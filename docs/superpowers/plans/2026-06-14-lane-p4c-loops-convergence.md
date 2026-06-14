# Lane P4c - Loop Execution + Convergence Release Floor Implementation Plan - v1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `lane_converge` LOOP lane actually run - walk its verb steps once per iteration, gate each iteration boundary on the lane policy's required product validators exactly once, close as `converged` only when all required validators are clean (a persisted, reproducible decision), and rename the orphan `ralph-loop.ts` diagnostic module to `convergence-loop.ts` with its truthful-convergence semantic fix.

**Architecture:** Build the loop iteration-boundary mechanism inside the existing P2/P4b-1 lane engine (`lane-runner.ts`). Loop lanes reuse the P4b-1 CLAIM/EXECUTE/FINALIZE lease+heartbeat protocol and the P4a clean-evaluator/validators verbatim - this phase adds only the loop control flow and the convergence sub-state. A loop verb step completes ADVISORY (no per-step validator gate); validators run ONLY at the iteration boundary via the explicit `LaneValidationPolicy` (the release floor), so the same validator is never run twice. Convergence is persisted in the checkpoint so a clean decision is reproducible from persisted inputs and never claimed without the required validators actually clean.

**Tech Stack:** TypeScript (CommonJS, `ts-node`), Node `crypto` (sha256 signatures), the sidecoach `LaneCheckpointStore` (JSON checkpoints + `proper-lockfile`), the scoped `npm test` runner (`scripts/run-tests.ts`). No new dependencies.

---

## Background the implementer needs

This phase builds on MERGED code. Read these before starting:

- **Spec:** `docs/superpowers/specs/2026-06-12-sidecoach-lane-intent-detection-design.md`
  - Section 7 lines 322-365 (completion contract; the LOOP iteration boundary at 355-365).
  - Section 9 lines 900-1011 (release floor, derived loop membership, truthful convergence, policy-wide phase-aware preflight).
  - Section 9 lines 1121-1199 (semantic rules: product-validator failure can no longer converge; the persisted `convergence` sub-state; the progress signature is the full required-state tuple, not findings-only; the GENERATED-from-coverage closing summary).
  - Blast radius lines 1262-1263 (`ralph-loop.ts` -> `convergence-loop.ts` + the t20 rename AND expectation fix).

- **Key MERGED files (do NOT reimplement their internals):**
  - `sidecoach/src/lane-runner.ts` - `startLane` currently REJECTS loop lanes at line 165-167 (the throw you remove). `advanceLane` `case 'complete'` (line 401-477) is the SEQUENCE per-step gate via `runStepValidators`+`validatorsForStep`; `skipStep` (line 570-588) and `transitionNonComplete` (line 488-543) are the other transitions. The lease helpers `claimLease`/`finalizeLease`/`refreshHeartbeat`/`leaseIsLive`/`publishOutbox` and the module-private `LIVE_OPERATIONS`/`leaseKey`/`startHeartbeatLoop`/`runStepValidators`/`buildStepResult`/`closedResult`/`defaultOperationId` are all reused as-is.
  - `sidecoach/src/lane-checkpoint-store.ts` - `LaneCheckpoint` already carries `cursor`/`iteration`; `migrate()` (line 50-59) tolerates older v2 missing sub-fields by spreading `...raw`. Schema stays version 2 (the new `convergence` field is additive and optional - no version bump, no new migration branch).
  - `sidecoach/src/lane-types.ts` - `LaneOutcome` already includes `'converged'`; `GateStatus` is `clean|findings|inconclusive|error`; `LaneStepResult.gate` is the existing validator surface.
  - `sidecoach/src/lane-validators.ts` - `validatorsForStep` (sequence per-step union), `aggregateWorstStatus`, `mapGateStatusToOutcome`.
  - `sidecoach/src/flow-validation-capabilities.ts` - `LANE_POLICIES` already declares `lane_converge` with `requiredProductValidatorIds: ['polish-standard','theming','anti-pattern','static-a11y']`; `VALIDATOR_REGISTRATIONS` wires each to `makeProductValidator`. `getValidatorRegistration` exists; `getLanePolicy` does NOT yet (Task 2 adds it).
  - `sidecoach/src/clean-evaluator.ts` + `sidecoach/src/validators/run-validator.ts` (`makeProductValidator`, `runValidatorForTest`) + `sidecoach/src/validators/project-collector.ts` (`collectFromPath`) + `sidecoach/src/validators.generated.ts` (`GENERATED_VALIDATORS[*].cleanPolicy.requiredCoverageByScope`) - the P4a floor. REUSE, do not touch their logic.
  - `sidecoach/src/lanes.generated.ts` - `lane_converge` is `executionKind:'loop'`, verbChain `polish -> audit -> critique`, three verbSteps. `getLane(id)` is exported. (`lane_calm` is `executionKind:'sequence'` - UNAFFECTED by this phase.)
  - `sidecoach/src/ralph-loop.ts` + `sidecoach/src/__tests__/t20-ralph-loop.test.ts` - the orphan diagnostic loop to rename (no production importer; only the test imports it, plus a stale path comment in the frozen `src/modes.ts:151`).

- **Spec ambiguities resolved in this plan (see also the report to team-lead):**
  1. **No double-run (boundary vs per-step gate).** In a loop lane, per-step `complete`/`skip` NEVER call `validatorsForStep` - they are advisory advances. The four required validators run ONLY at the iteration boundary via the lane policy. `polish-standard` (flowJ's flow binding) therefore runs exactly once per iteration, at the boundary, never mid-iteration. This is structural, matching spec line 958.
  2. **The persisted required-state signature** is a sha256 over the per-required-validator tuple `{validatorId, status, failedRuleIds[], inconclusiveRuleIds[], coverageGapIdentities[], validatorErrorCategory, ruleErrorCategories[]}` using stable identities only (canonical rule keys, gap identities, normalized error categories), sorted; never free-text messages or advisory output (spec lines 1155-1167).
  3. **`lane_calm` is SEQUENCE, not loop** (`lanes.generated.ts`), so it is unaffected; only `lane_converge` is a loop lane in the current registry.

- **Test harness style:** Lane suites are plain `ts-node` scripts that throw on failure (uncaught -> nonzero exit) and print `OK` on success. Each new suite is registered in `sidecoach/scripts/run-tests.ts` with `required: true` and run via `npm test` (cwd `sidecoach/`). Engine unit tests STUB `deps.runValidator` (return a hand-built `ProductValidationResult`) exactly like `lane-runner-advance-sequence.test.ts` - they never need real validators or fixtures. Baseline today is 33 required suites; this phase adds 10 (final 43).

- **Hard constraints:** path-specific `git add` in every commit (NEVER `git add -A`). Do not commit (the team-lead merges). Honest convergence: never set `outcome='converged'` unless every required validator returned `clean`. Trace every new symbol to a caller in the same task.

---

## File Structure

**New files:**
- `sidecoach/src/lane-convergence.ts` - pure module: `RequiredValidatorState` derivation, `computeRequiredStateSignature`, `evaluateBoundary`, `decideProgress`, `seedConvergenceState`, the `DEFAULT_LOOP_*` limits. No IO. (Task 3)
- `sidecoach/src/lane-convergence-preflight.ts` - `convergencePreflight(projectPath, laneId)`: static coverage-plan satisfiability check (reuses `collectFromPath` + `GENERATED_VALIDATORS`). IO at the orchestrator layer only. (Task 8)
- `sidecoach/src/convergence-loop.ts` - renamed from `ralph-loop.ts` with the truthful-convergence semantic fix. (Task 10)
- 10 new test suites under `sidecoach/src/__tests__/` (one per task), all registered `required:true`.
- `sidecoach/src/__tests__/fixtures/convergence/clean/` - a CSS+HTML fixture that reaches `clean` on all four required validators (Task 9).

**Modified files:**
- `sidecoach/src/lane-types.ts` - add `ConvergenceOutcome`, `RequiredValidatorState`, `ConvergenceIterationRecord`, `ConvergenceState`; add optional `convergence?` to `LaneStepResult`. (Task 1)
- `sidecoach/src/lane-checkpoint-store.ts` - add optional `convergence?: ConvergenceState` to `LaneCheckpoint`. (Task 1)
- `sidecoach/src/lane-validators.ts` - add `isLoopLane`, `requiredValidatorsForLane`. (Task 2)
- `sidecoach/src/flow-validation-capabilities.ts` - add `getLanePolicy`. (Task 2)
- `sidecoach/src/lane-runner.ts` - remove the loop rejection + minimal preflight + seed convergence (Task 4); `completeLoopStep` + `runIterationBoundary` + `loopSkipStep` + `applyConvergence` + `convergenceSurface` + dispatch wiring (Tasks 5-7).
- `sidecoach/src/sidecoach-orchestrator.ts` - call `convergencePreflight` for loop lanes in `startLane` (Task 8).
- `sidecoach/scripts/run-tests.ts` - register each new suite `required:true` (every task).
- `sidecoach/src/__tests__/t20-ralph-loop.test.ts` -> renamed `t20-convergence-loop.test.ts` with the Section 8 expectation fix (Task 10).

---

## Setup

- [ ] **Step 1: Branch from main**

Run:
```bash
cd /Users/spare3/Documents/Github/improv
git checkout main
git checkout -b lane-p4c-loops-convergence
```
Expected: `Switched to a new branch 'lane-p4c-loops-convergence'`

- [ ] **Step 2: Establish the green baseline (33 suites)**

Run:
```bash
cd /Users/spare3/Documents/Github/improv/sidecoach && npm test
```
Expected final line: `run-tests: 33 suite(s) passed` (exit 0). If not green, STOP and report - do not build on a red baseline.

- [ ] **Step 3: Confirm the ASCII / no-dash discipline for plan-adjacent edits**

Run (from repo root):
```bash
python3 - <<'PY'
import sys
p='docs/superpowers/plans/2026-06-14-lane-p4c-loops-convergence.md'
b=open(p,'rb').read()
bad=[c for c in (0x2013,0x2014,0x2012,0x2015,0x2212) if chr(c).encode('utf-8') in b]
print('NUL' , b.count(b'\x00'))
print('dash-codepoints', bad)
PY
```
Expected: `NUL 0` and `dash-codepoints []`. (Run this same check on any new source file before committing - the content guard blocks unicode dashes.)

---

## Task 1: Convergence state types + checkpoint and result fields

**Files:**
- Modify: `sidecoach/src/lane-types.ts`
- Modify: `sidecoach/src/lane-checkpoint-store.ts:9-27` (the `LaneCheckpoint` interface)
- Test: `sidecoach/src/__tests__/lane-convergence-types.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-convergence-types.test.ts`:
```ts
// Task 1: convergence sub-state types + checkpoint round-trip (additive, schema v2).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore, LaneCheckpoint } from '../lane-checkpoint-store';
import type { ConvergenceState } from '../lane-types';

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-types-'));
  const store = new LaneCheckpointStore(proj);

  const conv: ConvergenceState = {
    outcome: 'running', iteration: 0, signatures: [], consecutiveNoProgress: 0,
    limits: { maxIterations: 10, maxNoProgress: 3 },
    history: [], findings: [], validatorErrors: [], advisoryRuns: [],
    measuredScope: [], unverifiedScope: [],
  };
  const cp: LaneCheckpoint = {
    schemaVersion: 2, checkpointId: 'cp-conv', laneId: 'lane_converge', target: 'project',
    executionKind: 'loop', lifecycle: 'in_progress', outcome: undefined,
    cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
    stepReports: [], audit: [], servedSteps: {}, revision: 1, startRequestId: 'req',
    seenReportIds: [], fencingCounter: 1, sideEffectOutbox: [], stepGateStatuses: {},
    lease: null, convergence: conv, createdAt: 't', updatedAt: 't',
  };
  store.write(cp);
  const back = store.read('cp-conv');
  if (!back.convergence) throw new Error('convergence sub-state must round-trip');
  if (back.convergence.outcome !== 'running') throw new Error('convergence.outcome lost');
  if (back.convergence.limits.maxNoProgress !== 3) throw new Error('limits lost');

  // Regression: a SEQUENCE checkpoint with NO convergence still reads (additive field).
  const seq: LaneCheckpoint = { ...cp, checkpointId: 'cp-seq', laneId: 'lane_build', executionKind: 'sequence', convergence: undefined };
  store.write(seq);
  const seqBack = store.read('cp-seq');
  if (seqBack.convergence !== undefined) throw new Error('sequence checkpoint must have no convergence');

  console.log('lane-convergence-types: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-convergence-types.test.ts`
Expected: FAIL - TypeScript error that `ConvergenceState` is not exported / `convergence` is not a property of `LaneCheckpoint`.

- [ ] **Step 3: Add the types to `lane-types.ts`**

Append to `sidecoach/src/lane-types.ts` (after the existing `import type { ProductFinding }` line at the top, add `NormalizedErrorCategory`):
```ts
import type { ProductFinding, NormalizedErrorCategory } from './product-rule-types';
```
(Replace the existing `import type { ProductFinding } from './product-rule-types';` line.)

Append at the end of `sidecoach/src/lane-types.ts` (before the final helper exports is fine; place after `LaneInfo`):
```ts
// ---- P4c loop convergence sub-state (spec section 9 lines 1142-1167) ----------
export type ConvergenceOutcome = 'running' | 'converged' | 'stalled' | 'capped' | 'error';

// The full required-state tuple per required validator. Stable identities only
// (canonical rule keys, gap identities, normalized error categories) - never
// free-text messages, so the progress signature is reproducible.
export interface RequiredValidatorState {
  validatorId: string;
  status: GateStatus;
  failedRuleIds: string[];
  inconclusiveRuleIds: string[];
  coverageGapIdentities: string[];
  validatorErrorCategory?: NormalizedErrorCategory;
  ruleErrorCategories: string[];   // `${canonicalRuleKey}:${category}`
}

export interface ConvergenceIterationRecord {
  iteration: number;
  signature: string;
  perValidator: RequiredValidatorState[];
  measuredScope: string[];
  unverifiedScope: string[];
}

// Persisted in the checkpoint so every iteration survives process boundaries and a
// clean decision is reproducible from persisted inputs (spec lines 1138-1152). The
// LANE lifecycle/outcome lives on LaneCheckpoint; this is the LOOP result only.
export interface ConvergenceState {
  outcome: ConvergenceOutcome;
  iteration: number;
  signatures: string[];
  consecutiveNoProgress: number;
  limits: { maxIterations: number; maxNoProgress: number };
  history: ConvergenceIterationRecord[];                                  // productValidationRuns
  findings: ProductFinding[];                                            // latest boundary findings
  validatorErrors: { validatorId: string; category: NormalizedErrorCategory; message: string }[];
  advisoryRuns: { iteration: number; flowIds: FlowId[] }[];
  measuredScope: string[];
  unverifiedScope: string[];
}
```

Then add the optional surface to `LaneStepResult` (inside the interface, after the existing `gate?:` field):
```ts
  // Loop-lane convergence surface (present on a loop boundary result). The summary
  // is GENERATED from the run coverage record for a converged result (truthful).
  convergence?: {
    outcome: ConvergenceOutcome;
    iteration: number;
    signature?: string;
    findings: ProductFinding[];
    summary?: string;
  };
```

- [ ] **Step 4: Add the checkpoint field**

In `sidecoach/src/lane-checkpoint-store.ts`, add the import (extend the existing `lane-types` import on line 5):
```ts
import type { StepReport, LaneLifecycle, LaneOutcome, LaneAuditEntry, LeaseRecord, SideEffectOutboxRecord, PersistedStepGateStatus, ConvergenceState } from './lane-types';
```
Then add to the `LaneCheckpoint` interface (after `stepGateStatuses` on line 25):
```ts
  // P4c: loop convergence sub-state. Present only on loop lanes; undefined for
  // sequence lanes. Additive optional field - schema stays v2, migrate() passes it
  // through unchanged via the existing `...raw` spread.
  convergence?: ConvergenceState;
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-convergence-types.test.ts`
Expected: `lane-convergence-types: OK`

- [ ] **Step 6: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add to the `SUITES` array (after the last lane suite, before the validator suites is fine):
```ts
  { rel: 'src/__tests__/lane-convergence-types.test.ts', required: true },          // P4c convergence sub-state types
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 34 suite(s) passed`

- [ ] **Step 7: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-types.ts sidecoach/src/lane-checkpoint-store.ts sidecoach/src/__tests__/lane-convergence-types.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): add convergence sub-state types + optional checkpoint/result fields"
```

---

## Task 2: Lane policy getter + loop helpers

**Files:**
- Modify: `sidecoach/src/flow-validation-capabilities.ts` (add `getLanePolicy`)
- Modify: `sidecoach/src/lane-validators.ts` (add `isLoopLane`, `requiredValidatorsForLane`)
- Test: `sidecoach/src/__tests__/lane-converge-policy.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-converge-policy.test.ts`:
```ts
// Task 2: lane policy getter + loop helpers.
import { getLanePolicy } from '../flow-validation-capabilities';
import { isLoopLane, requiredValidatorsForLane } from '../lane-validators';

