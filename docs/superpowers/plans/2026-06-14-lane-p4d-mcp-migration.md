# Lane P4d MCP Migration Implementation Plan - v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the sidecoach lane system through the MCP server (CLI-only today) by replacing the legacy mode/keyword tools with a natural-classification tool, a lane-listing tool, and a four-operation lane-driver tool, all reusing the existing classifier and engine without reimplementing either.

**Architecture:** Three surfaces change. (1) `registries.ts` gains a lane-registry loader (`sidecoach-lanes.json`) and an advisory-intent-registry loader (`sidecoach-intent.json`), neither with a silent TS fallback. (2) `sidecoach_resolve_keyword` becomes `sidecoach_classify_intent` (returns the full classifier union including `NUDGE_ELIGIBLE`, computing nudge eligibility from the intent registry but never reading or mutating the cooldown file, since cooldown delivery stays the Python hook's job), and `sidecoach_list_modes` becomes `sidecoach_list_lanes`. The eligibility helper is a faithful behavior port of the production hook's non-length-preserving `sanitize()` and all nine `is_informational()` frames, and classifier parity is pinned by the shared `sidecoach/parity/classifier-corpus.json`. (3) A new `sidecoach_lane` tool wraps `createExecutionEngine().{startLane,advanceLane,laneStatus,listLanes}` (the same engine methods the CLI uses). The required MCP request `AbortSignal` is passed into every handler as a response deadline: after it fires, the MCP call abandons awaiting the engine result and returns TIMEOUT, while an already-started engine operation continues under its own P4b-1 operation lease and heartbeat.

**Tech Stack:** TypeScript (mcp-server, strict tsc), `@modelcontextprotocol/sdk`, Zod schemas, the custom ts-node test harness (`__tests__/harness.ts`, no jest/vitest), the engine's compiled `dist/` consumed by the mcp-server, and the engine's scoped `scripts/run-tests.ts` parity runner.

---

## Critical Context (read before starting)

**Two independent test runners both matter; capture both at every checkpoint:**

1. **mcp-server `npm test`** (cwd `sidecoach/mcp-server`) runs `ts-node __tests__/run-tests.ts`, which globs `__tests__/unit/`, `__tests__/integration/`, and `__tests__/fault-injection/` for `*.test.ts`. New mcp-server tool tests placed in those directories are auto-discovered (no manual registration). It does NOT run anything under `mcp-server/src/__tests__/`.
2. **engine `npm test`** (cwd `sidecoach`) runs `ts-node scripts/run-tests.ts`, an EXPLICIT suite list. It is the ONLY runner that executes `mcp-server/src/__tests__/classifier-parity.test.ts` (it runs it with cwd=mcp-server). That suite is already registered and required; this plan does not change the classifier, so it stays green unchanged. Do NOT add new suites under `mcp-server/src/__tests__/` (they would need a manual `scripts/run-tests.ts` edit); put all new mcp-server tests under `mcp-server/__tests__/{unit,integration,fault-injection}/` instead.

**The mcp-server consumes the engine's compiled `dist/`.** `registries.ts` and the new lane tool import from `../../dist/*` and `../../../dist/*`. The engine MUST be built (`cd sidecoach && npm run build`) before mcp-server `tsc` or tests run. The engine build also regenerates `lanes.generated.ts` via `scripts/generate-lanes.ts`.

**`mcp-server/dist` is committed and is what the server runs from** (`bin: ./dist/index.js`). A build+commit of `mcp-server/dist` is a required final step.

**Classifier is already mirrored (P1).** `mcp-server/src/keyword-resolver.ts` already exports `loadRegistry`, `classifyIntent`, `evaluateLane`, `detectVerb`, `SCHEMA_VERSION` (the full lane classifier). This plan CONFIRMS and EXTENDS it (adds `intentEligible()`), it does not reimplement it.

**Parity corpus is the only eligibility/classifier corpus.** `sidecoach/parity/classifier-corpus.json` already covers every member of `ROUTE | CLASSIFY | OUT_OF_SCOPE | CONTEXT_CHECK | VERB | NUDGE_ELIGIBLE | SILENT`. Task 2 adds the production-hook divergence cases to this same corpus, then asserts corpus-wide that classification using computed eligibility reproduces every row's declared outcome. Do not compare computed eligibility to the corpus's optional `eligible` field because earlier ROUTE/CLASSIFY branches can win even when computed eligibility is true.

**Every commit is green.** Any type-surface change and every affected fixture land in the same commit. Because `stdio.test.ts` executes committed `dist/index.js`, Tasks 4-8 are one atomic surface-cutover commit: all deleted tools, callers, docs, transcripts, signal fixtures, lane tool, and regenerated dist land together after the mandatory pre-dist scan. Before each actual commit run `npx tsc --noEmit && npm test` in `sidecoach/mcp-server` and `npm test` in `sidecoach`; do not commit or proceed on a failure.

**Hyphens only.** A content guard blocks em/en dashes. Use ASCII hyphens everywhere, including this document and all code/comments. Do not paste the smart-quote characters present in some existing regexes.

---

## File Structure

**mcp-server source (created / modified):**
- Modify `mcp-server/src/registries.ts` - add `loadLaneRegistry` + `loadIntentRegistry` + path resolvers + `RegistryBundle.lanes`/`.intent`. No silent TS fallback for lanes.
- Modify `mcp-server/src/keyword-resolver.ts` - add `intentEligible(prompt, intentReg)` as a faithful behavior port of the hook's non-length-preserving `sanitize()`, all nine informational frames, and `_intent_eligible()`. Existing classifier functions untouched.
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
- Modify `parity/classifier-corpus.json` - add production-hook sanitizer/informational divergence rows to the shared corpus.
- Modify `mcp-server/src/__tests__/classifier-parity.test.ts` - add corpus-wide computed-eligibility classifier parity.
- Create `mcp-server/__tests__/unit/intent-eligible.test.ts` - guards the exact hook eligibility port using shared corpus entries.
- Create `mcp-server/__tests__/unit/classify-intent.test.ts` - tool behavior incl. NUDGE_ELIGIBLE + no-cooldown.
- Create `mcp-server/__tests__/unit/list-lanes.test.ts` - tool behavior.
- Create `mcp-server/__tests__/unit/lane-tool.test.ts` - input validation + response deadline.
- Create `mcp-server/__tests__/integration/lane-tool-e2e.test.ts` - start/advance/status/list round-trip on a temp project.
- Create `mcp-server/__tests__/unit/registries-lane.test.ts` - lane/intent loader (present + structure-invalid + missing).
- Create `mcp-server/__tests__/unit/server-signal.test.ts` - signal reaches handler deps.
- Modify `mcp-server/__tests__/unit/tools.test.ts`, `__tests__/unit/schemas.test.ts`, `__tests__/integration/in-memory.test.ts`, `__tests__/integration/stdio.test.ts`, `__tests__/fault-injection/registry-missing.test.ts`, `__tests__/fault-injection/timeout-and-concurrency.test.ts`, `__tests__/fault-injection/python-repl-faults.test.ts`, `__tests__/fault-injection/state-store-faults.test.ts`, `__tests__/fault-injection/ast-grep-faults.test.ts`, `__tests__/fault-injection/validator-throw.test.ts`, `__tests__/smoke.sh`.
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
- Modify typed `RegistryBundle` fixtures in the same commit:
  - `mcp-server/__tests__/unit/tools.test.ts`
  - `mcp-server/__tests__/fault-injection/python-repl-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/state-store-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts`
- Modify untyped direct-handler registry fixtures in the same commit:
  - `mcp-server/__tests__/fault-injection/registry-missing.test.ts`
  - `mcp-server/__tests__/fault-injection/validator-throw.test.ts`

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

- [ ] **Step 4: Migrate every direct registry fixture before running the suite**

Add `lanes: null, intent: null` to every direct registry literal in these exact files:

```text
mcp-server/__tests__/unit/tools.test.ts
mcp-server/__tests__/fault-injection/python-repl-faults.test.ts
mcp-server/__tests__/fault-injection/state-store-faults.test.ts
mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts
mcp-server/__tests__/fault-injection/registry-missing.test.ts
mcp-server/__tests__/fault-injection/validator-throw.test.ts
```

For `tools.test.ts`, add the fields to both `fakeRegistries()` and the local `empty: RegistryBundle`. For the three typed fault-injection suites, add the fields to `NULL_REG`. For `registry-missing.test.ts` and `validator-throw.test.ts`, add the fields to every inline/fake registry object. Confirm the typed-construction inventory is complete:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
rg -n "RegistryBundle" __tests__ --glob '*.ts'
```
Expected: the only direct typed constructions are in `unit/tools.test.ts`, `fault-injection/python-repl-faults.test.ts`, `fault-injection/state-store-faults.test.ts`, and `fault-injection/ast-grep-faults.test.ts`, and every constructed object now contains `lanes` and `intent`.

- [ ] **Step 5: Run the full suites to verify this commit is green**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit && npm test 2>&1 | tail -20
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: `tsc` clean; mcp-server ends with `0 failed`; engine ends with `run-tests: NN suite(s) passed`.

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/src/registries.ts mcp-server/__tests__/unit/registries-lane.test.ts \
  mcp-server/__tests__/unit/tools.test.ts \
  mcp-server/__tests__/fault-injection/python-repl-faults.test.ts \
  mcp-server/__tests__/fault-injection/state-store-faults.test.ts \
  mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts \
  mcp-server/__tests__/fault-injection/registry-missing.test.ts \
  mcp-server/__tests__/fault-injection/validator-throw.test.ts
git commit -m "feat(lane-p4d): lane + intent registry loaders (no silent fallback for lanes)"
```

---

## Task 2: intentEligible() port (advisory-nudge eligibility)

**Files:**
- Modify: `mcp-server/src/keyword-resolver.ts`
- Modify: `parity/classifier-corpus.json`
- Modify: `mcp-server/src/__tests__/classifier-parity.test.ts`
- Test: `mcp-server/__tests__/unit/intent-eligible.test.ts`

This is a faithful behavior port of the production hook path in `claude/hooks/sidecoach-keyword.sh`: the non-length-preserving `sanitize()` at about line 156, all nine `is_informational()` frames at about line 189, and `_intent_eligible()` at about line 254. Do not use `laneSanitize` or `laneIsInformational`: those classifier helpers intentionally have different span-preserving behavior and fewer informational frames. The MCP helper reads no cooldown state. The shared parity corpus, not a parallel eligibility corpus, pins the divergence cases and proves that classification with computed eligibility reproduces every declared classifier outcome.

- [ ] **Step 1: Add the hook-divergence rows to the shared parity corpus**

Append these objects to `sidecoach/parity/classifier-corpus.json`'s `cases` array:

```json
{ "prompt": "tell me about design system", "expect": "SILENT" },
{ "prompt": "what design system does", "expect": "SILENT" },
{ "prompt": "what design system is", "expect": "SILENT" },
{ "prompt": "`restyle the navbar`", "expect": "SILENT" }
```

These rows cover the two production-only informational frames and non-length-preserving inline-code sanitization. They are intentionally in the existing shared corpus so Python hook, engine classifier, and MCP computed-eligibility behavior cannot drift into separate fixture sets.

- [ ] **Step 2: Write the failing unit test using those shared corpus entries**

Create `mcp-server/__tests__/unit/intent-eligible.test.ts`:

```typescript
import * as path from 'path';
import { intentEligible } from '../../src/keyword-resolver';
import { loadIntentRegistry } from '../../src/registries';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const intent = loadIntentRegistry(silentLogger());
const corpusPath = path.resolve(__dirname, '..', '..', '..', 'parity', 'classifier-corpus.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const corpus = require(corpusPath) as { cases: Array<{ prompt: string; expect: string }> };

function corpusPrompt(prompt: string): string {
  const row = corpus.cases.find((c) => c.prompt === prompt);
  assert.ok(row, `missing shared corpus row: ${prompt}`);
  return row!.prompt;
}

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

  await test('what is a design system is informational', () => {
    assert.strictEqual(intentEligible('what is a design system?', intent), false);
  });

  await test('production hook informational frames suppress eligibility', () => {
    assert.strictEqual(intentEligible(corpusPrompt('tell me about design system'), intent), false);
    assert.strictEqual(intentEligible(corpusPrompt('what design system does'), intent), false);
    assert.strictEqual(intentEligible(corpusPrompt('what design system is'), intent), false);
  });

  await test('production hook sanitizer removes inline-code intent text', () => {
    assert.strictEqual(intentEligible(corpusPrompt('`restyle the navbar`'), intent), false);
  });

  await test('new-build overrides an exempt token (redesign the marketing site from scratch)', () => {
    assert.strictEqual(intentEligible('redesign the marketing site from scratch', intent), true);
  });
}
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -20`
Expected: FAIL - `intentEligible` is not exported from `keyword-resolver.ts`.

- [ ] **Step 4: Write the faithful hook behavior port**

In `mcp-server/src/keyword-resolver.ts`, append at the end of the file. This deliberately does not call the classifier's length-preserving sanitizer or seven-frame informational helper:

```typescript
function hookEligibilitySanitize(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\b(?:https?|file|ftp):\/\/\S+/gi, ' ')
    .replace(/<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?<\/\1\s*>/g, ' ')
    .replace(/<[a-zA-Z!/][^>]*>/g, ' ')
    .replace(/\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]/gi, ' ');
}

function hookEligibilityIsInformational(text: string, pattern: string): boolean {
  const frames = [
    `\\bwhat\\s+(?:is|are|was|were|does|did)\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bwhat['\\u2019]s\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+to\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\bhow\\s+do\\s+(?:i|you|we)\\s+(?:use\\s+)?(?:the\\s+)?${pattern}(?![\\w-])`,
    `\\btell\\s+me\\s+about\\s+(?:the\\s+|a\\s+|an\\s+)?${pattern}(?![\\w-])`,
    `\\bexplain\\s+(?:the\\s+|how\\s+|what\\s+)?${pattern}(?![\\w-])`,
    `\\bdefine\\s+${pattern}(?![\\w-])`,
    `(?<![\\w-])${pattern}\\s+is\\s+(?:a|an|the)\\b`,
    `\\bwhat\\s+(?:the\\s+)?${pattern}\\s+(?:does|means|is)\\b`,
  ];
  return frames.some((frame) => new RegExp(frame, 'i').test(text));
}

