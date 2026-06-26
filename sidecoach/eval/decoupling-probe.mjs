#!/usr/bin/env node
/**
 * RENDER-DECOUPLING sanity check (lead-requested, Stage 1).
 *
 * The objective eval number is partly render-COUPLED: the product renders each corpus page the SAME deterministic
 * way the referee labels it (scripts stripped, external aborted, 1280x800), so it agrees closely. Question: is
 * that agreement GENUINE spec-correctness (the detection is render-ROBUST) or an artifact of sharing the
 * referee's exact transform? Test: re-render a SAMPLE the product's OWN way but PERTURBED (scripts ON, a
 * different viewport) and measure whether agreement with the referee HOLDS. Holds -> robust/genuine; drops ->
 * coupled. (This is a measurement of the held-out pages, not tuning - the scanner is unchanged.)
 *
 * NOTE: the corpus pages are self-contained (inline CSS), so abort-external is kept on both arms (no external
 * CSS to differ); the meaningful perturbations here are script-execution + viewport. The external-resource
 * coupling is the separate S5b real-page question.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { analyzeHtmlOnBrowser } from '../dist/validators/objective-rendered-scanner.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const OBJECTIVE = ['broken-image', 'skipped-heading', 'low-contrast', 'gray-on-color'];
const candidates = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));

// Sample: objective-defect-bearing pages (referee has >=1 objective label), excluding the contaminated page.
// (We skip pages that error under the perturbed scripts-on render - the point is detection stability, not robustness of every page's scripts.)
const sample = candidates
  .filter((c) => c.id !== 'ed_csstricks_live' && (c.objectiveLabels || []).length > 0)
  .slice(0, 20);

const fam = (set) => set.has('low-contrast') || set.has('gray-on-color');
function recallOf(records) {
  // micro objective recall over the sample (contrast-family + heading + broken-image), vs referee labels
  let tp = 0, present = 0;
  for (const c of sample) {
    const ref = new Set((c.objectiveLabels || []).map((o) => o.class));
    const det = records[c.id] || new Set();
    if (ref.has('skipped-heading')) { present++; if (det.has('skipped-heading')) tp++; }
    if (ref.has('low-contrast') || ref.has('gray-on-color')) { present++; if (fam(det)) tp++; }
    if (ref.has('broken-image')) { present++; if (det.has('broken-image')) tp++; }
  }
  return { tp, present, recall: present ? +(tp / present).toFixed(3) : null };
}

const browser = await chromium.launch({ headless: true });
const hermetic = {}, perturbed = {};
let perturbErrors = 0;
try {
  for (const c of sample) {
    const html = readFileSync(path.join(CORPUS, c.file), 'utf8');
    try { hermetic[c.id] = new Set((await analyzeHtmlOnBrowser(browser, html, 30000)).map((f) => f.rule)); } catch { hermetic[c.id] = new Set(); }
    // PERTURBED: scripts ON + a different viewport (still self-contained, abort-external on)
    try { perturbed[c.id] = new Set((await analyzeHtmlOnBrowser(browser, html, 30000, { stripScripts: false, viewport: { width: 1366, height: 768 } })).map((f) => f.rule)); }
    catch { perturbed[c.id] = new Set(); perturbErrors++; }
  }
} finally { await browser.close(); }

// per-page agreement between the two renders (did the same objective classes get detected?)
let pagesIdentical = 0, classFlips = 0;
for (const c of sample) {
  const h = hermetic[c.id], p = perturbed[c.id];
  const allCls = new Set([...h, ...p].filter((r) => OBJECTIVE.includes(r)));
  let same = true;
  for (const cls of allCls) { if (h.has(cls) !== p.has(cls)) { classFlips++; same = false; } }
  if (same) pagesIdentical++;
}

const rh = recallOf(hermetic), rp = recallOf(perturbed);
console.log('=== RENDER-DECOUPLING SANITY CHECK ===');
console.log(`sample: ${sample.length} objective-defect pages | perturbed-render errors: ${perturbErrors}`);
console.log(`objective recall vs referee:  HERMETIC ${rh.recall} (${rh.tp}/${rh.present})  |  PERTURBED(scripts-on,1366x768) ${rp.recall} (${rp.tp}/${rp.present})`);
console.log(`per-page objective detections identical across the two renders: ${pagesIdentical}/${sample.length} | total class flips: ${classFlips}`);
console.log(rh.recall !== null && rp.recall !== null && Math.abs(rh.recall - rp.recall) <= 0.05
  ? 'READ: agreement HOLDS under a different render -> detection is render-ROBUST (the agreement is spec-correctness, not brittle coupling to the exact transform).'
  : 'READ: agreement DROPS under a different render -> detection is render-COUPLED; the eval number overstates real-world.');
