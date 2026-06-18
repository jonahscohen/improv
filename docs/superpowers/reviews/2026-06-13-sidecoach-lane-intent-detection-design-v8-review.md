# Independent Review: Sidecoach Lane Intent Detection Design v8

**Date:** 2026-06-13  
**Reviewed design:** `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`  
**Review basis:** Current v8 design, prior v7 review findings, and the existing Sidecoach implementation

## Executive Verdict

V8 is materially stronger than v7. It resolves the previous rule-registry and evaluator-definition blockers by introducing a canonical declarative product-rule registry, explicit evaluator semantics, lane policies, progress signatures, source support checks, target scoping, and an async lease protocol.

The design is not yet implementation-ready. Two release-blocking contradictions remain:

1. The all-lanes Flow J source preflight prevents `lane_build` from starting on the fresh, ground-up projects it is intended to build.
2. The lease protocol can guarantee at-most-one committed checkpoint transition, but it cannot guarantee exactly-once async execution or side effects.

The remaining findings are narrower contract issues, but should be resolved before implementation because they affect persistence compatibility, convergence behavior, and the meaning of a successful validation result.

## Disposition of Prior Findings

V8 satisfactorily addresses the major v7 concerns around:

- A canonical `ProductRuleDefinition` registry.
- Defined product findings and canonical severities.
- A deterministic product-evaluation algorithm.
- Explicit per-lane policy rather than automatic policy widening.
- Progress signatures that include inconclusive and error outcomes.
- Unsupported-source detection.
- Explicit target path or glob support.
- Async timeout cancellation and checkpoint leasing.

Those additions make the architecture coherent enough to implement once the blockers below are corrected.

## Findings

### P0: The Lease Protocol Cannot Guarantee Exactly-Once Async Execution

The proposed lease, heartbeat, abort, and compare-and-swap protocol can prevent more than one operation from committing the same checkpoint transition. It cannot guarantee that an async operation executes exactly once.

An `AbortSignal` is cooperative. A timed-out handler can ignore cancellation and continue running. If its heartbeat then becomes stale, another caller may reclaim the lease and begin the same operation while the original execution is still active. Rejecting the old operation's final checkpoint commit does not undo its other side effects.

This is relevant to the current implementation because flow execution records persistent flow history and session memory outside a single fenced checkpoint commit. Two overlapping executions can therefore produce duplicate or conflicting side effects even when only one checkpoint transition is accepted.

**Recommendation**

- Replace the guarantee of “exactly-once execution” with “at-most-one committed lane transition.”
- Require validators and flows invoked during lane advancement to be pure or idempotent.
- Put unavoidable side effects behind a fenced finalization operation.
- Include a monotonically increasing fencing token or claimed checkpoint revision on every persistent write made by an operation.
- Explicitly state that lease expiry permits overlapping execution and only fences authoritative results.

Acceptance tests should prove that a superseded operation cannot commit authoritative state or persistent side effects after its lease is fenced. They should not claim to prove exactly-once execution.

### P0: Universal Source-Support Preflight Makes `lane_build` Unstartable

The design requires all sequence and loop lanes to preflight Flow J source support before work begins and reject execution when no supported source is found.

That conflicts with `lane_build`, whose purpose is a ground-up build. A valid fresh-build project may have no UI source until the lane creates it. The acceptance plan also requires every lane to pass a fresh-build fixture, making the contradiction observable in the design's own tests.

**Recommendation**

Make source-support preflight phase-aware:

- Refinement and convergence lanes should reject unsupported source at lane start.
- Build lanes should defer the Flow J source-support gate until the first step that requires product or visual validation.
- If a build lane reaches that gate without supported source, it should block there unless an explicit recorded bypass policy permits continuation.

Add a fresh empty-project acceptance test proving that `lane_build` can begin, create supported source, and then pass the deferred validation gate.

### P1: Loop Outcome Status Conflicts With Resumability and Retention Semantics

The design says terminal statuses are set only by explicit stop or final completion, but also maps stalled and capped loop outcomes to `partial` and errors to `failed`, while describing those outcomes as resumable.

Elsewhere, `partial` and `failed` are treated as terminal for listing and retention. This leaves `advance`, default listing, garbage collection, and resumption behavior ambiguous.

**Recommendation**

Separate lifecycle state from convergence outcome. For example:

- Lifecycle: `in_progress | interrupted | closed`
- Outcome: `converged | stalled | capped | error | stopped`

Alternatively, keep resumable stalled, capped, and error lanes in `in_progress` and record their outcome separately. Define listing and retention from lifecycle state only.

