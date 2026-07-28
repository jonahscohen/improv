#!/usr/bin/env node
/**
 * EQUIVALENCE PROOF for the 2026-07-28 nested-cards refactor.
 *
 * The refactor moved nested-cards out of inPageSubjective into its own score/threshold split
 * (inPageNestedCards + nestedCardsFindingFromScore) and collapsed its emission to ONE finding per page. The
 * claim attached to that change is that it does not alter WHICH pages fire. This file proves it rather than
 * asserting it: it runs the PRE-CHANGE detection predicate (lifted verbatim from commit 363458ea) and the
 * SHIPPING one side by side on every page of all three corpora, and reports any page where they disagree.
 *
 * SCOPE OF THE CLAIM, stated so it is not over-read: this proves the FIRE DECISION is identical. It does NOT
 * prove the evidence payload is - the new scorer picks the SMALLEST qualifying descendant as the representative
 * where the old one effectively used the first, so a finding's selector and detail can differ. That was a
 * deliberate change (a near-full-size wrapper child is the weakest evidence of a card-in-card).
 *
 * Usage: npm run build && node eval/nested-cards-equivalence.mjs
 * Exit 0 = identical on every page, 2 = IO error, 3 = render failure, 4 = A DISAGREEMENT (the claim is false).
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const dist = path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(dist)) { console.error('nested-cards-equivalence: dist not built. Run npm run build.'); process.exit(2); }
const { stripScripts, inPageNestedCards, nestedCardsFindingFromScore, inPageSubjective } = await import(dist);

/* ---- PRE-CHANGE predicate, verbatim from the nested-cards block of inPageSubjective at 363458ea. It returned
       nestedCount, and the detector fired at nestedCount >= 1. ---- */
/* istanbul ignore next - executes in the browser context */
function inPageNestedCountBefore() {
  const CARD_MIN_W = 100, CARD_MIN_H = 60, CARD_RADIUS = 4, INNER_MAX_AREA_FRAC = 0.85;
  function isCard(el) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
    const box = el.getBoundingClientRect();
    if (box.width < CARD_MIN_W || box.height < CARD_MIN_H) return false;
    if (!el.firstElementChild) return false;
    const br = Math.max(parseFloat(cs.borderTopLeftRadius) || 0, parseFloat(cs.borderTopRightRadius) || 0, parseFloat(cs.borderBottomLeftRadius) || 0, parseFloat(cs.borderBottomRightRadius) || 0);
    if (br < CARD_RADIUS) return false;
    const hasBorder = parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none';
    const hasShadow = !!cs.boxShadow && cs.boxShadow !== 'none';
    return hasBorder || hasShadow;
  }
  const cards = [];
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) if (isCard(el)) cards.push(el);
  const cardSet = new Set(cards);
  let nestedCount = 0;
  for (const outer of cards) {
    const oBox = outer.getBoundingClientRect(); const oArea = oBox.width * oBox.height;
    for (const d of Array.from(outer.querySelectorAll('*'))) {
      if (!cardSet.has(d)) continue;
      const dBox = d.getBoundingClientRect();
      if (dBox.width * dBox.height < INNER_MAX_AREA_FRAC * oArea) { nestedCount++; break; }
    }
  }
  return nestedCount;
}

/* ---- PRE-CHANGE tiny-text predicate, same source. It fired on the same proportion test; only the EMISSION
       changed (up to 20 findings -> 1), so this checks the fire decision is untouched. ---- */
