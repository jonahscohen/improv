# Sidecoach Sprint 10: Chain Context Propagation - Design Spec

**Date:** 2026-05-25
**Author:** Jonah Cohen (collaborator). Sprint executed autonomously by chief-architect mode per `feedback_chief_architect_autonomous_dogfood_loop.md`.

## Goal

Fix the root cause of why flowH (motion-integration) and flowI (accessibility) silently drop from the sidecoach verb chain. Sprint 9 dogfood verified all 3 Sprint 9 fixes work, but the craft chain only produces 4 of 5 expected flows. Investigation traced this to THREE compounding bugs in the chain executor and parser/consumer contract.

## Root cause investigation (executed during planning)

Read `sidecoach/src/sidecoach-orchestrator.ts:909-1015` (chain executor) and the canExecute methods of flowH/I handlers.

**Bug 1: chain executor drops projectContext.**

At orchestrator.ts:909, the chain executor builds `executionContext` from the user-supplied `context`:

```typescript
const executionContext: FlowExecutionContext = {
  utterance,
  userId: context.userId,
  projectPath: context.projectPath || process.cwd(),
  currentFile: context.currentFile,
  selectedText: context.selectedText,
  metadata: { ...context.metadata, commandTarget: commandMatch.target },
};
```

`context.projectContext` is NOT copied. Callers passing `projectContext: { register: 'brand' }` lose that. flowI's canExecute reads `context.projectContext?.register` and finds undefined.

**Bug 2: canExecute=false silently drops the flow with no record.**

The for-loop body at orchestrator.ts:957:

```typescript
const enrichedCtx = this.enrichContextForHandler(executionContext, flowId);
if (handler.canExecute(enrichedCtx)) {
  // ... execute, push to flowResults
}
// IMPLICIT: no else, no push. flowId silently absent from results.
```

Sprint 9 T3 wrapped the body in try/catch (continue past errors) but DID NOT add the else branch for canExecute. Flows whose prerequisites fail just disappear.

**Bug 3: parser/consumer casing mismatch.**

`ContextLoader.parseMarkdownFrontmatter` (Sprint 9 T1) writes `brandpersonality` (lowercased, no separator). flowH's canExecute reads `brandPersonality` (camelCase) or `brand_personality` (snake_case). Neither matches the parser's key.

## Three fixes, three tests

### Fix 1: Propagate projectContext through the chain executor

In `sidecoach/src/sidecoach-orchestrator.ts` around line 909, add `projectContext` to the executionContext spread:

```typescript
const executionContext: FlowExecutionContext = {
  utterance,
  userId: context.userId,
  projectPath: context.projectPath || process.cwd(),
  currentFile: context.currentFile,
  selectedText: context.selectedText,
  projectContext: (context as any).projectContext,  // Sprint 10 Bug 1
  metadata: { ...context.metadata, commandTarget: commandMatch.target },
};
```

The cast is because the function's `context` parameter type may not declare projectContext at the top level. Verify the actual type during implementation - if SidecoachProcessContext (or whatever the type is named) doesn't have projectContext, add it.

Also: if `context.projectContext` is undefined, run buildProjectContext to populate it before assigning. This mirrors the Sprint 9 T2 designTokens auto-load pattern.

### Fix 2: Push 'skipped' result when canExecute returns false

In the chain executor loop body, add an else branch:

```typescript
if (handler.canExecute(enrichedCtx)) {
  // ... existing execute path
} else {
  flowResults.push({
    flowId,
    flowName: flowId,
    status: 'skipped',
    message: `Skipped: ${flowId} prerequisites not met (canExecute returned false)`,
    guidance: [],
    checklist: [],
  } as any);
}
```

After this, flowH/I will appear in chain output even when they fail canExecute - the user sees the skip explicitly instead of silent omission.

### Fix 3: Parser/consumer casing standardization

Decide on the canonical key. Existing consumers use camelCase (`brandPersonality`, `antiReferences`, `strategicPrinciples`). The Sprint 9 parser wrote lowercase-no-separator (`brandpersonality`, `antireferences`, `strategicprinciples`). Match the consumers - update the parser to write camelCase.

In `sidecoach/src/project-context.ts` parseMarkdownFrontmatter teach-v2 post-pass:

```typescript
// Before:
if (personalityText && !result.brandpersonality) {
  result.brandpersonality = personalityText;
}
// After:
if (personalityText && !result.brandPersonality) {
  result.brandPersonality = personalityText;
}
```

Same for antiReferences and strategicPrinciples. Section keys (the ones derived from header text) stay lowercased/snake_case since they're keyed off the markdown header itself.

After Fix 3, flowH canExecute reads `context.projectContext.product.brandPersonality` and finds the parser's value.

## File structure

**Modified (2):**
- `sidecoach/src/sidecoach-orchestrator.ts` - Fix 1 (projectContext propagation) + Fix 2 (canExecute=false skipped record)
- `sidecoach/src/project-context.ts` - Fix 3 (camelCase keys)

**New tests (3):**
- `sidecoach/src/__tests__/sprint10-context-propagation.test.ts` - Fix 1 verification
- `sidecoach/src/__tests__/sprint10-canexecute-records-skip.test.ts` - Fix 2 verification
- `sidecoach/src/__tests__/sprint10-parser-camelcase-keys.test.ts` - Fix 3 verification

## Re-dogfood after Sprint 10

Re-run `sidecoach/src/dogfood-craft-step2.ts` against the marketing-site project. Expected after all 3 fixes:

- 5+ flows in result (flowA prereq + flowF + flowG + flowH + flowI + flowJ = 6 flowResults entries)
- flowH status: success OR skipped (with explicit skip message) - either way it's present in results
- flowI status: success OR skipped - present in results
- No silently-dropped flows

If after Sprint 10 the re-dogfood still surfaces a NEW error, the chief-architect directive requires fixing it in Sprint 11 and re-running again. The loop continues until clean.

## Acceptance criteria

- All 3 new tests pass via ts-node
- 72 baseline sidecoach tests still pass (Sprint 9 close baseline)
- `npx tsc --noEmit` exits 0
- Re-dogfood: `/sidecoach craft` on marketing-site shows >= 5 flowResults including flowH and flowI by ID
- flowH and flowI either succeed OR appear with status='skipped' and an actionable skip message

## Out of scope (future)

- Other surfacing of "canExecute returns false silently" elsewhere in the codebase
- Refactoring the two ContextLoader systems into one
- BuildReport verdict propagation for sidecoach verb chains
