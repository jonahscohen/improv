// sidecoach/src/validators/mined-taste-invariant.ts
//
// Phase 3b Step 7: the RUNTIME INVARIANT that keeps a build-BLOCKING mined-taste rule honest.
//
// A mined taste rule is ADVISORY until it crosses the second, precision-gated, human-signed
// enforce gate (bin/sidecoach-taste-enforce.js). The crossing is the ONLY sanctioned way a mined
// rule gets a blocking severity, and it appends a tamper-evident enforcement-ledger entry bound to
// a fresh passing precision measurement. This invariant is the fail-loud backstop for that gate:
//
//   EVERY rule with sourceVocabulary 'mined-taste' AND a blocking severity (blocker | major) MUST
//   carry (a) a matching enforcement-ledger entry AND (b) a passing precision record. Any that does
//   not is a rule that reached the blocking tier WITHOUT crossing the gate - a forged / hand-edited
//   / half-rolled-back enforcement - and the build/CI must fail loud rather than let it block.
//
// This module is a LEAF (it imports only the rule TYPES, no fs, no ledger crypto). The backing
// predicates - "does the enforcement ledger have an entry for this ruleId" and "is there a passing
// precision record" - are INJECTED by the caller (the suite reads the real ledger + precision cache;
// a unit test injects synthetic predicates). Keeping the predicates injected keeps this checkable in
// isolation and keeps the leaf from importing the data tier (the structural inertness invariant that
// forbids src/ reaching into data/guidance, the promotion/enforcement ledgers, or the enforced tier).
import type { CanonicalSeverity, SourceVocabulary } from '../product-rule-types';

/** The blocking severity set (mirrors validator-generation BLOCKING). */
export const BLOCKING_SEVERITIES: readonly CanonicalSeverity[] = ['blocker', 'major'];

/** The vocabulary tag every mined rule carries (bin/sidecoach-mine.js normalizeCandidate default). */
export const MINED_TASTE_VOCABULARY: SourceVocabulary = 'mined-taste';

/** The minimum shape the invariant needs off a rule (registry def OR an enforced-tier rule body). */
export interface MinedRuleView {
  ruleId: string;
  sourceVocabulary: SourceVocabulary | string;
  severity: CanonicalSeverity | string;
}

/** The two backing predicates the invariant is defined against - injected, never imported. */
export interface EnforcementBacking {
  /** True iff the enforcement ledger has an entry for this ruleId. */
  hasLedgerEntry(ruleId: string): boolean;
  /** True iff a passing precision record (P>=threshold, denominator over floor) exists for this ruleId. */
  hasPassingPrecision(ruleId: string): boolean;
}

export function isBlockingSeverity(sev: CanonicalSeverity | string): boolean {
  return (BLOCKING_SEVERITIES as readonly string[]).includes(sev);
}

export function isMinedTaste(vocab: SourceVocabulary | string): boolean {
  return vocab === MINED_TASTE_VOCABULARY;
}

/**
 * Return one human-readable error per invariant violation (empty => the invariant holds). A
 * violation is a mined-taste rule at a blocking severity that is missing its ledger entry and/or its
 * passing precision record. The caller fails loud (nonzero exit / a test failure) when this is
 * non-empty. Never throws.
 */
export function minedTasteBlockingViolations(rules: MinedRuleView[], backing: EnforcementBacking): string[] {
  const errors: string[] = [];
  for (const r of rules) {
    if (!isMinedTaste(r.sourceVocabulary)) continue;
    if (!isBlockingSeverity(r.severity)) continue;
    if (!backing.hasLedgerEntry(r.ruleId)) {
      errors.push(`mined-taste rule "${r.ruleId}" has BLOCKING severity ${r.severity} but NO enforcement-ledger entry - it reached the blocking tier without crossing the enforce gate`);
    }
    if (!backing.hasPassingPrecision(r.ruleId)) {
      errors.push(`mined-taste rule "${r.ruleId}" has BLOCKING severity ${r.severity} but NO passing precision record - blocking is not justified out of sample`);
    }
  }
  return errors;
}