function run() {
  const policy = getLanePolicy('lane_converge');
  if (!policy) throw new Error('lane_converge must have a policy');
  const expected = ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'];
  if (JSON.stringify(policy.requiredProductValidatorIds) !== JSON.stringify(expected)) {
    throw new Error('unexpected required validators: ' + JSON.stringify(policy.requiredProductValidatorIds));
  }
  if (getLanePolicy('lane_build') !== null) throw new Error('sequence lane has no policy -> null');

  if (!isLoopLane('lane_converge')) throw new Error('lane_converge is a loop lane');
  if (isLoopLane('lane_calm')) throw new Error('lane_calm is SEQUENCE, not loop');
  if (isLoopLane('lane_build')) throw new Error('lane_build is sequence');

  const reqs = requiredValidatorsForLane('lane_converge');
  if (JSON.stringify(reqs) !== JSON.stringify(expected)) throw new Error('requiredValidatorsForLane mismatch: ' + JSON.stringify(reqs));
  // A sequence lane has no policy -> empty required set (the boundary gate never runs for it).
  if (requiredValidatorsForLane('lane_build').length !== 0) throw new Error('sequence lane -> no required loop validators');

  console.log('lane-converge-policy: OK');
}
run();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-converge-policy.test.ts`
Expected: FAIL - `getLanePolicy` / `isLoopLane` / `requiredValidatorsForLane` are not exported.

- [ ] **Step 3: Add `getLanePolicy`**

In `sidecoach/src/flow-validation-capabilities.ts`, add after `getFlowCapability` (line 89-91):
```ts
export function getLanePolicy(laneId: string): LaneValidationPolicy | null {
  return LANE_POLICIES.find((p) => p.laneId === laneId) ?? null;
}
```

- [ ] **Step 4: Add the loop helpers**

In `sidecoach/src/lane-validators.ts`, add the imports + functions:
```ts
import { getFlowCapability, getLanePolicy } from './flow-validation-capabilities';
import { getLane } from './lanes.generated';
```
(Replace the existing `import { getFlowCapability } from './flow-validation-capabilities';` line, and add the `getLane` import.)

Append at the end of `sidecoach/src/lane-validators.ts`:
```ts
// A lane runs as a loop iff its generated executionKind is 'loop'. Unknown lane -> false.
export function isLoopLane(laneId: string): boolean {
  return getLane(laneId)?.executionKind === 'loop';
}

