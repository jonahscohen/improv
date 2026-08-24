// sidecoach/src/__tests__/enforced-rules-generation.test.ts
//
// Phase 3c Step C1 (pure gate): deriveEnforcedRules is the fail-closed precision/ledger gate that
// decides which enforced-tier rules compile into LIVE, blocking rules. Self-contained plain-assert
// suite (no jest). Proves a VALID record certifies at blocking severity, and EVERY tamper class
// (under-threshold, missing/failing/mismatched/stale precision, missing ledger entry, id mismatch,
// wrong vocabulary, no patternSpec) is REJECTED into `errors` (never certified) - which the wrapper
// turns into a non-zero exit so the build breaks.
import {
  deriveEnforcedRules, renderEnforcedRulesModule, ENFORCED_SEVERITY,
  type DeriveInputs, type EnforcedRecord, type LedgerEntryView, type PrecisionRecordView,
} from '../validators/enforced-rules-generation';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void { if (cond) passed += 1; else failures.push(label); }

const STAMP = 'abc123def4560000';
const PDIG = 'p'.repeat(64);

function validInputs(): DeriveInputs {
  const rec: EnforcedRecord = {
    fileStem: 'mined.x',
    obj: {
      ruleId: 'mined.x',
      rule: {
        ruleId: 'mined.x', canonicalRuleKey: 'mined/x', sourceVocabulary: 'mined-taste', severity: 'major',
        sourceSeverity: 'medium', findingClass: 'polish', ownerValidatorId: 'polish-standard',
        evidenceRequirements: ['css-rule'], supportedSourceKinds: [{ kind: 'css', level: 'full' }],
        scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable',
        patternSpec: { specVersion: 1, engine: 'static-css-regex', applicability: { anyOf: ['x'] }, defect: { anyOf: [{ pattern: 'y' }] }, message: 'm' },
      },
    },
  };
  const ledger = new Map<string, LedgerEntryView>([['mined.x', { ruleId: 'mined.x', content_digest: 'cd', precision_digest: PDIG, precision: 0.95 }]]);
  const precision = new Map<string, PrecisionRecordView>([['mined.x', { precisionDigest: PDIG, buildStamp: STAMP, pass: true, precision: 0.95, threshold: 0.90, minHeldoutPositives: 8, minFires: 8, recomputedPrecisionDigest: PDIG }]]);
  return { records: [rec], ledgerByRuleId: ledger, precisionByRuleId: precision, currentBuildStamp: STAMP };
}

// ---- VALID -> certified at blocking severity ----
{
  const r = deriveEnforcedRules(validInputs());
  ok(r.errors.length === 0, `valid record has no errors (${r.errors.join(' | ')})`);
  ok(r.certified.length === 1, 'valid record certifies exactly one rule');
  ok(r.certified[0]?.severity === ENFORCED_SEVERITY && ENFORCED_SEVERITY === 'major', 'certified rule is at blocking severity major');
  ok(r.certified[0]?.sourceVocabulary === 'mined-taste', 'certified rule is tagged mined-taste');
  ok(!!r.certified[0]?.patternSpec, 'certified rule carries the patternSpec (resolves to the interpreter)');
  ok(r.certified[0] && !('exampleCorpus' in r.certified[0]), 'exampleCorpus is dropped from the certified live rule');
}

// ---- each tamper class REJECTS (errors non-empty, certified empty) ----
function rejects(mutate: (i: DeriveInputs) => void, label: string, errNeedle?: string): void {
  const i = validInputs();
  mutate(i);
  const r = deriveEnforcedRules(i);
  ok(r.certified.length === 0 && r.errors.length > 0, `REJECT: ${label}`);
  if (errNeedle) ok(r.errors.some((e) => e.includes(errNeedle)), `REJECT: ${label} names "${errNeedle}"`);
}

