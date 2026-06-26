#!/usr/bin/env node
/**
 * Contract-6 OBJECTIVE-LABEL spec-faithful labeler (Stage 0).
 *
 * Produces the OBJECTIVE defect ground truth that BOTH our owned scanner AND oracle
 * (the oracle) are graded against (Contract 6 A1-A4). It is the neutral referee, so it
 * must be SPEC-FAITHFUL and INDEPENDENT of both detectors: every rule is grounded in a
 * public spec (WCAG SC / HTML / CSS) and computable such that two independent
 * spec-faithful implementations would agree WITHOUT any taste judgment (the lead's
 * objective-test). If deciding "is this defective HERE" needs aesthetic judgment, the
 * class is SUBJECTIVE -> the held lead-run Codex pass, NOT this labeler.
 *
 * BOUNDARY (lead ruling 2026-06-23, adopted spec-crispness test): a class is OBJECTIVE
 * only if its threshold is a SPEC CONSTANT two faithful implementations must agree on
 * (e.g. WCAG 4.5:1 contrast, "text-align: justify" present y/n, heading-level jump y/n),
 * NOT a taste-calibrated number (1.3 leading, "extreme" tracking). By that test:
 *  - OBJECTIVE-STATIC (here, now): broken-image (HTML: img needs a valid resource),
 *    justified-text on body (WCAG 1.4.8 AAA "Text is not justified" - binary), skipped-heading
 *    (WCAG 1.3.1 heading-level jump - binary). All taste-free + spec-grounded + decidable.
 *  - OBJECTIVE-RENDERED (pending the rendered labeler): low-contrast / gray-on-color only
 *    (WCAG 1.4.3 spec-constant ratios 4.5:1 / 3:1). No typographic-threshold classes here -
 *    a leading/tracking cutoff (even "overlap") is a chosen number, not a spec constant.
 *  - SUBJECTIVE (held Codex pass, A5): tiny-text, wide-tracking, all-caps-body,
 *    layout-transition, bounce-easing, tight-leading, extreme-negative-tracking - all have
 *    taste-calibrated thresholds, no spec constant; "is it a defect here" needs taste. The
 *    architect is registered for these in rule-authors.json so the freeze gate rejects the
 *    architect labeling them. How they are graded comparatively vs oracle: eval/README.md
 *    Contract-6 grading spec (A5a taste-detection vs Codex labels + A5b generative head-to-head).
 *
 * CONTEXT (Codex item-8 fixes): selectors are parsed to their KEY (subject) compound -
 * the rightmost compound after the last top-level combinator - and predicates apply to
 * THAT, so ancestor context cannot drive the decision (`.hero p` is a paragraph, not a
 * heading; `.nav li` is judged on the li). CSS comments are stripped, @keyframes blocks
 * removed (their 0%/100% stops are not element selectors), selector lists split
 * depth-aware (commas inside :is()/:not()/[attr] are not separators), and inline style=""
 * is attributed to its actual element TAG (single + double quoted).
 */

const OBJECTIVE_STATIC = ['broken-image', 'justified-text', 'skipped-heading'];
// Objective, computed by the RENDERED pass - SPEC-CONSTANT ratios only (WCAG 1.4.3):
const OBJECTIVE_RENDERED = ['low-contrast', 'gray-on-color'];
// Moved OBJECTIVE -> SUBJECTIVE by the lead boundary ruling (taste-calibrated thresholds, no spec
// constant). All registered to the architect in rule-authors.json so the freeze gate rejects them:
const SUBJECTIVE_MOVED = ['tiny-text', 'wide-tracking', 'all-caps-body', 'layout-transition', 'bounce-easing', 'tight-leading', 'extreme-negative-tracking'];

