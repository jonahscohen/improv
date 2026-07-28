# Abstention calibration - results

Commit stamp: `363458ea`. Reproduce with `python3 beats/_eval/calibrate.py --held-out`.
Corpus at measurement: 1230 beats, 1024-dim `qwen3-embedding:0.6b` vectors, `verify` exit 0.

## The shipped number

**T = 0.5288** cosine, derived by the rule pre-registered in `PREREGISTRATION.md`
(highest T whose false-abstention rate on the calibration set stays at or below 5%,
placed at the midpoint of the bracketing order statistics `[0.5186, 0.5391]`).

Signal: `top_cos`, the maximum cosine between the query embedding and any beat vector.

## Both error rates

| set | n answerable | n unanswerable | false abstention (cost) | correct abstention (benefit) | AUC |
|---|---|---|---|---|---|
| calibration (T fitted here) | 28 | 4 | 1/28 = 3.6% | 0/4 = 0% | 0.777 (in-sample) |
| held-out (T never saw it) | 22 | 5 | 2/22 = 9.1% | 4 solid + 1 knife-edge of 5 | 0.964 |
| pooled | 50 | 9 | 3/50 = 6.0% | 5/9 = 55.6% | 0.860 |
| pooled leave-one-out CV | 50 | 9 | 6.0% | 44.4% | - |
| **pooled, reviewer's label reading** | **53** | **6** | **6/53 = 11.3%** | **2/6 = 33.3%** | **0.767** |

Bootstrap 95% CI on the pooled rates (10k resamples): false abstention **[0%, 14%]**,
correct abstention **[22%, 89%]**. Nine negatives is not many and the CI says so. That
bootstrap resamples a visibly mixed population as if it were iid and does not propagate
threshold- or signal-selection uncertainty, so treat it as descriptive spread, not as
support for the held-out figure.

