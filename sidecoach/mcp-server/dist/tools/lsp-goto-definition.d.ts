import { lspGotoDefinitionShape, type LspGotoDefinitionInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';
export declare const definition: ToolDefinition<typeof lspGotoDefinitionShape>;
/** Normalize Location | Location[] | LocationLink[] | null into {uri, range}[]. */
export declare function normalizeLocations(result: unknown, projectRoot: string): Array<{
    uri: string;
    range: unknown;
}>;
export declare const handler: ToolHandler<LspGotoDefinitionInputT>;
//# sourceMappingURL=lsp-goto-definition.d.ts.map