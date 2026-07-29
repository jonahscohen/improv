---
name: fabricated-svg was blind to primitive-built icons - gap closed, and two visual heuristics failed before a semantic one worked
description: The gate counted <path> only; icons made of <line>/<rect>/<circle> and icons flattened into one compound path scored zero. Three rules were measured, the first two broke under review, aria-hidden shipped at P=1.000
type: project
relates_to: [session_2026-07-28_icon-source-fix.md, session_2026-05-24_taste_validator_built.md, session_2026-07-28_vacuous-assertion-sweep.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests + 12 mutation controls + repo sweep + 3 codex rounds
confidence: high
---

Collaborator: Jonah. Follows session_2026-07-28_icon-source-fix.md, which found the gap while
fixing the icons the gate DID report.

## The gap

`checkFabricatedSvg` matched `<path ... d="...">` and nothing else, then bailed on
`if (paths.length === 0) continue`. Two classes of fabricated icon walked through:

1. **Primitive-built.** An icon assembled from `<line>`, `<rect>`, `<circle>`, `<polyline>`,
   `<polygon>` or `<ellipse>` scored zero paths and was skipped. The hamburger in
   `reference/index.html` - three hand-placed `<line>` elements, the most nakedly fabricated icon in
   the file - passed a gate whose entire job is catching fabricated icons.
2. **Compound-path.** An icon flattened into ONE `d=""` with several moveto commands
   (`M3 6h18M3 12h18M3 18h18`) is three strokes counted as one path, and at 23 characters it also
   cleared the `maxPathLen > 50` fallback. That is what `sidecoach/reference/responsive-foundation.md`
   had.

Same shape both times: a threshold keyed to one syntactic form, reporting confidently on everything
except the cases that did not use that form.

## The real story: two visual heuristics failed before a semantic one worked

This is the part worth carrying forward. **Precision was the whole unit**, and I got it wrong twice.

| | rule | measured |
|---|---|---|
| Draft 1 | icon grid + `currentColor` + >= 2 primitives | **P=0.500** |
| Draft 2 | ...plus the "stroke-icon idiom" (`stroke-linecap`/`linejoin`) | **P=0.750 R=0.600 - WORSE** |
| Shipped | ...the semantic signal instead: root `aria-hidden="true"` | **P=1.000 R=1.000** |

Codex broke draft 1 with a 24x24 sparkline, a micro bar chart and a small monochrome logo. I added
the stroke-terminal clause; Codex broke that with the same sparkline drawn with rounded caps and
said plainly that I had moved the goalposts rather than found a discriminator. It was right: rounded
caps are simply how anyone draws a 24px sparkline. Draft 2 also LOST recall, dropping filled icons.

**Why the visual approach could not work:** an icon and a microchart are both small monochrome line
art. There is no pixel-level property that separates them, so every visual clause I added was a
guess that a counterexample would eventually defeat.

**What actually separates them is meaning.** An icon is decorative chrome - the information is in
the adjacent text, and correct markup says so with `aria-hidden="true"`. A chart, sparkline, logo or
wordmark carries information and is exposed to assistive tech via `role="img"` and a label. That is
the author's own declaration, not an inference about pixels, and it is exactly the class the
icon-provenance rule governs.

**The failure mode inside the failure mode:** both times, my own suite asserted the new false
positive as a desirable "anchor". A test suite certifying the bug it should have caught is the same
pathology as the detector itself. I only escaped it by stopping, writing a harness that scored four
candidate rules against every counterexample at once, and letting the measurement choose - instead
of reasoning forward from the rule I wanted to be true.

## What ships

Branch 1 (`paths.length >= 2 || maxPathLen > 50`) is byte-for-byte unchanged and evaluated first, so
everything the rule caught before it still catches on identical terms. Branch 2 fires only on:
root `aria-hidden="true"` AND `currentColor` AND a square viewBox (or square width/height) of side
<= 48 AND no `<text>`/`<image>`/`<defs>`/gradient/`<animate>`/`<use>` AND >= 2 drawing elements, or
one path with >= 2 subpaths.

Two further corrections came out of review round 3:
- `aria-hidden` was read from the whole SVG block, so a decorative `<g>` inside a LABELLED chart
  vouched for the whole graphic. Now read from the root tag only.
- A drafted `role="img"`/`aria-label` rejection was removed as **dead code**: it can only change the
  outcome on a root that is both `aria-hidden="true"` and labelled, which is contradictory markup.
  A guard no input can exercise cannot be mutation-tested and buys only false confidence.

## Scope limits, asserted rather than implied

Each is a PASSING test named "scope limit", so loosening the rule later must edit a deliberate line:
an icon carrying no `aria-hidden` (the accepted recall cost), icon-grid primitives painted with
literal colors, a 200x200 square canvas, a non-square 24x12 box.

## Measurement

Corpus n=16 (every inline SVG in the repo's own HTML/markdown/assets, plus all five Codex
counterexamples): **precision 1.000, recall 0.600 -> 1.000**, fp 0, fn 0.

**Stated limitation:** the repo labels are the rule author's own, so they show self-consistency, not
correctness. The load-bearing external evidence is the sweep and the adversarial counterexamples.

**Repo-wide sweep, old compiled detector vs new:**
- **Tracked files: OLD=22, NEW=22, 0 files changed.** Zero new findings on any committed file - no
  false positives on real repo content.
- All files including the `does-it-help` sibling's untracked in-flight pages: 2 files changed,
  4 -> 20 findings, every one an unmarked `viewBox="0 0 24 24"` `stroke="currentColor"`
  `aria-hidden="true"` icon. Measured only, never modified; those numbers move as the sibling works.
- End-to-end: `reference/index.html` at 8ae761a4 goes **5 -> 6** findings, the sixth at line 51, the
  hamburger. The fixed file still reports 0.

## The locked fixture still fires

`node eval/migration-harness/scanner-snapshot.mjs verify` -> `scanner goldens VERIFY OK (5 inputs,
current == golden)`. `taste-extra.html` carries no `aria-hidden`, so it fires via the untouched path
branch with a byte-identical message.

## Mutation controls

`sidecoach/mutation-check-primitive-icons.sh`, following the existing `mutation-check.sh` contract
(exit 3 anchor missing, 4 not caught, 5 revert failed). **12 mutations, all CAUGHT.** Anchor
uniqueness is verified before every mutation and the file is byte-compared after every revert.

The anchor check earned its keep: a multi-line mutation silently failed to apply (bash kept `\n`
literal) and the harness exited 3 rather than reporting a false pass. Chasing that is what exposed
the dead-code guard above.

**Honest limits of this harness**, both raised by Codex and both left in place deliberately: it
checks that the named assertion is among the failures plus a declared total failure COUNT, not exact
failure identities; and those counts were CALIBRATED from observed runs, which makes them frozen
characterization data and a drift tripwire, **not independent evidence**. The semantic constraint is
the named-assertion check; the counts only catch drift.

An interrupt trap was added at Codex's request and then hardened when it noted the first version did
not exit on INT: separate `EXIT`/`INT`/`TERM` traps, idempotent restore, verified live by
interrupting a run mid-mutation and confirming the source was intact.

## Verification

- Baseline BEFORE any edit: full `npm test` exit 0.
- New suite: 9 assertions fail against the old detector (recall 0.600); all pass against the new.
- 12/12 mutations caught, exit 0.
- `npm run build` exit 0; only the three taste-validator dist artifacts changed, no generated-source
  drift. The CLI loads `dist/`, not `src/` - a rebuild is required or the fix is inert.
- Golden harness VERIFY OK.
- Three Codex rounds; every finding folded and the whole unit re-verified after each.

## Files touched

- sidecoach/src/taste-validator.ts (primitive + compound branches, semantic icon test)
- sidecoach/src/__tests__/taste-validator-primitive-icons.test.ts (new; corpus + 5 Codex negatives)
- sidecoach/scripts/run-tests.ts (registered - the runner is an explicit list, not a glob)
- sidecoach/mutation-check-primitive-icons.sh (new, 12 mutations)
- sidecoach/dist/taste-validator.{js,js.map,d.ts.map} (compiled)

Not committed, per instruction.
