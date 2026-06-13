# Product Rule Registry + Clean-Evaluation Model (Phase 4a-1) Implementation Plan - v3

## What changed in v3 (Codex review `task-mqcyy723` - clean rewrite; no changelog-vs-body drift)

v2 folded its fixes into a CHANGELOG block while the TASK BODIES still showed the old code, so the plan contradicted itself and Codex rejected it. v3 deletes that changelog and rewrites the task bodies so the code, the tests, and the prose all agree. Every fix now lives where the work happens:

- The evidence-compatibility model (`EVIDENCE_SOURCE_COMPATIBILITY`, `sourceKindsForEvidence`, `isStaticallySatisfiable`) is defined in Task 1 and consumed by the generator (Task 4) and the coverage guard.
- The 6 seed `ProductRuleDefinition`s are fully spelled out in Task 2 with real cross-registry aliases (polish-standard numeric id + extended-domain `POLISH_0NN`), `sourceVocabulary`, and `sourceSeverity` taken from the live validators.
- `ProductValidatorRegistration` gains optional `validateProduct?`; flow `capability` is GENERATED from an authored `baseCapability` (Task 3 authors the base + a pure `deriveCapability`; Task 4 emits and `--check`s the resolved value).
- The generator (Task 4) exports pure `validateRegistry()` / `deriveValidator()`, generates EXPLICIT zero tolerance per owned blocking `(severity,findingClass)` pair, and has failing-first negative fixtures for EACH rejection case.
- `evaluateCleanPolicy` (Task 5) materializes findings for every non-error status, CONSUMES `requiredCoverageByScope` through a real run-derived coverage input + satisfaction function, looks up the real `ProductRuleDefinition` for missing-rule synthesis (never fabricates severity), carries reproducible coverage, rejects duplicate rule results, and uses a closed-vocab `NormalizedErrorCategory` for `validatorError.category`. The Task 5 test compiles against that signature.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Build the validator IDENTITY + EVALUATION foundation: the four-status result types, a canonical declarative `product-rule-registry.ts`, the three-registry capability model (`flow-validation-capabilities.ts`), the GENERATED clean policies + `--check` drift/metadata guard, and the deterministic clean-evaluation algorithm as a pure tested function. NO execution wiring and NO adaptation of the existing 12 validators (that is P4a-2); NO lane gating (that is P4b).

**Architecture:** Per spec section 7 (lines 367-634). A `ProductRuleDefinition` is the single canonical source for each semantic rule; duplicated source ids alias one canonical key. `flow-validation-capabilities.ts` holds three registries: `ProductValidatorRegistration` (identity; per-validator derived fields are GENERATED, not authored), `FlowValidationCapability` (how a flow relates to validators; `capability` GENERATED from an authored `baseCapability`), `LaneValidationPolicy` (what a lane requires to gate). A generator derives `ownedRuleIds`/`registryScope`/`supportedSourceKinds`/`cleanPolicy`/`requiredCoverageByScope` and the resolved flow `capability` mechanically from the rule registry and checks them in; `--check` rejects drift AND invalid registries. `evaluateCleanPolicy()` is the deterministic 7-step ordered function (spec lines 567-581) over a validator run's rule results + the generated `cleanPolicy` + a run-derived coverage input, with persisted, reproducible coverage.

**Scope discipline.** This sub-plan delivers the MODEL + ALGORITHM + GENERATION with a SMALL but real seed of canonical rules (enough to exercise aliasing, severity override, DOM-only-non-required, the evidence-compatibility model, and the four-status evaluation). P4a-2 populates the full floor-validator rule set and adapts the existing validators (`polish-standard-validator.ts`, `extended-domain-validator.ts`, `domains/*`, etc.) to emit `ProductRuleResult`/`ProductValidationResult` (attaching `checkProduct`/`validateProduct`). P4b wires `evaluateCleanPolicy` into `advanceLane` gating with the async lease/outbox durability. Do NOT pull those forward.

**Tech Stack:** TypeScript (`sidecoach/src/`), a new `scripts/generate-validators.ts` (mirrors `generate-lanes.ts`), ts-node runner via `sidecoach/scripts/run-tests.ts` SUITES (explicit, `required:true`).

---

## File Structure

**Create:**
- `sidecoach/src/product-rule-types.ts` - `CanonicalSeverity`, `NormalizedErrorCategory`, `RuleStatus`, `EvidenceKind`, `RuleScope`, `ProductRuleDefinition`, `ProductRuleResult`, `ProductFinding`, `ProductValidationResult`, `CleanPolicy`, `RequiredCoverageRecord`, `SEVERITY_TABLE`, the evidence-compatibility model (`EVIDENCE_SOURCE_COMPATIBILITY`, `sourceKindsForEvidence`, `isStaticallySatisfiable`), and `isBlocking`. Types + pure helpers only, one source.
- `sidecoach/src/product-rule-registry.ts` - the canonical `ProductRuleDefinition[]` (6-rule seed) + `getRule(canonicalRuleKey)` / `getRuleById(ruleId)` / `resolveSourceAlias(sourceId)`.
- `sidecoach/src/flow-validation-capabilities.ts` - the three registries (authored fields) + accessors + the pure `deriveCapability()`; per-validator derived fields and the resolved flow `capability` are imported from the generated file.
- `sidecoach/src/clean-evaluator.ts` - `evaluateCleanPolicy(input, policy)` deterministic 7-step function + `CleanEvalInput`/`CoverageObservation`/`RunCoverage` + `isCoverageSatisfied`.
- `sidecoach/scripts/generate-validators.ts` - pure `deriveValidator()` + `validateRegistry()` + `deriveFlowCapabilities()`; writes `validators.generated.ts`; `--check` mode (drift + registry validity).
- `sidecoach/src/validators.generated.ts` - GENERATED per-validator derived fields + resolved flow capabilities (DO NOT EDIT BY HAND).
- Tests: `product-rule-registry.test.ts`, `flow-validation-capabilities.test.ts`, `clean-evaluator.test.ts`, `generate-validators.test.ts` (all under `src/__tests__/`).

**Modify:**
- `sidecoach/scripts/run-tests.ts` - register each new suite `required:true`.

**Read-only references (do NOT modify):** spec section 7 lines 367-634; the source-vocabulary validators for the seed severity mapping only:
- `polish-standard-validator.ts` (numeric ids 1-22; vocabulary `critical|high|medium|low`; e.g. id 18 Focus Visible `critical`, id 19 Reduced Motion `critical`, id 5 Minimum Hit Area `critical`).
- `extended-domain-validator.ts` (the same 22 rules repeated as `POLISH_001..022`; vocabulary `critical|high|medium|low`).
- `absolute-ban-detector.ts:28-38` (named bans; vocabulary `P0|P1|P2`; CSS-side detectors precise, HTML-structural detectors heuristic per lines 19-21).
- `linguistic-ban-validator.ts:33-42` (vocabulary `P0|P1|P2`).
- `taste-validator.ts:8-19` (vocabulary `error` only; ids like `taste/hex-in-interactive-state`).

---

## Setup

- [ ] **Step 0.1: Branch + dirty snapshot** -> verify: `git branch --show-current` prints `lane-p4a1-rule-registry`.

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git checkout -b lane-p4a1-rule-registry
git branch --show-current
git status --porcelain | grep -v '^??' | sort > /tmp/lane-p4a1-preexisting-dirty.txt
```

- [ ] **Step 0.2: Baseline green** -> verify: `cd sidecoach && npm run build && npm test` gives build exit 0 and `run-tests: 16 suite(s) passed`. If red, STOP.

---

## Task 1: Four-status types + evidence-compatibility model

**Files:** Create `product-rule-types.ts`; Test `product-rule-registry.test.ts` (type + helper smoke this task)

- [ ] **Step 1.1: Failing test**

```typescript
// sidecoach/src/__tests__/product-rule-registry.test.ts
import {
  CanonicalSeverity, EvidenceKind, isBlocking,
  EVIDENCE_SOURCE_COMPATIBILITY, sourceKindsForEvidence, isStaticallySatisfiable,
} from '../product-rule-types';

