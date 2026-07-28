/**
 * Phase H Block 7: Flow Validator Integration Test
 * Verifies domain validators wire correctly into flow execution paths
 * and that soft-fail validation doesn't halt execution
 */

import {
  registerFlowDomainValidators,
  getValidatorsForFlow,
  COMPOSITE_FLOW_VALIDATIONS,
} from '../flow-domain-validators';
import { FlowCompositionEngine } from '../flow-composition';
import { FlowExecutionResult } from '../flow-handler';

interface TestResult {
  test: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function createTestResult(
  flowId: string,
  status: 'success' | 'error' | 'skipped' = 'success',
  guidance: string[] = [],
  checklist: any[] = []
): FlowExecutionResult {
  return {
    flowId: flowId as any,
    flowName: flowId,
    status,
    message: `${flowId} ${status}`,
    guidance,
    checklist,
    artifacts: [],
  };
}

function testBlock7a() {
  const engine = new FlowCompositionEngine();
  registerFlowDomainValidators(engine);

  // Test 1: All 5 validators register
  const allValidators = [
    'accessibility',
    'performance',
    'design_system',
    'semantic',
    'content_quality',
  ];
  const registrationTest = allValidators.every(domain => engine.getDomainValidator(domain));
  results.push({
    test: 'All 5 domain validators register',
    passed: registrationTest,
  });

  // Test 2: flowI_accessibility has accessibility validator
  const flowI_validators = getValidatorsForFlow('flowI_accessibility');
  results.push({
    test: 'flowI_accessibility mapped to [accessibility]',
    passed: JSON.stringify(flowI_validators) === JSON.stringify(['accessibility']),
  });

  // Test 3: flowE_motion_patterns has correct validators
  const flowE_validators = getValidatorsForFlow('flowE_motion_patterns');
  results.push({
    test: 'flowE_motion_patterns mapped to [performance, content_quality]',
    passed: JSON.stringify(flowE_validators) === JSON.stringify(['performance', 'content_quality']),
  });

  // Test 4: flowG_component_implementation has correct validators
  const flowG_validators = getValidatorsForFlow('flowG_component_implementation');
  results.push({
    test: 'flowG_component_implementation mapped to [semantic, design_system]',
    passed: JSON.stringify(flowG_validators) === JSON.stringify(['semantic', 'design_system']),
  });

  // Test 5: Unmapped flows return empty array
  const unmappedValidators = getValidatorsForFlow('flowUnknown');
  results.push({
    test: 'Unmapped flows return empty validator array',
    passed: unmappedValidators.length === 0,
  });

  // Test 6: Composite workflows have correct domains
  results.push({
    test: 'accessibility_workflow has correct domains',
    passed:
      JSON.stringify(COMPOSITE_FLOW_VALIDATIONS.accessibility_workflow.domains) ===
      JSON.stringify(['accessibility', 'semantic']),
  });

  // STALE COUNT CORRECTED 2026-07-28 (Jonah): 4 -> 5. complete_qa_workflow.domains is
  // [accessibility, performance, design_system, semantic, content_quality]
  // (flow-domain-validators.ts:275) - "complete" QA means every domain, and there are five.
  // This file contradicted ITSELF: testBlock7c's 'Complete QA workflow validates all 4
  // domains' asserts `validations3.length >= 4` and passes with 5, while this line demanded
  // exactly 4. A single file disagreeing with the product AND with its own later assertion
  // is a stale expectation, not a product defect.
  results.push({
    test: 'complete_qa_workflow has all 5 domains',
    passed:
      COMPOSITE_FLOW_VALIDATIONS.complete_qa_workflow.domains.length === 5 &&
      COMPOSITE_FLOW_VALIDATIONS.complete_qa_workflow.domains.includes('accessibility'),
  });

  // Test 7: All workflows use soft-fail mode
  const allSoftFail =
    !COMPOSITE_FLOW_VALIDATIONS.accessibility_workflow.failOnError &&
    !COMPOSITE_FLOW_VALIDATIONS.performance_workflow.failOnError &&
    !COMPOSITE_FLOW_VALIDATIONS.design_system_workflow.failOnError &&
    !COMPOSITE_FLOW_VALIDATIONS.complete_qa_workflow.failOnError;
  results.push({
    test: 'All composite workflows use soft-fail mode',
    passed: allSoftFail,
  });
}

function testBlock7b() {
  const engine = new FlowCompositionEngine();
  registerFlowDomainValidators(engine);

  // FIXTURE COMPLETED 2026-07-28 (Jonah) - the assertion is UNCHANGED and still demands 'pass'.
  //
  // This case claimed to test that a conforming accessibility result passes, but supplied
  // `checklist: []`. createAccessibilityValidator has three rules and the third,
  // has_checklist, requires checklist items (flow-domain-validators.ts:33-39), so the input
  // could only ever produce 'partial'. The suite was not testing accessibility validation; it
  // was testing what happens when you leave a required input empty.
  //
  // Weakening the assertion to 'partial' would have made it green while making it check less.
  // Completing the fixture keeps the original, stronger claim and makes the test mean what its
  // name says. The 'partial' path is separately and deliberately covered by the green gated
  // phase-h-block4-domain-validators.test.ts.
  const result1 = createTestResult(
    'flowI_accessibility',
    'success',
    [
      'WCAG 2.1 AA compliance:',
      'Use semantic HTML',
      'Screen reader testing: VoiceOver',
    ],
    [{ label: 'Keyboard traversal verified on every interactive control', done: false }],
  );
  const validations1 = engine.validateMultipleDomains(['accessibility'], result1);
  results.push({
    test: 'Accessibility validator passes with WCAG guidance',
    passed: validations1[0]?.status === 'pass',
  });

  // Test 2: Performance validator passes with motion guidance
  const result2 = createTestResult('flowE_motion_patterns', 'success', [
    'Performance budget: 60 FPS target',
    'Animation optimization: reduce DOM thrashing',
  ]);
  const validations2 = engine.validateMultipleDomains(['performance'], result2);
  results.push({
    test: 'Performance validator passes with motion guidance',
    passed: validations2[0]?.status === 'pass',
  });

  // FIXTURE COMPLETED 2026-07-28 (Jonah) - the assertion is UNCHANGED and still demands 'pass'.
  //
  // Same defect as Test 1, two rules deep. createDesignSystemValidator has three rules
  // (flow-domain-validators.ts:82-118): uses_design_tokens, which this input already
  // satisfied; has_design_rationale, which needs why/rationale/principle/constraint wording;
  // and validates_coverage, which needs artifacts or checklist items. The original fixture
  // supplied neither of the last two, so 2 of 3 rules failed and 'pass' was unreachable.
  // The guidance below now states a RATIONALE rather than only an instruction, which is the
  // property has_design_rationale exists to check.
  const result3 = createTestResult(
    'flowF_design_tokens',
    'success',
    [
      'Apply design tokens from design.md',
      'Typography uses design system tokens',
      'Rationale: tokens are the single source of truth, so a hard-coded hex is a drift risk',
    ],
    [{ label: 'Every declared token resolves against DESIGN.md', done: false }],
  );
  const validations3 = engine.validateMultipleDomains(['design_system'], result3);
  results.push({
    test: 'Design system validator passes with design tokens',
    passed: validations3[0]?.status === 'pass',
  });

  // Test 4: Content quality validator fails with AI-slop
  const result4 = createTestResult('flowB_component_research', 'success', [
    'leverage cutting edge techniques',
    'synergy with paradigm shift',
    'revolutionary game changer',
  ]);
  const validations4 = engine.validateMultipleDomains(['content_quality'], result4);
  // STALE EXPECTATION CORRECTED 2026-07-28 (Jonah): 'fail' -> 'partial', and the rule-level
  // assertion added so this tests DETECTION rather than just an aggregate label.
  //
  // The slop rule DID fire all along. `status` aggregates as
  // `failedRules.length === 0 ? pass : failedRules.length === rules.length ? fail : partial`
  // (flow-composition.ts:250), so 'fail' requires EVERY rule to fail. content_quality has two
  // rules and has_meaningful_content legitimately passes on this input (three guidance
  // entries), which makes 'partial' the correct verdict for "one rule caught something".
  //
  // That aggregation is pinned by the green gated suite phase-h-block4-domain-validators.test.ts
  // ('Validate result with mixed pass/fail returns partial status'), and again by
  // phase-h-block5 and phase-h-block6. Three gated suites against this one file.
  //
  // Asserting the failed RULE by name is the stronger check: it would survive a future change
  // to the aggregation labels and still prove the AI-slop detector fired.
  results.push({
    test: 'Content quality validator detects AI-slop patterns',
    passed:
      validations4[0]?.status === 'partial' &&
      (validations4[0]?.failedRules ?? []).includes('avoids_generic_content'),
  });

  // Test 5: Multi-domain validation works
  const result5 = createTestResult('flowV_all_seven_qa', 'success', [
    'WCAG 2.1 AA compliance guidance',
    'Performance: 60 FPS, animation optimization',
    'Design tokens: use design.md',
    'Semantic: ARIA, semantic HTML',
  ]);
  const validations5 = engine.validateMultipleDomains(
    ['accessibility', 'performance', 'design_system', 'semantic'],
    result5
  );
  results.push({
    test: 'Multi-domain validation validates all domains',
    // TIGHTENED 2026-07-28 (Jonah, Codex review): was `validations5.length >= 3 && some(accessibility)`,
    // which passed while SILENTLY DROPPING one of the four requested domains. The test is named
    // "validates all domains", so it now asserts exact membership of the four it asked for.
    passed:
      validations5.length === 4 &&
      ['accessibility', 'performance', 'design_system', 'semantic'].every(d =>
        validations5.some(v => v.domain === d),
      ),
  });

  // Test 6: Validation results stored in FlowExecutionResult
  const result6 = createTestResult('flowI_accessibility', 'success', [
    'WCAG 2.1 AA compliance guidance',
  ]);
  const validations6 = engine.validateMultipleDomains(['accessibility'], result6);
  result6.validationResults = validations6;
  results.push({
    test: 'Validation results stored in FlowExecutionResult',
    passed: result6.validationResults !== undefined && result6.validationResults.length > 0,
  });
}

function testBlock7c() {
  const engine = new FlowCompositionEngine();
  registerFlowDomainValidators(engine);

  // Test 1: Accessibility workflow validates both domains
  const result1 = createTestResult('flowI_accessibility', 'success', [
    'WCAG 2.1 AA: keyboard navigation',
    'Semantic HTML: article, section',
  ]);
  const workflowDomains1 = COMPOSITE_FLOW_VALIDATIONS.accessibility_workflow.domains;
  const validations1 = engine.validateMultipleDomains(workflowDomains1, result1);
  results.push({
    test: 'Accessibility workflow validates both accessibility and semantic',
    passed: validations1.some(v => v.domain === 'accessibility') &&
      validations1.some(v => v.domain === 'semantic'),
  });

  // Test 2: Performance workflow validates both domains
  const result2 = createTestResult('flowE_motion_patterns', 'success', [
    'Performance: 60 FPS animation targets',
    'Content: specific motion guidance',
  ]);
  const workflowDomains2 = COMPOSITE_FLOW_VALIDATIONS.performance_workflow.domains;
  const validations2 = engine.validateMultipleDomains(workflowDomains2, result2);
  results.push({
    test: 'Performance workflow validates both performance and content_quality',
    passed: validations2.some(v => v.domain === 'performance') &&
      validations2.some(v => v.domain === 'content_quality'),
  });

  // Test 3: Complete QA workflow validates all domains
  const result3 = createTestResult('flowV_all_seven_qa', 'success', [
    'WCAG 2.1 AA compliance',
    'Performance optimization',
    'Design tokens usage',
    'Semantic HTML structure',
  ]);
  const workflowDomains3 = COMPOSITE_FLOW_VALIDATIONS.complete_qa_workflow.domains;
  const validations3 = engine.validateMultipleDomains(workflowDomains3, result3);
  // TIGHTENED 2026-07-28 (Jonah, Codex review): was named "all 4 domains" and asserted
  // `validations3.length >= 4` against a workflow that declares FIVE. It passed while a domain
  // went missing, and its stale "4" is the same drift the registration test above carried. It
  // now asserts one validation per DECLARED domain, keyed off workflowDomains3 itself, so it
  // tracks the workflow instead of a hardcoded number that can rot again.
  results.push({
    test: 'Complete QA workflow validates every declared domain',
    passed:
      validations3.length === workflowDomains3.length &&
      workflowDomains3.every(d => validations3.some(v => v.domain === d)),
  });

  // Test 4: Backward compatibility with explicit validation config
  const result4 = createTestResult('flowI_accessibility', 'success', [
    'WCAG 2.1 AA compliance',
    'Semantic structure: article, section',
  ]);
  const explicitDomains = ['accessibility', 'semantic'];
  const validations4 = engine.validateMultipleDomains(explicitDomains, result4);
  results.push({
    test: 'Explicit domain validation configuration still works',
    passed: validations4.length === 2 &&
      validations4.some(v => v.domain === 'accessibility') &&
      validations4.some(v => v.domain === 'semantic'),
  });
}

function testBlock7d() {
  const mappedFlows = [
    'flowI_accessibility',
    'flowE_motion_patterns',
    'flowJ_tactical_polish',
    'flowK_multi_lens_audit',
    'flowT_ambitious_motion',
    'flowF_design_tokens',
    'flowA_brand_verify',
    'flowG_component_implementation',
    'flowH_motion_integration',
    'flowB_component_research',
    'flowC_font_research',
    'flowD_reference_inspiration',
    'flowU_curate',
    'flowV_all_seven_qa',
  ];

  // Test 1: All mapped flows have validators
  const allMapped = mappedFlows.every(flowId => {
    const validators = getValidatorsForFlow(flowId);
    return validators.length > 0;
  });
  results.push({
    test: 'All 14 mapped flows have validators defined',
    passed: allMapped,
  });

  // Test 2: All validators are registered
  const engine = new FlowCompositionEngine();
  registerFlowDomainValidators(engine);
  const domains = ['accessibility', 'performance', 'design_system', 'semantic', 'content_quality'];
  const allRegistered = domains.every(domain => engine.getDomainValidator(domain) !== null);
  results.push({
    test: 'All 5 domain validators are registered',
    passed: allRegistered,
  });
}

// Run all test blocks
testBlock7a();
testBlock7b();
testBlock7c();
testBlock7d();

// Print results
console.log('Phase H Block 7: Flow Validator Integration Tests');
console.log('================================================\n');

// RANGES CORRECTED 2026-07-28 (Jonah). They were off by one from index 7 onward, so every
// block after 7a was mislabelled and result index 19 ('All 5 domain validators are
// registered') was NEVER PRINTED - the suite displayed 19 of its 20 results while its total
// line correctly said /20. A reporting bug in a test is the same defect class as the runner
// bug this repair sits under, so it is fixed here rather than left.
// Actual pushes: 7a=8 (indices 0-7), 7b=6 (8-13), 7c=4 (14-17), 7d=2 (18-19).
const blocks = [
  { name: 'Block 7a: Validator Registration', range: [0, 8] },
  { name: 'Block 7b: Validator Application', range: [8, 14] },
  { name: 'Block 7c: Composite Flows', range: [14, 18] },
  { name: 'Block 7d: Coverage Verification', range: [18, 20] },
];

blocks.forEach(block => {
  const blockResults = results.slice(block.range[0], block.range[1]);
  const passed = blockResults.filter(r => r.passed).length;
  console.log(`${block.name}: ${passed}/${blockResults.length}`);
  blockResults.forEach(r => {
    console.log(`  ${r.passed ? '✓' : '✗'} ${r.test}`);
  });
});

const totalPassed = results.filter(r => r.passed).length;
console.log(`\nTotal: ${totalPassed}/${results.length} tests passing`);
console.log(totalPassed === results.length ? 'Status: PASSED' : 'Status: FAILED');

export {};

// FAIL-LOUD 2026-07-28 (Jonah): this suite used to tally a verdict, print `Status: FAILED`,
// and then fall off the end of the file, which exits 0 - the exact defect class the runner
// fix in scripts/run-tests.ts exists to catch. It now propagates its own verdict.
process.exit(totalPassed === results.length ? 0 : 1);
