"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const flow_specific_validators_1 = require("./flow-specific-validators");
const flow_metrics_tracker_1 = require("./flow-metrics-tracker");
const flow_performance_cache_1 = require("./flow-performance-cache");
const failures = [];
let asserted = 0;
const check = (cond, msg) => { asserted++; if (!cond)
    failures.push(msg); };
// Fresh per-test fixtures (mirrors the original beforeEach so no test leaks state into the next).
function fresh() {
    return {
        metrics: new flow_metrics_tracker_1.FlowMetricsTracker(),
        cache: new flow_performance_cache_1.FlowHandlerCache(60000, 100),
        ctx: {
            utterance: 'brand verification please',
            userId: 'test-user-123',
            projectPath: '/test/project',
            metadata: {
                designTokens: { colors: ['#FF0000', '#00FF00'], register: 'primary' },
                colors: { primary: '#FF0000', secondary: '#00FF00' },
                typography: { heading: 'Inter', body: 'System' },
                spacing: { xs: '4px', sm: '8px', md: '16px' },
                componentTree: { nodeCount: 42, depth: 5 },
                accessibility: { wcagLevel: 'AA', auditDate: Date.now() },
            },
        },
    };
}
const okResult = (flowId, over = {}) => ({
    flowId: flowId, flowName: flowId, status: 'success', message: 'ok',
    guidance: [], checklist: [], artifacts: [], ...over,
});
// ===== Validator Integration =====
{
    const { ctx } = fresh();
    const v = flow_specific_validators_1.FlowSpecificValidator.validateFlow('flowA_brand_verify', ctx, okResult('flowA_brand_verify', { message: 'Brand verification complete', guidance: ['Brand consistency verified'] }));
    check(v.passed > 0, 'brand-verify: passed > 0');
    check(v.failed === 0, 'brand-verify: failed === 0');
}
{
    const { ctx } = fresh();
    const v = flow_specific_validators_1.FlowSpecificValidator.validateFlow('flowB_component_research', ctx, okResult('flowB_component_research', {
        guidance: ['interaction patterns documented', 'accessibility rules checked'],
        checklist: [{ id: 'state1', label: 'State 1', required: false, completed: true }],
        artifacts: [{ type: 'reference', name: 'component-lib', description: 'Component library', content: '' }],
    }));
    check(v.passed > 0, 'component-research: passed > 0');
    check(v.warnings.length >= 0, 'component-research: warnings is an array');
}
{
    const { ctx } = fresh();
    const v = flow_specific_validators_1.FlowSpecificValidator.validateFlow('flowF_design_tokens', ctx, okResult('flowF_design_tokens', { guidance: ['color naming convention', 'spacing scale verified', 'semantic tokens defined'] }));
    check(v !== undefined && v !== null, 'design-tokens: validation defined');
    check(v.passed + v.failed > 0, 'design-tokens: ran at least one rule');
}
{
    const { ctx } = fresh();
    const v = flow_specific_validators_1.FlowSpecificValidator.validateFlow('flowJ_tactical_polish', ctx, okResult('flowJ_tactical_polish', {
        guidance: Array(8).fill('polish guidance item'),
        checklist: Array(14).fill({ id: 'baseline-item', label: 'Baseline Item', required: true, completed: true }),
    }));
    check(v.passed > 0, 'tactical-polish: passed > 0');
}
{
    const all = flow_specific_validators_1.FlowSpecificValidator.getAllValidators();
    check(all.length === 4, 'validator registry has 4 validators');
    check(all.map((x) => x.flowId).includes('flowA_brand_verify'), 'registry includes flowA_brand_verify');
    check(all.map((x) => x.flowId).includes('flowF_design_tokens'), 'registry includes flowF_design_tokens');
}
// ===== Metrics Tracking =====
{
    const { metrics } = fresh();
    const id = 'exec-test-001';
    metrics.startTracking('flowA_brand_verify', 'Brand Verify', id);
    const m = metrics.getMetadata(id);
    check(!!m, 'metrics: metadata defined');
    check(m?.flowId === 'flowA_brand_verify', 'metrics: flowId recorded');
    check(m?.flowName === 'Brand Verify', 'metrics: flowName recorded');
    check(m?.metrics.executionDuration === 0, 'metrics: initial duration 0');
}
{
    const { metrics } = fresh();
    const id = 'exec-test-002';
    metrics.startTracking('flowB_component_research', 'Component Research', id);
    metrics.recordDecision(id, 'use-gallery-reference', 'Selected component gallery as primary reference', 'high');
    const m = metrics.getMetadata(id);
    check(m?.decisions.length === 1, 'metrics: 1 decision recorded');
    check(m?.decisions[0].decision === 'use-gallery-reference', 'metrics: decision value');
    check(m?.metrics.decisionsRecorded === 1, 'metrics: decisionsRecorded === 1');
}
{
    const { metrics } = fresh();
    const id = 'exec-test-003';
    metrics.startTracking('flowF_design_tokens', 'Design Tokens', id);
    metrics.recordValidation(id, 'token-naming', 10, 8, ['rule-1-failed', 'rule-2-failed']);
    const m = metrics.getMetadata(id);
    check(m?.validations.length === 1, 'metrics: 1 validation recorded');
    check(m?.validations[0].passRate === 80, 'metrics: passRate 80');
    check(m?.validations[0].rulesFailed === 2, 'metrics: rulesFailed 2');
}
{
    const { metrics } = fresh();
    const id = 'exec-test-004';
    metrics.startTracking('flowJ_tactical_polish', 'Tactical Polish', id);
    metrics.recordArtifact(id, 'checklist', 'Polish Baseline Checklist', '14-item baseline checklist', 2048);
    const m = metrics.getMetadata(id);
    check(m?.artifacts.length === 1, 'metrics: 1 artifact recorded');
    check(m?.artifacts[0].type === 'checklist', 'metrics: artifact type');
    check(m?.metrics.artifactsProduced === 1, 'metrics: artifactsProduced === 1');
}
{
    const { metrics } = fresh();
    const id = 'exec-test-005';
    metrics.startTracking('flowA_brand_verify', 'Brand Verify', id);
    metrics.updateChecklistProgress(id, 7, 10);
    const m = metrics.getMetadata(id);
    check(m?.metrics.checklistItemsCompleted === 7, 'metrics: checklist completed 7');
    check(m?.metrics.checklistItemsTotal === 10, 'metrics: checklist total 10');
}
{
    const { metrics } = fresh();
    const id = 'exec-test-006';
    metrics.startTracking('flowA_brand_verify', 'Brand Verify', id);
    metrics.recordValidation(id, 'brand-consistency', 5, 4);
    metrics.recordArtifact(id, 'guide', 'Brand Guide', 'Brand guidelines');
    metrics.updateChecklistProgress(id, 3, 5);
    const s = metrics.getMetricsSummary(id);
    check(!!s, 'metrics: summary defined');
    check(s?.flowId === 'flowA_brand_verify', 'metrics: summary flowId');
    check(s?.artifactsProduced === 1, 'metrics: summary artifactsProduced 1');
    check(s?.validationSummary.passed === 4, 'metrics: summary validation passed 4');
}
// ===== Performance Cache =====
{
    const { cache } = fresh();
    const flowId = 'flowA_brand_verify';
    cache.cacheHandlerResult(flowId, okResult('flowA_brand_verify'));
    const c = cache.getHandlerResult(flowId);
    check(!!c, 'cache: handler result cached');
    check(c?.flowId === flowId, 'cache: handler flowId');
}
{
    const { cache, ctx } = fresh();
    cache.cacheContext('ctx-001', ctx);
    const c = cache.getContext('ctx-001');
    check(!!c, 'cache: context cached');
    check(c?.userId === 'test-user-123', 'cache: context userId');
}
{
    const { cache } = fresh();
    const r = { passed: 4, failed: 0 };
    cache.cacheValidatorResult('flowA_brand_verify:validation', r);
    check(JSON.stringify(cache.getValidatorResult('flowA_brand_verify:validation')) === JSON.stringify(r), 'cache: validator result');
}
{
    const { cache } = fresh();
    const results = [{ id: 'flow1' }, { id: 'flow2' }];
    cache.cacheQueryResult('select flows where status=success', results);
    check(JSON.stringify(cache.getQueryResult('select flows where status=success')) === JSON.stringify(results), 'cache: query result');
}
{
    const { cache } = fresh();
    const flowId = 'flowA_brand_verify';
    cache.cacheHandlerResult(flowId, okResult('flowA_brand_verify'));
    cache.getHandlerResult(flowId);
    cache.getHandlerResult(flowId);
    const stats = cache.getStats();
    check(stats.totalHits === 2, 'cache: totalHits 2');
    check(stats.hitRate > 0, 'cache: hitRate > 0');
}
{
    const { cache } = fresh();
    const flowId = 'flowA_brand_verify';
    cache.cacheHandlerResult(flowId, okResult('flowA_brand_verify'));
    cache.invalidateFlow(flowId);
    check(cache.getHandlerResult(flowId) === undefined, 'cache: invalidated entry is undefined');
}
{
    const small = new flow_performance_cache_1.FlowHandlerCache(60000, 5);
    for (let i = 0; i < 10; i++)
        small.cacheHandlerResult(`flow${i}`, okResult(`flow${i}`));
    check(small.getStats().cacheSize <= 5, 'cache: enforces size limit <= 5');
}
// ===== End-to-End =====
{
    const { metrics, cache, ctx } = fresh();
    const id = 'e2e-test-001';
    const flowId = 'flowA_brand_verify';
    metrics.startTracking(flowId, 'Brand Verify', id);
    const result = okResult('flowA_brand_verify', {
        message: 'Brand verified', guidance: ['guidance 1'],
        checklist: [{ id: 'item1', label: 'Item 1', required: true, completed: true }],
        artifacts: [{ type: 'reference', name: 'brand-ref', description: 'Brand reference', content: '' }],
    });
    const v = flow_specific_validators_1.FlowSpecificValidator.validateFlow(flowId, ctx, result);
    check(v.passed > 0, 'e2e: validation passed > 0');
    metrics.recordValidation(id, 'brand-check', 5, 5);
    metrics.recordArtifact(id, 'reference', 'Brand Ref', 'Brand reference');
    metrics.updateChecklistProgress(id, 1, 1);
    cache.cacheHandlerResult(flowId, result);
    check(!!cache.getHandlerResult(flowId), 'e2e: result cached');
    metrics.completeTracking(id);
    const s = metrics.getMetricsSummary(id);
    check(s?.flowId === flowId, 'e2e: summary flowId');
    check(s?.artifactsProduced === 1, 'e2e: summary artifacts 1');
    check(cache.getStats().totalHits > 0, 'e2e: cache totalHits > 0');
}
if (failures.length)
    throw new Error(`phase-iii-integration FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
console.log(`phase-iii-integration: OK (${asserted} asserted; FlowSpecificValidator + FlowMetricsTracker + FlowHandlerCache)`);
//# sourceMappingURL=phase-iii-integration.test.js.map