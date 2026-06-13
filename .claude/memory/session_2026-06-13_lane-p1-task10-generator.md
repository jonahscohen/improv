---
name: Lane P1 Task 10 - lane flow-sequence generator + checked-in artifacts
description: generate-lanes.ts derives each lane's executed flow sequence + verb-guidance from VERB_REGISTRY, emits checked-in lanes.generated.ts + LANES.generated.md; --check fails on drift. All 6 sequences match the golden table; npm test now 5 suites green.
type: project
relates_to: [session_2026-06-13_lane-p1-task9-scoped-test-runner.md, session_2026-06-13_lane-p1-task1-registry-loader.md]
---

Collaborator: Jonah

Implemented **Task 10 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. Committed 6 files.

## What was done

- `sidecoach/src/lane-derivation.ts` (NEW - my deviation, see below) - `deriveFlowSequence` (flows in verb-chain order, each once, first owning verb) + `deriveVerbGuidance`.
- `sidecoach/scripts/generate-lanes.ts` (NEW) - imports the derivation from ../src/lane-derivation; buildModel (reads sidecoach-lanes.json) + renderTs + renderMd + `--check`. Emits the checked-in artifacts; `--check` re-renders and compares to disk, exit 1 on drift.
- `sidecoach/src/lanes.generated.ts` (NEW, generated, checked in) - typed LANES[] + LANES_BY_ID + getLane/getLaneFlowSequence.
- `sidecoach/LANES.generated.md` (NEW, generated, checked in) - the `<!-- lanes:generated:start/end -->` doc-section (P1 stand-in; wiring into SKILL.md/CHEATSHEET.md is P4 - NOT touched).
- `sidecoach/src/__tests__/lane-derivation.test.ts` (NEW) - the 5th suite Task 9 forward-declared; asserts derivation == golden for all 6 lanes.
- `sidecoach/package.json` (MOD) - `build`: `tsc` -> `ts-node scripts/generate-lanes.ts && tsc`; added `generate-lanes` script.

## Deviation: derivation moved to src/lane-derivation.ts (TS6059 mitigation)

The plan put `deriveFlowSequence` IN scripts/generate-lanes.ts and the test imported it `from '../../scripts/generate-lanes'`. But a src/ test importing scripts/ (outside the engine `rootDir: ./src`) breaks `tsc` with **TS6059** (probed + confirmed). The engine `tsc` baseline is clean (0 errors) and Step 7 wires `tsc` into `build`, so that would break `npm run build`. Fix: the derivation functions live in `src/lane-derivation.ts` (inside rootDir); the generator imports + re-exports them; the test imports from `../lane-derivation`. The derivation logic is byte-identical to the plan's; only the home/import path moved. tsc stays clean (verified 0 errors after additions). Same class of cross-rootDir limitation found in Task 8.

## Verification (REAL runs, all green)

- Pre-check: probed live VERB_REGISTRY -> deriveFlowSequence reproduces the golden table for ALL 6 lanes, and every chain verb has a guidanceAppend array.
- TDD red: test importing ../lane-derivation -> TS2307 (module missing); green after creating it -> `lane-derivation: OK`.
- Generate: `ts-node scripts/generate-lanes.ts` -> wrote both artifacts (exit 0). Generated flow sequences match the golden table EXACTLY (lane_build flowA,B,E,F,G,H,I,M,J; lane_ship flowK,I,L,V,M,J; lane_delight flowF,H,T,J,M; lane_live flowN,F,J,M,L,K; lane_calm flowJ,X,M; lane_converge flowJ,M,K,I,L).
- `--check` clean: exit 0 ("no JSON/derivation/doc drift").
- `--check` catches drift: appended `// drift` to lanes.generated.ts -> "DRIFT in sidecoach/src/lanes.generated.ts", exit 1; restored -> clean again. (Proved it FAILS, not just passes.)
- `cd sidecoach && npm test` -> 5 suite(s) passed, exit 0: intent-detector (8/8), engine classifier-parity (19), slash-phrase (OK), mcp-server classifier-parity via cwd (19), lane-derivation (OK). No bench suites. The Task 9 forward-declared 5th suite now runs.
- engine `tsc --noEmit`: 0 errors (unchanged from baseline).
- python classifier suite untouched: 35 passed, 0 failed.
- model-router-guard: pure derivation/codegen, no LLM/network.
- P1 --check scope: JSON + derivation + doc-section drift only (NOT prereq-edge/validator-registration - those are P2/P3). LANES.generated.md is the P1 stand-in; SKILL.md/CHEATSHEET.md markers are P4 (untouched).

## Files touched

- sidecoach/src/lane-derivation.ts (new)
- sidecoach/scripts/generate-lanes.ts (new)
- sidecoach/src/lanes.generated.ts (new, generated)
- sidecoach/LANES.generated.md (new, generated)
- sidecoach/src/__tests__/lane-derivation.test.ts (new)
- sidecoach/package.json (build prepends generation + generate-lanes script)
