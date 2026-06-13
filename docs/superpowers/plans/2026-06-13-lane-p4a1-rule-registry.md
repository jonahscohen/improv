# Product Rule Registry + Clean-Evaluation Model (Phase 4a-1) Implementation Plan - v2

## What changed in v2 (Codex review `task-mqcyq1jw` - no P0; folds 8 P1 + 3 P2). BINDING:

- **Evaluator (P1-1/2/3):** `evaluateCleanPolicy` now materializes a `ProductFinding` for every effective FAIL (preserved for EVERY status, incl. clean), iterates EVERY `policy.requiredRuleIds` so a MISSING or coverage-gapped required rule becomes `inconclusive` (never silently clean), returns the EFFECTIVE rule set, and consumes a run-derived `coverageSatisfiedRuleIds` keyed to `requiredCoverageByScope`. (Rewritten in Task 5.)
- **Types (P1-4/5):** `ProductRuleDefinition` gains `sourceVocabulary` + `sourceSeverity` (so the `--check` severity-divergence guard is implementable) and an OPTIONAL `checkProduct?` (attached in P4a-2). `ProductValidatorRegistration` gains an OPTIONAL `validateProduct?` (attached P4a-2). `FlowValidationCapability.capability` is GENERATED in P4a-1 (Task 4 emits it from `productValidatorIds`), not authored - the authored array in `flow-validation-capabilities.ts` is consistency-checked against the generated value by `--check`.
- **Generator derivation, EXACT (P1-6, P2-3):** Task 4 must implement these PURE functions: `requiredRuleIds` = owned rules where `evidenceRequirements.every(e => !['dom','computed-style','contrast'].includes(e))` (DOM/computed/contrast-only -> owned-but-non-required); per required rule, `requiredCoverageByScope` record = `{ruleId, scope, supportedEvidenceAlternatives: supportedSourceKinds.filter(s=>s.level!=='none').map(s=>s.kind), requireAllDiscoveredApplicableFiles: scope==='file'||scope==='project'}`; `toleratedFindingCounts` emits an EXPLICIT `0` for every owned blocking `(severity,findingClass)` pair (not `{}`); `blockingSeverities=['blocker','major']`.
- **Generator guards + negative tests (P1-7):** expose pure `validateRegistry()` + `deriveValidator()` functions; Task 4's test has FAILING-FIRST fixtures for EACH rejection: empty `requiredRuleIds`, a gating rule missing metadata, a `canonicalRuleKey` with two owners, a source alias mapped to two canonical keys, a coverage record whose alternatives can't satisfy a required rule's `evidenceRequirements`, and a rule whose `SEVERITY_TABLE[sourceSeverity]` != `severity` WITHOUT `severityOverrideReason`.
- **Full seed, NO placeholder (P1-8, P2-1):** Task 2 spells out all 6 seed `ProductRuleDefinition`s completely (no 'author the rest in the same shape'). Alias semantics CORRECTED: the 22 POLISH rules are 22 SEMANTIC rules; each canonical rule's `sourceRuleAliases` are the cross-registry duplicate ids for the SAME semantic (polish-standard id + extended-domain `POLISH_0NN`) -> 22 canonical rules, ~2 aliases each (NOT all-22 -> one). Tests assert representative cross-registry aliasing AND conflicting-alias rejection.
- **Capability test rigor (P2-2):** assert EXACT generated `capability` equality (`product_validator` iff `productValidatorIds` non-empty, else `advisory`/`none` as authored), verify a registration exists for EVERY `ownerValidatorId` in the rule registry, and verify every lane-policy member validator is classified required-or-excluded.


> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the validator IDENTITY + EVALUATION foundation: the four-status result types, a canonical declarative `product-rule-registry.ts`, the three-registry capability model (`flow-validation-capabilities.ts`), the GENERATED clean policies + `--check` drift guard, and the deterministic clean-evaluation algorithm as a pure tested function. NO execution wiring and NO adaptation of the existing 12 validators (that is P4a-2); NO lane gating (that is P4b).

**Architecture:** Per spec section 7. A `ProductRuleDefinition` is the single canonical source for each semantic rule (duplicated source ids alias one canonical key). `flow-validation-capabilities.ts` holds three registries: `ProductValidatorRegistration` (identity; some fields GENERATED from the rule registry), `FlowValidationCapability` (how a flow relates to validators), `LaneValidationPolicy` (what a lane requires to gate). A generator derives `ownedRuleIds`/`registryScope`/`supportedSourceKinds`/`cleanPolicy`/`requiredCoverageByScope` mechanically from the rule registry and checks them in; `--check` rejects drift. `evaluateCleanPolicy()` is the deterministic 7-step ordered function (spec lines 567-581) over a `ProductValidationResult`'s rule results + the generated `cleanPolicy`, with persisted, reproducible inputs.

