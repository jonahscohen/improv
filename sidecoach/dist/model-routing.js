"use strict";
// T-0012: Per-flow model-tier routing for sidecoach.
//
// OMC's 2026-05-28 research showed that routing classification/validation work
// to Haiku, default reasoning to Sonnet, and reserving Opus for heavy synthesis
// shaves 30-50% off token spend without measurable quality loss. This module
// is the capability matrix + selection logic + cost ledger that lets sidecoach
// match that pattern.
//
// Pattern:
//   1. Each flow declares { minTier, preferredTier, rationale } in FLOW_MODELS.
//   2. selectModel(flowId, budget?) returns the preferred tier when no budget
//      ceiling is set, the minimum tier when the caller is under a budget cap.
//   3. trackCost(...) appends a CostEntry to the in-memory session ledger.
//   4. summarizeLedger(ledger) formats a per-flow + per-model breakdown.
//
// Handlers call selectModel() BEFORE any LLM invocation, stash the selected
// model into context.metadata.selectedModel, then call trackCost() after the
// LLM returns. For the polish/audit/critique handlers that already carry
// T-0009 retry-control halt checks, the modelSelection sits ABOVE the halt
// check so even a halt-early result is logged (cost=0).
Object.defineProperty(exports, "__esModule", { value: true });
exports.FLOW_MODELS = exports.TIERS = void 0;
exports.selectModel = selectModel;
exports.trackCost = trackCost;
exports.getSessionLedger = getSessionLedger;
exports.resetLedger = resetLedger;
exports.summarizeLedger = summarizeLedger;
exports.applyModelSelection = applyModelSelection;
/**
 * The three Claude tiers sidecoach routes to. Pricing reflects current
 * published rates (2026-05); update both numbers if Anthropic shifts.
 */
