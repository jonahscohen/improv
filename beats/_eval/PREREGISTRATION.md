# Abstention threshold - pre-registration

Commit stamp: `363458ea`. Written 2026-07-28T18:14:59Z by Jonah's session, BEFORE the
supplementary label set existed on disk (the four labelling agents were dispatched at
18:09Z and had not returned). Nothing below was chosen with knowledge of the held-out
labels. That is the whole point of writing it first.

## Why a pre-registration at all

The prior study (`session_2026-07-28_beats-search-efficacy.md`) caught itself building a
strawman baseline and only noticed when a different model graded the baseline's fairness.
The same failure mode applies harder here: **the person choosing an abstention threshold
is choosing the number that decides whether their own feature looks good.** Signal choice,
threshold placement, and the definition of "unanswerable" are all knobs, and all three can
be turned after seeing the answer.

So the knobs are set here, in advance, in writing.

## 1. The signal

Abstention keys on **`top_cos`**: the maximum cosine similarity between the query embedding
and any stored beat vector, over the whole corpus.

Selected on the published 32-question set by AUC (probability a random answerable question
outscores a random unanswerable one), measured before this document was written:

| signal | AUC |
|---|---|
| **top_cos** (max cosine over corpus) | **0.777** |
| top_fused_cos (cosine of the top-ranked result) | 0.732 |
| cos5_mean (mean cosine of the top 5) | 0.696 |
| rrf_top (the score beats already prints) | 0.679 |
| top_bm25 (best lexical score) | 0.643 |

`top_cos` is also the only principled candidate. **The RRF score that `search` currently
prints is rank-based, not similarity-based, so it cannot express confidence at all**: its
maximum is `2/(RRF_K+1) = 0.0328` for anything ranked first in both lists, no matter how
irrelevant. Measured: the query `zzqx flurble wombat quantum banana protocol` returns a
top score of 0.0259 against a real question's 0.0325 - the same narrow band. Any threshold
on the published score would be meaningless. This is the mechanical reason abstention needs
a new signal rather than a cutoff on the existing one.

`top_cos` is max-over-corpus rather than the cosine of whatever the fusion ranked first,
because the question abstention answers is "does the corpus contain anything semantically
close to this query", not "did the fusion order come out well".

## 2. The threshold rule

> **T = the highest threshold whose false-abstention rate on the published set's answerable
> questions is at or below 5%**, placed at the midpoint between the two adjacent positive
> order statistics that bracket it.

The 5% budget is not a taste call. Published recall@5 is 0.750 with a 95% CI of
[0.571, 0.893]. Abstaining on an answerable question converts a would-be hit into a
guaranteed miss, so a 5% false-abstention budget caps the recall damage at ~3.8 points
(0.750 -> ~0.712), which stays well inside the published CI and therefore cannot
measurably degrade the headline metric. The budget is derived from the prior measurement,
not picked to make the feature look good.

The midpoint placement exists because landing T exactly on a sample point is maximally
fitted to that sample.

**Asymmetry, stated deliberately:** a false abstention is worse than a false result. A
caller who gets a bad result can ignore it; a caller who gets an abstention cannot recover
the answer that was hidden. The budget is therefore set on the false-abstention side and
the correct-abstention rate is whatever falls out. A threshold tuned to maximise
"unanswerable questions caught" would be the fitted version of this feature.

## 3. Scope: hybrid mode only

Abstention applies **only when the vector half is live** (`mode == hybrid`). In
lexical-only / degraded mode there is no cosine to threshold, `beats.py` already prints
`VECTORS ABSENT`, and applying a cosine threshold there would be uncalibrated. Degraded
mode keeps its current behaviour exactly.

## 4. What is being held out

- **Calibration set:** the published 32 questions (28 answerable, 4 unanswerable), verbatim
  from the prior study, committed alongside this file as `questions.json` / `labels.json`.
  The signal choice and T above are derived from these and nothing else.
- **Held-out set:** 48 questions drawn by seeded random sample (`random.seed(20260728)`)
  from the same 155-interrogative pool, excluding the published 32, labelled by four
  independent agents forbidden from running `beats.py search`. **These labels do not exist
  on disk yet and cannot have informed anything above.**

The held-out set was sampled at random rather than hand-picked, so its answerable rate is
the natural base rate rather than one I selected. The prior study's stated selection bias
("I chose 32 plausibly beats-answerable questions... says nothing about how often beats
should answer not-found") is exactly what a random draw fixes.

## 5. What will be reported, regardless of outcome

Both error rates, on both sets, plus a leave-one-out cross-validated figure on the pooled
set:

- **false abstention rate** = abstained / answerable. The cost.
- **correct abstention rate** = abstained / unanswerable. The benefit.

A threshold that abstains on everything is perfect at the second and useless at the first,
which is why neither number means anything alone.

**Pre-declared kill criterion:** if the held-out correct-abstention rate is not meaningfully
above zero, the honest report is that this signal does not support abstention at this
corpus size, and that will be reported as the finding rather than the threshold being
re-tuned until it does.

## 6. Known weakness, stated in advance

The calibration set has **4 negatives**. Whether T catches 0, 1, or 2 of them is decided by
single data points sitting within 0.02 cosine of each other. T is therefore *placed* by the
rule above but its benefit is *not measurable* on the calibration set. The held-out set
exists because of this, and the held-out numbers are the ones that count.
