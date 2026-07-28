// JUDGEABILITY GUARD: a rendered document with nothing in it must never be certified clean.
//
// Regression cover for a measured live defect (2026-07-28): `sidecoach-detect <url>` and `/sidecoach audit <url>`
// both returned `verdict: clean` + exit 0 for JS-mounted apps whose shell body is a bare mount point
// (tilt-lab/app/index.html at 34 bytes, lotus/src/ui/index.html at 25 bytes). The render blocks/strips the
// bundle, every detector then goes quiet through its OWN content floor (TYPO/TYPEFACE_MIN_CONTENT_CHARS = 200,
// SUB11_MIN_CHARS = 150), and that silence was reported upward as a clean bill of health - inverting the content
// floors into a false pass. The CLI's stated contract is the opposite: "A lens that did not run is NEVER clean -
// a partial scan with zero findings is inconclusive."
//
// This suite drives the REAL scanRenderedLive through its `launcher` seam with a fake browser, NOT a pre-built
// unavailable scan injected into runRenderedAudit. That distinction is the whole point (Codex review F14): an
// earlier version of this test injected the result it was asserting, so deleting the guard from scanRenderedLive
// would still have passed. The `guard removed` mutation is asserted against here by construction - the fake page
// reports an empty document and the assertion is on scanRenderedLive's own return value.
//
// Also covers the ORDERING safety property (Codex review F8): the guard is consulted only after both detector
// families have run and only when both found nothing, so a page whose only defect is a body-level background
// (glow / dot-grid / stripe, no text, no media) still reports that finding instead of being demoted.
import { scanRenderedLive, inPageRenderIsEmpty, EMPTY_RENDER_REASON, UNPROBEABLE_RENDER_REASON } from '../validators/rendered-live-scan';
import { runRenderedAudit } from '../audit-rendered';
import type { RenderedScanCollection } from '../validators/rendered-live-scan';

let passed = 0;
const check = (label: string, cond: boolean) => {
  if (!cond) throw new Error(`FAIL: ${label}`);
  passed++;
};

/**
 * Fake Browser good enough for scanRenderedLive: newContext -> newPage -> routeWebSocket/route/goto/evaluate.
 * `evaluate` dispatches on the function IDENTITY, so the test controls exactly what each in-page probe returns
 * without reimplementing any detector.
 */
function fakeBrowser(handlers: {
  objective?: unknown[];
  structural?: unknown;
  emptyProbe?: boolean | (() => never);
}) {
  const evaluate = async (fn: unknown) => {
    if (fn === inPageRenderIsEmpty) {
      const p = handlers.emptyProbe;
      if (typeof p === 'function') return p();
      return p ?? false;
    }
    const name = (fn as { name?: string }).name || '';
    if (name === 'inPageObjective') return handlers.objective ?? [];
    if (name === 'inPageSubjective') return [];
    if (name === 'inPageBuzzword') return { density: 0, effectiveDensity: 0, words: 0, weighted: 0, distinctTerms: 0, hasStrongOrPeak: false, matched: [] };
    if (name === 'inPageTypeface') return { contentChars: 0, defaultStackChars: 0, defaultStackShare: 0, families: [], dominantShare: 0, declaredFamilies: [] };
    if (name === 'inPageTypographyExtremes') return { contentChars: 0, viewportWidth: 1280, tightTrackingChars: 0, tightTrackingShare: 0, tightestTrackingEm: 0, allCapsBodyChars: 0, allCapsShare: 0, largestH1Px: 0, h1Ratio: 0, sub11Chars: 0, sub11MinPx: 0 };
    if (name === 'inPageStructural') {
      return handlers.structural ?? { viewportWidth: 1280, viewportHeight: 800, thinBorderWideShadowCount: 0, tbwsMaxRatio: 0, stripeGradientCount: 0, textUnderOverlayCount: 0, firstViewportOverflowPx: 0, dotGridCount: 0, radialGlowCount: 0, imageHoverTransformCount: 0 };
    }
    if (name === 'inPageMotionMarker') return { marqueeElementCount: 0, marqueeAnimCount: 0, numberedMarkerCount: 0 };
    return [];
  };
  const page = {
    routeWebSocket: async () => undefined,
    route: async () => undefined,
    goto: async () => undefined,
    evaluate,
  };
  return {
    newContext: async () => ({ newPage: async () => page }),
    close: async () => undefined,
  } as never;
}

/** Narrowers for the discriminated {available} unions, so assertions read cleanly. */
const reasonOf = (l: { available: boolean; reason?: string }): string => (l.available ? '' : l.reason || '');
const findingsOf = <T>(l: { available: boolean; findings?: T[] }): T[] => (l.available ? l.findings || [] : []);

const scan = (handlers: Parameters<typeof fakeBrowser>[0]): Promise<RenderedScanCollection> =>
  scanRenderedLive('http://127.0.0.1/shell', undefined, { launcher: async () => fakeBrowser(handlers) });