// The required-validator gate for a LOOP lane's iteration boundary: the explicit
// LaneValidationPolicy.requiredProductValidatorIds (the release floor), in declared
// order, invoked once per boundary. Distinct from validatorsForStep (sequence per-step
// gating) - a loop lane's per-step completion is advisory and never gates, so flow-bound
// validators are NOT run twice (spec lines 355-359, 952-958). A lane without a policy
// (every sequence lane) returns [] - the boundary gate never runs for it.
export function requiredValidatorsForLane(laneId: string): string[] {
  return getLanePolicy(laneId)?.requiredProductValidatorIds ?? [];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-converge-policy.test.ts`
Expected: `lane-converge-policy: OK`

- [ ] **Step 6: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add:
```ts
  { rel: 'src/__tests__/lane-converge-policy.test.ts', required: true },            // P4c lane policy + loop helpers
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 35 suite(s) passed`

- [ ] **Step 7: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/flow-validation-capabilities.ts sidecoach/src/lane-validators.ts sidecoach/src/__tests__/lane-converge-policy.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): getLanePolicy + isLoopLane + requiredValidatorsForLane"
```

---

## Task 3: Pure convergence module (signature + boundary evaluation + progress decision)

**Files:**
- Create: `sidecoach/src/lane-convergence.ts`
- Test: `sidecoach/src/__tests__/lane-convergence.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-convergence.test.ts`:
```ts
// Task 3: pure convergence module - signature, boundary evaluation, progress decision.
import {
  toRequiredValidatorState, computeRequiredStateSignature,
  evaluateBoundary, decideProgress, seedConvergenceState,
  DEFAULT_LOOP_MAX_ITERATIONS, DEFAULT_LOOP_MAX_NO_PROGRESS,
} from '../lane-convergence';
import type { ProductValidationResult } from '../product-rule-types';

// Hand-built ProductValidationResult helpers (no real validators needed).
function clean(scope: string[] = ['s1']): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: scope, unverifiedScope: [] } };
}
function withFail(ruleKey: string): ProductValidationResult {
  return { status: 'findings',
    rules: [{ ruleId: ruleKey, canonicalRuleKey: ruleKey, status: 'fail', severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
    findings: [{ validatorId: 'polish-standard', ruleId: ruleKey, canonicalRuleKey: ruleKey, severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 1, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 1, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-x'] } };
}
function errored(): ProductValidationResult {
  return { status: 'error', normalizedErrorCategory: 'aborted', error: 'lease lost', rules: [], findings: [],
    coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } };
}

function run() {
  // --- signature: stable across validator ORDER ---
  const a = [
    { validatorId: 'theming', result: clean() },
    { validatorId: 'polish-standard', result: withFail('polish.no-transition-all') },
  ];
  const b = [a[1], a[0]];
  const sigA = computeRequiredStateSignature(a.map((x) => toRequiredValidatorState(x.validatorId, x.result)));
  const sigB = computeRequiredStateSignature(b.map((x) => toRequiredValidatorState(x.validatorId, x.result)));
  if (sigA !== sigB) throw new Error('signature must be stable across validator order');
  if (sigA.length !== 16) throw new Error('signature is 16 hex chars');

  // --- signature: changes when a failed rule changes ---
  const sigC = computeRequiredStateSignature([toRequiredValidatorState('polish-standard', withFail('polish.tabular-nums'))]);
  if (sigC === sigA) throw new Error('different failed rule keys -> different signature');

  // --- signature: a validator error category enters the signature ---
  const sigErr = computeRequiredStateSignature([toRequiredValidatorState('static-a11y', errored())]);
  const sigCleanOnly = computeRequiredStateSignature([toRequiredValidatorState('static-a11y', clean())]);
  if (sigErr === sigCleanOnly) throw new Error('error category must enter the signature');

  // --- evaluateBoundary: all clean -> converged ---
  const evClean = evaluateBoundary([
    { validatorId: 'polish-standard', result: clean(['polished-press-feedback']) },
    { validatorId: 'theming', result: clean(['theming-consistency']) },
  ]);
  if (!evClean.converged || evClean.iterationStatus !== 'clean') throw new Error('all clean -> converged');
  if (JSON.stringify(evClean.measuredScope) !== JSON.stringify(['polished-press-feedback', 'theming-consistency'].sort())) {
    throw new Error('measuredScope merged+sorted from coverage');
  }

  // --- evaluateBoundary: a fail -> not converged, worst-status findings, findings collected ---
  const evFail = evaluateBoundary([
    { validatorId: 'polish-standard', result: withFail('polish.no-transition-all') },
    { validatorId: 'theming', result: clean() },
  ]);
  if (evFail.converged) throw new Error('a fail cannot converge');
  if (evFail.iterationStatus !== 'findings') throw new Error('worst-status is findings');
  if (evFail.findings.length !== 1) throw new Error('findings collected from results');

  // --- evaluateBoundary: an error -> not converged, worst-status error, validatorErrors recorded ---
  const evErr = evaluateBoundary([
    { validatorId: 'static-a11y', result: errored() },
    { validatorId: 'theming', result: clean() },
  ]);
  if (evErr.converged) throw new Error('an error cannot converge');
  if (evErr.iterationStatus !== 'error') throw new Error('worst-status is error');
  if (evErr.validatorErrors.length !== 1 || evErr.validatorErrors[0].category !== 'aborted') throw new Error('validatorErrors recorded');

  // --- evaluateBoundary: empty required set is rejected (vacuous gate guard) ---
  let threw = false;
  try { evaluateBoundary([]); } catch { threw = true; }
  if (!threw) throw new Error('a convergence boundary requires >=1 required validator');

  // --- decideProgress: converged ---
  const seed = seedConvergenceState();
  if (seed.limits.maxIterations !== DEFAULT_LOOP_MAX_ITERATIONS || seed.limits.maxNoProgress !== DEFAULT_LOOP_MAX_NO_PROGRESS) {
    throw new Error('seed uses default limits');
  }
  const dConv = decideProgress(seed, evClean);
  if (dConv.outcome !== 'converged') throw new Error('converged decision');

  // --- decideProgress: first non-converged -> running, consecutiveNoProgress=1, nextIteration=1 ---
  const d1 = decideProgress(seed, evFail);
  if (d1.outcome !== 'running' || d1.consecutiveNoProgress !== 1 || d1.nextIteration !== 1) {
    throw new Error('first miss -> running/1/1, got ' + JSON.stringify(d1));
  }

  // --- decideProgress: same signature maxNoProgress times -> stalled ---
  let state = seedConvergenceState({ maxNoProgress: 3, maxIterations: 100 });
  let dec = decideProgress(state, evFail);                 // consecutive 1
  state = { ...state, signatures: [...state.signatures, evFail.signature], consecutiveNoProgress: dec.consecutiveNoProgress, iteration: dec.nextIteration };
  dec = decideProgress(state, evFail);                     // consecutive 2
  state = { ...state, signatures: [...state.signatures, evFail.signature], consecutiveNoProgress: dec.consecutiveNoProgress, iteration: dec.nextIteration };
  dec = decideProgress(state, evFail);                     // consecutive 3 -> stalled
  if (dec.outcome !== 'stalled' || dec.consecutiveNoProgress !== 3) throw new Error('stall at maxNoProgress, got ' + JSON.stringify(dec));

  // --- decideProgress: distinct signatures avoid stall; nextIteration reaching maxIterations -> capped ---
  let cs = seedConvergenceState({ maxNoProgress: 99, maxIterations: 2 });
  let cd = decideProgress(cs, withSig(evFail, 'sig-0'));   // running, next=1
  if (cd.outcome !== 'running') throw new Error('iter0 running');
  cs = { ...cs, signatures: ['sig-0'], consecutiveNoProgress: 1, iteration: 1 };
  cd = decideProgress(cs, withSig(evFail, 'sig-1'));       // next=2 >= maxIterations 2 -> capped
  if (cd.outcome !== 'capped') throw new Error('cap at maxIterations, got ' + JSON.stringify(cd));

  console.log('lane-convergence: OK');
}

// test helper: override a BoundaryEvaluation signature to drive distinct-signature paths.
function withSig(ev: ReturnType<typeof evaluateBoundary>, sig: string) { return { ...ev, signature: sig }; }

run();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-convergence.test.ts`
Expected: FAIL - cannot find module `../lane-convergence`.

- [ ] **Step 3: Implement `lane-convergence.ts`**

Create `sidecoach/src/lane-convergence.ts`:
```ts
// sidecoach/src/lane-convergence.ts
// Pure loop-convergence logic (no IO). Consumed by lane-runner.ts's iteration
// boundary. REUSES the P4a ProductValidationResult and aggregateWorstStatus; does
// not re-implement clean evaluation.
import { createHash } from 'crypto';
import type { GateStatus, RequiredValidatorState, ConvergenceState, ConvergenceOutcome } from './lane-types';
import type { ProductValidationResult, ProductValidationError, ProductFinding, NormalizedErrorCategory } from './product-rule-types';
import { aggregateWorstStatus } from './lane-validators';

export const DEFAULT_LOOP_MAX_ITERATIONS = 10;
export const DEFAULT_LOOP_MAX_NO_PROGRESS = 3;

// Reduce one required validator's typed result to its stable identity tuple. Only
// canonical rule keys / gap identities / normalized categories - never free-text
// messages or stack traces (which would destabilize the signature).
export function toRequiredValidatorState(validatorId: string, result: ProductValidationResult): RequiredValidatorState {
  const rules = result.rules ?? [];
  const cov = result.coverage;
  return {
    validatorId,
    status: result.status as GateStatus,
    failedRuleIds: rules.filter((r) => r.status === 'fail').map((r) => r.canonicalRuleKey).sort(),
    inconclusiveRuleIds: rules.filter((r) => r.status === 'inconclusive').map((r) => r.canonicalRuleKey).sort(),
    coverageGapIdentities: [...new Set([...(cov?.unsupportedSourceKinds ?? []), ...(cov?.unverifiedScope ?? [])])].sort(),
    validatorErrorCategory: result.status === 'error' ? (result as ProductValidationError).normalizedErrorCategory : undefined,
    ruleErrorCategories: rules.filter((r) => r.normalizedErrorCategory).map((r) => `${r.canonicalRuleKey}:${r.normalizedErrorCategory}`).sort(),
  };
}

// The required-state signature: a sha256-16 over the sorted per-validator tuples.
// Two boundaries with the same blocking state (in any validator order) hash equal,
// which is the no-progress signal stall detection watches for.
export function computeRequiredStateSignature(states: RequiredValidatorState[]): string {
  const sorted = [...states]
    .sort((a, b) => (a.validatorId < b.validatorId ? -1 : a.validatorId > b.validatorId ? 1 : 0))
    .map((s) => ({ v: s.validatorId, s: s.status, f: s.failedRuleIds, i: s.inconclusiveRuleIds, g: s.coverageGapIdentities, e: s.validatorErrorCategory ?? null, r: s.ruleErrorCategories }));
  return createHash('sha256').update(JSON.stringify(sorted)).digest('hex').slice(0, 16);
}

export interface BoundaryEvaluation {
  perValidator: RequiredValidatorState[];
  iterationStatus: GateStatus;     // worst-of required validators
  converged: boolean;              // every required validator returned clean
  signature: string;
  findings: ProductFinding[];
  validatorErrors: { validatorId: string; category: NormalizedErrorCategory; message: string }[];
  measuredScope: string[];
  unverifiedScope: string[];
}

// Evaluate one iteration boundary from the required validators' typed results.
// Convergence requires EVERY required validator to be clean (honest convergence:
// never converge on findings/inconclusive/error).
export function evaluateBoundary(perValidator: { validatorId: string; result: ProductValidationResult }[]): BoundaryEvaluation {
  if (perValidator.length === 0) {
    throw new Error('evaluateBoundary: a convergence lane requires at least one required product validator');
  }
  const states = perValidator.map((p) => toRequiredValidatorState(p.validatorId, p.result));
  const iterationStatus = aggregateWorstStatus(states.map((s) => s.status));
  const converged = states.every((s) => s.status === 'clean');
  const signature = computeRequiredStateSignature(states);
  const findings = perValidator.flatMap((p) => p.result.findings ?? []);
  const validatorErrors = perValidator
    .filter((p) => p.result.status === 'error')
    .map((p) => ({ validatorId: p.validatorId, category: (p.result as ProductValidationError).normalizedErrorCategory, message: (p.result as ProductValidationError).error }));
  const measuredScope = [...new Set(perValidator.flatMap((p) => p.result.coverage?.measuredScope ?? []))].sort();
  const unverifiedScope = [...new Set(perValidator.flatMap((p) => p.result.coverage?.unverifiedScope ?? []))].sort();
  return { perValidator: states, iterationStatus, converged, signature, findings, validatorErrors, measuredScope, unverifiedScope };
}

export interface ProgressDecision {
  outcome: ConvergenceOutcome;     // converged | running | stalled | capped
  consecutiveNoProgress: number;
  nextIteration: number;
}

// Decide the loop outcome after one boundary. Converged closes the lane (caller).
// Otherwise: count consecutive identical signatures (stall) and the next iteration
// index (cap). An errored/inconclusive iteration is treated like findings for
// progress - it cannot converge, but it stays resumable (running) until stall/cap.
export function decideProgress(prev: ConvergenceState, ev: BoundaryEvaluation): ProgressDecision {
  if (ev.converged) return { outcome: 'converged', consecutiveNoProgress: prev.consecutiveNoProgress, nextIteration: prev.iteration };
  const lastSig = prev.signatures.length ? prev.signatures[prev.signatures.length - 1] : undefined;
  const consecutiveNoProgress = lastSig === ev.signature ? prev.consecutiveNoProgress + 1 : 1;
  const nextIteration = prev.iteration + 1;
  let outcome: ConvergenceOutcome;
  if (consecutiveNoProgress >= prev.limits.maxNoProgress) outcome = 'stalled';
  else if (nextIteration >= prev.limits.maxIterations) outcome = 'capped';
  else outcome = 'running';
  return { outcome, consecutiveNoProgress, nextIteration };
}

export function seedConvergenceState(limits?: Partial<{ maxIterations: number; maxNoProgress: number }>): ConvergenceState {
  return {
    outcome: 'running', iteration: 0, signatures: [], consecutiveNoProgress: 0,
    limits: { maxIterations: limits?.maxIterations ?? DEFAULT_LOOP_MAX_ITERATIONS, maxNoProgress: limits?.maxNoProgress ?? DEFAULT_LOOP_MAX_NO_PROGRESS },
    history: [], findings: [], validatorErrors: [], advisoryRuns: [], measuredScope: [], unverifiedScope: [],
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-convergence.test.ts`
Expected: `lane-convergence: OK`

- [ ] **Step 5: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add:
```ts
  { rel: 'src/__tests__/lane-convergence.test.ts', required: true },                // P4c pure convergence module
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 36 suite(s) passed`

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-convergence.ts sidecoach/src/__tests__/lane-convergence.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): pure convergence module (signature, boundary eval, progress decision)"
```

---

## Task 4: Enable `lane_converge` at startLane + minimal preflight + seed convergence

**Files:**
- Modify: `sidecoach/src/lane-runner.ts:164-167` (remove the loop rejection), `:186-198` (seed convergence)
- Test: `sidecoach/src/__tests__/lane-loop-start.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-loop-start.test.ts`:
```ts
// Task 4: lane_converge starts (no longer rejected); convergence sub-state seeded.
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, LaneRunnerDeps } from '../lane-runner';

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    // never called at start (no boundary yet); throws if a step gate wrongly runs it.
    runValidator: async () => { throw new Error('runValidator must NOT run at lane start'); } };
}

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-start-'));
  const d = deps(proj);
  const start = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-loop', d);
  if (start.currentVerb !== 'polish') throw new Error('first loop step is polish, got ' + start.currentVerb);
  if (start.executionKind !== 'loop') throw new Error('executionKind loop');
  if (start.iteration !== 0) throw new Error('iteration 0 at start');
  if (start.lifecycle !== 'in_progress') throw new Error('in_progress at start');

  const cp = d.store.read(start.checkpointId);
  if (!cp.convergence) throw new Error('convergence sub-state must be seeded for a loop lane');
  if (cp.convergence.outcome !== 'running') throw new Error('seeded outcome running');
  if (cp.convergence.limits.maxNoProgress !== 3 || cp.convergence.limits.maxIterations !== 10) throw new Error('seeded default limits');

  // A loop lane whose policy is unknown would reject - sanity-check the happy path only here.
  console.log('lane-loop-start: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-start.test.ts`
Expected: FAIL - `startLane: lane "lane_converge" is a loop lane - loop execution + the convergence floor land in P4. Not startable in P2.`

- [ ] **Step 3: Replace the loop rejection with the minimal preflight + seed**

In `sidecoach/src/lane-runner.ts`, add to the imports at the top:
```ts
import { validatorsForStep, aggregateWorstStatus, mapGateStatusToOutcome, requiredValidatorsForLane, isLoopLane } from './lane-validators';
import { getValidatorRegistration, getLanePolicy } from './flow-validation-capabilities';
import { GENERATED_VALIDATORS } from './validators.generated';
import { seedConvergenceState, evaluateBoundary, decideProgress, BoundaryEvaluation, ProgressDecision } from './lane-convergence';
```
(Replace the existing `import { validatorsForStep, aggregateWorstStatus, mapGateStatusToOutcome } from './lane-validators';` line and add the three new imports.)

Replace lines 165-167 (the loop rejection):
```ts
  if (l.executionKind === 'loop') {
    throw new Error(`startLane: lane "${laneId}" is a loop lane - loop execution + the convergence floor land in P4. Not startable in P2.`);
  }
```
with the minimal release-floor preflight (no IO - the coverage-plan preflight is the orchestrator layer in Task 8):
```ts
  if (l.executionKind === 'loop') {
    // Minimal release-floor enablement: the lane must declare a non-empty product-
    // validator policy and every required validator must be registered + generated.
    // The IO-heavy coverage-plan satisfiability preflight runs at the orchestrator
    // layer (Task 8) so engine unit tests can drive startLane directly.
    const policy = getLanePolicy(l.lane);
    if (!policy || policy.requiredProductValidatorIds.length === 0) {
      throw new Error(`startLane: loop lane "${laneId}" has no release-floor policy (requiredProductValidatorIds) - convergence gating cannot be enabled`);
    }
    for (const vId of policy.requiredProductValidatorIds) {
      if (!getValidatorRegistration(vId)?.validateProduct) {
        throw new Error(`startLane: loop lane "${laneId}" requires validator "${vId}" which is not registered with a validateProduct entry`);
      }
      if (!GENERATED_VALIDATORS.find((g) => g.validatorId === vId)?.cleanPolicy) {
        throw new Error(`startLane: loop lane "${laneId}" required validator "${vId}" has no generated cleanPolicy`);
      }
    }
  }
```

Then in the checkpoint-creation block (the `const cp: LaneCheckpoint = {...}` at line 186-195), add the `convergence` field (after `stepGateStatuses: {},`):
```ts
      convergence: l.executionKind === 'loop' ? seedConvergenceState() : undefined,
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-start.test.ts`
Expected: `lane-loop-start: OK`

- [ ] **Step 5: Run the FULL gate (the loop-rejection removal must not break P2 sequence tests)**

Register the suite in `sidecoach/scripts/run-tests.ts`:
```ts
  { rel: 'src/__tests__/lane-loop-start.test.ts', required: true },                 // P4c lane_converge starts + seeds convergence
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 37 suite(s) passed` (all prior lane/sequence suites still green - removing the rejection must not regress sequence behavior).

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-loop-start.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): enable lane_converge start + minimal release-floor preflight + seed convergence"
```

---

## Task 5: Loop non-final step completion (advisory advance, no gate)

**Files:**
- Modify: `sidecoach/src/lane-runner.ts` (dispatch in `case 'complete'`, add `completeLoopStep`)
- Test: `sidecoach/src/__tests__/lane-loop-advance.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-loop-advance.test.ts`:
```ts
// Task 5: completing a NON-final loop verb step is advisory - cursor advances within
// the iteration and NO product validator runs (no per-step gate in a loop lane).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';

