---
name: The three escalation units committed - delegated writes, prune ownership, skill deploy and deactivate
description: The follow-on work Jonah authorised after the repair wave. Each unit found more than its brief named, and two agents independently hit the same REPO_DIR mutation trap.
type: project
relates_to: [session_2026-07-28_repair-wave-committed.md, session_2026-07-28_delegated-dispatch-ledger.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: each unit's suite re-run by the lead; live machine state checked after two self-reported incidents
confidence: high
---

# The escalations, committed (2026-07-28)

Jonah authorised all three escalations rather than deferring them. Each one turned out
larger than its brief.

## What landed

- `2842689f` - delegated installer writes. Every write in `justify/install.sh` and
  `lotus/install.sh` enumerated and made atomic, plus both dispatches in `install.sh` routed
  through the failure ledger.
- `b6498e04` - prune ownership. Deletion now needs shape AND git provenance; eleven
  scenarios flip from deleted to survived.
- skill deploy, verify and the deactivate exit-status fix follow.

## Each unit exceeded its brief

| brief said | reality |
|---|---|
| three unsafe writes in the delegated installers | the whole write surface, including a config-destroying `json.dump` |
| the tactical-polish deactivate arm | 13 leaves across 5 code sites |
| skills drift from HEAD | six files hand-edited with changes existing nowhere in git, distinct from eleven merely stale |

## The measured damage, per unit

- **Config destruction, silent.** `json.dump(d, open(p,'w'))` truncates `~/.claude.json`
  before writing and the unclosed file flushes during interpreter finalization, where
  CPython prints the OSError and swallows it. 4013 bytes to 512, exit 0, "MCP server
  registered" printed next.
- **Uninstall abandoning its plan.** On HEAD a four-component uninstall removed ONE and left
  three installed while reporting failure. A glob matching nothing left 1 as an arm's last
  status.
- **The prune deleting the reviewer.** The old prune would have removed the link to
  `codex-review.py`, the tool running its own review, when a stash made its target briefly
  absent.

## Two agents hit the identical trap independently

Both `codex-fix-prune` and `codex-fix-skilldeploy` wrote mutants to a temp dir, and
`install.sh` derives `REPO_DIR` from its own location, so every probe died before reaching
the mutated code and reported CAUGHT falsely. One said 15/15, the other 4/5.

That it happened twice, to two agents, one of whom had personally diagnosed and written up
the same trap hours earlier, makes it a property of this installer rather than a lapse.
Both fixed it structurally: run the UNMUTATED installer through the same probe first and
fail the row as BROKEN ENVIRONMENT if the baseline does not report correctly.

## Three corrections agents made to the lead's briefs

All three were premises I supplied from habit rather than from a run:

1. `cp -r` does NOT follow a symlinked destination on macOS; it fails with "Not a
   directory". GNU cp does follow.
2. A manifest is the wrong answer for the prune, because it needs instrumentation at every
   deploy site and leaves already-installed machines with an inert prune.
3. `task-list` is merely stale, not hand-edited, and `consolidate` is hand-edited.

## Files touched

- committed as described; `install.sh` dispatch edit made by the lead
