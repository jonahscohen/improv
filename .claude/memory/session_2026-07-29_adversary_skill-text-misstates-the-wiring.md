---
name: FAILED CLAIM - the installed skill undercounts its own tools AND misstates which are flow-wired
description: sidecoach-image appears zero times in the installed skill surface, and SKILL.md actively asserts the opposite of the truth about flow wiring. Separately, a teammate's reachability zero for image generation is wrong - flow D invokes it on a real input.
type: project
relates_to: [decision_discoverability_outranks_internal_quality.md, session_2026-07-29_image-generation.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: installed skill grepped; sidecoach list/help compared against it; flow D driven on a real input and its written artifacts read, including the produced PNG opened visually
confidence: high
---

# The skill text is not just silent, it is wrong (2026-07-29, adversary pass)

Commit stamp at authoring: 56251cb7.

## Half one: the discoverability gap, confirmed and then made worse

`session_2026-07-29_image-generation.md` claims the tool is "reachable from a real verb" and
"registered in `sidecoach list` / `help image` under Generative." Both are true:

    node bin/sidecoach.js list  | grep -i image
    #   Standalone tools (7) - sibling CLIs on the sidecoach surface:
    #     sidecoach-image
    node bin/sidecoach.js help image     # full description, names the flowD lens

But the CLI's self-description is not what a model loads. The installed surface is two
symlinked files, and it never names the tool:

    grep -rn "sidecoach-image" ~/.claude/skills/sidecoach/   # no output
    grep -rn "sidecoach-image" claude/                       # no output

That much a teammate already recorded in `decision_discoverability_outranks_internal_quality.md`.
What that beat does not say is that the skill text does not merely OMIT the tool - it makes two
statements that are now false, which is a worse failure than silence because a reader acts on
them:

`claude/skills/sidecoach/SKILL.md:153`

    Alongside the `sidecoach` resolver, six self-contained CLIs ship in `sidecoach/bin/`.

There are seven. The CLI's own `list` says 7. The skill says six and prints a table of six.

`claude/skills/sidecoach/SKILL.md:171`

    **`sidecoach-drift` is additionally wired into the audit flow.** [...] The other five
    tools are invoked directly (by you or the user), not auto-run by a flow.

This is the opposite of the truth. `sidecoach-image` IS auto-run by a flow - flow D's
concept-sketch lens - and the sentence tells a model that no tool other than drift is. A model
reading line 171 concludes it must invoke any image work by hand, and that no flow will produce
a plate for it. An omission leaves a gap; this sentence fills the gap with a wrong answer.

Why it happened: the tool was registered in the CLI's own registry (`bin/sidecoach.js`), which
is where `list` and `help` read from, and the count and the wiring sentence in SKILL.md are
hand-maintained prose with nothing asserting they agree with that registry. There is no test
that compares the skill's tool table to `sidecoach list`. That is the durable fix, not editing
the two lines: the count and the flow-wired set are both derivable, so a suite can assert them.

## Half two: the reachability zero in that teammate beat is wrong

`decision_discoverability_outranks_internal_quality.md` states:

> It is referenced by exactly two files - itself and its own CLI. No flow handler imports it.
> [...] Nothing can find it and nothing can call it.

The first sentence is a grep for IMPORTERS. Flow D does not import the module; it SPAWNS the
CLI, so an importer grep cannot see it:

    grep -n "sidecoach-image" src/flow-handler-design-references.ts
    # 94:  const bin = path.resolve(__dirname, '..', 'bin', 'sidecoach-image.js');

That beat sets its own revisit condition: "reachability is demonstrated by a command that shows
a flow, agent, or hook actually invoking it on a real input." Here is that command. A real verb,
a real workdir, no flags:

    cd /tmp/adv-probe/craftwd            # PRODUCT.md only
    node .../bin/sidecoach-monitor.js "/sidecoach craft a pricing page" --json

    guidance: Concept sketch: VERIFIED and available at
              /private/tmp/adv-probe/craftwd/.sidecoach-cache/sketches/concept-fe696165c668.png

Three files were written by the image bin through the flow: the sketch, plus the
content-addressed asset and its sidecar in `.sidecoach-cache/images/`. I opened the PNG: a
1024x1024 teal-to-purple gradient with four soft red discs and a palette strip along the
bottom - a real render, and unmistakably the deterministic offline placeholder it is supposed
to be rather than a blank or a flat fill.

So the two dimensions split, and the beat collapses them:

- DISCOVERABILITY: genuinely zero. Confirmed independently. A model cannot learn the tool exists.
- REACHABILITY: not zero. A shipped flow invokes it on a real input and consumes its verdict.

Scoring reachability as a hard ZERO on the strength of an importer grep would mislead Jonah in
the direction that feels rigorous, which is the direction that is hardest to catch. The honest
row is "reachable by one flow, discoverable by nobody" - and the fix that follows is different:
naming it in SKILL.md, not building an invoker that already exists.

## My own instruments, three of which broke first

Recorded because the standing rule is that a probe reporting nothing is the likelier culprit,
and it caught me three times in one pass:

1. `grep -cE 'sed[[:space:]]\+-i'` returned 0 on install.sh and I nearly reported it as a clean
   sweep. `\+` is not the ERE plus - the pattern was looking for a literal `+`. Fixed to `+`,
   then confirmed it fires on a planted `sed -i` before believing any zero.
2. `sk-[A-Za-z0-9_-]{16,}` for the key sweep matched `task-notification` and
   `ask-through-the-tool`, burying the real hit under false positives. Anchoring on
   `(^|[^A-Za-z0-9-])` fixed it.
3. I reported an "empty verdict line" on a clean page. It was my own 700-character print slice
   cutting `Warnings-only: 1 finding (1 warning), grade A.` in half. Not a defect. Withdrawn
   before it reached the report.

Every one is the same shape as the four the lead logged: the instrument matched what I expected
rather than what the subject emits.

## Files touched

- none (measurement only)
