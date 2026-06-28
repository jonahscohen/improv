---
name: pr-merged-to-main
description: PR #1 (the phase-2 reimplementation, one clean squashed commit) is MERGED to main via squash. The reimplementation is now canonical. Merge commit 2bbeabd4. Pre-squash 135-commit history backed up locally at backup-phase2-prescrub.
type: project
relates_to: [session_2026-06-26_history-squash.md, session_2026-06-26_PR-opened.md, MISSION-COMPLETE-stage5-6.md]
---

Collaborator: Jonah Cohen. 2026-06-26.

## MERGED
PR #1 squash-merged to main (Jonah confirmed past the merge safety guard). merge commit 2bbeabd4, mergedAt 2026-06-26T05:31:49Z, state MERGED. The phase-2 reimplement-and-own + one-engine convergence is now the canonical main.

## STATE / SAFETY
- main now carries the full phase-2 work as one clean commit (no trace of the scrubbed comparator name in tree, diff, or message).
- Pre-squash granular history preserved at local branch backup-phase2-prescrub (135 commits) if bisectability is ever needed.
- Local main may be behind origin/main until pulled (the merge happened on GitHub).

## DONE THIS ARC (for the record)
Option B convergence (beat the oracle on every aggregate axis, one engine, simpler) -> committed -> codex-doctor hooks + codegen guard -> PR opened -> competitor scrub (content + filenames + dependency) -> codex-gate Claude-fallback rule -> history squashed -> merged to main.

## Files touched
- (merge record; main updated on GitHub)
</content>
