---
name: P4 re-sequence - lane_converge (P4c) + MCP (P4d) before the browser collector (P4b-2)
description: browser collector needs a NEW heavy Playwright dep in sidecoach (which has none) + is lowest-value (upgrades a few a11y rules inconclusive->conclusive); lane_converge + MCP are higher-value, no browser dep; do them first, defer the collector + flag the dep when it comes
type: decision
relates_to: [session_2026-06-14_p4b1-COMPLETE.md, session_2026-06-13_p4-decomposition.md]
---

After P4b-1 merged, re-sequenced the remaining P4 work based on value/effort +
dependencies.

**Grounding:** justify/lotus/tilt-lab already use Playwright; sidecoach has NO
browser dep (deps = @anthropic-ai/sdk, js-yaml, proper-lockfile). So P4b-2's
browser-evidence collector = a NEW heavy Playwright (or reuse-justify-harness) dep
in sidecoach. It only upgrades the browser-only validator rules
(min-hit-area/color-contrast/concentric/typography/genericity) from
owned-non-required INCONCLUSIVE to conclusive - an enhancement, not core.

**Dependency check:** lane_converge's release floor = the REQUIRED product
validators clean. Browser rules are NON-required (P4a-2), so the convergence floor
is met by the STATIC rules; P4c (lane_converge) does NOT depend on P4b-2. P4d
(MCP) doesn't either.

**DECISION:** do the higher-value, no-new-heavy-dep phases first:
- NEXT: P4c - loop execution + lane_converge enablement + the convergence release
  floor (lane_converge is currently REJECTED at startLane; this makes a whole lane
  work - real user-facing capability). ralph-loop -> convergence-loop.
- THEN: P4d - MCP migration (classify-intent/list-lanes/sidecoach_lane) - the
  model-facing surface (lanes are CLI-only today).
- THEN: P4f - FlowHistory outbox publisher (small).
- DEFER: P4b-2 (browser collector) - revisit LAST as an optional enhancement; when
  it comes, FLAG the Playwright-dep choice to Jonah (new heavy dep vs reuse
  justify's harness vs skip). P4e (copy gating) similar - later enhancement.

Rationale: prioritize completing the lane model (lane_converge) + exposing it
(MCP) over a heavy-dep rule-conclusiveness enhancement. Nothing dropped - just
sequenced by value. The static floor already gates; browser-rule conclusiveness
is the last mile.

**STATE:** P1/P2/P4a-1/P4a-2/P4b-1 merged. impl-p4b1 terminating. Next: P4c plan
(Codex-author given it's spec-bound: loop iteration boundary + convergence floor +
the truthful-convergence semantics from spec section 9).

Collaborator: Jonah.
