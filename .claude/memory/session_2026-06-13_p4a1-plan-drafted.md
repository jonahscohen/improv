---
name: P4a-1 plan drafted (rule registry + clean-eval model) - to Codex
description: P4a-1 plan written - four-status types, canonical product-rule-registry (seed + alias canonicalization), 3-registry capability model, generated clean policies + --check, deterministic 7-step clean-evaluation algorithm; validator adaptation -> P4a-2
type: project
relates_to: [session_2026-06-13_p4-decomposition.md, feedback_autonomous_phases_codex_partner.md]
---

First P4 sub-plan drafted: docs/superpowers/plans/2026-06-13-lane-p4a1-rule-registry.md
(6 tasks), grounded in spec section 7 lines 367-634 (registries,
ProductRuleDefinition, severity table, ProductValidationResult, cleanPolicy, the
7-step clean-evaluation algorithm).

**P4a-1 scope (model + algorithm + generation, NO execution, NO validator
adaptation):** product-rule-types.ts (CanonicalSeverity, ProductRuleDefinition,
ProductRuleResult, ProductFinding, ProductValidationResult, CleanPolicy,
RequiredCoverageRecord, SEVERITY_TABLE, isBlocking); product-rule-registry.ts
(SEED canonical rules exercising alias canonicalization of the duplicated
POLISH_* ids, severity override, DOM-only-non-required); flow-validation-
capabilities.ts (3 registries); generate-validators.ts + validators.generated.ts
(derive ownedRuleIds/registryScope/supportedSourceKinds/cleanPolicy/
requiredCoverageByScope + --check rejecting empty requiredRuleIds / multi-owner
canonicalKey / metadata gaps / undocumented severity divergence); clean-evaluator.ts
(deterministic 7-step evaluateCleanPolicy, four-status, tested in isolation).

**Deferred within P4:** P4a-2 = populate full floor-validator rules + adapt the
12 existing validators to emit ProductRuleResult/ProductValidationResult; P4b =
wire evaluateCleanPolicy into advanceLane gating + the async lease/outbox
durability (folded P3); P4c = loops + lane_converge + convergence floor; P4d =
MCP + cleanup.

**Lessons applied:** generated-not-authored (--check guarded); honest four-status
(status not findings.length; missing evidence -> inconclusive not pass);
per-rule-authoritative severity; trace every export to a test in its own task; no
execution coupling (pure model, so no lease/attestation hazards here).

Plan wrote dash-clean on the first try (P3 dash-bisection lesson held).

**Next:** commit -> Codex plan review -> fold -> execute via fresh team
(lane-p4a1-exec) -> Codex code review -> merge -> P4a-2.

Collaborator: Jonah.
