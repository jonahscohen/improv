---
name: Beats evolution STAGE 2 - compiler (markdown -> jsonl + SQLite/FTS5)
description: Stage 2 kickoff under the new cost model - opus-executor agent definition created (.claude/agents/, model frontmatter = the guard-sanctioned route), full compiler spec dispatched to a named Opus teammate; Fable holds the gate (review, Codex round, parity verify clauses)
type: project
relates_to: [session_2026-07-02_beats-stage1-recall-benchmark.md, feedback_fable_orchestrator_opus_codex_executors.md]
superseded_by: session_2026-07-02_beats-stage2-compiler-impl.md
---

Collaborator: Jonah Cohen. 2026-07-02. Jonah greenlit stage 2 ("go ahead, start stage 2").

## In progress
- Created `.claude/agents/opus-executor.md` (model: opus in agent-definition frontmatter - the sanctioned mechanism; the per-spawn `model` param stays blocked by the guard). This resolves the Opus-delegation friction flagged in [[feedback_fable_orchestrator_opus_codex_executors]]: registered live mid-session, named teammate spawn succeeded.
- Dispatched the full stage-2 spec to named teammate "compiler" (opus-executor): `beats/beats.py` (compile/verify subcommands, stdlib-only, FTS5 probe, atomic db swap, mandatory in-compile parity self-verification, exit contract 0/2/3/4/5/6), `beats/_tests/test-beats-compile.sh` (7 cases incl. injected parity fault + real-corpus read-only smoke), `beats/.gitignore` for the build dir.
- Gate held by lead: code review of the delivered unit, run the tests myself, negative-verify the exit contract, then a real Codex round (producer=Opus, reviewer=Codex, cross-model triangle), then beat + commit.

## Files touched (so far)
- .claude/agents/opus-executor.md (new)
- .claude/memory/session_2026-07-02_beats-stage2-compiler.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
