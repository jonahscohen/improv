---
name: sidecoach-option-B-convergence-PLAN
description: The staged, verifiable convergence plan for Option B (one detection engine). Target architecture + 6 stages each with implement/Codex-review/verify gates + guardrails. Green baseline = 60 suites @ 774ab884.
type: decision
relates_to: [session_2026-06-24_sidecoach-option-B-convergence-mandate.md, session_2026-06-24_sidecoach-S5-integration-gap-and-plan.md, session_2026-06-24_sidecoach-stage1-plan.md]
---

Collaborator: Jonah Cohen. Green baseline before any change: **60 test suites passing, exit 0, HEAD 774ab884** (objective calibration 34 asserted, subjective 21 asserted). This is the regression anchor.

## THE SURFACE (verified by 2 Explore passes 2026-06-24) - THREE parallel detection mechanisms today
1. **Registry path** (`src/validators/run-validator.ts makeProductValidator` -> `checkProduct(ctx)` per owned rule, clean-policy + coverage + browser-evidence seam). 31 canonical rules in `product-rule-registry.ts` (polish-standard 21, static-a11y 3, theming 2, anti-pattern 5). ALREADY wired into the live lane path: orchestrator `laneDeps()` (~line 1651) wires `deps.runValidator` -> `getValidatorRegistration().validateProduct` -> `makeProductValidator`; lane-runner `runStepValidators` (~431) / `runBoundaryValidators` (~862) call it; render triggered when `cp.renderUrl` present. Golden test `product-rule-registry.test.ts` asserts RULES.length===31 (~line 172).
2. **Static validateAll path** (12 flow-handler call sites bypass the registry): `PolishStandardValidator.validateAll` (tactical-polish:211) + `ExtendedDomainValidator.validateAll` x9 (tactical-polish:212, component-implementation:98, constraint-design:31, layout-optimization:33, motion-patterns:163, design-references:120, accessibility:202, font-research:84) + `new AntiPatternValidator()` x3 (flow-handlers-tier3-tier4:200/470/607). ExtendedDomainValidator = 108KB / 112 rules (22 polish dups + 90 domain extensions: forms/gesture/animation/viz/i18n).
3. **Rendered scanners** (the eval-proven engine, ZERO live callers): `objective-rendered-scanner.ts scanObjectiveRendered(html,opts)` -> ObjectiveScan {available, findings:ObjectiveFinding[]} for broken-image/skipped-heading/low-contrast/gray-on-color/justified-text; `subjective-rendered-scanner.ts scanSubjectiveRendered(html,opts)` for tiny-text/nested-cards. Fail-closed. Consumed ONLY by eval/ (`eval/sidecoach-scan.mjs:52-67` imports the dist module + calls scanObjectiveRendered/scanSubjectiveRendered).

