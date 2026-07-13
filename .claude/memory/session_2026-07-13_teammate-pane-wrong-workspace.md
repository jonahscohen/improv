---
name: Teammate panes render, but in the WRONG WORKSPACE (not a shim regression)
description: Jonah could not see any teammate pane. The tmux shim was healthy and byte-identical to canonical; the panes existed and rendered - they were being created in workspace:1 (ppai) because the lead hands teammates a CMUX_WORKSPACE_ID bound to ppai, while the lead's visible surface lives in workspace:5 (improv)
type: project
relates_to: [session_2026-06-23_cmux-teammate-pane-FIX.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: cmux identify + list-panels per workspace
confidence: high
---

Collaborator: Jonah Cohen

## Symptom
Jonah: "i cant see a builder pane, so i have no idea what's going on." The working
hypothesis handed to me was that cmux had regenerated its stock tmux shim and the
2026-06-23 fix had been lost on a resumed session.

## That hypothesis was WRONG - the shim is healthy
- The live shim `~/.cmuxterm/claude-teams-bin/tmux` is 3891 bytes and CONTAINS the
  `cmux-teammate-launch` wrap marker.
- `cmp` against the canonical `~/.claude/cmux/teammate-tmux-shim`: BYTE-IDENTICAL.
- `cmux-teammate-shim-heal.sh` exits 0 with no action (correctly, it is idempotent and
  saw the marker).
- The stock shim (`tmux.orig`, 99 bytes, just `exec cmux __tmux-compat "$@"`) is NOT
  what is installed.
So the 2026-06-23 root cause (compound respawn command failing execvp) was NOT in play.
The panes were being CREATED and were RUNNING. Do not "heal" the shim in response to
this symptom - it is already correct, and the heal is a no-op.

## ACTUAL root cause: the teammate pane is created in the wrong WORKSPACE
`cmux identify` from inside the builder teammate reported:
    surface_ref: surface:34, workspace_ref: workspace:1
and my inherited env carried `CMUX_WORKSPACE_ID=6CC7F8AA-193A-4B7D-9A13-C82677CB988B`,
which `cmux workspace list --id-format both` resolves to **workspace:1 = ppai**.

Per-workspace panel listing made it unambiguous:
- workspace:5 (improv, SELECTED - where Jonah and the lead are looking):
  surface:13 (the lead) + surface:29. ZERO teammate panes.
- workspace:1 (ppai): surface:18 (general-purpose) + surface:34 (the builder teammate)
  + surface:35 (the builder's browser pane).

The teammate panes rendered perfectly - into the ppai workspace. Jonah, viewing improv,
saw nothing. The lead's own surface (surface:13) lives in workspace:5, but the lead
process's ENV is bound to workspace:1, and cmux creates new surfaces against
`CMUX_WORKSPACE_ID`. So every teammate the lead spawns lands in ppai.

## Immediate remedy applied
    cmux move-surface --surface surface:34 --workspace workspace:5
    cmux move-surface --surface surface:35 --workspace workspace:5
workspace:5 now shows the lead (surface:13), the builder (surface:34), and the
dependency-map browser (surface:35). ppai correctly retains only its own surfaces,
including surface:18 = `justify-watch` (agent-id justify-watch@session-5cf4ee5e), which
belongs to the PPAI session and was deliberately NOT moved.

## Durable fix (for whoever owns the lead session)
The env is fixed at process start, so this cannot be repaired from inside a teammate.
Either:
1. Relaunch the lead session FROM the improv workspace so `CMUX_WORKSPACE_ID` matches
   the workspace its surface actually lives in (cleanest), or
2. Have the spawner `cmux move-surface --surface <new-teammate-surface> --workspace
   <lead's actual workspace>` immediately after a spawn (a patch-up, not a cure).

## Self-analysis / the lesson
I was handed a confident diagnosis ("the shim regressed, re-apply the fix") and the fix
script to run. Running it and reporting "healed" would have been fast, wrong, and would
have left Jonah still unable to see the pane while everyone believed it was fixed. The
heal script is idempotent, so it would have printed nothing and changed nothing - a
silent no-op that looks like success. Checking the shim's ACTUAL bytes against canonical
BEFORE acting is what turned a plausible story into a measured one. A fix script that
exits 0 is not evidence that the thing it fixes was ever broken.

## Files touched
- .claude/memory/session_2026-07-13_teammate-pane-wrong-workspace.md (new)
- .claude/memory/MEMORY.md (index)
- No code changed. The shim needed no repair.
