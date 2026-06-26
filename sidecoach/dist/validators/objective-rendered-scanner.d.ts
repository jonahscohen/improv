/**
 * OWNED rendered OBJECTIVE scanner (Sidecoach Stage 1 - reimplement-and-own).
 *
 * Detects the spec-grounded OBJECTIVE a11y/quality classes by RENDERING the page and reading the real DOM +
 * computed styles - the classes a faithful implementation of the public spec must agree on:
 *   - broken-image        : <img> with no usable source / fails to render (renders as a broken box)
 *   - skipped-heading     : WCAG 1.3.1 - the heading outline skips a level (e.g. h1 then h3)
 *   - low-contrast        : WCAG 1.4.3 - text/background contrast below the AA ratio (CSS Color 4 compositing)
 *   - gray-on-color       : WCAG 1.4.3 - desaturated (gray) text on a chromatic background, AA-failing
 *   - justified-text      : WCAG 1.4.8 - justified body text (uneven spacing / rivers; AAA 1.4.8 disallows)
 *
 * AUTHORED FROM PUBLIC SPECS ONLY (WCAG 2.x SC 1.3.1 / 1.4.3 / 1.4.8 ; CSS Color Module Level 4 alpha
 * compositing ; WAI-ARIA heading roles). Copies NOTHING from oracle.
 *
 * INDEPENDENCE (eval integrity): this is the PRODUCT scanner. It is a DISTINCT artifact from the eval
 * ground-truth referee (eval/objective-label-rendered.mjs). It MUST NOT import anything under eval/. Both
 * draw on the same PUBLIC specs; neither shares code with the other. The committed test
 * src/__tests__/referee-independence.test.ts mechanically enforces zero eval/ imports in this module's graph.
 *
 * ENGINE: reuses the product's already-shipped Playwright dependency + the same render-determinism +
 * hermeticity posture as src/validators/browser-evidence-collector.ts (no new engine / dependency). Render is
 * deterministic + spec-faithful: page scripts stripped, external subresources blocked (inline content only),
 * fixed 1280x800 viewport, reduced motion - so objective defects reflect the authored HTML/CSS, reproducibly.
 *
 * STAGE 1 / S0 STATUS: render harness + types + independence boundary established; the per-class in-page
 * classification (S1-S4) is added incrementally. With no rules implemented yet, scanObjectiveRendered renders
 * and returns []. Each subsequent step fills one class and turns its calibration fixtures green.
 */
import { chromium } from 'playwright';
export type ObjectiveRule = 'broken-image' | 'skipped-heading' | 'low-contrast' | 'gray-on-color' | 'justified-text';
export interface ObjectiveFinding {
    rule: ObjectiveRule;
    severity: 'error' | 'warning';
    selector?: string;
    detail?: string;
}
export type ObjectiveScan = {
    available: true;
    findings: ObjectiveFinding[];
} | {
    available: false;
    reason: string;
};
export declare const OBJECTIVE_RULES: ObjectiveRule[];
export declare function stripScripts(html: string): string;
/**
 * The in-page objective analysis. Runs INSIDE the rendered page (serialized to the browser by page.evaluate),
 * so it must be fully self-contained (no outer-scope references). S0: scaffold returning []. S1-S4 add each
 * class's spec-faithful detection here.
 */
export declare function inPageObjective(): ObjectiveFinding[];
export interface ScanOptions {
    timeoutMs?: number;
    /** TEST-ONLY seam: inject a browser launcher (deterministic tests without a real Chromium / browser reuse). */
    launcher?: () => Promise<Awaited<ReturnType<typeof chromium.launch>>>;
}
type Browser = Awaited<ReturnType<typeof chromium.launch>>;
/**
 * Render one HTML string in a fresh hermetic context of an already-launched browser and return the objective
 * findings. Shared by the single-shot scanner and the batch path (calibration / scorecard) so they render
 * IDENTICALLY. Throws on render error (caller decides fail-closed).
 */
export interface RenderOpts {
    stripScripts?: boolean;
    abortExternal?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
}
export declare function analyzeHtmlOnBrowser(browser: Browser, html: string, timeoutMs?: number, render?: RenderOpts): Promise<ObjectiveFinding[]>;
/**
 * Render an HTML string deterministically and return the objective findings. FAIL-CLOSED: a launch/render
 * error or timeout returns { available:false } - never a false "0 findings = clean" result.
 */
export declare function scanObjectiveRendered(html: string, opts?: ScanOptions): Promise<ObjectiveScan>;
export {};
//# sourceMappingURL=objective-rendered-scanner.d.ts.map