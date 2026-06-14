"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeProductValidator = makeProductValidator;
exports.runValidatorForTest = runValidatorForTest;
const product_rule_types_1 = require("../product-rule-types");
const product_rule_registry_1 = require("../product-rule-registry");
const validators_generated_1 = require("../validators.generated");
const clean_evaluator_1 = require("../clean-evaluator");
const project_collector_1 = require("./project-collector");
const check_context_1 = require("./check-context");
function toCheckContext(c, raw) {
    const r = raw;
    return {
        cssText: c.cssText, markup: c.markup, files: c.files, discoveredFiles: c.discovered,
        computedStyle: r?.computedStyle, contrast: r?.contrast, designTokens: r?.designTokens, tasteOptions: r?.tasteOptions,
    };
}
function observationFor(x) {
    return {
        ruleId: x.result.ruleId,
        inspectedFiles: x.inspectedApplicableFiles,
        discoveredApplicableFiles: x.discoveredApplicableFiles,
    };
}
// The single execution/coverage source of truth (spec contract):
// 1. Browser-only rules have no static candidates -> run once (inconclusive), no coverage.
// 2. Static rules select candidate files by ACTUAL evidence presence (a css-rule file
//    must carry css text; a markup file must carry markup) so an html file with no
//    inline <style> never silently fails a css-rule check.
// 3. scope:file -> checkProduct once per applicable file via a one-file context;
//    scope:project -> checkProduct once over the assembled shape (the faithful source
//    scanner reasons over the page/project). Aggregate: any gap/inconclusive ->
//    inconclusive; else any fail -> fail; else any pass -> pass; else all N/A -> N/A.
// 4. A pass in one file can never cover a fail/gap in another applicable file.
async function executeRule(def, record, collected, raw, signal) {
    if (signal?.aborted)
        throw new AbortSentinel();
    const reqKind = def.evidenceRequirements[0];
    if (!(0, product_rule_types_1.isStaticallySatisfiable)(def.evidenceRequirements)) {
        // computed-style/dom/contrast: no static source can satisfy this until P4b.
        const result = def.checkProduct(toCheckContext(collected, raw));
        return { result, discoveredApplicableFiles: [], inspectedApplicableFiles: [], sufficientlyCovered: false };
    }
    const compatible = record
        ? new Set(record.evidenceAlternativesByRequirement.flat())
        : new Set((0, product_rule_types_1.sourceKindsForEvidence)([reqKind]));
    // Candidates are inspected files of a COMPATIBLE source kind - NOT only files that
    // already yielded extracted text. A compatible inspected file that carries an
    // applicable target but no usable evidence (e.g. an html/tsx with an uncovered
    // <button> and no inline <style>) still runs the check and surfaces inconclusive,
    // so the rule cannot be falsely reported measured/clean (Codex P1#1).
    const readable = collected.files.filter((f) => compatible.has(f.sourceKind));
    // Gaps force the rule inconclusive: an oversized/unreadable file of a compatible kind,
    // OR an unreadable directory subtree (sourceKind 'directory') - which could harbor
    // applicable files of ANY kind, so it is an unknown gap for every static rule (Codex
    // P1#2). Without the directory clause an unreadable subtree yielded a false clean.
    const gaps = collected.discovered.filter((d) => (d.outcome === 'oversized' && compatible.has(d.sourceKind))
        || (d.outcome === 'unreadable' && (d.sourceKind === 'directory' || compatible.has(d.sourceKind))));
    if (readable.length === 0 && gaps.length === 0) {
        return {
            result: (0, check_context_1.stampResult)(def, (0, check_context_1.inconclusive)(`no inspected ${reqKind} evidence for ${def.canonicalRuleKey}`, 'unreadable_input')),
            discoveredApplicableFiles: [], inspectedApplicableFiles: [], sufficientlyCovered: false,
        };
    }
    const perFile = [];
    if (def.scope === 'project') {
        const result = def.checkProduct(toCheckContext(collected, raw));
        for (const f of readable)
            perFile.push({ file: f, result });
    }
    else {
        for (const f of readable) {
            // Cooperatively yield BETWEEN FILES so the heartbeat timer can fire and an abort is
            // observed promptly even within a single rule scanning many files.
            if (signal?.aborted)
                throw new AbortSentinel();
            await yieldToEventLoop();
            const oneFile = {
                cssText: f.cssText, markup: f.markup, files: [f],
                tasteOptions: raw?.tasteOptions,
            };
            perFile.push({ file: f, result: def.checkProduct(oneFile) });
        }
    }
    const applicable = perFile.filter((p) => p.result.status !== 'not_applicable');
    const discoveredApplicableFiles = [
        ...applicable.map((p) => ({ file: p.file.path, evidenceKindsPresent: p.file.evidenceKindsPresent })),
        ...gaps.map((g) => ({ file: g.path, evidenceKindsPresent: [g.sourceKind] })),
    ];
    const inspectedApplicableFiles = applicable.map((p) => p.file.path);
    const statuses = applicable.map((p) => p.result.status);
    let status;
    let category;
    if (gaps.length > 0 || statuses.includes('inconclusive')) {
        status = 'inconclusive';
        category = applicable.find((p) => p.result.status === 'inconclusive')?.result.normalizedErrorCategory ?? 'unreadable_input';
    }
    else if (statuses.includes('fail')) {
        status = 'fail';
    }
    else if (statuses.includes('pass')) {
        status = 'pass';
    }
    else {
        status = 'not_applicable';
    }
    const contributing = applicable.filter((p) => status === 'inconclusive' ? p.result.status === 'inconclusive'
        : status === 'fail' ? p.result.status === 'fail'
            : status === 'pass' ? p.result.status === 'pass'
                : true);
    const evidenceLocations = [...new Set(contributing.flatMap((p) => p.result.evidenceLocations))];
    const message = contributing.map((p) => p.result.message).find(Boolean)
        ?? (status === 'inconclusive' ? `unread ${reqKind} evidence for ${def.canonicalRuleKey}` : `${def.canonicalRuleKey}: ${status}`);
    const remediation = contributing.map((p) => p.result.remediation).find((m) => !!m);
    const result = {
        ruleId: def.ruleId, canonicalRuleKey: def.canonicalRuleKey, status,
        normalizedErrorCategory: status === 'inconclusive' ? category : undefined,
        severity: def.severity, findingClass: def.findingClass,
        evidenceKind: def.evidenceRequirements[0], evidenceLocations, message, remediation,
    };
    const exec = { result, discoveredApplicableFiles, inspectedApplicableFiles, sufficientlyCovered: false };
    exec.sufficientlyCovered = status !== 'inconclusive' && (0, clean_evaluator_1.isCoverageSatisfied)(record, observationFor(exec));
    return exec;
}
function emptyRun() {
    return { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [], measuredScope: [], unverifiedScope: [] };
}
// Cooperative yield to the EVENT LOOP (a macrotask, not a microtask): returns control
// so setInterval timers - notably the lease heartbeat - can fire between files/rules. A
// microtask (Promise.resolve) would NOT let timers run; setImmediate does.
function yieldToEventLoop() { return new Promise((r) => setImmediate(r)); }
async function runDetailed(validatorId, context, signal) {
    const gen = validators_generated_1.GENERATED_VALIDATORS.find((v) => v.validatorId === validatorId);
    const policy = gen?.cleanPolicy;
    if (!gen || !policy) {
        const result = (0, clean_evaluator_1.evaluateCleanPolicy)({ validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
            validatorError: { category: 'registry_fault', message: `no generated validator for ${validatorId}` } }, { requiredRuleIds: [], blockingSeverities: ['blocker', 'major'], toleratedFindingCounts: {}, requiredCoverageByScope: [], inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report' });
        return { result, executions: [], coverageObservations: [], runCoverage: emptyRun() };
    }
    let collected;
    try {
        collected = await (0, project_collector_1.collect)(context, signal);
    }
    catch (e) {
        if (e instanceof project_collector_1.CollectionAbortedError)
            return abortedDetail(validatorId); // aborted DURING collection
        const result = (0, clean_evaluator_1.evaluateCleanPolicy)({ validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
            validatorError: { category: 'unreadable_input', message: String(e instanceof Error ? e.message : e) } }, policy);
        return { result, executions: [], coverageObservations: [], runCoverage: emptyRun() };
    }
    if (signal?.aborted)
        return abortedDetail(validatorId);
    const recordById = new Map(policy.requiredCoverageByScope.map((c) => [c.ruleId, c]));
    const defs = gen.ownedRuleIds
        .map((id) => (0, product_rule_registry_1.getRuleById)(id))
        .filter((d) => !!d && typeof d.checkProduct === 'function');
    const executions = [];
    try {
        for (const d of defs) {
            // Cooperatively yield BETWEEN RULES so the heartbeat keeps firing and abort is
            // observed promptly across a long synchronous validator run.
            if (signal?.aborted)
                return abortedDetail(validatorId);
            await yieldToEventLoop();
            executions.push(await executeRule(d, recordById.get(d.ruleId), collected, context, signal));
        }
    }
    catch (e) {
        if (e instanceof AbortSentinel)
            return abortedDetail(validatorId);
        throw e;
    }
    const rules = executions.map((x) => x.result);
    const coverageObservations = executions
        .filter((x) => policy.requiredRuleIds.includes(x.result.ruleId))
        .map(observationFor);
    const supportedSourceKinds = [...new Set(collected.files.map((f) => f.sourceKind))];
    const unsupportedSourceKinds = [...new Set(collected.discovered.filter((d) => d.outcome === 'unsupported').map((d) => d.sourceKind))];
    const measuredScope = [...new Set(executions
            .filter((x) => x.sufficientlyCovered && x.result.status !== 'inconclusive')
            .map((x) => (0, product_rule_registry_1.getRuleById)(x.result.ruleId).registryScope))];
    const runCoverage = {
        inspectedFiles: collected.inspectedFiles,
        skippedFiles: collected.skippedFiles,
        supportedSourceKinds, unsupportedSourceKinds,
        measuredScope,
        unverifiedScope: gen.registryScope.filter((s) => !measuredScope.includes(s)),
    };
    const result = (0, clean_evaluator_1.evaluateCleanPolicy)({ validatorId, rules, coverageObservations, runCoverage }, policy);
    return { result, executions, coverageObservations, runCoverage };
}
function makeProductValidator(validatorId) {
    // The public entry is ASYNC with cooperative abort: it checks the signal at entry,
    // yields so an abort fired during this tick is observed, then runs the cooperatively
    // async core (runDetailed), which yields + re-checks the signal between files and rules
    // so a long run cannot block the heartbeat / delay abort.
    return async function validateProduct(context, signal) {
        if (signal?.aborted)
            return abortedResult(validatorId);
        await Promise.resolve();
        if (signal?.aborted)
            return abortedResult(validatorId);
        return (await runDetailed(validatorId, context, signal)).result;
    };
}
// An aborted validator run maps to a validator-level error (category 'aborted') - the
// same shape the lease protocol expects when ownership is lost mid-execute.
function abortedResult(validatorId) {
    return (0, clean_evaluator_1.evaluateCleanPolicy)({ validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
        validatorError: { category: 'aborted', message: 'validation aborted (lease lost / cancelled)' } }, { requiredRuleIds: [], blockingSeverities: ['blocker', 'major'], toleratedFindingCounts: {}, requiredCoverageByScope: [], inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report' });
}
function abortedDetail(validatorId) {
    return { result: abortedResult(validatorId), executions: [], coverageObservations: [], runCoverage: emptyRun() };
}
// Sentinel thrown by the per-rule abort check inside runDetailed's execution loop.
class AbortSentinel extends Error {
}
// Test seam: exposes the internal executions/observations/coverage so the pipeline
// suite can assert per-file execution and coverage WITHOUT duplicating the algorithm.
// Async now that runDetailed yields cooperatively.
function runValidatorForTest(validatorId, context) {
    return runDetailed(validatorId, context);
}
//# sourceMappingURL=run-validator.js.map