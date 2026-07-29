# RESULTS - does sidecoach improve the output, or only run?

Trial run against commit `8ae761a4`. Collaborator: Jonah. Design frozen in
[PREREGISTRATION.md](./PREREGISTRATION.md) and reviewed twice by Codex before any data existed.

## The answer

> **No detectable improvement on this task at this n.** Neither pre-registered confirmatory
> measure survived Holm correction. The point estimate on the independent preference judgement runs
> slightly AGAINST sidecoach.

And the more interesting version, which the three measures only say together:

> **Sidecoach's payload reliably improves what sidecoach measures, and does not improve - and on
> rendered appearance measurably worsens - what an independent judge sees.**

realised n = **17 briefs x 3 arms = 51 pages**. Every number below is re-derivable from the
committed inputs; every tool is fail-closed.

## Confirmatory (Holm over the fixed family {M1, M2}, family-wise alpha 0.05)

| measure | statistic | p | Holm threshold | result |
|---|---|---|---|---|
| **M2** axe-core violations, S - P | Wilcoxon exact, mean diff **-0.471** | **0.072** | 0.025 | no rejection |
| **M1** blind preference, S vs P | exact binomial, **7 win / 10 loss / 0 tie** | **0.629** | 0.050 | no rejection |

**M1 - independent judge (Codex / GPT-5.4), blind, source-level, forced choice.**
Sidecoach win rate **0.412** on 17 decided comparisons, exact 95% CI **[0.184, 0.671]**, p = 0.629.
The placebo won 10 of 17. Not significant in either direction; the point estimate favours the
placebo.

**M2 - axe-core 4.12.1 (Deque), rendered, independent of sidecoach.**
mean S **0.941** vs mean P **1.412** violations per page; mean paired difference **-0.471**
(bootstrap 95% CI **[-0.882, -0.059]**), d_z = **-0.538**, exact Wilcoxon **p = 0.072**, with
**7 of 17 pairs tied at zero difference**.

**M2 is suggestive of a small mean reduction in axe violations, but the pre-registered Wilcoxon
test did not reject** - 0.072 uncorrected, 0.145 after Holm.

The bootstrap CI on the mean excludes zero. That is not a "weaker" claim, it is a claim about a
*different estimand*: mean violations per page rather than a rank comparison, and a mean reduction
may well be substantively meaningful. Calling it weaker would be glib (Codex's word, and it is
right). What it is NOT is the pre-registered test, and **reporting it as the result would be
exactly the post-hoc measure-swap the pre-registration forbids.** Both numbers stand; the
confirmatory verdict follows the registered one.

Where the axe difference actually comes from - two rules, both structural:

| axe rule | pages flagged C | P | S |
|---|---|---|---|
| `region` (content outside a landmark) | 5 | 3 | **0** |
| `heading-order` | 3 | 3 | **0** |
| `color-contrast` | 15 | 13 | 14 |

Contrast, the largest category, is **unchanged**. The improvement is landmark and heading
structure, which the sidecoach payload names explicitly.

## Secondary: the prompt-length effect (P vs C)

**8 win / 9 loss, win rate 0.471, p = 1.000.** axe: mean paired difference P - C = **-0.235**,
CI [-0.706, 0.294], p = 0.489.

This is the arm Codex's review forced into the design. Stated carefully: **no length effect was
DETECTED at this n**, which rules out only a large one - it does not show the length effect is
small. So the correct reading is that the S-vs-P result is **not explained by any detected length
effect in this run**, not that length has been eliminated as a mechanism.

## Secondary: M1b, blind preference on RENDERED SCREENSHOTS

**1 win / 16 loss for sidecoach.** Win rate **0.059**, exact 95% CI **[0.001, 0.287]**,
p = **0.0003**.

This is the single largest effect in the trial and it runs **against** sidecoach. Before reporting
it I checked the obvious artefact: the judge chose side A in 10 of 17 comparisons while sidecoach
was side A in 8, so this is **not** a side-position bias - the judges picked the placebo page
whichever side it was on.

It is declared SECONDARY (pre-registered) for two reasons that still hold: the judge is the same
model family as the producer, and comparisons were batched. Two further limitations - one mine, one
Codex's - are in the exploratory section below, and the second is the important one.

**Unplanned repeat-judging check (the one piece of reliability data in the trial).** Six full-page
pairs got judged more than once, because a judge appeared to stall and was relaunched - it had not
stalled, so the same pairs came back from two and in one case three independent contexts.

**5 of 6 repeat-judged pairs were unanimous across contexts; 1 was not** (16 judgements over those 6 pairs).
`app-ui-corporate-dense-it-operations` came back placebo, placebo, **sidecoach** from three
contexts. So the judge is stable but not deterministic, and a near-unanimous 17-of-17 should be
read with roughly that much slack in it.

