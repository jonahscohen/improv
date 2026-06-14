"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convergencePreflight = convergencePreflight;
exports.evaluateCoverageRecordForTest = evaluateCoverageRecordForTest;
const flow_validation_capabilities_1 = require("./flow-validation-capabilities");
const validators_generated_1 = require("./validators.generated");
const project_collector_1 = require("./validators/project-collector");
const product_rule_registry_1 = require("./product-rule-registry");
const clean_evaluator_1 = require("./clean-evaluator");
// Component-source kinds that can bundle BOTH styles and markup (so a rule that
// cannot inspect one is still blind to applicable targets that could live inside it).
// A discovered file of one of these kinds NOT in a rule's support is applicable-but-
// unsupported - it cannot be allowed to hide behind a flat union.
const UI_COMPONENT_KINDS = new Set(['tsx', 'jsx', 'vue', 'svelte']);
async function convergencePreflight(projectPath, laneId) {
    const policy = (0, flow_validation_capabilities_1.getLanePolicy)(laneId);
    if (!policy || policy.requiredProductValidatorIds.length === 0) {
        return { ok: false, gaps: [], message: `convergence preflight: lane "${laneId}" has no release-floor policy (requiredProductValidatorIds)` };
    }
    const collected = await (0, project_collector_1.collectFromPath)(projectPath);
    // An unreadable directory could harbor an applicable file of ANY kind for ANY rule,
    // so the runtime (run-validator) treats it as a coverage gap for every static rule.
    // Mirror that here: an unreadable subtree is an unmeasured gap for EVERY required
    // record, so such a target is rejected before it can enter a permanently-inconclusive
    // loop. (Policy-skipped directories like node_modules/.git are intentional, not gaps.)
    const unreadableDirs = collected.discovered.filter((d) => d.sourceKind === 'directory' && d.outcome === 'unreadable');
    const gaps = [];
    for (const vId of policy.requiredProductValidatorIds) {
        const gen = validators_generated_1.GENERATED_VALIDATORS.find((g) => g.validatorId === vId);
        if (!gen) {
            gaps.push({ validatorId: vId, ruleId: '<generated-validator-missing>', missingRequirements: [], reason: 'missing_rule' });
            continue;
        }
        for (const rec of gen.cleanPolicy.requiredCoverageByScope) {
            // Build a CoverageObservation for THIS record only, then reuse P4a's
            // isCoverageSatisfied so preflight and runtime have identical AND/OR logic.
            // applicableFilesForRule includes supported inspected candidates plus
            // discovered UI-source files that the rule cannot inspect, so mixed-source
            // targets cannot hide an unsupported applicable file.
            const applicable = applicableFilesForRule((0, product_rule_registry_1.getRuleById)(rec.ruleId), collected);
            const obs = {
                ruleId: rec.ruleId,
                inspectedFiles: collected.inspectedFiles,
                discoveredApplicableFiles: applicable.map((f) => ({
                    file: f.path,
                    evidenceKindsPresent: f.outcome === 'inspected' ? [f.sourceKind] : [],
                })),
            };
            if (!(0, clean_evaluator_1.isCoverageSatisfied)(rec, obs))
                gaps.push(...exactGapsForRecord(vId, rec, applicable, collected.inspectedFiles));
            // An unreadable subtree is a gap for this required record even when the inspected
            // files otherwise satisfy coverage (the unread files could be uncovered).
            for (const d of unreadableDirs) {
                gaps.push({
                    validatorId: vId, ruleId: rec.ruleId, sourceFile: d.path, sourceKind: 'directory',
                    missingRequirements: rec.evidenceAlternativesByRequirement.map((alternatives, requirementIndex) => ({ requirementIndex, alternatives })),
                    reason: 'uninspected_applicable_file',
                });
            }
        }
    }
    if (gaps.length) {
        const detail = gaps.map(formatGap).join('; ');
        return { ok: false, gaps, message: `convergence preflight: required rules cannot be measured on this target - ${detail}` };
    }
    return { ok: true, gaps: [] };
}
// The discovered files applicable to ONE rule's coverage record. A file is applicable
// iff its source kind is declared in the rule's supportedSourceKinds (full/partial =
// measurable candidate, none = applicable-but-unsupported) OR it is a UI-component
// source kind the rule cannot inspect (could harbor applicable targets). Directories
// and unrelated kinds (e.g. a pure CSS file for a markup-only rule) are not applicable.
function applicableFilesForRule(rule, collected) {
    if (!rule)
        return [];
    const declared = new Set(rule.supportedSourceKinds.map((s) => s.kind));
    const out = [];
    for (const d of collected.discovered) {
        if (d.sourceKind === 'directory')
            continue;
        if (declared.has(d.sourceKind) || UI_COMPONENT_KINDS.has(d.sourceKind))
            out.push(d);
    }
    return out;
}
// Per-file AND/OR coverage check (mirrors clean-evaluator.isCoverageSatisfied per file).
function fileCovered(rec, f, inspected) {
    const kindsPresent = f.outcome === 'inspected' ? [f.sourceKind] : [];
    return inspected.has(f.path)
        && rec.evidenceAlternativesByRequirement.every((alts) => alts.length > 0 && alts.some((a) => kindsPresent.includes(a)));
}
function missingFamiliesFor(rec, presentKinds) {
    return rec.evidenceAlternativesByRequirement
        .map((alternatives, requirementIndex) => ({ requirementIndex, alternatives }))
        .filter((m) => !m.alternatives.some((a) => presentKinds.includes(a)));
}
// The exact gaps for an unsatisfied record. Each gap names the validator, the rule, the
// source file/kind when one is implicated, and each unsatisfied requirement family's
// alternatives. requireAll names every uncovered applicable file; requireAll=false
// reports the families no applicable file can provide.
function exactGapsForRecord(validatorId, rec, applicable, inspectedFiles) {
    const inspected = new Set(inspectedFiles);
    if (applicable.length === 0) {
        return [{
                validatorId, ruleId: rec.ruleId,
                missingRequirements: rec.evidenceAlternativesByRequirement.map((alternatives, requirementIndex) => ({ requirementIndex, alternatives })),
                reason: 'no_applicable_source',
            }];
    }
    if (rec.requireAllDiscoveredApplicableFiles) {
        const gaps = [];
        for (const f of applicable) {
            if (fileCovered(rec, f, inspected))
                continue;
            const kindsPresent = f.outcome === 'inspected' ? [f.sourceKind] : [];
            gaps.push({
                validatorId, ruleId: rec.ruleId, sourceFile: f.path, sourceKind: f.sourceKind,
                missingRequirements: missingFamiliesFor(rec, kindsPresent),
                reason: inspected.has(f.path) ? 'unsupported_source' : 'uninspected_applicable_file',
            });
        }
        return gaps;
    }
    // requireAll=false: satisfied iff ANY applicable file is covered; otherwise report the
    // families no applicable file's source kind can satisfy.
    if (applicable.some((f) => fileCovered(rec, f, inspected)))
        return [];
    const present = applicable.flatMap((f) => (f.outcome === 'inspected' ? [f.sourceKind] : []));
    return [{ validatorId, ruleId: rec.ruleId, missingRequirements: missingFamiliesFor(rec, present), reason: 'missing_evidence_requirement' }];
}
function formatGap(g) {
    const where = g.sourceFile ? ` (${g.sourceFile}${g.sourceKind ? `:${g.sourceKind}` : ''})` : '';
    const reqs = g.missingRequirements.map((m) => `req#${m.requirementIndex}[${m.alternatives.join('|')}]`).join(' AND ');
    return `${g.validatorId}/${g.ruleId}${where} needs ${reqs || 'a measurable source'} [${g.reason}]`;
}
// The tiny pure per-record seam the test drives directly. Production preflight reuses
// the same independent-record evaluation: AND across requirement families, OR within a
// family's alternatives, never a flattened union across records.
function evaluateCoverageRecordForTest(rec, files) {
    const presentKinds = files.filter((f) => f.outcome === 'inspected').map((f) => f.sourceKind);
    const missingRequirements = missingFamiliesFor(rec, presentKinds);
    return { ok: missingRequirements.length === 0, missingRequirements };
}
//# sourceMappingURL=lane-convergence-preflight.js.map