export function intentEligible(prompt: string, intentReg: any): boolean {
  if (!intentReg) return false;
  const sanitized = hookEligibilitySanitize(prompt);
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
  const subst = (pats: string[]): string[] =>
    mlist(pats).filter((p) => !hookEligibilityIsInformational(sanitized, p));

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

- [ ] **Step 5: Add the non-tautological corpus-wide computed-eligibility parity assertion**

In `mcp-server/src/__tests__/classifier-parity.test.ts`, import `intentEligible`, load the real intent registry JSON, and insert this second corpus loop after the existing declared-eligibility parity loop but before the existing final `if (failures)`:

```typescript
const INTENT = path.join(REPO, 'claude', 'hooks', 'sidecoach-intent.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const intentReg = require(INTENT);

for (const c of corpus.cases) {
  const computed = intentEligible(c.prompt, intentReg);
  const r = classifyIntent(c.prompt, reg, VERBS, { intentEligible: computed });
  try {
    assert.strictEqual(r.outcome, c.expect, `computed-eligibility outcome for: ${c.prompt}`);
    if (c.winningLane) assert.strictEqual(r.winningLane, c.winningLane, `computed winningLane for: ${c.prompt}`);
    if (c.verbMatch) assert.strictEqual(r.verbMatch, c.verbMatch, `computed verbMatch for: ${c.prompt}`);
  } catch (e) {
    failures++;
    console.error(String(e));
  }
}
```

Change the import to:

```typescript
import { loadRegistry, classifyIntent, intentEligible } from '../keyword-resolver';
```

Do not assert `computed === !!c.eligible`. That would be wrong because a prompt can be eligibility-positive while an earlier ROUTE, CLASSIFY, OUT_OF_SCOPE, CONTEXT_CHECK, or VERB branch determines its declared classifier outcome.

Replace the final success line with:

```typescript
console.log(`classifier-parity: ${corpus.cases.length} cases OK (declared + computed eligibility)`);
```

- [ ] **Step 6: Run both full suites and commit green**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit && npm test 2>&1 | tail -20
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: mcp-server ends with `0 failed`; engine parity runner prints `classifier-parity: NN cases OK (declared + computed eligibility)` and ends with `run-tests: NN suite(s) passed`.

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add parity/classifier-corpus.json mcp-server/src/keyword-resolver.ts \
  mcp-server/src/__tests__/classifier-parity.test.ts \
  mcp-server/__tests__/unit/intent-eligible.test.ts
git commit -m "feat(lane-p4d): port production hook eligibility and pin computed parity"
```

---

## Task 3: Schemas for classify_intent, list_lanes, and lane

**Files:**
- Modify: `mcp-server/src/schemas.ts`
- Test: `mcp-server/__tests__/unit/schemas.test.ts`

Add the three new shapes and update the tool-name to schema map additively. Keep the legacy `resolve_keyword` and `list_modes` shapes/map entries in this commit so their still-registered tools continue to compile and pass. Tasks 4 and 5 remove each legacy shape in the same green commit that deletes its tool and migrates all callers. The lane tool uses a discriminating `operation` field with per-operation required fields enforced via `.refine`. `startRequestId` is required for `start` and must be caller-supplied; no `Date.now()` fallback is permitted. If a future transport needs a fallback, it must be deterministic from the request input.

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
    const ok = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'start', laneId: 'lane_build', startRequestId: 'transport-1',
    });
    const badLane = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'start', startRequestId: 'transport-1' });
    const badKey = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'start', laneId: 'lane_build' });
    assert.strictEqual(ok.success, true);
    assert.strictEqual(badLane.success, false);
    assert.strictEqual(badKey.success, false);
  });

  await test('lane: complete requires a StepReport; skip requires a reason', () => {
    const report = {
      stepId: 'shape', iteration: 0, reportId: 'report-1', verb: 'shape',
      summary: 'done', evidence: [{ kind: 'note', detail: 'verified' }],
    };
    const complete = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'complete', expectedRevision: 0, report,
    });
    const completeWithoutReport = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'complete', expectedRevision: 0,
    });
    const skip = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'skip', expectedRevision: 0, reason: 'not needed',
    });
    const skipWithoutReason = TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({
      operation: 'advance', checkpointId: 'cp1', action: 'skip', expectedRevision: 0,
    });
    assert.strictEqual(complete.success, true);
    assert.strictEqual(completeWithoutReport.success, false);
    assert.strictEqual(skip.success, true);
    assert.strictEqual(skipWithoutReason.success, false);
  });

  await test('lane: status requires checkpointId; list needs nothing', () => {
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'status', checkpointId: 'cp1' }).success, true);
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'status' }).success, false);
    assert.strictEqual(TOOL_INPUT_SCHEMAS.sidecoach_lane.safeParse({ operation: 'list' }).success, true);
  });
```

Keep the old `resolve_keyword` and `list_modes` schema cases in this additive task. They are removed atomically with their tools and callers in Tasks 4 and 5.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npm run test:unit 2>&1 | tail -25`
Expected: FAIL - `TOOL_INPUT_SCHEMAS.sidecoach_classify_intent` / `.sidecoach_list_lanes` / `.sidecoach_lane` are undefined.

- [ ] **Step 3: Write minimal implementation**

In `mcp-server/src/schemas.ts`, add this block after the existing `resolve_keyword` block:

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

Add this block after the existing `list_modes` block:

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
const StepReportSchema = z.object({
  stepId: z.string().min(1),
  iteration: z.number().int().min(0),
  reportId: z.string().min(1),
  verb: z.string().min(1),
  summary: z.string().min(1),
  evidence: z.array(z.object({
    kind: z.enum(['files', 'screenshot', 'validation', 'note']),
    detail: z.string().min(1),
  })).min(1),
  checklistResults: z.array(z.object({ itemId: z.string().min(1), done: z.boolean() })).optional(),
});

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
    .describe('Caller-supplied required transport idempotency key for operation=start. A repeat reuses the active lane.'),
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
  reason: z.string().min(1).max(LANE_REASON_MAX).optional().describe('Required for skip; recorded for stop/interrupt.'),
  report: StepReportSchema.optional().describe('StepReport object required for action=complete.'),
  all: z.boolean().optional().describe('Include closed lanes in the listing (operation=list).'),
};
export const LaneInput = z
  .object(laneShape)
  .refine(
    (v) =>
      v.operation !== 'start' ||
      (typeof v.laneId === 'string' &&
        v.laneId.length > 0 &&
        typeof v.startRequestId === 'string' &&
        v.startRequestId.length > 0),
    { message: 'operation=start requires laneId and caller-supplied startRequestId' },
  )
  .refine(
    (v) =>
      v.operation !== 'advance' ||
      (typeof v.checkpointId === 'string' &&
        v.checkpointId.length > 0 &&
        typeof v.action === 'string' &&
        typeof v.expectedRevision === 'number'),
    { message: 'operation=advance requires checkpointId, action, and expectedRevision' },
  )
  .refine((v) => v.operation !== 'advance' || v.action !== 'complete' || v.report !== undefined, {
    message: 'operation=advance action=complete requires report',
  })
  .refine(
    (v) => v.operation !== 'advance' || v.action !== 'skip' || (typeof v.reason === 'string' && v.reason.length > 0),
    { message: 'operation=advance action=skip requires reason' },
  )
  .refine((v) => v.operation !== 'status' || (typeof v.checkpointId === 'string' && v.checkpointId.length > 0), {
    message: 'operation=status requires checkpointId',
  });
export type LaneInputT = z.infer<typeof LaneInput>;
```

Update `TOOL_INPUT_SCHEMAS` additively: keep `sidecoach_resolve_keyword` and `sidecoach_list_modes`, and add:

```typescript
  sidecoach_list_lanes: ListLanesInput,
  sidecoach_classify_intent: ClassifyIntentInput,
  sidecoach_lane: LaneInput,
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit && npm test 2>&1 | tail -25
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: `tsc` clean; mcp-server ends with `0 failed`; engine ends with `run-tests: NN suite(s) passed`.

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
- Modify: `mcp-server/src/tools/index.ts`, `mcp-server/src/schemas.ts`
- Test: `mcp-server/__tests__/unit/classify-intent.test.ts`
- Migrate every deleted-tool caller in the same commit:
  - `mcp-server/__tests__/unit/tools.test.ts`
  - `mcp-server/__tests__/unit/schemas.test.ts`
  - `mcp-server/__tests__/integration/in-memory.test.ts`
  - `mcp-server/__tests__/integration/stdio.test.ts`
  - `mcp-server/__tests__/smoke.sh`

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
// Tool: sidecoach_classify_intent. Natural prompt classification for lanes.
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

- [ ] **Step 4: Remove the legacy schema and migrate every resolve_keyword caller before testing**

In `mcp-server/src/schemas.ts`, delete `resolveKeywordShape`, `ResolveKeywordInput`, `ResolveKeywordInputT`, and the `sidecoach_resolve_keyword` map entry. In `mcp-server/__tests__/unit/schemas.test.ts`, delete the legacy resolve-keyword cases.

In `mcp-server/__tests__/unit/tools.test.ts`, replace the four `resolve_keyword` cases with the four `classify_intent` cases shown in Task 8 below.

In `mcp-server/__tests__/integration/in-memory.test.ts`, replace both `sidecoach_resolve_keyword` calls with `sidecoach_classify_intent`, replace `{ phrase: ... }` with `{ prompt: ... }`, and change the empty-input rejection case to call `sidecoach_classify_intent` with `{ prompt: '' }`.

In `mcp-server/__tests__/integration/stdio.test.ts`, replace the all-tools call:

```typescript
['sidecoach_classify_intent', { prompt: 'polish the homepage' }],
```

In `mcp-server/__tests__/smoke.sh`, replace the deleted-tool call with:

```bash
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"sidecoach_classify_intent","arguments":{"prompt":"please polish the homepage"}}}
```

Confirm no executable/test caller remains before the deletion commit:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
rg -n "sidecoach_resolve_keyword|resolveKeywordShape|ResolveKeywordInput" src __tests__ --glob '!dist/**'
```
Expected: zero matches.

