import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import { IntentDetector } from '../intent-detector';
import { DisambiguationResult, MatchResult, FlowId } from '../types';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  // Construct a synthetic DisambiguationResult where the tiebreak was set via
  // the recommendation field. We patch the engine's intent detector so its
  // detect() returns our pre-built result. This isolates the orchestrator's
  // tiered-resolution behavior from the trigger registry state.
  const recommendedFlow: MatchResult = {
    flowId: 'flowF_design_tokens' as FlowId,
    flowName: 'Design System Tokens (DESIGN.md)',
    confidence: 0.85,
    matchedTokens: ['design.md'],
    reason: 'Rule-based match (confidence: 85%)',
  };
  // T-0015 (2026-05-28): flow11_extract_tokens was culled into flowF; the
  // disambiguation test now reuses flowS as a synthetic "other candidate".
  const otherCandidate: MatchResult = {
    flowId: 'flowS_typography_excellence' as FlowId,
    flowName: 'Typography Excellence',
    confidence: 0.85,
    matchedTokens: ['typography'],
    reason: 'Rule-based match (confidence: 85%)',
  };
  const syntheticDisambig: DisambiguationResult = {
    candidates: [recommendedFlow, otherCandidate],
    isAmbiguous: true,
    recommendation: recommendedFlow,
    clarificationNeeded: undefined,
    tieBreak: {
      chosenFlowId: 'flowF_design_tokens',
      reason: 'Used recommendation field as tiebreaker among 2 equal-confidence matches',
    },
  };

  // Patch the orchestrator's intent detector. The engine exposes its
  // intent-detector at `engine.intentDetector` (the property is public-ish
  // for testing purposes - access via `as any` if TypeScript narrows).
  const originalDetect = (engine as any).intentDetector.detect.bind((engine as any).intentDetector);
  (engine as any).intentDetector.detect = (utterance: string) => {
    if (utterance === '__test_silent_tiebreak') {
      return syntheticDisambig;
    }
    return originalDetect(utterance);
  };

  const result = await engine.process('__test_silent_tiebreak', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
  });

  // Silent tiebreak: flowF should have been reached. We don't assert
  // success=true (downstream validators may still skip flowF), but we
  // assert the flow appears in flowResults (proves canExecute was reached
  // for the recommended flow, not short-circuited at the ambiguous check).
  const fResult = (result.flowResults || []).find(
    (fr: any) => fr.flowId === 'flowF_design_tokens'
  );
  assertTrue(fResult != null, `flowF appears in flowResults via silent tiebreak (got: ${(result.flowResults || []).map((fr: any) => fr.flowId).join(', ')})`);

  // needsDisambiguation must NOT be set (silent path means no user prompt).
  const r: any = result;
  assertTrue(r.needsDisambiguation !== true, `needsDisambiguation is not true (got: ${r.needsDisambiguation})`);

  // Restore the patched detector so other tests are unaffected.
  (engine as any).intentDetector.detect = originalDetect;

  console.log('sprint5-disambiguation-silent-tiebreak PASS');
})();
