"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LSP_LANGUAGE_IDS = exports.LANGUAGE_SERVERS = void 0;
exports.specForExtension = specForExtension;
exports.specForFile = specForFile;
exports.specForLanguage = specForLanguage;
exports.languageIdForFile = languageIdForFile;
const path = __importStar(require("path"));
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
exports.LANGUAGE_SERVERS = [
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
exports.LSP_LANGUAGE_IDS = exports.LANGUAGE_SERVERS.map((s) => s.id);
/** Find the spec for a file extension (case-insensitive). Null if unsupported. */
function specForExtension(ext) {
    const lower = ext.toLowerCase();
    for (const spec of exports.LANGUAGE_SERVERS) {
        if (spec.extensions.includes(lower))
            return spec;
    }
    return null;
}
/** Find the spec for a file path by its extension. Null if unsupported. */
function specForFile(file) {
    return specForExtension(path.extname(file));
}
/** Find the spec for a language-family id (e.g. "go"). Null if unknown. */
function specForLanguage(language) {
    const lower = language.toLowerCase();
    return exports.LANGUAGE_SERVERS.find((s) => s.id === lower) ?? null;
}
/** LSP languageId for a file (used in textDocument/didOpen). Empty if unsupported. */
function languageIdForFile(file) {
    const ext = path.extname(file).toLowerCase();
    const spec = specForExtension(ext);
    return spec ? spec.languageId(ext) : '';
}
//# sourceMappingURL=servers.js.map