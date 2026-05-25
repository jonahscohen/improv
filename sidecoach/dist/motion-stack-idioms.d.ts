import { TechStack } from './project-context';
export interface MotionIdiom {
    framework: TechStack['framework'];
    loadingPattern: string;
    cleanupPattern: string;
    scopeBoundary: string;
    exampleSnippet: string;
    notes: string[];
}
/**
 * Look up the motion idiom for a given framework.
 *
 * The Record type guarantees every TechStack['framework'] value has a record,
 * so the `??` fallback is defensive against runtime `as any` paths where a
 * caller might pass a stale or malformed framework string. For known framework
 * values the IDIOMS lookup always succeeds; for unknown/malformed values the
 * vanilla idiom is the safe default.
 */
export declare function getMotionIdiom(framework: TechStack['framework']): MotionIdiom;
//# sourceMappingURL=motion-stack-idioms.d.ts.map