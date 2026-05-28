import { languageIdForFile } from './servers';
/** Relativize a file:// URI (or path) against the project root for compact output. */
export declare function relativizeUri(uri: string, projectRoot: string): string;
/**
 * Run a position-based request (hover / definition / references). Opens the
 * document, issues the request at {line, character}, closes the document, and
 * always releases the lease.
 */
export declare function runPositionRequest(file: string, method: string, line: number, character: number, extraParams?: Record<string, unknown>): Promise<{
    projectRoot: string;
    uri: string;
    language: string;
    result: unknown;
}>;
/** Run a document-level request (documentSymbol). No position needed. */
export declare function runDocumentRequest(file: string, method: string): Promise<{
    projectRoot: string;
    uri: string;
    language: string;
    result: unknown;
}>;
/**
 * Run a workspace/symbol query. The language server is selected from an
 * explicit `language` hint, or (failing that) derived from an optional `file`.
 * Deviation from the file+line+character shape: workspace symbols are
 * project-wide, so they take a query string and a server selector instead.
 */
export declare function runWorkspaceSymbolRequest(query: string, language?: string, file?: string): Promise<{
    projectRoot: string;
    language: string;
    result: unknown;
}>;
export { languageIdForFile };
//# sourceMappingURL=tool-support.d.ts.map