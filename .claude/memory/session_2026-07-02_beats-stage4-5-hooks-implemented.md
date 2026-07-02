---
name: Beats evolution STAGES 4+5 IMPLEMENTED - incremental vector reuse + rebuild-on-write hook + session-start staleness guard
description: Unit A incremental vector reuse in compile (155s->1s single-file), Unit B beats-rebuild.sh PostToolUse debounced background compile, Unit C beats-staleness-guard.sh SessionStart verify guard, project-scoped settings wiring; both ratified verify clauses proven E2E; scorer stays 45/48
type: project
relates_to: [session_2026-07-02_beats-stage4-5-hooks.md, session_2026-07-02_beats-stage3b-hybrid-embeddings.md]
---

Collaborator: Jonah Cohen. 2026-07-02. Executor (Opus) implementing the lead-ratified stages 4+5 plan. Do NOT commit (lead holds the commit gate).

## Unit A - incremental vector reuse in compile (prerequisite)
- `beats.py` `load_reusable_vectors(db_path, records, embed_model)` reads the EXISTING db and returns vectors reusable by CONTENT IDENTITY: reused when (a) vectors_present=1, (b) meta.embed_model == current model AND meta.embed_dim is a usable positive int, (c) stored sha256 == the file's current sha256 and the blob is well-formed. Otherwise re-embed. Deleted files vanish (full-table rebuild from records); new files fall through to a fresh embed.
- `cmd_compile` rewritten: reuse the unchanged, embed only the new/changed; `--reembed-all` flag forces a full re-embed. Success line now reports "N reused, M embedded".
- Why the model-name check stands in for a live-embedder dim probe: the model name determines the dimension, so a matching model IS a matching embedder - which lets an unchanged corpus recompile fully OFFLINE (no embedder round-trip). When the embedder IS probed (something needs embedding) and its live dim disagrees with the stored dim, reuse is invalidated loudly (VECTOR REUSE INVALIDATED) and all beats re-embed.
- FAIL-SOFT unchanged, vectors stay ALL-OR-NOTHING (self_verify enforces "vectors present => every beat has exactly one"): embedder down + a changed beat -> whole set drops to lexical-only loud VECTORS ABSENT; embedder down + every vector reusable -> vectors preserved offline. Reused vectors pass the same parity checks (dim, blob length, filename-set) as fresh ones; blob bytes are byte-identical across recompiles (float32 unpack/repack round-trips exactly).
- TIMINGS (real corpus, 866 beats, real qwen3-embedding:0.6b via local ollama): full compile 171.6s; unchanged recompile (866 reused, 0 embedded) 0.56s; single-changed-file (865 reused, 1 embedded) 1.04s. This is what makes a per-write hook usable.

## Unit B - beats-rebuild.sh (stage 4, PostToolUse Write|Edit|MultiEdit)
- Reads the hook JSON on stdin, extracts tool_input.file_path, path-matches a *.md directly under THIS repo's `.claude/memory/`, and kicks a DEBOUNCED BACKGROUND compile. Never blocks (nohup + `&`, hook returns immediately), never fails (all internal errors swallowed, exit 0).
- Debounce: mkdir-based lock in `beats/.build/.lock` + a `.dirty` marker + a settle window (BEATS_DEBOUNCE_SECS, default 2). A burst of writes coalesces into one compile; a write that lands mid-compile requeues one pass; a post-release recheck-and-reacquire closes the lock/dirty TOCTOU race. Log rotation truncates `beats/.build/compile.log` past ~1MB.
- Modes: default (hook), `--enqueue` (shared debounced kick, used by Unit C), `--run-compile` (detached runner). Env overrides BEATS_CORPUS / BEATS_BUILD / BEATS_PY / BEATS_COMPILE_CMD / BEATS_DEBOUNCE_SECS keep tests off the real corpus.

## Unit C - beats-staleness-guard.sh (stage 5, SessionStart)
- Runs `beats.py verify` under a short timeout (BEATS_VERIFY_TIMEOUT default 15s, 0.2s poll): exit 0 -> silent `{}`; exit 6 -> one STALE additionalContext line carrying the added/removed/changed detail + kick beats-rebuild.sh --enqueue; exit 4 -> LOUD "index BROKEN, run compile"; exit 2/3 -> loud one-liner; timeout/other -> silent + logged note. NEVER fails the session start.

## Wiring
- PROJECT settings only: created `/Users/spare3/Documents/Github/improv/.claude/settings.json` (did not exist) wiring both hooks via `$CLAUDE_PROJECT_DIR/claude/hooks/...`. Did NOT touch `~/.claude/settings.json` or `claude/settings.json` (the global live config). JSON validated.

## Verification
- Suites all green: test-beats-compile.sh 43 checks (26 original + Unit A cases 15-23), test-beats-search.sh 44 checks, test-beats-hooks.sh 20 checks.
- Scorer stays 45/48 = 0.9375 exit 0 (hybrid) - compile changes do not alter search results (confirmed identical before/after on the same corpus).
- Stage-4 E2E ("write a beat, search finds it same session") and stage-5 E2E ("touch a file, the hook flags it") both proven end-to-end by firing the hook scripts exactly as the harness would.

## Codex cross-model review (codex-review.py, gpt-5.x) - 4 rounds to CLEAN
- R1: High - verify's beats_vec check was filename-set only; a corrupt blob (right filename, wrong dim/length) verified fresh so the guard stayed silent. Folded: cmd_verify now validates per-row dim/blob-length/type + rejects unusable meta.embed_dim (exit 4). Low: hook `case` glob matched nested-subdir .md that compile's flat glob ignores -> restrict to direct children. Low: BEATS_VERIFY_TIMEOUT used in arithmetic under set -u could abort before exit 0 -> sanitize.
- R2: Medium - verify collapsed beats_vec to a filename SET, losing row cardinality (a duplicate valid row verifies fresh but search rejects on count) -> add row-count parity. Low: timeout uncapped -> clamp to BEATS_VERIFY_TIMEOUT_MAX (default 60).
- R3: Medium - load_reusable_vectors could reuse from a corrupt old db with a duplicate mislabeled row -> abandon reuse wholesale on any duplicate filename. Low: self_verify weaker than verify/search -> add row-count parity. DECLINED (spec-grounded): search stays fail-soft lexical-only (exit 0) on vector-only corruption while verify exits 4 - the ratified stage-3b contract (caseH6/H8/H9) and the intended verify=health / search=serve split.
- R4: CLEAN. Every fold re-verified (suites green, scorer 45/48).

## Files touched
- beats/beats.py (Unit A)
- claude/hooks/beats-rebuild.sh (new, Unit B)
- claude/hooks/beats-staleness-guard.sh (new, Unit C)
- beats/_tests/test-beats-compile.sh (Unit A cases 15-20)
- beats/_tests/test-beats-hooks.sh (new)
- .claude/settings.json (new, project-scoped wiring)
- .claude/memory/session_2026-07-02_beats-stage4-5-hooks-implemented.md (this beat) + MEMORY.md

Stage-4 E2E was proven live: writing this beat through the harness hot-loaded the project settings, fired beats-rebuild.sh, and the debounced background compile reused 866 vectors + embedded 1 in ~3s, making the new beat searchable in the same session; a controlled manual-invocation cycle then confirmed verify 6->0 and before/after retrieval of a sentinel-token edit. Stage-5 E2E: a corpus touch drove verify to 6, beats-staleness-guard.sh emitted the STALE context line and kicked the rebuild, and verify returned to 0.