- [ ] **Step 5: Run source-level checks and keep the cutover uncommitted**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit
npm run test:unit 2>&1 | tail -20
npm run test:fault 2>&1 | tail -20
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: source typecheck, unit/fault suites, and engine parity are green. Do not run `npm run build` and do not commit yet. The committed stdio runtime still points at the old dist until the mandatory Task 8 zero-reference gate; Tasks 4-8 land as one atomic green cutover commit.

---

## Task 5: list_lanes tool (replaces list_modes) + cheatsheet section rename

**Files:**
- Create: `mcp-server/src/tools/list-lanes.ts`
- Delete: `mcp-server/src/tools/list-modes.ts`
- Modify: `mcp-server/src/tools/index.ts`, `mcp-server/src/tools/get-cheatsheet.ts`
- Test: `mcp-server/__tests__/unit/list-lanes.test.ts`
- Migrate every deleted-tool and deleted-cheatsheet-section caller in the same commit:
  - `mcp-server/src/schemas.ts`
  - `mcp-server/__tests__/unit/tools.test.ts`
  - `mcp-server/__tests__/unit/schemas.test.ts`
  - `mcp-server/__tests__/integration/in-memory.test.ts`
  - `mcp-server/__tests__/integration/stdio.test.ts`
  - `mcp-server/__tests__/fault-injection/registry-missing.test.ts`
  - `mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts`
  - `mcp-server/__tests__/smoke.sh`

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
// Tool: sidecoach_list_lanes. Return the lane registry's lanes. No fallback -
// a null lane registry is DOWNSTREAM_UNAVAILABLE.

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

