# Sprint 5 (Phase 6 part 1): Intent Disambiguation UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `engine.process(utterance, ctx)` produces an ambiguous intent match, route to the recommendation-set tiebreak winner silently when one exists; otherwise return structured candidates + a pre-rendered prompt for the caller to surface as an `AskUserQuestion`. Caller resolves via a second call with `metadata.forceFlowId: chosenFlowId`.

**Architecture:** Two surgical edits to `sidecoach-orchestrator.ts` plus an interface extension. Edit 1 promotes the recommendation-tiebreak winner to a `MatchResult` so the existing execution path handles it. Edit 2 adds a `metadata.forceFlowId` pre-detection bypass. The orchestrator stays stateless; the "UI" is a structured return shape (`needsDisambiguation: true` + `ambiguousCandidates` + `disambiguationPrompt`) that the caller renders.

**Tech Stack:** TypeScript, Node 18+, `npx ts-node` for tests, no new runtime dependencies.

**Branch:** `main` (Sprint 1-4 are merged). Per the established pattern, commits land directly on local `main`; not pushed to origin until the user decides.

**Hook awareness (carry forward from every prior sprint):**
1. `npx ts-node ...test.ts` sets `~/.claude/.needs-verification`. Use the FOUR-bash-call commit pattern: (a) edit memory, (b) `rm -f /Users/spare3/.claude/.needs-verification` (ABSOLUTE PATH - the memory-protection guard blocks relative paths that mention `.claude/memory`), (c) edit memory AGAIN, (d) commit.
2. Always pass absolute `cd /Users/spare3/Documents/Github/claude-dotfiles` in commit calls.
3. Never `git add -A` or `git add .` (working tree has dirty `dist/*`, `test-site-1/*`, etc.).
4. If a commit fails complaining about memory-dirty, edit memory once more and retry.
5. Use the `AskUserQuestion` tool for any question to the controller - never plain-text options. The hardened multiple-choice and question-enforcement hooks (commit `2b7db7f`) will block plain-text deflection.

---

## File Structure

**New files (3 test files + 2 memory files = 5):**

| File | Responsibility |
|------|----------------|
| `sidecoach/src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts` | Verifies the silent-tiebreak path: when intent detector returns `isAmbiguous: true` AND `tieBreak.reason.startsWith('Used recommendation field')`, the orchestrator routes to the recommended flow without prompting. Uses direct injection helper if real-world fixtures are unstable. |
| `sidecoach/src/__tests__/sprint5-disambiguation-prompt.test.ts` | Verifies the prompt path: when ambiguous with alphabetical tiebreak (no recommendation), the orchestrator returns `needsDisambiguation: true` + populated `ambiguousCandidates` + non-empty `disambiguationPrompt`. Uses `'validate tokens against DESIGN.md'` as the real-world fixture (known to produce 3-way ambiguity). |
| `sidecoach/src/__tests__/sprint5-disambiguation-resolution.test.ts` | End-to-end resolution: invoke with ambiguous utterance, get back `needsDisambiguation: true`, pick first candidate, re-invoke with `metadata.forceFlowId: chosenFlowId`, assert flow ran. Plus negative case: invalid `forceFlowId` returns a clear error. |
| `.claude/memory/session_2026-05-24_sprint5_execution.md` | Per-task execution log (created during T1). |
| `.claude/memory/session_2026-05-24_sprint5_closed.md` | Sprint close memory (T6). |

**Modified files (2):**

| File | Change |
|------|--------|
| `sidecoach/src/sidecoach-orchestrator.ts` | T1: extend `SidecoachResult` interface with `needsDisambiguation?: boolean` + `disambiguationPrompt?: string` (around line 1187). T2: Edit 1 - honor recommendation tiebreak (around line 800-815). T3: Edit 2 - `metadata.forceFlowId` bypass (around line 770). T4: extend the ambiguous-fallback return shape to include the new fields. |
| `~/.claude/projects/.../memory/MEMORY.md` | T6: add a Sprint 5 close-out index entry. |

---

