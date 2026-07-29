---
name: FAILED CLAIMS - three of the scoreboard's eight wins do not survive, and the fail-closed cluster is vacuous
description: The canary gate itself holds under both broken directions. But the verbs WIN is a population artifact, the typecheck WIN is scored against an unmeasured side, and the four fail-closed rows award the identical WIN to a detector that cannot run at all.
type: project
relates_to: [session_2026-07-29_scoreboard-harness.md, decision_discoverability_outranks_internal_quality.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: canary gate broken in three directions and observed; verdict expressions replayed verbatim against a non-functional detector; both sides of two rows recounted symmetrically
confidence: high
---

# Attacking the scoreboard (2026-07-29, adversary pass)

Commit stamp at authoring: 56251cb7. `sidecoach/benchmark/` is UNTRACKED, so none of this is in
git yet - worth knowing separately, since every teammate is steering by a file that is not
version controlled.

## Item 1: the canary gate HOLDS. It was the first thing I tried to break and it did not break.

Three broken detectors, each substituted via a harness copy with `OURS_DETECT` repointed and
`OUT` sent to /tmp so the real board was never written:

| broken variant | behavior | canary verdict | selftest exit |
|---|---|---|---|
| shipped (control) | healthy | PASS - fires 16 / 0 | 0 |
| `silent` | prints nothing, exits 0 | **FAIL** - `positive=0 (lens ran: no)` | 1 |
| `noisy` | fires 7 on everything incl. the clean page | **FAIL** - `positive=7 negative=7` | 1 |
| `crash` | cannot run, exits 2 always | **FAIL** - `positive=0 (lens ran: no)` | 1 |

Both failure directions are caught, and the `lens static-ban: ran` discriminator is doing real
work - it is why a silent zero is distinguishable from a genuine clean scan. A full run with the
`silent` detector degraded the board honestly: **WIN 8 -> 2, UNMEASURED 2 -> 7**. The gate does
what it claims.

## Item 3 is the real finding, and it is worse than the lead suspected

The four failure-behaviour rows are FOUR of the EIGHT wins. Two defects, one structural and one
cosmetic.

**3a. Zero of the four rows is canary-gated.** Lines 476-520 contain 4 `row` calls and 0 `gated`
calls. So a canary FAIL does not degrade them.

**3b. The verdict asks only whether our exit code is non-zero.** Verbatim from the harness:

    v="LOSS"; [ "$o_missing" != "0" ] && [ "$l_missing" = "0" ] && v="WIN"

Replaying that expression against a detector that CANNOT RUN (`process.exit(2)` after printing
`Cannot find module`) versus the real one:

    probe     theirs   BROKEN-ours -> verdict   ||  REAL-ours -> verdict
    absent      0          2  -> WIN            ||     2  -> WIN
    garbage     0          2  -> WIN            ||     3  -> WIN
    noargs      0          2  -> WIN            ||     2  -> WIN

**A completely non-functional build scores the identical three WINs.** This is exactly the shape
the lead named: being credited for failing closed while actually failing to run, indistinguishable
from an exit code, because the harness looks at nothing but the exit code.

**Important and not to be softened in the other direction: the win is SUBSTANTIVELY DESERVED
today.** The real detector returns *differentiated* codes - 2 for IO, 3 for inconclusive, 2 for
usage - and emits a diagnostic naming the reason:

    sidecoach-detect: cannot read target: /tmp/sc-bench-absent-xyz.html
    ENOENT: no such file or directory, stat '/tmp/...'

Theirs prints `Warning: cannot access ...` and exits 0. So the behavior gap is real. The defect is
that the ROW CANNOT PROVE IT - it is a vacuous assertion in the precise sense this repo already
catalogued in `session_2026-07-28_vacuous-assertion-sweep.md`: a check whose pass condition cannot
distinguish the thing it is testing from its own failure mode.

**3c. Every interpretive label is a hardcoded literal, not a measurement.**

    "exit $l_missing (reports \`[]\`, fail-OPEN)"   "exit $o_missing (IO error, fail-closed)"
    "exit $l_garbage (fail-OPEN)"                   "exit $o_garbage (inconclusive)"
    "exit $l_noargs (fail-OPEN)"                    "exit $o_noargs (usage error)"
    "exit $o_linked_ec inconclusive, refuses to certify clean"

"IO error", "inconclusive", "usage error", "refuses to certify clean" and "reports `[]`" are
asserted strings wrapped around a live number. Two consequences:

- Under the broken-detector run the cell rendered **`exit 0 (IO error, fail-closed)`** - a cell
  that contradicts itself, because the number moved and the prose could not.
- `reports []` is simply false. Their detector prints a `Warning:` line, not `[]`. A fabricated
  detail in an evidence column.

**Fix I would defend:** assert the exit code equals the DOCUMENTED code for that failure class
(2 / 3 / 2, not merely non-zero), assert stderr matches a reason pattern for that class, derive
the label from what was matched, and route all four rows through `gated`. That row then fails on a
broken build instead of passing.

## Item 2a: the verbs WIN is a population artifact. It should be a LOSS.

    ours:   grep -oE '/sidecoach [a-z][a-z-]+' $INSTALLED_SKILL | sort -u   -> 24
    theirs: grep -oE '^\| `[a-z][a-z-]+' $LPX/skill/SKILL.src.md | sort -u  -> 23

Ours counts every command named ANYWHERE in the document. Theirs counts only the first cell of
markdown TABLE rows. Recounted symmetrically as "capabilities named anywhere in the skill
surface":

    their verb-table entries:                        23
    their reference-doc capabilities:                32
    documented by them but ABSENT from that table:    9
      android craft-floor doctor hooks ios new-work operate routing visualize
    union (symmetric to our count):                  32

**24 vs 32 is a LOSS.** Our 24 tokens are all legitimate (adapt animate audit bolder clarify
colorize craft critique delight distill document extract harden help layout list onboard optimize
overdrive polish quieter shape teach typeset) - our side is fine. Their side is undercounted by a
regex anchored to one table.

The document already contains the contradiction: row 47 states they document 11 capabilities we do
not expose, while row 45 scores us a WIN on capability count. Both rows read the same tree and
reach opposite conclusions.

## Item 2b: the typecheck WIN is scored against a side that was never measured

    v="LOSS"; TSCTXT="exit $TSC - RED, ..."
    if [ "$TSC" = "0" ]; then v="WIN"; TSCTXT="exit 0 - green, zero output"; fi

The verdict is a function of OUR result alone. `LPX_RUNNABLE` is a hardcoded string, "not runnable
here (no node_modules; installing is forbidden by charter)", and never enters the comparison. This
breaks two of the scoreboard's own rules: rule 5 (head-to-head rows run BOTH tools or they do not
count) and rule 3 (UNMEASURED never counts as a win). It is also structurally unwinnable for them
- the charter forbids the install that would make their side measurable. **It should be
UNMEASURED.**