**Scope discipline.** This sub-plan delivers the MODEL + ALGORITHM + GENERATION with a SMALL but real seed of canonical rules (enough to exercise aliasing, severity override, DOM-only-non-required, and the four-status evaluation). P4a-2 populates the full floor-validator rule set and adapts the existing validators (`polish-standard-validator.ts`, `extended-domain-validator.ts`, `domains/*`, etc.) to emit `ProductRuleResult`/`ProductValidationResult`. P4b wires `evaluateCleanPolicy` into `advanceLane` gating with the async lease/outbox durability. Do NOT pull those forward.

**Tech Stack:** TypeScript (`sidecoach/src/`), a new `scripts/generate-validators.ts` (mirrors `generate-lanes.ts`), ts-node runner via `sidecoach/scripts/run-tests.ts` SUITES (explicit, `required:true`).

---

## File Structure

**Create:**
- `sidecoach/src/product-rule-types.ts` - `CanonicalSeverity`, `NormalizedErrorCategory`, `ProductRuleDefinition`, `ProductRuleResult`, `ProductFinding`, `ProductValidationResult`, `CleanPolicy`, `RequiredCoverageRecord`. Types only, one source.
- `sidecoach/src/product-rule-registry.ts` - the canonical `ProductRuleDefinition[]` (seed set) + the severity normalization table + `getRule(canonicalRuleKey)` / `resolveSourceAlias(sourceId)`.
- `sidecoach/src/flow-validation-capabilities.ts` - the three registries (authored fields) + accessors; the GENERATED per-validator derived fields are imported from the generated file.
- `sidecoach/src/clean-evaluator.ts` - `evaluateCleanPolicy(result, policy)` deterministic 7-step function.
- `sidecoach/scripts/generate-validators.ts` - derive + write `validators.generated.ts`; `--check` mode.
- `sidecoach/src/validators.generated.ts` - GENERATED ownedRuleIds/registryScope/supportedSourceKinds/cleanPolicy/requiredCoverageByScope per validator (DO NOT EDIT BY HAND).
- Tests: `product-rule-registry.test.ts`, `flow-validation-capabilities.test.ts`, `clean-evaluator.test.ts`, `generate-validators.test.ts`.

**Modify:**
- `sidecoach/scripts/run-tests.ts` - register each new suite `required:true`.

**Read-only references:** spec section 7 lines 367-634 (registries, ProductRuleDefinition, severity table, ProductValidationResult, cleanPolicy, the 7-step algorithm); the source-vocabulary validators (`polish-standard-validator.ts:5-16`, `absolute-ban-detector.ts:28-38`, `linguistic-ban-validator.ts:33-42`, `taste-validator.ts:8-19`) for the severity-mapping seed only - do NOT modify them here.

---

## Setup

- [ ] **Step 0.1: Branch + dirty snapshot**

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git checkout -b lane-p4a1-rule-registry
git branch --show-current
git status --porcelain | grep -v '^??' | sort > /tmp/lane-p4a1-preexisting-dirty.txt
```

- [ ] **Step 0.2: Baseline green** - `cd sidecoach && npm run build && npm test` gives build exit 0 and `run-tests: 16 suite(s) passed`. If red, STOP.

---

## Task 1: Four-status types

**Files:** Create `product-rule-types.ts`; Test `product-rule-registry.test.ts` (type-construction smoke this task)

- [ ] **Step 1.1: Failing test**

```typescript
// sidecoach/src/__tests__/product-rule-registry.test.ts
import { CanonicalSeverity, isBlocking } from '../product-rule-types';

function run() {
  const blocker: CanonicalSeverity = 'blocker';
  if (!isBlocking(blocker, ['blocker', 'major'])) throw new Error('blocker must block under [blocker,major]');
  if (isBlocking('minor', ['blocker', 'major'])) throw new Error('minor must not block');
  if (isBlocking('advisory', ['blocker', 'major'])) throw new Error('advisory must not block');
  console.log('product-rule-types: OK');
}
run();
```

- [ ] **Step 1.2: Run, verify FAIL** - `Cannot find module '../product-rule-types'`.

- [ ] **Step 1.3: Write `product-rule-types.ts`**

```typescript
// sidecoach/src/product-rule-types.ts
export type CanonicalSeverity = 'blocker' | 'major' | 'minor' | 'advisory';
export type NormalizedErrorCategory =
  | 'unreadable_input' | 'registry_fault' | 'validator_exception' | 'rule_exception'
  | 'timeout' | 'aborted' | 'unsupported_runtime' | 'other';
