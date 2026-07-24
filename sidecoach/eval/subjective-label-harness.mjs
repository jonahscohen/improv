#!/usr/bin/env node
/**
 * Contract-6 SUBJECTIVE-LABELING HARNESS (Stage 0) - the PIPE for the lead-run Codex labeling pass.
 *
 * Division of labor (Jonah + lead): the architect builds this infra (the pipe) but does NOT produce labels.
 * The LEAD runs it; Codex (independent model, gpt-5.x via `codex exec`) sets the SUBJECTIVE ground truth for
 * the 22 held classes. Labels recorded labeledBy=codex with the finalized rubric's content-SHA + invocation,
 * so the pass is reproducible and the freeze gate (author!=labeler) can verify independence.
 *
 * SIGNAL per class (lead-finalized rubric "LABELING SIGNAL" section): ~18 classes are VISUAL gestalt -> the
 * RENDERED SCREENSHOT is the primary signal (judging from CSS text is the mentally-render unreliability the
 * objective labeler was rebuilt to avoid); 2 are TEXTUAL (page copy); 2 are MOTION (animation/transition
 * character in markup - a static image can't show motion). So the harness gives Codex: (a) a deterministic
 * full-page SCREENSHOT via `-i` (vision-verified: codex sees it + judged known cream/gradient cases right),
 * (b) the page's visible TEXT sample, (c) the page's MOTION declarations. Vision path = same independent
 * model family (codex/gpt) - satisfies Jonah's independent-model ruling AND the vision requirement.
 *
 * GUARDS: records labeledBy=codex ONLY (architect can't self-label); records rubricSha + model + utc +
 * screenshot. --dry-run renders the screenshot + prints the invocation WITHOUT calling Codex (architect
 * pipe-verification only - produces no labels). The LEAD runs the real pass.
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CORPUS = path.join(HERE, 'corpus');
const CANDIDATES = path.join(CORPUS, 'candidates.json');
const RUBRIC = path.join(CORPUS, 'subjective-rubric.md');
const SHOTS = path.join(CORPUS, '.shots'); // derived screenshots (gitignored; regenerated deterministically)

const VISUAL = new Set(['cream-palette', 'ai-color-palette', 'hero-eyebrow-chip', 'repeated-section-kickers', 'numbered-section-markers', 'icon-tile-stack', 'italic-serif-display', 'nested-cards', 'side-stripe-borders', 'glassmorphism-default', 'hero-metric-template', 'gradient-text', 'dark-glow', 'tiny-text', 'wide-tracking', 'all-caps-body', 'tight-leading', 'extreme-negative-tracking']);
// TYPEFACE: judged from the page's DECLARED font-family stacks, never the screenshot. The hermetic render
// blocks webfonts, so a page that deliberately names a custom family still PAINTS as a plain system face -
// a screenshot-only labeler calls that "default" when the page in fact chose a typeface. Proven 2026-07-24:
// the first A5a pass flipped six deliberately-branded fixtures to present for exactly this reason.
const TYPEFACE = new Set(['default-typeface']);
const TEXTUAL = new Set(['marketing-buzzword', 'aphoristic-cadence']);
const MOTION = new Set(['layout-transition', 'bounce-easing']);

// Provenance of HOW a label was obtained. Stale strings are a silent integrity problem: a reader auditing
// `method` would conclude the typeface classes were judged from the screenshot (they are judged from the
// CSSOM walk), which is exactly the mistake the screenshot-basis pass made.
export const LABEL_METHOD = 'screenshot-vision+text+motion+typeface-cssom';
/** Signal-count banner, DERIVED from the sets - a hardcoded count drifts the moment a class is added. */
export function signalCounts() { return `${VISUAL.size} screenshot / ${TEXTUAL.size} text / ${MOTION.size} motion / ${TYPEFACE.size} typeface`; }
// THROWS on an unknown class rather than defaulting. A rubric class that is not in any signal set used to
// fall through to 'motion', which silently mislabels HOW the label was obtained for every future class.
export function signalOfClass(cls) {
  if (VISUAL.has(cls)) return 'screenshot';
  if (TEXTUAL.has(cls)) return 'text';
  if (TYPEFACE.has(cls)) return 'typeface';
  if (MOTION.has(cls)) return 'motion';
  throw new Error(`refused: class "${cls}" is in the rubric but in no signal set - add it to VISUAL/TEXTUAL/TYPEFACE/MOTION before labeling`);
}
/**
 * Validate a Codex verdict against the rubric before it becomes ground truth. A verdict that silently
 * omits classes, invents classes, or returns a non-boolean `present` is corrupt GT, not a label.
 */
export function validateVerdict(verdict, classes) {
  if (!verdict || typeof verdict !== 'object' || Array.isArray(verdict)) throw new Error('refused: verdict is not a JSON object');
  const want = new Set(classes.map((c) => c.class));
  const got = new Set(Object.keys(verdict));
  const missing = [...want].filter((c) => !got.has(c));
  const extra = [...got].filter((c) => !want.has(c));
  if (missing.length) throw new Error(`refused: verdict is missing ${missing.length} rubric class(es): ${missing.join(', ')}`);
  if (extra.length) throw new Error(`refused: verdict invents ${extra.length} class(es) not in the rubric: ${extra.join(', ')}`);
  for (const [cls, v] of Object.entries(verdict)) {
    if (!v || typeof v !== 'object') throw new Error(`refused: verdict.${cls} is not an object`);
    if (typeof v.present !== 'boolean') throw new Error(`refused: verdict.${cls}.present is ${JSON.stringify(v.present)}, must be a boolean`);
    if (v.confidence !== undefined && v.confidence !== null && !(typeof v.confidence === 'number' && v.confidence >= 0 && v.confidence <= 1)) {
      throw new Error(`refused: verdict.${cls}.confidence is ${JSON.stringify(v.confidence)}, must be null or a number in [0,1]`);
    }
  }
  return verdict;
}