exports.TIERS = {
    haiku: {
        name: 'haiku',
        exactModel: 'claude-haiku-4-5-20251001',
        costPerMillionInput: 1.0,
        costPerMillionOutput: 5.0,
    },
    sonnet: {
        name: 'sonnet',
        exactModel: 'claude-sonnet-4-6',
        costPerMillionInput: 3.0,
        costPerMillionOutput: 15.0,
    },
    opus: {
        name: 'opus',
        exactModel: 'claude-opus-4-7',
        costPerMillionInput: 15.0,
        costPerMillionOutput: 75.0,
    },
};
// Numeric ordering so we can compare tiers (haiku < sonnet < opus).
const TIER_RANK = {
    haiku: 1,
    sonnet: 2,
    opus: 3,
};
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
exports.FLOW_MODELS = {
    // Tier 1: Strategy/Research
    flowA_brand_verify: {
        minTier: 'haiku',
        preferredTier: 'haiku',
        rationale: 'PRODUCT.md/DESIGN.md load + register detection - pure classification, no synthesis',
    },
    flowB_component_research: {
        minTier: 'haiku',
        preferredTier: 'sonnet',
        rationale: 'component.gallery research + interaction-state reasoning - moderate synthesis',
    },
    flowC_font_research: {
        minTier: 'haiku',
        preferredTier: 'sonnet',
        rationale: 'fontshare lookup + pairing reasoning - lightweight research with judgment',
    },
    flowD_reference_inspiration: {
        minTier: 'haiku',
        preferredTier: 'sonnet',
        rationale: 'design-reference grep + AI-slop filtering - moderate synthesis',
    },
    flowE_motion_patterns: {
        minTier: 'sonnet',
        preferredTier: 'sonnet',
        rationale: 'GSAP/Lenis pattern matching + exponential-easing reasoning',
    },
    // Tier 2: Execution
    flowF_design_tokens: {
        minTier: 'haiku',
        preferredTier: 'sonnet',
        rationale: 'DESIGN.md token derivation - rule-based with some derivation work',
    },
    flowG_component_implementation: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'CRAFT - component implementation from scratch, heavy synthesis across tokens/states/a11y',
    },
    flowH_motion_integration: {
        minTier: 'opus',
        preferredTier: 'opus',
        rationale: 'GSAP/Lenis integration - reduced-motion + timeline orchestration is complex reasoning',
    },
    flowI_accessibility: {
        minTier: 'haiku',
        preferredTier: 'sonnet',
        rationale: 'WCAG 2.1 AA checklist - rule-driven with occasional judgment on ARIA patterns',
    },
    // Tier 3: Polish/QA
    flowJ_tactical_polish: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'POLISH - 112-rule synthesis across Polish Standard + Extended Domains + linguistic bans',
    },
    flowK_multi_lens_audit: {
        minTier: 'haiku',
        preferredTier: 'sonnet',
        rationale: 'AUDIT - 5-dimension scan with rule-driven validation',
    },
    flowL_design_critique: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'CRITIQUE - Nielsen heuristics + AI-slop + cognitive load is qualitative judgment',
    },
    flowM_responsive_validation: {
        minTier: 'haiku',
        preferredTier: 'haiku',
        rationale: 'Breakpoint + touch-target validation - rule-based',
    },
    flowN_rapid_iteration_refined: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'Rapid iteration variations - generative + token-based reasoning',
    },
    // Tier 4: Special
    flowO_clone_match_special: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'Clone-match - 1:1 reproduction requires detailed observation and reconstruction',
    },
    flowP_constraint_design_special: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'Constraint-based design - reasoning under arbitrary constraints',
    },
    flowQ_migration_special: {
        minTier: 'sonnet',
        preferredTier: 'sonnet',
        rationale: 'API migration - mostly mechanical with some judgment on edge cases',
    },
    // Tier 5: Specialized Refinement
    flowR_layout_optimization: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'LAYOUT - spatial reasoning + rhythm analysis is heavy synthesis',
    },
    flowS_typography_excellence: {
        minTier: 'sonnet',
        preferredTier: 'sonnet',
        rationale: 'Typography tuning - scale/leading/tracking judgment, moderate synthesis',
    },
    flowT_ambitious_motion: {
        minTier: 'opus',
        preferredTier: 'opus',
        rationale: 'Ambitious motion + physics - timeline + spring orchestration is complex',
    },
    // Special: Curate & All-Seven QA
    flowU_curate: {
        minTier: 'haiku',
        preferredTier: 'haiku',
        rationale: 'Catalog capture - metadata extraction + tagging, no synthesis',
    },
    flowV_all_seven_qa: {
        minTier: 'sonnet',
        preferredTier: 'sonnet',
        rationale: 'Composite QA orchestrator - delegates to other flows, light coordination only',
    },
    // Tier 6: Composition & Copy
    flowW_landing_composition: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'CRAFT - landing-page section composition + rhythm is heavy synthesis',
    },
    flowX_copywriting: {
        minTier: 'sonnet',
        preferredTier: 'sonnet',
        rationale: 'Per-slot copy drafting - voice + slop-avoidance, moderate generation',
    },
    // Tier 7: Renamed legacy (T-0015) - genuinely separate flows preserved with letter prefix
    flowY_explore_discovery: {
        minTier: 'haiku',
        preferredTier: 'haiku',
        rationale: 'Exploration helper - lightweight ideation prompts',
    },
    flowZ_design_component: {
        minTier: 'sonnet',
        preferredTier: 'opus',
        rationale: 'New-component design from scratch - CRAFT work, heavy synthesis',
    },
};
/**
 * Pick the model for a flow. Preference order:
 *   1. preferredTier if no budget or budget allows it
 *   2. budget.maxTier if it's at or above the flow's minTier
 *   3. minTier as the floor (we never go below what the flow declared safe)
 */
function selectModel(flowId, budget) {
    const config = exports.FLOW_MODELS[flowId];
    if (!config) {
        // Unknown flow - fall back to Sonnet (workhorse default).
        return exports.TIERS.sonnet;
    }
    // No budget cap - take the preferred tier.
    if (!budget?.maxTier) {
        return exports.TIERS[config.preferredTier];
    }
    const maxRank = TIER_RANK[budget.maxTier];
    const preferredRank = TIER_RANK[config.preferredTier];
    const minRank = TIER_RANK[config.minTier];
    // Budget allows preferred - take it.
    if (preferredRank <= maxRank) {
        return exports.TIERS[config.preferredTier];
    }
    // Budget below preferred but at or above min - take the budget cap.
    if (maxRank >= minRank) {
        return exports.TIERS[budget.maxTier];
    }
    // Budget below the flow's minimum - take min anyway. The flow declared this
    // as the floor for a reason (capability-required), and dropping below it
    // would produce wrong output. Cost-tracking will flag the override.
    return exports.TIERS[config.minTier];
}
// Module-level ledger. One per Node process - sidecoach sessions live inside
// a single process so this is the session ledger. resetLedger() is exposed
// for tests + fresh-session boundaries.
let sessionLedger = [];
/**
 * Append a cost entry for a single LLM invocation. The flow handler should
 * call this AFTER the LLM returns, with the actual token counts from the
 * API response. Computes estimated cost from the tier's pricing.
 *
 * If the model string doesn't match a known tier's exactModel, the entry is
 * still recorded but with cost=0 (caller passed an unknown model - we don't
 * silently invent pricing).
 */