- [ ] **Step 4: Remove the legacy schema and migrate every list_modes and cheatsheet modes caller**

In `mcp-server/src/schemas.ts`, delete `listModesShape`, `ListModesInput`, `ListModesInputT`, and the `sidecoach_list_modes` map entry.

In `mcp-server/__tests__/unit/tools.test.ts`, replace the two `list_modes` cases with `list_lanes` success and null-lane-registry failure cases. Rename the cheatsheet case and input from `section=modes` to `section=lanes`; assert the same Section 0-only extraction behavior.

In `mcp-server/__tests__/unit/schemas.test.ts`, remove any `sidecoach_list_modes` case and replace every cheatsheet `{ section: 'modes' }` case with `{ section: 'lanes' }`.

In `mcp-server/__tests__/integration/in-memory.test.ts`, replace every `sidecoach_list_modes` call with `sidecoach_list_lanes`.

In `mcp-server/__tests__/integration/stdio.test.ts`, replace both `sidecoach_list_modes` calls with `sidecoach_list_lanes` and replace the cheatsheet call with `['sidecoach_get_cheatsheet', { section: 'lanes' }]`. Do not add a `sidecoach_lane` call yet; Task 7 adds it in the same commit that registers the tool.

In `mcp-server/__tests__/fault-injection/registry-missing.test.ts`, replace the `list_modes` case with a `sidecoach_list_lanes` DOWNSTREAM_UNAVAILABLE assertion for `lanes: null`; retain the server-boots-with-null-lanes case.

In `mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts`, replace the `list_modes` liveness probe with `sidecoach_list_lanes`.

In `mcp-server/__tests__/smoke.sh`, replace the deleted-tool call with:

```bash
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sidecoach_list_lanes","arguments":{}}}
```

Confirm no executable/test caller remains:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
rg -n "sidecoach_list_modes|listModesShape|ListModesInput|section:[[:space:]]*['\\\"]modes['\\\"]" src __tests__ --glob '!dist/**'
```
Expected: zero matches.

- [ ] **Step 5: Run source-level checks and keep the cutover uncommitted**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit
npm run test:unit 2>&1 | tail -20
npm run test:fault 2>&1 | tail -20
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: source-level checks are green. Do not build dist or commit yet; the deleted tools, every caller migration, response-deadline wiring, lane tool, docs, transcripts, and regenerated dist land together in Task 8.

---

## Task 6: AbortSignal propagation into tool handlers

**Files:**
- Modify: `mcp-server/src/tools/types.ts`, `mcp-server/src/server.ts`
- Test: `mcp-server/__tests__/unit/server-signal.test.ts`
- Modify every existing direct-handler dependency fixture in the same commit:
  - `mcp-server/__tests__/unit/tools.test.ts`
  - `mcp-server/__tests__/fault-injection/python-repl-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/state-store-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/registry-missing.test.ts`
  - `mcp-server/__tests__/fault-injection/validator-throw.test.ts`

Today `server.ts` creates a per-call `AbortController` and fires its signal on timeout but does not pass `controller.signal` to handlers. Add `signal: AbortSignal` to `ToolDependencies` and have `wrapHandler` pass `controller.signal`. For `sidecoach_lane`, this signal is a response deadline only: it lets the handler stop awaiting and return TIMEOUT, but it does not cancel an engine operation that has already started.

- [ ] **Step 1: Write the failing test**

Create `mcp-server/__tests__/unit/server-signal.test.ts`:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildServer } from '../../src/server';
import { TOOLS } from '../../src/tools';
import { z } from 'zod';
import { test, assert } from '../harness';

function silentLogger(): any {
  const l: any = { info() {}, warn() {}, error() {}, exception() {} };
  l.child = () => l;
  return l;
}
const emptyRegistries: any = { verbs: { verbs: [] }, modes: { modes: [] }, flows: [], cheatsheet: null, lanes: null, intent: null };

export async function run(): Promise<void> {
  await test('buildServer wrapHandler supplies a real AbortSignal to a handler', async () => {
    let observedSignal: AbortSignal | undefined;
    TOOLS.push({
      definition: {
        name: 'signal_probe',
        description: 'test-only handler-deps probe',
        inputSchema: { value: z.string() },
        timeoutMs: 1_000,
      },
      handler: async (_input, deps) => {
        observedSignal = deps.signal;
        return { data: { sawSignal: deps.signal instanceof AbortSignal } };
      },
    });
    const built = buildServer({ logger: silentLogger(), registries: emptyRegistries });
    TOOLS.pop();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await built.mcp.connect(serverTransport);
    const client = new Client({ name: 'signal-probe-client', version: '0.0.0' }, { capabilities: {} });
    await client.connect(clientTransport);
    try {
      const response = await client.callTool({ name: 'signal_probe', arguments: { value: 'x' } });
      assert.notStrictEqual(response.isError, true);
      assert.ok(observedSignal instanceof AbortSignal, 'real wrapHandler path did not supply AbortSignal');
    } finally {
      await client.close();
      await built.close();
    }
  });
}
```

