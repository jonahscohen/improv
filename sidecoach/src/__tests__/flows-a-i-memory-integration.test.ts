import { FlowFDesignTokensHandler } from '../flow-handler-design-tokens';
import { FlowGComponentImplementationHandler } from '../flow-handler-component-implementation';
import { FlowHMotionIntegrationHandler } from '../flow-handler-motion-integration';
import { FlowIAccessibilityHandler } from '../flow-handler-accessibility';
import { FlowABrandVerifyHandler } from '../flow-handler-brand-verify';
import { FlowBComponentResearchHandler } from '../flow-handler-component-research';
import { FlowCFontResearchHandler } from '../flow-handler-font-research';
import { FlowDReferenceSearchHandler } from '../flow-handler-design-references';
import { FlowEMotionPatternsHandler } from '../flow-handler-motion-patterns';
import { FlowExecutionContext } from '../flow-handler';
import { ProjectContext } from '../project-context';

const mockProjectContext: ProjectContext = {
  projectPath: process.cwd(),
  register: 'product',
  product: {
    brand_personality: 'modern, minimal',
  },
  design: {},
  loaded: {
    productMd: true,
    designMd: false,
  },
  errors: [],
};

const mockContext: FlowExecutionContext = {
  utterance: 'Test flow execution',
  projectPath: process.cwd(),
  projectContext: mockProjectContext,
  metadata: {
    componentName: 'button',
  },
};

async function runIntegrationTests() {
  console.log('Flows A-I Memory Integration Test Suite\n');
  console.log('='.repeat(80));

  let passed = 0;
  let failed = 0;
  const flowResults: { flowName: string; status: string; hasMemory: boolean; issues: string[] }[] = [];

  // Test Tier 1 flows (A-E)
  const tier1Flows = [
    { name: 'Flow A (Brand Verify)', handler: FlowABrandVerifyHandler },
    { name: 'Flow B (Component Research)', handler: FlowBComponentResearchHandler },
    { name: 'Flow C (Font Research)', handler: FlowCFontResearchHandler },
    { name: 'Flow D (Design References)', handler: FlowDReferenceSearchHandler },
    { name: 'Flow E (Motion Patterns)', handler: FlowEMotionPatternsHandler },
  ];

  console.log('\n--- Tier 1 Flows (A-E) ---\n');

  for (const flow of tier1Flows) {
    const handler = new flow.handler();
    const result = await handler.execute(mockContext);
    const memory = result.memory;
    const issues: string[] = [];

    if (!memory) {
      issues.push('No memory entry returned');
      failed++;
    } else {
      // Check required memory fields
      if (!memory.summary) issues.push('Missing summary');
      if (!memory.appliedRules || memory.appliedRules.length === 0) issues.push('Missing appliedRules');
      if (!memory.metrics || memory.metrics.length === 0) issues.push('Missing metrics');
      if (!memory.validationResults || memory.validationResults.length === 0) issues.push('Missing validationResults');

      if (issues.length === 0) {
        passed++;
      } else {
        failed++;
      }
    }

    const status = issues.length === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${flow.name} (${result.status})`);
    if (result.memory?.summary) console.log(`      Summary: ${result.memory.summary}`);
    if (issues.length > 0) {
      issues.forEach((issue) => console.log(`      ⚠ ${issue}`));
    }
    flowResults.push({ flowName: flow.name, status, hasMemory: !!memory, issues });
  }

  // Test Tier 2 flows (F-I)
  const tier2Flows = [
    { name: 'Flow F (Design Tokens)', handler: FlowFDesignTokensHandler },
    { name: 'Flow G (Component Implementation)', handler: FlowGComponentImplementationHandler },
    { name: 'Flow H (Motion Integration)', handler: FlowHMotionIntegrationHandler },
    { name: 'Flow I (Accessibility)', handler: FlowIAccessibilityHandler },
  ];

  console.log('\n--- Tier 2 Flows (F-I) ---\n');

  for (const flow of tier2Flows) {
    const handler = new flow.handler();
    const result = await handler.execute(mockContext);
    const memory = result.memory;
    const issues: string[] = [];

    if (!memory) {
      issues.push('No memory entry returned');
      failed++;
    } else {
      // Check required memory fields
      if (!memory.summary) issues.push('Missing summary');
      if (!memory.appliedRules || memory.appliedRules.length === 0) issues.push('Missing appliedRules');
      if (!memory.metrics || memory.metrics.length === 0) issues.push('Missing metrics');
      if (!memory.validationResults || memory.validationResults.length === 0) issues.push('Missing validationResults');

      if (issues.length === 0) {
        passed++;
      } else {
        failed++;
      }
    }

    const status = issues.length === 0 ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${flow.name} (${result.status})`);
    if (result.memory?.summary) console.log(`      Summary: ${result.memory.summary}`);
    if (issues.length > 0) {
      issues.forEach((issue) => console.log(`      ⚠ ${issue}`));
    }
    flowResults.push({ flowName: flow.name, status, hasMemory: !!memory, issues });
  }

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log(`\nResults: ${passed} passed, ${failed} failed out of ${tier1Flows.length + tier2Flows.length} flows`);
  console.log(`Success rate: ${(((passed) / (tier1Flows.length + tier2Flows.length)) * 100).toFixed(1)}%\n`);

  // Detail summary
  if (failed > 0) {
    console.log('Failed flows:');
    flowResults.filter((r) => r.status === 'FAIL').forEach((r) => {
      console.log(`- ${r.flowName}`);
      r.issues.forEach((issue) => console.log(`  - ${issue}`));
    });
  }

  return failed === 0;
}

// Run if executed directly
if (require.main === module) {
  runIntegrationTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((err) => {
      console.error('Test error:', err);
      process.exit(1);
    });
}

export { runIntegrationTests };
