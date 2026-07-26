---
name: Orphan test triage (sidecoach ungated suites)
description: Categorized all 81 ungated sidecoach test files vs run-tests.ts; 0 dead/0 redundant, 52 live-ungated verified-green + proposed for gating, 21 routing DEFER, 1 broken, 5 slow, 2 bench
type: project
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests (ran every ungated suite twice; proposed set 52/52 green). LEAD-INTEGRATED 2026-07-26: added all 52 to scripts/run-tests.ts, full gate = 140 suites no-drop (88->140, ~40% more real coverage incl the build-report subsystem which had ZERO gated coverage). ts-node under-load flake did NOT bite this run; retry-once wrapper flagged as a follow-up if it recurs in CI. 21 routing tests + 1 broken jest-style + 1 stale craft-length test held for separate handling.
confidence: high
relates_to: [session_2026-07-24_simplification-plan.md, session_2026-07-25_routing-consolidation.md]
---

Triaged the ORPHAN TESTS the simplification audit flagged (run-tests.ts gates ~88 suites; many test files on disk never run). Did NOT edit run-tests.ts (lead owns it - entries PROPOSED), did NOT commit, did NOT delete anything.

**Authoritative count (script, not eyeball):** 162 `*.test.ts`/`*.test.mjs` on disk (excl node_modules/dist); 81 gated in the SUITES `.test.*` set; **81 ungated** (set-difference, `comm -23`). The other gated suites are `eval/migration-harness/*.mjs`, `eval/prose-ablation.mjs`, `eval/corpus-tool.mjs` - not `.test.*`, so not in the 162.

**Method:** (1) extracted every relative import of all 81 ungated files and resolved against src/ - **every import resolves to an existing module** (the one apparent miss, `claudemd-mandate-validator`, is a repo filename typo: the real file is `clausemd-mandate-validator.ts`, which exists and is imported correctly). So **NO test is DEAD-by-missing-module**. (2) Ran all 81 via a faithful runner mirroring run-tests.ts env isolation (temp HOME + PLAYWRIGHT_BROWSERS_PATH) capturing exit + wall-ms + output tail. (3) Re-ran the propose-to-gate set clean = 52/52 green.

**Category counts (81):** DEAD 0 | REDUNDANT 0 | LIVE-BUT-UNGATED 52 | DEFER (routing) 21 | BROKEN 1 | SLOW-but-green 5 | BENCH (intentionally excluded) 2.

**DELETED: nothing.** By the task's own gate ("verify imports resolve / truly test nonexistent or duplicated things") nothing qualifies: no ungated test imports a missing module, and none duplicates a GATED suite. Checked the two plausible dup pairs and both are NOT redundant: the only gated importer of `flow-composition` is `domain-validation-coverage.test.ts` (uses it incidentally for domain validation, doesn't cover the composition surface the phase-h-block* tests do); `phase-f-integration` vs `phase-f-integration-full` differ by 137 lines (mock context vs real PRODUCT.md fixture - complementary). Honoring "a wrongly-deleted test is worse than an ungated one."

**BROKEN (1):** `src/phase-iii-integration.test.ts` - jest-style (`describe`/`beforeEach`/`expect`/`jest.Matchers`), but the repo has **no jest/mocha/vitest** (only file in src using `describe(`); throws `describe is not defined` at runtime - has never been runnable under the plain-ts-node harness. Its target modules ARE live (flow-metrics-tracker, flow-performance-cache, flow-specific-validators all imported by sidecoach-orchestrator.ts; flow-conditional-router is itself unimported = separate dead-module question, out of scope). Because imports resolve it is NOT dead by the deletion gate - left in place. Recommend lead PORT the scenarios to the plain-assert style used everywhere else, or delete after confirming intent. **Concurrency note:** the routing teammate (session_2026-07-25_routing-consolidation.md) DELETED `src/flow-conditional-router.ts` and surgically edited this test to drop the now-dead import (both uncommitted in the working tree at HEAD ba60fe33) - so phase-iii no longer imports a missing module, but it is STILL jest-style and STILL fails `describe is not defined`. Coordinate BROKEN/phase-iii + the whole DEFER list with that teammate, whose consolidation IS the routing refactor this triage defers to.

