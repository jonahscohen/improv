# Sidecoach Sprint 9: Dogfood Bug Fixes - Design Spec

**Date:** 2026-05-25
**Author:** Jonah Cohen (collaborator)
**Sprint:** Sprint 9 (3 bug fixes surfaced by Sprint 8 dogfood)
**Predecessor:** Sprint 8 closed (verb command + teach rebuild). The marketing-site dogfood retry exposed three bugs in actual end-to-end use that the unit tests didn't catch.

## Goal

Fix three sidecoach bugs surfaced by running `/sidecoach craft` against a real PRODUCT.md + DESIGN.md project. Each bug is independent and well-localized:

1. **flowA brand-verify parser self-inconsistency.** `/sidecoach teach` v2 writes PRODUCT.md in one format (`## Register / **Brand**`); flowA's ContextLoader-based parser reads a different format and reports `register` as empty. The system's own setup tool produces output its first analysis flow can't read.
2. **DESIGN.md → `context.metadata.designTokens` plumbing gap.** ContextLoader already parses DESIGN.md into a `parsedDesignTokens` value (context-loader.ts:146) but the orchestrator never copies that into the metadata field flowF reads from. flowF errors "Missing context: designTokens" even when DESIGN.md is present.
3. **Chain executor halts on first error.** When flowF errored in the craft chain, flowH (motion) and flowI (accessibility) didn't run at all - chain stopped propagating. User can't see all the gaps in one run; has to fix-and-rerun for each.

## Why

These gaps blocked the marketing-site dogfood from getting useful output even though sidecoach Sprint 8 said the pipeline was ready. They are exactly the bugs that only end-to-end use surfaces - unit tests pass, parameterized parity test passes, but real use against a real project produces the failures above.

## Scope decisions resolved during brainstorming

- **Chain halt semantic:** continue past errors. Each flow gets its own success/error/skipped status. Top-level success = "at least one flow succeeded" instead of "all flows succeeded". Surfaces all gaps in one run; downstream flows independent of the errored flow still produce value.
- **PRODUCT.md parser strategy:** add a new parser branch that recognizes teach v2's section headers (`## Register`, `## Primary Users`, `## Brand Personality`, `## Anti-References`, `## Strategic Principles`). Backwards compatible - existing PRODUCT.md formats still parse via the existing code path. New branch only fires when the existing path produces no `register` value.
- **designTokens plumbing:** add one block at the top of `engine.process()` that runs ContextLoader, copies `parsedDesignTokens` into `context.metadata.designTokens` when DESIGN.md exists. Guarded so callers who explicitly pre-stage via metadata still win.
- **Implementation:** surgical fixes in 3 isolated patches. No refactor. Each fix is small, independent, testable in isolation.
- **Subagent execution:** Opus only on every dispatch.

## Architecture overview

Three independent changes, three independent tests, plus a re-dogfood verification step that proves the integration.

### Change 1: PRODUCT.md parser update

`sidecoach/src/project-context.ts` (or wherever ContextLoader parses PRODUCT.md - the implementer locates the exact file). Add a new parser branch that recognizes teach v2's section-header format:

- `## Register` → look for `**Brand**` or `**Product**` in the section body → set `register: 'brand' | 'product'`
- `## Primary Users` → extract the paragraph after the header → set `users`
- `## Brand Personality` (when register=brand) → extract paragraph → set `brandPersonality`
- `## Anti-References` → extract bullet list (lines starting with `- `) → set `antiReferences: string[]`
- `## Strategic Principles` → extract bullet list → set `strategicPrinciples: string[]`

Backwards compatible: run the existing parser first. If `register` is empty after that runs, try the new section-header parser. If still empty, the existing fallback error message applies.

### Change 2: designTokens auto-load plumbing

`sidecoach/src/sidecoach-orchestrator.ts` at the top of `process()`, after context defaults are applied but before any flow dispatch (specifically: after the Sprint 6 lazy checkpoint init, before the Sprint 5 forceFlowId block):

```typescript
// Sprint 9: auto-stage parsed DESIGN.md tokens into context.metadata.designTokens
const loader = new ContextLoader();
const loaded = await loader.load(context.projectPath || process.cwd());
if (loaded.parsedDesignTokens && !context.metadata?.designTokens) {
  context.metadata = {
    ...(context.metadata || {}),
    designTokens: loaded.parsedDesignTokens,
  };
}
```

Add `ContextLoader` import. Guard `!context.metadata?.designTokens` so callers who pre-stage explicit tokens still win.

If DESIGN.md doesn't exist or parses to empty, `parsedDesignTokens` is undefined or `{}` - the assignment is skipped, flowF gets the same "Missing context: designTokens" error it gets today.

### Change 3: chain executor continues past errors

`sidecoach/src/sidecoach-orchestrator.ts` in the chain executor (the for-of loop iterating `commandMatch.flowIds`). Wrap each handler execution in try/catch. On error, push an error-status FlowExecutionResult to the results array; do NOT halt the loop. On `canExecute` returning false, push a skipped-status result.

```typescript
for (const flowId of commandMatch.flowIds) {
  const handler = this.handlers.get(flowId);
  if (!handler) continue;
  try {
    const enrichedCtx = this.enrichContextForHandler(executionContext, flowId);
    if (handler.canExecute(enrichedCtx)) {
      const result = await handler.execute(enrichedCtx);
      flowResults.push(result);
      // ... existing post-execution callbacks (taste, validators, etc) stay
    } else {
      flowResults.push({
        flowId, flowName: flowId,
        status: 'skipped',
        message: 'Skipped: canExecute returned false',
        guidance: [], checklist: [],
      } as any);
    }
  } catch (err) {
    flowResults.push({
      flowId, flowName: flowId,
      status: 'error',
      message: `Flow execution failed: ${(err as Error).message}`,
      error: String(err),
      guidance: [], checklist: [],
    } as any);
    // continue loop
  }
}
```