export function rubricInfo() {
  const text = readFileSync(RUBRIC, 'utf8');
  const sha = createHash('sha256').update(text).digest('hex');
  const classes = [...text.matchAll(/^-\s+([a-z][a-z0-9-]+):\s+(.+)$/gim)].map((m) => ({ class: m[1], desc: m[2].trim() }));
  // dedupe (the LABELING SIGNAL section re-lists class names in prose; keep only the definition bullets)
  const seen = new Set(); const defs = [];
  for (const c of classes) { if (!seen.has(c.class) && /[a-z]/.test(c.desc) && c.desc.length > 20) { seen.add(c.class); defs.push(c); } }
  return { sha, classes: defs, text };
}

const ANIM_OFF = '*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}';
function stripScripts(html) { return String(html).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<script\b[^>]*\/?>/gi, ''); }

// ---- ANSWER-LEAK CONTAINMENT (the labeler must never be told which page it is looking at) ----------------
// The attachment filename used to be the page id (`dev-p04-webfont-declared-never-applied.png`), which put the
// polarity prefix AND a plain-English statement of the verdict in the labeler's argv. An opaque, id-derived
// digest keeps the label associable to its page without carrying a single word of the scenario.
export function opaqueShotName(pageId) { return `shot-${createHash('sha256').update(String(pageId)).digest('hex').slice(0, 12)}.png`; }

/** Fail-loud guard: refuse to hand Codex an attachment name that carries the page id or its polarity. */
export function assertNoLeak(pageId, shotPath) {
  const base = path.basename(String(shotPath));
  const lower = base.toLowerCase(), id = String(pageId).toLowerCase();
  const bad = [];
  if (lower.includes(id)) bad.push(`carries the page id "${pageId}"`);
  if (/(^|[^a-z0-9])[pn]\d/i.test(base)) bad.push('carries a polarity prefix (p0.. or n0..)');
  for (const tok of id.split(/[^a-z0-9]+/).filter((t) => t.length >= 3)) if (lower.includes(tok)) bad.push(`carries id token "${tok}"`);
  if (bad.length) throw new Error(`refused: labeler attachment "${base}" ${bad.join('; ')} - that hands the labeler the answer`);
  return base;
}

/**
 * Run `codex exec` under FULL answer-key containment. Three independent layers, because the first two were
 * each proven insufficient by live probe on 2026-07-24:
 *
 *   1. ISOLATED CWD - the staging dir is created outside the repo and holds exactly one opaque PNG.
 *      Necessary but NOT sufficient: probed live, Codex 0.142.5's `--sandbox read-only` restricts WRITES
 *      only; the model still ran `ls <repo>/eval/fixtures/default-typeface/` and `head <repo>/eval/corpus/
 *      typeface-a5a-labels.json` from the isolated cwd and reported YES to both. cwd narrows the default
 *      working set; it does not close the channel.
 *   2. OS-LEVEL READ DENY - the whole invocation is wrapped in a seatbelt profile that denies file-read on
 *      the repo subtree. Re-probed after wrapping: LIST_DENIED / READ_DENIED. This is the layer that
 *      actually closes it. Absent a working sandbox-exec we REFUSE rather than label without containment
 *      (override: SIDECOACH_LABEL_UNSANDBOXED=1, which is recorded in the label provenance).
 *   3. TRANSCRIPT AUDIT - Codex echoes every shell command it runs. auditTranscript() fails the page if the
 *      transcript shows the labeler reaching for the corpus, so a future sandbox regression surfaces as a
 *      failed page instead of a quietly contaminated label.
 */
const REPO_ROOT = ROOT;
export const SEATBELT_PROFILE = `(version 1)(allow default)(deny file-read* file-read-metadata (subpath ${JSON.stringify(REPO_ROOT)}))`;
function seatbeltAvailable() {
  try { execSync('command -v sandbox-exec', { stdio: 'ignore' }); return process.platform === 'darwin'; } catch { return false; }
}
/** Fail-loud scan of the labeler's own transcript for any reach toward the answer key. */
export function auditTranscript(out) {
  const hits = [];
  const t = String(out);
  if (t.includes(REPO_ROOT)) hits.push('references the repo root path');
  if (/fixtures\/default-typeface|typeface-a5a-(labels|fixtures|realneg)/i.test(t)) hits.push('references the fixture dir or the labels sink');
  const pol = t.match(/\b[pn]\d{2}-[a-z][a-z-]{3,}/);
  if (pol) hits.push(`echoes a fixture polarity token "${pol[0]}"`);
  if (hits.length) throw new Error(`refused: labeler transcript ${hits.join('; ')} - the label is contaminated, not independent`);
  return true;
}
export function codexLabel(shotPath, prompt, { timeoutMs } = {}) {
  const sandboxed = seatbeltAvailable();
  // NO OVERRIDE. An env escape here would be a supported path to contaminated ground truth, and a label
  // produced by a model that could read the answer key is worse than no label at all (the gate fails closed
  // on a missing label; it cannot detect a contaminated one). Porting off darwin means porting containment.
  if (!sandboxed) {
    throw new Error('refused: no sandbox-exec containment available, so the labeler could read the fixtures and the labels sink. Ground truth is not produced without containment - port the deny-read layer to this platform first.');
  }
  const stage = path.join(os.tmpdir(), `sidecoach-label-${randomBytes(6).toString('hex')}`);
  mkdirSync(stage, { recursive: true });
  const name = path.basename(shotPath);
  try {
    copyFileSync(shotPath, path.join(stage, name));
    const codexArgv = `codex exec --sandbox read-only --skip-git-repo-check -i ${JSON.stringify(name)}`;
    const argv = sandboxed ? `sandbox-exec -p ${JSON.stringify(SEATBELT_PROFILE)} ${codexArgv}` : codexArgv;
    const out = execSync(argv, { cwd: stage, input: prompt, encoding: 'utf8', maxBuffer: 1 << 24, ...(timeoutMs ? { timeout: timeoutMs } : {}) });
    auditTranscript(out);
    return { out, argv, cwd: stage, attachment: name, containment: sandboxed ? 'isolated-cwd+seatbelt-deny-repo-read+transcript-audit' : 'isolated-cwd+transcript-audit (UNSANDBOXED)' };
  } finally { try { rmSync(stage, { recursive: true, force: true }); } catch { /* best effort */ } }
}

