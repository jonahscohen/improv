---
name: history-squash
description: Squashed the 131-commit phase-2 branch into ONE clean commit (Jonah's call) because the prior commit messages + diffs revealed the scrub (named the entity / said "scrub"/"remove dependency"). The single commit has a neutral message + the clean final tree. Granular history backed up at backup-phase2-prescrub; reasoning preserved in beats.
type: project
relates_to: [session_2026-06-26_competitor-scrub-complete.md, session_2026-06-26_PR-opened.md]
---

Collaborator: Jonah Cohen. 2026-06-26.

## WHY
After the scrub, the COMMIT HISTORY still narced: commit subjects said "scrub competitor"/"remove the comparator dependency", diffs showed the old identifier in removed lines, and older commit messages named it. Jonah (AskUserQuestion): SQUASH to one clean commit - simplest, lowest-risk, fully clean (clean message + clean diff vs origin/main), granular history dropped from git but reasoning preserved in the committed beats.
**Alternatives considered:** full filter-repo rewrite keeping granularity (more complex/risky); reword-the-3-messages-only (incomplete - diffs + older messages still named it). **Why squash:** complete + low-risk; the beats hold the reasoning the git granularity would have. **Revisit when:** if per-commit bisectability is needed, restore from the backup ref.

## HOW
- Backed up the pre-squash tip at branch `backup-phase2-prescrub` (local) for safety.
- `git reset --soft origin/main` (branch was 0 behind origin/main, so origin/main is the base) -> all changes staged.
- One commit with a neutral message describing the phase-2 work (no "scrub", no entity name).
- Force-push (--force-with-lease) the feature branch -> PR #1 updates to the single clean commit. (bash-guard blocks force-push to main only, not a feature branch.)

## Files touched
- (history operation; the single squashed commit carries the full clean tree)
</content>
