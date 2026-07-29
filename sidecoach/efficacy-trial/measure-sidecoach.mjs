#!/usr/bin/env node
/**
 * M3 - THE OWN-EXAM MEASURE. FAIL-CLOSED.
 *
 * Runs the SHIPPED `sidecoach-detect` CLI over every collected page and records its finding count.
 *
 * READ PREREGISTRATION.md SECTION 3 BEFORE USING THIS NUMBER. This is sidecoach's own engine
 * grading work produced under sidecoach's own guidance, so its evidential value was declared
 * UNEQUAL before any data existed:
 *   - null or negative  -> STRONG evidence against improvement (it fails its own exam)
 *   - positive          -> WEAK evidence, and BARRED from the headline and the verdict
 * Nothing in this file may be used to argue sidecoach helped.
 *
 * detect's exit contract is 0 clean / 1 findings / 2 usage-IO / 3 inconclusive. An INCONCLUSIVE
 * page is recorded as inconclusive and EXCLUDED from the paired test rather than scored as zero -
 * the CLI's own help says a partial scan with zero findings is not clean, and silently reading it
 * as clean is exactly the false-pass bug `session_2026-07-28_sidecoach-live-efficacy.md` fixed.
 *
 * EXIT CODES
 *   0  every collected page scanned; measurements/sidecoach.json written
 *   1  usage
 *   2  results/collection.json missing
 *   3  detect returned an unexpected exit code (not 0/1/3) or unparseable JSON on some page
 *   4  filesystem failure
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync, openSync, closeSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TRIAL_ROOT, SIDECOACH_ROOT } from './lib/briefs.mjs';

const EXIT = { OK: 0, USAGE: 1, NO_COLLECTION: 2, DETECT: 3, IO: 4 };
const die = (code, msg) => { console.error(`measure-sidecoach: ${msg}`); process.exit(code); };
const ARMS = ['C', 'P', 'S'];
const DETECT = path.join(SIDECOACH_ROOT, 'bin', 'sidecoach-detect.js');

/**
 * Run detect on one file. stdout goes to a FILE, not a pipe: the detect CLI spawns a Chrome
 * grandchild that inherits the stdio, and a piped read truncates (measured elsewhere in this trial
 * at 8178 of 188893 bytes, and documented in eval/oracle-comparator.mjs).
 */
function runDetect(file) {
  const dir = mkdtempSync(path.join(tmpdir(), 'efficacy-detect-'));
  const outPath = path.join(dir, 'out.json');
  const fd = openSync(outPath, 'w');
  const r = spawnSync('node', [DETECT, file, '--quiet'], { stdio: ['ignore', fd, 'pipe'], encoding: 'utf8' });
  closeSync(fd);
  const raw = readFileSync(outPath, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, raw, stderr: r.stderr || '' };
}

function main() {
  if (process.argv.length > 2) die(EXIT.USAGE, `takes no arguments, got: ${process.argv.slice(2).join(' ')}`);
  const collPath = path.join(TRIAL_ROOT, 'results', 'collection.json');
  if (!existsSync(collPath)) die(EXIT.NO_COLLECTION, `${collPath} not found - run collect.mjs first`);
  if (!existsSync(DETECT)) die(EXIT.IO, `${DETECT} not found`);
  const ids = JSON.parse(readFileSync(collPath, 'utf8')).completeTriples;
  if (ids.length === 0) die(EXIT.NO_COLLECTION, 'collection.json reports 0 complete triples');

  const out = { measuredAt: new Date().toISOString(), tool: 'sidecoach-detect (shipped CLI)', pages: [] };

  for (const id of ids) {
    for (const arm of ARMS) {
      const file = path.join(TRIAL_ROOT, 'pages', arm, `${id}.html`);
      const { code, raw, stderr } = runDetect(file);
      if (![0, 1, 3].includes(code)) die(EXIT.DETECT, `detect exited ${code} on ${arm}/${id}: ${stderr.slice(0, 300)}`);
      let parsed = null;
      if (raw.trim()) { try { parsed = JSON.parse(raw); } catch (e) { die(EXIT.DETECT, `unparseable detect JSON for ${arm}/${id}: ${e.message}`); } }
      const inconclusive = code === 3;
      const findings = parsed && Array.isArray(parsed.findings) ? parsed.findings : [];
      out.pages.push({
        id,
        arm,
        exit: code,
        inconclusive,
        findings: inconclusive ? null : findings.length,
        rules: inconclusive ? null : [...new Set(findings.map((f) => f.rule || f.id || 'unknown'))].sort(),
      });
    }
  }

  const expected = ids.length * ARMS.length;
  if (out.pages.length !== expected) die(EXIT.DETECT, `scanned ${out.pages.length} pages, expected ${expected}`);
  out.inconclusiveCount = out.pages.filter((p) => p.inconclusive).length;

  try {
    mkdirSync(path.join(TRIAL_ROOT, 'measurements'), { recursive: true });
    writeFileSync(path.join(TRIAL_ROOT, 'measurements', 'sidecoach.json'), `${JSON.stringify(out, null, 2)}\n`);
  } catch (e) { die(EXIT.IO, `writing sidecoach.json: ${e.message}`); }

  console.log(`measure-sidecoach: OK - ${out.pages.length} pages, ${out.inconclusiveCount} inconclusive (excluded from the paired test, never scored as clean)`);
  for (const arm of ARMS) {
    const rows = out.pages.filter((p) => p.arm === arm && !p.inconclusive);
    const m = rows.length ? rows.reduce((a, p) => a + p.findings, 0) / rows.length : NaN;
    console.log(`  arm ${arm}: mean findings ${Number.isNaN(m) ? 'n/a' : m.toFixed(2)} over ${rows.length} conclusive page(s)`);
  }
  process.exit(EXIT.OK);
}

main();
