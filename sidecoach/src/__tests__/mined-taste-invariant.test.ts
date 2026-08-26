// sidecoach/src/__tests__/mined-taste-invariant.test.ts
//
// Phase 3b Step 7: the runtime invariant that a build-BLOCKING mined-taste rule MUST carry a
// matching enforcement-ledger entry AND a passing precision record. Self-contained plain-assert
// suite (no jest). Covers:
//   - the LIVE check: the real registry RULES + the enforced-rules data tier hold the invariant
//     right now (GREEN - there are no ungated mined-taste blocking rules);
//   - the pure function goes RED on the mutation the design names: a mined-taste rule flipped to a
//     blocking severity WITHOUT an enforcement-ledger entry (and/or without a passing precision
//     record);
//   - it stays GREEN when the same rule is fully backed, when it is mined-taste but advisory, and
//     when it is blocking but NOT mined-taste (the invariant is scoped to mined-taste blocking rules).
import * as fs from 'fs';
import * as path from 'path';
import { RULES, BUILTIN_RULES } from '../product-rule-registry';
import { ENFORCED_RULE_IDS } from '../validators/enforced-rules.generated';
import {
  minedTasteBlockingViolations, isMinedTaste, isBlockingSeverity, MINED_TASTE_VOCABULARY,
} from '../validators/mined-taste-invariant';
import type { MinedRuleView, EnforcementBacking } from '../validators/mined-taste-invariant';

let passed = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void { if (cond) passed += 1; else failures.push(label); }

const DATA = path.resolve(__dirname, '..', '..', 'data');
const ENFORCED_DIR = path.join(DATA, 'enforced-rules');
const ENFORCE_LEDGER = path.join(DATA, 'enforcement-ledger.jsonl');
const PRECISION_CACHE = path.resolve(__dirname, '..', '..', 'eval', '.taste-enforce-cache');

// ---------------------------------------------------------------------------
// LIVE readers - the real backing predicates. Entry existence + a passing precision record; the
// enforce CLI's `verify-ledger`/`audit` own the tamper-evident crypto separately, so this backstop
// deliberately asks only "did the gate leave its two artifacts", which is what the invariant needs.
// ---------------------------------------------------------------------------
function enforcedTierRules(): MinedRuleView[] {
  let names: string[] = [];
  try { names = fs.readdirSync(ENFORCED_DIR).filter((n) => n.endsWith('.json')); } catch (_e) { return []; }
  const out: MinedRuleView[] = [];
  for (const n of names) {
    try {
      const obj = JSON.parse(fs.readFileSync(path.join(ENFORCED_DIR, n), 'utf8'));
      const body = obj && obj.rule && typeof obj.rule === 'object' ? obj.rule : obj;
      if (body && typeof body.ruleId === 'string') {
        out.push({ ruleId: body.ruleId, sourceVocabulary: body.sourceVocabulary, severity: body.severity });
      }
    } catch (_e) { /* a malformed enforced file is surfaced by the enforce CLI audit, not here */ }
  }
  return out;
}
function ledgerRuleIds(): Set<string> {
  const ids = new Set<string>();
  let raw = '';
  try { raw = fs.readFileSync(ENFORCE_LEDGER, 'utf8'); } catch (_e) { return ids; }
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { const e = JSON.parse(t); if (typeof e.ruleId === 'string') ids.add(e.ruleId); } catch (_e) { /* skip */ }
  }
  return ids;
}
function hasPassingPrecisionRecord(ruleId: string): boolean {
  try {
    const rec = JSON.parse(fs.readFileSync(path.join(PRECISION_CACHE, `${ruleId}.json`), 'utf8'));
    return rec && rec.pass === true;
  } catch (_e) { return false; }
}

// ---------------------------------------------------------------------------
// LIVE: the registry + enforced tier hold the invariant right now.
// ---------------------------------------------------------------------------
const liveIds = ledgerRuleIds();
const liveBacking: EnforcementBacking = {
  hasLedgerEntry: (id) => liveIds.has(id),
  hasPassingPrecision: (id) => hasPassingPrecisionRecord(id),
};
const liveRules: MinedRuleView[] = [
  ...RULES.map((r) => ({ ruleId: r.ruleId, sourceVocabulary: r.sourceVocabulary, severity: r.severity })),
  ...enforcedTierRules(),
];
const liveViolations = minedTasteBlockingViolations(liveRules, liveBacking);
ok(liveViolations.length === 0, `LIVE registry + enforced tier hold the invariant (violations: ${liveViolations.join(' | ')})`);

