---
name: lane spec v9 - self-audit repair pass
description: Jonah asked me to find/fix issues myself before his review agent runs; full consistency sweep of v8 caught 11 real defects (most v8-introduced interaction bugs), all repaired; bumped to v9
type: decision
relates_to: [session_2026-06-13_lane-v8-review-and-loop-gutcheck.md, session_2026-06-13_lane-design-v8-declarative-rule-registry.md]
supersedes: session_2026-06-13_lane-v8-review-and-loop-gutcheck.md
---

Jonah's instruction: "take a really careful look at what you made and evaluate
for issues/gaps, repair, then I'll run my review agent against it." This is the
right intervention - the whole review-loop pattern was that I fixed one section
and contradicted another (interaction defects), never self-auditing the whole
document. v9 is that missing self-audit.

Read the entire v8 spec critically and found 11 real issues (most are
interaction defects v8 itself introduced - the exact failure mode):

1. Header stale: "once-only execution" (the corrected-away overclaim) -> v9
   header rewritten, bumped to v9.
2. Severity: per-rule `ProductRuleDefinition.severity` vs a global
   normalization table were both present, unreconciled, and absolute-ban P1
   ->major->blocking contradicted the "tolerated" intent. Fix: table is a
   GENERATION-TIME default only; per-rule severity is authoritative;
   absolute-ban rules declare `minor` (non-blocking by construction since
   minor not in blockingSeverities); --check flags undocumented divergence.
3. Two-sources-of-truth: ProductValidatorRegistration listed ownedRuleIds/
   registryScope/supportedSourceKinds/cleanPolicy as authorable AND generated.
   Fix: those are GENERATED (read-only) from product-rule-registry; only
   validatorId/label/validateProduct authored; --check fails authored-vs-
   generated drift. Same for FlowValidationCapability.capability (derived).
4. clean-with-findings undefined: clean now explicitly = "accepted under
   policy", NOT "findings empty"; added findingCounts {blocking, tolerated};
   downstream reads status not findings.length.
5. Rule-level error undefined: ProductRuleResult.status has no 'error' - a
   rule throw is CAUGHT -> inconclusive + normalizedErrorCategory;
   validator-level error lives on ProductValidationResult. Algorithm reworded.
6. Lease struct mismatch: CLAIM wrote {operationId, stepIndex, startedAt,
   heartbeatAt} but FINALIZE validated {operationId, stepId, iteration,
   claimedCheckpointRevision}. Fixed both the lease block and checkpoint
   schema to the full identity (+ iteration distinguishes loop re-executions).
7. Lifecycle vs outcome (biggest): v8 mapped stalled/capped->partial/failed
   (terminal per retention) while calling them resumable - a contradiction.
   Fix: split LaneState into lifecycle (in_progress|interrupted|closed,
   governs listing+retention) and outcome (converged|stalled|capped|error|
   stopped|completed|partial, recorded separately). stalled/capped/error loop
   = lifecycle in_progress (resumable); only stop/final-completion/converged
   -> closed. Updated status-precedence, loop-mapping, transitions, checkpoint
   schema, retention, convergence sub-state (status->outcome), LaneStepResult.
8. Flow J registryScope claimed the full 90-rule extended matrix while the
   canonical-key partition delegates theming/anti-pattern/a11y to the slice
   validators - re-introducing the v7 ownership collision. Fix: Flow J owns
   only the non-delegated subset.
9. "executes exactly once per convergence iteration" acceptance line read as
   clashing with at-most-one-committed -> reworded to "invoked once"
   (scheduling sense). Same for the transition-struct comment and the
   concurrent-advance acceptance line ("exactly one COMMITS").
10. Target scope lacked containment/glob/rule-scope: added realpath
    containment, explicit glob semantics + zero-match-is-error, and a `scope`
    field on ProductRuleDefinition so a narrow target can't falsely-clean a
    project-scope rule (-> inconclusive).
11. Precondition-id enforcement implied source-body inspection (contradicting
    "generator never reads bodies"): made it a declarative
    `enforcesPreconditionIds[]` field validated by --check.

Verified post-repair: fences balanced (30), no stale field names
(toleratedFindingCountsByClass/stepIndex/convergence.status/once-only all
gone), all four remaining "exactly once" are the corrected sense, new fields
(lifecycle x18, outcome, toleratedFindingCounts, findingCounts,
normalizedErrorCategory, claimedCheckpointRevision, enforcesPreconditionIds,
scope) used consistently. Committed; ready for Jonah's review agent.

**Self-analysis (why this pass mattered):** across v7/v8 I made section-local
edits to a large interlocking contract without auditing cross-section
interactions, so each revision shipped new contradictions. The discipline I
was missing is a whole-document consistency sweep AFTER any multi-section edit
- treat the spec like a typed program and check that every renamed
field/enum/contract is consistent at every use site. That's now a standing
habit for spec work, not a one-off.

Files touched: docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md (v9: 11 issue repairs + 3 residual consistency fixes)
