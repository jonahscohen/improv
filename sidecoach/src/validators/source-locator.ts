// sidecoach/src/validators/source-locator.ts
//
// WHERE a finding lives. One place computes `path:line` for every static check, so a
// location is either right or absent - never approximately right.
//
// THE BUG THIS FILE EXISTS TO FIX (measured 2026-07-29 on benchmark/fixtures/canary/canary.html):
// the two findings that DID carry a line both carried the WRONG one. The real gradient-text
// defect is on file line 6. `ban.gradient-text` reported line 5 and `anti-pattern.gradient-text`
// reported line 3. Two independent causes:
//
//   1. OFF BY ONE FROM THE SELECTOR CAPTURE. The ban scanners match a whole rule with
//      /([^{}]+)\{([^}]*)\}/ and report the line of `match.index`. `[^{}]+` also eats the
//      newline after the PREVIOUS rule's `}`, so match.index sits on the previous rule's
//      closing-brace line. Fixed at the source: the scanners now report the line of the
//      TRIGGERING DECLARATION inside the body, which is the line a reader needs anyway.
//
//   2. LINE NUMBERS FROM A SLICE, LABELLED AS FILE LINES. project-collector's
//      extractInlineCss concatenates `<style>` bodies into CollectedFile.cssText and throws
//      the file positions away. Any rule scanning ctx.cssText and printing `${file}:${line}`
//      is reporting a line in an anonymous slice under a real filename - the most expensive
//      kind of wrong, because it looks authoritative. cssRegionsOf re-derives the `<style>`
//      bodies FROM THE MARKUP with the file line each one starts on, so a slice line maps
//      back. It does not touch the evidence pipeline: cssText is unchanged, so no verdict
//      can move.
//
// DEFECT LINES VS ANCHOR LINES. A presence finding ("transition: all found") has a defect
// line: the declaration itself. An absence finding ("no prefers-reduced-motion") has none -
// the defect is that nothing is there. Its location is the ANCHOR: the site the rule's own
// applicability probe matched, which is exactly where the missing rule has to be written.
// The two are tagged distinctly (`locationKind`) and rendered differently, because silently
// presenting an anchor as a defect site would be the same class of lie as case 2 above.
import type { CollectedFile, ProductCheckContext } from './check-context';
import {
  INTERACTIVE_RE, ICON_RE, IMAGE_RE, HEADING_RE, MOTION_RE, ROOT_TARGET_RE,
  SHADOW_TARGET_RE, OPTICAL_TARGET_RE, FOCUSABLE_RE, TABULAR_TARGET_RE,
  TRANSITION_TARGET_RE, FRAMER_TARGET_RE, WILL_CHANGE_TARGET_RE,
} from './check-context';

/** A contiguous run of source text, and the FILE line its first character sits on. */
export interface SourceRegion {
  path: string;
  text: string;
  /** 1-based file line of text[0]. */
  startLine: number;
}

export type LocationScope = 'css' | 'markup' | 'both';

const CSS_SOURCE_KINDS = new Set(['css', 'scss', 'sass', 'less']);

