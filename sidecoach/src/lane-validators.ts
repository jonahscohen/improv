// sidecoach/src/lane-validators.ts
import type { FlowId } from './types';
import type { GateStatus } from './lane-types';
import { getFlowCapability, getLanePolicy } from './flow-validation-capabilities';
import { getLane } from './lanes.generated';

// A sequence step that maps to multiple flows gates on the UNION (de-duplicated,
// order-preserving) of those flows' bound productValidatorIds (spec line 351-353).
export function validatorsForStep(step: { flowIds: FlowId[] }): string[] {
  const ids: string[] = [];
  for (const f of step.flowIds) {
    const cap = getFlowCapability(f as string);
    for (const v of cap?.productValidatorIds ?? []) if (!ids.includes(v)) ids.push(v);
  }
  return ids;
}

// Total order, worst-first: a gate machinery failure (error) is loudest because the
// gate could not be evaluated at all; a confirmed blocking defect (findings) outranks
// an unverified gap (inconclusive); clean is best. No bound validators -> clean
// (the step is vacuously gated - nothing required it).
const RANK: Record<GateStatus, number> = { clean: 0, inconclusive: 1, findings: 2, error: 3 };
export function aggregateWorstStatus(statuses: GateStatus[]): GateStatus {
  let worst: GateStatus = 'clean';
  for (const s of statuses) if (RANK[s] > RANK[worst]) worst = s;
  return worst;
}

export interface GateOutcome { proceed: boolean; stepStatus?: 'validation_failed' | 'validation_inconclusive' | 'validation_error'; }
export function mapGateStatusToOutcome(status: GateStatus): GateOutcome {
  switch (status) {
    case 'clean': return { proceed: true };
    case 'findings': return { proceed: false, stepStatus: 'validation_failed' };
    case 'inconclusive': return { proceed: false, stepStatus: 'validation_inconclusive' };
    case 'error': return { proceed: false, stepStatus: 'validation_error' };
  }
}

// A lane runs as a loop iff its generated executionKind is 'loop'. Unknown lane -> false.
export function isLoopLane(laneId: string): boolean {
  return getLane(laneId)?.executionKind === 'loop';
}

// The required-validator gate for a LOOP lane's iteration boundary: the explicit
// LaneValidationPolicy.requiredProductValidatorIds (the release floor), in declared
// order, invoked once per boundary. Distinct from validatorsForStep (sequence per-step
// gating) - a loop lane's per-step completion is advisory and never gates, so flow-bound
// validators are NOT run twice (spec lines 355-359, 952-958). A lane without a policy
// (every sequence lane) returns [] - the boundary gate never runs for it.
export function requiredValidatorsForLane(laneId: string): string[] {
  return getLanePolicy(laneId)?.requiredProductValidatorIds ?? [];
}
