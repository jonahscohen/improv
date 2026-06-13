// Lane flow-sequence derivation (spec section 2).
//
// Derives, from the verb-command registry, each lane's EXECUTED FLOW SEQUENCE
// (flows in verb-chain order, each flow once, first owning verb) plus the
// verb-guidance map. Lives inside the engine rootDir (./src) so the derivation
// test can import it without crossing rootDir (a src/ test importing
// scripts/generate-lanes.ts breaks `tsc` with TS6059). The generator
// (scripts/generate-lanes.ts) imports these same functions.

import { VERB_REGISTRY } from './verb-command-registry';
import type { FlowId } from './types';

/** Flows for a verb chain in verb order, each flow once, first owning verb. */
export function deriveFlowSequence(verbChain: string[]): FlowId[] {
  const seen = new Set<string>();
  const seq: FlowId[] = [];
  for (const verb of verbChain) {
    const entry = (VERB_REGISTRY as any)[verb];
    if (!entry) throw new Error(`unknown verb in chain: ${verb}`);
    for (const f of entry.flowIds as FlowId[]) {
      if (!seen.has(f)) { seen.add(f); seq.push(f); }
    }
  }
  return seq;
}

/** Per-verb guidance lines for a chain, in chain order. */
export function deriveVerbGuidance(verbChain: string[]): { verb: string; guidance: string[] }[] {
  return verbChain.map((v) => {
    const entry = (VERB_REGISTRY as any)[v];
    if (!entry) throw new Error(`unknown verb in chain: ${v}`);
    return { verb: v, guidance: entry.guidanceAppend as string[] };
  });
}

// First-owner assignment: a flow shared by two verbs is assigned to the FIRST
// verb in verbChain that owns it (so the union of nonempty step flows == the
// already-derived flowSequence). A verb whose flows were all claimed earlier
// yields an EMPTY-flow guidance-only step - that is legal and intentional.
export function deriveVerbSteps(
  verbChain: string[], flowSequence: FlowId[],
  verbGuidance: { verb: string; guidance: string[] }[],
): { verb: string; flowIds: FlowId[]; guidance: string[] }[] {
  const claimed = new Set<FlowId>();
  const guidanceByVerb = new Map(verbGuidance.map((g) => [g.verb, g.guidance]));
  return verbChain.map((verb) => {
    const entry = (VERB_REGISTRY as any)[verb];
    const verbFlows: FlowId[] = entry ? (entry.flowIds as FlowId[]) : [];
    const flowIds = flowSequence.filter((f) => verbFlows.includes(f) && !claimed.has(f));
    flowIds.forEach((f) => claimed.add(f));
    return { verb, flowIds, guidance: guidanceByVerb.get(verb) ?? [] };
  });
}
