---
name: session-2026-05-24-sprint5-design
description: Sprint 5 (Phase 6 intent disambiguation UI) design spec drafted via superpowers:brainstorming. Tiered resolution - silent on recommendation-set tiebreaks, prompt the user on alphabetical fallback. Two-call resolution via metadata.forceFlowId. Spec at docs/superpowers/specs/.
type: project
relates_to: [session_2026-05-24_sprint4_closed.md, session_2026-05-23_sidecoach_intent_ambiguity.md]
---

Human collaborator: Jonah.

## What this session is doing

Drafted the Sprint 5 design spec for Phase 6 part 1 (intent disambiguation UI). Phase 6 in the misty-jingling-plum roadmap originally bundled two features (checkpoint mechanism + intent disambiguation UI); decomposed into separate specs/plans per the brainstorming skill's scope check.

## Scope decisions resolved during brainstorming

- **Phase 6 split**: intent disambiguation UI first (~6 tasks). Checkpoint mechanism deferred to a separate sprint after this one ships.
- **Disambiguation behavior**: tiered - try recommendation field silently when set, surface candidates to user on alphabetical fallback.
- **Silent vs prompt**: only `tieBreak.reason` starting with 'Used recommendation field' bypasses the prompt. Alphabetical fallback always prompts.
- **Resolution mechanism**: two-call. Round 1 returns `needsDisambiguation: true` + candidates. Round 2 caller invokes with `metadata.forceFlowId: chosenFlowId` to bypass intent detection. Stateless orchestrator.

## Plan size

6 tasks. Smaller than Sprint 4 (8) but appropriately sized for a focused single-feature sprint that fixes a known bug + adds the UI surface.

## Open questions still open

- Real-world rate of silent-tiebreak firing (depends on whether `recommendation` is set on real DisambiguationResults). If rarely fires, future work could add per-flow `recommendation` defaults.
- Test fixture stability - utterances that produce specific ambiguity shapes may shift as the trigger registry evolves. Acceptable fallback to direct injection if needed.

## Risk flags

- High confidence on the silent-tiebreak fix (mechanical one-line reassignment), forceFlowId bypass (additive), return-shape additions (optional fields).
- Medium confidence on test fixture stability.

## Spec location

`/Users/spare3/Documents/Github/claude-dotfiles/docs/superpowers/specs/2026-05-24-sidecoach-phase-6-intent-disambiguation-ui-design.md`

## Tasks for implementation plan

6 tasks:
- T1: extend SidecoachResult with needsDisambiguation + disambiguationPrompt fields
- T2: recommendation-tiebreak silent path (Edit 1) + unit test
- T3: forceFlowId bypass (Edit 2) + unit test for happy and invalid-id paths
- T4: ambiguous-fallback return shape with needsDisambiguation + disambiguationPrompt + prompt test
- T5: end-to-end resolution test (two-call loop)
- T6: sprint close

## Next step

Spec self-review, then ask Jonah to review the spec file, then invoke superpowers:writing-plans.

Commit retry note: re-touched memory after rm flag-clear per Sprint 1 hook workaround.
