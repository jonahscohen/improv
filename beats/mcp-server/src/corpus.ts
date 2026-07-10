import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { open, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import * as path from 'node:path';

/**
 * Corpus access layer for the read-only beats MCP server.
 *
 * The markdown beats in `.claude/memory/` are the source of truth. This module
 * is the only place that touches the filesystem or spawns beats.py, so the tool
 * handlers stay declarative. Nothing here mutates the corpus - every path is a
 * read, and beats.py is only ever invoked with `search` / `verify`.
 */

// The compiled server lives at <repo>/beats/mcp-server/dist/server.js, so three
// levels up from the emitted dir is the repo root. Resolved from import.meta.url
// (an absolute file URL), this is independent of the process working directory.
const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
export const BEATS_PY = path.join(REPO_ROOT, 'beats', 'beats.py');

// Corpus dir defaults to the repo's .claude/memory. BEATS_CORPUS overrides it
// (resolved against the process cwd if relative).
const corpusOverride = process.env.BEATS_CORPUS;
export const CORPUS_DIR = corpusOverride
  ? path.resolve(corpusOverride)
  : path.join(REPO_ROOT, '.claude', 'memory');

// Build dir holds beats.py's compiled index (the same one search/verify read).
// It defaults to beats.py's own default (<repo>/beats/.build) and is passed
// explicitly so it stays coherent with the corpus. Override with BEATS_BUILD
// when pointing at a different corpus (compile that corpus with a matching
// --build so search reads the right index, not the default corpus's).
const buildOverride = process.env.BEATS_BUILD;
export const BUILD_DIR = buildOverride
  ? path.resolve(buildOverride)
  : path.join(REPO_ROOT, 'beats', '.build');

// The python interpreter is overridable for environments where `python3` is not
// the right binary; defaults to `python3` per the repo convention.
const PYTHON = process.env.BEATS_PYTHON ?? 'python3';

export interface BeatsRun {
  code: number;
  stdout: string;
  stderr: string;
}

/**
 * Spawn beats.py with the given argv and return its captured output and exit
 * code. `args` is [subcommand, ...rest]; --corpus/--build are injected right
 * after the subcommand so they always precede any `--` terminator in `rest`
 * (argparse treats everything after `--` as positional, so trailing options
 * would be mis-parsed). No shell is involved (argv array), so query strings
 * with spaces or shell metacharacters are passed through literally.
 */
export function runBeatsPy(args: string[]): Promise<BeatsRun> {
  return new Promise((resolve, reject) => {
    const [sub, ...rest] = args;
    const argv = [BEATS_PY, sub, '--corpus', CORPUS_DIR, '--build', BUILD_DIR, ...rest];
    const child = spawn(PYTHON, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (err) => {
      reject(new Error(`could not launch ${PYTHON} ${BEATS_PY}: ${err.message}`));
    });
    child.on('close', (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

/**
 * Resolve a caller-supplied beat filename to an absolute path inside the corpus
 * dir, rejecting anything that could escape it. A rejected path throws with a
 * message safe to surface to the client. Rules:
 *   - must be a non-empty string
 *   - must end in `.md`
 *   - must not be absolute
 *   - must not contain any path separator (the corpus is flat; beats.py globs
 *     `*.md` non-recursively and beats link to bare filenames)
 *   - a `..` component is called out with a traversal-specific message
 * A bare filename plus the no-follow open in readBeat means the only path
 * component is the filename itself, so it cannot be a subpath, a traversal, or
 * a symlink pointing outside the corpus.
 */
export function resolveBeatPath(file: unknown): string {
  if (typeof file !== 'string' || file.trim() === '') {
    throw new Error('file must be a non-empty string');
  }
  const raw = file.trim();
  if (!raw.toLowerCase().endsWith('.md')) {
    throw new Error(`rejected: file must end in .md (got ${raw})`);
  }
  if (path.isAbsolute(raw)) {
    throw new Error(`rejected: absolute paths are not allowed (got ${raw})`);
  }
  if (/[\\/]/.test(raw)) {
    if (raw.split(/[\\/]/).some((seg) => seg === '..')) {
      throw new Error(`rejected: path traversal is not allowed (got ${raw})`);
    }
    throw new Error(`rejected: file must be a bare filename with no path separators (got ${raw})`);
  }
  const resolved = path.resolve(CORPUS_DIR, raw);
  const base = path.resolve(CORPUS_DIR);
  // Redundant given the separator rejection, but kept as defense in depth.
  if (resolved !== base && !resolved.startsWith(base + path.sep)) {
    throw new Error(`rejected: path escapes the corpus dir (got ${raw})`);
  }
  return resolved;
}

export interface ParsedBeat {
  frontmatter: Record<string, string | string[]>;
  body: string;
}

const FM_RE = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/;
const KEY_RE = /^([A-Za-z][A-Za-z0-9_-]*):[ \t]?(.*)$/;
const ITEM_RE = /^[ \t]+-[ \t]*(.*)$/;

function stripQuotes(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && v[0] === v[v.length - 1] && (v[0] === '"' || v[0] === "'")) {
    return v.slice(1, -1);
  }
  return v;
}

/**
 * Line-based, dependency-free frontmatter parse that mirrors beats.py's tolerant
 * reader. A file without a leading `---` block yields empty frontmatter and the
 * whole file as body. Scalars are quote-stripped; a `[a, b]` inline list and a
 * block `- item` list both parse to string arrays.
 */
export function parseFrontmatter(input: string): ParsedBeat {
  // Mirror beats.py's decode: strip a leading UTF-8 BOM and normalize CRLF to
  // LF so a Windows-authored beat parses the same here as it does in the index.
  const md = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const match = FM_RE.exec(md);
  if (!match) {
    return { frontmatter: {}, body: md };
  }
  const fmText = match[1];
  const body = md.slice(match[0].length);
  const lines = fmText.split('\n');
  const frontmatter: Record<string, string | string[]> = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line[0] === ' ' || line[0] === '\t') {
      i += 1;
      continue;
    }
    const m = KEY_RE.exec(line);
    if (!m) {
      i += 1;
      continue;
    }
    const key = m[1];
    const rest = m[2].trim();
    if (rest === '~' || rest === 'null') {
      // beats.py treats these as empty values, not literal scalars.
      frontmatter[key] = '';
      i += 1;
    } else if (rest === '') {
      // Empty scalar or the head of a block list. Look ahead for `- item` lines.
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length) {
        const im = ITEM_RE.exec(lines[j]);
        if (!im) break;
        items.push(stripQuotes(im[1].trim()));
        j += 1;
      }
      if (items.length > 0) {
        frontmatter[key] = items;
        i = j;
      } else {
        frontmatter[key] = '';
        i += 1;
      }
    } else if (rest.startsWith('[') && rest.endsWith(']')) {
      const inner = rest.slice(1, -1).trim();
      // An empty inline list (`[]`, `[ ]`) is an empty value in beats.py, not [].
      frontmatter[key] = inner === ''
        ? ''
        : inner.split(',').map((s) => stripQuotes(s.trim())).filter((s) => s !== '');
      i += 1;
    } else {
      frontmatter[key] = stripQuotes(rest);
      i += 1;
    }
  }
  return { frontmatter, body };
}

/**
 * Read one beat's raw markdown by validated filename. The open is atomic and
 * symlink-safe: O_NOFOLLOW makes a symlink at the final component fail with
 * ELOOP instead of being followed, and validation happens on the very fd that
 * is read (no validate-then-reopen TOCTOU window). O_NOFOLLOW is undefined on
 * platforms without it, degrading to a normal open (Windows has no such link).
 */
export async function readBeat(file: unknown): Promise<{ file: string; markdown: string }> {
  const resolved = resolveBeatPath(file);
  const noFollow = constants.O_NOFOLLOW ?? 0;
  let handle;
  try {
    handle = await open(resolved, constants.O_RDONLY | noFollow);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ELOOP') {
      throw new Error(`rejected: path traversal is not allowed (symlink not allowed: ${path.basename(resolved)})`);
    }
    throw err;
  }
  try {
    const markdown = await handle.readFile('utf8');
    return { file: path.basename(resolved), markdown };
  } finally {
    await handle.close();
  }
}

/** Count the *.md beats in the corpus dir. */
export async function countCorpusFiles(): Promise<number> {
  const entries = await readdir(CORPUS_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md')).length;
}
