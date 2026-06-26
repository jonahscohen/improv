---
name: sidecoach-S5-integration-gap-and-plan
description: REVELATION + DIRECTION - the oracle-beating detection engine was proven in eval/ but NEVER wired into the live natural-language workflow (Stage-1 plan's "S5: wire scanner into shipping product path" was left undone). This is THE next-session priority. Full diagnosis + chosen forward path (Option A).
type: decision
relates_to: [session_2026-06-24_sidecoach-stage1-plan.md, feedback_sidecoach_mission_beat_oracle.md, session_2026-06-24_sidecoach-motion-flip-verification.md]
---

Collaborator: Jonah Cohen.

**START HERE next session.** Written 2026-06-24 right before a deliberate restart (also clears the [[reference_cmux_team_init_orphan_bug]]). This is the most important open item in the project.

## THE REVELATION (what was discovered)
The "beat oracle" mission was declared COMPLETE on the wrong axis. It was proven in the EVAL HARNESS (objective 0.936, precision wins, motion-artifact exposed) but the actual product goal - the oracle-beating detection driving the LIVE natural-language workflow - was NEVER built. The proof exists in `eval/`; the delivery to users does not.

Verified against code (2026-06-24):
- The rebuilt objective engine `src/validators/objective-rendered-scanner.ts` (`scanObjectiveRendered`) is called from **eval/ ONLY** (`eval/sidecoach-scan.mjs`, `eval/real-page-render-probe.mjs`). Zero callers in any flow-handler, lane, orchestrator, or runValidator.
- Its detection classes - `broken-image`, `skipped-heading`, `low-contrast`, `gray-on-color`, `justified-text` (+ the subjective sibling `subjective-rendered-scanner.ts`: tiny-text, nested-cards) - live ONLY in that scanner's in-page logic (`inPageObjective`).
- The LIVE path detects only ONE of these classes: `a11y.color-contrast` (wired via `browser-evidence-collector` as a registry browser-backed rule). Everything else the scanner detects is invisible to the running product.
- **The smoking gun:** [[session_2026-06-24_sidecoach-stage1-plan]] has an explicit step **"S5 wire owned scanner into shipping product path + eval/sidecoach-scan.mjs"**. The eval half shipped; the "shipping product path" half did NOT. S5 is half-done.

## JONAH'S ACTUAL INTENT (in his words, 2026-06-24 - do not lose this)
- Natural-language detection is the **MAIN DRIVER**. Slash commands are a standalone **FAILSAFE**, nothing more.
- oracle's REAL failure = it forces users into slash commands. Sidecoach's whole thesis is to prove oracle is unwieldy and **do the orchestration better, with oracle's best validation concepts in tow**.
- "that accordion needs polish" (freeform NL) must **seamlessly invoke oracle-beating functionality**. That is the product.
- He NEVER wanted a separate, unusable eval track. Beating oracle in a harness while the live workflow runs older/thinner detection is a failure of the actual goal, not a success.

## THE ARCHITECTURE (grounded, so the next session doesn't re-derive it)
Two render+detect engines that don't know about each other:

1. **LIVE natural-language path** (what users hit):
   utterance -> `src/lane-classifier.ts` (`resolveSidecoachPhrase`: ROUTE / CLASSIFY / OUT_OF_SCOPE / SILENT) -> `sidecoach-orchestrator.ts` dispatches a lane -> `lane-runner.ts` walks steps -> at bound steps + convergence boundaries calls `deps.runValidator(validatorId, ctx)` (lane-runner.ts ~437/869).
   - `runValidator` = `makeProductValidator` in `src/validators/run-validator.ts`: `collect`s project evidence (project-collector), RENDERS via `browser-evidence-collector` (has a clean per-run browser dependency SEAM ~line 38-42), runs registry rules' `checkProduct(ctx)` including browser-backed rules (promotes `browserRuleIds` when evidence available), returns `ProductValidationResult`.
   - NUANCE: there are actually TWO live validation invocation styles. (a) flow-handlers call `PolishStandardValidator.validateAll` / `ExtendedDomainValidator.validateAll` directly (the static POLISH_RULES / DOMAIN_RULES - older path). (b) lane-runner calls `deps.runValidator` (the registry four-status path - newer, rendered, has the browser seam). S5 should target (b); reconcile/dedupe with (a) later.

2. **EVAL scanner** (the oracle-beating engine, eval-only):
   `scanObjectiveRendered(html, opts)` -> launches its OWN Playwright chromium (`import { chromium } from 'playwright'`) -> `analyzeHtmlOnBrowser` -> `page.setContent(html)` -> `page.evaluate(inPageObjective)` -> `ObjectiveFinding[]`. FAIL-CLOSED (`{available:false}` on render error, never a false "0 = clean"). Renders IDENTICALLY to the eval ground-truth referee `eval/objective-label-rendered.mjs`; `src/__tests__/referee-independence.test.ts` mechanically forbids the scanner's import graph from touching `eval/`.

The difference is mechanism: live = render -> collect evidence into a `ProductCheckContext` -> run Node-side `checkProduct`. Scanner = render -> run an in-page JS detector -> return findings. So the scanner is a genuinely separate engine, not just unregistered rules.

## INTEGRATION OPTIONS (decision is OPEN - Jonah has not picked; he rejected the menu to redirect to documenting)
- **Option A (recommended, phase 1): wrap the scanner into run-validator.** Call `scanObjectiveRendered` (+ subjective sibling) from inside `makeProductValidator`, map `ObjectiveFinding[]` -> `ProductRuleResult` / `ProductValidationResult` alongside the registry rules. Lanes call runValidator as today and now get the eval-proven findings. SMALLEST change, preserves the EXACT engine that beat oracle byte-for-byte, ships the wins to users fastest. Static validators coexist; dedupe is a later pass.
- **Option B (end-state): full convergence to one engine.** Scanner becomes THE detection engine; migrate/retire the overlapping static validators (POLISH_RULES, ExtendedDomainValidator) so there's one scanner + one vocab + one classifier (the [[session_2026-06-23_sidecoach-evolution-plan-draft]] goal). Cleanest long-term, biggest blast radius (every flow's gate changes), highest risk.
- **Option C: fold scanner detectors into the registry.** Rewrite the in-page detectors as browser-backed registry `checkProduct` rules on `browser-evidence-collector`. One mechanism, BUT loses the render-identical-to-eval-referee guarantee that VALIDATES the head-to-head proof, and is a large in-page->Node rewrite. Likely rejected for that reason.
- Recommendation: A now (deliver the wins), B as the eventual convergence. Confirm with Jonah first turn.

