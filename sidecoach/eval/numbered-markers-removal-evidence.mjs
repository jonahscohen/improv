#!/usr/bin/env node
/**
 * REMOVAL EVIDENCE for numbered-section-markers (removed from the scanner 2026-07-28).
 *
 * The detector is gone, so this file carries the ONLY copy of its scoring logic that still exists - lifted
 * verbatim from the scanner at commit 363458ea before deletion. That is deliberate and is NOT a violation of the
 * single-source rule: there is no shipping detector for this to drift from. It exists so the claim "we removed it
 * because we measured it" stays re-runnable instead of resting on a number in a beat nobody can reproduce.
 *
 * It sweeps the detector's three parameters (prominence floor, zero-padding requirement, run length) over the
 * TUNE population (dev 48 + candidates 90, 6 labeled positives) and reports precision/recall at each point.
 *
 * Usage: npm run build && node eval/numbered-markers-removal-evidence.mjs
 * Exit 0 ok, 2 IO error, 3 a page failed to render, 5 the label population is not the one this evidence describes.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const dist = path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(dist)) { console.error('numbered-markers-removal-evidence: dist not built. Run npm run build.'); process.exit(2); }
const { stripScripts } = await import(dist);

/* ---- the REMOVED detector's candidate collector, verbatim from the scanner before deletion. Returns EVERY
       standalone 1-2 digit numeral with its rendered size and zero-padding, which is the raw material the three
       swept parameters consumed. ---- */
