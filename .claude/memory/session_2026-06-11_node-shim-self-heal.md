---
name: cmux NODE_OPTIONS shim now self-healing (canonical copy + SessionStart/Stop heal hook)
description: The macOS temp purge that breaks every node process (MODULE_NOT_FOUND on the cmux preload) recurred; permanent fix per Jonah's "never again" - durable shim copy in repo + node-shim-heal.sh re-plants it at session start and after every turn
type: project
relates_to: [session_2026-05-31_node-options-shim-fix.md]
supersedes: session_2026-05-31_node-options-shim-fix.md
---

Collaborator: Jonah. 2026-06-11. Recurrence of the 2026-05-31 incident, exactly as that beat predicted: macOS purged /var/folders/.../T/cmux-claude-node-options/ at 03:35, NODE_OPTIONS still preloads restore-node-options.cjs from there, so every node process (npx, npm, the nyx hook-bridge Stop hook) died with MODULE_NOT_FOUND. Jonah: "permanently fix these problems. never again."

## Permanent mechanism (recreate-by-hand is dead)
1. **Canonical shim** lives durably in the repo: `claude/node-shims/restore-node-options.cjs` (+ `~/.claude/node-shims` symlink). Shim behavior: strips its own --require token from NODE_OPTIONS for child processes (handles --require=path, --require path, -r path forms WITHOUT eating unrelated --require flags), preserves --max-old-space-size, never throws from the preload.
2. **Heal hook** `claude/hooks/node-shim-heal.sh` (symlinked, registered in settings.json for SessionStart AND Stop): parses NODE_OPTIONS for any restore-node-options.cjs path; if the file is missing, mkdir -p + cp from the canonical copy and emits a one-line context note. Silent and exit-0 when healthy. Stop registration means a mid-session purge heals within one turn; SessionStart covers cold starts.

## Verified (live destruction test)
rm the shim -> node dies with loader:1210 (symptom reproduced) -> heal hook run -> file re-planted -> node exits 0 with child NODE_OPTIONS=[--max-old-space-size=4096] -> the previously-failing `node ~/.nyx/hook-bridge.cjs claude-code stop` exits 0.

## Residual risk (honest)
A purge mid-turn can still break node calls within that turn until the next Stop fires - the exposure window shrank from "until a human notices" to "one turn". True root-cause fix belongs in cmux (plant the shim outside the temp area); out of our control.

Files: claude/node-shims/restore-node-options.cjs (new canonical), claude/hooks/node-shim-heal.sh (new), claude/settings.json (SessionStart + Stop registrations), ~/.claude/hooks + ~/.claude/node-shims symlinks, temp shim re-planted.