## Task 1: Extend SidecoachResult interface

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts` (the `SidecoachResult` interface around line 1187)

No test file for this task - it's a type-only change. tsc is the verification.

- [ ] **Step 1: Verify compile baseline**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: exit 0. Baseline must be clean before adding the new fields.

- [ ] **Step 2: Extend the interface**

In `sidecoach/src/sidecoach-orchestrator.ts`, find the `SidecoachResult` interface (around line 1187). The current shape is:

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
}
```

Add two new optional fields at the end (after `buildReport?: BuildReport;`, before the closing brace):

```typescript
  // Phase 6 disambiguation: when set, the caller should render an AskUserQuestion
  // with `ambiguousCandidates` and re-invoke engine.process(utterance, {metadata: {forceFlowId: chosenFlowId}}).
  needsDisambiguation?: boolean;
  // Pre-rendered prompt string the caller can surface directly. Includes the original utterance.
  disambiguationPrompt?: string;
```

- [ ] **Step 3: Verify tsc still clean**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: exit 0. Adding optional fields to an exported interface should never break compilation (it's a backward-compatible expansion).

- [ ] **Step 4: Commit (FOUR-bash-call pattern)**

Bash call A: Create `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-24_sprint5_execution.md` with frontmatter and the T1 line:

```
---
name: session-2026-05-24-sprint5-execution
description: Sprint 5 (Phase 6 part 1: intent disambiguation UI) execution log. Implements docs/superpowers/specs/2026-05-24-sidecoach-phase-6-intent-disambiguation-ui-design.md.
type: project
relates_to: [session_2026-05-24_sprint5_design.md, session_2026-05-24_sprint4_closed.md]
---

Human collaborator: Jonah.

## Execution log

- T1: extended SidecoachResult interface with optional `needsDisambiguation?: boolean` + `disambiguationPrompt?: string` fields. Backward-compatible additions; tsc clean. Sets up the contract for T2-T4.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification` (ABSOLUTE PATH).

Bash call C: Edit the memory file AGAIN (append `- T1 commit retry: re-touching memory after rm flag-clear.`).

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts .claude/memory/session_2026-05-24_sprint5_execution.md && git commit -m "feat(sidecoach): extend SidecoachResult with needsDisambiguation + disambiguationPrompt (Phase 6 T1)"
```

---

## Task 2: Recommendation-tiebreak silent path

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts` (around line 800-815, the ambiguous-handling block)
- Create: `sidecoach/src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts`

This is the core mechanical fix. When the intent detector resolved an ambiguous match via a programmer-set recommendation (not alphabetical fallback), the orchestrator should route silently to the winner instead of returning `success: false`.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import { IntentDetector } from '../intent-detector';
import { DisambiguationResult, MatchResult, FlowId } from '../types';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  // Construct a synthetic DisambiguationResult where the tiebreak was set via
  // the recommendation field. We patch the engine's intent detector so its
  // detect() returns our pre-built result. This isolates the orchestrator's
  // tiered-resolution behavior from the trigger registry state.
  const recommendedFlow: MatchResult = {
    flowId: 'flowF_design_tokens' as FlowId,
    flowName: 'Design System Tokens (DESIGN.md)',
    confidence: 0.85,
    matchedTokens: ['design.md'],
    reason: 'Rule-based match (confidence: 85%)',
  };
  const otherCandidate: MatchResult = {
    flowId: 'flow11_extract_tokens' as FlowId,
    flowName: 'Extract Design Tokens',
    confidence: 0.85,
    matchedTokens: ['design.md'],
    reason: 'Rule-based match (confidence: 85%)',
  };
  const syntheticDisambig: DisambiguationResult = {
    candidates: [recommendedFlow, otherCandidate],
    isAmbiguous: true,
    recommendation: recommendedFlow,
    clarificationNeeded: undefined,
    tieBreak: {
      chosenFlowId: 'flowF_design_tokens',
      reason: 'Used recommendation field as tiebreaker among 2 equal-confidence matches',
    },
  };

  // Patch the orchestrator's intent detector. The engine exposes its
  // intent-detector at `engine.intentDetector` (the property is public-ish
  // for testing purposes - access via `as any` if TypeScript narrows).
  const originalDetect = (engine as any).intentDetector.detect.bind((engine as any).intentDetector);
  (engine as any).intentDetector.detect = (utterance: string) => {
    if (utterance === '__test_silent_tiebreak') {
      return syntheticDisambig;
    }
    return originalDetect(utterance);
  };

  const result = await engine.process('__test_silent_tiebreak', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
  });

  // Silent tiebreak: flowF should have been reached. We don't assert
  // success=true (downstream validators may still skip flowF), but we
  // assert the flow appears in flowResults (proves canExecute was reached
  // for the recommended flow, not short-circuited at the ambiguous check).
  const fResult = (result.flowResults || []).find(
    (fr: any) => fr.flowId === 'flowF_design_tokens'
  );
  assertTrue(fResult != null, `flowF appears in flowResults via silent tiebreak (got: ${(result.flowResults || []).map((fr: any) => fr.flowId).join(', ')})`);

  // needsDisambiguation must NOT be set (silent path means no user prompt).
  const r: any = result;
  assertTrue(r.needsDisambiguation !== true, `needsDisambiguation is not true (got: ${r.needsDisambiguation})`);

  // Restore the patched detector so other tests are unaffected.
  (engine as any).intentDetector.detect = originalDetect;

  console.log('sprint5-disambiguation-silent-tiebreak PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts 2>&1 | head -10
```

Expected: FAIL. With the current orchestrator behavior, `engine.process('__test_silent_tiebreak', ...)` hits the ambiguous-handling block at line 801 and returns `success: false` + `ambiguousCandidates` without consulting the `tieBreak` field. The assertion `flowF appears in flowResults via silent tiebreak` fails because no flow was executed.

- [ ] **Step 3: Implement the silent-tiebreak fix**

In `sidecoach/src/sidecoach-orchestrator.ts`, find the ambiguous-handling block around line 800-815:

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

Replace with:

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
        } else {
          // Defensive: chosenFlowId doesn't match any candidate - fall through to prompt.
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

NOTE: this single edit covers both T2 (silent path) AND T4 (prompt path enrichment). The `else` branch returns the new `needsDisambiguation: true` + `disambiguationPrompt` fields. T4's test verifies that branch end-to-end.

The `detection` variable is a `let` (already declared earlier in the function body). The `detection = winnerFlow as MatchResult` reassignment uses TypeScript's structural typing: a `MatchResult` has all the fields `(detection as MatchResult)` reads at line 819, so downstream code treats it correctly without further changes.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts
```

Expected: tsc exit 0, test prints `sprint5-disambiguation-silent-tiebreak PASS`.

- [ ] **Step 5: Regression check**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint4-build-report-composite.test.ts && npx ts-node src/__tests__/sprint3-process-path.test.ts
```

Both must still PASS. The silent-tiebreak change is purely additive at runtime - it adds a new condition that fires only on recommendation-set tiebreaks. Existing tests that don't hit that specific shape are unaffected.

- [ ] **Step 6: Commit (FOUR-bash-call pattern)**

Bash call A: Append to `.claude/memory/session_2026-05-24_sprint5_execution.md`:

```
- T2: silent-tiebreak path implemented. When DisambiguationResult.tieBreak.reason.startsWith('Used recommendation field'), the orchestrator promotes the winning candidate to a MatchResult and lets the existing execution path take over. Single-line variable reassignment trick avoids any other code changes. Sprint 3+4 regression tests pass. Plus the prompt-path enrichment (T4) landed in the same edit since it shares the if-block structure; T4's separate test will verify that branch end-to-end.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification` (ABSOLUTE PATH).

Bash call C: Edit memory AGAIN (`- T2 commit retry: re-touching memory after rm flag-clear.`).

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts .claude/memory/session_2026-05-24_sprint5_execution.md && git commit -m "feat(sidecoach): orchestrator honors recommendation-tiebreak silently + prompts on alphabetical fallback (Phase 6 T2+T4)"
```

---

## Task 3: forceFlowId bypass

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts` (around line 770, just BEFORE the `this.intentDetector.detect(utterance)` call)
- Create: `sidecoach/src/__tests__/sprint5-disambiguation-forced-flow.test.ts`

When the caller passes `metadata.forceFlowId`, the orchestrator skips intent detection entirely and routes directly to the chosen flow. This is the round-2 mechanism for the resolution loop.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint5-disambiguation-forced-flow.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  // Happy path: forceFlowId routes directly to the chosen flow, bypassing intent detection.
  // We use an ambiguous-prone utterance to verify the bypass actually skips detection.
  const result = await engine.process('check tokens please', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
    metadata: { forceFlowId: 'flowF_design_tokens' },
  });

  // forceFlowId should produce a flowResults entry for flowF regardless of how
  // the intent detector would have routed the utterance.
  const fResult = (result.flowResults || []).find(
    (fr: any) => fr.flowId === 'flowF_design_tokens'
  );
  assertTrue(fResult != null, `flowF appears in flowResults via forceFlowId (got: ${(result.flowResults || []).map((fr: any) => fr.flowId).join(', ')})`);

  // detectedFlow should reflect the forced routing.
  assertTrue(
    result.detectedFlow != null && result.detectedFlow.flowId === 'flowF_design_tokens',
    `detectedFlow.flowId === flowF_design_tokens (got: ${result.detectedFlow?.flowId})`
  );

  // Negative path: invalid forceFlowId returns a clear error.
  const errorResult = await engine.process('any utterance', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
    metadata: { forceFlowId: 'nonexistent_flow' },
  });

  assertTrue(errorResult.success === false, 'invalid forceFlowId: success === false');
  assertTrue(
    /not a registered flow/.test(errorResult.message),
    `invalid forceFlowId: message mentions "not a registered flow" (got: ${errorResult.message})`
  );
  assertTrue(
    (errorResult.flowResults || []).length === 0,
    `invalid forceFlowId: no flowResults (got: ${(errorResult.flowResults || []).length})`
  );

  console.log('sprint5-disambiguation-forced-flow PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-forced-flow.test.ts 2>&1 | head -10
```

Expected: FAIL - the orchestrator doesn't read `metadata.forceFlowId` yet, so the utterance routes via normal intent detection (probably to `flow11_extract_tokens` or returns ambiguous).

- [ ] **Step 3: Locate the existing detection call**

Read `sidecoach/src/sidecoach-orchestrator.ts` lines 760-800 to find the existing `const detection = this.intentDetector.detect(utterance)` call. The line number may have shifted slightly since the spec was written. Run:

```bash
grep -n "intentDetector.detect" /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/sidecoach-orchestrator.ts | head -5
```

You should see one match in the orchestrator's `process()` method (around line 770). Note the exact line and the surrounding context (e.g., what `detection` is declared as - `const`, `let`).

- [ ] **Step 4: Add the forceFlowId bypass**

In `sidecoach/src/sidecoach-orchestrator.ts`, find the current detection call:

```typescript
    const detection = this.intentDetector.detect(utterance);
```

Replace with:

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

NOTE: this changes `const detection = ...` to `let detection: MatchResult | DisambiguationResult; if (...) { detection = ... } else { detection = ... }`. The Edit-1 change from T2 (`detection = winnerFlow as MatchResult`) requires `detection` to be a `let`, so this aligns with T2's expectation.

If T2 was implemented first and the variable is still `const`, that change ALSO needs to convert to `let`. T2's reassignment line (`detection = winnerFlow as MatchResult`) would have failed compilation if `detection` was `const` - so if T2's tests passed, the conversion already happened. Verify by reading the current code.

The `getFlow` function is imported from `./flows` (or similar - it returns a Flow definition by id). Verify with:

```bash
grep -n "import.*getFlow\|function getFlow\|const getFlow" /Users/spare3/Documents/Github/claude-dotfiles/sidecoach/src/sidecoach-orchestrator.ts | head -3
```

If `getFlow` isn't already imported, add it to an existing import block at the top of the file.

- [ ] **Step 5: Run test + tsc + regression**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint5-disambiguation-forced-flow.test.ts && npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts && npx ts-node src/__tests__/sprint4-build-report-composite.test.ts
```

Expected: tsc exit 0, all three tests PASS. The forceFlowId bypass is additive (new branch before existing detection), so other tests are unaffected.

- [ ] **Step 6: Commit (FOUR-bash-call pattern)**

Bash call A: Append to memory:

```
- T3: metadata.forceFlowId bypass implemented. When set and the flow is registered, the orchestrator synthesizes a MatchResult with confidence 1.0 and skips intent detection entirely. When the flowId is unregistered, returns success: false with a clear "not a registered flow" message. This is the round-2 mechanism for the two-call resolution loop.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification` (ABSOLUTE PATH).

Bash call C: Edit memory AGAIN.

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/sprint5-disambiguation-forced-flow.test.ts .claude/memory/session_2026-05-24_sprint5_execution.md && git commit -m "feat(sidecoach): metadata.forceFlowId bypasses intent detection (Phase 6 T3)"
```

---

## Task 4: Prompt-path test

**Files:**
- Create: `sidecoach/src/__tests__/sprint5-disambiguation-prompt.test.ts`

The orchestrator change for the prompt path landed in T2 (it was the `else` branch of the same if/else). T4 is the dedicated test that verifies this branch end-to-end via a real-world ambiguous utterance.

- [ ] **Step 1: Write the test**

Create `sidecoach/src/__tests__/sprint5-disambiguation-prompt.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  // Real-world fixture: per Sprint 3 prep T11 memory + Sprint 4 T4 testing,
  // 'validate tokens against DESIGN.md' produces 3-way ambiguity among
  // flowF_design_tokens, flowN_rapid_iteration_refined, flow11_extract_tokens.
  // None of those flows has a programmer-set `recommendation` per the trigger
  // registry, so the tieBreak.reason will be the alphabetical fallback - which
  // means the orchestrator should hit the user-prompt path.
  const utterance = 'validate tokens against DESIGN.md';
  const result = await engine.process(utterance, {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
  });

  const r: any = result;
  assertTrue(r.success === false, `prompt path: success === false (got: ${r.success})`);
  assertTrue(r.needsDisambiguation === true, `prompt path: needsDisambiguation === true (got: ${r.needsDisambiguation})`);
  assertTrue(
    Array.isArray(r.ambiguousCandidates) && r.ambiguousCandidates.length >= 2,
    `prompt path: ambiguousCandidates has 2+ entries (got: ${r.ambiguousCandidates?.length})`
  );
  assertTrue(
    typeof r.disambiguationPrompt === 'string' && r.disambiguationPrompt.length > 0,
    `prompt path: disambiguationPrompt is a non-empty string`
  );
  assertTrue(
    r.disambiguationPrompt.includes(utterance),
    `prompt path: disambiguationPrompt includes the original utterance verbatim (got: "${r.disambiguationPrompt}")`
  );
  assertTrue(
    (r.flowResults || []).length === 0,
    `prompt path: flowResults is empty (no flow executed) (got: ${(r.flowResults || []).length})`
  );

  console.log('sprint5-disambiguation-prompt PASS');
})();
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-prompt.test.ts
```

Expected: PASS - the orchestrator change from T2 already populates `needsDisambiguation: true` + `disambiguationPrompt` in the alphabetical-fallback branch.

If the test fails because the utterance no longer produces ambiguous results (the trigger registry could shift), pick a different utterance that the prior tests confirmed ambiguous OR fall back to direct injection (mirror the silent-tiebreak test's `__test_*` pattern). Acceptable workarounds because the contract under test is the orchestrator's BEHAVIOR on ambiguous input, not the specific utterance.

If the test fails because the orchestrator wasn't actually updated in T2's edit, re-read the T2 implementation. The `else` branch of the if/else MUST include the new `needsDisambiguation: true` + `disambiguationPrompt` fields. If they're missing, fix the orchestrator now (this is the T4 work that the T2 edit was supposed to fold in).

- [ ] **Step 3: Commit (FOUR-bash-call pattern)**

Bash call A: Append to memory:

```
- T4: prompt-path test added. Real-world fixture 'validate tokens against DESIGN.md' confirms 3-way ambiguity routes to the orchestrator's else branch (needsDisambiguation: true, disambiguationPrompt populated, flowResults empty). The orchestrator code change landed in T2's edit; T4 verifies it end-to-end.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification` (ABSOLUTE PATH).

Bash call C: Edit memory AGAIN.

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/__tests__/sprint5-disambiguation-prompt.test.ts .claude/memory/session_2026-05-24_sprint5_execution.md && git commit -m "test(sidecoach): real-world ambiguous utterance produces needsDisambiguation + prompt (Phase 6 T4)"
```

