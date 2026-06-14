import * as fs from 'fs';
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
  { rel: 'src/__tests__/lane-runner-start.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-advance-sequence.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-transitions.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-skip-prereq.test.ts', required: true },
  { rel: 'src/__tests__/lane-runner-status-list.test.ts', required: true },
  { rel: 'src/__tests__/lane-engine-methods.test.ts', required: true },
  { rel: 'src/__tests__/slash-phrase-wiring.test.ts', required: true },
  { rel: 'src/__tests__/lane-cli.test.ts', required: true },
  { rel: 'src/__tests__/lane-execution-e2e.test.ts', required: true },
  { rel: 'src/__tests__/product-rule-registry.test.ts', required: true },
  { rel: 'src/__tests__/flow-validation-capabilities.test.ts', required: true },
  { rel: 'src/__tests__/generate-validators.test.ts', required: true },
  { rel: 'src/__tests__/clean-evaluator.test.ts', required: true },
  { rel: 'src/__tests__/project-collector.test.ts', required: true },
  { rel: 'src/__tests__/product-validator-pipeline.test.ts', required: true },
  { rel: 'src/__tests__/polish-checks.test.ts', required: true },
  { rel: 'src/__tests__/a11y-checks.test.ts', required: true },
  { rel: 'src/__tests__/theming-checks.test.ts', required: true },
];

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