rejects((i) => { i.ledgerByRuleId.get('mined.x')!.precision = 0.5; }, 'ledgered precision under threshold', 'under threshold');
rejects((i) => { i.ledgerByRuleId.get('mined.x')!.precision = null; }, 'ledgered precision null', 'under threshold');
rejects((i) => { i.ledgerByRuleId.delete('mined.x'); }, 'no ledger entry', 'NO enforcement-ledger entry');
rejects((i) => { i.ledgerByRuleId.get('mined.x')!.precision_digest = undefined; }, 'ledger entry has no precision-digest', 'no precision-digest');
rejects((i) => { i.precisionByRuleId.delete('mined.x'); }, 'no precision record', 'no precision record');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.pass = false; }, 'precision record not a PASS', 'not a PASS');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.precisionDigest = 'q'.repeat(64); }, 'precision digest mismatch', 'does not match the ledger');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.buildStamp = 'STALE00000000000'; }, 'precision measured against a different interpreter build', 'DIFFERENT interpreter build');
rejects((i) => { (i.records[0].obj.rule as Record<string, unknown>).ruleId = 'a-different-id'; }, 'body ruleId != filename', 'does not match filename');
rejects((i) => { (i.records[0].obj.rule as Record<string, unknown>).sourceVocabulary = 'p012'; }, 'not mined-taste', 'not "mined-taste"');
rejects((i) => { delete (i.records[0].obj.rule as Record<string, unknown>).patternSpec; }, 'no patternSpec', 'no patternSpec');
// Codex HIGH #2: a ledger entry with NO content_digest must not certify (content never bound).
rejects((i) => { i.ledgerByRuleId.get('mined.x')!.content_digest = undefined; }, 'ledger entry has no content_digest', 'no content_digest');
// Codex MEDIUM #3: a precision record measured under a WEAKENED floor must not certify.
rejects((i) => { i.precisionByRuleId.get('mined.x')!.threshold = 0.5; }, 'record threshold below production', 'weaker than the production threshold');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.threshold = undefined; }, 'record threshold missing', 'weaker than the production threshold');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.minFires = 3; }, 'record fires floor weakened', 'weakened fires floor');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.minFires = 0; }, 'record fires floor zero (tiny-denominator)', 'weakened fires floor');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.minFires = undefined; }, 'record fires floor missing', 'weakened fires floor');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.minHeldoutPositives = 2; }, 'record held-out floor weakened', 'weakened held-out-positive floor');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.minHeldoutPositives = undefined; }, 'record held-out floor missing', 'weakened held-out-positive floor');
// Codex Caveat B: a cache whose FIELDS do not recompute to the ledger's signed digest (a same-uid
// rewrite that claims a production floor while the signed digest was for a weakened one) is rejected.
rejects((i) => { i.precisionByRuleId.get('mined.x')!.recomputedPrecisionDigest = 'z'.repeat(64); }, 'cache fields do not recompute to the signed digest', 'do not RE-COMPUTE');
rejects((i) => { i.precisionByRuleId.get('mined.x')!.recomputedPrecisionDigest = undefined; }, 'cache recompute missing', 'do not RE-COMPUTE');
// a STRICTER floor than production is fine (more conservative) -> still certifies.
{
  const i = validInputs();
  const p = i.precisionByRuleId.get('mined.x')!;
  p.threshold = 0.95; p.minHeldoutPositives = 20; p.minFires = 30;
  ok(deriveEnforcedRules(i).certified.length === 1, 'a record measured at a STRICTER-than-production floor still certifies');
}
// the required floor is configurable (the wrapper passes the test-root-gated value) - a lower required
// floor accepts a record measured at that lower floor.
{
  const i = validInputs();
  const p = i.precisionByRuleId.get('mined.x')!;
  p.threshold = 0.90; p.minHeldoutPositives = 3; p.minFires = 3;
  ok(deriveEnforcedRules({ ...i, requiredMinHeldoutPositives: 3, requiredMinFires: 3 }).certified.length === 1, 'with a test-lowered required floor, a record measured at that floor certifies');
  ok(deriveEnforcedRules(i).certified.length === 0, 'the SAME record is REJECTED under the default production floor (8/8)');
}

// ---- a mix: one valid + one tampered -> the valid still certifies, the tampered is an error ----
{
  const i = validInputs();
  const bad: EnforcedRecord = { fileStem: 'mined.bad', obj: { ruleId: 'mined.bad', rule: { ruleId: 'mined.bad', sourceVocabulary: 'mined-taste', patternSpec: { engine: 'static-css-regex' } } } };
  i.records.push(bad);   // no ledger entry for mined.bad
  const r = deriveEnforcedRules(i);
  ok(r.certified.length === 1 && r.certified[0].ruleId === 'mined.x', 'the valid rule still certifies alongside a rejected one');
  ok(r.errors.some((e) => e.includes('mined.bad')), 'the tampered rule is reported as an error');
}

// ---- render ----
{
  const empty = renderEnforcedRulesModule([]);
  ok(empty.includes('export const ENFORCED_RULES: ProductRuleDefinition[] = [];'), 'render emits an empty ENFORCED_RULES for no rules');
  ok(empty.includes('imports NO data'), 'render header documents the no-data-import invariant');
  const one = renderEnforcedRulesModule(deriveEnforcedRules(validInputs()).certified);
  ok(one.includes('"ruleId": "mined.x"') && one.includes('"severity": "major"'), 'render inlines the certified rule at major severity');
  ok(one.includes('ENFORCED_RULE_IDS'), 'render emits the ENFORCED_RULE_IDS list');
}

if (failures.length) {
  process.stderr.write(`enforced-rules-generation.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
process.stdout.write(`enforced-rules-generation.test: all ${passed} assertions passed\n`);