**The last row is the number to quote if you only quote one.** An independent reviewer
disputed three `NONE` labels (`s03` "where did we leave off?", `s06` "I'm getting
frustrated. What's our status?", `s24` "what work was performed across all my projects
last week?") on the grounds that a corpus of session notes *can* answer a status question
given recency sorting and aggregation - the retrieval layer just does not do that. That is
a definitional call, not a factual error, so both readings are recorded
(`contested_labels.json`) and `calibrate.py --held-out` prints both. Under the reviewer's
reading the benefit falls to 33% and the cost roughly doubles to 11.3%, because those
three cases move from "correctly abstained" to "wrongly abstained".

The calibration AUC of 0.777 is **in-sample and optimistic**: `top_cos` was chosen as the
best of five candidate signals measured on that same set. The held-out AUC of 0.964 rests
on five negatives. Neither number should be read as a clean estimate of the signal's
quality.

## The finding that matters more than the headline

**The two negative populations do not overlap, and which one you draw from decides
everything.**

| negative population | n | cosines | caught at T |
|---|---|---|---|
| calibration set - hand-picked from questions pre-judged "plausibly beats-answerable" | 4 | 0.537, 0.598, 0.623, 0.648 | **0/4** |
| held-out set - random draw from the interrogative pool | 5 | 0.459, 0.474, 0.505, 0.508, 0.528 | **5/5** |

Every calibration negative sits above every held-out negative. That is not noise, it is
the selection effect: the prior study chose its 32 questions *because they looked
answerable*, so its 4 unanswerable ones are the hardest possible kind - questions phrased
in the corpus's own technical vocabulary that the corpus simply never answered
(`why dont you ssh into it`, `Why did the justify worker's pane self close?`). The random
draw's negatives are the ordinary kind: vague, deictic, live-state, cross-project
(`where did we leave off?`, `what work was performed across all my projects last week?`).

So the honest statement of what this feature does, and the one to use instead of any
single percentage:

- It **reliably catches** queries that are off-corpus, vague, deictic, or about live
  state.
- It **does not catch** in-domain-sounding questions the corpus happens not to answer -
  **0 for 4** - and those are the more dangerous case, because they are exactly the
  queries a caller would most confidently trust.

"Abstention works" is not a supportable claim from this data. "Abstention catches the easy
off-corpus and live-state queries and fails the hard in-domain unanswered ones" is.

The pooled 55.6% is a mixture of these two regimes and means nothing without the mix.
**Do not quote it alone.** The held-out 5/5 is not representative of the risk a caller
actually carries, because the held-out negatives are systematically the easier kind.

## Where the result is thinner than it looks

- **s06 clears by 0.0007.** `I'm getting frustrated. What's our status?` scores 0.5281
  against T = 0.5288. Counting it as a win is within measurement noise; the held-out
  benefit is fairly read as "4 solid and 1 coin-flip", not a clean 5/5.
- **T is knife-edge by construction.** Sensitivity over the pooled set:

  | T | false abstention | correct abstention |
  |---|---|---|
  | 0.5100 | 2% | 44% |
  | 0.5200 | 6% | 44% |
  | **0.5288 (shipped)** | **6%** | **56%** |
  | 0.5400 | 10% | 67% |
  | 0.6000 | 26% | 78% |

  Buying the last two hard negatives costs 20 points of recall. The pre-registered budget
  is what stops that trade being made after seeing the answer.
- **Nine negatives.** The CI on the benefit spans 22% to 89%.
- **The pre-registration constrains the held-out test, not the signal choice.** `top_cos`
  was picked as the best of five candidates measured on the calibration labels, then
  written down. That is legitimate as train/test discipline - the held-out labels did not
  exist yet - but it is not a prospective fix of the signal, and the calibration-set
  numbers inherit that selection. Only the held-out and reviewer-reading rows are free of
  it.
- **The leave-one-out CV is not fully nested.** It re-derives T per fold but does not
  re-run signal selection among the five candidates, and it pools two different negative
  regimes. Read it as a sensitivity check, not an unbiased estimate.

## The out-of-domain floor, measured

`top_cos` has a high floor on this corpus, which is why T sits at 0.53 rather than
somewhere intuitive like 0.2:

| probe | top_cos | abstains |
|---|---|---|
| `how long should I braise short ribs at 300 degrees` | 0.328 | yes |
| `who won the 1986 world cup final` | 0.332 | yes |
| `what is the difference between a roth and traditional IRA` | 0.376 | yes |
| `when should I prune hydrangeas` | 0.378 | yes |
| `what are the contraindications for beta blockers in asthma` | 0.400 | yes |
| `purple mango trombone glacier seventeen` | 0.459 | yes |
| `zzqx flurble wombat quantum banana protocol` | 0.573 | **no** |
| `how does the incremental compile cache work` (real) | 0.569 | no |
| `what did we decide about tiny-text` (real) | 0.731 | no |

The word-salad case that survives contains real in-domain vocabulary (`quantum`,
`protocol`), so scoring it above a genuine question is defensible behaviour rather than a
bug - but it shows the signal keys on vocabulary overlap, which is precisely why the
in-domain-unanswered negatives escape.

## Why not a threshold on the score search already prints

The published `score` is Reciprocal Rank Fusion, which is computed from RANKS, not
similarities. Its ceiling is `2/(RRF_K+1) = 0.0328` for anything ranked first in both
lists. Measured: nonsense scores 0.0259 where a real question scores 0.0325 - the same
narrow band.

RRF is not a *null* confidence signal - its AUC of 0.679 is above chance - but it is badly
compressed next to raw cosine's 0.777, and the compression means small score differences
carry far less information than they appear to. Abstention therefore keys on a signal the
tool computes but does not currently surface, rather than on the number it prints.

## Method

- Calibration set: the 32 questions from `session_2026-07-28_beats-search-efficacy.md`,
  committed verbatim here as `questions.json` / `labels.json` so the threshold can be
  re-derived rather than trusted.
- Held-out set: 48 questions drawn by seeded random sample (`random.seed(20260728)`,
  `mine_pool.py`) from the same 155-interrogative pool, excluding the published 32.
  Labelled by four independent agents forbidden from running `beats.py search`, each label
  carrying a verbatim proof quote; 21 were excluded as MALFORMED (fragments, imperatives,
  unresolvable deixis) **by the labellers, not by me**, leaving 27 scored. Full labeller
  output including reasons and proof quotes is in `heldout_labels_full.json`.
- The pre-registration was written and timestamped before the held-out labels existed on
  disk. The signal, the rule, the budget, and the kill criterion were all fixed in advance
  of the held-out test, though the signal itself was selected on the calibration labels
  (see the limitation above).

## Independent review

Reviewed by Codex (`codex-cli 0.142.5`) with the calibration itself as the subject, not
the code: "the author chose the threshold that decides whether their own feature looks
good, grade exactly that." Five findings, all folded into this document:

1. *High* - the held-out abstention positives include status/recency questions that are
   arguably corpus-answerable, inflating the benefit. -> `contested_labels.json` plus the
   reviewer-reading row, and `calibrate.py` now reports both.
2. *High* - the population split makes the 100% held-out figure weak; the honest claim is
   "catches easy off-corpus, fails hard in-domain". -> rewritten as the headline finding.
3. *Medium* - the pre-registration constrains held-out peeking but not signal selection.
   -> stated as a limitation; calibration AUC relabelled in-sample.
4. *Medium* - reporting 5/5 is fragile when one case clears by 0.0007. -> reported as
   "4 solid + 1 knife-edge" throughout.
5. *Low* - "RRF cannot express confidence at all" is overstrong (AUC 0.679 is above
   chance); the bootstrap treats a mixed population as iid; the LOO is not fully nested.
   -> all three claims weakened to what the data supports, in this file and in the
   `beats.py` comment.

The verdict was that threshold *placement* is defensible but the evaluation *claim* was
overstated. This document is the corrected version; the original overstatement is
preserved in the review record rather than quietly edited away.
