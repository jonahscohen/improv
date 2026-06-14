---
name: P4a-1 COMPLETE - rule registry + clean-eval foundation built, reviewed, merged
description: P4a-1 (canonical product-rule registry + 3-registry capability model + generated clean policies + deterministic clean-evaluation) built (10 commits), independently verified, Codex code review confirmed core + 5 edge fixes; merged to main
type: project
relates_to: [session_2026-06-13_p4a1-v5-approved.md, session_2026-06-13_p4-decomposition.md, feedback_codex_takeover_on_round_fail.md]
---

P4a-1 COMPLETE and merged to main. The first P4 sub-plan (the validator
identity + evaluation FOUNDATION). Notable: the PLAN converged only via the
role inversion (Codex authored v5 after my-authoring stalled 4 rounds, I
reviewed+approved); EXECUTION ran the normal loop (impl-p4a1 built, I verified,
Codex code-reviewed, impl-p4a1 fixed, I verified, merged).

**Deliverable:** product-rule-types.ts (four-status types + discriminated-union
ProductValidationResult + evidence-compatibility model + SEVERITY_TABLE);
product-rule-registry.ts (6 canonical seed rules, cross-registry POLISH aliasing,
absolute-ban severity override, DOM-only owned-but-non-required);
flow-validation-capabilities.ts (3 registries, baseCapability + generated
capability); validator-generation.ts (pure deriveValidator/validateRegistry/
deriveFlowCapabilities/validateFixtureManifest in src/ - no TS6059) +
scripts/generate-validators.ts (thin --check wrapper) + validators.generated.ts;
clean-evaluator.ts (deterministic 7-step evaluateCleanPolicy: non-vacuity before
coverage, per-file AND per-requirement coverage, findings materialized on every
status, registry-fault->error, order-insensitive duplicate handling, reproducible
coverage). NO validator adaptation (P4a-2), NO execution wiring (P4b).

**Verification (3 legs):** impl-p4a1 self-report + MY independent re-run (build
exit 0, npm test 20 suites, both --checks OK, P1 hooks 110/0+35/0, branch diff =
exactly 12 files, no scope leak) + Codex code review (confirmed all core
correctness; 1 P1 + 4 P2 edge-case guards fixed: registry_fault-vs-inconclusive,
order-insensitive dup, blank-alias reject, unknown-sourceSeverity reject,
unregistered-gating-validator reject - each with a failing-first test).

**Commit chain (10 on lane-p4a1-rule-registry):** 1ae48ce 89b6eb8 6643c6a 60fe491
df7d4e4 (5 tasks) + e683d48 767ec09 ec6340c 157e33b 56fae28 (5 code-review fixes).

**KEY LESSON (role inversion):** when me/agent-authoring stalled on the intricate
foundation plan (4 rounds), Codex authoring + me reviewing converged in 1 pass.
Apply proactively to deeply spec-bound sub-plans. [[feedback_codex_takeover_on_round_fail.md]]

**NOT pushed** to origin (Jonah's outward call; consistent with P1/P2).

**Next:** P4a-2 (populate full floor-validator rules + adapt the 12 existing
validators to emit ProductRuleResult/ProductValidationResult). Then P4b (async
exec + durability), P4c (loops+convergence), P4d (MCP+cleanup).

Collaborator: Jonah.