/* istanbul ignore next - executes in the browser context */
function inPageNumberedCandidatesRemoved() {
  function sel(el) {
    const t = el.tagName.toLowerCase();
    if (el.id) return `${t}#${el.id}`;
    const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.');
    return cls ? `${t}.${cls}` : t;
  }
  function visuallyVisible(el) {
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible') return false;
    for (let n = el; n && n instanceof Element; n = n.parentElement) { if (parseFloat(getComputedStyle(n).opacity) === 0) return false; }
    const rects = el.getClientRects();
    if (!rects.length) return false;
    const box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return false;
    if ((box.width <= 1 || box.height <= 1) && cs.overflow !== 'visible') return false;
    if (box.right <= 0 || box.bottom <= 0) return false;
    if (parseFloat(cs.textIndent) <= -999) return false;
    const clipM = (cs.clip || '').replace(/\s+/g, ' ').match(/^rect\(\s*([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?[ ,]+([-\d.]+)(?:px)?\s*\)$/i);
    if (clipM) { const t = parseFloat(clipM[1]), rr = parseFloat(clipM[2]), b = parseFloat(clipM[3]), l = parseFloat(clipM[4]); if (rr <= l || b <= t) return false; }
    if (/^inset\(\s*(100%|50%)\b/.test(cs.clipPath || '')) return false;
    return true;
  }
  function ownText(el) {
    let t = '';
    for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent) t += n.textContent;
    return t.replace(/\s+/g, ' ').trim();
  }
  const numRe = /^0?\d{1,2}$/;
  const out = [];
  const scope = document.body ? [document.body, ...Array.from(document.body.querySelectorAll('*'))] : [];
  for (const el of scope) {
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') continue;
    if (!visuallyVisible(el)) continue;
    const cs = getComputedStyle(el);
    const candidates = [];
    const ot = ownText(el);
    if (ot) candidates.push({ text: ot, px: parseFloat(cs.fontSize) || 0 });
    for (const pseudo of ['::before', '::after']) {
      const pcs = getComputedStyle(el, pseudo);
      if (pcs.display === 'none' || pcs.visibility === 'hidden') continue;
      const content = (pcs.content || '').trim();
      const lit = content.match(/^["']([^"']*)["']$/);
      if (lit) candidates.push({ text: lit[1].trim(), px: parseFloat(pcs.fontSize) || parseFloat(cs.fontSize) || 0 });
    }
    for (const c of candidates) {
      if (!numRe.test(c.text)) continue;
      out.push({ value: parseInt(c.text, 10), padded: /^0\d$/.test(c.text), px: c.px, selector: sel(el) });
      break;
    }
    if (out.length >= 400) break;
  }
  return out;
}

/* ---- the REMOVED motif test, parameterised so the sweep covers what shipped (32 / padded / run 3) ---- */
const longestRun = (vals) => {
  const u = Array.from(new Set(vals)).sort((a, b) => a - b);
  let run = u.length ? 1 : 0, best = run;
  for (let i = 1; i < u.length; i++) { if (u[i] === u[i - 1] + 1) { run++; if (run > best) best = run; } else run = 1; }
  return best;
};
const fires = (cands, minPx, requirePadded, minRun) => {
  const c = cands.filter((m) => m.px >= minPx && (requirePadded ? m.padded : true));
  if (c.length < minRun) return false;
  return longestRun(c.map((m) => m.value)) >= minRun;
};

/* ---- corpora + labels ---- */
const devLabels = (() => {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/dev-subjective-labels.json'), 'utf8')).labels;
  const o = {}; for (const [id, e] of Object.entries(raw)) { o[id] = {}; for (const l of e.labels || []) o[id][l.class] = !!l.present; } return o;
})();
const candLabels = (() => {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/candidates.json'), 'utf8'));
  const o = {}; for (const c of raw) { o[c.id] = {}; for (const l of c.subjectiveLabels || []) o[c.id][l.class] = !!l.present; } return o;
})();
const SETS = [
  { dir: path.join(ROOT, 'eval/corpus/dev'), labels: devLabels },
  { dir: path.join(ROOT, 'eval/corpus/candidates'), labels: candLabels },
];

const browser = await chromium.launch({ headless: true });
const pages = [];
let renderFailures = 0;
for (const set of SETS) {
  for (const f of readdirSync(set.dir).filter((x) => x.endsWith('.html')).sort()) {
    const id = f.replace(/\.html$/, '');
    const gt = set.labels[id] ? set.labels[id]['numbered-section-markers'] : undefined;
    if (gt === undefined) continue;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
    try {
      await page.setContent(stripScripts(readFileSync(path.join(set.dir, f), 'utf8')), { waitUntil: 'domcontentloaded', timeout: 60000 });
      pages.push({ id, gt, cands: await page.evaluate(inPageNumberedCandidatesRemoved) });
    } catch (e) {
      renderFailures++;
      process.stderr.write(`  ${id}: RENDER FAILED - ${e && e.message ? e.message : e}\n`);
    } finally { await ctx.close(); }
  }
}
await browser.close();

const score = (minPx, padded, run) => {
  let tp = 0, fp = 0, fn = 0, tn = 0; const fps = [];
  for (const p of pages) {
    const f = fires(p.cands, minPx, padded, run);
    if (p.gt && f) tp++; else if (p.gt && !f) fn++; else if (!p.gt && f) { fp++; fps.push(p.id); } else tn++;
  }
  return { tp, fp, fn, tn, prec: tp + fp ? tp / (tp + fp) : null, rec: tp + fn ? tp / (tp + fn) : null, fps };
};
const f3 = (x) => (x === null ? 'undefined (no fires)' : x.toFixed(3));
const pos = pages.filter((p) => p.gt).length;
// FAIL CLOSED on a changed population. Every claim in the beat is stated over "138 labeled pages, 6 positives";
// if the corpus drifts, the table below would still print and would silently describe a different experiment.
const EXPECTED_PAGES = 138, EXPECTED_POSITIVES = 6;
if (pages.length !== EXPECTED_PAGES || pos !== EXPECTED_POSITIVES) {
  console.error(`numbered-markers-removal-evidence: expected ${EXPECTED_PAGES} labeled pages with ${EXPECTED_POSITIVES} positives, got ${pages.length} with ${pos}.`);
  console.error('The removal was decided over the original population; re-derive it before quoting these numbers.');
  process.exit(5);
}
console.log(`numbered-section-markers REMOVAL EVIDENCE - TUNE population: ${pages.length} labeled pages, ${pos} positives\n`);
console.log('  minPx padded run    P                      R      TP FP FN');
for (const minPx of [32, 24, 18, 12, 0]) {
  for (const padded of [true, false]) {
    for (const run of [3, 2]) {
      const s = score(minPx, padded, run);
      const shipped = minPx === 32 && padded && run === 3 ? '   <- THE SHIPPED POINT' : '';
      console.log(`  ${String(minPx).padStart(5)} ${String(padded).padStart(6)} ${String(run).padStart(3)}    ${f3(s.prec).padEnd(22)} ${f3(s.rec)}  ${String(s.tp).padStart(2)} ${String(s.fp).padStart(2)} ${String(s.fn).padStart(2)}${shipped}`);
    }
  }
}
const best = score(0, true, 3);
console.log(`\nBest non-inert point (no prominence floor, zero-padded, run 3): P=${f3(best.prec)} R=${f3(best.rec)}  FPs: ${best.fps.join(', ') || 'none'}`);
console.log('A coin-flip detector is worse than none under a precision-first ruling. Removed.');
if (renderFailures) { console.error(`${renderFailures} page(s) failed to render`); process.exit(3); }
