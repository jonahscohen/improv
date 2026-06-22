---
name: What nyx actually is (corrects "telemetry" framing)
description: nyx is a third-party desktop agent-runner app (v0.4.7 trial) installed only on the spare3/work machine; its settings.json hooks are an OSC state-bridge for the GUI, not phone-home telemetry. They must never be committed to the repo.
type: reference
relates_to: [session_2026-06-19_nyx-telemetry-strip.md, session_2026-06-21_remote-catchup-review.md]
---

Collaborator: Jonah Cohen

Inspected `~/.nyx/` directly on the spare3 ("Mac") machine - prior beats called nyx "private telemetry," which is imprecise. What it actually is:

**nyx = [Nyx](https://getnyx.dev), a commercial desktop "infinite canvas IDE" / "mission control for AI coding agents"** - a direct cmux competitor that runs Claude Code / Codex / Gemini in tiles (agent/terminal/browser/todo/diff/editor), with git worktrees, focus mode, inline diff review. Made by getnyx.dev (c 2026). $29 one-time lifetime license, 14-day trial, macOS 12+/Windows. v0.4.7 here.

**Provenance (sourced 2026-06-21):** installed via `curl -fsSL https://api.getnyx.dev/install.sh | bash` (zsh_history line 294) on 2026-05-03/04. Jonah trialed it once and abandoned it: single "Untitled" workspace opened May 4 02:56, `agent-sessions`/`models`/`templates` all empty, trial expired ~May 18, never purchased (`license.json` token:null, activatedAt:null). The app binary is now GONE (no /Applications bundle, nothing on PATH, no process) - only the `~/.nyx` data dir + injected hooks survive. On install it backed up CC settings (`~/.nyx/backups/claude-code-settings.1777863099865.json`, May 4) then self-wired its hook-bridge into `~/.claude/settings.json` - that injection is the origin of the repo leak. `config.json` shows model labels (`labelClaudeModel: haiku`, `codexModel: gpt-5.4`), voice hotkey, agent inbox; source comments are in Russian.

**The settings.json hooks are a state-bridge, not telemetry.** `~/.nyx/hook-bridge.cjs` is wired into `~/.claude/settings.json` for 8 CC lifecycle events (session-start, tool-start/end, prompt-submit, notify, stop, subagent-stop, session-end). On each event it reads the hook JSON from stdin and writes an OSC escape sequence (`\x1b]777;nyx:<agent>:<json>`) to `/dev/tty`. The nyx GUI parses those escapes out of the PTY to drive tile status (running/idle/waiting/permission) and its waiting/error notifications. It does not POST anywhere - it's local IPC over the terminal stream. (Note: `config.json` currently has `ccHooksEnabled:false`, so the settings.json entries may be stale-but-harmless leftovers here.)

**Why it spams errors on machines without nyx:** the 8 hook lines leaked into the dotfiles repo `claude/settings.json` and rode a `git pull` to the Florida laptop, which has no `~/.nyx/`. Every hook event then runs `node ~/.nyx/hook-bridge.cjs` -> MODULE_NOT_FOUND (`node:internal/modules/cjs/loader:1215`) on every session-start/tool/stop. Non-blocking but relentless.

**Invariant (re-stated):** nyx hooks are machine-local and must NEVER be committed to the repo - they point at an app only the spare3 machine has. Strip them from `claude/settings.json` whenever they reappear. The incoming `76197d8b` does this; but `settings.json.nyx-bak` (committed on origin/main) re-leaks them and should be removed.
