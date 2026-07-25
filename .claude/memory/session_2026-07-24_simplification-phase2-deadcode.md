---
name: Simplification Phase 2 - dead-code removal (Steps 3/4/5) + re-verify
description: Executing plan Steps 3-5 against current HEAD; convergence-loop re-verified NOT dead (kept), 8 dev harnesses deleted, built-never-wired reported for Jonah
type: project
relates_to: [session_2026-07-24_simplification-phase1-deadcode.md, session_2026-07-24_simplification-plan.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests
confidence: high
---

Executing Phase 2 (Steps 3, 4, 5) of the 2026-07-24 simplification plan
(`docs/superpowers/plans/2026-07-24-simplification-plan.md`, stamped `e378a632`).
HEAD at execution: `1aa41af6`. THE RULE: the plan drifted (mcp-server retirement +
vocab collapse + taste stages landed since the stamp), so every dead-proof was
RE-VERIFIED at current HEAD before acting, not trusted from the plan.

**Baseline (protected number): `tsc --noEmit` exit 0; `run-tests.ts` = 79 suite(s)
passed, exit 0.** NOT the plan's 75 nor phase 1's 76 - the tree grew (palette/roll/
taste suites added, mcp-server retire dropped one). `npm test` was NOT used as the
gate here because it runs `npm run build` (plain `tsc`, emits to dist), and dist is
the lead's to rebuild at integration; ran `npx ts-node scripts/run-tests.ts` directly
(no build, no dist emit) + `npx tsc --noEmit` as the compile proof instead.

**Step 3 - convergence-loop.ts: RE-VERIFIED NOT DEAD. KEPT (plan overstatement).**
The plan claimed its only consumer `t20-convergence-loop.test.ts` is NOT in the gate.
At current HEAD that is FALSE: `src/convergence-loop.ts`'s only importer is
`src/__tests__/t20-convergence-loop.test.ts:22` (`from '../convergence-loop'`), and
that test is `required: true` at `scripts/run-tests.ts:69`. So convergence-loop is
reached by a REQUIRED gate suite - deleting it would drop the gate. Not deleted. This
is exactly the drift phase 1 flagged; confirmed and closed.

**Step 5 - dev harnesses: 8 DELETED (all dead-proven).** Zero live importers under src
(grep, excluding self), absent from the run-tests.ts allowlist, and a whole-package
reachability scan (bin/scripts/package.json/eval/*.mjs/*.json) found only `dist/*`
build artifacts + prose mentions of 4 of them in `PHASES_1_TO_4_COMPLETE.md`. Deleted:
`phase-ii-verification.ts`, `phase2-flow-test.ts`, `phase3-reference-integration-test.ts`,
`phase4-orchestration-e2e-test.ts`, `phase4-stress-test-yes-and.ts`, `dogfood-runner.ts`,
`dogfood-craft-step2.ts`, `dogfood-teach-step1.ts`. Prize: 8 files, 1,166 non-test lines
(plan est. 1,163). None had a companion test (nothing imports them), so no tests removed.

**Step 4 - built-never-wired: REPORTED for Jonah, NOT deleted (per instruction).**
- `reference-update-service.ts` (337 lines): ZERO importers anywhere (no src, no test,
  no config). Provably dead candidate - deferred to lead's decision.
- `flow-domain-integration.ts` (124 lines): ZERO importers anywhere. Provably dead
  candidate - deferred to lead's decision.
- `project-drift-detector.ts` (84 lines): 2 test importers, BOTH UNGATED -
  `src/__tests__/sprint1-integration.test.ts:2` and
  `src/__tests__/project-drift-detector.test.ts:1` (both import `detectTokenDrift`;
  neither is in run-tests.ts). Zero live importers. Test-only, no gated coverage.

**Verify (real output):**
- `npx tsc --noEmit` exit 0 post-deletion (proves nothing live referenced any deleted
  file - the load-bearing behaviour-preservation proof).
- `run-tests.ts` = 79 suite(s) passed, exit 0 (INVARIANT 79 -> 79; deleted files are
  not gated and not imported by any gate suite).
- `git diff --stat`: 8 files changed, 1,166 deletions, 0 insertions.
- Foreground Codex review (codex-cli 0.142.5, read-only sandbox): "No live-path blocker
  found." Independently corroborated all 5 checks (no static import, no dynamic/config
  reach, none in run-tests.ts SUITES, tsc --noEmit 0, package main/bin/exports untouched)
  and confirmed the 4 deferred files (convergence-loop + the 3 built-never-wired) remain
  present and out of the diff. ZERO findings to fold.

**run-tests.ts NOT edited** (constraint: lead removes entries at integration to avoid
shared-file contention). Nothing to remove anyway - none of the deleted files nor any
absent test were in the allowlist, so the gate count is invariant. No entries to report
for removal.

**dist NOT touched** (constraint: lead rebuilds at integration). The 8 deleted harnesses
still have stale `dist/*.js/.d.ts/.map` artifacts (32 files); they compile-mirror the now-
deleted src and will be regenerated/dropped when the lead runs `npm run build`.

**Flagged, not fixed:** `PHASES_1_TO_4_COMPLETE.md` (a historical status doc, not in my
file-ownership) carries prose references to `phase2-flow-test.ts`,
`phase3-reference-integration-test.ts`, `phase4-orchestration-e2e-test.ts`,
`phase4-stress-test-yes-and.ts`. Those lines are now stale but are prose, not code reach.

**Why (rationale):** dead-code removal proven by `tsc --noEmit` + the 79-suite gate is the
safest maintainability win - unreachable modules compile into dist but are never required,
so removal is behaviour-preserving by construction. **How:** re-verified every plan-named
file at current HEAD with a per-file importer grep + a whole-package reachability-miss scan
before deleting; plain `rm` (left as unstaged deletions for the lead to stage); reran
tsc + the gate; foreground cross-model review. Step 3 re-verify caught the plan's stale
dead-proof and stopped the delete.

**Not committed.** Working tree holds 8 unstaged deletions for the lead's integration pass.

Collaborator: Jonah
