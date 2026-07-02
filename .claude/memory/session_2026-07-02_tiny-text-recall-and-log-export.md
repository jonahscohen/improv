---
name: tiny-text-recall-and-log-export
description: Recall session - answered "what did we decide about tiny-text" from the beats trail; exported a session log to the desktop; SELF-AUDIT - answered via grep, never ran beats.py search on day 1 of the parallel run (repeat of the protocol-gap failure mode); retrospective probe PASSED (pivot beat rank 2, supersession resolved)
type: project
relates_to: [session_2026-07-02_beats-search-protocol-gap.md]
---

Collaborator: Jonah.

Read-only recall session, no code or config changes.

- Answered Jonah's question "what did we decide about tiny-text?" from the beat trail: labeler adjudication (labels sound, feature wrong) -> SMALL_PX=13 operating point (superseded) -> pivot/self-correction (labels don't track font size; defer) -> taste survey (non-separable) -> final promotion to precision-safe partial detector (SMALL_PX=13, P 1.00 / R 0.23 on frozen-90, 15 TP / 0 FP).
- Exported a session log summarizing the question, the full decision trail, and the standing taste-frontier posture to /Users/spare3/Desktop/session-log_2026-07-02_tiny-text-decision-recall.md (Jonah's request).

## SELF-AUDIT (Jonah's demonstration probe, same session)
Jonah asked whether this session demonstrated the past day's beats upgrades (stages 1-5) or exposed an implementation gap. Findings:

What held (live, unprompted):
- Stage-4 rebuild-on-write hook: this session's beat writes triggered the background recompile - `beats.py verify` reports fresh at 871 beats, corpus grew 868 -> 871 with zero manual compile. Passed live.
- Stage-5 staleness guard: silent at session start = correct fresh-index behavior.
- Supersession discipline: followed superseded_by from the operating-point beat to the pivot beat manually; the search pipeline resolves the same way (superseded beat absent from results).
- Source priority (beats not git log) + per-task beat writes held.

The gap (repeat failure mode):
- Never ran `beats.py search`. The tiny-text question was the canonical recall-question use case on DAY 1 of the parallel run (feedback_memory_first_zero_failure_execution.md steps 6-7: sessions additionally use search, every miss becomes a benchmark case). Answered via raw grep + manual reads instead - zero parallel-run data produced until Jonah prompted the audit.
- Why: the parallel-run mandate lives only in beats this session never loaded (only tiny-text-adjacent beats were read). This is the EXACT systemic hole the same-day protocol-gap beat warned about: "the parallel-run protocol is documented only in beats, not surfaced anywhere a fresh session reliably loads." This session is the proof case.
- How to catch earlier: mechanical injection, not diligence - extend the stage-5 SessionStart guard (or a UserPromptSubmit hook) to state the parallel-run protocol during the run window (through ~2026-07-16).

## GAP 2 (found during the audit): index compactor evicts ALL new project pointers
- This session's MEMORY.md index line was silently moved to MEMORY-archive.md (line 982) by memory-compact.sh/compact-memory.py minutes after it was written. Same fate earlier today for the protocol-gap beat's line (archive 976) and the backlog/cutover beat's line (archive 979). ZERO of today's project-typed pointers survive in the live index.
- Root cause: the live index is budget-saturated (22,952 of 23,000 bytes) by standing entries + PINNED "** ACTIVE" lines. Pinned lines appear exempt from the 200-char line cap - the five ACTIVE stage lines run 500-1500 chars each - and two of them are stale pins (stage 3 IN FLIGHT, stage 4+5 IN FLIGHT are completed, superseded by their IMPLEMENTED beats). With standing+pinned filling the budget, every freshly-added non-standing pointer is the first eviction candidate on the very next write - the exact perverse outcome the compactor's 2026-06-25 docstring described; the all-types fallback fixed the infinite loop, not this.
- Impact during the parallel run: MEMORY.md is still the CANONICAL startup layer, and a fresh session reading it sees none of today's work. The write-time "update MEMORY.md" protocol is being silently undone. `beats.py search` DOES find all three beats (871 compiled, this beat ranked #1 in the probe) - the retrieval layer covers exactly the hole the index has, which is the strongest live evidence yet for the cutover.
- Deliberately NOT re-adding the index line: at 22,952/23,000 it would be re-evicted on the next write. Fix is policy-level (Jonah's call): retire stale ACTIVE pins, cap pinned lines, or accept index-miss until cutover (~2026-07-16).

Retrospective probe (lapse converted to parallel-run data):
- Query "what did we decide about tiny-text": pivot/self-correction beat rank 2, labeler adjudication rank 3, superseded operating-point beat correctly ABSENT (query-time supersession resolution working). PASS mode-any.
- The final-promotion state (reference_honest_final_scorecard.md, precision-safe partial) did NOT crack top-5 on the decision query; a follow-up query ("tiny-text detector shipped precision recall scorecard") ranks it #1. Consistent with the documented stage-3b 2-hop semantic frontier. Candidate benchmark case: decision-plus-eventual-shipped-state 2-hop query.

Files touched:
- /Users/spare3/Desktop/session-log_2026-07-02_tiny-text-decision-recall.md (new, outside repo)
- .claude/memory/session_2026-07-02_tiny-text-recall-and-log-export.md (this beat, audit added) + MEMORY.md
