import { lspDocumentSymbolsShape, type LspDocumentSymbolsInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';
export declare const definition: ToolDefinition<typeof lspDocumentSymbolsShape>;
interface FlatSymbol {
    name: string;
    kind: number;
    detail?: string;
    range: unknown;
}
/** Recursively flatten DocumentSymbol[] (which nest via `children`) and the
 *  flat SymbolInformation[] shape into one list, bounded at MAX_SYMBOLS. */
export declare function flattenSymbols(result: unknown): FlatSymbol[];
export declare const handler: ToolHandler<LspDocumentSymbolsInputT>;
export {};
//# sourceMappingURL=lsp-document-symbols.d.ts.map