// sidecoach/src/validators/checks/rendered-checks.ts
//
// Rendered-scan-backed checks (Stage 1 convergence). Each reads the ONE live rendered scan threaded onto the
// context (ctx.renderedScan), resolved once in run-validator from scanRenderedLive - the SAME in-page detector
// logic that the eval harness runs (objective-rendered-scanner / subjective-rendered-scanner), now driving the
// live natural-language workflow.
//
// FAIL-CLOSED: a check whose family scan is UNAVAILABLE returns inconclusive (never a false pass). With the
// renderUrl-presence promotion in run-validator, an unavailable scan on a target that HAS a renderUrl becomes
// required+inconclusive and blocks clean. A target with NO renderUrl leaves these rules dormant (non-required).
//
// A finding present -> fail (selectors -> evidenceLocations). No finding on an AVAILABLE scan -> pass (the scan
// ran and saw nothing). The check never launches a browser - the scan is pre-resolved.
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive } from '../check-context';
import type { ObjectiveScan, ObjectiveRule } from '../objective-rendered-scanner';
import type { SubjectiveScan } from '../subjective-rendered-scanner';

const selectorsOf = (findings: { selector?: string }[]): string[] =>
  findings.map((f) => f.selector).filter((s): s is string => !!s);

// Shared objective-family helper: gate on availability, then pass/fail on the presence of the rule's class.
function objectiveVerdict(
  scan: ObjectiveScan | undefined,
  rule: ObjectiveRule,
  cleanMsg: string,
  failMsg: (n: number) => string,
  remediation: string,
): RuleVerdict {
  if (!scan || !scan.available) return inconclusive(`${rule} needs a live rendered scan of the page`, 'unsupported_runtime');
  const hits = scan.findings.filter((f) => f.rule === rule);
  return hits.length === 0 ? pass(cleanMsg) : fail(failMsg(hits.length), selectorsOf(hits), remediation);
}

export const checkBrokenImage = (ctx: ProductCheckContext): RuleVerdict =>
  objectiveVerdict(ctx.renderedScan?.objective, 'broken-image',
    'no broken images in the rendered page',
    (n) => `${n} image(s) render broken (no usable source)`,
    'Provide a valid src (and alt), or remove the broken <img>');

export const checkSkippedHeading = (ctx: ProductCheckContext): RuleVerdict =>
  objectiveVerdict(ctx.renderedScan?.objective, 'skipped-heading',
    'heading outline does not skip a level',
    (n) => `${n} heading-level skip(s) in the outline (WCAG 1.3.1)`,
    'Do not skip heading levels (e.g. h1 then h3); use sequential headings and style with CSS');

export const checkGrayOnColor = (ctx: ProductCheckContext): RuleVerdict =>
  objectiveVerdict(ctx.renderedScan?.objective, 'gray-on-color',
    'no desaturated text failing contrast on a chromatic background',
    (n) => `${n} run(s) of gray text on a colored background fail AA contrast (WCAG 1.4.3)`,
    'Increase the text contrast (darken/lighten or saturate) against its colored background to meet WCAG AA');

export const checkJustifiedText = (ctx: ProductCheckContext): RuleVerdict =>
  objectiveVerdict(ctx.renderedScan?.objective, 'justified-text',
    'no justified body text',
    (n) => `${n} justified text block(s) (uneven spacing / rivers; WCAG 1.4.8)`,
    'Use text-align: start instead of justify for body copy');

// a11y.color-contrast (Stage 6 convergence): MIGRATED here from the collector contrast probe onto the rendered
// scanner's `low-contrast` finding - the SAME detector the eval harness scores. This closes the eval-only hole the
// one-engine audit found: low-contrast now drives the live a11y.color-contrast rule, so the natural-language
// workflow surfaces it. The old collector contrast probe is orphaned (no live rule reads ctx.contrast).
//
// LIVE DE-DUP (Codex P1): the scanner emits 'low-contrast' AND 'gray-on-color' for the SAME element when the text
// is gray on a chromatic background (gray-on-color is a more specific PRODUCT SUBTYPE of low-contrast, same
// selector - objective-rendered-scanner.ts:277-282). a11y.gray-on-color already consumes its finding live, so
// firing a11y.color-contrast on the same element too would DOUBLE-count/double-block one defect. We therefore
// suppress low-contrast hits whose selector is ALSO reported as gray-on-color in the same scan (the subtype wins);
// a11y.color-contrast fires only on PURE low-contrast not covered by gray-on-color. This is LIVE-PATH-ONLY: the
// scanner's emission is untouched (eval-frozen), so eval numbers are unchanged (detection-preserving).
export const checkLowContrast = (ctx: ProductCheckContext): RuleVerdict => {
  const scan = ctx.renderedScan?.objective;
  if (!scan || !scan.available) return inconclusive('color-contrast needs a live rendered scan of the page', 'unsupported_runtime');
  const grayOnColorSelectors = new Set(
    scan.findings.filter((f) => f.rule === 'gray-on-color').map((f) => f.selector).filter((s): s is string => !!s),
  );
  // Keep a low-contrast hit unless its selector is also a gray-on-color hit (the more specific subtype). A
  // selector-less low-contrast hit cannot be de-duped, so it is kept (never silently drop a real defect).
  const hits = scan.findings.filter((f) => f.rule === 'low-contrast' && !(f.selector && grayOnColorSelectors.has(f.selector)));
  return hits.length === 0
    ? pass('all measured text meets WCAG AA contrast against its background')
    : fail(`${hits.length} text run(s) fail WCAG AA contrast against their background (WCAG 1.4.3)`, selectorsOf(hits),
        'Increase foreground/background contrast to meet WCAG AA (4.5:1 body, 3:1 large text)');
};

export const checkTinyText = (ctx: ProductCheckContext): RuleVerdict => {
  const scan: SubjectiveScan | undefined = ctx.renderedScan?.subjective;
  if (!scan || !scan.available) return inconclusive('tiny-text needs a live rendered scan of the page', 'unsupported_runtime');
  const hits = scan.findings.filter((f) => f.rule === 'tiny-text');
  return hits.length === 0
    ? pass('content text is rendered at a comfortable readable size')
    : fail(`a substantial share of content text is rendered very small (strains readability)`, selectorsOf(hits),
        'Raise small body/interface text toward the 16px comfortable-reading baseline');
};

export const checkMarketingBuzzword = (ctx: ProductCheckContext): RuleVerdict => {
  const scan: SubjectiveScan | undefined = ctx.renderedScan?.subjective;
  if (!scan || !scan.available) return inconclusive('marketing-buzzword needs a live rendered scan of the page', 'unsupported_runtime');
  const hits = scan.findings.filter((f) => f.rule === 'marketing-buzzword');
  return hits.length === 0
    ? pass('copy reads concretely (low marketing-buzzword density)')
    : fail(`the copy leans on generic marketing buzzwords (high buzzword density) rather than concrete specifics`, selectorsOf(hits),
        'Replace generic buzzwords (seamless, powerful, revolutionary, ...) with concrete, specific claims');
};

export const RENDERED_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'a11y/broken-image': checkBrokenImage,
  'a11y/heading-order': checkSkippedHeading,
  'a11y/gray-on-color': checkGrayOnColor,
  'a11y/justified-text': checkJustifiedText,
  'a11y/color-contrast': checkLowContrast,
  'polish/tiny-text': checkTinyText,
  'polish/marketing-buzzword': checkMarketingBuzzword,
};
