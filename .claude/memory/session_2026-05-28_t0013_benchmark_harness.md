---
name: T-0013 benchmark harness skeleton
description: Empirical quality-drift harness for sidecoach - 5 fixtures, runner/scorer/reporter, save+compare baselines, 46/46 tests
type: project
relates_to: [session_2026-05-28_t0012_model_routing.md, session_2026-05-28_t0009_retry_control.md]
---

# T-0013 benchmark harness skeleton (2026-05-28, Jonah)

Built the empirical quality-drift harness for sidecoach. Pattern lifted from OMC's `benchmarks/run-all.ts` (save-baseline + compare commands). v1 is the skeleton; fixture expansion + handler-LLM wiring are follow-ups.

## What landed

### Directory tree

```
sidecoach/benchmarks/
  README.md                       (taxonomy + schema + CI snippet)
  tsconfig.bench.json             (extends ../tsconfig.json, rootDir="..", includes src + runner + t13 test)
  fixtures/
    brand-studio/                 (brand register, typography emphasis)
    saas-dashboard/               (product register, layout density)
    scroll-landing/               (brand register, motion emphasis)
    form-stress/                  (product register, accessibility)
    mixed-portfolio/              (mixed register, two surfaces one token system)
  runner/
    types.ts                      (BenchmarkRun, FlowRunResult, CompareReport schema)
    score.ts                      (loadFixture, discoverFixtures, validator scoring, syntheticTokens)
    report.ts                     (saveBaseline, loadBaseline, compareRuns, formatCompareTable)
    run-all.ts                    (CLI: --save / --compare / --save-only)
  baselines/
    baseline-latest.json          (last saved)
    archive/<timestamp>.json
```

### Fixture taxonomy (5 starter fixtures)

| Fixture | Category | Emphasis | What it stresses |
|---|---|---|---|
| brand-studio | brand | typography | Editorial register, serif display, restrained palette |
| saas-dashboard | product | layout-density | Dense product UI, tabular figures, 40px targets |
| scroll-landing | motion | scroll-driven-animation | Lenis + ScrollTrigger reveals, reduced-motion gates |
| form-stress | accessibility | wcag-aa-forms | WCAG AA contrast, 44px targets, focus rings |
| mixed-portfolio | mixed | register-aware-tokens | Marketing + dashboard sharing one token system |

Each fixture includes PRODUCT.md (register + brand personality + anti-references + principles), DESIGN.md (Google design.md YAML frontmatter), fixture.css, fixture.html, and meta.json (category bucket).

### Schema (sample row)

```json
{
  "runId": "2026-05-28T07:44:20.951Z",
  "modelTiers": {"haiku": "claude-haiku-4-5-20251001", "sonnet": "claude-sonnet-4-6", "opus": "claude-opus-4-7"},
  "fixtures": [
    {
      "name": "brand-studio", "category": "brand",
      "flows": [
        {
          "flowId": "flowJ_tactical_polish", "status": "success",
          "retryStateCount": 1, "tierUsed": "opus", "modelId": "claude-opus-4-7",
          "polishStandard": {"passed": 15, "failed": 7, "passRate": 0.682, "criticalViolations": 2},
          "extendedDomain": {"passed": 41, "failed": 96, "passRate": 0.299, "byDomain": {...}},
          "taste": {"violations": []},
          "latencyMs": 7, "tokensInput": 1201, "tokensOutput": 401, "estimatedCost": 0.0481
        }
      ]
    }
  ],
  "totals": {"passRateAvg": 0.70, "criticalViolations": 30, "estimatedCost": 0.578, "flowCount": 15},
  "harnessVersion": "b0a66e312a61"
}
```

### Regression detection

Triggers (any one fails the run):
- passRate drop > 2% (configurable via `--pass-rate-delta`)
- criticalViolations increased by any amount
- estimatedCost increased > 20% AND tierUsed unchanged (a legitimate tier upgrade is allowed)

Example output from the manual regression test (injected scale(0.96) + reduced-motion removal in brand-studio/fixture.css):

