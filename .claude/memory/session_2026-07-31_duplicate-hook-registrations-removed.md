---
name: 11 duplicate hook registrations were firing a second redundant process per event
description: Live settings held 102 hook entries of which 91 were unique. Eleven hooks, including three Stop guards, were registered twice and ran twice on every event. Deduped in place; the repo copy was already clean, so this was accumulated local drift.
type: project
relates_to: [session_2026-07-31_concise-gate-measured-and-widened.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: duplicates enumerated before and after; settings integrity checked key-by-key with permissions and mcpServers confirmed; all 81 referenced script paths confirmed to exist; concise suite re-run 45 passed 0 failed
confidence: high
---

# Eleven hooks were running twice (2026-07-31)

Commit stamp at authoring: b694db4f.

Noticed while answering a plain question - "so is this a hook?" - by actually reading the
registration rather than describing it from memory. `concise-detect-stop.sh` appeared twice under
`Stop`.

It was not alone. `~/.claude/settings.json` held **102 hook entries, 91 unique**:

    x2  PostCompact    startup-check.sh
    x2  PreCompact     memory-flush printf
    x2  SessionStart   consolidate-nudge.sh
    x2  SessionStart   reflect-nudge.sh
    x2  SessionStart   justify-watch-guard.sh
    x2  SessionStart   memory-compact.sh
    x2  Stop           api-drift-stop.sh
    x2  Stop           concise-detect-stop.sh
    x2  Stop           content-guard-stop.sh
    x2  Stop           justify-watch-guard.sh
    x2  Stop           multiple-choice-detect-stop.sh

Every one spawned a second process on every matching event. Six of them fire on SessionStart or
compaction, five on every single Stop.

## Why it was not visibly breaking anything

The Stop guards that could have double-blocked are individually protected. `concise-detect-stop`
claims its flag with `set -o noclobber`, so of two concurrent processes exactly one can block.
That defence is what kept a duplicate registration from becoming a duplicate block, and it is
also what hid the duplication - the symptom was wasted work, not wrong behaviour.

## The fix

Deduped in place keeping first occurrence, backup at `/tmp/settings-predupe.json`. Verified after:
top-level keys unchanged, `permissions` intact, all 3 `mcpServers` intact, 91 entries and 91
unique.

Also checked every registered script path resolves - **81 checked, 0 missing**. That check exists
because on 2026-07-29 I registered a hook before deploying its file and left every Write and Edit
pointing at a missing path for several minutes.

## Where it came from, and why nothing is committed

`claude/settings.json` in the repo has 5 entries and **zero** duplicates. So this is accumulated
LOCAL drift - repeated installer or setup runs appending to the live file rather than reconciling
with it - not something a fresh clone inherits. There is no repo change to make, which is why this
beat exists: the finding is the record.

The durable improvement, if it recurs, is for whatever appends hook registrations to check for an
identical (event, matcher, command) triple first. Worth doing only if the count climbs again;
noting it rather than building it.

## Files touched

- `~/.claude/settings.json` (live only; backup at /tmp/settings-predupe.json)
