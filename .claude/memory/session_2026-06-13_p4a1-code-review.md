---
name: P4a-1 code review (Codex) - core SHIP-grade, 5 edge-case fixes to impl-p4a1
description: independent verify green (20 suites); Codex code review confirmed all core correctness; 1 P1 + 4 P2 edge-case hardening defects routed to impl-p4a1 before merge
type: project
relates_to: [session_2026-06-13_p4a1-v5-approved.md, feedback_autonomous_phases_codex_partner.md]
---

P4a-1 built by impl-p4a1 (5 commits: 1ae48ce, 89b6eb8, 6643c6a, 60fe491, df7d4e4).
MY independent verify: build exit 0, npm test 20 suites, both --checks OK, P1
hooks 110/0 + 35/0, branch diff = exactly 12 intended files, no scope leak.

Codex code review (task-mqd1k2b0; session 019ec383): CONFIRMED CORRECT - four-status
+ discriminated union, ordered 7-step eval, real missing-rule metadata (when
registry has it), tolerance counting, reproducible coverage, findings preservation,
per-file AND per-requirement coverage (CSS-only can't satisfy CSS+markup), generated
required ids/coverage/zero-tolerance/capability/manifest/drift, lane-derived
capability test, 6-rule seed, no scope leak / no TS6059.

**5 defects -> impl-p4a1 (NEEDS-FIXES, all edge-case):**
- P1 clean-evaluator.ts:71 - a required ruleId with NO registry definition at all
  (registry fault) currently fabricates advisory metadata + returns inconclusive;
  it must be a validator-level ERROR (registry_fault) BEFORE non-vacuity. Preflight
  every required id through getRuleById; remove the advisory fallback. (Distinct
  from: required id present in registry but no RESULT this run -> inconclusive, which
  is correct.)
- P2 clean-evaluator.ts:132 - duplicate required results are order-sensitive
  ([fail, not_applicable] takes the vacuous branch + drops the fail; reversed
  synthesizes inconclusive). Normalize duplicated required ids deterministically
  before the vacuity return; test BOTH orders.
- P2 validator-generation.ts:100 - validateRegistry accepts sourceRuleAliases:[''];
  reject empty-string alias entries.
- P2 validator-generation.ts:142 - unknown/typoed sourceSeverity bypasses the
  divergence guard (missing SEVERITY_TABLE entry ignored); reject a sourceSeverity
  with no table entry.
- P2 validator-generation.ts:157 - an UNREGISTERED gating validator passes (only
  registered validators checked); a LaneValidationPolicy.requiredProductValidatorId
  with no ProductValidatorRegistration must be rejected.

Each fix needs a failing-first test. After fixes: re-verify (20+ suites, --checks),
optional Codex confirm, merge to main, then P4a-2.

Collaborator: Jonah.
