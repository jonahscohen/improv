---
name: memory-index-over-budget
description: improv's MEMORY.md exceeds the compact-memory.py 23KB budget purely from STANDING entries (decision/reference/feedback never archive), so the compactor dumps ALL non-standing project/session pointers to MEMORY-archive.md on every write and still can't get under budget. Project-pointer additions to the live index do NOT survive. Rely on standing DECISION anchors + the beat files, not the live index, for project continuity.
type: reference
relates_to: [decision_hook_system_architecture.md]
---

Collaborator: Jonah Cohen. Diagnosed 2026-06-25 while resuming the convergence mission.

## SYMPTOM
Adding a `- [..](session_2026-06-25_*.md)` pointer to MEMORY.md "vanishes" - grep finds it gone from MEMORY.md immediately after the edit, with no error. The archive (MEMORY-archive.md) shows the SAME Stage-2 entries duplicated 3+ times (every session that tried to add them).

## ROOT CAUSE (compact-memory.py behavior, NOT a bug per se)
`~/.claude/hooks/compact-memory.py` (run by the `memory-compact.sh` PostToolUse hook on every MEMORY.md write) keeps the index under BUDGET=23000 bytes by archiving the OLDEST dated, NON-STANDING entries. STANDING_TYPES = {feedback, decision, reference, user} are NEVER archived. improv's index is now ~29.8KB and the standing entries ALONE exceed 23KB. So the archive loop runs to exhaustion: it archives EVERY archivable (project/session-typed) entry - newest included, because it never reaches budget - and the file stays over budget anyway. Net effect: any project/session pointer you add is moved to the archive on the very next write.

## CONSEQUENCE
- The live MEMORY.md may be TRUNCATED by the harness at session load (the thing the compactor exists to prevent), so a session can start half-blind on the standing index too.
- Project/session continuity must come from (a) the standing `decision`-type ACTIVE-MISSION / ACTIVE-PLAN / START-HERE beats (these survive in the live index), and (b) the beat FILES themselves (grep `.claude/memory/`), NOT from project pointers in the live index.

## DON'T
Don't keep re-adding project pointers to MEMORY.md "to fix it" - each add just deposits another duplicate into MEMORY-archive.md (that's how the 3x dupes got there). Write the beat FILE (durable); skip the live-index pointer for transient project/session beats until the budget issue is resolved.

## CANDIDATE FIXES (for Jonah to weigh - global dotfiles change, do NOT apply unilaterally)
1. Raise BUDGET if the real harness limit is higher than 24.4KB now.
2. Let the compactor archive STANDING entries too once non-standing is exhausted and still over budget (oldest-first across all types), keeping only the few explicitly-pinned ACTIVE anchors.
3. De-duplicate MEMORY-archive.md (it has repeated identical pointers) and prune stale standing entries.
4. A periodic "index GC" that rebuilds MEMORY.md from current beat frontmatter, newest-N per type.
