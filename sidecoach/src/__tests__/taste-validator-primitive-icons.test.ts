// sidecoach/src/__tests__/taste-validator-primitive-icons.test.ts
//
// OWNED test for the 2026-07-28 fabricated-svg primitive-icon extension.
//
// THE GAP THIS CLOSES. checkFabricatedSvg matched `<path ... d="...">` and nothing else, then bailed
// on `if (paths.length === 0) continue`. Two classes of fabricated icon walked through:
//   1. PRIMITIVE-BUILT - assembled from <line>/<rect>/<circle>/<polyline>/<polygon>/<ellipse>. The
//      hamburger in reference/index.html was three hand-placed <line> elements and scored zero paths.
//   2. COMPOUND-PATH - flattened into one d="" with several moveto commands ("M3 6h18M3 12h18..."),
//      which is three strokes counted as one path, and short enough to clear maxPathLen > 50 too.
//
// THE HARD HALF IS PRECISION, and it took three attempts and two adversarial reviews to get right.
// A <rect> is not an icon: charts, diagrams, sparklines, wordmarks and the repo's own favicon are
// legitimate primitive SVG.
//
//   DRAFT 1  icon-grid + currentColor + primitive-count.        MEASURED P=0.500.
//            Codex broke it with a 24x24 sparkline, a micro bar chart and a small logo.
//   DRAFT 2  ...plus the "stroke-icon idiom" (stroke-linecap/linejoin).  MEASURED P=0.750 R=0.600.
//            WORSE. Rounded caps are just how anyone draws a 24px sparkline. Codex broke it again.
//   SHIPPED  ...the SEMANTIC signal instead: aria-hidden="true".         MEASURED P=1.000.
//
// Both visual drafts failed the same way, and BOTH TIMES this suite asserted the new false positive
// as a desirable "anchor" - a test suite certifying the bug it should have caught. That is why the
// counterexamples from both review rounds are pinned below as permanent NEGATIVES, and why the
// discriminator is no longer a guess about pixels: an icon is decorative chrome (the meaning is in
// the adjacent text, so the correct markup is aria-hidden="true"), while a chart, sparkline or logo
// carries information and is exposed via role="img" and a label. Style cannot tell those apart -
// both are small monochrome line art. The author's own accessibility declaration can.
//
// So the branch fires on: aria-hidden="true" AND currentColor AND a square grid of side <= 48 AND
// no <text>/<defs>/gradient/<animate> AND >= 2 drawing elements (or one path with >= 2 subpaths).
//
// SCOPE LIMITS are asserted, not hand-waved - every one is a PASSING test named "scope limit", so
// loosening the rule later has to edit a deliberate line rather than silently widen.
//
// MUTATION CONTROL. Every guard is disabled in turn by mutation-check-primitive-icons.sh, which
// requires the NAMED assertion to be among the failures and the total failure COUNT to match a
// declared blast radius. It does not assert exact failure identities, and the radii are calibrated
// from observed runs - frozen characterization data and a drift tripwire, not independent evidence.
// Anchors here are paired with each negative: a "not flagged" assertion passes just as happily when
// the fixture never reached the detector at all.
import { validateTaste } from '../taste-validator';

let failures = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    console.log(`PASS ${name}`);
  } else {
    console.error(`FAIL ${name}`);
    failures++;
  }
}

const wrap = (body: string) => `<!doctype html><html><body>${body}</body></html>`;
const fired = (html: string) =>
  validateTaste(wrap(html)).some(v => v.ruleId === 'taste/fabricated-svg');

// The library outline convention, shared by every positive fixture below.
const ICON_ATTRS =
  'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"';

// ---------------------------------------------------------------------------
// POSITIVES - primitive-built icons that must now fire
// ---------------------------------------------------------------------------

// Verbatim from reference/index.html at 8ae761a4: the icon the gate could not see.
const HAMBURGER_LINES =
  '<button class="topbar-toggle" type="button" aria-label="Toggle sidebar">' +
  `<svg ${ICON_ATTRS}>` +
  '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg></button>';

const CHECKBOX_RECT_POLYLINE =
  `<svg ${ICON_ATTRS}><rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="8 12 11 15 16 9"/></svg>`;

const CLOCK_CIRCLE_LINES =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" aria-hidden="true">' +
  '<circle cx="8" cy="8" r="7"/><line x1="8" y1="4" x2="8" y2="8"/><line x1="8" y1="8" x2="11" y2="10"/></svg>';

