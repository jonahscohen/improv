// sidecoach/src/__tests__/counter-rules.test.ts
//
// OWNED test for Stage 1c counter-rule compilation. Two layers:
//   1. REGISTRY EXISTENCE (the plan's hard requirement): every class named in the GENERATED module
//      (src/counter-rules.generated.ts) must be a real scanner class - OBJECTIVE_RULES + SUBJECTIVE_RULES - so no
//      counter-rule guidance can ever point at a class the product does not detect (no orphan guidance).
//   2. PURE-LOGIC boundary tests (no I/O): drive deriveCounterRules over synthetic distributions to pin the frozen
//      threshold, the min-sample noise guard, the null-rate exclusion, the corrupt-artifact throw, and the ordering.
import { OBJECTIVE_RULES } from '../validators/objective-rendered-scanner';
import { SUBJECTIVE_RULES } from '../validators/subjective-rendered-scanner';
import {
  deriveCounterRules, COUNTER_RULE_RATE_MIN, COUNTER_RULE_MIN_TOTAL, type DistArtifact,
} from '../counter-rule-generation';
import {
  COUNTER_RULES, counterRulesForProvider, counterRuleGuidanceForProvider,
} from '../counter-rules.generated';

const failures: string[] = [];
let asserted = 0;
const check = (cond: boolean, msg: string): void => { asserted++; if (!cond) failures.push(msg); };

// ---- layer 1: registry existence over the GENERATED module ---------------------------------------------------
const REGISTRY = new Set<string>([...OBJECTIVE_RULES, ...SUBJECTIVE_RULES]);
for (const cr of COUNTER_RULES) {
  check(REGISTRY.has(cr.rule), `generated counter-rule class '${cr.rule}' (provider ${cr.provider}) is NOT a scanner class in the registry`);
  check(cr.rate >= COUNTER_RULE_RATE_MIN && cr.rate <= 1, `counter-rule ${cr.provider}/${cr.rule} rate ${cr.rate} out of [${COUNTER_RULE_RATE_MIN},1]`);
  check(cr.total >= COUNTER_RULE_MIN_TOTAL, `counter-rule ${cr.provider}/${cr.rule} total ${cr.total} below the min-sample guard ${COUNTER_RULE_MIN_TOTAL}`);
  check(cr.fired <= cr.total && cr.fired >= 0, `counter-rule ${cr.provider}/${cr.rule} fired ${cr.fired} not in [0,total]`);
  check(typeof cr.guidance === 'string' && cr.guidance.includes(cr.rule), `counter-rule ${cr.provider}/${cr.rule} guidance does not name its class`);
}
// helpers agree with the flat list.
{
  const providers = Array.from(new Set(COUNTER_RULES.map((r) => r.provider)));
  for (const p of providers) {
    const viaHelper = counterRulesForProvider(p);
    check(viaHelper.every((r) => r.provider === p), `counterRulesForProvider('${p}') leaked another provider`);
    check(viaHelper.length === COUNTER_RULES.filter((r) => r.provider === p).length, `counterRulesForProvider('${p}') count mismatch`);
    check(counterRuleGuidanceForProvider(p).length === viaHelper.length, `guidance count for '${p}' mismatches rule count`);
  }
  check(counterRulesForProvider('provider-that-does-not-exist').length === 0, 'an unknown provider must yield no counter-rules');
}

// ---- layer 2: pure-logic boundary tests (synthetic distributions) --------------------------------------------
const art = (distribution: DistArtifact['distribution'], universe: string[]): DistArtifact => ({
  schema: 'sidecoach-defect-distribution/v1', generatedUtc: '2026-01-01T00:00:00.000Z', ruleUniverse: universe, distribution,
});
const rulesOf = (a: DistArtifact) => new Set(deriveCounterRules(a).map((r) => `${r.provider}/${r.rule}`));

// fires at EXACTLY the threshold, over a sufficient sample.
{
  const s = rulesOf(art({ claude: { 'tiny-text': { fired: 3, total: 10, rate: COUNTER_RULE_RATE_MIN } } }, ['tiny-text']));
  check(s.has('claude/tiny-text'), `must fire at exactly rate=${COUNTER_RULE_RATE_MIN}`);
}
// does NOT fire just below the threshold.
{
  const s = rulesOf(art({ claude: { 'tiny-text': { fired: 2, total: 10, rate: COUNTER_RULE_RATE_MIN - 0.01 } } }, ['tiny-text']));
  check(!s.has('claude/tiny-text'), 'must NOT fire just below the rate floor');
}
// noise guard: a high rate over too FEW conclusive pages does not fire.
{
  const s = rulesOf(art({ claude: { 'tiny-text': { fired: COUNTER_RULE_MIN_TOTAL - 1, total: COUNTER_RULE_MIN_TOTAL - 1, rate: 1.0 } } }, ['tiny-text']));
  check(!s.has('claude/tiny-text'), `rate 1.0 over total<${COUNTER_RULE_MIN_TOTAL} must NOT fire (noise guard)`);
}
// null rate (no conclusive pages for the class) is excluded.
{
  const s = rulesOf(art({ claude: { 'tiny-text': { fired: 0, total: 0, rate: null } } }, ['tiny-text']));
  check(!s.has('claude/tiny-text'), 'a null-rate class must be excluded');
}
// corrupt artifact: a class outside ruleUniverse throws (never silently emitted).
{
  let threw = false;
  try { deriveCounterRules(art({ claude: { 'ghost-class': { fired: 9, total: 10, rate: 0.9 } } }, ['tiny-text'])); }
  catch { threw = true; }
  check(threw, 'a distribution class outside ruleUniverse must throw (corrupt-artifact guard)');
}
// deterministic order: provider asc, then rate desc within a provider.
{
  const ordered = deriveCounterRules(art({
    gpt: { 'tiny-text': { fired: 6, total: 10, rate: 0.6 } },
    claude: { 'nested-cards': { fired: 5, total: 10, rate: 0.5 }, 'oversized-h1': { fired: 9, total: 10, rate: 0.9 } },
  }, ['tiny-text', 'nested-cards', 'oversized-h1']));
  const seq = ordered.map((r) => `${r.provider}/${r.rule}`);
  check(
    JSON.stringify(seq) === JSON.stringify(['claude/oversized-h1', 'claude/nested-cards', 'gpt/tiny-text']),
    `ordering wrong: ${JSON.stringify(seq)}`,
  );
}

if (failures.length) throw new Error(`counter-rules FAILED (${failures.length}):\n  ${failures.join('\n  ')}`);
console.log(`counter-rules: OK (${asserted} asserted; ${COUNTER_RULES.length} generated counter-rule(s) over the registry)`);
