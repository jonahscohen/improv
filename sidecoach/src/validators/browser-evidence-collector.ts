import { chromium } from 'playwright';
import type { EvidenceKind } from '../product-rule-types';
import type { BrowserDomEvidence, BrowserEvidenceMeta } from './check-context';

export interface CollectedBrowserEvidence {
  browserEvidence: BrowserEvidenceMeta;
  computedStyle: Record<string, string>;
  dom: BrowserDomEvidence;
  contrast: { wcagAA: boolean; ratio: number };
}

export type BrowserEvidenceCollection =
  | { available: true; evidence: CollectedBrowserEvidence }
  | { available: false; reason: string };

export function renderUrlFromContext(raw: unknown): string | undefined {
  const r = raw as { renderUrl?: unknown; target?: unknown };
  const candidate = typeof r?.renderUrl === 'string' ? r.renderUrl : typeof r?.target === 'string' ? r.target : undefined;
  if (!candidate) return undefined;
  try {
    const u = new URL(candidate);
    return ['http:', 'https:', 'file:', 'data:'].includes(u.protocol) ? u.href : undefined;
  } catch {
    return undefined;
  }
}

// Pure hermeticity policy for a subresource request given the supplied document URL.
// Inline data: subresources are always allowed; otherwise a data:/file: document may
// only load same-protocol resources, and an http(s) document may only load same-ORIGIN
// resources. Cross-origin HTTP and ALL ws/wss (whose origin can never match a
// data:/file:/http document origin) are blocked. Unparseable URLs are blocked.
export function isSubresourceAllowed(suppliedUrl: string, requestedUrl: string): boolean {
  let supplied: URL;
  let requested: URL;
  try { supplied = new URL(suppliedUrl); } catch { return false; }
  try { requested = new URL(requestedUrl); } catch { return false; }
  if (requested.protocol === 'data:') return true;
  if (supplied.protocol === 'data:' || supplied.protocol === 'file:') {
    return requested.protocol === supplied.protocol;
  }
  return requested.origin === supplied.origin;
}

const errorMessage = (e: unknown): string => e instanceof Error ? e.message : String(e);

class AbortError extends Error {}

