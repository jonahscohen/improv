import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

async function run() {
  const engine = new FlowExecutionEngine();
  const projectPath = path.resolve(__dirname, '../../');

  // Spy on intentDetector.detect to confirm it is NOT called when forceFlowId is set.
  let detectCalled = false;
  const originalDetect = (engine as any).intentDetector.detect.bind((engine as any).intentDetector);
  (engine as any).intentDetector.detect = (...args: any[]) => {
    detectCalled = true;
    return originalDetect(...args);
  };

  // Happy path: forceFlowId routes directly to flowF_design_tokens.
  const happy = await engine.process('any utterance, totally ignored', {
    projectPath,
    projectContext: { register: 'brand' },
    metadata: { forceFlowId: 'flowF_design_tokens' },
  } as any);

  const happyHasFlowF = happy.flowResults && happy.flowResults.some((r: any) => r.flowId === 'flowF_design_tokens');
  const detectSkipped = detectCalled === false;
  console.log(detectSkipped ? 'PASS detect skipped' : 'FAIL detect was invoked');
  console.log(happyHasFlowF ? 'PASS flowF executed via force bypass' : `FAIL flowF not executed (got: ${(happy.flowResults || []).map((r: any) => r.flowId).join(', ')})`);

  // Reset spy for invalid path.
  detectCalled = false;

  // Invalid path: forceFlowId points to a non-existent id.
  const invalid = await engine.process('any utterance', {
    projectPath,
    projectContext: { register: 'brand' },
    metadata: { forceFlowId: 'flowZ_does_not_exist' },
  } as any);

  const invalidNotSuccess = invalid.success === false;
  const invalidMessageMentionsId =
    typeof invalid.message === 'string' &&
    (invalid.message.includes('flowZ_does_not_exist') ||
      invalid.message.toLowerCase().includes('unknown') ||
      invalid.message.toLowerCase().includes('invalid') ||
      invalid.message.toLowerCase().includes('not found'));

  console.log(invalidNotSuccess ? 'PASS invalid forceFlowId returns success=false' : 'FAIL invalid forceFlowId returned success=true');
  console.log(invalidMessageMentionsId ? 'PASS invalid forceFlowId message identifies the bad id' : `FAIL invalid forceFlowId message missing: "${invalid.message}"`);

  // Restore spy.
  (engine as any).intentDetector.detect = originalDetect;

  const allPass = detectSkipped && happyHasFlowF && invalidNotSuccess && invalidMessageMentionsId;
  console.log(allPass ? 'sprint5-force-flowid-bypass PASS' : 'sprint5-force-flowid-bypass FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
