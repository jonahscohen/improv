#!/usr/bin/env node
/**
 * Stage 5a v2 calibration harness for the marketing-buzzword detector. INTEGRITY: it imports the SHIPPING in-page
 * scorer (inPageBuzzword) from the built dist and runs it via page.evaluate - the SINGLE SOURCE of the taxonomy +
 * weighted-density math. It does NOT reimplement the detector (the Codex P1 fix). It sweeps the firing THRESHOLD
 * over the shipping effectiveDensity (which already bakes in the qualify guard: >=1 STRONG/PEAK term OR >=2 distinct
 * terms) and reports recall / precision / F1 with the negative count + the per-page confusion. DEV ONLY.
 *
 * Build the dist first (npm run build), then: node eval/buzzword-calibrate.mjs
 * The operating point is frozen on PRINCIPLE + this labeled diverse dev signal, NEVER on the frozen-90.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const { inPageBuzzword, BUZZ_DENSITY_THRESHOLD } = await import(path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js'));
const DEV = path.join(ROOT, 'eval/corpus/dev');
const labels = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/dev-subjective-labels.json'), 'utf8')).labels;
const man = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/dev-manifest.json'), 'utf8'));
const regOf = {}; for (const p of man.pages) regOf[p.id] = p.register || 'saas-v1';
const present = (id) => { const m = (labels[id]?.labels || []).find((l) => l.class === 'marketing-buzzword'); return m ? m.present : null; };
const stripScripts = (h) => String(h).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, '');

function confusion(scored, th) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const s of scored) { const fire = s.eff >= th; if (s.gt && fire) tp++; else if (s.gt && !fire) fn++; else if (!s.gt && fire) fp++; else tn++; }
  const prec = tp + fp ? tp / (tp + fp) : 1, rec = tp + fn ? tp / (tp + fn) : 0, f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
  return { th, tp, fp, fn, tn, prec, rec, f1 };
}

const browser = await chromium.launch({ headless: true });
const scored = [];
for (const f of readdirSync(DEV).filter((x) => x.endsWith('.html')).sort()) {
  const id = f.replace('.html', ''); const gt = present(id); if (gt === null) continue;
  // hermetic render matching the shipping scanSubjectiveRendered (strip scripts, abort external, 1280x800).
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
  try { await page.setContent(stripScripts(readFileSync(path.join(DEV, f), 'utf8')), { waitUntil: 'domcontentloaded', timeout: 60000 }); } catch { await ctx.close(); continue; }
  const score = await page.evaluate(inPageBuzzword); await ctx.close();
  scored.push({ id, gt, reg: regOf[id], eff: score.effectiveDensity, density: score.density, words: score.words, qualified: score.effectiveDensity > 0 || score.density === 0 ? score.effectiveDensity > 0 : false, distinct: score.distinctTerms });
}
await browser.close();

const nPos = scored.filter((s) => s.gt).length, nNeg = scored.filter((s) => !s.gt).length;
console.log(`Calibration set: ${scored.length} labeled pages (${nPos} present / ${nNeg} negative). Source: SHIPPING inPageBuzzword.`);
console.log(`(oracle bar: recall 0.5 / precision 0.4)  current production threshold = ${BUZZ_DENSITY_THRESHOLD}\n`);

const THS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.5];
console.log('SWEEP effectiveDensity (the shipping score):');
console.log('  thr   TP FP FN TN   R     P     F1');
for (const th of THS) { const c = confusion(scored, th); console.log(`  ${th.toFixed(2)}  ${String(c.tp).padStart(2)} ${String(c.fp).padStart(2)} ${String(c.fn).padStart(2)} ${String(c.tn).padStart(2)}   ${c.rec.toFixed(2)}  ${c.prec.toFixed(2)}  ${c.f1.toFixed(2)}`); }

const cur = confusion(scored, BUZZ_DENSITY_THRESHOLD);
console.log(`\nAt the current production threshold ${BUZZ_DENSITY_THRESHOLD}: R=${cur.rec.toFixed(3)} P=${cur.prec.toFixed(3)} F1=${cur.f1.toFixed(3)} (TP=${cur.tp} FP=${cur.fp} FN=${cur.fn} TN=${cur.tn}, neg=${cur.tn + cur.fp})`);
console.log(`Per-page (sorted by effectiveDensity):`);
scored.sort((a, b) => b.eff - a.eff);
for (const s of scored) { const fire = s.eff >= BUZZ_DENSITY_THRESHOLD; const mark = s.gt ? (fire ? 'TP' : 'FN') : (fire ? 'FP' : 'TN'); console.log(`  ${s.id.padEnd(13)} ${(s.reg || '?').padEnd(20)} ${(s.gt ? 'P' : '-')} ${mark}  eff=${s.eff.toFixed(2).padStart(5)} raw=${s.density.toFixed(2).padStart(5)} words=${String(s.words).padStart(4)}`); }
