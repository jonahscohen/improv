---
name: session-2026-05-25-sprint9-design
description: Sprint 9 (3 dogfood bug fixes) design spec. Surfaced by Sprint 8 marketing-site dogfood that found flowA can't read teach v2 PRODUCT.md, flowF doesn't auto-load DESIGN.md tokens, chain halts on first error.
type: project
relates_to: [session_2026-05-25_dogfood_retry.md, session_2026-05-25_sprint8_closed.md]
---

Human collaborator: Jonah.

## Trigger

After Sprint 8 closed (impeccable parity + brief-driven teach), retried the marketing-site dogfood. Three bugs surfaced from real end-to-end use that unit tests + parameterized parity test didn't catch.

## Three bugs

1. **flowA brand-verify can't read teach v2's PRODUCT.md format.** The system's own setup tool produces output its first analysis flow can't parse. Self-inconsistent.
2. **DESIGN.md → context.metadata.designTokens plumbing gap.** ContextLoader parses DESIGN.md (context-loader.ts:146) but orchestrator never copies result into the metadata field flowF reads.
3. **Chain halts on first error.** When flowF errored in craft chain, flowH (motion) + flowI (a11y) didn't run.

## Scope decisions

- Approach: surgical fixes in 3 isolated patches (not refactor).
- Chain halt: continue past errors. Top-level success = at least one flow succeeded.
- PRODUCT.md parser: add a new branch reading teach v2 section headers; backwards compatible.
- designTokens: one block at top of engine.process() loads ContextLoader + auto-stages tokens; explicit metadata wins.

## Spec

`docs/superpowers/specs/2026-05-25-sidecoach-sprint9-dogfood-bug-fixes-design.md` (281 lines).

## Plan size

4 tasks (T1 parser, T2 tokens, T3 chain, T4 re-dogfood + close). All Opus subagents.

## Risk flags

- Existing tests may assert `result.success === false` on flow errors - T3 may need to update those to "some flow succeeded" semantics. Documented in T4.
- ContextLoader.load() is async; need to verify the orchestrator entry is in async scope at the chosen wiring point.

## Next

Spec self-review, then user reviews, then writing-plans.
