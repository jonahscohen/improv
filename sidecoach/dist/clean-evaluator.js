"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCoverageSatisfied = isCoverageSatisfied;
exports.evaluateCleanPolicy = evaluateCleanPolicy;
const product_rule_registry_1 = require("./product-rule-registry");
// A discovered applicable file is covered only when it was inspected AND every
// evidence requirement has at least one compatible kind available for THAT file.
// The evidence test is AND across requirements, OR within a requirement's
// alternatives. Global aggregation is forbidden because it could hide an
// uncovered file (spec 526-533).
function isCoverageSatisfied(record, obs) {
    if (!record || !obs)
        return false;
    if (record.evidenceAlternativesByRequirement.length === 0)
        return false;
    const fileIsCovered = (f) => obs.inspectedFiles.includes(f.file)
        && record.evidenceAlternativesByRequirement.every((alts) => alts.length > 0 && alts.some((alt) => f.evidenceKindsPresent.includes(alt)));
    return record.requireAllDiscoveredApplicableFiles
        ? obs.discoveredApplicableFiles.length > 0 && obs.discoveredApplicableFiles.every(fileIsCovered)
        : obs.discoveredApplicableFiles.some(fileIsCovered);
}
function toFinding(validatorId, r) {
    return {
        validatorId, ruleId: r.ruleId, canonicalRuleKey: r.canonicalRuleKey,
        severity: r.severity, findingClass: r.findingClass,
        evidenceLocations: r.evidenceLocations, message: r.message, remediation: r.remediation,
    };
}
// Synthesize a required rule the validator did not cleanly produce. Looks up the
// REAL definition for severity/findingClass/canonicalRuleKey - never fabricates a
// severity. evaluateCleanPolicy preflights every required id through getRuleById
// and returns a registry_fault ERROR before this is ever reached, so the
// definition is guaranteed to exist for any reqId we synthesize here. (The
// previous advisory-fabrication fallback for a missing definition is gone; a
// genuinely unknown required rule is now a validator-level error, not a fudged
// inconclusive.)
function synthInconclusive(reqId, message, category) {
    const def = (0, product_rule_registry_1.getRuleById)(reqId);
    return {
        ruleId: reqId, canonicalRuleKey: def.canonicalRuleKey, status: 'inconclusive',
        normalizedErrorCategory: category, severity: def.severity, findingClass: def.findingClass,
        evidenceLocations: [], message,
    };
}
function baseCoverage(run) {
    return {
        inspectedFiles: run.inspectedFiles, skippedFiles: run.skippedFiles,
        supportedSourceKinds: run.supportedSourceKinds, unsupportedSourceKinds: run.unsupportedSourceKinds,
        ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
        findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 },
        measuredScope: run.measuredScope, unverifiedScope: run.unverifiedScope,
        discoveredFiles: run.discoveredFiles, unreadableFiles: run.unreadableFiles, unsupportedFiles: run.unsupportedFiles,
    };
}
function ruleCounts(effective) {
    return {
        pass: effective.filter((x) => x.status === 'pass').length,
        fail: effective.filter((x) => x.status === 'fail').length,
        notApplicable: effective.filter((x) => x.status === 'not_applicable').length,
        inconclusive: effective.filter((x) => x.status === 'inconclusive').length,
    };
}
function evaluateCleanPolicy(input, policy) {
    const run = input.runCoverage;
    // 1. validator-level error -> STOP. findings empty; coverage still reproducible.
    if (input.validatorError) {
        return {
            status: 'error', rules: input.rules, findings: [], coverage: baseCoverage(run),
            normalizedErrorCategory: input.validatorError.category, error: input.validatorError.message,
        };
    }
    // 1b. REGISTRY PREFLIGHT (P1). A required ruleId with NO registry definition is
    //     a TRUE registry fault, not an inconclusive: it is a validator-level ERROR
    //     returned BEFORE any non-vacuity / coverage logic. (Distinct from a
    //     required id that IS in the registry but produced no result this run -
    //     that stays the inconclusive case synthesized in step 3 from real metadata.)
    const unknownRequired = policy.requiredRuleIds.filter((id) => !(0, product_rule_registry_1.getRuleById)(id));
    if (unknownRequired.length > 0) {
        return {
            status: 'error', rules: input.rules, findings: [], coverage: baseCoverage(run),
            normalizedErrorCategory: 'registry_fault',
            error: `required rule(s) have no registry definition: ${unknownRequired.join(', ')}`,
        };
    }
    const required = new Set(policy.requiredRuleIds);
    const recordById = new Map(policy.requiredCoverageByScope.map((c) => [c.ruleId, c]));
    const obsById = new Map(input.coverageObservations.map((o) => [o.ruleId, o]));
    // duplicate results are ambiguous - do NOT collapse silently via Map (NEW P2).
    const occurrence = new Map();
    for (const r of input.rules)
        occurrence.set(r.ruleId, (occurrence.get(r.ruleId) ?? 0) + 1);
    const duplicated = new Set([...occurrence].filter(([, n]) => n > 1).map(([id]) => id));
    const byId = new Map(input.rules.map((r) => [r.ruleId, r]));
    // 2. NON-VACUITY runs BEFORE coverage (spec 567-575). A required rule is
    //    "measurable" unless its produced result is not_applicable (applicability /
    //    target-scope exclusion). A MISSING required rule is still declared-
    //    measurable (it becomes inconclusive in step 4; it is not excluded here).
    //    A DUPLICATED required rule is ALSO always measurable (P2): otherwise the
    //    last-occurrence-wins `byId` lookup makes [fail, not_applicable] vacuously
    //    drop the fail while [not_applicable, fail] synthesizes inconclusive - an
    //    order-sensitive bug. Treating it as measurable routes BOTH orders through
    //    step 3's deterministic single-inconclusive collapse.
    //    No measurable required rule -> inconclusive, with NO coverage logic run.
    const measurableRequiredIds = policy.requiredRuleIds.filter((id) => duplicated.has(id) || byId.get(id)?.status !== 'not_applicable');
    if (measurableRequiredIds.length === 0) {
        // findings can still come from present non-required, non-duplicated fails (P1-1).
        const naFindings = input.rules
            .filter((r) => !required.has(r.ruleId) && !duplicated.has(r.ruleId) && r.status === 'fail')
            .map((r) => toFinding(input.validatorId, r));
        return { status: 'inconclusive', rules: input.rules, findings: naFindings, coverage: { ...baseCoverage(run), ruleCounts: ruleCounts(input.rules) } };
    }
    // 3. COVERAGE + EFFECTIVE rule set (only now that non-vacuity has passed). Over
    //    EVERY required rule: missing / duplicated / coverage-gapped required rules
    //    are synthesized inconclusive, not ignored; present non-required rules carry
    //    through.
    const effective = [];
    for (const reqId of policy.requiredRuleIds) {
        if (duplicated.has(reqId)) {
            effective.push(synthInconclusive(reqId, `duplicate results for required rule ${reqId}`, 'rule_exception'));
            continue;
        }
        const r = byId.get(reqId);
        if (!r) {
            effective.push(synthInconclusive(reqId, `required rule ${reqId} produced no result`, 'rule_exception'));
            continue;
        }
        if (r.status === 'not_applicable') {
            effective.push(r);
            continue;
        }
        if (!isCoverageSatisfied(recordById.get(reqId), obsById.get(reqId))) {
            effective.push({ ...r, status: 'inconclusive', normalizedErrorCategory: r.normalizedErrorCategory ?? 'unreadable_input', message: `coverage gap for required rule ${reqId}` });
            continue;
        }
        effective.push(r);
    }
    const emittedDup = new Set();
    for (const r of input.rules) {
        if (required.has(r.ruleId))
            continue;
        if (duplicated.has(r.ruleId)) {
            if (emittedDup.has(r.ruleId))
                continue;
            emittedDup.add(r.ruleId);
            effective.push({ ...r, status: 'inconclusive', normalizedErrorCategory: 'rule_exception', message: `duplicate results for rule ${r.ruleId}` });
            continue;
        }
        effective.push(r);
    }
    // materialize findings from EVERY effective fail, BEFORE any early return (P1-1).
    const findings = effective.filter((r) => r.status === 'fail').map((r) => toFinding(input.validatorId, r));
    const rc = ruleCounts(effective);
    // 4. block on any REQUIRED applicable rule that is inconclusive (non-vacuity in
    //    step 2 guarantees this set is non-empty, so a vacuous run never reaches here).
    const requiredApplicable = effective.filter((r) => required.has(r.ruleId) && r.status !== 'not_applicable');
    if (requiredApplicable.some((r) => r.status === 'inconclusive')) {
        return { status: 'inconclusive', rules: effective, findings, coverage: { ...baseCoverage(run), ruleCounts: rc } };
    }
    // 5/6. count blocking fails by (severity,class) vs tolerance.
    let blockingExcess = 0, withinTolerance = 0, nonBlocking = 0;
    const counts = new Map();
    for (const r of effective) {
        if (r.status !== 'fail')
            continue;
        if (!policy.blockingSeverities.includes(r.severity)) {
            nonBlocking++;
            continue;
        }
        const key = `${r.severity}|${r.findingClass}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, n] of counts) {
        const T = policy.toleratedFindingCounts[key] ?? 0;
        withinTolerance += Math.min(n, T);
        blockingExcess += Math.max(0, n - T);
    }
    // 7. clean unless blockingExcess > 0; findings PRESERVED for every status. The
    //    status literal narrows to the ProductValidationOk variant of the union.
    const status = blockingExcess > 0 ? 'findings' : 'clean';
    return {
        status, rules: effective, findings,
        coverage: { ...baseCoverage(run), ruleCounts: rc, findingCounts: { blockingExcess, withinTolerance, nonBlocking } },
    };
}
//# sourceMappingURL=clean-evaluator.js.map