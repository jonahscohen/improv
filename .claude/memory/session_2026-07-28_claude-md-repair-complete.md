---
name: CLAUDE.md symlink repair COMPLETE - payload sources restored, drift synced, empty content diff
description: The legacy symlink is gone, both payload sources are clean, RULES.md received months of drifted edits back, strip_block_markers is case-insensitive, and the reassembled file is byte-identical in content to what Jonah had before.
type: project
relates_to: [session_2026-07-28_rules-md-stale-drift.md, session_2026-07-28_claude-md-contamination-diagnosed.md]
supersedes: session_2026-07-28_claude-md-symlink-model.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: content diff after reassembly is EMPTY (278 content lines before and after); strip_block_markers proven with 4 case variants plus a negative control
confidence: high
---

# The repair, finished (2026-07-28)

Jonah's design intent was right all along: the additive markers exist to PROTECT each
user's own CLAUDE.md, because everyone works on different projects. This machine was stuck
in the pre-`fab3cdc6` legacy state where a symlink made his global file and the repo's
payload source the same inode, which defeated exactly that protection.

## Final state

| thing | before | after |
|---|---|---|
| `~/.claude/CLAUDE.md` | symlink into the repo | REAL file, 443 lines, content unchanged |
| `claude/CLAUDE.md` | 443-line assembled OUTPUT | 184-line payload, zero markers |
| `claude/RULES.md` | 104 lines, months stale, self-wrapped | 121 lines, current, zero markers |
| `strip_block_markers` | fixed-string, lowercase only | case-insensitive regex, whitespace tolerant |

Live file structure is now exactly one memory-discipline block and one brain block, with no
nested rules markers.

## The gate that made this safe

The acceptance criterion was an EMPTY content diff against a pre-change backup, markers and
blank lines ignored. **278 content lines before, 278 after, diff empty.**

That gate earned its keep. The FIRST reassembly attempt looked completely healthy - the
installer printed "Installation complete", the marker count was correct, one clean brain
block, a plausible 426 lines - and had silently dropped Team Rules 8, 9 and 10, the entire
Hook Error Response Protocol, and every beats-rename wording change. Line count and
structure are not evidence. Only the content diff caught it.

## Two defects fixed along the way

1. **`claude/RULES.md` had drifted months behind.** Because the live file WAS the repo file,
   edits to the team rules landed in the assembled output and never reached the payload
   source. The output had quietly become the de-facto source of truth. Commit `0fae7543`
   ("sync CLAUDE.md drift back to source") shows this was hand-patched once before and read
   as a chore rather than a symptom.
2. **`strip_block_markers` was case-sensitive.** RULES.md wrapped itself in
   `<!-- Improv:rules:begin -->` with a capital I, so yesterday's new invariant let it
   through. Now matches the marker SHAPE across case and surrounding whitespace, verified
   against a negative control so an ordinary HTML comment still survives.

## A test was certifying the contamination

`test-userfile-safe-edit.sh` asserted that a refreshed brain block contains
`Beats Discipline`. That string is in NEITHER payload source - it belongs to the
memory-discipline component. The row passed only because `claude/CLAUDE.md` had been
overwritten with the assembled output, so the payload happened to contain another
component's block. The moment the source was cleaned, the assertion went red.

Corrected to require a string from EACH payload source (`Team Rules` from RULES.md,
`Question-Asking Protocol` from CLAUDE.md), which is strictly stronger than what it
replaced, plus the original `OLD` absence check. Mutation-proved rather than assumed:
breaking the `# Team Rules` heading in RULES.md turns the row red, restoring it turns it
green, 49/0.

The general form is worth stating: **a refresh assertion anchored on a string the payload
does not own certifies whatever contamination put that string there.** It looked like a
strong end-to-end check and was validating the exact bug it should have caught.

## Still drifted, NOT fixed here

`claude/memory-discipline-section.md` contains zero occurrences of `Beats Discipline`,
while the memory-discipline block in the live file contains it. That is the same
output-overwrote-input drift as RULES.md, on the other component, and it was out of scope
for this repair. Whoever picks it up should sync it the same way and gate on an empty
content diff.

## What to carry forward

A payload must never be writable from the thing it assembles into. The symlink created a
cycle where output overwrote input, and every downstream problem today - contaminated
source, stale RULES.md, nested markers - is a consequence of that one cycle rather than four
separate bugs.

## Files touched

- `~/.claude/CLAUDE.md` - symlink replaced by a real file, content identical
- `claude/CLAUDE.md` - trimmed to its 184-line payload
- `claude/RULES.md` - drift synced back, self-wrapping markers removed
- `install.sh` - `strip_block_markers` made case-insensitive