// No registry rule is tagged mined-taste today (they cross the gate into the enforced DATA tier,
// never into RAW_RULES), so the live check above is a real assertion, not a tautology once the tier
// fills. Prove the scoping predicates behave.
// Scope to the HARD-CODED builtins: once the enforced tier fills, RULES legitimately contains the
// gated mined rules (via MINED_ENFORCED_RULES), so the "no mined-taste hard-coded rule" invariant is
// about BUILTIN_RULES, not the merged RULES. The gated mined rules are covered by the LIVE check above.
ok(!BUILTIN_RULES.some((r) => isMinedTaste(r.sourceVocabulary)), 'no hard-coded registry rule is tagged mined-taste');
ok(isBlockingSeverity('blocker') && isBlockingSeverity('major'), 'blocker/major are blocking');
ok(!isBlockingSeverity('minor') && !isBlockingSeverity('advisory'), 'minor/advisory are NOT blocking');

// ---------------------------------------------------------------------------
// MUTATION: a mined-taste rule set to a blocking severity WITHOUT an enforcement-ledger entry -> RED.
// ---------------------------------------------------------------------------
const ungated: MinedRuleView = { ruleId: 'mined.sneaky-blocker', sourceVocabulary: MINED_TASTE_VOCABULARY, severity: 'major' };
const noBacking: EnforcementBacking = { hasLedgerEntry: () => false, hasPassingPrecision: () => false };
const mutViolations = minedTasteBlockingViolations([ungated], noBacking);
ok(mutViolations.length > 0, 'MUTATION: an ungated mined-taste blocking rule PRODUCES violations (RED)');
ok(mutViolations.some((e) => e.includes('enforcement-ledger')), 'the violation names the missing enforcement-ledger entry');

// ledger entry present but precision record missing -> still RED (both artifacts required).
const ledgerOnly: EnforcementBacking = { hasLedgerEntry: () => true, hasPassingPrecision: () => false };
ok(minedTasteBlockingViolations([ungated], ledgerOnly).some((e) => e.includes('precision')), 'ledger entry alone is NOT enough - the missing precision record still trips the invariant');

// fully backed -> GREEN.
const fullBacking: EnforcementBacking = { hasLedgerEntry: () => true, hasPassingPrecision: () => true };
ok(minedTasteBlockingViolations([ungated], fullBacking).length === 0, 'a fully-backed mined-taste blocking rule holds the invariant (GREEN)');

// mined-taste but ADVISORY -> GREEN (invariant is scoped to blocking severities).
const advisory: MinedRuleView = { ruleId: 'mined.advisory-ok', sourceVocabulary: MINED_TASTE_VOCABULARY, severity: 'advisory' };
ok(minedTasteBlockingViolations([advisory], noBacking).length === 0, 'a mined-taste ADVISORY rule is not gated by the invariant (GREEN)');

// blocking but NOT mined-taste -> GREEN (a hand-authored blocker is out of scope).
const handBlocker: MinedRuleView = { ruleId: 'polish.reduced-motion-respect', sourceVocabulary: 'polish-extended-antipattern', severity: 'blocker' };
ok(minedTasteBlockingViolations([handBlocker], noBacking).length === 0, 'a non-mined blocking rule is out of scope (GREEN)');

// ---------------------------------------------------------------------------
// Step C4: a LIVE-blocking mined rule MUST be in the certified GENERATED set (ENFORCED_RULE_IDS).
// The codegen only emits a rule into that set after verifying its ledger entry + passing precision, so
// membership in the set IS the ledger+precision proof. Binding the backing predicates to set-membership
// closes the loop: a mined-taste rule can be live in RULES ONLY because it came from the generated set.
// ---------------------------------------------------------------------------
const inGeneratedSet = new Set(ENFORCED_RULE_IDS);
const generatedBacking: EnforcementBacking = {
  hasLedgerEntry: (id) => inGeneratedSet.has(id),      // in the certified set => the codegen verified the ledger
  hasPassingPrecision: (id) => inGeneratedSet.has(id), // in the certified set => the codegen verified precision
};
// EVERY mined-taste rule that is live in RULES must be in the generated set (it is the only source).
const strayMined = RULES.filter((r) => isMinedTaste(r.sourceVocabulary) && !inGeneratedSet.has(r.ruleId)).map((r) => r.ruleId);
ok(strayMined.length === 0, `every live mined-taste rule is in the certified generated set (stray: ${strayMined.join(', ')})`);
// The certified-set-backed invariant holds over the live registry (empty set today => vacuous, real once filled).
ok(minedTasteBlockingViolations(liveRules, generatedBacking).length === 0, 'certified-set-backed invariant holds over the live registry + enforced tier');
// MUTATION: a mined-taste blocking rule NOT in the generated set -> RED under the set binding.
const notCertified: MinedRuleView = { ruleId: 'mined.not-in-generated-set', sourceVocabulary: MINED_TASTE_VOCABULARY, severity: 'major' };
ok(minedTasteBlockingViolations([notCertified], generatedBacking).length > 0, 'C4 MUTATION: a live-blocking mined rule absent from the certified generated set is RED');

// ---------------------------------------------------------------------------
// report
// ---------------------------------------------------------------------------
if (failures.length) {
  process.stderr.write(`mined-taste-invariant.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
process.stdout.write(`mined-taste-invariant.test: all ${passed} assertions passed\n`);
