---
name: /sidecoach audit <url> now renders + runs the engine + honest verdict (WIRED, verified)
description: Wired the proven rendered detection engine into the /sidecoach audit command. When the target is a URL it renders via scanRenderedLive and reports real findings + honest verdict, bypassing the build-pipeline prereqs and the guidance-only flowK. Fail-closed - a render failure is inconclusive, never clean. Verified live against 4830 (20 real contrast findings, verdict blocked) and a dead port (inconclusive, no clean report).
type: project
relates_to: [session_2026-06-26_audit-command-doesnt-render-rootcause.md, session_2026-06-26_sidecoach-audit-is-diagnosis-reframe.md]
---

Collaborator: Jonah. 2026-06-26.

## WHAT WAS BUILT
New module sidecoach/src/audit-rendered.ts:
- looksLikeUrl(target) / normalizeRenderUrl(target) - detect + normalize a URL target
  (http(s)://, bare host:port, localhost, ipv4).
- runRenderedAudit(target, {scan?}) -> RenderedAuditResult: renders via scanRenderedLive,
  maps objective findings (error->blocking, warning->warning) + subjective (warning), counts
  severities, and computes an HONEST verdict: not rendered -> 'inconclusive'; blocking>0 ->
  'blocked'; warning>0 -> 'warnings-only'; else 'clean'. 'clean' REQUIRES at least one lens
  actually scanned (pure + test-seamable via the scan dep).

Wired into sidecoach-orchestrator.ts:
- Interception at the top of the verb-chain routing: if command==='audit' AND
  looksLikeUrl(target) -> runRenderedAudit + toRenderedAuditResult, returning BEFORE the flow
  chain. This bypasses the build-pipeline prereqs (flowJ->flowI->...->flowA) AND the
  guidance-only flowK that never rendered.
- toRenderedAuditResult(audit): builds an honest SidecoachResult. Rendered -> real BuildReport
  (verdict via computeVerdict on real counts, grade via passRate, findings as FindingEntry[]).
  NOT rendered -> success:false, clear "INCONCLUSIVE, not clean" message, NO buildReport (a
  non-execution can never surface a clean report).

## THE THREE DEFECTS, RESOLVED
1. FALSE CLEAN -> fail-closed: render failure = success:false + inconclusive + no buildReport.
2. AUDIT GATED BEHIND PIPELINE -> bypassed for the URL case (no prereq chain).
3. COMMAND NEVER RENDERED -> now renders the URL + runs the proven engine (scanRenderedLive).

## VERIFIED (live, with my own eyes)
- `/sidecoach audit localhost:4830` (dev server up, http 200): success:true, verdict BLOCKED,
  grade F, 20 BLOCKING findings - real rendered detections: low-contrast on
  button.install-block__copy (4.23:1 need 4.5:1), gray-on-color, p.section__eyebrow (3.86:1),
  span.tool-card__tag (3.26:1), span.process__num (3.26:1), ... The SAME class of defects the
  session found by hand. Was previously a false "clean / 0 findings".
- FAIL-CLOSED: `/sidecoach audit localhost:59997` (dead port, ERR_CONNECTION_REFUSED):
  success:false, message "did not render. This is INCONCLUSIVE, not clean", buildReport absent,
  verdict None. A false clean is now structurally impossible.
- Build green (tsc + generate-validators --check OK).

## VERIFICATION PROGRESS
- Full sidecoach suite BEFORE the test was added: 64 suites passed, 0 failed (no regression
  from the orchestrator import/interception).
- Unit test added: src/__tests__/audit-rendered.test.ts (url detect, normalize, severity
  mapping, clean/blocked/warnings, FAIL-CLOSED inconclusive-not-clean, partial-lens) via the
  injected scan seam; registered in scripts/run-tests.ts. (First run flagged 2 trivial TS
  artifacts - a stray tag + a redundant post-narrow comparison - both fixed; re-running.)
- Codex review of the diff + new files: in flight.

## VERIFIED GREEN
- New test passes: `audit-rendered: OK`. Full suite: 65 suites passed, 0 failed (64 + the new one).

## STILL TO DO
- Fold Codex findings (review in flight; early signal = possible coverage gap on the
  orchestrator toRenderedAuditResult shaping step, not just runRenderedAudit); re-verify.
- (Deferred, lower-pri) the GENERAL false-clean in the non-URL flow-chain buildReport
  (computeVerdict returns 'clean' on 0 findings even when 0 flows executed) - the URL path no
  longer hits it, but a no-URL audit chain still could. Note for a follow-up.

## Files touched
- sidecoach/src/audit-rendered.ts (new), sidecoach/src/sidecoach-orchestrator.ts (import +
  interception + toRenderedAuditResult helper).
</content>
