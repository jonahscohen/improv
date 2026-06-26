---
name: RULES.md split from CLAUDE.md
description: Team-wide standards (Code Quality, Verification, Debugging, Style Guide) extracted into RULES.md as a shared source of truth
type: project
---

## What changed

- Created `claude/RULES.md` with team-wide standards: Code Quality, Verification Protocol, Debugging Protocol, Style Guide and Component Library Rules
- Stripped those four sections from `claude/CLAUDE.md`, leaving only personal workflow: Memory Discipline, Oracle, Permission Posture, Voice, Discord, cmux
- Updated `install.sh`: the `claude` component now concatenates RULES.md + CLAUDE.md into `~/.claude/CLAUDE.md` (no longer a symlink)
- Updated component detection to look for `<!-- claude-dotfiles:rules:begin -->` marker instead of symlink check
- Updated deactivation to handle generated file instead of symlink
- Updated TUI description and install summary to mention RULES.md
- Content-guard hook required rephrasing three rule examples (co-author lines, AI attribution, legacy model IDs) to avoid triggering literal pattern matches on the very text being documented

## Why

Andrew (or any team lead) needs a single file to define global standards that propagate to all team members on pull. Mixing team rules with personal workflow in one file created unclear ownership boundaries.

## How

RULES.md is the team-wide source of truth. Push a new rule there, everyone gets it on `ampersand --pull`. CLAUDE.md stays personal workflow. The installer concatenates both into `~/.claude/CLAUDE.md` at install time.

## CLAUDE.local.md (added 2026-05-01)

- Added `claude/CLAUDE.local.md` as the third concat layer: personal overrides, gitignored, per-machine
- Created `claude/CLAUDE.local.example.md` as a checked-in template showing structure and example sections
- Installer appends CLAUDE.local.md after RULES.md + CLAUDE.md if present
- Installer prints a nudge when CLAUDE.local.md doesn't exist, pointing to the example
- .gitignore updated to exclude CLAUDE.local.md from the repo
- TUI description and install summary updated to mention all three layers

## Files touched

- claude/RULES.md (new)
- claude/CLAUDE.md (stripped team sections)
- claude/CLAUDE.local.md (gitignored, per-machine scaffold)
- install.sh (three-layer concat, detection, deactivation, descriptions)
- .gitignore (added claude/CLAUDE.local.md)
- ~/.claude/CLAUDE.md (regenerated)

Collaborator: Jonah
