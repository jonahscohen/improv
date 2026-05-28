// T-0026: language-server discovery.
//
// Maps a source file (by extension) to the language server that should handle
// it, plus the LSP `languageId` to announce in textDocument/didOpen. The map is
// intentionally small and explicit - the brief's set (typescript/javascript,
// go, rust, python) plus a couple of obvious extras. Adding a language is a
// one-line entry; nothing else in the subsystem hard-codes a language.
//
// These binaries are NOT bundled. Each must be installed separately and be on
// PATH; absence is handled gracefully (DOWNSTREAM_UNAVAILABLE) by the manager's
// binary probe, never a crash.

import * as path from 'path';

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
export const LANGUAGE_SERVERS: LanguageServerSpec[] = [
  {
    id: 'typescript',
    command: 'typescript-language-server',
    args: ['--stdio'],
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'],
    languageId: (ext) => {
      switch (ext) {
        case '.tsx':
          return 'typescriptreact';
        case '.jsx':
          return 'javascriptreact';
        case '.js':
        case '.mjs':
        case '.cjs':
          return 'javascript';
        default:
          return 'typescript';
      }
    },
  },
  {
    id: 'go',
    command: 'gopls',
    args: ['serve'],
    extensions: ['.go'],
    languageId: () => 'go',
  },
  {
    id: 'rust',
    command: 'rust-analyzer',
    args: [],
    extensions: ['.rs'],
    languageId: () => 'rust',
  },
  {
    id: 'python',
    command: 'pyright-langserver',
    args: ['--stdio'],
    extensions: ['.py', '.pyi'],
    languageId: () => 'python',
  },
  {
    id: 'c',
    command: 'clangd',
    args: [],
    extensions: ['.c', '.h'],
    languageId: () => 'c',
  },
  {
    id: 'cpp',
    command: 'clangd',
    args: [],
    extensions: ['.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx'],
    languageId: () => 'cpp',
  },
];

/** Lower-cased extensions accepted by the workspace_symbols `language` hint. */
export const LSP_LANGUAGE_IDS = LANGUAGE_SERVERS.map((s) => s.id);

/** Find the spec for a file extension (case-insensitive). Null if unsupported. */
export function specForExtension(ext: string): LanguageServerSpec | null {
  const lower = ext.toLowerCase();
  for (const spec of LANGUAGE_SERVERS) {
    if (spec.extensions.includes(lower)) return spec;
  }
  return null;
}

/** Find the spec for a file path by its extension. Null if unsupported. */
export function specForFile(file: string): LanguageServerSpec | null {
  return specForExtension(path.extname(file));
}

/** Find the spec for a language-family id (e.g. "go"). Null if unknown. */
export function specForLanguage(language: string): LanguageServerSpec | null {
  const lower = language.toLowerCase();
  return LANGUAGE_SERVERS.find((s) => s.id === lower) ?? null;
}

/** LSP languageId for a file (used in textDocument/didOpen). Empty if unsupported. */
export function languageIdForFile(file: string): string {
  const ext = path.extname(file).toLowerCase();
  const spec = specForExtension(ext);
  return spec ? spec.languageId(ext) : '';
}
