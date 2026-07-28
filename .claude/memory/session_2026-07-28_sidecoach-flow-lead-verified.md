---
name: Sidecoach flow fix LEAD VERIFIED on a held-out fixture, plus a new narrow gap in broken-image
description: The flow layer now renders local files and grades from findings, reproduced independently. A fresh fixture the teammate never saw shows skipped-heading and low-contrast firing correctly and broken-image NOT firing on a missing file over file://.
type: project
relates_to: [session_2026-07-28_sidecoach-flow-fix.md, session_2026-07-28_sidecoach-live-efficacy.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: two-target reproduction re-run by the lead with the same method used to prove the original defect, plus a purpose-built held-out fixture
confidence: high
---

# Lead verification of the sidecoach flow fix (2026-07-28)

## The original defect, and its repair, both measured the same way

Earlier today the lead proved the defect by driving two maximally different targets and
diffing: a 0-byte file and a catastrophic page produced **byte-identical 8866-byte output**,
differing only in clocks.

Re-run against the fixed code, same method:

| | before | after |
|---|---|---|
| output sizes | 8866 vs 8866 (identical) | 6892 vs 8435 (differ) |
| substantive differing lines | 0 (all 20 were timestamps) | 142 |

## Held-out fixture, built by the lead after the fix

The first re-run used the lead's ORIGINAL awful.html, which turned out to be a weak probe:
it placed an `h5` before an `h1`, which is a heading ASCENT, not a skip, so
`skipped-heading` correctly stayed silent. Recording that because it nearly produced a
false "the fix does not work" report - the fixture was wrong, not the code.

Rebuilt as a genuine held-out case (`h1` then `h4`, a missing image file, `#f2f2f2` body
text on `#ffffff`), a fixture the teammate never saw:

    skipped-heading   7 hits
    low-contrast      9 hits
    broken-image      0 hits
    verdict blocked, grade D, audit.rendered = true

So the flow renders a local file, finds real defects in it, and derives a grade from what it
found. That is the property that was missing.

## NEW FINDING: broken-image does not fire on a missing FILE over file://

The teammate's catastrophic fixture used an **empty-src** img and reported broken-image.
The lead's held-out fixture used `src="definitely-missing-image-xyz.png"`, a file that does
not exist, and broken-image did NOT fire.

Those are different failure modes and only one is covered. This matters beyond the fixture:
the detector's P 1.000 / R 1.000 figure comes from 89 held-out pages, and if those are HTTP
captures then a missing LOCAL file may never have appeared in that corpus at all. Now that
local file targets reach the render path for the first time, this case is newly reachable.

NOT FIXED. Reported for the Codex vetting pass.

## Still in flight at time of writing

The teammate has two verifications running that nothing above depends on: the full
`npm test` suite, and a 38-page held-out cross-check comparing per-rule objective counts
between the flow path and the known-good `sidecoach-detect` path.

## Two methodology notes from the teammate worth keeping

1. Its "constants are gone" assertion was VACUOUS and mutation control caught it - it
   inspected the rendered-audit payload, but the rendered audit bypasses the chain, so the
   only emitter of the constant never ran there. It was absent for a reason unrelated to
   the fix.
2. Re-running nine mutations after folding review, two reported NOT CAUGHT and were
   actually STALE ANCHORS whose replace mutated nothing. **A no-op mutation is
   indistinguishable from an uncaught one and fails in the dangerous direction.** Every
   mutation now asserts its anchor exists first.

## Files touched

- none by the lead (verification only)