check('primitive icon: 3-line hamburger from reference/index.html IS flagged', fired(HAMBURGER_LINES));
check('primitive icon: rect + polyline checkbox IS flagged', fired(CHECKBOX_RECT_POLYLINE));
check('primitive icon: circle + 2 lines clock on a 16 grid IS flagged', fired(CLOCK_CIRCLE_LINES));

// The marker is what the rule is actually about. A primitive icon that declares provenance is fine.
check(
  'primitive icon with data-icon-source marker is NOT flagged',
  !fired(HAMBURGER_LINES.replace('<svg ', '<svg data-icon-source="lucide" '))
);
check(
  'primitive icon with lucide- class marker is NOT flagged',
  !fired(HAMBURGER_LINES.replace('<svg ', '<svg class="lucide-menu" '))
);
check(
  'primitive icon with a <!-- source: --> comment is NOT flagged',
  !fired(HAMBURGER_LINES.replace('<line', '<!-- source: lucide/menu.svg --><line'))
);

// ---------------------------------------------------------------------------
// NEGATIVES - legitimate primitive SVG that must stay silent, each with an anchor.
// ---------------------------------------------------------------------------

// 1. The repo's own favicon: a brand mark. 64 grid, literal hex, carries <text>.
const FAVICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
  '<rect width="64" height="64" rx="12" fill="#F4EFE4"/>' +
  '<text x="50%" y="50%" font-size="44" text-anchor="middle" fill="#DC2618">&amp;</text></svg>';
check('logo: favicon rect + text is NOT flagged', !fired(FAVICON));
check(
  '  anchor: same shape on an icon grid, declared decorative, IS flagged',
  fired(`<svg ${ICON_ATTRS}><rect width="24" height="24" rx="12"/><circle cx="12" cy="12" r="4"/></svg>`)
);

// 2. A chart: many rects, a real data viewBox, axis text.
const BAR_CHART =
  `<svg viewBox="0 0 320 180" stroke="currentColor" stroke-linecap="round">` +
  '<rect x="10" y="40" width="30" height="120"/><rect x="50" y="70" width="30" height="90"/>' +
  '<rect x="90" y="20" width="30" height="140"/><rect x="130" y="95" width="30" height="65"/>' +
  '<text x="10" y="175">Q1</text></svg>';
check('chart: bar chart with a data viewBox is NOT flagged', !fired(BAR_CHART));
check(
  '  anchor: the same bars on a 24 grid with no text IS flagged',
  fired(`<svg ${ICON_ATTRS}><rect x="2" y="8" width="4" height="12"/><rect x="10" y="4" width="4" height="16"/><rect x="18" y="12" width="4" height="8"/></svg>`)
);

// 3. A diagram container populated by JS - zero children at rest.
check('diagram: empty <svg id="wires"> container is NOT flagged', !fired('<svg id="wires" aria-hidden="true"></svg>'));

// 4. A wordmark: non-square viewBox.
const WORDMARK =
  '<svg viewBox="0 0 150 54" stroke="currentColor" stroke-linejoin="round"><polygon points="0,0 40,0 40,54 0,54"/>' +
  '<polyline points="50,10 90,10 90,44"/></svg>';
check('wordmark: non-square viewBox is NOT flagged', !fired(WORDMARK));
check(
  '  anchor: the same primitives on a square 24 grid IS flagged',
  fired(`<svg ${ICON_ATTRS}><polygon points="0,0 8,0 8,8 0,8"/><polyline points="10,2 18,2 18,10"/></svg>`)
);

// 5. A decorative/brand shape on a large square grid.
const BRAND_SQUARE =
  '<svg viewBox="0 0 100 100" fill="#DC2618"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="20"/></svg>';
check('brand mark: 100 grid with literal fill is NOT flagged', !fired(BRAND_SQUARE));
check(
  '  anchor: the same circles on a 24 grid, declared decorative, IS flagged',
  fired(`<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/></svg>`)
);

// 6. CODEX REGRESSION BLOCK. These three broke the earlier draft of this rule. Kept verbatim.
const CODEX_SPARKLINE =
  '<svg viewBox="0 0 24 24" role="img" aria-label="Revenue trend" fill="none" stroke="currentColor">' +
  '<polyline points="1,20 6,12 11,16 16,6 23,9"/><circle cx="23" cy="9" r="1.5"/></svg>';
const CODEX_MICRO_BARCHART =
  '<svg viewBox="0 0 24 24" role="img" aria-label="7-day usage" fill="currentColor">' +
  '<rect x="3" y="12" width="3" height="8"/><rect x="8" y="6" width="3" height="14"/>' +
  '<rect x="13" y="9" width="3" height="11"/><rect x="18" y="3" width="3" height="17"/></svg>';
