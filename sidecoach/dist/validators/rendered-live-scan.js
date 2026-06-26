"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scanRenderedLive = scanRenderedLive;
/**
 * LIVE rendered scan bridge (Sidecoach Stage 1 - Option B convergence).
 *
 * The eval-facing scanners (objective-rendered-scanner.ts / subjective-rendered-scanner.ts) render an HTML
 * STRING via page.setContent - the hermetic basis that renders IDENTICALLY to the eval ground-truth referee, so
 * the head-to-head 0.894 proof stays valid. Eval imports those functions directly and MUST stay untouched.
 *
 * This module is the LIVE counterpart: it renders a real renderUrl via page.goto (so same-origin app scripts run
 * and the detector reads the ACTUAL rendered DOM of a live app, not a static shell), then runs the SAME in-page
 * detector functions (inPageObjective + inPageSubjective). One browser, one page, both detector families - the
 * "ONE memoized scan per target" the converged engine needs. The page-load boundary differs (goto vs setContent);
 * the detection LOGIC is shared. This is the additive live caller that ships the oracle-beating detection to
 * the natural-language workflow (Codex review P0-1 / P0-4 / P1-2 / P1-3).
 *
 * HERMETICITY: same-origin-only subresources (reuse isSubresourceAllowed), all WebSockets blocked, reduced
 * motion, fixed 1280x800 viewport - deterministic, no cross-origin traffic. FAIL-CLOSED: a launch/navigation
 * error returns {available:false} for BOTH families (never a false "0 findings = clean"); a single detector
 * throwing marks only that family unavailable. ABORTABLE: honors an AbortSignal at every phase, mirroring
 * browser-evidence-collector.ts.
 *
 * INDEPENDENCE: this is PRODUCT code. It MUST NOT import anything under eval/. It imports the product scanners +
 * the product collector only; the eval referee shares no code with it. referee-independence.test guards the
 * objective-scanner graph; this new module is not in that graph (the scanner does not import it).
 */
const playwright_1 = require("playwright");
const objective_rendered_scanner_1 = require("./objective-rendered-scanner");
const subjective_rendered_scanner_1 = require("./subjective-rendered-scanner");
const browser_evidence_collector_1 = require("./browser-evidence-collector");
/** Default viewport - matches the scanners' hermetic 1280x800 so live + eval read the same layout basis. */
const VIEWPORT = { width: 1280, height: 800 };
class AbortError extends Error {
}
const reason = (e) => e instanceof Error ? e.message : String(e);
/**
 * Render `renderUrl` once and return both objective and subjective findings. FAIL-CLOSED + ABORTABLE.
 *
 * - No renderUrl                -> {objective:{available:false}, subjective:{available:false}} (the caller maps
 *                                  this to a coverage gap; the run-validator promotion gate decides whether it
 *                                  blocks, based on renderUrl-presence).
 * - launch / navigation failure -> both families {available:false, reason}.
 * - render succeeds             -> each family runs its detector; a detector that throws marks ONLY its family
 *                                  unavailable, so an objective failure never hides subjective findings.
 */
async function scanRenderedLive(renderUrl, signal, opts = {}) {
    if (!renderUrl) {
        const r = 'no render URL in validation context';
        return { objective: { available: false, reason: r }, subjective: { available: false, reason: r } };
    }
    if (signal?.aborted) {
        const r = 'rendered scan aborted before launch';
        return { objective: { available: false, reason: r }, subjective: { available: false, reason: r } };
    }
    const timeoutMs = opts.timeoutMs ?? 30000;
    const launch = opts.launcher ?? (() => playwright_1.chromium.launch({ headless: true }));
    let browser;
    let launchPromise;
    let phase = 'launch';
    let onAbort = () => undefined;
    const aborted = new Promise((_resolve, reject) => {
        onAbort = () => { void browser?.close().catch(() => undefined); reject(new AbortError(`rendered scan aborted during ${phase}`)); };
    });
    void aborted.catch(() => undefined); // a late rejection (post-return) must not go unhandled
    signal?.addEventListener('abort', onAbort, { once: true });
    const race = (p, ph) => { phase = ph; return signal ? Promise.race([p, aborted]) : p; };
    try {
        launchPromise = launch();
        browser = await race(launchPromise, 'launch');
        const context = await race(browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce', deviceScaleFactor: 1, serviceWorkers: 'block' }), 'launch');
        const page = await context.newPage();
        // Block every WebSocket (a non-same-origin channel under the hermeticity model) and every cross-origin
        // subresource before navigation, so the live render runs same-origin app scripts only.
        await page.routeWebSocket(() => true, (ws) => { ws.close(); });
        await page.route('**/*', async (route) => {
            if ((0, browser_evidence_collector_1.isSubresourceAllowed)(renderUrl, route.request().url()))
                await route.continue();
            else
                await route.abort('blockedbyclient');
        });
        await race(page.goto(renderUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs }), 'navigation');
        // Run each detector independently so one family's failure never suppresses the other's findings.
        let objective;
        try {
            objective = { available: true, findings: await race(page.evaluate(objective_rendered_scanner_1.inPageObjective), 'evaluate') };
        }
        catch (e) {
            if (e instanceof AbortError)
                throw e;
            objective = { available: false, reason: reason(e) };
        }
        let subjective;
        try {
            const findings = await race(page.evaluate(subjective_rendered_scanner_1.inPageSubjective), 'evaluate');
            // marketing-buzzword via the SINGLE-SOURCE score + Node-side threshold (same code path the eval scan + the
            // calibration harness use, so the live NL workflow surfaces exactly what ships).
            const buzz = (0, subjective_rendered_scanner_1.buzzwordFindingFromScore)(await race(page.evaluate(subjective_rendered_scanner_1.inPageBuzzword), 'evaluate'));
            if (buzz)
                findings.push(buzz);
            subjective = { available: true, findings };
        }
        catch (e) {
            if (e instanceof AbortError)
                throw e;
            subjective = { available: false, reason: reason(e) };
        }
        return { objective, subjective };
    }
    catch (e) {
        const r = reason(e);
        return { objective: { available: false, reason: r }, subjective: { available: false, reason: r } };
    }
    finally {
        signal?.removeEventListener('abort', onAbort);
        // If we bailed before `browser` was assigned (abort during launch), the launch may still be in flight -
        // fire-and-forget the close so the eventual browser is closed without blocking the prompt return (mirrors
        // browser-evidence-collector). An already-launched browser is closed synchronously.
        if (!browser && launchPromise) {
            void launchPromise.then((b) => b.close()).catch(() => undefined);
        }
        else {
            await browser?.close().catch(() => undefined);
        }
    }
}
//# sourceMappingURL=rendered-live-scan.js.map