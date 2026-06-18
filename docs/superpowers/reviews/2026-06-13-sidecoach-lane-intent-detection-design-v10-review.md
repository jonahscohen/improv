# Independent Review and Revision Report: Sidecoach Lane Intent Detection v10

**Date:** 2026-06-13
**Reviewed input:** v9 of `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`
**Result:** The design document was directly revised to v10

## Executive Verdict

V9 correctly resolved the two v8 release blockers and most previously reported
contract gaps. It was not yet implementation-ready because several remaining
contradictions could still produce duplicate side effects, permanently
inconclusive lanes, invalid state, or incompatible implementations.

The design has been revised in place as v10. The identified contract defects
are now resolved in the document. No remaining release-blocking internal
contradiction was found in the final pass.

Implementation should proceed incrementally. The async lease/outbox protocol,
canonical rule inventory, and coverage planner are substantial independent
pieces and should be proven before the full lane surface is enabled.

## Repository Validation Basis

The review checked the design against the current implementation, including:

- `checkpoint-store.ts`: checkpoints are project-local and currently use
  schema v1 atomic writes without revision, lease, or outbox support.
- `sidecoach-orchestrator.ts`: flow execution currently writes flow history and
  session memory outside a fenced checkpoint transition.
- `flow-history.ts`: history is append-oriented, so attaching a fencing token
  to an already-written stale entry would not retract it.
- `ralph-loop.ts`: a current iteration executes the entire flow chain, which
  required the new lane state machine to define an explicit iteration boundary.
- `flow-prerequisites.ts`: prerequisites count only successful flows, confirming
  that a skipped prerequisite cannot safely serve dependent steps.
- MCP timeout handling: async handlers can continue after timeout, requiring
  cooperative cancellation plus authoritative-result fencing.

## Defects Corrected in v10

### 1. Missing `partial` Outcome

V9 used `partial` as a terminal sequence outcome but omitted it from the
declared outcome union.

**Revision:** Added `partial` to the canonical outcome type and retained
lifecycle as the only listing/retention axis.

### 2. Undefined Loop Execution Boundary

V9 said lane-policy validators run once per iteration, while the general step
contract also ran flow-bound validators at step completion. Flow J could
therefore run twice, and implementations could disagree about when an
iteration ended.

**Revision:** A loop now walks each coaching verb step once and invokes the
explicit lane-policy validators exactly once after the final verb step. Flow
bindings gate sequence steps only. Loop skips cannot bypass the boundary gate.

### 3. Flow-J-Only Source Preflight Was Too Narrow

V9's phase-aware timing fixed the fresh-build blocker, but preflight still
checked only Flow J. `lane_converge` could start when Flow J had support but
another required release-floor validator did not, guaranteeing an inconclusive
loop.

**Revision:** Preflight now evaluates the generated coverage plan for every
required applicable rule in the active step or lane policy. It remains
phase-aware for `lane_build`.

### 4. Fencing Tokens Alone Could Not Repair Early Side Effects

V9 required persistent writes to carry a fencing token. That does not repair an
append-oriented stale write made before another operation fences it.

**Revision:** Async execution must collect persistent effects locally. Only a
successfully finalized operation creates a committed side-effect outbox record.
Publishers idempotently apply that record using logical keys and fencing tokens.
Pending outbox records prevent checkpoint garbage collection.

### 5. Retried Starts Could Create Duplicate Lanes

The lease protocol covered `advanceLane` but not a timed-out and retried
`startLane`.

**Revision:** `startLane` now requires a durable `startRequestId`, creates one
checkpoint and first-step lease under the project lock, and uses the same
finalize/outbox protocol as advancement.

### 6. Live Operations Could Not Be Cancelled

V9 rejected a second transition while a lease was live, conflicting with the
requirement that user interruption or stop cancels current work.

**Revision:** `interrupt` and `stop` are priority control transitions that fence
and clear the live lease, advance the persisted fencing counter, and trigger
cooperative abort. Other transitions remain rejected while the lease is live.

### 7. Skip Could Serve an Unexecutable Dependent Step

V9 said a skip immediately serves the next step, while checkpoint-local
prerequisites require successful completion rather than ordering alone.

**Revision:** A sequence skip is rejected when it would leave a remaining
non-waived hard prerequisite unsatisfied. Loop skips affect coaching only.

### 8. Target Scope Could Be Permanently Inconclusive

V9 made a broader-scope required rule inconclusive under a narrow target. Since
required inconclusive rules block, such a lane could never complete. It also
rejected every zero-match target, conflicting with a build aimed at a future
file.

**Revision:** Rules declare deterministic narrow-target behavior: expand and
disclose context, exclude and disclose the unverified claim, or reject the
target. Runtime gates must remain non-vacuous. `lane_build` may use a contained
future literal path, but not an ambiguous zero-match glob.

### 9. Coverage and Alias Contracts Were Underspecified

V9 described coverage as a union of source kinds, which did not express whether
kinds were alternatives or jointly required. Duplicate semantic rules also had
one canonical key but no explicit single-execution representation.

**Revision:** The generated coverage plan now contains per-rule supported
evidence alternatives and applicable-file requirements. Each canonical rule
has one executable definition; duplicated source IDs are non-executable
aliases.

### 10. Clean and Error Semantics Still Contradicted Their Types

V9 allowed tolerated findings in a clean result but separately required every
required rule to pass. It also used a normalized validator error category in
progress signatures without defining it on the validator result.

**Revision:** Clean now means no required inconclusive result, no validator
error, and no finding above blocking tolerance. Finding counts distinguish
blocking excess, within-tolerance, and nonblocking findings. A closed normalized
error-category vocabulary is part of `ProductValidationResult`.

### 11. Project-Local Lookup and Identifier Hardening Were Incomplete

The engine API accepted only checkpoint IDs even though checkpoint lookup is
project-local. Checkpoint and start-request identifiers also lacked explicit
path and length constraints.

**Revision:** Project path is explicit for advance/status/list calls.
Checkpoint IDs use a strict opaque format, start-request IDs are length-capped
and hashed for lookup, and target containment is rechecked at validator read
time.

## Remaining Implementation Risks

These are delivery risks rather than unresolved design contradictions:

1. The lease, priority cancellation, fencing counter, and outbox protocol
   should be implemented and stress-tested as an isolated persistence milestone
   before lane handlers depend on it.
2. Building the canonical rule registry requires a complete inventory and
   semantic deduplication of existing polish and extended-domain rules.
3. Rule applicability, target-scope behavior, and supported-evidence
   alternatives require careful authored metadata; weak metadata would make
   the generated coverage plan misleading.
4. Static accessibility support for JSX/TSX must be proven against fixtures
   before it can participate in the release floor.
5. Schema-v1 checkpoint migration and project-scoped flow-history migration
   need rollback and corruption fixtures.

## Recommended Implementation Order

1. Persistence foundation: project identity, schema v2 migration, revisions,
   locks, leases, cancellation, start idempotency, and outbox publishing.
2. Canonical rule registry, alias mapping, generated policies, and clean
   evaluator.
3. Target resolver, applicability discovery, coverage planner, and source
   preflight.
4. Sequence lane state machine and prerequisite-safe transitions.
5. Loop iteration boundary and convergence state.
6. Classifier, hook/MCP parity, generated documentation, and release-floor
   enablement.

## Final Recommendation

The revised v10 design is suitable to move into an implementation plan.

Do not implement it as one change set. Gate `lane_converge` until the required
static validator slices, non-vacuous coverage plans, and persistence race tests
all pass exactly as specified.