let validatorCalls = 0;
function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: async () => { validatorCalls++; throw new Error('no validator on a non-final loop step'); } };
}
const rep = (verb: string, iteration = 0): StepReport => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-adv-'));
  const d = deps(proj);
  const start = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-adv', d); // polish
  if (start.currentVerb !== 'polish') throw new Error('start at polish');

  // complete polish (non-final) -> advisory advance to audit, iteration stays 0, NO validator.
  const r1 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: start.revision }, d);
  if (r1.currentVerb !== 'audit') throw new Error('advance to audit, got ' + r1.currentVerb);
  if (r1.iteration !== 0) throw new Error('iteration stays 0 within the pass');
  if (r1.lifecycle !== 'in_progress') throw new Error('still in_progress');

  // complete audit (non-final) -> advance to critique (the final/boundary step).
  const r2 = await advanceLane(proj, start.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: r1.revision }, d);
  if (r2.currentVerb !== 'critique') throw new Error('advance to critique, got ' + r2.currentVerb);

  if (validatorCalls !== 0) throw new Error('NO product validator may run on non-final loop steps; got ' + validatorCalls);

  const cp = d.store.read(start.checkpointId);
  if (cp.cursor !== 2) throw new Error('cursor at the final step (2)');
  if (cp.iteration !== 0) throw new Error('iteration still 0 before the boundary');
  if (!cp.convergence || cp.convergence.advisoryRuns.length < 2) throw new Error('advisory served flows recorded per non-final step');

  console.log('lane-loop-advance: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-advance.test.ts`
Expected: FAIL - completing the polish step runs the SEQUENCE gate (`validatorsForStep`), which throws via `runValidator` (or advances wrongly), so the assertion `validatorCalls !== 0` / wrong currentVerb trips.

- [ ] **Step 3: Add the loop dispatch + `completeLoopStep`**

In `sidecoach/src/lane-runner.ts`, inside `advanceLane`'s `case 'complete'`, AFTER the partial-serve guard (current line 416, right after the `if (servedFlows.length < step.flowIds.length) { throw ... }` block) and BEFORE the sequence CLAIM (`const operationId = ...` at line 419), insert:
```ts
      // LOOP lanes: per-step completion is advisory (no per-step gate). The required
      // validators run ONLY at the iteration boundary via the lane policy, so a flow-
      // bound validator is never run twice (spec lines 355-359, 952-958).
      if (l.executionKind === 'loop') return completeLoopStep(cp, l, transition, projectPath, d);
```

Then add the new function `completeLoopStep` near `skipStep` (end of file). Add the boundary helper `runIterationBoundary` and state helpers in Task 6 - for THIS task `completeLoopStep` only needs the non-boundary branch plus a placeholder that defers the boundary to a function added next task. To keep the build green now, implement `completeLoopStep` fully but have the boundary branch call `runIterationBoundary` (added in Task 6). Add a minimal stub of `runIterationBoundary` in THIS task that the next task replaces:
```ts
// --- P4c loop execution -------------------------------------------------------

// Complete one verb step of a loop lane. Non-final steps are advisory: record the
// report, log the served advisory flows, advance the cursor within the iteration.
// The final step reaches the iteration boundary (Task 6).
async function completeLoopStep(cp: LaneCheckpoint, l: GeneratedLane, transition: LaneTransition, projectPath: string, d: LaneRunnerDeps): Promise<LaneStepResult> {
  const r = transition.report!;
  const step = l.verbSteps[cp.cursor];
  const isBoundary = cp.cursor === l.verbSteps.length - 1;
  if (isBoundary) {
    return runIterationBoundary(cp, l, projectPath, d, transition.expectedRevision, (c, committedRevision) => {
      c.seenReportIds.push(r.reportId); c.stepReports.push(r);
      recordAdvisoryRun(c, cp.cursor);
      c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: committedRevision, reason: 'boundary', at: d.now() });
    });
  }
  const operationId = (d.newOperationId ?? defaultOperationId)();
  const claimed = await claimLease(d.store, cp.checkpointId, { expectedRevision: transition.expectedRevision, stepId: step.verb, iteration: cp.iteration, operationId, now: d.now, staleMs: d.staleMs });
  const id = claimed.lease!;
  const final = await finalizeLease(d.store, cp.checkpointId, id, (c, committedRevision) => {
    c.seenReportIds.push(r.reportId); c.stepReports.push(r);
    recordAdvisoryRun(c, cp.cursor);
    c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: committedRevision, at: d.now() });
    c.cursor += 1;   // advance within the iteration; a loop never closes on a non-final step
  }, d.now);
  if (projectPath) await (d.publishOutbox ?? publishOutbox)(d.store, cp.checkpointId, projectPath, d.now);
  return buildStepResult(final, l, { projectPath }, d);
}

// Log the advisory member-flows served at the current step for this iteration (M/K/I/L
// coach every pass; their guidance is informational - it never gates).
function recordAdvisoryRun(c: LaneCheckpoint, cursor: number): void {
  if (!c.convergence) return;
  const served = c.servedSteps[`${cursor}:${c.iteration}`];
  if (served) c.convergence.advisoryRuns.push({ iteration: c.iteration, flowIds: [...served.flowIds] });
}

// Placeholder boundary (Task 6 implements the real gate). Throws so the build is honest
// until the gate exists; no test in Task 5 reaches it.
async function runIterationBoundary(
  _cp: LaneCheckpoint, _l: GeneratedLane, _projectPath: string, _d: LaneRunnerDeps,
  _claimRevision: number, _onCommit: (c: LaneCheckpoint, committedRevision: number) => void,
): Promise<LaneStepResult> {
  throw new Error('runIterationBoundary: implemented in Task 6');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-advance.test.ts`
Expected: `lane-loop-advance: OK`

- [ ] **Step 5: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add:
```ts
  { rel: 'src/__tests__/lane-loop-advance.test.ts', required: true },               // P4c loop advisory step advance
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 38 suite(s) passed`

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-loop-advance.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): loop non-final step completion is advisory (no per-step gate)"
```

---

## Task 6: Iteration boundary - converged path

**Files:**
- Modify: `sidecoach/src/lane-runner.ts` (replace the `runIterationBoundary` placeholder; add `applyConvergence`, `convergenceSurface`, `buildConvergedSummary`)
- Test: `sidecoach/src/__tests__/lane-loop-boundary-converge.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-loop-boundary-converge.test.ts`:
```ts
// Task 6: completing the FINAL loop step runs the lane policy validators ONCE, and
// all-clean closes the lane as converged with a truthful summary. Asserts the four
// required validators each ran exactly once, AT the boundary (no double-run).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';