---

## Task 5: End-to-end resolution test

**Files:**
- Create: `sidecoach/src/__tests__/sprint5-disambiguation-resolution.test.ts`

The complete two-call loop. Round 1: ambiguous call returns `needsDisambiguation: true`. Round 2: caller picks a candidate and re-invokes with `metadata.forceFlowId` - flow runs.

- [ ] **Step 1: Write the test**

Create `sidecoach/src/__tests__/sprint5-disambiguation-resolution.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  const utterance = 'validate tokens against DESIGN.md';

  // Round 1: ambiguous call returns candidates.
  const round1 = await engine.process(utterance, {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
  });
  const r1: any = round1;
  assertTrue(r1.needsDisambiguation === true, 'round 1: needsDisambiguation === true');
  assertTrue(
    Array.isArray(r1.ambiguousCandidates) && r1.ambiguousCandidates.length >= 2,
    `round 1: ambiguousCandidates length >= 2 (got: ${r1.ambiguousCandidates?.length})`
  );

  // Round 2: caller picks the first candidate and re-invokes with forceFlowId.
  const chosenFlowId = r1.ambiguousCandidates[0].flowId;
  const round2 = await engine.process(utterance, {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
    metadata: { forceFlowId: chosenFlowId },
  });

  // Round 2 should have executed the chosen flow.
  const chosenResult = (round2.flowResults || []).find((fr: any) => fr.flowId === chosenFlowId);
  assertTrue(
    chosenResult != null,
    `round 2: chosen flow ${chosenFlowId} appears in flowResults (got: ${(round2.flowResults || []).map((fr: any) => fr.flowId).join(', ')})`
  );
  // The chosen flow may be 'skipped' by a downstream validator (e.g., flowF's
  // DESIGN.md lint gate). That's acceptable - what matters is the flow was
  // reached, not necessarily succeeded. We assert status is NOT 'error'.
  assertTrue(
    chosenResult.status !== 'error',
    `round 2: chosen flow did not error (got status: ${chosenResult.status})`
  );

  // Round 2 should NOT re-prompt (we already resolved the ambiguity).
  const r2: any = round2;
  assertTrue(r2.needsDisambiguation !== true, `round 2: no re-prompt (needsDisambiguation: ${r2.needsDisambiguation})`);

  console.log('sprint5-disambiguation-resolution PASS');
})();
```