function run() {
  const blocker: CanonicalSeverity = 'blocker';
  if (!isBlocking(blocker, ['blocker', 'major'])) throw new Error('blocker must block under [blocker,major]');
  if (isBlocking('minor', ['blocker', 'major'])) throw new Error('minor must not block');
  if (isBlocking('advisory', ['blocker', 'major'])) throw new Error('advisory must not block');

  // evidence-compatibility model: browser-only evidence maps to NO static source kind
  if (EVIDENCE_SOURCE_COMPATIBILITY['dom'].length !== 0) throw new Error('dom must map to no static source kind');
  if (EVIDENCE_SOURCE_COMPATIBILITY['computed-style'].length !== 0) throw new Error('computed-style must be browser-only');
  if (EVIDENCE_SOURCE_COMPATIBILITY['contrast'].length !== 0) throw new Error('contrast must be browser-only');
  if (!EVIDENCE_SOURCE_COMPATIBILITY['css-rule'].includes('css')) throw new Error('css-rule must be satisfiable from css source');

  // a css-rule rule is statically satisfiable; a dom rule is not
  if (!isStaticallySatisfiable(['css-rule'] as EvidenceKind[])) throw new Error('css-rule must be statically satisfiable');
  if (isStaticallySatisfiable(['css-rule', 'dom'] as EvidenceKind[])) throw new Error('any dom requirement makes a rule non-statically-satisfiable');
  if (sourceKindsForEvidence(['markup'] as EvidenceKind[]).includes('css')) throw new Error('css cannot satisfy a markup-only requirement');

  console.log('product-rule-types: OK');
}
run();
```

- [ ] **Step 1.2: Run, verify FAIL** -> `Cannot find module '../product-rule-types'`.

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
export type SourceVocabulary = 'polish-extended-antipattern' | 'p012' | 'taste';

export interface SourceKindSupport { kind: string; level: 'full' | 'partial' | 'none'; }

export interface ProductRuleDefinition {
  ruleId: string;
  sourceRuleAliases: string[];        // cross-registry source ids for the SAME semantic rule
  canonicalRuleKey: string;
  ownerValidatorId: string;
  // sourceVocabulary + sourceSeverity feed the --check divergence guard: --check
  // normalizes sourceSeverity via SEVERITY_TABLE and REQUIRES severityOverrideReason
  // when the normalized default != the declared canonical `severity`.
  sourceVocabulary: SourceVocabulary;
  sourceSeverity: string;             // raw source value, e.g. 'critical' | 'P1' | 'error'
  severity: CanonicalSeverity;        // canonical, per-rule AUTHORITATIVE (evaluator reads only this)
  severityOverrideReason?: string;    // REQUIRED by --check when SEVERITY_TABLE[sourceSeverity] != severity
  findingClass: string;               // 'a11y' | 'theming' | 'anti-pattern' | 'copy' | 'polish' | ...
  registryScope: string;              // the user-facing claim this rule contributes to
  evidenceRequirements: EvidenceKind[];
  supportedSourceKinds: SourceKindSupport[];
  scope: RuleScope;
  narrowTargetBehavior: 'evaluate_expanded_context' | 'exclude_and_disclose' | 'reject_target';
  applicability: 'not_applicable' | 'inconclusive';   // disposition when the rule does not apply
  // checkProduct(context) -> ProductRuleResult is OPTIONAL here and ATTACHED in
  // P4a-2 (validator adaptation). The P4a-1 registry is purely declarative.
  checkProduct?: (context: unknown) => ProductRuleResult;
}

export interface ProductRuleResult {
  ruleId: string;
  canonicalRuleKey: string;
  status: RuleStatus;
  normalizedErrorCategory?: NormalizedErrorCategory;   // set when an inconclusive came from a caught throw / gap
  severity: CanonicalSeverity;
  findingClass: string;
  evidenceKind?: EvidenceKind;
  evidenceLocations: string[];
  message: string;
  remediation?: string;
}

export interface ProductFinding {
  validatorId: string;
  ruleId: string;
  canonicalRuleKey: string;
  severity: CanonicalSeverity;
  findingClass: string;
  evidenceLocations: string[];
  message: string;
  remediation?: string;
}

export interface RequiredCoverageRecord {
  ruleId: string;
  scope: RuleScope;
  supportedEvidenceAlternatives: string[];   // source kinds that can satisfy this rule's evidence
  requireAllDiscoveredApplicableFiles: boolean;
}

export interface CleanPolicy {
  requiredRuleIds: string[];
  blockingSeverities: CanonicalSeverity[];
  toleratedFindingCounts: Record<string, number>;   // key: `${severity}|${findingClass}`; explicit 0 per owned blocking pair
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

// The normalization table - used ONCE at registry-authoring time to SEED severity.
// The evaluator never reads it (per-rule severity is authoritative). --check uses it
// to flag undocumented divergence (Task 4).
export const SEVERITY_TABLE: Record<string, CanonicalSeverity> = {
  critical: 'blocker', P0: 'blocker', error: 'blocker',
  high: 'major', P1: 'major',
  medium: 'minor', P2: 'minor',
  low: 'advisory',
};

// EVIDENCE-COMPATIBILITY MODEL (spec lines 526-533, 608-612). Maps each evidence
// requirement to the SOURCE KINDS that can satisfy it statically. Browser-only
// evidence (dom / computed-style / contrast) maps to the EMPTY set: no static
// source kind can provide it until a browser-evidence collector exists (P4b+).
// This makes both `requiredRuleIds` derivation and the coverage satisfiability
// guard well-defined instead of prose.
export const EVIDENCE_SOURCE_COMPATIBILITY: Record<EvidenceKind, string[]> = {
  'css-rule': ['css', 'scss', 'sass', 'less', 'tsx', 'jsx', 'html', 'vue', 'svelte'],
  'markup': ['html', 'tsx', 'jsx', 'vue', 'svelte'],
  'computed-style': [],
  'dom': [],
  'contrast': [],
};

// The union of source kinds that can satisfy ALL of the given evidence requirements
// (union across requirements; a rule is satisfied if any listed kind is present for
// each requirement family it declares).
export function sourceKindsForEvidence(reqs: EvidenceKind[]): string[] {
  const set = new Set<string>();
  for (const e of reqs) for (const k of EVIDENCE_SOURCE_COMPATIBILITY[e]) set.add(k);
  return [...set];
}

// A rule is statically satisfiable iff it declares at least one evidence
// requirement and EVERY requirement has a non-empty static source-kind set
// (i.e. no dom / computed-style / contrast requirement).
export function isStaticallySatisfiable(reqs: EvidenceKind[]): boolean {
  return reqs.length > 0 && reqs.every((e) => EVIDENCE_SOURCE_COMPATIBILITY[e].length > 0);
}
```

- [ ] **Step 1.4: Run PASS + register** -> verify: test prints `product-rule-types: OK`. Add `{ rel: 'src/__tests__/product-rule-registry.test.ts', required: true },` to SUITES in `run-tests.ts`.

- [ ] **Step 1.5: Commit** -> `git add` the type file + test + run-tests; `git commit -m "feat(lane-p4a1): four-status types + evidence-compatibility model"`.

---

## Task 2: Canonical rule registry (6-rule seed + alias resolution)

**Files:** Create `product-rule-registry.ts`; Test extend `product-rule-registry.test.ts`

The seed is 6 complete `ProductRuleDefinition`s, chosen to exercise the whole model:

1. `polish.reduced-motion-respect` - Flow J static polish, owner `polish-standard`, cross-registry aliased, `css-rule`, blocker. (REQUIRED)
2. `theming.hex-in-interactive-state` - token consistency, owner `theming`, `css-rule`, blocker, single source. (REQUIRED)
3. `anti-pattern.gradient-text` - CSS-side precise ban, owner `anti-pattern`, `css-rule`, major. (REQUIRED)
4. `a11y.focus-visible` - statically satisfiable a11y, owner `static-a11y`, cross-registry aliased, `css-rule`, blocker. (REQUIRED)
5. `a11y.min-hit-area` - DOM-only a11y, owner `static-a11y`, cross-registry aliased, `dom`, blocker. (OWNED-but-NON-REQUIRED)
6. `anti-pattern.identical-card-grids` - heuristic ban, owner `anti-pattern`, `markup`, sourceSeverity `P1` but DECLARES `severity: 'minor'` with `severityOverrideReason`. (REQUIRED-but-NON-blocking)

Cross-registry alias semantics (spec lines 454-461): the 22 Polish rules are 22 SEMANTIC rules; each canonical rule lists the SAME-semantic source ids - the polish-standard numeric id (as `polish-standard:<n>`) and the extended-domain `POLISH_0NN`. So rule 4 aliases `polish-standard:18` AND `POLISH_018` (both are "Focus Visible"). It is NOT all-22-to-one.

- [ ] **Step 2.1: Failing test (append)**

