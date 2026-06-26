import type { Browser } from 'playwright';
import type { ObjectiveScan } from './objective-rendered-scanner';
import type { SubjectiveScan } from './subjective-rendered-scanner';
/** Both detector families from ONE rendered pass of a live renderUrl. Each family is independently fail-closed. */
export interface RenderedScanCollection {
    objective: ObjectiveScan;
    subjective: SubjectiveScan;
}
export interface LiveScanOptions {
    timeoutMs?: number;
    /** TEST-ONLY seam: inject a browser launcher for deterministic tests without a real Chromium. */
    launcher?: () => Promise<Browser>;
}
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