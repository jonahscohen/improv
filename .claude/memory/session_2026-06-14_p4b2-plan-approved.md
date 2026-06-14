---
name: P4b-2 plan (4-rule scope) reviewed + APPROVED; executing
description: Codex-revised P4b-2 plan (1297 lines, 5 tasks, genericity excluded) reviewed - integrity clean, genericity explicitly excluded + allowlist-gated + asserted-inconclusive, collector hermetic (network-blocked + data: fixture + shared cache + graceful degradation + skip-without-chromium), static baseline unchanged + runtime per-target promotion, --check guards; approved for execution
type: project
relates_to: [session_2026-06-14_p4b2-kickoff.md, session_2026-06-14_p4b2-genericity-excluded-decision.md]
supersedes: session_2026-06-14_p4b2-kickoff.md
---

P4b-2 plan (docs/superpowers/plans/2026-06-14-lane-p4b2-browser-evidence-collector.md,
Codex-authored then revised to the 4-rule scope, 1297 lines, 5 tasks) reviewed.
APPROVED.

**Verified:**
- Integrity: 0 dashes/NUL/emoji/smart-unicode.
- 4-rule scope: browser-backs a11y.min-hit-area (BLOCKER), a11y.color-contrast
  (BLOCKER), polish.concentric-radius, polish.typography-rhythm. genericity
  EXPLICITLY EXCLUDED - registry+checkProduct untouched; asserted inconclusive even
  with a successful collector in 5 places; gated OUT by an explicit
  BROWSER_BACKED_RULE_IDS allowlist (NOT "any dom/computed-style/contrast rule" -
  genericity also declares dom but is deliberately not in the allowlist).
- Collector (Task 2): chromium.launch headless from the shared ms-playwright cache
  (no fresh install); page.route('**/*') blocks cross-origin/protocol subresources
  (hermetic); renderUrlFromContext validates http/https/file/data; returns
  {available:false,reason} on no-URL / signal-abort / launch/nav/collect failure ->
  graceful degradation, never throws; AbortSignal-aware. Test uses a self-contained
  data: URL fixture, real Chromium, SKIPs cleanly if !available (no browser). Proves
  real verdicts (concentric pass, 20px button hit-area fail, #aaa-on-#fff contrast
  fail) + genericity inconclusive.
- Satisfiability (Task 3/4): generated static cleanPolicy.requiredRuleIds UNCHANGED
  (browser rules NOT added to static baseline = safe absent-browser default);
  browser rules promoted to required at RUNTIME per-target only when evidence was
  collected for that target. generate-validators --check guards the allowlist
  (rejects missing/statically-satisfiable/wrong-evidence-kind allowlisted rules)
  while keeping untouched genericity valid as owned-non-required-inconclusive.
- Hermetic tests + degradation suite required:true; HOME isolation owned by the
  aggregate runner; engine-only scope; explicit per-file dist allowlist.

**Render model (lead decision):** caller-provided URL (ctx.renderUrl/target);
collector navigates an already-served page. Graceful inconclusive when absent.

**Next:** execute via team lane-p4b2-exec (impl creates branch lane-p4b2 per Setup
Step 1; ~49 suites green target) with the dirty-tree/dash/green-commit/dist-allowlist
+ Playwright-shared-cache + hermetic-test constraints; I verify; Codex code review;
merge. NOT pushed.

Collaborator: Jonah.
