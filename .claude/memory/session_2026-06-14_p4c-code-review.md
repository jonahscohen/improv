---
name: P4c code review (Codex) - convergence core confirmed, 3 fixes to impl-p4c
description: independent verify green (43 suites); Codex code review confirmed the convergence core; 1 P1 (preflight ignores unreadable dirs -> false-pass) + 2 P2 (retry consumes iteration index; loop-complete doesn't propagate successfulFlowIds) routed before merge
type: project
relates_to: [session_2026-06-14_p4c-v2-approved.md, feedback_autonomous_phases_codex_partner.md]
---

P4c built by impl-p4c (9 commits). MY independent verify: build exit 0, 43 suites,
both --checks OK, P1 hooks 110/0+35/0, no scope leak, ralph->convergence rename
landed (git R075). Codex code review (task-mqdhju9s; session 019ec51d): CONFIRMED
no-double-run, truthful convergence (stable-identity signatures, errors/
inconclusive never converge), stall/cap terminal-pending (guard before dup-report),
boundary under reused lease + validator-throw finalize, per-record AND/OR preflight
(+ the anti-pattern/static-a11y deviation is CORRECT), advisory display, additive
v2 field, complete rename, genuine e2e, no scope leak, lane_calm sequence.

**3 defects -> impl-p4c (NEEDS-FIXES):**
- P1 preflight false-pass on unreadable dirs (lane-convergence-preflight.ts:80
  ignores directories; runtime run-validator.ts:84 treats an unreadable dir as a
  gap for every static rule). A target with an unreadable subtree passes preflight
  -> enters the loop -> permanently inconclusive. FIX: preflight reports an
  unreadable-directory record as an applicable gap for EVERY required coverage
  record; regression test (target with an unreadable subtree -> preflight rejects).
- P2 retry consumes pending iteration index: decideProgress increments
  prev.iteration (lane-convergence.ts:114) persisted at lane-runner.ts:827; an
  UNCLEAN retry then resume skips a pending iteration index. FIX: retry preserves
  the existing pending iteration UNLESS it converges; test unclean-retry-then-resume.
- P2 loop-complete doesn't propagate successfulFlowIds: sequence complete
  propagates (lane-runner.ts:481) but loop complete (lane-runner.ts:652) does not
  -> flowK can't observe successful flowJ, flowL can't observe J/K via the real
  orchestrator prereq path. FIX: propagate the completed step's successfulFlowIds
  during loop-complete finalization; assert actual advisory outcomes in the e2e.

Each fix needs a failing-first test. After fixes: re-verify (43+ suites, --checks,
hooks), commit the lane dist (deferred to merge - the runtime loads it), merge,
then P4d (MCP).

Collaborator: Jonah.
