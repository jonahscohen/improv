"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Stage 2 convergence: the cherry-picked DOM-evidence Tier-2 keepers detect correctly. Each: N/A guard + fail +
// pass. These 6 replace the genuinely-strong rules from ExtendedDomainValidator's Tier-2 set (the rest retired).
const page_quality_checks_1 = require("../validators/checks/page-quality-checks");
const m = (markup) => ({ cssText: '', markup, files: [] });
const css = (cssText) => ({ cssText, markup: '', files: [] });
function expect(c, msg) { if (!c)
    throw new Error(msg); }
function run() {
    // image-dimensions
    expect((0, page_quality_checks_1.checkImageDimensions)(m('<p>no images</p>')).status === 'not_applicable', 'img-dims N/A without <img>');
    expect((0, page_quality_checks_1.checkImageDimensions)(m('<img src="a.jpg">')).status === 'fail', 'img-dims: missing width/height fails');
    expect((0, page_quality_checks_1.checkImageDimensions)(m('<img src="a.jpg" width="10" height="10">')).status === 'pass', 'img-dims: width+height passes');
    expect((0, page_quality_checks_1.checkImageDimensions)(m('<img src="a.jpg" style="aspect-ratio:1">')).status === 'pass', 'img-dims: aspect-ratio passes');
    // image-lazy-load (PER-IMAGE, Codex P1: first/hero image may be eager; later non-lazy images must not be masked)
    expect((0, page_quality_checks_1.checkImageLazyLoad)(m('<p>none</p>')).status === 'not_applicable', 'lazy N/A without <img>');
    expect((0, page_quality_checks_1.checkImageLazyLoad)(m('<img src="hero.jpg">')).status === 'pass', 'lazy: single hero image may load eagerly (first image exempt)');
    expect((0, page_quality_checks_1.checkImageLazyLoad)(m('<img src="hero.jpg"><img src="b.jpg"><img src="c.jpg">')).status === 'fail', 'lazy: below-the-fold images not lazy must fail (not masked by the eager hero)');
    expect((0, page_quality_checks_1.checkImageLazyLoad)(m('<img src="hero.jpg"><img src="b.jpg" loading="lazy"><img src="c.jpg" loading="lazy">')).status === 'pass', 'lazy: later images lazy-loaded passes');
    expect((0, page_quality_checks_1.checkImageLazyLoad)(m('<img src="hero.jpg"><img src="b.jpg" fetchpriority="high">')).status === 'pass', 'lazy: an explicitly-prioritized later image is exempt');
    // text-overflow (CSS)
    expect((0, page_quality_checks_1.checkTextOverflowStrategy)(css('.x{color:red}')).status === 'not_applicable', 'overflow N/A without ellipsis/clamp');
    expect((0, page_quality_checks_1.checkTextOverflowStrategy)(css('.x{text-overflow:ellipsis;white-space:nowrap}')).status === 'fail', 'overflow: ellipsis without wrap fails');
    expect((0, page_quality_checks_1.checkTextOverflowStrategy)(css('.x{text-overflow:ellipsis;overflow-wrap:anywhere}')).status === 'pass', 'overflow: with wrap passes');
    // color-scheme dark (CSS)
    expect((0, page_quality_checks_1.checkColorSchemeDark)(css('.x{color:red}')).status === 'not_applicable', 'color-scheme N/A without dark intent');
    expect((0, page_quality_checks_1.checkColorSchemeDark)(css('@media (prefers-color-scheme: dark){body{background:#000}}')).status === 'fail', 'color-scheme: dark intent without color-scheme declaration fails');
    expect((0, page_quality_checks_1.checkColorSchemeDark)(css('@media (prefers-color-scheme: dark){body{color-scheme:dark}}')).status === 'pass', 'color-scheme: declared passes');
    // chart a11y fallback
    expect((0, page_quality_checks_1.checkChartA11yFallback)(m('<p>our sales chart shows growth</p>')).status === 'not_applicable', 'chart N/A when "chart" is only prose, not a real chart');
    expect((0, page_quality_checks_1.checkChartA11yFallback)(m('<canvas class="chart"></canvas>')).status === 'fail', 'chart: canvas chart without fallback fails');
    expect((0, page_quality_checks_1.checkChartA11yFallback)(m('<canvas class="chart" aria-label="Sales by month"></canvas>')).status === 'pass', 'chart: aria-label fallback passes');
    // button label specificity
    expect((0, page_quality_checks_1.checkButtonLabelSpecific)(m('<div>no buttons</div>')).status === 'not_applicable', 'button-label N/A without button text');
    expect((0, page_quality_checks_1.checkButtonLabelSpecific)(m('<button>Submit</button>')).status === 'fail', 'button-label: generic "Submit" fails');
    expect((0, page_quality_checks_1.checkButtonLabelSpecific)(m('<button>Save changes</button>')).status === 'pass', 'button-label: specific passes');
    console.log('page-quality-checks: OK (6 Tier-2 keepers - N/A guards + pass/fail)');
}
run();
//# sourceMappingURL=page-quality-checks.test.js.map