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
/**
 * Collect a SINGLE file as a one-file project - the `detect` CLI's file-target mode.
 *
 * Uses the SAME source-kind matrix and the SAME read/extract step (readCollectedFile) as
 * the directory walk, so the EVIDENCE is identical to what collectFromPath produces for
 * that file. The reported `path` is the file's basename, which is exactly what
 * collectFromPath(dirname(file)) yields for it - the file's own directory is the implied
 * project root. Scanning a HIGHER directory reports a longer relative path for the same
 * file; that is a difference in root, not in evidence.
 *
 * An unsupported or unreadable file yields ZERO collected files with the gap recorded in
 * `discovered` - the caller reports that as a coverage gap, never as an
 * empty-and-therefore-clean scan.
 */
export declare function collectFromSingleFile(filePath: string): Collected;
export declare function collect(context: unknown, signal?: AbortSignal): Promise<Collected>;
//# sourceMappingURL=project-collector.d.ts.map