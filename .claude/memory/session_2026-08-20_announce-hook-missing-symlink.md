---
name: artifact-announce-stop missing symlink - every-Stop "No such file" error
description: Armed the new hook in live settings.json but never created the ~/.claude/hooks symlink it resolves to; every Stop printed "No such file or directory"
type: project
relates_to: [session_2026-08-20_artifact-announce-stop-hook.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

Peer (ppai-pm) reported, via Jonah: `/bin/sh: ~/.claude/hooks/artifact-announce-stop.sh: No such file or directory` firing on EVERY Stop. Peer guessed a stale/renamed entry; the real cause was a MISSING SYMLINK.

ROOT CAUSE (mine): I made the new hook "live" by hand-appending its command to ~/.claude/settings.json's Stop array, pointing at `~/.claude/hooks/artifact-announce-stop.sh`. But ~/.claude/hooks/ holds PER-FILE SYMLINKS into the repo (each sibling: `~/.claude/hooks/X.sh -> .../improv/claude/hooks/X.sh`), and those symlinks are created by install.sh, which I did NOT run. So the repo file existed (claude/hooks/artifact-announce-stop.sh) but its ~/.claude/hooks symlink never did, and the registered command path resolved to nothing -> non-blocking "No such file" every Stop.

SELF-ANALYSIS (false-positive verification): I verified `grep -c artifact-announce-stop.sh ~/.claude/settings.json == 1` and called the hook "live". That is EXACTLY the Verification Protocol rule-6 trap - registration PRESENCE is not the hook RESOLVING/RUNNING. I never triggered a real Stop or checked the command path existed on disk. "Registered" != "resolvable". LESSON: when arming a hook live by hand, verify it RUNS from its ~/.claude path (the harness's actual invocation), not just that the settings entry is present; better, run install.sh (which creates the symlink AND registers) instead of hand-editing settings.json for immediacy.

FIX (live immediately, no restart): created the symlink matching the siblings - `ln -s .../improv/claude/hooks/artifact-announce-stop.sh ~/.claude/hooks/artifact-announce-stop.sh`. Verified: symlink resolves; `printf '{...}' | /bin/sh ~/.claude/hooks/artifact-announce-stop.sh` exits 0 with empty output (healthy, no error). DURABLE via the install.sh verification-cluster registration already committed (d17c49e0) - a future install recreates the symlink. The symlink itself is machine-local (not version-controlled), like every sibling.

SECOND INSTANCE, same class (peer ethos-fa): `~/.claude/hooks/sidecoach-craft-floor.sh` was registered (settings.json:355, PreToolUse:Edit) but its symlink was ALSO missing -> "No such file or directory" on every Edit. Repo script exists (claude/hooks/sidecoach-craft-floor.sh) and is registered in browser-tree + install.sh + app-wirings, so NOT retired - just unsymlinked. Fixed the same way (ln -s to the repo; resolves + runs clean, exit 0).

SWEPT the whole live settings.json for the class: parsed every registered `~/.claude/hooks/*.sh` command and checked on-disk existence. Found ONLY these two (announce + craft-floor); after both symlinks, re-sweep = ZERO dangling registrations. So this is not a widespread drift, just two hooks that were registered without their symlink being created (both live now; both durable via their existing install.sh registration).

OPERATIONAL NOTE: Claude Code caches the hook REGISTRY at session start, so these dangling entries only surfaced in sessions that started after the registration; and a mid-session settings edit does not take effect until a new session (proven separately). The symlink fixes ARE live immediately (the registry entry was already loaded; only its target was missing).

Files: none in-repo (machine-local symlinks). Repo hooks + registrations already committed/present.
