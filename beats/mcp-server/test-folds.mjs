// Targeted verification of the Codex-review folds that the stdio smoke test
// does not cover: frontmatter BOM/CRLF/null parsing, symlink-escape rejection,
// and the dash-query terminator. Pure-function tests import the built module;
// the symlink test runs in a child process with BEATS_CORPUS pointed at a temp
// corpus (CORPUS_DIR is resolved from env at module load).
import { parseFrontmatter, resolveBeatPath } from './dist/corpus.js';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

let failures = 0;
function check(cond, desc) {
  console.log(`CHECK ${cond ? 'PASS' : 'FAIL'}: ${desc}`);
  if (!cond) failures += 1;
}

// --- Fold #5: CRLF + BOM frontmatter ---------------------------------------
const crlf = '﻿---\r\nname: Windows Beat\r\ndescription: made on windows\r\nrelates_to:\r\n  - other.md\r\n---\r\n\r\nbody here\r\n';
const p1 = parseFrontmatter(crlf);
check(p1.frontmatter.name === 'Windows Beat', 'CRLF+BOM: name parsed');
check(Array.isArray(p1.frontmatter.relates_to) && p1.frontmatter.relates_to[0] === 'other.md', 'CRLF+BOM: block relates_to parsed');

// --- Fold #6: null / ~ / [] scalars are empty ------------------------------
const nulls = '---\nname: N\nsuperseded_by: null\nsupersedes: ~\nrelates_to: []\n---\nbody\n';
const p2 = parseFrontmatter(nulls);
check(p2.frontmatter.superseded_by === '', 'null superseded_by -> empty');
check(p2.frontmatter.supersedes === '', '~ supersedes -> empty');
check(p2.frontmatter.relates_to === '', '[] relates_to -> empty');
// second-pass fold: whitespace-only inline list matches beats.py ('' not [])
check(parseFrontmatter('---\nname: N\nrelates_to: [ ]\n---\nx\n').frontmatter.relates_to === '', '[ ] relates_to -> empty (matches beats.py)');

// --- inline + block list sanity --------------------------------------------
const lists = '---\nname: L\nrelates_to: [a.md, b.md,  c.md ]\n---\nx\n';
const p3 = parseFrontmatter(lists);
check(JSON.stringify(p3.frontmatter.relates_to) === JSON.stringify(['a.md', 'b.md', 'c.md']), 'inline list parsed + trimmed');

// --- separator rejection (flat corpus) -------------------------------------
function rejects(input) {
  try { resolveBeatPath(input); return false; } catch { return true; }
}
check(rejects('foo/bar.md'), 'resolveBeatPath rejects a path separator (flat corpus)');
check(rejects('../secret.md'), 'resolveBeatPath rejects ../ traversal');
check(rejects('/etc/hosts.md'), 'resolveBeatPath rejects absolute path');
check(!rejects('normal_beat.md'), 'resolveBeatPath accepts a bare .md filename');

// --- Fold #2: symlink escape rejected --------------------------------------
const tmp = mkdtempSync(path.join(tmpdir(), 'beats-corpus-'));
try {
  writeFileSync(path.join(tmp, 'real.md'), '---\nname: Real\n---\nok\n');
  let symlinkMade = false;
  try {
    symlinkSync('/etc/hosts', path.join(tmp, 'leak.md'));
    symlinkMade = true;
  } catch { /* symlink may be unavailable; skip that assertion */ }

  const script = `
    import { readBeat } from ${JSON.stringify(path.resolve('dist/corpus.js'))};
    const out = {};
    try { const r = await readBeat('real.md'); out.real = r.markdown.includes('ok'); }
    catch (e) { out.realErr = e.message; }
    try { await readBeat('leak.md'); out.leak = 'READ (BAD)'; }
    catch (e) { out.leak = e.message; }
    console.log(JSON.stringify(out));
  `;
  const res = spawnSync('node', ['--input-type=module', '-e', script], {
    env: { ...process.env, BEATS_CORPUS: tmp },
    encoding: 'utf8',
  });
  const out = JSON.parse((res.stdout || '{}').trim() || '{}');
  check(out.real === true, 'symlink test: a normal beat in the temp corpus reads fine');
  if (symlinkMade) {
    check(typeof out.leak === 'string' && /rejected/.test(out.leak), `symlink escape rejected (${out.leak})`);
  } else {
    console.log('CHECK SKIP: symlink could not be created in this environment');
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

// --- Fold #3: a query starting with "-" is literal, not an option ----------
// Mirror the exact argv runBeatsPy builds (options after subcommand, `--`, then
// query). A dash-query must produce a JSON array, not argparse help text.
const repoRoot = path.resolve('..', '..');
const beatsPy = path.join(repoRoot, 'beats', 'beats.py');
const corpus = path.join(repoRoot, '.claude', 'memory');
const build = path.join(repoRoot, 'beats', '.build');
const dashRes = spawnSync('python3', [beatsPy, 'search', '--corpus', corpus, '--build', build, '--json', '--', '--help'], { encoding: 'utf8' });
let dashJson = null;
try { dashJson = JSON.parse(dashRes.stdout.trim() || 'null'); } catch { /* leave null */ }
check(Array.isArray(dashJson), `dash-query "--help" returns a JSON array (exit ${dashRes.status}), not argparse help`);

console.log(`\nSUMMARY: ${failures === 0 ? 'ALL FOLD CHECKS PASSED' : failures + ' FOLD CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
