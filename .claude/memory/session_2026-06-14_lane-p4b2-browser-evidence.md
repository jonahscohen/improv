---
name: Lane P4b-2 Browser Evidence Collector
description: Playwright headless-Chromium collector promoting four parked browser rules to real verdicts; genericity stays excluded
type: project
relates_to: []
---

# Lane P4b-2 - Browser Evidence Collector

Collaborator: Jonah

Executing the TDD plan at `docs/superpowers/plans/2026-06-14-lane-p4b2-browser-evidence-collector.md` on branch `lane-p4b2` (off main). Engine-only (sidecoach/src + tests + scripts); does not touch mcp-server, hooks, or the spec out-of-scope systems.

Goal: an engine-owned Playwright collector navigates an already-running render URL and gathers evidence for four browser-dependent rules so they become real, browser-verified checks:
- `a11y.min-hit-area` (BLOCKER, evidence `dom`)
- `a11y.color-contrast` (BLOCKER, evidence `contrast`)
- `polish.concentric-radius` (minor, evidence `computed-style`)
- `polish.typography-rhythm` (minor, evidence `computed-style`)

`polish.anti-pattern-genericity` is DELIBERATELY EXCLUDED (team-lead decision). Its registry entry and `checkProduct` stay untouched; it remains owned, non-required, and inconclusive even when the collector succeeds.

## Baseline note (why suite counts are -1 vs the plan)
The plan states a 47-suite baseline, but `scripts/run-tests.ts` actually registers 46 suite entries (all green at baseline). So every absolute suite-count in the plan is +1 vs reality: Task 1 -> 47, Task 2 -> 48, Task 4/5 -> 49 final. This matches the team-lead's "~49" expectation. Benign plan/codebase drift in numbers only; the per-task "adds one suite, all green" invariant holds.

