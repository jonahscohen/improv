---
name: Memory is the core - zero-failure execution bar for the beats evolution
description: Jonah - the memory component is improv's MOST IMPORTANT part; the beats-evolution plan must execute with mechanical gates (benchmark-first, fail-loud, parallel-run) not model diligence; cross-model backstop is standing practice, designed in
type: feedback
relates_to: [proposal_beats_next_evolution.md, feedback_multiagent_verified_implementation_mandate.md]
---

Collaborator: Jonah Cohen (2026-07-01).

Jonah's directive on the beats next-evolution proposal (proposal_beats_next_evolution.md): the memory component is the most important part of improv, and execution of the evolution plan must be failure-free in practice. He stated plainly that Claude is "lazy by nature" and that he has called other models to support Claude when it falters - so the plan must NOT depend on Claude's diligence.

**Why:** Memory is the cross-session, cross-machine continuity layer for the whole project. A silent failure in the memory system (a recall miss, a stale index, a skipped write) corrupts every downstream session. Jonah's trust calibration is explicit: assume the executor will falter, and build the system so faltering is caught mechanically.

**How to apply:** Every stage of the beats-evolution build gets a runnable mechanical gate, never a behavioral intention:
1. Recall benchmark built FIRST (~30 cold-session questions hand-mapped to answer beats) before any index code.
2. Compiler verifies count + content-hash parity with the corpus; distinct exit codes for stale/empty/failed (codex-review.py pattern) - loud failure, never silent degradation.
3. `beats search` bar: answer beat in top 5 for >=90% of benchmark questions; supersession resolved at query time.
4. Index rebuild on beat WRITE, not commit.
5. Session-start staleness guard (corpus hash vs index hash).
6. Parallel-run retrieval beside read-everything ~2 weeks; every miss becomes a benchmark case; zero unexplained misses before cutover.
7. Retire the hand-edited index and flip CLAUDE.md in the SAME commit - no half-migrated state.
8. Codex adversarial review at every stage (standing produce-and-verify mandate) - the other-model backstop is designed in, not emergency-invoked.
Plan B (provenance fields): validator warns, never blocks - tooling can never stop a mandated beat write. Markdown stays source of truth at every stage so worst case is rollback, never data loss.

## Files touched
- .claude/memory/feedback_memory_first_zero_failure_execution.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
