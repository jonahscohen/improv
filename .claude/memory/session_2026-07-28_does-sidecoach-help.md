---
name: Does sidecoach IMPROVE the output, or only run? A pre-registered 3-arm trial, and the answer is a measured null
description: n=17 briefs x 3 arms (control / length-matched placebo / sidecoach), 51 pages, Codex-reviewed design frozen before any data. NO detectable improvement - neither confirmatory measure survived Holm (independent blind judge 7-10 AGAINST sidecoach p=0.629; axe-core -0.47 violations/page p=0.072). Sidecoach DOES drive its own checklist to zero (6 rule classes 17->0) and improves landmark/heading structure by axe's independent reckoning. On rendered screenshots a blind judge preferred the placebo 16 of 17. The pattern - improves what it measures, not what a judge sees - is the finding.
type: project
relates_to: [session_2026-07-28_sidecoach-live-efficacy.md, session_2026-07-28_beats-abstention.md, session_2026-07-28_taste-precision.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: 51 generated pages, axe-core 4.12.1, shipped sidecoach-detect, 34 blind Codex verdicts + 34 blind screenshot verdicts, 13-check integrity suite with mutation controls, 2 pre-data Codex design reviews + 1 post-result Codex review (5 findings, all folded)
confidence: high
---

Collaborator: Jonah. Codex raised this as finding F7 of the live-efficacy review and it was never
closed: every measurement in this repo establishes whether a sidecoach component FIRES, never
whether it HELPS. This closes it at the resolution the budget allows, and the honest headline is
the one the lead half expected.

## The answer

**No detectable improvement on this task at this n.** Neither pre-registered confirmatory measure
survived Holm correction, and the point estimate on the independent preference judgement runs
slightly AGAINST sidecoach.

The more useful version, which only emerges from three measures together:

**Sidecoach's payload reliably improves what sidecoach measures, and does not improve - and on
rendered appearance is consistently judged worse than - what a blind judge sees.** (That last
clause rests on secondary/exploratory same-family judging with a live alternative explanation; see
below.)

## Design (frozen before any data, Codex-reviewed TWICE before any data)

Unit: one self-contained HTML page from one committed brief. Population: the 17 template-conforming
briefs in `eval/corpus/briefs/` - **authored by Codex in a prior commit**, so I could not have
shaped them. Producer: a fresh Claude Code subagent per cell, sonnet, identical tier across arms.

| arm | prompt | isolates |
|---|---|---|
| C control | wrapper + brief | the floor |
| P placebo | wrapper + brief + length-matched NON-DESIGN block | prompt length, salience |
| S sidecoach | wrapper + brief + the shipped engine's `guidance`, verbatim | design content |

**Codex round 1 rejected the design outright** and that rejection is the single most valuable thing
in this unit. My v1 was two-arm (S vs C). Its verdict: the sidecoach prompt is ~16x longer than the
bare control's, so any S-vs-C win is a length/salience effect and the headline claim is *not
identifiable*. It demanded a length-matched placebo arm. **Round 2 returned NO-GO** on one further
item: I had pre-registered dropping M2 from the confirmatory family if its tie rate exceeded 60%,
and Codex called that an outcome-dependent analysis path even though pre-registered. Removed; the
Holm family is fixed at {M1, M2} whatever the data does.

Both verdicts are committed verbatim at `codex-review-v1.md` / `codex-review-v2.md`.

## The numbers

Confirmatory, Holm over {M1, M2}, family-wise alpha 0.05:

| measure | statistic | p | threshold | result |
|---|---|---|---|---|
| M2 axe-core violations S-P | mean diff **-0.471**, exact Wilcoxon | **0.072** | 0.025 | no rejection |
| M1 blind preference S vs P | **7 win / 10 loss**, exact binomial | **0.629** | 0.050 | no rejection |

- **M1** (Codex/GPT-5.4, blind, source-level): sidecoach win rate **0.412**, CI [0.184, 0.671].
- **M2** (axe-core 4.12.1, Deque, zero shared code): mean S 0.941 vs P 1.412 violations/page,
  bootstrap CI [-0.882, -0.059], d_z -0.538, **7 of 17 pairs tied at zero**.
- **P vs C** (the pure prompt-length effect): 8/9, p = 1.000. Stated carefully after Codex's final
  review pushed back on my first wording: **no length effect was DETECTED at this n**, which rules
  out a large one only. So S-vs-P is not explained by any *detected* length effect - not that length
  has been eliminated as a mechanism.
- **M1b** rendered-screenshot judge (secondary): **1 win / 16 loss**, p = 0.0003, AGAINST sidecoach.
  An EXPLORATORY full-page re-judgement (added after seeing that, to test whether my first-viewport
  framing caused it) came back **0 win / 17 loss** - so the framing was not the explanation. Both
  passes agree on 16/17 and show no side-position bias. It is a robustness probe, not a replication.
  **Codex's final review named the artefact I had NOT ruled out: style-template detectability.** The
  payload prescribes a recognisable look (oversized display headings, generous spacing, balanced
  wrap, press animations, tabular numerals) and a same-family judge may be punishing a recognisable
  sidecoach-shaped page rather than expressing human preference. This trial cannot separate those.
  Repeat-judging reliability, measured by accident (a judge that looked stalled was relaunched and
  had not stalled): over 16 judgements of 6 pairs, **5 of 6 unanimous, 1 flipped**. Stable, not
  deterministic - read a 17-of-17 with that much slack in it.
- **M3** own exam (`sidecoach-detect`): mean S 11.88 vs P 19.24, p = 0.027 - pre-registered as WEAK
  and BARRED from the headline. Honoured.

**Why the axe CI and the axe p-value disagree, and why I did not take the flattering one:** the
bootstrap CI on the MEAN excludes zero while the pre-registered Wilcoxon RANK test gives 0.072.
They answer different estimands and the mean reduction may be substantively real - Codex pushed
back on my first wording, which called the CI "weaker", and it was right to. But the registered
test is the Wilcoxon, and reporting the CI as the result would be precisely the post-hoc
measure-swap the pre-registration exists to forbid. Both stand; the verdict follows the registered
one. The honest phrasing is **"suggestive of a small mean reduction; the pre-registered test did
not reject."**

## The finding that actually matters: circularity, measured rather than worried about

M3's per-rule breakdown makes the own-exam problem concrete:

| sidecoach-detect rule | C | P | **S** |
|---|---|---|---|
| `polish.text-wrap-balance` | 17 | 17 | **0** |
| `polish.scale-on-press` | 17 | 16 | **0** |
| `polish.icon-swap-compound` | 17 | 15 | **0** |
| `polish.subtle-exit` | 10 | 11 | **0** |
| `polish.font-smoothing` | 2 | 7 | **0** |
| `polish.tabular-nums` | 3 | 5 | **0** |
| `anti-pattern.modal-as-first-thought` | 1 | 1 | **4 (worse)** |

Six classes go to **exactly zero on all 17 sidecoach pages**. Those six are verbatim tactical-polish
checklist items the guidance payload enumerates, and the scanner checks precisely those strings.

But not all of it is teaching to the test. axe **independently** corroborates two structural wins:

| axe rule | C | P | S |
|---|---|---|---|
| `region` (content outside a landmark) | 5 | 3 | **0** |
| `heading-order` | 3 | 3 | **0** |
| `color-contrast` | 15 | 13 | 14 |

Contrast, the biggest category, is unchanged. The real, externally-visible effect is landmark and
heading structure.

## What the trial CANNOT say

n = 17 detects only a large effect: the sign test needs 13 of 17 and reaches 80% power only at a
true win rate of **0.813**. At a plausible 0.65 it has **23.5%** power. So "no large effect
detected" is the claim; "sidecoach does not help" is not. Codex's framing is adopted: **this is a
pilot, not a decisive efficacy trial.** The placebo also contains no design content at all, so S vs
P is a low bar - the informative comparison is against equally long *good generic design advice*,
which nobody has run.

## The incident that nearly produced an untrustworthy number

The runtime caps concurrent subagents at 20. Spawns beyond the cap were rejected, so missing cells
were relaunched - and some earlier spawns for those same cells were still alive and completed
later, **rewriting four arm-S pages AFTER they had been measured and judged.**

Caught by hash comparison, not by any statistic: `collect.mjs` records a sha256 per page and three
(later four) no longer matched. Nothing in axe, the scanner, or the judge would have flagged it -
each would have reported a perfectly normal number for an artefact that no longer existed.

Repair: confirmed quiescence, re-froze the collection, re-ran both measurements over the whole set,
moved the four affected verdicts to `verdicts.stale.jsonl` (never deleted) and re-judged them on
their SAME seeded sides. Durable fix: `collect.mjs --verify` re-checks every hash and exits 6 with
the list; its first run reproduced the mismatches.

**Lesson, and it generalises past this repo: when a launcher retries on a rejection, the rejection
must be distinguished from a completion, or the retry is a second writer.** A concurrency cap
turned a retry into a race.

## Self-analysis

Three of my own errors, each caught by a control rather than by care:

1. **My integrity suite contained a vacuous mutation control.** `mutation('population filter
   rejects a calib brief')` asserted the TRUE claim, so it never tripped and the harness correctly
   reported VACUOUS. This is the same trap `session_2026-07-28_taste-precision.md` recorded, and I
   walked into it anyway - which is the argument for the harness flagging vacuity as a failure
   (exit 3) rather than trusting the author.
2. **A check that compared arm-specific output paths** flagged a false integrity violation, because
   each arm legitimately writes to its own directory. I nearly "fixed" the arms instead of the check.
3. **The placebo was 10% too long, then 28% too long in the units that matter.** The first tiler
   converged onto the +10% ceiling; the second matched whitespace-words exactly (4164 vs 4164) while
   leaving 32457 vs 25374 CHARACTERS - a 28% gap in the units a tokeniser charges for, inside the
   very arm that exists to remove a length confound. Both were caught and fixed before any page was
   generated, but only because I printed the ratio rather than assuming it.

The deeper one: **I built the thing that decides whether the thing I am evaluating looks good.**
Codex's round-1 review named the hidden channels I had convinced myself did not exist - I had
written "the delta between arms is produced by the product, not by me" and it was false, because I
chose the PRODUCT.md transform, the payload field, the wrapper, the judge, and the measures. The
pre-registration now states each authored choice and its bias direction rather than claiming
neutrality. The generalisable rule: **"I did not author the treatment" is not the same as "I did
not determine the result", and a design review from a different model is how you find out which
one you actually achieved.**

## Product defects found (reported, NOT fixed - fixing them would be editing product code to move a result)

Full detail in `sidecoach/efficacy-trial/DEFECTS-FOUND.md`:

- **D1 `## Product Purpose` in PRODUCT.md is never parsed.** The guidance payload prints
  `Purpose: Not specified` for every project including **sidecoach's own PRODUCT.md**.
  `parseMarkdownFrontmatter` has handlers for Register / Primary Users / Brand Personality /
  Anti-References / Strategic Principles and none for purpose.
- **D2 `## Users` is silently ignored** (only `## Primary Users` is read) - no warning. With
  sidecoach's own PRODUCT.md the same line renders `Users: [object Object],[object Object]`.
- **D3 `sidecoach-monitor --json` truncates through a pipe** - 8178 of 188893 bytes measured. Same
  Chrome-grandchild hazard `eval/oracle-comparator.mjs` documents, on a second surface with no guard.
  A lenient consumer would silently receive a shortened guidance payload.
- **D4** `/sidecoach craft <feature>` routed to `flowA_brand_verify` on all 17 briefs, never a
  build flow, with a valid PRODUCT.md present.
- **D5** the guidance contains a warning-sign emoji, which this repo's own content-guard hook blocks
  on write - observed forcing producer retries.

## Codex's final review of the RESULT (5 findings, all folded)

Run after the numbers existed, asking it to attack the reporting rather than the design:

1. Calling the axe bootstrap CI "weaker" than the Wilcoxon was glib - it answers a different
   estimand and a mean reduction may be substantively real. Reworded to "suggestive of a small mean
   reduction; the pre-registered test did not reject."
2. **The artefact I had not ruled out: style-template detectability.** Folded as the headline caveat
   on the rendered-screenshot result.
3. "Prompt-length confound small as an effect" and "therefore not a length artefact" both
   overstated at n=17. Reworded to "no length effect DETECTED" / "not explained by any detected
   length effect".
4. The full-page pass was being used rhetorically as a replication. Relabelled a robustness probe.
5. On the wrapper-less page I kept: it asked whether I knew the arm at the time. **I did** - it was
   the placebo's - so the retention is a subjective call touching the primary comparison even with
   zero outcomes in view. Now stated, with what dropping it would have cost (n 17 -> 16) and how
   that pair actually fell.

Its verdict on the substance: "the confirmatory verdict is sound."

## Files touched

- `sidecoach/efficacy-trial/` (new, self-contained): `PREREGISTRATION.md` (frozen, v3),
  `codex-review-v1.md`, `codex-review-v2.md`, `RESULTS.md`, `README.md`, `DEFECTS-FOUND.md`,
  `INCIDENT-late-overwrite.md`, `judge-visual-prompt.md`
- runner: `power.mjs`, `build-arms.mjs`, `collect.mjs`, `measure-axe.mjs`, `measure-sidecoach.mjs`,
  `judge-prompt.mjs`, `judge-run.mjs`, `shoot.mjs`, `analyze.mjs`, `analyze-visual.mjs`,
  `repair-stale-verdicts.mjs`, `verify-integrity.mjs`, `lib/{briefs,product-md,placebo,stats}.mjs`,
  `package.json` (pins axe-core 4.12.1)
- data: `arms/` (51 prompts + manifest), `pages/{C,P,S}/` (51 pages), `judge/` (assignment,
  verdicts, stale verdicts, screenshots), `measurements/`, `results/`
- **No product code was modified.** No commit made.