## TARGET ARCHITECTURE (one engine) - decided, pending Codex adversarial check
Keep the **registry/run-validator spine** as the single integration + test surface (live path + 60 suites depend on it; replacing it is needless blast radius). Make the **rendered scanner THE rendered-detection mechanism inside it**:
1. ONE rendered pass per target: a shared, memoized scan (objective + subjective) invoked from run-validator, replacing both the eval-only scanner call AND the overlapping per-rule browser checkProduct (e.g. a11y.color-contrast collapses into the scanner's low-contrast).
2. Scanner classes -> registry rules: register each finding-class as a rendered-evidence rule whose checkProduct reads the memoized scan (no second render).
3. Retire the static validateAll path: the 12 flow-handler sites route through runValidator; the registry must cover what they need.
4. Triage + absorb/retire ExtendedDomainValidator: 22 polish dups retire; 90 domain rules -> absorb valuable as registry rules, retire low-signal. The 108KB simplification.
5. Absorb remaining standalone validators (taste/typography/linguistic-ban/anti-pattern): unique detection -> registry rules; retire the classes once unreferenced.
6. One vocab (registry) + one classifier (lane-classifier). No parallel rule sets.
END STATE: live NL path AND eval invoke the SAME engine; no parallel validateAll; eval measures the converged engine (detection-preserving); simpler (108KB dup + parallel path deleted).

## STAGES - each = implement -> Codex adversarial review -> fold ALL findings -> verify (tests+eval green, behavior observed) -> beat. /loop until all done.
- **Stage 1 (CORE wiring): rendered scanner -> registry rules, invoked by run-validator.** Detection-preserving. Register 5 objective + tiny-text subjective as rendered registry rules off ONE memoized scan; dedupe a11y.color-contrast. GATE: eval scorecard findings IDENTICAL (no regression of 0.894 objective), referee-independence green, golden updated, 60+ suites green, a REAL NL utterance ("that accordion needs polish") surfaces scanner findings end-to-end.
- **Stage 2: migrate the 12 static validateAll call sites to runValidator.** GATE: flow-handler tests green, findings preserved.
- **Stage 3: triage + absorb/retire ExtendedDomainValidator (108KB).** GATE: tests green, eval unchanged, kept-vs-retired capability map reviewed (no silent capability loss).
- **Stage 4: absorb remaining standalone validators; collapse to one vocab.** GATE: tests, eval.
- **Stage 5: subjective/taste frontier - BEAT oracle on subjective.** The mission-winning axis (oracle 0.277 vs our ~0.033 historically; tiny-text/nested-cards/motion partially done). nested-cards negative top-up + tighten, motion instrument, remaining taste classes. GATE: subjective recall BEATS oracle, precision-disciplined per-class.
- **Stage 6: final convergence proof.** One engine (no parallel detection), beat oracle on EVERY axis (objective parity+, subjective beat) AND simpler. Full frozen-90 scorecard, Codex final gate, lead gate.

## GUARDRAILS (do not break)
- `referee-independence.test.ts` green: the scanner never imports eval/ (live importing scanner is fine; one-directional).
- DETECTION-PRESERVING: convergence must NOT change WHAT the scanner detects - eval numbers must not regress (the 0.894 objective + render-robustness are banked wins).
- Held-out discipline: develop against dev signal; frozen-90 = milestone measurement per fix-BATCH only, never per-tweak (training-on-test = Contract-6 disqualifier).
- Precision co-equal with recall, per-class, every batch. New gate: precision needs >=~10 negatives ([[session_2026-06-24_sidecoach-nested-cards-precision-miss]]).
- author != labeler for taste; slash = failsafe, NL = driver.

## OPERATING (per the mandate beat)
Autonomous /loop, cmux-teams agents, Codex adversarial reviewer (produce-and-verify: producer never self-certifies). 10-version-per-component handoff to Codex. Track per-component version counters. Bar: if oracle beats ANY axis, FAIL.

## RESUME POINT (next session, after teams-mode relaunch) - 2026-06-24
Jonah chose to RELAUNCH in cmux agent-teams mode (this session had teams mode OFF; see [[reference_cmux_agent_teams_flag_unset]]). On resume:
1. FIRST verify teams mode is actually on: `echo $CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` == 1 AND `~/.claude/teams/session-<id>/` is populated. Do NOT trust that an Agent call "returned" - an inline return = in-process, not a pane. If the flag is STILL unset, tell Jonah (the relaunch didn't take) rather than silently running in-process again.
2. NO product code was changed this session - only beats + the harness task list (6 stages, all pending). IMPORTANT: the working tree already carried ~13 uncommitted modified sidecoach/src files at session start (polish-checks.test, product-rule-registry(.test), validator-integration.test, dogfood-runner, flow-handler-tactical-polish, flow-specific-validators, model-routing, phase-iii-integration.test, polish-standard-validator, validators.generated, validators/checks/polish-checks, t13-bench-harness.test) - these PRE-DATE this session, are NOT mine, and the green baseline (60 suites) passed WITH them present. Do NOT revert them; they are the working-tree baseline. HEAD is 774ab884.
3. The Codex adversarial architecture review was STOPPED by Jonah before completing - RE-RUN it (now as a real teammate pane) as the first act of Stage 1, fold its findings, THEN build Stage 1 (wire rendered scanner into run-validator, detection-preserving). The review prompt + the 6 risk areas are in this beat's TARGET ARCHITECTURE section + the mandate beat.
4. Then /loop the 6 stages to full convergence. Bar: beat oracle on every axis.

## Files touched
- (planning beat; implementation in follow-on stage beats)
