---
name: agent-teams-guard symlink missing
description: Hook referenced in settings.json but no symlink at ~/.claude/hooks/. Added symlink. Pattern reminder - new hooks in claude/hooks/ need a corresponding ~/.claude/hooks/ symlink to be discovered by Claude Code.
type: project
relates_to: [session_2026-05-26_peekaboo_parity_audit.md]
---

Session report: `Failed with non-blocking status code: /bin/sh: /Users/spare3/.claude/hooks/agent-teams-guard.sh: No such file or directory`.

**Root cause:** The hook file exists in the dotfiles repo at `claude/hooks/agent-teams-guard.sh` (executable, 2442 bytes, created 2026-05-27) and is referenced in `claude/settings.json` at line 77 under PreToolUse. But the live `~/.claude/hooks/` directory had no corresponding symlink. Claude Code looks at the live path; it found nothing.

**Fix:** `ln -s /Users/spare3/Documents/Github/claude-dotfiles/claude/hooks/agent-teams-guard.sh /Users/spare3/.claude/hooks/agent-teams-guard.sh`.

**Why this happened:** Whoever added the hook (looks like 2026-05-27 work) committed the script and updated settings.json, but didn't create the symlink. Every other hook in the directory IS symlinked to the dotfiles - this one was the lone outlier.

**How to prevent recurrence:** When a new hook is added to `claude/hooks/<name>.sh` in the dotfiles, the corresponding `~/.claude/hooks/<name>.sh` symlink must also be created. Two options to make this automatic:
1. Installer script (`install.sh` or similar) that walks `claude/hooks/*.sh` and ensures a matching symlink in `~/.claude/hooks/` for each.
2. Manual discipline (current default) - mention in CLAUDE.md or a hooks README that adding a hook requires `ln -s` as part of the workflow.

Recommend option 1 - mechanical enforcement is more reliable than discipline.

**Verification:** Piped a sample PreToolUse JSON payload into the hook, got back the expected JSON `permissionDecision: "deny"` response with the team-flow instructions, exit code 0. Hook is functioning correctly.

**Files touched:**
- `~/.claude/hooks/agent-teams-guard.sh` (new symlink)
