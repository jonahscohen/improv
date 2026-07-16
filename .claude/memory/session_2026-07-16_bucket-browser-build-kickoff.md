---
name: Bucket-browser build kickoff - worktree setup (branch from local HEAD, not stale origin)
description: Starting the subagent-driven build of the installer bucket browser per the plan. Jonah chose commit-design-then-build + isolated worktree. Setting up a worktree branched from LOCAL HEAD because origin/main is 16 commits behind (nothing pushed this session).
type: project
relates_to: [decision_installer_bucket_browser.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: none (setup in progress)
confidence: high
---

Design fully committed to main (07e541ec docs = spec+prototype+plan; 05546ed8 beats). Jonah chose: commit design -> start build -> isolated worktree, and FULL per-hook control for app components (Task 5).

**WORKTREE SETUP - critical gotcha:** local `main` is **16 commits ahead of origin/main** (NOTHING pushed this whole session - Stage 3b's install.sh changes, the codex fix, and the design docs are all local-only). `worktree.baseRef` is unset -> defaults to `fresh` = origin/main. So a default `EnterWorktree name=...` would branch from a STALE origin MISSING Stage 3b's install.sh work AND the plan/prototype -> would break the build. FIX: create the worktree from LOCAL HEAD via `git worktree add .claude/worktrees/installer-bucket-browser -b feat/installer-bucket-browser` (branches from HEAD by default), THEN enter it via the native `EnterWorktree path=...` (the tool docs explicitly support entering a git-worktree-add-created worktree under .claude/worktrees/). Added `.claude/worktrees/` to .gitignore first (skill safety requirement for project-local worktrees).

**BUILD PLAN:** docs/superpowers/plans/2026-07-16-installer-bucket-browser.md - 10 TDD tasks, subagent-driven (fresh subagent per task + spec-review + quality-review). The prototype (docs/superpowers/specs/2026-07-16-installer-bucket-browser-prototype.html) is the reference implementation to port to bash.

**Status:** worktree being created; next = enter it, verify baseline (bash -n + parity), dispatch Task 1 (browser-tree.json + test scaffold).