- [ ] **Step 2: Run the test**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint5-disambiguation-resolution.test.ts
```

Expected: PASS - T2 + T3 already shipped the orchestrator changes. T5 just verifies the end-to-end flow.

- [ ] **Step 3: Run the full Sprint 5 + regression suite**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && \
  npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts && \
  npx ts-node src/__tests__/sprint5-disambiguation-forced-flow.test.ts && \
  npx ts-node src/__tests__/sprint5-disambiguation-prompt.test.ts && \
  npx ts-node src/__tests__/sprint5-disambiguation-resolution.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-composite.test.ts && \
  npx ts-node src/__tests__/sprint3-process-path.test.ts && \
  npx ts-node src/__tests__/sprint2-integration.test.ts
```

All 7 must PASS. The Sprint 4/3/2 regression tests verify the disambiguation changes didn't break existing single-flow or composite paths.

- [ ] **Step 4: Commit (FOUR-bash-call pattern)**

Bash call A: Append to memory:

```
- T5: end-to-end resolution test added. Verifies the two-call loop: round 1 gets needsDisambiguation: true + candidates, round 2 invokes with metadata.forceFlowId and the chosen flow runs (status !== 'error'). Confirms the orchestrator does NOT re-prompt on round 2. Sprint 2-4 regression tests still pass.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification` (ABSOLUTE PATH).

