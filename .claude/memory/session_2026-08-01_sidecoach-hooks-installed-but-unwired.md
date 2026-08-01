---
name: Every sidecoach hook is installed, works when invoked, and is registered nowhere
description: Zero sidecoach entries in live settings while the skill, the CLIs and all eight hook files are present and functional. The craft floor I verified firing on 2026-07-29 is gone. This is the likely answer to the open marketing-buzzword question.
type: project
relates_to: [session_2026-07-29_craft-floor-is-live-and-nothing-is-symlinked.md, session_2026-07-31_duplicate-hook-registrations-removed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: live settings enumerated by event (86 registrations, zero containing "sidecoach"); the pre-dedupe backup also contains zero, so the dedupe did not cause it; all four hook files confirmed present and both craft-floor and taste-gate invoked directly and responded correctly
confidence: high
---

# The sidecoach hook layer is wired to nothing (2026-08-01)

Commit stamp at authoring: 6d0a9925.

Found while answering a question about which hooks fire during a justify worker run. I had
listed `sidecoach-craft-floor` and `sidecoach-taste-gate` as firing on any HTML or CSS write.
Neither is registered. Neither is anything else sidecoach owns.

    sidecoach registrations in ~/.claude/settings.json : 0
    sidecoach registrations in the pre-dedupe backup   : 0
    sidecoach hook files present on disk               : all
    invoked directly                                   : both respond correctly

The skill is installed, `~/.local/bin/sidecoach` and `sidecoach-monitor` exist, the hooks are
on disk and functional. They are simply not wired.

## Not caused by today's dedupe

The 2026-07-31 pre-dedupe backup contains zero sidecoach entries, so they were already gone
before that pass touched anything.

## What almost certainly removed them

`install.sh` inside `if picked sidecoach` runs a NORMALIZE-ONLY strip that deletes **every**
registration whose command contains `sidecoach`, by design:

    g['hooks'] = [h for h in g.get('hooks', []) if 'sidecoach' not in h.get('command', '')]

Its stated contract is that the later `picked sidecoach && install_app_hooks ...` pass re-adds
exactly the ones that survive the off-list, which keeps re-runs idempotent across old absolute-path
wirings. `app-wirings.json` does carry all eight, including `sidecoach-craft-floor.sh` on
`PreToolUse` and `sidecoach-taste-gate.sh` on `PostToolUse`.

So the strip ran and the re-add did not restore. The exact failure of the re-add is not yet
established and should not be guessed at.

**The hand-registration I made on 2026-07-29 was always going to lose this race.** I edited live
settings directly and verified the hook firing; a later `picked sidecoach` run stripped it. A
registration that is not in `app-wirings.json` AND deployed through the installer is temporary by
construction.

## Why this matters beyond one hook

The global instructions assert that `sidecoach-taste-gate.sh` "fires on every `.html`/`.css` write
under a directory containing DESIGN.md" and runs the six anti-pattern ban sweep. **It has been
firing on nothing.** That is a rule documented as mechanically enforced with no mechanism behind
it, which is the exact class the `detector` teammate was asked to investigate for
`marketing-buzzword` on 2026-07-29 and never answered. This is very likely that answer.

It also means the craft floor - 15 rules and 10 refusals, the instructive layer that was the whole
point of that day's work - has not loaded once since it was built.

## Files touched

- none yet (measurement only)
