---
name: HANDOFF - execute the bare-node hook-PATH root fix (next session)
description: Next-session task - read the armed hook-PATH capture, make node reachable on the reduced hook PATH, verify, make durable, clean up the probe
type: project
relates_to: [session_2026-08-20_codex-plugin-bare-node-hook.md]
superseded_by: session_2026-08-20_bare-node-hook-path-rootfix.md
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

**DONE (2026-08-20).** Executed and superseded by [[session_2026-08-20_bare-node-hook-path-rootfix.md]]. The probe was read, the root fix built (plugin-node-hook-heal.sh), Codex-reviewed, verified 18/18, and the probe cleaned up.


**THIS IS A NEXT-SESSION TASK.** Jonah chose "measure next session, root-fix" for the bare-node hook failure (codex stop-review-gate + cmux hooks print "node: command not found" every Stop because Claude Code runs hooks via /bin/sh with a REDUCED PATH lacking node's dirs and ~/.claude/cmux). Full diagnosis: [[session_2026-08-20_codex-plugin-bare-node-hook.md]]. A SessionStart probe is ARMED to measure the exact reduced hook PATH.

DO THIS (in order):
1. READ `~/.claude/.hook-path-capture.txt` (the probe appended the reduced HOOK PATH, node/cmux resolution, CLAUDE_ENV_FILE, and which PATH dirs are WRITABLE). If empty/absent, the probe did not fire - re-check the SessionStart registration in ~/.claude/settings.json (`.hook-path-capture.sh`).
2. DECIDE the fix from what was captured:
   - If a WRITABLE dir sits on the reduced hook PATH: drop a `node` symlink there pointing at the real node (`/opt/homebrew/bin/node`) - and a `cmux` symlink at the cmux shim (`~/.claude/cmux/cmux`) - so bare-name hooks resolve. Prefer a dir the dotfiles already own if one is on-PATH.
   - If NO writable dir is on the hook PATH: the fix is harness-level. Check whether CLAUDE_ENV_FILE reaches hooks (the capture shows its value); if a SessionStart hook writing `export PATH=...:$PATH` to $CLAUDE_ENV_FILE affects the HOOK shell, that is the clean root fix (a `node-hook-path.sh` SessionStart hook). If not, surface to Jonah - it may need a cmux-claude-launch.sh change (how the claude process passes PATH to hooks).
3. VERIFY: after the fix, a bare-node command resolves on the hook PATH (re-arm a one-shot capture that also runs `node --version`, or confirm the codex stop-review-gate stops erroring on the next Stop). Do NOT declare done without observing the error gone - it is DEGRADED COVERAGE (the review gate silently was not running), not just noise.
4. MAKE DURABLE: put the fix in the dotfiles/install mechanism (a committed SessionStart hook + its registration, or the launcher), not a one-off manual symlink. Mirror how node-shim-heal / node-path-default were structured.
5. CLEAN UP the probe: remove the SessionStart entry for `.hook-path-capture.sh` from ~/.claude/settings.json, then `rm ~/.claude/.hook-path-capture.sh ~/.claude/.hook-path-capture.txt`. Verify settings.json still parses.

CONTEXT that will save you time: node-shim-heal.sh is UNRELATED (NODE_OPTIONS preload, not a node PATH shim). The documented CLAUDE.md cmux fix claims ~/.claude/cmux is on the hook PATH - that is CONTRADICTED now (both its node+cmux shims fail from hooks), so do not trust it; the capture is ground truth. Mid-session settings edits do NOT take effect (registry cached at session start) - that is why this is a next-session task.

Files armed: ~/.claude/.hook-path-capture.sh (probe), ~/.claude/settings.json (SessionStart entry). Both are machine-local; remove after the fix.