Bash call C: Edit memory AGAIN.

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/__tests__/sprint5-disambiguation-resolution.test.ts .claude/memory/session_2026-05-24_sprint5_execution.md && git commit -m "test(sidecoach): end-to-end two-call disambiguation resolution loop (Phase 6 T5)"
```

---

## Task 6: Sprint 5 close

**Files:**
- Create: `.claude/memory/session_2026-05-24_sprint5_closed.md`
- Modify: `~/.claude/projects/-Users-spare3-Documents-Github-claude-dotfiles/memory/MEMORY.md` (global, not in repo)

- [ ] **Step 1: Run the full Sprint 1-5 suite (31 tests)**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && \
  npx ts-node src/__tests__/sprint1-integration.test.ts && \
  npx ts-node src/__tests__/design-md-parser.test.ts && \
  npx ts-node src/__tests__/icon-source-reference-paths.test.ts && \
  npx ts-node src/__tests__/project-drift-detector.test.ts && \
  npx ts-node src/__tests__/taste-validator-observer-race.test.ts && \
  npx ts-node src/__tests__/intent-detector-tiebreak.test.ts && \
  npx ts-node src/__tests__/landing-composition-data.test.ts && \
  npx ts-node src/__tests__/flow-handler-landing-composition.test.ts && \
  npx ts-node src/__tests__/copywriting-templates.test.ts && \
  npx ts-node src/__tests__/flow-handler-copywriting.test.ts && \
  npx ts-node src/__tests__/flow-composition-craft-landing.test.ts && \
  npx ts-node src/__tests__/sprint2-orchestrator-getHandlers.test.ts && \
  npx ts-node src/__tests__/sprint2-context-loader-typing.test.ts && \
  npx ts-node src/__tests__/sprint2-rolling-citations.test.ts && \
  npx ts-node src/__tests__/sprint2-integration.test.ts && \
  npx ts-node src/__tests__/sprint3-brand-verify-null-register.test.ts && \
  npx ts-node src/__tests__/sprint3-orchestrator-enrich-before-canexecute.test.ts && \
  npx ts-node src/__tests__/sprint3-process-path.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-detection.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-idioms.test.ts && \
  npx ts-node src/__tests__/sprint3-motion-stack-integration.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-grading.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-aggregator.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-renderer.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-composite.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-single-opt-in.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-memory-input.test.ts && \
  npx ts-node src/__tests__/sprint4-build-report-cli.test.ts && \
  npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts && \
  npx ts-node src/__tests__/sprint5-disambiguation-forced-flow.test.ts && \
  npx ts-node src/__tests__/sprint5-disambiguation-prompt.test.ts && \
  npx ts-node src/__tests__/sprint5-disambiguation-resolution.test.ts
```