export type RuleStatus = 'pass' | 'fail' | 'not_applicable' | 'inconclusive';
export type EvidenceKind = 'css-rule' | 'computed-style' | 'dom' | 'markup' | 'contrast';
export type RuleScope = 'file' | 'component' | 'page' | 'project';

export interface ProductRuleDefinition {
  ruleId: string;
  sourceRuleAliases: string[];
  canonicalRuleKey: string;
  ownerValidatorId: string;
  // Source vocabulary + severity ENABLE the --check divergence guard: --check
  // normalizes sourceSeverity via SEVERITY_TABLE and REQUIRES severityOverrideReason
  // when the normalized default != the declared canonical `severity`.
  sourceVocabulary: 'polish-extended-antipattern' | 'p012' | 'taste';   // which source scale sourceSeverity uses
  sourceSeverity: string;            // raw source value, e.g. 'critical' | 'P1' | 'error'
  severity: CanonicalSeverity;       // canonical, per-rule AUTHORITATIVE (evaluator reads only this)
  severityOverrideReason?: string;   // REQUIRED by --check when SEVERITY_TABLE[sourceSeverity] != severity
  findingClass: string;              // 'a11y' | 'theming' | 'anti-pattern' | 'copy' | 'polish' | ...
  registryScope: string;             // the user-facing claim this rule contributes to
  evidenceRequirements: EvidenceKind[];
  supportedSourceKinds: { kind: string; level: 'full' | 'partial' | 'none' }[];
  scope: RuleScope;
  narrowTargetBehavior: 'evaluate_expanded_context' | 'exclude_and_disclose' | 'reject_target';
  applicability: 'not_applicable' | 'inconclusive';   // when not applicable vs inconclusive
  // checkProduct(context) -> ProductRuleResult is OPTIONAL here and ATTACHED in
  // P4a-2 (validator adaptation). The P4a-1 registry is purely declarative.
  checkProduct?: (context: unknown) => ProductRuleResult;
}

export interface ProductRuleResult {
  ruleId: string; canonicalRuleKey: string;
  status: RuleStatus;
  normalizedErrorCategory?: NormalizedErrorCategory;   // set when an inconclusive came from a caught throw
  severity: CanonicalSeverity; findingClass: string;
  evidenceKind?: EvidenceKind; evidenceLocations: string[];
  message: string; remediation?: string;
}

export interface ProductFinding {
  validatorId: string; ruleId: string; canonicalRuleKey: string;
  severity: CanonicalSeverity; findingClass: string;
  evidenceLocations: string[]; message: string; remediation?: string;
}

export interface RequiredCoverageRecord {
  ruleId: string; scope: RuleScope;
  supportedEvidenceAlternatives: string[];
  requireAllDiscoveredApplicableFiles: boolean;
}

export interface CleanPolicy {
  requiredRuleIds: string[];
  blockingSeverities: CanonicalSeverity[];
  toleratedFindingCounts: Record<string, number>;   // key: `${severity}|${findingClass}`
  requiredCoverageByScope: RequiredCoverageRecord[];
  inconclusiveBehavior: 'block';
  notApplicableBehavior: 'exclude_and_report';
}

export interface ProductValidationResult {
  status: 'clean' | 'findings' | 'inconclusive' | 'error';
  rules: ProductRuleResult[];
  findings: ProductFinding[];
  coverage: {
    inspectedFiles: string[]; skippedFiles: string[];
    supportedSourceKinds: string[]; unsupportedSourceKinds: string[];
    ruleCounts: { pass: number; fail: number; notApplicable: number; inconclusive: number };
    findingCounts: { blockingExcess: number; withinTolerance: number; nonBlocking: number };
    measuredScope: string[]; unverifiedScope: string[];
  };
  normalizedErrorCategory?: NormalizedErrorCategory;   // REQUIRED when status === 'error'
  error?: string;
}

export function isBlocking(sev: CanonicalSeverity, blocking: CanonicalSeverity[]): boolean {
  return blocking.includes(sev);
}