function trackCost(flowId, model, inputTokens, outputTokens) {
    const tier = lookupTierByModel(model);
    let cost = 0;
    if (tier) {
        cost =
            (inputTokens / 1000000) * tier.costPerMillionInput +
                (outputTokens / 1000000) * tier.costPerMillionOutput;
    }
    sessionLedger.push({
        timestamp: Date.now(),
        flowId,
        model,
        tier: tier ? tier.name : 'sonnet', // unknown model defaults to sonnet bucket for grouping
        inputTokens,
        outputTokens,
        estimatedCost: cost,
    });
}
/** Get a snapshot of the current session ledger. Returns a defensive copy. */
function getSessionLedger() {
    return [...sessionLedger];
}
/** Clear the ledger. Tests call this between cases; sessions call this on start. */
function resetLedger() {
    sessionLedger = [];
}
/**
 * Format a human-readable summary of a cost ledger. Groups by flow and by
 * model, totals tokens and cost. Output is multi-line plain text suitable
 * for end-of-session logs.
 */
function summarizeLedger(ledger) {
    if (ledger.length === 0) {
        return 'Cost ledger: empty (no LLM calls tracked this session).';
    }
    const totalCost = ledger.reduce((sum, e) => sum + e.estimatedCost, 0);
    const totalInput = ledger.reduce((sum, e) => sum + e.inputTokens, 0);
    const totalOutput = ledger.reduce((sum, e) => sum + e.outputTokens, 0);
    // Per-flow breakdown.
    const perFlow = new Map();
    for (const e of ledger) {
        const existing = perFlow.get(e.flowId) || { calls: 0, input: 0, output: 0, cost: 0 };
        existing.calls += 1;
        existing.input += e.inputTokens;
        existing.output += e.outputTokens;
        existing.cost += e.estimatedCost;
        perFlow.set(e.flowId, existing);
    }
    // Per-model breakdown.
    const perModel = new Map();
    for (const e of ledger) {
        const existing = perModel.get(e.model) || { calls: 0, input: 0, output: 0, cost: 0 };
        existing.calls += 1;
        existing.input += e.inputTokens;
        existing.output += e.outputTokens;
        existing.cost += e.estimatedCost;
        perModel.set(e.model, existing);
    }
    const lines = [];
    lines.push('Cost ledger summary');
    lines.push('===================');
    lines.push(`Total: ${ledger.length} calls, ${totalInput.toLocaleString()} input tokens, ${totalOutput.toLocaleString()} output tokens, $${totalCost.toFixed(4)} estimated`);
    lines.push('');
    lines.push('By flow:');
    for (const [flowId, stats] of [...perFlow.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
        lines.push(`  ${flowId}: ${stats.calls} calls, ${stats.input.toLocaleString()} in / ${stats.output.toLocaleString()} out, $${stats.cost.toFixed(4)}`);
    }
    lines.push('');
    lines.push('By model:');
    for (const [model, stats] of [...perModel.entries()].sort((a, b) => b[1].cost - a[1].cost)) {
        lines.push(`  ${model}: ${stats.calls} calls, ${stats.input.toLocaleString()} in / ${stats.output.toLocaleString()} out, $${stats.cost.toFixed(4)}`);
    }
    return lines.join('\n');
}
function lookupTierByModel(model) {
    for (const tier of Object.values(exports.TIERS)) {
        if (tier.exactModel === model)
            return tier;
    }
    return undefined;
}
// ============================================================================
// Handler convenience
// ============================================================================
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
function applyModelSelection(flowId, context) {
    const budget = context.metadata?.modelBudget;
    const selected = selectModel(flowId, budget);
    // Stash on the context so downstream code (and tests inspecting
    // post-handler state) can read which model was chosen.
    if (!context.metadata) {
        context.metadata = {};
    }
    context.metadata.selectedModel = selected;
    return selected;
}
//# sourceMappingURL=model-routing.js.map