// ---- robust CSS rule extraction ----
function stripComments(css) { return css.replace(/\/\*[\s\S]*?\*\//g, ''); }
function removeKeyframes(css) {
  // @keyframes name { 0%{...} 100%{...} } - drop the whole block (stops are not selectors).
  return css.replace(/@(?:-[a-z]+-)?keyframes\b[^{]*\{(?:[^{}]*\{[^{}]*\}\s*)*[^{}]*\}/gi, '');
}
/** Split a selector list on TOP-LEVEL commas only (ignore commas inside () and []). */
function splitSelectorList(sel) {
  const out = []; let depth = 0, cur = '';
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}
/** Key (subject) selector: the rightmost compound after the last TOP-LEVEL combinator. */
function keySelector(sel) {
  let depth = 0, start = 0;
  for (let i = 0; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth = Math.max(0, depth - 1);
    else if (depth === 0 && (ch === ' ' || ch === '>' || ch === '+' || ch === '~' || ch === '\t' || ch === '\n')) start = i + 1;
  }
  return sel.slice(start).trim();
}
/** Leading element tag of a compound (lowercased), or '' if none (class/id/star-only). */
function keyTag(key) {
  const m = /^([a-zA-Z][\w-]*)/.exec(key);
  return m ? m[1].toLowerCase() : '';
}
function ruleBlocks(html) {
  const blocks = [];
  let styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  styles = removeKeyframes(stripComments(styles));
  // leaf rules only: decls contain no nested '{' (so @media/@supports preludes are skipped,
  // their inner leaf rules still match with the inner selector as the subject).
  for (const m of styles.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const decls = m[2];
    for (const sel of splitSelectorList(m[1])) blocks.push({ selector: sel, decls });
  }
  // inline style="" / style='' attributed to the actual element tag (the selector context).
  for (const m of html.matchAll(/<([a-zA-Z][\w-]*)\b[^>]*?\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    blocks.push({ selector: m[1].toLowerCase(), decls: m[2] ?? m[3] ?? '' });
  }
  return blocks;
}

// ---- element-context predicates (applied to the KEY selector) ----
// Text-container context for justify (WCAG 1.4.8 targets blocks of text).
const TEXT_TAGS = new Set(['p', 'li', 'blockquote', 'dd', 'dt', 'figcaption', 'address', 'body', 'html', 'article', 'main', 'section']);
function isTextContainerKey(key) {
  if (TEXT_TAGS.has(keyTag(key))) return true;
  return /\b(prose|content|copy|description|body-?text|paragraph|article|rich-?text|markdown|lead|intro|text)\b/i.test(key);
}

export function objectiveLabelsStatic(html) {
  const labels = new Set();

  // broken-image (HTML): <img> must reference a valid resource - empty/missing src or a
  // placeholder token is functionally broken (no taste judgment).
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const src = /\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[1]);
    const val = src ? (src[2] ?? src[3] ?? '') : null;
    if (val === null || val.trim() === '' || /\b(placeholder|todo|xxx)\b/i.test(val)) labels.add('broken-image');
  }

  // skipped-heading (WCAG 1.3.1 Info and Relationships): heading levels convey document
  // structure; a level jump (h1 -> h3, no intervening h2) breaks the programmatic outline.
  if (skippedHeading(html)) labels.add('skipped-heading');

  // justified-text (WCAG 1.4.8 AAA Visual Presentation: "Text is not justified"): justify
  // on a block of body text. Judged on the KEY selector (the element the rule targets).
  for (const { selector, decls } of ruleBlocks(html)) {
    if (/text-align\s*:\s*justify\b/i.test(decls) && isTextContainerKey(keySelector(selector))) labels.add('justified-text');
  }

  return [...labels].sort();
}

function skippedHeading(html) {
  const tags = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => parseInt(m[1], 10));
  for (let i = 1; i < tags.length; i++) { if (tags[i] - tags[i - 1] >= 2) return true; }
  return false;
}

/** Full objective label set for a page: static now; rendered-objective classes flagged pending. */
export function objectiveLabels(html) {
  return { static: objectiveLabelsStatic(html), renderedPending: OBJECTIVE_RENDERED, movedToSubjective: SUBJECTIVE_MOVED };
}

export { OBJECTIVE_STATIC, OBJECTIVE_RENDERED, SUBJECTIVE_MOVED, ruleBlocks, keySelector, keyTag, splitSelectorList, isTextContainerKey };

if (import.meta.url === `file://${process.argv[1]}`) {
  const fs = await import('node:fs');
  const file = process.argv[2];
  if (!file) { console.error('usage: objective-label.mjs <html-file>'); process.exit(2); }
  const r = objectiveLabels(fs.readFileSync(file, 'utf8'));
  console.log(JSON.stringify(r, null, 2));
}
