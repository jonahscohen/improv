import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';

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
//
// SELF-REPORTED VERDICTS (added 2026-07-28, Jonah). Exit code alone is NOT a sufficient
// pass signal here. Many suites in this repo are plain scripts that tally their own
// results, print `Status: FAILED`, and then fall off the end of the file - which exits 0.
// The runner counted every one of those as a pass, so `npm test` reported
// "N suite(s) passed, exit 0" while its own transcript contained the failures.
// `allowFailureLines` is the escape hatch for the OPPOSITE error. A suite whose
// legitimate output contains a failure-shaped line (a negative case it is deliberately
// demonstrating) declares those exact lines here, with a reason. Anything matched that is
// NOT declared fails the suite, and declared-but-absent ALSO fails, so an allowance cannot
// rot into a permanently-open hole.
//
// WHAT THIS DOES NOT GUARANTEE, stated plainly (Codex review 2026-07-28, finding 4): the
// reconciliation is exact-text and count-exact, not context-aware. If a real broken path
// starts emitting the SAME line the allowance was written for, at the same count, the
// allowance absorbs it. The mitigation is on the suite side - an allowlisted line should
// carry a case id unique to the negative case, and the suite should separately assert that
// the negative case actually ran. There are currently ZERO entries in this list, so the
// only live guarantee is the default-deny one.
// See scanForFailureVerdicts() below for the matching rules.
interface AllowedFailureLine { line: string; why: string }
interface Suite {
  rel: string;
  cwd?: string;
  required?: boolean;
  runner?: 'ts-node' | 'node';
  args?: string[];
  env?: Record<string, string>;
  allowFailureLines?: AllowedFailureLine[];
}
const SUITES: Suite[] = [
  { rel: 'src/intent-detector.test.ts', required: true },                                 // legacy; outside __tests__/ - must not be dropped
  { rel: 'src/__tests__/classifier-parity.test.ts', required: true },                     // engine classifier copy guard (Task 7/8)
  { rel: 'src/__tests__/slash-phrase.test.ts', required: true },                          // /sidecoach phrase union + near-miss (Task 8)
  { rel: 'src/__tests__/executive-report.test.ts', required: true },                      // executive-report renderer contract (Jonah 2026-07-04)
  { rel: 'src/__tests__/polish-craft.test.ts', required: true },                          // polish TEACH half: craft coverage, selection, no templated After (Jonah 2026-07-29)
  { rel: 'src/__tests__/craft-corpus.test.ts', required: true },                           // TEACH half across ALL verbs: registry coverage, probe honesty, live handler wiring (Jonah 2026-07-29)
  { rel: 'src/__tests__/craft-floor.test.ts', required: true },                            // the craft FLOOR: unconditional, self-identifying, never blended with findings (Jonah 2026-07-29)
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
  { rel: 'src/__tests__/typography-fluid-pairing.test.ts', required: true },         // Capability breadth: font-pairing + clamp() fluid-type guidance (emission via 2 handlers, WCAG-1.4.4 caveat)
  { rel: 'src/__tests__/default-typeface-ground-b-wiring.test.ts', required: true }, // Stage 4b: DESIGN.md committed family -> run-validator/audit -> scanner Ground B; fail-closed when no brand declared
  { rel: 'src/__tests__/typography-extremes.test.ts', required: true },              // Stage 4b: 5 typographic-extreme taste classes - threshold boundaries + fixtures + A2 non-regression
  { rel: 'src/__tests__/structural-motion.test.ts', required: true },               // Stage 4c/4d: 7 structural + 3 motion/marker taste classes - threshold boundaries + fixtures + A2 non-regression
  { rel: 'src/__tests__/taste-precision-gates.test.ts', required: true },           // 2026-07-28 taste-precision retune: buzzword PEAK gate, nested-cards viewport guard, default-typeface ground-A gate, numbered-section-markers removal, page-level dedupe
  { rel: 'src/__tests__/rendered-scan-integration.test.ts', required: true },        // Stage 1 convergence: rendered scanner findings surface through the LIVE run-validator path
  { rel: 'src/__tests__/forms-checks.test.ts', required: true },                      // Stage 2 convergence: absorbed forms-a11y checks (FORMS_016/018/019/002/015)
  { rel: 'src/__tests__/page-quality-checks.test.ts', required: true },               // Stage 2 convergence: cherry-picked DOM-evidence Tier-2 keepers (img/text/dark/chart/button)
  { rel: 'src/__tests__/validator-integration.test.ts', required: true },             // Stage 2 convergence: registry-facade migration contract tripwire (Extended===22, Polish+Extended===46, honest Flow J display)
  { rel: 'src/__tests__/audit-rendered.test.ts', required: true },                    // /sidecoach audit <url> rendered read path: url detect, severity mapping, FAIL-CLOSED inconclusive-not-clean
  { rel: 'src/__tests__/empty-render-guard.test.ts', required: true },                // FAIL-CLOSED: a JS-app shell that renders empty is inconclusive, never "clean" (measured live 2026-07-28)
  { rel: 'src/__tests__/flow-target-render.test.ts', required: true },                // FLOW SURFACE: file/dir targets actually render; two maximally different targets must differ + catastrophic grades worse (measured live 2026-07-28)
  { rel: 'src/__tests__/detect-cli.test.ts', required: true },                        // Stage 3a bin/sidecoach-detect.js: fail-closed verdict matrix + exit-code classes + dispatch e2e
  { rel: 'src/__tests__/audit-history.test.ts', required: true },                     // append-only AUDIT-HISTORY capture: v1 line shape, findings-reduced, append-only, FAIL-OPEN, stdout parity (detect's stdout contract unchanged)
  { rel: 'src/__tests__/palette-recipe.test.ts', required: true },                     // Stage 2a bin/sidecoach-palette.js: OKLCH ramps, fail-closed WCAG gate (shipping scanner), DESIGN.md emit
  { rel: 'src/__tests__/direction-roll.test.ts', required: true },                     // Stage 2c bin/sidecoach-roll.js: outside-ranking deck roll - determinism, unsigned-seed domain, exclusion re-roll, full-sweep no-repeat + exhaustion
  { rel: 'src/__tests__/pre-authorship.test.ts', required: true },                     // Stage 2b bin/sidecoach-preauthor.js: author board+mock, render both, fail-closed gate (proceed/blocked/inconclusive) + e2e render/halt
  { rel: 'src/__tests__/direction-deck-present.test.ts', required: true },             // Stage 2d bin/sidecoach-deck.js: dual-surface deck (markdown table + static artifact), exclusion self-scan, roll-json ids + e2e
  { rel: 'src/__tests__/image-png-codec.test.ts', required: true },                    // image codec: round trip, deterministic encode, all five scanline filters, five color types, ten NAMED refusals
  { rel: 'src/__tests__/image-asset-verify.test.ts', required: true },                 // generated-asset verification: blank/flat caught, geometry+format from bytes, placement contrast on real pixels, three-value rule (unverified never folds to verified)
  { rel: 'src/__tests__/image-generation.test.ts', required: true },                    // provider-agnostic core: cache key, deterministic offline render, legacy-model refusal, projected vs measured cost, both caps, openai + nanobanana adapters and six failure classes
  { rel: 'src/__tests__/image-cli.test.ts', required: true },                          // bin/sidecoach-image.js e2e: every exit code, nothing written on failure, cache hit proven by a throwing transport, ledger + cumulative cap
  { rel: 'src/__tests__/image-flow-lens.test.ts', required: true },                    // flowD concept-sketch lens (reached by `sidecoach craft`): real plate through the real bin at zero cost, verified-only artifact, fail-closed memory validation
  { rel: 'src/__tests__/image-brief-compiler.test.ts', required: true },                // concept + composition layer: staging catalog separation enforced, weak brief compiles with real palette, contract DERIVED from the staging ink zone, provider-aware size, real asset through flowG
  { rel: 'src/__tests__/image-supplied-pixels.test.ts', required: true },              // closing the pixel-verification hole on our own default provider WITHOUT loosening the three-value verdict: format still fails on a substitution, a supply is checked not trusted, provenance cannot be laundered, and the browser decode agrees with an independent decoder
  { rel: 'src/__tests__/skill-surface-parity.test.ts', required: true },                // the loadable skill document must agree with `sidecoach list --json` on the CLI count and on WHICH tools a flow auto-runs; both statements were false once and nothing checked them
  { rel: 'src/__tests__/reference-update-service.test.ts', required: true },           // reference-update-service + bin/sidecoach-refs.js: capture-preserving upstream merge, fail-closed apply
  { rel: 'src/__tests__/taste-ingest.test.ts', required: true },                       // bin/sidecoach-taste-ingest.js: SAFE external taste ingest - allowlist/exclusion guard, forbidden-manifest writes nothing, untrusted-wrap + provenance, diff-since-last no-op vs flag, no-execution
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
  // ORPHAN-TEST GATING (2026-07-26): 52 live-but-ungated suites recovered by the orphan-test triage - every one was
  // import-resolved and run green twice (batch + a clean 52/52). Biggest gap closed: the build-report subsystem had
  // ZERO gated coverage. None duplicate a gated suite; none were dead. (21 routing tests + 5 slow + 1 broken jest-style
  // + the stale craft-length test are handled separately.)
  { rel: 'eval/dev-corpus-disjoint.test.mjs', runner: 'node', required: true },
  { rel: 'eval/objective-label.test.mjs', runner: 'node', required: true },
  { rel: 'bin/__tests__/sidecoach-mine.test.js', runner: 'node', required: true },              // taste miner engine: dedup classify, in-isolation pre-flight, measured-signal, inert-output dry-run
  { rel: 'src/__tests__/taste-map-types.test.ts', required: true },                              // consolidation map schema: pure classifyContradiction typing (direction-pair/hard-vs-hard/standard-calibration/cross-type/null), provenance-gated direction, seedConceptFromKey
  { rel: 'bin/__tests__/sidecoach-consolidate.test.js', runner: 'node', required: true },        // consolidation+contradiction MAP engine: distill-corpus parity, acceptance fixture (3 typed contradictions + overlap counts), renderer+--check drift, inertness fence, headless baseline, labeled typing-precision gate
  { rel: 'src/__tests__/pattern-interpreter.test.ts', required: true },                          // Phase 3a: static-css-regex interpreter + ReDoS screen (fires/clean/inconclusive fail-closed, catastrophic-backtrack bounded under a hard timeout)
  { rel: 'src/__tests__/mined-taste-invariant.test.ts', required: true },                        // Phase 3b Step 7: a mined-taste rule at a blocking severity MUST have an enforcement-ledger entry + a passing precision record (RED on the ungated mutation, GREEN on the live registry + enforced tier)
  { rel: 'src/__tests__/enforced-rules-generation.test.ts', required: true },                     // Phase 3c Step C1: the fail-closed ledger+precision gate deriveEnforcedRules (valid certifies at major; every tamper class rejected into errors -> build breaks)
  { rel: 'src/__tests__/copywriting-templates.test.ts', required: true },
  { rel: 'src/__tests__/design-md-parser.test.ts', required: true },
  { rel: 'src/__tests__/flow-composition-craft-landing.test.ts', required: true },
  { rel: 'src/__tests__/flow-handler-copywriting.test.ts', required: true },
  { rel: 'src/__tests__/flow-handler-landing-composition.test.ts', required: true },
  { rel: 'src/__tests__/flows-a-i-memory-integration.test.ts', required: true },
  { rel: 'src/__tests__/icon-source-reference-paths.test.ts', required: true },
  { rel: 'src/__tests__/landing-composition-data.test.ts', required: true },
  { rel: 'src/__tests__/phase-f-integration-full.test.ts', required: true },
  { rel: 'src/__tests__/phase-f-integration.test.ts', required: true },
  { rel: 'src/__tests__/phase-g-block3-prerequisites.test.ts', required: true },
  { rel: 'src/__tests__/phase-h-block1-composition.test.ts', required: true },
  { rel: 'src/__tests__/phase-h-block2-conditional.test.ts', required: true },
  { rel: 'src/__tests__/phase-h-block3-result-injection.test.ts', required: true },
  { rel: 'src/__tests__/phase-h-block4-domain-validators.test.ts', required: true },
  { rel: 'src/__tests__/phase-h-block5-orchestrator-integration.test.ts', required: true },
  { rel: 'src/__tests__/phase-h-block6-e2e-validation.test.ts', required: true },
  { rel: 'src/__tests__/phase-h-block7-flow-validator-integration.test.ts', required: true },
  { rel: 'src/__tests__/phase-i-block3-context-tracking-e2e.test.ts', required: true },
  { rel: 'src/__tests__/sprint10-canexecute-records-skip.test.ts', required: true },
  { rel: 'src/__tests__/sprint10-context-propagation.test.ts', required: true },
  { rel: 'src/__tests__/sprint10-parser-camelcase-keys.test.ts', required: true },
  { rel: 'src/__tests__/sprint11-flowa-personality-display.test.ts', required: true },
  { rel: 'src/__tests__/sprint2-context-loader-typing.test.ts', required: true },
  { rel: 'src/__tests__/sprint2-rolling-citations.test.ts', required: true },
  { rel: 'src/__tests__/sprint3-brand-verify-null-register.test.ts', required: true },
  { rel: 'src/__tests__/sprint3-motion-stack-detection.test.ts', required: true },
  { rel: 'src/__tests__/sprint3-motion-stack-idioms.test.ts', required: true },
  { rel: 'src/__tests__/sprint3-motion-stack-integration.test.ts', required: true },
  { rel: 'src/__tests__/sprint4-build-report-aggregator.test.ts', required: true },
  { rel: 'src/__tests__/sprint4-build-report-composite.test.ts', required: true },
  { rel: 'src/__tests__/sprint4-build-report-grading.test.ts', required: true },
  { rel: 'src/__tests__/sprint4-build-report-memory-input.test.ts', required: true },
  { rel: 'src/__tests__/sprint4-build-report-renderer.test.ts', required: true },
  { rel: 'src/__tests__/sprint6-checkpoint-engine-gc.test.ts', required: true },
  { rel: 'src/__tests__/sprint6-checkpoint-resume.test.ts', required: true },
  { rel: 'src/__tests__/sprint6-checkpoint-store-isolated.test.ts', required: true },
  { rel: 'src/__tests__/sprint6-checkpoint-write-on-step.test.ts', required: true },
  { rel: 'src/__tests__/sprint7-buildreport-includes-unstructured.test.ts', required: true },
  { rel: 'src/__tests__/sprint7-claudemd-validator-result.test.ts', required: true },
  { rel: 'src/__tests__/sprint7-polish-validator-result.test.ts', required: true },
  { rel: 'src/__tests__/sprint7-taste-validator-result.test.ts', required: true },
  { rel: 'src/__tests__/sprint8-document-handler.test.ts', required: true },
  { rel: 'src/__tests__/sprint8-teach-rebuild.test.ts', required: true },
  { rel: 'src/__tests__/sprint9-chain-continues-past-errors.test.ts', required: true },
  { rel: 'src/__tests__/sprint9-design-tokens-autoload.test.ts', required: true },
  { rel: 'src/__tests__/sprint9-product-md-parser.test.ts', required: true },
  { rel: 'src/__tests__/t23-deep-interview.test.ts', required: true },
  { rel: 'src/__tests__/taste-validator-observer-race.test.ts', required: true },
  { rel: 'src/__tests__/taste-validator-tailwind-tokens.test.ts', required: true },
  // 2026-07-28: fabricated-svg was blind to icons built from <line>/<rect>/<circle>/<polyline>/
  // <polygon> and to icons compressed into one compound path. Pins the primitive/compound triggers
  // AND the conjunctive icon test that keeps charts, diagrams, logos and sparklines silent.
  { rel: 'src/__tests__/taste-validator-primitive-icons.test.ts', required: true },
  // ROUTING/COMMAND-RESOLUTION tests (2026-07-26): deferred during the routing consolidation, now reconciled
  // against the landed refactor - ALL 21 gated. sprint12 had a stale length assertion (fixed 8->11).
  // sprint3-process-path was a DATA regression, not a stale test: reference/DESIGN.md had drifted out of
  // lint-compliance (rounded.none: "0" -> "0px"), so @google/design.md lint blocked flowF and the
  // "Source: DESIGN.md L<n>" citation never emitted; fixing the fixture unblocked the feature (resolved 2026-07-26).
  { rel: 'src/__tests__/intent-detector-tiebreak.test.ts', required: true },
  { rel: 'src/__tests__/sprint7-intent-detector-flowwx.test.ts', required: true },
  { rel: 'src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts', required: true },
  { rel: 'src/__tests__/sprint5-disambiguation-e2e-resolution.test.ts', required: true },
  { rel: 'src/__tests__/sprint5-disambiguation-prompt-path.test.ts', required: true },
  { rel: 'src/__tests__/sprint5-force-flowid-bypass.test.ts', required: true },
  { rel: 'src/__tests__/slash-command.test.ts', required: true },
  { rel: 'src/__tests__/orchestrator-slash-command.test.ts', required: true },
  { rel: 'src/__tests__/qa-gate.test.ts', required: true },                            // orchestrated QA gate (audit->critique->polish) resolves via the shared router; on-edit hook depends on it
  { rel: 'src/__tests__/sprint8-router-registry-branch.test.ts', required: true },
  { rel: 'src/__tests__/sprint8-verb-parity.test.ts', required: true },
  { rel: 'src/__tests__/sprint8-registry-shape.test.ts', required: true },
  { rel: 'src/__tests__/sprint8-list-and-help.test.ts', required: true },
  { rel: 'src/__tests__/sprint11-craft-chain-includes-motion-a11y.test.ts', required: true },
  { rel: 'src/__tests__/sprint12-craft-chain-includes-research.test.ts', required: true },
  { rel: 'src/__tests__/task8-list-command-taxonomy.test.ts', required: true },
  { rel: 'src/__tests__/task10-flow-n-justify.test.ts', required: true },
  { rel: 'src/__tests__/task11-interactive-menu.test.ts', required: true },
  { rel: 'src/__tests__/sprint2-orchestrator-getHandlers.test.ts', required: true },
  { rel: 'src/__tests__/sprint7-composite-parser-both-forms.test.ts', required: true },
  { rel: 'src/__tests__/sprint2-integration.test.ts', required: true },
  { rel: 'src/__tests__/sprint3-process-path.test.ts', required: true },              // resolved 2026-07-26: reference/DESIGN.md lint drift was blocking flowF's citation
  // Ported 2026-07-26 from an unrunnable jest-style test to plain-assert - the ONLY coverage for
  // FlowSpecificValidator / FlowMetricsTracker / FlowHandlerCache (all live, orchestrator-imported).
  { rel: 'src/phase-iii-integration.test.ts', required: true },
  // SLOW-BUT-GREEN cohort gated 2026-07-26 (the orphan-triage "5 slow", gate-cost decision resolved = GATE).
  // Each verified green in isolation (npx ts-node); isolated cost ~1-8s though the triage saw up to ~44s under
  // full-gate concurrent ts-node load. Coverage otherwise absent: build-report single/opt-in + CLI e2e, orchestrator
  // enrich-before-canExecute ordering, model-tier routing (t12, a distinct subsystem), retry-control (t9).
  { rel: 'src/__tests__/sprint4-build-report-single-opt-in.test.ts', required: true },
  { rel: 'src/__tests__/sprint4-build-report-cli.test.ts', required: true },
  { rel: 'src/__tests__/sprint3-orchestrator-enrich-before-canexecute.test.ts', required: true },
  { rel: 'src/__tests__/t12-model-routing.test.ts', required: true },
  { rel: 'src/__tests__/t9-retry-control.test.ts', required: true },
  { rel: 'src/__tests__/design-tokens-count.test.ts', required: true },                   // Flow F design-tokens: real parsed token count, not a Math.random placeholder (drive-to-green item 6)
  { rel: 'src/__tests__/consolidate-mine-router.test.ts', required: true },                // drive-to-green item 1: consolidate/mine routable via the slash router
  { rel: 'bin/__tests__/consolidate-frontdoor.test.js', runner: 'node', required: true },  // drive-to-green item 1: consolidate front-door delegates real args to the engine, bare prints the plan
  { rel: 'bin/__tests__/sidecoach-doctor.test.js', runner: 'node', required: true },       // drive-to-green item 5: doctor excludes test files from the capability inventory, keeps all real tools
  { rel: 'src/__tests__/flowk-drift-theming-escalation.test.ts', required: true },         // drive-to-green item 7: the active multi-lens handler escalates the Theming dimension on real token drift
  { rel: 'src/__tests__/coverage-honesty.test.ts', required: true },                        // drive-to-green item 2: a clean/quiet result never claims VERIFIED CLEAN without both-lenses-ran positive evidence
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

// FAILURE-VERDICT VOCABULARY.
//
// Deliberately NARROW. This is not a `grep -i fail` over the transcript - that direction
// cries wolf, and a gate that cries wolf gets ignored, which lands you back at a false
// green by a longer road. Three constraints keep it honest:
//
//  1. ANCHORED. The marker must open the line (leading whitespace allowed). A failure word
//     mentioned mid-sentence in prose, a filename, or an assertion label is not a verdict.
//  2. UPPERCASE verdict token. Every self-reporting suite in this repo prints FAIL / FAILED
//     in caps. Requiring caps drops ordinary prose ("Status: failed to parse config") out
//     of scope while still catching every verdict shape the repo actually emits.
//  3. TALLY lines must be self-describing. `Total: 16/20 tests passing` counts; a bare
//     `3/10` does not, because plenty of suites print ratios that are not verdicts
//     (fixtures scanned, rules matched, steps run).
//
// Anything this vocabulary cannot see - a suite that fails silently and prints nothing -
// is still invisible to the runner. That residual gap is real; it is bounded by the fact
// that a suite printing NO verdict at all also proves nothing to a human reading the log.
//
// The FAIL token is matched with an explicit terminator lookahead rather than `\b`.
// `\b` matches between `L` and `-`, so `FAIL\b` fires on FAIL-CLOSED - a phrase this
// repo's passing suites use constantly ("FAIL-CLOSED: inconclusive render refused as
// clean"). That would have been a manufactured red on healthy suites (Codex review
// 2026-07-28, finding 2).
const FAIL_TOKEN = String.raw`FAIL(?:ED)?(?=[ \t:,.;!?)\]]|$)`;

const FAILURE_VERDICT_PATTERNS: { name: string; re: RegExp; isFailure?: (m: RegExpMatchArray) => boolean }[] = [
  // `Status: FAILED`, `Result: FAIL (artifact not found)`, `Verdict: FAIL`
  { name: 'labelled-verdict', re: new RegExp(String.raw`^[ \t]*(?:Status|Result|Results|Verdict|Outcome)[ \t]*:[ \t]*` + FAIL_TOKEN) },
  // `FAIL <label>` - the per-check shape ~44 suites in this repo use alongside `PASS <label>`
  { name: 'leading-fail', re: new RegExp(String.raw`^[ \t]*` + FAIL_TOKEN) },
  // `<suite-name> FAIL` / `<label>: FAIL` - the trailing single-word verdict shape.
  // Two branches, and the split is the whole point (Codex review 2026-07-28, fourth pass).
  // Trailing `!`/`?` are allowed ONLY after a colon, so `checkout-flow: FAIL!` is caught
  // while the English sentences `negative case should FAIL!` and `does this intentionally
  // FAIL?` are not. A colon is a label, and a label is what distinguishes a verdict from
  // a sentence; without one this pattern is the most exposed in the set, so the
  // whitespace-separated branch stays strictly unpunctuated. A trailing `.` is never
  // accepted on either branch.
  { name: 'trailing-fail', re: /[A-Za-z0-9_)\]-](?:[ \t]*:[ \t]*FAIL(?:ED)?[!?]?|[ \t]+FAIL(?:ED)?)[ \t]*$/ },
  // `[FAIL] <case>` - the bracketed per-case shape. Codex review 2026-07-28 (second pass,
  // finding 3) caught this as a live hole: `[PASS]` appears 17 times in a full baseline
  // transcript, so the convention is in use, and a suite that reported only bracketed
  // per-case verdicts would have exited 0 and read green with nothing matching it.
  { name: 'bracketed-fail', re: /^[ \t]*\[[ \t]*FAIL(?:ED)?[ \t]*\]/ },
  // `Total: 16/20 tests passing`, `Results: 8/9 tests passing`, `<name>: 43/43 passed`
  {
    name: 'short-tally',
    re: /^[ \t]*[\w .\/-]*?[ \t]*:?[ \t]*(\d+)[ \t]*\/[ \t]*(\d+)[ \t]+(?:tests?[ \t]+)?(?:pass(?:ed|ing)|ok)\b/,
    isFailure: (m) => Number(m[1]) < Number(m[2]),
  },
  // `Results: 9 passed, 1 failed out of 10 tests`, `TEST RESULTS: 5 passed, 0 failed`.
  // Codex review 2026-07-28 (finding 1) caught that this repo's most common summary shape
  // was invisible to the vocabulary above, so a suite emitting only it could still exit 0
  // and read green.
  //
  // The LABEL IS REQUIRED here, unlike short-tally, and that asymmetry is evidence-driven
  // rather than stylistic. A full baseline transcript contains bare, indented DETAIL lines
  // inside PASSING tests - phase-h-block4 prints "  1 passed, 2 failed" as the explanatory
  // message of a green assertion about partial-status aggregation, and phase-h-block5
  // prints "  2 passed, 1 failed" the same way. A label-free version of this pattern marks
  // both of those healthy suites red. Requiring a label separates a suite-level verdict
  // from an assertion's own commentary, which is exactly the line that has to be drawn.
  //
  // The label is an EXPLICIT vocabulary rather than "any word plus a colon" (Codex review
  // 2026-07-28, second pass, finding 2): "any word" re-opens the false red from the other
  // side, flagging explanatory lines like `Expected: 1 passed, 2 failed`. The colon is
  // optional so the repo's unpunctuated `TEST RESULTS 9 passed, 1 failed` still matches.
  {
    name: 'labelled-passfail-tally',
    re: /^[ \t]*(?:TEST[ \t]+RESULTS?|RESULTS?|TOTALS?|SUMMARY|TESTS)[ \t]*:?[ \t]*(\d+)[ \t]+pass(?:ed)?[,;]?[ \t]+(\d+)[ \t]+fail(?:ed)?\b/i,
    isFailure: (m) => Number(m[2]) > 0,
  },
];

