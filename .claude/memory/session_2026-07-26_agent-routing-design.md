---
name: Agent routing design (Opus-led dispatch to frontmatter-pinned tiers)
description: Jonah reversed the 2026-06-11 no-routing rule; designed a 4-tier global agent roster plus a shell classifier hook so the lead dispatches work-shaped prompts to cheaper models. Spec written, not yet implemented.
type: decision
relates_to: [session_2026-07-26_sidecoach-token-efficiency-evaluation.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: dependency map grepped at HEAD 1bd2e239; no code changed yet
confidence: high
---

# Agent routing design

Spec written to `docs/superpowers/specs/2026-07-26-agent-routing-design.md`,
stamped against `1bd2e239`. Nothing implemented yet. Collaborator: Jonah.

## What prompted it

Jonah asked whether prompts could be classified and routed to a cheaper agent,
citing ChatGPT's automatic model selection. The concise hooks already cut output
LENGTH; the target now is reasoning EFFORT.

Initial pushback from the lead cited Jonah's own `model-router-guard.sh`
("NON-NEGOTIABLE, 2026-06-11, Claude is FORBIDDEN from automatically routing
work to another model"). Jonah's reply: "i'm allowed to change my mind," and
sidecoach is a separate optimization track that should not frame this one.

## Choices made

**1. Trigger: hook-nudged, lead decides.**

- Alternatives: pure judgment via a CLAUDE.md policy section; Stop-hook
  enforcement after the fact.
- Rejected pure judgment because the `design-build` skill already exists as
  evidence that judgment-only triggering fails ("the individual skills did not
  auto-trigger reliably"). Rejected Stop-time enforcement because the effort is
  already spent by the time it fires.
- Why this one: a shell classifier costs no tokens, survives the lead
  forgetting, and leaves the decision with the lead so a wrong nudge is
  harmless.

**2. Write boundary: cheap tiers read-only, sonnet may edit.**

- Alternatives: everything below Opus read-only; a haiku tier that can edit.
- Why this one: haiku misreading a spec on a write is harder to catch than a
  wrong answer, but capping all writes at Opus loses the larger half of the
  spend.

**3. Guard: drop the rule entirely** (Jonah's call, against the lead's
recommendation to amend it and keep the CLI-level blocks).

- Accepted consequence: `claude --model`, `ANTHROPIC_MODEL=`, and `fable-router`
  become unblocked at the CLI.
- Dependency map grepped before scoping the removal, and it is narrower than the
  phrase implies. Only `model-router-guard.sh` plus its two `settings.json`
  registrations (lines 64, 109) come out. `detect-session-model.sh` STAYS
  (called by `fable-orchestrator-guard.sh:26`) and `fable-orchestrator-guard.sh`
  STAYS (independent hook at `settings.json:144`). The `sidecoach_lanes.py:3`
  and `sidecoach-keyword.sh:89` hits are prose comments, not calls.

**4. Multi-tier match resolves UP, not first-in-order** (added during spec
self-review, which caught it as an unresolved ambiguity).

- On a prompt matching several tiers the classifier names the most capable one
  (`opus-executor` > `sonnet-impl` > `explore` > `quick_answer`).
- Why: routing one tier too high wastes budget, routing too low produces work
  that must be redone. Escalation is the cheaper error.
- Deliberately differs from `sidecoach-keyword.sh`, which tie-breaks to
  first-in-registry because its verbs are peers, not a capability ladder.

## The constraint that bounds the payoff

The lead reads every prompt in full context before it can dispatch, so routing
cannot lower that floor. It lowers only the continuation: reasoning trace, tool
loop, answer generation. Dispatching a genuinely one-line question is therefore
net-negative (emit call + read report + relay costs more than answering). The
lexicon targets multi-step-but-mechanical prompts, not short ones. This
correction was accepted as part of the design.

## Roster (global `~/.claude/agents/`, currently empty)

`quick-answer` haiku read-only, `Explore` built-in read-only, `sonnet-impl`
sonnet edit-capable, `opus-executor` opus edit-capable (exists project-local,
to be promoted global).

## Revisit when

The classifier's nudge is being declined more often than accepted, which would
mean the lexicon is targeting the wrong prompt shape and the layer is costing
attention without saving effort.

## Files touched
- `docs/superpowers/specs/2026-07-26-agent-routing-design.md` (new)
- `.claude/memory/session_2026-07-26_agent-routing-design.md` (this beat)
- `.claude/memory/MEMORY.md` (index pointer)