const CODEX_SMALL_LOGO =
  '<svg viewBox="0 0 24 24" aria-label="Acme" fill="currentColor">' +
  '<circle cx="8" cy="12" r="5"/><circle cx="16" cy="12" r="5"/></svg>';

// Round 2: Codex broke DRAFT 2 with this - the same sparkline drawn with rounded caps, which is
// simply good practice at 24px. It is the reason the stroke-idiom heuristic was abandoned.
const CODEX_SPARKLINE_ROUNDED =
  '<svg viewBox="0 0 24 24" role="img" aria-label="Revenue trend" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<polyline points="2 18 6 13 10 16 15 7 22 10"/>' +
  '<circle cx="22" cy="10" r="1.5" fill="currentColor" stroke="none"/></svg>';

check('codex FP 1: 24-grid sparkline with endpoint dot is NOT flagged', !fired(CODEX_SPARKLINE));
check('codex FP 4 (round 2): rounded-cap sparkline is NOT flagged', !fired(CODEX_SPARKLINE_ROUNDED));

// Round 3: a LABELLED chart that hides its own gridline layer. An earlier build read aria-hidden
// anywhere in the block, so the decorative <g> vouched for the whole graphic. The root tag's own
// declaration is what counts, and role="img" + aria-label on the root is the opposite of chrome.
const CODEX_LABELLED_CHART_WITH_HIDDEN_LAYER =
  '<svg viewBox="0 0 24 24" role="img" aria-label="Revenue rose from 42 to 57" fill="none" stroke="currentColor">' +
  '<g aria-hidden="true"><line x1="2" y1="20" x2="22" y2="20"/></g>' +
  '<polyline points="2 18 7 14 12 16 17 8 22 6"/>' +
  '<circle cx="22" cy="6" r="1.5" fill="currentColor" stroke="none"/></svg>';
check('codex FP 5 (round 3): labelled chart with a hidden gridline layer is NOT flagged', !fired(CODEX_LABELLED_CHART_WITH_HIDDEN_LAYER));
check(
  '  anchor: the same drawing with the ROOT declared decorative IS flagged',
  fired(
    '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor">' +
      '<line x1="2" y1="20" x2="22" y2="20"/><polyline points="2 18 7 14 12 16 17 8 22 6"/></svg>'
  )
);
check(
  'root scope: aria-hidden on a DESCENDANT does not make the graphic chrome',
  !fired('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><g aria-hidden="true"><line x1="2" y1="2" x2="22" y2="2"/><line x1="2" y1="8" x2="22" y2="8"/></g></svg>')
);
check('codex FP 2: 24-grid micro bar chart is NOT flagged', !fired(CODEX_MICRO_BARCHART));
check('codex FP 3: small monochrome logo on a 24 grid is NOT flagged', !fired(CODEX_SMALL_LOGO));
check(
  '  anchor: the SAME sparkline declared decorative (aria-hidden) IS flagged',
  fired(
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">' +
      '<polyline points="1,20 6,12 11,16 16,6 23,9"/><circle cx="23" cy="9" r="1.5"/></svg>'
  )
);

// A single primitive is a shape, not an icon, even in the stroke-icon idiom.
check(
  'sparkline: single polyline on an icon grid is NOT flagged',
  !fired('<svg viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><polyline points="1,20 6,12 11,16 16,6 23,9"/></svg>')
);
check(
  '  anchor: adding a second primitive to the same svg IS flagged',
  fired('<svg viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"><polyline points="1,20 6,12 11,16 16,6 23,9"/><circle cx="23" cy="9" r="2"/></svg>')
);

// 7. Animated / gradient illustration: brand motion, not UI chrome.
check(
  'animation: <animate> child is NOT flagged',
  !fired(`<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"><animate attributeName="r" values="4;8;4" dur="2s"/></circle></svg>`)
);
check(
  'illustration: gradient/defs is NOT flagged',
  !fired(`<svg ${ICON_ATTRS}><defs><linearGradient id="g"/></defs><circle cx="12" cy="12" r="10" fill="url(#g)"/><rect x="2" y="2" width="6" height="6"/></svg>`)
);

// ---------------------------------------------------------------------------
// SCOPE LIMITS - accepted misses, asserted so a later loosening is deliberate.
// ---------------------------------------------------------------------------

