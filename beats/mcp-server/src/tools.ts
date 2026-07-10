import { z } from 'zod';
import {
  runBeatsPy,
  readBeat,
  parseFrontmatter,
  countCorpusFiles,
} from './corpus.js';

/**
 * Read-only MCP tool definitions over the beats corpus.
 *
 * READ-ONLY CONTRACT: every tool here only reads. beats.py is invoked with
 * `search` and `verify` (both read-only); beats are read straight off disk.
 * There is deliberately no write path - beats are authored as markdown through
 * the Claude Code harness, and that stays the only way in.
 */

export interface ToolResult {
  text: string;
  isError?: boolean;
}

export interface BeatsToolDef {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: Record<string, unknown>) => Promise<ToolResult>;
}

function ok(payload: unknown): ToolResult {
  return { text: typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2) };
}

function fail(message: string): ToolResult {
  return { text: message, isError: true };
}

/** Pull the STALE warning line(s) beats.py prints to stderr, if any. */
function staleNote(stderr: string): string | null {
  const lines = stderr
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('STALE:'));
  return lines.length > 0 ? lines.join(' ') : null;
}

/** Normalize a frontmatter value that may be a scalar or list into a string[]. */
function asList(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  if (Array.isArray(value)) return value.filter((v) => v.trim() !== '');
  return value.trim() === '' ? [] : [value.trim()];
}

/** Normalize a frontmatter value expected to be a single scalar. */
function asScalar(value: string | string[] | undefined): string {
  if (value === undefined) return '';
  if (Array.isArray(value)) return value[0]?.trim() ?? '';
  return value.trim();
}

// ── beats_search ──────────────────────────────────────────────────────────
const searchTool: BeatsToolDef = {
  name: 'beats_search',
  description:
    'Search the beats memory corpus with a natural-language query. Returns a ranked, '
    + 'supersession-resolved JSON array of beats (filename, name, description, score). '
    + 'Read-only.',
  schema: z.object({
    query: z.string().describe('Natural-language query text.'),
    top: z.number().int().positive().optional().describe('Max results to return (default 5).'),
  }),
  handler: async (args) => {
    const query = args.query;
    if (typeof query !== 'string' || query.trim() === '') {
      return fail('beats_search error: query must be a non-empty string.');
    }
    // Options before a `--` terminator, then the query as the final positional.
    // Without `--`, a query that starts with `-` (e.g. "--help") would be parsed
    // by beats.py's argparse as an option rather than literal query text.
    const cmd = ['search', '--json'];
    if (typeof args.top === 'number' && Number.isInteger(args.top) && args.top > 0) {
      cmd.push('--top', String(args.top));
    }
    cmd.push('--', query);
    let run;
    try {
      run = await runBeatsPy(cmd);
    } catch (err) {
      return fail(`beats_search error: ${(err as Error).message}`);
    }
    // Exit-code contract for search: 0 ok (incl. zero hits), 1 unusable query,
    // 2 corpus missing, 4 artifact/db failure. STALE prints to stderr but the
    // exit stays 0 and results are still returned.
    if (run.code === 1) {
      return fail(`beats_search error (unusable query): ${run.stderr.trim() || 'no searchable terms after sanitization.'}`);
    }
    if (run.code === 2) {
      return fail(`beats_search error (corpus missing): ${run.stderr.trim()}`);
    }
    if (run.code === 4) {
      return fail(`beats_search error (artifact/db failure): ${run.stderr.trim()}`);
    }
    if (run.code !== 0) {
      return fail(`beats_search error (exit ${run.code}): ${run.stderr.trim()}`);
    }
    let results: unknown;
    try {
      results = JSON.parse(run.stdout || '[]');
    } catch (err) {
      return fail(`beats_search error: could not parse beats.py JSON output: ${(err as Error).message}`);
    }
    // Pass records through as-is; do not strip unknown keys (a sibling adds
    // provenance fields to beats.py's --json records).
    const note = staleNote(run.stderr);
    const payload: Record<string, unknown> = {
      count: Array.isArray(results) ? results.length : 0,
      results,
    };
    if (note) payload.note = note;
    return ok(payload);
  },
};

