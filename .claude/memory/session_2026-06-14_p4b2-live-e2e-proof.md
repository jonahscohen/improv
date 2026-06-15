---
name: P4b-2 LIVE end-to-end run PROVEN - real http page -> MCP -> collector -> real rule FAIL verdicts
description: the queued live e2e (per the reality-check directive) ran successfully - a deliberately-broken page served on real http://localhost, driven through the sidecoach_lane MCP handler + the engine collector, produced REAL browser-rule fail verdicts (both a11y blockers), with no flow-history pollution; proves P4b-2 is real end-to-end, not just plumbing-tested
type: project
relates_to: [session_2026-06-14_p4b2-COMPLETE.md, session_2026-06-14_p4-reality-check.md, feedback_post_phase_reality_check.md]
---

The LIVE end-to-end run Jonah queued (the antidote to "plumbing-tested, use-
unproven") PASSED. Drove the full chain against a REAL served page.

**Setup:** /tmp/live-e2e/bad.html - low-contrast #bbb-on-#fff text + a 20x20 button
(both deliberate a11y failures). Served via python3 -m http.server (HTTP 200). Driver
ran with HOME=mkdtemp (flow-history isolation) + PLAYWRIGHT_BROWSERS_PATH=real shared
cache (so Chromium resolves).

**RESULT (all real):**
- collector available=true: real headless Chromium launched + navigated the real
  http://localhost URL.
- trusted evidence kinds: ["computed-style","dom","contrast"] - collected from the
  real rendered page.
- measured contrast: {wcagAA:false, ratio:1.92} - real measurement of the #bbb/#fff.
- VERDICT a11y/color-contrast: FAIL ("worst measured text contrast is 1.92:1") -
  REAL blocker verdict, not inconclusive.
- VERDICT a11y/min-hit-area: FAIL ("1/1 interactive target miss minimum hit area;
  smallest is 20x20px") - REAL blocker verdict.
- MCP sidecoach_lane start OK (lane=lane_build, checkpoint created); checkpoint.
  renderUrl persisted = http://localhost:8793/bad.html - the model-facing surface
  threads renderUrl end to end onto the checkpoint.
- flow-history byte-identical before==after (ccb0c69f) - the live run did NOT pollute
  the real ~/.claude file (isolation held).

**What this proves (the chain is REAL):** MCP sidecoach_lane (renderUrl arg) ->
engine startLane -> checkpoint(renderUrl) -> validator -> collectBrowserEvidence
(real Chromium, real http nav, hermetic) -> real computed-style/dom/contrast ->
browser rules reach REAL pass/fail. P4b-2 is not just green-tested; it genuinely
measures a real page and the a11y blockers fire. Per the reality-check directive,
this closes the "is it real or fluff" question for P4b-2: REAL.

**Honest residuals (unchanged):** validators remain heuristic (broad signal quality
on diverse real sites unmeasured); a real model driving this in a live Claude
session via the actual stdio MCP transport (vs the handler direct-call here) is the
only layer not exercised in this proof (the stdio transport itself is separately
tested in stdio.test.ts). P4f lane flow-history records still have no lane-specific
consumer. The orchestrator emoji + lane-runner-concurrency no-op + bidirectional
eligibility parity remain follow-ups.

Driver + fixture in /tmp/live-e2e (scratch, not committed).

Collaborator: Jonah.
