export interface LanguageServerSpec {
    /** Stable family key used for the per-language client pool + binary probe. */
    id: string;
    /** Executable name resolved on PATH. */
    command: string;
    /** Args to launch the server in stdio mode. */
    args: string[];
    /** File extensions (lower-case, with leading dot) this server handles. */
    extensions: string[];
    /** Resolve the LSP languageId for a given file extension. */
    languageId: (ext: string) => string;
}
/**
 * The registry. Order matters only for documentation; lookup is by extension.
 *
 * Binary choices:
 *  - typescript/javascript -> `typescript-language-server --stdio`
 *  - go                    -> `gopls`
 *  - rust                  -> `rust-analyzer`
 *  - python                -> `pyright-langserver --stdio`
 *  - c/c++                 -> `clangd`
 */
export declare const LANGUAGE_SERVERS: LanguageServerSpec[];
/** Lower-cased extensions accepted by the workspace_symbols `language` hint. */
export declare const LSP_LANGUAGE_IDS: string[];
/** Find the spec for a file extension (case-insensitive). Null if unsupported. */
export declare function specForExtension(ext: string): LanguageServerSpec | null;
/** Find the spec for a file path by its extension. Null if unsupported. */
export declare function specForFile(file: string): LanguageServerSpec | null;
/** Find the spec for a language-family id (e.g. "go"). Null if unknown. */
export declare function specForLanguage(language: string): LanguageServerSpec | null;
/** LSP languageId for a file (used in textDocument/didOpen). Empty if unsupported. */
export declare function languageIdForFile(file: string): string;
//# sourceMappingURL=servers.d.ts.map