// The normalization table - used ONCE at registry-authoring time to SEED severity;
// the evaluator never reads it (per-rule severity is authoritative). --check uses it
// to flag undocumented divergence (Task 4).
export const SEVERITY_TABLE: Record<string, CanonicalSeverity> = {
  critical: 'blocker', P0: 'blocker', error: 'blocker',
  high: 'major', P1: 'major',
  medium: 'minor', P2: 'minor',
  low: 'advisory',
};
```

- [ ] **Step 1.4: Run PASS + register** - add `{ rel: 'src/__tests__/product-rule-registry.test.ts', required: true },` to SUITES.

- [ ] **Step 1.5: Commit** - `git add` the type file + test + run-tests; `git commit -m "feat(lane-p4a1): four-status product-rule + clean-policy types"`.

---

## Task 2: Canonical rule registry (seed set + alias resolution)

**Files:** Create `product-rule-registry.ts`; Test extend `product-rule-registry.test.ts`

- [ ] **Step 2.1: Failing test (append)**

```typescript
// --- canonical registry + alias resolution ---
import { RULES, getRule, resolveSourceAlias } from '../product-rule-registry';
{
  // one executable definition per canonicalRuleKey (no duplicate executable keys)
  const keys = RULES.map((r) => r.canonicalRuleKey);
  if (new Set(keys).size !== keys.length) throw new Error('duplicate canonicalRuleKey - must be one executable def per key');
  // every sourceRuleAlias maps to exactly one canonical rule
  const seen = new Map();
  for (const r of RULES) for (const a of r.sourceRuleAliases) {
    if (seen.has(a)) throw new Error(`source alias ${a} maps to two canonical keys`);
    seen.set(a, r.canonicalRuleKey);
  }
  // the 22 POLISH dupes alias ONE canonical rule (seed: at least POLISH_001 aliased)
  const aliased = resolveSourceAlias('POLISH_001');
  if (!aliased) throw new Error('POLISH_001 must resolve to a canonical rule');
  if (getRule(aliased.canonicalRuleKey)?.canonicalRuleKey !== aliased.canonicalRuleKey) throw new Error('getRule round-trip failed');
  // every gating rule carries the required metadata (severity, findingClass, scope, evidenceRequirements)
  for (const r of RULES) {
    if (!r.severity || !r.findingClass || !r.scope) throw new Error(`rule ${r.ruleId} missing required metadata`);
  }
  console.log('product-rule-registry: OK');
}
```

- [ ] **Step 2.2: Run, verify FAIL** - `Cannot find module '../product-rule-registry'`.

- [ ] **Step 2.3: Write `product-rule-registry.ts` (seed canonical rules)**

Author a SEED set that exercises the model (P4a-2 fills the rest): at least (a) one Flow-J static-polish rule that canonicalizes the duplicated `POLISH_001..NNN` source ids via `sourceRuleAliases`; (b) one theming/token rule; (c) one CSS anti-pattern rule; (d) one static-a11y rule that is statically satisfiable; (e) one DOM-only a11y rule (`evidenceRequirements: ['dom']`) to exercise owned-but-non-required; (f) one absolute-ban rule DECLARING `severity: 'minor'` with `severityOverrideReason` (heuristic, non-blocking by construction).

```typescript
// sidecoach/src/product-rule-registry.ts
import type { ProductRuleDefinition } from './product-rule-types';

