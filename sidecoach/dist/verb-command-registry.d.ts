/**
 * Verb Command Registry
 *
 * Maps verb commands (craft, polish, audit, ...) onto sidecoach
 * flow chains. Each entry carries:
 *  - flowIds: sidecoach FlowIds the verb orchestrates (in execution order)
 *  - guidanceAppend: extra guidance lines the orchestrator appends after the
 *      flow chain finishes (these turn raw flow output into a verb-shaped
 *      response that matches the verb voice)
 *  - parityChecklist: real substrings from canonical reference files
 *      that MUST appear in the final output so the parity test passes
 *  - parityPlus: substrings that prove sidecoach added something beyond
 *      legacy skill (validators, BuildReport, taste rules, memory entry, etc.)
 *
 * Sprint 8 T1 ships the registry skeleton + 5 prototype entries (craft,
 * polish, audit, critique, document). T5 fills in the remaining 17 verbs.
 *
 * SKILL_REF resolves to sidecoach's reference directory.
 * Each entry's skillRefPath points at the canonical reference file
 * those strings were derived from, so a future drift-audit can diff entries
 * against the current canonical reference.
 */
import type { FlowId } from './types';
export interface VerbCommandEntry {
    command: string;
    description: string;
    skillRefPath: string;
    phase: 'shape' | 'craft' | 'review' | 'tone' | 'docs' | 'tactical';
    flowIds: FlowId[];
    guidanceAppend: string[];
    parityChecklist: string[];
    parityPlus: string[];
}
export declare const VERB_REGISTRY: Record<string, VerbCommandEntry>;
export declare function getVerbList(): string[];
export declare function getVerbEntry(command: string): VerbCommandEntry | undefined;
//# sourceMappingURL=verb-command-registry.d.ts.map