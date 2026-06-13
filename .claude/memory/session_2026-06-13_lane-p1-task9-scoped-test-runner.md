---
name: Lane P1 Task 9 - scoped test runner wired to npm test
description: Replaced sidecoach `npm test` (single intent-detector suite) with a scoped explicit-list runner that also runs both TS parity guards (engine + mcp-server, the latter via cwd) + slash-phrase, skips forward-declared lane suites, excludes bench suites. npm test -> 4 suites pass, exit 0.
type: project
relates_to: [session_2026-06-13_lane-p1-task8-slash-phrase-resolution.md, session_2026-06-13_lane-p1-task7-ts-mirror-parity.md]
---

Collaborator: Jonah

Implemented **Task 9 only** of `docs/superpowers/plans/2026-06-13-lane-p1-classifier-tier.md` on branch `lane-p1-classifier-tier`. Committed 2 files.

## What was done

- `sidecoach/scripts/run-tests.ts` (new) - scoped, explicit-list runner. Each suite is `{rel, cwd?, required?}`. Required-missing -> exit 2; forward-declared-missing -> skip-with-warning; any run failure -> exit 1.
- `sidecoach/package.json` (modified) - `"test"`: `ts-node src/intent-detector.test.ts` -> `ts-node scripts/run-tests.ts`.

## Deviation from the plan's verbatim runner (justified, honors the Task 7/8 reviews)

The plan's Step-1 runner listed only intent-detector + slash-phrase + lane-derivation. But Tasks 7 and 8 (authored AFTER the plan) added TWO parity guards the runner MUST run or a classifier copy drifts unguarded. The team lead made this an explicit carry-forward. So the SUITES list is:
- `src/intent-detector.test.ts` (REQUIRED; lives OUTSIDE __tests__/ so a glob would drop it)
- `src/__tests__/classifier-parity.test.ts` (REQUIRED; engine classifier copy guard)
- `src/__tests__/slash-phrase.test.ts` (REQUIRED; /sidecoach phrase union + near-miss)
- `mcp-server/src/__tests__/classifier-parity.test.ts` (REQUIRED; **cwd=mcp-server** - separate package)
- `src/__tests__/lane-derivation.test.ts` (forward-declared, Task 10 - skip-with-warning until then)

## Reaching the mcp-server parity suite (the cross-package question)

The mcp classifier copy lives in a DIFFERENT package. Verified mcp-server's OWN runner (mcp-server/__tests__/run-tests.ts) globs `mcp-server/__tests__/*.test.ts`, NOT `mcp-server/src/__tests__/` - so `cd mcp-server && npm test` would NOT run my new mcp parity suite. Therefore the sidecoach runner runs it directly with `cwd=mcp-server` (so ts-node uses mcp-server's tsconfig + node_modules + relative imports). This guarantees all THREE classifier copies are guarded by one `npm test`.

## Excludes / scope

NOT a `src/__tests__/*.test.ts` glob: that would pull in ~88 unrelated suites and the two bench suites (t13-bench-harness, t16-bench-ledger) which only run under `--project benchmarks/tsconfig.bench.json` and FAIL under plain ts-node. The explicit list excludes them by not naming them - verified the run contains no bench suites.

## Verification (REAL run)

- baseline: `npx ts-node src/intent-detector.test.ts` -> exit 0, 100% (the suite we must not drop).
- `cd sidecoach && npm test` -> NPM_TEST_EXIT=0. Ran: intent-detector (8 passed, 0 failed, 100%); engine classifier-parity (19 cases OK); slash-phrase (OK); mcp-server classifier-parity via cwd=mcp-server (19 cases OK); lane-derivation SKIPPED ("not present yet"); "run-tests: 4 suite(s) passed".
- Confirmed NO bench suites pulled in (grep t13/t16/bench -> none).
- python classifier suite untouched: `python3 test_sidecoach_lanes.py` -> 35 passed, 0 failed.
- REQUIRED hard-fail (exit 2 on missing) + run-failure (exit 1) branches implemented; verified by inspection (not destructively triggered, to avoid removing a required file).
- model-router-guard: pure runner, no LLM/network.

## Files touched

- sidecoach/scripts/run-tests.ts (new)
- sidecoach/package.json (test script repointed)
