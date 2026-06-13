"use strict";
// Lane flow-sequence derivation (spec section 2).
//
// Derives, from the verb-command registry, each lane's EXECUTED FLOW SEQUENCE
// (flows in verb-chain order, each flow once, first owning verb) plus the
// verb-guidance map. Lives inside the engine rootDir (./src) so the derivation
// test can import it without crossing rootDir (a src/ test importing
// scripts/generate-lanes.ts breaks `tsc` with TS6059). The generator
// (scripts/generate-lanes.ts) imports these same functions.
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveFlowSequence = deriveFlowSequence;
exports.deriveVerbGuidance = deriveVerbGuidance;
exports.deriveVerbSteps = deriveVerbSteps;
const verb_command_registry_1 = require("./verb-command-registry");
/** Flows for a verb chain in verb order, each flow once, first owning verb. */
function deriveFlowSequence(verbChain) {
    const seen = new Set();
    const seq = [];
    for (const verb of verbChain) {
        const entry = verb_command_registry_1.VERB_REGISTRY[verb];
        if (!entry)
            throw new Error(`unknown verb in chain: ${verb}`);
        for (const f of entry.flowIds) {
            if (!seen.has(f)) {
                seen.add(f);
                seq.push(f);
            }
        }
    }
    return seq;
}
/** Per-verb guidance lines for a chain, in chain order. */
function deriveVerbGuidance(verbChain) {
    return verbChain.map((v) => {
        const entry = verb_command_registry_1.VERB_REGISTRY[v];
        if (!entry)
            throw new Error(`unknown verb in chain: ${v}`);
        return { verb: v, guidance: entry.guidanceAppend };
    });
}
// First-owner assignment: a flow shared by two verbs is assigned to the FIRST
// verb in verbChain that owns it (so the union of nonempty step flows == the
// already-derived flowSequence). A verb whose flows were all claimed earlier
// yields an EMPTY-flow guidance-only step - that is legal and intentional.
function deriveVerbSteps(verbChain, flowSequence, verbGuidance) {
    const claimed = new Set();
    const guidanceByVerb = new Map(verbGuidance.map((g) => [g.verb, g.guidance]));
    return verbChain.map((verb) => {
        const entry = verb_command_registry_1.VERB_REGISTRY[verb];
        // Unknown verb -> hard error (a malformed chain). This is distinct from a
        // KNOWN verb whose flows were all claimed by an earlier verb: that yields a
        // legal EMPTY-flow guidance-only step (first-owner assignment), NOT an error.
        if (!entry)
            throw new Error(`deriveVerbSteps: unknown verb in chain: ${verb}`);
        const verbFlows = entry.flowIds;
        const flowIds = flowSequence.filter((f) => verbFlows.includes(f) && !claimed.has(f));
        flowIds.forEach((f) => claimed.add(f));
        return { verb, flowIds, guidance: guidanceByVerb.get(verb) ?? [] };
    });
}
//# sourceMappingURL=lane-derivation.js.map