This test is non-tautological: it registers a probe in `TOOLS`, builds the real server, invokes the probe through an in-memory MCP client, and observes the dependencies supplied by `wrapHandler`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npx tsc --noEmit 2>&1 | grep -i "signal" | head`
Expected: after adding `signal` to `ToolDependencies` first, `tsc` reports the `wrapHandler` call in `server.ts` and the listed direct-handler fixtures are missing `signal`.

- [ ] **Step 3: Write minimal implementation**

In `mcp-server/src/tools/types.ts`, add to `ToolDependencies`:

```typescript
export interface ToolDependencies {
  logger: Logger;
  registries: RegistryBundle;
  /** Per-call response-deadline signal. Fires on tool timeout or server shutdown. */
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

- [ ] **Step 4: Migrate every direct-handler dependency fixture**

Add `signal: new AbortController().signal` to every direct handler-dependency object or shared `deps()` helper in these exact files:

```text
mcp-server/__tests__/unit/tools.test.ts
mcp-server/__tests__/fault-injection/python-repl-faults.test.ts
mcp-server/__tests__/fault-injection/state-store-faults.test.ts
mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts
mcp-server/__tests__/fault-injection/registry-missing.test.ts
mcp-server/__tests__/fault-injection/validator-throw.test.ts
```

Do not add `signal` to `buildServer({ registries: ... })` options; `buildServer` creates the per-call signal. Confirm there is no direct handler fixture left with only logger and registries:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
rg -n "\\{ logger: silentLogger\\(\\), registries:|return \\{ logger: silentLogger\\(\\), registries:" __tests__ --glob '*.ts'
```
Expected: every match also contains `signal` on the same dependency object or in the immediately following lines.

- [ ] **Step 5: Run source-level checks and keep the cutover uncommitted**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit
npm run test:unit 2>&1 | tail -20
npm run test:fault 2>&1 | tail -20
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: source-level checks are green. Do not build dist or commit yet; Task 8 performs the pre-dist scan and atomic green cutover.

---

## Task 7: sidecoach_lane tool (four operations + response deadline)

**Files:**
- Create: `mcp-server/src/tools/lane.ts`
- Modify: `mcp-server/src/tools/index.ts`
- Test: `mcp-server/__tests__/unit/lane-tool.test.ts` (validation + response deadline), `mcp-server/__tests__/integration/lane-tool-e2e.test.ts` (real start/advance/status/list round-trip)
- Modify live-surface callers in the same commit: `mcp-server/__tests__/integration/in-memory.test.ts`, `mcp-server/__tests__/integration/stdio.test.ts`, `mcp-server/__tests__/smoke.sh`

The handler wraps `createExecutionEngine().{startLane,advanceLane,laneStatus,listLanes}` (the same engine methods the CLI uses). The MCP signal is composed at the tool boundary via `raceResponseDeadline`. If the signal fires before an operation starts, the handler returns TIMEOUT without touching the engine. If it fires after async start/advance begins, the MCP call abandons awaiting that result and returns a deadline-exceeded TIMEOUT response, but the engine operation continues and may persist checkpoint/outbox changes. That operation remains bounded by its own P4b-1 operation lease and heartbeat. The lease/fencing protocol preserves at-most-one committed transition, and a duplicate caller retry is rejected or resolved by the engine's idempotency/fencing rules. P4d does not thread the MCP signal into the engine.

- [ ] **Step 1: Write the failing unit test (validation + already-expired response deadline)**

Create `mcp-server/__tests__/unit/lane-tool.test.ts`:

```typescript
import { definition, handler } from '../../src/tools/lane';
import { SidecoachToolError } from '../../src/errors';
import { test, assert } from '../harness';

function silentLogger(): any {
  return { info() {}, warn() {}, error() {}, exception() {}, child() { return silentLogger(); } };
}
const registries: any = { verbs: null, modes: null, flows: [], cheatsheet: null, lanes: null, intent: null };

export async function run(): Promise<void> {
  await test('definition is named sidecoach_lane', () => {
    assert.strictEqual(definition.name, 'sidecoach_lane');
  });

  await test('an already-expired response deadline rejects before touching the engine', async () => {
    const ac = new AbortController();
    ac.abort();
    const deps: any = { logger: silentLogger(), registries, signal: ac.signal };
    let threw = false;
    try {
      await handler({ operation: 'list' } as any, deps);
    } catch (e) {
      threw = /TIMEOUT|deadline exceeded/.test(String(e));
    }
    assert.strictEqual(threw, true);
  });

  await test('handler requires caller-supplied startRequestId before touching engine', async () => {
    const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };
    let threw = false;
    try {
      await handler({ operation: 'start', laneId: 'lane_build' } as any, deps);
    } catch (e) {
      threw = e instanceof SidecoachToolError && e.code === 'INVALID_INPUT';
    }
    assert.strictEqual(threw, true);
  });

