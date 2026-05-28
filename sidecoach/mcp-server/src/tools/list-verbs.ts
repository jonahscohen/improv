// Tool 1: sidecoach_list_verbs - return all 22 verbs from sidecoach-verbs.json.

import { SidecoachToolError } from '../errors';
import { listVerbsShape, type ListVerbsInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof listVerbsShape> = {
  name: 'sidecoach_list_verbs',
  description:
    'Return all 22 sidecoach verbs from the canonical registry. Each verb includes its phase ' +
    '(shape-strategy/build/review/tone/docs/tactical), description, and a one-line explanation. ' +
    'Optionally filter by phase.',
  inputSchema: listVerbsShape,
  timeoutMs: 5_000,
};

export const handler: ToolHandler<ListVerbsInputT> = async (input, deps) => {
  if (!deps.registries.verbs) {
    throw new SidecoachToolError(
      'DOWNSTREAM_UNAVAILABLE',
      'verbs registry is not loaded (sidecoach-verbs.json missing or unreadable at startup)',
      { resource: 'sidecoach-verbs.json' },
    );
  }
  const all = deps.registries.verbs.verbs;
  const phase = input.phase?.toLowerCase().trim();
  const filtered = phase
    ? all.filter((v) => v.phase.toLowerCase() === phase)
    : all;

  return {
    data: {
      count: filtered.length,
      total: all.length,
      verbs: filtered,
    },
    summary: phase
      ? `sidecoach_list_verbs: ${filtered.length} verb(s) in phase=${phase} (out of ${all.length} total)`
      : `sidecoach_list_verbs: ${all.length} verb(s)`,
  };
};
