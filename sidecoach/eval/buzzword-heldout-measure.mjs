#!/usr/bin/env node
/**
 * LEAD-HELD held-out head-to-head for marketing-buzzword (v3 precision test).
 * Measures OURS (shipping scanSubjectiveRendered) vs ORACLE (oracle detect.mjs via runOracle) on the FRESH
 * 38-page held-out (eval/corpus/buzzword-heldout), scored against the Codex held-out labels. Same methodology as
 * the frozen-90 scorecard, focused on the one class. The held-out is disjoint from dev + frozen-90 (verified by
 * buzzword's capture); this is the clean precision measurement, run ONCE.
 *
 * Usage: node eval/buzzword-heldout-measure.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const DIR = path.join(ROOT, 'eval/corpus/buzzword-heldout');
const MAN = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/buzzword-heldout-manifest.json'), 'utf8'));
const LAB = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/buzzword-heldout-labels.json'), 'utf8')).labels;

const { scanSubjectiveRendered } = await import(path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js'));
const { runOracle } = await import('./oracle-comparator.mjs');

const CLASS = 'marketing-buzzword';
const gtOf = (id) => {
  const e = LAB[id];
  if (!e) return null;
  const l = (e.labels || []).find((x) => x.class === CLASS);
  return l ? !!l.present : null;
};

const pages = (MAN.pages || []).filter((p) => !p.failed).map((p) => p.id);
const rows = [];
let skipped = 0;
for (const id of pages) {
  const gt = gtOf(id);
  if (gt === null) { skipped++; continue; } // unlabeled -> skip (don't guess)
  const file = path.join(DIR, `${id}.html`);
  const html = readFileSync(file, 'utf8');
  // OURS: the shipping rendered scanner end-to-end (render + inPageBuzzword + threshold + merge).
  let ours = null;
  try { const s = await scanSubjectiveRendered(html, { timeoutMs: 60000 }); ours = s && s.available ? s.findings.some((f) => f.rule === CLASS) : null; }
  catch { ours = null; }
  // ORACLE: oracle detect.mjs headless; fire iff a marketing-buzzword finding.
  let imp = null;
  try { const r = await runOracle(file, { timeoutMs: 120000 }); imp = r && r.available ? (r.findings || []).some((f) => f.rule === CLASS) : null; }
  catch { imp = null; }
  rows.push({ id, reg: (MAN.pages.find((p) => p.id === id) || {}).register, gt, ours, imp });
  process.stderr.write(`  ${id.padEnd(18)} gt=${gt ? 'P' : '.'} ours=${ours === null ? '?' : ours ? 'F' : '.'} imp=${imp === null ? '?' : imp ? 'F' : '.'}\n`);
}

function score(rows, key) {
  let tp = 0, fp = 0, fn = 0, tn = 0, unavail = 0;
  for (const r of rows) {
    if (r[key] === null) { unavail++; continue; }
    if (r.gt && r[key]) tp++;
    else if (r.gt && !r[key]) fn++;
    else if (!r.gt && r[key]) fp++;
    else tn++;
  }
  const rec = tp + fn ? tp / (tp + fn) : null;
  const prec = tp + fp ? tp / (tp + fp) : null;
  const f1 = rec && prec ? (2 * rec * prec) / (rec + prec) : null;
  return { tp, fp, fn, tn, unavail, rec, prec, f1 };
}
const fmt = (x) => x === null ? 'n/a' : x.toFixed(3);
const present = rows.filter((r) => r.gt).length;
console.log(`\n=== FRESH HELD-OUT head-to-head: marketing-buzzword (${rows.length} labeled, ${present} present / ${rows.length - present} negative; ${skipped} unlabeled skipped) ===`);
for (const [name, key] of [['OURS (v3)', 'ours'], ['oracle', 'imp']]) {
  const s = score(rows, key);
  console.log(`${name.padEnd(12)} R=${fmt(s.rec)} P=${fmt(s.prec)} F1=${fmt(s.f1)}  (TP=${s.tp} FP=${s.fp} FN=${s.fn} TN=${s.tn}${s.unavail ? ' unavail=' + s.unavail : ''})`);
}
console.log('\nFP (ours, the precision test):', rows.filter((r) => !r.gt && r.ours).map((r) => `${r.id}[${r.reg}]`).join(', ') || 'none');
console.log('FN (ours):', rows.filter((r) => r.gt && r.ours === false).map((r) => `${r.id}[${r.reg}]`).join(', ') || 'none');