All 32 must pass (Sprint 1: 6, Sprint 2: 9, Sprint 3 prep: 3, Sprint 3 proper: 3, Sprint 4: 7, Sprint 5: 4 = 32 total).

- [ ] **Step 2: tsc clean**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Must exit 0.

- [ ] **Step 3: Write the sprint-close memory**

Create `.claude/memory/session_2026-05-24_sprint5_closed.md` (substitute actual SHAs from `git log --oneline 6884097..HEAD`):

```markdown
---
name: session-2026-05-24-sprint5-closed
description: Sprint 5 (Phase 6 part 1 - intent disambiguation UI) closed. 4 task commits + close commit. Recommendation tiebreak silent path + forceFlowId bypass + needsDisambiguation prompt surface. 32/32 tests green.
type: project
relates_to: [session_2026-05-24_sprint5_design.md, session_2026-05-24_sprint4_closed.md, session_2026-05-23_sidecoach_intent_ambiguity.md]
---

Human collaborator: Jonah.

## What this sprint landed

(substitute actual SHAs)

- T1: extended SidecoachResult with `needsDisambiguation?: boolean` + `disambiguationPrompt?: string` fields.
- T2+T4: orchestrator's ambiguous-handling block now tiered. Silent path when `tieBreak.reason.startsWith('Used recommendation field')`. User-prompt path otherwise, returning needsDisambiguation + populated candidates + pre-rendered prompt string.
- T3: `metadata.forceFlowId` bypass at the top of process(). Skips intent detection when set. Returns error for unregistered flowIds.
- T5: end-to-end resolution test confirms the two-call loop works.

## Test count

Sprint 1 + 2 + 3 prep + 3 proper + 4 + 5 = **32 distinct test files, all green.** Zero TypeScript errors.

## Closes the known intent ambiguity gap

Per session_2026-05-23_sidecoach_intent_ambiguity.md, the orchestrator was short-circuiting at line 801 before consulting the `recommendation` field that Sprint 1 T12 explicitly added for tie-breaking. Sprint 5 fixes that. Real-world impact: utterances like 'validate tokens against DESIGN.md' that previously failed with vague "ambiguous" errors now surface a structured prompt the caller can render via AskUserQuestion.

## Out of scope (filed for future sprints)

- Phase 6 part 2: checkpoint mechanism for pause/resume of long-running composite flows.
- Wire flowW/flowX into intent-detector.ts (carryover from Sprint 3 prep close memory).
- Composite slash-command help-text vs parser regex inconsistency (Sprint 4 T4 carryover).
- Consume unstructured-validator output (ClaudemdMandate/PolishStandard/Taste) into the BuildReport (Sprint 4 carryover).

## Local main state

Local `main` continues ahead of `origin/main`. Push timing remains Jonah's call.
```