// ── beats_get ─────────────────────────────────────────────────────────────
const getTool: BeatsToolDef = {
  name: 'beats_get',
  description:
    'Fetch one beat by filename (e.g. "session_2026-07-06_topic.md"). Returns the full '
    + 'markdown plus its parsed frontmatter. The filename must be a bare corpus filename '
    + 'ending in .md; paths that escape the corpus dir are rejected. Read-only.',
  schema: z.object({
    file: z.string().describe('Bare beat filename ending in .md (no path segments).'),
  }),
  handler: async (args) => {
    let beat;
    try {
      beat = await readBeat(args.file);
    } catch (err) {
      const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? `beats_get error: beat not found: ${String(args.file)}`
        : `beats_get error: ${(err as Error).message}`;
      return fail(msg);
    }
    const parsed = parseFrontmatter(beat.markdown);
    return ok({
      file: beat.file,
      frontmatter: parsed.frontmatter,
      markdown: beat.markdown,
    });
  },
};

// ── beats_related ───────────────────────────────────────────────────────────
interface RelatedRef {
  file: string;
  name?: string;
  description?: string;
  superseded?: boolean;
  missing?: boolean;
  invalid?: string;
}

async function resolveRef(file: string): Promise<RelatedRef> {
  let beat;
  try {
    beat = await readBeat(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return { file, missing: true };
    }
    // A rejected path (traversal / symlink escape / bad name) is noted, not fatal.
    return { file, invalid: (err as Error).message };
  }
  const { frontmatter } = parseFrontmatter(beat.markdown);
  const supersededBy = asScalar(frontmatter.superseded_by);
  return {
    file,
    name: asScalar(frontmatter.name),
    description: asScalar(frontmatter.description),
    superseded: supersededBy !== '',
  };
}

const relatedTool: BeatsToolDef = {
  name: 'beats_related',
  description:
    'Given a beat filename, return the beats it links to via relates_to, supersedes, and '
    + 'superseded_by frontmatter, each with its name and description. Missing targets are '
    + 'noted rather than erroring. Read-only.',
  schema: z.object({
    file: z.string().describe('Bare beat filename ending in .md (no path segments).'),
  }),
  handler: async (args) => {
    let beat;
    try {
      beat = await readBeat(args.file);
    } catch (err) {
      const msg = (err as NodeJS.ErrnoException).code === 'ENOENT'
        ? `beats_related error: beat not found: ${String(args.file)}`
        : `beats_related error: ${(err as Error).message}`;
      return fail(msg);
    }
    const { frontmatter } = parseFrontmatter(beat.markdown);
    const relatesTo = asList(frontmatter.relates_to);
    const supersedes = asScalar(frontmatter.supersedes);
    const supersededBy = asScalar(frontmatter.superseded_by);

    const relatesRefs = await Promise.all(relatesTo.map((f) => resolveRef(f)));
    const supersedesRef = supersedes ? await resolveRef(supersedes) : null;
    const supersededByRef = supersededBy ? await resolveRef(supersededBy) : null;

    return ok({
      file: beat.file,
      is_superseded: supersededBy !== '',
      relates_to: relatesRefs,
      supersedes: supersedesRef,
      superseded_by: supersededByRef,
    });
  },
};

// ── beats_status ────────────────────────────────────────────────────────────
const statusTool: BeatsToolDef = {
  name: 'beats_status',
  description:
    'Report the health of the compiled beats index by running beats.py verify: healthy '
    + '(index matches the corpus), stale (corpus changed since last compile), or broken '
    + '(a malformed/unreadable artifact). Includes the corpus file count. Read-only.',
  schema: z.object({}),
  handler: async () => {
    let run;
    try {
      run = await runBeatsPy(['verify']);
    } catch (err) {
      return fail(`beats_status error: ${(err as Error).message}`);
    }
    // verify exit-code contract: 0 healthy, 6 stale, 2/3/4/5 broken.
    let status: string;
    if (run.code === 0) status = 'healthy';
    else if (run.code === 6) status = 'stale';
    else status = 'broken';

    let corpusFileCount: number | null = null;
    try {
      corpusFileCount = await countCorpusFiles();
    } catch {
      corpusFileCount = null;
    }

    // The one-line summary lives on stdout for a healthy index and on stderr for
    // stale/broken; prefer whichever is populated.
    const detail = (run.stdout.trim() || run.stderr.trim()).split('\n')[0] ?? '';
    return ok({
      status,
      exit_code: run.code,
      corpus_file_count: corpusFileCount,
      detail,
    });
  },
};

export const beatsTools: BeatsToolDef[] = [searchTool, getTool, relatedTool, statusTool];
