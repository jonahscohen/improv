---
name: nyx private-telemetry hooks stripped from live + repo settings (laptop deploy)
description: SessionStart node cjs/loader error traced to missing ~/.nyx/hook-bridge.cjs; stripped all nyx hook entries from live ~/.claude/settings.json (15) and repo claude/settings.json (8 leaked)
type: project
relates_to: [session_2026-05-24_settings_sync.md, session_2026-06-19_dangling-hooks-config-sync.md]
---

Collaborator: Jonah Cohen

Context: Jonah built Improv on his work computer, pushed to GitHub, pulled the whole project to his personal laptop (in Florida) to keep working. Session opened on the laptop with a `node:internal/modules/cjs/loader:1215` SessionStart error.

**Root cause:** `nyx` is Jonah's WORK-MACHINE private telemetry. `~/.claude/settings.json` wires `node "$HOME/.nyx/hook-bridge.cjs"` across 8 hook events (tool-start, session-start, prompt-submit, tool-end, notify, stop, subagent-stop, session-end), but `~/.nyx/` does not exist on the laptop (nyx correctly never traveled - it is not in the repo by design). Every hook event threw MODULE_NOT_FOUND; SessionStart was just the surfaced one. Non-blocking (session ran fine), but noise on every event.

**Two problems, both fixed:**
1. **Live noise** - laptop's `~/.claude/settings.json` called the missing bridge 15 times (several events doubled, from a merge that appended the repo's copies alongside originals).
2. **Repo leak** - `claude/settings.json` had 8 nyx entries, violating the documented invariant from [[session_2026-05-24_settings_sync.md]] ("ZERO nyx hook-bridge entries leaked"). They leaked back in and got installed to live.

**Fix:** Jonah said "strip it" - full removal from both files (laptop-only; work-machine local settings untouched).

Python transform: load JSON, filter any hook command containing `nyx/hook-bridge.cjs`, prune now-empty hook groups, prune now-empty event keys, dump indent=2 + trailing newline. Backups at `<path>.nyx-bak`.

**Why scripted, not Edit:** entries were scattered across 8-15 sites with surrounding matcher-group structure; a JSON-aware filter with empty-group pruning is safer than hand-editing and self-verifies survivor counts.

**Verified:**
- repo: removed 8 cmds + 7 empty groups; nyx remaining 0; survivors 52/52; JSON valid.
- live: removed 15 cmds + 14 empty groups; nyx remaining 0; survivors 54/54; JSON valid.
- Legit SessionStart hooks survived on live (startup-check, voice-mandate, team-reaper, node-shim-heal, sidecoach-sessionstart).

**Laptop deploy verdict:** project pulled clean - synced with origin/main (0/0), all key dirs present (claude/hooks 72, claude/skills 17, lotus, justify), harness installed (~/.claude: 41 hooks, 17 skills, CLAUDE.md). The only uncommitted state is the in-progress install-fix work from the prior two laptop sessions ([[session_2026-06-19_dangling-hooks-config-sync.md]], install-safe-cp-fix). Not cooked.

**Follow-up (open):** repo `claude/settings.json` is now de-leaked but uncommitted along with install.sh + MEMORY.md. Commit when Jonah is ready. If nyx is ever wanted on the laptop, it must be installed separately (external/private, not in this repo).

Files touched:
- claude/settings.json (repo - 8 nyx hook commands removed)
- ~/.claude/settings.json (live laptop - 15 nyx hook commands removed; not in repo)
