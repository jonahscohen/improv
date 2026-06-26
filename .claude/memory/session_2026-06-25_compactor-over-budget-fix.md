---
name: compactor over-budget standing fix
description: Fixed compact-memory.py so the live MEMORY.md always reaches the 23000-byte budget even when standing entries alone exceed it - all-types oldest-first fallback (minus pinned anchors) + archive de-duplication. Verified on copies of the real index; live files untouched (lead writing concurrently).
type: project
relates_to: [reference_memory_index_over_budget.md, decision_hook_system_architecture.md]
---

Collaborator: Jonah Cohen. 2026-06-25. Teammate task #3 (fixing the harness bug diagnosed in [[reference_memory_index_over_budget]]).

## PROBLEM
`claude/hooks/compact-memory.py` (live via the `~/.claude/hooks/` symlink; run by `memory-compact.sh` PostToolUse on every MEMORY.md write) kept MEMORY.md under BUDGET=23000 by archiving only OLDEST NON-STANDING entries; STANDING_TYPES {feedback,decision,reference,user} were never archived. improv's standing entries ALONE exceeded 23KB, so the loop ran to exhaustion: it archived every project/session pointer (newest included) and STILL stayed over budget. Net effect: any project pointer added vanished into the archive on the next write, and MEMORY-archive.md accrued the same pointers duplicated many times.

## FIX (3 parts)
1. **All-types oldest-first fallback.** Replaced the non-standing-only filter with a single sort over all non-PINNED candidates keyed `(is_standing, date_key)`: non-standing (False) shed before standing (True); within each group oldest-first; undated (`9999-99-99`) sorts last (kept longest). Loop archives until `byte_size(header, keep) <= BUDGET`, so the live index ALWAYS reaches budget.
2. **Pins.** `is_pinned(m)` - title starts `** ACTIVE` / `** START HERE` (PIN_TITLE_MARKERS) or filename in `PINNED_FILES` (empty default extension point). Pinned anchors are excluded from candidates and never archive, so ACTIVE-MISSION / ACTIVE-PLAN / START-HERE always stay live.
3. **De-dup.** `dedup_archive()` collapses pre-existing duplicate pointers (same filename link) to first occurrence, preserving section comments + blanks. Append path skips any victim whose filename is already in the archive, so a pointer is never written twice. Beat FILES never touched - only pointers move between the two index files.

Also: `byte_size` now measures UTF-8 BYTES (was char count) - the budget is a byte limit and the real index has ~154 bytes of non-ASCII; char-count would let a unicode-heavy index slip over. Both MEMORY.md and MEMORY-archive.md writes are change-guarded (only rewrite when content differs) -> idempotent, won't fight an in-progress edit.

## VERIFY (on COPIES - live files left alone, lead writing beats concurrently)
- Real index copy: BEFORE 29797 bytes / 112 entries; AFTER run 1 = 22907 bytes (< 23000) / 78 entries, 34 archived. All 3 pins retained. Archive 422 lines/412 unique -> 446 lines/446 unique (10 pre-existing dupes collapsed, 34 new appended, zero dupes). Run 2 = "already under budget, no change" (idempotent).
- No data loss: all 412 original-unique archive pointers still present; all 34 entries that left live are in the archive.
- Self-test `test-compact-memory.sh` rewritten: scenario A (non-standing exhaustion suffices -> standing retained, original 2026-06-06 detection behavior preserved) + scenario B (over-budget-standing -> all-types fallback, pins survive, de-dup collapse + no-re-append, idempotency across both files). 28/28 PASS.

## CODEX CROSS-MODEL REVIEW (folded)
Independent codex review (read-only, high reasoning) CONFIRMED: pins never archive (combined `(is_standing, date_key)` sort over non-pinned candidates is correct), de-dup is safe + lossless (a victim already in the archive is removed from live but keeps its first archive occurrence - pointer never lost), idempotency is real after one normalization pass, UTF-8 byte accounting correct. FOLDED Finding 2: when header + pins ALONE exceed budget the loop can't reach budget (unavoidable) - the old code would still print "already under budget"; now it reports an honest stderr WARNING with the real size, and a new scenario C proves pins survive + return 0 + idempotent in that degenerate case. Codex's other note (read-then-write concurrency race) pre-exists this change and is why I tested only on copies; a file-lock guard is out of scope.

## NOTES FOR LEAD
- Files modified: `claude/hooks/compact-memory.py`, `claude/hooks/test-compact-memory.sh`. Did NOT touch anything under `sidecoach/`. Did NOT commit.
- Did NOT manually de-dup the LIVE MEMORY-archive.md. The fixed compactor de-dups it automatically on the next MEMORY.md write (verified on a copy). The fix is live the instant the file is saved (symlink), so the next beat write self-heals the live archive.

Files touched: claude/hooks/compact-memory.py, claude/hooks/test-compact-memory.sh