/**
 * Deterministic full-page screenshot of the captured (script-stripped) page PLUS the CSSOM typeface facts,
 * both from ONE render. Returns { shot, facts }.
 */
export async function renderAndExtract(html, outPath, { width = 1280, height = 900 } = {}) {
  const { chromium } = await import('playwright');
  mkdirSync(path.dirname(outPath), { recursive: true });
  const b = await chromium.launch({ headless: true, args: ['--force-color-profile=srgb'] });
  try {
    const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => { const u = r.request().url(); return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort(); });
    await page.setContent(stripScripts(html), { waitUntil: 'domcontentloaded', timeout: 60000 });
    const facts = await page.evaluate(inPageTypefaceFacts);   // BEFORE ANIM_OFF so the injected sheet is not walked
    await page.addStyleTag({ content: ANIM_OFF });
    await page.screenshot({ path: outPath, fullPage: true });
    return { shot: outPath, facts };
  } finally { await b.close(); }
}

/** Frozen-90 convenience wrapper: renders candidates/<id>.html to an OPAQUE shot name. */
export async function renderScreenshot(pageId) {
  const html = readFileSync(path.join(CORPUS, 'candidates', `${pageId}.html`), 'utf8');
  return renderAndExtract(html, path.join(SHOTS, opaqueShotName(pageId)), { width: 1280, height: 900 });
}

function visibleTextSample(html) {
  // Head-first strip: without a <body> the old fallback handed the WHOLE document (including <title>,
  // which on a fixture names the brand) to the copy sample. Strip head explicitly before falling back.
  const body = (/(<body[\s\S]*<\/body>)/i.exec(html) || [String(html).replace(/<head\b[\s\S]*?<\/head>/gi, ' ')])[0];
  return body.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
}

// ============================================================================================================
// TYPEFACE EXTRACTION - CSSOM WALK (replaces the regex extractor entirely)
// ============================================================================================================
// Three defects killed the regex version and none of them could be patched in a regex:
//   (1) NESTED AT-RULES: `@media (...) { body { font-family: X } }` brace-matched to
//       `@media (...) { font-family: X }` - the REAL selector `body` was silently dropped.
//   (2) UNVERIFIED "APPLIED": a stylesheet declaration was presented to the labeler as putting a font on
//       text without ever checking the selector matches a DOM node, so an unused `.brand-copy { font-family:
//       Custom }` read as "the page chose a typeface" when it applies to nothing. Same definition-vs-
//       application bug already fixed for @font-face, just never generalized.
//   (3) INLINE STYLES: only `style="..."` (double-quoted) was read, and comments inside the attribute were
//       not stripped.
// All three dissolve once the browser parses the CSS for us. The page is ALREADY open in Playwright for the
// screenshot, so the walk is free.
//
// INTEGRITY: this reports what the page ASKS FOR and whether the ask reaches an element with text. It carries
// NO detector logic - no share threshold, no content-vs-peripheral scoping, no cascade "which declaration
// wins" resolution. Copying any of that here would make the ground truth a mirror of the rule it grades.

/**
 * Runs INSIDE the rendered page (page.evaluate). Returns RAW facts only - selectors verbatim.
 * Sanitization/formatting happens in Node (one implementation, unit-testable, and the raw text never
 * reaches the labeler).
 */
