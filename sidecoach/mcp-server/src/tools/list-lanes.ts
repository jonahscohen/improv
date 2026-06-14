// Tool: sidecoach_list_lanes. Return the lane registry's lanes. No fallback -
// a null lane registry is DOWNSTREAM_UNAVAILABLE.

import { SidecoachToolError } from '../errors';
import { listLanesShape, type ListLanesInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof listLanesShape> = {
  name: 'sidecoach_list_lanes',
  description:
    'Return all sidecoach lanes (lane_build / lane_ship / lane_delight / lane_live / lane_calm / lane_converge). ' +
    'Each lane carries a human label, its interview label, a description, and its executionKind (sequence | loop). ' +
    'Lanes replace the legacy modes; the classifier routes natural prompts to a lane.',
  inputSchema: listLanesShape,
  timeoutMs: 5_000,
};

export const handler: ToolHandler<ListLanesInputT> = async (_input, deps) => {
  const lanes = deps.registries.lanes;
  if (!lanes) {
    throw new SidecoachToolError(
      'DOWNSTREAM_UNAVAILABLE',
      'lane registry not loaded (sidecoach-lanes.json missing or structure-invalid)',
      { resource: 'claude/hooks/sidecoach-lanes.json' },
    );
  }
  const list = (lanes.registry.lanes as any[]).map((l) => ({
    lane: l.lane,
    label: l.label,
    executionKind: l.executionKind ?? 'sequence',
    interviewLabel: l.interviewLabel ?? l.label,
    description: l.description ?? '',
  }));
  return {
    data: { count: list.length, lanes: list },
    summary: `sidecoach_list_lanes: ${list.length} lane(s)`,
  };
};
