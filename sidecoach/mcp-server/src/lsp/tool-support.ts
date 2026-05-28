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

import * as fs from 'fs';
import { pathToFileURL, fileURLToPath } from 'url';

import { SidecoachToolError } from '../errors';
import { PROJECT_ROOT_ENV, resolveProjectRoot, validatePathInRoot } from '../project-root';
import { getSharedLspManager, type LanguageServerSpec } from './index';
import { specForFile, specForLanguage, languageIdForFile } from './servers';

/** Cap on a file we are willing to read + send to a language server. */
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MiB

interface ResolvedTarget {
  projectRoot: string;
  absFile: string;
  uri: string;
  spec: LanguageServerSpec;
}

function resolveProjectRootOrThrow(): string {
  try {
    return resolveProjectRoot();
  } catch (err) {
    if (err instanceof SidecoachToolError) throw err;
    throw new SidecoachToolError('INVALID_INPUT', `failed to resolve ${PROJECT_ROOT_ENV}`, {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

function resolveTargetFile(file: string): ResolvedTarget {
  const projectRoot = resolveProjectRootOrThrow();
  const absFile = validatePathInRoot(file, projectRoot);
  const spec = specForFile(absFile);
  if (!spec) {
    throw new SidecoachToolError(
      'DOWNSTREAM_UNAVAILABLE',
      `no language server is configured for this file type: "${file}". ` +
        'Supported: typescript/javascript, go, rust, python, c/c++.',
      { resource: 'lsp' },
    );
  }
  return { projectRoot, absFile, uri: pathToFileURL(absFile).href, spec };
}

function readFileForLsp(absFile: string): string {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(absFile);
  } catch {
    throw new SidecoachToolError('INVALID_INPUT', `file does not exist: ${absFile}`);
  }
  if (!stat.isFile()) {
    throw new SidecoachToolError('INVALID_INPUT', `not a regular file: ${absFile}`);
  }
  if (stat.size > MAX_FILE_BYTES) {
    throw new SidecoachToolError('INVALID_INPUT', `file exceeds ${MAX_FILE_BYTES} byte cap (${stat.size})`);
  }
  try {
    return fs.readFileSync(absFile, 'utf8');
  } catch (err) {
    throw new SidecoachToolError('INTERNAL_ERROR', 'failed to read file for LSP', {
      errorMessage: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Relativize a file:// URI (or path) against the project root for compact output. */
export function relativizeUri(uri: string, projectRoot: string): string {
  let p = uri;
  if (uri.startsWith('file://')) {
    try {
      p = fileURLToPath(uri);
    } catch {
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
export async function runPositionRequest(
  file: string,
  method: string,
  line: number,
  character: number,
  extraParams?: Record<string, unknown>,
): Promise<{ projectRoot: string; uri: string; language: string; result: unknown }> {
  const target = resolveTargetFile(file);
  const text = readFileForLsp(target.absFile);
  const manager = getSharedLspManager();
  const lease = await manager.acquire(target.spec, {
    rootUri: pathToFileURL(target.projectRoot).href,
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
  } finally {
    lease.release();
  }
}

/** Run a document-level request (documentSymbol). No position needed. */
export async function runDocumentRequest(
  file: string,
  method: string,
): Promise<{ projectRoot: string; uri: string; language: string; result: unknown }> {
  const target = resolveTargetFile(file);
  const text = readFileForLsp(target.absFile);
  const manager = getSharedLspManager();
  const lease = await manager.acquire(target.spec, {
    rootUri: pathToFileURL(target.projectRoot).href,
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
  } finally {
    lease.release();
  }
}

/**
 * Run a workspace/symbol query. The language server is selected from an
 * explicit `language` hint, or (failing that) derived from an optional `file`.
 * Deviation from the file+line+character shape: workspace symbols are
 * project-wide, so they take a query string and a server selector instead.
 */
export async function runWorkspaceSymbolRequest(
  query: string,
  language?: string,
  file?: string,
): Promise<{ projectRoot: string; language: string; result: unknown }> {
  const projectRoot = resolveProjectRootOrThrow();
  let spec: LanguageServerSpec | null = null;
  if (language) {
    spec = specForLanguage(language);
    if (!spec) {
      throw new SidecoachToolError('INVALID_INPUT', `unknown language: "${language}"`);
    }
  } else if (file) {
    const abs = validatePathInRoot(file, projectRoot);
    spec = specForFile(abs);
    if (!spec) {
      throw new SidecoachToolError(
        'DOWNSTREAM_UNAVAILABLE',
        `no language server for the given file type: "${file}"`,
        { resource: 'lsp' },
      );
    }
  } else {
    // No selector given: default to the typescript server (this repo's primary
    // language). Documented in the tool description + README.
    spec = specForLanguage('typescript');
  }
  if (!spec) {
    throw new SidecoachToolError('DOWNSTREAM_UNAVAILABLE', 'no language server available', { resource: 'lsp' });
  }

  const manager = getSharedLspManager();
  const lease = await manager.acquire(spec, {
    rootUri: pathToFileURL(projectRoot).href,
    cwd: projectRoot,
  });
  try {
    const result = await lease.client.request('workspace/symbol', { query });
    return { projectRoot, language: spec.id, result };
  } finally {
    lease.release();
  }
}

export { languageIdForFile };
