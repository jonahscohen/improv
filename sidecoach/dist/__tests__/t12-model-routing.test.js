"use strict";
// T-0012: Per-flow model-tier routing tests.
//
// Covers:
//   1. TIERS constants use the latest Claude model IDs (per CLAUDE.md mandate).
//   2. FLOW_MODELS has one entry per FlowId in types.ts.
//   3. selectModel returns preferredTier with no budget constraint.
//   4. selectModel falls back to budget cap under budget constraint.
//   5. selectModel respects minTier floor when budget is below min.
//   6. trackCost appends entries with correct token counts and computes cost.
//   7. summarizeLedger formats per-flow + per-model breakdown.
//   8. applyModelSelection stashes selected model into context.metadata.
//   9. Each handler invokes applyModelSelection / selectModel before its
//      LLM call (the LLM is mocked - we assert the metadata write happened).
//  10. T-0009 retry-control halt still fires in handlers that combine the
//      two mechanisms (polish/audit/critique).
Object.defineProperty(exports, "__esModule", { value: true });
const model_routing_1 = require("../model-routing");
const flow_handler_brand_verify_1 = require("../flow-handler-brand-verify");
const flow_handler_tactical_polish_1 = require("../flow-handler-tactical-polish");
const flow_handler_multi_lens_audit_1 = require("../flow-handler-multi-lens-audit");
const flow_handler_design_critique_1 = require("../flow-handler-design-critique");
const flow_handler_curate_1 = require("../flow-handler-curate");
const flow_handler_motion_integration_1 = require("../flow-handler-motion-integration");
const checks = [];
function expect(label, ok, detail) {
    checks.push({ label, ok, detail });
}
async function run() {
    // === Section 1: TIERS uses latest model IDs ===
    expect('tiers: haiku uses claude-haiku-4-5-20251001', model_routing_1.TIERS.haiku.exactModel === 'claude-haiku-4-5-20251001', model_routing_1.TIERS.haiku.exactModel);
    expect('tiers: sonnet uses claude-sonnet-4-6', model_routing_1.TIERS.sonnet.exactModel === 'claude-sonnet-4-6', model_routing_1.TIERS.sonnet.exactModel);
    expect('tiers: opus uses claude-opus-4-7', model_routing_1.TIERS.opus.exactModel === 'claude-opus-4-7', model_routing_1.TIERS.opus.exactModel);
    expect('tiers: haiku pricing < sonnet < opus (input)', model_routing_1.TIERS.haiku.costPerMillionInput < model_routing_1.TIERS.sonnet.costPerMillionInput &&
        model_routing_1.TIERS.sonnet.costPerMillionInput < model_routing_1.TIERS.opus.costPerMillionInput);
    expect('tiers: haiku pricing < sonnet < opus (output)', model_routing_1.TIERS.haiku.costPerMillionOutput < model_routing_1.TIERS.sonnet.costPerMillionOutput &&
        model_routing_1.TIERS.sonnet.costPerMillionOutput < model_routing_1.TIERS.opus.costPerMillionOutput);
    // === Section 2: FLOW_MODELS coverage ===
    // Enumerate all FlowId values and assert each appears in FLOW_MODELS.
    // Pull the canonical list from types.ts via a sample object.
    const allFlowIds = [
        'flowA_brand_verify',
        'flowB_component_research',
        'flowC_font_research',
        'flowD_reference_inspiration',
        'flowE_motion_patterns',
        'flowF_design_tokens',
        'flowG_component_implementation',
        'flowH_motion_integration',
        'flowI_accessibility',
        'flowJ_tactical_polish',
        'flowK_multi_lens_audit',
        'flowL_design_critique',
        'flowM_responsive_validation',
        'flowN_rapid_iteration_refined',
        'flowO_clone_match_special',
        'flowP_constraint_design_special',
        'flowQ_migration_special',
        'flowR_layout_optimization',
        'flowS_typography_excellence',
        'flowT_ambitious_motion',
        'flowU_curate',
        'flowV_all_seven_qa',
        'flowW_landing_composition',
        'flowX_copywriting',
        // T-0015 (2026-05-28): legacy flow1..flow14 IDs culled; only flowY/flowZ survived (renamed from flow4/flow7).
        'flowY_explore_discovery',
        'flowZ_design_component',
    ];
    let missingFlows = [];
    for (const flowId of allFlowIds) {
        if (!model_routing_1.FLOW_MODELS[flowId]) {
            missingFlows.push(flowId);
        }
    }
    expect(`flow-models: all ${allFlowIds.length} FlowIds have entries`, missingFlows.length === 0, missingFlows.join(', '));
    // Every entry has a rationale (catch empty-string typos).
    let emptyRationale = [];
    for (const [flowId, config] of Object.entries(model_routing_1.FLOW_MODELS)) {
        if (!config.rationale || config.rationale.trim().length === 0) {
            emptyRationale.push(flowId);
        }
    }
    expect('flow-models: every entry has a rationale', emptyRationale.length === 0, emptyRationale.join(', '));
    // Distribution check - tier breakdown should be sane.
    const tierCounts = { haiku: 0, sonnet: 0, opus: 0 };
    for (const config of Object.values(model_routing_1.FLOW_MODELS)) {
        tierCounts[config.preferredTier] += 1;
    }
    expect(`flow-models: distribution = haiku:${tierCounts.haiku} sonnet:${tierCounts.sonnet} opus:${tierCounts.opus}`, tierCounts.haiku + tierCounts.sonnet + tierCounts.opus === allFlowIds.length);
    // === Section 3: selectModel - no budget returns preferredTier ===
    const opusFlow = (0, model_routing_1.selectModel)('flowG_component_implementation');
    expect('select: flowG (preferredTier=opus) returns opus without budget', opusFlow.name === 'opus', opusFlow.name);
    const haikuFlow = (0, model_routing_1.selectModel)('flowA_brand_verify');
    expect('select: flowA (preferredTier=haiku) returns haiku without budget', haikuFlow.name === 'haiku', haikuFlow.name);
    const sonnetFlow = (0, model_routing_1.selectModel)('flowE_motion_patterns');
    expect('select: flowE (preferredTier=sonnet) returns sonnet without budget', sonnetFlow.name === 'sonnet', sonnetFlow.name);
    // === Section 4: selectModel - budget cap forces downgrade ===
    const cappedToSonnet = (0, model_routing_1.selectModel)('flowG_component_implementation', { maxTier: 'sonnet' });
    expect('select: opus flow with maxTier=sonnet returns sonnet', cappedToSonnet.name === 'sonnet', cappedToSonnet.name);
    const cappedToHaiku = (0, model_routing_1.selectModel)('flowG_component_implementation', { maxTier: 'haiku' });
    expect('select: opus flow with maxTier=haiku returns sonnet (flowG.minTier=sonnet)', cappedToHaiku.name === 'sonnet', cappedToHaiku.name);
    // A flow whose minTier === preferredTier === opus never goes below opus.
    const opusFloor = (0, model_routing_1.selectModel)('flowH_motion_integration', { maxTier: 'haiku' });
    expect('select: flowH (min=preferred=opus) returns opus even with maxTier=haiku (floor)', opusFloor.name === 'opus', opusFloor.name);
    // Budget above preferred is a no-op.
    const budgetAbove = (0, model_routing_1.selectModel)('flowA_brand_verify', { maxTier: 'opus' });
    expect('select: haiku flow with maxTier=opus returns haiku (no upgrade)', budgetAbove.name === 'haiku', budgetAbove.name);
    // === Section 5: trackCost appends and computes ===
    (0, model_routing_1.resetLedger)();
    expect('ledger: starts empty', (0, model_routing_1.getSessionLedger)().length === 0);
    (0, model_routing_1.trackCost)('flowA_brand_verify', 'claude-haiku-4-5-20251001', 1000, 500);
    let ledger = (0, model_routing_1.getSessionLedger)();
    expect('ledger: append adds entry', ledger.length === 1);
    expect('ledger: entry.flowId', ledger[0].flowId === 'flowA_brand_verify');
    expect('ledger: entry.inputTokens', ledger[0].inputTokens === 1000);
    expect('ledger: entry.outputTokens', ledger[0].outputTokens === 500);
    expect('ledger: entry.tier', ledger[0].tier === 'haiku');
    // Cost: 1000 input * $1/MTok + 500 output * $5/MTok = $0.001 + $0.0025 = $0.0035
    expect('ledger: entry.estimatedCost (haiku 1k in + 500 out)', Math.abs(ledger[0].estimatedCost - 0.0035) < 0.00001, `${ledger[0].estimatedCost}`);
    (0, model_routing_1.trackCost)('flowG_component_implementation', 'claude-opus-4-7', 5000, 2000);
    ledger = (0, model_routing_1.getSessionLedger)();
    expect('ledger: second append', ledger.length === 2);
    // Opus: 5000 * $15/MTok + 2000 * $75/MTok = $0.075 + $0.15 = $0.225
    expect('ledger: opus entry cost', Math.abs(ledger[1].estimatedCost - 0.225) < 0.00001, `${ledger[1].estimatedCost}`);
    // Unknown model = cost 0 but entry still recorded.
    (0, model_routing_1.trackCost)('flowA_brand_verify', 'unknown-model-id', 100, 50);
    ledger = (0, model_routing_1.getSessionLedger)();
    expect('ledger: unknown model still recorded', ledger.length === 3);
    expect('ledger: unknown model cost=0', ledger[2].estimatedCost === 0);
    // === Section 6: summarizeLedger format ===
    (0, model_routing_1.resetLedger)();
    (0, model_routing_1.trackCost)('flowA_brand_verify', 'claude-haiku-4-5-20251001', 1000, 500);
    (0, model_routing_1.trackCost)('flowA_brand_verify', 'claude-haiku-4-5-20251001', 2000, 1000);
    (0, model_routing_1.trackCost)('flowG_component_implementation', 'claude-opus-4-7', 5000, 2000);
    (0, model_routing_1.trackCost)('flowE_motion_patterns', 'claude-sonnet-4-6', 3000, 1500);
    const summary = (0, model_routing_1.summarizeLedger)((0, model_routing_1.getSessionLedger)());
    expect('summary: header line', summary.includes('Cost ledger summary'));
    expect('summary: shows total calls (4)', summary.includes('4 calls'));
    expect('summary: by-flow section', summary.includes('By flow:'));
    expect('summary: by-model section', summary.includes('By model:'));
    expect('summary: lists flowA', summary.includes('flowA_brand_verify'));
    expect('summary: lists flowG', summary.includes('flowG_component_implementation'));
    expect('summary: lists flowE', summary.includes('flowE_motion_patterns'));
    expect('summary: lists haiku model', summary.includes('claude-haiku-4-5-20251001'));
    expect('summary: lists sonnet model', summary.includes('claude-sonnet-4-6'));
    expect('summary: lists opus model', summary.includes('claude-opus-4-7'));
    // Empty ledger summary.
    (0, model_routing_1.resetLedger)();
    expect('summary: empty ledger', (0, model_routing_1.summarizeLedger)((0, model_routing_1.getSessionLedger)()).includes('empty'));
    // === Section 7: applyModelSelection stashes into metadata ===
    const ctx = { utterance: 'test' };
    const selected = (0, model_routing_1.applyModelSelection)('flowA_brand_verify', ctx);
    expect('applyModelSelection: returns haiku tier for flowA', selected.name === 'haiku');
    expect('applyModelSelection: stashes into context.metadata.selectedModel', !!ctx.metadata?.selectedModel &&
        ctx.metadata.selectedModel.name === 'haiku', JSON.stringify(ctx.metadata));
    // Budget override honored.
    const ctxBudget = {
        utterance: 'test',
        metadata: { modelBudget: { maxTier: 'sonnet' } },
    };
    const selectedBudget = (0, model_routing_1.applyModelSelection)('flowG_component_implementation', ctxBudget);
    expect('applyModelSelection: respects modelBudget in context.metadata', selectedBudget.name === 'sonnet', selectedBudget.name);
    // === Section 8: Handler integrations - confirm selectModel runs ===
    // Each handler should write selectedModel into context.metadata before any
    // LLM call. We don't actually invoke an LLM (the handlers are currently
    // checklist-only); we just verify the metadata write happened.
    (0, model_routing_1.resetLedger)();
    // Flow A - brand verify (Haiku).
    const flowACtx = {
        utterance: 'brand verify',
        projectPath: '/tmp/nonexistent-t12-test',
    };
    const flowAHandler = new flow_handler_brand_verify_1.FlowABrandVerifyHandler();
    await flowAHandler.execute(flowACtx);
    expect('handler: FlowA stashed selectedModel', !!flowACtx.metadata?.selectedModel, JSON.stringify(flowACtx.metadata));
    expect('handler: FlowA selected haiku tier', flowACtx.metadata?.selectedModel?.name === 'haiku', JSON.stringify(flowACtx.metadata?.selectedModel));
    // Flow U - curate (Haiku).
    const flowUCtx = {
        utterance: 'curate',
        projectPath: '/tmp/nonexistent-t12-test',
    };
    const flowUHandler = new flow_handler_curate_1.FlowUCurateHandler();
    await flowUHandler.execute(flowUCtx);
    expect('handler: FlowU stashed selectedModel', !!flowUCtx.metadata?.selectedModel, JSON.stringify(flowUCtx.metadata));
    expect('handler: FlowU selected haiku tier', flowUCtx.metadata?.selectedModel?.name === 'haiku');
    // Flow H - motion integration (Opus).
    const flowHCtx = {
        utterance: 'motion',
        projectPath: '/tmp/nonexistent-t12-test',
    };
    const flowHHandler = new flow_handler_motion_integration_1.FlowHMotionIntegrationHandler();
    await flowHHandler.execute(flowHCtx);
    expect('handler: FlowH stashed selectedModel', !!flowHCtx.metadata?.selectedModel, JSON.stringify(flowHCtx.metadata));
    expect('handler: FlowH selected opus tier (heavy reasoning)', flowHCtx.metadata?.selectedModel?.name === 'opus');
    // Flow J - tactical polish (Opus). Combined with T-0009 retry-control.
    // Success path: model is selected AND retry state attaches.
    const flowJCtx = {
        utterance: 'polish',
        projectPath: '/tmp',
    };
    const flowJHandler = new flow_handler_tactical_polish_1.FlowJTacticalPolishHandler();
    const flowJResult = await flowJHandler.execute(flowJCtx);
    expect('handler: FlowJ stashed selectedModel', !!flowJCtx.metadata?.selectedModel, JSON.stringify(flowJCtx.metadata));
    expect('handler: FlowJ selected opus tier', flowJCtx.metadata?.selectedModel?.name === 'opus');
    // T-0009 still works: retry state attached on success.
    expect('handler: FlowJ retry state still attaches (T-0009 preserved)', !!flowJResult.executionMetadata?.enhancedContext?.retryState);
    // Flow J - halt path: model is STILL selected even when halt fires (the
    // modelSelection sits ABOVE the halt check per task spec).
    const flowJHaltCtx = {
        utterance: 'polish',
        projectPath: '/tmp/nonexistent-t12-test',
        metadata: {
            retryState: {
                cycleCount: 5,
                errorSignatures: ['a1', 'a2', 'a3', 'a4', 'a5'],
            },
        },
    };
    const originalLog = console.log;
    console.log = () => { };
    try {
        const flowJHaltResult = await flowJHandler.execute(flowJHaltCtx);
        expect('handler: FlowJ halt-path selected model recorded ABOVE halt check', !!flowJHaltCtx.metadata?.selectedModel, JSON.stringify(flowJHaltCtx.metadata));
        expect('handler: FlowJ halt-path returns error status (T-0009 halt still fires)', flowJHaltResult.status === 'error', flowJHaltResult.message);
    }
    finally {
        console.log = originalLog;
    }
    // Flow K (audit) and Flow L (critique) - same combined pattern.
    const flowKCtx = {
        utterance: 'audit',
        projectPath: '/tmp/nonexistent-t12-test',
    };
    const flowKHandler = new flow_handler_multi_lens_audit_1.FlowKMultiLensAuditHandler();
    await flowKHandler.execute(flowKCtx);
    expect('handler: FlowK stashed selectedModel', !!flowKCtx.metadata?.selectedModel);
    const flowLCtx = {
        utterance: 'critique',
        projectPath: '/tmp/nonexistent-t12-test',
    };
    const flowLHandler = new flow_handler_design_critique_1.FlowLDesignCritiqueHandler();
    await flowLHandler.execute(flowLCtx);
    expect('handler: FlowL stashed selectedModel', !!flowLCtx.metadata?.selectedModel);
    // === Section 9: Estimated savings calculation sanity ===
    // Compute what a "naive Opus-for-everything" baseline would cost vs the
    // tiered approach for a typical sidecoach session.
    // Naive baseline: every flow uses Opus.
    (0, model_routing_1.resetLedger)();
    for (const flowId of allFlowIds.slice(0, 10)) {
        (0, model_routing_1.trackCost)(flowId, 'claude-opus-4-7', 2000, 1000);
    }
    const naiveCost = (0, model_routing_1.getSessionLedger)().reduce((s, e) => s + e.estimatedCost, 0);
    (0, model_routing_1.resetLedger)();
    for (const flowId of allFlowIds.slice(0, 10)) {
        const tier = (0, model_routing_1.selectModel)(flowId);
        (0, model_routing_1.trackCost)(flowId, tier.exactModel, 2000, 1000);
    }
    const tieredCost = (0, model_routing_1.getSessionLedger)().reduce((s, e) => s + e.estimatedCost, 0);
    const savings = ((naiveCost - tieredCost) / naiveCost) * 100;
    expect(`savings: tiered vs naive-opus = ${savings.toFixed(1)}% saved ($${naiveCost.toFixed(4)} -> $${tieredCost.toFixed(4)})`, savings >= 30, `${savings}% (want >=30%)`);
    // === Report ===
    let allPass = true;
    for (const c of checks) {
        if (c.ok) {
            console.log(`PASS ${c.label}`);
        }
        else {
            console.log(`FAIL ${c.label}${c.detail ? ' :: ' + c.detail : ''}`);
            allPass = false;
        }
    }
    const total = checks.length;
    const passed = checks.filter((c) => c.ok).length;
    console.log('---');
    console.log(`t12-model-routing: ${passed}/${total} passed`);
    console.log(allPass ? 't12-model-routing PASS' : 't12-model-routing FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=t12-model-routing.test.js.map