The committed tally uses the **first complete set** of verdicts. Swapping in a later repeat after
seeing it would be cherry-picking, so the repeats live in `judge/visual-verdicts-fullpage.repeat.txt`
as reliability data and are excluded from every tally.

## Secondary: M3, the engine's own exam - and the clearest finding in the trial

`sidecoach-detect` findings per page: mean **S 11.88** vs **P 19.24**, mean paired difference
**-7.35** (CI [-12.06, -2.24]), Wilcoxon **p = 0.027**.

**Pre-registered reading: a positive M3 is WEAK evidence and is BARRED from the headline.** It is
honoured here. What makes M3 worth reading is not its p-value but its per-rule breakdown, which
shows the circularity concretely rather than as a worry:

| sidecoach-detect rule | C | P | **S** |
|---|---|---|---|
| `polish.text-wrap-balance` | 17 | 17 | **0** |
| `polish.scale-on-press` | 17 | 16 | **0** |
| `polish.icon-swap-compound` | 17 | 15 | **0** |
| `polish.subtle-exit` | 10 | 11 | **0** |
| `polish.font-smoothing` | 2 | 7 | **0** |
| `polish.tabular-nums` | 3 | 5 | **0** |
| `a11y.skipped-heading` | 3 | 3 | **0** |
| `a11y.gray-on-color` | 4 | 3 | **0** |
| `anti-pattern.modal-as-first-thought` | 1 | 1 | **4 (worse)** |

Six rule classes drop to **exactly zero on all 17 sidecoach pages**. Those six are verbatim items
from the tactical-polish checklist that the guidance payload enumerates - `text-wrap: balance`,
`scale(0.96)` on press, icon swaps, subtle exits, font smoothing, tabular numerals. The scanner
checks precisely those strings. This is teaching to the test, measured.

Two are not: `skipped-heading` and `gray-on-color` are real accessibility defects, and axe
independently corroborates the heading result.

## What this trial supports, and what it does not

**Supported:**

- On this corpus, this producer tier, this judge and this injection, sidecoach's payload produced
  **no large improvement** over a length-matched irrelevant payload, and no improvement at all on
  the independent preference measure.
- The **prompt-length confound produced no DETECTED effect** here (P vs C, p = 1.000) - which
  rules out a large one only.
- Sidecoach's payload **does** reliably drive its own checklist items to zero, and **does** improve
  landmark and heading structure by an independent tool's reckoning.
- On rendered appearance, **secondary and exploratory same-model-family** judges preferred the
  placebo pages 16 of 17 (first viewport) and 17 of 17 (full page), agreeing with each other on 16
  of 17 artefacts.

**Not supported:**

- "Sidecoach does not help." n = 17 detects only a large effect: the sign test needs 13 of 17, and
  80% power arrives only at a true win rate of 0.813. At a true win rate of 0.65 this trial has
  **23.5%** power. A real, moderate improvement would be invisible here. M2 and M3 both point
  toward *some* improvement; neither is the registered confirmatory rejection.
- "Sidecoach makes pages worse." M1b and its full-page replication are secondary/exploratory and
  same-model-family. They are consistent (16/17 agreement) and not framing artefacts, which makes
  them worth acting on as a hypothesis - but a same-family judge is not a person.
- Any claim about a top-tier producer, about multi-turn use, or about sidecoach's audit/critique/
  polish verbs. This trial exercised the `craft` payload injected once into a single-shot build.

## EXPLORATORY (added after seeing the M1b result - labelled per the pre-registration)

The 1280x1600 screenshots are the **first viewport only**, not the whole page. That was my choice,
and it interacts badly with the judge's first rubric item (content delivery): a generously spaced
page shows less of the brief's content in a fixed window. Looking at one pair myself confirmed the
shape - the sidecoach medical-intake page uses a large serif display heading and wide spacing; the
placebo page fits three more form sections into the same window.

So M1b's 16-of-17 may be partly measuring my framing. A full-page re-judgement was run to check.
It is EXPLORATORY: the variant was chosen after seeing the result. It is reported because it
interrogates a finding that runs **against** sidecoach, not to rescue one that flatters it.

**Full-page result: 0 wins / 17 losses for sidecoach.** Win rate **0.000**, exact 95% CI
**[0.000, 0.195]**, p < 0.0001.

This is a **robustness probe, not a replication** - it re-judges the same 17 artefacts with the
framing changed, so it cannot independently confirm anything. What it establishes is narrow and
useful: the viewport framing was not the explanation. The two passes agree on **16 of 17** pairs,
and the full-page judges chose side A in 9 of 17 while sidecoach was side A in 8, so again no
side-position bias.

