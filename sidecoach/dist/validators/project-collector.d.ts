import type { CollectedFile, DiscoveredFile } from './check-context';
export declare class CollectionAbortedError extends Error {
    constructor();
}
export interface Collected {
    discovered: DiscoveredFile[];
    files: CollectedFile[];
    inspectedFiles: string[];
    skippedFiles: string[];
    unreadableFiles: string[];
    unsupportedFiles: string[];
    cssText: string;
    markup: string;
}
export declare function collectFromPath(projectPath: string, signal?: AbortSignal): Promise<Collected>;
export declare function collect(context: unknown, signal?: AbortSignal): Promise<Collected>;
//# sourceMappingURL=project-collector.d.ts.map