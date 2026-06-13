---
name: lane spec v10 - external review-repair (read + assessed)
description: The spec advanced to v10 (uncommitted review-repair on top of my committed v9); read the full v9->v10 diff and assessed it as clean - first revision in the chain that improved without regressing
type: project
relates_to: [session_2026-06-13_lane-v9-self-audit-repair.md]
supersedes: session_2026-06-13_lane-v9-self-audit-repair.md
---

CURRENT STATE OF THE SPEC: it is **v10**, an UNCOMMITTED working-tree edit
(354 ins / 165 del) on top of my committed v9 (commit 5ce0ae0). Authored by
Jonah / his review agent between turns, not by me. A future session must treat
v10 (working tree) as current, NOT v9 (last commit). If still uncommitted,
it needs committing.

Read the entire v9->v10 diff (862 lines). v10 = "REVIEW REPAIR pass over v9",
closing the executable-contract gaps my v9 left. What it added (all sound):

- **Transactional side-effect outbox + fencing tokens** - the correct answer to
  the cooperative-abort overlap problem my v9 only half-solved. EXECUTE buffers
  side effects operation-locally (no direct flow-history/session-memory writes);
  FINALIZE writes a committed outbox record keyed by (checkpointId,
  committedRevision)+fencingToken; PUBLISH upserts downstream by logical key
  guarded by monotonic fencing token; startup replay worker; GC never reaps a
  checkpoint with an unconfirmed outbox record. `fencingCounter` on the
  checkpoint, bumped on every claim/reclaim/priority-cancel.
- **startLane idempotency** - required `startRequestId` transport key mapped to
  one checkpoint under lock; start uses the same EXECUTE/FINALIZE/outbox path.
- **Explicit projectPath on every engine call** (checkpoint IDs are
  project-local); checkpoint IDs are opaque/safe-charset, startRequestId hashed,
  never used as a filename.
- **Loop iteration boundary defined** - loop walks verb steps once collecting
  StepReports; flow-bound validators gate SEQUENCE steps only; in a loop the
  LaneValidationPolicy supersedes member-flow bindings (no double-run); the
  iteration boundary invokes each requiredProductValidatorId once. Fixed my v9
  ambiguity that could have double-run Flow J.
- **Policy-wide phase-aware preflight** - my v9 checked only "Flow J can parse
  one file," which would admit a target another floor validator can't evaluate.
  v10 builds the active requiredCoverageByScope plan and checks every required
  rule for every required validator. lane_build still defers to its polish gate.
- **narrowTargetBehavior** ('evaluate_expanded_context'|'exclude_and_disclose'|
  'reject_target') - replaces my v9 "default to inconclusive" which could strand
  a never-completable lane; a required rule may NOT silently go inconclusive on
  a narrow target.
- **sourceRuleAliases[]** - one executable ProductRuleDefinition per canonical
  key; duplicate source ids (POLISH_001..022) are aliases, never scheduled
  separately. Sharpens my v9 canonical-key dedup.
- **NormalizedErrorCategory** closed vocab (I'd referenced it undefined);
  findingCounts -> {blockingExcess, withinTolerance, nonBlocking} with explicit
  arithmetic; requiredCoverageByScope as an executable plan (not a source-kind
  union); missing `partial` outcome added; loop outcome DERIVED from
  convergence.outcome (no drift); skip gated by sequence-dependency / loop
  boundary; target containment rechecked at read time (TOCTOU symlink swap).

ASSESSMENT: verified internally consistent - fences balanced (30), every rename
complete (0 stale minimumCoverageByScope), all new fields used consistently,
findingCounts/outcome shapes coherent throughout. CRUCIALLY: unlike v8 (which
introduced new P0s while fixing old ones), v10 did NOT introduce a new
contradiction. This is the FIRST revision in the chain that cleanly improved
without regressing - the whole-document consistency discipline (the lesson from
v9) applied by whoever authored v10 worked.

One minor OPEN OPERATIONAL EDGE I spotted (not a contradiction, not a blocker):
a permanently-failing declared outbox publisher pins its checkpoint forever
(never GC-eligible) - v10 says retry-until-confirmed but bounds no retries and
defines no dead-letter. Worth a bounded-retry/dead-letter note before
implementation, but it's an ops edge, not a contract gap.

NOTE: did not commit v10 (it is Jonah's uncommitted edit). Offered to commit.
