---
name: hook-registry-guard - catch unmanaged hooks at write time, gate the Stop until packaged
description: New project-scoped hook pair that detects a hook written without an owning component, injects exactly what to wire (tree + install.sh + app-wirings), and blocks the Stop until it is packaged. Closes the write-time end of the unmanaged-hook hole that let 5 hooks go unpackaged and the tree lie about sidecoach owning 2 hooks when the installer wired 6.
type: project
relates_to: [decision_installer_bucket_browser.md, decision_beats_hooks_stay_project_scoped.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: tests (25 new, negative-controlled) + dogfood + full suite
confidence: high
---

Jonah: "write a hook that recognizes when a hook is being written, categorizes it according to what component owns it, then updates the installer package to include it (with description)."

**RULING (Jonah, via AskUserQuestion): "Detect, instruct, gate."** Not auto-wire. A shell hook cannot pick the right owning component or write a description worth reading - it would guess from the filename and ship a wrong owner plus a placeholder into a browser humans read. So the hook DETECTS + INSTRUCTS precisely, and a Stop gate makes forgetting impossible. The model does the categorising.

**THE HOLE IT CLOSES (measured, not hypothetical):** 100 hook files on disk, 61 in browser-tree.json. Of the 39 missing: 33 tests, 1 lib, and **5 genuinely unmanaged** - beats-reflect-weekly, detect-session-model, node-path-default, voice-mandate, voice-toggle. `node-path-default.sh` was written THAT SAME DAY by the spawned codex-shim task and never packaged: it will not install on any other machine. The tree ALSO lied the other way (claimed sidecoach owned 2 hooks while install.sh wired 6) because the only completeness test checked the tree against ITSELF. The structural test now cross-checks install.sh's own `picked X && install_app_hooks` lines both directions; this guard closes the write-time end.

**BUILT:**
- `claude/hooks/hook-registry-guard.sh` - PostToolUse Write|Edit|MultiEdit. On a write to `claude/hooks/*.sh`, computes managed = pinned OR (in tree's hook_owner AND named by install.sh). If unmanaged: arms `~/.claude/.unmanaged-hook` and injects step-by-step wiring instructions (owner choice, tree hooks list + hook_desc + hook_owner, the install_app_hooks call site, app-wirings.json, the verify command). Also `--audit` (lists all unmanaged, exit 1 if any) and `--check NAME`.
- `claude/hooks/hook-registry-stop.sh` - Stop gate. RE-DERIVES managed-ness rather than trusting the flag, so it opens the instant the work is genuinely done and cannot be satisfied by deleting the flag; self-heals if the hook file was deleted. Blocks ONCE per armed set (cannot trap a session), same shape as the chrome-tabgroup reminder.
- `claude/hooks/test-hook-registry.sh` - 25 assertions.

**Why BOTH halves of "managed" matter:** tree-only means the browser offers a toggle for something no machine installs. Installer-only means the browser under-reports - the exact sidecoach 2-vs-6 lie.

**Exclusions (deliberate):** `test-*` and `*-lib` are never wired into settings.json, so demanding an owner would be noise that trains you to ignore the guard. `detect-session-model` is exempt: it is a shared DEPENDENCY, deployed by install.sh and exec'd by model-router-guard.sh and fable-orchestrator-guard.sh, never wired standalone, so it has no owner to toggle.

**PROJECT-SCOPED, and it wired ITSELF.** The guard reads THIS repo's browser-tree.json and install.sh, so it is meaningless on a machine that merely installed the dotfiles - same reasoning as [[decision_beats_hooks_stay_project_scoped.md]]. Wired in `.claude/settings.json` via `$CLAUDE_PROJECT_DIR`, matching the beats-rebuild precedent, and added to `pinned_hooks`. **Dogfood proof:** `--check hook-registry-guard` reported UNMANAGED before wiring and MANAGED after. The hook caught itself.

**Verified:** 25/25 registry (every core assertion NEGATIVE-CONTROLLED: breaking `_is_managed` turns 6 red, breaking the Stop gate turns 1 red, restore returns 25/25 - written the day a visibly torn UI shipped past 110 green assertions, so an assertion nobody has watched fail is not evidence). Plus component-browser 104/104, parity ALL PASSED, bash -n clean, both JSON files valid.

**NOT LIVE UNTIL A SESSION RESTART** - project settings.json hooks are read at session start.

**Skipped deliberately:** the Codex cross-model gate. Jonah explicitly instructed lower cost and faster turnaround after a very expensive day; his instruction outranks the standing gate. Available on request.

**Known-live backlog it surfaces:** `--audit` currently reports 4 real unmanaged hooks (beats-reflect-weekly, node-path-default, voice-mandate, voice-toggle). They are pre-existing and NOT retroactively blocked - the guard only fires when a hook file is written. Packaging them is its own task.

Files: claude/hooks/hook-registry-guard.sh, claude/hooks/hook-registry-stop.sh, claude/hooks/test-hook-registry.sh, .claude/settings.json, claude/hooks/browser-tree.json (pinned_hooks).