```typescript
// --- canonical registry + alias resolution ---
import { RULES, getRule, getRuleById, resolveSourceAlias } from '../product-rule-registry';
import { SEVERITY_TABLE, isStaticallySatisfiable } from '../product-rule-types';
{
  // exactly one executable definition per canonicalRuleKey
  const keys = RULES.map((r) => r.canonicalRuleKey);
  if (new Set(keys).size !== keys.length) throw new Error('duplicate canonicalRuleKey - one executable def per key');

  // every source alias maps to exactly one canonical rule (no conflict in the real seed)
  const seen = new Map<string, string>();
  for (const r of RULES) for (const a of r.sourceRuleAliases) {
    if (seen.has(a)) throw new Error(`source alias ${a} maps to two canonical keys`);
    seen.set(a, r.canonicalRuleKey);
  }

  // representative CROSS-REGISTRY aliasing: the polish-standard numeric id and the
  // extended-domain POLISH_0NN both resolve to the SAME canonical rule.
  const byNum = resolveSourceAlias('polish-standard:18');
  const byExt = resolveSourceAlias('POLISH_018');
  if (!byNum || !byExt) throw new Error('focus-visible aliases must resolve');
  if (byNum.canonicalRuleKey !== byExt.canonicalRuleKey) throw new Error('cross-registry aliases must resolve to ONE canonical rule');
  if (byNum.canonicalRuleKey !== 'a11y/focus-visible') throw new Error('focus-visible canonical key mismatch');

  // getRule / getRuleById round-trip
  if (getRule(byNum.canonicalRuleKey)?.canonicalRuleKey !== 'a11y/focus-visible') throw new Error('getRule round-trip failed');
  if (getRuleById('a11y.focus-visible')?.canonicalRuleKey !== 'a11y/focus-visible') throw new Error('getRuleById round-trip failed');

  // every rule carries required metadata
  for (const r of RULES) {
    if (!r.ruleId || !r.canonicalRuleKey || !r.ownerValidatorId || !r.severity || !r.findingClass || !r.scope) {
      throw new Error(`rule ${r.ruleId || '(no id)'} missing required metadata`);
    }
  }

  // the seed exercises the model: a DOM-only owned-non-required rule + a declared severity override
  const domOnly = getRuleById('a11y.min-hit-area');
  if (!domOnly || isStaticallySatisfiable(domOnly.evidenceRequirements)) throw new Error('a11y.min-hit-area must be DOM-only (not statically satisfiable)');
  const override = getRuleById('anti-pattern.identical-card-grids');
  if (!override || override.severity !== 'minor' || !override.severityOverrideReason) throw new Error('identical-card-grids must declare a minor override with a reason');
  if (SEVERITY_TABLE[override.sourceSeverity] === override.severity) throw new Error('override rule must diverge from the table default');

  console.log('product-rule-registry: OK');
}
```

- [ ] **Step 2.2: Run, verify FAIL** -> `Cannot find module '../product-rule-registry'`.

- [ ] **Step 2.3: Write `product-rule-registry.ts` (all 6 seed rules in full)**

```typescript
// sidecoach/src/product-rule-registry.ts
import type { ProductRuleDefinition } from './product-rule-types';

export const RULES: ProductRuleDefinition[] = [
  // 1. Flow J static polish - owner polish-standard - REQUIRED (css-rule, blocker).
  //    Source: polish-standard id 19 ('critical') and extended-domain POLISH_019.
  {
    ruleId: 'polish.reduced-motion-respect',
    sourceRuleAliases: ['polish-standard:19', 'POLISH_019'],
    canonicalRuleKey: 'polish/reduced-motion-respect',
    ownerValidatorId: 'polish-standard',
    sourceVocabulary: 'polish-extended-antipattern',
    sourceSeverity: 'critical',
    severity: 'blocker',
    findingClass: 'polish',
    registryScope: 'polished-motion-respect',
    evidenceRequirements: ['css-rule'],
    supportedSourceKinds: [
      { kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' },
      { kind: 'less', level: 'full' }, { kind: 'tsx', level: 'partial' },
      { kind: 'html', level: 'partial' },
    ],
    scope: 'file',
    narrowTargetBehavior: 'evaluate_expanded_context',
    applicability: 'not_applicable',
  },

  // 2. Token consistency - owner theming - REQUIRED (css-rule, blocker). Single
  //    source: taste/hex-in-interactive-state ('error'). No cross-registry dup.
  {
    ruleId: 'theming.hex-in-interactive-state',
    sourceRuleAliases: ['taste/hex-in-interactive-state'],
    canonicalRuleKey: 'theming/token-driven-interactive-state',
    ownerValidatorId: 'theming',
    sourceVocabulary: 'taste',
    sourceSeverity: 'error',
    severity: 'blocker',
    findingClass: 'theming',
    registryScope: 'token-consistency',
    evidenceRequirements: ['css-rule'],
    supportedSourceKinds: [
      { kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' },
      { kind: 'less', level: 'full' }, { kind: 'tsx', level: 'partial' },
      { kind: 'html', level: 'partial' },
    ],
    scope: 'file',
    narrowTargetBehavior: 'evaluate_expanded_context',
    applicability: 'not_applicable',
  },

  // 3. CSS-side anti-pattern (precise detector) - owner anti-pattern - REQUIRED
  //    (css-rule, major). Source: absolute-ban gradient-text ('P1' -> table major).
  {
    ruleId: 'anti-pattern.gradient-text',
    sourceRuleAliases: ['ban/gradient-text'],
    canonicalRuleKey: 'anti-pattern/gradient-text',
    ownerValidatorId: 'anti-pattern',
    sourceVocabulary: 'p012',
    sourceSeverity: 'P1',
    severity: 'major',
    findingClass: 'anti-pattern',
    registryScope: 'named-ban-compliance',
    evidenceRequirements: ['css-rule'],
    supportedSourceKinds: [
      { kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' },
      { kind: 'less', level: 'full' }, { kind: 'html', level: 'partial' },
    ],
    scope: 'file',
    narrowTargetBehavior: 'evaluate_expanded_context',
    applicability: 'not_applicable',
  },

  // 4. Statically satisfiable a11y - owner static-a11y - REQUIRED (css-rule,
  //    blocker). Source: polish-standard id 18 ('critical') + extended POLISH_018.
  {
    ruleId: 'a11y.focus-visible',
    sourceRuleAliases: ['polish-standard:18', 'POLISH_018'],
    canonicalRuleKey: 'a11y/focus-visible',
    ownerValidatorId: 'static-a11y',
    sourceVocabulary: 'polish-extended-antipattern',
    sourceSeverity: 'critical',
    severity: 'blocker',
    findingClass: 'a11y',
    registryScope: 'keyboard-accessibility-floor',
    evidenceRequirements: ['css-rule'],
    supportedSourceKinds: [
      { kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' },
      { kind: 'less', level: 'full' }, { kind: 'tsx', level: 'partial' },
      { kind: 'html', level: 'partial' },
    ],
    scope: 'file',
    narrowTargetBehavior: 'evaluate_expanded_context',
    applicability: 'not_applicable',
  },

  // 5. DOM-only a11y - owner static-a11y - OWNED but NON-REQUIRED (dom evidence
  //    has no static source kind; surfaces inconclusive until a browser collector).
  //    Source: polish-standard id 5 ('critical') + extended POLISH_005.
  {
    ruleId: 'a11y.min-hit-area',
    sourceRuleAliases: ['polish-standard:5', 'POLISH_005'],
    canonicalRuleKey: 'a11y/min-hit-area',
    ownerValidatorId: 'static-a11y',
    sourceVocabulary: 'polish-extended-antipattern',
    sourceSeverity: 'critical',
    severity: 'blocker',
    findingClass: 'a11y',
    registryScope: 'touch-target-floor',
    evidenceRequirements: ['dom'],
    supportedSourceKinds: [
      { kind: 'dom', level: 'full' }, { kind: 'tsx', level: 'none' },
      { kind: 'html', level: 'none' },
    ],
    scope: 'component',
    narrowTargetBehavior: 'evaluate_expanded_context',
    applicability: 'inconclusive',
  },

  // 6. Heuristic anti-pattern with a DECLARED severity override - owner
  //    anti-pattern - REQUIRED (markup) but NON-blocking by construction. Source:
  //    absolute-ban identical-card-grids ('P1' -> table major) DECLARED minor.
  {
    ruleId: 'anti-pattern.identical-card-grids',
    sourceRuleAliases: ['ban/identical-card-grids'],
    canonicalRuleKey: 'anti-pattern/identical-card-grids',
    ownerValidatorId: 'anti-pattern',
    sourceVocabulary: 'p012',
    sourceSeverity: 'P1',
    severity: 'minor',
    severityOverrideReason:
      'HTML-structural detector flags pattern shapes, not certainties; false positives are possible (absolute-ban-detector.ts:19-21). Demoted from the table default major to non-blocking minor.',
    findingClass: 'anti-pattern',
    registryScope: 'named-ban-compliance',
    evidenceRequirements: ['markup'],
    supportedSourceKinds: [
      { kind: 'html', level: 'full' }, { kind: 'tsx', level: 'partial' },
      { kind: 'jsx', level: 'partial' }, { kind: 'vue', level: 'partial' },
      { kind: 'svelte', level: 'partial' },
    ],
    scope: 'page',
    narrowTargetBehavior: 'evaluate_expanded_context',
    applicability: 'not_applicable',
  },
];

export function getRule(canonicalRuleKey: string): ProductRuleDefinition | null {
  return RULES.find((r) => r.canonicalRuleKey === canonicalRuleKey) ?? null;
}
export function getRuleById(ruleId: string): ProductRuleDefinition | null {
  return RULES.find((r) => r.ruleId === ruleId) ?? null;
}
export function resolveSourceAlias(sourceId: string): ProductRuleDefinition | null {
  return RULES.find((r) => r.sourceRuleAliases.includes(sourceId)) ?? null;
}
```

