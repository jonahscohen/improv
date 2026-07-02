---
name: Beats backlog items T-0044..46 added + cutover plan confirmed documented
description: Jonah asked whether the 2-week parallel-run-then-CLAUDE.md-cutover plan is documented (YES - feedback_memory_first_zero_failure_execution.md steps 6-7 + stage4-5 beat plan-state) and had three backlog items added to TASKS.md under a new improv area - provenance frontmatter, scheduled weekly reflect, MCP surface for other models
type: project
relates_to: [session_2026-07-02_beats-search-protocol-gap.md, feedback_memory_first_zero_failure_execution.md]
---

Collaborator: Jonah Cohen. 2026-07-02.

## Cutover documentation confirmed
- Jonah asked whether the "parallel run ~2 weeks then cutover / flip CLAUDE.md" plan is documented. It is, in two places:
  - feedback_memory_first_zero_failure_execution.md (2026-07-01), steps 6-7: parallel-run retrieval beside read-everything ~2 weeks, every miss becomes a benchmark case, zero unexplained misses before cutover; then retire the hand-edited index and flip CLAUDE.md in the SAME commit (no half-migrated state).
  - session_2026-07-02_beats-stage4-5-hooks.md plan-state paragraph: build phase complete (stages 1-5), remaining = the parallel run then the cutover decision, which is Jonah's, gated on the parallel-run record.
- Timeline: parallel run effectively started 2026-07-02 (build complete); cutover decision due ~2026-07-16.
- This search also corrected the same-day protocol-gap beat (its "open decision" was already decided; correction folded into that file).

## Backlog added (TASKS.md, new `## improv` area, T-0044..T-0046, all P2)
- T-0044 provenance frontmatter fields - Plan B from the zero-failure mandate; validator warns, never blocks.
- T-0045 scheduled weekly /reflect run - from proposal_beats_next_evolution.md (scheduled reflect for max corpus value); must not double-fire with the reflect-nudge hook.
- T-0046 MCP surface for other models/CLIs - model-agnostic read access to beats retrieval from the same proposal; read-only first.
- Structure note: the repo's TASKS.md already used the global area-layer format (dotfiles/marketing-site/tilt-lab/sidecoach), so the items went under a new `## improv` area to preserve structure rather than forcing the skill's flat project-local template onto an existing file. Last ID bumped T-0043 -> T-0046.

## Files touched
- TASKS.md (new improv area, T-0044..46, Last ID bump)
- .claude/memory/session_2026-07-02_beats-search-protocol-gap.md (correction section + relates_to)
- .claude/memory/session_2026-07-02_beats-backlog-and-cutover-confirmation.md (this beat) + MEMORY.md
