// Tool 10: sidecoach_get_flow_metadata - given a flow ID, return its name,
// description, triggers, derived tier, and model-routing config.

import { getFlowById } from '../registries';
import { SidecoachToolError } from '../errors';
import { getFlowMetadataShape, type GetFlowMetadataInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof getFlowMetadataShape> = {
  name: 'sidecoach_get_flow_metadata',
  description:
    'Return metadata for a single sidecoach flow. Includes id, name, description, trigger ' +
    'patterns / intent markers / collision-avoid / negative filters, derived tier, and the ' +
    'model-routing config (preferredTier, minTier, rationale).',
  inputSchema: getFlowMetadataShape,
  timeoutMs: 5_000,
};

export const handler: ToolHandler<GetFlowMetadataInputT> = async (input, _deps) => {
  const flow = getFlowById(input.flowId);
  if (!flow) {
    throw new SidecoachToolError(
      'INVALID_INPUT',
      `unknown flowId: "${input.flowId}". Use sidecoach_list_flows to discover valid IDs.`,
      { resource: input.flowId },
    );
  }
  return {
    data: { flow },
    summary: `sidecoach_get_flow_metadata: ${flow.id} (${flow.name})`,
  };
};
