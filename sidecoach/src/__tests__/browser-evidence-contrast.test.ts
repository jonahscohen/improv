// P1-1: the collector must NEVER emit a trusted contrast verdict it could not
// faithfully measure. If zero visible text was measured, OR any unsupported
// background (image/gradient) or unparseable computed color was encountered, the
// collector must DROP 'contrast' from the trusted evidence kinds so a11y.color-contrast
// stays INCONCLUSIVE (never a false blocker PASS).
import { collectBrowserEvidence } from '../validators/browser-evidence-collector';
import { A11Y_CHECKS } from '../validators/checks/a11y-checks';
import type { ProductCheckContext } from '../validators/check-context';

const dataUrl = (html: string) => `data:text/html,${encodeURIComponent(html)}`;

// (a) no visible text at all -> nothing to measure.
const noText = `<!doctype html><main><div style="width:40px;height:40px;background:#ffffff"></div></main>`;
// (b) text over a gradient background -> background not faithfully determinable.
const gradientBg = `<!doctype html><body style="background:linear-gradient(#000000,#ffffff)"><main><p style="color:#111111;line-height:20px">Over a gradient</p></main></body>`;
// (c) wide-gamut color() the rgb parser cannot read -> unparseable foreground.
const unparseable = `<!doctype html><body style="background:#ffffff"><main><p style="color:color(display-p3 1 0.4 0);line-height:20px">Wide gamut</p></main></body>`;

async function unmeasurable(label: string, html: string): Promise<'skip' | 'ok'> {
  const r = await collectBrowserEvidence(dataUrl(html));
  if (!r.available) { console.log(`browser-evidence-contrast: SKIP (${r.reason})`); return 'skip'; }
  const e = r.evidence;
  if (e.browserEvidence.kinds.includes('contrast')) throw new Error(`${label}: 'contrast' must NOT be a trusted kind when unmeasurable`);
  const ctx: ProductCheckContext = { cssText: '', markup: '', files: [], renderUrl: dataUrl(html), ...e };
  const status = A11Y_CHECKS['a11y/color-contrast'](ctx).status;
  if (status !== 'inconclusive') throw new Error(`${label}: color-contrast must be inconclusive, got ${status}`);
  // The collector still completes; only contrast is withheld.
  if (!e.browserEvidence.kinds.includes('computed-style') || !e.browserEvidence.kinds.includes('dom')) {
    throw new Error(`${label}: computed-style and dom evidence must still be collected`);
  }
  return 'ok';
}

async function run() {
  for (const [label, html] of [['no-text', noText], ['gradient', gradientBg], ['unparseable', unparseable]] as const) {
    if ((await unmeasurable(label, html)) === 'skip') return;
  }

  // Faithfully-measurable page: contrast IS trusted and reaches a real verdict (a low
  // ratio fails, not inconclusive) - proving the gate did not over-withhold.
  const lowContrast = `<!doctype html><body style="background:#ffffff"><main><p style="color:#aaaaaa;line-height:20px">Low contrast</p></main></body>`;
  const r = await collectBrowserEvidence(dataUrl(lowContrast));
  if (r.available) {
    const e = r.evidence;
    if (!e.browserEvidence.kinds.includes('contrast')) throw new Error('a fully-measurable page must include trusted contrast');
    const ctx: ProductCheckContext = { cssText: '', markup: '', files: [], renderUrl: dataUrl(lowContrast), ...e };
    if (A11Y_CHECKS['a11y/color-contrast'](ctx).status !== 'fail') throw new Error('low-contrast measurable text must FAIL, not inconclusive/pass');
  }
  console.log('browser-evidence-contrast: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