### P1: Lease Identity Is Insufficient for Loop Iterations

The lease identity contains `operationId`, `stepIndex`, and timestamps, while step reports are identified by step and iteration. Loop lanes can execute the same step index repeatedly, so a lease without iteration and stable step identity cannot precisely identify the work being claimed.

A stale lease from a previous iteration could block or be confused with a current iteration, and finalization lacks enough identity to prove it is committing the intended policy and target revision.

**Recommendation**

Include and validate at least:

- `operationId`
- `stepId`
- `iteration`
- `claimedCheckpointRevision` or fencing token
- Target identity
- Policy or capability revision/hash

Finalization should compare all authoritative identity fields before accepting results.

### P1: Absolute-Ban Tolerance Conflicts With Canonical Severity Mapping

The canonical mapping makes `P1` findings `major`, and `major` findings block clean validation. The proposed policy separately describes heuristic absolute-ban findings as minor and report-only.

The existing absolute-ban detector emits `P1` findings by default. Under the stated evaluator rules, those findings normalize to `major` and block, contrary to the intended policy.

**Recommendation**

Give each `ProductRuleDefinition` an authoritative canonical severity or an explicit rule-specific source-severity override. Do not depend solely on a global source-severity mapping where rule semantics intentionally differ.

Also define the exact key and lookup behavior for tolerated finding counts. The evaluator reasons over severity and class, while the current tolerance description appears keyed only by class.

### P1: Target Scoping Lacks Containment and Rule-Scope Semantics

The target may be a path or glob under the project root, but the design does not define:

- Realpath containment and symlink-escape handling.
- Glob syntax, negation, directory matching, or no-match behavior.
- Whether rules require file, component, page, or project context.
- What happens when a narrow target cannot provide enough context for a required rule.

Without these rules, a narrow target could run a project-wide rule over incomplete input and incorrectly produce a clean result.

**Recommendation**

Define a canonical target resolver that performs realpath containment checks, handles symlinks, and specifies glob and no-match behavior. Add rule scope or required context to `ProductRuleDefinition`. A required rule that cannot validly evaluate the selected target should return a disclosed inconclusive result rather than clean.

### P1: Clean Results May Still Contain Findings Without a Clear Downstream Contract

The evaluator permits a result to be `clean` while nonblocking or tolerated findings remain. This is a valid policy choice, but it conflicts with the common downstream assumption that clean means the findings list is empty.

The algorithm also refers to required-rule “error” outcomes even though the product-rule result model does not clearly define a rule-level error status.

**Recommendation**

- Define `clean` explicitly as “accepted under the active policy,” not “no findings.”
- Include separate accepted, blocking, tolerated, inconclusive, and error counts.
- Use wording such as “accepted with nonblocking findings” in summaries when findings remain.
- Define whether rule execution errors are represented as a rule status, a validator-level error, or both.

### P2: Precondition Reference Enforcement Needs Declarative Metadata

The generator must fail if a handler does not reference required stable precondition IDs. Proving arbitrary handler-body references would require brittle source inspection unless the reference is registered declaratively.

**Recommendation**

Add authored or generated `preconditionIds` metadata to handlers or handler registrations. Validate that metadata against lane requirements rather than parsing implementation bodies.

### P2: Capability Registration Still Risks Duplicate Sources of Truth

`ProductValidatorRegistration` still exposes fields such as owned rule IDs, supported source kinds, and clean policy while the design says these values are generated from canonical rule definitions.

If these fields remain authorable, registry and capability declarations can drift.

**Recommendation**

Mark all derived capability fields as generated, read-only outputs and validate that no independent authored copy exists. Derive whether a flow is a product validator directly from its bound rule IDs.

## Required Acceptance Additions

Before implementation, add acceptance coverage for:

1. `lane_build` starting from a project with no UI source and deferring source validation until the relevant gate.
2. A timed-out operation that ignores abort while a replacement operation acquires the lease.
3. A superseded operation attempting every supported persistent side effect after fencing.
4. Reclaiming a stale lease between two iterations of the same loop step.
5. Resuming stalled, capped, and error outcomes without violating terminal-status retention rules.
6. Absolute-ban findings proving the intended blocking or nonblocking policy.
7. Symlink escape, glob no-match, and project-wide rules evaluated against narrow targets.
8. A clean result containing tolerated findings and the exact downstream summary produced.

## Recommended Disposition

Revise before implementation.

V8 has the right overall architecture and resolves the central v7 design gaps. Correct the two P0 contradictions first, then tighten the lifecycle, lease identity, severity, and target-scope contracts. With those changes, the design should be suitable for an implementation plan and incremental delivery.
