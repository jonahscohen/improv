// Tool: sidecoach_classify_intent. Natural prompt classification for lanes.
// Classify a natural prompt against the sidecoach lane registry, returning the
// full classifier union: ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB |
// NUDGE_ELIGIBLE | SILENT. Eligibility for the advisory nudge is computed from
// sidecoach-intent.json; the cooldown that maps NUDGE_ELIGIBLE -> NUDGE/SILENT is
// owned by the Python hook and is NEVER read or mutated here.

import { classifyIntent, intentEligible } from '../keyword-resolver';
import { SidecoachToolError } from '../errors';
import { classifyIntentShape, type ClassifyIntentInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof classifyIntentShape> = {
  name: 'sidecoach_classify_intent',
  description:
    'Classify a natural prompt against the sidecoach lane registry using the same grouped scoring, ' +
    'clause binding, and occurrence-aware suppression as the UserPromptSubmit hook. Returns one of ' +
    'ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB | NUDGE_ELIGIBLE | SILENT, plus laneScores, ' +
    'evidence ids, the winning lane/label, and any matched verb. NUDGE_ELIGIBLE is returned as-is; the ' +
    'cooldown that decides NUDGE vs SILENT belongs to the hook and is never read or mutated here.',
  inputSchema: classifyIntentShape,
  timeoutMs: 5_000,
};

export const handler: ToolHandler<ClassifyIntentInputT> = async (input, deps) => {
  const lanes = deps.registries.lanes;
  if (!lanes) {
    throw new SidecoachToolError(
      'DOWNSTREAM_UNAVAILABLE',
      'lane registry not loaded (sidecoach-lanes.json missing or structure-invalid) - lane tier disabled',
      { resource: 'claude/hooks/sidecoach-lanes.json' },
    );
  }
  const verbs = deps.registries.verbs?.verbs ?? [];
  const intentReg = deps.registries.intent;
  const eligible = intentEligible(input.prompt, intentReg);
  const decision = classifyIntent(input.prompt, lanes.registry, verbs, { intentEligible: eligible });

  let winningLabel: string | undefined;
  if (decision.winningLane) {
    const lane = lanes.registry.lanes.find((l: any) => l.lane === decision.winningLane);
    winningLabel = lane ? lane.label : decision.winningLane;
  }
  const nudge =
    decision.outcome === 'NUDGE_ELIGIBLE' && intentReg && typeof intentReg.nudge === 'string'
      ? (intentReg.nudge as string)
      : undefined;

  return {
    data: { decision, winningLabel, nudge },
    summary: `sidecoach_classify_intent: ${decision.outcome}${decision.winningLane ? ` -> ${winningLabel}` : ''}`,
  };
};
