---
name: codex plugin bare-node Stop hook - "node: command not found" every Stop
description: The openai-codex plugin's Stop hook calls bare `node`, which fails because Claude Code runs hooks with a reduced PATH lacking node; diagnosed, fix pending decision
type: project
relates_to: [session_2026-08-20_announce-hook-missing-symlink.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: none
confidence: high
---

Peer (ppai-pm) reported, via Jonah: `/bin/sh: node: command not found` firing every Stop, non-blocking. Culprit: openai-codex plugin hooks.json (line 31, and SessionStart/SessionEnd lines 9/20) runs `node "${CLAUDE_PLUGIN_ROOT}/scripts/...mjs"` with BARE node.

DIAGNOSIS (grounded, not the peer's guess):
- node-shim-heal.sh does NOT provide a `node` PATH shim - it re-plants the cmux NODE_OPTIONS PRELOAD file (restore-node-options.cjs) when macOS purges $TMPDIR. Unrelated to this. The peer assumed it should guarantee node on the hook PATH; it does not.
- The claude PROCESS env (ps eww) HAS node many ways: PATH includes ~/.claude/cmux (a working `node` shim), /opt/homebrew/bin (node 24.2.0), and nvm v20 bin. `which node` -> ~/.claude/cmux/node.
- Yet the codex hook gets "command not found" -> Claude Code runs hooks via `/bin/sh` with a REDUCED/sanitized PATH that does NOT inherit the claude process PATH (it lacks ~/.claude/cmux and /opt/homebrew/bin). Confirmed by semantics ("command not found" = shell cannot find the executable) AND by the working nyx Stop hook, which sidesteps it by calling `/opt/homebrew/bin/node` (ABSOLUTE) instead of bare node.
- The removed node-path-default.sh (beat 2026-07-16) wrote PATH to $CLAUDE_ENV_FILE for the BASH TOOL; that file no longer exists at claude/hooks/ and whether $CLAUDE_ENV_FILE reaches HOOKS is unconfirmed.

WHY NOT FIXED BLIND: the durable fix depends on WHAT the reduced hook PATH actually contains (to place a node shim on a writable dir that is on it) - and I have not CAPTURED that PATH (capturing it definitively spans a turn: a throwaway diagnostic hook that dumps $PATH). Guessing a dir would be an unverifiable fix. Surfaced to Jonah with options:
  (A) Measure the reduced hook PATH first, then place a node shim on a writable dir on it, or widen the hook PATH (root fix, helps every bare-command hook).
  (B) Point the codex hook at absolute node (like nyx) + a heal hook to re-apply after plugin updates (the security_reminder_hook vendoring pattern). Immediate + update-durable, edits the plugin cache.
  (C) Leave it (non-blocking noise), document only.

CORROBORATED by a SECOND independent peer (read-only file-mapper) which BROADENED it: not just the codex hook - the CMUX hooks (`${CMUX_CLAUDE_HOOK_CMUX_BIN:-cmux} hooks claude stop/feed/auto-name`) ALSO fail on the bare-name fallback. So the documented CLAUDE.md cmux fix (2026-06-25: a `cmux` shim at ~/.claude/cmux/cmux, "a dir already on PATH via the dotfiles symlink") is CONTRADICTED by current reality - if ~/.claude/cmux were on the hook PATH, both its `cmux` AND `node` shims would resolve and neither hook would fail. It is NOT on the hook PATH now (regressed, or the 2026-06-25 fix only ever covered the Bash-tool PATH). This makes a ROOT fix (node+cmux on the hook PATH) more valuable than patching one plugin - it fixes the whole bare-name class.

OPERATIONAL FINDING (important): Claude Code CACHES the hook registry at SESSION START. A mid-session edit to ~/.claude/settings.json hooks does NOT take effect this session - proven by a throwaway PreToolUse PATH-capture hook that registered fine but never fired. Implications: (1) my earlier mid-session announce-hook settings edit only armed it for NEW sessions (e.g. the peer's), not mine; (2) capturing the exact reduced hook PATH needs a session-boundary (a dump added to an already-loaded hook SCRIPT fires next Stop, since script CONTENTS are read fresh even though the registry is cached). Cleaned up the throwaway hook; settings valid.

NOT a regression from my work this session (the announce-hook + reflag fixes are node-independent bash/python). Pre-existing plugin/harness-PATH gap.

Files: none (diagnosis). Fix pending Jonah's choice on approach; exact hook PATH pending a session-boundary capture.
