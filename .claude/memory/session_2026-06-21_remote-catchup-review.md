---
name: Remote catch-up review - 5 incoming commits (laptop infra work) + nyx re-leak hazard on this work machine
description: origin/main is 5 ahead; all infra/installer/launcher maintenance from the Florida laptop. This machine (spare3) IS a nyx host, so the incoming nyx-strip + committed nyx-bak create a fast-forward/reinstall hazard worth flagging before pulling.
type: project
relates_to: [session_2026-06-19_nyx-telemetry-strip.md, session_2026-06-19_install-safe-cp-fix.md, session_2026-06-21_remote-control-launch-prompt.md]
---

Collaborator: Jonah Cohen

Reviewed (not yet pulled) the 5 commits local `main` is behind `origin/main`. Working tree clean. All five came from Jonah's personal laptop (username `jonah`, Florida) after he pulled Improv from his work machine; none touch the product (justify / sidecoach / tilt-lab / marketing site) - it is all harness/installer/launcher maintenance plus one reference beat.

The 5 commits (oldest first):
1. `81d32a41` Remote Control opt-in in `discord-chat-launcher.sh` - new `Start with Remote Control enabled? [y/N, or 'never']` prompt, asked before the Discord flow; `y` runs `claude --remote-control` and short-circuits Discord; `never` writes `~/.claude/.skip-remote-control`. ([[session_2026-06-21_remote-control-launch-prompt.md]])
2. `160c309d` reference beat: Claude-in-Chrome host != Claude Code host (isLocal is the extension's host, not CC's; verify both via ipinfo.io before trusting "local").
3. `76197d8b` Resync hooks; remove nyx telemetry - stripped 8 nyx `hook-bridge.cjs` entries from repo `claude/settings.json`, AND added 12 previously-orphaned runtime hooks to install.sh CONFIG_HOOKS. ([[session_2026-06-19_nyx-telemetry-strip.md]])
4. `f9b27cc2` sidecoach `.package-lock.json` bump (14 lines).
5. `716c35ef` install.sh `safe_cp` helper - `rm -f dest; cp` so reinstalls survive legacy symlink destinations that made BSD `cp` bail "are identical" under `set -e`. ([[session_2026-06-19_install-safe-cp-fix.md]])

**Hazard flagged (the reason this review matters): THIS machine is a nyx host.**
- `whoami`=spare3, host "Mac"; `~/.nyx/` EXISTS; live `~/.claude/settings.json` still wires nyx 8x and works here.
- The incoming nyx-strip was correct FOR THE LAPTOP (nyx absent there -> MODULE_NOT_FOUND noise). On this machine nyx is functional telemetry.
- Risk: fast-forwarding then reinstalling the `config` component could merge the now-nyx-free repo settings over this machine's live settings and drop the working nyx wiring. Pull is safe (repo only); the danger is a follow-on `./install.sh ... config`. Verify live settings keeps its 8 nyx entries after any reinstall here.
- Separate cleanup: `claude/settings.json.nyx-bak` (595 lines) got COMMITTED to the repo on origin/main. It is a machine-local backup artifact AND it contains the full nyx-era settings - so it re-leaks the exact nyx wiring the strip commit removed. Candidate for `git rm` + gitignore.

**Pull completed (2026-06-21):** fast-forwarded d477b581 -> 81d32a41 (clean, no conflicts). MEMORY.md intelligently merged - my 2 nyx index entries placed at top above origin's 6 incoming entries; the memory-compact hook then auto-archived the 8 oldest (06-14 P4c/P4d cluster) into MEMORY-archive.md (8 removed == 8 archived, zero loss). Working tree now holds the merged index + 2 new untracked beats, uncommitted.

**Still pending Jonah's call:** (1) commit this local beat work; (2) `git rm` the leaked `claude/settings.json.nyx-bak`; (3) guard live nyx wiring if config is ever reinstalled on this machine.
