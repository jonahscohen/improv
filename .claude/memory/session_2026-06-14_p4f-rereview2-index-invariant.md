---
name: P4f re-review#2 NEEDS-FIXES - migration seed not durably persisted; switch to index-invariant fix
description: Codex 4th finding - upsertLaneFlow's migration seed is in-memory only and same/lower early-returns do not save, so the seed evaporates and post-eviction a stale token writes; after 3 reactive point-patches I am directing the global invariant instead (backfill laneFencing from retained runs in reloadFromDisk, persisted by every mutator's save)
type: project
relates_to: [session_2026-06-14_p4f-rereview-migration-fix.md, session_2026-06-14_p4f-fixes-verified.md]
---

Codex final re-review (task-mqdwcwte; session 019ec698) = NEEDS-FIXES. 4th P4f
durability finding. setContext/clearSession reload CONFIRMED. New P1:

**Migrated fencing token not durably SEEDED.** upsertLaneFlow's migration block sets
the derived token in memory (flow-history.ts:210) but the same/lower checks return
(:227-228) WITHOUT save(). Sequence: pre-index run token 30, no index -> upsert
same(30) derives 30 in memory, returns noop without saving -> recordFlow reloads the
UNSEEDED disk, evicts the token-30 run under the 20-cap -> token 29 now has neither
an index entry nor a retained run -> incorrectly written. The minimal "save before
early-return" patch (Codex's literal ask) still leaves an eviction-BEFORE-any-upsert
hole (recordFlow evicts the only retained run before any upsert seeds the index).

**DIRECTED FIX - the INVARIANT (not another point-patch):** laneFencing must always
be >= every retained tagged run's token AND persisted by every saving mutation.
- Add private backfillLaneFencingFromRuns(): for each session, for each retained run
  with laneLogicalKey + numeric fencingToken, set laneFencing[key] =
  max(existing ?? -Inf, run.fencingToken). Never lowers; idempotent; safe.
- Call it in reloadFromDisk() AFTER load(). Every saving mutator (recordFlow,
  upsertLaneFlow, setContext, clearSession) reloads then saves, so the backfilled
  index is persisted on every mutation. Eviction happens only in appendFlowCore
  (recordFlow / upsert-append), both save-bearing, so the index is persisted
  before/with eviction -> closes eviction-before-upsert too.
- upsert keeps reading the (now-backfilled) index for its fencing decision.
- Tests: (a) Codex's: migrate token-30 run w/o index, upsert same/lower, then 20
  ordinary writes to evict, token 29 still rejected. (b) NEW: eviction-BEFORE-any-
  upsert - token-30 run w/o index, 20 ordinary recordFlow writes (evict) with NO
  upsert between, then token 29 -> rejected (proves recordFlow backfilled+saved the
  index before eviction).

**SELF-ANALYSIS (per protocol):** I under-specified the index's DURABILITY three
times (persist-outside-cap -> seed-from-runs -> persist-the-seed). Root cause: I
patched the index reactively at each point Codex flagged instead of stating and
enforcing the global invariant. LESSON: when a durability index springs repeated
leaks, stop patching points - define the invariant (index >= every retained run's
token, persisted by every mutator) and enforce it at the choke points (reload +
save). This round directs that.

**Next:** impl applies the invariant fix + both tests (failing-first), re-verify
(46 suites, real file untouched), Codex final re-review, merge.

Collaborator: Jonah.
