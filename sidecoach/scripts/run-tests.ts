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
// There are TWO copies of the lane classifier (Python hook / engine TS), kept
// in sync ONLY by parity tests against the shared corpus. This runner MUST run
// the engine TS parity suite + the slash-phrase guard, or the engine copy drifts
// unguarded. The Python copy has its own separate guard,
// claude/hooks/test_classifier_parity.py, not run here.
//
// Forward-declared lane suites (created in later plan tasks) are SKIPPED-with-
// warning until they exist; REQUIRED suites hard-fail (exit nonzero) if missing.
//
// `runner: 'node'` suites are the eval/migration-harness golden snapshots, which
// are plain .mjs taking a `verify` arg (see `args`). They are the ONLY coverage for
// absolute-ban-detector and reference-loader - neither has a unit test - so without
// them here a regression in either ships through a green suite.
// The harnesses import from dist/, not src/, so they verify the LAST BUILD - a stale
// dist would let a src regression pass this gate green, voiding the guarantee above.
// `npm test` therefore builds first (see package.json: `npm run build && ...`, ~5s).
// Invoking this file directly bypasses that - build first, or these suites check
// stale output. The ts-node suites above test src/ directly and are unaffected.
interface Suite { rel: string; cwd?: string; required?: boolean; runner?: 'ts-node' | 'node'; args?: string[]; env?: Record<string, string>; }
const SUITES: Suite[] = [
  { rel: 'src/intent-detector.test.ts', required: true },                                 // legacy; outside __tests__/ - must not be dropped
  { rel: 'src/__tests__/classifier-parity.test.ts', required: true },                     // engine classifier copy guard (Task 7/8)
  { rel: 'src/__tests__/slash-phrase.test.ts', required: true },                          // /sidecoach phrase union + near-miss (Task 8)
  { rel: 'src/__tests__/executive-report.test.ts', required: true },                      // executive-report renderer contract (Jonah 2026-07-04)
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
  { rel: 'src/__tests__/lane-render-url.test.ts', required: true },
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
  { rel: 'src/__tests__/domain-validation-coverage.test.ts', required: true },       // orchestrator domain-validation coverage (all execute branches) + memory-before-validation ordering
  { rel: 'src/__tests__/counter-rules.test.ts', required: true },                     // Stage 1c counter-rule compilation: registry-existence + threshold/noise-guard/ordering logic
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
  { rel: 'src/__tests__/browser-evidence-abort-latency.test.ts', required: true },
  { rel: 'src/__tests__/browser-evidence-concentric.test.ts', required: true },
  { rel: 'src/__tests__/theming-checks.test.ts', required: true },
  { rel: 'src/__tests__/anti-pattern-checks.test.ts', required: true },
  { rel: 'src/__tests__/validator-fixtures-e2e.test.ts', required: true },
  { rel: 'src/__tests__/panel-renderer.test.ts', required: true },                  // Sidecoach progress panel: model + renderer
  { rel: 'src/__tests__/referee-independence.test.ts', required: true },             // Stage 1: product objective scanner has ZERO eval/ (referee) imports
  { rel: 'src/__tests__/objective-rendered-calibration.test.ts', required: true },   // Stage 1: owned objective scanner spec-correctness (incl referee adversarial INPUTS)
  { rel: 'src/__tests__/decouple-isolation.test.ts', required: true },               // Stage 1: objective/subjective scan decouple - subjective ReDoS can't starve objective
  { rel: 'src/__tests__/subjective-rendered-calibration.test.ts', required: true },  // Stage 1 ST1: owned subjective (taste) scanner - tiny-text precision-first spec
  { rel: 'src/__tests__/typeface-vocabulary.test.ts', required: true },              // Stage 4a: default-typeface vocabulary single-source (reference-data == inlined scanner copy)
  { rel: 'src/__tests__/default-typeface-ground-b-wiring.test.ts', required: true }, // Stage 4b: DESIGN.md committed family -> run-validator/audit -> scanner Ground B; fail-closed when no brand declared
  { rel: 'src/__tests__/typography-extremes.test.ts', required: true },              // Stage 4b: 5 typographic-extreme taste classes - threshold boundaries + fixtures + A2 non-regression
  { rel: 'src/__tests__/structural-motion.test.ts', required: true },               // Stage 4c/4d: 7 structural + 3 motion/marker taste classes - threshold boundaries + fixtures + A2 non-regression
  { rel: 'src/__tests__/rendered-scan-integration.test.ts', required: true },        // Stage 1 convergence: rendered scanner findings surface through the LIVE run-validator path
  { rel: 'src/__tests__/forms-checks.test.ts', required: true },                      // Stage 2 convergence: absorbed forms-a11y checks (FORMS_016/018/019/002/015)
  { rel: 'src/__tests__/page-quality-checks.test.ts', required: true },               // Stage 2 convergence: cherry-picked DOM-evidence Tier-2 keepers (img/text/dark/chart/button)
  { rel: 'src/__tests__/validator-integration.test.ts', required: true },             // Stage 2 convergence: registry-facade migration contract tripwire (Extended===22, Polish+Extended===46, honest Flow J display)
  { rel: 'src/__tests__/audit-rendered.test.ts', required: true },                    // /sidecoach audit <url> rendered read path: url detect, severity mapping, FAIL-CLOSED inconclusive-not-clean
  { rel: 'src/__tests__/detect-cli.test.ts', required: true },                        // Stage 3a bin/sidecoach-detect.js: fail-closed verdict matrix + exit-code classes + dispatch e2e
  { rel: 'src/__tests__/palette-recipe.test.ts', required: true },                     // Stage 2a bin/sidecoach-palette.js: OKLCH ramps, fail-closed WCAG gate (shipping scanner), DESIGN.md emit
  { rel: 'src/__tests__/direction-roll.test.ts', required: true },                     // Stage 2c bin/sidecoach-roll.js: outside-ranking deck roll - determinism, unsigned-seed domain, exclusion re-roll, full-sweep no-repeat + exhaustion
  { rel: 'src/__tests__/pre-authorship.test.ts', required: true },                     // Stage 2b bin/sidecoach-preauthor.js: author board+mock, render both, fail-closed gate (proceed/blocked/inconclusive) + e2e render/halt
  { rel: 'src/__tests__/direction-deck-present.test.ts', required: true },             // Stage 2d bin/sidecoach-deck.js: dual-surface deck (markdown table + static artifact), exclusion self-scan, roll-json ids + e2e
  { rel: 'src/__tests__/reference-update-service.test.ts', required: true },           // reference-update-service + bin/sidecoach-refs.js: capture-preserving upstream merge, fail-closed apply
  { rel: 'src/__tests__/project-drift-detector.test.ts', required: true },             // token drift: pure detector, all 5 categories + value-based/var rules (was ungated)
  { rel: 'src/__tests__/drift-cli.test.ts', required: true },                          // bin/sidecoach-drift.js: fail-closed verdict matrix + exit classes + e2e
  { rel: 'src/__tests__/sprint1-integration.test.ts', required: true },                // orchestrator DESIGN.md injection + drift e2e vs the reference project (was ungated)
  { rel: 'eval/migration-harness/scanner-snapshot.mjs', runner: 'node', args: ['verify'], required: true },      // absolute-ban detector goldens (5 inputs) - the ONLY coverage that module has
  { rel: 'eval/migration-harness/reference-snapshot.mjs', runner: 'node', args: ['verify'], required: true },    // reference-loader bundle golden - the ONLY coverage that module has
  { rel: 'eval/migration-harness/routing-snapshot.mjs', runner: 'node', args: ['verify'], required: true },      // flow routing goldens
  { rel: 'eval/migration-harness/convergence-snapshot.mjs', runner: 'node', args: ['verify'], required: true },  // convergence goldens
  { rel: 'eval/migration-harness/buildreport-snapshot.mjs', runner: 'node', args: ['verify'], required: true },  // BuildReport golden (deterministic fields)
  { rel: 'eval/prose-ablation.mjs', runner: 'node', args: ['--self-test'], required: true },                    // Stage 1d prose-ablation: seeded priming/protective ordering assertion (dry-run, no keys)
  // EVAL-CORPUS INTEGRITY (wired 2026-07-24). `verify-candidates` is the freeze gate on the
  // claim-bearing 90-page corpus: it re-hashes every page's canonical record (labels, file
  // content, split, provenance) against lock-candidates.json, so it is what stops a corpus
  // from being edited out from under a published number. It sat RED at 90/90 for a month
  // because the runner never invoked it - the tool was correct, nothing asked it the question.
  // Both are cheap (~1s, no browser) and fully reproducible: all 90 corpus HTML files and 25
  // briefs are git-tracked, so a fresh clone gets the same verdict.
  // corpus-tool.test.mjs covers the freeze/verify LOGIC in temp dirs (incl. the post-freeze
  // re-label that caused the outage, and the vacuous-green guard); verify-candidates checks the
  // REAL committed artifact. Logic tests first, so a broken gate reports as a broken gate rather
  // than as a corrupt corpus.
  // NOTE: the sibling `corpus-tool.mjs verify` (manifest corpus) is deliberately NOT wired. That
  // corpus is intentionally empty (tooling-only path) so the command is vacuously green; adding it
  // would bank a permanent pass that asserts nothing.
  // `env` PINS SIDECOACH_CORPUS_DIR: corpus-tool resolves its corpus from that variable, so an
  // ambient `SIDECOACH_CORPUS_DIR=/tmp/clean-fixture npm test` would otherwise point the gate at a
  // decoy and pass green while the committed corpus was corrupt. The gate names its own subject.
  { rel: 'eval/corpus-tool.test.mjs', runner: 'node', required: true },                                          // freeze/verify logic (temp-dir), incl. candidates path
  { rel: 'eval/corpus-tool.mjs', runner: 'node', args: ['verify-candidates'], required: true,                    // REAL frozen 90-page corpus: canonical-record freeze intact
    env: { SIDECOACH_CORPUS_DIR: path.join(SIDECOACH, 'eval', 'corpus') } },
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
  const argSuffix = s.args?.length ? ` ${s.args.join(' ')}` : '';
  process.stdout.write(`-> ${s.rel}${argSuffix}${s.cwd ? ` (cwd ${s.cwd})` : ''}\n`);
  const env = s.env ? { ...process.env, ...s.env } : process.env;
  try {
    if (s.runner === 'node') {
      execFileSync('node', [full, ...(s.args ?? [])], { stdio: 'inherit', cwd, env });
    } else {
      execFileSync('npx', ['ts-node', full], { stdio: 'inherit', cwd, env });
    }
  } catch {
    failed++;
  }
}
if (failed) { console.error(`run-tests: ${failed} suite(s) failed`); process.exit(1); }
console.log(`run-tests: ${ran} suite(s) passed`);