- [ ] **Step 2.4: Run PASS + commit** -> verify: `product-rule-registry: OK`. `git commit -m "feat(lane-p4a1): canonical product-rule registry seed (cross-registry aliasing, severity override)"`.

Note: conflicting-alias REJECTION (the negative case) is exercised by `validateRegistry` in Task 4 against a bad fixture; the real seed is clean, so Task 2 asserts the positive invariant (every alias resolves to exactly one canonical rule).

---

## Task 3: Three-registry capability model

**Files:** Create `flow-validation-capabilities.ts`; Test `flow-validation-capabilities.test.ts`

Authored fields only. `capability` is GENERATED: this file authors `baseCapability` (distinguishing an empty flow that is `advisory` from one that is `none`) plus a pure `deriveCapability(flow)`; Task 4 emits the resolved value to `validators.generated.ts` and `--check` asserts file-level equality. Per-validator derived fields (`ownedRuleIds`, `registryScope`, `supportedSourceKinds`, `cleanPolicy`) are imported from the generated file (consumed by P4a-2/P4b), never authored here.

- [ ] **Step 3.1: Failing test**

```typescript
// sidecoach/src/__tests__/flow-validation-capabilities.test.ts
import {
  VALIDATOR_REGISTRATIONS, FLOW_CAPABILITIES, LANE_POLICIES,
  getValidatorRegistration, deriveCapability,
} from '../flow-validation-capabilities';
import { RULES } from '../product-rule-registry';

function run() {
  // a registration exists for EVERY ownerValidatorId in the rule registry
  for (const ownerId of new Set(RULES.map((r) => r.ownerValidatorId))) {
    if (!getValidatorRegistration(ownerId)) throw new Error(`missing registration for owner ${ownerId}`);
  }

  // deriveCapability matches the spec formula EXACTLY for every authored flow
  for (const f of FLOW_CAPABILITIES) {
    const expected = f.productValidatorIds.length > 0 ? 'product_validator' : f.baseCapability;
    if (deriveCapability(f) !== expected) throw new Error(`flow ${f.flowId} capability formula mismatch`);
  }
  // the three resolved capabilities are all represented in the seed
  const caps = new Set(FLOW_CAPABILITIES.map(deriveCapability));
  if (!caps.has('product_validator') || !caps.has('advisory') || !caps.has('none')) {
    throw new Error('seed must exercise product_validator, advisory, and none');
  }

  // every lane-policy member validator is classified (required or excluded) AND registered
  for (const p of LANE_POLICIES) {
    if (!Array.isArray(p.requiredProductValidatorIds) || !Array.isArray(p.excludedProductValidatorIds)) {
      throw new Error(`lane policy ${p.laneId} malformed`);
    }
    for (const v of [...p.requiredProductValidatorIds, ...p.excludedProductValidatorIds]) {
      if (!getValidatorRegistration(v)) throw new Error(`lane policy ${p.laneId} references unregistered validator ${v}`);
    }
  }
  console.log('flow-validation-capabilities: OK');
}
run();
```

- [ ] **Step 3.2: Run, verify FAIL** -> module missing.

- [ ] **Step 3.3: Write `flow-validation-capabilities.ts`**

```typescript
// sidecoach/src/flow-validation-capabilities.ts
import type { FlowId } from './types';
import type { ProductValidationResult } from './product-rule-types';

export interface ProductValidatorRegistration {
  validatorId: string;
  label: string;
  // AUTHORED here is identity ONLY. validateProduct is attached in P4a-2; the
  // GENERATED per-validator fields (ownedRuleIds, registryScope,
  // supportedSourceKinds, cleanPolicy) live in validators.generated.ts.
  validateProduct?: (context: unknown) => ProductValidationResult;
}

export interface FlowValidationCapability {
  flowId: FlowId;
  productValidatorIds: string[];                 // AUTHORED: validators bound to this flow's step (may be empty)
  baseCapability: 'advisory' | 'none';           // AUTHORED: disposition WHEN no product validator is bound
}

export interface LaneValidationPolicy {
  laneId: string;
  requiredProductValidatorIds: string[];         // AUTHORED: loop gate
  excludedProductValidatorIds: string[];         // AUTHORED: member-flow validators intentionally not gating
}

// The single derivation rule for a flow's capability (spec lines 391-393). The
// generator emits the resolved value to validators.generated.ts and --check
// asserts file-level equality; this pure function is the contract both sides use.
export function deriveCapability(f: FlowValidationCapability): 'product_validator' | 'advisory' | 'none' {
  return f.productValidatorIds.length > 0 ? 'product_validator' : f.baseCapability;
}

export const VALIDATOR_REGISTRATIONS: ProductValidatorRegistration[] = [
  { validatorId: 'polish-standard', label: 'Polish Standard' },
  { validatorId: 'theming', label: 'Theming / Token Consistency' },
  { validatorId: 'anti-pattern', label: 'CSS Anti-Patterns' },
  { validatorId: 'static-a11y', label: 'Static Accessibility' },
];

export const FLOW_CAPABILITIES: FlowValidationCapability[] = [
  { flowId: 'flowJ_tactical_polish' as FlowId, productValidatorIds: ['polish-standard'], baseCapability: 'none' },
  { flowId: 'flowI_accessibility' as FlowId, productValidatorIds: ['static-a11y'], baseCapability: 'none' },
  { flowId: 'flowB_component_research' as FlowId, productValidatorIds: [], baseCapability: 'advisory' },
  { flowId: 'flowA_brand_verify' as FlowId, productValidatorIds: [], baseCapability: 'none' },
];

export const LANE_POLICIES: LaneValidationPolicy[] = [
  {
    laneId: 'lane_converge',
    requiredProductValidatorIds: ['polish-standard', 'theming', 'anti-pattern', 'static-a11y'],
    excludedProductValidatorIds: [],
  },
];

export function getValidatorRegistration(id: string): ProductValidatorRegistration | null {
  return VALIDATOR_REGISTRATIONS.find((v) => v.validatorId === id) ?? null;
}
```

- [ ] **Step 3.4: Run PASS + register + commit** -> verify: `flow-validation-capabilities: OK`. Add the suite to `run-tests.ts`; `git commit -m "feat(lane-p4a1): three-registry validator capability model (generated capability via baseCapability)"`.

---

## Task 4: Generator + `--check` (derive clean policies, validate registry)

**Files:** Create `scripts/generate-validators.ts`, `src/validators.generated.ts`; Test `generate-validators.test.ts`

- [ ] **Step 4.1: Failing test (positive + failing-first negative fixtures for EACH rejection)**

