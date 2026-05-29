---
name: TASKS.md cleanup - removed all completed entries
description: Pruned 29 done tasks from TASKS.md down to the 2 open ones; detail preserved in beats + git
type: project
---

Collaborator: Jonah. 2026-05-28.

Jonah asked to review unfinished tasks and clear out finished ones. AskUserQuestion -> "Remove all completed."

## State at cleanup
Only 2 unfinished tasks remained; everything else (29 entries) was done and scattered across the Active + Done sections.

## Open tasks kept
- T-0001 [P2] research QuiverAI implementation methods (oldest open, no work started).
- T-0007 [P2] Codex + Gemini CLI orchestration for sidecoach (large; spec says design-memo-first).

## What was removed
All 29 [x] DONE entries (T-0002..T-0006, T-0008..T-0033) plus the now-empty `### Done` section under sidecoach. Each removed entry's full detail lives in its referenced `.claude/memory/` beat and in git history, so nothing is lost. Last-ID counter preserved at T-0033 (next task = T-0034). Added a header comment documenting the "remove once done; detail in beats + git" convention.

## Not filed (flagged to Jonah)
The skill-recon Tier 2 backlog (content-resilience, clip-path, CSS recipe catalog, URL-as-state, dark-mode mechanics, touch CSS, chart-selection matrix, 2 motion rules, copywriting, char-substitution, image/perf) still lives only in session_2026-05-28_skill-recon-synthesis.md - never filed as tasks. Offered to file them; left unfiled pending Jonah's call so the freshly-cleaned list stays lean.

## Files
- TASKS.md (29 done entries removed; 2 open retained)
