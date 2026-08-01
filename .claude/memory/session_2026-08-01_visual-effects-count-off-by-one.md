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

## Not fixed here, deliberately

`claude/CLAUDE.md` already carries uncommitted edits from another session, and it is the human's
standing instruction file. Correcting a number inside it while it is dirty with someone else's
work risks entangling two unrelated changes in one commit. Raised for Jonah instead.

## The general point

A number in a description is a claim, and it ages. Nothing in the installer or the test suites
checks that "25" still matches what the skill ships, so the only thing that caught it was a person
counting while rewriting the sentence. Every other count in these descriptions was verified the
same way during this pass.
