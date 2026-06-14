---
name: P4f plan reviewed + APPROVED with one correction (test HOME isolation)
description: Codex-authored P4f plan (1184 lines, 6 tasks) reviewed - Tasks 2/3/4/5 verified sound (fencing semantics, per-publisher ack invariant, DRY FINALIZE helper, crash+idempotent replay); integrity clean; ONE lead-directed gap fix - global HOME isolation in run-tests.ts so lane FINALIZE flow-history publishes do not pollute the real ~/.claude
type: project
relates_to: [session_2026-06-14_p4f-kickoff.md, session_2026-06-14_p4b1-COMPLETE.md]
supersedes: session_2026-06-14_p4f-kickoff.md
---

P4f plan (docs/superpowers/plans/2026-06-14-lane-p4f-flowhistory-outbox-publisher.md,
Codex-authored, 1184 lines, 6 tasks) reviewed. APPROVED with one correction.

**Verified sound (substance, not notes):**
- Integrity: 0 dashes/NUL/emoji/smart-unicode.
- Task 2 upsertLaneFlow: fencing semantics correct (lower=rejected, same=noop,
  higher=replace-IN-PLACE so no unbounded growth); additive optional fields
  (laneLogicalKey/fencingToken) on FlowHistoryEntry; recordFlow + 20-run cap
  preserved for existing callers (test asserts hasFlowExecuted/getFlowCount/
  getFlowRuns/getFlowSequence/singleton). strictSave=true on lane upserts (throws
  on save failure so the outbox will NOT falsely ack). HISTORY_FILE change
  (private static field -> public dynamic getter) is BENIGN: original is already
  path.join(process.env.HOME||'~','.claude','sidecoach-flow-history.json'); getter
  computes the identical path, just lazily for test HOME-redirection; nothing else
  references it.
- Task 3 LaneFlowHistoryPublisher: lock-guarded (withCheckpointLock on
  dirname(HISTORY_FILE)=~/.claude), reloads fresh FlowHistory inside the lock.
- Task 4 generalized publishOutbox: dispatch map + per-publisher loop +
  ackOutboxPublisher preserves the P4b-1 invariant (record removed only when
  pendingPublishers empties; no semantic-revision bump). Test rigorously covers:
  both-must-ack-before-removal, rejected-still-acks, FAILED-publisher-stays-pending
  while sink already acked, unknown-publisher-retained.
- Task 5: DRY committedStepOutbox helper at BOTH STEP FINALIZE sites; correctly
  leaves the convergence-boundary record sink-only (generalized dispatch skips
  undeclared publishers - proven by the unknown-publisher test); crash-replay +
  same-token-noop-replay asserted.
- FINALIZE publishOutbox calls are NOT try/catch-wrapped, but that is PRE-EXISTING
  P4b-1 behavior and symmetric (the sink's fs writes can already throw); in normal
  operation neither throws; transition commits BEFORE publish; publishPendingOutbox
  replays on failure. Not a P4f regression. Flag to Codex final review as an
  observation, not a blocker.

**CORRECTION (lead-directed, gap in the plan):** ~18 existing lane suites
(lane-lease, lane-runner-concurrency, lane-loop-*, lane-runner-*, etc.) drive
startLane/advanceLane (FINALIZE) WITHOUT stubbing publishOutbox or isolating HOME.
After P4f, every FINALIZE publishes to the HOME-scoped flow-history file ->
pollutes the dev's real ~/.claude/sidecoach-flow-history.json during the test run.
run-tests.ts spawns suites via execFileSync('npx',['ts-node',...]) which INHERITS
env, so the minimal fix is ONE point: set process.env.HOME to a fresh
fs.mkdtempSync temp dir at the top of scripts/run-tests.ts (before the suite loop;
add `import * as os from 'os'`); all spawned suites inherit it -> isolated.
Direct `npx ts-node <existing lane suite>` dev-run steps (Task 5 Step 7) should be
prefixed `HOME=$(mktemp -d)` to avoid dev-time pollution. The new P4f suites
already self-isolate HOME (keep that).

**Next:** execute via team lane-p4f-exec (impl creates branch lane-p4f per Setup
Step 1) with the HOME-isolation correction as an explicit instruction; I verify;
Codex code review; merge. NOT pushed.

Collaborator: Jonah.
