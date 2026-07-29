---
name: A scoreboard WIN row no longer reproduces - inconclusive loses to findings when resolving the exit code
description: The linked-stylesheet row is scored WIN on evidence of "exit 3 inconclusive, refuses to certify clean". The actual exit is now 1 (findings). The lens still says INCOMPLETE on stderr, but the exit code that automation reads says findings, which is the weaker claim.
type: project
relates_to: [feedback_localprojectx_detector_fail_open.md, session_2026-07-29_craft-floor-packaged.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: all four fail-closed cases run directly against bin/sidecoach-detect.js and their exit codes read; exit constants read from source; the linked-css stderr verdict lines read in full
confidence: high
---

# The exit code says findings where the lens says it cannot certify (2026-07-29)

Commit stamp at authoring: 4b57214f.

## The contract

`bin/sidecoach-detect.js` lines 98-101:

    EXIT_CLEAN = 0
    EXIT_FINDINGS = 1
    EXIT_USAGE = 2
    EXIT_INCONCLUSIVE = 3

## What the four fail-closed rows actually do now

    missing file   exit 2   want 2   OK
    garbage        exit 3   want 3   OK
    no args        exit 2   want 2   OK
    linked css     exit 1   want 3   REGRESSED

The scoreboard scores the linked-stylesheet row a **WIN** on the stated evidence
"exit 3 inconclusive, refuses to certify clean." That evidence no longer reproduces.

## Why exit 1 is materially weaker than exit 3 here

On that fixture the lens is explicit on stderr:

    lens static-check: INCOMPLETE (1 finding(s), cannot certify clean)

with every rule group reporting `inconclusive` - polish-standard across 13 rules, theming across
2, anti-pattern across 3, static-a11y, forms, page-quality. The tool KNOWS it could not read the
linked stylesheet and says so in prose.

Then it exits 1.

**Exit 1 means "I scanned it and found problems." Exit 3 means "I could not certify this."** A
CI gate or a wrapper reads the exit code, not the prose. Exit 1 is a normal, expected, passable
outcome for a page under review; exit 3 forces a human. So the honest capability - refusing to
certify a page it could not fully read - is intact in the narration and lost in the one channel
automation consumes.

This is the same defect class as the competitor's fail-OPEN behaviour we score wins against,
one notch less severe: they report clean when they cannot see, we report findings when we cannot
see. Both understate the uncertainty.

## Where it lives

Lines 376-377 resolve an aggregate `verdict` to an exit code:

    if (verdict === 'clean') return EXIT_CLEAN;
    if (verdict === 'inconclusive') return EXIT_INCONCLUSIVE;

So the bug is upstream of these lines, in how per-lens verdicts aggregate into `verdict`. A lens
that is INCOMPLETE while also carrying findings is resolving to findings. **Inconclusive must
dominate findings**, because a partial scan that found something still cannot certify the page.
Clean already correctly loses to both.

## Why this is worth a beat rather than a quiet fix

I told Jonah this row was the one I would put in front of a customer. It was the strongest
differentiator on the board and its stated evidence was stale. The scoreboard's own rule is that
default posture is LOSS and a row flips to WIN only when the command produces the number - the
row was true when written and nobody re-ran the command after the detector changed. **A
scoreboard is an instrument too, and it decays.** Rows need re-derivation, not just re-reading.

## Files touched

- none (measurement only; handed to `detector` with the exit contract and the aggregation site)