export function inPageTypefaceFacts() {
  const MAX_RULES = 800;
  const TEXTLESS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'TITLE', 'HEAD', 'META', 'LINK']);
  const out = { sheets: { total: 0, unreadable: 0, blockedLinks: 0 }, unreadable: [], rules: [], truncated: false, inline: [], fontFaces: [], vars: {} };
  const allVars = new Map();

  const visible = (el) => {
    try { if (typeof el.checkVisibility === 'function') return el.checkVisibility({ checkVisibilityCSS: true }); } catch { /* fall through */ }
    const cs = getComputedStyle(el);
    return cs.display !== 'none' && cs.visibility !== 'hidden';
  };
  // Returns { text, visibleText }. Text that is display:none / visibility:hidden is real text the rule DOES
  // reach, but it is not text a reader sees - reported separately rather than folded into "applied".
  function textInfo(el) {
    const r = { text: false, visibleText: false };
    if (!el || !el.tagName || TEXTLESS.has(el.tagName)) return r;
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue;
      let p = n.parentElement, bad = false;
      while (p && p !== el.parentElement) { if (TEXTLESS.has(p.tagName)) { bad = true; break; } p = p.parentElement; }
      if (bad) continue;
      r.text = true;
      if (n.parentElement && visible(n.parentElement)) { r.visibleText = true; return r; }
    }
    return r;
  }
  const containsText = (el) => textInfo(el).text;
  /** Split a selector list on TOP-LEVEL commas only - commas inside :is()/:has()/[attr="a,b"] are not separators. */
  function splitTopLevel(sel) {
    const parts = []; let depth = 0, q = null, cur = '';
    for (let i = 0; i < sel.length; i++) {
      const c = sel[i];
      if (q) { cur += c; if (c === '\\') { cur += sel[++i] ?? ''; continue; } if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; cur += c; continue; }
      if (c === '\\') { cur += c + (sel[++i] ?? ''); continue; }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (c === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
      cur += c;
    }
    parts.push(cur);
    return parts;
  }
  // Dynamic-state pseudo-classes and pseudo-elements make querySelectorAll return 0 for a rule that DOES
  // apply (`a:hover`) or throw outright (`p::before`). Strip them for the MATCH TEST only - the selector the
  // labeler sees keeps them.
  const DYNAMIC = /::?(?:-(?:moz|webkit|ms|o)-)?(?:hover|focus-visible|focus-within|focus|active|visited|link|any-link|target(?:-within)?|checked|disabled|enabled|indeterminate|default|placeholder-shown|placeholder|autofill|user-invalid|user-valid|valid|invalid|required|optional|read-only|read-write|in-range|out-of-range|fullscreen|picture-in-picture|defined|popover-open|modal|open|selection|before|after|first-line|first-letter|marker|backdrop|file-selector-button|input-placeholder|scrollbar[a-z-]*|search-[a-z-]*|slider-[a-z-]*|progress-[a-z-]*|meter-[a-z-]*)\b(?:\([^()]*\))?/gi;
  function matchTestSelector(sel) {
    const parts = splitTopLevel(String(sel)).map((p) => p.replace(DYNAMIC, '').trim())
      .map((p) => p.replace(/[>+~]\s*$/, '').trim()).filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  }
  function matchInfo(sel) {
    for (const cand of [String(sel), matchTestSelector(sel)]) {
      if (!cand) continue;
      let els;
      try { els = document.querySelectorAll(cand); } catch { continue; }
      if (!els.length) { if (cand === matchTestSelector(sel)) return { state: 'unmatched', n: 0 }; continue; }
      let anyText = false;
      for (const el of els) {
        const ti = textInfo(el);
        if (ti.visibleText) return { state: 'applied', n: els.length };
        if (ti.text) anyText = true;
      }
      return { state: anyText ? 'matched-hidden-text' : 'matched-no-text', n: els.length };
    }
    return { state: 'unverified', n: null };
  }
  function collectVars(style) {
    for (let i = 0; i < style.length; i++) {
      const nm = style.item(i);
      if (!nm || nm.slice(0, 2) !== '--') continue;
      const v = style.getPropertyValue(nm).trim();
      if (!v) continue;
      if (!allVars.has(nm)) allVars.set(nm, new Set());
      allVars.get(nm).add(v);
    }
  }
  // Conditions are returned STRUCTURED (kind + raw text + whether the query is active in THIS render) so Node
  // can sanitize author-chosen names and the prompt can say when a rule's condition does not currently apply.
  function condOf(rule) {
    const t = rule.constructor && rule.constructor.name;
    if (rule.media && rule.media.mediaText) {
      let active = null;
      try { active = window.matchMedia(rule.media.mediaText).matches; } catch { active = null; }
      return { kind: 'media', text: rule.media.mediaText, active };
    }
    if (t === 'CSSSupportsRule') return { kind: 'supports', text: rule.conditionText || '', active: null };
    if (t === 'CSSLayerBlockRule') return { kind: 'layer', text: '', active: null };   // layer NAME is author-chosen
    if (t === 'CSSContainerRule') return { kind: 'container', text: rule.containerQuery || '', active: null };
    if (t === 'CSSScopeRule') return { kind: 'scope', text: '', active: null };
    return { kind: (t || 'at').replace(/^CSS/, '').replace(/Rule$/, '').toLowerCase(), text: rule.conditionText || '', active: null };
  }
  function record(rule, conds) {
    if (typeof rule.selectorText !== 'string' || !rule.style) return;
    const fam = rule.style.getPropertyValue('font-family');
    if (!fam || !fam.trim()) return;
    const mi = matchInfo(rule.selectorText);
    out.rules.push({ sel: rule.selectorText, family: fam.trim(), conds: conds.slice(), match: mi.state, n: mi.n, pseudoEl: /::/.test(rule.selectorText) });
  }
  function walk(rules, conds) {
    for (const rule of rules) {
      if (out.rules.length >= MAX_RULES) { out.truncated = true; return; }
      const t = rule.constructor && rule.constructor.name;
      if (t === 'CSSKeyframesRule') continue;                        // keyframes carry no selectors
      if (t === 'CSSFontFaceRule') {
        const f = rule.style && rule.style.getPropertyValue('font-family');
        if (f) out.fontFaces.push(f.trim());
        continue;
      }
      if (t === 'CSSImportRule') {                                   // @import: walk the imported sheet or record it lost
        let sub = null;
        try { sub = rule.styleSheet && rule.styleSheet.cssRules; } catch { sub = null; }
        if (sub) walk(Array.from(sub), conds.concat([{ kind: 'import', text: '', active: null }]));
        else { out.sheets.unreadable++; out.unreadable.push({ kind: 'import', href: rule.href || null }); }
        continue;
      }
      if (rule.style) collectVars(rule.style);
      // A CSS-NESTING style rule has BOTH its own declarations and child rules. Recursing without recording
      // first dropped the parent's own font-family (`article { font-family: Brand; & h1 {...} }`).
      record(rule, conds);
      if (rule.cssRules && rule.cssRules.length) walk(Array.from(rule.cssRules), conds.concat([condOf(rule)]));
    }
  }
  // A <link rel=stylesheet> whose sheet never loaded means REAL font-family declarations are invisible to this
  // extraction. Counted so the run can refuse the page rather than describe it as declaring nothing.
  for (const l of Array.from(document.querySelectorAll('link[rel~="stylesheet" i]'))) {
    if (!l.sheet) { out.sheets.blockedLinks++; out.unreadable.push({ kind: 'link', href: l.getAttribute('href') || null }); }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    out.sheets.total++;
    let rules = null;
    try { rules = sheet.cssRules; } catch { out.sheets.unreadable++; out.unreadable.push({ kind: 'sheet', href: sheet.href || null }); continue; }
    if (!rules) { out.sheets.unreadable++; out.unreadable.push({ kind: 'sheet', href: sheet.href || null }); continue; }
    walk(Array.from(rules), []);
  }
  for (const el of Array.from(document.querySelectorAll('[style]'))) {
    const f = el.style && el.style.getPropertyValue('font-family');   // browser-parsed: quoting + comments handled
    if (!f || !f.trim()) continue;
    const ti = textInfo(el);
    out.inline.push({ tag: el.tagName.toLowerCase(), family: f.trim(), hasText: ti.text, hasVisibleText: ti.visibleText });
    if (out.inline.length >= 60) break;
  }
  for (const el of Array.from(document.querySelectorAll('[style]'))) { if (el.style) collectVars(el.style); }
  // Only surface custom properties actually REFERENCED by a font-family (transitively, bounded depth).
  const wanted = new Set();
  const seed = out.rules.map((r) => r.family).concat(out.inline.map((r) => r.family));
  let frontier = seed;
  for (let d = 0; d < 4 && frontier.length; d++) {
    const next = [];
    for (const v of frontier) {
      for (const m of String(v).matchAll(/var\(\s*(--[-\w]+)/g)) {
        if (wanted.has(m[1])) continue;
        wanted.add(m[1]);
        for (const val of (allVars.get(m[1]) || [])) next.push(val);
      }
    }
    frontier = next;
  }
  for (const nm of wanted) out.vars[nm] = Array.from(allVars.get(nm) || []);
  out.fontFaces = Array.from(new Set(out.fontFaces));
  return out;
}

// ---- Node-side sanitization (single implementation; the in-page walk returns raw text only) ---------------
// Author-chosen names carry INTENT (`.brand-font-unused`, `#hero-never-styled`, `[data-expected=present]`)
// and would hand the labeler the verdict. Redact them. PRESERVE the neutral structure the labeler legitimately
// needs: element tag names, ARIA/role attributes, standard structural attributes, combinators, and pseudo
// selectors - those describe WHERE in a document the font lands, which is the actual question.
const HTML_TAGS = new Set(('a abbr address area article aside audio b base bdi bdo blockquote body br button canvas caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em embed fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 head header hgroup hr html i iframe img input ins kbd label legend li link main map mark menu meta meter nav noscript object ol optgroup option output p param picture pre progress q rp rt ruby s samp script search section select slot small source span strong style sub summary sup table tbody td template textarea tfoot th thead time title tr track u ul var video wbr '
  + 'svg circle ellipse g line path polygon polyline rect text tspan defs use symbol marker mask clippath lineargradient radialgradient stop filter foreignobject').split(/\s+/));
// Standard HTML attributes whose NAME and enumerated VALUE are spec-defined, not author-chosen.
const STRUCTURAL_ATTRS = new Set(['type', 'lang', 'dir', 'hidden', 'disabled', 'checked', 'selected', 'readonly', 'required', 'multiple', 'open', 'scope', 'colspan', 'rowspan', 'controls', 'autoplay', 'loop', 'muted', 'rel', 'contenteditable', 'translate', 'draggable', 'inert', 'reversed', 'spellcheck', 'wrap', 'method', 'novalidate']);
// Attributes whose VALUE is a spec-enumerated token, so printing it leaks nothing an author chose. Everything
// else keeps only its NAME: `aria-label="expected present"` is free author text and would hand over the answer,
// while `[aria-current=page]` or `[type=submit]` is vocabulary. (Codex review, High-1.)
const VALUE_SAFE_ATTRS = new Set(['role', 'type', 'dir', 'lang', 'scope', 'method', 'rel', 'contenteditable', 'translate', 'draggable', 'spellcheck', 'wrap',
  'aria-current', 'aria-expanded', 'aria-hidden', 'aria-selected', 'aria-checked', 'aria-disabled', 'aria-pressed', 'aria-level', 'aria-sort', 'aria-live', 'aria-atomic', 'aria-busy', 'aria-haspopup', 'aria-invalid', 'aria-modal', 'aria-multiline', 'aria-orientation', 'aria-readonly', 'aria-required']);
// Functional pseudos whose ARGUMENT is itself a selector -> recurse. Everything else functional gets its
// argument redacted unless it is in STRUCTURAL_ARG_PSEUDOS: `::part(brand-slot)` and `::slotted(.brand)`
// carry author names, and an allowlist that leaves unknown args raw fails open. (Codex review, High-3.)
const SELECTOR_ARG_PSEUDOS = new Set(['not', 'is', 'where', 'has', 'matches', 'any', '-moz-any', '-webkit-any', 'host', 'host-context', 'slotted', 'nth-child', 'nth-last-child']);
const STRUCTURAL_ARG_PSEUDOS = new Set(['lang', 'dir', 'nth-of-type', 'nth-last-of-type', 'nth-col', 'nth-last-col']);

function findClose(s, i, open, close) {
  let depth = 0, q = null;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (q) { if (c === '\\') { j++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '\\') { j++; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return j; }
  }
  return -1;
}
function sanitizeAttr(raw) {
  const m = /^\[\s*((?:\\.|[-\w])+)\s*(?:([~^|$*]?=)\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[^\]\s]*)\s*([iIsS])?\s*)?\]$/.exec(raw);
  if (!m) return '[attr]';
  const name = m[1].replace(/\\/g, '').toLowerCase();
  const structural = name === 'role' || name.startsWith('aria-') || STRUCTURAL_ATTRS.has(name);
  if (!structural) return '[attr]';                                 // data-*, id, class, href, name, custom: redacted whole
  if (!m[2]) return `[${name}]`;                                    // presence-only test: the name IS the structure
  if (VALUE_SAFE_ATTRS.has(name)) return raw;                       // spec-enumerated value: safe verbatim
  return `[${name}]`;                                               // structural name, author-written value dropped
}
/** Redact author-chosen class/id/attribute/custom-element names; keep tags, ARIA, structure, pseudos. */
export function sanitizeSelector(sel) {
  const s = String(sel ?? '');
  let out = '', i = 0;
  const IDENT = '(?:\\\\[\\s\\S]|[^\\s.#\\[\\]:,>+~()*|="\'])+';
  while (i < s.length) {
    const rest = s.slice(i), c = s[i];
    let m;
    if (c === '.' && (m = new RegExp(`^\\.(${IDENT})`).exec(rest))) { out += '.cls'; i += m[0].length; continue; }
    if (c === '#' && (m = new RegExp(`^#(${IDENT})`).exec(rest))) { out += '#id'; i += m[0].length; continue; }
    if (c === '[') {
      const close = findClose(s, i, '[', ']');
      if (close < 0) { out += '[attr]'; break; }
      out += sanitizeAttr(s.slice(i, close + 1)); i = close + 1; continue;
    }
    if (c === ':' && (m = /^(::?)([-a-zA-Z]+)/.exec(rest))) {
      const name = m[2].toLowerCase();
      let j = i + m[0].length;
      if (s[j] === '(') {
        const close = findClose(s, j, '(', ')');
        if (close < 0) { out += m[1] + name; i = j; continue; }
        const arg = s.slice(j + 1, close);
        let sanArg;
        if (SELECTOR_ARG_PSEUDOS.has(name)) {
          const of = /\bof\b/i.exec(arg);
          sanArg = of ? arg.slice(0, of.index + 2) + ' ' + sanitizeSelector(arg.slice(of.index + 2)) : (/^[\s\d+n-]*$/i.test(arg) ? arg : sanitizeSelector(arg));
        } else if (STRUCTURAL_ARG_PSEUDOS.has(name)) sanArg = arg;  // :lang(en), :dir(rtl), :nth-of-type(2n)
        else sanArg = '...';                                        // unknown functional pseudo: fail CLOSED
        out += `${m[1]}${name}(${sanArg})`; i = close + 1; continue;
      }
      out += m[1] + name; i = j; continue;
    }
    if ((m = /^(-?[_a-zA-Z][-\w]*)/.exec(rest))) {
      const t = m[1].toLowerCase();
      out += HTML_TAGS.has(t) ? t : 'elem';                          // custom elements (<brand-hero>) are author-chosen
      i += m[0].length; continue;
    }
    out += c; i++;
  }
  return out.replace(/\s+/g, ' ').trim();
}
/** Alias custom-property NAMES (`--brand-font-unused` leaks) while keeping their declared VALUES verbatim. */
function aliasVars(text, alias) {
  return String(text).replace(/--[-\w]+/g, (nm) => {
    if (!alias.has(nm)) alias.set(nm, `--custom-${alias.size + 1}`);
    return alias.get(nm);
  });
}

