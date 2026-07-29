#!/usr/bin/env node
/**
 * GENERATION COLLECTOR / GATE. FAIL-CLOSED.
 *
 * ALSO THE ARTEFACT-FREEZE POINT. It records a sha256 per page, and `--verify` re-checks every
 * one against the file on disk. That check exists because it CAUGHT a real incident in this
 * trial: duplicate producer subagents (relaunched after the runtime's concurrency limit rejected
 * earlier spawns) completed late and REWROTE three arm-S pages AFTER the first measurement pass.
 * Measuring one artefact and judging another is a silent corruption that no statistic would have
 * revealed, so the freeze is verified rather than assumed. See RESULTS.md for how it was handled.
 *
 * Verifies that every brief x arm cell produced a usable page BEFORE any measurement runs, and
 * applies the pre-registered drop rule: a cell that failed invalidates its WHOLE TRIPLE (all three
 * arms for that brief), so every comparison stays balanced (PREREGISTRATION.md section 4).
 *
 * Also runs the BLINDING LEAK CHECK: a generated page that names sidecoach, the placebo's
 * distinctive vocabulary, or the trial's own scaffolding would un-blind the judge. Leaks are
 * reported, never silently stripped - stripping would edit the artefact under measurement.
 *
 * EXIT CODES
 *   0  all 17 triples complete and self-contained; results/collection.json written
 *   1  usage
 *   2  arms manifest missing (build-arms.mjs has not run)
 *   3  one or more triples incomplete - names them; writes collection.json marking them dropped
 *   4  a page violated the self-containment contract (remote asset / external request)
 *   5  filesystem failure
 *   6  --verify only: a page changed on disk since the frozen collection
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { TRIAL_ROOT, sha256 } from './lib/briefs.mjs';

const EXIT = { OK: 0, USAGE: 1, NO_MANIFEST: 2, INCOMPLETE: 3, NOT_SELF_CONTAINED: 4, IO: 5, CHANGED: 6 };
const die = (code, msg) => { console.error(`collect: ${msg}`); process.exit(code); };
const ARMS = ['C', 'P', 'S'];

/** Remote-asset patterns. A page that reaches the network is not the artefact we specified. */
const REMOTE = [
  [/<link[^>]+href\s*=\s*["']https?:\/\//i, 'remote <link>'],
  [/<script[^>]+src\s*=\s*["']https?:\/\//i, 'remote <script src>'],
  [/<img[^>]+src\s*=\s*["']https?:\/\//i, 'remote <img>'],
  [/@import\s+(url\()?["']https?:\/\//i, 'remote @import'],
  [/\bfetch\s*\(\s*["']https?:\/\//i, 'fetch() to a URL'],
  [/new\s+WebSocket\s*\(/i, 'WebSocket'],
  [/new\s+XMLHttpRequest\s*\(/i, 'XMLHttpRequest'],
];

/** Blinding leak terms. Case-insensitive substring hits on the page source. */
const LEAK_TERMS = [
  'sidecoach', 'PROJECT GUIDANCE', 'PRODUCT.md', 'DESIGN.md',
  'efficacy-trial', 'placebo', 'buildreport', 'tactical-polish',
];

function verifyFrozen() {
  const collPath = path.join(TRIAL_ROOT, 'results', 'collection.json');
  if (!existsSync(collPath)) die(EXIT.NO_MANIFEST, `${collPath} not found - nothing to verify`);
  const coll = JSON.parse(readFileSync(collPath, 'utf8'));
  const changed = [];
  for (const cell of coll.cells) {
    for (const arm of ARMS) {
      const rec = cell.arms[arm];
      if (!rec || !rec.sha256) continue;
      const f = path.join(TRIAL_ROOT, 'pages', arm, `${cell.id}.html`);
      if (!existsSync(f)) { changed.push(`${arm}/${cell.id} (missing)`); continue; }
      if (sha256(readFileSync(f, 'utf8')) !== rec.sha256) changed.push(`${arm}/${cell.id}`);
    }
  }
  if (changed.length) {
    console.error(`collect --verify: ${changed.length} page(s) CHANGED since collection - every measurement and verdict touching them is stale:`);
    for (const c of changed) console.error(`  ${c}`);
    process.exit(EXIT.CHANGED);
  }
  console.log(`collect --verify: OK - all ${coll.cells.length * ARMS.length} pages byte-identical to the frozen collection`);
  process.exit(EXIT.OK);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--verify') return verifyFrozen();
  if (args.length > 0) die(EXIT.USAGE, `takes no arguments (or --verify), got: ${args.join(' ')}`);
  const manifestPath = path.join(TRIAL_ROOT, 'arms', 'manifest.json');
  if (!existsSync(manifestPath)) die(EXIT.NO_MANIFEST, `${manifestPath} not found - run build-arms.mjs first`);
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  const out = { collectedAt: new Date().toISOString(), cells: [], dropped: [], leaks: [], notSelfContained: [], wrapperless: [] };

  for (const b of manifest.briefs) {
    const row = { id: b.id, arms: {} };
    for (const arm of ARMS) {
      const f = path.join(TRIAL_ROOT, 'pages', arm, `${b.id}.html`);
      if (!existsSync(f)) { row.arms[arm] = { ok: false, reason: 'missing' }; continue; }
      let html;
      try { html = readFileSync(f, 'utf8'); } catch (e) { die(EXIT.IO, `reading ${f}: ${e.message}`); }
      const bytes = statSync(f).size;
      if (html.trim().length < 200) { row.arms[arm] = { ok: false, reason: `too small (${bytes} bytes)` }; continue; }
      // PRE-REGISTERED DROP CRITERIA ONLY (section 4): "fails to generate" or "fails the
      // self-containment check". A missing <html>/<!doctype> wrapper is NEITHER - the browser
      // supplies the implied elements and the page renders normally - so a wrapper-less page is
      // RECORDED as an anomaly and kept, not dropped on a criterion the pre-registration never
      // stated. Decided when it first occurred, with ZERO outcome measurements taken, and the
      // n-without-it sensitivity is reported alongside the headline either way.
      const wrapperless = !/<html[\s>]/i.test(html) && !/<!doctype html/i.test(html);
      if (wrapperless) out.wrapperless.push({ id: b.id, arm });

      const remote = REMOTE.filter(([re]) => re.test(html)).map(([, name]) => name);
      if (remote.length) out.notSelfContained.push({ id: b.id, arm, violations: remote });

      // ENVIRONMENT DIAGNOSTIC, not an outcome measure. This machine runs a global content-guard
      // hook that blocks emoji and emdashes on Write, so a producer that emitted either was forced
      // to rewrite. The sidecoach payload itself contains an emoji, so the intervention is
      // potentially ARM-CORRELATED and has to be visible in the record rather than invisible.
      const emoji = (html.match(/[\u{1F300}-\u{1FAFF}\u{2190}-\u{27BF}\u{FE0F}]/gu) || []).length;
      const emdash = (html.match(/[\u2014\u2013]/g) || []).length;

      const lc = html.toLowerCase();
      const leaked = LEAK_TERMS.filter((t) => lc.includes(t.toLowerCase()));
      if (leaked.length) out.leaks.push({ id: b.id, arm, terms: leaked });

      row.arms[arm] = { ok: remote.length === 0, bytes, sha256: sha256(html), remote, leaked, emoji, emdash, wrapperless };
    }
    row.complete = ARMS.every((a) => row.arms[a] && row.arms[a].ok);
    if (!row.complete) out.dropped.push({ id: row.id, reasons: Object.fromEntries(ARMS.map((a) => [a, row.arms[a] ? (row.arms[a].reason || (row.arms[a].remote || []).join(',') || 'ok') : 'missing'])) });
    out.cells.push(row);
  }

  out.contentGuardDiagnostic = Object.fromEntries(ARMS.map((a) => [a, {
    pagesWithEmoji: out.cells.filter((c) => c.arms[a] && c.arms[a].emoji > 0).length,
    pagesWithEmdash: out.cells.filter((c) => c.arms[a] && c.arms[a].emdash > 0).length,
  }]));

  out.completeTriples = out.cells.filter((c) => c.complete).map((c) => c.id);
  out.realisedN = out.completeTriples.length;

  try {
    mkdirSync(path.join(TRIAL_ROOT, 'results'), { recursive: true });
    writeFileSync(path.join(TRIAL_ROOT, 'results', 'collection.json'), `${JSON.stringify(out, null, 2)}\n`);
  } catch (e) { die(EXIT.IO, `writing collection.json: ${e.message}`); }

  console.log(`collect: realised n = ${out.realisedN} of ${manifest.briefs.length} triples`);
  if (out.leaks.length) {
    console.log(`  BLINDING LEAKS in ${out.leaks.length} page(s):`);
    for (const l of out.leaks) console.log(`    ${l.arm}/${l.id}: ${l.terms.join(', ')}`);
  } else {
    console.log('  blinding leak check: 0 pages name sidecoach, the placebo, or the trial');
  }
  if (out.wrapperless.length) console.log(`  ANOMALY - ${out.wrapperless.length} page(s) omit the <html>/<!doctype> wrapper (kept; renders normally; not a pre-registered drop criterion): ${out.wrapperless.map((w) => `${w.arm}/${w.id}`).join(', ')}`);
  console.log(`  content-guard diagnostic (emoji/emdash surviving in pages): ${ARMS.map((a) => `${a}=${out.contentGuardDiagnostic[a].pagesWithEmoji}/${out.contentGuardDiagnostic[a].pagesWithEmdash}`).join(' ')}`);
  if (out.notSelfContained.length) {
    console.log(`  NOT SELF-CONTAINED (${out.notSelfContained.length}):`);
    for (const v of out.notSelfContained) console.log(`    ${v.arm}/${v.id}: ${v.violations.join(', ')}`);
    process.exit(EXIT.NOT_SELF_CONTAINED);
  }
  if (out.dropped.length) {
    console.log(`  INCOMPLETE TRIPLES (${out.dropped.length}), dropped whole per the pre-registration:`);
    for (const d of out.dropped) console.log(`    ${d.id}: ${JSON.stringify(d.reasons)}`);
    process.exit(EXIT.INCOMPLETE);
  }
  console.log('collect: OK - every triple complete and self-contained');
  process.exit(EXIT.OK);
}

main();
