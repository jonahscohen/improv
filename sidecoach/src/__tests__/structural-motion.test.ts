// sidecoach/src/__tests__/structural-motion.test.ts
//
// OWNED test for the Stage 4c structural + 4d motion/marker rendered SUBJECTIVE classes:
//   4c: thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay, first-viewport-overflow,
//       decorative-dot-grid, soft-radial-glow, image-hover-transform
//   4d: marquee, blinking-cursor, numbered-section-markers
//
// Two layers (the typography-extremes.test.ts shape):
//   1. SYNTHETIC-SCORE boundary tests (no browser) - pin each frozen threshold in structuralFindingsFromScore /
//      motionMarkerFindingsFromScore exactly at its edge.
//   2. BROWSER end-to-end over the on-disk fixtures (the SAME pages eval/structural-motion-calibrate.mjs sweeps)
//      plus the shipped known-good page - the A2 precision non-regression: clean-page.html fires NONE of the ten.
//
// Precision-first: every negative fixture is asserted to NOT fire its class; the known-good page is asserted clean.
import { chromium } from 'playwright';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import {
  analyzeHtmlOnBrowserSubjective,
  structuralFindingsFromScore, motionMarkerFindingsFromScore,
  TBWS_MIN_COUNT, STRIPE_MIN_COUNT, TUO_MIN_COUNT, FVO_OVERFLOW_MIN_PX, DOTGRID_MIN_COUNT, GLOW_MIN_COUNT, IHT_MIN_COUNT,
  MARQUEE_MIN_COUNT, BLINK_MIN_COUNT, NUM_MARKER_MIN_COUNT,
  type StructuralScore, type MotionMarkerScore, type SubjectiveRule, type SubjectiveFinding,
} from '../validators/subjective-rendered-scanner';

const MY_RULES: SubjectiveRule[] = [
  'thin-border-wide-shadow', 'repeating-stripe-gradients', 'text-under-overlay', 'first-viewport-overflow',
  'decorative-dot-grid', 'soft-radial-glow', 'image-hover-transform',
  'marquee', 'blinking-cursor', 'numbered-section-markers',
];
const failures: string[] = [];
let asserted = 0;
const check = (cond: boolean, msg: string) => { asserted++; if (!cond) failures.push(msg); };

// ---- layer 1: synthetic-score boundary tests ----------------------------------------------------------------
const baseStructural = (over: Partial<StructuralScore> = {}): StructuralScore => ({
  viewportWidth: 1280, viewportHeight: 800,
  thinBorderWideShadowCount: 0, tbwsMaxRatio: 0,
  stripeGradientCount: 0,
  textUnderOverlayCount: 0,
  firstViewportOverflowPx: 0,
  dotGridCount: 0,
  radialGlowCount: 0,
  imageHoverTransformCount: 0,
  ...over,
});
const baseMotion = (over: Partial<MotionMarkerScore> = {}): MotionMarkerScore => ({
  marqueeElementCount: 0, marqueeAnimCount: 0,
  blinkCount: 0,
  numberedMarkerCount: 0, numberedZeroPadded: false,
  ...over,
});
const sRules = (s: StructuralScore): Set<string> => new Set(structuralFindingsFromScore(s).map((f: SubjectiveFinding) => f.rule));
const mRules = (s: MotionMarkerScore): Set<string> => new Set(motionMarkerFindingsFromScore(s).map((f: SubjectiveFinding) => f.rule));

// each structural class fires at exactly its floor, not just below.
check(sRules(baseStructural({ thinBorderWideShadowCount: TBWS_MIN_COUNT, tbwsMaxRatio: 8 })).has('thin-border-wide-shadow'), `tbws must fire at count=${TBWS_MIN_COUNT}`);
check(!sRules(baseStructural({ thinBorderWideShadowCount: TBWS_MIN_COUNT - 1 })).has('thin-border-wide-shadow'), 'tbws must NOT fire below its count floor');
check(sRules(baseStructural({ stripeGradientCount: STRIPE_MIN_COUNT })).has('repeating-stripe-gradients'), `stripe must fire at count=${STRIPE_MIN_COUNT}`);
check(!sRules(baseStructural({ stripeGradientCount: STRIPE_MIN_COUNT - 1 })).has('repeating-stripe-gradients'), 'stripe must NOT fire below its count floor');
check(sRules(baseStructural({ textUnderOverlayCount: TUO_MIN_COUNT })).has('text-under-overlay'), `text-under-overlay must fire at count=${TUO_MIN_COUNT}`);
check(!sRules(baseStructural({ textUnderOverlayCount: TUO_MIN_COUNT - 1 })).has('text-under-overlay'), 'text-under-overlay must NOT fire below its count floor');
check(sRules(baseStructural({ firstViewportOverflowPx: FVO_OVERFLOW_MIN_PX })).has('first-viewport-overflow'), `fvo must fire at ${FVO_OVERFLOW_MIN_PX}px overflow`);
check(!sRules(baseStructural({ firstViewportOverflowPx: FVO_OVERFLOW_MIN_PX - 1 })).has('first-viewport-overflow'), 'fvo must NOT fire below the overflow floor');
check(sRules(baseStructural({ dotGridCount: DOTGRID_MIN_COUNT })).has('decorative-dot-grid'), `dot-grid must fire at count=${DOTGRID_MIN_COUNT}`);
check(!sRules(baseStructural({ dotGridCount: DOTGRID_MIN_COUNT - 1 })).has('decorative-dot-grid'), 'dot-grid must NOT fire below its count floor');
check(sRules(baseStructural({ radialGlowCount: GLOW_MIN_COUNT })).has('soft-radial-glow'), `glow must fire at count=${GLOW_MIN_COUNT}`);
check(!sRules(baseStructural({ radialGlowCount: GLOW_MIN_COUNT - 1 })).has('soft-radial-glow'), 'glow must NOT fire below its count floor');
check(sRules(baseStructural({ imageHoverTransformCount: IHT_MIN_COUNT })).has('image-hover-transform'), `image-hover must fire at count=${IHT_MIN_COUNT}`);
check(!sRules(baseStructural({ imageHoverTransformCount: IHT_MIN_COUNT - 1 })).has('image-hover-transform'), 'image-hover must NOT fire below its count floor');

