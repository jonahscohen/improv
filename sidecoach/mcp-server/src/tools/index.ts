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
// T-0022 extension tools
import * as stateSet from './state-set';
import * as stateGet from './state-get';
import * as stateDelete from './state-delete';
import * as stateListKeys from './state-list-keys';
import * as astGrep from './ast-grep';
// T-0026 LSP tools
import * as lspHover from './lsp-hover';
import * as lspGotoDefinition from './lsp-goto-definition';
import * as lspFindReferences from './lsp-find-references';
import * as lspDocumentSymbols from './lsp-document-symbols';
import * as lspWorkspaceSymbols from './lsp-workspace-symbols';

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
  // T-0022 extension tools (state + ast-grep).
  { definition: stateSet.definition, handler: stateSet.handler },
  { definition: stateGet.definition, handler: stateGet.handler },
  { definition: stateDelete.definition, handler: stateDelete.handler },
  { definition: stateListKeys.definition, handler: stateListKeys.handler },
  { definition: astGrep.definition, handler: astGrep.handler },
  // T-0026 extension tools (LSP: hover, goto-definition, find-references,
  // document-symbols, workspace-symbols).
  { definition: lspHover.definition, handler: lspHover.handler }, // T-0026
  { definition: lspGotoDefinition.definition, handler: lspGotoDefinition.handler }, // T-0026
  { definition: lspFindReferences.definition, handler: lspFindReferences.handler }, // T-0026
  { definition: lspDocumentSymbols.definition, handler: lspDocumentSymbols.handler }, // T-0026
  { definition: lspWorkspaceSymbols.definition, handler: lspWorkspaceSymbols.handler }, // T-0026
];

export const TOOL_NAMES = TOOLS.map((t) => t.definition.name);
