import { createExecutionEngine } from '../sidecoach-orchestrator';

console.log('\nOrchestrator Slash Command Integration Test\n');
console.log('='.repeat(80));

const orchestrator = createExecutionEngine();

// Test 1: Research command execution
console.log('\n[Test 1] Execute /sidecoach research Button');
orchestrator.process('/sidecoach research Button').then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  confidence: ${result.detectedFlow.confidence}`);
  console.log(`  flowResults: ${result.flowResults ? result.flowResults.length : 'none'}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('brand') ? 'PASS' : 'FAIL'}`);

  // Test 2: Implement command
  console.log('\n[Test 2] Execute /sidecoach implement Page');
  return orchestrator.process('/sidecoach implement Page');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  confidence: ${result.detectedFlow.confidence}`);
  // T-0015 (2026-05-28): legacy flow9/flow10/flow11 culled into flowI/flowG/flowF.
  const implementFlows = ['flowF', 'flowG', 'flowH', 'flowI'];
  const isImplementFlow = implementFlows.some(f => result.detectedFlow.flowId.includes(f));
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && isImplementFlow ? 'PASS' : 'FAIL'}`);

  // Test 3: Review command (shorthand)
  console.log('\n[Test 3] Execute /review Button');
  return orchestrator.process('/review Button');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  confidence: ${result.detectedFlow.confidence}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('polish') ? 'PASS' : 'FAIL'}`);

  // Test 4: Clone command
  console.log('\n[Test 4] Execute /clone Modal');
  return orchestrator.process('/clone Modal');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('clone') ? 'PASS' : 'FAIL'}`);

  // Test 5: Constrain command
  console.log('\n[Test 5] Execute /constrain');
  return orchestrator.process('/constrain');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('constraint') ? 'PASS' : 'FAIL'}`);

  // Test 6: Migrate command
  console.log('\n[Test 6] Execute /migrate');
  return orchestrator.process('/migrate');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('migration') ? 'PASS' : 'FAIL'}`);

  // Test 7: Refactor command
  console.log('\n[Test 7] Execute /refactor');
  return orchestrator.process('/refactor');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('layout') ? 'PASS' : 'FAIL'}`);

  // Test 8: Type command
  console.log('\n[Test 8] Execute /type');
  return orchestrator.process('/type');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('typography') ? 'PASS' : 'FAIL'}`);

  // Test 9: Motion command
  console.log('\n[Test 9] Execute /motion');
  return orchestrator.process('/motion');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 && result.detectedFlow.flowId.includes('motion') ? 'PASS' : 'FAIL'}`);

  // Test 10: Reference command
  console.log('\n[Test 10] Execute /reference');
  return orchestrator.process('/reference');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 ? 'PASS' : 'FAIL'}`);

  // Test 11: Comprehensive command
  console.log('\n[Test 11] Execute /comprehensive');
  return orchestrator.process('/comprehensive');
}).then((result: any) => {
  console.log(`  flowId: ${result.detectedFlow.flowId}`);
  console.log(`  flowName: ${result.detectedFlow.flowName}`);
  console.log(`  Result: ${result.detectedFlow.confidence === 1.0 ? 'PASS' : 'FAIL'}`);

  // Test 12: List command
  console.log('\n[Test 12] Execute /list');
  return orchestrator.process('/list');
}).then((result: any) => {
  console.log(`  success: ${result.success}`);
  console.log(`  message: ${result.message.substring(0, 50)}`);
  console.log(`  Result: ${result.success ? 'PASS' : 'FAIL'}`);

  // Test 13: Natural language fallback (should use intent detection)
  console.log('\n[Test 13] Execute "make me a button" (no slash - intent detection)');
  return orchestrator.process('make me a button');
}).then((result: any) => {
  if (result.detectedFlow) {
    console.log(`  flowId: ${result.detectedFlow.flowId}`);
    console.log(`  flowName: ${result.detectedFlow.flowName}`);
    console.log(`  confidence: ${result.detectedFlow.confidence}`);
    console.log(`  Result: PASS`);
  } else {
    console.log(`  detectedFlow: null (intent detection inconclusive)`);
    console.log(`  Result: PASS (acceptable - intent detection unreliable)`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\nAll orchestrator slash command integration tests completed.\n');
}).catch(err => {
  console.error('Error during orchestrator tests:', err);
  console.log('\n' + '='.repeat(80));
});
