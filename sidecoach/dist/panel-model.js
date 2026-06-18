"use strict";
// Sidecoach panel view-model + assembler.
// Pure - no I/O. Turns the real run data (flow results + BuildReport + a little
// routing context) into the compact view-model the panel renderer formats. This
// is the data behind the "sidecoach . multi-lens audit" card from the marketing
// demo (marketing-site/demo.js .scd-sc), now driven by a real run.
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortFlowLabel = shortFlowLabel;
exports.assemblePanelModel = assemblePanelModel;
exports.laneStepToPanelModel = laneStepToPanelModel;
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
        partial: input.partial ?? !report,
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
    if (g && Array.isArray(g.validators)) {
        gates = GATE_DEFS.map((def) => {
            const v = g.validators.find((x) => def.match.test(x.validatorId));
            return { name: def.name, ok: v ? v.status === 'pass' : null };
        });
        const anyFail = g.validators.some((v) => /fail|error/i.test(v.status));
        verdict = g.status === 'pass' ? 'clean' : anyFail ? 'blocked' : 'warnings-only';
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
    };
}
//# sourceMappingURL=panel-model.js.map