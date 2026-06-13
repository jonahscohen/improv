---
name: P4a-1 plan v2 - all Codex findings folded - re-Codex
description: P4a-1 v2 rewrites evaluateCleanPolicy (findings materialization + missing-required-rule + coverage plan), adds sourceSeverity/checkProduct?/validateProduct? types, generated capability, exact generator derivation + negative tests + full seed + corrected alias semantics
type: project
relates_to: [session_2026-06-13_p4a1-codex-review.md, feedback_autonomous_phases_codex_partner.md]
supersedes: session_2026-06-13_p4a1-plan-drafted.md
---

P4a-1 revised to v2 (same file, git has v1 at cd907c1), folding all 11 Codex
findings (8 P1 + 3 P2).

**v2 changes:**
- Evaluator REWRITTEN (P1-1/2/3): materializes a ProductFinding per effective
  fail (preserved for every status incl clean); iterates EVERY requiredRuleId so
  a missing/coverage-gapped required rule -> inconclusive (never silently clean);
  returns the effective rule set; consumes run-derived coverageSatisfiedRuleIds
  keyed to requiredCoverageByScope. +tests for missing-required, coverage-gap,
  findings-on-clean.
- Types (P1-4/5): ProductRuleDefinition += sourceVocabulary + sourceSeverity
  (makes the --check severity-divergence guard implementable) + optional
  checkProduct?; ProductValidatorRegistration += optional validateProduct?;
  FlowValidationCapability.capability GENERATED in P4a-1 (authored array
  --check'd against generated).
- Generator EXACT (P1-6, P2-3): pure requiredRuleIds predicate
  (evidenceRequirements all non-DOM/computed/contrast); per-rule coverage record
  derivation; EXPLICIT zero tolerance per owned blocking (severity,class) pair.
- Generator guards + negative tests (P1-7): pure validateRegistry/deriveValidator
  + failing-first fixtures for each rejection (empty requiredRuleIds, missing
  metadata, two owners, conflicting alias, unsatisfiable coverage, undocumented
  severity divergence).
- Full 6-rule seed, no placeholder (P1-8). Alias semantics CORRECTED (P2-1): 22
  canonical rules each with cross-registry aliases (polish-standard id +
  extended-domain POLISH_0NN), NOT all-22->one; test representative + conflicting.
- Capability test rigor (P2-2): exact generated-capability equality + every owner
  registered + lane members classified.

File verified: 531 lines, 0 NUL, 0 dashes, v2.

**Next:** commit -> Codex confirm -> if converged, execute via fresh team
(lane-p4a1-exec) -> code review -> merge -> P4a-2. Per autonomous mandate, this is
P4's foundation; remaining P4 sub-plans (a-2, b, c, d) follow the same loop.

Collaborator: Jonah.