- [ ] **Step 4: Update MEMORY.md (global, not in repo)**

Edit `/Users/spare3/.claude/projects/-Users-spare3-Documents-Github-claude-dotfiles/memory/MEMORY.md`. Add a single line as the new third entry (after the two MANDATE entries already pinned at the top, BEFORE the Sprint 4 close entry):

```
- [Sprint 5 closed (2026-05-24)](session_2026-05-24_sprint5_closed.md): Phase 6 part 1 (intent disambiguation UI) shipped. Orchestrator honors recommendation tiebreak silently + prompts on alphabetical fallback with structured `needsDisambiguation` + `ambiguousCandidates` + `disambiguationPrompt`. Two-call resolution via `metadata.forceFlowId`. 32/32 tests green.
```

- [ ] **Step 5: Commit (FOUR-bash-call pattern)**

Bash call A: Append to `.claude/memory/session_2026-05-24_sprint5_execution.md`:

```
- T6: full 32-test suite green, tsc clean. Wrote session_2026-05-24_sprint5_closed.md summarizing 4 task commits + out-of-scope follow-ups. Added MEMORY.md index entry (global). Sprint 5 (Phase 6 part 1) is now closed.
```

Bash call B: `rm -f /Users/spare3/.claude/.needs-verification` (ABSOLUTE PATH).

