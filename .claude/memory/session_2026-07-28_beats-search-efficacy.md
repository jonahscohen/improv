---
name: beats search live efficacy - the hybrid is alive and best-in-class, but its edge over a FAIR grep is not statistically significant at n=28
description: 32 verbatim real questions mined from 407 transcripts, labelled by 4 agents forbidden from using the tool. beats-hybrid recall@1 0.464 / recall@5 0.750 / MRR 0.586 beats every baseline, but vs an IDF-weighted grep (0.429/0.571/0.483) the paired sign test is p=0.146, NOT significant. The defensible win is the VECTOR HALF on non-quoted questions (recall@5 0.700 vs 0.300 lexical-only, p=0.039). Codex review overturned my first numbers by exposing a strawman grep baseline. Cache proven correct; no abstention is the real gap.
type: project
relates_to: [session_2026-07-02_beats-stage3b-hybrid-embeddings.md, session_2026-07-27_route-intent-live-efficacy.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: 135-check baseline suite, 32-question real-prompt corpus, 28 hand-labelled scored cases, 5-way system comparison with bootstrap CIs and paired sign tests, vector ablation with engagement assertion, cache-correctness cosine proof, Codex methodology review (10 findings, all folded, numbers changed)
confidence: high
---

Collaborator: Jonah. The question was the one the route-intent beat taught us to ask:
not "is the suite green" but **does it work on real inputs**. Beats search survives that
test far better than the router did - but the honest margin is smaller than my first
pass claimed, and Codex is the reason I know that.

## Verdict

The hybrid is **alive, correct, and the best of the five systems measured**. It is not
the silently-dead upgrade the prior warned about. But the headline "it beats grep" is
weaker than it looks: against a *fair* lexical baseline the difference does not reach
significance at this sample size. What IS statistically defensible is that the **vector
half earns its keep** on the questions that matter.

| system | recall@1 | recall@5 | MRR | recall@5 95% CI |
|---|---|---|---|---|
| **beats-hybrid** | **0.464** | **0.750** | **0.586** | [0.571, 0.893] |
| grep-idf (fair lexical baseline) | 0.429 | 0.571 | 0.483 | [0.393, 0.750] |
| beats lexical-only (vectors ablated) | 0.464 | 0.464 | 0.464 | [0.286, 0.643] |
| grep-terms | 0.321 | 0.500 | 0.396 | [0.321, 0.679] |
| grep-phrase (naive `grep -ril`) | 0.143 | 0.393 | 0.217 | [0.214, 0.571] |

n = 28 answerable cases of 32 questions. Paired sign tests on reciprocal rank:

| comparison | wins | losses | p | verdict |
|---|---|---|---|---|
| hybrid vs grep-phrase | 16 | 1 | 0.0003 | significant |
| hybrid vs grep-terms | 12 | 3 | 0.0352 | significant |
| hybrid vs grep-idf | 9 | 3 | 0.1460 | **NOT significant** |
| hybrid vs lexical-only | 8 | 2 | 0.1094 | **NOT significant** |

**Answer to "does the hybrid beat plain grep":** it beats naive grep decisively and a
term-counting grep significantly. Against a competently-weighted grep it wins on every
metric and every subset, but at n=28 that could be luck. Saying otherwise would be
overclaiming.

## The split that carries the real finding

The corpus RECORDS Jonah's questions inside beats, so some questions are near-verbatim
quoted in their own answer file. Those are free for any lexical matcher. Splitting on
term overlap >= 0.8 separates the artifact from the signal:

| subset | system | recall@1 | recall@5 | MRR |
|---|---|---|---|---|
| corpus QUOTES it (n=8) | hybrid | 0.750 | 0.875 | 0.812 |
| | grep-idf | **0.875** | 0.875 | **0.875** |
| | lexical-only | **0.875** | 0.875 | **0.875** |
| corpus does NOT quote it (n=20) | **hybrid** | **0.350** | **0.700** | **0.496** |
| | grep-idf | 0.250 | 0.450 | 0.327 |
| | lexical-only | 0.300 | 0.300 | 0.300 |

On quoted questions **grep-idf equals or beats the hybrid** - vectors are dead weight
there and actually cost recall@1 (0.750 vs 0.875). On the 20 questions phrased in Jonah's
own words, the hybrid pulls away: recall@5 **0.700 vs 0.450** for grep-idf and **0.300**
for lexical-only.

**The one clearly significant result in the whole study:** hybrid vs lexical-only on the
non-quoted subset, 8 wins / 1 loss, **p=0.039**. The embeddings are doing real work
exactly where lexical matching runs out. Against grep-idf on that same subset it is
9-2, p=0.065 - directionally strong, just short of the bar.

Read together: **the lexical half of beats is worth about as much as a good grep. The
vector half is what makes it a different tool.**

## Q1: is the vector half actually running?

Yes, proven by ablation. ollama serving `qwen3-embedding:0.6b`, index 1199/1199 vectors,
`verify` exit 0. Pointing `BEATS_OLLAMA_URL` at a closed port changes the result set
completely and prints `VECTORS ABSENT: ... this query is lexical-only` - the fail-soft is
LOUD. ollama runs as a brew LaunchAgent (`homebrew.mxcl.ollama.plist`, started), so the
"vectors quietly died at reboot" failure mode is structurally guarded.

The v2 harness now **asserts the mode on every single query**: a hybrid run that emits
`VECTORS ABSENT` aborts the study with exit 4, and an ablation run that does NOT emit it
aborts too. Codex flagged that without this, a mid-run ollama hiccup would be scored as
"hybrid" and nobody would ever know.

## Q4: is the incremental cache correct, not just fast?

Correct. On a scratch corpus (real beat content is not mine to edit): edited a beat,
recompiled, got `40 reused, 1 embedded`. The stored row lost the old token and gained the
new one, and - the decisive test - the **stored vector** cosines **0.9988 against the new
text vs 0.9153 against the old**. No stale vector was served.

The 0.56s unchanged-recompile claim **holds**: 0.62-0.81s at 1196 beats (claim was 0.56s
at 866). I first measured 6.1s and nearly filed a 10x regression; it was CPU contention
from my own 4 parallel labelling agents. Search latency idle: median 0.49s.

## Method

- Mined **407 transcripts**, excluding tool results, system reminders, hook injections,
  slash expansions, teammate envelopes: **1188 unique human prompts**.
- Filtered to real interrogatives from improv/dotfiles sessions (155), selected **32
  verbatim questions**. Nothing invented or rephrased.
- **Ground truth labelled by 4 independent agents FORBIDDEN from running `beats.py
  search`** - grep and file reads only, every label carrying a verbatim proof quote.
  Labelling with the tool under test measures nothing.
- 4 excluded as unanswerable/no-answer: q24 (no SSH beat exists), q27 (unresolved
  anaphor), q29 (live git state), q32 (labeller ruled NONE honest).

## Where it fails (5 of 28 misses)

- **q09 identifier format** - "t44, t45 and t46" vs the stored `T-0044/45/46`.
- **q18 codename gap** - the reference article is filed under a retired codename.
- **q23 near-miss token** - "visualize hook" vs `visualizer-guard`.
- **q16 / q21 under-specification** - deictic or long directives matching many beats.

## The real gap: no abstention

On q24, where the labeller proved **no beat answers it**, search returns 5 confidently
scored results with no signal that nothing matched. No score threshold, no low-confidence
output. A caller cannot distinguish "here is your answer" from "here are the 5
least-unrelated beats." Same on q32. Codex correctly noted my table measures
**answerable-only recall** and says nothing about false-positive behaviour. This is the
highest-value next improvement and it is a design call, not an execution detail.

## Codex review - 10 findings, all folded, and it changed the answer

`codex-cli 0.142.5`, adversarial methodology review. Two findings were material:

1. **The grep baselines were strawmen.** They were allowed to rank `MEMORY.md` and
   `MEMORY-archive.md` - derived index files that beats.py excludes structurally.
   **56 of 268 grep result slots (21%) were burned on files beats never has to compete
   with.** Excluding them and adding an IDF-weighted, title-boosted `grep-idf` baseline
   moved grep-terms from 0.107/0.464/0.245 to 0.321/0.500/0.396, and the new grep-idf
   lands at 0.429/0.571/0.483. My first draft claimed a 4.3x recall@1 advantage; the real
   figure against a fair baseline is 1.08x and not significant.
2. **A silently-degraded hybrid run would score as hybrid** (search exits 0 on
   `VECTORS ABSENT`, warning only on stderr, which the harness discarded).

Also folded: supersession-canonicalised labels before scoring (1 of 60 labels was a
superseded name); hard-fail instead of silent `[]` on unparseable output; bootstrap CIs
and paired sign tests for uncertainty; the table renamed to answerable-only; label-target
existence assertion. Two findings I answered rather than changed - the CAND_K=100 sweep
was tuned against the OLD authored 48-query benchmark, not this set, so this eval is
genuinely held-out; and the selection bias is real and now stated outright below.

## Stated limitations

- **Selection bias.** I chose 32 "plausibly beats-answerable" questions from 155 real
  interrogatives. That inflates answerability versus a random sample and says nothing
  about how often beats should answer "not found."
- **n=28 is small.** Each case moves recall by 3.6 points. The CIs are wide and overlap.
- **Labels are single-adjudicator.** Four agents proposed with proof quotes; I resolved.
  No inter-annotator agreement was computed.

## Self-analysis

I built a strawman and did not notice. The grep baseline was handicapped by 21% of its
result slots for a reason that had nothing to do with grep's ability - and I ran it,
read the output, saw `MEMORY-archive.md` sitting at rank 1 in my own sanity check, and
did not register it as a fairness bug. I was measuring the thing I hoped to confirm and
the disconfirming detail was on screen the whole time. Codex caught in one pass what I
had looked straight at.

The failure mode is specific: **when you build both the system-under-test and its
baseline, you will accidentally invest more care in the one you want to win.** The guard
is not "be careful" - it is to have a different model grade the baseline's fairness
before you believe any margin. That is precisely what the produce-and-verify mandate is
for, and this is the first time it has changed a headline number rather than patching an
edge case.

Second, smaller lesson, twice repeated: I nearly reported two numbers produced by setups
I had not verified were in effect - an ablation using the wrong env var (never ablated)
and a timing taken under load from my own agents. An experiment must first prove its
independent variable actually changed. Both are now hard assertions in the harness.

## Baseline first (Team Rule 9)

Recorded before touching anything: `test-beats-compile.sh` **59 / 0**,
`test-beats-search.sh` **47 / 0**, `test-beats-hooks.sh` **29 / 0** (135 checks),
`beats.py verify` exit 0. Both beats hooks wired in project settings and executable.
No production file was modified by this study; all harness code lives in /tmp.

## Files touched

None in the repo. Study artifacts in `/tmp/beatseval/` (questions.json, labels.json,
run_eval2.py, results2.json, METHOD.md). This beat + MEMORY.md index line.
