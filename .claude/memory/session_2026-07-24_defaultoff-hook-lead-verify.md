---
name: default-off-hook engine lead-verified + committed (GUI opt-in gap closed)
description: Lead independently confirmed defaultoff-hook's fix - test-component-browser.sh 139/0 (was 127), browser-lib.sh diff is 21 lines mirroring pinned_hooks with ONE functional token, browser-tree.json marks sidecoach-detect default-off. Recall preserved (every non-default-off hook unchanged). The "Install all means all" boundary accepted as a sound default.
type: project
relates_to: [session_2026-07-24_defaultoff-hook-engine.md, session_2026-07-24_stage3b-detect-packaging.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests - lead re-ran test-component-browser.sh (139/0), read the browser-lib.sh diff (surgical, mirrors pinned), confirmed the single guard token and the tree entry
confidence: high
---

Collaborator: Jonah. 2026-07-24. defaultoff-hook closed the GUI-install opt-in gap for sidecoach-detect; lead-verified and committed.

## Lead verification (not the teammate's self-report)
- **Gate**: `test-component-browser.sh` -> 139 passed / 0 failed (was 127; +12 assertions incl. master-leaf INSTALL-but-off, no-recall-loss, negative control).
- **Conservatism**: `git diff browser-lib.sh` = 21 added lines, all mirroring the pinned_hooks mechanism (BR_DEFAULTOFF_* loader emit, hook_default_off helper, the allowlist entry). The ONLY functional change is the single guard token on the leaf-install force-enable branch - for any non-default-off hook it reduces to the original condition, byte-identical.
- **Tree**: browser-tree.json marks `default_off_hooks: ["sidecoach-detect"]`.
- **Recall preserved**: default_off deliberately does NOT touch hooks_owned_by / counts / item_state / stage_toggle, so a default-off hook stays owned/toggleable/probe-read - it just installs-but-off under a master-leaf install.

## The "Install all means all" boundary (accepted, not a gap)
defaultoff-hook correctly declined to make the explicit "Install all hooks" bulk action respect default-off, and LOCKED it with a test. Rationale accepted: the gap being closed was the whole-component MASTER-LEAF install (now fixed); an explicit "install all" opting detect in is consistent with per-hook opt-in semantics (all means all), and a row labeled "all" that skips detect would be a label-lie of the class the test file exists to catch. Making install-all respect default-off would be a SEPARATE design call. No user decision forced - defensible default.

## Committed
As its own unit (browser-lib.sh + browser-tree.json + test-component-browser.sh + beats). Disjoint from the two still-running teammates (arm-narrow on verify-before-done, modes-delete on sidecoach vocab), so committed independently without touching their in-flight work.

## Files touched
- this beat + MEMORY.md index. The commit: claude/hooks/{browser-lib.sh, browser-tree.json, test-component-browser.sh}.
