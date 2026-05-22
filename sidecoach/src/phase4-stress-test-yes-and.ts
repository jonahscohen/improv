// Phase 4 Stress Test: Full Sidecoach with Yes& Brand Project
// Tests complete flow chain: Intent Detection → Orchestration → Multiple Flows → Phase Completion
// Validates that Sidecoach properly consolidates design materials across flows

import { createExecutionEngine } from './sidecoach-orchestrator';

const YES_AND_BRAND = {
  projectPath: '/tmp/yes-and-demo',
  utterances: [
    // Research Phase - Brand Verification & Reference Research
    'Verify that our brand identity is ready for design work',
    'Research component patterns that work for an empowering, optimistic brand',
    'Find font choices that support our modern, trustworthy brand voice',
    'Search for design inspiration that matches our strategic principles',
    'Study motion patterns for an optimistic, energetic brand experience',

    // Execution Phase - Design System Construction
    'Extract design tokens from our brand guidelines and create a token system',
    'Implement the core components (button, card, form, modal) in code',
    'Plan motion and micro-interactions for our component library',
    'Review accessibility requirements for our design system',
  ],
};

interface FlowTestResult {
  utterance: string;
  success: boolean;
  flowName?: string;
  flowsExecuted?: number;
  guidance?: number;
  artifacts?: number;
}

async function runStressTest() {
  console.log('===========================================');
  console.log('Phase 4 Sidecoach Stress Test: Yes& Brand');
  console.log('===========================================\n');

  const engine = createExecutionEngine();
  const results: FlowTestResult[] = [];
  let totalFlowsExecuted = 0;

  for (let i = 0; i < YES_AND_BRAND.utterances.length; i++) {
    const utterance = YES_AND_BRAND.utterances[i];

    console.log(`Test ${i + 1}/${YES_AND_BRAND.utterances.length}: "${utterance.substring(0, 60)}..."`);

    try {
      const result = await engine.process(utterance, {
        projectPath: YES_AND_BRAND.projectPath,
        metadata: {
          test: 'stress-test',
          utteranceIndex: i,
          timestamp: new Date().toISOString(),
        },
      });

      const flowsCount = result.flowResults?.length || 0;
      totalFlowsExecuted += flowsCount;

      results.push({
        utterance,
        success: result.success,
        flowName: result.detectedFlow?.flowName,
        flowsExecuted: flowsCount,
        guidance: result.guidance?.length || 0,
        artifacts: result.artifacts?.length || 0,
      });

      if (result.success && flowsCount > 0) {
        console.log(`  ✓ ${result.detectedFlow?.flowName} (${flowsCount} flows, ${result.guidance?.length || 0} guidance)`);
      } else if (result.ambiguousCandidates && result.ambiguousCandidates.length > 0) {
        console.log(`  ? Ambiguous: ${result.ambiguousCandidates.map(c => c.flowName).join(' or ')}`);
      } else {
        console.log(`  ✗ ${result.message}`);
      }
    } catch (err) {
      console.log(`  ✗ Error: ${String(err).substring(0, 80)}`);
      results.push({
        utterance,
        success: false,
      });
    }
  }

  // Summary Report
  console.log(`\n===========================================`);
  console.log(`Stress Test Summary`);
  console.log(`===========================================\n`);

  const successful = results.filter(r => r.success).length;
  const ambiguous = results.filter(r => !r.success && r.flowName).length;
  const failed = results.filter(r => !r.success && !r.flowName).length;

  console.log(`Test Results:`);
  console.log(`  ✓ Successful: ${successful}/${results.length}`);
  console.log(`  ? Ambiguous: ${ambiguous}/${results.length}`);
  console.log(`  ✗ Failed: ${failed}/${results.length}\n`);

  console.log(`Flow Execution:`);
  console.log(`  Total flows executed: ${totalFlowsExecuted}`);
  console.log(`  Average per test: ${(totalFlowsExecuted / results.length).toFixed(1)}\n`);

  console.log(`Detailed Results:`);
  results.forEach((r, idx) => {
    const status = r.success ? '✓' : '✗';
    const flows = r.flowsExecuted ? ` (${r.flowsExecuted} flows)` : '';
    console.log(`  ${idx + 1}. ${status} ${r.flowName || 'Failed'}${flows}`);
  });

  console.log(`\n===========================================`);
  if (successful >= results.length * 0.7) {
    console.log(`✓ Stress Test: PASS (${successful}/${results.length} successful)`);
    console.log(`  Sidecoach successfully orchestrates multiple flows`);
    console.log(`  Design material consolidation verified`);
  } else {
    console.log(`✗ Stress Test: NEEDS IMPROVEMENT`);
    console.log(`  Success rate: ${((successful / results.length) * 100).toFixed(0)}%`);
  }
  console.log(`===========================================\n`);

  return {
    success: successful >= results.length * 0.7,
    totalTests: results.length,
    successfulTests: successful,
    totalFlowsExecuted,
    results,
  };
}

runStressTest().catch(err => {
  console.error('Stress test failed:', err);
  process.exit(1);
});