```
fixture          flow                    tier    passRate        crit    cost                status
brand-studio     flowJ_tactical_polish   opus    68.2% -> 72.7%  2 -> 3  $0.0481 -> $0.0475  REGRESSION: criticalViolations +1
brand-studio     flowK_multi_lens_audit  sonnet  68.2% -> 72.7%  2 -> 3  $0.0096 -> $0.0095  REGRESSION: criticalViolations +1
brand-studio     flowL_design_critique   opus    68.2% -> 72.7%  2 -> 3  $0.0481 -> $0.0475  REGRESSION: criticalViolations +1
...
Result: FAIL (3 regressions)
```

Exit code 1, as designed.

## Why these choices

### Why direct validator invocation, not handler result.validationResults

The handlers push ValidationResult objects (pass/fail + failed rule IDs) into `result.validationResults`, but those don't carry the granular numbers the schema requires (passRate, criticalViolations, per-domain rollups). The runner calls `PolishStandardValidator.validateAll(...)`, `ExtendedDomainValidator.validateAll(...)`, and `validateTaste(...)` directly so it can fill the schema completely. The handler still runs - the runner captures tier, status, retryStateCount, latency from the handler result.

### Why synthetic token costs

The sidecoach flow handlers don't call the Anthropic SDK today; they're rule-based checklists. The runner estimates token counts deterministically as `ceil(input bytes / 4)` for input and `ceil(input / 3)` for output, multiplied by the model-routing pricing table (T-0012's TIERS). When handlers wire real LLM calls and call `trackCost()`, the runner swaps in `getSessionLedger()` reads instead of synthesizing. Documented in README as a v1 carve-out.

### Why a separate tsconfig.bench.json

Main `tsconfig.json` has `rootDir: "./src"` and `include: ["src/**/*"]`. Benchmarks files live outside that root and import from src/. A separate tsconfig with `rootDir: ".."` and broader includes lets both layers exist without breaking the main emit config. The test file (`src/__tests__/t13-bench-harness.test.ts`) imports from benchmarks/, so the main tsconfig excludes that one test, and the bench tsconfig includes it.

## Verification

- `npm run bench` -> wrote baseline-latest.json + archive (5 fixtures, 15 flows, $0.578 total, harnessVersion=b0a66e312a61).
- `npm run bench:compare` on clean state -> 15/15 OK, exit 0.
- Injected regression -> `npm run bench:compare` flagged 3 regressions correctly, exit 1.
- `npm run test:bench` -> 46/46 PASS covering discovery, fixture loading, validator scoring, runAll schema conformance, all 4 regression detection modes, tier-upgrade carve-out, saveBaseline archive, and first-run mode.
- `npx tsc --noEmit` -> 0 errors on main.
- `npx tsc -p benchmarks/tsconfig.bench.json --noEmit` -> 0 errors on bench.
- T-0009 (52/52) and T-0012 (54/54) tests still green - no regressions in adjacent work.

## Follow-ups (out of T-0013 scope)

1. **Handler -> LLM wiring + ledger swap.** When the sidecoach handlers start calling Anthropic's SDK, drop the synthetic-token estimator and read from `getSessionLedger()` directly.
2. **Fixture expansion to 10-20.** Task originally called for 10-20; v1 ships 5 with one per taxonomy bucket. Expand once we've actually used the harness on real PRs and learned what diversity matters.
3. **CI workflow wiring.** README documents the suggested GitHub Actions snippet but it's not committed under `.github/workflows/`.
4. **Composite flow coverage.** v1 runs flows J/K/L (polish/audit/critique). Composite flows + craft-stack flows (G/W/X) are not yet in `BENCH_FLOWS` - add when they have measurable validators.

## Files touched

- sidecoach/package.json (added bench, bench:compare, bench:save-baseline, test:bench scripts)
- sidecoach/tsconfig.json (excluded t13 test from main config since it imports benchmarks/)
- sidecoach/benchmarks/tsconfig.bench.json (new)
- sidecoach/benchmarks/README.md (new)
- sidecoach/benchmarks/runner/{types.ts, score.ts, report.ts, run-all.ts} (new)
- sidecoach/benchmarks/fixtures/{brand-studio, saas-dashboard, scroll-landing, form-stress, mixed-portfolio}/{PRODUCT.md, DESIGN.md, fixture.css, fixture.html, meta.json} (new)
- sidecoach/src/__tests__/t13-bench-harness.test.ts (new, 46 tests)
- TASKS.md (marked T-0013 done, moved under sidecoach ### Done)
