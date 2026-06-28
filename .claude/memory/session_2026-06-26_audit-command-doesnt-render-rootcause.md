---
name: WIN (framing fix worked) + audit COMMAND never renders the URL (3 stacked defects)
description: A fresh session now answers YES to using sidecoach (the reframe flipped the behavior - the WIN). But it found the audit ENGINE bug: /sidecoach audit <url> bails on a build-pipeline prerequisite, never renders, and reports a FALSE "clean / 0 findings". Root: flowK_multi_lens_audit is a guidance + static-source-file flow that never renders the URL; the proven rendered engine (makeProductValidator/scanRenderedLive) is reached by the eval + live NL path but NOT by the audit command.
type: project
relates_to: [session_2026-06-26_sidecoach-audit-is-diagnosis-reframe.md, session_2026-06-26_sidecoach-NL-tier-dead-rootcause.md]
---

Collaborator: Jonah. 2026-06-26.

## THE WIN (the reframe worked)
After the "diagnosis IS an audit" reframe, a fresh session asked "are you using sidecoach?"
answered YES: invoked the skill, then ran `sidecoach-monitor.js "/sidecoach audit localhost:4830"`.
The behavioral fix flipped it - sidecoach is now the front door. That part is resolved.

## THE NEW BUG (reproduced)
`node sidecoach/bin/sidecoach-monitor.js "/sidecoach audit localhost:4830"` returns:
- success:false, "Executed audit flow chain (0/2 flows successful)"
- flowK_multi_lens_audit: status ERROR "Flow prerequisites not met: Required flow
  flowJ_tactical_polish has not been executed"
- flowI_accessibility: status SKIPPED (prereqs not met)
- buildReport.verdict: "clean", severityCounts 0/0/0  <-- FALSE CLEAN
So the audit reports the page "clean / 0 findings" while never running. dev server WAS up
(4830 -> 200), so this is not a render failure - it bailed BEFORE any render.

## ROOT CAUSE (3 stacked defects)
1. FALSE CLEAN (safety): clean-evaluator.ts:217 sets 'clean' whenever blockingExcess===0.
   Zero findings from NOT RUNNING is indistinguishable from zero findings from a clean page.
   An audit that did not execute must never report "clean".
2. AUDIT GATED BEHIND THE BUILD PIPELINE: orchestrator.ts flowK requires flowJ ->
   flowI -> flowG+flowH -> flowF -> flowA. So /sidecoach audit transitively demands the
   ENTIRE craft/build/polish pipeline ran first. A standalone diagnosis of an existing URL
   can never execute. Contradicts the just-shipped reframe (audit = the read path, no build).
3. THE BIG ONE - THE COMMAND NEVER RENDERS: flow-handlers-tier3-tier4.ts FlowKMultiLensAudit
   .execute() emits a generic 5-dimension GUIDANCE template + runs AntiPatternValidator on
   local SOURCE files in ./src. It never renders the URL, never calls the rendered detection
   engine. The proven engine (makeProductValidator -> scanRenderedLive, the 59-rule registry
   that beats the oracle) is reached by the EVAL harness and the live NL path
   (lane-runner.ts d.runValidator with renderUrl) but NOT by the /sidecoach audit command.
   That is why the session had to hand-run the audit's read path. The command path and the
   proven engine were never connected.

## ENGINE ENTRY POINTS (for the fix)
- makeProductValidator(validatorId) in sidecoach/src/validators/run-validator.ts -> (ctx, signal)
  => ProductValidationResult; renders via scanRenderedLive(renderUrl).
- flow-validation-capabilities.ts already wires all 6 domains (static-a11y, anti-pattern,
  polish-standard, theming, forms, page-quality) via makeProductValidator.
- lane-runner.ts shows the call pattern with a renderUrl (ctx.renderUrl = target URL).

## PLAN (verifiable)
1. Fix FALSE CLEAN -> verify: a chain with 0 successful flows reports verdict != 'clean'
   (blocked/inconclusive). -> run the audit command, assert verdict not 'clean'.
2. Decouple standalone audit from build-pipeline prereqs -> verify: /sidecoach audit <url>
   executes (does not bail on flowJ).
3. Wire the rendered engine into the audit path: when target is a URL, run the domain
   validators via makeProductValidator with renderUrl=target, aggregate REAL findings +
   honest verdict -> verify: /sidecoach audit localhost:4830 renders + returns real findings
   (dev server up), matching what the session found by hand.
4. Build green + full suite + Codex review.

## Files (investigation)
- orchestrator.ts (prereq chain), flow-handlers-tier3-tier4.ts (flowK), clean-evaluator.ts
  (verdict), build-report-aggregator.ts (report), validators/run-validator.ts +
  flow-validation-capabilities.ts (engine entry), lane-runner.ts (the URL call pattern).
</content>
