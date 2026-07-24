---
name: Stage 3b detect hook - packaging as OPT-IN component
description: Wired claude/hooks/sidecoach-detect.sh through the component-packaging system (tree + install_app_hooks + app-wirings) so the hook-registry gate passes, shipped OPT-IN via a default-off seed; Codex found a residual browser-master-install path that arms it, escalated to Jonah as an engine design decision.
type: project
relates_to: [session_2026-07-24_stage3b-detect-hook.md, session_2026-07-24_two-stop-gates-visual-and-registry.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests / codex-review
confidence: high
---

Packaged `claude/hooks/sidecoach-detect.sh` (the Stage 3b advisory PostToolUse scanner, still uncommitted/untracked) so it clears the `hook-registry-stop.sh` gate and becomes an installable, browser-visible, sidecoach-owned component - shipped OPT-IN (default OFF), not default-active. Authored against HEAD d2fca78d.

**What was wired (the manifests):**
- `claude/hooks/browser-tree.json` - added `sidecoach-detect` to sidecoach's `hooks` list (7th, last), to `hook_desc` (a real actionable sentence, not a placeholder), and to `hook_owner` (-> sidecoach).
- `install.sh` - appended `sidecoach-detect.sh` to the `picked sidecoach && install_app_hooks ...` line; added it to the `deactivate_sidecoach` file-removal loop.
- `claude/hooks/app-wirings.json` - added its `PostToolUse` `Write|Edit|MultiEdit` entry, timeout 120 (accommodates the hook's 90s internal scan default; taste-gate's sibling entry is the shape precedent).
- `claude/hooks/test-component-browser.sh` - updated the one hardcoded assertion (`node_children 'sidecoach/Hooks'`) + comment from 6 to 7 hooks; check #1 requires this test green and it asserts the exact sidecoach hook list.

**The OPT-IN mechanism (default-off seed).**
Why not "deploy-but-don't-wire": `browser-lib.sh` `_real_probe` keys a hook's on/off off `is_our_hook` (FILE PRESENCE), so a deployed-but-unwired hook reads "active" in the browser - a lie of exactly the class this whole registry system exists to kill. The honest opt-in state is file-absent-by-default.
Why not `pinned_hooks`: pinned = always-on + not installer-managed (never installs elsewhere). Wrong on both counts for an installable opt-in hook.
How: a seed near install.sh top (`if [ -z "${_AMPERSAND_HOOK_OFF+x}" ]; then HOOK_OFF="...sidecoach-detect.sh"; fi`) adds detect to the off-list ONLY when the caller did not SET the sentinel. `install_app_hooks` then routes it to DROP (file not deployed, no PostToolUse wiring). The component browser ALWAYS sets `_AMPERSAND_HOOK_OFF` (browser-lib.sh:752), so its per-hook toggle overrides the seed and wires detect on; `apply_plan` then keeps that state via the file-presence probe. A plain re-run resets it to OFF - the same way a plain re-run resets every other component hook to its own default (ON). CLI opt-in one-liner: `_AMPERSAND_HOOK_OFF="" bash install.sh --only sidecoach --yes`.

**Verify (all real):**
- `hook-registry-guard.sh --audit` exit 0 (was 1 with `UNMANAGED: sidecoach-detect`); `--check sidecoach-detect` exit 0 (managed).
- `test-component-browser.sh` exit 0, 127 passed 0 failed, "PASS sidecoach hook children" (the 7-hook assertion).
- `test-sidecoach-detect.sh` exit 0, 38 passed 0 failed (hook itself untouched).
- OPT-IN end-to-end proof: extracted the REAL `install_app_hooks`/`deactivate_app_hooks`/`is_our_hook`/`rm_hook_if_ours` verbatim, ran them against a sandbox CLAUDE_DIR with the REAL app-wirings.json. DEFAULT (sentinel unset): HOOK_OFF='sidecoach-detect.sh', detect file NOT deployed, PostToolUse detect WIRED=False, taste-gate WIRED=True (sanity). OPT-IN (sentinel=""): detect deployed, PostToolUse detect WIRED=True. Repo hook file untouched (still `??`).
- Repo `.claude/settings.json`: no sidecoach-detect wiring (absent-by-default).

**Codex cross-model review** (deterministic wrapper `~/.claude/hooks/codex-review.py`, real codex-cli 0.142.5 gpt, 152.5s, exit 0), diff scoped to my 4 files (excluded concurrent sidecoach/ teammate work). Confirmed gate passes, install wiring consistent with the other 6 sidecoach hooks, CLI default install genuinely opt-in.
- HIGH (folded to Jonah as a DESIGN DECISION, NOT silently patched): browser MASTER-LEAF install still arms detect. `apply_plan` sets `leaf_install=1` when the sidecoach component leaf is staged install (browser-lib.sh:590-604), forcing EVERY owned hook on -> empty off_list -> `_AMPERSAND_HOOK_OFF=""` -> my seed is suppressed -> detect wired. So a fresh GUI install of the whole Sidecoach component arms the per-edit scan. The seed correctly covers the CLI default install and both browser per-hook-toggle directions; only this one path is uncovered. Closing it requires the packaging ENGINE (`browser-lib.sh`) to learn a new "default-off hook" concept (a new tree-schema field like `default_off_hooks` + an `apply_plan` guard so leaf_install does not force default-off hooks on). That is a shared-infra design decision beyond wiring detect into the 3 manifests I was scoped to, so per the execution-layer mandate ("design belongs to the orchestrator; STOP and report rather than improvise") it is ESCALATED with a ready patch, not improvised. Ready patch: loader emits `default_off_hooks` -> `BR_DEFAULTOFF_*` parallel to pinned (browser-lib.sh:131-132), add `_hook_default_off`, guard `elif [ "$leaf_install" = "1" ] && ! _hook_default_off "$h"; then on=1`, plus a browser-tree.json `default_off_hooks: ["sidecoach-detect"]` and a test.
- MEDIUM (noted, not acted): sidecoach's install/deactivate parity is not test-guarded because check #2 only scopes one-line `deactivate_X` bodies and sidecoach's is multi-line. Pre-existing test-design limitation; detect is correctly in both sides now.
- MINOR (folded, in-lane): stale "Sidecoach's 6 hooks" prose at install.sh -> "7 hooks" + opt-in note.

**Self-analysis (the miss).** My opt-in analysis traced only the browser per-hook-toggle path (apply_plan off_list from probe) and the CLI path, and concluded the seed was sufficient. I did NOT trace the browser MASTER-LEAF install path, where `leaf_install=1` short-circuits the probe and force-enables every owned hook. The signal I skipped: apply_plan has TWO enable routes (per-hook stage vs leaf-install force), and a default-off hook must be exempt from BOTH. Caught by the cross-model review, not by me. Lesson: when a component has a master switch, "installing the component" is a distinct code path from "toggling a hook" and must be checked separately for any per-hook default.

Files touched:
- claude/hooks/browser-tree.json
- claude/hooks/app-wirings.json
- install.sh
- claude/hooks/test-component-browser.sh
