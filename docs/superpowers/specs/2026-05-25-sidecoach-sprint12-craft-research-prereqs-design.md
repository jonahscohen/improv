# Sidecoach Sprint 12 - craft chain declares research prerequisites

**Status:** spec
**Author:** Jonah (autonomous per chief-architect directive)
**Date:** 2026-05-25

## Problem

Sprint 11 expanded the `craft` chain to 6 flows (A/F/G/H/I/J). The re-dogfood surfaced one error:

```
flowH_motion_integration -> error: Flow prerequisites not met:
Required flow flowE_motion_patterns has not been executed.
```

Investigation showed:

1. `flow-prerequisites.ts` declares `flowH_motion_integration` requires `flowE_motion_patterns` (required: true).
2. The craft chain does not include `flowE_motion_patterns`.
3. flowH therefore fails the static prereq check at chain time.

A latent variant of the same bug applies to flowG:

1. `flow-prerequisites.ts` declares `flowG_component_implementation` requires `flowB_component_research` (required: true).
2. The craft chain does not include `flowB_component_research`.
3. flowG should have failed too. It did not, because `flow-history.ts` persists session state to disk at `~/.claude/sidecoach-flow-history.json`, and an earlier sprint's dogfood happened to record flowB. Stale state is masking the gap.

The chain is currently self-inconsistent: it declares the execution flows (F/G/H/I) but omits the research flows they depend on (B/E), relying on accidental history to pass.

## Decision

Make the `craft` chain self-sufficient by including the research flows it depends on, in their natural sequence.

New chain (8 flows):

```
flowA_brand_verify          (shape - already in chain)
flowB_component_research    (research - NEW, prereq of G)
flowE_motion_patterns       (research - NEW, prereq of H)
flowF_design_tokens         (execution - already in chain)
flowG_component_implementation (execution - already in chain)
flowH_motion_integration    (execution - already in chain)
flowI_accessibility         (execution - already in chain)
flowJ_tactical_polish       (polish - already in chain)
```

This matches sidecoach's craft.md mental model: shape -> research -> tokens -> components -> motion -> accessibility -> polish.

## Alternative rejected

Loosening flowG and flowH prereqs to optional. This hides a real dependency: motion integration genuinely needs motion patterns to be researched first; component implementation needs component research. The constraint is correct - the chain is what needs to spell it out.

## Dogfood cleanliness

The dogfood currently uses persistent flow history. To make the re-dogfood meaningful, clear the history file before each run. This exposes any other latent prereq gaps instead of hiding them behind stale state.

## Acceptance

After Sprint 12 lands:

- `VERB_REGISTRY.craft.flowIds` length is 8.
- `craft.flowIds` includes `flowB_component_research` and `flowE_motion_patterns` in the proper positions.
- Sprint 11 chain-length test updated (was 6, now 8) plus 2 new assertions for the research entries.
- Re-dogfood run on `marketing-site` with cleared history executes all 8 flows without prerequisite-not-met errors.
- All tests pass; tsc clean.

## Out of scope

- Refactoring FlowHistory persistence semantics (keep on-disk session continuity for normal use; only the dogfood runner clears it).
- Expanding any other verb chain (only `craft` is currently dogfood-covered).
- Surfacing any further bugs the re-dogfood reveals - those become Sprint 13.
