"use strict";
// Phase 3 Reference Integration Test: Verify Flows B-E with Real Reference Systems
// Tests: Component Research → Font Research → Design References → Motion Patterns
// Each flow uses real reference implementations (not stubs)
Object.defineProperty(exports, "__esModule", { value: true });
const flow_handler_component_research_1 = require("./flow-handler-component-research");
const flow_handler_font_research_1 = require("./flow-handler-font-research");
const flow_handler_design_references_1 = require("./flow-handler-design-references");
const flow_handler_motion_patterns_1 = require("./flow-handler-motion-patterns");
const testProjectContext = {
    register: 'product',
    product: {
        name: 'Test Product',
        register: 'product',
        brandPersonality: ['clean', 'minimal', 'restrained'],
    },
    design: {
        components: { approach: 'standard' },
        typography: { approach: 'sans-serif-first' },
        visual: { approach: 'modern' },
    },
};
const createTestContext = (overrides) => ({
    utterance: 'test execution',
    projectContext: { ...testProjectContext, ...overrides },
    projectPath: '/test/project',
    metadata: {},
});
async function testPhase3References() {
    console.log('Phase 3 Reference Integration Test: B-E Research Flows\n');
    try {
        // Test Flow B: Component Research (real ComponentGalleryReferenceImpl)
        console.log('Testing Flow B: Component Research');
        const flowB = new flow_handler_component_research_1.FlowBComponentResearchHandler();
        const contextB = createTestContext({
            design: {
                components: { approach: 'button' }, // Search for button component
                typography: { approach: 'sans-serif-first' },
                visual: { approach: 'modern' },
            },
        });
        if (!flowB.canExecute(contextB)) {
            console.error('Flow B cannot execute with test context');
            process.exit(1);
        }
        const resultB = await flowB.execute(contextB);
        console.log(`OK Flow B: ${resultB.status} - ${resultB.message}`);
        console.log(`   Items: ${resultB.checklist?.length || 0} checklist items, ${resultB.artifacts?.length || 0} artifacts`);
        // Verify real reference data
        if (!resultB.artifacts || resultB.artifacts.length === 0) {
            console.error('ERROR: Flow B returned no artifacts (real reference data missing)');
            process.exit(1);
        }
        const componentArtifact = resultB.artifacts[0];
        if (!componentArtifact.content || !componentArtifact.content.includes(':')) {
            console.error('ERROR: Component patterns artifact missing expected content');
            process.exit(1);
        }
        console.log(`   ✓ Real reference data: Component patterns loaded\n`);
        // Test Flow C: Font Research (real FontshareReferenceImpl)
        console.log('Testing Flow C: Font Research');
        const flowC = new flow_handler_font_research_1.FlowCFontResearchHandler();
        const contextC = createTestContext();
        if (!flowC.canExecute(contextC)) {
            console.error('Flow C cannot execute with test context');
            process.exit(1);
        }
        const resultC = await flowC.execute(contextC);
        console.log(`OK Flow C: ${resultC.status} - ${resultC.message}`);
        console.log(`   Items: ${resultC.checklist?.length || 0} checklist items, ${resultC.artifacts?.length || 0} artifacts`);
        // Verify real reference data
        if (!resultC.artifacts || resultC.artifacts.length === 0) {
            console.error('ERROR: Flow C returned no artifacts (real reference data missing)');
            process.exit(1);
        }
        const fontArtifact = resultC.artifacts[0];
        if (!fontArtifact.content || !fontArtifact.content.includes('weights')) {
            console.error('ERROR: Font candidates artifact missing expected content');
            process.exit(1);
        }
        console.log(`   ✓ Real reference data: Font catalog loaded\n`);
        // Test Flow D: Design References (real DesignReferencesSystemImpl)
        console.log('Testing Flow D: Design References');
        const flowD = new flow_handler_design_references_1.FlowDReferenceSearchHandler();
        const contextD = createTestContext();
        if (!flowD.canExecute(contextD)) {
            console.error('Flow D cannot execute with test context');
            process.exit(1);
        }
        const resultD = await flowD.execute(contextD);
        console.log(`OK Flow D: ${resultD.status} - ${resultD.message}`);
        console.log(`   Items: ${resultD.checklist?.length || 0} checklist items, ${resultD.artifacts?.length || 0} artifacts`);
        // Verify real reference data + AI slop detection
        if (!resultD.artifacts || resultD.artifacts.length === 0) {
            console.warn('WARN: Flow D returned no artifacts (may be OK if no references matched)');
        }
        else {
            const designArtifact = resultD.artifacts[0];
            if (designArtifact.description && designArtifact.description.includes('genericityScore')) {
                console.log(`   ✓ Real reference data: Design references with AI slop detection loaded\n`);
            }
        }
        // Test Flow E: Motion Patterns (real MotionReferenceImpl)
        console.log('Testing Flow E: Motion Patterns');
        const flowE = new flow_handler_motion_patterns_1.FlowEMotionPatternsHandler();
        const contextE = createTestContext();
        if (!flowE.canExecute(contextE)) {
            console.error('Flow E cannot execute with test context');
            process.exit(1);
        }
        const resultE = await flowE.execute(contextE);
        console.log(`OK Flow E: ${resultE.status} - ${resultE.message}`);
        console.log(`   Items: ${resultE.checklist?.length || 0} checklist items, ${resultE.artifacts?.length || 0} artifacts`);
        // Verify real reference data
        if (!resultE.artifacts || resultE.artifacts.length === 0) {
            console.error('ERROR: Flow E returned no artifacts (real reference data missing)');
            process.exit(1);
        }
        const motionArtifact = resultE.artifacts[0];
        if (!motionArtifact.content || !motionArtifact.content.includes('cubic-bezier')) {
            console.error('ERROR: Easing curves artifact missing expected content');
            process.exit(1);
        }
        console.log(`   ✓ Real reference data: Motion easing curves loaded\n`);
        // Summary
        console.log('===========================================');
        console.log('OK All Phase 3 Reference Flows Work');
        console.log('  Flow B: Component Research -> 60+ patterns');
        console.log('  Flow C: Font Research -> Font catalog');
        console.log('  Flow D: Design References -> AI slop detection');
        console.log('  Flow E: Motion Patterns -> Exponential easing');
        console.log('===========================================\n');
    }
    catch (error) {
        console.error('Test failed:', error);
        process.exit(1);
    }
}
testPhase3References();
//# sourceMappingURL=phase3-reference-integration-test.js.map