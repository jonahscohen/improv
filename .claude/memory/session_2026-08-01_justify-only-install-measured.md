---
name: A Justify-only install already works; the one real gap was a hook that shipped nowhere
description: Measured --only justify under a redirected HOME rather than reasoning about it. Exit 0, fully self-contained, MCP registered, skill and CLI shims placed. justify-queue-mandate.sh was in the repo, in no wiring file and on no install line, so it reached no machine except by hand.
type: project
relates_to: [session_2026-08-01_sidecoach-hooks-installed-but-unwired.md, reference_browser_change_dependency_chain.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: install run twice under a redirected HOME, before and after the fix; settings.json, .claude.json, skills and bin shims enumerated from the fake HOME; wiring entries re-parsed with the installer's own access pattern
confidence: high
---

# The Justify-only pathway already exists (2026-08-01)

Commit stamp at authoring: 93e9a28b.

Jonah's boss wants to work with Justify alone. The question was how to build that pathway. It is
already built, and measuring it was cheaper than designing it.

    HOME=<fake> bash install.sh --only justify --yes
    exit 0

What lands, all inside the redirected HOME with nothing escaping:

    ~/.claude.json                 mcpServers: ['justify']
    ~/.claude/settings.json        9 hook registrations (was 7 before the fix below)
    ~/.claude/justify/             the tree: core, server, adapters, dist, fonts, assets,
                                   node_modules, 9 CLI scripts
    ~/.claude/skills/justify/      the skill
    ~/.local/bin/                  justify-{done,init,remove,serve,watch,watch-arm,
                                   watch-disarm,worker}
    3,499 files excluding node_modules

## The one real defect

`justify-queue-mandate.sh` existed in `claude/hooks/`, appeared in **no** `app-wirings.json`
entry, and was on **no** `install_app_hooks` line. It therefore shipped to nobody. It is
registered on this machine only because it was hand-added, which is the same failure that lost
the entire Sidecoach layer earlier today: **a hook that is not both in `app-wirings.json` and on
an install line reaches exactly one machine and does not survive the next run.**

That matters more than most: it is the hook that keeps the model completing the Justify queue
rather than handing it back. A Justify-only install shipped without the thing that makes Justify
finish its work.

Fixed: added to `app-wirings.json` (SessionStart bare, UserPromptSubmit with the `turn` argument,
mirroring the live registration exactly) and to the `picked justify && install_app_hooks` line.
Re-measured: 7 registrations to 9, file deployed, install still exit 0 and still self-contained.

## What does NOT exist, and is the actual open question

`KEYS` is a FLAT list - `brain config memory skills statusline cmux nvm ampersand discord
voice-input voice-output reflect sidecoach task-list` plus the Stage 3b app components. There is
no `REQUIRES`, no `RECOMMENDS`, no profile. So "Justify, plus the supporting cast that makes it
good" is not expressible today.

A bare `--only justify` gives a working Justify with none of the fidelity layer, no beats, no
Sidecoach. It runs; it is not the "maximally successful" install Jonah described. Choosing what
rides along is a product decision about his boss's first experience, not a technical one, so it
goes to him rather than being guessed at.

## Files touched

- `claude/hooks/app-wirings.json` (justify-queue-mandate entries)
- `install.sh` (justify install_app_hooks line)
