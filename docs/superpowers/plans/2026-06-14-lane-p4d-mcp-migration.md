# Lane P4d MCP Migration Implementation Plan - v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the sidecoach lane system through the MCP server (CLI-only today) by replacing the legacy mode/keyword tools with a natural-classification tool, a lane-listing tool, and a four-operation lane-driver tool, all reusing the existing classifier and engine without reimplementing either.

**Architecture:** Three surfaces change. (1) `registries.ts` gains a lane-registry loader (`sidecoach-lanes.json`) and an advisory-intent-registry loader (`sidecoach-intent.json`), neither with a silent TS fallback. (2) `sidecoach_resolve_keyword` becomes `sidecoach_classify_intent` (returns the full classifier union including `NUDGE_ELIGIBLE`, computing nudge eligibility from the intent registry but never reading or mutating the cooldown file, since cooldown delivery stays the Python hook's job), and `sidecoach_list_modes` becomes `sidecoach_list_lanes`. (3) A new `sidecoach_lane` tool wraps `createExecutionEngine().{startLane,advanceLane,laneStatus,listLanes}` (the same engine methods the CLI uses) and composes the MCP request AbortSignal into the tool handler boundary. The three-way classifier parity (Python hook / engine TS / mcp-server TS, guarded by `sidecoach/parity/classifier-corpus.json`) is preserved untouched because no classifier logic changes; only a new `intentEligible()` eligibility helper is added on the mcp-server side and guarded by its own curated unit suite.

**Tech Stack:** TypeScript (mcp-server, strict tsc), `@modelcontextprotocol/sdk`, Zod schemas, the custom ts-node test harness (`__tests__/harness.ts`, no jest/vitest), the engine's compiled `dist/` consumed by the mcp-server, and the engine's scoped `scripts/run-tests.ts` parity runner.

---

## Critical Context (read before starting)

**Two independent test runners both matter; capture both at every checkpoint:**

1. **mcp-server `npm test`** (cwd `sidecoach/mcp-server`) runs `ts-node __tests__/run-tests.ts`, which globs `__tests__/unit/`, `__tests__/integration/`, and `__tests__/fault-injection/` for `*.test.ts`. New mcp-server tool tests placed in those directories are auto-discovered (no manual registration). It does NOT run anything under `mcp-server/src/__tests__/`.
2. **engine `npm test`** (cwd `sidecoach`) runs `ts-node scripts/run-tests.ts`, an EXPLICIT suite list. It is the ONLY runner that executes `mcp-server/src/__tests__/classifier-parity.test.ts` (it runs it with cwd=mcp-server). That suite is already registered and required; this plan does not change the classifier, so it stays green unchanged. Do NOT add new suites under `mcp-server/src/__tests__/` (they would need a manual `scripts/run-tests.ts` edit); put all new mcp-server tests under `mcp-server/__tests__/{unit,integration,fault-injection}/` instead.

**The mcp-server consumes the engine's compiled `dist/`.** `registries.ts` and the new lane tool import from `../../dist/*` and `../../../dist/*`. The engine MUST be built (`cd sidecoach && npm run build`) before mcp-server `tsc` or tests run. The engine build also regenerates `lanes.generated.ts` via `scripts/generate-lanes.ts`.

**`mcp-server/dist` is committed and is what the server runs from** (`bin: ./dist/index.js`). A build+commit of `mcp-server/dist` is a required final step.

**Classifier is already mirrored (P1).** `mcp-server/src/keyword-resolver.ts` already exports `loadRegistry`, `classifyIntent`, `evaluateLane`, `detectVerb`, `SCHEMA_VERSION` (the full lane classifier). This plan CONFIRMS and EXTENDS it (adds `intentEligible()`), it does not reimplement it.

**Parity corpus already covers the full outcome union.** `sidecoach/parity/classifier-corpus.json` already contains at least one case for every member of `ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB | NUDGE_ELIGIBLE | SILENT` (NUDGE_ELIGIBLE via `"restyle the navbar"` with `eligible:true`). No corpus extension is required for outcome coverage; eligibility-computation is guarded separately (Task 2). This is verified explicitly in the final task.

**Hyphens only.** A content guard blocks em/en dashes. Use ASCII hyphens everywhere, including this document and all code/comments. Do not paste the smart-quote characters present in some existing regexes.

---

## File Structure

**mcp-server source (created / modified):**
- Modify `mcp-server/src/registries.ts` - add `loadLaneRegistry` + `loadIntentRegistry` + path resolvers + `RegistryBundle.lanes`/`.intent`. No silent TS fallback for lanes.
- Modify `mcp-server/src/keyword-resolver.ts` - add `intentEligible(prompt, intentReg)` (1:1 TS port of the hook's `_intent_eligible()`). Existing classifier functions untouched.
- Modify `mcp-server/src/schemas.ts` - add `classifyIntentShape`, `listLanesShape`, `laneShape` (+ wrapped objects + types); update `TOOL_INPUT_SCHEMAS` (remove resolve_keyword/list_modes, add classify_intent/list_lanes/lane).
- Modify `mcp-server/src/tools/types.ts` - add `signal: AbortSignal` to `ToolDependencies`.
- Modify `mcp-server/src/server.ts` - pass the per-call `controller.signal` into handler deps.
- Create `mcp-server/src/tools/classify-intent.ts` - replaces resolve-keyword.
- Delete `mcp-server/src/tools/resolve-keyword.ts`.
- Create `mcp-server/src/tools/list-lanes.ts` - replaces list-modes.
- Delete `mcp-server/src/tools/list-modes.ts`.
- Create `mcp-server/src/tools/lane.ts` - the four-operation lane driver.
- Modify `mcp-server/src/tools/get-cheatsheet.ts` - section enum key `modes` to `lanes`.
- Modify `mcp-server/src/tools/index.ts` - swap registrations.

**mcp-server tests (created / modified):**
- Create `mcp-server/__tests__/unit/intent-eligible.test.ts` - guards the `intentEligible()` port.
- Create `mcp-server/__tests__/unit/classify-intent.test.ts` - tool behavior incl. NUDGE_ELIGIBLE + no-cooldown.
- Create `mcp-server/__tests__/unit/list-lanes.test.ts` - tool behavior.
- Create `mcp-server/__tests__/unit/lane-tool.test.ts` - input validation + AbortSignal.
- Create `mcp-server/__tests__/integration/lane-tool-e2e.test.ts` - start/advance/status/list round-trip on a temp project.
- Create `mcp-server/__tests__/unit/registries-lane.test.ts` - lane/intent loader (present + structure-invalid + missing).
- Create `mcp-server/__tests__/unit/server-signal.test.ts` - signal reaches handler deps.
- Modify `mcp-server/__tests__/unit/tools.test.ts`, `__tests__/unit/schemas.test.ts`, `__tests__/integration/in-memory.test.ts`, `__tests__/fault-injection/registry-missing.test.ts`, `__tests__/fault-injection/timeout-and-concurrency.test.ts`, `__tests__/smoke.sh`.
- Regenerate `mcp-server/__tests__/integration/stdio-transcript.txt` (written by the stdio test) and update `mcp-server/__tests__/SMOKE_TRANSCRIPT.txt`.

**Docs (modified):**
- Modify `mcp-server/README.md` and `mcp-server/DESIGN.md` - rename tool sections, add `sidecoach_lane`.

**Out of scope (do NOT touch):** `claude/hooks/sidecoach-keyword.sh`, `claude/hooks/sidecoach_lanes.py`, `claude/hooks/test-sidecoach-keyword.sh` (the cooldown mapping + Python `_intent_eligible` stay where they are), the engine `src/` (classifier, runner, orchestrator), `modes.ts`/`dist`, the user-facing ralph mode, the browser collector (P4b-2), copy gating (P4e), the FlowHistory outbox publisher (P4f).

---

## Setup

- [ ] **Step 1: Create the working branch off main**

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main
git checkout -b lane-p4d-mcp-migration
```

- [ ] **Step 2: Build the engine (mcp-server depends on its dist)**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm run build
```
Expected: regenerates `lanes.generated.ts`, runs `tsc`, exits 0. If it fails, STOP - the mcp-server cannot build against a broken engine dist.

- [ ] **Step 3: Capture the engine baseline (the parity runner)**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -20
```
Expected: ends with `run-tests: NN suite(s) passed` (no `suite(s) failed`). This includes `mcp-server/src/__tests__/classifier-parity.test.ts`. Record the suite count.

- [ ] **Step 4: Capture the mcp-server baseline (all three categories)**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npm test 2>&1 | tail -20
```
Expected: ends with a line like `NN tests: NN passed, 0 failed`. Record the count. If `ts-node` reports the engine dist is missing, re-run Setup Step 2.

- [ ] **Step 5: Confirm the registry files the new loaders will read exist**

```bash
ls -la /Users/spare3/Documents/Github/improv/claude/hooks/sidecoach-lanes.json \
       /Users/spare3/Documents/Github/improv/claude/hooks/sidecoach-intent.json
```
Expected: both files present (they are; this is a guard against a bad checkout).

---

## Task 1: Lane + intent registry loaders in registries.ts

**Files:**
- Modify: `mcp-server/src/registries.ts`
- Test: `mcp-server/__tests__/unit/registries-lane.test.ts`

The lane registry is loaded via the classifier's own `loadRegistry` (from `keyword-resolver.ts`), which validates structure (lanes present, scope complete, scoring keys present) and THROWS on structural invalidity. Per spec section 12/13, structural invalidity disables the lane tier loudly (loader returns null, tool returns DOWNSTREAM_UNAVAILABLE); there is no silent TS fallback (unlike modes, which fall back to `modes.ts`). The intent registry is a plain JSON parse; a missing/invalid intent file yields a null slot (eligibility computes to false, no nudge text), mirroring the hook's `if not intent: return False`.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/__tests__/unit/registries-lane.test.ts`:

```typescript
// Unit tests for the lane + intent registry loaders (P4d).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  loadLaneRegistry,
  loadIntentRegistry,
  resolveLanesJsonPath,
  resolveIntentJsonPath,
} from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}

