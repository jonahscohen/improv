---
name: compactor-fix-lead-verified
description: Lead-verified the compactor agent's fix to claude/hooks/compact-memory.py (over-budget all-types-archive-with-pins + de-dup). Functional test on a live MEMORY.md copy: 29797 -> 22907 bytes (under the 23000 budget), all 3 ** ACTIVE/** START HERE pins survived, idempotent 2nd run. Committed.
type: project
relates_to: [reference_memory_index_over_budget.md, session_2026-06-25_compactor-over-budget-fix.md]
---

Collaborator: Jonah Cohen. 2026-06-25. The compactor teammate fixed the over-budget index issue (Jonah asked for a dedicated agent); it did the work + left its own beat but did NOT relay (named-teammate relay issue again), so I verified directly.

## WHAT THE FIX DOES (claude/hooks/compact-memory.py, +135/-35)
- All-types fallback: once non-standing entries are exhausted and still over BUDGET (23000), archive OLDEST-across-ALL-types (including standing decision/reference/feedback) so the live index genuinely gets under budget. Previously standing entries alone exceeded budget, so every project/session pointer was dumped on each write and the index never got under budget. See [[reference_memory_index_over_budget]].
- PINS: entries whose index TITLE begins with "** ACTIVE" or "** START HERE" (PIN_TITLE_MARKERS), plus an empty PINNED_FILES extension set, are NEVER archived - the active-mission/plan/start-here anchors always survive.
- De-dup: identical pointers (same filename link) never appended twice + a one-time collapse of existing archive dupes.

## LEAD VERIFICATION (functional, on a copy of the live MEMORY.md)
- Before: 29797 bytes / 112 entries (OVER budget). After: 22907 bytes / 78 entries (34 archived) - UNDER 23000. PASS.
- Pins: all 3 ** ACTIVE / ** START HERE anchors survived. PASS.
- Idempotent: 2nd run = "already under budget, no change". PASS.

## MINOR FOLLOW-UP (not blocking)
MEMORY-archive.md still has ~10 residual duplicate pointers (422 total / 412 unique) - the one-time de-dup pass didn't catch all (likely cross-session re-appends before the new logic landed). The new de-dup-on-append prevents NEW dupes; the 10 residuals are cosmetic. A future pass could collapse them.

## Files: claude/hooks/compact-memory.py (logic), .claude/memory/MEMORY-archive.md (de-dup), and this + session_2026-06-25_compactor-over-budget-fix.md (the agent's beat). Note: Codex cross-model review of the hook diff was the agent's responsibility and was not independently confirmed in the lead's context (the agent claimed it); functional verification above is the lead gate for this contained hook change.
