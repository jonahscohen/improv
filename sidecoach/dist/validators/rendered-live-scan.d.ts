import type { Browser } from 'playwright';
import type { ObjectiveScan } from './objective-rendered-scanner';
import type { SubjectiveScan, TypefaceFindingOptions } from './subjective-rendered-scanner';
/** Both detector families from ONE rendered pass of a live renderUrl. Each family is independently fail-closed. */
export interface RenderedScanCollection {
    objective: ObjectiveScan;
    subjective: SubjectiveScan;
}
export interface LiveScanOptions {
    timeoutMs?: number;
    /** TEST-ONLY seam: inject a browser launcher for deterministic tests without a real Chromium. */
    launcher?: () => Promise<Browser>;
    /** default-typeface brand-mismatch input (Stage 4a). Ground (B) of the class is INERT unless a committed
     *  family is supplied; nothing on the live path reads PRODUCT.md yet, so the live scan runs ground (A)
     *  (default stack) only. The option exists so a later PRODUCT.md/DESIGN.md wiring has a seam to fill. */
    typeface?: TypefaceFindingOptions;
}
/**
 * EMPTY-RENDER GUARD (fail-closed). Runs in the browser context; must be self-contained.
 *
 * Returns true when the rendered document carries NOTHING this engine's lenses could judge. A JS-mounted
 * app whose shell is `<div id="root">` renders exactly this when its bundle is cross-origin (blocked by
 * our same-origin subresource policy) or has not mounted, and every detector then goes quiet through its
 * own content floor (TYPO/TYPEFACE_MIN_CONTENT_CHARS = 200, SUB11_MIN_CHARS = 150). Those floors are
 * correct in isolation, but their silence was being reported upward as "clean" - the exact false pass the
 * lens-availability discipline exists to prevent.
 *
 * ZERO-THRESHOLD, deliberately: the test is "did the render produce anything judgeable at all", not "is
 * there enough content", so it cannot demote a legitimately small page (a sign-in form, a 404). This is
 * only ever consulted when BOTH detector families already returned zero findings, so it can never
 * suppress a real finding - see the call site.
 *
 * VISIBLE text only (Codex review F12): `innerText` is the rendered-text projection; `textContent` is
 * consulted ONLY when innerText is unavailable (a non-rendering context), because textContent counts
 * hidden nodes, <template> bodies and no-JS fallbacks that no lens can see.
 *
 * JUDGEABLE visuals only (Codex review F11): geometry-bearing img/svg/canvas/video. A zero-size or
 * display:none image is not rendered content. `iframe`/`object`/`embed` are deliberately EXCLUDED - our
 * lenses read the top document only and never look inside them, so their presence is not evidence that
 * anything here can be judged. `picture` is a wrapper; its <img> is what paints.
 */
export declare function inPageRenderIsEmpty(): boolean;
/** Reason string surfaced on both lenses when the guard trips. Named so tests and callers can assert it. */
export declare const EMPTY_RENDER_REASON = "rendered document is empty (no visible text and no rendered image/svg/canvas/video) - the page navigated but produced nothing this engine can judge, so no lens can certify it clean";
/** Reason used when the judgeability probe itself could not be evaluated AND no detector found anything.
 *  Failing closed here is the point (Codex review F13): an unreadable probe means judgeability was never
 *  established, and "we could not tell" must never be reported as clean. */
export declare const UNPROBEABLE_RENDER_REASON = "could not establish whether the rendered document contains anything judgeable (probe failed) and no lens reported a finding - not certifiable as clean";
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
export declare function scanRenderedLive(renderUrl: string | undefined, signal?: AbortSignal, opts?: LiveScanOptions): Promise<RenderedScanCollection>;
//# sourceMappingURL=rendered-live-scan.d.ts.map