#!/usr/bin/env node
/**
 * #3 SCORE-NEUTRALITY PROBE (lead revert-condition 2).
 *
 * Batch-2 added a "skip contrast on any element with CSS filter / mix-blend-mode / backdrop-filter in its
 * ancestry" rule (#3). We reverted it on STANDARD grounds: axe-core and Lighthouse IGNORE CSS filter and
 * compute declared-color contrast; the skip was non-standard over-conservatism. The lead's condition: prove the
 * revert is SCORE-NEUTRAL on the full corpus - i.e. that un-skipping filter cannot move any page's labels.
 *
 * The skip could only ever have changed a verdict for a VISIBLE, TEXT-BEARING element that has a non-trivial
 * filter / mix-blend-mode / backdrop-filter somewhere in its self-or-ancestry (up to the first opaque bg). This
 * probe counts exactly that set per page - an UPPER BOUND on "#3 could matter here". If the count is 0 across
 * every page, batch-2's skip never fired on any text node, so removing it changes no contrast verdict: the
 * revert is score-neutral BY CONSTRUCTION (no contrast math needed). Any page with count>0 is surfaced for the
 * finer check (is that filtered text actually low-contrast).
 *
 * Render basis MATCHES the shipping scanner exactly (HERMETIC: scripts stripped, external aborted to data:/about:
 * only, 1280x800, reducedMotion=reduce, deviceScaleFactor=1) so the rendered DOM the probe inspects is the same
 * DOM the scanner reads. Reads the frozen candidates.json; honors corpus/contaminated.json (the 89-page corpus).
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { stripScripts } from '../dist/validators/objective-rendered-scanner.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');

const candidates = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
const contaminated = existsSync(path.join(CORPUS, 'contaminated.json'))
  ? new Set((JSON.parse(readFileSync(path.join(CORPUS, 'contaminated.json'), 'utf8')).ids || []))
  : new Set();
const pages = candidates.filter((c) => !contaminated.has(c.id));

// In-page: count VISIBLE, text-bearing elements with filter/mix-blend-mode/backdrop-filter != none/normal in
// self-or-ancestry up to (and including) the first ancestor with an opaque background-color. Returns count + a
// few example tag/class samples for any page that is non-zero.
function inPageFilterTextCount() {
  const isOpaqueBg = (cs) => {
    const m = cs.backgroundColor && cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
    if (!m) return false;
    const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
    return parts.length < 4 ? true : parts[3] >= 1; // rgb() = opaque; rgba() opaque iff alpha==1
  };
  const nonTrivialCompositing = (cs) =>
    (cs.filter && cs.filter !== 'none') ||
    (cs.backdropFilter && cs.backdropFilter !== 'none') ||
    (cs.mixBlendMode && cs.mixBlendMode !== 'normal');
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const hasOwnText = (el) => {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent && n.textContent.trim().length > 0) return true;
    return false;
  };
  const samples = [];
  let count = 0;
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
    if (!hasOwnText(el) || !visible(el)) continue;
    // walk self -> ancestors, stop at first opaque bg, looking for non-trivial compositing
    let compositing = false;
    for (let n = el; n && n instanceof Element; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (nonTrivialCompositing(cs)) { compositing = true; break; }
      if (isOpaqueBg(cs)) break;
    }
    if (compositing) {
      count++;
      if (samples.length < 5) samples.push((el.tagName || '').toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : ''));
    }
  }
  return { count, samples };
}

const browser = await chromium.launch({ headless: true });
const offenders = [];
let scanned = 0;
try {
  for (const c of pages) {
    const html = readFileSync(path.join(CORPUS, c.file), 'utf8');
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    try {
      const page = await context.newPage();
      await page.route('**/*', (route) => { const u = route.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? route.continue() : route.abort(); });
      await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded', timeout: 60000 });
      const { count, samples } = await page.evaluate(inPageFilterTextCount);
      scanned++;
      if (count > 0) { offenders.push({ id: c.id, count, samples }); console.error(`  ${c.id}: ${count} filtered-text node(s) [${samples.join(', ')}]`); }
      else console.error(`  ${c.id}: 0`);
    } catch (e) { offenders.push({ id: c.id, error: e instanceof Error ? e.message.split('\n')[0] : String(e) }); console.error(`  FAIL ${c.id}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); }
    finally { await context.close(); }
  }
} finally { await browser.close(); }

const realOffenders = offenders.filter((o) => !o.error && o.count > 0);
const errored = offenders.filter((o) => o.error);
console.log('\n=== #3 FILTER-NEUTRALITY PROBE RESULT ===');
console.log(`scanned ${scanned}/${pages.length} pages`);
console.log(`pages with visible filtered TEXT (where the filter-skip could change a verdict): ${realOffenders.length}`);
if (realOffenders.length) { for (const o of realOffenders) console.log(`  ${o.id}: ${o.count} [${(o.samples || []).join(', ')}]`); }
if (errored.length) console.log(`render errors (inconclusive): ${errored.map((o) => o.id).join(', ')}`);
console.log(realOffenders.length === 0 && errored.length === 0
  ? 'VERDICT: NEUTRAL - no visible text under filter/blend/backdrop on the corpus; #3-revert changes no contrast verdict by construction.'
  : 'VERDICT: NOT trivially neutral - inspect the listed pages for actual low-contrast under the filtered text.');