## Item 2c: the loadable-docs asymmetry is real but CONSERVATIVE, so the row stands

    ours   find -L -type f        -> 2      ours   find -L -name '*.md'  -> 2
    theirs find -name '*.md'      -> 39     theirs find -type f          -> 108

The filters differ, but symmetrising makes the loss BIGGER (2 vs 108), so the asymmetry is not
manufacturing a false loss. The row survives; the command string should say which filter it used.

## Item 4: the two UNMEASURED rows are legitimate

Model-backed cost needs paid calls the charter forbids; the competitor's render lane needs a
dependency install the charter forbids. Neither is load-bearing for a conclusion stated elsewhere:
the "largest gap" section rests on discoverability, distribution, and the fail-closed rows, and it
hedges correctly with "on every axis where the number can be read directly." The tally keeps them
separate and does not round them up. Nothing to report here beyond confirming it.

One related check that came out clean: row 51 measures our findings with `--no-render` against
their default invocation. That is conservative against us (rendering could only add findings), so
it is not an asymmetry that manufactures a win.

## Item: the rule-registry row is symmetric

Their registry directory holds exactly one file and it carries 60 rule ids; there is no second
registry the count is missing. 81 vs 60 stands.

## Corrected tally

Falsifying the verbs row (WIN -> LOSS) and the typecheck row (WIN -> UNMEASURED):

    as published:  WIN 8  / LOSS 15 / TIE 1 / UNMEASURED 2
    corrected:     WIN 6  / LOSS 16 / TIE 1 / UNMEASURED 3

Three of the remaining six wins (the fail-closed cluster) are substantively real but rest on a row
that cannot fail, so they should be re-earned by a stronger assertion rather than removed.

## Files touched

- none (measurement only; harness copies were written to benchmark/ as zz-adv-* and deleted, real
  SCOREBOARD.md and run-scoreboard.sh unmodified)
