"use strict";
// Tool: sidecoach_classify_intent. Natural prompt classification for lanes.
// Classify a natural prompt against the sidecoach lane registry, returning the
// full classifier union: ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB |
// NUDGE_ELIGIBLE | SILENT. Eligibility for the advisory nudge is computed from
// sidecoach-intent.json; the cooldown that maps NUDGE_ELIGIBLE -> NUDGE/SILENT is
// owned by the Python hook and is NEVER read or mutated here.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const keyword_resolver_1 = require("../keyword-resolver");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_classify_intent',
    description: 'Classify a natural prompt against the sidecoach lane registry using the same grouped scoring, ' +
        'clause binding, and occurrence-aware suppression as the UserPromptSubmit hook. Returns one of ' +
        'ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB | NUDGE_ELIGIBLE | SILENT, plus laneScores, ' +
        'evidence ids, the winning lane/label, and any matched verb. NUDGE_ELIGIBLE is returned as-is; the ' +
        'cooldown that decides NUDGE vs SILENT belongs to the hook and is never read or mutated here.',
    inputSchema: schemas_1.classifyIntentShape,
    timeoutMs: 5000,
};
const handler = async (input, deps) => {
    const lanes = deps.registries.lanes;
    if (!lanes) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', 'lane registry not loaded (sidecoach-lanes.json missing or structure-invalid) - lane tier disabled', { resource: 'claude/hooks/sidecoach-lanes.json' });
    }
    const verbs = deps.registries.verbs?.verbs ?? [];
    const intentReg = deps.registries.intent;
    const eligible = (0, keyword_resolver_1.intentEligible)(input.prompt, intentReg);
    const decision = (0, keyword_resolver_1.classifyIntent)(input.prompt, lanes.registry, verbs, { intentEligible: eligible });
    let winningLabel;
    if (decision.winningLane) {
        const lane = lanes.registry.lanes.find((l) => l.lane === decision.winningLane);
        winningLabel = lane ? lane.label : decision.winningLane;
    }
    const nudge = decision.outcome === 'NUDGE_ELIGIBLE' && intentReg && typeof intentReg.nudge === 'string'
        ? intentReg.nudge
        : undefined;
    return {
        data: { decision, winningLabel, nudge },
        summary: `sidecoach_classify_intent: ${decision.outcome}${decision.winningLane ? ` -> ${winningLabel}` : ''}`,
    };
};
exports.handler = handler;
//# sourceMappingURL=classify-intent.js.map