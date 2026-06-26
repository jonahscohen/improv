---
name: sidecoach-option-B-convergence-mandate
description: Jonah chose Option B (FULL convergence to ONE detection engine) for the S5 gap. Autonomous cmux-teams loop, Codex as adversarial reviewer, 10-version-per-component handoff rule. Hard bar - if oracle beats ANY part of sidecoach, the mission failed.
type: decision
relates_to: [session_2026-06-24_sidecoach-S5-integration-gap-and-plan.md, feedback_sidecoach_mission_beat_oracle.md, session_2026-06-23_sidecoach-evolution-plan-draft.md, feedback_multiagent_verified_implementation_mandate.md]
---

Collaborator: Jonah Cohen.

**The directive (2026-06-24, verbatim intent).** Jonah picked **Option B** from [[session_2026-06-24_sidecoach-S5-integration-gap-and-plan]] - and stressed it is what he wanted "in the first place." Full convergence into ONE engine. The eval-proven rendered scanner becomes THE detection engine driving the LIVE natural-language workflow; the overlapping static validators (POLISH_RULES / ExtendedDomainValidator) get migrated and retired so there is one scanner + one vocab + one classifier (the [[session_2026-06-23_sidecoach-evolution-plan-draft]] end-state).

**Operating mode (standing for this mission):**
- Work AUTONOMOUSLY in a self-paced /loop until FULL convergence is reached. Do not stop to ask permission on things answerable from context.
- We are in cmux teams mode: spawn agents/teammates in panes to parallelize. (Mind [[reference_cmux_team_init_orphan_bug]] when spawning named teammates.)
- Codex is the REVIEWER, adversarial teammate. Claude produces, Codex scrutinizes; per [[feedback_multiagent_verified_implementation_mandate]] the producing model never certifies its own unit. Keep uncovering each other's mistakes until perfection.
- **10-version handoff rule:** if any single component of the work hits 10 versions/iterations without converging, HAND THE COMPONENT OFF to Codex to take over implementation, and Claude flips to being the reviewer of that component. Track a per-component version counter.

**/goal:** fully converge into one engine WITHOUT sacrificing a single bit of quality. The non-negotiable bar: if oracle beats ANY part of sidecoach at all, the mission has FAILED. Preserve every win already banked (objective 0.936, precision wins, motion-artifact exposure, tiny-text ship, nested-cards deferred-but-not-lost).

**Why Option B over A (Jonah's reasoning):** A was the smallest-change "ship the wins fast" path; B is the real product - one engine, no two-track split, NL as the driver and slash as the failsafe. Jonah wanted the convergence itself, not a wrapper that leaves the static validators alive.

**Revisit when:** convergence proves to break a banked win that can't be recovered, or a guardrail ([[session_2026-06-24_sidecoach-S5-integration-gap-and-plan]] guardrails - referee-independence, render-identical-to-referee, slash-as-failsafe) cannot be preserved under one engine. Then re-surface to Jonah, do not silently fall back to A.

## Files touched
- (this beat only - planning/decision record; implementation tracked in follow-on session beats)