/** At-rule condition -> prompt text. Author-named things (layer names, container names, selector() args) out. */
function fmtCond(c, alias) {
  if (!c || typeof c !== 'object') return aliasVars(String(c), alias);
  const active = c.active === false ? ' [NOT active in this render]' : '';
  switch (c.kind) {
    case 'media': return `@media ${aliasVars(c.text, alias)}${active}`;
    case 'supports': return `@supports ${aliasVars(String(c.text).replace(/selector\(([^)]*)\)/gi, (_, s) => `selector(${sanitizeSelector(s)})`), alias)}`;
    case 'layer': return '@layer';                                   // layer name is author-chosen
    case 'container': return `@container ${aliasVars(String(c.text).replace(/^\s*[-\w]+\s+(?=[({])/, ''), alias)}`.trim();
    case 'scope': return '@scope';
    case 'import': return '@import';
    default: return `@${c.kind}${c.text ? ' ' + aliasVars(c.text, alias) : ''}`;
  }
}
/**
 * Refuse to label a page whose CSS could not be fully read. A blocked <link rel=stylesheet> or an unreadable
 * sheet means real font-family declarations are invisible to this extraction, and the page would be shown to
 * the labeler as declaring less than it does - a manufactured positive. A prompt footnote is not enough.
 */
export function assertExtractionComplete(facts) {
  const bad = [];
  const unread = (facts && facts.unreadable) || [];
  const anonymous = unread.filter((u) => !u.href);
  if (facts && facts.truncated) bad.push('rule list hit the extraction cap');
  // An unreadable sheet we cannot even NAME is fatal: there is nothing to tell the labeler about it.
  if (anonymous.length) bad.push(`${anonymous.length} stylesheet(s) unreadable with no identifiable source`);
  // An unreadable sheet on a page that shows NO readable font-family rule at all is also fatal: that is
  // precisely the case where the hidden CSS could be the page's entire typeface ask, and the labeler would be
  // shown an empty picture. (This is a completeness condition on the EXTRACTION, not a rule about fonts.)
  if (unread.length && !(facts.rules || []).length && !(facts.inline || []).length) {
    bad.push('the only font-family declarations may be inside stylesheet(s) that could not be read');
  }
  if (bad.length) throw new Error(`refused: incomplete CSS extraction (${bad.join('; ')}) - the page's real font-family declarations are not fully visible, so any label would be unsound`);
  return true;
}
/**
 * Family names are shown VERBATIM and deliberately so: deciding whether "Arial, Helvetica" or "system-ui"
 * counts as a chosen typeface is the LABELER's judgment, and pre-bucketing families into chosen/system here
 * would copy the detector's own classification into the ground truth. What is guarded instead is a family
 * string that states the VERDICT (a fixture named "Never Applied Sans" would).
 */