  await test('handler requires report for complete and reason for skip', async () => {
    const deps: any = { logger: silentLogger(), registries, signal: new AbortController().signal };
    for (const input of [
      { operation: 'advance', checkpointId: 'cp1', action: 'complete', expectedRevision: 0 },
      { operation: 'advance', checkpointId: 'cp1', action: 'skip', expectedRevision: 0 },
    ]) {
      let threw = false;
      try {
        await handler(input as any, deps);
      } catch (e) {
        threw = e instanceof SidecoachToolError && e.code === 'INVALID_INPUT';
      }
      assert.strictEqual(threw, true);
    }
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
// Response deadline: deps.signal is passed into the handler as required, but the
// engine methods accept no external signal. If the deadline fires after start or
// advance begins, the MCP call stops awaiting and returns TIMEOUT while the engine
// operation continues under its own P4b-1 operation lease and heartbeat.

import { createExecutionEngine } from '../../../dist/sidecoach-orchestrator';
import { resolveProjectRoot } from '../project-root';
import { SidecoachToolError } from '../errors';
import { LaneInput, laneShape, type LaneInputT } from '../schemas';
import type { ToolDefinition, ToolHandler } from './types';

export const definition: ToolDefinition<typeof laneShape> = {
  name: 'sidecoach_lane',
  description:
    'Drive a sidecoach lane through the engine state machine: operation=start (begin a lane on a target), ' +
    'advance (apply a transition: complete | retry | skip | resume | interrupt | stop), status (read a ' +
    'checkpoint), or list (enumerate lanes). Wraps the same engine methods the monitor CLI uses. The MCP ' +
    'response deadline can stop awaiting an in-flight start/advance, but the engine operation continues under its lease.',
  inputSchema: laneShape,
  // Lane operations can run flow handlers; give them headroom under the 30s server cap.
  timeoutMs: 25_000,
};

function deadlineError(): SidecoachToolError {
  return new SidecoachToolError('TIMEOUT', 'lane response deadline exceeded (engine operation may still complete under lease)', {});
}

// Stop awaiting when the response deadline fires. This does not cancel p.
function raceResponseDeadline<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(deadlineError());
  return new Promise<T>((resolve, reject) => {
    const onDeadline = () => reject(deadlineError());
    signal.addEventListener('abort', onDeadline, { once: true });
    p.then(
      (v) => { signal.removeEventListener('abort', onDeadline); resolve(v); },
      (e) => { signal.removeEventListener('abort', onDeadline); reject(e); },
    );
  });
}

export const handler: ToolHandler<LaneInputT> = async (input, deps) => {
  if (deps.signal.aborted) throw deadlineError();
  // The SDK registers a raw Zod shape, so enforce cross-field operation
  // contracts again at the handler boundary with the refined LaneInput schema.
  const parsed = LaneInput.safeParse(input);
  if (!parsed.success) {
    throw new SidecoachToolError('INVALID_INPUT', 'invalid sidecoach_lane operation input', {
      issues: parsed.error.issues.map((issue) => issue.message),
    });
  }
  const request = parsed.data;
  const projectPath = request.projectPath ? request.projectPath : resolveProjectRoot();
  const engine = createExecutionEngine();

  switch (request.operation) {
    case 'start': {
      const result = await raceResponseDeadline(
        engine.startLane(request.laneId as string, request.target ?? '', { projectPath }, request.startRequestId as string),
        deps.signal,
      );
      return { data: { result }, summary: `sidecoach_lane start: ${result.laneId} @ ${result.checkpointId}` };
    }
    case 'advance': {
      const transition: any = {
        action: request.action,
        expectedRevision: request.expectedRevision as number,
      };
      if (request.report !== undefined) transition.report = request.report;
      if (request.reason !== undefined) transition.reason = request.reason;
      const result = await raceResponseDeadline(
        engine.advanceLane(projectPath, request.checkpointId as string, transition),
        deps.signal,
      );
      return { data: { result }, summary: `sidecoach_lane advance(${request.action}): rev ${result.revision}` };
    }
    case 'status': {
      const result = engine.laneStatus(projectPath, request.checkpointId as string);
      return { data: { result }, summary: `sidecoach_lane status: ${result.lifecycle} @ rev ${result.revision}` };
    }
    case 'list': {
      const result = engine.listLanes(projectPath, { all: !!request.all });
      return { data: { count: result.length, lanes: result }, summary: `sidecoach_lane list: ${result.length} lane(s)` };
    }
    default:
      throw new SidecoachToolError('INTERNAL_ERROR', `unknown lane operation: ${String((request as any).operation)}`, {});
  }
};
```

Register it in `mcp-server/src/tools/index.ts`: add `import * as lane from './lane';` and append `{ definition: lane.definition, handler: lane.handler },` to `TOOLS` (after `getFlowMetadata`).

Add `{ name: 'sidecoach_lane', args: { operation: 'list' } }` to the valid-call array in `mcp-server/__tests__/integration/in-memory.test.ts`. Add `['sidecoach_lane', { operation: 'list' }]` to the live subprocess call array and required-tool assertions in `mcp-server/__tests__/integration/stdio.test.ts`. Add this request to `mcp-server/__tests__/smoke.sh`:

```bash
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"sidecoach_lane","arguments":{"operation":"list"}}}
```

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
  let revision = 0;
  let servedVerb = '';
  let nextServedVerb = '';

  await test('start a sequence lane returns a checkpoint + first step', async () => {
    const r = await handler(
      { operation: 'start', laneId: 'lane_build', target: 'the landing page', projectPath: project, startRequestId: 'e2e-1' } as any,
      deps,
    );
    const res = (r.data as any).result;
    assert.strictEqual(res.laneId, 'lane_build');
    assert.strictEqual(res.executionKind, 'sequence');
    assert.ok(res.checkpointId && res.checkpointId.length > 0);
    assert.ok(res.currentVerb, 'start must serve the first step');
    checkpointId = res.checkpointId;
    revision = res.revision;
    servedVerb = res.currentVerb;
  });

  await test('advance completes the served step with a valid report and serves the next step', async () => {
    const report = {
      stepId: servedVerb,
      iteration: 0,
      reportId: 'e2e-report-1',
      verb: servedVerb,
      summary: 'completed by MCP e2e',
      evidence: [{ kind: 'note', detail: 'e2e evidence' }],
    };
    const r = await handler(
      { operation: 'advance', checkpointId, projectPath: project, action: 'complete', expectedRevision: revision, report } as any,
      deps,
    );
    const res = (r.data as any).result;
    assert.strictEqual(res.checkpointId, checkpointId);
    assert.ok(res.currentVerb, 'advance must serve the next step');
    assert.notStrictEqual(res.currentVerb, servedVerb);
    nextServedVerb = res.currentVerb;
    revision = res.revision;
  });

  await test('status reads the checkpoint back', async () => {
    const r = await handler({ operation: 'status', checkpointId, projectPath: project } as any, deps);
    const res = (r.data as any).result;
    assert.strictEqual(res.checkpointId, checkpointId);
    assert.strictEqual(res.laneId, 'lane_build');
    assert.strictEqual(res.lifecycle, 'in_progress');
    assert.strictEqual(res.currentVerb, nextServedVerb);
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

- [ ] **Step 6: Run the new lane integration module directly**

Run: `cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server && npx ts-node -e "require('./__tests__/integration/lane-tool-e2e.test').run()" 2>&1 | tail -25`
Expected: PASS for `lane-tool-e2e.test.ts` (5 cases), including a real `advance` with a valid `StepReport` that observes the next served step. If `start` throws a release-floor/policy error, confirm `lane_build` is `executionKind: sequence` in `claude/hooks/sidecoach-lanes.json` and the engine `lanes.generated.ts`; loop lanes require convergence preflight and must not be used here.

- [ ] **Step 7: Run source-level checks and keep the cutover uncommitted**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npx tsc --noEmit
npm run test:unit 2>&1 | tail -20
npm run test:fault 2>&1 | tail -20
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: source-level checks are green. Do not build dist or commit yet; Task 8 performs the mandatory pre-dist gate, builds the runtime, runs the full suite including stdio, and commits the whole surface atomically.

---

## Task 8: Pre-dist migration audit, docs, and zero-reference gate

**Files:**
- Audit exact caller files already migrated atomically in Tasks 4 and 5:
  - `mcp-server/__tests__/unit/tools.test.ts`
  - `mcp-server/__tests__/unit/schemas.test.ts`
  - `mcp-server/__tests__/integration/in-memory.test.ts`
  - `mcp-server/__tests__/integration/stdio.test.ts`
  - `mcp-server/__tests__/fault-injection/registry-missing.test.ts`
  - `mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts`
  - `mcp-server/__tests__/smoke.sh`
- Audit every typed `RegistryBundle` construction:
  - `mcp-server/__tests__/unit/tools.test.ts`
  - `mcp-server/__tests__/fault-injection/python-repl-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/state-store-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts`
- Audit every direct handler-dependency fixture:
  - `mcp-server/__tests__/unit/tools.test.ts`
  - `mcp-server/__tests__/unit/classify-intent.test.ts`
  - `mcp-server/__tests__/unit/list-lanes.test.ts`
  - `mcp-server/__tests__/unit/lane-tool.test.ts`
  - `mcp-server/__tests__/integration/lane-tool-e2e.test.ts`
  - `mcp-server/__tests__/fault-injection/python-repl-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/state-store-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts`
  - `mcp-server/__tests__/fault-injection/registry-missing.test.ts`
  - `mcp-server/__tests__/fault-injection/validator-throw.test.ts`
- Modify before the gate: `mcp-server/README.md`, `mcp-server/DESIGN.md`, `mcp-server/__tests__/integration/stdio-transcript.txt`, `mcp-server/__tests__/SMOKE_TRANSCRIPT.txt`

This is the mandatory pre-dist gate. It runs before `npm run build` regenerates `mcp-server/dist`, so a missed source, test, docs, transcript, typed bundle, direct handler dependency, deleted tool name, or deleted cheatsheet `modes` section fails here rather than shipping.

- [ ] **Step 1: Audit tools.test.ts**

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
- Confirm every other `deps` literal includes `signal: new AbortController().signal` and every registry literal includes `lanes`/`intent`.

- [ ] **Step 2: Audit in-memory.test.ts and stdio.test.ts**

In `mcp-server/__tests__/integration/in-memory.test.ts` the call subset (lines ~54-56) becomes:

```typescript
      { name: 'sidecoach_list_lanes', args: {} },
      { name: 'sidecoach_classify_intent', args: { prompt: 'polish the homepage' } },
      { name: 'sidecoach_lane', args: { operation: 'list' } },
```
and the empty-input rejection case (lines ~104-114) changes the tool name to `sidecoach_classify_intent` with `arguments: { prompt: '' }`. The `tools/list === TOOL_NAMES` assertion needs no edit.

In `mcp-server/__tests__/integration/stdio.test.ts`, confirm both deleted tools and `{ section: 'modes' }` are gone, and the live subprocess invokes `sidecoach_list_lanes`, `sidecoach_classify_intent`, `sidecoach_lane`, and cheatsheet `{ section: 'lanes' }`.

- [ ] **Step 3: Audit every fault-injection fixture**

In `mcp-server/__tests__/fault-injection/registry-missing.test.ts`:
- Every stubbed `registries` object (lines ~18-58) gains `lanes: null, intent: null` (and `flows: [], cheatsheet: null` if absent).
- Rename the `list_modes still works...` test to target `sidecoach_list_lanes` and invert it: with `lanes: null` the handler throws DOWNSTREAM_UNAVAILABLE (no fallback). Add a sibling case proving the server still BOOTS with `lanes: null` (no throw at build time).

In `mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts`:
- Replace the `list_modes` liveness probe (lines ~85-86) with `sidecoach_list_lanes` (`arguments: {}`).

Confirm `python-repl-faults.test.ts`, `state-store-faults.test.ts`, and `ast-grep-faults.test.ts` each have `lanes: null, intent: null` in `NULL_REG` and `signal: new AbortController().signal` in `deps()`. Confirm every direct handler call in `validator-throw.test.ts` and `registry-missing.test.ts` supplies `signal`. Confirm the new direct-handler fixtures `classify-intent.test.ts`, `list-lanes.test.ts`, `lane-tool.test.ts`, and `lane-tool-e2e.test.ts` also supply the same complete dependency shape.

- [ ] **Step 4: Audit smoke.sh**

In `mcp-server/__tests__/smoke.sh`, change the two tool calls (lines 30-31):

```bash
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"sidecoach_list_lanes","arguments":{}}}
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"sidecoach_classify_intent","arguments":{"prompt":"please polish the homepage"}}}
```

- [ ] **Step 5: Update docs and transcript references before dist**

In `mcp-server/README.md`:
- Rename `sidecoach_list_modes` to `sidecoach_list_lanes` and document the six lanes.
- Rename `sidecoach_resolve_keyword` to `sidecoach_classify_intent`, its `prompt` input, and seven-outcome union.
- Add `sidecoach_lane` with required caller-supplied `startRequestId`, all four operations, complete `StepReport`, skip `reason`, and response-deadline semantics.

In `mcp-server/DESIGN.md`:
- Replace the deleted tool names, add the three new tools to inventory, and describe lane/intent registry loading.
- State that the MCP signal is passed to handlers as a response deadline; it stops awaiting and returns TIMEOUT, while an already-started lane engine operation continues under its own lease/heartbeat.

In `mcp-server/__tests__/integration/stdio-transcript.txt` and `mcp-server/__tests__/SMOKE_TRANSCRIPT.txt`, remove every deleted tool-name and cheatsheet `{ section: "modes" }` reference, replace them with the new calls already present in `stdio.test.ts` and `smoke.sh`, and include a `sidecoach_lane` list call. Task 9 regenerates the stdio transcript after the new dist exists; this pre-dist edit exists so stale committed transcript content cannot bypass the zero-reference gate.

- [ ] **Step 6: Run the mandatory repo-wide pre-dist zero-reference gate**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
rg -n 'sidecoach_resolve_keyword|sidecoach_list_modes' . --glob '!dist/**'
rg -n "[\"']?section[\"']?[[:space:]]*[:=][[:space:]]*[\"']modes[\"']" . --glob '!dist/**'
```
Expected: both commands print no matches and exit 1. Any match is a failed gate; migrate it before running any dist build.