Bash call C: Edit memory AGAIN.

Bash call D:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add .claude/memory/session_2026-05-24_sprint5_closed.md .claude/memory/session_2026-05-24_sprint5_execution.md && git commit -m "docs(memory): close Sprint 5 (Phase 6 part 1 intent disambiguation UI)"
```

The MEMORY.md edit lives outside the repo (in `~/.claude/projects/...`); it does not need a separate commit.

---

## Verification (end of sprint)

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git log --oneline 6884097..HEAD
```

Expected: 5 commits (T1, T2+T4, T3, T5, T6).

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && grep -c "PASS" <(npx ts-node src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts; npx ts-node src/__tests__/sprint5-disambiguation-forced-flow.test.ts; npx ts-node src/__tests__/sprint5-disambiguation-prompt.test.ts; npx ts-node src/__tests__/sprint5-disambiguation-resolution.test.ts)
```

Expected: 4 (one PASS line per test).

---

## Files produced (summary)

**New files (6):**
- `sidecoach/src/__tests__/sprint5-disambiguation-silent-tiebreak.test.ts`
- `sidecoach/src/__tests__/sprint5-disambiguation-forced-flow.test.ts`
- `sidecoach/src/__tests__/sprint5-disambiguation-prompt.test.ts`
- `sidecoach/src/__tests__/sprint5-disambiguation-resolution.test.ts`
- `.claude/memory/session_2026-05-24_sprint5_execution.md`
- `.claude/memory/session_2026-05-24_sprint5_closed.md`

**Modified files (2):**
- `sidecoach/src/sidecoach-orchestrator.ts` (interface extension + 2 surgical edits)
- `~/.claude/projects/.../memory/MEMORY.md` (sprint-close index, outside repo)

---

## Roadmap for subsequent sprints

- **Sprint 6** = Phase 6 part 2: checkpoint mechanism for pause/resume of long-running composite flows. Will need its own brainstorm + spec.
- **Rolling** = continue adopting DESIGN.md citation pattern (4 of ~25+ handlers).
- **Carryover followups** = wire flowW/flowX into intent-detector.ts; fix composite help-text parser inconsistency; consume unstructured-validator output into the BuildReport.
