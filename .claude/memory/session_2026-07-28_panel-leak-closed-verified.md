---
name: Sidecoach no-page panel leak CLOSED - verified by the lead on the same probe that found it
description: The Critical-1 defect from the Codex sidecoach vet is fixed. A target that rendered nothing no longer prints a verdict or grade to the human-visible panel, confirmed with the identical command that exposed it.
type: project
relates_to: [session_2026-07-28_codex-vet-wave-verdicts.md, session_2026-07-28_sidecoach-flow-lead-verified.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: /sidecoach audit . re-run by the lead, ANSI stripped, panel inspected directly
confidence: high
---

# The panel leak is closed (2026-07-28)

## Before and after, same command, lead-run both times

`/sidecoach audit .` against a directory with no entry document, ANSI stripped:

    BEFORE   gates   [check] taste  [check] claudemd  [check] polish
             > verdict  clean - grade A - 0 findings

    AFTER    gates   . taste   . claudemd   . polish
             (no verdict line at all)

`audit.rendered` is false and `buildReport` is absent in BOTH. Only the panel changed,
which is the point: the panel was the one surface a human actually reads, and it was the
one surface still asserting a clean grade for a page nothing had opened.

The fix passes `report: unrenderedAuditTarget ? undefined : chainBuildReport` into
`assemblePanelModel`. With no report the model already sets `partial=true`, drops the
verdict, grade and findings, and renders gates as PENDING, so the panel keeps its route and
chain context and loses only the CLAIM.

## Why this one matters beyond the fix

Three separate verifications missed it before Codex found it:

1. The unit's own test asserted `!res.buildReport` and never inspected `res.panel`.
2. The lead checked the JSON result, saw `rendered:false` and `buildReport` absent, and
   stopped there.
3. The markdown surface was CORRECT the whole time - it printed "Audit could not run" and
   "inconclusive" - which made every check that looked at it agree the property held.

A safety property has to be asserted on EVERY surface that renders it, not on the one the
author happened to be looking at. Two correct surfaces and one wrong one still means a user
is shown a grade.

## A second finding from the same unit, worth more than the fix

Tightening the non-vacuity guard from "flowI is present" to "flowI succeeded" immediately
failed under an isolated HOME - which is what `npm test` uses - because flowI is recorded as
`error: prerequisites not met`. So that entire constant-absence layer had been passing for
the WRONG reason on CI and for the right reason only on a warm dev machine. The layer now
seeds its prerequisite so flowI genuinely executes everywhere.

Also surfaced and correctly identified as PRE-EXISTING rather than caused by this work:
`sprint7-buildreport-includes-unstructured.test.ts` is order-dependent through the shared
HOME-scoped flow-history file, and fails standalone under a fresh HOME both with and without
the aggregator change.

## Files touched

- none by the lead (verification only)
