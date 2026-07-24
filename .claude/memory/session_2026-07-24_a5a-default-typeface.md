---
name: A5a taste-detection gate for default-typeface (Stage 4a)
description: Closed the Contract-6 A5a head-to-head for default-typeface - extended rubric (Guardrail #1 held), Codex-labeled fixtures + real negatives, graded ours vs oracle
type: project
relates_to: []
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

# A5a taste-detection gate: default-typeface (Stage 4a)

EVAL-ONLY work under `sidecoach/eval/`. Detector already shipped + green; A5a runs the detection
head-to-head (ours vs the studied "oracle") against independent Codex present/absent labels.

## Guardrail #1 - does extending subjective-rubric.md break the frozen corpus? NO.
Why safe (from code, not assumption): neither `verify()` nor `verifyCandidates()` in `corpus-tool.mjs`
reads the rubric or checks `rubricSha`. `rubricSha` is stored on each label as INFORMATIONAL provenance
only; it is NOT part of `canonicalRecord`/`canonicalCandidateRecord` (the freeze hash). So changing the
rubric's content-SHA cannot invalidate any frozen label. The real freeze integrity rides on: file-content
SHA + sorted {class,labeledBy,present} labels + split + provenance.

How proven (before -> after the rubric edit, identical):
- `corpus-tool verify` (manifest corpus): VERIFY OK -> VERIFY OK.
- `corpus-tool.test.mjs` (freeze/verify LOGIC, temp-dir): ALL PASS -> ALL PASS.
- `corpus-tool verify-candidates` (real corpus): 90 errors -> 90 errors (identical; my edit added zero).
- `rubricInfo().classes.length`: 22 -> 23; new rubricSha 61a6a24614c3be66; default-typeface tagged [SCREENSHOT].

## PRE-EXISTING baseline finding (NOT caused by me, NOT fixed here)
`corpus-tool verify-candidates` fails 90/90 "LOCKED RECORD TAMPERED" at committed HEAD 1ea7ae73. Files are
intact (not "FILE CONTENT TAMPERED") so it is a record-hash/schema drift between candidates.json and
lock-candidates.json, committed and pre-existing. CRITICAL: `npm test` (scripts/run-tests.ts, explicit
73-suite list) does NOT run verify-candidates OR corpus-tool.test.mjs, so this failure is ungated. Left
untouched (out of scope; the frozen corpus was already in this state independent of this work).

## Changes (all eval/ - no product code touched)
- `eval/corpus/subjective-rubric.md`: added a Stage-4a subsection + `default-typeface:` definition bullet
  (descriptive, screenshot-judgeable, no thresholds/props/selectors) + added default-typeface to the
  LABELING SIGNAL VISUAL list.
- `eval/subjective-label-harness.mjs`: added default-typeface to the VISUAL set; cosmetic count log 18->19 screenshot.
- `eval/dev-subjective-label.mjs`: added default-typeface to its VISUAL set (recorded signal=screenshot).

## Oracle behavior (characterized by running it over the 11 fixtures; pinned 4.0.2)
Oracle has NO default-typeface rule. Its font rules: `overused-font` (fires on font NAMES in an overused
set incl Arial/Helvetica/Inter/Roboto...) and `single-font` (font monotony - one family used throughout).
Both orthogonal to "left in the default/system stack." Generous mapping (credit the oracle both font rules
as its nearest coverage) reproduces the head-to-head; strict mapping (no rule = default-typeface) gives the
oracle 0 coverage.

## Files touched
- eval/corpus/subjective-rubric.md
- eval/subjective-label-harness.mjs
- eval/dev-subjective-label.mjs
- (labeling sink + grader added in later steps this session)
