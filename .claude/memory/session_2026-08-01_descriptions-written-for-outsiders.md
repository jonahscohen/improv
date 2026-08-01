---
name: Every installable component got a two-sentence explanation, and the first draft failed on audience rather than accuracy
description: 71 hooks and 36 components now carry two sentences each. The first pass was factually sound and unreadable to anyone outside this team - it defined unknowns with other unknowns. A teammate went idle twice without doing the rewrite, so the lead did it.
type: project
relates_to: [session_2026-08-01_badge-becomes-the-checkbox.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: 147/0 on test-component-browser.sh; hook key set byte-identical before and after; jargon sweep 0; rendered and read in the installer
confidence: high
---

# Written for someone who just downloaded this (2026-08-01)

Jonah, on the first batch: *"Some of these aren't written for a developer who doesn't have
insight/context to the situation. Please write with that in mind."*

## The failure was audience, not accuracy

Every fact in the first draft was verified against the hook source. It was still unusable, and the
defect was uniform: **it defined unknowns with other unknowns.**

    so a beat write never stalls              <- they do not know what a beat is
    even without a sidecoach verb             <- or that Sidecoach has verbs
    content-guard still runs alongside        <- naming a sibling explains nothing
    Same cadence as task-loop-mandate         <- one unknown defined by another

The reader is not on this team. They downloaded an installer and are deciding whether to tick a
box. That is a different person from the one the first draft was addressed to, and no amount of
factual precision fixes writing aimed at the wrong reader.

The rule that came out of it: **never define an unknown with another unknown.** Real paths, real
file names and real commands are GOOD - concrete and checkable. It is unexplained CONCEPTS that
fail. So "a beat" became "a session note", `beats.py` became "rebuilds the searchable index of
those notes", and "a sidecoach verb" became "a design command word such as audit or polish".

## A teammate that idled instead of working

`descriptions` was re-tasked with the audience correction and went idle. I checked four entries
against its first pass and they were **byte-identical** - it had not done the work. Re-tasked a
second time with a mechanical acceptance test it had to make print zero. It idled again, still
unchanged.

At that point the round-trips cost more than the work. The lead did the 15 rewrites directly.

**The lesson is about verification, not the teammate.** An idle notification is not a completion
report, and "available" says nothing about whether anything was produced. Diffing the output
against the previous state is what caught it; taking the idle signal at face value would have
shipped the unchanged file twice.

`compdesc` is the counter-example: it got the audience correction BEFORE writing anything and
delivered all 36 components in the right voice on the first pass. Correcting the brief early beats
correcting the output late.

## The other half: the data never reached the browser

Hook rows had always rendered blank. The 71 explanations existed in `browser-tree.json` all along,
but `manifest.py` never forwarded the `hook_desc` map to the client, so `walkMembers` set every
hook child to `desc: ''`. **The most cryptic names in the whole installer were the only ones with
no explanation.** Three lines to plumb through.

## Final state

    hooks       71 total, 0 under two sentences, 0 carrying insider terms
    components  36 total, 0 under two sentences, 0 carrying insider terms
    key set     byte-identical before and after
    suite       147 passed, 0 failed

## Editing a file a teammate has not finished with

After the commit, another edit landed on the Justify description, changing "puts eight justify-*
commands in ~/.local/bin" to "on your PATH". I put the path back, reasoning that both are true and
each carries what the other does not - the path is the fact you can check, the PATH phrasing is
what it MEANS - and the teammate promptly rewrote it again.

It was still running. I had sent it a shutdown request and treated that as the end of its unit,
which it was not: a shutdown REQUEST is a question, and until the process exits the teammate still
owns its file. Editing underneath a live writer produces exactly this, two agents overwriting one
line, and the fault is the timing rather than either wording. Left as the teammate has it and
waited for the process to exit before touching the file again.

## Files touched

- `claude/hooks/browser-tree.json` (all 107 descriptions)
- `claude/installer-gui/manifest.py`, `claude/installer-gui/index.html` (forward and render them)
