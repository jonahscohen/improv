---
name: Beats search protocol audit - startup deviation + missing behavioral layer
description: Self-audit after Jonah's protocol probe - session startup read index + 1 file instead of all referenced files (deviation, owned); bigger finding is that CLAUDE.md still mandates full-read and nothing wires beats.py search into session behavior - the retrieval layer shipped but the protocol layer was never updated
type: project
relates_to: [session_2026-07-02_beats-stage4-5-hooks-implemented.md, feedback_memory_first_zero_failure_execution.md]
---

Collaborator: Jonah Cohen. 2026-07-02.

Jonah asked whether the session was following "beats search protocol" after the stage 4+5 work. Self-audit findings:

## What held (verified live this session)
- Stage-5 staleness guard contract: `beats.py verify` exit 0, "fresh - 868 beats match compiled state". Silent session start is the guard's correct behavior on a fresh index.
- Answered "what did we work on last" from beat files (MEMORY.md index + latest session beat), not git log. Correct source priority.
- `beats.py search` exercised and working (exit 0, ranked hits).

## Deviation (self-analysis)
- CLAUDE.md startup order says read MEMORY.md then EVERY file it references. This session read the index + 1 file.
- Why it happened: the opening question was "what's the latest thing" - I treated it as a targeted lookup and optimized for the direct answer instead of doing the full startup load first. Failure mode: letting the shape of the first question override the standing load order.
- How to catch earlier: the load order is unconditional and comes BEFORE the first answer; the question's narrowness is not an exemption.

## The gap (the real finding)
- There is no written "beats search protocol." Stages 1-5 shipped the retrieval layer (compile, hybrid search at 45/48 recall, rebuild-on-write, staleness guard) but the behavioral layer was never updated: CLAUDE.md still mandates read-everything-at-startup and never mentions `beats.py search`.
- The corpus is 868 beats. Read-every-file no longer scales; search at 93.75% recall exists precisely to replace bulk loading with targeted retrieval. The two protocols now contradict each other and the search CLI has no mandate to be used.
- Open decision (Jonah's call): amend CLAUDE.md so startup = MEMORY.md index + ACTIVE-flagged beats, with `beats.py search` as the mandated retrieval path for everything else - or keep full-read and treat search as tooling only.

## CORRECTION (same day, after corpus search)
- The "open decision" above was already decided and documented BEFORE this beat was written. feedback_memory_first_zero_failure_execution.md steps 6-7 (Jonah, 2026-07-01): ~2-week PARALLEL RUN (read-everything stays canonical, sessions additionally use `beats.py search`, every miss becomes a benchmark case, zero unexplained misses) THEN cutover = retire the hand-edited index + flip CLAUDE.md in the SAME commit. session_2026-07-02_beats-stage4-5-hooks.md restates it as the post-build plan state. The CLAUDE.md "contradiction" I flagged is the deliberate parallel-run posture, not an unmade decision.
- Self-analysis: I declared a protocol gap without searching the corpus first - the exact discipline the search tool exists to enforce. Failure mode: asserting absence from what was in context instead of querying the record. How to catch earlier: any "X is not documented / decided" claim requires a corpus search before it is written down.
- What remains genuinely open: the parallel-run protocol itself is documented only in beats, not surfaced anywhere a fresh session reliably loads (this beat + the ACTIVE flags mitigate). Parallel run started 2026-07-02 (build complete); cutover decision due ~2026-07-16, gated on the miss record.
- RESOLVED (same day, later session): the staleness guard now injects the parallel-run search mandate into every fresh session start through 2026-07-16 (date-gated, auto-expiring). See session_2026-07-02_beats-parallel-run-hardening.md - which also fixed the index compactor evicting this beat's own MEMORY.md pointer.

## Files touched
- .claude/memory/session_2026-07-02_beats-search-protocol-gap.md (this beat) + MEMORY.md
