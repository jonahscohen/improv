---
name: icon-cascade-guard wired LIVE into the safety cluster
description: Wired icon-cascade-guard.sh as the 6th safety-cluster hook (cluster-wirings.json + cluster_hooks membership + browser-tree.json + live settings symlink), NOT app-wirings.json or committed settings.json. Audit 0, fires live next session.
type: project
relates_to: [decision_2026-09-05_icon-priority-cascade.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: hook-registry --audit exit 0 + tests 73/73 + 1898-file dry-run (0 denies) + live fire test (off-cascade DENY / compliant ALLOW) + live-vs-cluster wiring parity
confidence: high
---

Collaborator: Jonah. Follows the cascade gate commit 336d8b66. The gate existed on disk but
was NOT wired into any settings event, so it never fired. This wires it live + installable.

## The wiring convention (corrected from the brief's literal instruction)

The dispatch said "register in committed claude/settings.json + app-wirings.json." Both are
WRONG for a safety guard, and the same brief's governing clause ("match how the other
content/bash guards are wired") points at the RIGHT path:

- **Safety guards (bash-guard, content-guard, ...) are NOT in committed `claude/settings.json`**
  (grep: 0 mentions). Only CORE base-wired hooks live there. So icon-cascade-guard was NOT
  added there - doing so would diverge from every other safety guard and create ownership
  confusion (base-wired AND cluster-wired).
- **Safety guards do NOT use `app-wirings.json`** (that file is for APP-owned hooks: memory,
  cmux, voice, clickup, ...). They wire through the **QA-hook cluster pass**:
  `claude/hooks/cluster-wirings.json` holds the exact settings entry; `cluster_hooks()` in
  `install.sh` (the `safety)` case) is the single membership source of truth that BOTH the
  install pass (16d) and `deactivate_cluster` read; `browser-tree.json` registers it for the
  audit + TUI.

So "in parity" is achieved not by duplicating the entry into committed settings.json, but by
cluster-wirings.json reproducing the live wiring on a fresh install. Verified: the live
`~/.claude/settings.json` entry (PreToolUse / Write|Edit|MultiEdit / timeout 5) is byte-equal
to the cluster-wirings.json entry.

## What was changed (committed surface - team-lead reviews/commits)

- `install.sh`: added `icon-cascade-guard.sh` to `cluster_hooks() safety)` (drives install
  pass 16d deploy+wire AND deactivate_cluster removal); bumped the FILES label 5 -> 6 safety
  hooks.
- `claude/hooks/cluster-wirings.json`: new `icon-cascade-guard.sh` entry, PreToolUse
  Write|Edit|MultiEdit, `~/.claude/hooks/icon-cascade-guard.sh`, timeout 5 (mirrors content-guard).
- `claude/hooks/browser-tree.json`: added `icon-cascade-guard` to the safety hooks array, tag
  5 -> 6, a hook_desc entry, and the owner map `icon-cascade-guard: safety`.

## Live machine state (NOT committed; takes effect next session)

- Symlink `~/.claude/hooks/icon-cascade-guard.sh` -> repo (matches content-guard's deploy style).
- `~/.claude/settings.json`: added the PreToolUse Write|Edit|MultiEdit entry. Hooks load at
  SessionStart, so the LIVE block is demonstrable from the next session (a relaunch is pending
  for a Full Disk Access grant, which will pick it up).

## Verification

- `hook-registry-guard.sh --audit` -> exit 0 (no unmanaged hook; icon-cascade-guard now managed).
- Test suite 73/73 green; 1898-file tracked-app-source dry-run = 0 denies (no over-block).
- FIRE test through the real PreToolUse payload: an off-cascade `react-icons/fa` import on an
  interactive `<button>` -> DENY; a compliant `lucide-react` version -> ALLOW.
- All four JSON files valid.

## Why the fire test uses a real payload, not a live session block

A PreToolUse hook's "real input" IS the JSON envelope on stdin - there is no UI to click, and
hooks load at SessionStart so the just-added live entry is not in THIS session's chain yet.
Feeding the exact envelope Claude Code would send is the genuine fire test; the live block is
provable next session.

## Files touched

- install.sh
- claude/hooks/cluster-wirings.json
- claude/hooks/browser-tree.json
- ~/.claude/settings.json (live, uncommitted) + ~/.claude/hooks/icon-cascade-guard.sh (live symlink)
- .claude/memory/session_2026-09-05_icon-cascade-guard-wired.md (this beat)
- .claude/memory/MEMORY.md (index)