// a multi-defect structural score returns one finding per firing class.
{
  const multi = sRules(baseStructural({ stripeGradientCount: 2, dotGridCount: 1, imageHoverTransformCount: 3 }));
  check(multi.has('repeating-stripe-gradients') && multi.has('decorative-dot-grid') && multi.has('image-hover-transform'), 'a multi-defect structural score returns one finding per firing class');
  check(!multi.has('thin-border-wide-shadow') && !multi.has('soft-radial-glow'), 'silent structural slices emit nothing');
}

// motion/marker floors. marquee fires from EITHER a <marquee> element OR a marquee animation (the sum).
check(mRules(baseMotion({ marqueeElementCount: MARQUEE_MIN_COUNT })).has('marquee'), 'marquee must fire on a <marquee> element');
check(mRules(baseMotion({ marqueeAnimCount: MARQUEE_MIN_COUNT })).has('marquee'), 'marquee must fire on a marquee animation');
check(!mRules(baseMotion({})).has('marquee'), 'marquee must NOT fire with no element and no animation');
check(mRules(baseMotion({ blinkCount: BLINK_MIN_COUNT })).has('blinking-cursor'), `blink must fire at count=${BLINK_MIN_COUNT}`);
check(!mRules(baseMotion({ blinkCount: BLINK_MIN_COUNT - 1 })).has('blinking-cursor'), 'blink must NOT fire below its count floor');
check(mRules(baseMotion({ numberedMarkerCount: NUM_MARKER_MIN_COUNT, numberedZeroPadded: true })).has('numbered-section-markers'), `numbered must fire at count=${NUM_MARKER_MIN_COUNT}`);
check(!mRules(baseMotion({ numberedMarkerCount: NUM_MARKER_MIN_COUNT - 1 })).has('numbered-section-markers'), 'numbered must NOT fire below its count floor');

// ---- layer 2: browser end-to-end over the on-disk fixtures + the shipped known-good page ---------------------
const FIX = path.resolve(__dirname, '..', '..', 'eval', 'fixtures', 'structural-motion');
const KNOWN_GOOD = path.resolve(__dirname, '..', '..', 'eval', 'fixtures', 'known-good', 'clean-page.html');
const classOfFixture = (id: string): SubjectiveRule | undefined => MY_RULES.find((r) => id.includes(r));

async function run(): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const f of readdirSync(FIX).filter((x) => x.endsWith('.html')).sort()) {
      const id = f.replace('.html', '');
      const cls = classOfFixture(id);
      if (!cls) { failures.push(`fixture ${id} names no known class`); continue; }
      const findings = await analyzeHtmlOnBrowserSubjective(browser, readFileSync(path.join(FIX, f), 'utf8'));
      const fired = new Set(findings.map((x) => x.rule));
      if (f.startsWith('p')) check(fired.has(cls), `positive fixture ${id} must fire ${cls}`);
      else check(!fired.has(cls), `negative fixture ${id} must NOT fire ${cls}`);
    }
    // A2 precision non-regression: the shipped known-good page fires NONE of the ten new classes.
    const kg = new Set((await analyzeHtmlOnBrowserSubjective(browser, readFileSync(KNOWN_GOOD, 'utf8'))).map((x) => x.rule));
    for (const r of MY_RULES) check(!kg.has(r), `known-good clean-page.html must NOT fire ${r} (A2 precision non-regression)`);
  } finally { await browser.close(); }

  if (failures.length) throw new Error(`structural-motion FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
  console.log(`structural-motion: OK (${asserted} asserted; classes: [${MY_RULES.join(', ')}])`);
}

run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
