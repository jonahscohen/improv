---
name: Lane P1 Task 7 - TS classifier mirror + shared parity corpus
description: Added the TS lane classifier mirror to keyword-resolver.ts (alongside resolveKeyword) + a 19-case shared corpus run against BOTH Python and TS. Both agree on every case incl all adversarial fixtures. python 35/35, parity 19/19 both sides.
type: project
relates_to: [session_2026-06-13_lane-p1-task5-decision-flow.md, session_2026-06-13_lane-p1-task7-fence-parity-fix.md]
---

Collaborator: Jonah

Implemented **Task 7 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. The most parity-critical task. Committed exactly 4 files.

## What was done

- `sidecoach/parity/classifier-corpus.json` (new) - 19 shared fixtures, prompt -> expected outcome (+winningLane/verbMatch where non-null). Includes ALL the verifier's adversarial cases.
- `sidecoach/mcp-server/src/keyword-resolver.ts` (modified) - ADDED the TS lane classifier (SCHEMA_VERSION, LaneScore/Decision, loadRegistry, blankInformational, segmentClauses, evaluateLane, detectVerb, classifyIntent) ALONGSIDE the existing resolveKeyword/sanitize/isInformational (untouched; MCP tool rename is P4). Added `import * as fs from 'fs'`.
- `sidecoach/mcp-server/src/__tests__/classifier-parity.test.ts` (new) - runs classifyIntent over the corpus, asserts outcome/winningLane/verbMatch; prints "classifier-parity: N cases OK".
- `claude/hooks/test_classifier_parity.py` (new) - runs Python classify_intent over the SAME corpus; pytest-free __main__ runner.

## Step 0 reconciliation: duplicate-export collision (CRITICAL)

The plan's TS block re-declared `export function sanitize` and `export function isInformational`, but keyword-resolver.ts ALREADY exports both - and they must DIFFER from the lane needs:
- existing `sanitize` collapses each region to a SINGLE space (not length-preserving) -> would shift clause offsets and diverge from Python.
- existing `isInformational` has 9 frames; the Python classifier's is_informational has 7.
So I renamed the lane copies `laneSanitize` (length-preserving, mirrors Python sanitize) and `laneIsInformational` (7-frame, mirrors Python), kept them non-exported, and updated their call sites (evaluateLane/classifyIntent use laneSanitize; detectVerb uses laneIsInformational). The existing exports are byte-unchanged.

## Corpus correctness (verified against ACTUAL Python before writing TS)

I ran Python classify_intent on every candidate and set expects to the verified actuals. Two plan-corpus values were WRONG and corrected:
- Cross-sentence "The landing page is done. Make the migration production-ready." -> the plan said SILENT; actual (and team-lead-specified) is **OUT_OF_SCOPE** (ship evidence binds to migration; oos with no eligibility -> OUT_OF_SCOPE).
- Plan's "keep iterating on the card until it passes the audit" expected ROUTE, but "audit" is a registered VERB so it actually classifies as CLASSIFY (verb + route-grade lane). Replaced with a clean converge ROUTE prompt: "keep iterating on the dashboard until it passes".
- Also DROPPED the plan's "rework the memory layout of the struct" SILENT case - "layout" is a registered verb so it fires VERB(layout); kept 5 other clean SILENT cases instead.

Adversarial coverage (all verified, both sides agree): prefix-trap "make it production-ready, butter the migration aside" -> OUT_OF_SCOPE (", butter" must not split); cross-sentence OUT_OF_SCOPE; bare "interface" -> CONTEXT_CHECK vs "user interface" -> ROUTE; grouped MAX-not-sum "production-ready and ship-ready" -> ROUTE score 3; route_margin==2 "build me a dashboard from scratch and make it production-ready" -> ROUTE lane_build; quoted-verb 'the spec said "polish it"' -> SILENT. One+ each of ROUTE/CLASSIFY/CONTEXT_CHECK/VERB/NUDGE_ELIGIBLE/SILENT/OUT_OF_SCOPE.

## Python parity-test path bug (fixed)

The plan's test_classifier_parity.py used `REPO = os.path.join(HERE, "..")`, which from `<repo>/claude/hooks` resolves to `<repo>/claude` (a flat `<repo>/hooks` layout was assumed). The corpus lives at `<repo>/sidecoach/parity`. Fixed to `os.path.join(HERE, "..", "..")`. (The TS test's 4-level `path.resolve` was already correct.)

## Abbreviation-masking parity note (do-not-"fix")

Recorded in the corpus `parityNotes`: Python masks abbreviation periods with \x00, TS with a space; both length-preserving and proven span-identical. NOT a divergence - a future editor must not "fix" one side to the other.

## Verification

- python classifier suite: `python3 test_sidecoach_lanes.py` -> 35 passed, 0 failed.
- python parity: `python3 test_classifier_parity.py` -> 1 passed (19 cases), exit 0.
- TS parity (red): before adding the mirror, `npx ts-node ...classifier-parity.test.ts` failed TS2305 (loadRegistry/classifyIntent not exported) - right reason.
- TS parity (green): `classifier-parity: 19 cases OK`, exit 0. ts-node v10.9.2, node v20.
- Regression guard: existing resolveKeyword/sanitize/isInformational STILL exported (functions) + new classifyIntent/loadRegistry present.
- Result-shape parity contract: TS Decision interface == Python dict keys {outcome, winningLane, verbMatch, diagnosticLane, laneScores, schemaVersion}; laneScores entries {lane,label,score,scope,evidenceIds}.
- model-router-guard: TS side pure regex; no LLM/network. No cross-package engine import (loadRegistry reads JSON via fs), so the Task 8 tsconfig-cross-import risk did not apply here.

## Files touched

- sidecoach/parity/classifier-corpus.json (new)
- sidecoach/mcp-server/src/keyword-resolver.ts (added lane classifier mirror; existing exports untouched)
- sidecoach/mcp-server/src/__tests__/classifier-parity.test.ts (new)
- claude/hooks/test_classifier_parity.py (new)