```typescript
// sidecoach/src/__tests__/generate-validators.test.ts
import { execFileSync } from 'child_process';
import * as path from 'path';
import { deriveValidator, validateRegistry } from '../../scripts/generate-validators';
import type { ProductRuleDefinition } from '../product-rule-types';
import type { ProductValidatorRegistration } from '../flow-validation-capabilities';

const SC = path.resolve(__dirname, '..', '..');

// minimal valid rule template; tweak per fixture
const baseRule = (over: Partial<ProductRuleDefinition>): ProductRuleDefinition => ({
  ruleId: 'x.rule', sourceRuleAliases: [], canonicalRuleKey: 'x/rule', ownerValidatorId: 'v',
  sourceVocabulary: 'p012', sourceSeverity: 'P1', severity: 'major', findingClass: 'anti-pattern',
  registryScope: 'scope', evidenceRequirements: ['css-rule'],
  supportedSourceKinds: [{ kind: 'css', level: 'full' }],
  scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable',
  ...over,
});
const reg = (id: string): ProductValidatorRegistration => ({ validatorId: id, label: id });
const expectInvalid = (label: string, rules: ProductRuleDefinition[], regs: ProductValidatorRegistration[]) => {
  const res = validateRegistry(rules, regs);
  if (res.ok) throw new Error(`${label}: validateRegistry should have FAILED but passed`);
};

function run() {
  // --check passes on the committed generated file (no drift) AND the real registry is valid
  execFileSync('npx', ['ts-node', 'scripts/generate-validators.ts', '--check'], { cwd: SC, stdio: 'pipe' });

  // generated cleanPolicy for polish-standard is non-vacuous
  const gen = require('../validators.generated');
  const pol = gen.GENERATED_VALIDATORS.find((v: any) => v.validatorId === 'polish-standard');
  if (!pol || pol.cleanPolicy.requiredRuleIds.length === 0) throw new Error('generated requiredRuleIds must be non-empty');

  // the DOM-only rule is OWNED by static-a11y but NOT required
  const a11y = gen.GENERATED_VALIDATORS.find((v: any) => v.validatorId === 'static-a11y');
  if (!a11y.ownedRuleIds.includes('a11y.min-hit-area')) throw new Error('static-a11y must OWN the dom-only rule');
  if (a11y.cleanPolicy.requiredRuleIds.includes('a11y.min-hit-area')) throw new Error('DOM-only rule must NOT be required');

  // toleratedFindingCounts is EXPLICIT 0 per owned blocking (severity,class) pair (not {})
  if (Object.keys(a11y.cleanPolicy.toleratedFindingCounts).length === 0) throw new Error('tolerated counts must be explicit, not empty');
  if (a11y.cleanPolicy.toleratedFindingCounts['blocker|a11y'] !== 0) throw new Error('explicit 0 expected for blocker|a11y');

  // deriveValidator is pure: an all-dom-only owner yields EMPTY requiredRuleIds
  const domOwner = deriveValidator(reg('v'), [baseRule({ ruleId: 'v.dom', canonicalRuleKey: 'v/dom', ownerValidatorId: 'v', evidenceRequirements: ['dom'], supportedSourceKinds: [{ kind: 'dom', level: 'full' }] })]);
  if (domOwner.cleanPolicy.requiredRuleIds.length !== 0) throw new Error('all-dom-only owner must derive empty requiredRuleIds');

  // --- failing-first negative fixtures, ONE per rejection case (spec 628-634) ---
  // 1. empty requiredRuleIds (only owned rule is dom-only)
  expectInvalid('empty-required', [baseRule({ ruleId: 'v.dom', canonicalRuleKey: 'v/dom', evidenceRequirements: ['dom'], supportedSourceKinds: [{ kind: 'dom', level: 'full' }] })], [reg('v')]);
  // 2. missing metadata (no findingClass)
  expectInvalid('missing-metadata', [baseRule({ findingClass: '' as any })], [reg('v')]);
  // 3. canonicalRuleKey with two owners (same key, different ownerValidatorId)
  expectInvalid('two-owners', [baseRule({ ruleId: 'a', canonicalRuleKey: 'dup/key', ownerValidatorId: 'v' }), baseRule({ ruleId: 'b', canonicalRuleKey: 'dup/key', ownerValidatorId: 'w' })], [reg('v'), reg('w')]);
  // 4. conflicting alias (one source id mapped to two canonical keys)
  expectInvalid('conflicting-alias', [baseRule({ ruleId: 'a', canonicalRuleKey: 'k/a', sourceRuleAliases: ['DUP'] }), baseRule({ ruleId: 'b', canonicalRuleKey: 'k/b', sourceRuleAliases: ['DUP'] })], [reg('v')]);
  // 5. unsatisfiable coverage (markup evidence but only css supported)
  expectInvalid('unsatisfiable-coverage', [baseRule({ ruleId: 'v.m', canonicalRuleKey: 'v/m', evidenceRequirements: ['markup'], supportedSourceKinds: [{ kind: 'css', level: 'full' }] })], [reg('v')]);
  // 6. undocumented severity divergence (table says major, declares minor, no reason)
  expectInvalid('severity-divergence', [baseRule({ severity: 'minor' })], [reg('v')]);

  console.log('generate-validators: OK');
}
run();
```

- [ ] **Step 4.2: Run, verify FAIL** -> generator/generated file missing (cannot import `deriveValidator`/`validateRegistry`).

- [ ] **Step 4.3: Write the generator**

`scripts/generate-validators.ts` exports PURE functions (no I/O) so the test imports them directly, plus a `main()`/`--check` that does the file I/O.

