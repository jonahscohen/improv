import { FlowId } from './types';
export type TierName = 'haiku' | 'sonnet' | 'opus';
export interface ModelTier {
    name: TierName;
    /**
     * Exact Anthropic model ID. CLAUDE.md mandates the latest Claude IDs only;
     * legacy 4.x IDs are blocked by content-guard.sh and bash-guard.sh, so the
     * source of truth here is the most-recent bleeding-edge release.
     */
    exactModel: string;
    /** USD per million input tokens (current published pricing). */
    costPerMillionInput: number;
    /** USD per million output tokens (current published pricing). */
    costPerMillionOutput: number;
}
/**
 * The three Claude tiers sidecoach routes to. Pricing reflects current
 * published rates (2026-05); update both numbers if Anthropic shifts.
 */
export declare const TIERS: Record<TierName, ModelTier>;
export interface FlowModelConfig {
    /** Minimum acceptable tier. Used when budget pressure forces a downgrade. */
    minTier: TierName;
    /** Preferred tier when no budget constraint applies. */
    preferredTier: TierName;
    /** One-line rationale for the tier choice (for audit + summary output). */
    rationale: string;
}
/**
 * Capability matrix: one entry per sidecoach FlowId.
 *
 * Tier assignment rationale:
 * - **Haiku** for lightweight classification, validation, formatting, and
 *   checklist-driven flows where no synthesis is required.
 * - **Sonnet** as the workhorse default - research, composition, audit,
 *   most implementation flows.
 * - **Opus** for heavy reasoning - craft (component design from scratch),
 *   layout/motion integration, complex critique, cross-flow synthesis.
 *
 * minTier vs preferredTier: most flows tolerate a one-step downgrade under
 * budget pressure (Opus -> Sonnet, Sonnet -> Haiku). A few flows have minTier
 * equal to preferredTier because they genuinely can't run lower without
 * losing essential capability (motion-integration, design-critique).
 */
export declare const FLOW_MODELS: Record<FlowId, FlowModelConfig>;
/**
 * Caller-supplied budget hint. Pick the highest tier the caller is willing to
 * pay for; selectModel will downgrade if the flow's preferred exceeds the cap.
 *
 * Example: a CI batch job sets `maxTier: 'sonnet'` to forbid Opus calls
 * regardless of which flow runs. A craft session sets no cap and gets Opus
 * for flows that want it.
 */
export interface ModelBudget {
    maxTier?: TierName;
}
/**
 * Pick the model for a flow. Preference order:
 *   1. preferredTier if no budget or budget allows it
 *   2. budget.maxTier if it's at or above the flow's minTier
 *   3. minTier as the floor (we never go below what the flow declared safe)
 */
export declare function selectModel(flowId: FlowId, budget?: ModelBudget): ModelTier;
export interface CostEntry {
    /** Wall-clock timestamp (ms since epoch). */
    timestamp: number;
    flowId: FlowId;
    /** Exact model ID used (e.g. 'claude-sonnet-4-6'). */
    model: string;
    tier: TierName;
    inputTokens: number;
    outputTokens: number;
    /** USD cost computed from tier pricing * token counts. */
    estimatedCost: number;
}
/**
 * Append a cost entry for a single LLM invocation. The flow handler should
 * call this AFTER the LLM returns, with the actual token counts from the
 * API response. Computes estimated cost from the tier's pricing.
 *
 * If the model string doesn't match a known tier's exactModel, the entry is
 * still recorded but with cost=0 (caller passed an unknown model - we don't
 * silently invent pricing).
 */
export declare function trackCost(flowId: FlowId, model: string, inputTokens: number, outputTokens: number): void;
/** Get a snapshot of the current session ledger. Returns a defensive copy. */
export declare function getSessionLedger(): CostEntry[];
/** Clear the ledger. Tests call this between cases; sessions call this on start. */
export declare function resetLedger(): void;
/**
 * Format a human-readable summary of a cost ledger. Groups by flow and by
 * model, totals tokens and cost. Output is multi-line plain text suitable
 * for end-of-session logs.
 */
export declare function summarizeLedger(ledger: CostEntry[]): string;
/**
 * One-shot helper for flow handlers: pick the model for this flow, stash it
 * into context.metadata.selectedModel so downstream LLM-call code can find it,
 * and return the tier for direct use.
 *
 * Handlers call this once at the top of execute(), BEFORE any LLM call. For
 * handlers that also have T-0009 retry-control halt checks (polish, audit,
 * critique), this call sits ABOVE the halt check so even halt-early paths
 * leave a model-selection record.
 */
export declare function applyModelSelection(flowId: FlowId, context: {
    metadata?: Record<string, any>;
}): ModelTier;
//# sourceMappingURL=model-routing.d.ts.map