interface VerdictHit { line: string; pattern: string }

function scanForFailureVerdicts(output: string): VerdictHit[] {
  const hits: VerdictHit[] = [];
  for (const raw of output.split('\n')) {
    // Strip ANSI so a coloured verdict cannot slip past the anchor.
    // Colon-parameter SGR (`\x1b[38:2::255:0:0m`) is valid ANSI and would otherwise leave
    // residue in front of the anchor, so `:` is in the parameter class alongside `;`.
    const line = raw.replace(/\x1b\[[0-9;:]*[A-Za-z]/g, '').replace(/\r$/, '');
    for (const p of FAILURE_VERDICT_PATTERNS) {
      const m = line.match(p.re);
      if (!m) continue;
      if (p.isFailure && !p.isFailure(m)) continue;
      hits.push({ line: line.trim(), pattern: p.name });
      break;  // one hit per line; the first matching pattern names it
    }
  }
  return hits;
}

// Compare observed verdict lines against the suite's declared allowlist as a MULTISET.
// Exact-line, both directions:
//   - an observed line with no matching allowance  -> the suite reported a failure
//   - a declared line that did not appear          -> the allowance is stale, and a stale
//                                                     allowance is a hole a future failure
//                                                     can hide in, so it fails too
function reconcileVerdicts(hits: VerdictHit[], allowed: AllowedFailureLine[]): string[] {
  const problems: string[] = [];
  const remaining = allowed.map((a) => a.line);
  for (const hit of hits) {
    const i = remaining.indexOf(hit.line);
    if (i === -1) problems.push(`UNDECLARED failure verdict [${hit.pattern}]: ${hit.line}`);
    else remaining.splice(i, 1);
  }
  for (const line of remaining) problems.push(`DECLARED failure verdict never appeared (stale allowFailureLines entry): ${line}`);
  return problems;
}

// --audit: run everything, report every verdict-line hit per suite, never fail on the scan.
// This is how the allowlist gets built from observed evidence instead of from guesswork,
// and how the whole suite list gets swept for the print-a-failure-then-exit-0 shape.
// --only <substr>: restrict the run to suites whose `rel` contains <substr>.
const argv = process.argv.slice(2);
const AUDIT = argv.includes('--audit');
const ONLY = (() => { const i = argv.indexOf('--only'); return i !== -1 ? argv[i + 1] : undefined; })();

const CAPTURE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-test-capture-'));

let ran = 0;
let failed = 0;
const auditReport: { rel: string; exit: number | null; hits: VerdictHit[]; hardFail: boolean }[] = [];
const failureDetail: string[] = [];

for (const s of SUITES) {
  if (ONLY && !s.rel.includes(ONLY)) continue;
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

  // Child output is captured to a FILE, not to a pipe buffer, then echoed. A pipe would
  // impose spawnSync's maxBuffer ceiling and silently truncate a chatty suite - and a
  // truncated transcript is exactly how a verdict line goes missing. The cost is that
  // output appears when the suite finishes rather than while it runs; the `-> <suite>`
  // line above still says what is in flight.
  const runOnce = (attempt: number): { ok: boolean; problems: string[]; hits: VerdictHit[]; exit: number | null } => {
    const logPath = path.join(CAPTURE_DIR, `${ran}-${attempt}.log`);
    const fd = fs.openSync(logPath, 'w');
    let r;
    try {
      r = s.runner === 'node'
        ? spawnSync('node', [full, ...(s.args ?? [])], { stdio: ['ignore', fd, fd], cwd, env })
        : spawnSync('npx', ['ts-node', full], { stdio: ['ignore', fd, fd], cwd, env });
    } finally {
      fs.closeSync(fd);
    }
    const output = fs.readFileSync(logPath, 'utf8');
    process.stdout.write(output);
    if (r.error) {
      console.error(`run-tests: could not spawn ${s.rel}: ${r.error.message}`);
      process.exit(3);  // runner-internal, NOT a test verdict - do not let it read as one
    }
    const problems: string[] = [];
    if (r.signal) problems.push(`killed by signal ${r.signal}`);
    else if (r.status !== 0) problems.push(`exit code ${r.status}`);
    const hits = scanForFailureVerdicts(output);
    if (!AUDIT) problems.push(...reconcileVerdicts(hits, s.allowFailureLines ?? []));
    return { ok: problems.length === 0, problems, hits, exit: r.status };
  };

  let outcome = runOnce(1);
  // RETRY-ONCE: ts-node can spuriously fail to COMPILE under concurrent load (a TS2304 on a symbol
  // that resolves fine in isolation - observed while gating 50+ ts-node suites in one run). A transient
  // flake passes the second attempt; a genuinely-red suite fails BOTH and is still counted, so this
  // suppresses load-flakes without masking real failures.
  //
  // A SELF-REPORTED VERDICT IS NEVER RETRIED (Codex review 2026-07-28, finding 3). The retry exists
  // for a spawn/compile flake, which shows up as a non-zero exit. A suite that ran far enough to TALLY
  // its own results and print a failure has produced evidence, not noise - and re-running it and
  // accepting a green second attempt would rebuild the exact false green this whole change exists to
  // remove (a suite that only fails on its first run per fresh state would sail straight through).
  //
  // The gate is on raw HITS, not on reconciled problems (Codex second pass, finding 1). Keying it on
  // `verdictProblems` was wrong in two reachable ways: `--audit` forces that list empty, so the audit
  // path would happily retry a self-reported failure and then record only the clean second attempt;
  // and once any suite declares an allowlist, an allowed hit also empties the list. Raw hits are the
  // honest signal in every mode. The accepted cost: a suite that legitimately prints a negative-case
  // line AND hits a genuine compile flake gets no retry. That is the safe direction to be wrong in.
  if (!outcome.ok && outcome.hits.length === 0) {
    process.stdout.write(`   (retrying ${s.rel} once after a non-zero exit)\n`);
    outcome = runOnce(2);
  }
  if (AUDIT) {
    auditReport.push({ rel: s.rel, exit: outcome.exit, hits: outcome.hits, hardFail: outcome.problems.length > 0 });
  } else if (!outcome.ok) {
    failed++;
    for (const p of outcome.problems) failureDetail.push(`  ${s.rel}: ${p}`);
  }
}

fs.rmSync(CAPTURE_DIR, { recursive: true, force: true });

if (AUDIT) {
  console.log('\n===== run-tests --audit: self-reported failure verdicts =====');
  const flagged = auditReport.filter((a) => a.hits.length > 0);
  for (const a of flagged) {
    console.log(`${a.rel}  (exit ${a.exit})`);
    for (const h of a.hits) console.log(`    [${h.pattern}] ${h.line}`);
  }
  const greenWhileFailing = flagged.filter((a) => a.exit === 0);
  console.log(`\naudit: ${auditReport.length} suite(s) run, ${flagged.length} emitted a failure verdict, ${greenWhileFailing.length} of those exited 0 (green-while-failing)`);
  for (const a of greenWhileFailing) console.log(`  GREEN-WHILE-FAILING: ${a.rel}`);
  // Audit is a DISCOVERY mode, but it must not become a second way to report a false green
  // (Codex review 2026-07-28, finding 5). A suite that exited non-zero or died on a signal is
  // reported here and takes the exit code with it, even though the verdict scan is advisory
  // in this mode.
  const hardFails = auditReport.filter((a) => a.hardFail);
  for (const a of hardFails) console.error(`  HARD FAILURE (exit ${a.exit}): ${a.rel}`);
  if (hardFails.length || greenWhileFailing.length) {
    console.error(`audit: ${hardFails.length} hard failure(s), ${greenWhileFailing.length} green-while-failing suite(s)`);
    process.exit(1);
  }
  console.log('audit: no suite reported a failure it did not also exit non-zero for');
  process.exit(0);
}

if (failed) {
  console.error(`run-tests: ${failed} suite(s) failed`);
  for (const d of failureDetail) console.error(d);
  process.exit(1);
}
console.log(`run-tests: ${ran} suite(s) passed`);
