---
name: Remote Control launch prompt added to claude launcher
description: discord-chat-launcher.sh now offers a --remote-control opt-in that short-circuits the Discord prompt
type: project
relates_to: [session_2026-06-21_discord-skip-launcher-removed.md]
---

Added a Remote Control opt-in to the `claude()` wrapper in `claude/discord-chat-launcher.sh` at Jonah's request.

Behavior:
- New prompt asked FIRST (after the subcommand guard, before the Discord skip-launcher check): `Start with Remote Control enabled? [y/N, or 'never' to stop asking]`.
- `y` -> runs `command claude --remote-control "$@"` and returns, short-circuiting the Discord prompt entirely (RC sessions get no Discord question, per Jonah's spec).
- `n` / bare Enter (default N) -> falls through to the existing Discord WARM/MID/COLD flow unchanged.
- `never` -> writes opt-out marker `~/.claude/.skip-remote-control`, then still falls through to Discord this launch.
- Marker present -> RC prompt is skipped, straight to Discord flow.
- Bare `--remote-control` (no name) auto-names the session by hostname prefix - intentional for portable multi-machine use.

Why this design (decided with Jonah):
- RC is orthogonal to the Discord bot (native Claude Code mobile/web remote), so it gets its own opt-out marker at `~/.claude/.skip-remote-control`, NOT inside the discord channel dir.
- RC takes precedence and short-circuits Discord because Jonah wanted opting into RC to mean "no Discord question," and opting out to mean "ask about Discord."
- `claude --remote-control [name]` is the real Claude Code flag (`claude --help`), plus `--remote-control-session-name-prefix` (default hostname).

Bug caught during verification (self-analysis):
- First implementation wrote the marker with `: > "$RC_SKIP_FILE"` but did not ensure the parent dir existed. The behavioral test (temp HOME) exposed `no such file or directory` on the `never` branch. Root cause: copied the write idiom but not the Discord cold-path's `mkdir -p` guard. Fix: added `mkdir -p "${RC_SKIP_FILE:h}"` (zsh dirname modifier) before the write. On a real machine `~/.claude` always exists so it would not have bitten in production, but the guard makes it robust and the test now passes.

Verification: `zsh -n` clean; behavioral test with a stubbed `claude` on PATH + temp HOME confirmed all four branches (y / n / never / marker-present) behave as specified.

Collaborator: Jonah Cohen

Files touched:
- claude/discord-chat-launcher.sh (RC_SKIP_FILE var + RC prompt block + mkdir guard)
