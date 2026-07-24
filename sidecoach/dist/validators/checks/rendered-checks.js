"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RENDERED_CHECKS = exports.checkDefaultTypeface = exports.checkMarketingBuzzword = exports.checkTinyText = exports.checkLowContrast = exports.checkJustifiedText = exports.checkGrayOnColor = exports.checkSkippedHeading = exports.checkBrokenImage = void 0;
const check_context_1 = require("../check-context");
const subjective_rendered_scanner_1 = require("../subjective-rendered-scanner");
const selectorsOf = (findings) => findings.map((f) => f.selector).filter((s) => !!s);
// Shared objective-family helper: gate on availability, then pass/fail on the presence of the rule's class.
function objectiveVerdict(scan, rule, cleanMsg, failMsg, remediation) {
    if (!scan || !scan.available)
        return (0, check_context_1.inconclusive)(`${rule} needs a live rendered scan of the page`, 'unsupported_runtime');
    const hits = scan.findings.filter((f) => f.rule === rule);
    return hits.length === 0 ? (0, check_context_1.pass)(cleanMsg) : (0, check_context_1.fail)(failMsg(hits.length), selectorsOf(hits), remediation);
}
const checkBrokenImage = (ctx) => objectiveVerdict(ctx.renderedScan?.objective, 'broken-image', 'no broken images in the rendered page', (n) => `${n} image(s) render broken (no usable source)`, 'Provide a valid src (and alt), or remove the broken <img>');
exports.checkBrokenImage = checkBrokenImage;
const checkSkippedHeading = (ctx) => objectiveVerdict(ctx.renderedScan?.objective, 'skipped-heading', 'heading outline does not skip a level', (n) => `${n} heading-level skip(s) in the outline (WCAG 1.3.1)`, 'Do not skip heading levels (e.g. h1 then h3); use sequential headings and style with CSS');
exports.checkSkippedHeading = checkSkippedHeading;
const checkGrayOnColor = (ctx) => objectiveVerdict(ctx.renderedScan?.objective, 'gray-on-color', 'no desaturated text failing contrast on a chromatic background', (n) => `${n} run(s) of gray text on a colored background fail AA contrast (WCAG 1.4.3)`, 'Increase the text contrast (darken/lighten or saturate) against its colored background to meet WCAG AA');
exports.checkGrayOnColor = checkGrayOnColor;
const checkJustifiedText = (ctx) => objectiveVerdict(ctx.renderedScan?.objective, 'justified-text', 'no justified body text', (n) => `${n} justified text block(s) (uneven spacing / rivers; WCAG 1.4.8)`, 'Use text-align: start instead of justify for body copy');
exports.checkJustifiedText = checkJustifiedText;
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
const checkLowContrast = (ctx) => {
    const scan = ctx.renderedScan?.objective;
    if (!scan || !scan.available)
        return (0, check_context_1.inconclusive)('color-contrast needs a live rendered scan of the page', 'unsupported_runtime');
    const grayOnColorSelectors = new Set(scan.findings.filter((f) => f.rule === 'gray-on-color').map((f) => f.selector).filter((s) => !!s));
    // Keep a low-contrast hit unless its selector is also a gray-on-color hit (the more specific subtype). A
    // selector-less low-contrast hit cannot be de-duped, so it is kept (never silently drop a real defect).
    const hits = scan.findings.filter((f) => f.rule === 'low-contrast' && !(f.selector && grayOnColorSelectors.has(f.selector)));
    return hits.length === 0
        ? (0, check_context_1.pass)('all measured text meets WCAG AA contrast against its background')
        : (0, check_context_1.fail)(`${hits.length} text run(s) fail WCAG AA contrast against their background (WCAG 1.4.3)`, selectorsOf(hits), 'Increase foreground/background contrast to meet WCAG AA (4.5:1 body, 3:1 large text)');
};
exports.checkLowContrast = checkLowContrast;
const checkTinyText = (ctx) => {
    const scan = ctx.renderedScan?.subjective;
    if (!scan || !scan.available)
        return (0, check_context_1.inconclusive)('tiny-text needs a live rendered scan of the page', 'unsupported_runtime');
    const hits = scan.findings.filter((f) => f.rule === 'tiny-text');
    return hits.length === 0
        ? (0, check_context_1.pass)('content text is rendered at a comfortable readable size')
        : (0, check_context_1.fail)(`a substantial share of content text is rendered very small (strains readability)`, selectorsOf(hits), 'Raise small body/interface text toward the 16px comfortable-reading baseline');
};
exports.checkTinyText = checkTinyText;
const checkMarketingBuzzword = (ctx) => {
    const scan = ctx.renderedScan?.subjective;
    if (!scan || !scan.available)
        return (0, check_context_1.inconclusive)('marketing-buzzword needs a live rendered scan of the page', 'unsupported_runtime');
    const hits = scan.findings.filter((f) => f.rule === 'marketing-buzzword');
    return hits.length === 0
        ? (0, check_context_1.pass)('copy reads concretely (low marketing-buzzword density)')
        : (0, check_context_1.fail)(`the copy leans on generic marketing buzzwords (high buzzword density) rather than concrete specifics`, selectorsOf(hits), 'Replace generic buzzwords (seamless, powerful, revolutionary, ...) with concrete, specific claims');
};
exports.checkMarketingBuzzword = checkMarketingBuzzword;
// default-typeface has TWO grounds and they need DIFFERENT verdict text: ground A is "no typeface was chosen"
// (the content is on the system stack), ground B is "a typeface was chosen and it is not the committed one"
// (the page may be set in a perfectly good face). Phrasing every finding as the default-stack story would be
// wrong on ground B (Codex review P2), so the ground tag on the finding drives the message.
const checkDefaultTypeface = (ctx) => {
    const scan = ctx.renderedScan?.subjective;
    if (!scan || !scan.available)
        return (0, check_context_1.inconclusive)('default-typeface needs a live rendered scan of the page', 'unsupported_runtime');
    const hits = scan.findings.filter((f) => f.rule === 'default-typeface');
    if (hits.length === 0)
        return (0, check_context_1.pass)('content text is set in a chosen typeface');
    const brandMismatch = hits.every((f) => (0, subjective_rendered_scanner_1.typefaceGroundOf)(f.detail) === 'brand-mismatch');
    return brandMismatch
        ? (0, check_context_1.fail)('the content text is not set in the typeface the brand committed to', selectorsOf(hits), 'Apply the committed family to the body copy, or update the committed family if the page is right and the brand record is stale')
        : (0, check_context_1.fail)('the content text is not set in a chosen typeface (it renders on the default system stack)', selectorsOf(hits), 'Set the content text in the typeface the brand committed to, and make sure that family actually reaches the body copy');
};
exports.checkDefaultTypeface = checkDefaultTypeface;
exports.RENDERED_CHECKS = {
    'a11y/broken-image': exports.checkBrokenImage,
    'a11y/heading-order': exports.checkSkippedHeading,
    'a11y/gray-on-color': exports.checkGrayOnColor,
    'a11y/justified-text': exports.checkJustifiedText,
    'a11y/color-contrast': exports.checkLowContrast,
    'polish/tiny-text': exports.checkTinyText,
    'polish/marketing-buzzword': exports.checkMarketingBuzzword,
    'polish/default-typeface': exports.checkDefaultTypeface,
};
//# sourceMappingURL=rendered-checks.js.map