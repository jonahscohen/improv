import { FlowId } from './types';
export interface Mode {
    /** Mode name as the user types it (lowercase, magic-keyword form). */
    name: string;
    /** Tagline describing the shape of work this mode covers. */
    description: string;
    /** One-sentence explanation that surfaces in cheatsheets and the marketing site. */
    oneLineExplanation: string;
    /**
     * Ordered verb chain. Each entry is a sidecoach verb (matching
     * VERB_REGISTRY in verb-command-registry.ts). The hook emits this chain so
     * the receiving session can sequence flows verb by verb if it wants
     * verb-shaped output; or it can use the FlowId chain below for direct
     * orchestrator dispatch.
     */
    verbChain: string[];
    /**
     * Resolved FlowId chain - the deduped union of each verb's flowIds in
     * execution order. Use this when calling the orchestrator directly.
     */
    chain: FlowId[];
}
/**
 * MODES registry. Lookups are by lowercase mode name.
 *
 * Order matters for the tie-break rule: if a prompt fires multiple modes
 * (rare but possible), the hook picks the first in declaration order. We
 * order by frequency of expected use: forge first (most common shape of
 * work in a fresh build), then kiln (ship-ready), then bloom (delight),
 * canvas (live), trim (simplify).
 */
export declare const MODES: Record<string, Mode>;
/** Convenience: ordered list of modes (matches MODES declaration order). */
export declare const MODE_LIST: Mode[];
/** Returns the mode for the given name (case-insensitive), or undefined. */
export declare function getMode(name: string): Mode | undefined;
/** Returns the FlowId chain for a mode name, or undefined if unknown. */
export declare function getModeChain(name: string): FlowId[] | undefined;
/** Returns the verb chain for a mode name, or undefined if unknown. */
export declare function getModeVerbChain(name: string): string[] | undefined;
//# sourceMappingURL=modes.d.ts.map