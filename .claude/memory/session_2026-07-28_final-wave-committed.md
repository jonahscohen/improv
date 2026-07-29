---
name: The final wave - a measured null on sidecoach, and three instruments that could not see
description: The efficacy trial came back null and named why. The justify HOME escape, the team reaper's blindness to its own lead, and the fabricated-icon detector's blindness to primitives all closed. Install to the live machine is unblocked.
type: project
relates_to: [session_2026-07-28_deploy-decision.md, session_2026-07-28_does-sidecoach-help.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: all five suites re-run by the lead; live shims re-checked; page rendering verified by the lead's own screenshot
confidence: high
---

# The final wave (2026-07-28)

Jonah asked "what's left to do" twice. The second time produced four units, and one of
them answers the question the whole repo had been avoiding.

## The efficacy trial: a measured null

**Sidecoach shows no detectable improvement on this task at n=17.** Neither pre-registered
measure survived Holm, and the blind preference judgement runs slightly AGAINST it - the
length-matched placebo won 10 of 17.

The one-line finding: **sidecoach's payload reliably improves what sidecoach MEASURES, and
does not improve what a blind judge SEES.** Six polish rule classes drop to exactly zero on
all 17 sidecoach pages, and those six are verbatim checklist items the payload enumerates
and the scanner checks by string.

Not all circular: axe-core independently corroborates two structural wins, `region` 5/3/0
and `heading-order` 3/3/0. `color-contrast`, the largest category, is unchanged.

**Codex rejected the first design outright** - two arms could not separate the product from
a 16x prompt-length effect, and the defence that "the delta is produced by the product, not
by me" was not sound. The third length-matched placebo arm is what makes the null mean
anything.

The result it could NOT explain: on rendered appearance the placebo won 16 of 17, and an
exploratory full-page re-judgement came back 0 of 17. Codex named the unruled-out artefact
honestly - a same-model-family judge may be punishing a recognisably sidecoach-SHAPED page
rather than expressing anything a human would. Settling that needs an out-of-family judge
or a person.

## Three more instruments that could not see

- **justify's installer** wrote eight shims into the real `/opt/homebrew/bin` while running
  under a redirected HOME, and its verification loop PASSED because they resolved inside
  the sandbox. Success reported over a broken host CLI.
- **the team reaper** matched only process markers carrying the TEAM name, which only
  teammates carry. It was structurally blind to the lead - so standing teammates down, the
  documented discipline, is what made a healthy session look abandoned.
- **the fabricated-icon detector** counted `<path>` only, so an icon built from `<line>`
  primitives, or three strokes flattened into one compound path, was invisible.

## The lesson that recurred inside the fixes

Each agent reproduced the defect class it was fixing, INSIDE its own fix:

- justify's containment test was LEXICAL, defeated by a symlinked `$HOME/.local/bin`,
  written twenty lines after three paragraphs about resolving physically first.
- the reaper's mutation harness truncated every mutant to 0 bytes, so 13 reported CAUGHT
  having proven nothing. The tell was that all 17 produced an IDENTICAL failure list; real
  mutants give diverse signatures.
- the icon detector's suite asserted its own new FALSE POSITIVE as a desirable anchor,
  twice, in the two drafts Codex broke.

## The icon finding worth generalising

Two visual heuristics failed before a semantic one worked. An icon and a microchart are
both small monochrome line art, so no pixel-level property separates them and every visual
clause is a guess awaiting a counterexample. What separates them is MEANING: `aria-hidden`
on the root is the author declaring this is decorative chrome. P 0.500 to P 1.000 R 1.000.

## Lead verification

Suites re-run: justify escape 16/0, offline re-install 15/0, delegated writes 106/0,
team-reaper 51/0, primitive-icons PASS. All ten live shims resolve to `~/.claude/justify`.

I also took my OWN screenshot of the reference page rather than citing an agent's: the
GitHub arrow and the house-card CTAs render correctly. My first shot came back black, which
is the mid-scroll artefact the icon agent had documented - had I not read its report I would
have filed it as a rendering bug.

## Next

Install to the live machine, which Jonah approved gated on the justify fix. That gate is
now clear.

## Files touched

- committed as `5d5cea81` and `c5fbf0fc`; remaining units follow
