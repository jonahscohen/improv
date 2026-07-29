---
name: Adversary handoff - what broke, what held, and where to resume
description: Handoff at team pause. The canary gate HELD under three deliberately broken detectors and is trustworthy. Three of the scoreboard's eight wins do not survive. Six other claims were attacked and could not be broken.
type: project
relates_to: [session_2026-07-29_adversary_scoreboard-defects.md, session_2026-07-29_adversary_real-key-tail-committed.md, session_2026-07-29_adversary_claims-that-survived.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: written at pause from results already verified in the linked beats; no re-verification performed
confidence: high
---

# Handoff (2026-07-29, adversary, at team pause)

Commit stamp at authoring: 56251cb7. Written fast at shutdown, no re-verification. Every claim
below is backed by a command recorded in one of the linked beats.

## The question asked first: DOES THE CANARY GATE ACTUALLY FAIL?

**Yes. It held under every direction I attacked it from, and it is trustworthy.** This was the
first thing I tried to break, because it certifies every other instrument on the board.

Method: harness copies with `OURS_DETECT` repointed at a broken detector and `OUT` sent to /tmp,
so the real `SCOREBOARD.md` was never written. Copies were named `benchmark/zz-adv-sb-*.sh` and
deleted afterward.

| variant | behavior | canary verdict | `--selftest` exit |
|---|---|---|---|
| shipped (control) | healthy | PASS - fires 16 / 0 | 0 |
| `silent` | prints nothing, exits 0 | **FAIL** - `positive=0 (lens ran: no)` | 1 |
| `noisy` | fires 7 on everything incl. the clean page | **FAIL** - `positive=7 negative=7` | 1 |
| `crash` | cannot run at all, exits 2 always | **FAIL** - `positive=0 (lens ran: no)` | 1 |

Both failure directions are caught - a detector that goes blind AND one that cries wolf. A full
run with the `silent` detector degraded the board honestly: **WIN 8 -> 2, UNMEASURED 2 -> 7**.

The load-bearing part is the `lens static-ban: ran` discriminator. It is what makes a silent zero
distinguishable from a genuine clean scan, and without it the `silent` variant would have looked
like a clean page. Whoever maintains this harness should treat that discriminator as the thing
that makes the gate work and not remove it as redundant.

**So the gate is not the defect. The defect is what is NOT behind the gate** - see below.

## What FAILED (full detail in session_2026-07-29_adversary_scoreboard-defects.md)

1. **The four failure-behaviour rows are not canary-gated and their check cannot fail.** Verdict is
   `[ "$o" != "0" ] && [ "$l" = "0" ]`. A detector that cannot run scores the identical three WINs
   as the real one (2/2/2 broken vs 2/3/2 real, both -> WIN). The wins are substantively deserved -
   our codes are differentiated with a reason on stderr, theirs exits 0 - but the row cannot prove
   it. Four of eight wins sit here.
2. **Every interpretive label is a hardcoded literal.** "IO error", "inconclusive", "usage error",
   "refuses to certify clean", "reports `[]`". Under the broken run a cell rendered
   `exit 0 (IO error, fail-closed)`, contradicting itself. `reports []` is factually wrong - theirs
   prints `Warning: cannot access ...`.
3. **The verbs WIN is a population artifact.** Ours counts commands named anywhere in SKILL.md
   (24); theirs counts only first cells of one markdown table (23). Symmetrically it is 24 vs 32
   and a LOSS. Nine capabilities they document sit outside the counted table.
4. **The typecheck WIN is scored against a side never measured.** The verdict is a function of our
   result alone; their column is a hardcoded string. Should be UNMEASURED per the board's own
   rules 3 and 5.

Corrected tally: **WIN 6 / LOSS 16 / TIE 1 / UNMEASURED 3** (published: 8/15/1/2).

Also worth flagging and unrelated to any row: **`sidecoach/benchmark/` is untracked.** The file the
team steers by is not in git.

## Claims I attacked and COULD NOT break - these are results, not gaps

1. **The canary gate itself.** Three broken directions, all caught. Above.
2. **Contrast read from decoded pixels.** I did not reproduce the reported figures; I built a PNG
   with an independent Python encoder holding an exactly-flat `#777777` patch and computed WCAG
   myself (4.4781 white / 4.6895 black). Tool returned 4.48 exit 1 and 4.69 exit 0 over exactly
   4096 px. Then planted ONE white pixel in a flat dark region: worst-mode flipped 15.91 -> 1.00,
   mean-mode ignored it. Worst-case is genuinely per-pixel.
3. **The three-value verdict against its author's interest.** Four checks pass (bytes, format,
   geometry, provenance) and the verdict is still `unverified`, exit 3, never 0. Fail outranks
   unverified. Format read from magic bytes, so a `.png` holding JPEG was caught.
4. **The budget cap is pre-flight.** Identical bogus-key calls, only the cap changed: `0.0001` ->
   exit 7, no file, no ledger created, no provider error; `1.00` -> exit 6, Google 400. The cap
   decided whether the request happened.
5. **install.sh has zero live in-place sed edits.** The repo's own token scan caught 12 planted
   spellings (including `-Ei.bak`, `-ni.bak`, `-e 's/a/b/' -i FILE`, and a backslash-continued
   split) and rejected 6 decoys. Real file: 0.
6. **The polish payload teaches, non-vacuously.** 6 findings across 6 rule classes, grade B, and 0
   template occurrences - the zero is not the vacuous kind.
7. **The green-while-failing runner guard.** Synthetic suite printing `Status: FAILED` at exit 0 was
   flagged with the correct pattern name, runner exit 1; the honest suite was left alone.
8. **The spend ledger.** One real entry, `usd 0.0447636`, `basis: usage-derived`, plus a cost-free
   failed attempt. Gitignored.
9. **Loadable-docs asymmetry and the rule-registry row.** Both stand. The docs filter differs but
   symmetrising makes the loss bigger (2 vs 108), so it manufactures nothing.

## Where I would resume

1. Fix the four failure-behaviour rows: assert the exit code equals the DOCUMENTED code for its
   class (2/3/2, not merely non-zero), assert stderr matches a reason pattern, derive the label
   from what matched, and route all four through `gated`. That is the single highest-value change
   on the board - it converts four unfailable rows into four that can fail.
2. Recount the verbs row symmetrically and flip it; flip the typecheck row to UNMEASURED.
3. Commit `sidecoach/benchmark/`.
4. `scorekeeper` has my item-5 message: the test-suite-lines row is unit-unstable (by lines we lose
   23432/39960, by files we win 174/83) and should become mutation-kill rate, which lands as
   UNMEASURED on their side because they have no mutation harness. I argued that ships anyway.
5. Open and not mine to close: rotation of `improv-openai-image-api-key`. The fixture is synthetic
   now (`5fcfdcee`) but the fragment remains in history from `7cb49c97`. The key is already dead at
   401, so rotation costs nothing.

## The lesson I would carry forward, since it caught me four times in one night

My own instruments broke four times: `\+` used as an ERE plus; `sk-` matching `task-` and `ask-`;
a 700-character print slice I nearly reported as an empty verdict line; and reading `costUsd` when
the field is `usd`. Every one was built to match the shape I expected rather than the shape the
subject emits, which is the same failure as the four the lead logged and the same as the sweep that
missed the key tail by reasoning about the hit's location instead of its content.

The working rule: before believing any zero, plant a positive of the shape actually at risk and
confirm the instrument fires. I withdrew one false positive because of it, and it is the only
reason the key fragment was found at all.

## Files touched

- none (measurement only across the whole pass; four defect beats plus this handoff are the output)
