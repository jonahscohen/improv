---
name: Autonomous completion of all lane phases, Codex as review partner
description: Jonah's standing directive - work autonomously until ALL lane phases (P2, P3, P4) are complete, using Codex as the continuous review partner; stop checkpointing decisions
type: feedback
relates_to: [feedback_multiagent_verified_implementation_mandate.md, session_2026-06-13_lane-p2-codex-review.md]
---

Mid-P2-planning, Jonah said: "work autonomously until all 'phases' are
complete, work with codex as your review partner."

**Why:** he wants the lane work driven to completion without per-decision
checkpoints. The earlier multiagent mandate (produce-with-agents,
verify-with-separate-agents, Codex secondary) still holds; this ADDS: don't stop
to ask, run the full loop yourself.

**How to apply:**
- The loop per phase: revise plan -> Codex review -> fold findings -> (re-Codex
  if material) -> EXECUTE via subagent-driven-development (TeamCreate + named
  teammates; Agent is blocked without a team in cmux) -> Codex CODE review of the
  branch -> fix -> merge to main -> next phase.
- Codex is the REVIEW PARTNER throughout (plan reviews AND code reviews), not a
  one-shot gate. Use the codex-companion `task --background` for plan reviews and
  `review`/`adversarial-review` or `task` for code.
- The GOAL is completing phases, not a perfect Codex verdict on a plan. Fold the
  real fixes, do a confirming pass, and EXECUTE - Codex's highest value is
  reviewing real code during/after execution. Don't loop forever on plan prose.
- Phases remaining: P2 (lane execution sequence + phrase wiring), P3 (durability:
  leases/fencing/outbox/schema-migration/AbortSignal), P4 (validators + rule
  registry + loop execution + convergence floor + MCP migration + cleanup).
- Beat every discrete task. Never claim done without execution evidence.
- Surface to Jonah only for genuinely outward-facing/irreversible calls or a true
  blocker - otherwise proceed.

Collaborator: Jonah.
