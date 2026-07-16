---
name: Bucket-browser Task 3.5 - hook install-owners + pinned flag
description: Added hook_owner + pinned_hooks to browser-tree.json plus hook_owner/hook_pinned accessors; pinned hook leaves read always-active
type: project
relates_to: [decision_beats_hooks_stay_project_scoped.md, session_2026-07-16_bucket-browser-build-kickoff.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Task 3.5 (refinement, TDD) DONE on branch feat/installer-bucket-browser. Resolves the Task-4 blocker: hooks now carry an install OWNER (the `--only` key that installs them) and an always-on PINNED flag.

Changes:
- `claude/hooks/browser-tree.json`: two new top-level maps (siblings of `hook_desc`) - `hook_owner` (all 55 hooks -> owner key) and `pinned_hooks` (`["beats-rebuild","beats-staleness-guard"]`). Owner rule: for every hooks-node except the Beats/Hooks folder, owner = the node key (clusters safety/verification/question-discipline/grounding/api-drift/planning-git/surface/model-routing; app components sidecoach/justify/codex/chrome/cmux/figma/clickup/visualizer/fable/voice-output). Beats/Hooks folder exception (node key "Hooks" is not an install key): memory-approve/nudge/compact + consolidate-nudge -> `memory`; reflect-nudge -> `reflect`; beats-rebuild + beats-staleness-guard -> `memory` AND pinned.
- `claude/hooks/browser-lib.sh`: `browser_load` now loads `hook_owner` -> `BR_HOOKOWNER_<hex>` and `pinned_hooks` -> `BR_PINNED_<hex>=1` (encoded plain-scalar globals, bash-3.2 safe; both prefixes added to the reset loop). New accessors `hook_owner <hook>` (owner key, empty if unknown) and `hook_pinned <hook>` (0 if pinned else 1, via `${!n-}` indirect read). `item_state` leaf branch: a hook leaf (parent node kind `hooks`) that is pinned echoes `active` WITHOUT calling the probe; the `node_kind "$parent" = "hooks"` guard keeps top-level component leaves from ever false-positiving (a no-slash path where `${path%/*}` returns the whole string resolves to a leaf parent, not hooks).
- `claude/hooks/test-component-browser.sh`: 10 new owner/pinned assertions. 34/34 pass under `/bin/bash` 3.2.57.

Why: apply logic needs the per-hook install owner (Beats/Hooks mixes memory + reflect + project-scoped mechanisms), and the 2 project-scoped beats hooks are always-on and not installer-toggleable.

Independent review (Codex unavailable on this box -> fresh Claude reviewer, not the producer): bash-3.2 safety CLEAN, 55/55 owners complete+correct, pinned set exact, browser_load reset correct, JSON valid. One Medium raised: `counts()` (rollup driver) is NOT pinned-aware, so with a probe that reports pinned hooks off, a folder can show `none` while its pinned children show `active`. DELIBERATELY NOT folded in - it is out of Task 3.5 scope ("modify item_state ... otherwise unchanged") AND would break the already-committed Task 3 test contract (`counts 'Beats/Hooks'` = `2/7`, which excludes the two pinned hooks; forcing pinned on -> `4/7`). In production the pinned hooks are project-scoped always-installed, so `_real_probe` reports them active and the rollup agrees. Flagged as a concern for the task author to decide (possible follow-up: make counts pinned-aware AND update the Task 3 counts expectations together).

Files touched: claude/hooks/browser-tree.json, claude/hooks/browser-lib.sh, claude/hooks/test-component-browser.sh.
