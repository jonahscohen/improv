---
name: FAILED CLAIM - two installer failure paths bypass PARTIAL_FAILURES entirely
description: The harness-skills mirror returns 1 without recording on mktemp and find failures, and its call site discards that with "|| true". The installer reaches "Installation complete." with exit 0 while sidecoach was never mirrored.
type: project
relates_to: [session_2026-07-29_adversary_claims-that-survived.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: function extracted with stubs and driven with a poisoned TMPDIR; ledger observed empty; found by Codex cross-model review and confirmed independently
confidence: high
---

# The ledger has two holes (2026-07-29, adversary pass)

Commit stamp at authoring: 56251cb7. The defect is in UNCOMMITTED work, so it is catchable
before it lands.

## The claim

That `install.sh` has zero live `sed -i` calls **and routes failures through
`PARTIAL_FAILURES`**. The first half holds and is recorded separately with its negative control.
The second half has two holes.

## The two paths

`install_skill_to_harnesses()` (install.sh:800-866) records into the ledger on its two main
failure modes - it calls `record_component_failure` for a directory it could not create and a
file it could not deploy. But two earlier paths return non-zero with no ledger write at all:

    install.sh:822   mktemp failed  -> err(...); return 1     # no record_component_failure
    install.sh:827   find failed    -> err(...); return 1     # no record_component_failure

And the call site discards the return value:

    install.sh:7475  install_skill_to_harnesses sidecoach || true

So a non-zero return goes nowhere. The run prints one `ERR:` line and continues to
"Installation complete." with exit 0, having mirrored the skill to no harness.

## Confirmed behaviorally, not just by reading

The real installer was NOT run (it writes into HOME). The function was extracted with stubs for
`err` / `info` / `record_component_failure` and driven directly:

    TMPDIR=/no/such/dir install_skill_to_harnesses sidecoach || true

    mktemp: mkstemp failed on /no/such/dir/improv-harness-bzYtin: No such file or directory
    ERR: harness-skills: could not create a temp file for the source walk
    ---
    LEDGER EMPTY  <-- failure was NOT routed through PARTIAL_FAILURES

## Why this one is worth ranking

The comment directly above line 822 states the reason the temp-file walk exists:

> Same temp-file walk as install_bundled_skill, for the same reason: process substitution
> discards find's exit status, so an unreadable source tree would mirror a SUBSET and report
> success.

The walk was written to stop a failure being discarded, and its own failure is then discarded
one layer up by `|| true`. The defect the comment describes is reproduced by the fix for it.
This is also the exact shape another comment in the same file (around :7440) says the ledger was
built to end: "a broken or offline sidecoach build printed one yellow line and the run still
reached 'Installation complete.' with exit 0."

Both failures are plausible in the field rather than theoretical: a full or unwritable `TMPDIR`,
and an unreadable source tree (permissions, a partial checkout, a interrupted sync).

## The fix shape

Not `|| true` removal on its own - that would let `set -e` kill the run on a mirror failure,
which is why the `|| true` is there. Either both `return 1` paths call
`record_component_failure` like their siblings, or the call site becomes
`install_skill_to_harnesses sidecoach || record_component_failure harness-skills "..."`. The
first is better: it keeps the reason specific to what actually failed.

A guard is also cheap here, and its absence is why this survived: nothing asserts that every
non-zero return path in a component installer either records or is recorded at its call site.

## Provenance

Found by Codex (`codex-review.py`, real verdict, exit 0, 186.9s) reviewing the team's
uncommitted diff, as finding 6 of 6. Relayed here only after independent confirmation, because
a cross-model finding is a hypothesis until the failing input is run. Codex's line number for
the call site (7435) was off by 40; the behavior was as described.

## Files touched

- none (measurement only)
