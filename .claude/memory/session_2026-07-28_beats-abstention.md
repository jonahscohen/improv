---
name: beats search abstention - a calibrated no-match, and the honest finding that it catches the easy negatives and misses the hard ones
description: Closes the gap the efficacy study found. T=0.5288 max-cosine, derived by a pre-registered rule from the committed 32-question set, with a held-out 48-question set labelled by 4 independent agents. Cost 6.0% false abstention, benefit 55.6% correct abstention (n=50/9); under a reviewer's disputed-label reading 11.3%/33.3%. The real finding is that the two negative populations do not overlap - vague/live-state queries are caught 5/5, in-domain-sounding unanswered ones 0/4. Eval set now COMMITTED so the number can be re-derived. Two Codex rounds, 8 findings, all folded; one found a real cross-space hole and one a latent retrieval regression I introduced.
type: project
relates_to: [session_2026-07-28_beats-search-efficacy.md, session_2026-07-02_beats-stage3b-hybrid-embeddings.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: 153-check baseline suite green (59/65/29), 3 mutation controls on the implementation + 2 on the new guards, 9 fail-loud exit paths exercised with real mutations, held-out validation on an independently-labelled set, 2 Codex review rounds (8 findings, all folded)
confidence: high
---

Collaborator: Jonah. The efficacy study ended by naming its own biggest gap: on a question
where the labeller had proved no beat answers it, search returned five confidently scored
results with no signal that nothing matched. This closes that, and the closing is less
flattering than "we shipped abstention" would suggest.

## What shipped

`beats.py search` now prints an explicit **NO MATCH** instead of its five least-unrelated
beats when the best cosine anywhere in the corpus falls below **T = 0.5288**. Exit stays 0
(abstaining is an outcome, not a failure) and `--json` stays an array (`[]`), so the
benchmark scorer and every existing consumer are untouched.

## The number is derived, not chosen

`beats/_eval/` is now committed: the 32-question calibration set verbatim from the prior
study, a 48-question held-out set, the miner that rebuilt the interrogative pool, and
`calibrate.py`, which re-derives T from those files. The threshold can be argued with
instead of trusted.

The rule was **pre-registered before the held-out labels existed on disk**
(`PREREGISTRATION.md`, written 18:14Z while the labelling agents were still running):
T = the highest threshold whose false-abstention rate stays at or below 5%, placed at the
midpoint of the bracketing order statistics. The 5% budget is derived, not tasted: it caps
recall damage at ~3.8 points, inside the published recall@5 CI of [0.571, 0.893].

**Why:** the person setting an abstention threshold is choosing the number that decides
whether their own feature looks good. The prior study's self-analysis was about exactly
this failure mode. Writing the rule down first is the only mechanism that actually
constrains it.

**How:** signal is `top_cos`, max cosine over the corpus. The RRF score search already
prints is rank-based - its ceiling is `2/(RRF_K+1)` for anything ranked first in both
lists, and a nonsense query measured 0.0259 against a real question's 0.0325. A cutoff on
the printed score could never have worked.

## Both error rates

| set | answerable | unanswerable | false abstention (cost) | correct abstention (benefit) |
|---|---|---|---|---|
| calibration (T fitted here) | 28 | 4 | 1/28 = 3.6% | 0/4 = 0% |
| held-out (T never saw it) | 22 | 5 | 2/22 = 9.1% | 4 solid + 1 knife-edge of 5 |
| pooled | 50 | 9 | 3/50 = 6.0% | 5/9 = 55.6% |
| pooled leave-one-out CV | 50 | 9 | 6.0% | 44.4% |
| **pooled, reviewer's label reading** | 53 | 6 | **11.3%** | **33.3%** |

Bootstrap 95% CI on the pooled benefit: [22%, 89%]. Nine negatives is not many.

## The finding that matters more than the threshold

**The two negative populations do not overlap, and which one you draw from decides
everything.**

| negatives | n | cosines | caught |
|---|---|---|---|
| calibration set (hand-picked as "plausibly answerable") | 4 | 0.537-0.648 | **0/4** |
| held-out set (random draw) | 5 | 0.459-0.528 | **5/5** |

Every calibration negative sits above every held-out negative. That is the prior study's
selection bias made visible: it chose its 32 questions *because they looked answerable*, so
its unanswerable four are the hardest kind - questions in the corpus's own vocabulary that
it simply never answered. The random draw's negatives are the ordinary kind: vague,
deictic, live-state.

So the supportable claim is **not** "abstention works." It is: **abstention catches
off-corpus, vague, and live-state queries, and fails the in-domain-sounding unanswered
ones** - which are the more dangerous case, because they are what a caller would most
confidently trust. Measured out-of-domain floor: cooking 0.328, sports 0.332, finance
0.376, medicine 0.400 all abstain correctly.

## Codex - two rounds, eight findings, all folded, two of them material

Round 1 graded the **calibration**, not the code, on the explicit instruction that the
author picked the number that flatters him. Two High findings changed the report:

1. Three held-out `NONE` labels (`where did we leave off?`, `what's our status?`, `what
   work was performed across all my projects last week?`) are arguably answerable by
   recency/aggregation. Rather than argue, both readings are now recorded in
   `contested_labels.json` and `calibrate.py` prints both - which is where the 11.3% /
   33.3% row comes from. The benefit roughly halves under the reviewer's reading.
2. The population split makes the 100% held-out figure unrepresentative. That became the
   headline finding above instead of a footnote.

Also folded: the calibration AUC relabelled in-sample (`top_cos` was picked as best-of-five
on that same set, so the pre-registration constrains held-out peeking but not signal
choice); "5/5" restated as "4 solid + 1 knife-edge" because `s06` clears by **0.0007**;
"RRF cannot express confidence at all" weakened to what the data supports (its AUC is
0.679, above chance, just badly compressed).

Round 2 reviewed the **implementation** and found a real hole plus integrity gaps:

3. **Cross-space cosine.** The gate checked the *stored* model and dim, but a db compiled
   with the calibrated model and *searched* with a different model of the same width would
   produce a numerically fine, semantically meaningless cosine, and abstention would fire
   on it. The dimension check cannot see that. Both ends now must be the calibrated model.
4. `calibrate.py` could report a confident threshold from a stale, partial, or wrong-model
   index. It now hard-stops on all of those, plus corpus staleness.
5. Malformed eval files escaped the exit-code contract as tracebacks; `check_shape()` and a
   `UnicodeDecodeError` catch now land them on 5 and 2.
6. `nan`/`inf` overrides were accepted silently (`nan` disables by accident, `inf` abstains
   on everything). Rejected loudly now.
7. A test named a single filename where a structural check was needed.
8. Round 2's re-review caught that my own cross-space test was blocked by the dim gate
   before it ever reached the model gate - it proved nothing. Replaced with a direct probe
   of `resolve_abstain_threshold` at the calibrated width, which fails when the guard is
   removed.

## The regression I introduced and nearly shipped

Reading `embed_model` from `meta`, I folded it into the existing
`SELECT vectors_present, embed_dim` - so a db carrying perfectly good vectors but lacking
the `embed_model` column would have had its **entire vector half disabled** by one missing
column. Abstention metadata taking down retrieval is exactly backwards. Caught by reviewing
my own diff before the second Codex round, proven real with a mutation
(`PRE-FIX: degraded to lexical-only`), fixed by decoupling the reads, and pinned by
`caseA8`.

**Why it happened:** I reached for the cheapest edit - one more column on a SELECT already
in front of me - without asking what that SELECT's failure mode was. The existing
`except sqlite3.OperationalError` was load-bearing for a completely different purpose
(stage-3a schema tolerance), and I widened what could trip it. The lesson is narrow and
useful: **when adding a field to an existing query, check what the query's error handler
already means.** A shared try block is a shared fate.

## Self-analysis

The pre-registration did real work, and not in the direction I expected. The rule I fixed
in advance produced T = 0.5288, which catches **0 of 4** negatives on the calibration set -
while T = 0.5391, one order statistic higher, catches 1 of 4. I could see both numbers when
I ran it. Holding the pre-registered midpoint placement cost me the only positive result
available on that set, and I only found out the threshold was any good when the held-out
labels arrived hours later. That gap is the entire value of writing the rule first: for
several hours the honest report was "my feature catches nothing," and there was no version
of the rule I could reach for without visibly changing it after the fact.

The failure mode I did not avoid: I still built the thing that decides whether my feature
looks good. Codex's first round found that three of my five held-out wins were arguable and
that my 100% figure came from systematically easier negatives - both of which I had the
data to notice and did not. I reported "5/5, AUC 0.964" to myself and moved on to
implementation. The tell was right there: a 0.0007 margin on `s06` should have made me
suspicious of the whole column, and instead I logged it as a caveat and kept the headline.
**A result that flatters the thing you built deserves the same interrogation as a result
that indicts it, and I only gave it the second-best version of that.**

## Baseline (Team Rule 9)

Recorded before touching anything: `test-beats-compile.sh` **59/0**,
`test-beats-search.sh` **47/0**, `test-beats-hooks.sh` **29/0**, `beats.py verify` exit 0.
At the end: **59/0**, **65/0** (+18 abstention cases), **29/0**, verify exit 0,
`calibrate.py --held-out` exit 0. Every new assertion mutation-controlled; three mutations
of `beats.py` (disable abstention, drop the model gate, drop the lexical-only scope) each
produced exactly the expected failures and no others.

Not committed, per instruction.

## Files touched

- `beats/beats.py` - abstention constants, `resolve_abstain_threshold()`, the NO MATCH
  short-circuit, `embed_model` read decoupled from the vectors read, docstring contract.
- `beats/_tests/test-beats-search.sh` - 18 new checks (caseA1-A11).
- `beats/_eval/` (new) - `PREREGISTRATION.md`, `RESULTS.md`, `calibrate.py`,
  `questions.json`, `labels.json`, `heldout_questions.json`, `heldout_labels.json`,
  `heldout_labels_full.json`, `heldout_sample_raw.json`, `contested_labels.json`,
  `pool.json`, `mine_pool.py`.
- This beat + MEMORY.md index line.
