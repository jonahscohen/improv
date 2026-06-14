---
name: P4b-1 lock - 4th review failure; even proper-lockfile has the window; DECISION to Jonah
description: Codex confirm STILL-OPEN on the P0 lock - proper-lockfile's stat/rmdir/mkdir also has the 3-party stale-takeover window; truly race-free needs OS flock (native dep); decision = descope cross-process race-safety vs grind flock; cheap P1#2 + @types routed regardless
type: decision
relates_to: [session_2026-06-14_p4b1-code-review-lock-library.md, session_2026-06-13_lane-p3-pivot-gutcheck.md, feedback_codex_takeover_on_round_fail.md]
---

Codex P4b-1 fix-confirm (task-mqdbsakt; session 019ec489). CLOSED: P1#1
duplicate-start, P2 outbox. STILL-OPEN: P0 lock, P1#2 collection-sync.

**P0 lock - 4th failure.** proper-lockfile@4.1.2 ALSO has the 3-party window: its
stale recovery does stat(shared) -> rmdir(shared) -> mkdir(shared), so a delayed
stale observer can rmdir a NEWER live owner's dir and a third owner enters. The
lease-identity check at FINALIZE catches MOST overlaps, but FINALIZE's
check-then-write is itself vulnerable without a serializing lock (A passes its
identity check, B claims, A writes -> two commits possible). proper-lockfile's
onCompromised + mtime-refresh shrink the window (A aborts when its lock is stolen)
but do NOT make it provably zero. Codex's only "provably race-free" fix: OS
advisory locking (flock) = a native dependency.

**Why this is THE decision point:** cross-process race-free locking is genuinely
hard; the STANDARD library doesn't satisfy the bar; the provable fix (flock) is a
heavy native dep + more rounds; and the VALUE is ~zero for a single-user tool
(two processes never drive the same lane concurrently). This validates the P3
gut-check + the proper-lockfile-adoption flag. Jonah explicitly offered "say the
word to descope the locking."

**Recommendation:** DESCOPE the strict cross-process race-safety. Merge P4b-1 now
with proper-lockfile as best-effort serialization + the lease/fencing/
FINALIZE-identity/onCompromised layer (which makes the residual window tiny and
single-process-safe), and DOCUMENT the limitation (strict 3-process adversarial
stale-reclaim not guaranteed; acceptable single-user; a future flock lock closes
it if multi-process ever matters). All the durability VALUE (lease, fencing,
outbox, heartbeat, validator gating, at-most-one-committed in practice) is intact.
Alternative: lean on Codex to author a flock-based lock (provable, but native dep
+ more grind for a non-problem).

**Cheap fixes routed to impl-p4b1 regardless of the P0 choice:** P1#2 make
collection (project-collector traversal + reads) cooperatively async (await
setImmediate + abort-check between dirs/files) so a slow collection can't starve
the heartbeat; and move @types/proper-lockfile to devDependencies.

**DECISION (Jonah, 2026-06-14): SHIP BEST-EFFORT, DOCUMENT IT.** Keep
proper-lockfile (best-effort) + the lease/fencing/onCompromised layer; NO flock,
NO native dep. Document the limitation in code (lane-lock.ts comment) + the plan:
strict 3-process adversarial stale-reclaim is NOT guaranteed; single-process-safe;
all durability VALUE (crash-recovery, lease identity, fencing, validator gating,
at-most-one-committed in practice) intact; a future flock lock could close the
residual window if multi-process ever matters. The P0 is RESOLVED by this scoping
decision (accepted best-effort), not by further lock work.

**STATE:** P4b-1 complete + green (33 suites); P1#1/P2 closed; P0 resolved by
decision; impl-p4b1 finishing the 2 cheap fixes (async collection + @types) +
adding the documented-limitation comment; then verify + merge.

Collaborator: Jonah.
