# Sidecoach Phase 6 (Part 1): Intent Disambiguation UI - Design Spec

**Date:** 2026-05-24
**Project:** Sidecoach (`/Users/spare3/Documents/Github/claude-dotfiles/sidecoach`)
**Sprint:** Sprint 5 (Phase 6 part 1 of `~/.claude/plans/misty-jingling-plum.md`)
**Status:** Approved by Jonah; ready for implementation planning.

## Goal

When `engine.process(utterance, ctx)` produces an ambiguous intent match (multiple flows with equal confidence), the orchestrator should resolve the ambiguity in tiers:

1. **Silent tiebreak** when the intent-detector resolved the tie via a programmer-set `recommendation` field. Route to that flow without prompting the user.
2. **Surface to the user** when the tie was resolved by alphabetical fallback (no `recommendation` set) OR when the detector reports `isAmbiguous && !chosenFlowId`. Return structured candidates + a pre-rendered prompt string. The caller (Claude) renders an `AskUserQuestion`, gets the user's pick, and re-invokes `engine.process` with `metadata.forceFlowId` to route directly to the chosen flow.

This closes the known intent-detection gap documented in `session_2026-05-23_sidecoach_intent_ambiguity.md` and the friction that surfaced during Sprint 3 prep T11 and Sprint 4 T4 testing.

## Why this matters

Today's orchestrator short-circuits at `sidecoach-orchestrator.ts:801` whenever `isAmbiguous && !flowId`, returning `success: false` with an unhelpful message. The `recommendation` field that Sprint 1 T12 explicitly added for tie-breaking is consulted ONLY at line 819 - but that line is only reached when the result was NOT ambiguous in the first place. The recommendation is effectively dead code for ambiguous matches.

Real-world impact:
- Sprint 4 T4's composite test had to use `/sidecoach composite composite_craft_landing_page` instead of a natural-language phrase because routing was ambiguous.
- Sprint 3 prep T11 documented that the design-tokens flow's natural-language utterances (`'validate tokens against DESIGN.md'`) trigger 3-way ambiguity.
- Yes&'s usage pattern is natural-language phrases; the orchestrator failing them with a vague error breaks the primary surface.

The fix is precise: use the recommendation when it exists, fall back to user prompt when it doesn't.

## Architecture

```
engine.process(utterance, ctx)
  │
  ├─ ctx.metadata.forceFlowId set?
  │     │
  │     yes -> bypass detection, route directly to forceFlowId
  │     │      (return error if forceFlowId is not a registered flow)
  │     │
  │     no -> intent-detector.detect(utterance)
  │           │
  │           ├─ result is MatchResult (single match) -> execute normally
  │           │
  │           └─ result is DisambiguationResult (ambiguous)
  │                 │
  │                 ├─ tieBreak.reason starts with "Used recommendation field"
  │                 │     -> SILENT: promote winnerFlow to MatchResult, execute normally
  │                 │
  │                 └─ otherwise (alphabetical fallback OR no chosenFlowId)
  │                       -> return {success: false, needsDisambiguation: true,
  │                                  ambiguousCandidates: [...],
  │                                  disambiguationPrompt: "..."}
  │
  caller (Claude) receives the result
  │
  ├─ result.needsDisambiguation === true
  │     │
  │     yes -> render AskUserQuestion with ambiguousCandidates
  │           get user's pick (chosenFlowId)
  │           re-invoke engine.process(utterance, {metadata: {forceFlowId: chosenFlowId}})
  │
  │     no -> consume result normally
```

The orchestrator stays stateless. The "UI" is a structured return shape that Claude knows how to render.

## Data model

`SidecoachResult` gains two optional fields:

```typescript
export interface SidecoachResult {
  success: boolean;
  message: string;
  detectedFlow: { flowId: FlowId; flowName: string; confidence: number } | null;
  flowResults: FlowExecutionResult[];
  guidance?: string[];
  checklist?: any[];
  artifacts?: any[];
  ambiguousCandidates?: Array<{ flowId: FlowId; flowName: string; confidence: number }>;
  buildReport?: BuildReport;

  // NEW (Phase 6 disambiguation)
  needsDisambiguation?: boolean;
  disambiguationPrompt?: string;
}
```