## Setup (done)
- Branch `lane-p4b2` created off main.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright --save` -> playwright@1.60.0, no browser download. Shared cache `~/Library/Caches/ms-playwright` present (chromium-1223, chromium_headless_shell-1223). Collector resolves Chromium from that shared cache.
- `package.json` build script now: `generate-lanes && generate-validators && generate-validators --check && tsc`.

## Task 1 - Typed trusted browser evidence + real verdicts (DONE)
Why: the four parked rules must trust ONLY a collector-set `browserEvidence` marker, not ad hoc caller-provided browser-shaped fields (preserves the P4a rule that arbitrary fields cannot forge a verdict).
How:
- `check-context.ts`: added `BrowserDomEvidence`, `BrowserEvidenceMeta`; added optional `renderUrl`, `browserEvidence`, `dom` to `ProductCheckContext`; added `hasTrustedBrowserEvidence(ctx, kind)` and `browserNumber(ctx, key)` helpers.
- `polish-checks.ts`: replaced `checkConcentricRadius` + `checkTypographyRhythm` with trusted-evidence verdicts (inconclusive without marker; pass/fail/not_applicable from collected aggregate keys). `checkGenericity` left untouched (always inconclusive).
- `a11y-checks.ts`: replaced `checkMinHitArea` + `checkColorContrast` with trusted-evidence verdicts.
- New `browser-evidence-rules.test.ts`: full evidence-present pass/fail matrix for the four rules, ad-hoc-stays-inconclusive, and genericity-stays-inconclusive-with-trusted-DOM. Registered required:true after a11y-checks in run-tests.ts.
- Existing `polish-checks.test.ts` / `a11y-checks.test.ts` needed no edits: their assertions already only cover absent/ad-hoc (untrusted) evidence, which still resolves inconclusive. Genericity-inconclusive assertion already present in polish-checks.test.ts.
- Verified: build exit 0, `run-tests: 47 suite(s) passed`.

Files touched (Task 1): sidecoach/package.json, sidecoach/package-lock.json, sidecoach/src/validators/check-context.ts, sidecoach/src/validators/checks/polish-checks.ts, sidecoach/src/validators/checks/a11y-checks.ts, sidecoach/src/__tests__/browser-evidence-rules.test.ts, sidecoach/scripts/run-tests.ts.
Commit: da72921.

## Task 2 - Hermetic Playwright collector (DONE)
Why: a real headless-Chromium collector turns the trusted-evidence rules into genuinely browser-verified checks, with a self-contained `data:` fixture (no network) and clean skip-on-unavailable.
How:
- New `browser-evidence-collector.ts`: `collectBrowserEvidence(renderUrl, signal?)` launches headless Chromium via Playwright's shared-cache lookup, reduced-motion context, blocks cross-origin/cross-protocol subresources via page.route, navigates, and `page.evaluate`s bounded facts: concentric checked/failing pairs, typography checked/invalid-line-height counts, minHitArea (button>=44, others>=40), worst direct-text WCAG-AA contrast. Returns `{available:true, evidence}` or `{available:false, reason}`; never throws. Honors AbortSignal before launch and during navigation. Also exports `renderUrlFromContext` (accepts http/https/file/data).
- New `browser-evidence-collector.test.ts`: hermetic `data:` fixture; if collector unavailable prints `SKIP` and returns (exit 0); else asserts the three evidence kinds, a real concentric pair, a failing small button, failing low-contrast text, and that the four rules reach real pass/fail while genericity stays inconclusive. Registered required:true after browser-evidence-rules.

### KEY FINDING - collector SKIPs inside `npm test`, runs OK standalone
The aggregate runner (`scripts/run-tests.ts`) sets `process.env.HOME` to a throwaway temp dir to keep lane-FINALIZE writes out of the real `~/.claude`. Playwright resolves its browser cache from `$HOME/Library/Caches/ms-playwright`, so under the isolated HOME the executable is "not found" and the collector returns available:false -> the test prints `browser-evidence-collector: SKIP (browser evidence unavailable: ... Executable doesn't exist at <tempHOME>/Library/Caches/ms-playwright/...)` and exits 0 (suite still passes).
Standalone (`npx ts-node src/__tests__/browser-evidence-collector.test.ts`, real HOME) it prints `browser-evidence-collector: OK` - real Chromium from the shared cache, real pass + real fail.
This is the exact dual outcome Step 2.5 sanctions; required:true is correct because the skip branch exits 0; the plan's Self-Review keeps HOME isolation owned by the runner (out of scope to change). Net: real-browser verification genuinely happens (standalone); aggregate-runner skip is by-design HOME isolation, not a Chromium failure.
- Verified: build exit 0, `run-tests: 48 suite(s) passed` (skip line present), standalone collector OK.

Files touched (Task 2): sidecoach/src/validators/browser-evidence-collector.ts, sidecoach/src/__tests__/browser-evidence-collector.test.ts, sidecoach/scripts/run-tests.ts.
Commit: d7f7424.

## Task 3 - Generated browser-policy metadata + authoritative --check (DONE)
Why: the four browser-backed rules need an explicit, generated, checked-in allowlist split from the static cleanPolicy, with `--check` rejecting drift. genericity must NOT be inferred into browser policy just because it declares 'dom'.
How:
- `validator-generation.ts`: added exported `BROWSER_BACKED_RULE_IDS` (the 4 rules; genericity deliberately absent) and `COLLECTOR_EVIDENCE_KINDS` (computed-style/dom/contrast). Extended `GeneratedValidator` with `browserRuleIds` + `browserCoverageByScope`. Added `browserCoverageRecord` (maps each evidence requirement to `[evidenceKind]` directly - matched at runtime against browserEvidence.kinds, not static source kinds). `deriveValidator` now computes `browserRequired = owned.filter(BROWSER_BACKED_RULE_IDS.has)` and emits the two new fields. `validateRegistry` gained a 4th optional `browserBackedRuleIds: string[] = []` arg; new block rejects: (a) an allowlisted id no rule owns, (b) an allowlisted rule that is statically satisfiable, (c) an allowlisted rule with a non-collector evidence requirement. Rules OUTSIDE the allowlist are never rejected for being non-static -> genericity stays valid owned/non-required/inconclusive.
- `generate-validators.ts`: imports `BROWSER_BACKED_RULE_IDS`, passes `[...BROWSER_BACKED_RULE_IDS]` into the real-registry `validateRegistry`, and the rendered `GeneratedValidator` interface string now includes the two new fields.
- `generate-validators.test.ts`: added the plan's browser-split assertions (a11y browserRuleIds include min-hit-area+color-contrast; min-hit-area browser coverage evidence kind is 'dom'; pol.browserRuleIds == {concentric-radius,typography-rhythm}; genericity owned, NOT browser-backed, NOT required). Extended `expectInvalid` with a 5th `browser` arg + a matrix-consistent `okRule` helper, and added three isolated negative fixtures (12a absent id, 12b statically-satisfiable, 12c non-collector evidence via mixed ['dom','markup']).
- Regenerated `validators.generated.ts`: polish-standard browserRuleIds=[concentric-radius,typography-rhythm], static-a11y=[min-hit-area,color-contrast], theming/anti-pattern empty; genericity present once (ownedRuleIds only).
- Minor ordering note: implemented 3.3/3.4 before adding the 3.1 test assertions, but still confirmed RED (--check DRIFT on the stale committed generated file) before regenerating to GREEN, preserving TDD evidence.
- Verified: build exit 0, both `--check` OK, `run-tests: 48 suite(s) passed`.

Files touched (Task 3): sidecoach/src/validator-generation.ts, sidecoach/scripts/generate-validators.ts, sidecoach/src/validators.generated.ts, sidecoach/src/__tests__/generate-validators.test.ts.
Commit: e0fb0d2.

## Task 4 - Collector invocation, per-target promotion, clean degradation (DONE)
Why: the runtime must collect browser evidence ONCE per target, promote ONLY the browser rules whose evidence is present, execute browser rules always (so unavailable evidence surfaces inconclusive), and never throw/error on collector failure or absent URL.
How:
- `run-validator.ts`: added `ValidatorRuntimeDeps` (injectable collectBrowserEvidence seam) + `activateBrowserPolicy(base, gen, kinds)` (promotes gen.browserRuleIds whose evidenceRequirements are all in the collected kinds; appends their browserCoverageByScope). `toCheckContext` now takes the browser collection and, when available, sets browserEvidence + computedStyle/dom/contrast from the trusted evidence (falling back to raw ad hoc for back-compat). `executeRule` gained a `browser` param; its non-static branch now builds a synthetic render-URL coverage observation (discovered/inspected = [renderUrl] when available) and computes sufficientlyCovered. `ValidatorRunDetail` gained `activePolicy`; `runDetailed` collects browser evidence after static collection, builds activePolicy, uses it for recordById/coverageObservations/final evaluateCleanPolicy, passes browser into executeRule, returns activePolicy. Early-error/abort returns carry the static policy (or EMPTY_POLICY); `abortedDetail` takes an optional policy. `runValidatorForTest` gained a deps arg; production `makeProductValidator` uses default (real collector, which no-ops to available:false when there is no render URL).
- `lane-runner.ts`: imported `renderUrlFromContext`; extended the runValidator dep type + runStepValidators/runBoundaryValidators ctx types to `{projectPath,target,renderUrl?}`; both call sites now pass `renderUrl: renderUrlFromContext({target: cp.target})` so a URL-shaped lane target becomes browser-verifiable without a checkpoint-schema change.
- New `browser-evidence-degradation.test.ts` (required:true, ALWAYS runs): no-URL and injected-collector-failure -> the two a11y browser rules surface inconclusive and are NOT promoted, and a collector failure is never a validator error; a successful polish-standard collector keeps genericity inconclusive + non-required.
- `product-validator-pipeline.test.ts`: added `browserPromotion()` (called in run()) proving successful collection promotes the four rules with real coverage (a11y fail->findings; polish pass), genericity stays inconclusive/non-promoted.

### RECONCILIATION (flagged to team-lead) - browserPromotion static-a11y context
The plan's browserPromotion static-a11y case asserts result.status==='findings' but used context {files:[], renderUrl}. static-a11y ALSO requires the static rule a11y.focus-visible, which is inconclusive with no CSS; evaluateCleanPolicy (P4a-1, OUT OF SCOPE) short-circuits required-inconclusive BEFORE counting blocking browser fails, so the real result was 'inconclusive' (verified empirically). Fix: added a clean focus-visible CSS file to ONLY that test's static-a11y context so the required static rule PASSES (covered), letting the two failing blocker browser rules drive 'findings'. Intent preserved/strengthened; browser-rule assertions unchanged; clean-evaluator untouched; degradation suite needed no change. This is the only deviation from the plan's literal test code.
- Verified: build exit 0, both --check OK, `run-tests: 49 suite(s) passed` (baseline 46 + 3 new suites). Degradation OK; collector SKIPs in-runner (HOME isolation, by design).

Files touched (Task 4): sidecoach/src/validators/run-validator.ts, sidecoach/src/lane-runner.ts, sidecoach/src/__tests__/browser-evidence-degradation.test.ts, sidecoach/src/__tests__/product-validator-pipeline.test.ts, sidecoach/scripts/run-tests.ts.
Commit: 5d4c5d8.

## Task 5 - Final integration verification + explicit dist commit (DONE)
Why: prove the whole lane is green, hermetic, in-scope, ASCII-clean, and commit ONLY the explicitly-allowlisted generated dist (never a broad `git add dist/`).
How / verification:
- 5.1 focused matrix: browser-evidence-rules / -collector / -degradation / generate-validators / product-validator-pipeline all OK. Collector ran STANDALONE against real Chromium (OK), proving real pass + real fail.
- 5.2: regenerate + both --check OK, build exit 0, `run-tests: 49 suite(s) passed`. validators.generated.ts had no drift after regen (already committed in Task 3).
- 5.3: committed diff main...HEAD = exactly the 17 intended source/test/script/generated files. product-rule-registry.ts UNTOUCHED (genericity entry intact). No mcp-server/hooks paths in my commits (the mcp-server entries in `git status` are PRE-EXISTING baseline dirt, verified against the baseline snapshot, never staged/committed by me). No playwright-report/test-results/.cache artifacts.
- 5.4: ASCII/control-byte guard OK on the plan + new collector/test files AND all other edited source files (no Unicode dashes, no control bytes).
- 5.5/5.6: staged the explicit per-file dist allowlist. product-rule-types.* was UNCHANGED (source untouched) so its 4 files were correctly omitted; 32 dist files staged (8 stems x 4 suffixes). Deterministic rebuild produced byte-identical staged output. `git diff --cached --check` clean.

## Final state
- Branch lane-p4b2, 5 commits. Final `run-tests: 49 suite(s) passed` (baseline 46 + browser-evidence-rules + -collector + -degradation). Plan's absolute counts are each +1 vs this codebase (plan baseline 47 vs actual 46).
- Genericity: registry entry + checkProduct untouched; remains owned, NOT browser-backed, NOT required, inconclusive even with a successful collector (proven by browser-evidence-rules, generate-validators, degradation, and pipeline suites).
- Playwright reuses the shared `~/Library/Caches/ms-playwright` cache; NO `playwright install` / browser download. Tests hermetic (data: fixture, no network; collector blocks cross-origin subresources).
- The real-browser collector SKIPs cleanly inside `npm test` due to the aggregate runner's HOME isolation (browser cache lives under the real HOME); runs OK standalone. required:true is correct (skip exits 0).

## Task 6 (lead-directed) - run collector real-browser test INSIDE npm test (DONE)
Why: the team-lead directed that the real-browser collector path must be covered by the committed `npm test` gate, not only a manual standalone run (otherwise P4b-2's core path is a coverage gap). Approved as in-scope (run-tests.ts is already modified for suite registration); noted as a deviation.
How: in `scripts/run-tests.ts`, BEFORE the temp-HOME override, set `process.env.PLAYWRIGHT_BROWSERS_PATH` to the OS-default ms-playwright cache under the REAL home (darwin: ~/Library/Caches/ms-playwright; win32: ~/AppData/Local/ms-playwright; else ~/.cache/ms-playwright). Respects a pre-existing PLAYWRIGHT_BROWSERS_PATH (never clobbers a user/CI override). execFileSync inherits env, so every spawned suite resolves Chromium from the shared cache regardless of the temp HOME. On a cacheless machine the env var points at a missing dir and the collector SKIPs gracefully (required:true, exit 0) - no hard failure.
Verification (full `npm test`):
- `run-tests: playwright cache -> /Users/spare3/Library/Caches/ms-playwright`, `isolated HOME -> <temp>`, then `browser-evidence-collector: OK` (NOT SKIP) inside the aggregate run. `run-tests: 49 suite(s) passed`, exit 0.
- HOME isolation intact: real ~/.claude/sidecoach-flow-history.json byte-identical before/after (mtime 1781435574, md5 03ad42c45855a4b370c5411ae61c1083 unchanged).
- No Playwright writes under the temp HOME: temp HOME holds ONLY .claude/sidecoach-flow-history.json (the expected isolated flow-history write); 0 ms-playwright paths under it (Chromium read the shared cache read-only; its temp profile lives under os.tmpdir(), not HOME).
Deviation note: this run-tests.ts env-block change is a lead-directed addition beyond the plan's literal "register suites" scope. Commit: build(lane-p4b2): run collector real-browser test inside aggregate npm test.

Files touched (Task 6): sidecoach/scripts/run-tests.ts. Build gate re-ran green (exit 0, --check OK) before commit.

## Codex review fixes (collector internals; framework integration confirmed sound)
Codex review = NEEDS-FIXES on 4 collector-internal defects (genericity exclusion, trusted-marker gating, static baseline, runtime promotion, --check, PLAYWRIGHT_BROWSERS_PATH all confirmed sound). Each fixed failing-test-first, green gate after each. Lane stays lane-p4b2.

### P1-1 - contrast false trusted PASS (DONE, highest priority)
Why: the collector skipped unparseable colors, ignored background images/gradients, assumed opaque white, and turned "nothing measured" into {wcagAA:true, ratio:21}; a11y-checks then read wcagAA:true as a BLOCKER PASS. An unmeasurable page FALSE-PASSED a blocker a11y rule - violates "missing/incomplete evidence -> inconclusive, never pass."
How: `browser-evidence-collector.ts` now tracks contrastApplicable vs contrastMeasured and a contrastUnsupported flag. `backgroundFor` returns `{color, unsupported}` - unsupported flips true on any ancestor background-image/gradient (background-image !== 'none') or an unparseable non-transparent backgroundColor. A text element with an unparseable foreground color also sets unsupported. `contrastMeasurable = applicable>0 && measured===applicable && !unsupported`. The evaluate returns `contrast.measurable`; the Node side includes 'contrast' in the trusted evidence kinds ONLY when measurable (computed-style + dom always present), and never defaults the ratio to 21 (0 when nothing measured). So a11y.color-contrast stays inconclusive on any page it could not honestly measure.
Test: new `browser-evidence-contrast.test.ts` (required:true, SKIP-aware) - fixtures (a) no text, (b) text over a gradient, (c) wide-gamut color(display-p3 ...) foreground -> ALL yield a11y.color-contrast = inconclusive and 'contrast' absent from kinds; plus a faithfully-measurable low-contrast page that DOES emit trusted contrast and FAILs (proves the gate did not over-withhold). RED first (no-text false-passed as 'contrast' trusted), GREEN after fix.
Verified: build exit 0, `run-tests: 50 suite(s) passed`, collector OK (not SKIP), existing collector/rules/degradation unaffected.
Files: sidecoach/src/validators/browser-evidence-collector.ts, sidecoach/src/__tests__/browser-evidence-contrast.test.ts, sidecoach/scripts/run-tests.ts.

### P1-2 - network hermeticity incomplete (DONE)
Why: page.route did not cover Service Workers or WebSockets, so a reviewed page could still open cross-origin channels.
How: extracted the subresource-allow decision into an exported pure `isSubresourceAllowed(suppliedUrl, requestedUrl)` (data: inline always allowed; data:/file: doc -> same-protocol only; http(s) doc -> same-origin only; cross-origin HTTP and all ws/wss blocked; unparseable -> blocked). page.route now delegates to it. Added `serviceWorkers: 'block'` to newContext and `page.routeWebSocket(() => true, ws => ws.close())` BEFORE navigation to block every websocket (the collector reads static layout and never needs a live socket).
Test: new `browser-evidence-hermeticity.test.ts` (required:true). The hermetic policy is proven by a network-free unit test of isSubresourceAllowed (cross-origin http + ws/wss + garbage URL all blocked; same-origin/data allowed) that ALWAYS runs; a SKIP-aware real-browser case proves collection still completes when a page embeds a cross-origin <img> and attempts a cross-origin WebSocket. RED first (isSubresourceAllowed not exported), GREEN after. playwright 1.60 supports page.routeWebSocket + serviceWorkers:'block'.
Verified: build exit 0, `run-tests: 51 suite(s) passed`, collector OK.
Files: sidecoach/src/validators/browser-evidence-collector.ts, sidecoach/src/__tests__/browser-evidence-hermeticity.test.ts, sidecoach/scripts/run-tests.ts.

### P1-3 - AbortSignal not honored mid-op (DONE)
Why: the signal was only checked before launch and after goto; an abort during launch/navigation/evaluate could still return available:true and delayed cancellation (hang), with no listener to close the in-flight browser.
How: added an `AbortError` class and a single abort listener that (a) closes whatever browser exists and (b) rejects a shared `aborted` promise carrying the phase that was in progress (`during launch|navigation|collection`). A `race(p, phase)` helper wraps launch, newContext, goto, and evaluate via Promise.race against `aborted`, so an abort at ANY phase rejects the in-flight op immediately. Added a post-evaluate aborted check before returning available:true. The finally removes the listener and, if we bailed before `browser` was assigned (abort during launch), awaits the in-flight launch promise to close its browser - no leak. `void aborted.catch()` prevents an unhandled post-return rejection.
Test: new `browser-evidence-abort.test.ts` (required:true, SKIP-aware). already-aborted -> "aborted before launch"; a near-immediate abort (fires during launch, which takes far longer) -> available:false with an "aborted during launch" reason (RED pre-fix: old code could only report "during navigation" via its single post-goto check); and a normal collection still succeeds after aborted runs (no hang/leak). RED->GREEN confirmed.
Verified: build exit 0, `run-tests: 52 suite(s) passed`, collector OK.
Files: sidecoach/src/validators/browser-evidence-collector.ts, sidecoach/src/__tests__/browser-evidence-abort.test.ts, sidecoach/scripts/run-tests.ts.

### P2 - concentric-radius first-child only (DONE)
Why: the concentric scan used `.find(visible)` so only the FIRST visible child of each rounded parent was examined; a clean first child hid failing siblings.
How: restructured the loop to compute the parent's outer radius + padding once, then iterate EVERY visible direct child (filter(visible)) and count each qualifying parent-child pair. A failing sibling is now caught.
Test: new `browser-evidence-concentric.test.ts` (required:true, SKIP-aware): parent radius 12 + padding 4 (faithful inner = 8), first child radius 8 (clean), second child radius 20 (fail) -> checkedPairs >= 2, failingPairs >= 1, and concentric-radius = FAIL. RED pre-fix (checkedPairs=1, would PASS), GREEN after. Existing single-child collector fixture still PASSes.
Verified: build exit 0, `run-tests: 53 suite(s) passed`, collector OK.
Files: sidecoach/src/validators/browser-evidence-collector.ts, sidecoach/src/__tests__/browser-evidence-concentric.test.ts, sidecoach/scripts/run-tests.ts.

### Codex-fix commits (source+test; dist re-committed at the end)
- b687468 P1-1 contrast false-pass
- db2b92e P1-2 hermeticity (SW + WS)
- 74572b8 P1-3 abort mid-op
- (P2 below)
Final suite count: 53 (was 49; +4 new browser suites: contrast, hermeticity, abort, concentric). Real-browser collector test still prints OK (not SKIP) inside npm test.
Final verification after all 4 fixes: build exit 0, both --check OK, run-tests: 53 suite(s) passed, collector OK (not SKIP), flow-history md5 byte-identical before+after (03ad42c45855a4b370c5411ae61c1083). Dist re-commit: dist/validators/browser-evidence-collector.{js,js.map,d.ts,d.ts.map} (only collector source changed across the 4 fixes; run-tests.ts is scripts/, new test dist not in the committed allowlist).

## renderUrl activation path (lead-directed scope expansion; now spans mcp-server)
Reality-check found the 4 browser rules only fired when the lane TARGET was literally a URL (renderUrlFromContext({target})); free-text targets left them dormant. Jonah approved an explicit renderUrl input path. Failing-test-first, green per commit.

### Engine (DONE)
Why: a lane needs a renderUrl distinct from its free-text target so the collector activates without overloading `target`.
How:
- `lane-checkpoint-store.ts`: added optional `renderUrl?: string` to LaneCheckpoint (target identity, NOT evidence). Migration-safe: `...raw` passes it through; older checkpoints lack it (undefined). No schema bump.
- `lane-runner.ts startLane`: new optional `renderUrl?` param; validated via `renderUrlFromContext({ renderUrl })` (stores only a valid http/https/file/data URL, else undefined); set on the created checkpoint. Both validator call sites now use `renderUrlFromContext({ renderUrl: cp.renderUrl, target: cp.target })` so an explicit stored renderUrl wins and the target-as-URL fallback is preserved.
- `sidecoach-orchestrator.ts startLane`: new optional `renderUrl?` param threaded into laneRunner.startLane (the engine method used by CLI + MCP). Internal route call (free-text) passes none -> dormant, unchanged.
- New `lane-render-url.test.ts` (required:true): (1) WITH a data: renderUrl -> validator ctx.renderUrl equals it AND it persists on the checkpoint across reload; (2) free-text target -> ctx.renderUrl undefined (dormant); (3) non-URL renderUrl stored as undefined; (4) real verdicts through the lane via makeProductValidator - no renderUrl -> all browser rules inconclusive, with a data: renderUrl -> at least one browser rule reaches a real verdict (SKIP-aware). Drives lane_build (craft step binds polish-standard). RED first (startLane 5-arg, no checkpoint renderUrl), GREEN after.
- Verified: build exit 0, --check OK, `run-tests: 54 suite(s) passed`, collector OK, lane-render-url OK (real verdict activated, not SKIP).
Files (engine): sidecoach/src/lane-checkpoint-store.ts, sidecoach/src/lane-runner.ts, sidecoach/src/sidecoach-orchestrator.ts, sidecoach/src/__tests__/lane-render-url.test.ts, sidecoach/scripts/run-tests.ts (+ engine dist).

### MCP (DONE; first time this lane crosses into mcp-server)
Why: expose renderUrl as a sidecoach_lane start arg so callers activate the browser rules without overloading the free-text target.
How:
- `mcp-server/src/schemas.ts`: added optional `renderUrl` to laneShape, validated via a local `isValidRenderUrl` (http/https/file/data protocol allowlist mirroring renderUrlFromContext); a non-URL is rejected at the schema boundary. Max 4096 chars.
- `mcp-server/src/tools/lane.ts`: start case now passes `request.renderUrl` into `engine.startLane(..., request.renderUrl)`. Start-only (other operations ignore it).
- Docs: README.md + DESIGN.md lane-arg enumerations updated with `renderUrl?`.
- New `mcp-server/__tests__/integration/lane-render-url.test.ts` (auto-discovered by the category runner): schema accepts a valid data:/https: renderUrl and rejects a non-URL; handler start threads renderUrl onto the checkpoint (read back via the engine-dist LaneCheckpointStore), and omitting it leaves renderUrl undefined. RED first (zod stripped the unknown key; checkpoint renderUrl undefined), GREEN after.
- Cross-package gate: built BOTH (engine `npm run build` + mcp-server `npm run build`, both exit 0). Engine `npm test`: 54 suites pass. mcp-server `npm test`: 296/297 pass - the ONLY failure is the known env-dependent `python_repl OOM` test (sanctioned). flow-history untouched. `stdio-transcript.txt` is pre-existing baseline dirt, NOT staged.
Files (MCP): sidecoach/mcp-server/src/schemas.ts, sidecoach/mcp-server/src/tools/lane.ts, sidecoach/mcp-server/README.md, sidecoach/mcp-server/DESIGN.md, sidecoach/mcp-server/__tests__/integration/lane-render-url.test.ts (+ mcp-server dist schemas + tools/lane).

### HOME-isolation fix for the mcp-server test runner (DONE; bug I missed)
Bug (team-lead reality-check, confirmed): the real ~/.claude/sidecoach-flow-history.json CHANGES during a full mcp-server `npm test`. Root cause: `mcp-server/__tests__/run-tests.ts` had NO HOME isolation (unlike the engine runner). Its lane-driving integration suites (lane-tool-e2e, my new lane-render-url) call engine startLane/advanceLane, which since P4f publish the committed step to the HOME-scoped flow-history (FlowHistory.HISTORY_FILE is a static getter reading process.env.HOME at call time). With no temp HOME, that publish wrote the developer's REAL file. Latent since P4f; my new lane test made it visible.
RED reproduced: real md5 85d42f65 -> ccb0c69f across one mcp test run.
Fix: in `mcp-server/__tests__/run-tests.ts`, at module top (before main() require()s any suite/the engine dist), capture REAL_HOME, set PLAYWRIGHT_BROWSERS_PATH (only-if-unset) to the real-home OS-default ms-playwright cache, stamp the real flow-history (mtime:size), then `process.env.HOME = fs.mkdtempSync(...)`. Added a regression GUARD in main() after the suites: if the real flow-history stamp changed, print "HOME-ISOLATION BREACH" and exit 3 (catches any future breaching suite loudly). The in-process require() model means setting HOME before the suite requires is sufficient.
GREEN re-verify (BOTH runners, single md5 window): real md5 BEFORE both = ccb0c69f...; engine `npm test` 54 suites pass; mcp `npm test` 296/297 (only sanctioned python_repl OOM; "isolated HOME -> <temp>" printed); real md5 AFTER both = ccb0c69f... (BYTE-IDENTICAL). Guard did not fire (no breach). run-tests.ts is a script, no dist.
Files: sidecoach/mcp-server/__tests__/run-tests.ts. Commit: see below.

### P1 abort latency - prompt return on a STALLED launch (DONE; final Codex re-review item)
Why: the round-1 abort fix returned the correct reason, but the finally AWAITED the launch promise to close the browser. If chromium.launch() STALLS, an aborted collector still HUNG (right reason, not prompt). The prior abort test only checked the reason after launch eventually settled, never bounded latency.
How:
- Added a test-only LAUNCHER SEAM: collectBrowserEvidence gains an optional 3rd param `launcher = () => chromium.launch({headless:true})` (production passes only renderUrl+signal - public 2-arg contract unchanged). Renamed the in-flight promise var `launch` -> `launchPromise`.
- Codex fire-and-forget fix in finally: on a launch-phase bail (browser not yet assigned), `void launchPromise.then(b => b.close()).catch(()=>undefined)` instead of `await launchPromise` - return promptly, close the browser whenever the (possibly stalled) launch eventually resolves; .catch prevents an unhandled rejection. An already-launched browser is still closed synchronously (await branch).
- New `browser-evidence-abort-latency.test.ts` (required:true, deterministic, NO real Chromium): inject a launcher that NEVER settles, abort during launch, race the collector against a 2s watchdog -> the collector must resolve (available:false, "aborted during launch") while the injected launch is STILL pending. RED first (hung -> watchdog won), GREEN after the fire-and-forget fix. Seam refactor verified non-behavioral (collector/abort tests stayed green before the test was added).
- Verified BOTH runners + md5: real flow-history md5 BEFORE both = ccb0c69f...; engine `npm test` 55 suites pass (collector OK, latency OK); mcp `npm test` 296/297 (OOM only, isolated HOME, guard quiet); real md5 AFTER both = ccb0c69f... (byte-identical).
Files: sidecoach/src/validators/browser-evidence-collector.ts, sidecoach/src/__tests__/browser-evidence-abort-latency.test.ts, sidecoach/scripts/run-tests.ts (+ collector dist).

### P2 dist trailing-whitespace + P3 genuine RED demo (DONE; final re-review items)
P2 (gating): `git diff --check main..lane-p4b2` failed - committed dist/validators/browser-evidence-collector.js:50 had trailing whitespace on the compiled signature. Root cause was NOT the inline comment (my first guess) but the MULTI-LINE param formatting: tsc emits `...(renderUrl, signal, ` with a trailing space before the line break when params span lines. Fix: put the collectBrowserEvidence signature back on ONE line (comment moved above the function). Rebuilt -> compiled signature is a single line with no trailing space; working-tree collector dist `git diff --check` clean. (Lesson: confirmed the fix with the external probe `git diff --check` rather than assuming the comment-move fixed it - it didn't; the second diagnosis, single-line params, was the real cause.)
P3 (accuracy of the fail-first claim): the latency test's RED at the true parent (1560492's parent) was a COMPILE error (collector took 2 args there), not the runtime hang. Demonstrated the GENUINE runtime RED: with the launcher seam PRESENT, temporarily reverted ONLY the finally to `await launchPromise` -> latency test compiled and HUNG (watchdog: "collector did not return promptly on a stalled-launch abort (hung awaiting the launch)") -> restored the fire-and-forget -> GREEN. The temporary revert was NOT committed (demonstration only).
Verify: engine `npm test` 55 suites pass (abort-latency OK); mcp 296/297 (OOM only, isolated HOME, guard silent); flow-history md5 BEFORE==AFTER ccb0c69f... (byte-identical); `git diff --check main..lane-p4b2` clean after committing the rebuilt dist.
Files: sidecoach/src/validators/browser-evidence-collector.ts (signature single-lined) + collector dist.

## Failure-mode self-analysis
HOME-pollution miss (this lane): I claimed "flow-history untouched / HOME isolation intact" across the renderUrl work, but I only ever md5-checked around the ENGINE runner (which IS isolated). I never ran the md5 window around the MCP runner - the very runner whose new lane test I added that drives startLane and publishes to flow history. I even SAW the symptom (the session md5 drifted 03ad42c -> 1940706) and rationalized it as "activity outside my isolated test runs" instead of investigating - a textbook confirmation-bias dismissal of contradicting evidence. The signal I missed: two separate test runners means two separate isolation responsibilities; verifying one does not verify the other. The shortcut I took: treating "the engine runner isolates HOME" as "the test suite isolates HOME." Correct habit going forward: when an invariant (no real-HOME writes) spans multiple independent runners, assert it around EACH runner, and when a monitored value changes unexpectedly, trace it rather than hand-wave it - especially when my own new code is the most likely cause. The team-lead's "re-verify activation/consumption, not just green" is exactly the discipline that caught this.
The one real snag (Task 4 browserPromotion expecting 'findings' but getting 'inconclusive') came from the plan author not accounting for static-a11y's OTHER required static rule (a11y.focus-visible) being inconclusive under an empty-files context, which short-circuits in the out-of-scope P4a-1 evaluator before findings are counted. I caught it by static-analyzing evaluateCleanPolicy + the generated requiredRuleIds BEFORE running, predicted the failure, ran the exact plan test to confirm (evidence over theory), then applied the minimal intent-preserving reconciliation (clean focus-visible CSS so the static rule passes) and flagged it to the team-lead rather than silently changing plan test code. Lesson reinforced: when a plan's expected status depends on an aggregate evaluator, trace ALL required rules' dispositions, not just the ones the task adds.