Top-level `success` becomes `flowResults.some(r => r.status === 'success')` (at least one succeeded), not `flowResults.every(...)` (all succeeded).

If the chain executor currently has any `break` or early `return` on error, remove it.

## Testing strategy

Three new test files in `sidecoach/src/__tests__/`:

### 1. sprint9-product-md-parser.test.ts

- Sandbox A: PRODUCT.md in teach v2 format → ContextLoader parses → register='brand', users, brandPersonality, antiReferences (≥1), strategicPrinciples (≥1) all populated.
- Sandbox B: PRODUCT.md with register='product' in teach v2 format → register='product', no brandPersonality field expected.
- Sandbox C: PRODUCT.md in an EXISTING format (copy from `sidecoach/PRODUCT.md`) → still parses correctly (regression).
- Sandbox D: PRODUCT.md missing → returns null/empty (existing behavior preserved).

### 2. sprint9-design-tokens-autoload.test.ts

- Sandbox with PRODUCT.md + DESIGN.md (real one copied from `reference/DESIGN.md`):
  - Run `engine.process('/sidecoach craft', { projectPath })`.
  - Assert flowF's status is 'success' (no "Missing context: designTokens" error).
  - Assert flowF's output references real token values from DESIGN.md (e.g. '#DC2618' or 'brand.red').
- Sandbox with PRODUCT.md only, NO DESIGN.md:
  - Same call.
  - Assert flowF's status is 'error' (current behavior preserved).
- Sandbox where caller pre-stages metadata.designTokens explicitly:
  - Assert the explicit value wins, NOT the auto-loaded one (guard works).

### 3. sprint9-chain-continues-past-errors.test.ts

- Sandbox with PRODUCT.md + DESIGN.md.
- Monkey-patch one mid-chain handler (e.g. flowG_component_implementation) to throw.
- Run `engine.process('/sidecoach craft', { projectPath })`.
- Assert: result.flowResults.length === full chain length (5 for craft - not 3 or 4 from halt).
- Assert: the patched flow has status='error'.
- Assert: at least one flow AFTER the patched one has status='success' or status='skipped' (not absent).
- Assert: top-level success === true (some flow succeeded).

### Re-dogfood (T4 acceptance)

Re-run the dogfood-craft-step2.ts runner against the marketing-site project. Expected after all 3 fixes:

- All 5 chain flows attempted (flowF, flowG, flowH, flowI, flowJ + flowA brand-verify prerequisite)
- flowA's output reports `Register detected: brand` (not empty)
- flowF's status is 'success' (reads DESIGN.md tokens)
- Per-flow guidance + checklist all populated
- BuildReport appears with domain grades

## File structure

**Modified (2):**
- `sidecoach/src/project-context.ts` (Bug 1 - new parser branch)
- `sidecoach/src/sidecoach-orchestrator.ts` (Bug 2 - designTokens auto-load + Bug 3 - chain continue-past-errors)

**New (3):**
- `sidecoach/src/__tests__/sprint9-product-md-parser.test.ts`
- `sidecoach/src/__tests__/sprint9-design-tokens-autoload.test.ts`
- `sidecoach/src/__tests__/sprint9-chain-continues-past-errors.test.ts`

## Execution model

Subagent-driven-development. Every Agent dispatch uses `model: "opus"`. No haiku or sonnet on this work.

4 tasks:
- T1: Bug 1 - PRODUCT.md parser update + test
- T2: Bug 2 - designTokens auto-load + test
- T3: Bug 3 - chain continue-past-errors + test
- T4: Re-dogfood verification + sprint close

Each task is small and independent. Standard four-bash-call commit pattern. Spec + code quality review after each task.

## Failure modes

- **The PRODUCT.md parser fix doesn't fully restore register parsing on some edge cases** (e.g. PRODUCT.md uses both formats mixed, or has extra whitespace around section headers). T1's test plants 4 sandbox cases; if the implementer finds another edge case during T4 re-dogfood, document and fix.
- **ContextLoader has an async load() but the orchestrator's process() entry might not be in async scope at the right place.** If the load needs awaiting and the surrounding code is sync, the implementer may need to refactor the entry slightly. T2 surfaces this.
- **Chain continue-past-errors changes top-level success semantics.** Some existing tests might assert `result.success === false` when a flow errors. T3's regression should flag these; the implementer updates those assertions to "some flow succeeded" semantics.

## Acceptance criteria

- All 3 new tests pass via ts-node
- Existing 69 sidecoach tests still pass (or any that break are updated to match the new continue-past-errors semantics, documented in T4)
- `npx tsc --noEmit` exits 0
- Re-dogfood: `/sidecoach craft` on marketing-site shows all 5 craft chain flows attempted, flowA reads `register: brand`, flowF reads DESIGN.md tokens with `Brand register detected: brand` in output
- Sprint close memory documents per-bug fix + before/after dogfood comparison

## Out of scope (future)

- Refactoring ContextLoader to be a fully centralized ContextStager (Approach B from brainstorming)
- Dependency-aware chain execution (Approach C from brainstorming chain-halt question)
- Other dogfood bugs not yet surfaced (this sprint targets the 3 specific bugs from 2026-05-25 marketing-site dogfood)