/** 1-based line of a character offset. Counts newlines only - no allocation per line. */
export function lineOfOffset(text: string, offset: number): number {
  if (offset <= 0) return 1;
  const stop = Math.min(offset, text.length);
  let line = 1;
  for (let i = 0; i < stop; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/** Map an offset inside a region back to its file line. */
export function fileLineOf(region: SourceRegion, offsetInRegion: number): number {
  return region.startLine + lineOfOffset(region.text, offsetInRegion) - 1;
}

/**
 * The CSS regions of one collected file, each carrying the file line it starts on.
 *
 * A css-family file is one region starting at line 1. A markup file's regions are its
 * `<style>` bodies, re-derived from `markup` (NOT from `cssText`, which has already lost
 * the positions). A markup file with no `<style>` block has no CSS regions, which is the
 * honest answer: there is no CSS in this file to point at.
 */
export function cssRegionsOf(file: CollectedFile): SourceRegion[] {
  if (CSS_SOURCE_KINDS.has(file.sourceKind)) {
    return file.cssText ? [{ path: file.path, text: file.cssText, startLine: 1 }] : [];
  }
  const out: SourceRegion[] = [];
  const html = file.markup || '';
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    if (m.index === undefined) continue;
    const bodyOffset = m.index + m[0].indexOf('>') + 1;   // first char after the opening tag
    out.push({ path: file.path, text: m[1], startLine: lineOfOffset(html, bodyOffset) });
  }
  return out;
}

/** The markup region of one collected file (the whole file), or none for a pure CSS file. */
export function markupRegionOf(file: CollectedFile): SourceRegion | undefined {
  if (!file.markup) return undefined;
  return { path: file.path, text: file.markup, startLine: 1 };
}

function regionsFor(ctx: ProductCheckContext, scope: LocationScope): SourceRegion[] {
  const files = Array.isArray(ctx.files) ? ctx.files : [];
  const out: SourceRegion[] = [];
  for (const f of files) {
    if (scope === 'css' || scope === 'both') out.push(...cssRegionsOf(f));
    if (scope === 'markup' || scope === 'both') {
      const m = markupRegionOf(f);
      if (m) out.push(m);
    }
  }
  return out;
}

/**
 * Every `path:line` where `re` matches, across the requested scope, capped at `limit`.
 *
 * Returns [] when nothing matched - and [] is what a check must then report, because an
 * invented location is worse than none. The caller never fabricates a fallback.
 */
export function locate(ctx: ProductCheckContext, re: RegExp, scope: LocationScope = 'both', limit = 5): string[] {
  const seen = new Set<string>();
  // A caller's regex is reused across regions, so it must not carry lastIndex state.
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  for (const region of regionsFor(ctx, scope)) {
    const rx = new RegExp(re.source, flags);
    for (const m of region.text.matchAll(rx)) {
      if (m.index === undefined) continue;
      seen.add(`${region.path}:${fileLineOf(region, m.index)}`);
      if (seen.size >= limit) return [...seen];
    }
  }
  return [...seen];
}

/** First location only - the common case for a single-anchor finding. */
export function locateFirst(ctx: ProductCheckContext, re: RegExp, scope: LocationScope = 'both'): string[] {
  return locate(ctx, re, scope, 1);
}

/**
 * Locations of the matches of `re` that ALSO satisfy `keep`, indexed by match order.
 *
 * For rules that fail on a SUBSET of matches - "3 of 5 images lack width+height" - so the
 * reported lines are the three offending tags and not all five. `index` is the running
 * position across the whole scope, matching the order the check itself counts in, so an
 * order-sensitive predicate (the first image is the exempt hero) stays consistent with the
 * verdict it decorates.
 */
export function locateWhere(
  ctx: ProductCheckContext,
  re: RegExp,
  keep: (matchText: string, index: number) => boolean,
  scope: LocationScope = 'both',
  limit = 5,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  let index = 0;
  for (const region of regionsFor(ctx, scope)) {
    const rx = new RegExp(re.source, flags);
    for (const m of region.text.matchAll(rx)) {
      if (m.index === undefined) continue;
      const i = index++;
      if (!keep(m[0], i)) continue;
      const loc = `${region.path}:${fileLineOf(region, m.index)}`;
      if (seen.has(loc)) continue;
      seen.add(loc);
      out.push(loc);
      if (out.length >= limit) return out;
    }
  }
  return out;
}

/**
 * The anchor target per rule: the SAME regex that rule's applicability probe tested, in
 * probe order for the composite ones. Keyed by canonicalRuleKey so it lines up 1:1 with
 * check-context's PROBES table; `source-locator.test.ts` asserts the two key sets are
 * identical, so adding a probe without an anchor (or the reverse) fails the suite rather
 * than silently shipping a rule that can never report where to fix it.
 */
export const RULE_ANCHOR_TARGETS: Record<string, { re: RegExp; scope: LocationScope }[]> = {
  'polish/scale-on-press': [{ re: INTERACTIVE_RE, scope: 'both' }],
  'polish/state-completeness': [{ re: INTERACTIVE_RE, scope: 'both' }],
  'polish/icon-swap-compound': [{ re: ICON_RE, scope: 'both' }, { re: INTERACTIVE_RE, scope: 'both' }],
  'polish/image-outline-neutral': [{ re: IMAGE_RE, scope: 'both' }],
  'polish/no-transition-all': [{ re: TRANSITION_TARGET_RE, scope: 'css' }],
  'polish/tabular-nums': [{ re: TABULAR_TARGET_RE, scope: 'css' }],
  'polish/text-wrap-balance': [{ re: HEADING_RE, scope: 'both' }],
  'polish/staggered-enter': [{ re: MOTION_RE, scope: 'both' }],
  'polish/subtle-exit': [{ re: MOTION_RE, scope: 'both' }],
  'polish/reduced-motion-respect': [{ re: MOTION_RE, scope: 'both' }],
  'polish/font-smoothing': [{ re: ROOT_TARGET_RE, scope: 'css' }],
  'polish/animatepresence-initial': [{ re: FRAMER_TARGET_RE, scope: 'markup' }],
  'polish/sparse-will-change': [{ re: WILL_CHANGE_TARGET_RE, scope: 'css' }],
  'polish/shadows-over-borders': [{ re: SHADOW_TARGET_RE, scope: 'css' }],
  'polish/shadow-hierarchy': [{ re: SHADOW_TARGET_RE, scope: 'css' }],
  'polish/optical-alignment': [{ re: OPTICAL_TARGET_RE, scope: 'css' }],
};

/** The focusable anchor is used by a11y/focus-visible, which has no PROBES entry. */
export const FOCUSABLE_ANCHOR: { re: RegExp; scope: LocationScope }[] = [{ re: FOCUSABLE_RE, scope: 'both' }];

/** Resolve an anchor location list by trying each target in probe order. */
export function locateAnchor(ctx: ProductCheckContext, targets: { re: RegExp; scope: LocationScope }[]): string[] {
  for (const t of targets) {
    const hit = locateFirst(ctx, t.re, t.scope);
    if (hit.length) return hit;
  }
  return [];
}

/** Anchor location for a rule identified by canonicalRuleKey. [] when it has no anchor. */
export function locateRuleAnchor(ctx: ProductCheckContext, canonicalRuleKey: string): string[] {
  const targets = RULE_ANCHOR_TARGETS[canonicalRuleKey];
  return targets ? locateAnchor(ctx, targets) : [];
}
