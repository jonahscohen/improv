// Tool 4: sidecoach_resolve_keyword - run the bash hook's verb/mode resolver
// over a phrase and return the matched verb/mode (if any).

import { resolveKeyword } from '../keyword-resolver';
import { SidecoachToolError } from '../errors';
import { resolveKeywordShape, type ResolveKeywordInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof resolveKeywordShape> = {
  name: 'sidecoach_resolve_keyword',
  description:
    'Resolve a free-text phrase against the sidecoach verb and mode registries using the same ' +
    'sanitize + word-boundary + informational-suppression logic as the UserPromptSubmit hook. ' +
    'Returns the matched verb or mode (modes take precedence), or kind="none" with a reason.',
  inputSchema: resolveKeywordShape,
  timeoutMs: 5_000,
};

export const handler: ToolHandler<ResolveKeywordInputT> = async (input, deps) => {
  const verbs = deps.registries.verbs?.verbs ?? [];
  const modes = deps.registries.modes?.modes ?? [];

  if (verbs.length === 0 && modes.length === 0) {
    throw new SidecoachToolError(
      'DOWNSTREAM_UNAVAILABLE',
      'verb and mode registries are both empty - cannot resolve keywords',
      { resource: 'sidecoach-verbs.json + sidecoach-modes.json' },
    );
  }

  const match = resolveKeyword(input.phrase, { verbs, modes });

  return {
    data: { match },
    summary:
      match.kind === 'none'
        ? `sidecoach_resolve_keyword: no match (${match.reason ?? 'no reason given'})`
        : `sidecoach_resolve_keyword: matched ${match.kind}=${match.name}`,
  };
};
