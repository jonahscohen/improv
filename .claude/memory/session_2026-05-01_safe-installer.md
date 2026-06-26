---
name: Safe installer redesign - additive components, clean uninstall
description: Splitting monolithic claude into brain + config, making all installs additive (marker-guarded appends, JSON-merge), fixing all deactivation, adding picker descriptions, rebranding colors
type: project
---

Collaborator: Jonah Cohen

## Design decisions

- `claude` component splits into `brain` (CLAUDE.md content) and `config` (settings.json + hooks)
- Brain: marker-guarded append to ~/.claude/CLAUDE.md (user's existing content preserved)
- Config: JSON-merge into settings.json (user's defaultMode, model, etc. untouched), hook scripts copied alongside existing hooks
- Every component is now additive. Zero data loss risk.
- Every deactivation removes only what we installed, verified by marker or symlink target
- Discord scripts moved from old claude to discord component
- Voice and discord get proper deactivation functions
- `--only claude` stays as backward compat alias for `brain,config` with deprecation notice
- Returning-user picker shows component descriptions inline
- Color rebrand: red yes& logo, dark cyan accents (replacing purple)

## Spec

`docs/superpowers/specs/2026-05-01-safe-installer-design.md`

## Plan

`docs/superpowers/plans/2026-05-01-safe-installer.md` (7 tasks, 0-6)

## Progress

All 7 tasks complete. Pushed to origin/main.

- Task 0: Color rebrand (3ab5f05) - red logo, dark cyan accents
- Task 1: Split arrays (5068ea7) - claude -> brain + config in KEYS/TITLES/DESCS
- Task 2: Detect + deactivate (fb051c9) - new functions for brain, config, voice, discord
- Task 3: Install sections (fab3cdc) - additive brain (marker-append) + config (JSON-merge), Discord scripts moved
- Task 4: Picker descriptions (0bee1ee) - status table and gum choose show TITLES inline
- Task 5+6: State migration + verify (9892107) - legacy claude migrates to brain+config, all dry-run tests pass

## Verification results

- `bash -n install.sh` - clean
- `--dry-run --yes` - all 10 components selected
- `--dry-run --only claude` - deprecation warning, selects brain + config
- `--dry-run --only brain,config` - selects both, no warning
- `--dry-run --preset minimal` - brain, config, memory, skills, nvm

## Post-plan polish (user-driven fixes)

- a58a584: Fixed picker column alignment (%-14s), dark cyan header color
- 12a7b41: Moved (quit) to top of picker list, fixed all remaining purple/periwinkle (#a5b4fc) to cyan (#67e8f9) across all gum choose calls (fresh-flow welcome, a-la-carte checkbox, action picker)

## README update (38026a1)

Full README rewrite to match the safe installer: 14 specific changes across all 5 acts. Component table updated (7->10, claude->brain+config, added voice+discord). All "additive" messaging updated. Skills section adds component-gallery-reference. Architecture section: symlink strategy replaced with merge/append/copy strategy. Plugin table: added 5 newer plugins (23 total). Removed "What's NOT additive (yet)" section. Troubleshooting updated. 829 lines, net zero change.

## README second pass (cfa76f9)

- Added RULES.md / CLAUDE.md / CLAUDE.local.md three-layer architecture explanation to "The Claude Code brain" reference section
- Added three-layer mention to "What this is" overview
- Added full component-gallery-reference section to the design stack detail (research layer between Oracle and make-interfaces-feel-better)
- Trimmed project root MEMORY.md index: removed 4 superseded memory-permission entries, shortened all entries to under 100 chars

## CLAUDE.md bloat fix (320e7bf)

- Root cause: Memory Discipline section (4K chars) was duplicated - once from the `memory` component's append, once from inside `claude/CLAUDE.md` which the `brain` component appends. Total was 44.4K chars, over the 40K limit.
- Fix: extracted Memory Discipline into `claude/memory-discipline-section.md` as its own file. Removed it from `claude/CLAUDE.md`. Memory component reads from the new file instead of awk-extracting from CLAUDE.md.
- Also fixed `--only`/`--yes` flag precedence bug: `--yes` was calling `set_all 1` which overwrote `--only`'s selections. Now `--yes` alone means "install everything", but `--only X --yes` respects the `--only` selection.
- Result: 27.2K chars deployed, well under 40K limit.

## Picker pagination fix (1e1c87d)

- Added `--height 15` to the gum choose call so all 11 items (10 components + quit) display without pagination.

## Cleanup

- Killed dev servers (ports 5199, 3000)
- Removed eval workspace (~/.claude/skills/component-gallery-reference-workspace/)

## Files

- `install.sh` - all changes (8 commits total)
- `README.md` - full update for safe installer (1 commit)
- `docs/superpowers/specs/2026-05-01-safe-installer-design.md` - spec
- `docs/superpowers/plans/2026-05-01-safe-installer.md` - plan