function clean(scope: string): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [scope], unverifiedScope: [] } };
}

const calls: string[] = [];
function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: async (validatorId) => { calls.push(validatorId); return clean(`scope-${validatorId}`); } };
}
const rep = (verb: string, iteration = 0): StepReport => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-conv-'));
  const d = deps(proj);
  const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-c', d); // polish
  const a = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision }, d); // audit
  if (calls.length !== 0) throw new Error('no validators before the boundary; got ' + JSON.stringify(calls));
  const b = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision }, d);  // critique
  const c = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('critique'), expectedRevision: b.revision }, d); // BOUNDARY

  if (c.lifecycle !== 'closed') throw new Error('converged closes the lane, got ' + c.lifecycle);
  if (c.outcome !== 'converged') throw new Error('outcome converged, got ' + c.outcome);
  if (!c.convergence || c.convergence.outcome !== 'converged') throw new Error('convergence.outcome converged');
  if (!c.convergence.summary || !/Converged \(machine-measured\)/.test(c.convergence.summary)) throw new Error('truthful summary present: ' + c.convergence?.summary);

  // The four required validators each ran EXACTLY once, at the boundary.
  const expected = ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'];
  if (JSON.stringify(calls.slice().sort()) !== JSON.stringify(expected.slice().sort())) throw new Error('required validators run once each: ' + JSON.stringify(calls));
  if (calls.length !== 4) throw new Error('exactly 4 validator runs (no double-run); got ' + calls.length);

  // Persisted + reproducible: a signature recorded; lane closed.
  const cp = d.store.read(s.checkpointId);
  if (cp.convergence!.signatures.length !== 1) throw new Error('one boundary signature persisted');
  if (cp.convergence!.history.length !== 1) throw new Error('one boundary history record persisted');

  console.log('lane-loop-boundary-converge: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-boundary-converge.test.ts`
Expected: FAIL - `runIterationBoundary: implemented in Task 6` (the placeholder throws).

- [ ] **Step 3: Replace the `runIterationBoundary` placeholder + add the state helpers**

In `sidecoach/src/lane-runner.ts`, replace the placeholder `runIterationBoundary` (added in Task 5) with the real implementation, and add the helpers:
```ts
// Run one loop iteration boundary: CLAIM the lease, EXECUTE the lane policy validators
// once (abortable, heartbeat-protected - same P4b-1 protocol as a sequence complete),
// evaluate convergence, and FINALIZE. Converged -> close the lane (converged). Otherwise
// -> persist the required-state signature, advance the iteration, reset the verb cursor.
// onCommit pushes the caller's report/skip audit inside the same atomic FINALIZE.
async function runIterationBoundary(
  cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, d: LaneRunnerDeps,
  claimRevision: number, onCommit: (c: LaneCheckpoint, committedRevision: number) => void,
): Promise<LaneStepResult> {
  const step = l.verbSteps[cp.cursor];
  const operationId = (d.newOperationId ?? defaultOperationId)();
  const claimed = await claimLease(d.store, cp.checkpointId, { expectedRevision: claimRevision, stepId: step.verb, iteration: cp.iteration, operationId, now: d.now, staleMs: d.staleMs });
  const id = claimed.lease!;
  const controller = new AbortController();
  const opKey = leaseKey(cp.checkpointId, id);
  LIVE_OPERATIONS.set(opKey, controller);
  const stopHeartbeat = startHeartbeatLoop(d, cp.checkpointId, id, controller);
  try {
    // EXECUTE: the required validators run ONCE each, via the lane policy (not per-step).
    const validatorIds = requiredValidatorsForLane(l.lane);
    const perValidator = await runStepValidators(d, validatorIds, { projectPath, target: cp.target }, controller.signal);
    const ev = evaluateBoundary(perValidator);
    const decision = decideProgress(cp.convergence!, ev);
    const gate = { status: ev.iterationStatus, validators: perValidator.map((p) => ({ validatorId: p.validatorId, status: p.result.status as GateStatus })), findings: ev.findings };
    const final = await finalizeLease(d.store, cp.checkpointId, id, (c, committedRevision) => {
      onCommit(c, committedRevision);
      applyConvergence(c, ev, decision);
      if (ev.converged) { c.lifecycle = 'closed'; c.outcome = 'converged'; }
      else { c.iteration = decision.nextIteration; c.cursor = 0; }   // reset to the first verb step of the next pass
      c.sideEffectOutbox.push({
        checkpointId: c.checkpointId, committedRevision, fencingToken: id.fencingToken, stepId: step.verb, iteration: id.iteration,
        pendingPublishers: ['lane-side-effect-sink'], createdAt: d.now(),
        entries: [{ publisher: 'lane-side-effect-sink', entryIndex: 0, logicalKey: `${c.checkpointId}:boundary:${id.iteration}`,
          payload: { laneId: c.laneId, boundary: true, iteration: id.iteration, convergence: c.convergence!.outcome, committedRevision } }],
      });
    }, d.now);
    if (projectPath) await (d.publishOutbox ?? publishOutbox)(d.store, cp.checkpointId, projectPath, d.now);
    if (ev.converged) return { ...closedResult(final, l), gate, convergence: convergenceSurface(final) };
    return { ...(await buildStepResult(final, l, { projectPath }, d, gate)), convergence: convergenceSurface(final) };
  } finally {
    stopHeartbeat();
    if (LIVE_OPERATIONS.get(opKey) === controller) LIVE_OPERATIONS.delete(opKey);
  }
}

// Fold one boundary's evaluation + progress decision into the persisted convergence
// sub-state. Records the iteration in history (reproducible inputs), the latest
// findings/validatorErrors/scope, and the signature. The caller sets c.iteration/
// c.cursor/lifecycle; this only touches c.convergence.
function applyConvergence(c: LaneCheckpoint, ev: BoundaryEvaluation, decision: ProgressDecision): void {
  const conv = c.convergence!;
  conv.history.push({ iteration: c.iteration, signature: ev.signature, perValidator: ev.perValidator, measuredScope: ev.measuredScope, unverifiedScope: ev.unverifiedScope });
  conv.signatures.push(ev.signature);
  conv.findings = ev.findings;
  conv.validatorErrors = ev.validatorErrors;
  conv.measuredScope = ev.measuredScope;
  conv.unverifiedScope = ev.unverifiedScope;
  conv.outcome = decision.outcome;
  conv.consecutiveNoProgress = ev.converged ? conv.consecutiveNoProgress : decision.consecutiveNoProgress;
  conv.iteration = ev.converged ? c.iteration : decision.nextIteration;
}

function convergenceSurface(c: LaneCheckpoint): NonNullable<LaneStepResult['convergence']> {
  const conv = c.convergence!;
  return {
    outcome: conv.outcome, iteration: conv.iteration,
    signature: conv.signatures.length ? conv.signatures[conv.signatures.length - 1] : undefined,
    findings: conv.findings,
    summary: conv.outcome === 'converged' ? buildConvergedSummary(conv) : undefined,
  };
}

// Truthful closing summary GENERATED from the run coverage record (spec lines 1177-1186) -
// never from registry declarations. ASCII only.
function buildConvergedSummary(conv: NonNullable<LaneCheckpoint['convergence']>): string {
  const measured = conv.measuredScope.length ? conv.measuredScope.join(', ') : 'no measured scope';
  const unverified = conv.unverifiedScope.length ? conv.unverifiedScope.join(', ') : 'none';
  const passes = conv.history.length;
  return `Converged (machine-measured): ${measured} clean after ${passes} iteration(s) under the release floor. Not machine-verified: ${unverified}. Advisory audit/critique guidance was served each pass; manual verification remains advised.`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-boundary-converge.test.ts`
Expected: `lane-loop-boundary-converge: OK`

- [ ] **Step 5: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add:
```ts
  { rel: 'src/__tests__/lane-loop-boundary-converge.test.ts', required: true },     // P4c boundary converged path
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 39 suite(s) passed`

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-loop-boundary-converge.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): iteration-boundary gate runs the policy validators once; all-clean converges (persisted, truthful)"
```

---

## Task 7: Iteration boundary - continue, stall, cap, and skip-cannot-bypass

**Files:**
- Modify: `sidecoach/src/lane-runner.ts` (loop-aware skip dispatch + `loopSkipStep`)
- Test: `sidecoach/src/__tests__/lane-loop-boundary-continue.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-loop-boundary-continue.test.ts`:
```ts
// Task 7: non-converged boundary persists the signature, increments the iteration, and
// resets the verb cursor; repeated identical state stalls; a SKIP of the final step
// still runs the boundary gate (cannot bypass).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';
import type { ProductValidationResult } from '../product-rule-types';

function fail(ruleKey: string): ProductValidationResult {
  return { status: 'findings',
    rules: [{ ruleId: ruleKey, canonicalRuleKey: ruleKey, status: 'fail', severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
    findings: [{ validatorId: 'polish-standard', ruleId: ruleKey, canonicalRuleKey: ruleKey, severity: 'major', findingClass: 'polish', evidenceLocations: ['x'], message: 'm' }],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 0, fail: 1, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 1, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: ['scope-x'] } };
}
function clean(): ProductValidationResult {
  return { status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
      ruleCounts: { pass: 1, fail: 0, notApplicable: 0, inconclusive: 0 },
      findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: ['ok'], unverifiedScope: [] } };
}

