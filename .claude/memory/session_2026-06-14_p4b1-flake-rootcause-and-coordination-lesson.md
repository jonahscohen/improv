---
name: P4b-1 flake root-caused + fixed (kept on main, reviewed); coordination lesson
description: the rare durability-suite flake was an over-asserting lock test (asserted concurrent-stale-reclaim mutual exclusion = the documented best-effort NON-guarantee); fixed test + deterministic onHeartbeat seam, reviewed clean, 6/6 stable, KEPT; lesson - don't switch shared tree to main while an implementer is active
type: project
relates_to: [session_2026-06-14_p4b1-COMPLETE.md, session_2026-06-14_p4b1-lock-decision.md]
---

**Flake ROOT-CAUSED (impl-p4b1's late finding):** the rare ~1-in-several
full-suite failure was NOT the heartbeat/abort logic - it was the P0 3-contender
lock TEST over-asserting: it pre-seeded a STALE lock and asserted strict
at-most-one under CONCURRENT STALE RECLAIM, which is exactly the BEST-EFFORT
property the lock decision documents as NOT guaranteed (proper-lockfile's
mtime-reclaim has a tiny residual window). The test demanded more than the lock
promises -> rare red ("only one of three stale reclaimers may hold the lock").

**Fix (commits 8b6037d + 2712d1e, on main):** test now asserts the GUARANTEED
property (mutual exclusion under concurrent contention on a LIVE/fresh lock =
atomic mkdir, deterministic); single-reclaimer stale takeover still covered
separately; concurrent-stale-reclaim assertion removed (aligned with the
documented limitation). Added a deterministic onHeartbeat seam to lane-runner so
the abort-fence + pipeline tests await ACTUAL heartbeat fires / abort-in-check
instead of racing wall-clock timers.

**My review (it landed on main unreviewed - I reviewed before blessing):**
lane-lock.ts production logic UNCHANGED (empty diff - lock untouched); lane-runner
only adds the benign onHeartbeat?:(ok)=>void seam (no-op in production); rest is
test-only + dist rebuild. Strict improvement, no production durability/lock logic
change. 6/6 full-suite runs clean on my machine (+ impl's 20/20 isolation, 33/33
full). DECISION: KEEP. The flake is genuinely eliminated at root - better than my
prior accept-with-caveat. main = 123 ahead of origin (local only, not pushed).

**COORDINATION LESSON (how it went wrong):** I merged P4b-1 to main (switching the
shared git working tree to main) WHILE impl-p4b1 was still active processing my
flake task. The teammate shares the same working tree, so its subsequent commits
landed on MAIN (wherever HEAD was), not a branch. Harmless here (correct +
local-only + flagged), but a real hazard. RULE: shut down / quiesce implementers
BEFORE switching branches or merging to main; or have implementers always operate
on their own branch and never let HEAD be main while they're alive.

**STATE:** P1/P2/P4a-1/P4a-2/P4b-1 merged + durability suite now robustly green.
Next: P4c (loops + lane_converge + convergence floor).

Collaborator: Jonah.