```typescript
// sidecoach/scripts/generate-validators.ts
import * as fs from 'fs';
import * as path from 'path';
import {
  CleanPolicy, ProductRuleDefinition, SourceKindSupport,
  SEVERITY_TABLE, sourceKindsForEvidence, isStaticallySatisfiable,
} from '../src/product-rule-types';
import { RULES } from '../src/product-rule-registry';
import {
  VALIDATOR_REGISTRATIONS, FLOW_CAPABILITIES, ProductValidatorRegistration,
  deriveCapability,
} from '../src/flow-validation-capabilities';

const SC = path.resolve(__dirname, '..');
const OUT = path.resolve(SC, 'src', 'validators.generated.ts');
const BLOCKING: CleanPolicy['blockingSeverities'] = ['blocker', 'major'];

export interface GeneratedValidator {
  validatorId: string;
  ownedRuleIds: string[];
  registryScope: string[];
  supportedSourceKinds: SourceKindSupport[];
  cleanPolicy: CleanPolicy;
}

function dedupeSourceKinds(kinds: SourceKindSupport[]): SourceKindSupport[] {
  // strongest level wins per kind (full > partial > none)
  const rank = { full: 3, partial: 2, none: 1 } as const;
  const best = new Map<string, SourceKindSupport>();
  for (const k of kinds) {
    const cur = best.get(k.kind);
    if (!cur || rank[k.level] > rank[cur.level]) best.set(k.kind, k);
  }
  return [...best.values()].sort((a, b) => a.kind.localeCompare(b.kind));
}

// PURE: derive one validator's generated entry from the registry.
export function deriveValidator(reg: ProductValidatorRegistration, rules: ProductRuleDefinition[]): GeneratedValidator {
  const owned = rules.filter((r) => r.ownerValidatorId === reg.validatorId);
  const required = owned.filter((r) => isStaticallySatisfiable(r.evidenceRequirements));

  const requiredCoverageByScope = required.map((r) => ({
    ruleId: r.ruleId,
    scope: r.scope,
    supportedEvidenceAlternatives: r.supportedSourceKinds
      .filter((s) => s.level !== 'none')
      .map((s) => s.kind)
      .filter((k) => sourceKindsForEvidence(r.evidenceRequirements).includes(k)),
    requireAllDiscoveredApplicableFiles: r.scope === 'file' || r.scope === 'project',
  }));

  // EXPLICIT 0 tolerance for every owned blocking (severity,findingClass) pair.
  const toleratedFindingCounts: Record<string, number> = {};
  for (const r of owned) {
    if (BLOCKING.includes(r.severity)) toleratedFindingCounts[`${r.severity}|${r.findingClass}`] = 0;
  }

  const cleanPolicy: CleanPolicy = {
    requiredRuleIds: required.map((r) => r.ruleId),
    blockingSeverities: BLOCKING,
    toleratedFindingCounts,
    requiredCoverageByScope,
    inconclusiveBehavior: 'block',
    notApplicableBehavior: 'exclude_and_report',
  };

  return {
    validatorId: reg.validatorId,
    ownedRuleIds: owned.map((r) => r.ruleId),
    registryScope: [...new Set(owned.map((r) => r.registryScope))],
    supportedSourceKinds: dedupeSourceKinds(owned.flatMap((r) => r.supportedSourceKinds)),
    cleanPolicy,
  };
}

// PURE: validate the whole registry; returns { ok, errors }. --check exits nonzero
// if !ok. Covers the spec 628-634 rejection set.
export function validateRegistry(rules: ProductRuleDefinition[], regs: ProductValidatorRegistration[]): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  // missing metadata
  for (const r of rules) {
    if (!r.ruleId || !r.canonicalRuleKey || !r.ownerValidatorId || !r.severity || !r.findingClass || !r.scope || !r.evidenceRequirements?.length) {
      errors.push(`missing metadata on rule ${r.ruleId || '(no id)'}`);
    }
  }

  // canonicalRuleKey with more than one owner / definition
  const byKey = new Map<string, Set<string>>();
  for (const r of rules) {
    if (!byKey.has(r.canonicalRuleKey)) byKey.set(r.canonicalRuleKey, new Set());
    byKey.get(r.canonicalRuleKey)!.add(r.ownerValidatorId);
  }
  for (const [key, owners] of byKey) {
    const defs = rules.filter((r) => r.canonicalRuleKey === key).length;
    if (defs > 1 || owners.size > 1) errors.push(`canonicalRuleKey ${key} has more than one owner/definition`);
  }

  // conflicting alias (one source id -> two canonical keys)
  const aliasTo = new Map<string, string>();
  for (const r of rules) for (const a of r.sourceRuleAliases) {
    const prev = aliasTo.get(a);
    if (prev && prev !== r.canonicalRuleKey) errors.push(`source alias ${a} maps to two canonical keys (${prev}, ${r.canonicalRuleKey})`);
    aliasTo.set(a, r.canonicalRuleKey);
  }

  // undocumented severity divergence
  for (const r of rules) {
    const def = SEVERITY_TABLE[r.sourceSeverity];
    if (def && def !== r.severity && !r.severityOverrideReason) {
      errors.push(`rule ${r.ruleId} severity ${r.severity} diverges from table default ${def} without severityOverrideReason`);
    }
  }

  // every owner referenced by a rule has a registration
  const registered = new Set(regs.map((v) => v.validatorId));
  for (const ownerId of new Set(rules.map((r) => r.ownerValidatorId))) {
    if (!registered.has(ownerId)) errors.push(`rule owner ${ownerId} has no registration`);
  }

  // per-validator generated checks: non-empty requiredRuleIds + satisfiable coverage
  for (const reg of regs) {
    if (rules.every((r) => r.ownerValidatorId !== reg.validatorId)) continue; // no owned rules: skip
    const g = deriveValidator(reg, rules);
    if (g.cleanPolicy.requiredRuleIds.length === 0) errors.push(`validator ${reg.validatorId} has empty generated requiredRuleIds`);
    for (const c of g.cleanPolicy.requiredCoverageByScope) {
      if (c.supportedEvidenceAlternatives.length === 0) errors.push(`coverage plan for ${c.ruleId} cannot satisfy its declared evidence`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// resolved flow capabilities (generated; --check asserts file equality)
export function deriveFlowCapabilities() {
  return FLOW_CAPABILITIES.map((f) => ({ flowId: f.flowId as string, capability: deriveCapability(f) }));
}

function render(): string {
  const validators = VALIDATOR_REGISTRATIONS.map((reg) => deriveValidator(reg, RULES));
  const flows = deriveFlowCapabilities();
  return (
    `// GENERATED by sidecoach/scripts/generate-validators.ts - DO NOT EDIT BY HAND.\n` +
    `// Source: product-rule-registry.ts + flow-validation-capabilities.ts\n` +
    `import type { CleanPolicy, SourceKindSupport } from './product-rule-types';\n\n` +
    `export interface GeneratedValidator { validatorId: string; ownedRuleIds: string[]; registryScope: string[]; supportedSourceKinds: SourceKindSupport[]; cleanPolicy: CleanPolicy; }\n` +
    `export interface GeneratedFlowCapability { flowId: string; capability: 'product_validator' | 'advisory' | 'none'; }\n\n` +
    `export const GENERATED_VALIDATORS: GeneratedValidator[] = ${JSON.stringify(validators, null, 2)};\n\n` +
    `export const GENERATED_FLOW_CAPABILITIES: GeneratedFlowCapability[] = ${JSON.stringify(flows, null, 2)};\n`
  );
}

function main() {
  const check = process.argv.includes('--check');
  const { ok, errors } = validateRegistry(RULES, VALIDATOR_REGISTRATIONS);
  if (!ok) { console.error('generate-validators: INVALID registry\n' + errors.map((e) => '  - ' + e).join('\n')); process.exit(1); }
  const want = render();
  if (check) {
    const have = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf-8') : '';
    if (have !== want) { console.error(`generate-validators --check: DRIFT in ${path.relative(SC, OUT)}`); process.exit(1); }
    console.log('generate-validators --check: OK (registry valid, no drift)');
    return;
  }
  fs.writeFileSync(OUT, want);
  console.log(`generate-validators: wrote ${path.relative(SC, OUT)}`);
}

if (require.main === module) main();
```

Then run `npx ts-node scripts/generate-validators.ts` once to WRITE `src/validators.generated.ts`, and commit the generated file.

- [ ] **Step 4.4: Run PASS + register + commit** -> verify: `generate-validators: OK` and the standalone `npx ts-node scripts/generate-validators.ts --check` prints OK. Add the suite to `run-tests.ts`; `git add` generator + generated file + test + run-tests; `git commit -m "feat(lane-p4a1): validator clean-policy generator + --check drift/registry guard"`.

---

## Task 5: Deterministic clean-evaluation algorithm

**Files:** Create `clean-evaluator.ts`; Test `clean-evaluator.test.ts`

- [ ] **Step 5.1: Failing test (the 7-step semantics, spec 567-581; compiles against the real signature)**

```typescript
// sidecoach/src/__tests__/clean-evaluator.test.ts
import { evaluateCleanPolicy, isCoverageSatisfied } from '../clean-evaluator';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
import type { ProductRuleResult, CleanPolicy } from '../product-rule-types';

const REQ = 'a11y.focus-visible';   // a REAL seed rule (lets us assert real-metadata synthesis)

const policy: CleanPolicy = {
  requiredRuleIds: [REQ],
  blockingSeverities: ['blocker', 'major'],
  toleratedFindingCounts: {},
  requiredCoverageByScope: [{ ruleId: REQ, scope: 'file', supportedEvidenceAlternatives: ['css', 'scss'], requireAllDiscoveredApplicableFiles: true }],
  inconclusiveBehavior: 'block',
  notApplicableBehavior: 'exclude_and_report',
};

const run: RunCoverage = {
  inspectedFiles: ['a.css'], skippedFiles: [], supportedSourceKinds: ['css'], unsupportedSourceKinds: [],
  measuredScope: ['file:a.css'], unverifiedScope: [],
};
const satObs = (id: string): CoverageObservation => ({ ruleId: id, inspectedFiles: ['a.css'], discoveredApplicableFiles: ['a.css'], evidenceKindsPresent: ['css'] });
const gapObs = (id: string): CoverageObservation => ({ ruleId: id, inspectedFiles: [], discoveredApplicableFiles: ['a.css'], evidenceKindsPresent: ['css'] });
const rule = (id: string, status: any, severity: any = 'blocker', findingClass = 'a11y'): ProductRuleResult =>
  ({ ruleId: id, canonicalRuleKey: id, status, severity, findingClass, evidenceLocations: [], message: '' });
const input = (rules: ProductRuleResult[], obs: CoverageObservation[]) => ({ validatorId: 'static-a11y', rules, coverageObservations: obs, runCoverage: run });