**The artefact NOT ruled out (Codex, final review): style-template detectability.** The sidecoach
payload prescribes a recognisable set of moves - oversized display headings, generous editorial
spacing, balanced text wrap, press animations, tabular numerals. A same-model-family judge may be
reacting against a recognisable *sidecoach-shaped* look rather than expressing anything a human
would. That is a plausible mechanism for a near-unanimous result and this trial cannot separate it
from genuine preference. Distinguishing them needs a judge outside the family, or a human.

So: the most uncomfortable number here is secondary/exploratory, same-family, and has a live
alternative explanation. It does not license "sidecoach makes pages worse". It does say the measure
closest to *what a person would look at* points the opposite way from the engine's own scanner, on
the same 17 artefacts - which is a hypothesis worth the cost of testing properly.

## Integrity record

- **Blinding:** 0 of 51 pages named sidecoach, the placebo, or the trial. Arm labels never reached
  either judge; A/B sides came from a seed committed before any judging.
- **Arm integrity:** `build-arms.mjs` byte-compares the wrapper and brief blocks across all three
  arms and exits 4 on any difference. Mutation-tested: injecting a difference produces exit 4.
- **Length match:** placebo and sidecoach payloads are identical in line count and within 0.01% on
  characters (mean prompt size P 32406 vs S 32409 chars). A first version matched *words* exactly
  while leaving a 28% character gap, and was fixed before any page was generated.
- **Artefact freeze:** `collect.mjs --verify` confirms all 51 pages are byte-identical to the
  frozen collection. It exists because a real incident required it - see
  [INCIDENT-late-overwrite.md](./INCIDENT-late-overwrite.md): duplicate producers rewrote four
  arm-S pages after their first measurement, all measurements were re-run and the four affected
  verdicts were re-judged on their same seeded sides.
- **Integrity suite:** `verify-integrity.mjs`, 13 checks, 0 failed, 0 vacuous. Every assertion is
  paired with a mutation control that must fail; two of my own checks were caught as wrong by it
  (one vacuous mutation control, one check that compared arm-specific output paths).
- **Statistics:** verified against published reference values (Clopper-Pearson(15,20) =
  [0.5090, 0.9134]; sign test 15/20 p = 0.041389; Wilcoxon n=6 all-positive p = 0.03125).

## Recorded anomalies

- One page omits the `<html>`/`<!doctype>` wrapper. It renders normally and neither pre-registered
  drop criterion ("fails to generate", "fails self-containment") covers it, so it was kept. Stated
  fully, because Codex asked and it matters: the call was made when it first appeared, with **zero**
  outcome measurements taken, but **I did know it was the PLACEBO arm's page**. Knowing the arm
  makes it a subjective retention call that touches the primary S-vs-P comparison, even with no
  outcome in view. Dropping the triple would have moved n from 17 to 16; the pair it contributes
  went to sidecoach on M1 and to the placebo on both visual passes.
- The three `real-govuk-*` briefs were excluded pre-data (AMENDMENT 1) because they do not conform
  to the corpus template and `_spec.md` itself says to avoid design-system pattern pages.
- The machine's `content-guard` hook blocks emoji and emdashes on write, so some producers were
  forced to rewrite. Surviving counts differ by arm (emoji/emdash: C 2/1, P 1/0, S 2/4). The
  sidecoach payload itself contains an emoji, so this intervention is potentially arm-correlated
  and is recorded rather than assumed harmless.
- The arm letter appears in each producer's output path (`pages/S/...`). It carries no meaning
  without the key, but it is a residual asymmetry I would remove by using opaque directory names.

## What would strengthen this

1. **n.** The binding constraint. n = 17 detects only a win rate above 0.81. Detecting a plausible
   0.65 needs ~90 pairs; at 3 arms that is ~270 generations.
2. **A real design-advice comparator.** The placebo contains no design content, so S vs P is a low
   bar. The informative comparison is sidecoach against an equally long block of *good generic
   design advice* - that is the question a user actually faces.
3. **More than one judge, and a human.** One model's rubric is a proxy. M1 (source) and M1b
   (rendered) disagreed sharply on the same artefacts, which is itself evidence that a single judge
   is not enough.
4. **Multi-turn use.** Sidecoach's documented workflow is craft, then audit, then critique, then
   polish. This trial measures a single injection of the craft payload. The gate may be where the
   value is, and it is untested.
5. **Full-page rendering as the default**, not the first viewport, with the judging rubric stated in
   a way that does not implicitly reward density.
