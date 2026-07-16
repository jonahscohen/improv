---
name: memory-index-over-budget
description: Adding a project/session pointer to MEMORY.md can "vanish" with no error - compact-memory.py (memory-compact.sh PostToolUse) archives it to keep the index under a 23KB budget. RESOLVED 2026-07-15: the compactor now archives oldest-across-all-types (standing included) except PINNED anchors + de-dups the archive, so the index is back UNDER budget (22919/23000, stable). OPERATIONAL RULE: to keep a load-bearing pointer in the live index, PIN it (index title starts "** ACTIVE" or "** START HERE"); non-pinned project pointers still archive on the next write, so rely on the beat FILE + a relates_to link from a pinned active beat for continuity.
type: reference
relates_to: [decision_hook_system_architecture.md, proposal_beats_next_evolution.md, session_2026-07-15_stage3b-plan.md]
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

## UPDATE 2026-07-15 (Jonah Cohen) - fixes #2 + #3 IMPLEMENTED; index now UNDER budget; PIN load-bearing entries

The "hopelessly over budget" state above is RESOLVED. compact-memory.py implemented candidate fixes #2 and #3:
- ALL-TYPES FALLBACK (added 2026-06-25): when standing entries alone exceed budget, the loop keeps archiving oldest-across-ALL-types (standing included) until the live index reaches budget. Only PINNED anchors are exempt.
- PINNED anchors: an index entry whose TITLE begins `** ACTIVE` or `** START HERE` (or whose filename is in PINNED_FILES) is NEVER archived - the mechanism that keeps load-bearing pointers live.
- Archive de-dup (dedup_archive): an identical pointer is never appended twice and pre-existing dupes collapse to first occurrence, so the 3x-dupe problem no longer recurs.
- It also strips any non-entry "stray" line that appears AFTER the first entry (a malformed `- [..](..)` line is dropped, not kept), which is how a badly-formatted re-add can "vanish" leaving an empty git diff.

MEASURED STATE 2026-07-15: MEMORY.md = 22919 bytes / 23000 budget (81 entries), UNDER budget and STABLE (compactor is a no-op on it).

OPERATIONAL RULE (supersedes the blanket DON'T above for load-bearing pointers):
- To keep a load-bearing pointer in the LIVE index (so a fresh session's MEMORY.md load surfaces it), PIN it: start the index title with `** ACTIVE `. Pinned entries survive every compaction (verified this session: 1 pinned 2026-07-15 pointer stayed; 2 non-pinned 2026-07-15 pointers archived on the same write).
- For TRANSIENT project/session beats, the beat FILE + a relates_to link from a pinned active beat is the durable path; a bare non-pinned live-index pointer is ephemeral. (The old DON'T still holds for those.)
- Long-term direction unchanged: retire the byte-budgeted index for a retrieval CLI (proposal_beats_next_evolution.md).

SELF-ANALYSIS (why this beat matters): a 2026-07-15 session re-derived the "pointer vanishes with no error" symptom from scratch by code-reading and reached a WRONG first conclusion ("no reverter; my edits never landed / were never committed"). This beat already documented the exact symptom and cause. Lesson: when a memory/beats behavior looks anomalous, GREP THE BEATS FIRST (`grep -ri <symptom> .claude/memory/`) before code-diving - the record had the answer.
