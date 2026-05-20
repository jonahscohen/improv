---
name: Reflection actions 1-6 deployed
description: Five parallel agents executed reflection_2026-05-19 actions; settings.json wired; remaining work documented
type: project
relates_to: [reflection_2026-05-19.md, session_2026-05-19_verify-hook-server-offramp.md, session_2026-05-19_second-fix-gate-hook.md, plan_claude_md_split.md, decision_hook_system_architecture.md]
---

## What shipped (2026-05-19)

| Action | Status | Where |
|--------|--------|-------|
| #1 Drop Read from memory-nudge matcher | DONE | `~/.claude/settings.json` PostToolUse[0].matcher (Read removed) |
| #2 verify-before-done.sh server off-ramp | DONE | repo + installed identical; accepts test runs, node probes, ext curl, /tmp/ log Reads |
| #3 Mark 3 stale memories superseded | DONE | feedback_speak_responses, project_discipline_enforcement_plan, session_2026-05-04_handoff + back-links |
| #4 decision_hook_system_architecture.md | DONE | full 16-hook inventory + flag registry + precedence + recipe |
| #5 Second-fix gate hook | DONE | claude/hooks/second-fix-gate.sh + symlink + wired in installed settings.json |
| #6 CLAUDE.md split plan | DRAFTED (not executed) | plan_claude_md_split.md - reconcile installed→source FIRST, then slim |

## Settings.json wiring applied
- `~/.claude/settings.json` PostToolUse[0]:
  - Matcher changed from `Write|Edit|MultiEdit|Bash|Read` → `Write|Edit|MultiEdit|Bash`
  - Added third hook: `~/.claude/hooks/second-fix-gate.sh` (after verify-before-done.sh, so it sees the freshly-set `.needs-verification` flag from the same fire)
- JSON validated post-edit.

## Drift NOT reconciled this pass
The repo's `claude/settings.json` does NOT contain the PostToolUse hook block - those wirings only exist in `~/.claude/settings.json` (installed-only). The hook scripts themselves ARE in the repo and symlinked; only the wiring is divergent. A fresh install would lose the new wiring. Per Agent E's plan, this is part of a broader settings.json/CLAUDE.md reconciliation - addressed in `plan_claude_md_split.md`.

## Surprises from the deploy
- Only 5 of 16 hook scripts are wired in repo settings.json; the other 11 wirings live in machine-local installed settings (per Agent C). Same drift pattern as CLAUDE.md.
- The 67% CLAUDE.md drift figure in the reflection was wrong (per Agent E): installer concatenates 3 source files; installed is actually 47 lines SHORTER than a fresh install. Real drift is 46 lines installed-only (unmerged from May 18 hook-gated voice rewrite) + 87 lines source-only (never installed). Direction still correct: reconcile + slim. Magnitude different.
- Agent D flagged a syntax error in installed verify-before-done.sh at line 97; verified post-deploy that repo and installed are now identical and both exit cleanly on test inputs. Was either a stale-read artifact or fixed by Agent A's edits.

## Verify the new gate actually fires (test plan for next session)
1. Edit a file under `improv/core/` (sets `.needs-verification`)
2. Within 10 minutes, edit another file in the same dir without running a test
3. Expected: second-fix-gate.sh emits the "SECOND FIX DETECTED" warning text
4. If it doesn't fire, check: `cat ~/.claude/.last-fix-file` and `ls -la ~/.claude/.needs-verification`

## Collaborator
Jonah
