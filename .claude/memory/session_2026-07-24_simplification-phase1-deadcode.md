---
name: Simplification Phase 1 - dead-code removal (handlers + routers)
description: Executing Steps 1-2 + delete-side orphan tests of the simplification plan (dead handler dupes, dead router modules, processWithEntryPoint strip)
type: project
relates_to: [session_2026-07-24_simplification-plan.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Executing Phase 1 (dead-code removal ONLY) of the 2026-07-24 simplification plan
(`docs/superpowers/plans/2026-07-24-simplification-plan.md`). Scope: Step 1 (dead
handler duplicates), Step 2 (dead router modules + `processWithEntryPoint` strip),
and the DELETE side of the orphan-test triage (tests for code deleted in 1-2 only).
OUT of scope: Steps 3/4/5 (convergence-loop, built-never-wired, dev harnesses -
need Jonah glances), vocabulary collapse, mcp-server retirement.

**Plan-drift confirmed at kickoff (plan stamped `e378a632`, HEAD is `9074b537`):**
- src `.ts` file count is 297 (plan expected 296) - within noise.
- `t20-convergence-loop.test.ts` is NOW in the gate (`run-tests.ts:72`, required:true).
  The plan's Step 3 claimed it was NOT in the gate. Step 3 (convergence-loop delete)
  is out of my scope but its dead-proof has drifted - flag for a later phase.
- Every dead file re-verified by grep before deletion per the load-bearing rule.

**Executed (all dead-proven before deletion):**
- Step 1 - 5 dead handler modules removed: `flow-handlers-new-tiers.ts` (zero refs),
  `flow-handler-rapid-iteration/clone-match/constraint-design.ts` (zero refs; live twins
  Flow N/O/P handlers in `flow-handlers-tier3-tier4.ts`, which the orchestrator imports),
  `flow-handler-migration.ts` (imported only by 2 orphan tests).
- Step 2 - 5 dead router modules removed: `sidecoach-entry-point.ts`, `-cache.ts`,
  `command-routing-adapter.ts`, `sidecoach-skill.ts` (zero importers),
  `sidecoach-command.ts` (only importer was sidecoach-skill).
- Stripped dead `processWithEntryPoint` method (orchestrator 643-670, zero callers) + its
  now-unused import (SidecoachEntryPoint/globalEntryPoint/EntryPointRequest, used only in
  that method). Orchestrator otherwise untouched (Ground B wiring preserved).
- 5 orphan tests removed (NONE in run-tests.ts): `phase-g-block2-flows-qv`,
  `phase-g-block4-performance`, `phase-iv-entry-point`, `phase-iv-e2e-integration`,
  `phase3-completion`.
- 60 stale `dist/` compiled artifacts (15 files x .js/.js.map/.d.ts/.d.ts.map) removed -
  dist ships in the npm `files` allowlist and mirrors src, so compiled dead code would ship.

**run-tests.ts: NOT edited.** None of the 5 deleted tests were in the allowlist, so there
was nothing to remove and the gate count is invariant (matches plan's Step1/2 "75->75").

**Verify (real output):**
- `tsc --noEmit` exit 0; `generate-validators --check: OK (registry valid, no drift)`.
- `npm test` -> `run-tests: 76 suite(s) passed`, exit 0 (identical to pre-change baseline).
- Reachability-miss scan (beyond tsc): zero JSON/config refs, zero dynamic require/import,
  zero live references to any deleted class - all clean.
- `git diff --stat`: 81 files, 5840 deletions / 3 insertions. Src: 10 modules + orchestrator
  strip = 1643 non-test lines removed (matches plan est ~1613 + ~30 strip); 5 test files =
  1302 lines; dist = 60 files / 2895 lines.

**Why dist removal was in scope:** the task surface is the dead .ts + orchestrator strip +
run-tests.ts; dist is the direct build OUTPUT of those exact deleted files and ships in the
package, so removing the now-sourceless compiled artifacts completes the deletion. Reported
separately from the src prize for transparency.

**Codex cross-model review (deterministic wrapper, exit 0, 140s):** "No internal live-path
blocker found." Independently corroborated all 4 checks - no remaining refs, N/O/P/Q resolve
through flow-handlers-tier3-tier4.ts, the 5 deleted tests are not in the allowlist (Codex
also confirms true suite count = 76; a raw "77 rel" count is the interface-line `rel`), and
the import strip is safe. Codex also checked bin/scripts: `bin/sidecoach.js` loads
slash-command-router/registry/modes/flows/model-routing (none deleted); sidecoach-monitor /
-artifacts load `dist/sidecoach-orchestrator` (intact).
- ONE finding (external deep-imports): `files` ships all of `dist/` and there is no `exports`
  map, so a consumer could in theory `require('.../dist/sidecoach-entry-point')`. FOLD /
  evaluated NON-BLOCKING: package is UNPUBLISHED (`npm view` -> 404), so no external consumer
  exists; declared public surface is `main: dist/intent-detector.js` + `bin: sidecoach.js`,
  neither touching a deleted module; the deleted modules were dead to the package's own code.
  No code change (adding an `exports` map touches package.json = off-limits, and is a
  distributability/GAP4 concern owned elsewhere + Jonah's call - pre-existing, not introduced
  by Phase 1). Build (tsc 0) + test (76 green) evidence stands unchanged.

**Why (rationale):** dead-code removal proven by the tsc + 76-suite gate is the safest
maintainability win - unreachable code compiles into the shipped dist but is never required,
so removal is behaviour-preserving by construction. **How:** re-verified every plan-named
file with a full-package importer grep + a reachability-miss scan (JSON/dynamic-require/
class-name) before deleting; git rm; rebuilt; reran the gate; cross-model review.

**Dead code left for later phases (out of THIS scope):** Step 3 convergence-loop.ts (NOTE:
its dead-proof drifted - `t20-convergence-loop.test.ts` is now a LIVE gate suite, re-check
before deleting), Step 4 built-never-wired (reference-update-service, flow-domain-integration,
project-drift-detector - need Jonah glance), Step 5 dev harnesses (8 phase*/dogfood* files),
Step 6 orphan-test RE-ADD side (the 2 block-g tests also covered 5 live per-flow handlers
layout-optimization/typography-excellence/ambitious-motion/curate/all-seven-qa whose gate
coverage should be triaged), vocabulary collapse (Jonah decision), mcp-server retire (Jonah).

Collaborator: Jonah
