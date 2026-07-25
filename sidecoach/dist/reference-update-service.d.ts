export declare const REFERENCE_SYSTEMS: readonly ["component-gallery", "design-references", "fontshare", "icon-source", "motion-reference"];
export type ReferenceSystemName = (typeof REFERENCE_SYSTEMS)[number];
export type CheckStatus = 'current' | 'stale' | 'not-installed' | 'error';
export type ApplyStatus = 'installed' | 'refreshed' | 'unchanged' | 'failed';
export type ErrorClass = 'upstream' | 'validation' | 'io';
export interface CheckResult {
    system: ReferenceSystemName;
    status: CheckStatus;
    localVersion: string | null;
    upstreamVersion: string | null;
    reason: string;
    userCaptures: number;
}
export interface ApplyResult {
    system: ReferenceSystemName;
    status: ApplyStatus;
    previousVersion: string | null;
    newVersion: string | null;
    mergedUserCaptures: number;
    bytesWritten: number;
    error?: string;
    errorClass?: ErrorClass;
}
export interface DesignMdUpdate {
    updated: boolean;
    path: string;
    reason: string;
    failed: boolean;
}
export interface UpdateServiceOptions {
    upstreamDir?: string;
    localDir?: string;
    capturesDir?: string;
    designMdPath?: string;
}
export interface CapturedReference {
    id: string;
    title: string;
    category: string;
    patterns: string[];
    feel: string[];
    source: string;
    url: string;
    saved: string;
    description: string;
}
export declare class ReferenceUpdateService {
    private upstreamDir;
    private localDir;
    private capturesDir;
    private designMdPath;
    constructor(options?: UpdateServiceOptions);
    getPaths(): {
        upstreamDir: string;
        localDir: string;
        capturesDir: string;
        designMdPath: string;
    };
    check(): CheckResult[];
    private checkSystem;
    apply(opts?: {
        systems?: ReferenceSystemName[];
        onlyStale?: boolean;
        stampDesignMd?: boolean;
    }): {
        results: ApplyResult[];
        designMd: DesignMdUpdate;
    };
    private applySystem;
    private failure;
    private updateDesignMd;
    private installedVersions;
    private scanCaptures;
    private captureCountFor;
    private upstreamPath;
    private localPath;
    private readBundle;
    private safeVersion;
    private ensureLocalDir;
}
export declare function mergeBundle(system: ReferenceSystemName, upstream: any, existingLocal: any, catalog: Record<string, CapturedReference>): {
    merged: any;
    mergedCount: number;
};
export declare function validateBundle(data: any, system: ReferenceSystemName): boolean;
//# sourceMappingURL=reference-update-service.d.ts.map