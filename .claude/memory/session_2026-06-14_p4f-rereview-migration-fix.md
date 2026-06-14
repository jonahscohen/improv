---
name: P4f re-review NEEDS-FIXES - laneFencing migration gap (my design miss) -> impl-p4f
description: Codex re-review confirmed P1-1 closed + P1-2 established-index path sound, but caught a NEW P1 migration gap in my index design - a retained tagged run with no laneFencing entry lets a lower token overwrite it; fix = seed the index from the retained run's fencingToken before fencing; + minor setContext reload consistency
type: project
relates_to: [session_2026-06-14_p4f-fixes-verified.md, session_2026-06-14_p4f-code-review.md]
---

Codex re-review (task-mqduxp5i; session 019ec674) = NEEDS-FIXES. CONFIRMED closed:
P1-1 stale recordFlow clobber (sync reload->mutate->save, preserves laneFencing);
P1-2 works AFTER the index is established (eviction, recordFlow persistence,
higher-token). New P1 + 1 minor:

**NEW P1 - laneFencing MIGRATION gap (a miss in MY P1-2 fix direction).**
upsertLaneFlow inits a missing index to {} (flow-history.ts:205); the fencing
check then sees acceptedToken=undefined (:209), treats it as a new key, advances
the index to the incoming token, and blindly replaces an existing tagged run
(:220). So for valid PRE-INDEX persisted data - a retained tagged run at token 30
with NO laneFencing entry - incoming token 30 reports 'written' and token 29 can
OVERWRITE token 30. Violates lower-token-rejection.
FIX (Codex-specified, routed to impl): when laneFencing lacks logicalKey, DERIVE
the accepted token from any RETAINED tagged run for that logicalKey (its
fencingToken field) BEFORE evaluating the incoming token; seed the index from it;
then apply same/lower fencing. Failing-first test: load/write a tagged run WITHOUT
a laneFencing entry, then same=noop, lower=rejected, higher=written.

**Minor (also routed):** "reload before every mutation" is inaccurate - setContext
(:283) mutates+saves without reloadFromDisk (same stale-clobber footgun; no
production callers today). Make setContext (and any other saving mutator,
e.g. clearSession) reloadFromDisk first so the invariant actually holds.

**SELF-ANALYSIS (per protocol):** the migration gap is in MY fix direction. Why
missed: I declared the index authoritative ("consult it first") without specifying
a seeding/backfill path from the PRE-EXISTING representation (the tagged runs,
which carry fencingToken). Index and runs are two views of the same fencing state
and can diverge (index absent, run present); I treated the index as always-present.
LESSON: when introducing a new authoritative index over data that already has an
implicit representation, ALWAYS specify the migration/backfill path from the old
representation on first encounter. Codex's first review couldn't catch this (the
index didn't exist yet); it surfaced only once implemented - normal iterative
hardening of a durability store.

**Next:** impl applies the migration fix + setContext consistency (failing-first),
re-verify (46 suites, real file untouched), Codex re-review, merge. Pre-existing
lane-runner-concurrency no-op still a separate deferred follow-up.

Collaborator: Jonah.
