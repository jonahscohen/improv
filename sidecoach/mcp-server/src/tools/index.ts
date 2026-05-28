// Re-export every tool's definition + handler. The server's index.ts loops
// over this list to register each tool with the SDK.

import * as listVerbs from './list-verbs';
import * as listModes from './list-modes';
import * as listFlows from './list-flows';
import * as resolveKeyword from './resolve-keyword';
import * as validatePolish from './validate-polish-standard';
import * as validateExtendedDomain from './validate-extended-domain';
import * as validateTaste from './validate-taste';
import * as getCostLedger from './get-cost-ledger';
import * as getCheatsheet from './get-cheatsheet';
import * as getFlowMetadata from './get-flow-metadata';

import type { ToolDefinition, ToolHandler } from './types';

export interface RegisteredTool {
  definition: ToolDefinition<any>;
  handler: ToolHandler<any>;
}

export const TOOLS: RegisteredTool[] = [
  { definition: listVerbs.definition, handler: listVerbs.handler },
  { definition: listModes.definition, handler: listModes.handler },
  { definition: listFlows.definition, handler: listFlows.handler },
  { definition: resolveKeyword.definition, handler: resolveKeyword.handler },
  { definition: validatePolish.definition, handler: validatePolish.handler },
  { definition: validateExtendedDomain.definition, handler: validateExtendedDomain.handler },
  { definition: validateTaste.definition, handler: validateTaste.handler },
  { definition: getCostLedger.definition, handler: getCostLedger.handler },
  { definition: getCheatsheet.definition, handler: getCheatsheet.handler },
  { definition: getFlowMetadata.definition, handler: getFlowMetadata.handler },
];

export const TOOL_NAMES = TOOLS.map((t) => t.definition.name);
