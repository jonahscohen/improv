---
name: The documented transformative-FX count has been 25 for months; the skill actually ships 26
description: A teammate changed an installer description from 25 to 26 and I assumed it had miscounted, because CLAUDE.md says 25 in two places. Counting the skill's own section headings gives 8+6+4+3+5=26. The teammate was right and the standing documentation is stale.
type: project
relates_to: [session_2026-08-01_descriptions-written-for-outsiders.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: counted from the SKILL.md section headings, and the sibling claims in the same sentence (35 files, 14 backgrounds) independently confirmed against find and ls
confidence: high
---

# 25 or 26 (2026-08-01)

Writing user-facing copy for the installer meant every number in a description had to be checked
rather than copied. That is what surfaced this.

The `visual-effects` description claimed "25 transformative FX". A teammate changed it to 26 while
polishing. My first read was that it had drifted, since `claude/CLAUDE.md` states 25 and so does
the installed `~/.claude/CLAUDE.md`:

    /visual-effects - 14 generative shader backgrounds + 25 transformative FX + 17 post-process effects

The skill's own section headings say otherwise:

    ASCII (8 variants) + Dither (6 algorithms) + Glitch (4 types)
      + Halftone (3 modes) + Art (5 styles)  =  26

**The teammate was right and the standing documentation is stale.** Both CLAUDE.md copies carry
the old number.

The two sibling claims in the same sentence hold up, which is what makes the odd one out
interesting rather than noise: "35 files" is exactly `find . -type f` in the skill directory, and
"14 animated backgrounds" is exactly the count of shader directories.

## All four surfaces now agree

Jonah asked for both CLAUDE.md copies to be corrected too, so the number is now 26 in all four
places it appears: `browser-tree.json` (the GUI), `install.sh` DESCS (the CLI), `claude/CLAUDE.md`
(the repo), and `~/.claude/CLAUDE.md` (the installed copy). The last two are separate real files,
not symlinks, so each needed its own write.

I had held off on these, saying the file carried unrelated uncommitted edits. When I actually
diffed it, the count was the ONLY change in it - I had read a `git status` from earlier in the
session and never re-checked. **The caution was reasonable but the fact behind it was stale**, and
a one-line diff would have settled it in seconds.

## The same two errors also lived in install.sh

`browser-tree.json` feeds the GUI; `install.sh`'s `DESCS` feed the command line. Both carried the
stale 25, and install.sh additionally carried a worse one:

    "Personal: cinematic Ghostty effects (CRT curvature, TFT pixel grid, blazing cursor trail)."

`config.ghostty` has `bettercrt.glsl` and `tft.glsl` commented out. Only `cursor_blaze.glsl`
loads, so **two of the three advertised effects were sold and never delivered.** Corrected to say
which one is live and where to uncomment the others.

Fixing one surface and not the other would have left the CLI stating as fact what the GUI had just
stopped claiming.

## The general point

A number in a description is a claim, and it ages. Nothing in the installer or the test suites
checks that "25" still matches what the skill ships, so the only thing that caught it was a person
counting while rewriting the sentence. Every other count in these descriptions was verified the
same way during this pass.