check(
  'scope limit: icon-grid primitives painted with literal colors are NOT flagged',
  !fired('<svg width="24" height="24" aria-hidden="true"><line x1="0" y1="0" x2="24" y2="24" stroke="#333"/><line x1="0" y1="24" x2="24" y2="0" stroke="#333"/></svg>')
);
check(
  '  anchor: the same two lines with currentColor IS flagged',
  fired('<svg width="24" height="24" aria-hidden="true"><line x1="0" y1="0" x2="24" y2="24" stroke="currentColor"/><line x1="0" y1="24" x2="24" y2="0" stroke="currentColor"/></svg>')
);

check(
  'scope limit: a primitive icon with NO aria-hidden is NOT flagged (accepted recall cost)',
  !fired('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>')
);
check(
  '  anchor: the same icon declared decorative IS flagged',
  !!fired('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>')
);
check(
  'scope limit: a FILLED primitive icon IS flagged when declared decorative',
  fired('<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="12" r="9"/><rect x="10" y="6" width="4" height="8"/></svg>')
);

// Grid boundary, side: a large SQUARE canvas is illustrative territory. Guarded by ICON_GRID_MAX.
check(
  'scope limit: a 200x200 square canvas is NOT flagged',
  !fired('<svg viewBox="0 0 200 200" fill="none" stroke="currentColor" aria-hidden="true"><circle cx="100" cy="100" r="80"/><circle cx="100" cy="100" r="40"/></svg>')
);
check(
  '  anchor: the same two circles on a 24 grid IS flagged',
  fired(`<svg ${ICON_ATTRS}><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="5"/></svg>`)
);

// Grid boundary, aspect: a small NON-square box is an ornament or rule. Guarded by w === h.
check(
  'scope limit: a small non-square 24x12 box is NOT flagged',
  !fired('<svg viewBox="0 0 24 12" fill="none" stroke="currentColor" aria-hidden="true"><line x1="0" y1="6" x2="24" y2="6"/><line x1="0" y1="9" x2="24" y2="9"/></svg>')
);
check(
  '  anchor: the same two lines in a square 24x24 box IS flagged',
  fired(`<svg ${ICON_ATTRS}><line x1="0" y1="6" x2="24" y2="6"/><line x1="0" y1="9" x2="24" y2="9"/></svg>`)
);

// viewBox parsing: comma-separated is legal and must not fall through to the width/height branch.
check(
  'parsing: comma-separated viewBox="0,0,24,24" is recognised as an icon grid',
  fired('<svg viewBox="0,0,24,24" fill="none" stroke="currentColor" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>')
);
check(
  '  anchor: the same comma viewBox at 200 is NOT flagged',
  !fired('<svg viewBox="0,0,200,200" fill="none" stroke="currentColor" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/></svg>')
);

// ---------------------------------------------------------------------------
// COMPOUND PATH - the second gap.
// ---------------------------------------------------------------------------

// Verbatim from sidecoach/reference/responsive-foundation.md at 8ae761a4.
const COMPOUND_HAMBURGER =
  '<svg width="24" height="24" aria-hidden="true">' +
  '<path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
check('compound path: 3 subpaths in one d="" on an icon grid IS flagged', fired(COMPOUND_HAMBURGER));
check(
  '  anchor: a single-subpath d="" of the same shape is NOT flagged',
  !fired('<svg width="24" height="24" aria-hidden="true"><path d="M3 6h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>')
);

// ---------------------------------------------------------------------------
// REGRESSION - branch 1 is untouched. The locked eval fixture must still fire.
// ---------------------------------------------------------------------------

// Verbatim from sidecoach/eval/migration-harness/inputs/taste-extra.html, whose golden asserts this
// finding. It carries NO currentColor - it must fire via the path branch, unchanged.
const LOCKED_FIXTURE =
  '<svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0zoooooong"/>' +
  '<path d="M8 12l3 3 5-6 more-fabricated-path-data-here"/></svg>';
check('regression: the locked eval fixture still fires via the path branch', fired(LOCKED_FIXTURE));

check(
  'regression: a single short unmarked path still does NOT fire',
  !fired(`<svg ${ICON_ATTRS}><path d="M5 12h14"/></svg>`)
);
check('regression: two unmarked paths still fire', fired(`<svg ${ICON_ATTRS}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`));
check(
  'regression: a marked 2-path icon still does NOT fire',
  !fired('<svg class="lucide-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>')
);

// A mixed svg counts ALL its drawing elements. One path plus one line is two strokes of a hand-drawn
// icon; splitting the count by element type is how the gap opened in the first place.
check(
  'mixed: one path plus one line on an icon grid IS flagged',
  fired(`<svg ${ICON_ATTRS}><path d="M5 12h14"/><line x1="4" y1="4" x2="20" y2="4"/></svg>`)
);