export const RULES: ProductRuleDefinition[] = [
  {
    ruleId: 'polish.static.contrast-token-usage',
    sourceRuleAliases: ['POLISH_001', 'EXT_POLISH_001'],   // the dupes alias one canonical rule
    canonicalRuleKey: 'polish/contrast-token-usage',
    ownerValidatorId: 'polish-standard',
    severity: 'major', findingClass: 'polish',
    registryScope: 'polished-visual-consistency',
    evidenceRequirements: ['css-rule'],
    supportedSourceKinds: [{ kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' }, { kind: 'tsx', level: 'partial' }],
    scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable',
  },
  // ... (theming, anti-pattern, static-a11y, dom-only-a11y, absolute-ban-minor) per the seed list above
];

export function getRule(canonicalRuleKey: string): ProductRuleDefinition | null {
  return RULES.find((r) => r.canonicalRuleKey === canonicalRuleKey) ?? null;
}
export function resolveSourceAlias(sourceId: string): ProductRuleDefinition | null {
  return RULES.find((r) => r.sourceRuleAliases.includes(sourceId)) ?? null;
}
```

(Author the remaining 5 seed rules in the same shape. The DOM-only rule sets `evidenceRequirements: ['dom']`; the absolute-ban rule sets `severity: 'minor', severityOverrideReason: 'heuristic pattern shapes, not certainties (absolute-ban-detector.ts:20)'`.)

- [ ] **Step 2.4: Run PASS + commit** - `git commit -m "feat(lane-p4a1): canonical product-rule registry seed (alias canonicalization, severity override)"`.

---

## Task 3: Three-registry capability model

**Files:** Create `flow-validation-capabilities.ts`; Test `flow-validation-capabilities.test.ts`

- [ ] **Step 3.1: Failing test**

```typescript
// sidecoach/src/__tests__/flow-validation-capabilities.test.ts
import { VALIDATOR_REGISTRATIONS, FLOW_CAPABILITIES, LANE_POLICIES, getValidatorRegistration } from '../flow-validation-capabilities';

function run() {
  // a validator registration exists for each ownerValidatorId in the rule registry
  const reg = getValidatorRegistration('polish-standard');
  if (!reg) throw new Error('polish-standard registration missing');
  // FlowValidationCapability.capability is product_validator iff productValidatorIds non-empty
  for (const f of FLOW_CAPABILITIES) {
    const expected = f.productValidatorIds.length > 0 ? 'product_validator' : 'advisory';
    if (f.capability !== expected && f.capability !== 'none') throw new Error(`flow ${f.flowId} capability mismatch`);
  }
  // a LaneValidationPolicy classifies every product_validator flow's validator as required or excluded
  for (const p of LANE_POLICIES) {
    if (!Array.isArray(p.requiredProductValidatorIds) || !Array.isArray(p.excludedProductValidatorIds)) throw new Error(`lane policy ${p.laneId} malformed`);
  }
  console.log('flow-validation-capabilities: OK');
}
run();
```

- [ ] **Step 3.2: Run, verify FAIL** - module missing.

- [ ] **Step 3.3: Write `flow-validation-capabilities.ts`**

```typescript
// sidecoach/src/flow-validation-capabilities.ts
import type { FlowId } from './types';

export interface ProductValidatorRegistration {
  validatorId: string;
  label: string;
  // AUTHORED: validateProduct is attached in P4a-2; here identity only.
  // GENERATED (read-only, from validators.generated.ts): ownedRuleIds, registryScope,
  // supportedSourceKinds, cleanPolicy - imported, NOT authored here.
}
export interface FlowValidationCapability {
  flowId: FlowId;
  productValidatorIds: string[];                 // AUTHORED
  capability: 'product_validator' | 'advisory' | 'none';   // GENERATED in P4a-2; authored-consistent here
}
export interface LaneValidationPolicy {
  laneId: string;
  requiredProductValidatorIds: string[];         // AUTHORED: loop gate
  excludedProductValidatorIds: string[];         // AUTHORED: member-flow validators intentionally not gating
}

export const VALIDATOR_REGISTRATIONS: ProductValidatorRegistration[] = [
  { validatorId: 'polish-standard', label: 'Polish Standard' },
  { validatorId: 'theming', label: 'Theming / Token Consistency' },
  { validatorId: 'anti-pattern', label: 'CSS Anti-Patterns' },
  { validatorId: 'static-a11y', label: 'Static Accessibility' },
];
export const FLOW_CAPABILITIES: FlowValidationCapability[] = [
  { flowId: 'flowJ_tactical_polish' as FlowId, productValidatorIds: ['polish-standard'], capability: 'product_validator' },
  // ... advisory/none flows as authored
];
export const LANE_POLICIES: LaneValidationPolicy[] = [
  { laneId: 'lane_converge', requiredProductValidatorIds: ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'], excludedProductValidatorIds: [] },
];
export function getValidatorRegistration(id: string): ProductValidatorRegistration | null {
  return VALIDATOR_REGISTRATIONS.find((v) => v.validatorId === id) ?? null;
}
```

- [ ] **Step 3.4: Run PASS + commit** - `git commit -m "feat(lane-p4a1): three-registry validator capability model"`.

---

## Task 4: Generator + `--check` (derive clean policies)

**Files:** Create `scripts/generate-validators.ts`, `src/validators.generated.ts`; Test `generate-validators.test.ts`

- [ ] **Step 4.1: Failing test**

```typescript
// sidecoach/src/__tests__/generate-validators.test.ts
import { execFileSync } from 'child_process';
import * as path from 'path';
const SC = path.resolve(__dirname, '..', '..');
function run() {
  // --check must pass on the committed generated file (no drift)
  execFileSync('npx', ['ts-node', 'scripts/generate-validators.ts', '--check'], { cwd: SC, stdio: 'pipe' });
  // the generated cleanPolicy for polish-standard is non-vacuous: requiredRuleIds non-empty
  const gen = require('../validators.generated');
  const pol = gen.GENERATED_VALIDATORS.find((v: any) => v.validatorId === 'polish-standard');
  if (!pol || pol.cleanPolicy.requiredRuleIds.length === 0) throw new Error('generated requiredRuleIds must be non-empty');
  // a DOM-only rule is owned but NOT required (surfaces inconclusive until browser evidence)
  if (pol.cleanPolicy.requiredRuleIds.some((id: string) => id.includes('dom-only'))) throw new Error('DOM-only rule must not be required');
  console.log('generate-validators: OK');
}
run();
```

- [ ] **Step 4.2: Run, verify FAIL** - generator/generated file missing.

- [ ] **Step 4.3: Write the generator**

`scripts/generate-validators.ts` derives, per `ProductValidatorRegistration`, from `RULES` (rules whose `ownerValidatorId === validatorId`):
- `ownedRuleIds` = those rules' ruleIds.
- `registryScope` = union of owned rules' `registryScope`.
- `supportedSourceKinds` = union of owned rules' `supportedSourceKinds`.
- `cleanPolicy.requiredRuleIds` = owned rules whose `evidenceRequirements` are ALL statically satisfiable (none is `dom`/`computed-style`/`contrast`-only).
- `cleanPolicy.blockingSeverities` = `['blocker','major']`.
- `cleanPolicy.toleratedFindingCounts` = `{}` (0 for every blocking pair by default).
- `cleanPolicy.requiredCoverageByScope` = one `RequiredCoverageRecord` per required rule (scope, supported-evidence alternatives, requireAllDiscoveredApplicableFiles).
- writes `src/validators.generated.ts` (`export const GENERATED_VALIDATORS = [...]`).

`--check` mode regenerates in-memory and diffs against the committed file; exits nonzero on drift. It ALSO REJECTS (per spec 628-634): empty generated `requiredRuleIds`; a gating rule lacking registry metadata; a `canonicalRuleKey` with more than one owner; a coverage plan whose alternatives cannot satisfy the required rule's declared evidence; a rule whose declared `severity` differs from `SEVERITY_TABLE` default WITHOUT a `severityOverrideReason`.

- [ ] **Step 4.4: Run PASS + register + commit** - `git commit -m "feat(lane-p4a1): validator clean-policy generator + --check drift/metadata guard"`.

---

## Task 5: Deterministic clean-evaluation algorithm

**Files:** Create `clean-evaluator.ts`; Test `clean-evaluator.test.ts`

- [ ] **Step 5.1: Failing test (the 7-step semantics, spec 567-581)**

```typescript
// sidecoach/src/__tests__/clean-evaluator.test.ts
import { evaluateCleanPolicy } from '../clean-evaluator';
import type { ProductRuleResult, CleanPolicy } from '../product-rule-types';

const policy: CleanPolicy = {
  requiredRuleIds: ['r.req'], blockingSeverities: ['blocker', 'major'],
  toleratedFindingCounts: {}, requiredCoverageByScope: [{ ruleId: 'r.req', scope: 'file', supportedEvidenceAlternatives: ['css'], requireAllDiscoveredApplicableFiles: true }],
  inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report',
};
const rule = (id: string, status: any, severity: any = 'major', findingClass = 'polish'): ProductRuleResult =>
  ({ ruleId: id, canonicalRuleKey: id, status, severity, findingClass, evidenceLocations: [], message: '' });

function run() {
  // required rule passes -> clean
  let r = evaluateCleanPolicy({ rules: [rule('r.req', 'pass')], inspectedRequiredRuleIds: ['r.req'] }, policy);
  if (r.status !== 'clean') throw new Error('all required pass -> clean');

  // required rule inconclusive -> inconclusive (step 4)
  r = evaluateCleanPolicy({ rules: [rule('r.req', 'inconclusive')], inspectedRequiredRuleIds: ['r.req'] }, policy);
  if (r.status !== 'inconclusive') throw new Error('required inconclusive -> inconclusive');

  // required rule coverage gap (not inspected) -> inconclusive (step 3)
  r = evaluateCleanPolicy({ rules: [rule('r.req', 'pass')], inspectedRequiredRuleIds: [] }, policy);
  if (r.status !== 'inconclusive') throw new Error('coverage gap -> inconclusive');

  // blocking fail over tolerance -> findings (step 6)
  r = evaluateCleanPolicy({ rules: [rule('r.req', 'fail', 'major')], inspectedRequiredRuleIds: ['r.req'] }, policy);
  if (r.status !== 'findings') throw new Error('blocking fail -> findings');

  // non-blocking (minor) fail -> clean with nonBlocking count (step 7)
  r = evaluateCleanPolicy({ rules: [rule('r.req', 'pass'), rule('x.minor', 'fail', 'minor')], inspectedRequiredRuleIds: ['r.req'] }, policy);
  if (r.status !== 'clean' || r.coverage.findingCounts.nonBlocking !== 1) throw new Error('minor fail -> clean + nonBlocking');

  // tolerated blocking fail -> clean (withinTolerance)
  const tol: CleanPolicy = { ...policy, toleratedFindingCounts: { 'major|polish': 1 } };
  r = evaluateCleanPolicy({ rules: [rule('r.req', 'pass'), rule('y.maj', 'fail', 'major')], inspectedRequiredRuleIds: ['r.req'] }, tol);
  if (r.status !== 'clean' || r.coverage.findingCounts.withinTolerance !== 1) throw new Error('tolerated blocking -> clean');

  console.log('clean-evaluator: OK');
}
run();
```

- [ ] **Step 5.2: Run, verify FAIL** - module missing.

- [ ] **Step 5.3: Implement `evaluateCleanPolicy` (the ordered 7 steps)**

```typescript
// sidecoach/src/clean-evaluator.ts
import type { ProductRuleResult, ProductFinding, CleanPolicy, ProductValidationResult, RuleStatus } from './product-rule-types';

export interface CleanEvalInput {
  validatorId: string;                       // for materialized findings
  rules: ProductRuleResult[];                // results actually produced this run (may be MISSING some required rules)
  coverageSatisfiedRuleIds: string[];        // required ruleIds whose requiredCoverageByScope record was satisfied this run
  validatorError?: { category: any; message: string };   // step 1: validator could not run at all
}

// Materialize a ProductFinding for every effective FAIL (blocking or not), so a
// clean result can still carry tolerated/non-blocking findings (spec 490-500).
function toFinding(validatorId: string, r: ProductRuleResult): ProductFinding {
  return { validatorId, ruleId: r.ruleId, canonicalRuleKey: r.canonicalRuleKey, severity: r.severity, findingClass: r.findingClass, evidenceLocations: r.evidenceLocations, message: r.message, remediation: r.remediation };
}

export function evaluateCleanPolicy(input: CleanEvalInput, policy: CleanPolicy): ProductValidationResult {
  const emptyCoverage = () => ({ inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
    ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
    findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] });

  // 1. validator-level error -> STOP.
  if (input.validatorError) return { status: 'error', rules: input.rules, findings: [], coverage: emptyCoverage(), normalizedErrorCategory: input.validatorError.category, error: input.validatorError.message };

  const required = new Set(policy.requiredRuleIds);
  const coverageOk = new Set(input.coverageSatisfiedRuleIds);
  const byId = new Map(input.rules.map((r) => [r.ruleId, r]));

  // Build the EFFECTIVE rule set over EVERY required rule (missing or
  // coverage-gapped required rules are synthesized as inconclusive, NOT ignored),
  // plus the present non-required rules.
  const effective: ProductRuleResult[] = [];
  for (const reqId of policy.requiredRuleIds) {
    const r = byId.get(reqId);
    if (!r) { effective.push({ ruleId: reqId, canonicalRuleKey: reqId, status: 'inconclusive', severity: 'major', findingClass: 'unknown', evidenceLocations: [], message: `required rule ${reqId} produced no result` }); continue; }
    if (r.status !== 'not_applicable' && !coverageOk.has(reqId)) { effective.push({ ...r, status: 'inconclusive', message: `coverage gap for required rule ${reqId}` }); continue; }
    effective.push(r);
  }
  for (const r of input.rules) if (!required.has(r.ruleId)) effective.push(r);

  // 2. non-vacuity: at least one required APPLICABLE rule after exclusions.
  const requiredApplicable = effective.filter((r) => required.has(r.ruleId) && r.status !== 'not_applicable');
  if (requiredApplicable.length === 0) return { status: 'inconclusive', rules: effective, findings: [], coverage: emptyCoverage() };

  // 3/4. any required rule inconclusive -> inconclusive.
  if (requiredApplicable.some((r) => r.status === 'inconclusive')) {
    return { status: 'inconclusive', rules: effective, findings: [], coverage: { ...emptyCoverage(), ruleCounts: ruleCounts(effective, input.rules) } };
  }

  // 5/6. materialize findings + count blocking by (severity,class) vs tolerance.
  const findings: ProductFinding[] = effective.filter((r) => r.status === 'fail').map((r) => toFinding(input.validatorId, r));
  let blockingExcess = 0, withinTolerance = 0, nonBlocking = 0;
  const counts = new Map<string, number>();
  for (const r of effective) {
    if (r.status !== 'fail') continue;
    if (!policy.blockingSeverities.includes(r.severity)) { nonBlocking++; continue; }
    const key = `${r.severity}|${r.findingClass}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, n] of counts) { const T = policy.toleratedFindingCounts[key] ?? 0; withinTolerance += Math.min(n, T); blockingExcess += Math.max(0, n - T); }

  // 7. clean unless blockingExcess > 0; findings PRESERVED for every status.
  const status: ProductValidationResult['status'] = blockingExcess > 0 ? 'findings' : 'clean';
  return { status, rules: effective, findings, coverage: { ...emptyCoverage(), ruleCounts: ruleCounts(effective, input.rules), findingCounts: { blockingExcess, withinTolerance, nonBlocking } } };
}

function ruleCounts(effective: ProductRuleResult[], raw: ProductRuleResult[]) {
  return { pass: effective.filter((x) => x.status === 'pass').length, fail: effective.filter((x) => x.status === 'fail').length,
    notApplicable: raw.filter((x) => x.status === 'not_applicable').length, inconclusive: effective.filter((x) => x.status === 'inconclusive').length };
}
```

The test (5.1) must add: a MISSING required rule (in policy.requiredRuleIds but absent from `rules`) -> inconclusive (not clean); a coverage-gapped required rule (present + pass but NOT in `coverageSatisfiedRuleIds`) -> inconclusive; a blocking fail -> `findings.length === 1` with the right `validatorId`; a clean-with-tolerated-finding -> status clean AND `findings.length === 1` (findings preserved).

- [ ] **Step 5.4: Run PASS + register + commit** - `git commit -m "feat(lane-p4a1): deterministic clean-evaluation algorithm (7-step, four-status)"`.

---

## Task 6: Final integration check

- [ ] **Step 6.1:** `cd sidecoach && npx ts-node scripts/generate-validators.ts --check && npx ts-node scripts/generate-lanes.ts --check && npm run build && npm test` -> both --checks OK; build exit 0; `run-tests: N suite(s) passed` (16 prior + product-rule-registry + flow-validation-capabilities + generate-validators + clean-evaluator = 20). Every new suite present + required.
- [ ] **Step 6.2:** P1 hook regression green (110/0, 35/0).
- [ ] **Step 6.3:** Scope check - this sub-plan touches ONLY the new files + run-tests.ts; it does NOT modify the existing validators, lane-runner, lane-checkpoint-store, or any mcp-server file. `git diff --name-only main..lane-p4a1-rule-registry | grep -E 'lane-runner|lane-checkpoint|mcp-server/|polish-standard-validator|extended-domain-validator' && echo LEAK || echo clean`.
- [ ] **Step 6.4:** No dist commit needed (no CLI/runtime path consumes these yet; P4b wires them). If `npm run build` left dist dirty, leave it uncommitted.

---

## Deferred (later P4 sub-plans)

- **P4a-2:** populate the FULL floor-validator rule set; attach `checkProduct`/`validateProduct` entry points; adapt `polish-standard-validator.ts`, `extended-domain-validator.ts`, `domains/*`, anti-pattern/a11y to emit `ProductRuleResult`/`ProductValidationResult` (four-status; absence-passes and N/A-as-passed eliminated); the static floor-validator slice modules (theming, anti-pattern, static-a11y).
- **P4b:** wire `evaluateCleanPolicy` into `advanceLane` step/iteration gating, async EXECUTE, + the lease/lock/outbox/AbortSignal durability (the folded P3).
- **P4c:** loop execution + `lane_converge` enablement gated by the release floor; ralph-loop -> convergence-loop.
- **P4d:** MCP migration (classify-intent/list-lanes/sidecoach_lane) + modes deletion + SKILL/CHEATSHEET/marketing regen.

---

## Self-Review (P2/P3 lessons applied)

- **No execution coupling:** P4a-1 is pure model + algorithm + generation; nothing here is wired into lane execution (that is P4b), so no false attestation / lease interaction to get wrong.
- **Generated, not authored:** ownedRuleIds/registryScope/supportedSourceKinds/cleanPolicy/requiredCoverageByScope are derived by the generator and `--check`-guarded (spec 601-634); the registry is the single source.
- **Honest four-status:** `clean` means accepted-under-policy, not findings-empty; consumers read `status`, not `findings.length` (spec 498-500). Missing/unsupported evidence -> `inconclusive`, never `pass` (spec 589-591).
- **Severity is per-rule authoritative;** the table seeds once; `--check` flags undocumented divergence (spec 543-561).
- **Trace to callers:** every exported fn (`getRule`, `resolveSourceAlias`, `getValidatorRegistration`, `evaluateCleanPolicy`, the generator) is consumed by a test in its own task; the generated file is consumed by Task 4's test and (later) P4a-2/P4b.
- **Reviewer watch-items:** (1) the seed rule set must be large enough to make `requiredRuleIds` non-empty AND include a DOM-only non-required rule AND a severity-override rule, or Task 4's `--check` non-vacuity guard cannot be exercised; (2) `evaluateCleanPolicy`'s step-3 coverage uses `inspectedRequiredRuleIds` as the run-derived input - P4b must supply it truthfully from the actual run; (3) `toleratedFindingCounts` key format `${severity}|${findingClass}` must match between the generator and the evaluator.
