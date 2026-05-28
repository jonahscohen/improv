import { createExecutionEngine } from '../sidecoach-orchestrator';

console.log('\n[Task 10] Flow N Live Browser Iteration with Endow\n');
console.log('='.repeat(80));

const orchestrator = createExecutionEngine();

// Test 1: Without Endow available
console.log('\n[Test 1] Flow N without Endow (token-based fallback)');
delete process.env.ENDOW_AVAILABLE;

orchestrator.process('/sidecoach rapid button states').then((result: any) => {
  const hasFlowN = result.flowResults && result.flowResults.some((r: any) => r.flowId === 'flowN_rapid_iteration_refined');
  const noEndowMsg = result.flowResults && result.flowResults.some((r: any) =>
    r.guidance && r.guidance.some((g: string) => g.includes('DESIGN.md tokens'))
  );

  console.log(`  Flow N executed: ${hasFlowN ? 'YES' : 'NO'}`);
  console.log(`  Token-based fallback guidance: ${noEndowMsg ? 'YES' : 'NO'}`);
  console.log(`  Result: ${hasFlowN && noEndowMsg ? 'PASS' : 'FAIL'}`);

  // Test 2: With Endow available
  console.log('\n[Test 2] Flow N with Endow (live browser iteration)');
  process.env.ENDOW_AVAILABLE = 'true';

  return orchestrator.process('/sidecoach rapid navigation');
}).then((result: any) => {
  const hasFlowN = result.flowResults && result.flowResults.some((r: any) => r.flowId === 'flowN_rapid_iteration_refined');
  const endowMsg = result.flowResults && result.flowResults.some((r: any) =>
    r.message && r.message.includes('Endow')
  );
  const endowGuidance = result.flowResults && result.flowResults.some((r: any) =>
    r.guidance && r.guidance.some((g: string) => g.includes('LIVE BROWSER ITERATION ENABLED'))
  );
  const endowArtifact = result.flowResults && result.flowResults.some((r: any) =>
    r.artifacts && r.artifacts.some((a: any) => a.name === 'endow-iteration-session')
  );

  console.log(`  Flow N executed: ${hasFlowN ? 'YES' : 'NO'}`);
  console.log(`  Message mentions Endow: ${endowMsg ? 'YES' : 'NO'}`);
  console.log(`  Guidance shows live iteration: ${endowGuidance ? 'YES' : 'NO'}`);
  console.log(`  Endow artifact created: ${endowArtifact ? 'YES' : 'NO'}`);

  const allConditions = hasFlowN && endowMsg && endowGuidance && endowArtifact;
  console.log(`\n  Result: ${allConditions ? 'PASS' : 'FAIL'}`);

  // Test 3: Artifact structure
  console.log('\n[Test 3] Endow artifact structure');
  const flowN = result.flowResults && result.flowResults.find((r: any) => r.flowId === 'flowN_rapid_iteration_refined');
  const artifact = flowN && flowN.artifacts && flowN.artifacts.find((a: any) => a.name === 'endow-iteration-session');

  if (artifact) {
    const content = JSON.parse(artifact.content);
    const hasMode = content.mode === 'live-browser-iteration';
    const hasStatus = content.improveStatus === 'connected';
    const hasMaxRounds = content.maxRounds === 10;
    const hasCaptureMode = content.captureMode === 'screenshot-per-round';

    console.log(`  Mode set to live-browser-iteration: ${hasMode ? 'YES' : 'NO'}`);
    console.log(`  Endow status set to connected: ${hasStatus ? 'YES' : 'NO'}`);
    console.log(`  Max rounds set to 10: ${hasMaxRounds ? 'YES' : 'NO'}`);
    console.log(`  Capture mode is screenshot-per-round: ${hasCaptureMode ? 'YES' : 'NO'}`);

    const structureValid = hasMode && hasStatus && hasMaxRounds && hasCaptureMode;
    console.log(`\n  Result: ${structureValid ? 'PASS' : 'FAIL'}`);
  } else {
    console.log('\n  Result: FAIL (artifact not found)');
  }

  console.log('\n' + '='.repeat(80));
}).catch((error: any) => {
  console.error('Test failed:', error);
  process.exit(1);
});