/** Minimal `document` stand-in for the in-page predicate: innerText/textContent + geometry-bearing visuals. */
function withDocument(body: { innerText?: string; textContent?: string; visuals?: { w: number; h: number }[] } | null, fn: () => boolean): boolean {
  const g = globalThis as unknown as { document?: unknown };
  const prior = g.document;
  const vis = (body?.visuals ?? []).map((v) => ({ getBoundingClientRect: () => ({ width: v.w, height: v.h }) }));
  g.document = body === null ? {} : {
    body: {
      innerText: body.innerText,
      textContent: body.textContent ?? '',
      querySelectorAll: (_s: string) => vis,
    },
  };
  try { return fn(); } finally { g.document = prior; }
}
const isEmpty = (b: Parameters<typeof withDocument>[0]) => withDocument(b, inPageRenderIsEmpty);

async function run() {
  // ---- the in-page predicate ----
  check('a bare mount point is empty', isEmpty({ innerText: '', visuals: [] }) === true);
  check('whitespace-only text is empty (the JS-shell shape)', isEmpty({ innerText: '  \n\t ', visuals: [] }) === true);
  check('a missing body is empty (fails closed, never crashes)', isEmpty(null) === true);
  check('ONE character of visible text is not empty', isEmpty({ innerText: 'x', visuals: [] }) === false);
  check('ONE painted image is not empty', isEmpty({ innerText: '', visuals: [{ w: 40, h: 40 }] }) === false);

  // F11: geometry matters - a zero-size image is not rendered content.
  check('a zero-size image does NOT clear the guard', isEmpty({ innerText: '', visuals: [{ w: 0, h: 0 }] }) === true);
  check('a zero-height image does NOT clear the guard', isEmpty({ innerText: '', visuals: [{ w: 100, h: 0 }] }) === true);
  check('one painted visual among hidden ones clears the guard', isEmpty({ innerText: '', visuals: [{ w: 0, h: 0 }, { w: 10, h: 10 }] }) === false);

  // F12: visible text only. innerText is empty (nothing rendered) while textContent carries hidden/template text.
  check('hidden textContent does NOT clear the guard when innerText is empty',
    isEmpty({ innerText: '', textContent: 'hidden template copy nobody can see', visuals: [] }) === true);
  check('textContent IS used when innerText is unavailable (non-rendering context)',
    isEmpty({ innerText: undefined, textContent: 'real copy', visuals: [] }) === false);

  // ---- scanRenderedLive: the REAL path through the launcher seam ----
  const empty = await scan({ emptyProbe: true });
  check('empty render: objective lens is unavailable', empty.objective.available === false);
  check('empty render: subjective lens is unavailable', empty.subjective.available === false);
  check('empty render: the reason names the empty document', reasonOf(empty.objective).includes('rendered document is empty'));
  check('empty render reason constant is the one used', reasonOf(empty.subjective) === EMPTY_RENDER_REASON);

  const real = await scan({ emptyProbe: false });
  check('non-empty render with no findings: objective stays available', real.objective.available === true);
  check('non-empty render with no findings: subjective stays available', real.subjective.available === true);
  check('non-empty render reports zero findings (still clean-able)', findingsOf(real.objective).length === 0 && findingsOf(real.subjective).length === 0);

  // F13: a probe that cannot be evaluated must fail closed, not fall through to clean.
  const unprobeable = await scan({ emptyProbe: () => { throw new Error('evaluate blew up'); } });
  check('probe failure: objective lens is unavailable', unprobeable.objective.available === false);
  check('probe failure: subjective lens is unavailable', unprobeable.subjective.available === false);
  check('probe failure carries its own distinct reason', reasonOf(unprobeable.objective) === UNPROBEABLE_RENDER_REASON);

  // F8 ORDERING: findings win over the guard. A body-level radial glow is a real structural finding on a page
  // with no text and no media - the guard must NOT demote it, because the detectors already spoke.
  const glow = await scan({
    emptyProbe: true,
    structural: { viewportWidth: 1280, viewportHeight: 800, thinBorderWideShadowCount: 0, tbwsMaxRatio: 0, stripeGradientCount: 0, textUnderOverlayCount: 0, firstViewportOverflowPx: 0, dotGridCount: 0, radialGlowCount: 1, glowSelector: 'body', imageHoverTransformCount: 0 },
  });
  check('a real finding is NOT suppressed by the guard', glow.subjective.available === true);
  check('the suppressed-case finding actually surfaces', findingsOf(glow.subjective).some((f) => f.rule === 'soft-radial-glow'));

  // Same ordering property on the objective side.
  const objFinding = await scan({ emptyProbe: true, objective: [{ rule: 'low-contrast', severity: 'error', selector: 'p', detail: '1.0:1' }] });
  check('an objective finding is NOT suppressed by the guard', objFinding.objective.available === true);
  check('the objective finding surfaces', findingsOf(objFinding.objective).length === 1);

  // ---- end-to-end: unavailable lenses -> inconclusive, never clean ----
  const res = await runRenderedAudit('http://127.0.0.1/shell', { scan: async () => empty, committedFamilies: [] });
  check('an empty render is NEVER clean', res.verdict !== 'clean');
  check('an empty render is inconclusive', res.verdict === 'inconclusive');
  check('the reason reaches the caller', res.unavailableReasons.some((r) => r.includes('rendered document is empty')));

  const ok = await runRenderedAudit('http://127.0.0.1/real', { scan: async () => real, committedFamilies: [] });
  check('a real page with no findings is still clean (guard is not over-broad)', ok.verdict === 'clean');

  console.log(`empty-render-guard: OK (${passed} asserted)`);
}

run().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
