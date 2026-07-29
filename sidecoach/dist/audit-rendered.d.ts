import type { RenderedScanCollection, LiveScanOptions } from './validators/rendered-live-scan';
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
export { looksLikeUrl, normalizeRenderUrl } from './render-target';
/** Entry documents probed, in order, when the target is a directory. */
export declare const DIRECTORY_ENTRY_DOCUMENTS: readonly ["index.html", "index.htm"];
export type RenderableTargetKind = 'url' | 'file' | 'directory';
export type UnrenderableTargetKind = 'missing' | 'unsupported-file' | 'no-entry-document';
export interface RenderableAuditTarget {
    renderable: true;
    kind: RenderableTargetKind;
    renderUrl: string;
    /** absolute path of the document actually rendered (file/directory targets only) */
    resolvedPath?: string;
}
export interface UnrenderableAuditTarget {
    renderable: false;
    kind: UnrenderableTargetKind;
    target: string;
    /** user-facing: WHY nothing could be scanned */
    reason: string;
    /** user-facing: what to do instead */
    remedy: string;
}
export type AuditTargetResolution = RenderableAuditTarget | UnrenderableAuditTarget;
/**
 * Resolve an audit target to the URL that should be rendered.
 * Pure except for the `fs` probes, which are injectable for tests.
 */
export declare function resolveAuditTarget(target: string | undefined | null, opts?: {
    cwd?: string;
    statSync?: (p: string) => {
        isDirectory(): boolean;
        isFile(): boolean;
    };
    pathToFileUrl?: (p: string) => string;
}): AuditTargetResolution;
/**
 * Render `target` and run both detection lenses. Pure except for the injected scan
 * (defaults to the real live scanner); deterministic to test via the `scan` seam.
 */
export declare function runRenderedAudit(target: string, deps?: {
    scan?: (renderUrl: string | undefined, signal?: AbortSignal, opts?: LiveScanOptions) => Promise<RenderedScanCollection>;
    projectPath?: string;
    committedFamilies?: string[];
}): Promise<RenderedAuditResult>;
//# sourceMappingURL=audit-rendered.d.ts.map