/* istanbul ignore next */
function inPageTinyFiresBefore() {
  const SMALL_PX = 13, PROPORTION_MIN = 0.15, MIN_CONTENT_CHARS = 200;
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
  function ownText(el) { let t = ''; for (const n of Array.from(el.childNodes)) if (n.nodeType === 3 && n.textContent) t += n.textContent; return t.replace(/\s+/g, ' ').trim(); }
  function paintedInvisible(cs) {
    const fill = cs.webkitTextFillColor;
    const colors = [cs.color, fill].filter(Boolean);
    return colors.some((c) => { const m = c.match(/rgba?\(([^)]+)\)/i); if (!m) return /^transparent$/i.test(c.trim()); const p = m[1].split(/[,/]/).map((x) => parseFloat(x.trim())); return p.length >= 4 && p[3] <= 0.05; });
  }
  const PERIPHERAL_TAGS = new Set(['footer', 'nav', 'aside', 'menu']);
  const PERIPHERAL_ROLES = new Set(['navigation', 'contentinfo', 'complementary', 'menubar', 'menu']);
  const peripheral = (el) => {
    for (let n = el; n && n instanceof Element; n = n.parentElement) {
      if (PERIPHERAL_TAGS.has((n.tagName || '').toLowerCase())) return true;
      const role = (n.getAttribute('role') || '').trim().toLowerCase().split(/\s+/)[0];
      if (role && PERIPHERAL_ROLES.has(role)) return true;
    }
    return false;
  };
  let contentChars = 0, smallChars = 0;
  for (const el of Array.from(document.body ? document.body.querySelectorAll('*') : [])) {
    const text = ownText(el);
    if (!text || !visuallyVisible(el) || peripheral(el)) continue;
    const cs0 = getComputedStyle(el);
    if (paintedInvisible(cs0)) continue;
    const fontPx = parseFloat(cs0.fontSize);
    if (!(fontPx > 0)) continue;
    contentChars += text.length;
    if (fontPx <= SMALL_PX) smallChars += text.length;
  }
  const proportion = contentChars > 0 ? smallChars / contentChars : 0;
  return contentChars >= MIN_CONTENT_CHARS && proportion >= PROPORTION_MIN;
}

const DIRS = [
  path.join(ROOT, 'eval/corpus/dev'),
  path.join(ROOT, 'eval/corpus/candidates'),
  path.join(ROOT, 'eval/corpus/buzzword-heldout'),
];

const browser = await chromium.launch({ headless: true });
let n = 0, renderFailures = 0;
const disagreements = [];
for (const dir of DIRS) {
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.html')).sort()) {
    const id = `${path.basename(dir)}/${f.replace(/\.html$/, '')}`;
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
    try {
      await page.setContent(stripScripts(readFileSync(path.join(dir, f), 'utf8')), { waitUntil: 'domcontentloaded', timeout: 60000 });
      const before = (await page.evaluate(inPageNestedCountBefore)) >= 1;
      const after = nestedCardsFindingFromScore(await page.evaluate(inPageNestedCards)) !== null;
      const tinyBefore = await page.evaluate(inPageTinyFiresBefore);
      const subj = await page.evaluate(inPageSubjective);
      const tinyAfter = subj.some((x) => x.rule === 'tiny-text');
      const tinyCount = subj.filter((x) => x.rule === 'tiny-text').length;
      if (before !== after) disagreements.push(`${id}: nested-cards before=${before} after=${after}`);
      if (tinyBefore !== tinyAfter) disagreements.push(`${id}: tiny-text before=${tinyBefore} after=${tinyAfter}`);
      if (tinyAfter && tinyCount !== 1) disagreements.push(`${id}: tiny-text emitted ${tinyCount} findings, expected exactly 1`);
      n++;
    } catch (e) {
      renderFailures++;
      process.stderr.write(`  ${id}: RENDER FAILED - ${e && e.message ? e.message : e}\n`);
    } finally { await ctx.close(); }
  }
}
await browser.close();

console.log(`nested-cards / tiny-text equivalence: ${n} page(s) compared across dev + candidates + held-out.`);
if (disagreements.length) {
  console.error(`DISAGREEMENT on ${disagreements.length} page(s) - the refactor CHANGED which pages fire:`);
  for (const d of disagreements) console.error(`  ${d}`);
  process.exit(4);
}
console.log('IDENTICAL on every page: the refactor changed emission shape only, not the fire decision.');
console.log('(Scope: the FIRE DECISION. Selector/detail evidence may differ - the representative pair is now the smallest, not the first.)');
if (renderFailures) { console.error(`${renderFailures} page(s) failed to render`); process.exit(3); }
