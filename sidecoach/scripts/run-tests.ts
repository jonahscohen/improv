import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const SIDECOACH = path.resolve(__dirname, '..');

// P1 scope: an EXPLICIT, scoped suite list - NOT a `src/__tests__/*.test.ts` glob.
// A glob would (a) DROP src/intent-detector.test.ts (it lives outside __tests__/),
// (b) pull in ~88 unrelated suites, and (c) pull in the two bench suites
// (t13-bench-harness, t16-bench-ledger) that only compile under
// `--project benchmarks/tsconfig.bench.json` and FAIL under plain ts-node.
//
// There are THREE copies of the lane classifier (Python / mcp-server / engine)
// kept in sync ONLY by parity tests against the shared corpus. The runner MUST
// run BOTH TS parity suites + the slash-phrase guard, or a copy drifts unguarded.
// The mcp-server parity suite lives in a DIFFERENT package, so it runs with
// cwd=mcp-server (its own tsconfig + ts-node). NOTE: mcp-server's own `npm test`
// does NOT cover it - that runner globs mcp-server/__tests__/, not
// mcp-server/src/__tests__/ - which is exactly why this runner reaches it here.
//
// Forward-declared lane suites (created in later plan tasks) are SKIPPED-with-
// warning until they exist; REQUIRED suites hard-fail (exit nonzero) if missing.
interface Suite { rel: string; cwd?: string; required?: boolean; }
const SUITES: Suite[] = [
  { rel: 'src/intent-detector.test.ts', required: true },                                 // legacy; outside __tests__/ - must not be dropped
  { rel: 'src/__tests__/classifier-parity.test.ts', required: true },                     // engine classifier copy guard (Task 7/8)
  { rel: 'src/__tests__/slash-phrase.test.ts', required: true },                          // /sidecoach phrase union + near-miss (Task 8)
  { rel: 'mcp-server/src/__tests__/classifier-parity.test.ts', cwd: 'mcp-server', required: true }, // mcp-server classifier copy guard (separate package)
  { rel: 'src/__tests__/lane-derivation.test.ts', required: true },                       // verbSteps derivation (Task 2)
  { rel: 'src/__tests__/lane-types.test.ts', required: true },
  { rel: 'src/__tests__/lane-checkpoint-store.test.ts', required: true },
  { rel: 'src/__tests__/lane-checkpoint-migration.test.ts', required: true },
  { rel: 'src/__tests__/lane-lock.test.ts', required: true },
  { rel: 'src/__tests__/lane-lease.test.ts', required: true },
  { rel: 'src/__tests__/lane-validator-gating.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-concurrency.test.ts', required: true },
  { rel: 'src/__tests__/lane-side-effect-outbox.test.ts', required: true },
  { rel: 'src/__tests__/lane-flow-history-publisher.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-start.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-advance-sequence.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-transitions.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-skip-prereq.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-status-list.test.ts', required: true },
  { rel: 'src/__tests__/lane-engine-methods.test.ts', required: true },
  { rel: 'src/__tests__/slash-phrase-wiring.test.ts', required: true },
  { rel: 'src/__tests__/lane-cli.test.ts', required: true },
  { rel: 'src/__tests__/lane-execution-e2e.test.ts', required: true },
  { rel: 'src/__tests__/lane-convergence-types.test.ts', required: true },          // P4c convergence sub-state types
  { rel: 'src/__tests__/lane-converge-policy.test.ts', required: true },            // P4c lane policy + loop helpers
  { rel: 'src/__tests__/lane-convergence.test.ts', required: true },                // P4c pure convergence module
  { rel: 'src/__tests__/lane-loop-start.test.ts', required: true },                 // P4c lane_converge starts + seeds convergence
  { rel: 'src/__tests__/lane-loop-advance.test.ts', required: true },               // P4c loop advisory step advance
  { rel: 'src/__tests__/lane-loop-boundary-converge.test.ts', required: true },     // P4c boundary converged path
  { rel: 'src/__tests__/lane-loop-boundary-continue.test.ts', required: true },     // P4c boundary continue/stall/skip-no-bypass
  { rel: 'src/__tests__/lane-loop-retry-iteration.test.ts', required: true },       // P4c retry preserves the pending iteration
  { rel: 'src/__tests__/lane-loop-prereq-propagation.test.ts', required: true },    // P4c loop-complete propagates successfulFlowIds
  { rel: 'src/__tests__/lane-convergence-preflight.test.ts', required: true },      // P4c coverage-plan preflight
  { rel: 'src/__tests__/lane-converge-e2e.test.ts', required: true },               // P4c real-fixture convergence e2e
  { rel: 'src/__tests__/t20-convergence-loop.test.ts', required: true },            // P4c renamed convergence-loop diagnostic + truthful-convergence fix
  { rel: 'src/__tests__/product-rule-registry.test.ts', required: true },
  { rel: 'src/__tests__/flow-validation-capabilities.test.ts', required: true },
  { rel: 'src/__tests__/generate-validators.test.ts', required: true },
  { rel: 'src/__tests__/clean-evaluator.test.ts', required: true },
  { rel: 'src/__tests__/project-collector.test.ts', required: true },
  { rel: 'src/__tests__/product-validator-pipeline.test.ts', required: true },
  { rel: 'src/__tests__/polish-checks.test.ts', required: true },
  { rel: 'src/__tests__/a11y-checks.test.ts', required: true },
  { rel: 'src/__tests__/browser-evidence-rules.test.ts', required: true },
  { rel: 'src/__tests__/browser-evidence-collector.test.ts', required: true },
  { rel: 'src/__tests__/browser-evidence-degradation.test.ts', required: true },
  { rel: 'src/__tests__/browser-evidence-contrast.test.ts', required: true },
  { rel: 'src/__tests__/browser-evidence-hermeticity.test.ts', required: true },
  { rel: 'src/__tests__/browser-evidence-abort.test.ts', required: true },
  { rel: 'src/__tests__/theming-checks.test.ts', required: true },
  { rel: 'src/__tests__/anti-pattern-checks.test.ts', required: true },
  { rel: 'src/__tests__/validator-fixtures-e2e.test.ts', required: true },
];

