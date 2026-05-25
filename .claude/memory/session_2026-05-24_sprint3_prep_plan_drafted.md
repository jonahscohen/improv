---
name: session-2026-05-24-sprint3-prep-plan-drafted
description: Sprint 3 prep plan (T11 carryover) drafted using superpowers:writing-plans. 4 tasks closing the two orchestrator bugs Sprint 2 T11 uncovered + porting the deferred process()-path test. Saved to docs/superpowers/plans/.
type: project
relates_to: [session_2026-05-24_sprint2_t11_deferred.md, session_2026-05-24_sprint2_closed.md]
---

Human collaborator: Jonah.

## What this session is doing

Drafted the Sprint 3 prep implementation plan that closes Sprint 2's deferred T11. The plan lives at `docs/superpowers/plans/2026-05-24-sprint3-prep-t11-carryover.md`.

## Scope

4 tasks, all TDD with the 4-bash-call commit pattern Sprint 1/2 established:

- T1: `flow-handler-brand-verify.ts:191-193` - null-check `REGISTER_SPECIFIC_LAWS[register]` lookup; emits a fallback string instead of throwing when register is undefined.
- T2: `sidecoach-orchestrator.ts:548, 727, 925` - swap canExecute/enrichContextForHandler order in 3 call sites; one enrichment per call shared by canExecute + execute.
- T3: port Sprint 2's deferred T11 test as `sprint3-process-path.test.ts` with utterance `'lint design.md'` (unique to flow F).
- T4: close out T11 deferral memory + write Sprint 3 prep close memory + MEMORY.md index.

## Source-grounded the plan

Verified actual line numbers by reading the current source (post Sprint 2 + the 2 follow-up commits):
- canExecute call sites at lines 548, 727, 925 (confirmed via grep).
- brand-verify lookup at line 192-193 (confirmed via grep).

## Output location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/plans/2026-05-24-sprint3-prep-t11-carryover.md`

## Files touched this session (so far)

- `docs/superpowers/plans/2026-05-24-sprint3-prep-t11-carryover.md` (new)
- `.claude/memory/session_2026-05-24_sprint3_prep_plan_drafted.md` (this file)
