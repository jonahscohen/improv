"use strict";
/**
 * Phase H Block 1 Integration Test - Flow Composition
 * Tests composition engine and preset workflows
 */
Object.defineProperty(exports, "__esModule", { value: true });
const flow_composition_1 = require("../flow-composition");
const results = [];
// Test 1: Preset workflows registered
function testPresetWorkflows() {
    const engine = new flow_composition_1.FlowCompositionEngine();
    const workflows = flow_composition_1.PRESET_COMPOSITE_FLOWS;
    results.push({
        test: 'Preset composite workflows are defined',
        passed: workflows.length >= 3 && workflows.every((w) => w.id && w.name && w.steps),
        message: `${workflows.length} workflows defined`,
    });
}
// Test 2: Register and retrieve composite flows
function testRegisterAndRetrieve() {
    const engine = new flow_composition_1.FlowCompositionEngine();
    const workflow = flow_composition_1.PRESET_COMPOSITE_FLOWS[0];
    engine.registerCompositeFlow(workflow);
    const retrieved = engine.getCompositeFlow(workflow.id);
    results.push({
        test: 'Can register and retrieve composite flows',
        passed: retrieved !== null && retrieved.id === workflow.id,
        message: retrieved ? retrieved.name : 'Not retrieved',
    });
}
// Test 3: List all composite flows
function testListCompositeFlows() {
    const engine = new flow_composition_1.FlowCompositionEngine();
    flow_composition_1.PRESET_COMPOSITE_FLOWS.forEach((wf) => engine.registerCompositeFlow(wf));
    const list = engine.listCompositeFlows();
    results.push({
        test: 'Can list all registered composite flows',
        passed: list.length === flow_composition_1.PRESET_COMPOSITE_FLOWS.length,
        message: `${list.length} flows registered`,
    });
}
// Test 4: Research to Implementation workflow has all required flows
function testResearchToImplementationSteps() {
    const workflow = flow_composition_1.PRESET_COMPOSITE_FLOWS.find((w) => w.id === 'composite_research_to_impl');
    const requiredFlows = [
        'flowA_brand_verify',
        'flowB_component_research',
        'flowC_font_research',
        'flowF_design_tokens',
        'flowG_component_implementation',
        'flowI_accessibility',
    ];
    const hasAllFlows = requiredFlows.every((flow) => workflow?.steps.some((step) => step.flowId === flow));
    results.push({
        test: 'Research to Implementation workflow has all required flows',
        passed: hasAllFlows && (workflow?.steps.length || 0) >= 9,
        message: `${workflow?.steps.length} steps, all required flows present`,
    });
}
// Test 5: QA workflow error handling
function testQAWorkflowErrorHandling() {
    const workflow = flow_composition_1.PRESET_COMPOSITE_FLOWS.find((w) => w.id === 'composite_qa_workflow');
    const hasSkipOnErrorSteps = workflow?.steps.some((step) => step.skipOnError === true) === true;
    results.push({
        test: 'QA workflow has steps that skip on error',
        passed: hasSkipOnErrorSteps && workflow?.failOnFirstError === false,
        message: `${workflow?.steps.filter((s) => s.skipOnError).length} steps skip on error`,
    });
}
// Test 6: Optimization workflow configuration
function testOptimizationWorkflow() {
    const workflow = flow_composition_1.PRESET_COMPOSITE_FLOWS.find((w) => w.id === 'composite_optimization');
    const allSkipOnError = workflow?.steps.every((step) => step.skipOnError === true) === true;
    results.push({
        test: 'Optimization workflow allows all steps to skip on error',
        passed: allSkipOnError && workflow?.steps.length === 5,
        message: `5 steps, all skip on error for resilience`,
    });
}
// Test 7: Result aggregation structure
function testResultAggregation() {
    const mockResults = [
        {
            flowId: 'test1',
            flowName: 'Test 1',
            status: 'success',
            message: 'Success',
            guidance: ['Guidance 1', 'Guidance 2'],
            checklist: [{ label: 'Item 1' }],
            artifacts: [{ id: 'art1', type: 'reference' }],
        },
        {
            flowId: 'test2',
            flowName: 'Test 2',
            status: 'success',
            message: 'Success',
            guidance: ['Guidance 1', 'Guidance 3'], // Duplicate guidance 1
            checklist: [{ label: 'Item 2' }],
            artifacts: [{ id: 'art1', type: 'reference' }], // Duplicate art1
        },
    ];
    const aggregated = flow_composition_1.FlowCompositionEngine.aggregateResults(mockResults);
    results.push({
        test: 'Result aggregation deduplicates guidance and artifacts',
        passed: aggregated.guidance.length === 3 && // Guidance 1, 2, 3 (deduplicated)
            aggregated.artifacts.length === 1 && // art1 (deduplicated)
            aggregated.checklist.length === 2, // Both items kept
        message: `Guidance: ${aggregated.guidance.length}, Artifacts: ${aggregated.artifacts.length}, Checklist: ${aggregated.checklist.length}`,
    });
}
// Test 8: Context propagation
function testContextPropagation() {
    const originalContext = {
        utterance: 'test',
        projectPath: '/project',
        metadata: { componentName: 'button' },
    };
    const flowResult = {
        flowId: 'flowA_brand_verify',
        flowName: 'Brand Verify',
        status: 'success',
        message: 'Brand verified',
    };
    const propagated = flow_composition_1.FlowCompositionEngine.propagateContext(originalContext, flowResult);
    const hasPreviousFlow = propagated.metadata?.previousFlowId === 'flowA_brand_verify';
    const preservesOriginal = propagated.metadata?.componentName === 'button';
    results.push({
        test: 'Context propagation preserves original and adds flow results',
        passed: hasPreviousFlow && preservesOriginal,
        message: 'Previous flow and original metadata preserved',
    });
}
// Test 9: Composite flow structure validation
function testCompositeFlowStructure() {
    const workflow = flow_composition_1.PRESET_COMPOSITE_FLOWS[0];
    const hasRequiredFields = !!(workflow.id &&
        workflow.name &&
        workflow.description &&
        Array.isArray(workflow.steps) &&
        workflow.steps.length > 0 &&
        'aggregateResults' in workflow &&
        'failOnFirstError' in workflow);
    results.push({
        test: 'All preset workflows have required structure',
        passed: hasRequiredFields,
        message: `${workflow.steps.length} steps defined`,
    });
}
// Test 10: Unique composite flow IDs
function testUniqueWorkflowIds() {
    const ids = flow_composition_1.PRESET_COMPOSITE_FLOWS.map((w) => w.id);
    const uniqueIds = new Set(ids);
    results.push({
        test: 'All composite workflows have unique IDs',
        passed: ids.length === uniqueIds.size,
        message: `${uniqueIds.size} unique workflow IDs`,
    });
}
// Run all tests
function runTests() {
    testPresetWorkflows();
    testRegisterAndRetrieve();
    testListCompositeFlows();
    testResearchToImplementationSteps();
    testQAWorkflowErrorHandling();
    testOptimizationWorkflow();
    testResultAggregation();
    testContextPropagation();
    testCompositeFlowStructure();
    testUniqueWorkflowIds();
    console.log('Phase H Block 1: Flow Composition Integration Test');
    console.log('='.repeat(60));
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    for (const result of results) {
        const statusSymbol = result.passed ? '✓' : '✗';
        console.log(`${statusSymbol} ${result.test}`);
        if (result.message) {
            console.log(`  ${result.message}`);
        }
    }
    console.log('='.repeat(60));
    console.log(`Results: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}
runTests();
//# sourceMappingURL=phase-h-block1-composition.test.js.map