Also confirm the complete fixture inventories:

```bash
rg -n 'RegistryBundle' __tests__ --glob '*.ts'
rg -n '\{ logger: silentLogger\(\), registries:|return \{ logger: silentLogger\(\), registries:' __tests__ --glob '*.ts'
```
Expected: typed constructions occur only in the four files enumerated above and include `lanes`/`intent`; every direct-handler dependency fixture includes `signal`.

- [ ] **Step 7: Regenerate dist only after the gate, then run all suites**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npm run build
rm -f dist/tools/resolve-keyword.* dist/tools/list-modes.*
npx tsc --noEmit && npm test 2>&1 | tail -25
cd /Users/spare3/Documents/Github/improv/sidecoach
npm test 2>&1 | tail -15
```
Expected: this is the first mcp-server dist regeneration after the zero-reference gate; `tsc` is clean; mcp-server including live stdio ends with `0 failed`; engine ends with `run-tests: NN suite(s) passed`.

- [ ] **Step 8: Stage the atomic cutover with explicit paths and commit green**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add parity/classifier-corpus.json \
  mcp-server/src/registries.ts mcp-server/src/keyword-resolver.ts mcp-server/src/schemas.ts \
  mcp-server/src/server.ts mcp-server/src/tools/types.ts mcp-server/src/tools/index.ts \
  mcp-server/src/tools/get-cheatsheet.ts mcp-server/src/tools/classify-intent.ts \
  mcp-server/src/tools/list-lanes.ts mcp-server/src/tools/lane.ts \
  mcp-server/src/__tests__/classifier-parity.test.ts \
  mcp-server/__tests__/unit/registries-lane.test.ts mcp-server/__tests__/unit/intent-eligible.test.ts \
  mcp-server/__tests__/unit/classify-intent.test.ts mcp-server/__tests__/unit/list-lanes.test.ts \
  mcp-server/__tests__/unit/lane-tool.test.ts mcp-server/__tests__/unit/server-signal.test.ts \
  mcp-server/__tests__/unit/tools.test.ts mcp-server/__tests__/unit/schemas.test.ts \
  mcp-server/__tests__/integration/in-memory.test.ts mcp-server/__tests__/integration/stdio.test.ts \
  mcp-server/__tests__/integration/lane-tool-e2e.test.ts \
  mcp-server/__tests__/fault-injection/registry-missing.test.ts \
  mcp-server/__tests__/fault-injection/timeout-and-concurrency.test.ts \
  mcp-server/__tests__/fault-injection/python-repl-faults.test.ts \
  mcp-server/__tests__/fault-injection/state-store-faults.test.ts \
  mcp-server/__tests__/fault-injection/ast-grep-faults.test.ts \
  mcp-server/__tests__/fault-injection/validator-throw.test.ts \
  mcp-server/__tests__/smoke.sh mcp-server/README.md mcp-server/DESIGN.md \
  mcp-server/__tests__/integration/stdio-transcript.txt \
  mcp-server/__tests__/SMOKE_TRANSCRIPT.txt
git add -u mcp-server/src/tools/resolve-keyword.ts mcp-server/src/tools/list-modes.ts

git add \
  mcp-server/dist/keyword-resolver.js mcp-server/dist/keyword-resolver.js.map \
  mcp-server/dist/keyword-resolver.d.ts mcp-server/dist/keyword-resolver.d.ts.map \
  mcp-server/dist/registries.js mcp-server/dist/registries.js.map \
  mcp-server/dist/registries.d.ts mcp-server/dist/registries.d.ts.map \
  mcp-server/dist/schemas.js mcp-server/dist/schemas.js.map \
  mcp-server/dist/schemas.d.ts mcp-server/dist/schemas.d.ts.map \
  mcp-server/dist/server.js mcp-server/dist/server.js.map \
  mcp-server/dist/server.d.ts mcp-server/dist/server.d.ts.map \
  mcp-server/dist/tools/types.js mcp-server/dist/tools/types.js.map \
  mcp-server/dist/tools/types.d.ts mcp-server/dist/tools/types.d.ts.map \
  mcp-server/dist/tools/index.js mcp-server/dist/tools/index.js.map \
  mcp-server/dist/tools/index.d.ts mcp-server/dist/tools/index.d.ts.map \
  mcp-server/dist/tools/get-cheatsheet.js mcp-server/dist/tools/get-cheatsheet.js.map \
  mcp-server/dist/tools/get-cheatsheet.d.ts mcp-server/dist/tools/get-cheatsheet.d.ts.map \
  mcp-server/dist/tools/classify-intent.js mcp-server/dist/tools/classify-intent.js.map \
  mcp-server/dist/tools/classify-intent.d.ts mcp-server/dist/tools/classify-intent.d.ts.map \
  mcp-server/dist/tools/list-lanes.js mcp-server/dist/tools/list-lanes.js.map \
  mcp-server/dist/tools/list-lanes.d.ts mcp-server/dist/tools/list-lanes.d.ts.map \
  mcp-server/dist/tools/lane.js mcp-server/dist/tools/lane.js.map \
  mcp-server/dist/tools/lane.d.ts mcp-server/dist/tools/lane.d.ts.map
git add -u \
  mcp-server/dist/tools/resolve-keyword.js mcp-server/dist/tools/resolve-keyword.js.map \
  mcp-server/dist/tools/resolve-keyword.d.ts mcp-server/dist/tools/resolve-keyword.d.ts.map \
  mcp-server/dist/tools/list-modes.js mcp-server/dist/tools/list-modes.js.map \
  mcp-server/dist/tools/list-modes.d.ts mcp-server/dist/tools/list-modes.d.ts.map

git diff --cached --check
git diff --cached --name-only
git commit -m "feat(lane-p4d): atomically migrate model-facing MCP lane surface"
```
Expected: staged paths contain only the explicitly named P4d source, tests, docs, transcripts, parity corpus, and dist allowlist; no unrelated dirty dist path is staged; both suites were green immediately before this commit.

---

## Task 9: Dist build, transcript regeneration, explicit staging, and full verification

**Files:**
- Regenerate: `mcp-server/__tests__/integration/stdio-transcript.txt`
- Modify: `mcp-server/__tests__/SMOKE_TRANSCRIPT.txt`
- Build + stage only the explicit `mcp-server/dist` allowlist below