// polish-standard always fails (same rule key) -> stable signature -> stall path.
function deps(proj: string, polishResult: () => ProductValidationResult): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    runValidator: async (validatorId) => (validatorId === 'polish-standard' ? polishResult() : clean()) };
}
const rep = (verb: string, iteration: number): StepReport => ({ stepId: verb, iteration, reportId: `r:${verb}:${iteration}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

// Drive one full iteration via complete; returns the boundary result.
async function onePass(proj: string, d: LaneRunnerDeps, cpId: string, rev: number, iter: number): Promise<{ res: any }> {
  const a = await advanceLane(proj, cpId, { action: 'complete', report: rep('polish', iter), expectedRevision: rev }, d);
  const b = await advanceLane(proj, cpId, { action: 'complete', report: rep('audit', iter), expectedRevision: a.revision }, d);
  const c = await advanceLane(proj, cpId, { action: 'complete', report: rep('critique', iter), expectedRevision: b.revision }, d);
  return { res: c };
}

async function run() {
  // --- continue + reset cursor on a non-converged boundary ---
  {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-cont-'));
    const d = deps(proj, () => fail('polish.no-transition-all'));
    const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-cont', d);
    const { res } = await onePass(proj, d, s.checkpointId, s.revision, 0);
    if (res.lifecycle !== 'in_progress') throw new Error('non-converged stays in_progress');
    if (res.currentVerb !== 'polish') throw new Error('cursor reset to polish for the next pass, got ' + res.currentVerb);
    if (res.iteration !== 1) throw new Error('iteration incremented to 1, got ' + res.iteration);
    if (!res.convergence || res.convergence.outcome !== 'running') throw new Error('outcome running');
    if (!res.convergence.findings || res.convergence.findings.length !== 1) throw new Error('findings returned to the model');
    const cp = d.store.read(s.checkpointId);
    if (cp.convergence!.signatures.length !== 1) throw new Error('one signature persisted after pass 0');
  }

  // --- stall: identical failing state for maxNoProgress passes ---
  {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-stall-'));
    const d = deps(proj, () => fail('polish.no-transition-all'));   // same rule each pass -> same signature
    const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-stall', d);
    let rev = s.revision;
    let last: any;
    for (let i = 0; i < 3; i++) { const { res } = await onePass(proj, d, s.checkpointId, rev, i); rev = res.revision; last = res; }
    if (!last.convergence || last.convergence.outcome !== 'stalled') throw new Error('stalled after 3 identical passes, got ' + last.convergence?.outcome);
  }

  // --- skip of the FINAL step still runs the boundary gate (cannot bypass) ---
  {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-skip-'));
    let boundaryRan = 0;
    const base = deps(proj, () => clean());
    const d: LaneRunnerDeps = { ...base, runValidator: async (vId) => { boundaryRan++; return clean(); } };
    const s = await startLane('lane_converge', 'project', { projectPath: proj }, 'req-skip', d);
    const a = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('polish', 0), expectedRevision: s.revision }, d);
    const b = await advanceLane(proj, s.checkpointId, { action: 'complete', report: rep('audit', 0), expectedRevision: a.revision }, d);
    // SKIP critique (the final coaching verb): the boundary gate MUST still run.
    const c = await advanceLane(proj, s.checkpointId, { action: 'skip', reason: 'critique coaching not needed this pass', expectedRevision: b.revision }, d);
    if (boundaryRan !== 4) throw new Error('skip of the final step must still run the 4 boundary validators, got ' + boundaryRan);
    if (c.outcome !== 'converged') throw new Error('all-clean boundary after a final-step skip still converges, got ' + c.outcome);
  }

  console.log('lane-loop-boundary-continue: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-boundary-continue.test.ts`
Expected: FAIL - the skip path uses the SEQUENCE `skipStep` (which advances/closes via `advanceCursorInPlace`), so the final-step skip does NOT run the boundary gate (`boundaryRan !== 4`). The continue/stall paths already pass from Task 6 (this suite also locks them in).

- [ ] **Step 3: Add the loop-aware skip dispatch + `loopSkipStep`**

In `sidecoach/src/lane-runner.ts`, in `transitionNonComplete`'s `case 'skip'` (line 538-539), change:
```ts
    case 'skip':
      return skipStep(cp, l, projectPath, t, d);
```
to:
```ts
    case 'skip':
      return l.executionKind === 'loop'
        ? loopSkipStep(cp, l, projectPath, t, d)
        : skipStep(cp, l, projectPath, t, d);
```

Then add `loopSkipStep` near `completeLoopStep`:
```ts
// Skip a loop verb step. A non-final skip drops that pass's coaching and advances the
// cursor. A skip of the FINAL verb step still reaches the iteration boundary - a skip
// can skip coaching but cannot bypass the lane-policy gate (spec lines 348-349, 364-365).
async function loopSkipStep(cp: LaneCheckpoint, l: GeneratedLane, projectPath: string, t: LaneTransition, d: LaneRunnerDeps): Promise<LaneStepResult> {
  if (!t.reason || !t.reason.trim()) throw new Error('advanceLane: skip requires a reason');
  const step = l.verbSteps[cp.cursor];
  const isBoundary = cp.cursor === l.verbSteps.length - 1;
  if (isBoundary) {
    return runIterationBoundary(cp, l, projectPath, d, t.expectedRevision, (c, committedRevision) => {
      c.skippedStepIds.push(step.verb);
      c.audit.push({ action: 'skip', stepId: step.verb, iteration: c.iteration, reason: t.reason, revision: committedRevision, at: d.now() });
    });
  }
  const operationId = (d.newOperationId ?? defaultOperationId)();
  const claimed = await claimLease(d.store, cp.checkpointId, { expectedRevision: t.expectedRevision, stepId: step.verb, iteration: cp.iteration, operationId, now: d.now, staleMs: d.staleMs });
  const id = claimed.lease!;
  const final = await finalizeLease(d.store, cp.checkpointId, id, (c, committedRevision) => {
    c.skippedStepIds.push(step.verb);
    c.audit.push({ action: 'skip', stepId: step.verb, iteration: c.iteration, reason: t.reason, revision: committedRevision, at: d.now() });
    c.cursor += 1;   // loop: advance within the iteration; never close on a non-final skip
  }, d.now);
  if (projectPath) await (d.publishOutbox ?? publishOutbox)(d.store, cp.checkpointId, projectPath, d.now);
  return buildStepResult(final, l, { projectPath }, d);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-loop-boundary-continue.test.ts`
Expected: `lane-loop-boundary-continue: OK`

- [ ] **Step 5: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add:
```ts
  { rel: 'src/__tests__/lane-loop-boundary-continue.test.ts', required: true },     // P4c boundary continue/stall/skip-no-bypass
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 40 suite(s) passed`

- [ ] **Step 6: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-runner.ts sidecoach/src/__tests__/lane-loop-boundary-continue.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): boundary continue/stall/cap + loop skip cannot bypass the gate"
```

---

## Task 8: Convergence coverage-plan preflight + orchestrator wiring

**Files:**
- Create: `sidecoach/src/lane-convergence-preflight.ts`
- Modify: `sidecoach/src/sidecoach-orchestrator.ts:1639-1642` (`startLane`)
- Test: `sidecoach/src/__tests__/lane-convergence-preflight.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/lane-convergence-preflight.test.ts`:
```ts
// Task 8: convergence preflight rejects a target whose required validators have NO
// supported evidence path (would be permanently inconclusive), and passes a CSS+HTML
// target (spec lines 996-1011, 1069-1072).
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { convergencePreflight } from '../lane-convergence-preflight';

async function run() {
  // --- empty target: no supported sources -> reject, gap names a required validator ---
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-empty-'));
  const r1 = await convergencePreflight(empty, 'lane_converge');
  if (r1.ok) throw new Error('an empty target cannot satisfy the release floor');
  if (r1.gaps.length === 0) throw new Error('preflight names the unmet validator(s)');
  if (!/cannot be measured/.test(r1.message || '')) throw new Error('actionable message: ' + r1.message);

  // --- CSS + HTML target: supported -> ok ---
  const good = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-good-'));
  fs.writeFileSync(path.join(good, 'style.css'), '.btn { color: #111; }\n');
  fs.writeFileSync(path.join(good, 'index.html'), '<!doctype html><html><body><button>Go</button></body></html>\n');
  const r2 = await convergencePreflight(good, 'lane_converge');
  if (!r2.ok) throw new Error('a CSS+HTML target meets the release floor, got: ' + r2.message);

  // --- unknown lane / no policy -> reject ---
  const r3 = await convergencePreflight(good, 'lane_build');
  if (r3.ok) throw new Error('a lane with no policy cannot preflight as a convergence lane');

  console.log('lane-convergence-preflight: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-convergence-preflight.test.ts`
Expected: FAIL - cannot find module `../lane-convergence-preflight`.

- [ ] **Step 3: Implement the preflight**

Create `sidecoach/src/lane-convergence-preflight.ts`:
```ts
// sidecoach/src/lane-convergence-preflight.ts
// Static, IO-bound coverage-plan satisfiability preflight for a convergence lane. It
// proves the gate is not permanently-inconclusive BY CONSTRUCTION (spec lines 996-1011,
// 1069-1072): every required validator must have at least one required rule whose
// supported source kinds intersect the target's discovered sources. Reuses the generated
// requiredCoverageByScope and the real project collector - it does NOT run validators.
import { getLanePolicy } from './flow-validation-capabilities';
import { GENERATED_VALIDATORS } from './validators.generated';
import { collectFromPath } from './validators/project-collector';

export interface PreflightGap { validatorId: string; requiredSourceKinds: string[]; presentSourceKinds: string[]; }
export interface PreflightResult { ok: boolean; gaps: PreflightGap[]; message?: string; }

export async function convergencePreflight(projectPath: string, laneId: string): Promise<PreflightResult> {
  const policy = getLanePolicy(laneId);
  if (!policy || policy.requiredProductValidatorIds.length === 0) {
    return { ok: false, gaps: [], message: `convergence preflight: lane "${laneId}" has no release-floor policy (requiredProductValidatorIds)` };
  }
  const collected = await collectFromPath(projectPath);
  const present = new Set(collected.files.map((f) => f.sourceKind));
  const gaps: PreflightGap[] = [];
  for (const vId of policy.requiredProductValidatorIds) {
    const gen = GENERATED_VALIDATORS.find((g) => g.validatorId === vId);
    if (!gen) { gaps.push({ validatorId: vId, requiredSourceKinds: [], presentSourceKinds: [...present].sort() }); continue; }
    const supported = new Set<string>();
    for (const rec of gen.cleanPolicy.requiredCoverageByScope) {
      for (const alts of rec.evidenceAlternativesByRequirement) for (const k of alts) supported.add(k);
    }
    // A validator with NO required statically-coverable rules cannot anchor a gate.
    if (supported.size === 0 || ![...supported].some((k) => present.has(k))) {
      gaps.push({ validatorId: vId, requiredSourceKinds: [...supported].sort(), presentSourceKinds: [...present].sort() });
    }
  }
  if (gaps.length) {
    const detail = gaps.map((g) => `${g.validatorId} needs one of [${g.requiredSourceKinds.join(', ') || 'none'}] but the target has [${g.presentSourceKinds.join(', ') || 'no supported sources'}]`).join('; ');
    return { ok: false, gaps, message: `convergence preflight: required validators cannot be measured on this target - ${detail}` };
  }
  return { ok: true, gaps: [] };
}
```

- [ ] **Step 4: Wire the preflight into the orchestrator's `startLane`**

In `sidecoach/src/sidecoach-orchestrator.ts`, add the imports (near the existing `import { LANES } from './lanes.generated';` and `import { getValidatorRegistration } from './flow-validation-capabilities';`):
```ts
import { getLane } from './lanes.generated';
import { convergencePreflight } from './lane-convergence-preflight';
```
Then replace `startLane` (line 1639-1642):
```ts
  async startLane(laneId: string, target: string, context: { projectPath?: string } & Record<string, any>, startRequestId: string): Promise<LaneStepResult> {
    const projectPath = context.projectPath || process.cwd();
    // Loop lanes get the policy-wide coverage-plan preflight (spec lines 1018-1023): a
    // target that cannot satisfy the release floor is rejected here, not started into a
    // permanently-inconclusive loop. (laneRunner.startLane keeps the cheap policy check.)
    if (getLane(laneId)?.executionKind === 'loop') {
      const pf = await convergencePreflight(projectPath, laneId);
      if (!pf.ok) throw new Error(pf.message);
    }
    return laneRunner.startLane(laneId, target, { ...context, projectPath }, startRequestId, this.laneDeps(projectPath));
  }
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-convergence-preflight.test.ts`
Expected: `lane-convergence-preflight: OK`

- [ ] **Step 6: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add:
```ts
  { rel: 'src/__tests__/lane-convergence-preflight.test.ts', required: true },      // P4c coverage-plan preflight
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 41 suite(s) passed`

- [ ] **Step 7: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/lane-convergence-preflight.ts sidecoach/src/sidecoach-orchestrator.ts sidecoach/src/__tests__/lane-convergence-preflight.test.ts sidecoach/scripts/run-tests.ts
git commit -m "feat(lane-p4c): coverage-plan preflight rejects permanently-inconclusive convergence targets; wired into orchestrator startLane"
```

---

## Task 9: End-to-end - a real CSS+HTML fixture reaches converged

**Files:**
- Create: `sidecoach/src/__tests__/fixtures/convergence/clean/style.css`
- Create: `sidecoach/src/__tests__/fixtures/convergence/clean/index.html`
- Test: `sidecoach/src/__tests__/lane-converge-e2e.test.ts`
- Modify: `sidecoach/scripts/run-tests.ts`

This task proves the gate is not permanently-inconclusive by construction (spec lines 996-998): at least one representative supported fixture reaches `clean` end to end using the REAL four validators.

- [ ] **Step 1: Create the clean fixture (starting point)**

Create `sidecoach/src/__tests__/fixtures/convergence/clean/style.css`:
```css
:root {
  --color-fg: #111418;
  --color-bg: #ffffff;
  --radius-sm: 4px;
  --radius-md: 8px;
  --space-2: 8px;
  --space-3: 12px;
}
.button {
  color: var(--color-fg);
  background: var(--color-bg);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  transition: transform 0.15s ease-out, box-shadow 0.15s ease-out;
  box-shadow: 0 1px 2px rgba(17, 20, 24, 0.12);
}
.button:active { transform: scale(0.98); }
@media (prefers-reduced-motion: reduce) {
  .button { transition: none; }
}
```

Create `sidecoach/src/__tests__/fixtures/convergence/clean/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Convergence clean fixture</title>
    <link rel="stylesheet" href="style.css" />
  </head>
  <body>
    <main>
      <h1>Welcome</h1>
      <button type="button" class="button" aria-label="Continue">Continue</button>
    </main>
  </body>
</html>
```

- [ ] **Step 2: Write the e2e test (asserts each validator clean, then drives the lane)**

Create `sidecoach/src/__tests__/lane-converge-e2e.test.ts`:
```ts
// Task 9: real-validator end-to-end. The four required validators reach clean on the
// fixture, and lane_converge converges in one pass. Proves the gate is not permanently
// inconclusive (spec lines 996-998, 1195-1199).
import * as path from 'path';
import { LaneCheckpointStore } from '../lane-checkpoint-store';
import { startLane, advanceLane, LaneRunnerDeps } from '../lane-runner';
import { StepReport } from '../lane-types';
import { getValidatorRegistration, getLanePolicy } from '../flow-validation-capabilities';
import { runValidatorForTest } from '../validators/run-validator';

const FIXTURE = path.join(__dirname, 'fixtures', 'convergence', 'clean');

function deps(proj: string): LaneRunnerDeps {
  let n = 0, t = 0, op = 0;
  return { store: new LaneCheckpointStore(proj),
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => { t += 1000; return new Date(t).toISOString(); }, newCheckpointId: () => `lane-cp${++n}`,
    newOperationId: () => `op-${++op}`,
    // REAL validators against the fixture project.
    runValidator: async (validatorId, ctx, signal) => {
      const reg = getValidatorRegistration(validatorId);
      if (!reg?.validateProduct) throw new Error('no validator ' + validatorId);
      return reg.validateProduct({ projectPath: ctx.projectPath }, signal);
    } };
}
const rep = (verb: string): StepReport => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });

async function run() {
  // Gate 1: each required validator must be clean on the fixture (actionable if not).
  for (const vId of getLanePolicy('lane_converge')!.requiredProductValidatorIds) {
    const detail = await runValidatorForTest(vId, { projectPath: FIXTURE });
    if (detail.result.status !== 'clean') {
      const failing = detail.result.rules.filter((r) => r.status !== 'pass' && r.status !== 'not_applicable')
        .map((r) => `${r.canonicalRuleKey}:${r.status}`);
      throw new Error(`fixture is not clean for ${vId} (status ${detail.result.status}); adjust the fixture for: ${failing.join(', ')}`);
    }
  }

  // Gate 2: drive the lane to convergence against the fixture project.
  const d = deps(FIXTURE);
  const s = await startLane('lane_converge', 'project', { projectPath: FIXTURE }, 'e2e-' + Date.now(), d);
  const a = await advanceLane(FIXTURE, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision }, d);
  const b = await advanceLane(FIXTURE, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision }, d);
  const c = await advanceLane(FIXTURE, s.checkpointId, { action: 'complete', report: rep('critique'), expectedRevision: b.revision }, d);
  if (c.outcome !== 'converged') throw new Error('expected converged end-to-end, got ' + c.outcome + ' / ' + JSON.stringify(c.convergence));
  if (!c.convergence?.summary) throw new Error('converged result must carry a truthful summary');

  console.log('lane-converge-e2e: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
```

Note: the lane's checkpoint store writes under `FIXTURE/.claude/lane-checkpoints/`. That subtree is created at runtime and is fine to leave untracked; if you prefer a clean tree, the test can target a temp copy of the fixture instead. Keep `startRequestId` unique per run (the `Date.now()` suffix) so reruns are not deduped to a closed lane.

- [ ] **Step 3: Run it and iterate the fixture until clean**

Run: `cd sidecoach && npx ts-node src/__tests__/lane-converge-e2e.test.ts`
Expected (first run may fail Gate 1): the error message lists the exact `canonicalRuleKey:status` pairs that are not clean. Adjust ONLY the fixture files (`style.css` / `index.html`) to satisfy those rules - never weaken the validators. Re-run until: `lane-converge-e2e: OK`.

Common adjustments if a rule is inconclusive/fail: ensure tokens are referenced via `var(--token)` (theming), no `transition: all` (anti-pattern / polish), a `prefers-reduced-motion` block (polish), semantic markup with `lang`, `alt`/`aria-label`, button `type` (static-a11y). If a required rule is inconclusive because it needs evidence the static fixture cannot provide, confirm it is NOT in `requiredRuleIds` (browser-only rules are non-required per P4a-2); if it genuinely is required and unprovable, STOP and report - that is a floor-coverage gap, not a fixture bug.

- [ ] **Step 4: Register the suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add:
```ts
  { rel: 'src/__tests__/lane-converge-e2e.test.ts', required: true },               // P4c real-fixture convergence e2e
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 42 suite(s) passed`

- [ ] **Step 5: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/__tests__/fixtures/convergence/clean/style.css sidecoach/src/__tests__/fixtures/convergence/clean/index.html sidecoach/src/__tests__/lane-converge-e2e.test.ts sidecoach/scripts/run-tests.ts
git commit -m "test(lane-p4c): e2e - real CSS+HTML fixture reaches converged on all four required validators"
```

---

## Task 10: Rename ralph-loop.ts -> convergence-loop.ts + truthful-convergence semantic fix + t20 rename/expectation

**Files:**
- Rename: `sidecoach/src/ralph-loop.ts` -> `sidecoach/src/convergence-loop.ts` (symbols `Ralph*` -> `Convergence*`, `[ralph]` -> `[convergence]`)
- Rename: `sidecoach/src/__tests__/t20-ralph-loop.test.ts` -> `sidecoach/src/__tests__/t20-convergence-loop.test.ts`
- Modify: `sidecoach/src/modes.ts:151` (stale path comment - optional)
- Modify: `sidecoach/scripts/run-tests.ts` (register the renamed suite)

The blast-radius note (spec lines 1262-1263) requires the rename AND the expectation fix: this orphan diagnostic loop currently treats a runner throw as zero findings and CONVERGES; the new rule is that a flow error can no longer converge (spec lines 1123-1130).

- [ ] **Step 1: Confirm there are no production importers (only the test)**

Run:
```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
grep -rn "ralph-loop\|runRalphLoop\|from './ralph" src --include="*.ts"
```
Expected: matches only in `src/__tests__/t20-ralph-loop.test.ts` and a comment in `src/modes.ts:151` (no executable production importer). If any OTHER `.ts` imports it, STOP and report - the rename scope changed.

- [ ] **Step 2: Rename the module file (git mv)**

Run:
```bash
cd /Users/spare3/Documents/Github/improv
git mv sidecoach/src/ralph-loop.ts sidecoach/src/convergence-loop.ts
git mv sidecoach/src/__tests__/t20-ralph-loop.test.ts sidecoach/src/__tests__/t20-convergence-loop.test.ts
```

- [ ] **Step 3: Rename the symbols inside `convergence-loop.ts` and apply the semantic fix**

In `sidecoach/src/convergence-loop.ts`, rename every public symbol (use exact find/replace, whole-word):
- `RalphStatus` -> `ConvergenceStatus`
- `RalphFinding` -> `ConvergenceFinding`
- `RalphIterationFlow` -> `ConvergenceIterationFlow`
- `RalphIteration` -> `ConvergenceIteration`
- `RalphResult` -> `ConvergenceResult`
- `RalphOptions` -> `ConvergenceOptions`
- `RalphFlowRunner` -> `ConvergenceFlowRunner`
- `RalphFlowRunOutput` -> `ConvergenceFlowRunOutput`
- `RalphFixApplier` -> `ConvergenceFixApplier`
- `runRalphLoop` -> `runConvergenceLoop`
- `computeProgressSignature` -> keep the name (it is a generic helper; tests reference it)
- `extractFindingsFromFlowResult` -> keep the name
- `DEFAULT_RALPH_FLOW_CHAIN` -> `DEFAULT_CONVERGENCE_FLOW_CHAIN`
- `DEFAULT_RALPH_MAX_GLOBAL_ITERATIONS` -> `DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS`
- `DEFAULT_RALPH_MAX_NO_PROGRESS_ITERATIONS` -> `DEFAULT_CONVERGENCE_MAX_NO_PROGRESS_ITERATIONS`
- log prefix string `[ralph]` -> `[convergence]` (every occurrence in emitted strings)
- the leading file-header comment `T-0020: Ralph-mode ...` -> `Convergence-loop: relentless cross-flow iteration ...` (ASCII, no dashes beyond hyphens)

Apply the semantic fix in `runConvergenceLoop`'s iteration body. Track whether any flow ERRORED this iteration and block convergence on it (a runner throw or a returned `error` can no longer count as zero findings -> clean).

Add, inside the `for (const flowId of flowChain)` loop, after the existing per-flow handling, a flag accumulation. Concretely, declare at the top of each iteration:
```ts
    let iterationErrored = false;
```
In the `catch (err)` branch (the runner-threw path) AND when `runOutput.error` is set, set `iterationErrored = true`. The existing catch block pushes `{ ..., error: errMsg }`; add `iterationErrored = true;` there. After building `flowResults.push({ ..., error: runOutput.error })` for the non-throw path, add:
```ts
      if (runOutput.error) iterationErrored = true;
```

Then change the convergence check from:
```ts
    // Convergence: zero findings across every flow in this iteration.
    if (allFindings.length === 0) {
```
to:
```ts
    // Convergence requires zero findings AND no flow error this iteration. A flow
    // error can no longer be recorded as zero findings and "converge" (spec lines
    // 1123-1130: product-validator failure can no longer converge).
    if (allFindings.length === 0 && !iterationErrored) {
```

Leave stall/cap logic unchanged: with a deterministic same-error-each-pass runner and zero findings, the findings-based signature is stable, so the loop STALLS at `maxNoProgressIterations` rather than converging - which is the corrected behavior.

- [ ] **Step 4: Update the test imports/symbols + fix the Section 8 expectation**

In `sidecoach/src/__tests__/t20-convergence-loop.test.ts`:
1. Update the import block to the renamed module + symbols:
```ts
import {
  runConvergenceLoop,
  computeProgressSignature,
  DEFAULT_CONVERGENCE_FLOW_CHAIN,
  DEFAULT_CONVERGENCE_MAX_GLOBAL_ITERATIONS,
  DEFAULT_CONVERGENCE_MAX_NO_PROGRESS_ITERATIONS,
  ConvergenceFinding,
  ConvergenceFlowRunner,
} from '../convergence-loop';
```
2. Replace every `runRalphLoop(` call with `runConvergenceLoop(`, every `RalphFinding`/`RalphFlowRunner` type with `ConvergenceFinding`/`ConvergenceFlowRunner`, every `DEFAULT_RALPH_*` with `DEFAULT_CONVERGENCE_*`, and the final summary log labels `t20-ralph-loop` -> `t20-convergence-loop`. Update Section 7's expected log-line substring `'[ralph]'` -> `'[convergence]'` (the `iter1Line.startsWith('[convergence]')` assertion). Update Section 1's `CONVERGED in 1 iter` / `found 0 violations` assertions - those log strings are unchanged except the `[ralph]` prefix becomes `[convergence]` only where the test checks `startsWith('[ralph]')`.
3. **Section 8 expectation fix.** Replace the Section 8 body (the "Runner throw is isolated ... still converged because findings still total 0" block) with the corrected expectation - a runner throw can NO LONGER converge:
```ts
  // === Section 8: Runner throw can NO LONGER converge (truthful convergence) ===
  {
    const cap = makeCaptureLogger();
    let invocations = 0;
    const runFlow: ConvergenceFlowRunner = async ({ flowId }) => {
      invocations++;
      if (flowId === 'flowK_multi_lens_audit') throw new Error('synthetic-runner-failure');
      return { findings: [] };   // polish + critique find nothing; audit throws every pass
    };
    const result = await runConvergenceLoop('/tmp/runner-throw-target', { runFlow, logger: cap.logger });
    expect(
      'runner-throw: does NOT converge (a flow error blocks convergence)',
      result.status !== 'converged',
      `${result.status}`,
    );
    expect(
      'runner-throw: stalls because the same error repeats with no progress',
      result.status === 'stalled',
      `${result.status}`,
    );
    expect(
      'runner-throw: error line logged for the throwing flow',
      cap.lines.some((l) => l.includes('runner threw') && l.includes('flowK_multi_lens_audit')),
      cap.lines.join('\n'),
    );
    const auditRecord = result.history[0]?.flowResults.find((fr) => fr.flowId === 'flowK_multi_lens_audit');
    expect(
      'runner-throw: error recorded on the iteration flow result',
      !!auditRecord && typeof auditRecord.error === 'string',
      JSON.stringify(auditRecord),
    );
  }
```
4. Update Section 12 (`defaults: ...`) to the renamed `DEFAULT_CONVERGENCE_*` constants and `DEFAULT_CONVERGENCE_FLOW_CHAIN`.

- [ ] **Step 5: Run the renamed test to verify it passes**

Run: `cd sidecoach && npx ts-node src/__tests__/t20-convergence-loop.test.ts`
Expected: final lines `t20-convergence-loop: <N>/<N> passed` then `t20-convergence-loop PASS` (exit 0). If Section 8 still reports `converged`, the semantic fix in Step 3 was not applied.

- [ ] **Step 6: Fix the stale path comment in the frozen modes.ts (optional, low-risk)**

In `sidecoach/src/modes.ts:151`, update the comment reference `sidecoach/src/ralph-loop.ts` -> `sidecoach/src/convergence-loop.ts` so no dangling path remains. (`modes.ts` is the frozen MCP-legacy feed; this is a comment-only edit.)

- [ ] **Step 7: Register the renamed suite and run the full gate**

In `sidecoach/scripts/run-tests.ts`, add (this suite was NOT previously gated - now it is):
```ts
  { rel: 'src/__tests__/t20-convergence-loop.test.ts', required: true },            // P4c renamed convergence-loop diagnostic + truthful-convergence fix
```
Run: `cd sidecoach && npm test`
Expected: `run-tests: 43 suite(s) passed`

- [ ] **Step 8: Confirm no stale ralph references remain in src**

Run:
```bash
cd /Users/spare3/Documents/Github/improv/sidecoach
grep -rn "Ralph\|ralph-loop\|runRalphLoop\|DEFAULT_RALPH" src --include="*.ts" || echo "NO RALPH REFERENCES - OK"
```
Expected: `NO RALPH REFERENCES - OK` (dist artifacts under `sidecoach/dist/` are out of scope - rebuilt separately; see Deferred).

- [ ] **Step 9: Commit**

```bash
cd /Users/spare3/Documents/Github/improv
git add sidecoach/src/convergence-loop.ts sidecoach/src/__tests__/t20-convergence-loop.test.ts sidecoach/src/modes.ts sidecoach/scripts/run-tests.ts
git commit -m "refactor(lane-p4c): rename ralph-loop -> convergence-loop; a flow error can no longer converge; t20 renamed + expectation fixed"
```

---

## Deferred (explicitly NOT in P4c)

These are out of scope. Do NOT build them here.

- **Browser-evidence collector (P4b-2).** The convergence floor is met by the STATIC required rules being clean. Browser-only rules (dom/computed-style/contrast) are non-required (inconclusive). lane_converge converges WITHOUT the browser collector.
- **MCP migration (P4d), copy gating (P4e), FlowHistory publisher (P4f).**
- **Target-scoped validator discovery.** `makeProductValidator`/`collect` scan the whole `projectPath` (not the `target` glob). A lane aimed at one component can be blocked by unrelated project-wide findings. The convergence summary discloses the run `measuredScope`, so a clean claim's scope is explicit; narrowing discovery to the target (spec lines 1038-1075, the canonical target resolver) is a follow-up.
- **Per-rule (vs per-validator) coverage-plan preflight granularity.** Task 8 checks each required validator has at least one required rule whose supported source kinds intersect the target's discovered sources (spec lines 1069-1072 "at least one required measurable rule"). Per-required-rule applicable-scope evaluation (spec lines 1007-1011) is a refinement.
- **Sequence-lane start-time preflight for the other refinement lanes** (`lane_ship`, `lane_calm`, `lane_live`, `lane_delight`). Their polish step already gates on `polish-standard` via the existing P4b-1 sequence path; the policy-wide START preflight (spec lines 1018-1021) for sequence lanes is separate from P4c (which is scoped to `lane_converge`).
- **Advisory-failure display-label qualification** (`machine_checks_clean_with_advisory_warnings`, spec lines 1188-1193). P4c records `advisoryRuns` but does not yet qualify the displayed label on advisory flow ERRORS - that needs advisory flow-status capture plumbing.
- **A hard `convergence.outcome === 'error'` terminal transition.** For P4c an errored iteration is recorded (validatorErrors + signature including the normalized category) and stays resumable (`running`) until stall/cap, so it never converges - matching "neither can converge." A dedicated immediate error-termination policy is a follow-up.
- **`sidecoach/dist/*` rebuild.** The test runner uses `ts-node` on `src/`, so the suite is green without dist. Rebuilding dist (and the stale `dist/ralph-loop.*` artifacts) is a separate build commit owned by the merge step, not hand-edited here.

---

## Self-Review

Run this checklist yourself after the last task.

**1. Spec coverage:**
- Loop execution / iteration boundary (spec 355-365): Tasks 4-7 (start, advisory advance, boundary converge, boundary continue/stall/skip).
- Validators run ONCE per boundary via the lane policy, never twice (spec 357-359, 958): Task 2 (`requiredValidatorsForLane`), Task 5 (loop dispatch never calls `validatorsForStep`), Task 6 assertion (exactly 4 runs, at the boundary).
- Release floor is a lane policy, not a verbChain side effect (spec 411-412, 952-958): Tasks 2, 4, 6.
- Persisted + truthful convergence; never converge without required-clean (spec 1108-1130, 1138-1199): Task 3 (`evaluateBoundary` requires every validator clean), Task 6 (`applyConvergence` persists history/signatures; converged closes), Task 9 (real validators).
- Required-state signature = full per-validator tuple, not findings-only (spec 1155-1167): Task 3.
- Floor enablement / permanently-inconclusive preflight (spec 996-1011): Task 4 (minimal) + Task 8 (coverage-plan).
- ralph-loop -> convergence-loop rename + t20 expectation fix (spec 1262-1263, 1123-1130): Task 10.
- Closing summary GENERATED from run coverage (spec 1177-1186): Task 6 (`buildConvergedSummary`).
- Loop skip cannot bypass the boundary gate (spec 348-349, 364-365): Task 7.

**2. Placeholder scan:** The Task 5 `runIterationBoundary` placeholder throws by design and is REPLACED with the real implementation in Task 6 (a deliberate TDD step, not a shipped placeholder). Confirm no other step ships a stub. Confirm every code step shows complete code.

**3. Type/symbol consistency:** `ConvergenceState`/`RequiredValidatorState`/`ConvergenceOutcome` (lane-types) are used identically in lane-convergence.ts, lane-runner.ts, and lane-checkpoint-store.ts. `requiredValidatorsForLane`/`isLoopLane` (lane-validators), `getLanePolicy` (flow-validation-capabilities), `evaluateBoundary`/`decideProgress`/`seedConvergenceState`/`BoundaryEvaluation`/`ProgressDecision` (lane-convergence), `completeLoopStep`/`runIterationBoundary`/`loopSkipStep`/`applyConvergence`/`convergenceSurface`/`buildConvergedSummary` (lane-runner) - each new symbol has a named caller in its task: `completeLoopStep` is called from the `case 'complete'` loop dispatch (Task 5); `loopSkipStep` from the `case 'skip'` dispatch (Task 7); `runIterationBoundary`/`applyConvergence`/`convergenceSurface` from `completeLoopStep`/`loopSkipStep` (Tasks 6-7); `convergencePreflight` from orchestrator `startLane` (Task 8); the convergence module functions from `lane-runner` (Tasks 4, 6) and the unit suite (Task 3).

**4. Final gate + hard-constraint checks:**
- `cd sidecoach && npm test` -> `run-tests: 43 suite(s) passed`.
- `grep -rn "Ralph\|ralph-loop" sidecoach/src --include="*.ts"` -> no matches.
- ASCII/no-NUL on every new/modified source file:
```bash
cd /Users/spare3/Documents/Github/improv
python3 - <<'PY'
import subprocess
files = subprocess.check_output(['git','diff','--name-only','main...HEAD']).decode().split()
bad=False
for f in files:
    try: b=open(f,'rb').read()
    except: continue
    nul=b.count(b'\x00')
    dash=[hex(c) for c in (0x2013,0x2014,0x2012,0x2015,0x2212) if chr(c).encode('utf-8') in b]
    if nul or dash: print('VIOLATION',f,'NUL',nul,'dashes',dash); bad=True
print('clean' if not bad else 'FOUND VIOLATIONS')
PY
```
Expected: `clean`.
- Confirm every commit used path-specific `git add` (no `git add -A`/`git add .`).
- Do NOT commit beyond the per-task commits; do NOT push. Report status to team-lead.