// ---------------------------------------------------------------------------
// MEASUREMENT against the repo's real SVG, labelled BY HAND during the 2026-07-28 sweep.
//
// LIMITATION, stated plainly: these labels were produced by the same author as the rule. They cover
// every inline SVG in the repo's own HTML/markdown/assets (third-party eval corpora excluded) but
// they are not an independent ground truth, and a rule graded against its author's own labels can
// only demonstrate self-consistency, not correctness. The load-bearing external check is the
// repo-wide old-vs-new sweep recorded in the session beat, plus the Codex counterexamples above.
// ---------------------------------------------------------------------------

interface Labelled { name: string; icon: boolean; svg: string }

const CORPUS: Labelled[] = [
  // Positives: the seven fixed in the 2026-07-28 sweep (path icons shown pre-marker).
  { name: 'index.html arrow-up-right (2 paths)', icon: true, svg: `<svg ${ICON_ATTRS}><path d="M7 17 17 7"/><path d="M7 7h10v10"/></svg>` },
  { name: 'index.html hamburger (3 lines)', icon: true, svg: HAMBURGER_LINES },
  { name: 'index.html arrow-right x4 (2 paths)', icon: true, svg: `<svg ${ICON_ATTRS}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>` },
  { name: 'responsive-foundation.md hamburger (1 compound path)', icon: true, svg: COMPOUND_HAMBURGER },
  { name: 'taste-extra.html locked fixture (2 paths)', icon: true, svg: LOCKED_FIXTURE },
  // Negatives: everything deliberately left alone during the sweep, plus the Codex counterexamples.
  { name: 'reference/assets/favicon.svg (logo)', icon: false, svg: FAVICON },
  { name: 'docs/dependency-map wires (diagram)', icon: false, svg: '<svg id="wires" aria-hidden="true"></svg>' },
  { name: 'tilt-lab and-dev-white.svg (wordmark)', icon: false, svg: WORDMARK },
  { name: 'justify dual-bar spark (brand mark)', icon: false, svg: BRAND_SQUARE },
  { name: 'test-visualizer-guard.sh svg alias (test literal)', icon: false, svg: '<svg><rect class="c-blue" fill="var(--p)"/></svg>' },
  { name: 'a11y-remediation.md elided example', icon: false, svg: '<svg class="icon-save" aria-hidden="true">...</svg>' },
  { name: 'codex FP: micro sparkline', icon: false, svg: CODEX_SPARKLINE },
  { name: 'codex FP: micro bar chart', icon: false, svg: CODEX_MICRO_BARCHART },
  { name: 'codex FP: small monochrome logo', icon: false, svg: CODEX_SMALL_LOGO },
  { name: 'codex FP r2: rounded-cap sparkline', icon: false, svg: CODEX_SPARKLINE_ROUNDED },
  { name: 'codex FP r3: labelled chart, hidden gridline layer', icon: false, svg: CODEX_LABELLED_CHART_WITH_HIDDEN_LAYER },
];

let tp = 0, fp = 0, fn = 0, tn = 0;
const mistakes: string[] = [];
for (const c of CORPUS) {
  const hit = fired(c.svg);
  if (c.icon && hit) tp++;
  else if (c.icon && !hit) { fn++; mistakes.push(`  MISS (false negative): ${c.name}`); }
  else if (!c.icon && hit) { fp++; mistakes.push(`  FALSE POSITIVE: ${c.name}`); }
  else tn++;
}
const precision = tp + fp === 0 ? 1 : tp / (tp + fp);
const recall = tp + fn === 0 ? 1 : tp / (tp + fn);
console.log(
  `\nCORPUS (author-labelled + codex counterexamples, n=${CORPUS.length}): ` +
  `tp=${tp} fp=${fp} fn=${fn} tn=${tn} precision=${precision.toFixed(3)} recall=${recall.toFixed(3)}`
);
for (const m of mistakes) console.log(m);

check('corpus: zero false positives', fp === 0);
check('corpus: zero false negatives', fn === 0);
// Guard the measurement itself: a corpus that silently shrank would make the scores meaningless.
check('corpus: both classes are fully represented', tp + fn === 5 && tn + fp === 11);

if (failures > 0) {
  console.error(`\ntaste-validator primitive-icons: ${failures} FAILURE(S)`);
  process.exit(1);
}
console.log('\ntaste-validator primitive-icons PASS');
