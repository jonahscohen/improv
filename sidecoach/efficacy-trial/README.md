# sidecoach efficacy trial - does sidecoach improve the output, or only run?

Every other measurement in this repo establishes whether a sidecoach component **fires**. The
detection engine's precision and recall are measured. The flow layer's rendering is measured.
Nobody had compared work produced WITH sidecoach against work produced WITHOUT it. Codex raised
that as finding F7 of the 2026-07-28 live-efficacy review and it was never closed. This directory
closes it, at the resolution the available budget allows.

**Read [PREREGISTRATION.md](./PREREGISTRATION.md) first.** It was frozen before any page existed,
reviewed twice by Codex before any data was collected (`codex-review-v1.md`, `codex-review-v2.md`),
and it fixes the arms, the measures, the tests, the multiplicity correction and the null-declaration
rule so none of them could be chosen after seeing a number. Round 1 rejected the design outright;
round 2 returned NO-GO on one item. Both are folded.

**Read [RESULTS.md](./RESULTS.md) for the answer**, including its limits. This is a PILOT: n = 17
detects only a large effect.

## The design in one table

| arm | prompt | what it isolates |
|---|---|---|
| **C** control | task wrapper + brief | the floor |
| **P** placebo | wrapper + brief + a length-matched NON-DESIGN instruction block | prompt length, density, salience |
| **S** sidecoach | wrapper + brief + the shipped engine's `guidance` payload, verbatim | design content |

The primary comparison is **S vs P**, not S vs C. A two-arm S-vs-C design was built first and
Codex rejected it: the sidecoach prompt is ~16x longer than the bare control's, so any S-vs-C win
could be a prompt-length effect with nothing to do with sidecoach. P and S prompts are matched to
within 4 characters on average.

## Re-deriving the result

```bash
npm install                    # pins axe-core 4.12.1
node power.mjs --n 17          # the pre-data MDE; no data touched
node build-arms.mjs            # 17 briefs x 3 arms -> arms/*.txt  (exit 4 on any arm-integrity violation)
#   ... generate pages/{C,P,S}/<brief>.html from arms/*.txt, one fresh model context per cell ...
node collect.mjs               # completeness + self-containment + blinding leak check
node measure-axe.mjs           # M2  (independent: Deque axe-core)
node measure-sidecoach.mjs     # M3  (own exam - read its asymmetric reading rule first)
node judge-prompt.mjs          # seeded blind A/B assignment, written BEFORE judging
node judge-run.mjs             # M1  (independent: Codex / GPT-5.4, blind, forced choice)
node analyze.mjs               # the pre-registered analysis -> results/results.json
```

Every tool is fail-closed with a distinct exit code per failure class. None of them prints a
success line on partial work, and `judge-prompt.mjs` refuses to redraw an assignment that already
exists so the A/B sides cannot be reshuffled after a verdict is seen.

## What is committed, and why

- `arms/` - the exact 51 prompts each producer saw, plus a manifest with per-brief sha256s. The
  central integrity claim (only the appended payload differs) is checkable from these files, not
  just asserted.
- `pages/` - all 51 generated pages, unedited. Leaks are reported, never stripped.
- `judge/assignment.json` - the seeded blind draw. `judge/verdicts.jsonl` - every verdict with its
  wrapper exit code and the judge's one-line reason.
- `measurements/` and `results/` - the raw numbers behind every claim in RESULTS.md.

The point is that the result can be argued with. If you think the placebo is a bad comparator (the
author does, and says so in PREREGISTRATION.md 2.1), you can read it and say why.
