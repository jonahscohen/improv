---
name: produce-and-verify with agents + Codex secondary coverage (MANDATE)
description: After repeated spec regressions, Jonah mandated that implementation work be produced AND independently verified by my own subagents, with Codex as secondary coverage via the plugin - not single-pass solo work
type: feedback
relates_to: [session_2026-06-13_lane-v10-review-repair-read.md, session_2026-06-13_lane-v9-self-audit-repair.md, feedback_shortcuts_are_lies.md]
---

Jonah (2026-06-13), freezing the lane spec at v10 to move to implementation:
"i'm disappointed that you dropped the ball so many times. i want you to deploy
agents of your own to produce and verify your work, and let codex take an extra
peek via mcp to provide secondary coverage."

**Why this happened (self-analysis, exact failure modes - not platitudes):**
1. I edited a large interlocking spec section-by-section without a
   whole-document consistency re-audit after each change. Each fix was locally
   correct but contradicted other sections - v7 and v8 each INTRODUCED new P0s
   while fixing old ones.
2. I twice asserted convergence ("last review", "let's implement") WITHOUT
   verifying it - a no-false-positives violation (claiming done-ness without
   evidence).
3. The consistency sweep (v9) only happened when Jonah demanded it; it should
   have been standing discipline from revision 1.
Root cause: trusting my own single-pass eye on a complex artifact, reactively
patching findings instead of re-verifying the whole artifact each time.

**The mandate (standing, for implementation and beyond):**
- **Produce with agents.** Spawn subagents to do/build the work, not solo
  single-pass authoring.
- **Verify with SEPARATE agents.** The agent that produced a unit does not
  certify it; an independent agent (or me) verifies against the spec contract
  and via real execution (tests/build/run), not by re-reading. Defense in depth
  against my own interaction-bug blind spot.
- **Codex secondary coverage.** Route a Codex pass (codex plugin: companion
  `task`/`review`/`adversarial-review`, and the enabled stop-time review gate)
  over produced work for an independent-model check before reporting done.
- **No claimed completion without execution evidence** (build green, tests
  pass, behavior observed) - per the Verification Protocol. "tsc clean" or "it
  renders" is not verification.

**How to apply:** For the lane implementation, stage per the spec (classifier +
5 sequence lanes first; convergence floor second). Each stage: produce ->
independent-agent verify against the v10 contract + real test/build ->
Codex secondary -> only then report. Treat a verifier/Codex finding the same way
the spec reviews were treated: fold it, re-verify the whole unit, don't just
patch the line.
