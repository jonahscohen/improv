---
name: T-0016 benchmark runner ledger-aware wiring
description: Bench runner now prefers T-0012 live cost ledger over synthetic estimator, with tokenSource per-flow flag
type: project
relates_to: [session_2026-05-28_sprint4_closed.md]
---

T-0016 shipped 2026-05-28 (Jonah). Bench harness from T-0013 now reads the T-0012 cost ledger to source token counts + cost per flow row, with mechanical detection between live and synthetic paths.

**What changed:**

- `sidecoach/benchmarks/runner/run-all.ts` -- `runFlowOnFixture` flow:
  1. `resetLedger()` BEFORE `handler.execute()` (was after - critical bug; the old order would have silently discarded any live entries a future LLM-wired handler emitted).
  2. Run the flow.
  3. `getSessionLedger().filter(e => e.flowId === flowDesc.flowId)` after.
  4. If non-empty -> LIVE path: sum tokensInput, tokensOutput, estimatedCost from those entries. Use the entry's `model` + `tier` directly (overrides applyModelSelection's prediction if a handler downgraded mid-call under budget pressure). Stamp `tokenSource: 'live'`.
  5. If empty -> SYNTHETIC fallback: call `estimateSyntheticTokens(fixture)`, then `trackCost(flowId, modelId, in, out)` so the ledger shape mirrors the live path. Sum the resulting entry. Stamp `tokenSource: 'synthetic'`.

- `sidecoach/benchmarks/runner/types.ts` -- `FlowRunResult.tokenSource: 'live' | 'synthetic'` added with full inline docs explaining when each path triggers.

- `sidecoach/src/__tests__/t16-bench-ledger.test.ts` -- 25/25 PASS. Coverage:
  - Live path: handler calls `trackCost` once, runner uses live numbers + sonnet pricing math verified against `(4000/1e6)*3 + (1200/1e6)*15`.
  - Synthetic fallback: handler emits nothing, runner falls back to byte-length estimator with 3:1 in:out ratio, writes one synthetic CostEntry for shape parity.
  - Mixed run: flowJ live + flowL synthetic in sequence, each row carries its own tokenSource.
  - Ledger reset: stale flowJ entry seeded before flowK runs - runner wipes it before flowK, flowK still goes synthetic, ledger contains zero flowJ entries after.
  - Multi-call live: handler calls `trackCost` twice, tokens summed (3000 in, 900 out).
  - Error path: handler throws, status=error, tokenSource still set to 'synthetic'.

- `sidecoach/src/__tests__/t13-bench-harness.test.ts` -- `synthRun` helper updated with `tokenSource: 'synthetic'`; new schema check verifies every flow row has `tokenSource` one of 'live'/'synthetic'. 46/46 still PASS.

- `sidecoach/benchmarks/README.md` -- new "Token source" section explains the detection logic + forward-compat semantics. Sample schema gained the field. Limitations bullet now points at the section instead of duplicating the explanation.

**Why this is structured this way:**

Handlers today never call `trackCost` -- the rule-based polish/audit/critique flows run validator checklists, not LLM invocations. So every row in baseline-latest.json today reports `tokenSource: 'synthetic'`. The point of T-0016 is to be ready: the moment a flow handler wires an Anthropic SDK call and records the response with `trackCost(flowId, model, in, out)` during execute(), the corresponding row in the next bench run flips from 'synthetic' to 'live' with no further code change in the runner.

This makes the runner forward-compatible without speculative complexity. The detection is mechanical (filter the ledger by flowId), the schema is stable (both paths produce identical FlowRunResult shapes), and the field is visible (compare-mode diff can filter by tokenSource so cost spikes on synthetic rows aren't mistaken for API spend regressions).

**How verified:**

- t16-bench-ledger.test.ts: 25/25 PASS
- t13-bench-harness.test.ts: 46/46 PASS (regression-clean after synthRun update)
- t12-model-routing.test.ts: 54/54 PASS (regression-clean)
- End-to-end: `ts-node --transpile-only --project benchmarks/tsconfig.bench.json benchmarks/runner/run-all.ts --save` produced baseline-latest.json with 15/15 rows showing `tokenSource: "synthetic"`. Sample row at brand-studio/flowJ_tactical_polish: tier=opus, modelId=claude-opus-4-7, tokensInput=1201, tokensOutput=401, estimatedCost=$0.0481, tokenSource='synthetic'.
- tsc on my own files: 0 errors.

**Cross-teammate friction:**

`npm run bench` (full type check) is currently blocked by T-0015's mid-stream `flows.ts` edits breaking `FlowId` in flow-handler.ts + sidecoach-orchestrator.ts + slash-command-router.ts. Those are out-of-scope per task brief; T-0015 will resolve when their legacy-flow cull finishes. Transpile-only runs cleanly end-to-end, which proves the runtime semantics work; full-tsc will go green automatically once T-0015 lands.

**Hook bug observed and flagged:**

`~/.claude/hooks/verify-before-done.sh` was broken mid-conversation -- a Python heredoc embedded in the bash script appeared truncated, causing bash to interpret Python regex literals as commands at lines 222-287. T-0017 was filed and shipped by another teammate during this session to fix exactly this. By the end of T-0016 the hook was repaired.

**Files touched:**

- sidecoach/benchmarks/runner/run-all.ts
- sidecoach/benchmarks/runner/types.ts
- sidecoach/benchmarks/README.md
- sidecoach/src/__tests__/t13-bench-harness.test.ts
- sidecoach/src/__tests__/t16-bench-ledger.test.ts (new)
- TASKS.md (T-0016 filed under sidecoach > Active then moved to Done)
- .claude/memory/MEMORY.md (this beat's index entry)
- .claude/memory/session_2026-05-28_t0016_bench_ledger_wire.md (this beat)