`FlowExecutionContext.metadata` gains an OPTIONAL `forceFlowId` field:

```typescript
// in flow-handler.ts FlowExecutionContext.metadata?: Record<string, any>;
// We do not add a new typed property - the existing `Record<string, any>` shape
// accommodates `metadata.forceFlowId` at runtime. The orchestrator reads it as:
const forcedFlowId = (context.metadata as any)?.forceFlowId as FlowId | undefined;
```

(Loose typing matches the existing pattern in the orchestrator's metadata reads.)

## Behavior rules

### Silent tiebreak conditions

The orchestrator routes silently (no user prompt) when ALL of these are true:

1. `detection.isAmbiguous === true`
2. `detection.tieBreak` is set
3. `detection.tieBreak.reason` starts with the literal string `"Used recommendation field"`
4. The winning candidate (matching `tieBreak.chosenFlowId`) exists in `detection.candidates`

If condition 3 fails (e.g., `"Alphabetical tiebreak"`), the orchestrator surfaces the ambiguity to the user.

If condition 4 fails (chosenFlowId doesn't match any candidate - shouldn't happen but defensively guarded), fall through to the user prompt path.

### User prompt path

When the detector reports ambiguous and no silent tiebreak fires, the orchestrator returns:

```typescript
return {
  success: false,
  message: 'Multiple flows match - user input needed.',
  detectedFlow: null,
  flowResults: [],
  ambiguousCandidates: candidates.map((c) => ({
    flowId: c.flowId,
    flowName: c.flowName,
    confidence: c.confidence,
  })),
  needsDisambiguation: true,
  disambiguationPrompt: `Your request "${utterance}" could match multiple flows. Which best matches your intent?`,
};
```

`disambiguationPrompt` is a pre-rendered prompt the caller can display directly. The caller can also construct their own prompt from `ambiguousCandidates` if they prefer.

### forceFlowId bypass

When the caller passes `metadata.forceFlowId`, the orchestrator skips intent detection entirely:

1. If `forceFlowId` is a registered flow (`getFlow(forceFlowId)` returns non-null), synthesize a `MatchResult` shape with `confidence: 1.0` and `reason: 'Forced via metadata.forceFlowId'`. Downstream execution proceeds normally.
2. If `forceFlowId` is NOT a registered flow, return `success: false` with message `"forceFlowId '<id>' is not a registered flow."` and no flowResults.

This makes the two-call resolution loop trivial for the caller: they don't need to re-utter; they just pass the flowId they want.

## Orchestrator changes (two edits)

### Edit 1 - Honor recommendation tiebreak

In `sidecoach/src/sidecoach-orchestrator.ts` around line 800-815, the current ambiguous-handling block is:

```typescript
    // Handle ambiguous matches
    if ((detection as DisambiguationResult).isAmbiguous && !(detection as MatchResult).flowId) {
      const candidates = (detection as DisambiguationResult).candidates || [];
      return {
        success: false,
        message: 'Your request could match multiple flows. Please clarify.',
        detectedFlow: null,
        flowResults: [],
        ambiguousCandidates: candidates.map((c) => ({
          flowId: c.flowId,
          flowName: c.flowName,
          confidence: c.confidence,
        })),
      };
    }
```

It becomes:

```typescript
    // Handle ambiguous matches with tiered resolution.
    if ((detection as DisambiguationResult).isAmbiguous && !(detection as MatchResult).flowId) {
      const disambig = detection as DisambiguationResult;
      const candidates = disambig.candidates || [];

      // Silent path: if the intent-detector resolved the tie via a programmer-set
      // recommendation (not alphabetical fallback), promote the winner to a
      // MatchResult and let the normal execution path take over.
      if (
        disambig.tieBreak &&
        typeof disambig.tieBreak.reason === 'string' &&
        disambig.tieBreak.reason.startsWith('Used recommendation field')
      ) {
        const winnerFlow = candidates.find((c) => c.flowId === disambig.tieBreak!.chosenFlowId);
        if (winnerFlow) {
          detection = winnerFlow as MatchResult;
        }
      } else {
        // User-prompt path: alphabetical fallback or no chosenFlowId.
        return {
          success: false,
          message: 'Multiple flows match - user input needed.',
          detectedFlow: null,
          flowResults: [],
          ambiguousCandidates: candidates.map((c) => ({
            flowId: c.flowId,
            flowName: c.flowName,
            confidence: c.confidence,
          })),
          needsDisambiguation: true,
          disambiguationPrompt: `Your request "${utterance}" could match multiple flows. Which best matches your intent?`,
        };
      }
    }
```

The `detection = winnerFlow as MatchResult` reassignment is the key trick: when the recommendation tiebreak fires, the variable now looks like a single-match result, and the existing downstream code at line 816-819 (`(detection as MatchResult).flowId ... DisambiguationResult.recommendation`) treats it correctly. Zero other changes to the orchestrator's execution path.

### Edit 2 - forceFlowId bypass

In `sidecoach/src/sidecoach-orchestrator.ts`, around line 770 (just BEFORE the `this.intentDetector.detect(utterance)` call), insert a forceFlowId check:

```typescript
    // Phase 6 disambiguation re-entry: if the caller has already resolved
    // ambiguity from a prior call, bypass intent detection entirely and
    // route directly to the chosen flow.
    const forcedFlowId = (context.metadata as any)?.forceFlowId as FlowId | undefined;
    let detection: MatchResult | DisambiguationResult;
    if (forcedFlowId) {
      const forcedFlow = getFlow(forcedFlowId);
      if (!forcedFlow) {
        return {
          success: false,
          message: `forceFlowId '${forcedFlowId}' is not a registered flow.`,
          detectedFlow: null,
          flowResults: [],
        };
      }
      detection = {
        flowId: forcedFlowId,
        flowName: forcedFlow.name,
        confidence: 1.0,
        matchedTokens: [],
        reason: 'Forced via metadata.forceFlowId',
      } as MatchResult;
    } else {
      detection = this.intentDetector.detect(utterance);
    }
```

The existing `detection` assignment that was inline (`const detection = this.intentDetector.detect(utterance)`) gets pulled into this if/else. Everything downstream still reads `detection` the same way.

## Tests

Three new test files. The trickiest part is constructing utterances that reliably hit each branch; tests fall back to direct `detection` injection via a test-only helper if real-world utterances become unstable as the trigger registry evolves.

### `sprint5-disambiguation-silent-tiebreak.test.ts`

Constructs an utterance which produces `isAmbiguous: true` AND `tieBreak.reason.startsWith('Used recommendation field')`. Asserts:
- `result.flowResults.length > 0` (the flow actually ran)
- `result.needsDisambiguation` is `undefined` or `false`
- `result.detectedFlow.flowId === <expected recommended flow id>`

Falls back to direct injection if a stable real-world utterance can't be found. The injection helper would need a way to override `detection` in the orchestrator, OR a test-only constructor that pre-loads a `MatchResult` into the flow.

### `sprint5-disambiguation-prompt.test.ts`

Constructs an utterance which produces ambiguous with alphabetical tiebreak (or no tiebreak at all). Asserts:
- `result.success === false`
- `result.needsDisambiguation === true`
- `result.ambiguousCandidates.length >= 2`
- `result.disambiguationPrompt` is a non-empty string containing the utterance verbatim
- `result.flowResults.length === 0`

Per Sprint 3 prep + Sprint 4 testing, `'validate tokens against DESIGN.md'` produces 3-way ambiguity among `flowF_design_tokens`, `flowN_rapid_iteration_refined`, `flow11_extract_tokens`. If none of these flows have a recommendation pre-set, this utterance is a good real-world fixture.

### `sprint5-disambiguation-resolution.test.ts`

Two-call resolution loop. Step 1: invoke with the ambiguous utterance, get back `needsDisambiguation: true`. Step 2: pick the first candidate and call `engine.process(sameUtterance, {metadata: {forceFlowId: chosenFlowId}})`. Assert:
- Step 1: `result.needsDisambiguation === true`, candidates length >= 2
- Step 2: `result.flowResults.length > 0`, first flowResult has `flowId === chosenFlowId`, `status !== 'error'` (status may be 'skipped' if a validator gate fails downstream - that's fine, it proves the flow was reached)

Negative case: `engine.process('any utterance', {metadata: {forceFlowId: 'nonexistent_flow'}})` returns `result.success === false`, message matches `/not a registered flow/`, `flowResults.length === 0`.

## Out of scope (filed for future sprints)

- **flowW/flowX intent-detector wiring** - the carryover from Sprint 3 prep close memory. Different work (ADDING detectors, not fixing how ambiguity is handled). Files: `intent-detector.ts` lines 22-66. Sprint 5 doesn't change this gap.
- **Composite slash-command help-text vs parser regex inconsistency** - the Sprint 4 T4 carryover. Different code path (`slash-command-router.ts`).
- **Checkpoint mechanism** - the OTHER Phase 6 feature. Decomposed into a separate spec / plan per the brainstorming scope decision. Should follow this sprint.
- **Smarter recommendation weighting** - some flows might want to be "always preferred" when tied. Today the only signal is the `recommendation` field on the DisambiguationResult. A future enhancement could add per-flow weight constants, but that's not needed for the immediate fix.
- **Custom prompt rendering by the caller** - the orchestrator emits a default `disambiguationPrompt` string, but the caller could ignore it and build a richer prompt from `ambiguousCandidates`. We don't need to support multiple prompt formats from the orchestrator.

## Estimated tasks for the implementation plan

1. **T1** Add `needsDisambiguation?: boolean` and `disambiguationPrompt?: string` to `SidecoachResult` interface. Compile-check passes.
2. **T2** Implement Edit 1 (recommendation-tiebreak silent path) + unit test `sprint5-disambiguation-silent-tiebreak.test.ts`.
3. **T3** Implement Edit 2 (`metadata.forceFlowId` bypass) + unit test for both happy path and invalid-flowId error path.
4. **T4** Update the ambiguous-fallback return shape to include `needsDisambiguation: true` + `disambiguationPrompt` + unit test `sprint5-disambiguation-prompt.test.ts`.
5. **T5** End-to-end resolution test `sprint5-disambiguation-resolution.test.ts` covering the two-call loop.
6. **T6** Sprint close - full 31-test suite green check + sprint close memory + MEMORY.md index entry.

6 tasks. Smaller than Sprint 4 (8) but appropriately sized for a focused single-feature sprint.

## Files

**New (3 test files + 2 memory files = 5):**
- `sidecoach/src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts`
- `sidecoach/src/__tests__/sprint5-disambiguation-prompt.test.ts`
- `sidecoach/src/__tests__/sprint5-disambiguation-resolution.test.ts`
- `.claude/memory/session_2026-05-24_sprint5_execution.md`
- `.claude/memory/session_2026-05-24_sprint5_closed.md`

**Modified (2):**
- `sidecoach/src/sidecoach-orchestrator.ts` (Edit 1 + Edit 2 + SidecoachResult interface)
- `~/.claude/projects/.../memory/MEMORY.md` (global, sprint-close index entry)

## Open questions resolved during brainstorming

- **Q: Scope - one sprint for both Phase 6 features?** A: No, decompose. Intent disambiguation UI first, checkpoint mechanism after. Each gets its own spec.
- **Q: When the intent detector returns multiple matches, what behavior?** A: Tiered - try recommendation first, ask only on true ties.
- **Q: Which tiebreak should bypass the user prompt?** A: Only the recommendation-set tiebreak. Alphabetical fallback prompts.
- **Q: How does the user's disambiguation choice get back to the orchestrator?** A: Two-call: caller re-invokes with `metadata.forceFlowId`. Stateless.

## Risk / confidence flags

- **High confidence:** the silent-tiebreak fix is mechanical (one-line variable reassignment), the forceFlowId bypass is additive (no existing path changes), the return-shape additions are optional fields. Low blast radius.
- **Medium confidence:** test fixture stability. Real-world utterances that produce specific ambiguity shapes may shift as the trigger registry evolves. Test 1 (silent tiebreak) is the most likely to need a fallback to direct injection if no flows currently have a programmer-set recommendation among tied candidates. Acceptable fallback.
- **Lower confidence:** how often the silent path actually fires in real Yes& usage. If `recommendation` is rarely set on the DisambiguationResult, the silent path is effectively unused and we're shipping a fix that helps in theory but not in practice. Future work could add per-flow `recommendation` defaults to make the silent path more common.

## Next step

Invoke `superpowers:writing-plans` to convert this spec into a task-by-task implementation plan (~6 tasks per the breakdown above).