**DEFER - routing / command-resolution / verb-registry / intent / disambiguation (21; another teammate is refactoring routing - do NOT touch):**
intent-detector-tiebreak, sprint7-intent-detector-flowwx, sprint5-disambiguation-{silent-tiebreak,e2e-resolution,prompt-path}, sprint5-force-flowid-bypass, slash-command, orchestrator-slash-command, sprint8-router-registry-branch, sprint8-verb-parity, sprint8-registry-shape, sprint8-list-and-help, sprint11-craft-chain-includes-motion-a11y, sprint12-craft-chain-includes-research, task8-list-command-taxonomy, task10-flow-n-justify, task11-interactive-menu, sprint2-orchestrator-getHandlers, sprint7-composite-parser-both-forms, sprint3-process-path, sprint2-integration.
Borderline (routing-adjacent; deferred conservatively, lead may reclaim to LIVE if the refactor doesn't touch them): sprint2-integration, sprint2-orchestrator-getHandlers, sprint3-process-path, sprint7-composite-parser-both-forms.
**sprint12-craft-chain-includes-research is currently RED:** deterministic fail on a stale hardcoded `craft.flowIds.length === 8` - actual craft chain now has **11** flows (all content/order/checklist assertions pass). The routing lead should update 8->11 (or make it length-agnostic) when reconciling the craft chain. sprint5-force-flowid-bypass is green (a batch-load ts-node flake, see below).

**SLOW-but-green (5) - gate-worthy content, flag gate-cost (lead: gate anyway or move to a slow/nightly lane):**
sprint4-build-report-single-opt-in (**44s**, spawns CLI children repeatedly), sprint3-orchestrator-enrich-before-canexecute (26s), sprint4-build-report-cli (8s), t12-model-routing (9.4s - MODEL-tier routing, a distinct subsystem, NOT command-resolution; likely not in the routing refactor - confirm with that teammate), t9-retry-control (9.2s).

**BENCH (2) - not orphans, intentionally excluded:** t13-bench-harness, t16-bench-ledger. run-tests.ts documents they only compile under benchmarks/tsconfig.bench.json. (They happened to pass under plain ts-node in this run, but leave the documented exclusion as-is.)

**LIVE-BUT-UNGATED (52) - real unique coverage, propose gating, VERIFIED GREEN TWICE (81-file batch + clean 52-file confirmation, 52/52).** Biggest unique-coverage gaps currently ungated: the **build-report** subsystem (aggregator/grading/renderer/memory-input/composite/single-opt-in/cli - build-report has ZERO gated coverage), **checkpoint** (store-isolated/resume/write-on-step/engine-gc), **flow-composition** phase-h-block1..7, **taste-validator** (observer-race/tailwind-tokens/result - the orchestrator-side validator, distinct from the gated rendered-scanner taste tests), **motion-stack** (detection/idioms/integration), **parsers** (design-md/product-md/context-loader/camelcase), and phase-f/flows-a-i handler integration. Exact paste-ready SUITES entries (ts-node default; the 2 eval files use `runner: 'node'`) captured in the report to the lead.

**ts-node flake caveat (real, flag for integration):** in the 81-file back-to-back batch, 2 suites (sprint5-force-flowid-bypass, sprint6-checkpoint-engine-gc) spuriously failed with TS2304 "cannot find name" compile errors; both PASS reliably in isolation AND in the clean 52-run. This is a transient ts-node-compile-under-load issue (run-tests.ts already uses the same execFileSync-per-suite pattern, so it is already exposed). Adding 52 more ts-node suites lengthens the gate and widens exposure to this transient - worth a retry-once wrapper if it bites.

**Files touched:** none in the repo (analysis only; scratchpad scripts + this beat + MEMORY.md index).
