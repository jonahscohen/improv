---
name: teams-launcher-reset
description: Reset Claude Teams launcher from always-on back to interactive prompt
type: project
---

Jonah wanted the Claude Teams launcher to stop auto-launching into Teams and go back to asking each time.

- Root cause: `~/.claude/.teams-default-on` flag file existed (set when user previously chose "Always enable")
- Fix: deleted `~/.claude/.teams-default-on`
- Also restored the `claude-teams` block in `~/.zshrc` after accidentally removing it

The launcher (`~/.claude/claude-teams-launcher.sh`) checks for two flag files:
- `~/.claude/.teams-default-on` - skips prompt, always launches Teams
- `~/.claude/.skip-teams-launcher` - skips prompt, never launches Teams

Deleting either file resets to the interactive y/n/a/x prompt.
