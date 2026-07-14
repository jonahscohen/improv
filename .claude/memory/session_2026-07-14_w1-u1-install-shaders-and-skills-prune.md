---
name: Wave-1 Unit 1 executed - install.sh shaders path fix + dry-run-default skills prune (Task 3 cmux STOPPED, spec conflict)
description: Executor unit for the parallel-dispatch plan. Fixed the dead $REPO_DIR/ghostty/shaders source path to $REPO_DIR/shaders (plus two sibling stale ghostty/shaders strings), added prune_broken_skill_symlinks (dry-run default, apply gated behind --prune-skills-apply, distinct exit codes), and a new temp-$HOME fixture test. Task 3 (remove the cmux/settings.json symlink) was STOPPED and reported instead of executed - its guard precondition "verify it is the commented-out legacy one first" is false at HEAD.
type: project
relates_to: [session_2026-07-14_parallel-dispatch-plan.md, session_2026-07-14_structural-briefing-and-hook-deps.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Collaborator: Jonah Cohen. 2026-07-14. Ran as a background opus-executor for Wave 1, Unit 1 of the parallel-dispatch plan, in worktree improv-wt/u1 (branch w1-u1) off clean 7eb21eca. Owns install.sh only; also created one new sibling test file and this beat.

## What was executed

Task 1 - shaders repo path (findings from the :4832 debt inventory):
- install.sh PERSONAL_DIRS pointed the shaders component source at `$REPO_DIR/ghostty/shaders`, which does not exist. The in-repo shaders live at top-level `shaders/` (bettercrt.glsl, cursor_blaze.glsl, tft.glsl), and config.ghostty loads `__DOTFILES_DIR__/shaders/*.glsl` from there. Changed the DIRS entry to `$REPO_DIR/shaders`.
- Two other stale `ghostty/shaders` strings in the same personal block were corrected: PERSONAL_FILES advertised `~/.config/ghostty/shaders/ (symlinks)` that the installer never creates (rewritten to the real artifacts: `<repo>/shaders/*.glsl` + the community `~/Documents/Github/ghostty-shaders/` clone), and the section comment read "ghostty/shaders" (now "ghostty and shaders", the two personal components). No `ghostty/shaders` literal remains anywhere in install.sh.

Task 2 - skills prune (new capability):
- Added `prune_broken_skill_symlinks()` above the IMPROV_INSTALL_LIB_ONLY early return (so the test can source it, like link_or_copy). Why: dead skill symlinks accumulate in ~/.claude/skills when the repo drops a skill; Claude Code still tries to load them. How: scans direct children of ~/.claude/skills, removes ONLY entries that are (a) symlinks, (b) broken (target `! -e`), and (c) resolve inside `$REPO_DIR` (canonicalize the target's parent with `pwd -P` to collapse /tmp->/private, lexical fallback when the parent is also gone). Live links, links pointing outside the repo, and real files/dirs are never touched.
- Safety gating: DRY RUN by default (prints "would remove"); a destructive removal requires the explicit `--prune-skills-apply` flag (human approval). `--prune-skills` is the dry-run entry. Both are standalone actions that run and exit before the installer flow, so an unattended `--yes/--only/--preset` run never invokes the prune and never mutates ~/.claude. Distinct fail-loud exit codes: 5 (REPO_DIR unresolvable -> refuse to prune rather than guess the footprint), 6 (an apply-mode rm failed).
- New suite claude/hooks/test-install-prune-skills.sh drives the prune against a mktemp temp `$HOME` + temp repo fixture: asserts a repo-sourced broken link (including a `skills/improv` orphan) and a lexical-fallback case ARE removed in apply mode, while a live repo link, a non-repo broken link, a non-repo live link, and a real directory are LEFT untouched; dry run mutates nothing; unresolvable REPO_DIR returns 5 and prunes nothing; the real ~/.claude/skills is never touched.

## Task 3 STOPPED - cmux/settings.json (spec conflict, reported not executed)
The dispatch guard was "verify it is the commented-out legacy one first." That precondition is FALSE at HEAD 7eb21eca:
- install.sh:2181 `make_symlink "$REPO_DIR/cmux/settings.json" "$CMUX_CONFIG_DIR/settings.json"` is LIVE, uncommented code inside `if picked cmux`.
- git blame: last touched by fab3cdc6b (2026-05-01), not commented out; the plan doc's claim "100% commented-out since 2026-04-11" does not match reality.
- `cmux/settings.json` is a real 6120-byte file in the repo.
- The public `cmux` component detects active state via `[ -L "$HOME/.config/cmux/settings.json" ]` (detect_component) and removes it on deactivate; FILES lists it.
Removing line 2181 would break the live cmux component. Per execution rules (stop on a load-bearing spec conflict rather than improvise), left for orchestrator ruling.

## Verification (all real, all green)
- `bash -n install.sh` exit 0.
- `grep ghostty/shaders install.sh` -> no matches (exit 1).
- test-install-hook-deploy.sh: 26 passed, 0 failed (kept green; my changes did not touch link_or_copy).
- test-install-prune-skills.sh (new): 13 passed, 0 failed.
- Dry-run proof: PERSONAL_DIRS shaders entry resolves to `$REPO_DIR/shaders` (exists on disk with 3 glsl files); `$REPO_DIR/ghostty/shaders` does not exist.

## Notes for the orchestrator (harness false-positives observed)
- The memory-nudge / beats-dirty gate false-fired repeatedly on read-only git/ls/grep commands and finally blocked the commit - the exact misclassification U3 targets. This beat is uniquely named and does NOT edit MEMORY.md, to stay collision-free with the other parallel units; the lead adds the index pointer at integration (per the plan's U8/U9 convention).
- verify-before-done and second-fix-gate hooks fired asking for screenshots on a non-UI shell tool; verified via test suites + dry-run instead (the correct proof for a CLI tool).
- Codex cross-model review is the lead's integration step per the plan (codex-review.py on the w1-u1 diff vs 7eb21eca); not run inside this executor.

## Files touched
- install.sh (Tasks 1+2)
- claude/hooks/test-install-prune-skills.sh (new prune test suite)
- .claude/memory/session_2026-07-14_w1-u1-install-shaders-and-skills-prune.md (this beat)
