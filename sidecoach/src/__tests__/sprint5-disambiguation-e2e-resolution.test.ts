import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';
import type { DisambiguationResult, MatchResult, FlowId } from '../types';

async function run() {
  const engine = new FlowExecutionEngine();
  const projectPath = path.resolve(__dirname, '../../');
  const utterance = 'validate tokens against DESIGN.md';

  // ROUND 1: synthetic ambiguity that should hit the prompt branch.
  const synthetic: DisambiguationResult = {
    isAmbiguous: true,
    candidates: [
      { flowId: 'flowF_design_tokens' as FlowId, confidence: 0.7, matchedTriggers: ['tokens', 'DESIGN.md'], isAmbiguous: true } as any,
      { flowId: 'flowJ_tactical_polish' as FlowId, confidence: 0.7, matchedTriggers: ['polish'], isAmbiguous: true } as any,
    ],
    tieBreak: {
      chosenFlowId: 'flowF_design_tokens' as FlowId,
      reason: 'Alphabetical fallback among 2 equal-confidence matches',
    },
    clarificationNeeded: 'User must choose between candidate flows',
  } as any;

  const originalDetect = (engine as any).intentDetector.detect.bind((engine as any).intentDetector);
  let detectCallCount = 0;
  (engine as any).intentDetector.detect = (..._args: any[]) => {
    detectCallCount++;
    return synthetic;
  };

  // Round 1: caller sends utterance, gets prompt back.
  const round1 = await engine.process(utterance, {
    projectPath,
    projectContext: { register: 'brand' },
  } as any);

  const round1Checks: Array<[string, boolean]> = [
    ['round1: needsDisambiguation true', round1.needsDisambiguation === true],
    ['round1: success false', round1.success === false],
    ['round1: ambiguousCandidates has 2 entries', Array.isArray(round1.ambiguousCandidates) && round1.ambiguousCandidates.length === 2],
    ['round1: disambiguationPrompt string set', typeof round1.disambiguationPrompt === 'string' && round1.disambiguationPrompt.length > 0],
    ['round1: detect was invoked', detectCallCount === 1],
  ];

  // Simulate the caller picking the first candidate.
  const chosen: string | undefined = Array.isArray(round1.ambiguousCandidates) && round1.ambiguousCandidates[0]
    ? round1.ambiguousCandidates[0].flowId
    : undefined;

  // Round 2: caller re-invokes with metadata.forceFlowId.
  const detectCountBeforeRound2 = detectCallCount;
  const round2 = await engine.process(utterance, {
    projectPath,
    projectContext: { register: 'brand' },
    metadata: { forceFlowId: chosen },
  } as any);

  // Restore spy.
  (engine as any).intentDetector.detect = originalDetect;

  const round2Checks: Array<[string, boolean]> = [
    ['round2: chosen id was set', typeof chosen === 'string' && chosen.length > 0],
    ['round2: detect was NOT invoked again (bypass worked)', detectCallCount === detectCountBeforeRound2],
    ['round2: needsDisambiguation falsy', round2.needsDisambiguation !== true],
    ['round2: chosen flow appears in flowResults', Array.isArray(round2.flowResults) && round2.flowResults.some((r: any) => r.flowId === chosen)],
  ];

  const allChecks = [...round1Checks, ...round2Checks];
  let allPass = true;
  for (const [label, ok] of allChecks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }

  console.log(allPass ? 'sprint5-disambiguation-e2e-resolution PASS' : 'sprint5-disambiguation-e2e-resolution FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
