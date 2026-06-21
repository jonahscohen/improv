---
name: Discord skip-launcher marker removed
description: Deleted ~/.claude/channels/discord/.skip-launcher so the connect prompt can fire again
type: project
---

Removed `~/.claude/channels/discord/.skip-launcher` on Jonah's machine at his request.

The launcher (`discord-chat-launcher.sh`, sourced from `.zshrc` line 28) checks for this marker first (line 77) and falls straight through to plain `claude` when present. With it gone, the launcher now evaluates machine state on each `claude` invocation.

Current state after removal (verified 2026-06-21):
- Bot token in Keychain: NO (absent)
- access.json: EXISTS, allowFrom count = 1 (stale pairing record)
- skip-launcher: now removed

Because there is still no bot token in Keychain, the next session lands in the COLD path (`[s] Set up now / [k] Skip / [n] Never ask`), NOT the WARM `Connect to Discord Chat Agent? (y/n)` prompt. To reach the warm connect prompt, the bot token must be re-added via `bash ~/.claude/discord-onboard.sh`.

Note the inconsistency: access.json shows 1 paired user but Keychain has no token - fingerprint of a machine paired before, then token removed or markers synced from another machine without the secret (Keychain secrets do not travel through the dotfiles repo).

Collaborator: Jonah Cohen

Files touched:
- ~/.claude/channels/discord/.skip-launcher (deleted; not tracked in repo)
