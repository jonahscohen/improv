---
name: sidecoach audit - the "342 failing tests" was a wrong-runner false alarm
description: Audit of commit 09d19d55 found sidecoach fully green; the reported 342 test failures were a vitest-style glob run against plain ts-node scripts
type: project
relates_to: [session_2026-07-17_sidecoach.md, decision_sidecoach_mcpserver_fate.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests (npm test 66/66, tsc clean, build byte-identical, 5/5 eval snapshots)
confidence: high
---

Audited commit 09d19d55, which was landed as "unverified" with a report that sidecoach's
suite "does not run to completion - 342 test files fail with import errors and no tests."

## The 342 failures were not real

Root cause: wrong test runner. Sidecoach's suite is `ts-node scripts/run-tests.ts` - an
explicit hand-maintained list of 66 suites of PLAIN ts-node scripts. Zero of the 147 files
in `src/__tests__/` use `describe`/`it`; there is no jest or vitest in the package.

A vitest-style glob (`test|spec` x `ts|js|mjs|cjs`, excluding node_modules) over sidecoach
matches EXACTLY 342 files. Running that glob reports every file as "No test suite found"
= "no tests", plus import errors. The number matched the hypothesis exactly, which is what
confirmed it.

**Why:** the prior session reached for a conventional runner instead of reading
`package.json`'s `test` script. The suite was never broken.

## Actual verified state (all green)

- `npm test` -> 66/66 suites passed, 0 failed
- `tsc --noEmit` -> clean
- `npm run build` -> regenerates dist/ BYTE-IDENTICAL to committed (git status: 0 changes).
  The "dist/ went in mid-edit" concern is unfounded; dist/ is consistent with src/.
- All 5 eval snapshot harnesses verify OK: scanner (absolute-bans), reference, routing,
  convergence, buildreport.

## The one REAL finding: coverage gap on the commit's headline changes

`absolute-ban-detector.ts` (71 lines changed) and `reference-loader.ts` (55 lines changed)
have ZERO unit tests - no test file exists for either, anywhere. Their only coverage is
`eval/migration-harness/*-snapshot.mjs`, which `npm test` does NOT run (grep count: 0).

So `npm test` going green does not exercise the two headline modules in that commit. They
happen to be correct (verified by running the eval harness by hand), but nothing in the
default gate would have caught a regression.

**Systemic cause:** `run-tests.ts` is an explicit hand-maintained SUITES array, chosen
deliberately over a glob (the file's own comment explains why: a glob would drop
`src/intent-detector.test.ts`, pull in ~88 unrelated suites, and break on the two bench
suites needing `tsconfig.bench.json`). The tradeoff is that new modules are invisible to
the gate until someone hand-adds them. The eval harness is a second, entirely separate
uncovered gate.

**How to apply:** when a sidecoach module is added or changed, hand-add its suite to
SUITES in `scripts/run-tests.ts`, or its coverage does not run. Consider wiring
`eval/migration-harness/*-snapshot.mjs verify` into `npm test`.

## Self-analysis (why the prior session got this wrong)

The failure mode was diagnosing from a tool's output instead of from the project's own
declared entry point. `package.json` names the runner in one line. Reaching for the
conventional runner (vitest/jest) and then attributing its 342 "no tests" errors to
"environmental" problems in sidecoach inverted the causality: the runner was the variable,
not the environment. The Debugging Protocol's "identify what changed" applies to the
harness too - a suite that has never run under vitest is not a suite that regressed.

Second failure: "couldn't isolate it without touching their tree again, so I stopped" -
running `npm test` is a read-only observation, not a tree modification. The caution was
misapplied and cost a full verification pass.

## Files touched

None. Audit only - the tree is byte-identical to 09d19d55 after a full rebuild.