// Deliberately NARROW. Broad words ("control", "expected", "negative") appear in legitimate real-world custom
// property names and would fail real pages for no leak; these are phrases that only appear when someone is
// naming the ANSWER. Verified against all 23 A5a pages: zero hits.
const VERDICT_WORDS = /\b(?:never[\s_-]?applied|unapplied|do[\s_-]?not[\s_-]?use|ground[\s_-]?truth|answer[\s_-]?key|default[\s_-]?typeface|polarity)\b|\b(?:font|family|brand|face|typeface)[\s_-]?unused\b|\bunused[\s_-]?(?:font|family|brand|face|typeface)\b/i;
export function assertNoFamilyLeak(facts) {
  const vals = [...(facts.rules || []).map((r) => r.family), ...(facts.inline || []).map((r) => r.family),
    ...(facts.fontFaces || []), ...Object.values(facts.vars || {}).flat()];
  for (const v of vals) { const m = VERDICT_WORDS.exec(String(v)); if (m) throw new Error(`refused: font-family value "${v}" states the verdict ("${m[0]}") - rename the fixture family`); }
  return true;
}

/** Render the extracted facts into the prompt's FONT-FAMILY block. Pure - unit-testable without a browser. */
export function formatTypefaceFacts(facts) {
  if (!facts || !Array.isArray(facts.rules)) throw new Error('formatTypefaceFacts: missing CSSOM facts (extraction did not run)');
  const alias = new Map();
  const CAP = 30;
  const fmt = (r) => {
    const where = r.conds && r.conds.length ? `   [in ${r.conds.map((c) => fmtCond(c, alias)).join(' / ')}]` : '';
    const n = r.match === 'applied' ? `   [selector matches ${r.n} element(s) holding visible text]`
      : r.match === 'matched-hidden-text' ? `   [matches ${r.n} element(s) whose text is hidden (display:none / visibility:hidden)]`
      : r.match === 'matched-no-text' ? `   [matches ${r.n} element(s), none containing text]`
      : r.match === 'unmatched' ? '   [matches 0 elements]' : '   [could not be match-tested]';
    const pe = r.pseudoEl ? '   [pseudo-element rule; match tested on the originating element]' : '';
    return `  ${sanitizeSelector(r.sel)} { font-family: ${aliasVars(r.family, alias)} }${where}${n}${pe}`;
  };
  const bucket = (st) => facts.rules.filter((r) => r.match === st);
  const applied = bucket('applied'), unmatched = bucket('unmatched'), noText = bucket('matched-no-text'), hidden = bucket('matched-hidden-text'), unver = bucket('unverified');
  const sect = (title, rows) => `${title} (${rows.length}${rows.length > CAP ? `, first ${CAP} shown` : ''}):\n`
    + (rows.length ? rows.slice(0, CAP).map(fmt).join('\n') : '  (none)');
  const inline = facts.inline || [];
  const ff = facts.fontFaces || [];
  const varNames = Object.keys(facts.vars || {});
  const varLines = varNames.map((nm) => `  ${aliasVars(nm, alias)} declared as: ${(facts.vars[nm] || []).map((v) => aliasVars(v, alias)).join('  |  ')}`);
  const unread = facts.unreadable || [];
  return `Read from the RENDERED page's CSS object model, then MATCH-TESTED against the live DOM. Author-chosen `
    + `names (classes, ids, data-attributes, custom elements, custom-property names, layer/container names) are `
    + `REDACTED to .cls / #id / [attr] / elem / --custom-N; element tags, ARIA/role and spec-enumerated `
    + `attributes are kept verbatim, as are font-family values.\n`
    + `WHAT THE BUCKETS MEAN: they report whether a rule's SELECTOR reaches an element with text. They do NOT `
    + `resolve the cascade - a rule listed as APPLIED may still be overridden by another rule, and nothing here `
    + `weighs how much of the page's text each rule covers. Judge the page's ASK, not a computed winner.\n\n`
    + sect('APPLIED - the selector matches at least one element holding visible text, so the ask reaches real text', applied)
    + `\n\n` + sect('DECLARED BUT NOT APPLIED - no element on the page matches this rule, so it puts this font on NOTHING', unmatched)
    + `\n\n` + sect('MATCHED BUT TEXTLESS - the rule matches elements, but none of them contain any text', noText)
    + (hidden.length ? `\n\n` + sect('MATCHED BUT TEXT HIDDEN - the rule reaches text that is not visible in this render', hidden) : '')
    + (unver.length ? `\n\n` + sect('MATCH UNVERIFIED - the selector could not be tested against the DOM; do not assume it applies', unver) : '')
    + `\n\nINLINE style attributes (${inline.length}):\n`
    + (inline.length ? inline.slice(0, CAP).map((r) => `  <${HTML_TAGS.has(r.tag) ? r.tag : 'elem'} style> { font-family: ${aliasVars(r.family, alias)} }   [${r.hasVisibleText ? 'element holds visible text' : r.hasText ? 'element text is hidden' : 'element contains no text'}]`).join('\n') : '  (none)')
    + `\n\nDEFINED via @font-face (${ff.length}) - bundles a font FILE only; applies to NO text unless a rule above names it:\n`
    + (ff.length ? `  ${ff.slice(0, 15).join(', ')}` : '  (none)')
    + (varLines.length ? `\n\nCUSTOM PROPERTIES referenced by the font-family values above (names redacted, declared values verbatim):\n${varLines.slice(0, 20).join('\n')}` : '')
    // Surfaced as a first-class section, not a footnote: the page ASKS for these stylesheets, this render
    // could not load them, and whatever font-family they declare is absent from every list above.
    + (unread.length ? `\n\nSTYLESHEETS THE PAGE ASKS FOR BUT THIS RENDER COULD NOT LOAD (${unread.length}) - their font-family declarations are NOT represented anywhere above, so treat the lists above as incomplete by exactly these sources:\n`
      + unread.slice(0, 10).map((u) => `  [${u.kind}] ${u.href || '(source unknown)'}`).join('\n') : '');
}
function motionDeclarations(html) {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const lines = [...css.matchAll(/[^{};]*(transition|animation|@keyframes|cubic-bezier|bounce|elastic)[^{};]*[;{]/gi)].map((m) => m[0].trim());
  return [...new Set(lines)].slice(0, 40).join('\n').slice(0, 1500) || '(no explicit motion declarations found)';
}

export function buildPrompt(pageId, html, typefaceFacts) {
  const { classes } = rubricInfo();
  // pageId is accepted for call-site symmetry ONLY and must never reach the prompt text - the id encodes the
  // scenario and its polarity. Guarded, not merely intended.
  const typefaceBlock = formatTypefaceFacts(typefaceFacts);
  const line = (c) => `- ${c.class} [${VISUAL.has(c.class) ? 'SCREENSHOT' : TEXTUAL.has(c.class) ? 'TEXT' : TYPEFACE.has(c.class) ? 'TYPEFACE' : 'MOTION'}]: ${c.desc}`;
  return `You are an INDEPENDENT design labeler with no stake in any tool. Judge whether each design idiom is `
    + `PRESENT or ABSENT on THIS page, using ONLY the neutral descriptions below and the signal noted per class:\n`
    + `- [SCREENSHOT] classes: judge from the ATTACHED rendered screenshot (what the page LOOKS like). Do not parse CSS.\n`
    + `- [TEXT] classes: judge from the page COPY below.\n`
    + `- [MOTION] classes: judge from the MOTION declarations below (a static image can't show motion).\n`
    + `- [TYPEFACE] classes: judge from the FONT-FAMILY declarations below - what the page ASKS FOR. Do NOT use `
    + `the screenshot for these: the render blocks webfonts, so a page that deliberately names a custom family `
    + `still paints as a plain system face. Naming a chosen family counts as chosen even if it paints plain.\n`
    + `Do not infer which tool or author made the page. Output ONLY JSON keyed by class name, each value `
    + `{"present":true|false,"confidence":0..1,"note":"<=12 words"}. Include all ${classes.length} classes.\n\n`
    + `CLASSES:\n${classes.map(line).join('\n')}\n\nPAGE COPY (for TEXT classes):\n${visibleTextSample(html)}\n\n`
    + `MOTION DECLARATIONS (for MOTION classes):\n${motionDeclarations(html)}\n\n`
    + `FONT-FAMILY DECLARATIONS (for TYPEFACE classes):\n${typefaceBlock}`;
}

/**
 * Fail-loud: the built prompt must not carry the page's SLUG or a fixture polarity token.
 * Deliberately NOT a bare substring test on single-word ids: a real capture's id IS its brand name
 * ("linear", "ghost", "framer") and that word appears legitimately in the page's own copy - blocking it
 * would block labeling without removing any leak. A hyphenated slug or a polarity token (p0.. / n0..) is a
 * different thing: no shipped page's copy contains "p04-webfont-declared-never-applied".
 */
export function assertPromptClean(pageId, prompt) {
  const p = String(prompt).toLowerCase(), id = String(pageId).toLowerCase();
  const hits = [];
  if (/[-_]/.test(id) && p.includes(id)) hits.push(`page slug "${pageId}"`);
  const pol = p.match(/\b[pn]\d{2}-[a-z][a-z-]{3,}/);
  if (pol) hits.push(`fixture polarity token "${pol[0]}"`);
  if (hits.length) throw new Error(`refused: prompt leaks ${hits.join(', ')} to the labeler`);
  return true;
}

export function parseVerdict(output) {
  const m = output.match(/\{[\s\S]*\}/g);
  if (!m) throw new Error('no JSON object in Codex output');
  return JSON.parse(m[m.length - 1]);
}

export function recordLabels(pageId, verdict, { sha, model = 'codex', shot, containment = null }) {
  const man = JSON.parse(readFileSync(CANDIDATES, 'utf8'));
  const c = man.find((x) => x.id === pageId);
  if (!c) throw new Error(`no page ${pageId}`);
  const labels = Object.entries(verdict).map(([cls, v]) => ({
    class: cls, present: !!v.present, confidence: v.confidence ?? null, note: v.note ?? null,
    labeledBy: 'codex', signal: signalOfClass(cls),
    method: LABEL_METHOD, containment, rubricSha: sha, model, screenshot: shot ? path.basename(shot) : null, labeledUtc: new Date().toISOString(),
  }));
  if (labels.some((l) => l.labeledBy !== 'codex')) throw new Error('refused: harness records labeledBy=codex only');
  c.subjectiveLabels = labels;
  c.subjectiveStatus = 'labeled-codex';
  writeFileSync(CANDIDATES, JSON.stringify(man, null, 2) + '\n');
  return labels.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry-run');
  const all = args.includes('--all');
  const resume = args.includes('--resume'); // skip pages already labeled-codex (don't re-pay)
  const pi = args.indexOf('--page');
  const { sha, classes } = rubricInfo();
  const man = JSON.parse(readFileSync(CANDIDATES, 'utf8'));
  const byId = new Map(man.map((c) => [c.id, c]));
  const ids = all ? man.map((c) => c.id) : pi >= 0 ? [args[pi + 1]] : [];
  if (!ids.length) { console.error('usage: subjective-label-harness.mjs (--page <id> | --all) [--resume] [--dry-run]'); process.exit(2); }
  console.error(`rubric SHA ${sha.slice(0, 12)} | ${classes.length} classes (${signalCounts()}) | ${ids.length} page(s) | ${dry ? 'DRY-RUN' : 'LIVE (Codex vision)'}${resume ? ' | --resume' : ''}`);
  let labeled = 0, skipped = 0; const failed = [];
  for (const id of ids) {
    const rec = byId.get(id);
    if (resume && rec && rec.subjectiveStatus === 'labeled-codex') { skipped++; console.error(`  skip ${id} (already labeled-codex)`); continue; }
    try {
      const html = readFileSync(path.join(CORPUS, 'candidates', `${id}.html`), 'utf8');
      const { shot, facts } = await renderScreenshot(id);
      const attachment = assertNoLeak(id, shot);                       // opaque name or refuse
      assertExtractionComplete(facts);                                 // every stylesheet read, or refuse
      assertNoFamilyLeak(facts);                                       // no family name states the verdict
      const prompt = buildPrompt(id, html, facts);
      assertPromptClean(id, prompt);
      if (dry) { console.log(`\n=== ${id} ===\nscreenshot: ${shot}\ninvocation: echo <prompt ${prompt.length} chars> | codex exec --sandbox read-only --skip-git-repo-check -i ${attachment}  (cwd: isolated staging dir)\nprompt head: ${prompt.slice(0, 200)}...`); continue; }
      // LEAD runs this branch: prompt via stdin, opaque screenshot via -i, cwd = isolated staging dir.
      const { out, containment } = codexLabel(shot, prompt);
      const n = recordLabels(id, validateVerdict(parseVerdict(out), classes), { sha, shot, containment });
      labeled++; console.error(`  labeled ${id}: ${n} classes (codex vision)`);
    } catch (e) {
      // CONTINUE-ON-ERROR: a transient codex/render failure on one page must not abort the run.
      failed.push(id); console.error(`  FAILED ${id}: ${e instanceof Error ? e.message.slice(0, 140) : e}`);
    }
  }
  if (!dry) {
    console.error(`\nSUMMARY: labeled ${labeled} | skipped(resume) ${skipped} | failed ${failed.length}${failed.length ? ` [${failed.join(', ')}]` : ''}`);
    // EXIT CONTRACT: 5 = incomplete label set (some page failed); 0 = every targeted page labeled.
    if (failed.length) {
      console.error(`FAIL (exit 5): ${failed.length} page(s) unlabeled - re-run \`--all --resume\` to retry without re-paying completed pages.`);
      process.exit(5);
    }
    console.error('all targeted pages labeled.');
  }
}
