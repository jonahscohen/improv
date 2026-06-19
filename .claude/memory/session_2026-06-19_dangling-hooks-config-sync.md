---
name: 11 orphaned hooks healed + install.sh CONFIG_HOOKS resync
description: SessionStart errors traced to install.sh CONFIG_HOOKS drifting out of sync with claude/settings.json; copied 11 hooks to disk + added them to the install array
type: project
relates_to: [session_2026-06-19_install-safe-cp-fix.md]
---

Collaborator: Jonah Cohen

Session opened with 5 SessionStart hook errors (node-shim-heal.sh, justify-watch-guard.sh, memory-compact.sh, consolidate-nudge.sh all "No such file or directory", plus a node cjs/loader cascade in startup-check.sh).

**Root cause:** `claude/settings.json` wires 11 runtime hooks that the install.sh `CONFIG_HOOKS` array (install.sh:1592) never copied to `~/.claude/hooks/`, and no other component copied them either. The array had drifted out of sync with what settings.json references. Fresh installs / reinstalls left them dangling. `~/.claude/hooks/` had 30 of the repo's 54 hook files; 24 missing (13 of those were `test-*.sh` harnesses, correctly excluded - the other 11 were genuinely-wired runtime hooks).

**The 11 genuinely orphaned (in repo + referenced in settings.json + copied by no component):**
block-clickup-writes, consolidate-nudge, content-guard-stop, grounding-gate, grounding-guard, justify-source-guard, justify-watch-guard, memory-compact, model-router-guard, node-shim-heal, sidecoach-taste-gate.

**Fix (two layers):**
1. Healed this machine - `cp` + `chmod +x` all 11 into `~/.claude/hooks/` (30 -> 41 hooks). Verified each present, executable, `bash -n` clean.
2. Fixed installer - added all 11 to the `CONFIG_HOOKS` array so reinstalls don't reintroduce the gap. Verified `bash -n install.sh` passes and all 11 appear in the array.

**Why:** The install.sh comment at line 1585 already states the invariant ("settings.json ... references every one of these by command path, so they must all land on disk or the wired hooks dangle") - the array just fell behind reality. Config component owns these because they're wired in the base `claude/settings.json` that the config merge installs.

**Residual (benign):** resume-*, sidecoach-* (keyword/preamble/sessionstart/postuserp/postresponse), team-reaper, voice-* are component-owned (installed by their own components, already on disk) - not orphans.

**Gotcha logged:** zsh does NOT word-split unquoted `$VAR` in `for b in $HOOKS` - first copy attempt treated the whole hook-name string as one filename. Use literal lists or `${=VAR}` in this environment.

**Observed side issue (not fixed):** the PostToolUse bash/edit guard hooks over-fire "BASH WROTE FILES" beat-mandate and "CODE DEPLOYED/BUILT ... take a screenshot" verify-mandate on read-only grep/ls/sed commands and on non-UI shell edits. False positives worth a future debounce/scope tightening.

Files touched:
- install.sh (CONFIG_HOOKS array, +11 entries)
- ~/.claude/hooks/*.sh (11 files copied - local machine, not repo)
