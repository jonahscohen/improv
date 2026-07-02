---
name: Beats evolution STAGES 4+5 - rebuild-on-write + session-start staleness guard (dispatched)
description: Stages 4-5 kickoff - incremental vector reuse in compile (prereq - full compile re-embeds 865 beats ~155s, unusable per-write), debounced PostToolUse rebuild hook, SessionStart verify guard (silent/STALE-rebuild/broken-loud), project-scoped settings wiring; dispatched to fresh Opus teammate "hooksmith"
type: project
relates_to: [session_2026-07-02_beats-stage3-search.md, feedback_memory_first_zero_failure_execution.md]
---

Collaborator: Jonah Cohen. 2026-07-02. Jonah said "Continue" after stage-3 closure - stages 4+5 proceed.

## Design decisions (lead-fixed before dispatch)
- **Unit A prereq - incremental vector reuse**: compile reuses a beat's vector when vectors_present + embed_model/dim match + stored sha256 == current sha256; re-embeds otherwise; `--reembed-all` escape hatch. Why: the ratified stage-4 verify clause ("write a beat, search finds it in the same session") is impossible with a 155s full re-embed per write; content-hash-keyed reuse makes a single-beat write cost ~1 embed. Side effect worth having: unchanged corpora compile fully offline (all vectors reusable).
- **Stage 4**: `claude/hooks/beats-rebuild.sh` PostToolUse(Write|Edit|MultiEdit), path-matched to this repo's .claude/memory/*.md, debounced lockfile background compile, never blocks or fails the session; failures surface via search's STALE warning + the stage-5 guard + compile.log.
- **Stage 5**: `claude/hooks/beats-staleness-guard.sh` SessionStart: verify exit 0 = silent, 6 = one STALE context line + background rebuild, 4 = LOUD broken warning, 2/3 = loud, never fails session start.
- **Wiring scope**: PROJECT settings (improv/.claude/settings.json), NOT the global live ~/.claude/settings.json - beats hooks belong where the corpus lives; lower blast radius.
- Gates held by lead: suites + new hook suite green, scorer must stay 45/48 exit 0, E2E proofs of both ratified verify clauses, Codex rounds, lead certification, commit, teardown.

## Lead acceptance verification (hooksmith-acceptance-e2e, 2026-07-02)
Hooksmith delivered stages 4+5. Lead-re-run all green: compile suite 43, search 44, hooks 20, validate OK, verify fresh (867 beats), scorer 45/48 exit 0. Code review: rebuild hook's debounce protocol is correct (dirty-before-lock, post-release recheck closes the requeue race, full detach, symlink-normalized flat-glob path match, log rotation, all-errors-swallowed exit 0); staleness guard sanitizes+clamps its timeout under set -u, correct exit-code taxonomy, silent-on-fresh, shared enqueue on stale, loud on broken, never fails session start. Project settings wiring minimal and valid. Timings confirmed transformative: full 171.6s -> unchanged 0.56s -> single-change 1.04s. This very edit is the lead's own E2E article: guard must flag it stale, background rebuild must pick it up, and search must find the token hooksmith-acceptance-e2e in-session.

**E2E result (stronger than designed):** the live PostToolUse hook fired on the lead's beat edit ITSELF - compile.log shows the rebuild at 08:22:00, "866 reused, 1 embedded", done in ~1s, hash matching verify - so by the time the guard ran, the index was already FRESH and the guard correctly emitted silent {}. Stage 4's clause is thereby proven in a SECOND independent session (the lead's, which predates the settings file - Claude Code hot-loads project settings). The lead's first search probe used body-only tokens and lost to name-weighted competitors (correct bm25 behavior, not a defect); the name-weighted query returns this beat rank 1, and the FTS token check confirms the new content indexed. Guard stale-path coverage: hook suite (20 checks) + hooksmith's controlled demo + lead code review.

**Lead Codex CERTIFICATION: PASS, no mandatory items.** Reuse-staleness interaction sound (content-hash identity means a reused vector cannot go stale from corpus edits), lock/debounce protocol sound under concurrent writers, no session-failing path in either hook, structural corruption not masked. Documented non-blocking caveat: semantic vector tampering with a valid-length float32 blob is undetectable by structural parity (out of ratified scope; --reembed-all is the recovery tool).

**Plan state after this stage:** build phase COMPLETE (stages 1-5). Remaining: the ~2-week PARALLEL RUN (read-everything startup stays canonical per CLAUDE.md; sessions additionally use `beats.py search` for recall questions; every real miss becomes a benchmark case; zero unexplained misses required) then the cutover decision (retire the hand-edited index + flip CLAUDE.md in the SAME commit) - which is Jonah's, gated on the parallel-run record.

## Files touched (kickoff)
- .claude/memory/session_2026-07-02_beats-stage4-5-hooks.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
