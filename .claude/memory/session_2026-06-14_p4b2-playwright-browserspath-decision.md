---
name: P4b-2 decision - wire PLAYWRIGHT_BROWSERS_PATH so the real-browser test runs in npm test
description: P4f's HOME-isolation in run-tests.ts (HOME=temp) breaks Playwright cache resolution ($HOME/Library/Caches/ms-playwright), so the collector real-browser test SKIPs inside npm test (runs standalone). Decision - set PLAYWRIGHT_BROWSERS_PATH to the real shared cache in run-tests.ts before the HOME override so the committed gate actually exercises the collector
type: decision
relates_to: [session_2026-06-14_p4b2-plan-approved.md, session_2026-06-14_p4f-COMPLETE.md]
---

During P4b-2 Task 2, impl-p4b2 found a real interaction between two things we built:
P4f's run-tests.ts HOME-isolation (sets HOME=temp so lane-FINALIZE flow-history
writes do not pollute real ~/.claude) breaks Playwright's browser resolution
(Playwright looks under $HOME/Library/Caches/ms-playwright). Under the temp HOME the
shared cache is not found -> the collector real-browser test prints
"browser-evidence-collector: SKIP (Executable doesn't exist...)" and exits 0 INSIDE
npm test, though STANDALONE it runs real Chromium and passes (real concentric pass,
hit-area fail, low-contrast fail). The shared cache IS present; this is a
HOME-resolution issue, not a can't-launch failure.

Problem: with the test skipping inside the committed `npm test` gate, P4b-2's CORE
path (real browser collection) would never be exercised by the gate - only by a
manual standalone run. That is a real coverage gap.

Choice made: set process.env.PLAYWRIGHT_BROWSERS_PATH to the REAL shared cache in
run-tests.ts, captured from the real HOME (the OS default ms-playwright location)
BEFORE the HOME=temp override. Spawned suites (execFileSync inherits env) then
resolve Chromium from the shared cache regardless of the temp HOME, so the
real-browser test RUNS inside npm test (real committed-gate coverage) AND flow-history
HOME-isolation is preserved. Portable: where the cache does not exist (other
machines/CI), PLAYWRIGHT_BROWSERS_PATH points at a missing dir -> Playwright cannot
find Chromium -> the test SKIPs gracefully (required:true, exit 0). No regression.

**Alternatives considered:**
- Accept SKIP-inside-npm-test (impl's offered default): rejected - leaves the core
  collector path untested by the committed gate.
- Set PLAYWRIGHT_BROWSERS_PATH in the test file / collector: rejected - the runner
  already owns the temp-HOME env setup; one place (run-tests.ts) is cleaner and
  keeps the collector free of machine paths.

**Why:** the real browser path is the whole point of P4b-2; it must be exercised by
npm test. Low-risk (headless, tiny data: URL, 10s timeout, deterministic) and
degrades to skip where no cache.

**Revisit when:** Playwright changes its cache-resolution env, or run-tests stops
isolating HOME.

Collaborator: Jonah.
