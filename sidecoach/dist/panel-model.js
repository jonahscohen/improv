"use strict";
// Sidecoach panel view-model + assembler.
// Pure - no I/O. Turns the real run data (flow results + BuildReport + a little
// routing context) into the compact view-model the panel renderer formats. This
// is the data behind the "sidecoach . multi-lens audit" card from the marketing
// demo (marketing-site/demo.js .scd-sc), now driven by a real run.
Object.defineProperty(exports, "__esModule", { value: true });
exports.coverageForVerdict = coverageForVerdict;
exports.shortFlowLabel = shortFlowLabel;
exports.assemblePanelModel = assemblePanelModel;
exports.laneStepToPanelModel = laneStepToPanelModel;
// A terminal verdict maps to a coverage banner; an absent verdict (in-progress or measured-nothing)
// maps to undefined, so the card shows no coverage claim until there is a real one to make. This is
// the FULL-COVERAGE mapping only - callers downgrade to 'not-fully-checked' when a run is partial or
// its gate was inconclusive/error (see assemblePanelModel and laneStepToPanelModel).
function coverageForVerdict(verdict) {
    if (!verdict)
        return undefined;
    return verdict === 'clean' ? 'verified-clean' : 'checked';
}
// The three QA gates the panel shows, matched against BuildReport findings by a
// substring of the finding's source / rule / flowId. A gate is "failed" when a
// blocking-or-warning finding is attributed to it.
const GATE_DEFS = [
    { name: 'taste', match: /taste/i },
    { name: 'claudemd', match: /claude\.?md|clausemd|mandate/i },
    { name: 'polish', match: /polish/i },
];
// "Multi-Lens Audit (5 dimensions)" -> "multi-lens audit". With only an id, derive
// a readable label: "flowK_multi_lens_audit" -> "multi lens audit".
function shortFlowLabel(flowName, flowId) {
    if (flowName && flowName !== flowId) {
        return flowName.replace(/\s*\(.*\)\s*$/, '').trim().toLowerCase();
    }
    const fromId = String(flowId).replace(/^flow[a-z0-9]+_/i, '').replace(/_/g, ' ').trim().toLowerCase();
    return fromId || String(flowId);
}
function assemblePanelModel(input) {
    const { flowResults, report } = input;
    const headline = input.headlineFlowId
        ? flowResults.find((r) => String(r.flowId) === input.headlineFlowId)
        : flowResults[flowResults.length - 1];
    const flowName = headline ? headline.flowName : report?.composite ?? 'sidecoach';
    const flowId = headline ? String(headline.flowId) : report?.composite ?? '';
    const chain = flowResults.map((r) => shortFlowLabel(r.flowName, String(r.flowId)));
    const checklist = flowResults.map((r) => ({
        label: shortFlowLabel(r.flowName, String(r.flowId)),
        done: r.status === 'success' || r.status === 'skipped',
    }));
    // Dims: explicit wins; otherwise use the headline flow's own checklist labels.
    let dims = input.dims;
    if (!dims && headline && Array.isArray(headline.checklist) && headline.checklist.length > 0) {
        dims = headline.checklist.map((c) => c.label);
    }
    const findings = report ? report.severityCounts.blocking + report.severityCounts.warning : undefined;
    const gates = GATE_DEFS.map((g) => {
        if (report) {
            const hit = report.findings.some((f) => f.severity !== 'info' &&
                (g.match.test(f.source) || g.match.test(f.rule) || g.match.test(String(f.flowId))));
            return { name: g.name, ok: !hit };
        }
        return { name: g.name, ok: input.ranGates ? true : null };
    });
    // Codex 2026-08-25: coverage must never certify without positive evidence of a COMPLETE run.
    //  - auditPartial (Med): a rendered audit that scanned but a lens did not run -> 'partially-checked'
    //    (incomplete coverage, never an unqualified CHECKED), even when it produced findings.
    //  - forced/partial snapshot (Med): an INCOMPLETE snapshot with a clean verdict is not proof both
    //    lenses ran clean -> 'not-fully-checked', never 'verified-clean'.
    //  - a run with no verdict at all makes no claim (undefined).
    const isPartial = input.partial ?? !report;
    let coverage;
    if (input.auditPartial && report?.verdict) {
        coverage = 'partially-checked';
    }
    else if (isPartial) {
        coverage = report?.verdict ? 'not-fully-checked' : undefined;
    }
    else {
        coverage = coverageForVerdict(report?.verdict);
    }
    return {
        verb: input.verb,
        flowName,
        flowId,
        confidence: input.confidence,
        chain,
        checklist,
        dims,
        gates,
        verdict: report?.verdict,
        grade: report?.overallGrade,
        findings,
        partial: isPartial,
        notice: input.notice,
        coverage,
    };
}
function laneStepToPanelModel(step) {
    const ids = (step.flowIds || []).map((x) => String(x));
    const chain = ids.map((id) => shortFlowLabel('', id));
    const checklist = ids.map((id) => {
        const items = (step.checklist || []).filter((c) => c.id === id || c.id.startsWith(`${id}:`));
        return { label: shortFlowLabel('', id), done: items.length > 0 && items.every((c) => c.completed) };
    });
    const g = step.gate;
    let gates;
    let verdict;
    let findings;
    let coverage;
    if (g && Array.isArray(g.validators)) {
        gates = GATE_DEFS.map((def) => {
            const v = g.validators.find((x) => def.match.test(x.validatorId));
            return { name: def.name, ok: v ? v.status === 'pass' : null };
        });
        // GateStatus is clean|findings|inconclusive|error (lane-types.ts). Codex 2026-08-25: VERIFIED
        // CLEAN requires positive evidence that checks ACTUALLY RAN and found nothing.
        //  - (High) an inconclusive OR error gate did NOT complete a check -> no verdict, 'not-fully-checked'.
        //  - (High) a 'clean' gate with ZERO validators ran NOTHING (e.g. `shape` -> flowA_brand_verify has
        //    no product validators; the lane aggregates an empty list as 'clean'). An empty run is "nothing
        //    was measured", never verified-clean -> no verdict, 'not-fully-checked'. verified-clean demands
        //    validators.length > 0 AND all clean. Err toward not certifying.
        const gateStatus = String(g.status || '');
        if (gateStatus === 'inconclusive' || gateStatus === 'error' || g.validators.length === 0) {
            verdict = undefined;
            coverage = 'not-fully-checked';
        }
        else {
            const anyFail = g.validators.some((v) => /fail|error|inconclusive/i.test(v.status));
            verdict = gateStatus === 'pass' || gateStatus === 'clean' ? 'clean' : anyFail ? 'blocked' : 'warnings-only';
            coverage = coverageForVerdict(verdict);
        }
        findings = Array.isArray(g.findings)
            ? g.findings.length
            : Array.isArray(step.convergence?.findings)
                ? step.convergence.findings.length
                : undefined;
    }
    else {
        gates = GATE_DEFS.map((def) => ({ name: def.name, ok: null }));
    }
    return {
        verb: step.currentVerb,
        flowName: ids.length > 0 ? shortFlowLabel('', ids[0]) : 'sidecoach',
        flowId: ids.length > 0 ? ids[ids.length - 1] : '',
        chain,
        checklist,
        gates,
        verdict,
        findings,
        partial: !g,
        coverage,
    };
}
//# sourceMappingURL=panel-model.js.map