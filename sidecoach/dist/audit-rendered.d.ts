import type { RenderedScanCollection } from './validators/rendered-live-scan';
export type RenderedAuditVerdict = 'clean' | 'warnings-only' | 'blocked' | 'inconclusive';
export interface RenderedAuditFinding {
    rule: string;
    severity: 'blocking' | 'warning';
    lens: 'objective' | 'subjective';
    selector?: string;
    detail?: string;
}
export interface RenderedAuditLens {
    available: boolean;
    findings: number;
    reason?: string;
}
export interface RenderedAuditResult {
    renderUrl: string;
    rendered: boolean;
    verdict: RenderedAuditVerdict;
    findings: RenderedAuditFinding[];
    severityCounts: {
        blocking: number;
        warning: number;
        info: number;
    };
    unavailableReasons: string[];
    lenses: {
        objective: RenderedAuditLens;
        subjective: RenderedAuditLens;
    };
}
export declare function looksLikeUrl(target: string | undefined | null): boolean;
export declare function normalizeRenderUrl(target: string): string;
/**
 * Render `target` and run both detection lenses. Pure except for the injected scan
 * (defaults to the real live scanner); deterministic to test via the `scan` seam.
 */
export declare function runRenderedAudit(target: string, deps?: {
    scan?: (renderUrl: string | undefined) => Promise<RenderedScanCollection>;
}): Promise<RenderedAuditResult>;
//# sourceMappingURL=audit-rendered.d.ts.map