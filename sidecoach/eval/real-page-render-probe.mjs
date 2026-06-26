#!/usr/bin/env node
/**
 * REAL-PAGE RENDER GENERALIZATION probe (Jonah's real-world caveat closure). ONE-SHOT, not a permanent eval change.
 * Q: does objective 0.936 (measured on HERMETIC stored captures - scripts stripped, external blocked) HOLD on REAL
 * live pages rendered normally (scripts + external CSS/fonts loading)? The decoupling probe covered scripts+viewport
 * with external blocked BOTH arms; this tests the untested EXTERNAL-resource dimension.
 * DESIGN: sample ~18 _live pages. REAL = navigate the live URL fully (scripts+external on). HERMETIC = the OWNED
 * scanner on the stored capture (the exact 0.936 input). Compare per-class objective detections. Live arm is noisy
 * (drift since capture) - noted. Metric: per-class agreement across pages.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { scanObjectiveRendered, inPageObjective, stripScripts } from '../dist/validators/objective-rendered-scanner.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const OBJ = ['broken-image', 'skipped-heading', 'low-contrast', 'gray-on-color', 'justified-text'];
const cand = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
// sample _live pages with a real source URL; cap ~18
const live = cand.filter((c) => /_live/.test(c.id) && c.provenance && /^https?:\/\//.test(c.provenance.source || '')).slice(0, 18);

const browser = await chromium.launch({ headless: true });
const rows = []; const agree = {}; for (const k of OBJ) agree[k] = { same: 0, total: 0 };
try {
  for (const c of live) {
    const url = c.provenance.source;
    // HERMETIC (the 0.936 basis): owned scanner on the stored capture
    let hermetic = null;
    try { const s = await scanObjectiveRendered(readFileSync(path.join(CORPUS, c.file), 'utf8'), { timeoutMs: 60000 }); hermetic = s.available ? new Set(s.findings.map((f) => f.rule)) : null; } catch { hermetic = null; }
    // REAL: live nav, scripts + external on
    let real = null;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1, userAgent: 'Mozilla/5.0 (sidecoach-render-probe)' });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      const findings = await page.evaluate(inPageObjective);
      real = new Set(findings.map((f) => f.rule));
    } catch (e) { real = null; }
    finally { await ctx.close(); }
    if (!hermetic || !real) { rows.push({ id: c.id, skip: !hermetic ? 'hermetic-unavail' : 'real-fetch-failed' }); console.error(`  SKIP ${c.id} (${!hermetic ? 'hermetic' : 'real'})`); continue; }
    const per = {};
    for (const k of OBJ) { const h = hermetic.has(k), r = real.has(k); per[k] = h === r ? '=' : (h ? 'H-only' : 'R-only'); agree[k].total++; if (h === r) agree[k].same++; }
    rows.push({ id: c.id, hermetic: [...hermetic].filter((x) => OBJ.includes(x)), real: [...real].filter((x) => OBJ.includes(x)), per });
    console.error(`  ${c.id}: H[${rows[rows.length - 1].hermetic.join(',')}] R[${rows[rows.length - 1].real.join(',')}] ${OBJ.map((k) => k[0] + ':' + per[k]).join(' ')}`);
  }
} finally { await browser.close(); }

console.log('\n=== REAL vs HERMETIC objective agreement (per class) ===');
let ts = 0, tt = 0;
for (const k of OBJ) { const a = agree[k]; if (!a.total) { console.log(k.padEnd(18) + 'n/a'); continue; } console.log(k.padEnd(18) + `${a.same}/${a.total} = ${(a.same / a.total * 100).toFixed(0)}% agree`); ts += a.same; tt += a.total; }
console.log('OVERALL'.padEnd(18) + `${ts}/${tt} = ${(ts / tt * 100).toFixed(0)}% agree`);
const scored = rows.filter((r) => !r.skip).length;
console.log(`(scored ${scored}/${live.length} sampled live pages; skips = live-fetch failures or hermetic-unavail)`);