`stdio-transcript.txt` is written by `stdio.test.ts`, so running the integration test regenerates it with the new tool list. `SMOKE_TRANSCRIPT.txt` is recaptured from `smoke.sh`. The working tree already contains unrelated dist changes, so never run `git add mcp-server/dist`; stage only the named files produced by P4d.

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
Expected: the grep returns 0 and the transcript contains the new calls from `smoke.sh`.

- [ ] **Step 3: Re-run the repo-wide zero-reference gate after transcript regeneration**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
rg -n 'sidecoach_resolve_keyword|sidecoach_list_modes' . --glob '!dist/**'
rg -n "[\"']?section[\"']?[[:space:]]*[:=][[:space:]]*[\"']modes[\"']" . --glob '!dist/**'
```
Expected: both commands print no matches and exit 1.

- [ ] **Step 4: Confirm stale deleted-tool artifacts remain absent**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
npm run build
ls dist/tools/classify-intent.js dist/tools/list-lanes.js dist/tools/lane.js
```
Expected: the three new `dist/tools/*.js` exist. The Task 8 atomic cutover explicitly deleted the stale artifacts; verify a later build did not recreate them:

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach/mcp-server
test ! -e dist/tools/resolve-keyword.js
test ! -e dist/tools/list-modes.js
```
Expected: both `test` commands exit 0.

- [ ] **Step 5: Full verification - both runners + computed parity + corpus union + dash/NUL scan**

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

The engine runner's `classifier-parity.test.ts` must also print the computed-eligibility pass for every shared corpus row. This is the constructive parity assertion from Task 2; it verifies declared classifier outcomes, not equality between computed and declared eligibility booleans.

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

- [ ] **Step 6: Stage only the exact generated dist allowlist**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git add mcp-server/__tests__/integration/stdio-transcript.txt mcp-server/__tests__/SMOKE_TRANSCRIPT.txt

git add \
  mcp-server/dist/keyword-resolver.js mcp-server/dist/keyword-resolver.js.map \
  mcp-server/dist/keyword-resolver.d.ts mcp-server/dist/keyword-resolver.d.ts.map \
  mcp-server/dist/registries.js mcp-server/dist/registries.js.map \
  mcp-server/dist/registries.d.ts mcp-server/dist/registries.d.ts.map \
  mcp-server/dist/schemas.js mcp-server/dist/schemas.js.map \
  mcp-server/dist/schemas.d.ts mcp-server/dist/schemas.d.ts.map \
  mcp-server/dist/server.js mcp-server/dist/server.js.map \
  mcp-server/dist/server.d.ts mcp-server/dist/server.d.ts.map \
  mcp-server/dist/tools/types.js mcp-server/dist/tools/types.js.map \
  mcp-server/dist/tools/types.d.ts mcp-server/dist/tools/types.d.ts.map \
  mcp-server/dist/tools/index.js mcp-server/dist/tools/index.js.map \
  mcp-server/dist/tools/index.d.ts mcp-server/dist/tools/index.d.ts.map \
  mcp-server/dist/tools/get-cheatsheet.js mcp-server/dist/tools/get-cheatsheet.js.map \
  mcp-server/dist/tools/get-cheatsheet.d.ts mcp-server/dist/tools/get-cheatsheet.d.ts.map \
  mcp-server/dist/tools/classify-intent.js mcp-server/dist/tools/classify-intent.js.map \
  mcp-server/dist/tools/classify-intent.d.ts mcp-server/dist/tools/classify-intent.d.ts.map \
  mcp-server/dist/tools/list-lanes.js mcp-server/dist/tools/list-lanes.js.map \
  mcp-server/dist/tools/list-lanes.d.ts mcp-server/dist/tools/list-lanes.d.ts.map \
  mcp-server/dist/tools/lane.js mcp-server/dist/tools/lane.js.map \
  mcp-server/dist/tools/lane.d.ts mcp-server/dist/tools/lane.d.ts.map

git diff --cached --name-only
```

Expected: staged paths are only the two transcript files and any changed subset of the 40 explicitly allowed dist files. Normally all dist paths are already committed by Tasks 4-7, so only regenerated transcripts appear. Some declaration-only source changes may leave their `.js` output byte-identical, so unchanged allowlisted files do not appear. No `dist/__tests__`, validator dist output, or other pre-existing dirty dist path is staged.

- [ ] **Step 7: Verify staged scope and commit green**

```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
git diff --cached --check
cd mcp-server
npx tsc --noEmit && npm test 2>&1 | tail -15
cd ..
npm test 2>&1 | tail -15
if git diff --cached --quiet; then
  echo "no final artifact delta"
else
  git commit -m "dist(lane-p4d): refresh verified MCP lane artifacts"
fi
```
Expected: `git diff --cached --check` prints no errors; both suites are green; either `no final artifact delta` prints or a final artifact-only commit is created with no unrelated dist changes.

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
- Parity stops before delivery state; hook maps NUDGE_ELIGIBLE to NUDGE/SILENT -> preserved by not touching cooldown delivery. Task 2 faithfully ports production-hook eligibility behavior and proves every shared corpus row still reaches its declared classifier outcome with computed eligibility.
- Phrase-parser resolution is a SEPARATE union (section 10) -> `slash-command-router.ts` `PhraseResolution` (`ROUTE|CLASSIFY|OUT_OF_SCOPE|UNKNOWN`) is the engine's concern and is untouched; the MCP classifier union and the phrase parser union stay distinct (parser UNKNOWN never conflated with classifier SILENT). No MCP change needed.
- `sidecoach_lane` mirrors all four monitor lane operations -> Task 7.
- `list-modes.ts -> list-lanes.ts`; `schemas.ts`, `tools/index.ts`, `get-cheatsheet.ts`; README/DESIGN; all test tiers + transcripts; dist -> Tasks 3, 5, 8, 9.
- AbortSignal propagation into tool handlers (server.ts, tools/types.ts) -> Task 6; used truthfully as a response deadline at the lane-tool boundary, without claiming engine cancellation -> Task 7.

**2. Placeholder scan:** every code step shows complete code; every command shows expected output. No "TBD", no "add error handling", no "similar to Task N". The two doc tasks (README/DESIGN) describe exact renames + the new section's required content rather than pasting full prose, which is appropriate for prose-only files with a verifiable grep gate.

**3. Type consistency:** `LaneRegistryBundle { registry, sourcePath }` (Task 1) is consumed as `deps.registries.lanes.registry` in Tasks 4/5. `ToolDependencies.signal: AbortSignal` (Task 6) is consumed as `deps.signal` in Task 7. `classifyIntentShape`/`listLanesShape`/`laneShape` + their `*InputT` types (Task 3) match the tool `definition.inputSchema`/handler input types (Tasks 4/5/7). Engine method signatures used in Task 7 match the orchestrator: `startLane(laneId, target, {projectPath}, startRequestId)`, `advanceLane(projectPath, checkpointId, transition)`, `laneStatus(projectPath, checkpointId)`, `listLanes(projectPath, {all})`. `intentEligible(prompt, intentReg)` (Task 2) is called with `deps.registries.intent` (Task 4). `TOOL_INPUT_SCHEMAS` keys (`sidecoach_classify_intent`/`sidecoach_list_lanes`/`sidecoach_lane`) match the tool `definition.name`s.

## v2 revision notes

P1-1 is closed by the exact production-hook sanitizer and nine informational frames plus shared-corpus divergence and computed-outcome parity tests; P1-2 is closed by migrating `stdio.test.ts`, the unit cheatsheet `modes` case, and a mandatory pre-dist zero-reference gate; P1-3 is closed by enumerating and migrating every typed `RegistryBundle` construction and direct handler-dependency fixture; P1-4 is closed by defining the signal as a response deadline while engine work continues under its lease; P1-5 is closed by requiring caller-supplied `startRequestId`, strict complete `StepReport` and skip `reason` validation, and a real advance e2e; P1-6 is closed by an explicit dist staging allowlist; P2-1 is closed by atomic caller/deletion commits and full green-suite gates before every commit; P2-2 is closed by the `buildServer` plus in-memory-client handler probe.
