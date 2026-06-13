---
name: P4a-1 v3 Codex review - v4 fix-spec (10 closed, 2 open, ~7 new, all tractable)
description: P4a-1 v3 NEEDS-FIXES but 10 findings closed; remaining are tractable patches (TS6059 rootDir, evidence-compat union bug, 7-step order, capability seed vs spec 949, metadata+manifest guards, discriminated union, alias raw ids, unique ruleId); fix-spec for v4
type: project
relates_to: [session_2026-06-13_p4a1-v2-review-rewrite-spec.md, feedback_autonomous_phases_codex_partner.md]
---

Codex P4a-1 v3 (task-mqczmkyu; session 019ec351). NEEDS-FIXES. The clean rewrite
CLOSED 10: P1-1, P1-3 (core), P1-4, P1-8, P2-1, P2-3, Task5-compiles,
missing-rule-lookup, reproducible-coverage, dup-results, closed-error-vocab.

**v4 fix-spec (TASK-BODY edits; tractable):**
STILL-OPEN:
- P1-7: validateRegistry metadata guard checks only a subset - enforce ALL
  required fields non-empty (sourceVocabulary, sourceSeverity, registryScope,
  supportedSourceKinds, narrowTargetBehavior, applicability, findingClass, scope,
  ownerValidatorId, canonicalRuleKey). ADD the spec-required (628-634) fixture-
  MANIFEST rejection: --check fails on a missing clean/findings/inconclusive
  fixture manifest entry (generator checks manifest PRESENCE; tests execute them).
- P2-2: capability test must actually classify lane-MEMBER flows; AND the seed
  CONTRADICTS spec - it binds static-a11y to flowI_accessibility but spec:949
  says Flow I is ADVISORY (no bound product validator), and it omits lane_converge
  members M/K/L. Read spec 939-950 for the real flow->validator table and fix
  FLOW_CAPABILITIES + LANE_POLICIES to match.
NEW P1:
- TS6059 build break: generate-validators.test.ts imports ../../scripts/ (outside
  rootDir ./src) - the EXACT lane-derivation P2 issue. FIX per P2 precedent: move
  the importable logic (validateRegistry/deriveValidator/derivation) into a src/
  module (e.g. src/validator-generation.ts); scripts/generate-validators.ts is a
  thin wrapper; the test imports from src/.
- evidence-compat union FALSE-satisfaction: sourceKindsForEvidence unions kinds,
  so ['css-rule','markup'] includes css and a CSS-only run "satisfies" it. FIX:
  satisfaction = EVERY evidenceRequirement has >=1 present compatible source (AND
  across requirements; OR across that requirement's alternatives). Same fix in the
  generator's isStaticallySatisfiable (a rule is statically satisfiable iff EVERY
  required evidence kind is statically satisfiable).
- 7-step ORDER wrong: evaluator does missing-synth + coverage-conversion before
  step-2 non-vacuity. Spec 567-575: validator-error(1) -> non-vacuity(2) ->
  coverage(3). Reorder so non-vacuity precedes coverage conversion.
- requireAllDiscoveredApplicableFiles blanket-false for component/page weakens
  completeness (spec 526-533 wants every discovered applicable input checked).
  Derive from registry metadata (applicability/narrowTargetBehavior/scope), not a
  blanket scope check; default true unless metadata justifies otherwise.
NEW P2:
- ProductValidationResult should be a discriminated union: normalizedErrorCategory
  REQUIRED when status==='error' (spec 512-513).
- absolute-ban aliases use invented 'ban/gradient-text' - live findings expose
  banName 'gradient-text'/'identical-card-grids' (absolute-ban-detector.ts:110,159)
  with NO prefix. Use the raw banName as the alias OR specify a prefix-normalizing
  adapter.
- validateRegistry must reject duplicate canonical ruleId (currently only checks
  canonicalRuleKey + aliases).

**Honest convergence note:** this is the 4th P4a-1 iteration (draft/v2/v3/v4) and
3rd Codex round; 10 closed this round, ~9 remain, all tractable. P4a-1 is 1 of 5
P4 sub-plans, none executed yet. Full P4 at this fidelity is a large multi-session
grind. Flagged to Jonah in the turn status; continuing to drive per the mandate. If
a v5 is needed after this, that 5th round is the hard signal to reassess scope.

**Action:** dispatch a fresh planner agent (team lane-p4a1-plan2) to apply the v4
fix-spec to the v3 plan (TASK BODIES, no changelog split), then Codex re-review.

Collaborator: Jonah.
