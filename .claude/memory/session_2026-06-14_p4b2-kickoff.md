---
name: P4b-2 kickoff - browser-evidence collector (engine-driven Playwright); Codex authoring plan
description: P4f merged; starting P4b-2 (the last deferred build) - engine-driven headless Playwright collector populates ProductCheckContext.computedStyle/contrast/dom so the 5 currently-inconclusive browser-evidence rules become real verified checks; render model = caller-provided URL; Codex authoring the plan (task-mqdywydt)
type: project
relates_to: [session_2026-06-14_p4b2-playwright-decision.md, session_2026-06-14_p4f-COMPLETE.md]
---

P4f merged to main (a859ea7). All lane BUILD work done. Started P4b-2 - the
browser-evidence collector (Jonah: engine-driven Playwright).

**Scope (I investigated):** P4a's ProductCheckContext ALREADY declares optional
browser slots (computedStyle?, contrast?) that nothing populates today
(check-context.ts ~:31-37). FIVE rules in product-rule-registry.ts declare
dom/computed-style/contrast evidence (lines ~45,253 computed-style; ~318,354 dom;
~371 contrast) and are currently inconclusive/non-required. run-validator.ts builds
the context from static per-file CSS/markup only. P4b-2 = a headless-Chromium
(Playwright) collector that populates those slots so the 5 rules become real
browser-verified required checks.

**Key architecture decision (lead-set, proceeding):** RENDER MODEL = caller-provided
URL. The collector navigates headless Chromium to an ALREADY-served page (matching
the verification protocol, which always validates against a running URL via
cmux/Chrome MCP) and collects only what the 5 rules need (specific computed styles,
contrast wcagAA+ratio, DOM facts). NO dev-server start, NO project build in the
collector, NO network beyond the URL. Rejected: collector-starts-dev-server
(fragile, per-project) and static-build-artifacts (misses runtime UIs). Graceful
degradation: no URL / no browser / nav fail -> rules INCONCLUSIVE (never pass, never
throw); collector availability + URL gate satisfiability.

**Dependency:** add playwright to sidecoach, REUSE the shared ~/Library/Caches/
ms-playwright cache (1GB, Chromium present, shared w/ Chrome MCP + tilt-lab) - no
fresh download. Tests hermetic (file://or data: fixture, no network; skip-not-fail
if no browser).

**Workflow:** Codex authoring the plan (task-mqdywydt-7fpvnu, --write --effort high)
with a brief grounded in the 5 rules + check-context + run-validator + clean-policy
generation. Next: I review (integrity, the 5 rules each get present+inconclusive
paths, satisfiability/--check consistency, hermetic tests, URL-model fit), execute
via a fresh impl team, Codex code review, merge. NOT pushed.

**After P4b-2:** P4e (copy gating, deferred) + 2 follow-ups (lane-runner-concurrency
no-op; bidirectional eligibility parity).

Collaborator: Jonah.