function run_() {
  // satisfaction function unit check
  if (!isCoverageSatisfied(policy.requiredCoverageByScope[0], satObs(REQ))) throw new Error('satObs must satisfy');
  if (isCoverageSatisfied(policy.requiredCoverageByScope[0], gapObs(REQ))) throw new Error('gapObs must NOT satisfy');

  // required pass + satisfied coverage -> clean, with REPRODUCIBLE coverage
  let r = evaluateCleanPolicy(input([rule(REQ, 'pass')], [satObs(REQ)]), policy);
  if (r.status !== 'clean') throw new Error('all required pass -> clean');
  if (JSON.stringify(r.coverage.inspectedFiles) !== JSON.stringify(['a.css'])) throw new Error('coverage must be reproducible (inspectedFiles)');
  if (r.coverage.measuredScope[0] !== 'file:a.css') throw new Error('coverage must carry measuredScope');

  // required inconclusive -> inconclusive (step 4)
  r = evaluateCleanPolicy(input([rule(REQ, 'inconclusive')], [satObs(REQ)]), policy);
  if (r.status !== 'inconclusive') throw new Error('required inconclusive -> inconclusive');

  // coverage gap -> inconclusive (step 3)
  r = evaluateCleanPolicy(input([rule(REQ, 'pass')], [gapObs(REQ)]), policy);
  if (r.status !== 'inconclusive') throw new Error('coverage gap -> inconclusive');

  // MISSING required rule -> inconclusive AND synthesized from the REAL definition
  r = evaluateCleanPolicy(input([], []), policy);
  if (r.status !== 'inconclusive') throw new Error('missing required -> inconclusive');
  const synth = r.rules.find((x) => x.ruleId === REQ);
  if (!synth || synth.canonicalRuleKey !== 'a11y/focus-visible' || synth.severity !== 'blocker') throw new Error('synthesis must use real registry metadata, not fabricated values');

  // blocking fail -> findings, materialized with the right validatorId (step 6)
  r = evaluateCleanPolicy(input([rule(REQ, 'fail', 'blocker')], [satObs(REQ)]), policy);
  if (r.status !== 'findings' || r.findings.length !== 1 || r.findings[0].validatorId !== 'static-a11y') throw new Error('blocking fail -> findings with validatorId');

  // non-blocking (minor) fail -> clean, nonBlocking counted, finding PRESERVED (step 7 + P1-1)
  r = evaluateCleanPolicy(input([rule(REQ, 'pass'), rule('x.minor', 'fail', 'minor', 'polish')], [satObs(REQ)]), policy);
  if (r.status !== 'clean' || r.coverage.findingCounts.nonBlocking !== 1 || r.findings.length !== 1) throw new Error('minor fail -> clean + nonBlocking + preserved finding');

  // tolerated blocking fail -> clean (withinTolerance)
  const tol: CleanPolicy = { ...policy, toleratedFindingCounts: { 'major|anti-pattern': 1 } };
  r = evaluateCleanPolicy(input([rule(REQ, 'pass'), rule('y.maj', 'fail', 'major', 'anti-pattern')], [satObs(REQ)]), tol);
  if (r.status !== 'clean' || r.coverage.findingCounts.withinTolerance !== 1) throw new Error('tolerated blocking -> clean');

  // duplicate required-rule results -> inconclusive (NEW P2: not silently collapsed)
  r = evaluateCleanPolicy(input([rule(REQ, 'pass'), rule(REQ, 'pass')], [satObs(REQ)]), policy);
  if (r.status !== 'inconclusive') throw new Error('duplicate required result -> inconclusive');

  console.log('clean-evaluator: OK');
}
run_();
```

- [ ] **Step 5.2: Run, verify FAIL** -> module missing.

- [ ] **Step 5.3: Implement `evaluateCleanPolicy` (the ordered 7 steps)**

```typescript
// sidecoach/src/clean-evaluator.ts
import type {
  ProductRuleResult, ProductFinding, CleanPolicy, ProductValidationResult,
  RequiredCoverageRecord, NormalizedErrorCategory,
} from './product-rule-types';
import { getRuleById } from './product-rule-registry';

// run-derived coverage input (P1-3): one observation per required rule attempted.
export interface CoverageObservation {
  ruleId: string;
  inspectedFiles: string[];
  discoveredApplicableFiles: string[];
  evidenceKindsPresent: string[];   // source kinds actually present this run, e.g. ['css','html']
}

// reproducible coverage facts carried onto every result (P1: not empty).
export interface RunCoverage {
  inspectedFiles: string[];
  skippedFiles: string[];
  supportedSourceKinds: string[];
  unsupportedSourceKinds: string[];
  measuredScope: string[];
  unverifiedScope: string[];
}

export interface CleanEvalInput {
  validatorId: string;
  rules: ProductRuleResult[];                 // results actually produced (may MISS some required rules)
  coverageObservations: CoverageObservation[];
  runCoverage: RunCoverage;
  validatorError?: { category: NormalizedErrorCategory; message: string };   // step 1: validator could not run
}

// A required rule is coverage-satisfied iff (requireAllDiscovered ? inspected
// superset of discovered : inspected non-empty) AND at least one supported
// evidence alternative is present this run. Consumes requiredCoverageByScope.
export function isCoverageSatisfied(record: RequiredCoverageRecord | undefined, obs: CoverageObservation | undefined): boolean {
  if (!record || !obs) return false;
  const filesOk = record.requireAllDiscoveredApplicableFiles
    ? obs.discoveredApplicableFiles.every((f) => obs.inspectedFiles.includes(f))
    : obs.inspectedFiles.length > 0;
  const evidenceOk = record.supportedEvidenceAlternatives.some((alt) => obs.evidenceKindsPresent.includes(alt));
  return filesOk && evidenceOk;
}

function toFinding(validatorId: string, r: ProductRuleResult): ProductFinding {
  return {
    validatorId, ruleId: r.ruleId, canonicalRuleKey: r.canonicalRuleKey,
    severity: r.severity, findingClass: r.findingClass,
    evidenceLocations: r.evidenceLocations, message: r.message, remediation: r.remediation,
  };
}

// Synthesize a required rule the validator did not cleanly produce. Look up the
// REAL definition for severity/findingClass/canonicalRuleKey - never fabricate a
// blocking severity. If the registry has no such rule (a generation bug --check
// would normally catch), mark inconclusive with registry_fault + a benign
// non-blocking severity (severity is immaterial for an inconclusive: step 4
// blocks on it regardless).
function synthInconclusive(reqId: string, message: string, category: NormalizedErrorCategory): ProductRuleResult {
  const def = getRuleById(reqId);
  if (def) {
    return {
      ruleId: reqId, canonicalRuleKey: def.canonicalRuleKey, status: 'inconclusive',
      normalizedErrorCategory: category, severity: def.severity, findingClass: def.findingClass,
      evidenceLocations: [], message,
    };
  }
  return {
    ruleId: reqId, canonicalRuleKey: reqId, status: 'inconclusive',
    normalizedErrorCategory: 'registry_fault', severity: 'advisory', findingClass: 'unresolved',
    evidenceLocations: [], message: `${message} (no registry definition for ${reqId})`,
  };
}

function baseCoverage(run: RunCoverage) {
  return {
    inspectedFiles: run.inspectedFiles, skippedFiles: run.skippedFiles,
    supportedSourceKinds: run.supportedSourceKinds, unsupportedSourceKinds: run.unsupportedSourceKinds,
    ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
    findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 },
    measuredScope: run.measuredScope, unverifiedScope: run.unverifiedScope,
  };
}

function ruleCounts(effective: ProductRuleResult[]) {
  return {
    pass: effective.filter((x) => x.status === 'pass').length,
    fail: effective.filter((x) => x.status === 'fail').length,
    notApplicable: effective.filter((x) => x.status === 'not_applicable').length,
    inconclusive: effective.filter((x) => x.status === 'inconclusive').length,
  };
}