// Pin Playwright to the SHARED real-home browser cache BEFORE we isolate HOME below.
// Playwright resolves its browser cache from $HOME by default; the temp-HOME override
// (next block) would otherwise hide the shared Chromium so the real-browser collector
// suite could never launch and would SKIP. We capture the OS-default ms-playwright
// cache under the REAL home and pin it via PLAYWRIGHT_BROWSERS_PATH (execFileSync
// inherits env, so every spawned suite resolves Chromium from the shared cache
// regardless of the temp HOME). This keeps the collector real-browser test RUNNING in
// the committed `npm test` gate while leaving flow-history HOME-isolation intact.
// - An existing PLAYWRIGHT_BROWSERS_PATH (user/CI override) is respected, never clobbered.
// - If the cache dir does not exist (cacheless machine), Playwright simply cannot find
//   Chromium and the collector suite SKIPs gracefully (required:true, exit 0) - no hard
//   failure. Pointing the env var at a missing dir is safe.
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const realHome = process.env.HOME || os.homedir();
  const cacheByPlatform: Record<string, string> = {
    darwin: path.join(realHome, 'Library', 'Caches', 'ms-playwright'),
    win32: path.join(realHome, 'AppData', 'Local', 'ms-playwright'),
  };
  process.env.PLAYWRIGHT_BROWSERS_PATH = cacheByPlatform[process.platform] ?? path.join(realHome, '.cache', 'ms-playwright');
}
console.log(`run-tests: playwright cache -> ${process.env.PLAYWRIGHT_BROWSERS_PATH}`);

// Isolate HOME so suites that drive lane FINALIZE (and thus publish to the
// HOME-scoped ~/.claude/sidecoach-flow-history.json) write into a throwaway temp
// home instead of the developer's real one. execFileSync below inherits env, so
// every spawned suite picks this up.
process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-test-home-'));
console.log(`run-tests: isolated HOME -> ${process.env.HOME}`);

let ran = 0;
let failed = 0;
for (const s of SUITES) {
  const full = path.join(SIDECOACH, s.rel);
  if (!fs.existsSync(full)) {
    if (s.required) {
      console.error(`run-tests: REQUIRED suite missing: ${s.rel}`);
      process.exit(2);
    }
    console.error(`run-tests: SKIP (not present yet): ${s.rel}`);  // forward-declared lane suite
    continue;
  }
  ran++;
  const cwd = s.cwd ? path.join(SIDECOACH, s.cwd) : SIDECOACH;
  process.stdout.write(`-> ${s.rel}${s.cwd ? ` (cwd ${s.cwd})` : ''}\n`);
  try {
    execFileSync('npx', ['ts-node', full], { stdio: 'inherit', cwd });
  } catch {
    failed++;
  }
}
if (failed) { console.error(`run-tests: ${failed} suite(s) failed`); process.exit(1); }
console.log(`run-tests: ${ran} suite(s) passed`);