export async function run(): Promise<void> {
  await test('resolveLanesJsonPath points at claude/hooks/sidecoach-lanes.json', () => {
    assert.ok(resolveLanesJsonPath().endsWith(path.join('claude', 'hooks', 'sidecoach-lanes.json')));
  });

  await test('resolveIntentJsonPath points at claude/hooks/sidecoach-intent.json', () => {
    assert.ok(resolveIntentJsonPath().endsWith(path.join('claude', 'hooks', 'sidecoach-intent.json')));
  });

  await test('loadLaneRegistry loads the real registry (lanes + scoring present)', () => {
    const b = loadLaneRegistry(silentLogger());
    assert.ok(b, 'expected a non-null lane bundle');
    assert.ok(Array.isArray(b!.registry.lanes) && b!.registry.lanes.length >= 1);
    assert.ok(b!.registry.scoring && typeof b!.registry.scoring.route_floor === 'number');
    assert.ok(b!.sourcePath.endsWith('sidecoach-lanes.json'));
  });

  await test('loadIntentRegistry loads the advisory registry (has nudge + actions)', () => {
    const intent = loadIntentRegistry(silentLogger());
    assert.ok(intent, 'expected a non-null intent registry');
    assert.ok(typeof intent.nudge === 'string' && intent.nudge.length > 0);
    assert.ok(Array.isArray(intent.actions));
  });

  await test('loadRegistry rejects a structure-invalid file (no silent pass)', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4d-lanes-'));
    const bad = path.join(dir, 'bad-lanes.json');
    fs.writeFileSync(bad, JSON.stringify({ lanes: [{ lane: 'x', label: 'x', lexicon: [] }] }));
    const { loadRegistry } = require('../../src/keyword-resolver');
    let threw = false;
    try { loadRegistry(bad); } catch { threw = true; }
    assert.strictEqual(threw, true, 'structure-invalid registry must throw, not silently pass');
  });

  await test('loadIntentRegistry returns an object for the present file', () => {
    const intent = loadIntentRegistry(silentLogger());
    assert.strictEqual(typeof intent, 'object');
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: FAIL - `loadLaneRegistry` / `loadIntentRegistry` / `resolveLanesJsonPath` / `resolveIntentJsonPath` are not exported from `registries.ts` (TypeScript import error or runtime undefined).

- [ ] **Step 3: Write minimal implementation**

In `mcp-server/src/registries.ts`, add the import for the validating loader near the top (after the existing imports):

```typescript
import { loadRegistry as loadLaneClassifierRegistry } from './keyword-resolver';
```

Add path resolvers next to `resolveModesJsonPath`:

```typescript
export function resolveLanesJsonPath(): string {
  return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-lanes.json');
}

export function resolveIntentJsonPath(): string {
  return path.join(resolveRepoRoot(), 'claude', 'hooks', 'sidecoach-intent.json');
}
```

Add the loaders (after `loadModeRegistry`):

```typescript
// ---------------------------------------------------------------------------
// Lane registry (P4d) - the classifier's own validating loader. Structural
// invalidity (no lanes / incomplete scope / missing scoring keys) THROWS inside
// loadLaneClassifierRegistry; we surface that as a null slot, which disables the
// lane tier loudly (the tool returns DOWNSTREAM_UNAVAILABLE). There is no silent
// TS fallback for lanes - the classifier registry is the single source of truth.
// ---------------------------------------------------------------------------

export interface LaneRegistryBundle {
  registry: any;
  sourcePath: string;
}

export function loadLaneRegistry(logger: Logger): LaneRegistryBundle | null {
  const filePath = resolveLanesJsonPath();
  try {
    const registry = loadLaneClassifierRegistry(filePath);
    return { registry, sourcePath: filePath };
  } catch (err) {
    logger.warn('failed to load lane registry (lane tier disabled, no fallback)', {
      path: filePath,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Advisory-intent registry (P4d) - sidecoach-intent.json. Used ONLY to compute
// nudge eligibility and to surface the advisory nudge text. The MCP never reads
// or mutates the cooldown state file referenced inside it (cooldown -> NUDGE/
// SILENT delivery is the Python hook's job). A missing/invalid file yields null:
// eligibility computes to false and no nudge text is attached.
// ---------------------------------------------------------------------------

export function loadIntentRegistry(logger: Logger): any | null {
  const filePath = resolveIntentJsonPath();
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      logger.warn('intent registry shape unexpected', { path: filePath });
      return null;
    }
    return parsed;
  } catch (err) {
    logger.warn('failed to load intent registry (advisory nudge disabled)', {
      path: filePath,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
```

Extend `RegistryBundle` and `loadAllRegistries`:

```typescript
export interface RegistryBundle {
  verbs: VerbRegistry | null;
  modes: ModeRegistry | null;
  flows: FlowSummary[];
  cheatsheet: CheatsheetContent | null;
  lanes: LaneRegistryBundle | null;
  intent: any | null;
}
```

In `loadAllRegistries`, after `const cheatsheet = loadCheatsheet(logger);` add:

```typescript
  const lanes = loadLaneRegistry(logger);
  const intent = loadIntentRegistry(logger);
```

Update the returned object and the info log to include `lanes` and `intent`:

```typescript
  logger.info('registries loaded', {
    verbCount: verbs?.verbs.length ?? 0,
    modeCount: modes.modes.length,
    flowCount: flows.length,
    cheatsheetLoaded: cheatsheet !== null,
    laneCount: lanes?.registry.lanes.length ?? 0,
    intentLoaded: intent !== null,
  });

  return { verbs, modes, flows, cheatsheet, lanes, intent };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: PASS for all `registries-lane.test.ts` cases; `0 failed` overall (existing unit suites still pass; `RegistryBundle` gained fields, and any stubbed-registries test that constructs a partial bundle is fixed in Task 8).

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/registries.ts mcp-server/__tests__/unit/registries-lane.test.ts
git commit -m "feat(lane-p4d): lane + intent registry loaders (no silent fallback for lanes)"
```

---

## Task 2: intentEligible() port (advisory-nudge eligibility)

**Files:**
- Modify: `mcp-server/src/keyword-resolver.ts`
- Test: `mcp-server/__tests__/unit/intent-eligible.test.ts`

This is a 1:1 TS port of the hook's `_intent_eligible()` (`claude/hooks/sidecoach-keyword.sh` lines 254-287). It matches the `sidecoach-intent.json` lexicons against the length-preserving-sanitized prompt and applies the documented fire rule (`standalone OR (action AND target)`) and exempt rule (a trivial-modify framing with no new-build and no standalone stays silent). It reads NO cooldown state. It exists so `sidecoach_classify_intent` can compute `intentEligible` itself and return `NUDGE_ELIGIBLE` deterministically. The classifier's `NUDGE_ELIGIBLE` outcome is unchanged (it still just consumes the boolean), so three-way classifier parity is unaffected; this helper gets its OWN curated guard.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/__tests__/unit/intent-eligible.test.ts`:

```typescript
// Guards the TS port of the hook's _intent_eligible() against the real
// sidecoach-intent.json. Cases mirror the registry's documented fire/exempt rules.
import { intentEligible } from '../../src/keyword-resolver';
import { loadIntentRegistry } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const intent = loadIntentRegistry(silentLogger());

export async function run(): Promise<void> {
  await test('null registry is never eligible', () => {
    assert.strictEqual(intentEligible('redesign the landing page', null), false);
  });

  await test('standalone signal fires (restyle the navbar)', () => {
    assert.strictEqual(intentEligible('restyle the navbar', intent), true);
  });

  await test('action + substantive target fires (build a dashboard)', () => {
    assert.strictEqual(intentEligible('build me a dashboard', intent), true);
  });

  await test('trivial-modify exempt framing stays silent (just tweak the padding)', () => {
    assert.strictEqual(intentEligible('just tweak the padding', intent), false);
  });

  await test('minor target alone does not fire (make the button bigger)', () => {
    assert.strictEqual(intentEligible('make the button bigger', intent), false);
  });

  await test('non-design backend work does not fire', () => {
    assert.strictEqual(intentEligible('fix the packet header parsing in the network layer', intent), false);
  });

  await test('informational framing suppresses a standalone signal', () => {
    assert.strictEqual(intentEligible('what is a design system?', intent), false);
  });

  await test('new-build overrides an exempt token (redesign the marketing site from scratch)', () => {
    assert.strictEqual(intentEligible('redesign the marketing site from scratch', intent), true);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: FAIL - `intentEligible` is not exported from `keyword-resolver.ts`.

- [ ] **Step 3: Write minimal implementation**

In `mcp-server/src/keyword-resolver.ts`, append at the end of the file (it can use the module-private `laneSanitize` and `laneIsInformational` already defined above it):

```typescript
// ===========================================================================
// Advisory-nudge eligibility (P4d) - a 1:1 TS port of `_intent_eligible()` in
// claude/hooks/sidecoach-keyword.sh. It loads nothing and reads NO cooldown
// state; it only matches the sidecoach-intent.json lexicons against the
// length-preserving-sanitized prompt so sidecoach_classify_intent can return
// NUDGE_ELIGIBLE deterministically. The hook alone maps NUDGE_ELIGIBLE ->
// NUDGE/SILENT via its cooldown file. Pattern boundaries mirror the Python form
// exactly: (?<![\w-])PATTERN(?![\w-]) with no extra wrapping group.
// ===========================================================================
export function intentEligible(prompt: string, intentReg: any): boolean {
  if (!intentReg) return false;
  const sanitized = laneSanitize(prompt);
  const arr = (k: string): string[] => (Array.isArray(intentReg[k]) ? intentReg[k] : []);
  const actions = arr('actions');
  const targets = arr('substantive_targets');
  const standalone = arr('standalone');
  const exempt = arr('exempt');
  const newBuild = arr('new_build');

  const mlist = (pats: string[]): string[] => {
    const out: string[] = [];
    for (const p of pats) {
      if (typeof p !== 'string' || !p) continue;
      let rx: RegExp;
      try { rx = new RegExp(`(?<![\\w-])${p}(?![\\w-])`, 'i'); } catch { continue; }
      if (rx.test(sanitized)) out.push(p);
    }
    return out;
  };
  const subst = (pats: string[]): string[] => mlist(pats).filter((p) => !laneIsInformational(sanitized, p));

  const hasAction = mlist(actions).length > 0;
  const hasTarget = subst(targets).length > 0;
  const hasStandalone = subst(standalone).length > 0;
  const hasExempt = mlist(exempt).length > 0;
  const hasNewBuild = mlist(newBuild).length > 0;

  let fires = hasStandalone || (hasAction && hasTarget);
  if (hasExempt && !hasNewBuild && !hasStandalone) fires = false;
  return fires;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: PASS for all `intent-eligible.test.ts` cases. If a case fails, the failure names the exact prompt; reconcile the expectation against the registry lexicons (do not weaken the port; fix the test expectation to the registry's actual behavior, since the registry is the source of truth).

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/keyword-resolver.ts mcp-server/__tests__/unit/intent-eligible.test.ts
git commit -m "feat(lane-p4d): intentEligible() TS port of the hook eligibility rule (no cooldown read)"
```

---

## Task 3: Schemas for classify_intent, list_lanes, and lane

**Files:**
- Modify: `mcp-server/src/schemas.ts`
- Test: `mcp-server/__tests__/unit/schemas.test.ts`

Add the three new shapes and update the tool-name to schema map. The lane tool uses a discriminating `operation` field with per-operation required fields enforced via `.refine`.

- [ ] **Step 1: Write the failing test**

Append these cases inside the existing `run()` in `mcp-server/__tests__/unit/schemas.test.ts` (keep the existing imports; `TOOL_INPUT_SCHEMAS` is already imported there):

```typescript
  await test('classify_intent: rejects empty prompt', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_classify_intent.safeParse({ prompt: '' });
    assert.strictEqual(r.success, false);
  });

  await test('classify_intent: accepts a normal prompt', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_classify_intent.safeParse({ prompt: 'restyle the navbar' });
    assert.strictEqual(r.success, true);
  });

  await test('classify_intent: rejects > 4000 char prompt', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_classify_intent.safeParse({ prompt: 'x'.repeat(4001) });
    assert.strictEqual(r.success, false);
  });

  await test('list_lanes: accepts empty input', () => {
    const r = TOOL_INPUT_SCHEMAS.sidecoach_list_lanes.safeParse({});
    assert.strictEqual(r.success, true);
  });

  await test('lane: start requires laneId', () => {
    const ok = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'start', laneId: 'lane_build' });
    const bad = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'start' });
    assert.strictEqual(ok.success, true);
    assert.strictEqual(bad.success, false);
  });

  await test('lane: advance requires checkpointId + action + expectedRevision', () => {
    const ok = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'complete', expectedRevision: 0,
    });
    const bad = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'advance', checkpointId: 'cp1' });
    assert.strictEqual(ok.success, true);
    assert.strictEqual(bad.success, false);
  });

  await test('lane: status requires checkpointId; list needs nothing', () => {
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'status', checkpointId: 'cp1' }).success, true);
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'status' }).success, false);
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'list' }).success, true);
  });
```

Delete the two old `resolve_keyword:` schema cases in this file (they are replaced by the `classify_intent` cases above).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -25`
Expected: FAIL - `TOOL_INPUT_SCHEMAS.sidecoach_classify_intent` / `.sidecoach_list_lanes` / `.sidecoach_lane` are undefined.

- [ ] **Step 3: Write minimal implementation**

In `mcp-server/src/schemas.ts`, REPLACE the `resolve_keyword` block (the `resolveKeywordShape` / `ResolveKeywordInput` / `ResolveKeywordInputT` exports) with:

```typescript
// ---------------------------------------------------------------------------
// Tool 4: classify_intent (replaces resolve_keyword) - natural lane classifier
// ---------------------------------------------------------------------------

export const classifyIntentShape = {
  prompt: z
    .string()
    .min(1)
    .max(MAX_PHRASE_CHARS)
    .describe('Natural user prompt to classify against the sidecoach lane registry.'),
};
export const ClassifyIntentInput = z.object(classifyIntentShape);
export type ClassifyIntentInputT = z.infer<typeof ClassifyIntentInput>;
```

REPLACE the `list_modes` block with:

```typescript
// ---------------------------------------------------------------------------
// Tool 2: list_lanes (replaces list_modes - no input)
// ---------------------------------------------------------------------------

export const listLanesShape = {} as const;
export const ListLanesInput = z.object(listLanesShape);
export type ListLanesInputT = z.infer<typeof ListLanesInput>;
```

Add a new lane shape (place it after `getFlowMetadataShape`, before the state tools):

```typescript
// ---------------------------------------------------------------------------
// Tool: sidecoach_lane (P4d) - drive the four monitor lane operations
// ---------------------------------------------------------------------------

const LANE_PROJECT_MAX = 2048;
const LANE_ID_MAX = 128;
const LANE_TARGET_MAX = 2048;
const LANE_CHECKPOINT_MAX = 256;
const LANE_REASON_MAX = 2048;

export const laneShape = {
  operation: z
    .enum(['start', 'advance', 'status', 'list'])
    .describe('Which lane engine method to invoke: start | advance | status | list.'),
  projectPath: z
    .string()
    .min(1)
    .max(LANE_PROJECT_MAX)
    .optional()
    .describe('Project root for checkpoint storage. Defaults to SIDECOACH_PROJECT_ROOT (cwd).'),
  laneId: z.string().min(1).max(LANE_ID_MAX).optional().describe('Lane id, e.g. "lane_build" (operation=start).'),
  target: z.string().max(LANE_TARGET_MAX).optional().describe('Free-text target the lane operates on (operation=start).'),
  startRequestId: z
    .string()
    .min(1)
    .max(LANE_CHECKPOINT_MAX)
    .optional()
    .describe('Idempotency key for start. A repeat with the same id reuses the active lane.'),
  checkpointId: z
    .string()
    .min(1)
    .max(LANE_CHECKPOINT_MAX)
    .optional()
    .describe('Checkpoint id (operation=advance or status).'),
  action: z
    .enum(['complete', 'retry', 'skip', 'resume', 'interrupt', 'stop'])
    .optional()
    .describe('Transition action (operation=advance).'),
  expectedRevision: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe('Best-effort in-process revision check (operation=advance).'),
  reason: z.string().max(LANE_REASON_MAX).optional().describe('Required for skip; recorded for stop/interrupt.'),
  report: z
    .record(z.unknown())
    .optional()
    .describe('StepReport object (required for action=complete). Shape: stepId, iteration, reportId, verb, summary, evidence[].'),
  all: z.boolean().optional().describe('Include closed lanes in the listing (operation=list).'),
};
export const LaneInput = z
  .object(laneShape)
  .refine((v) => v.operation !== 'start' || (typeof v.laneId === 'string' && v.laneId.length > 0), {
    message: 'operation=start requires laneId',
  })
  .refine(
    (v) =>
      v.operation !== 'advance' ||
      (typeof v.checkpointId === 'string' &&
        v.checkpointId.length > 0 &&
        typeof v.action === 'string' &&
        typeof v.expectedRevision === 'number'),
    { message: 'operation=advance requires checkpointId, action, and expectedRevision' },
  )
  .refine((v) => v.operation !== 'status' || (typeof v.checkpointId === 'string' && v.checkpointId.length > 0), {
    message: 'operation=status requires checkpointId',
  });
export type LaneInputT = z.infer<typeof LaneInput>;
```

Update `TOOL_INPUT_SCHEMAS`: remove the `sidecoach_resolve_keyword` and `sidecoach_list_modes` entries and add (place `sidecoach_list_lanes` where `sidecoach_list_modes` was, `sidecoach_classify_intent` where `sidecoach_resolve_keyword` was, and `sidecoach_lane` after `sidecoach_get_flow_metadata`):

```typescript
  sidecoach_list_lanes: ListLanesInput,
  sidecoach_classify_intent: ClassifyIntentInput,
  sidecoach_lane: LaneInput,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -25`
Expected: PASS for all `schemas.test.ts` cases. (The tools/index and tool files are not yet updated; the unit category compiles because `schemas.ts` is self-contained. Other categories are fixed in Tasks 4-5.)

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/schemas.ts mcp-server/__tests__/unit/schemas.test.ts
git commit -m "feat(lane-p4d): schemas for classify_intent, list_lanes, lane (refined per-op)"
```

---

## Task 4: classify_intent tool (replaces resolve_keyword)

**Files:**
- Create: `mcp-server/src/tools/classify-intent.ts`
- Delete: `mcp-server/src/tools/resolve-keyword.ts`
- Modify: `mcp-server/src/tools/index.ts`
- Test: `mcp-server/__tests__/unit/classify-intent.test.ts`

The tool loads the lane registry + verbs + intent registry from deps, computes `intentEligible` itself, calls the existing `classifyIntent`, resolves the winning lane label, and attaches the nudge text on a `NUDGE_ELIGIBLE` outcome. It returns the full classifier union. It does NOT touch the cooldown file.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/__tests__/unit/classify-intent.test.ts`:

```typescript
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { definition, handler } from '../../src/tools/classify-intent';
import { loadAllRegistries } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const registries = loadAllRegistries(silentLogger());
const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };

export async function run(): Promise<void> {
  await test('definition is named sidecoach_classify_intent', () => {
    assert.strictEqual(definition.name, 'sidecoach_classify_intent');
  });

  await test('a confident lane phrase ROUTEs with a winning label', async () => {
    const r = await handler({ prompt: 'make the landing page production-ready' } as any, deps);
    const d = (r.data as any).decision;
    assert.strictEqual(d.outcome, 'ROUTE');
    assert.strictEqual(d.winningLane, 'lane_ship');
    assert.ok((r.data as any).winningLabel && (r.data as any).winningLabel.length > 0);
  });

  await test('an explicit verb yields VERB', async () => {
    const r = await handler({ prompt: 'audit this and make it production-ready' } as any, deps);
    assert.strictEqual((r.data as any).decision.outcome, 'VERB');
    assert.strictEqual((r.data as any).decision.verbMatch, 'audit');
  });

  await test('an eligible natural prompt returns NUDGE_ELIGIBLE with nudge text', async () => {
    const r = await handler({ prompt: 'restyle the navbar' } as any, deps);
    assert.strictEqual((r.data as any).decision.outcome, 'NUDGE_ELIGIBLE');
    assert.ok((r.data as any).nudge && (r.data as any).nudge.length > 0);
  });

  await test('classify_intent never opens the cooldown state file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'p4d-cooldown-'));
    const cooldown = path.join(dir, '.sidecoach-intent-cooldown');
    const prev = process.env.SIDECOACH_INTENT_COOLDOWN_FILE;
    process.env.SIDECOACH_INTENT_COOLDOWN_FILE = cooldown;
    try {
      await handler({ prompt: 'restyle the navbar' } as any, deps);
      assert.strictEqual(fs.existsSync(cooldown), false, 'MCP must not touch cooldown state');
    } finally {
      if (prev === undefined) delete process.env.SIDECOACH_INTENT_COOLDOWN_FILE;
      else process.env.SIDECOACH_INTENT_COOLDOWN_FILE = prev;
    }
  });

  await test('a null lane registry throws DOWNSTREAM_UNAVAILABLE', async () => {
    const depsNoLanes: any = { logger: silentLogger(), registries: { ...registries, lanes: null }, signal: new AbortController().signal };
    let threw = false;
    try { await handler({ prompt: 'anything' } as any, depsNoLanes); } catch (e) { threw = /DOWNSTREAM_UNAVAILABLE|lane registry/.test(String(e)); }
    assert.strictEqual(threw, true);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: FAIL - `../../src/tools/classify-intent` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `mcp-server/src/tools/classify-intent.ts`:

```typescript
// Tool 4: sidecoach_classify_intent (replaces sidecoach_resolve_keyword).
// Classify a natural prompt against the sidecoach lane registry, returning the
// full classifier union: ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB |
// NUDGE_ELIGIBLE | SILENT. Eligibility for the advisory nudge is computed from
// sidecoach-intent.json; the cooldown that maps NUDGE_ELIGIBLE -> NUDGE/SILENT is
// owned by the Python hook and is NEVER read or mutated here.

import { classifyIntent, intentEligible } from '../keyword-resolver';
import { SidecoachToolError } from '../errors';
import { classifyIntentShape, type ClassifyIntentInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof classifyIntentShape> = {
  name: 'sidecoach_classify_intent',
  description:
    'Classify a natural prompt against the sidecoach lane registry using the same grouped scoring, ' +
    'clause binding, and occurrence-aware suppression as the UserPromptSubmit hook. Returns one of ' +
    'ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB | NUDGE_ELIGIBLE | SILENT, plus laneScores, ' +
    'evidence ids, the winning lane/label, and any matched verb. NUDGE_ELIGIBLE is returned as-is; the ' +
    'cooldown that decides NUDGE vs SILENT belongs to the hook and is never read or mutated here.',
  inputSchema: classifyIntentShape,
  timeoutMs: 5_000,
};

export const handler: ToolHandler<ClassifyIntentInputT> = async (input, deps) => {
  const lanes = deps.registries.lanes;
  if (!lanes) {
    throw new SidecoachToolError(
      'DOWNSTREAM_UNAVAILABLE',
      'lane registry not loaded (sidecoach-lanes.json missing or structure-invalid) - lane tier disabled',
      { resource: 'claude/hooks/sidecoach-lanes.json' },
    );
  }
  const verbs = deps.registries.verbs?.verbs ?? [];
  const intentReg = deps.registries.intent;
  const eligible = intentEligible(input.prompt, intentReg);
  const decision = classifyIntent(input.prompt, lanes.registry, verbs, { intentEligible: eligible });

  let winningLabel: string | undefined;
  if (decision.winningLane) {
    const lane = lanes.registry.lanes.find((l: any) => l.lane === decision.winningLane);
    winningLabel = lane ? lane.label : decision.winningLane;
  }
  const nudge =
    decision.outcome === 'NUDGE_ELIGIBLE' && intentReg && typeof intentReg.nudge === 'string'
      ? (intentReg.nudge as string)
      : undefined;

  return {
    data: { decision, winningLabel, nudge },
    summary: `sidecoach_classify_intent: ${decision.outcome}${decision.winningLane ? ` -> ${winningLabel}` : ''}`,
  };
};
```

Update `mcp-server/src/tools/index.ts`: change the import line `import * as resolveKeyword from './resolve-keyword';` to `import * as classifyIntent from './classify-intent';`, and in the `TOOLS` array change `{ definition: resolveKeyword.definition, handler: resolveKeyword.handler },` to `{ definition: classifyIntent.definition, handler: classifyIntent.handler },`.

Delete the old tool file:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git rm mcp-server/src/tools/resolve-keyword.ts
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: PASS for `classify-intent.test.ts`. (The old `tools.test.ts` resolve_keyword cases still reference the deleted tool; those are migrated in Task 8. If the unit category aborts on a compile error from `tools.test.ts`, proceed; Task 8 fixes it.)

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/tools/classify-intent.ts mcp-server/src/tools/index.ts mcp-server/__tests__/unit/classify-intent.test.ts
git commit -m "feat(lane-p4d): sidecoach_classify_intent tool replaces resolve_keyword (computes eligibility, no cooldown)"
```

---

## Task 5: list_lanes tool (replaces list_modes) + cheatsheet section rename

**Files:**
- Create: `mcp-server/src/tools/list-lanes.ts`
- Delete: `mcp-server/src/tools/list-modes.ts`
- Modify: `mcp-server/src/tools/index.ts`, `mcp-server/src/tools/get-cheatsheet.ts`
- Test: `mcp-server/__tests__/unit/list-lanes.test.ts`

`list_lanes` returns the lane registry's lanes with the fields the classifier registry carries (`lane`, `label`, `executionKind`, `interviewLabel`, `description`). Unlike modes (which had a `modes.ts` fallback), there is no fallback: a null lane registry yields DOWNSTREAM_UNAVAILABLE.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/__tests__/unit/list-lanes.test.ts`:

```typescript
import { definition, handler } from '../../src/tools/list-lanes';
import { loadAllRegistries } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const registries = loadAllRegistries(silentLogger());

export async function run(): Promise<void> {
  await test('definition is named sidecoach_list_lanes', () => {
    assert.strictEqual(definition.name, 'sidecoach_list_lanes');
  });

  await test('returns the registry lanes with lane + label', async () => {
    const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };
    const r = await handler({} as any, deps);
    const d = r.data as any;
    assert.ok(d.count >= 1);
    assert.ok(d.lanes.every((l: any) => typeof l.lane === 'string' && typeof l.label === 'string'));
    assert.ok(d.lanes.some((l: any) => l.lane === 'lane_build'));
  });

  await test('a null lane registry throws DOWNSTREAM_UNAVAILABLE', async () => {
    const deps: any = { logger: silentLogger(), registries: { ...registries, lanes: null }, signal: new AbortController().signal };
    let threw = false;
    try { await handler({} as any, deps); } catch (e) { threw = /DOWNSTREAM_UNAVAILABLE|lane registry/.test(String(e)); }
    assert.strictEqual(threw, true);
  });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: FAIL - `../../src/tools/list-lanes` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `mcp-server/src/tools/list-lanes.ts`:

```typescript
// Tool 2: sidecoach_list_lanes (replaces sidecoach_list_modes). Return the lane
// registry's lanes. No fallback - a null lane registry is DOWNSTREAM_UNAVAILABLE.

import { SidecoachToolError } from '../errors';
import { listLanesShape, type ListLanesInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof listLanesShape> = {
  name: 'sidecoach_list_lanes',
  description:
    'Return all sidecoach lanes (lane_build / lane_ship / lane_delight / lane_live / lane_calm / lane_converge). ' +
    'Each lane carries a human label, its interview label, a description, and its executionKind (sequence | loop). ' +
    'Lanes replace the legacy modes; the classifier routes natural prompts to a lane.',
  inputSchema: listLanesShape,
  timeoutMs: 5_000,
};

export const handler: ToolHandler<ListLanesInputT> = async (_input, deps) => {
  const lanes = deps.registries.lanes;
  if (!lanes) {
    throw new SidecoachToolError(
      'DOWNSTREAM_UNAVAILABLE',
      'lane registry not loaded (sidecoach-lanes.json missing or structure-invalid)',
      { resource: 'claude/hooks/sidecoach-lanes.json' },
    );
  }
  const list = (lanes.registry.lanes as any[]).map((l) => ({
    lane: l.lane,
    label: l.label,
    executionKind: l.executionKind ?? 'sequence',
    interviewLabel: l.interviewLabel ?? l.label,
    description: l.description ?? '',
  }));
  return {
    data: { count: list.length, lanes: list },
    summary: `sidecoach_list_lanes: ${list.length} lane(s)`,
  };
};
```

Update `mcp-server/src/tools/index.ts`: change `import * as listModes from './list-modes';` to `import * as listLanes from './list-lanes';`, and in `TOOLS` change `{ definition: listModes.definition, handler: listModes.handler },` to `{ definition: listLanes.definition, handler: listLanes.handler },`.

Delete the old tool:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git rm mcp-server/src/tools/list-modes.ts
```

Update `mcp-server/src/tools/get-cheatsheet.ts`: in the `SECTION_HEADERS` map rename the `modes` key to `lanes` (pointing at the same Section 0 regex), and in the `description` change `modes (5 modes), verbs (22 verbs)` to `lanes (6 lanes), verbs (22 verbs)`:

```typescript
const SECTION_HEADERS: Record<NonNullable<GetCheatsheetInputT['section']>, RegExp | null> = {
  lanes: /^##\s+Section\s+0\b.*$/m,
```

Update the `getCheatsheetShape` enum in `mcp-server/src/schemas.ts` from `['modes', 'verbs', 'flows', 'routing', 'all']` to `['lanes', 'verbs', 'flows', 'routing', 'all']`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: PASS for `list-lanes.test.ts`. (Migrated `tools.test.ts` cases in Task 8 will pick up list_lanes; any cheatsheet schema test referencing `modes` is migrated in Task 8.)

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/tools/list-lanes.ts mcp-server/src/tools/index.ts mcp-server/src/tools/get-cheatsheet.ts mcp-server/src/schemas.ts mcp-server/__tests__/unit/list-lanes.test.ts
git rm mcp-server/src/tools/list-modes.ts
git commit -m "feat(lane-p4d): sidecoach_list_lanes tool replaces list_modes; cheatsheet section modes->lanes"
```

---

## Task 6: AbortSignal propagation into tool handlers

**Files:**
- Modify: `mcp-server/src/tools/types.ts`, `mcp-server/src/server.ts`
- Test: `mcp-server/__tests__/unit/server-signal.test.ts`

Today `server.ts` creates a per-call `AbortController` and aborts it on timeout but does NOT pass `controller.signal` to handlers (it passes only `{ logger, registries }`). The lane tool needs the signal to bound the engine call. Add `signal: AbortSignal` to `ToolDependencies` and have `wrapHandler` pass `controller.signal`.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/__tests__/unit/server-signal.test.ts`:

```typescript
// The per-call AbortController.signal must reach the handler deps so the lane
// tool can bound a long engine call against the MCP timeout/shutdown.
import { buildServer } from '../../src/server';
import { TOOLS } from '../../src/tools';
import { test, assert } from '../harness';

function silentLogger(): any {
  const l: any = { info() {}, warn() {}, error() {}, exception() {} };
  l.child = () => l;
  return l;
}
const emptyRegistries: any = { verbs: { verbs: [] }, modes: { modes: [] }, flows: [], cheatsheet: null, lanes: null, intent: null };

export async function run(): Promise<void> {
  await test('a handler receives an AbortSignal on its deps', async () => {
    const probe = TOOLS.find((t) => t.definition.name === 'sidecoach_list_verbs')!;
    const ac = new AbortController();
    const deps: any = { logger: silentLogger(), registries: emptyRegistries, signal: ac.signal };
    await probe.handler({} as any, deps).catch(() => {});
    assert.ok(deps.signal instanceof AbortSignal, 'deps.signal must be an AbortSignal');
  });

  await test('server builds and registers tools with the signal-bearing deps shape', () => {
    const built = buildServer({ logger: silentLogger(), registries: emptyRegistries });
    assert.strictEqual(built.inFlightCount(), 0);
  });
}
```

The compile-time guarantee is the real fix: once `ToolDependencies` requires `signal`, the `wrapHandler` call site fails to typecheck until it passes `controller.signal`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npx tsc --noEmit 2>&1 | grep -i "signal" | head`
Expected: after adding `signal` to `ToolDependencies` (do the type edit first), `tsc` reports the `wrapHandler` call in `server.ts` is missing `signal`. (If you write the test before the type change, the test still runs but does not yet prove plumbing; the type change is what enforces it.)

- [ ] **Step 3: Write minimal implementation**

In `mcp-server/src/tools/types.ts`, add to `ToolDependencies`:

```typescript
export interface ToolDependencies {
  logger: Logger;
  registries: RegistryBundle;
  /** Per-call AbortSignal. Aborts on the tool timeout or server shutdown. */
  signal: AbortSignal;
}
```

In `mcp-server/src/server.ts`, inside `wrapHandler`, change the handler invocation to pass the signal:

```typescript
        const result = await withTimeout(
          () =>
            handler(validatedInput, {
              logger: childLogger,
              registries,
              signal: controller.signal,
            }),
          timeoutMs,
          controller,
        );
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npx tsc --noEmit && npm run test:unit 2>&1 | tail -15`
Expected: `tsc` clean; `server-signal.test.ts` PASS. Any existing unit test that builds a `deps` object without `signal` now fails to compile; those are fixed in Task 8.

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/tools/types.ts mcp-server/src/server.ts mcp-server/__tests__/unit/server-signal.test.ts
git commit -m "feat(lane-p4d): propagate per-call AbortSignal into ToolDependencies"
```

---

## Task 7: sidecoach_lane tool (four operations + AbortSignal)

**Files:**
- Create: `mcp-server/src/tools/lane.ts`
- Modify: `mcp-server/src/tools/index.ts`
- Test: `mcp-server/__tests__/unit/lane-tool.test.ts` (validation + abort), `mcp-server/__tests__/integration/lane-tool-e2e.test.ts` (round-trip)

The handler wraps `createExecutionEngine().{startLane,advanceLane,laneStatus,listLanes}` (the same engine methods the CLI uses). The MCP signal is composed at the tool boundary via `raceSignal`: if the signal aborts (timeout or shutdown) the async start/advance reject with a TIMEOUT tool error; status/list are synchronous and only check `aborted` up front. The runner's internal lease/heartbeat AbortController (P4b-1) is independent and untouched; it bounds the validator EXECUTE inside the engine, while the MCP signal bounds the tool-call wall-clock.

- [ ] **Step 1: Write the failing unit test (validation + abort)**

Create `mcp-server/__tests__/unit/lane-tool.test.ts`:

```typescript
import { definition, handler } from '../../src/tools/lane';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const registries: any = { verbs: null, modes: null, flows: [], cheatsheet: null, lanes: null, intent: null };

export async function run(): Promise<void> {
  await test('definition is named sidecoach_lane', () => {
    assert.strictEqual(definition.name, 'sidecoach_lane');
  });

  await test('an already-aborted signal rejects before touching the engine', async () => {
    const ac = new AbortController();
    ac.abort();
    const deps: any = { logger: silentLogger(), registries, signal: ac.signal };
    let threw = false;
    try {
      await handler({ operation: 'list' } as any, deps);
    } catch (e) {
      threw = /TIMEOUT|aborted/.test(String(e));
    }
    assert.strictEqual(threw, true);
  });
}
```

- [ ] **Step 2: Run unit test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -15`
Expected: FAIL - `../../src/tools/lane` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `mcp-server/src/tools/lane.ts`:

```typescript
// Tool: sidecoach_lane (P4d). Drive the four monitor lane operations by wrapping
// the SAME engine methods the CLI (bin/sidecoach-monitor.js) calls:
// createExecutionEngine().{startLane, advanceLane, laneStatus, listLanes}.
//
// AbortSignal: the MCP request signal (deps.signal) is composed at the tool
// boundary via raceSignal - a timeout or shutdown rejects the async start/advance
// with a TIMEOUT error. This is INDEPENDENT of the runner's internal lease/
// heartbeat AbortController (P4b-1), which bounds the validator EXECUTE inside the
// engine; the MCP signal bounds the tool-call wall-clock only.

import { createExecutionEngine } from '../../../dist/sidecoach-orchestrator';
import { resolveProjectRoot } from '../project-root';
import { SidecoachToolError } from '../errors';
import { laneShape, type LaneInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof laneShape> = {
  name: 'sidecoach_lane',
  description:
    'Drive a sidecoach lane through the engine state machine: operation=start (begin a lane on a target), ' +
    'advance (apply a transition: complete | retry | skip | resume | interrupt | stop), status (read a ' +
    'checkpoint), or list (enumerate lanes). Wraps the same engine methods the monitor CLI uses. The MCP ' +
    'request timeout aborts an in-flight start/advance.',
  inputSchema: laneShape,
  // Lane operations can run flow handlers; give them headroom under the 30s server cap.
  timeoutMs: 25_000,
};

function abortError(): SidecoachToolError {
  return new SidecoachToolError('TIMEOUT', 'lane operation aborted (MCP timeout or shutdown)', {});
}

// Reject as soon as `signal` aborts, else settle with the wrapped promise.
function raceSignal<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(abortError());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError());
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
      (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
    );
  });
}

export const handler: ToolHandler<LaneInputT> = async (input, deps) => {
  if (deps.signal.aborted) throw abortError();
  const projectPath = input.projectPath ? input.projectPath : resolveProjectRoot();
  const engine = createExecutionEngine();

  switch (input.operation) {
    case 'start': {
      const startRequestId = input.startRequestId || `mcp-${process.pid}-${Date.now()}`;
      const result = await raceSignal(
        engine.startLane(input.laneId as string, input.target ?? '', { projectPath }, startRequestId),
        deps.signal,
      );
      return { data: { result }, summary: `sidecoach_lane start: ${result.laneId} @ ${result.checkpointId}` };
    }
    case 'advance': {
      const transition: any = {
        action: input.action,
        expectedRevision: input.expectedRevision ?? 0,
      };
      if (input.report !== undefined) transition.report = input.report;
      if (input.reason !== undefined) transition.reason = input.reason;
      const result = await raceSignal(
        engine.advanceLane(projectPath, input.checkpointId as string, transition),
        deps.signal,
      );
      return { data: { result }, summary: `sidecoach_lane advance(${input.action}): rev ${result.revision}` };
    }
    case 'status': {
      const result = engine.laneStatus(projectPath, input.checkpointId as string);
      return { data: { result }, summary: `sidecoach_lane status: ${result.lifecycle} @ rev ${result.revision}` };
    }
    case 'list': {
      const result = engine.listLanes(projectPath, { all: !!input.all });
      return { data: { count: result.length, lanes: result }, summary: `sidecoach_lane list: ${result.length} lane(s)` };
    }
    default:
      throw new SidecoachToolError('INTERNAL_ERROR', `unknown lane operation: ${String((input as any).operation)}`, {});
  }
};
```

Register it in `mcp-server/src/tools/index.ts`: add `import * as lane from './lane';` and append `{ definition: lane.definition, handler: lane.handler },` to `TOOLS` (after `getFlowMetadata`).

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npx tsc --noEmit && npm run test:unit 2>&1 | tail -15`
Expected: `tsc` clean (engine dist must be built; see Setup Step 2); `lane-tool.test.ts` PASS.

- [ ] **Step 5: Write the failing integration test (round-trip)**

Create `mcp-server/__tests__/integration/lane-tool-e2e.test.ts`:

```typescript
// Round-trip the sidecoach_lane tool against a real engine on a temp project:
// start a sequence lane -> status -> list. Uses lane_build (executionKind=sequence)
// to avoid the loop convergence preflight.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { handler } from '../../src/tools/lane';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}

export async function run(): Promise<void> {
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'p4d-lane-proj-'));
  const deps: any = {
    logger: silentLogger(),
    registries: { lanes: null, intent: null, verbs: null, modes: null, flows: [], cheatsheet: null },
    signal: new AbortController().signal,
  };

  let checkpointId = '';

  await test('start a sequence lane returns a checkpoint + first step', async () => {
    const r = await handler(
      { operation: 'start', laneId: 'lane_build', target: 'the landing page', projectPath: project, startRequestId: 'e2e-1' } as any,
      deps,
    );
    const res = (r.data as any).result;
    assert.strictEqual(res.laneId, 'lane_build');
    assert.strictEqual(res.executionKind, 'sequence');
    assert.ok(res.checkpointId && res.checkpointId.length > 0);
    checkpointId = res.checkpointId;
  });

  await test('status reads the checkpoint back', async () => {
    const r = await handler({ operation: 'status', checkpointId, projectPath: project } as any, deps);
    const res = (r.data as any).result;
    assert.strictEqual(res.checkpointId, checkpointId);
    assert.strictEqual(res.laneId, 'lane_build');
    assert.strictEqual(res.lifecycle, 'in_progress');
  });

  await test('list includes the started lane', async () => {
    const r = await handler({ operation: 'list', projectPath: project } as any, deps);
    const list = (r.data as any).lanes;
    assert.ok(Array.isArray(list) && list.some((l: any) => l.checkpointId === checkpointId));
  });

  await test('start is idempotent on the same startRequestId', async () => {
    const r = await handler(
      { operation: 'start', laneId: 'lane_build', target: 'the landing page', projectPath: project, startRequestId: 'e2e-1' } as any,
      deps,
    );
    assert.strictEqual((r.data as any).result.checkpointId, checkpointId);
  });
}
```

- [ ] **Step 6: Run the integration test to verify it passes**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:integration 2>&1 | tail -25`
Expected: PASS for `lane-tool-e2e.test.ts` (4 cases). If `start` throws a release-floor/policy error, confirm `lane_build` is `executionKind: sequence` in `claude/hooks/sidecoach-lanes.json` and the engine `lanes.generated.ts`; loop lanes (lane_converge) require the convergence preflight and must not be used here.

- [ ] **Step 7: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/tools/lane.ts mcp-server/src/tools/index.ts mcp-server/__tests__/unit/lane-tool.test.ts mcp-server/__tests__/integration/lane-tool-e2e.test.ts
git commit -m "feat(lane-p4d): sidecoach_lane tool wraps engine start/advance/status/list + AbortSignal"
```

---

## Task 8: Migrate existing tests and the smoke script to the new tool names

**Files:**
- Modify: `mcp-server/__tests__/unit/tools.test.ts`
- Modify: `mcp-server/__tests__/integration/in-memory.test.ts`
- Modify: `mcp-server/__tests__/fault-injection/registry-missing.test.ts`
- Modify: `mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts`
- Modify: `mcp-server/__tests__/smoke.sh`

These tests reference the removed `sidecoach_resolve_keyword` / `sidecoach_list_modes` tool names and build `deps` objects that now need a `signal` field (Task 6) and `lanes`/`intent` registry slots (Task 1).

- [ ] **Step 1: Update tools.test.ts**

In `mcp-server/__tests__/unit/tools.test.ts`:
- Add two helpers near the top of `run()`: `const realDeps = () => ({ logger: silentLogger(), registries: loadAllRegistries(silentLogger()), signal: new AbortController().signal });` and `const depsWithLanes = (lanes: any) => ({ logger: silentLogger(), registries: { ...loadAllRegistries(silentLogger()), lanes }, signal: new AbortController().signal });` (import `loadAllRegistries` from `../../src/registries` and define `silentLogger()` if not present).
- Replace the `list_modes` block (lines ~92-110) with a `list_lanes` block: call `pickHandler('sidecoach_list_lanes')` with `realDeps()`, assert `data.lanes` is a non-empty array of `{lane,label}` containing `lane_build`; replace the "tolerates missing modes registry" case with a null-registry case asserting DOWNSTREAM_UNAVAILABLE via `depsWithLanes(null)`.
- Replace the four `resolve_keyword` tests (lines ~131-160) with `classify_intent` tests:

```typescript
  // ------ classify_intent ------
  await test('classify_intent: routes a confident lane phrase', async () => {
    const h = pickHandler('sidecoach_classify_intent');
    const r = await h({ prompt: 'make the landing page production-ready' } as any, realDeps());
    assert.strictEqual((r.data as any).decision.outcome, 'ROUTE');
  });

  await test('classify_intent: detects an explicit verb', async () => {
    const h = pickHandler('sidecoach_classify_intent');
    const r = await h({ prompt: 'audit this and make it production-ready' } as any, realDeps());
    assert.strictEqual((r.data as any).decision.verbMatch, 'audit');
  });

  await test('classify_intent: NUDGE_ELIGIBLE on an eligible natural prompt', async () => {
    const h = pickHandler('sidecoach_classify_intent');
    const r = await h({ prompt: 'restyle the navbar' } as any, realDeps());
    assert.strictEqual((r.data as any).decision.outcome, 'NUDGE_ELIGIBLE');
  });

  await test('classify_intent: null lane registry throws DOWNSTREAM_UNAVAILABLE', async () => {
    const h = pickHandler('sidecoach_classify_intent');
    let threw = false;
    try { await h({ prompt: 'x' } as any, depsWithLanes(null)); } catch (e) { threw = /DOWNSTREAM_UNAVAILABLE/.test(String(e)); }
    assert.strictEqual(threw, true);
  });
```
- Ensure every other `deps` literal in the file includes `signal: new AbortController().signal` and `lanes`/`intent` slots (search the file for `registries:` and add the fields).

- [ ] **Step 2: Update in-memory.test.ts**

In `mcp-server/__tests__/integration/in-memory.test.ts` the call subset (lines ~54-56) becomes:

```typescript
      { name: 'sidecoach_list_lanes', args: {} },
      { name: 'sidecoach_classify_intent', args: { prompt: 'polish the homepage' } },
      { name: 'sidecoach_lane', args: { operation: 'list' } },
```
and the empty-input rejection case (lines ~104-114) changes the tool name to `sidecoach_classify_intent` with `arguments: { prompt: '' }`. The `tools/list === TOOL_NAMES` assertion needs no edit.

- [ ] **Step 3: Update the fault-injection tests**

In `mcp-server/__tests__/fault-injection/registry-missing.test.ts`:
- Every stubbed `registries` object (lines ~18-58) gains `lanes: null, intent: null` (and `flows: [], cheatsheet: null` if absent).
- Rename the `list_modes still works...` test to target `sidecoach_list_lanes` and invert it: with `lanes: null` the handler throws DOWNSTREAM_UNAVAILABLE (no fallback). Add a sibling case proving the server still BOOTS with `lanes: null` (no throw at build time).

In `mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts`:
- Replace the `list_modes` liveness probe (lines ~85-86) with `sidecoach_list_lanes` (`arguments: {}`).

- [ ] **Step 4: Update smoke.sh**

In `mcp-server/__tests__/smoke.sh`, change the two tool calls (lines 30-31):

```bash
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sidecoach_list_lanes","arguments":{}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"sidecoach_classify_intent","arguments":{"prompt":"please polish the homepage"}}}
```

- [ ] **Step 5: Run all mcp-server categories to verify green**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npx tsc --noEmit && npm test 2>&1 | tail -25`
Expected: `tsc` clean; final line `NN tests: NN passed, 0 failed`. Investigate any failure naming an old tool name (a missed reference).

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/__tests__/unit/tools.test.ts mcp-server/__tests__/integration/in-memory.test.ts mcp-server/__tests__/fault-injection/registry-missing.test.ts mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts mcp-server/__tests__/smoke.sh
git commit -m "test(lane-p4d): migrate existing mcp-server tests + smoke to classify_intent/list_lanes/lane"
```

---

## Task 9: Transcripts, docs, dist build, and full verification

**Files:**
- Regenerate: `mcp-server/__tests__/integration/stdio-transcript.txt`
- Modify: `mcp-server/__tests__/SMOKE_TRANSCRIPT.txt`
- Modify: `mcp-server/README.md`, `mcp-server/DESIGN.md`
- Build + commit: `mcp-server/dist`

`stdio-transcript.txt` is WRITTEN (not golden-compared) by `stdio.test.ts` (`fs.writeFileSync`), so running the stdio integration test regenerates it with the new tool list. `SMOKE_TRANSCRIPT.txt` is a hand-captured reference for `smoke.sh` and is edited/recaptured manually.

- [ ] **Step 1: Regenerate the stdio transcript**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run build && npm run test:integration 2>&1 | tail -15`
Expected: the integration suite passes and rewrites `__tests__/integration/stdio-transcript.txt`. Confirm names:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
grep -c "sidecoach_classify_intent\|sidecoach_list_lanes\|sidecoach_lane" __tests__/integration/stdio-transcript.txt
grep -c "sidecoach_resolve_keyword\|sidecoach_list_modes" __tests__/integration/stdio-transcript.txt
```
Expected: first count > 0, second count == 0.

- [ ] **Step 2: Recapture the SMOKE transcript**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
bash __tests__/smoke.sh > __tests__/SMOKE_TRANSCRIPT.txt 2>&1 || true
grep -c "sidecoach_resolve_keyword\|sidecoach_list_modes" __tests__/SMOKE_TRANSCRIPT.txt
```
Expected: the grep returns 0. If `smoke.sh` does not capture cleanly, manually edit `SMOKE_TRANSCRIPT.txt`: replace `sidecoach_list_modes` with `sidecoach_list_lanes`, `sidecoach_resolve_keyword` (+ its `phrase` arg) with `sidecoach_classify_intent` (+ a `prompt` arg), and add a `sidecoach_lane` `{ "operation": "list" }` example.

- [ ] **Step 3: Update README.md**

In `mcp-server/README.md`:
- Rename the `### sidecoach_list_modes` section to `### sidecoach_list_lanes`; describe the six lanes (lane_build, lane_ship, lane_delight, lane_live, lane_calm, lane_converge) with labels + executionKind.
- Rename the `### sidecoach_resolve_keyword` section to `### sidecoach_classify_intent`; describe the `prompt` input and the seven-member outcome union; state explicitly that NUDGE_ELIGIBLE is returned as-is and the cooldown (NUDGE vs SILENT delivery) is the hook's job, never read or mutated by the MCP.
- Add a new `### sidecoach_lane` section documenting the four operations and that it wraps the engine methods the monitor CLI uses.

- [ ] **Step 4: Update DESIGN.md**

In `mcp-server/DESIGN.md`: replace every `sidecoach_resolve_keyword` with `sidecoach_classify_intent` and every `sidecoach_list_modes` with `sidecoach_list_lanes`; add `sidecoach_lane` to the tool inventory; add one paragraph noting the lane + intent registries load once with no silent fallback for lanes, AbortSignal is now plumbed into every handler, and the MCP never touches the advisory-nudge cooldown.

Verify the rename is complete:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
grep -rn "sidecoach_resolve_keyword\|sidecoach_list_modes" README.md DESIGN.md
```
Expected: no output.

- [ ] **Step 5: Build + stage the committed dist**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npm run build
ls dist/tools/classify-intent.js dist/tools/list-lanes.js dist/tools/lane.js
```
Expected: the three new `dist/tools/*.js` exist. tsc does not delete artifacts for removed sources, so explicitly drop the stale ones:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
git rm -f --ignore-unmatch \
  dist/tools/resolve-keyword.js dist/tools/resolve-keyword.d.ts dist/tools/resolve-keyword.js.map dist/tools/resolve-keyword.d.ts.map \
  dist/tools/list-modes.js dist/tools/list-modes.d.ts dist/tools/list-modes.js.map dist/tools/list-modes.d.ts.map
rm -f dist/tools/resolve-keyword.* dist/tools/list-modes.*
```

- [ ] **Step 6: Full verification - both runners + parity + corpus union + dash/NUL scan**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: `run-tests: NN suite(s) passed` (same or higher than baseline; `mcp-server/src/__tests__/classifier-parity.test.ts` green).

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit && npm test 2>&1 | tail -15
```
Expected: `tsc` clean; `NN tests: NN passed, 0 failed`.

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
python3 -c "import json; c=json.load(open('parity/classifier-corpus.json'))['cases']; have={x['expect'] for x in c}; need={'ROUTE','CLASSIFY','OUT_OF_SCOPE','CONTEXT_CHECK','VERB','NUDGE_ELIGIBLE','SILENT'}; print('missing:', need-have)"
```
Expected: `missing: set()`.

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
python3 - <<'PY'
import glob
em = chr(0x2014); en = chr(0x2013); nul = chr(0)
bad = []
files = glob.glob('src/**/*.ts', recursive=True) + glob.glob('__tests__/**/*.ts', recursive=True) + ['README.md', 'DESIGN.md']
for f in files:
    try:
        t = open(f, encoding='utf-8').read()
    except Exception:
        continue
    if em in t or en in t or nul in t:
        bad.append(f)
print('files with em/en-dash or NUL:', bad)
PY
```
Expected: `files with em/en-dash or NUL: []`. (If a PRE-EXISTING file flags, leave it; only the plan-authored additions must be clean.)

- [ ] **Step 7: Commit the docs, transcripts, and dist**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/README.md mcp-server/DESIGN.md \
        mcp-server/__tests__/integration/stdio-transcript.txt \
        mcp-server/__tests__/SMOKE_TRANSCRIPT.txt \
        mcp-server/dist
git commit -m "docs+dist(lane-p4d): rename tool docs, regenerate transcripts, rebuild committed mcp-server dist"
```

---

## Deferred (explicitly NOT in P4d)

- **Bidirectional eligibility parity in Python.** `intentEligible()` is guarded on the MCP side by `intent-eligible.test.ts` against the real registry. A future change could extract the hook's inline `_intent_eligible()` into `sidecoach_lanes.py` as a pure `intent_eligible(prompt, intent_reg)`, repoint the hook to it, and add a Python assertion so eligibility parity becomes bidirectional (Python module == TS port). Left out here to keep P4d MCP-scoped and avoid hook-layer churn. Flagged to the team lead.
- **list_lanes engine enrichment.** `list_lanes` returns the classifier registry fields. Enriching each lane with the engine's `getLane(...)` verb-step count / waivers is possible but adds engine coupling; deferred.
- **Removing the legacy `resolveKeyword`/`loadModeRegistry`/`modes.ts` plumbing.** The legacy verb/mode resolver function and the mode registry loader remain (still unit-tested) even though no tool exposes them now. modes.ts and the user-facing ralph mode are a separate later cleanup per the spec; not touched.
- **Browser collector (P4b-2), copy gating (P4e), FlowHistory outbox publisher (P4f).** Out of scope.

---

## Self-Review

**1. Spec coverage (section 11 + section 10 + the NUDGE_ELIGIBLE/cooldown split):**
- `registries.ts` lane + scope-policy loader, no silent TS fallback -> Task 1. (Scope policy travels inside the lane registry's `scope` block, validated by `loadRegistry`.)
- `keyword-resolver.ts` full classifier (grouped scoring, clause binding, occurrence-aware suppression) -> already present from P1 (Critical Context); extended with `intentEligible()` in Task 2.
- `sidecoach_classify_intent` replaces `sidecoach_resolve_keyword`; full union incl. NUDGE_ELIGIBLE; loads intent registry; never reads/mutates cooldown -> Tasks 3-4 (+ Task 2 eligibility, + the no-cooldown test).
- Parity stops before delivery state; hook maps NUDGE_ELIGIBLE to NUDGE/SILENT -> preserved by NOT touching the hook (Deferred + Out of scope); classifier parity unchanged (Critical Context + Task 9 verification).
- Phrase-parser resolution is a SEPARATE union (section 10) -> `slash-command-router.ts` `PhraseResolution` (`ROUTE|CLASSIFY|OUT_OF_SCOPE|UNKNOWN`) is the engine's concern and is untouched; the MCP classifier union and the phrase parser union stay distinct (parser UNKNOWN never conflated with classifier SILENT). No MCP change needed.
- `sidecoach_lane` mirrors all four monitor lane operations -> Task 7.
- `list-modes.ts -> list-lanes.ts`; `schemas.ts`, `tools/index.ts`, `get-cheatsheet.ts`; README/DESIGN; all test tiers + transcripts; dist -> Tasks 3, 5, 8, 9.
- AbortSignal propagation into tool handlers (server.ts, tools/types.ts) -> Task 6; composed in the lane tool -> Task 7.

**2. Placeholder scan:** every code step shows complete code; every command shows expected output. No "TBD", no "add error handling", no "similar to Task N". The two doc tasks (README/DESIGN) describe exact renames + the new section's required content rather than pasting full prose, which is appropriate for prose-only files with a verifiable grep gate.

**3. Type consistency:** `LaneRegistryBundle { registry, sourcePath }` (Task 1) is consumed as `deps.registries.lanes.registry` in Tasks 4/5. `ToolDependencies.signal: AbortSignal` (Task 6) is consumed as `deps.signal` in Task 7. `classifyIntentShape`/`listLanesShape`/`laneShape` + their `*InputT` types (Task 3) match the tool `definition.inputSchema`/handler input types (Tasks 4/5/7). Engine method signatures used in Task 7 match the orchestrator: `startLane(laneId, target, {projectPath}, startRequestId)`, `advanceLane(projectPath, checkpointId, transition)`, `laneStatus(projectPath, checkpointId)`, `listLanes(projectPath, {all})`. `intentEligible(prompt, intentReg)` (Task 2) is called with `deps.registries.intent` (Task 4). `TOOL_INPUT_SCHEMAS` keys (`sidecoach_classify_intent`/`sidecoach_list_lanes`/`sidecoach_lane`) match the tool `definition.name`s.