export function evaluateCleanPolicy(input: CleanEvalInput, policy: CleanPolicy): ProductValidationResult {
  const run = input.runCoverage;

  // 1. validator-level error -> STOP. findings empty; coverage still reproducible.
  if (input.validatorError) {
    return {
      status: 'error', rules: input.rules, findings: [], coverage: baseCoverage(run),
      normalizedErrorCategory: input.validatorError.category, error: input.validatorError.message,
    };
  }

  const required = new Set(policy.requiredRuleIds);
  const recordById = new Map(policy.requiredCoverageByScope.map((c) => [c.ruleId, c]));
  const obsById = new Map(input.coverageObservations.map((o) => [o.ruleId, o]));

  // duplicate results are ambiguous - do NOT collapse silently via Map (NEW P2).
  const occurrence = new Map<string, number>();
  for (const r of input.rules) occurrence.set(r.ruleId, (occurrence.get(r.ruleId) ?? 0) + 1);
  const duplicated = new Set([...occurrence].filter(([, n]) => n > 1).map(([id]) => id));
  const byId = new Map(input.rules.map((r) => [r.ruleId, r]));

  // EFFECTIVE rule set over EVERY required rule (missing / duplicated /
  // coverage-gapped required rules are synthesized inconclusive, not ignored),
  // plus the present non-required rules.
  const effective: ProductRuleResult[] = [];
  for (const reqId of policy.requiredRuleIds) {
    if (duplicated.has(reqId)) { effective.push(synthInconclusive(reqId, `duplicate results for required rule ${reqId}`, 'rule_exception')); continue; }
    const r = byId.get(reqId);
    if (!r) { effective.push(synthInconclusive(reqId, `required rule ${reqId} produced no result`, 'rule_exception')); continue; }
    if (r.status === 'not_applicable') { effective.push(r); continue; }
    if (!isCoverageSatisfied(recordById.get(reqId), obsById.get(reqId))) {
      effective.push({ ...r, status: 'inconclusive', normalizedErrorCategory: r.normalizedErrorCategory ?? 'unreadable_input', message: `coverage gap for required rule ${reqId}` });
      continue;
    }
    effective.push(r);
  }
  const emittedDup = new Set<string>();
  for (const r of input.rules) {
    if (required.has(r.ruleId)) continue;
    if (duplicated.has(r.ruleId)) {
      if (emittedDup.has(r.ruleId)) continue;
      emittedDup.add(r.ruleId);
      effective.push({ ...r, status: 'inconclusive', normalizedErrorCategory: 'rule_exception', message: `duplicate results for rule ${r.ruleId}` });
      continue;
    }
    effective.push(r);
  }

  // materialize findings from EVERY effective fail, BEFORE any early return (P1-1).
  const findings: ProductFinding[] = effective.filter((r) => r.status === 'fail').map((r) => toFinding(input.validatorId, r));
  const rc = ruleCounts(effective);

  // 2. non-vacuity: at least one required APPLICABLE rule after exclusions.
  const requiredApplicable = effective.filter((r) => required.has(r.ruleId) && r.status !== 'not_applicable');
  if (requiredApplicable.length === 0) {
    return { status: 'inconclusive', rules: effective, findings, coverage: { ...baseCoverage(run), ruleCounts: rc } };
  }

  // 3/4. any required applicable rule inconclusive -> inconclusive.
  if (requiredApplicable.some((r) => r.status === 'inconclusive')) {
    return { status: 'inconclusive', rules: effective, findings, coverage: { ...baseCoverage(run), ruleCounts: rc } };
  }

  // 5/6. count blocking fails by (severity,class) vs tolerance.
  let blockingExcess = 0, withinTolerance = 0, nonBlocking = 0;
  const counts = new Map<string, number>();
  for (const r of effective) {
    if (r.status !== 'fail') continue;
    if (!policy.blockingSeverities.includes(r.severity)) { nonBlocking++; continue; }
    const key = `${r.severity}|${r.findingClass}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const [key, n] of counts) {
    const T = policy.toleratedFindingCounts[key] ?? 0;
    withinTolerance += Math.min(n, T);
    blockingExcess += Math.max(0, n - T);
  }

  // 7. clean unless blockingExcess > 0; findings PRESERVED for every status.
  const status: ProductValidationResult['status'] = blockingExcess > 0 ? 'findings' : 'clean';
  return {
    status, rules: effective, findings,
    coverage: { ...baseCoverage(run), ruleCounts: rc, findingCounts: { blockingExcess, withinTolerance, nonBlocking } },
  };
}
```

- [ ] **Step 5.4: Run PASS + register + commit** -> verify: `clean-evaluator: OK`. Add the suite to `run-tests.ts`; `git commit -m "feat(lane-p4a1): deterministic clean-evaluation algorithm (7-step, four-status, coverage-consuming)"`.

---

## Task 6: Final integration check

- [ ] **Step 6.1: Full suite + both generators clean** -> verify:

```bash
cd sidecoach
npx ts-node scripts/generate-validators.ts --check
npx ts-node scripts/generate-lanes.ts --check
npm run build
npm test
```

Both `--check`s print OK; build exit 0; `run-tests: 20 suite(s) passed` (16 prior + product-rule-registry + flow-validation-capabilities + generate-validators + clean-evaluator). Every new suite present and `required:true`.

- [ ] **Step 6.2: Hook regression green** -> verify: P1 hook regression suite passes (110/0, 35/0) unchanged.

- [ ] **Step 6.3: Scope check** -> verify: this sub-plan touches ONLY the new files + run-tests.ts; it does NOT modify the existing validators, lane-runner, lane-checkpoint-store, or any mcp-server file.

```bash
git diff --name-only main..lane-p4a1-rule-registry \
  | grep -E 'lane-runner|lane-checkpoint|mcp-server/|polish-standard-validator|extended-domain-validator|absolute-ban-detector|linguistic-ban-validator|taste-validator' \
  && echo LEAK || echo clean
```

Expect `clean`.

- [ ] **Step 6.4: dist** -> verify: no dist commit needed (no CLI/runtime path consumes these yet; P4b wires them). If `npm run build` left `dist/` dirty, leave it uncommitted.

---

## Deferred (later P4 sub-plans)

- **P4a-2:** populate the FULL floor-validator rule set; attach `checkProduct`/`validateProduct` entry points; adapt `polish-standard-validator.ts`, `extended-domain-validator.ts`, `domains/*`, anti-pattern/a11y to emit `ProductRuleResult`/`ProductValidationResult` (four-status; absence-passes and N/A-as-passed eliminated); the static floor-validator slice modules (theming, anti-pattern, static-a11y).
- **P4b:** wire `evaluateCleanPolicy` into `advanceLane` step/iteration gating; build the real `CoverageObservation`/`RunCoverage` inputs from the actual run; async EXECUTE + the lease/lock/outbox/AbortSignal durability (the folded P3).
- **P4c:** loop execution + `lane_converge` enablement gated by the release floor; ralph-loop -> convergence-loop.
- **P4d:** MCP migration (classify-intent/list-lanes/sidecoach_lane) + modes deletion + SKILL/CHEATSHEET/marketing regen.

---

## Self-Review (P2/P3 lessons applied)

- **No changelog-vs-body drift:** the v2 failure mode (a binding changelog contradicting the task bodies) is gone. The only summary is the v3 pointer, and it points AT the task bodies, which carry the actual correct code.
- **No execution coupling:** P4a-1 is pure model + algorithm + generation; nothing here is wired into lane execution (that is P4b), so no false attestation / lease interaction to get wrong.
- **Generated, not authored:** ownedRuleIds/registryScope/supportedSourceKinds/cleanPolicy/requiredCoverageByScope AND the resolved flow `capability` are derived by the generator and `--check`-guarded (spec 601-634); the registry is the single source.
- **Evidence-compatibility is a model, not prose:** `EVIDENCE_SOURCE_COMPATIBILITY` makes "statically satisfiable" and "coverage satisfiable" computable; the generator and the coverage guard read the SAME mapping, so they cannot disagree (fixes the v7 LESS/TSX mismatch class of bug).
- **Honest four-status:** `clean` means accepted-under-policy, not findings-empty; findings are materialized for every non-error status; consumers read `status`, not `findings.length` (spec 498-500). Missing/duplicate/unsupported evidence -> `inconclusive`, never `pass` (spec 589-591).
- **No fabricated identity:** missing-required-rule synthesis reads the real `ProductRuleDefinition` (`getRuleById`) for canonicalRuleKey/severity/findingClass; only a genuine registry gap falls back, and then to a benign non-blocking placeholder + `registry_fault`, never an invented `major`.
- **Reproducible decisions:** `ProductValidationResult.coverage` carries the run-derived inspectedFiles/skippedFiles/source kinds/measuredScope on every status; `validatorError.category` is the closed-vocab `NormalizedErrorCategory`.
- **Severity is per-rule authoritative;** the table seeds once; `--check` flags undocumented divergence with a required `severityOverrideReason` (spec 543-561). The seed includes one declared override (`anti-pattern.identical-card-grids`).
- **Trace to callers:** every exported fn (`getRule`, `getRuleById`, `resolveSourceAlias`, `deriveCapability`, `getValidatorRegistration`, `deriveValidator`, `validateRegistry`, `evaluateCleanPolicy`, `isCoverageSatisfied`) is consumed by a test in its own task; the generated file is consumed by Task 4's test and (later) P4a-2/P4b.
- **Reviewer watch-items:** (1) the seed must keep at least one statically-satisfiable owned rule per registered owner, one DOM-only owned-non-required rule (`a11y.min-hit-area`), and one declared severity override, or Task 4's non-vacuity and override guards cannot be exercised; (2) `evaluateCleanPolicy`'s coverage uses the run-derived `CoverageObservation` - P4b must supply it truthfully from the actual run; (3) the `${severity}|${findingClass}` tolerance key format must match between the generator (Task 4) and the evaluator (Task 5).