## WAY FORWARD - S5 work breakdown (for Option A; adjust if Jonah picks B)
1. **Confirm the canonical live gate.** Decide whether the scanner plugs into `runValidator` (registry path, recommended - it has the render seam) and/or the flow-handler `validateAll` path. Map which lane/verb a freeform "X needs polish" actually routes to (check `lane-classifier`, `verb-command-registry.ts`, `claude/hooks/sidecoach-intent.json` lexicon) and confirm that lane has a step that calls runValidator AND triggers a render.
2. **Adapter (the seam).** In/near `run-validator.ts`, call the scanner. Reconcile the input mismatch: the scanner takes an HTML string + its own browser; the live path has a `renderUrl` + the collector. Preferred: let the scanner navigate the renderUrl itself (keeps its hermetic, referee-identical render intact) rather than forcing it through the collector. Respect the existing browser dependency seam + fail-closed contract.
3. **Map findings.** `ObjectiveFinding[]` -> `ProductRuleResult[]` -> merge into `ProductValidationResult` (ruleId, severity, evidence, message, coverage).
4. **Register the new classes** in `product-rule-registry.ts` (ids, aliases, severities, evidence reqs), regenerate `src/validators.generated.ts` (`scripts/generate-validators.ts`), and update the golden `src/__tests__/product-rule-registry.test.ts` (rows + count). THE PATTERN FOR THIS IS ALREADY PROVEN - see [[session_2026-06-24_sidecoach-feelbetter-gap-implement]] (registry + codegen + golden + count-assertion tests for the #4/#13 additions). Reuse it.
5. **Subjective classes** gated by precision: tiny-text is precision-safe-partial (ship), nested-cards is DEFERRED for a negative top-up (precision miss documented). New gate criterion: precision needs >=~10 negatives. See [[session_2026-06-24_sidecoach-nested-cards-precision-miss]].
6. **End-to-end verify with REAL natural language.** A freeform utterance ("that accordion needs polish") -> classifier -> lane -> runValidator -> scanner findings surface in the lane result. Plus `npm test` green (60 suites today), `tsc --noEmit` clean, `generate-validators --check` clean.

## GUARDRAILS (do not break these doing S5)
- Keep `referee-independence.test.ts` green: the scanner must NOT import anything under `eval/`. Wiring the LIVE path to import the scanner is fine (one-directional); the scanner importing eval is the violation.
- Do NOT change the scanner's render in a way that invalidates the eval head-to-head proof (the identical-render-to-referee is what makes the 0.936 valid).
- Slash commands stay as the failsafe; NL is the driver. Don't regress the slash path.

## SELF-ANALYSIS (my failure, per protocol)
Why it happened: I inherited a session summary that said the mission was "COMPLETE and fully verified/closed," took that at face value, and when I found the two-track reality I described it as an ARCHITECTURE ("here are two tracks, here's how they could connect someday") instead of naming it as a MISSING DELIVERABLE against the stated goal. I treated an undone planned step (S5) like a design choice.
The signal I missed: the GOAL was always NL-driven product behavior ([[feedback_sidecoach_mission_beat_oracle]]) and the plan literally had an "S5 wire into shipping product path" step. "Beat oracle" never meant "win an eval"; it meant "the live workflow does it better." A green eval is not a shipped feature.
Prevention: when a mission is reported "complete," verify completion against the ORIGINAL goal statement and the plan's FINAL steps, not the last session's self-report. Cross-check the user's intent, not the inherited framing.

## Files/artifacts referenced
- Engine: src/validators/objective-rendered-scanner.ts, src/validators/subjective-rendered-scanner.ts
- Live path: src/lane-classifier.ts, src/sidecoach-orchestrator.ts, src/lane-runner.ts, src/validators/run-validator.ts, src/validators/browser-evidence-collector.ts, src/product-rule-registry.ts, src/validators.generated.ts
- Registry/codegen/golden pattern: src/__tests__/product-rule-registry.test.ts, scripts/generate-validators.ts
- Eval (proof, do not regress): eval/sidecoach-scan.mjs, eval/real-page-render-probe.mjs, eval/objective-label-rendered.mjs, src/__tests__/referee-independence.test.ts
