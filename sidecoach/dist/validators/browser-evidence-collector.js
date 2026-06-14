"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderUrlFromContext = renderUrlFromContext;
exports.collectBrowserEvidence = collectBrowserEvidence;
const playwright_1 = require("playwright");
function renderUrlFromContext(raw) {
    const r = raw;
    const candidate = typeof r?.renderUrl === 'string' ? r.renderUrl : typeof r?.target === 'string' ? r.target : undefined;
    if (!candidate)
        return undefined;
    try {
        const u = new URL(candidate);
        return ['http:', 'https:', 'file:', 'data:'].includes(u.protocol) ? u.href : undefined;
    }
    catch {
        return undefined;
    }
}
const errorMessage = (e) => e instanceof Error ? e.message : String(e);
async function collectBrowserEvidence(renderUrl, signal) {
    if (!renderUrl)
        return { available: false, reason: 'no render URL in validation context' };
    if (signal?.aborted)
        return { available: false, reason: 'browser evidence collection aborted before launch' };
    let browser;
    try {
        browser = await playwright_1.chromium.launch({ headless: true });
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        const page = await context.newPage();
        const supplied = new URL(renderUrl);
        await page.route('**/*', async (route) => {
            const requested = new URL(route.request().url());
            const allowed = supplied.protocol === 'data:' || supplied.protocol === 'file:'
                ? requested.protocol === supplied.protocol || requested.protocol === 'data:'
                : requested.origin === supplied.origin || requested.protocol === 'data:';
            if (allowed)
                await route.continue();
            else
                await route.abort('blockedbyclient');
        });
        await page.goto(renderUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        if (signal?.aborted)
            return { available: false, reason: 'browser evidence collection aborted during navigation' };
        const raw = await page.evaluate(() => {
            const visible = (el) => {
                if (!(el instanceof HTMLElement))
                    return false;
                const s = getComputedStyle(el);
                const r = el.getBoundingClientRect();
                return s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0 && r.width > 0 && r.height > 0;
            };
            const px = (value) => {
                const n = Number.parseFloat(value);
                return Number.isFinite(n) ? n : 0;
            };
            const radius = (s) => Math.max(px(s.borderTopLeftRadius), px(s.borderTopRightRadius), px(s.borderBottomLeftRadius), px(s.borderBottomRightRadius));
            const padding = (s) => Math.max(px(s.paddingTop), px(s.paddingRight), px(s.paddingBottom), px(s.paddingLeft));
            let concentricChecked = 0;
            let concentricFailing = 0;
            for (const parent of Array.from(document.querySelectorAll('body *')).filter(visible)) {
                const child = Array.from(parent.children).find(visible);
                if (!child)
                    continue;
                const outer = radius(getComputedStyle(parent));
                const inner = radius(getComputedStyle(child));
                const pad = padding(getComputedStyle(parent));
                if (outer <= 0 || inner <= 0 || pad <= 0)
                    continue;
                concentricChecked++;
                if (Math.abs(outer - (inner + pad)) > 1)
                    concentricFailing++;
            }
            const textElements = Array.from(document.querySelectorAll('body *')).filter((el) => visible(el) && Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()));
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
                if (r.width < min || r.height < min)
                    hitFailing++;
            }
            const parseColor = (rawColor) => {
                const m = rawColor.match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[, /]+([\d.]+))?\)/);
                return m ? [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])] : undefined;
            };
            const blend = (fg, bg) => {
                const a = fg[3] + bg[3] * (1 - fg[3]);
                if (a === 0)
                    return [255, 255, 255, 1];
                return [
                    (fg[0] * fg[3] + bg[0] * bg[3] * (1 - fg[3])) / a,
                    (fg[1] * fg[3] + bg[1] * bg[3] * (1 - fg[3])) / a,
                    (fg[2] * fg[3] + bg[2] * bg[3] * (1 - fg[3])) / a,
                    a,
                ];
            };
            const backgroundFor = (el) => {
                let bg = [255, 255, 255, 1];
                const chain = [];
                for (let cur = el; cur; cur = cur.parentElement)
                    chain.unshift(cur);
                for (const cur of chain) {
                    const parsed = parseColor(getComputedStyle(cur).backgroundColor);
                    if (parsed)
                        bg = blend(parsed, bg);
                }
                return bg;
            };
            const linear = (n) => {
                const c = n / 255;
                return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
            };
            const luminance = (c) => 0.2126 * linear(c[0]) + 0.7152 * linear(c[1]) + 0.0722 * linear(c[2]);
            const ratio = (a, b) => {
                const l1 = luminance(a);
                const l2 = luminance(b);
                return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            };
            let worstRatio = Number.POSITIVE_INFINITY;
            let allAA = true;
            for (const el of textElements) {
                const style = getComputedStyle(el);
                const fgRaw = parseColor(style.color);
                if (!fgRaw)
                    continue;
                const measured = ratio(blend(fgRaw, backgroundFor(el)), backgroundFor(el));
                const size = px(style.fontSize);
                const weight = Number.parseInt(style.fontWeight, 10) || 400;
                const threshold = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
                worstRatio = Math.min(worstRatio, measured);
                if (measured < threshold)
                    allAA = false;
            }
            if (!Number.isFinite(worstRatio))
                worstRatio = 21;
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
                contrast: { wcagAA: allAA, ratio: worstRatio },
            };
        });
        return {
            available: true,
            evidence: {
                browserEvidence: { available: true, kinds: ['computed-style', 'dom', 'contrast'], renderUrl },
                computedStyle: raw.computedStyle,
                dom: raw.dom,
                contrast: raw.contrast,
            },
        };
    }
    catch (e) {
        return { available: false, reason: `browser evidence unavailable: ${errorMessage(e)}` };
    }
    finally {
        await browser?.close().catch(() => undefined);
    }
}
//# sourceMappingURL=browser-evidence-collector.js.map