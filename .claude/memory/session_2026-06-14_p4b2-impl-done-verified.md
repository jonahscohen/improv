---
name: P4b-2 impl DONE + my independent verify GREEN - Codex code review dispatched
description: impl-p4b2 executed P4b-2 (6 commits on lane-p4b2 incl the lead-directed PLAYWRIGHT_BROWSERS_PATH wiring); my independent verify clean (scope sidecoach-only, genericity registry 0-diff, 0 dashes/NUL/emoji, build+--check OK, 49 suites, collector OK-not-SKIP in the gate, real flow-history untouched, playwright dep no binaries); Codex review dispatched (task-mqe5pw2r)
type: project
relates_to: [session_2026-06-14_p4b2-plan-approved.md, session_2026-06-14_p4b2-playwright-browserspath-decision.md, session_2026-06-14_p4b2-genericity-excluded-decision.md]
supersedes: session_2026-06-14_p4b2-plan-approved.md
---

impl-p4b2 reported DONE_WITH_CONCERNS -> after the PLAYWRIGHT_BROWSERS_PATH wiring,
fully done. 6 commits on lane-p4b2:
  da72921 T1 trusted browser verdicts | d7f7424 T2 collector | e0fb0d2 T3 policy
  metadata+--check | 5d4c5d8 T4 runtime promotion+degradation | 1933b07 T5 dist |
  b2397ae PLAYWRIGHT_BROWSERS_PATH wiring (lead-directed).

**MY INDEPENDENT VERIFY - ALL CLEAN:**
- Scope: only sidecoach/{src,scripts,dist,package.json,package-lock.json}; 0
  out-of-scope.
- genericity registry UNTOUCHED (product-rule-registry.ts 0 changed lines) - the
  exclusion decision honored.
- Integrity: 0 dash/NUL/emoji. playwright ^1.60.0 added; NO browser binaries
  committed (shared cache).
- Build exit 0; generate-validators --check OK (no drift, both runs).
- npm test: "playwright cache -> /Users/spare3/Library/Caches/ms-playwright",
  "isolated HOME -> <temp>", browser-evidence-collector: OK (NOT skip),
  browser-evidence-degradation: OK, run-tests: 49 suite(s) passed.
- Real ~/.claude/sidecoach-flow-history.json md5 03ad42c4 IDENTICAL before+after
  (P4f HOME isolation intact under the new PLAYWRIGHT_BROWSERS_PATH). The lone
  "Failed to save flow history ENOTDIR blocked-home" log = the DELIBERATE strict-
  save-failure assertion in the flow-history publisher test, not a real failure.

**Deliverable:** engine-driven headless Playwright collector populates
ProductCheckContext (computed-style/dom/contrast) for 4 rules: a11y.min-hit-area
(BLOCKER), a11y.color-contrast (BLOCKER), polish.concentric-radius,
polish.typography-rhythm. TRUSTED-evidence marker so only collector-produced
evidence drives real verdicts. Hermetic (page.route blocks cross-origin; data:
fixture; no network), shared-cache reuse (no install/download), graceful
degradation (no URL/browser/nav-fail -> inconclusive, never throws), AbortSignal.
Static cleanPolicy baseline UNCHANGED; runtime per-target promotion only when
evidence collected; --check authoritative. genericity excluded + asserted
inconclusive-with-collector. PLAYWRIGHT_BROWSERS_PATH wiring makes the real-browser
test run in the committed gate (coverage of the core path) while preserving
flow-history isolation; cacheless -> graceful skip.

**Deviations (all sound):** (1) lead-directed PLAYWRIGHT_BROWSERS_PATH in
run-tests.ts; (2) browserPromotion test adds clean focus-visible CSS so static-a11y
required rule passes (P4a evaluator short-circuits required-inconclusive before
blocking-fail counting) - realistic static-clean+browser-fail scenario, evaluator
untouched; (3) install via PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1.

**Next:** Codex code review (task-mqe5pw2r-uv9v3e). On SHIP: quiesce impl-p4b2,
TeamDelete, FF-merge to main (NOT pushed). Then P4b-2 DONE -> only P4e (deferred) +
2 follow-ups (lane-runner-concurrency no-op; bidirectional eligibility parity).

Collaborator: Jonah.
