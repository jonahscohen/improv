"use strict";
// T-0026: shared plumbing for the five LSP tool handlers.
//
// Every LSP tool follows the same lifecycle:
//   1. resolve SIDECOACH_PROJECT_ROOT and validate the file is inside it
//      (reuses project-root.ts - same realpath + symlink-escape protection as
//      ast_grep).
//   2. discover the language server from the file extension (or an explicit
//      language hint, for workspace symbols).
//   3. acquire a LEASED, initialized client from the shared manager.
//   4. open the document, run the request, close the document.
//   5. release the lease (always, in finally).
//
// This module owns steps 1-5 so each tool file is a thin description + a
// one-line delegation.
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
exports.languageIdForFile = void 0;
exports.relativizeUri = relativizeUri;
exports.runPositionRequest = runPositionRequest;
exports.runDocumentRequest = runDocumentRequest;
exports.runWorkspaceSymbolRequest = runWorkspaceSymbolRequest;
const fs = __importStar(require("fs"));
const url_1 = require("url");
const errors_1 = require("../errors");
const project_root_1 = require("../project-root");
const index_1 = require("./index");
const servers_1 = require("./servers");
Object.defineProperty(exports, "languageIdForFile", { enumerable: true, get: function () { return servers_1.languageIdForFile; } });
/** Cap on a file we are willing to read + send to a language server. */
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB
function resolveProjectRootOrThrow() {
    try {
        return (0, project_root_1.resolveProjectRoot)();
    }
    catch (err) {
        if (err instanceof errors_1.SidecoachToolError)
            throw err;
        throw new errors_1.SidecoachToolError('INVALID_INPUT', `failed to resolve ${project_root_1.PROJECT_ROOT_ENV}`, {
            errorMessage: err instanceof Error ? err.message : String(err),
        });
    }
}
function resolveTargetFile(file) {
    const projectRoot = resolveProjectRootOrThrow();
    const absFile = (0, project_root_1.validatePathInRoot)(file, projectRoot);
    const spec = (0, servers_1.specForFile)(absFile);
    if (!spec) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', `no language server is configured for this file type: "${file}". ` +
            'Supported: typescript/javascript, go, rust, python, c/c++.', { resource: 'lsp' });
    }
    return { projectRoot, absFile, uri: (0, url_1.pathToFileURL)(absFile).href, spec };
}
function readFileForLsp(absFile) {
    let stat;
    try {
        stat = fs.statSync(absFile);
    }
    catch {
        throw new errors_1.SidecoachToolError('INVALID_INPUT', `file does not exist: ${absFile}`);
    }
    if (!stat.isFile()) {
        throw new errors_1.SidecoachToolError('INVALID_INPUT', `not a regular file: ${absFile}`);
    }
    if (stat.size > MAX_FILE_BYTES) {
        throw new errors_1.SidecoachToolError('INVALID_INPUT', `file exceeds ${MAX_FILE_BYTES} byte cap (${stat.size})`);
    }
    try {
        return fs.readFileSync(absFile, 'utf8');
    }
    catch (err) {
        throw new errors_1.SidecoachToolError('INTERNAL_ERROR', 'failed to read file for LSP', {
            errorMessage: err instanceof Error ? err.message : String(err),
        });
    }
}
/** Relativize a file:// URI (or path) against the project root for compact output. */
function relativizeUri(uri, projectRoot) {
    let p = uri;
    if (uri.startsWith('file://')) {
        try {
            p = (0, url_1.fileURLToPath)(uri);
        }
        catch {
            return uri;
        }
    }
    if (p.startsWith(projectRoot)) {
        const rel = p.slice(projectRoot.length);
        return rel.startsWith('/') ? rel.slice(1) : rel;
    }
    return p;
}
/**
 * Run a position-based request (hover / definition / references). Opens the
 * document, issues the request at {line, character}, closes the document, and
 * always releases the lease.
 */
async function runPositionRequest(file, method, line, character, extraParams) {
    const target = resolveTargetFile(file);
    const text = readFileForLsp(target.absFile);
    const manager = (0, index_1.getSharedLspManager)();
    const lease = await manager.acquire(target.spec, {
        rootUri: (0, url_1.pathToFileURL)(target.projectRoot).href,
        cwd: target.projectRoot,
    });
    try {
        lease.client.didOpen(target.uri, text);
        const result = await lease.client.request(method, {
            textDocument: { uri: target.uri },
            position: { line, character },
            ...(extraParams ?? {}),
        });
        lease.client.didClose(target.uri);
        return {
            projectRoot: target.projectRoot,
            uri: target.uri,
            language: target.spec.id,
            result,
        };
    }
    finally {
        lease.release();
    }
}
/** Run a document-level request (documentSymbol). No position needed. */
async function runDocumentRequest(file, method) {
    const target = resolveTargetFile(file);
    const text = readFileForLsp(target.absFile);
    const manager = (0, index_1.getSharedLspManager)();
    const lease = await manager.acquire(target.spec, {
        rootUri: (0, url_1.pathToFileURL)(target.projectRoot).href,
        cwd: target.projectRoot,
    });
    try {
        lease.client.didOpen(target.uri, text);
        const result = await lease.client.request(method, {
            textDocument: { uri: target.uri },
        });
        lease.client.didClose(target.uri);
        return {
            projectRoot: target.projectRoot,
            uri: target.uri,
            language: target.spec.id,
            result,
        };
    }
    finally {
        lease.release();
    }
}
/**
 * Run a workspace/symbol query. The language server is selected from an
 * explicit `language` hint, or (failing that) derived from an optional `file`.
 * Deviation from the file+line+character shape: workspace symbols are
 * project-wide, so they take a query string and a server selector instead.
 */
async function runWorkspaceSymbolRequest(query, language, file) {
    const projectRoot = resolveProjectRootOrThrow();
    let spec = null;
    if (language) {
        spec = (0, servers_1.specForLanguage)(language);
        if (!spec) {
            throw new errors_1.SidecoachToolError('INVALID_INPUT', `unknown language: "${language}"`);
        }
    }
    else if (file) {
        const abs = (0, project_root_1.validatePathInRoot)(file, projectRoot);
        spec = (0, servers_1.specForFile)(abs);
        if (!spec) {
            throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', `no language server for the given file type: "${file}"`, { resource: 'lsp' });
        }
    }
    else {
        // No selector given: default to the typescript server (this repo's primary
        // language). Documented in the tool description + README.
        spec = (0, servers_1.specForLanguage)('typescript');
    }
    if (!spec) {
        throw new errors_1.SidecoachToolError('DOWNSTREAM_UNAVAILABLE', 'no language server available', { resource: 'lsp' });
    }
    const manager = (0, index_1.getSharedLspManager)();
    const lease = await manager.acquire(spec, {
        rootUri: (0, url_1.pathToFileURL)(projectRoot).href,
        cwd: projectRoot,
    });
    try {
        const result = await lease.client.request('workspace/symbol', { query });
        return { projectRoot, language: spec.id, result };
    }
    finally {
        lease.release();
    }
}
//# sourceMappingURL=tool-support.js.map