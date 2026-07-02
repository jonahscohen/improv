---
name: Cost model - Fable orchestrates, Opus/Codex execute
description: Jonah (2026-07-02) - to save money, Fable is the orchestrator; Opus and Codex are the execution layer. Known friction - a non-negotiable Agent-tool guard blocks the per-spawn model override, so Opus delegation needs Jonah to reconcile the guard or set subagent model config.
type: feedback
relates_to: [feedback_multiagent_verified_implementation_mandate.md, feedback_memory_first_zero_failure_execution.md]
---

Collaborator: Jonah Cohen. 2026-07-02, given mid-way through beats-evolution stage 1.

Directive: "to save money, Fable should be the orchestrator here, Opus/Codex should be the execution layer."

**Why:** Fable is the premium model; burning it on execution-layer work (bulk implementation, reviews another model can run) is wasted spend. Fable's value is judgment: sequencing, gate rulings, mapping decisions, folding reviews, catching stale truth.

**How to apply:**
- Fable (session lead): plans stages, authors gate contracts, adjudicates findings, verifies, writes beats, reports.
- Codex: adversarial reviews via codex-review.py (works today, proven 3 rounds in stage 1) and implementation handoffs via the codex plugin when a unit is well-specified.
- Opus subagents: implementation/execution units.
- KNOWN FRICTION (unresolved): the Agent tool's `model` parameter is hard-BLOCKED by a non-negotiable guard ("subagents inherit the session model; if a different model seems needed, ask the user"). Jonah's directive IS that ask, but the guard is mechanical and blocks regardless. Until Jonah reconciles it (relax the guard, or configure subagent model defaults in agent definitions / .claude/agents frontmatter where model: is legal), Opus delegation via per-spawn override is unavailable; Codex delegation is the working execution path.

## Files touched
- .claude/memory/feedback_fable_orchestrator_opus_codex_executors.md (this beat)
- .claude/memory/MEMORY.md (index pointer)