export async function collectBrowserEvidence(renderUrl: string | undefined, signal?: AbortSignal): Promise<BrowserEvidenceCollection> {
  if (!renderUrl) return { available: false, reason: 'no render URL in validation context' };
  if (signal?.aborted) return { available: false, reason: 'browser evidence collection aborted before launch' };

  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  let launch: ReturnType<typeof chromium.launch> | undefined;
  // The signal must be honored AT every phase, not only between phases: an abort during
  // launch/navigation/collection rejects the in-flight phase immediately (no hang) and
  // the listener closes whatever browser exists. `phase` is read at abort time so the
  // reason names the phase that was in progress.
  let phase = 'launch';
  let onAbort: () => void = () => undefined;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => { void browser?.close().catch(() => undefined); reject(new AbortError(`browser evidence collection aborted during ${phase}`)); };
  });
  void aborted.catch(() => undefined);   // a late rejection (post-return) must not go unhandled
  signal?.addEventListener('abort', onAbort, { once: true });
  const race = <T>(p: Promise<T>, ph: string): Promise<T> => { phase = ph; return signal ? Promise.race([p, aborted]) : p; };

  try {
    launch = chromium.launch({ headless: true });
    browser = await race(launch, 'launch');
    // serviceWorkers: 'block' stops a reviewed page from registering a SW that could
    // initiate its own (cross-origin) traffic outside the request-route interception.
    const context = await race(browser.newContext({ reducedMotion: 'reduce', serviceWorkers: 'block' }), 'launch');
    const page = await context.newPage();
    // Block EVERY WebSocket before navigation: the collector reads static layout and
    // never needs a live socket, and any ws/wss is a non-same-origin channel under the
    // hermeticity model. Closing the route prevents the connection from reaching a server.
    await page.routeWebSocket(() => true, (ws) => { ws.close(); });
    await page.route('**/*', async (route) => {
      if (isSubresourceAllowed(renderUrl, route.request().url())) await route.continue();
      else await route.abort('blockedbyclient');
    });
    await race(page.goto(renderUrl, { waitUntil: 'domcontentloaded', timeout: 10_000 }), 'navigation');

    const rawPromise = page.evaluate(() => {
      const visible = (el: Element): el is HTMLElement => {
        if (!(el instanceof HTMLElement)) return false;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
      };
      const px = (value: string): number => {
        const n = Number.parseFloat(value);
        return Number.isFinite(n) ? n : 0;
      };
      const radius = (s: CSSStyleDeclaration): number =>
        Math.max(px(s.borderTopLeftRadius), px(s.borderTopRightRadius), px(s.borderBottomLeftRadius), px(s.borderBottomRightRadius));
      const padding = (s: CSSStyleDeclaration): number =>
        Math.max(px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft));

      let concentricChecked = 0;
      let concentricFailing = 0;
      for (const parent of Array.from(document.querySelectorAll('body *')).filter(visible)) {
        const outer = radius(getComputedStyle(parent));
        const pad = padding(getComputedStyle(parent));
        if (outer <= 0 || pad <= 0) continue;
        // Inspect EVERY visible direct child, not just the first: a clean first child
        // must not hide a failing sibling pair.
        for (const child of Array.from(parent.children).filter(visible)) {
          const inner = radius(getComputedStyle(child));
          if (inner <= 0) continue;
          concentricChecked++;
          if (Math.abs(outer - (inner + pad)) > 1) concentricFailing++;
        }
      }

      const textElements = Array.from(document.querySelectorAll('body *')).filter((el): el is HTMLElement =>
        visible(el) && Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()));
      const invalidLineHeight = textElements.filter((el) => {
        const line = getComputedStyle(el).lineHeight;
        return line === 'normal' || !Number.isFinite(Number.parseFloat(line)) || Number.parseFloat(line) <= 0;
      }).length;

      const interactive = Array.from(document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="switch"], [role="checkbox"], [tabindex]')).filter(visible);
      let hitFailing = 0;
      let smallestWidth = Number.POSITIVE_INFINITY;
      let smallestHeight = Number.POSITIVE_INFINITY;
      for (const el of interactive) {
        const r = el.getBoundingClientRect();
        const min = el.tagName === 'BUTTON' ? 44 : 40;
        smallestWidth = Math.min(smallestWidth, r.width);
        smallestHeight = Math.min(smallestHeight, r.height);
        if (r.width < min || r.height < min) hitFailing++;
      }

      const parseColor = (rawColor: string): [number, number, number, number] | undefined => {
        const m = rawColor.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?\)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : undefined;
      };
      const blend = (fg: [number, number, number, number], bg: [number, number, number, number]): [number, number, number, number] => {
        const a = fg[3] + bg[3] * (1 - fg[3]);
        if (a === 0) return [255, 255, 255, 1];
        return [
          (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
          (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
          (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
          a,
        ];
      };
      // Walk the ancestor chain blending background COLORS over an opaque-white canvas
      // base. `unsupported` flips true if any ancestor paints a background IMAGE or
      // gradient (background-image !== 'none') OR carries a backgroundColor the rgb
      // parser cannot read - in either case the effective background behind the text is
      // not faithfully determinable, so contrast must not be reported as trusted.
      const backgroundFor = (el: HTMLElement): { color: [number, number, number, number]; unsupported: boolean } => {
        let bg: [number, number, number, number] = [255, 255, 255, 1];
        let unsupported = false;
        const chain: HTMLElement[] = [];
        for (let cur: HTMLElement | null = el; cur; cur = cur.parentElement) chain.unshift(cur);
        for (const cur of chain) {
          const cs = getComputedStyle(cur);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') unsupported = true;
          const rawBg = cs.backgroundColor;
          const parsed = parseColor(rawBg);
          if (parsed) bg = blend(parsed, bg);
          else if (rawBg && rawBg !== 'transparent' && rawBg !== 'rgba(0, 0, 0, 0)') unsupported = true;
        }
        return { color: bg, unsupported };
      };
      const linear = (n: number): number => {
        const c = n / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      const luminance = (c: [number, number, number, number]): number => 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2]);
      const ratio = (a: [number, number, number, number], b: [number, number, number, number]): number => {
        const l1 = luminance(a);
        const l2 = luminance(b);
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      };

      // Contrast is only TRUSTED when EVERY applicable visible text was faithfully
      // measured against a faithfully-determined background. Track applicable vs
      // measured and whether anything unsupported was encountered; never default a
      // "nothing measured" run to a passing ratio.
      let contrastApplicable = 0;
      let contrastMeasured = 0;
      let contrastUnsupported = false;
      let worstRatio = Number.POSITIVE_INFINITY;
      let allAA = true;
      for (const el of textElements) {
        contrastApplicable++;
        const style = getComputedStyle(el);
        const fgRaw = parseColor(style.color);
        const bg = backgroundFor(el);
        if (!fgRaw || bg.unsupported) { contrastUnsupported = true; continue; }
        const measured = ratio(blend(fgRaw, bg.color), bg.color);
        const size = px(style.fontSize);
        const weight = Number.parseInt(style.fontWeight, 10) || 400;
        const threshold = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
        contrastMeasured++;
        worstRatio = Math.min(worstRatio, measured);
        if (measured < threshold) allAA = false;
      }
      const contrastMeasurable = contrastApplicable > 0 && contrastMeasured === contrastApplicable && !contrastUnsupported;

      return {
        computedStyle: {
          'concentric.checkedPairs': String(concentricChecked),
          'concentric.failingPairs': String(concentricFailing),
          'typography.checkedElements': String(textElements.length),
          'typography.invalidLineHeightElements': String(invalidLineHeight),
        },
        dom: {
          minHitArea: {
            checked: interactive.length,
            failing: hitFailing,
            smallestWidth: Number.isFinite(smallestWidth) ? smallestWidth : 0,
            smallestHeight: Number.isFinite(smallestHeight) ? smallestHeight : 0,
          },
        },
        contrast: {
          wcagAA: contrastMeasurable ? allAA : false,
          ratio: Number.isFinite(worstRatio) ? worstRatio : 0,
          measurable: contrastMeasurable,
        },
      };
    });
    const raw = await race(rawPromise, 'collection');
    if (signal?.aborted) return { available: false, reason: 'browser evidence collection aborted during collection' };

    // 'contrast' is included ONLY when the page evaluation faithfully measured every
    // applicable text against a determinable background. computed-style and dom are
    // always collectable. This keeps a11y.color-contrast inconclusive (never a false
    // blocker pass) on any page the collector could not honestly measure.
    const kinds: EvidenceKind[] = ['computed-style', 'dom'];
    if (raw.contrast.measurable) kinds.push('contrast');

    return {
      available: true,
      evidence: {
        browserEvidence: { available: true, kinds, renderUrl },
        computedStyle: raw.computedStyle,
        dom: raw.dom,
        contrast: { wcagAA: raw.contrast.wcagAA, ratio: raw.contrast.ratio },
      },
    };
  } catch (e) {
    if (e instanceof AbortError) return { available: false, reason: e.message };
    return { available: false, reason: `browser evidence unavailable: ${errorMessage(e)}` };
  } finally {
    signal?.removeEventListener('abort', onAbort);
    // If we bailed before `browser` was assigned (abort during launch), the launch may
    // still be in flight - await it so its browser is closed and never leaks.
    if (!browser && launch) browser = await launch.catch(() => undefined);
    await browser?.close().catch(() => undefined);
  }
}
