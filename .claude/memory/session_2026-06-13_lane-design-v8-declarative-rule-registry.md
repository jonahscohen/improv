---
name: lane intent detection design v8 - declarative rule registry
description: v8 folds the two convergent cross-model P0s (external + Codex both hit clean-evaluator + rule-metadata) plus the Codex-only async-lease and the per-review P1/P2s; both reviews say implementation can begin after this
type: decision
relates_to: [session_2026-06-13_lane-design-v7-first-class-validators.md, session_2026-06-13_codex-v7-review-findings.md]
supersedes: session_2026-06-13_lane-design-v7-first-class-validators.md
---

Spec revised to v8 after TWO independent v7 reviews arrived together: the
external reviewer (`reviews/2026-06-13-...-v7-review.md`) and the Codex/GPT-5.4
cross-model review I ran (job task-mqbyt31x-kiwn6h). Headline: CROSS-MODEL
CONVERGENCE - both, independently, hit the same two top P0s. That is the
strongest signal yet that those two are real and central, not reviewer noise.

**Convergent P0s (both reviews):**
1. Clean-policy evaluator can't be built from the v7 result schema -
   ProductFinding undefined, ProductRuleResult had no severity/class,
   cleanPolicy needs blockingSeverities + toleratedFindingCountsByClass, and
   the three source severity vocabularies (critical|high|medium|low /
   P0|P1|P2 / error) were never unified.
2. Deterministic policy generation had no declarative rule metadata - v7's
   "selection rules" were prose over arbitrary checkFunction bodies; a
   generator can't decide static-vs-DOM without reading function source =
   the mirror-drift the design exists to avoid.

**The unifying fix (external reviewer's prescription, adopted): canonical
declarative ProductRuleDefinition registry** (new product-rule-registry.ts).
Each rule declares canonicalRuleKey, ownerValidatorId, severity (canonical),
findingClass, registryScope, evidenceRequirements, per-rule
supportedSourceKinds, applicability, checkProduct. ownedRuleIds,
requiredRuleIds, minimumCoverageByScope, and source-support are all GENERATED
from it (no checkFunction-body inspection). Dissolves BOTH P0s + several P1s:
- canonicalRuleKey kills the v7 rule-ownership collision (Flow J "all
  statically-determinable polish rules" overlapping the anti-pattern/a11y
  slices) AND the semantic-alias double-count (the 22 POLISH_001..022
  duplicates aliasing the polish-standard 1..22).
- per-rule supportedSourceKinds fixes the binary-can't-express-partial P0 and
  the LESS/TSX coverage-vs-support mismatch.
- ProductFinding + CanonicalSeverity (blocker|major|minor|advisory) +
  normalization table + a single ordered clean-evaluation algorithm
  (coverage -> block on required inconclusive/error -> count by severity/class
  -> apply tolerances -> one status), persisted so a clean decision is
  reproducible.

**Codex-only depth P0 (the NEW class): async-lease.** Bare CAS can't guarantee
once-only execution because lane work is async - MCP Promise.race leaves
timed-out handlers running, no AbortSignal reaches them. v8: operation-lease
protocol (claim under O_EXCL CAS writing an in-flight lease, execute async
with an AbortSignal + heartbeat, finalize under CAS verifying same
operationId); a live-lease second advance is rejected, stale lease (dead
heartbeat) reclaimable+logged; MCP propagates abort into handlers. StepReport
gains stepId/iteration/reportId for idempotency; checkpoint gains
lease/seenReportIds.

**P1s folded:** explicit lane policy - promotion NEVER auto-widens the gate
(--check forces required-or-excluded classification; removed the contradictory
self-widening text in 3 places incl. an acceptance test); progress signature
now includes failed/inconclusive rule ids + coverage-gap identities + error
category (not findings-only), stable identities only; FOUR executability gates
not three (flowA canExecute:true then errors without PRODUCT.md - verified
flow-handler-brand-verify.ts:33-61), precondition IDs referenced by handlers,
per-lane no-PRODUCT/no-DESIGN matrix SUPPLIED; decision-flow reordered so an
explicit verb beats CONTEXT-CHECK/OUT_OF_SCOPE (primary VERB + non-routing lane
diagnostic = zero verb-overrides); Flow J unsupported-source rejection extended
to SEQUENCE lanes (preflight, not stuck-inconclusive); validator target grammar
(path/glob vs project sentinel).

**P2s:** realpath project-identity canonicalization (history/checkpoint/
--project/lane state one key); validators-decide-clean terminology (flow
capability derived from bindings); ONE invalid-regex policy (structure invalid
= disable tier; one bad pattern = skip+log); generation-vs-test responsibility
split (generator = manifest presence, suite = execute fixtures).

**Both reviews' verdict on the path:** neither asks for a round 9. Both say
implementation can BEGIN once the declarative registry + evaluator land - which
v8 now contains. Disposition tables: everything Approve except the two P0s,
which v8 resolves. The cross-model convergence updated my prior "go build, it's
diminishing returns" read: the two P0s were a missing FOUNDATION (rule
metadata), not churn - the kind of thing that would force a painful
mid-implementation refactor if left to TDD. Resolving it in-spec first was
right. The async model in the Codex P0 confirms the value of a cross-model pass.

**Next:** implementation plan (writing-plans). Stage classifier + 5 sequence
lanes first (they need the lease/state-machine + the four-gate preflight, NOT
the floor validators); convergence floor (rule registry, 4 product validators,
Flow J hardening) second. The Codex review gate (enabled this session) guards
each implementation stop.

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v8 edits)
