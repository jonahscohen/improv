---
name: P4a-1 plan v3 - clean rewrite (task bodies correct, no changelog drift)
description: Rewrote docs/superpowers/plans/2026-06-13-lane-p4a1-rule-registry.md to v3 - deleted the v2 changelog, made every task body spec-faithful, addressed all 13 fix-spec findings in the bodies themselves
type: project
relates_to: [session_2026-06-13_p4a1-v2-review-rewrite-spec.md, session_2026-06-13_p4a1-plan-v2.md]
---

Rewrote the P4a-1 plan in place to v3 per the complete fix-spec
(session_2026-06-13_p4a1-v2-review-rewrite-spec.md). v3 is 1165 lines, 0 unicode
dashes, 0 NUL, title ends ` - v3`.

**Why:** v2 NEEDS-FIXES root cause was a changelog block whose "binding
requirements" contradicted the still-old task bodies. A changelog that
contradicts its task bodies is worse than none. v3 DELETES the `## What changed
in v2` section and makes the task bodies themselves correct (kept a short
`## What changed in v3` pointer that points AT the bodies, not away).

**How (each fix-spec finding -> where in v3):**
- P1-1 materialize findings before early returns -> Task 5 `evaluateCleanPolicy`
  computes `findings` from effective fails once and returns them on every
  non-error status; error returns `findings: []`.
- P1-3 consume requiredCoverageByScope -> Task 5 adds `CoverageObservation`
  (run-derived: inspectedFiles/discoveredApplicableFiles/evidenceKindsPresent) +
  `isCoverageSatisfied()` satisfaction fn (requireAllDiscovered superset check +
  evidence-present check). Not a renamed id list.
- P1-4 generated capability via authored base -> Task 3 authors
  `{flowId, productValidatorIds, baseCapability:'advisory'|'none'}` + pure
  `deriveCapability`; Task 4 emits GENERATED_FLOW_CAPABILITIES and --check asserts
  equality. ProductValidatorRegistration += optional `validateProduct?`.
- P1-7 pure validateRegistry/deriveValidator + per-case negative fixtures ->
  Task 4 exports both; test has failing-first fixtures for empty-required,
  missing-metadata, two-owners, conflicting-alias, unsatisfiable-coverage,
  severity-divergence.
- P1-8 all 6 seed rules in full -> Task 2 spells out all 6 with sourceVocabulary
  + sourceSeverity (no "author the rest in the same shape").
- P2-1 correct alias semantics + real ids -> 22 semantic rules; each canonical
  rule aliases the polish-standard numeric id (`polish-standard:18`) AND the
  extended-domain `POLISH_018` for the SAME semantic. Killed the invented
  `EXT_POLISH_001`. Cross-registry + conflicting-alias both tested.
- P2-2 capability test rigor -> Task 3 asserts deriveCapability formula exactly +
  every owner registered + every lane-member classified; Task 4 --check enforces
  file-level equality.
- P2-3 explicit zero tolerance -> Task 4 generator emits `{severity|class:0}` for
  every owned blocking pair, not `{}`; test asserts `blocker|a11y === 0`.
- NEW P1 Task 5 test compiles -> passes validatorId + coverageObservations +
  runCoverage (removed inspectedRequiredRuleIds).
- NEW P1 missing-rule synthesis uses real def -> `synthInconclusive` calls
  `getRuleById` for canonicalRuleKey/severity/findingClass; only a true registry
  gap falls back to advisory+registry_fault (never invents 'major'/'unknown').
- NEW P1 reproducible coverage -> `RunCoverage` carried onto every result via
  `baseCoverage(run)`; test asserts inspectedFiles + measuredScope survive.
- NEW P1 evidence-compatibility model -> Task 1 defines
  `EVIDENCE_SOURCE_COMPATIBILITY` (dom/computed-style/contrast -> []),
  `sourceKindsForEvidence`, `isStaticallySatisfiable`; generator + coverage guard
  read the same map.
- NEW P2 duplicate required-rule results -> evaluator detects dup ruleIds and
  marks them inconclusive (does not collapse via Map); test covers it.
- NEW P2 validatorError.category closed vocab -> typed `NormalizedErrorCategory`.

Seed rules grounded in LIVE validators (real source ids/severities): polish id 18
Focus Visible / id 19 Reduced Motion / id 5 Min Hit Area (`critical`),
extended-domain `POLISH_0NN`, taste `taste/hex-in-interactive-state` (`error`),
absolute-ban `gradient-text` (P1, CSS-side precise) and `identical-card-grids`
(P1, heuristic -> declared `minor` override citing absolute-ban-detector.ts:19-21).

Scope held: model + algorithm + generation ONLY (validator adaptation = P4a-2,
execution = P4b). Did NOT commit (lead commits). Did NOT execute the plan.

Files touched: docs/superpowers/plans/2026-06-13-lane-p4a1-rule-registry.md
(overwritten v2 -> v3).

Collaborator: Jonah.
