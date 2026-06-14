# Partial Static Floor Rule Set + checkProduct/validateProduct Adaptation (Phase 4a-2) Implementation Plan - v2

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Every task is failing-test-first, then real implementation, then the exact verify command. No task is "done" until its verify clause passes.

**Goal:** Build ON the merged P4a-1 foundation (`product-rule-types.ts`, `product-rule-registry.ts` 6-rule seed, `flow-validation-capabilities.ts`, `validator-generation.ts`, `clean-evaluator.ts`) and deliver the STATIC-DETERMINABLE PARTIAL floor. This is not the full release floor. Browser-evidence rules remain owned-but-non-required and report `inconclusive` until P4b. Copy/linguistic gating is explicitly deferred to P4e. Three deliverables:

1. EXPAND `product-rule-registry.ts` from the 6-rule seed to the 30-rule partial-static registry slice: the 22 Polish Standard rules (each canonicalizing its cross-registry `POLISH_0NN` duplicate via `sourceRuleAliases`), split by `findingClass` across the `polish-standard` and `static-a11y` owners, plus the `theming` token slice, the `anti-pattern` CSS/markup ban slice, and the remaining `static-a11y` rule. Keep `generate-validators.ts --check` green. The five browser-only rules are represented and owned, but are non-required and unmeasured in this phase.
2. ATTACH a real four-status `checkProduct` to every `ProductRuleDefinition` and a real `validateProduct` to every `ProductValidatorRegistration`. Adapt the EXISTING validator logic (the hardened static checks already in `polish-standard-validator.ts`, the taste checks in `taste-validator.ts`, the ban detectors in `absolute-ban-detector.ts`) into pure per-rule verdicts that emit `pass | fail | not_applicable | inconclusive`. Eliminate the absence-passes (`undefined !== '0px' -> pass`) and the N/A-as-`passed: true` convention: missing, unsupported, or unreadable evidence becomes `inconclusive`, never `pass`. A thrown rule check is CAUGHT and recorded `inconclusive` + `normalizedErrorCategory`.
3. WIRE `validateProduct` to collect a target without losing discovered gaps, run `scope: 'file'` rules once per actually applicable file, aggregate their verdicts, build truthful `CoverageObservation`s and evidence-derived `RunCoverage`, and assemble a `ProductValidationResult` by calling the P4a-1 `evaluateCleanPolicy` (do NOT re-implement it). Create the clean/findings/inconclusive fixture files declared by the P4a-1 manifest and make a suite EXECUTE them.

**Out of scope (DEFERRED, do NOT pull forward):** P4b lane EXECUTION wiring (`advanceLane` calling validators), browser evidence collection, and async/lease/outbox durability; P4c loops/convergence enablement; P4d MCP/cleanup; P4e copy/linguistic gating adaptation. This plan does NOT call any validator from `lane-runner.ts`, does NOT claim browser-derived scope as measured, and does NOT invent per-pattern linguistic rules. It builds the partial-static entry points and proves them through direct unit + fixture tests only.

**Architecture.** Per spec section 7 (lines 367-634, 939-958, 1262-1310). The P4a-1 type already declared `checkProduct?` (on `ProductRuleDefinition`) and `validateProduct?` (on `ProductValidatorRegistration`) as OPTIONAL; this plan fills them in. The single source of each per-validator `cleanPolicy` / `ownedRuleIds` / `requiredRuleIds` stays the GENERATED `validators.generated.ts` (expanded by re-running the generator after the registry grows); the runtime validators READ the generated policy, they never re-derive it. Per-rule check logic is PURE (`context -> verdict`); the collection of files and the orchestration into a `ProductValidationResult` lives in a shared `run-validator.ts`. The four partial-static validators differ ONLY in which rules they own; orchestration is one shared factory `makeProductValidator(validatorId)`.

**Tech Stack:** TypeScript (`sidecoach/src/`). ts-node runner via `sidecoach/scripts/run-tests.ts` SUITES (explicit, `required:true`). No new deps.

---

## File Structure

**Create:**
- `sidecoach/src/validators/source-support-matrix.ts` - ONE source-support matrix shared by registry authoring/generation and project collection. It maps extensions to source kinds and evidence requirements to support levels; no second extension or support list is allowed.
- `sidecoach/src/validators/check-context.ts` - the per-target evidence type `ProductCheckContext`, the per-file `CollectedFile`, collection outcome types, applicability probes, the verdict subtype `RuleVerdict`, the verdict helpers (`pass`/`fail`/`notApplicable`/`inconclusive`), and `stampResult(def, verdict) -> ProductRuleResult` (stamps `ruleId`/`canonicalRuleKey`/`severity`/`findingClass` from the definition so per-rule metadata is never duplicated in a check body). Imports `product-rule-types` only; no fs.
- `sidecoach/src/validators/checks/polish-checks.ts` - the pure verdict functions for the 18 `polish-standard`-owned rules (adapted from `polish-standard-validator.ts` hardened static logic).
- `sidecoach/src/validators/checks/a11y-checks.ts` - the 3 `static-a11y`-owned rule verdicts (`focus-visible` css-rule; `min-hit-area` dom-only -> inconclusive; `color-contrast` contrast-only -> inconclusive).
- `sidecoach/src/validators/checks/theming-checks.ts` - the 2 `theming`-owned rule verdicts (adapted from `taste-validator.ts` `hex-in-interactive-state` + `border-radius-inconsistency`).
- `sidecoach/src/validators/checks/anti-pattern-checks.ts` - the 6 `anti-pattern`-owned rule verdicts (adapted from `absolute-ban-detector.ts` scanners).
- `sidecoach/src/validators/checks/index.ts` - merges the four slices into `CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict>` keyed by `canonicalRuleKey`, plus `missingCheck` (returns `inconclusive` for any unattached key).
- `sidecoach/src/validators/project-collector.ts` - recursive project discovery driven by `source-support-matrix.ts`; returns discovered, inspected, policy-skipped, unreadable, oversized, and unsupported files. A root collection failure throws to the validator-level error path. Per-file gaps remain discovered.
- `sidecoach/src/validators/run-validator.ts` - `makeProductValidator(validatorId) -> (context) => ProductValidationResult`: reads the validator's generated `cleanPolicy`/`ownedRuleIds`, collects, selects applicable evidence, executes file-scoped rules per applicable file and project-scoped rules only where semantically declared, aggregates verdicts, builds truthful `CoverageObservation`s + evidence-derived `RunCoverage`, and calls `evaluateCleanPolicy`.
- Fixtures under `sidecoach/fixtures/<validatorId>/{clean,findings,inconclusive}/` (the exact paths the P4a-1 `FIXTURE_MANIFEST` already declares).
- Tests (under `src/__tests__/`): `product-validator-pipeline.test.ts`, `polish-checks.test.ts`, `a11y-checks.test.ts`, `theming-checks.test.ts`, `anti-pattern-checks.test.ts`, `validator-fixtures-e2e.test.ts`.

**Modify:**
- `sidecoach/src/product-rule-registry.ts` - EXPAND the `RULES` array from 6 to 30 declarative definitions (Task 1), sourcing `supportedSourceKinds` from the shared matrix, then change the export so each definition carries a `checkProduct` looked up from `CHECKS` by `canonicalRuleKey` and wrapped in the throw-catch boundary (Task 2).
- `sidecoach/src/validator-generation.ts` - validate every rule's generated source-support declaration against the same shared matrix; no authored or generated support list may drift.
- `sidecoach/src/flow-validation-capabilities.ts` - attach `validateProduct: makeProductValidator(id)` to each of the four `VALIDATOR_REGISTRATIONS` entries (Task 2). Identity fields unchanged; the generated derivation is unaffected because `deriveValidator` and `JSON.stringify` read identity/owned fields only, not the attached function.
- `sidecoach/src/validators.generated.ts` - REGENERATED (committed) after Task 1 expands the registry. DO NOT hand-edit.
- `sidecoach/scripts/run-tests.ts` - register each new suite `required:true`.

**Read-only references (consume; do NOT modify their behavior):**
- `polish-standard-validator.ts` (numeric ids 1-22; vocabulary `critical|high|medium|low`; the HARDENED static fallbacks at ids 4/5/7/10/12/14/17 are the logic to port). Severities ARE the source for the table below.
- `extended-domain-validator.ts:180-529` (the same 22 rules repeated `POLISH_001..022`; same names + severities; these are the cross-registry `sourceRuleAliases`).
- `absolute-ban-detector.ts` (the 6 named bans, raw `banName` strings at the `findingFromBan(...)` call sites lines 95/110/140/159/171/184; CSS-side detectors precise -> blocking; HTML-structural detectors heuristic per lines 19-21 -> declared non-blocking).
- `taste-validator.ts` (vocabulary `error`; `ruleId: 'taste/hex-in-interactive-state'` line 242, `ruleId: 'taste/border-radius-inconsistency'` line 306).
- `clean-evaluator.ts` (`evaluateCleanPolicy`, `isCoverageSatisfied`, `CoverageObservation`, `RunCoverage`, `DiscoveredApplicableFileEvidence`) - CONSUMED, never reimplemented.

---

## The complete partial-static registry slice (transcription table)

This is the authoritative table for Task 1. Every row is grounded in a real source id/severity. Canonical severity is `SEVERITY_TABLE[sourceSeverity]` UNLESS an override is noted. `req` = statically satisfiable (all `evidenceRequirements` in `{css-rule, markup}`) and therefore a generated required rule; `non-req` = owned-but-not-required (a `computed-style`/`dom`/`contrast` requirement, surfaces `inconclusive` until a browser collector exists in P4b+).

`sourceRuleAliases` for the 22 polish rules are ALWAYS `['polish-standard:<id>', 'POLISH_0<id>']` (the numeric source id plus the extended-domain dup). For taste rows it is `['taste/<id>']`. For anti-pattern rows it is the raw `banName` (no prefix), matching the seed's `gradient-text` / `identical-card-grids` precedent.

`sourceVocabulary` is `'polish-extended-antipattern'` for every polish/a11y row, `'taste'` for theming rows, `'p012'` for anti-pattern rows.

### Owner `polish-standard` (findingClass `polish`) - 19 rules (1 is the seed)

| src id | ruleId | canonicalRuleKey | srcSev | severity | evidence | req | applicability | registryScope |
|---|---|---|---|---|---|---|---|---|
| 1 | polish.scale-on-press | polish/scale-on-press | high | major | css-rule | req | not_applicable | polished-press-feedback |
| 2 | polish.concentric-radius | polish/concentric-radius | medium | minor | computed-style | non-req | inconclusive | polished-radius-concentricity |
| 3 | polish.icon-swap-compound | polish/icon-swap-compound | medium | minor | css-rule | req | not_applicable | polished-icon-transition |
| 4 | polish.image-outline-neutral | polish/image-outline-neutral | low | advisory | css-rule | req | not_applicable | polished-image-outline |
| 6 | polish.no-transition-all | polish/no-transition-all | high | major | css-rule | req | not_applicable | polished-explicit-transition |
| 7 | polish.tabular-nums | polish/tabular-nums | medium | minor | css-rule | req | not_applicable | polished-tabular-numerics |
| 8 | polish.text-wrap-balance | polish/text-wrap-balance | low | advisory | css-rule | req | not_applicable | polished-heading-balance |
| 9 | polish.staggered-enter | polish/staggered-enter | medium | minor | css-rule | req | not_applicable | polished-enter-stagger |
| 10 | polish.subtle-exit | polish/subtle-exit | medium | minor | css-rule | req | not_applicable | polished-exit-choreography |
| 11 | polish.font-smoothing | polish/font-smoothing | low | advisory | css-rule | req | not_applicable | polished-font-smoothing |
| 12 | polish.animatepresence-initial | polish/animatepresence-initial | medium | minor | markup | req | not_applicable | polished-first-load-suppression |
| 13 | polish.sparse-will-change | polish/sparse-will-change | low | advisory | css-rule | req | not_applicable | polished-sparse-will-change |
| 14 | polish.shadows-over-borders | polish/shadows-over-borders | medium | minor | css-rule | req | not_applicable | polished-elevation-shadow |
| 15 | polish.optical-alignment | polish/optical-alignment | medium | minor | css-rule | req | not_applicable | polished-optical-alignment |
| 16 | polish.typography-rhythm | polish/typography-rhythm | medium | minor | computed-style | non-req | inconclusive | polished-vertical-rhythm |
| 17 | polish.shadow-hierarchy | polish/shadow-hierarchy | medium | minor | css-rule | req | not_applicable | polished-shadow-hierarchy |
| 19 | polish.reduced-motion-respect | polish/reduced-motion-respect | critical | blocker | css-rule | req | not_applicable | polished-motion-respect (SEED - unchanged) |
| 21 | polish.state-completeness | polish/state-completeness | high | major | css-rule | req | not_applicable | polished-state-completeness |
| 22 | polish.anti-pattern-genericity | polish/anti-pattern-genericity | medium | minor | dom | non-req | inconclusive | polished-genericity-floor |

> NOTE: id 19 already exists in the seed EXACTLY as above. Do not duplicate it; add the other 18 rows. Rule 22's `genericityScore` is a collected design-token metric no static source provides, so it declares evidence `['dom']` and surfaces `inconclusive` (mirrors the seed's `a11y.min-hit-area` dom-only pattern). Its `supportedSourceKinds` use the dom-style `level: 'none'` placeholder form.

### Owner `static-a11y` (findingClass `a11y`) - 3 rules (2 are the seed)

| src id | ruleId | canonicalRuleKey | srcSev | severity | evidence | req | applicability | registryScope |
|---|---|---|---|---|---|---|---|---|
| 18 | a11y.focus-visible | a11y/focus-visible | critical | blocker | css-rule | req | not_applicable | keyboard-accessibility-floor (SEED) |
| 5 | a11y.min-hit-area | a11y/min-hit-area | critical | blocker | dom | non-req | inconclusive | touch-target-floor (SEED) |
| 20 | a11y.color-contrast | a11y/color-contrast | critical | blocker | contrast | non-req | inconclusive | contrast-floor |

> NOTE: ids 18 and 5 already exist in the seed. Add ONLY id 20 (`a11y.color-contrast`). It is contrast-only (no static source), so non-required and surfaces inconclusive. Its `supportedSourceKinds` use the `level: 'none'` placeholder form `[{ kind: 'contrast', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' }]`.

### Owner `theming` (findingClass `theming`) - 2 rules (1 is the seed)

| ruleId | canonicalRuleKey | alias | srcSev | severity | evidence | req | applicability | registryScope |
|---|---|---|---|---|---|---|---|---|
| theming.hex-in-interactive-state | theming/token-driven-interactive-state | taste/hex-in-interactive-state | error | blocker | css-rule | req | not_applicable | token-consistency (SEED) |
| theming.border-radius-consistency | theming/border-radius-consistency | taste/border-radius-inconsistency | error | blocker | css-rule | req | not_applicable | token-consistency |

> NOTE: `hex-in-interactive-state` exists in the seed. Add ONLY `border-radius-consistency`. `error` normalizes to `blocker` (no override).

### Owner `anti-pattern` (findingClass `anti-pattern`) - 6 rules (2 are the seed)

| ruleId | canonicalRuleKey | alias (raw banName) | srcSev | severity | override? | evidence | req | applicability | registryScope |
|---|---|---|---|---|---|---|---|---|---|
| anti-pattern.gradient-text | anti-pattern/gradient-text | gradient-text | P1 | major | no | css-rule | req | not_applicable | named-ban-compliance (SEED) |
| anti-pattern.glassmorphism-default | anti-pattern/glassmorphism-default | glassmorphism-default | P1 | major | no | css-rule | req | not_applicable | named-ban-compliance |
| anti-pattern.side-stripe-borders | anti-pattern/side-stripe-borders | side-stripe-borders | P1 | major | no | css-rule | req | not_applicable | named-ban-compliance |
| anti-pattern.identical-card-grids | anti-pattern/identical-card-grids | identical-card-grids | P1 | minor | YES | markup | req | not_applicable | named-ban-compliance (SEED) |
| anti-pattern.hero-metric-template | anti-pattern/hero-metric-template | hero-metric-template | P1 | minor | YES | markup | req | not_applicable | named-ban-compliance |
| anti-pattern.modal-as-first-thought | anti-pattern/modal-as-first-thought | modal-as-first-thought | P2 | minor | no | markup | req | not_applicable | named-ban-compliance |

> NOTE: `gradient-text` and `identical-card-grids` exist in the seed. Add the other 4. The three precise CSS detectors (`gradient-text`, `glassmorphism-default`, `side-stripe-borders`) keep the `P1 -> major` default (blocking, NO override). The two HTML-structural heuristics (`identical-card-grids` seed, `hero-metric-template` NEW) DECLARE `severity: minor` with a `severityOverrideReason` citing `absolute-ban-detector.ts:19-21` ("flag pattern shapes, not certainties; false positives are possible"). `modal-as-first-thought` is `P2 -> minor` (table default; NO override needed even though heuristic).

**Counts after Task 1:** `polish-standard` owns 19 (16 required css-rule/markup, 3 non-required), `static-a11y` owns 3 (1 required, 2 non-required), `theming` owns 2 (both required), `anti-pattern` owns 6 (all required; 3 blocking major, 3 non-blocking minor). Total 30 canonical rules. Every gating validator has a non-empty generated `requiredRuleIds`. The only declared severity overrides are `identical-card-grids` and `hero-metric-template`.

### Shared supported-source matrix and scope rules

Create `validators/source-support-matrix.ts` in Task 1 and use it from BOTH `product-rule-registry.ts` and `project-collector.ts`. It exports:

- `SOURCE_KIND_BY_EXTENSION`: `.css -> css`, `.scss -> scss`, `.sass -> scss`, `.less -> less`, `.html/.htm -> html`, `.tsx -> tsx`, `.jsx -> jsx`, `.vue -> vue`, `.svelte -> svelte`.
- `SUPPORTED_SOURCE_KINDS_BY_EVIDENCE`: the five support blocks below.
- `supportedKindsFor(...requirements)` for registry definitions and generator input.
- `sourceKindForPath(path)` and `isCollectableSourceKind(kind)` for the collector.

The canonical blocks in that one matrix are:

- css-rule rule: `[{ kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' }, { kind: 'less', level: 'full' }, { kind: 'tsx', level: 'partial' }, { kind: 'html', level: 'partial' }]`
- markup rule: `[{ kind: 'html', level: 'full' }, { kind: 'tsx', level: 'partial' }, { kind: 'jsx', level: 'partial' }, { kind: 'vue', level: 'partial' }, { kind: 'svelte', level: 'partial' }]`
- computed-style rule (non-req): `[{ kind: 'computed-style', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' }]`
- dom rule (non-req): `[{ kind: 'dom', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' }]`
- contrast rule (non-req): `[{ kind: 'contrast', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' }]`

Every row uses `narrowTargetBehavior: 'evaluate_expanded_context'` (matches the seed; coverage `requireAllDiscoveredApplicableFiles` derives `true`).

`scope: 'file'` means execute once per applicable inspected file, then aggregate. Use it for every static CSS rule, theming rule, `polish.animatepresence-initial`, and `polish.image-outline-neutral`. Use `scope: 'project'` only for the three cross-markup anti-pattern heuristics because their source scanners intentionally reason over a page/project shape. Browser-only rules keep `scope: 'component'`.

### Concrete applicability contract for every `not_applicable` rule

Applicability is determined from collected evidence before the rule check runs. If the necessary evidence channel is missing, unreadable, oversized, unsupported, or insufficient to decide applicability, return `inconclusive`, never `fail` or `not_applicable`. The rule check may return `not_applicable` only after its probe conclusively returns false:

| Rules | Applicable when collected evidence establishes |
|---|---|
| `polish.scale-on-press`, `polish.state-completeness` | an interactive selector or interactive element exists |
| `polish.icon-swap-compound` | an icon-bearing interactive control or icon swap selector exists |
| `polish.image-outline-neutral` | an image element or image selector exists |
| `polish.no-transition-all` | at least one transition declaration exists |
| `polish.tabular-nums` | a dynamic-number selector/element exists |
| `polish.text-wrap-balance` | a heading element or heading selector exists |
| `polish.staggered-enter`, `polish.subtle-exit`, `polish.reduced-motion-respect` | a transition, animation, keyframe, or motion-library marker exists |
| `polish.font-smoothing` | a document/root/body style target exists |
| `polish.animatepresence-initial` | Framer Motion or `AnimatePresence` markup exists |
| `polish.sparse-will-change` | a `will-change` declaration exists |
| `polish.shadows-over-borders`, `polish.shadow-hierarchy` | an elevated surface/card/panel/dialog or shadow declaration exists |
| `polish.optical-alignment` | an icon-text control, badge, or optical-alignment target exists |
| `a11y.focus-visible` | a focusable element or interactive selector exists |
| `theming.hex-in-interactive-state` | an interactive state and a token system are both established; absence of either is N/A |
| `theming.border-radius-consistency` | at least one radius declaration or rounded utility is established |
| three CSS anti-pattern rules | the file contains CSS rule bodies; clean CSS is applicable and passes |
| three markup anti-pattern rules | collected markup is sufficient for the source scanner; clean markup is applicable and passes |

Implement these probes as named reusable functions in the slice modules or `check-context.ts`, and table-test every row. Do not infer N/A from a failed feature check. In particular, "no headings", "no focusable elements", "no motion", and "no interactive elements" must resolve N/A only when markup/CSS evidence is sufficient to establish that absence.

---

## Setup

- [ ] **Step 0.1: Branch + dirty snapshot** -> verify: `git branch --show-current` prints `lane-p4a2-validator-adaptation`.

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git checkout -b lane-p4a2-validator-adaptation
git branch --show-current
git status --porcelain | sort > /tmp/lane-p4a2-preexisting-dirty.txt
```

- [ ] **Step 0.2: Baseline green** -> verify: `cd sidecoach && npm run build && npm test` gives build exit 0 and `run-tests: 20 suite(s) passed`, AND `npx ts-node scripts/generate-validators.ts --check` prints `OK`. If red, STOP and fix the baseline before touching anything.

```bash
cd sidecoach
npx ts-node scripts/generate-validators.ts --check
npm run build && npm test
```

---

## Task 1: Expand the registry to the 30-rule partial-static slice (declarative only)

**Files:** Create `src/validators/source-support-matrix.ts`; Modify `src/product-rule-registry.ts` (6 -> 30 rules) and `src/validator-generation.ts` (matrix drift validation); Modify `src/__tests__/product-rule-registry.test.ts` + `src/__tests__/generate-validators.test.ts`; Regenerate `src/validators.generated.ts`.

This task is PURELY declarative (no `checkProduct` yet). It must keep `--check` green and produce a non-empty generated `requiredRuleIds` for all four validators.

- [ ] **Step 1.1: Failing test first.** Append to `src/__tests__/product-rule-registry.test.ts` a table-driven EXACT assertion. Define `EXPECTED_RULES` by transcribing all 30 rows from the authoritative tables above with these exact fields for every row: `ruleId`, `sourceRuleAliases`, `canonicalRuleKey`, `ownerValidatorId`, `sourceVocabulary`, `sourceSeverity`, `severity`, `findingClass`, `registryScope`, `evidenceRequirements`, `supportedSourceKinds`, `scope`, `narrowTargetBehavior`, `applicability`, and `severityOverrideReason` when present. Sort actual and expected by `ruleId`, strip only executable `checkProduct`, and compare `JSON.stringify(actual) === JSON.stringify(EXPECTED_RULES)`. This is an exact 30-row assertion, not representative sampling.

In the same test define all 22 Polish alias pairs explicitly and assert both aliases resolve to the same expected canonical key:

```typescript
const EXPECTED_POLISH_ALIAS_PAIRS: Array<[string, string, string]> = [
  ['polish-standard:1', 'POLISH_001', 'polish/scale-on-press'],
  ['polish-standard:2', 'POLISH_002', 'polish/concentric-radius'],
  ['polish-standard:3', 'POLISH_003', 'polish/icon-swap-compound'],
  ['polish-standard:4', 'POLISH_004', 'polish/image-outline-neutral'],
  ['polish-standard:5', 'POLISH_005', 'a11y/min-hit-area'],
  ['polish-standard:6', 'POLISH_006', 'polish/no-transition-all'],
  ['polish-standard:7', 'POLISH_007', 'polish/tabular-nums'],
  ['polish-standard:8', 'POLISH_008', 'polish/text-wrap-balance'],
  ['polish-standard:9', 'POLISH_009', 'polish/staggered-enter'],
  ['polish-standard:10', 'POLISH_010', 'polish/subtle-exit'],
  ['polish-standard:11', 'POLISH_011', 'polish/font-smoothing'],
  ['polish-standard:12', 'POLISH_012', 'polish/animatepresence-initial'],
  ['polish-standard:13', 'POLISH_013', 'polish/sparse-will-change'],
  ['polish-standard:14', 'POLISH_014', 'polish/shadows-over-borders'],
  ['polish-standard:15', 'POLISH_015', 'polish/optical-alignment'],
  ['polish-standard:16', 'POLISH_016', 'polish/typography-rhythm'],
  ['polish-standard:17', 'POLISH_017', 'polish/shadow-hierarchy'],
  ['polish-standard:18', 'POLISH_018', 'a11y/focus-visible'],
  ['polish-standard:19', 'POLISH_019', 'polish/reduced-motion-respect'],
  ['polish-standard:20', 'POLISH_020', 'a11y/color-contrast'],
  ['polish-standard:21', 'POLISH_021', 'polish/state-completeness'],
  ['polish-standard:22', 'POLISH_022', 'polish/anti-pattern-genericity'],
];
for (const [numeric, extended, key] of EXPECTED_POLISH_ALIAS_PAIRS) {
  if (resolveSourceAlias(numeric)?.canonicalRuleKey !== key) throw new Error(`bad alias ${numeric}`);
  if (resolveSourceAlias(extended)?.canonicalRuleKey !== key) throw new Error(`bad alias ${extended}`);
}
```

Then retain the following focused invariant assertions for readable failures:

```typescript
// --- P4a-2: partial-static registry slice (30 rules) ---
{
  if (RULES.length !== 30) throw new Error(`expected 30 canonical rules, got ${RULES.length}`);

  const owners = (id: string) => RULES.filter((r) => r.ownerValidatorId === id);
  if (owners('polish-standard').length !== 19) throw new Error('polish-standard must own 19 rules');
  if (owners('static-a11y').length !== 3) throw new Error('static-a11y must own 3 rules');
  if (owners('theming').length !== 2) throw new Error('theming must own 2 rules');
  if (owners('anti-pattern').length !== 6) throw new Error('anti-pattern must own 6 rules');

  // color-contrast is contrast-only -> NOT statically satisfiable -> owned non-required
  const contrast = getRuleById('a11y.color-contrast');
  if (!contrast || contrast.ownerValidatorId !== 'static-a11y') throw new Error('color-contrast owned by static-a11y');
  if (isStaticallySatisfiable(contrast.evidenceRequirements)) throw new Error('color-contrast must be non-required (contrast-only)');

  // hero-metric-template declares a MINOR override with a reason (P1 table default is major)
  const hero = getRuleById('anti-pattern.hero-metric-template');
  if (!hero || hero.severity !== 'minor' || !hero.severityOverrideReason) throw new Error('hero-metric-template must declare a minor override with a reason');
  if (SEVERITY_TABLE[hero.sourceSeverity] === hero.severity) throw new Error('hero-metric override must diverge from table default');

  // the precise CSS bans keep the blocking major default (no override)
  const glass = getRuleById('anti-pattern.glassmorphism-default');
  if (!glass || glass.severity !== 'major' || glass.severityOverrideReason) throw new Error('glassmorphism-default stays major with no override');

  // theming border-radius rule added, blocker, css-rule required
  const br = getRuleById('theming.border-radius-consistency');
  if (!br || br.severity !== 'blocker' || !isStaticallySatisfiable(br.evidenceRequirements)) throw new Error('border-radius-consistency must be a required blocker');
  if (!resolveSourceAlias('taste/border-radius-inconsistency')) throw new Error('taste alias must resolve');

  console.log('product-rule-registry (P4a-2 partial-static slice): OK');
}
```

- [ ] **Step 1.2: Run, verify FAIL** -> `npx ts-node src/__tests__/product-rule-registry.test.ts` throws `expected 30 canonical rules, got 6`.

- [ ] **Step 1.3: Create the shared matrix and add the 24 new rules.** Create `src/validators/source-support-matrix.ts` exactly as specified above. Replace every hand-written `supportedSourceKinds` block in all 30 registry definitions with `supportedKindsFor(...evidenceRequirements)` from that matrix, so registry generation and collection cannot drift. Modify `validateRegistry` in `validator-generation.ts` to call the same helper and reject any definition whose `supportedSourceKinds` diverge. Add the 24 new rules to `RULES`, transcribing every other field from the table above. Each rule is a full `ProductRuleDefinition` literal in the SAME shape as the seed entries. Concrete examples to copy the shape from (do all 24):

```typescript
// polish-standard owner, css-rule required, high -> major (no override)
{
  ruleId: 'polish.scale-on-press',
  sourceRuleAliases: ['polish-standard:1', 'POLISH_001'],
  canonicalRuleKey: 'polish/scale-on-press',
  ownerValidatorId: 'polish-standard',
  sourceVocabulary: 'polish-extended-antipattern',
  sourceSeverity: 'high',
  severity: 'major',
  findingClass: 'polish',
  registryScope: 'polished-press-feedback',
  evidenceRequirements: ['css-rule'],
  supportedSourceKinds: supportedKindsFor('css-rule'),
  scope: 'file',
  narrowTargetBehavior: 'evaluate_expanded_context',
  applicability: 'not_applicable',
},
// polish-standard owner, computed-style NON-required, medium -> minor (no override)
{
  ruleId: 'polish.concentric-radius',
  sourceRuleAliases: ['polish-standard:2', 'POLISH_002'],
  canonicalRuleKey: 'polish/concentric-radius',
  ownerValidatorId: 'polish-standard',
  sourceVocabulary: 'polish-extended-antipattern',
  sourceSeverity: 'medium',
  severity: 'minor',
  findingClass: 'polish',
  registryScope: 'polished-radius-concentricity',
  evidenceRequirements: ['computed-style'],
  supportedSourceKinds: [
    { kind: 'computed-style', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' },
  ],
  scope: 'component',
  narrowTargetBehavior: 'evaluate_expanded_context',
  applicability: 'inconclusive',
},
// anti-pattern owner, markup heuristic, P1 default major DEMOTED to minor with reason
{
  ruleId: 'anti-pattern.hero-metric-template',
  sourceRuleAliases: ['hero-metric-template'],
  canonicalRuleKey: 'anti-pattern/hero-metric-template',
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
  scope: 'project',
  narrowTargetBehavior: 'evaluate_expanded_context',
  applicability: 'not_applicable',
},
```

Use `scope: 'file'` for css-rule rules, theming rules, `polish.animatepresence-initial`, and `polish.image-outline-neutral`; use `scope: 'component'` for computed-style/contrast/dom non-required rules; use `scope: 'project'` for the three markup ban heuristics because their faithful source scanners aggregate a page/project shape. Task 2 executes these scopes differently, so the exact registry test must pin every scope.

- [ ] **Step 1.4: Run, verify the registry test PASSES** -> `npx ts-node src/__tests__/product-rule-registry.test.ts` prints both `OK` lines.

- [ ] **Step 1.5: Regenerate the committed generated file** -> `npx ts-node scripts/generate-validators.ts` writes `src/validators.generated.ts`. Then `--check` must be green.

```bash
cd sidecoach
npx ts-node scripts/generate-validators.ts
npx ts-node scripts/generate-validators.ts --check   # expect: OK (registry valid, manifest present, no drift)
```

- [ ] **Step 1.6: Strengthen the generator test.** Append to `src/__tests__/generate-validators.test.ts` (inside `run()`, before the final `console.log`) assertions that the NEW gating validators are non-vacuous:

```typescript
  // P4a-2: every gating validator now owns a non-empty generated requiredRuleIds
  for (const id of ['polish-standard', 'theming', 'anti-pattern', 'static-a11y']) {
    const v = gen.GENERATED_VALIDATORS.find((x: any) => x.validatorId === id);
    if (!v || v.cleanPolicy.requiredRuleIds.length === 0) throw new Error(`gating validator ${id} must have non-empty requiredRuleIds`);
  }
  // anti-pattern: the heuristic markup rules are owned but the precise css bans are the blocking required ones
  const ap = gen.GENERATED_VALIDATORS.find((x: any) => x.validatorId === 'anti-pattern');
  if (!ap.cleanPolicy.requiredRuleIds.includes('anti-pattern.gradient-text')) throw new Error('gradient-text must be required');
  if (ap.cleanPolicy.toleratedFindingCounts['major|anti-pattern'] !== 0) throw new Error('explicit 0 tolerance for major|anti-pattern');
  // generated support records must exactly reflect the one shared matrix
  for (const rule of RULES) {
    const expected = supportedKindsFor(...rule.evidenceRequirements);
    if (JSON.stringify(rule.supportedSourceKinds) !== JSON.stringify(expected)) throw new Error(`source matrix drift for ${rule.ruleId}`);
  }
```

- [ ] **Step 1.7: Verify Task 1** -> all of:

```bash
cd sidecoach
npx ts-node src/__tests__/product-rule-registry.test.ts     # both OK lines
npx ts-node src/__tests__/generate-validators.test.ts        # generate-validators: OK
npx ts-node scripts/generate-validators.ts --check           # OK
npx ts-node scripts/generate-lanes.ts --check                # unaffected, still OK
git add src/validators/source-support-matrix.ts src/product-rule-registry.ts src/validator-generation.ts src/validators.generated.ts src/__tests__/product-rule-registry.test.ts src/__tests__/generate-validators.test.ts
git commit -m "lane-p4a2: expand product-rule-registry to partial-static 30-rule slice"
```

---

## Task 2: Shared check infrastructure + checkProduct/validateProduct wiring

**Files:** Create `src/validators/check-context.ts`, `src/validators/project-collector.ts`, `src/validators/run-validator.ts`, `src/validators/checks/index.ts`; Modify `src/product-rule-registry.ts` (attach `checkProduct`), `src/flow-validation-capabilities.ts` (attach `validateProduct`), `scripts/run-tests.ts`; Test `src/__tests__/product-validator-pipeline.test.ts` and `src/__tests__/project-collector.test.ts`.

This task builds the plumbing and proves the four-status pipeline with ONE representative real check (`polish/reduced-motion-respect`); every other rule resolves to `missingCheck` (inconclusive) until Tasks 3-6 fill them in. It also proves the collection and execution invariants that every later slice relies on: no discovered input silently disappears, file rules execute per applicable file, coverage names the files actually evaluated, and measured scope is earned from conclusive sufficiently-covered executions only.

- [ ] **Step 2.1: Failing test first** -> `src/__tests__/product-validator-pipeline.test.ts`:

```typescript
// sidecoach/src/__tests__/product-validator-pipeline.test.ts
import { getValidatorRegistration } from '../flow-validation-capabilities';
import { getRuleById } from '../product-rule-registry';
import { CHECKS } from '../validators/checks';
import type { ProductCheckContext } from '../validators/check-context';

// A context with CSS present but NO reduced-motion media query.
const cssNoReducedMotion = (css: string): ProductCheckContext => ({
  cssText: css, markup: '',
  files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }],
});
const emptyCtx: ProductCheckContext = { cssText: '', markup: '', files: [] };

function run() {
  // 1. validateProduct is ATTACHED to every gating registration
  for (const id of ['polish-standard', 'theming', 'anti-pattern', 'static-a11y']) {
    const reg = getValidatorRegistration(id);
    if (!reg || typeof reg.validateProduct !== 'function') throw new Error(`${id} must have an attached validateProduct`);
  }

  // 2. checkProduct is ATTACHED to every rule and returns a four-status result
  const rm = getRuleById('polish.reduced-motion-respect')!;
  if (typeof rm.checkProduct !== 'function') throw new Error('reduced-motion checkProduct must be attached');

  // 3. evidence PRESENT, feature ABSENT -> FAIL (not the old absence-pass, not inconclusive)
  const failV = rm.checkProduct!(cssNoReducedMotion('.btn { transition: opacity 150ms; }'));
  if (failV.status !== 'fail') throw new Error(`css present without reduced-motion must FAIL, got ${failV.status}`);

  // 4. evidence PRESENT, feature PRESENT -> PASS
  const passV = rm.checkProduct!(cssNoReducedMotion('@media (prefers-reduced-motion: reduce) { * { animation: none; } }'));
  if (passV.status !== 'pass') throw new Error(`reduced-motion present must PASS, got ${passV.status}`);

  // 5. evidence ABSENT (no CSS collected) -> INCONCLUSIVE, never pass
  const incV = rm.checkProduct!(emptyCtx);
  if (incV.status !== 'inconclusive') throw new Error(`no CSS evidence must be INCONCLUSIVE, got ${incV.status}`);
  if (!incV.normalizedErrorCategory) throw new Error('an evidence-gap inconclusive must carry a normalizedErrorCategory');

  // 6. an UNATTACHED rule (missingCheck) is inconclusive, never a false pass
  const unattached = getRuleById('polish.scale-on-press')!;   // not implemented until Task 3
  if (unattached.checkProduct!(cssNoReducedMotion('.btn{}')).status !== 'inconclusive') throw new Error('unattached rule must be inconclusive');

  // 7. a genuinely throwing injected check is CAUGHT -> inconclusive + rule_exception
  const original = CHECKS['polish/reduced-motion-respect'];
  CHECKS['polish/reduced-motion-respect'] = new Proxy(original, {
    apply() { throw new Error('injected rule explosion'); },
  });
  const thrown = rm.checkProduct!(cssNoReducedMotion('.btn{}'));
  CHECKS['polish/reduced-motion-respect'] = original;
  if (thrown.status !== 'inconclusive') throw new Error('a thrown check must be caught as inconclusive');
  if (thrown.normalizedErrorCategory !== 'rule_exception') throw new Error('throw must normalize to rule_exception');

  // 8. validateProduct end-to-end on an empty project -> required rules inconclusive -> status inconclusive
  const res = getValidatorRegistration('polish-standard')!.validateProduct!(emptyCtx);
  if (res.status !== 'inconclusive') throw new Error(`empty project must yield validator status inconclusive, got ${res.status}`);
  // honest coverage is still populated
  if (!res.coverage || !Array.isArray(res.coverage.measuredScope)) throw new Error('coverage must be reproducible even when inconclusive');
  if (res.coverage.measuredScope.includes('polished-motion-respect')) throw new Error('inconclusive rule must not claim measured scope');
  if (!res.coverage.unverifiedScope.includes('polished-motion-respect')) throw new Error('unmeasured registry scope must remain unverified');

  console.log('product-validator-pipeline: OK');
}
run();
```

- [ ] **Step 2.2: Run, verify FAIL** -> `Cannot find module '../validators/check-context'`.

- [ ] **Step 2.3: Write `src/validators/check-context.ts`** (types + verdict helpers + stamp; no fs):

```typescript
// sidecoach/src/validators/check-context.ts
import type {
  ProductRuleDefinition, ProductRuleResult, RuleStatus, EvidenceKind, NormalizedErrorCategory,
} from '../product-rule-types';

// Per-file collected evidence. evidenceKindsPresent lists the SOURCE kinds available
// for this file (e.g. ['css'] or ['tsx']) - it is what isCoverageSatisfied matches
// against the coverage record's evidenceAlternativesByRequirement.
export interface CollectedFile {
  path: string;
  sourceKind: string;            // 'css' | 'scss' | 'less' | 'html' | 'tsx' | 'jsx' | 'vue' | 'svelte'
  cssText: string;               // CSS-family text in this file (incl. inline <style> for markup files)
  markup: string;                // markup text in this file ('' for pure CSS files)
  evidenceKindsPresent: string[];
}

export type CollectionOutcome = 'inspected' | 'policy_skipped' | 'unreadable' | 'oversized' | 'unsupported';
export interface DiscoveredFile {
  path: string;
  sourceKind: string;
  outcome: CollectionOutcome;
  reason?: string;
}

// The per-target evidence a checkProduct inspects. Browser-collected fields are
// OPTIONAL and absent in P4a-2; a rule that needs them returns inconclusive.
export interface ProductCheckContext {
  cssText: string;               // joined CSS-family text across inspected files
  markup: string;                // joined markup across inspected files
  files: CollectedFile[];
  discoveredFiles?: DiscoveredFile[];
  computedStyle?: Record<string, string>;
  contrast?: { wcagAA: boolean; ratio: number };
  designTokens?: Record<string, unknown>;
  tasteOptions?: { tailwindDetected?: boolean };
}

// A check returns ONLY the verdict; metadata is stamped from the definition so a
// check body never duplicates (and cannot drift from) the rule's severity/class/key.
export interface RuleVerdict {
  status: RuleStatus;
  message: string;
  evidenceLocations?: string[];
  remediation?: string;
  normalizedErrorCategory?: NormalizedErrorCategory;
  evidenceKind?: EvidenceKind;
}

export const pass = (message: string, evidenceLocations: string[] = []): RuleVerdict => ({ status: 'pass', message, evidenceLocations });
export const fail = (message: string, evidenceLocations: string[] = [], remediation?: string): RuleVerdict => ({ status: 'fail', message, evidenceLocations, remediation });
export const notApplicable = (message: string): RuleVerdict => ({ status: 'not_applicable', message });
export const inconclusive = (message: string, category: NormalizedErrorCategory = 'unreadable_input'): RuleVerdict => ({ status: 'inconclusive', message, normalizedErrorCategory: category });

// True only when at least one CSS-family file was collected with non-empty text.
export const hasCss = (ctx: ProductCheckContext): boolean => !!ctx && typeof ctx.cssText === 'string' && ctx.cssText.trim().length > 0;
export const hasMarkup = (ctx: ProductCheckContext): boolean => !!ctx && typeof ctx.markup === 'string' && ctx.markup.trim().length > 0;

export function stampResult(def: ProductRuleDefinition, v: RuleVerdict): ProductRuleResult {
  return {
    ruleId: def.ruleId,
    canonicalRuleKey: def.canonicalRuleKey,
    status: v.status,
    normalizedErrorCategory: v.normalizedErrorCategory,
    severity: def.severity,
    findingClass: def.findingClass,
    evidenceKind: v.evidenceKind ?? def.evidenceRequirements[0],
    evidenceLocations: v.evidenceLocations ?? [],
    message: v.message,
    remediation: v.remediation,
  };
}
```

Also add named applicability probes and `withRuleApplicability(canonicalRuleKey, rawCheck)` used by Tasks 3-6. Each probe returns `true | false | 'unknown'`; `'unknown'` maps to `inconclusive`, `false` maps to `not_applicable`, and only `true` reaches the feature check. Rules whose registry applicability is `inconclusive` bypass the N/A wrapper and retain their raw browser-only inconclusive result. The probes implement every row in the complete applicability table above. They inspect the current per-file context for `scope: 'file'` rules and the assembled context only for declared `scope: 'project'` rules.

- [ ] **Step 2.4: Write `src/validators/checks/index.ts`** (the merge point; slices are empty until Tasks 3-6):

```typescript
// sidecoach/src/validators/checks/index.ts
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { inconclusive } from '../check-context';
import { POLISH_CHECKS } from './polish-checks';
import { A11Y_CHECKS } from './a11y-checks';
import { THEMING_CHECKS } from './theming-checks';
import { ANTI_PATTERN_CHECKS } from './anti-pattern-checks';

export type CheckFn = (ctx: ProductCheckContext) => RuleVerdict;

// Keyed by canonicalRuleKey. The four slices are disjoint by construction.
export const CHECKS: Record<string, CheckFn> = {
  ...POLISH_CHECKS, ...A11Y_CHECKS, ...THEMING_CHECKS, ...ANTI_PATTERN_CHECKS,
};

// A rule whose check is not yet attached surfaces inconclusive, NEVER a false pass.
export const missingCheck: CheckFn = () => inconclusive('no checkProduct attached for this rule', 'unsupported_runtime');
```

For Task 2 only, create the four slice files as stubs that each `export const <NAME>_CHECKS = {}` EXCEPT `polish-checks.ts`, which implements the single representative `polish/reduced-motion-respect`:

```typescript
// sidecoach/src/validators/checks/polish-checks.ts  (Task 2 seed; Task 3 fills in the rest)
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss, withRuleApplicability } from '../check-context';

// id 19, css-rule. Old code: cssRules?.some(...) ?? false (absence-failed silently).
// New: no CSS collected -> inconclusive; CSS present without the media query -> fail.
export function checkReducedMotion(ctx: ProductCheckContext): RuleVerdict {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected to check reduced-motion', 'unreadable_input');
  const present = ctx.cssText.includes('@media (prefers-reduced-motion');
  return present
    ? pass('prefers-reduced-motion media query present')
    : fail('no prefers-reduced-motion media query found in collected CSS', [], 'Add: @media (prefers-reduced-motion: reduce) { animation: none; }');
}

export const POLISH_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'polish/reduced-motion-respect': withRuleApplicability('polish/reduced-motion-respect', checkReducedMotion),
};
```

```typescript
// sidecoach/src/validators/checks/a11y-checks.ts        (Task 4)
import type { ProductCheckContext, RuleVerdict } from '../check-context';
export const A11Y_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {};
// sidecoach/src/validators/checks/theming-checks.ts      (Task 5)  -> export const THEMING_CHECKS = {};
// sidecoach/src/validators/checks/anti-pattern-checks.ts (Task 6)  -> export const ANTI_PATTERN_CHECKS = {};
```

- [ ] **Step 2.5: Attach `checkProduct` in `src/product-rule-registry.ts`.** Keep the literal `RULES` array but rename it to `RAW_RULES`, then export a wrapped `RULES`. The wrapper looks up the verdict fn by `canonicalRuleKey` and catches throws at the boundary (spec 479-483):

```typescript
// at the top of product-rule-registry.ts
import type { ProductRuleDefinition } from './product-rule-types';
import { CHECKS, missingCheck } from './validators/checks';
import { stampResult } from './validators/check-context';
import type { ProductCheckContext } from './validators/check-context';

// rename the existing array:  const RAW_RULES: ProductRuleDefinition[] = [ ...the 30 literals... ];

export const RULES: ProductRuleDefinition[] = RAW_RULES.map((def) => ({
  ...def,
  checkProduct: (context: unknown): import('./product-rule-types').ProductRuleResult => {
    const fn = CHECKS[def.canonicalRuleKey] ?? missingCheck;
    try {
      return stampResult(def, fn(context as ProductCheckContext));
    } catch (e) {
      // A rule check throwing is CAUGHT and recorded inconclusive (spec 479-483).
      return stampResult(def, {
        status: 'inconclusive',
        message: `rule check threw: ${String(e instanceof Error ? e.message : e)}`.slice(0, 200),
        normalizedErrorCategory: 'rule_exception',
      });
    }
  },
}));
```

`getRule`/`getRuleById`/`resolveSourceAlias` stay as-is (they read `RULES`). The generated file is unaffected: `deriveValidator` reads identity/owner fields and `JSON.stringify` drops functions.

> Cycle check: `product-rule-registry` -> `validators/checks` -> the four slice files -> `check-context` (types only). No slice imports the registry. `clean-evaluator` imports the registry (`getRuleById`); `run-validator` imports `clean-evaluator` + registry + `validators.generated` + collector. None import back into `validators/checks`. No cycle.

- [ ] **Step 2.6: Write `src/validators/project-collector.ts`** (recursive; replaces the one-level collectors). It accepts a context that is EITHER an in-memory `{ cssText, markup, files }` (used by unit tests) OR `{ projectPath }` (used by fixtures), and returns a normalized `Collected`:

```typescript
// sidecoach/src/validators/project-collector.ts
import * as fs from 'fs';
import * as path from 'path';
import type { CollectedFile, DiscoveredFile, ProductCheckContext } from './check-context';
import { sourceKindForPath, isCollectableSourceKind } from './source-support-matrix';

const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git']);
const MAX_BYTES = 2 * 1024 * 1024;

// Root read/stat failure throws. Nested failures are recorded, never discarded.
function walk(root: string, dir: string, discovered: DiscoveredFile[]): void {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    const rel = path.relative(root, abs);
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || SKIP_DIR.has(e.name)) {
        discovered.push({ path: rel, sourceKind: 'directory', outcome: 'policy_skipped', reason: 'excluded_directory' });
        continue;
      }
      try { walk(root, abs, discovered); }
      catch { discovered.push({ path: rel, sourceKind: 'directory', outcome: 'unreadable', reason: 'readdir_failed' }); }
    } else if (e.isFile()) {
      const kind = sourceKindForPath(abs);
      discovered.push({
        path: rel,
        sourceKind: kind ?? `extension:${path.extname(abs).toLowerCase() || '<none>'}`,
        outcome: kind && isCollectableSourceKind(kind) ? 'inspected' : 'unsupported',
      });
    }
  }
}

export interface Collected {
  discovered: DiscoveredFile[];
  files: CollectedFile[];
  inspectedFiles: string[];
  skippedFiles: string[];
  unreadableFiles: string[];
  unsupportedFiles: string[];
  cssText: string;
  markup: string;
}

export function collectFromPath(projectPath: string): Collected {
  // Missing/unreadable root is a validator-level collection failure and throws.
  fs.statSync(projectPath);
  const discovered: DiscoveredFile[] = [];
  walk(projectPath, projectPath, discovered);
  const files: CollectedFile[] = [];
  for (const d of discovered.filter((x) => x.outcome === 'inspected')) {
    const abs = path.join(projectPath, d.path);
    try {
      if (fs.statSync(abs).size > MAX_BYTES) { d.outcome = 'oversized'; d.reason = 'over_2mb'; continue; }
      const content = fs.readFileSync(abs, 'utf-8');
      const kind = d.sourceKind;
      const isCss = kind === 'css' || kind === 'scss' || kind === 'less';
      files.push({
        path: d.path, sourceKind: kind,
        cssText: isCss ? content : extractInlineCss(content),
        markup: isCss ? '' : content,
        evidenceKindsPresent: [kind],
      });
    } catch { d.outcome = 'unreadable'; d.reason = 'stat_or_read_failed'; }
  }
  return assemble(discovered, files);
}

function extractInlineCss(html: string): string {
  let out = '';
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out += '\n' + m[1];
  return out;
}

function assemble(discovered: DiscoveredFile[], files: CollectedFile[]): Collected {
  return {
    discovered,
    files,
    inspectedFiles: discovered.filter((d) => d.outcome === 'inspected').map((d) => d.path),
    skippedFiles: discovered.filter((d) => d.outcome === 'policy_skipped' || d.outcome === 'oversized' || d.outcome === 'unreadable').map((d) => d.path),
    unreadableFiles: discovered.filter((d) => d.outcome === 'unreadable').map((d) => d.path),
    unsupportedFiles: discovered.filter((d) => d.outcome === 'unsupported').map((d) => d.path),
    cssText: files.map((f) => f.cssText).filter(Boolean).join('\n'),
    markup: files.map((f) => f.markup).filter(Boolean).join('\n'),
  };
}

// Normalize whatever validateProduct received into a Collected. An in-memory
// context (unit tests) is used verbatim; a { projectPath } is walked. A context
// with NEITHER yields an empty collection (-> required rules inconclusive).
export function collect(context: unknown): Collected {
  const c = context as Partial<ProductCheckContext> & { projectPath?: string };
  if (c && Array.isArray(c.files)) {
    const discovered = c.discoveredFiles ?? c.files.map((f) => ({ path: f.path, sourceKind: f.sourceKind, outcome: 'inspected' as const }));
    return assemble(discovered, c.files as CollectedFile[]);
  }
  if (c && typeof c.projectPath === 'string') return collectFromPath(c.projectPath);
  return { discovered: [], files: [], inspectedFiles: [], skippedFiles: [], unreadableFiles: [], unsupportedFiles: [], cssText: '', markup: '' };
}
```

The implementation must preserve unsupported regular files in `discovered` even though their contents are not read. Excluded directories are `policy_skipped`; unreadable nested directories/files and oversized supported files stay discovered with their outcome. The explicit category arrays are derived views over `discovered`, never separate discovery passes. Only an unreadable/missing root becomes validator-level `error`.

- [ ] **Step 2.6a: Add collector/source-matrix tests first, then implement.** `src/__tests__/project-collector.test.ts` creates temporary projects and asserts: a Sass-only project is discovered as `scss`, inspected, and usable by css-rule coverage; a mixed `.css` + `.md` project reports `.css` inspected and `.md` unsupported; an oversized supported file remains discovered and skipped; an injected/read-failure seam records unreadable; and a missing/unreadable root throws. Verify FAIL before implementing, then verify `npx ts-node src/__tests__/project-collector.test.ts` prints `project-collector: OK`.

- [ ] **Step 2.7: Write `src/validators/run-validator.ts`** (the shared orchestration; CONSUMES `evaluateCleanPolicy`):

```typescript
// sidecoach/src/validators/run-validator.ts
import type { ProductValidationResult, ProductRuleResult, ProductRuleDefinition, RequiredCoverageRecord } from '../product-rule-types';
import { getRuleById } from '../product-rule-registry';
import { GENERATED_VALIDATORS } from '../validators.generated';
import { evaluateCleanPolicy } from '../clean-evaluator';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
import { collect, Collected } from './project-collector';
import type { ProductCheckContext, CollectedFile } from './check-context';

function toCheckContext(c: Collected, raw: unknown): ProductCheckContext {
  const r = raw as Partial<ProductCheckContext>;
  return {
    cssText: c.cssText, markup: c.markup, files: c.files, discoveredFiles: c.discovered,
    computedStyle: r?.computedStyle, contrast: r?.contrast, designTokens: r?.designTokens, tasteOptions: r?.tasteOptions,
  };
}

interface RuleExecution {
  result: ProductRuleResult;
  discoveredApplicableFiles: Array<{ file: string; evidenceKindsPresent: string[] }>;
  inspectedApplicableFiles: string[];
  sufficientlyCovered: boolean;
}

// executeRule is the single execution/coverage source of truth.
// 1. Select candidate discovered files using the coverage record's supported alternatives.
// 2. Run the rule's concrete applicability probe. An unreadable/oversized supported candidate,
//    or an applicability result of unknown, produces an inconclusive execution.
// 3. For scope:file, invoke checkProduct once per applicable inspected file using a one-file
//    ProductCheckContext. Aggregate: any inconclusive -> inconclusive; else any fail -> fail;
//    else any pass -> pass; else all conclusively non-applicable -> not_applicable.
//    A pass in one file can never cover a fail or gap in another applicable file.
// 4. For scope:project, invoke once on assembled applicable inspected evidence.
// 5. Merge evidence locations/messages from every per-file result into the aggregate result.
// 6. Return discoveredApplicableFiles containing only conclusively applicable files plus
//    unknown/gapped candidates that could be applicable. Exclude conclusively N/A files.
//    observationFor is built only from this RuleExecution, never from every collected
//    supported-kind file. sufficientlyCovered is true only when every discovered applicable
//    file was inspected with a compatible evidence alternative and no execution was inconclusive.
function executeRule(
  def: ProductRuleDefinition,
  record: RequiredCoverageRecord | undefined,
  collected: Collected,
  raw: unknown,
): RuleExecution { /* implement contract above */ }

function observationFor(x: RuleExecution): CoverageObservation {
  return {
    ruleId: x.result.ruleId,
    inspectedFiles: x.inspectedApplicableFiles,
    discoveredApplicableFiles: x.discoveredApplicableFiles,
  };
}

export function makeProductValidator(validatorId: string) {
  return function validateProduct(context: unknown): ProductValidationResult {
    const gen = GENERATED_VALIDATORS.find((v) => v.validatorId === validatorId);
    const policy = gen?.cleanPolicy;
    if (!gen || !policy) {
      // No generated policy is a real validator-level fault; reuse the error path
      // with a benign empty policy so evaluateCleanPolicy returns status 'error'.
      return evaluateCleanPolicy(
        { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
          validatorError: { category: 'registry_fault', message: `no generated validator for ${validatorId}` } },
        { requiredRuleIds: [], blockingSeverities: ['blocker', 'major'], toleratedFindingCounts: {}, requiredCoverageByScope: [], inconclusiveBehavior: 'block', notApplicableBehavior: 'exclude_and_report' },
      );
    }

    let collected: Collected;
    try { collected = collect(context); }
    catch (e) {
      return evaluateCleanPolicy(
        { validatorId, rules: [], coverageObservations: [], runCoverage: emptyRun(),
          validatorError: { category: 'unreadable_input', message: String(e instanceof Error ? e.message : e) } },
        policy,
      );
    }

    const recordById = new Map(policy.requiredCoverageByScope.map((c) => [c.ruleId, c]));
    const executions: RuleExecution[] = gen.ownedRuleIds
      .map((id) => getRuleById(id))
      .filter((d): d is NonNullable<typeof d> => !!d && typeof d.checkProduct === 'function')
      .map((d) => executeRule(d, recordById.get(d.ruleId), collected, context));
    const rules = executions.map((x) => x.result);

    const coverageObservations = executions
      .filter((x) => policy.requiredRuleIds.includes(x.result.ruleId))
      .map(observationFor);

    const inspectedFiles = collected.inspectedFiles;
    const skippedFiles = collected.skippedFiles;
    const supportedSourceKinds = [...new Set(collected.files.map((f) => f.sourceKind))];
    const unsupportedSourceKinds = [...new Set(collected.discovered.filter((d) => d.outcome === 'unsupported').map((d) => d.sourceKind))];
    const measuredScope = [...new Set(executions
      .filter((x) => x.sufficientlyCovered && x.result.status !== 'inconclusive')
      .map((x) => getRuleById(x.result.ruleId)!.registryScope))];
    const runCoverage: RunCoverage = {
      inspectedFiles, skippedFiles,
      supportedSourceKinds, unsupportedSourceKinds,
      measuredScope,
      unverifiedScope: gen.registryScope.filter((s) => !measuredScope.includes(s)),
    };

    return evaluateCleanPolicy({ validatorId, rules, coverageObservations, runCoverage }, policy);
  };
}

function emptyRun(): RunCoverage {
  return { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [], measuredScope: [], unverifiedScope: [] };
}
```

- [ ] **Step 2.7a: Add execution/coverage regression cases before implementation, verify FAIL, then make them pass.** Extend `product-validator-pipeline.test.ts` with:

1. A file-scoped injected check over `good.css` and `bad.css` where only `good.css` passes. Assert the aggregate rule verdict is `fail`, the check was called twice with one-file contexts, and `CoverageObservation.discoveredApplicableFiles` is exactly `['good.css', 'bad.css']`.
2. A supported unreadable or oversized applicable file plus an inspected applicable file. Assert the required rule is `inconclusive`, the gap remains in `discoveredApplicableFiles`, only the inspected file is in `inspectedFiles`, and `coverage.skippedFiles` is non-empty.
3. A mixed supported/unsupported project. Assert `unsupportedSourceKinds` is non-empty and contains the matrix-derived unsupported extension kind.
4. A conclusive covered rule and an inconclusive/gapped rule with different registry scopes. Assert only the first scope is in `measuredScope`, and the second is in `unverifiedScope`.
5. A root collection failure. Assert validator status `error` and `normalizedErrorCategory === 'unreadable_input'`.

These tests must inspect the actual result/observation data through a small exported `runValidatorForTest` or injectable execution seam. Do not test private behavior by duplicating the algorithm.

```bash
cd sidecoach
npx ts-node src/__tests__/product-validator-pipeline.test.ts
# expect FAIL before executeRule/coverage implementation, then product-validator-pipeline: OK after
```

- [ ] **Step 2.8: Attach `validateProduct` in `src/flow-validation-capabilities.ts`.** Import the factory and assign in the registration literals:

```typescript
import { makeProductValidator } from './validators/run-validator';

export const VALIDATOR_REGISTRATIONS: ProductValidatorRegistration[] = [
  { validatorId: 'polish-standard', label: 'Polish Standard', validateProduct: makeProductValidator('polish-standard') },
  { validatorId: 'theming', label: 'Theming / Token Consistency', validateProduct: makeProductValidator('theming') },
  { validatorId: 'anti-pattern', label: 'CSS Anti-Patterns', validateProduct: makeProductValidator('anti-pattern') },
  { validatorId: 'static-a11y', label: 'Static Accessibility', validateProduct: makeProductValidator('static-a11y') },
];
```

> The factory returns a closure that reads `GENERATED_VALIDATORS` lazily at call time, so module init order does not matter. `deriveValidator`/`validateRegistry`/`render()` read identity + owner fields only, so `--check` output is unchanged (verify in Step 2.10).

- [ ] **Step 2.9: Register the new suite** in `scripts/run-tests.ts` (append, `required:true`):

```typescript
  { rel: 'src/__tests__/product-validator-pipeline.test.ts', required: true },
```

- [ ] **Step 2.10: Verify Task 2** -> all green:

```bash
cd sidecoach
npx ts-node src/__tests__/project-collector.test.ts             # project-collector: OK
npx ts-node src/__tests__/product-validator-pipeline.test.ts    # product-validator-pipeline: OK
npx ts-node scripts/generate-validators.ts --check             # OK (no drift from attaching functions)
npm run build && npm test                                      # run-tests: 22 suite(s) passed
git add src/validators/check-context.ts src/validators/project-collector.ts src/validators/run-validator.ts src/validators/checks/index.ts src/validators/checks/polish-checks.ts src/validators/checks/a11y-checks.ts src/validators/checks/theming-checks.ts src/validators/checks/anti-pattern-checks.ts src/product-rule-registry.ts src/flow-validation-capabilities.ts src/__tests__/project-collector.test.ts src/__tests__/product-validator-pipeline.test.ts scripts/run-tests.ts
git commit -m "lane-p4a2: add truthful four-status partial-static validator pipeline"
```

---

## Task 3: polish-standard slice - port the 18 remaining polish checks

**Files:** Modify `src/polish-standard-validator.ts` only as needed to export reusable source predicates; Modify `src/validators/checks/polish-checks.ts`; Test `src/__tests__/polish-checks.test.ts`.

Adapt the HARDENED static logic from `polish-standard-validator.ts` (ids 1-17, 21, 22; id 19 already done in Task 2). Extract every static source predicate used by these rules into named exported helpers in `polish-standard-validator.ts`, update the existing validator callbacks to call those helpers, and reuse the same helpers from `polish-checks.ts`. Do not independently rewrite any regex, substring predicate, threshold, or option. Preserve every source precondition and option. The two computed-style rules (2, 16) and the dom rule (22) remain owned-but-non-required and return `inconclusive` without browser evidence. Every static rule first runs its concrete applicability probe: unknown/missing evidence -> `inconclusive`; conclusively no target -> `not_applicable`; applicable target missing the required feature -> `fail`; satisfied -> `pass`.

- [ ] **Step 3.1: Failing test first** -> `src/__tests__/polish-checks.test.ts`. It exercises the four-status contract for a representative spread (a css-rule pass/fail, an N/A rule, a computed-style inconclusive, the absence-pass elimination):

```typescript
// sidecoach/src/__tests__/polish-checks.test.ts
import { POLISH_CHECKS } from '../validators/checks/polish-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };
const get = (k: string) => { const f = POLISH_CHECKS[k]; if (!f) throw new Error(`no check for ${k}`); return f; };

function run() {
  // every owned polish rule key has a check (16 css/markup + the 3 browser-only excluded below)
  for (const k of ['polish/scale-on-press', 'polish/no-transition-all', 'polish/state-completeness', 'polish/tabular-nums']) get(k);

  // css-rule: present-feature -> pass; present-css-missing-feature -> fail; no-css -> inconclusive
  if (get('polish/scale-on-press')(ctxCss(':active { transform: scale(0.96); }')).status !== 'pass') throw new Error('scale-on-press present must pass');
  if (get('polish/scale-on-press')(ctxCss('.btn:active { color: red; }')).status !== 'fail') throw new Error('applicable scale-on-press missing must fail');
  if (get('polish/scale-on-press')(ctxCss('.prose { color: red; }')).status !== 'not_applicable') throw new Error('no interactive target must be N/A');
  if (get('polish/scale-on-press')(empty).status !== 'inconclusive') throw new Error('scale-on-press no-css must be inconclusive');

  // NEGATION rule: transition: all present -> fail; absent -> pass (css present)
  if (get('polish/no-transition-all')(ctxCss('.x { transition: all 1s; }')).status !== 'fail') throw new Error('transition:all must fail');
  if (get('polish/no-transition-all')(ctxCss('.x { transition: opacity 1s; }')).status !== 'pass') throw new Error('explicit transition must pass');

  // N/A: tabular-nums is not_applicable only when sufficient evidence establishes no dynamic-number target
  if (get('polish/tabular-nums')(ctxCss('.btn { color: red; }')).status !== 'not_applicable') throw new Error('tabular-nums with no number selectors must be N/A');
  if (get('polish/tabular-nums')(ctxCss('.price { font-variant-numeric: tabular-nums; }')).status !== 'pass') throw new Error('tabular-nums present must pass');
  if (get('polish/tabular-nums')(ctxCss('.price { color: red; }')).status !== 'fail') throw new Error('number selector without tabular-nums must fail');

  // ABSENCE-PASS ELIMINATED: concentric-radius (computed-style only) must NOT pass on absence
  const radius = POLISH_CHECKS['polish/concentric-radius'];
  if (radius && radius(empty).status === 'pass') throw new Error('computed-style rule must never pass on absent evidence');
  if (radius && radius(empty).status !== 'inconclusive') throw new Error('computed-style rule must be inconclusive without browser evidence');
  if (radius && radius({ ...empty, computedStyle: { borderRadius: '8px' } }).status !== 'inconclusive') throw new Error('ad hoc computed style must not bypass P4b collector');

  console.log('polish-checks: OK');
}
run();
```

Add a table-driven applicability test covering every Polish `not_applicable` row from the contract table. Each row supplies: `unknownEvidence -> inconclusive`, `knownNoTarget -> not_applicable`, `applicableMissingFeature -> fail`, and `applicableSatisfied -> pass`. This prevents a feature absence from being mistaken for N/A.

- [ ] **Step 3.2: Run, verify FAIL** -> `no check for polish/scale-on-press`.

- [ ] **Step 3.3: Implement the 18 checks** in `polish-checks.ts`. Each is a small pure function. The PATTERN for a css-rule presence rule:

```typescript
function cssPresence(ctx: ProductCheckContext, needle: (css: string) => boolean, okMsg: string, badMsg: string, fix: string): RuleVerdict {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return needle(ctx.cssText) ? pass(okMsg) : fail(badMsg, [], fix);
}
```

Implement each rule from its `polish-standard-validator.ts` source. The existing validator and the new adapter must call the same exported predicate helpers; no second regex/predicate implementation is allowed. Only the four-status/applicability wrapper is new. The bodies below are shape guidance; replace their inline predicates with the extracted source helpers, and pin every preserved precondition with regression tests.

Every exported static Polish check is wrapped by `withRuleApplicability(canonicalRuleKey, rawCheck)` from `check-context.ts`. That wrapper consults the complete applicability table: unknown -> inconclusive, false -> not_applicable, true -> invoke the faithful raw source predicate. The direct raw bodies below must never be exported or placed in `POLISH_CHECKS` without that wrapper.

```typescript
export const checkScaleOnPress = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, (c) => c.includes('scale(0.96)'), 'scale-on-press present', 'no :active scale(0.96) press feedback', 'Add :active { transform: scale(0.96); }');

export const checkIconSwapCompound = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, (c) => c.includes('opacity') && c.includes('scale'), 'compound icon transition present', 'icon transitions need opacity + scale (+ blur)', 'Use opacity, transform scale, and filter blur in icon transitions');

export const checkNoTransitionAll = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return ctx.cssText.includes('transition: all')
    ? fail('transition: all found; use explicit properties', [], 'Replace transition: all with specific properties')
    : pass('no transition: all');
};

export const checkSparseWillChange = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return ctx.cssText.includes('will-change: all')
    ? fail('will-change: all found', [], 'Use will-change for specific properties only')
    : pass('no will-change: all');
};

export const checkTabularNums = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const hasDynamicSelectors = /\.(?:counter|timer|stat|price|count|metric|number|kpi|tabular)\b/i.test(ctx.cssText);
  if (!hasDynamicSelectors) return notApplicable('no dynamic-number selectors in project');
  return /font-variant-numeric\s*:\s*(?:[^;]*\b)?tabular-nums/i.test(ctx.cssText)
    ? pass('tabular-nums applied') : fail('numeric fields should use tabular-nums', [], 'Add font-variant-numeric: tabular-nums');
};

export const checkSubtleExit = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const hasAnyMotion = /transition\s*:|@keyframes\b|animation\s*:/.test(ctx.cssText);
  if (!hasAnyMotion) return notApplicable('no animations or transitions in project');
  const ok = ctx.cssText.includes('opacity: 0') && (ctx.cssText.includes('scale(0.8)') || ctx.cssText.includes('scale(0.96)'));
  return ok ? pass('exit choreography present') : fail('exit animations need opacity + scale', [], 'Fade opacity to 0 and scale toward 0.96 on exit');
};

export const checkImageOutline = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const noImages = !/img\s*\{|\.image\b|<img\b/.test(ctx.cssText + ctx.markup);
  if (noImages) return notApplicable('no img rules in project');
  const ok = /img\s*\{[^}]*(?:outline|border)[^}]*rgba\s*\(\s*0\s*,\s*0\s*,\s*0/i.test(ctx.cssText)
    || /(?:img|\.image)[^{]*\{[^}]*box-shadow[^}]*inset[^}]*rgba/i.test(ctx.cssText);
  return ok ? pass('neutral image outline present') : fail('image outlines should use neutral transparency', [], 'border: 1px solid rgba(0,0,0,0.1)');
};

export const checkAnimatePresenceInitial = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  const isFramer = /framer-motion|<AnimatePresence/.test(ctx.markup);
  if (!isFramer) return notApplicable('no Framer Motion / AnimatePresence in project');
  return /initial\s*=\s*\{?\s*false/.test(ctx.markup)
    ? pass('AnimatePresence initial={false} present') : fail('AnimatePresence children need initial={false}', [], 'Set initial={false} on AnimatePresence children');
};

export const checkShadowsOverBorders = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, (c) => /box-shadow\s*:\s*[^;]*\(/.test(c), 'box-shadow elevation present', 'use box-shadow for elevation', 'Add box-shadow: 0 1px 3px rgba(0,0,0,0.1) or elevation tokens');

export const checkShadowHierarchy = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const tiered = /--shadow-(?:sm|xs|md|lg|xl|2xl|small|medium|large)/i.test(ctx.cssText);
  const multi = (ctx.cssText.match(/box-shadow\s*:/g) || []).length >= 3;
  return (tiered || multi) ? pass('shadow hierarchy present') : fail('use an elevation-based shadow hierarchy', [], 'Define --shadow-sm/md/lg or 3+ elevation tiers');
};

export const checkStateCompleteness = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const states = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
  const defined = states.filter((s) => ctx.cssText.includes(`:${s}`)).length;
  return defined >= 8 ? pass('all 8 component states defined') : fail(`${defined}/8 component states defined`, [], 'Define all 8 component states');
};

export const checkStaggeredEnter = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, (c) => c.includes('animation-delay'), 'stagger delays present', 'animations should use stagger delays', 'Apply animation-delay: calc(30ms * var(--index))');
export const checkFontSmoothing = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, (c) => c.includes('-webkit-font-smoothing'), 'font smoothing present', 'apply font smoothing', 'Add -webkit-font-smoothing: antialiased');
export const checkTextWrapBalance = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, (c) => c.includes('text-wrap: balance'), 'heading balance present', 'headings should use text-wrap: balance', 'Add text-wrap: balance to heading styles');
export const checkOpticalAlignment = (ctx: ProductCheckContext): RuleVerdict =>
  cssPresence(ctx, (c) => c.includes('padding'), 'optical alignment padding present', 'apply optical alignment adjustments', 'Subtract 2-4px from top padding for descender allowance');

// computed-style / dom rules: browser evidence absent in P4a-2 -> inconclusive (NOT pass).
export const checkConcentricRadius = (ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('concentric radius needs computed-style evidence (browser collector, P4b)', 'unsupported_runtime');
export const checkTypographyRhythm = (ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('typography rhythm needs computed-style evidence (browser collector, P4b)', 'unsupported_runtime');
export const checkGenericity = (ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('genericity needs browser/design-token evidence (P4b)', 'unsupported_runtime');

const RAW_POLISH_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'polish/reduced-motion-respect': checkReducedMotion,
  'polish/scale-on-press': checkScaleOnPress,
  'polish/concentric-radius': checkConcentricRadius,
  'polish/icon-swap-compound': checkIconSwapCompound,
  'polish/image-outline-neutral': checkImageOutline,
  'polish/no-transition-all': checkNoTransitionAll,
  'polish/tabular-nums': checkTabularNums,
  'polish/text-wrap-balance': checkTextWrapBalance,
  'polish/staggered-enter': checkStaggeredEnter,
  'polish/subtle-exit': checkSubtleExit,
  'polish/font-smoothing': checkFontSmoothing,
  'polish/animatepresence-initial': checkAnimatePresenceInitial,
  'polish/sparse-will-change': checkSparseWillChange,
  'polish/shadows-over-borders': checkShadowsOverBorders,
  'polish/optical-alignment': checkOpticalAlignment,
  'polish/typography-rhythm': checkTypographyRhythm,
  'polish/shadow-hierarchy': checkShadowHierarchy,
  'polish/state-completeness': checkStateCompleteness,
  'polish/anti-pattern-genericity': checkGenericity,
};
export const POLISH_CHECKS = Object.fromEntries(
  Object.entries(RAW_POLISH_CHECKS).map(([key, fn]) => [key, withRuleApplicability(key, fn)]),
) as Record<string, (ctx: ProductCheckContext) => RuleVerdict>;
```

(Add the `cssPresence` helper + the `import { pass, fail, notApplicable, inconclusive, hasCss, hasMarkup, withRuleApplicability } from '../check-context';` line. Keep `checkReducedMotion` from Task 2, but include it in the same wrapper map.)

- [ ] **Step 3.4: Verify Task 3** ->

```bash
cd sidecoach
# register the suite in scripts/run-tests.ts first:  { rel: 'src/__tests__/polish-checks.test.ts', required: true },
npx ts-node src/__tests__/polish-checks.test.ts                # polish-checks: OK
npx ts-node src/__tests__/product-validator-pipeline.test.ts   # still OK (reduced-motion unchanged)
npm test                                                       # run-tests: 23 suite(s) passed
git add src/polish-standard-validator.ts src/validators/checks/polish-checks.ts src/__tests__/polish-checks.test.ts scripts/run-tests.ts
git commit -m "lane-p4a2: adapt polish-standard checks to four-status verdicts"
```

---

## Task 4: static-a11y slice - focus-visible (css) + min-hit-area / color-contrast (browser-only)

**Files:** Modify `src/validators/checks/a11y-checks.ts`; Test `src/__tests__/a11y-checks.test.ts`.

`focus-visible` (id 18) is a real css-rule check. `min-hit-area` (id 5, dom) and `color-contrast` (id 20, contrast) have NO static source: they always return `inconclusive` in P4a-2, even if a unit caller supplies ad hoc browser-shaped fields, because P4b owns the trusted browser collector and coverage contract. Because they are non-required, their inconclusive results do NOT block the validator; only `focus-visible` gates.

- [ ] **Step 4.1: Failing test first** -> `src/__tests__/a11y-checks.test.ts`:

```typescript
import { A11Y_CHECKS } from '../validators/checks/a11y-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };

function run() {
  const fv = A11Y_CHECKS['a11y/focus-visible']; const mh = A11Y_CHECKS['a11y/min-hit-area']; const cc = A11Y_CHECKS['a11y/color-contrast'];
  if (!fv || !mh || !cc) throw new Error('all three a11y checks must be present');

  if (fv(ctxCss('a:focus-visible { outline: 2px solid; }')).status !== 'pass') throw new Error('focus-visible present must pass');
  if (fv(ctxCss('.btn:hover { color: red; }')).status !== 'fail') throw new Error('focus-visible missing for an applicable interactive target must fail');
  if (fv(ctxCss('.prose { color: red; }')).status !== 'not_applicable') throw new Error('known no focusable target must be N/A');
  if (fv(empty).status !== 'inconclusive') throw new Error('focus-visible no-css must be inconclusive');

  // dom-only rule: inconclusive without DOM evidence, never pass
  if (mh(ctxCss('.btn { min-height: 48px; }')).status !== 'inconclusive') throw new Error('min-hit-area must be inconclusive without DOM evidence');
  // contrast-only rule stays inconclusive until P4b's trusted browser collector
  if (cc(empty).status !== 'inconclusive') throw new Error('color-contrast must be inconclusive without contrast evidence');
  if (cc({ ...empty, contrast: { wcagAA: true, ratio: 5 } }).status !== 'inconclusive') throw new Error('ad hoc contrast evidence must not bypass P4b collector');

  console.log('a11y-checks: OK');
}
run();
```

- [ ] **Step 4.2: Run, verify FAIL** -> `all three a11y checks must be present`.

- [ ] **Step 4.3: Implement** `a11y-checks.ts`:

```typescript
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss, focusableTargetApplicability } from '../check-context';

export const checkFocusVisible = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const applicable = focusableTargetApplicability(ctx);
  if (applicable === 'unknown') return inconclusive('cannot establish focusable targets from collected evidence', 'unreadable_input');
  if (!applicable) return notApplicable('no focusable element or interactive selector');
  return ctx.cssText.includes(':focus-visible')
    ? pass(':focus-visible present')
    : fail('implement :focus-visible for keyboard navigation', [], 'Add :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }');
};

// dom-only: no static source can provide hit-area geometry. Honest inconclusive until P4b.
export const checkMinHitArea = (ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('hit-area geometry needs DOM evidence (browser collector, P4b)', 'unsupported_runtime');

// contrast-only: same. P4a-2 does not trust ad hoc browser-shaped fields.
export const checkColorContrast = (ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('contrast ratio needs measured contrast evidence (browser collector, P4b)', 'unsupported_runtime');

export const A11Y_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'a11y/focus-visible': checkFocusVisible,
  'a11y/min-hit-area': checkMinHitArea,
  'a11y/color-contrast': checkColorContrast,
};
```

- [ ] **Step 4.4: Verify Task 4** ->

```bash
cd sidecoach
# register:  { rel: 'src/__tests__/a11y-checks.test.ts', required: true },
npx ts-node src/__tests__/a11y-checks.test.ts                 # a11y-checks: OK
npm test                                                      # run-tests: 24 suite(s) passed
git add src/validators/check-context.ts src/validators/checks/a11y-checks.ts src/__tests__/a11y-checks.test.ts scripts/run-tests.ts
git commit -m "lane-p4a2: adapt static-a11y checks for partial-static floor"
```

---

## Task 5: theming slice - port the taste token checks

**Files:** Modify `src/taste-validator.ts` only to export reusable scanner/context helpers; Modify `src/validators/checks/theming-checks.ts`; Test `src/__tests__/theming-checks.test.ts`.

Adapt `taste-validator.ts` `checkHexInHoverWithCssVars` (line 226) and `checkBorderRadiusInconsistency` (line 289) into per-rule verdicts by exporting and reusing its existing `detectTailwindContext`, `blockReferencesToken`, CSS block iterator, and radius-token predicates. Do not create a lightweight replacement parser. Faithfully preserve every option and precondition: explicit `ValidateTasteOptions.tailwindDetected`, Tailwind/shadcn content detection, `hsl(var(--token))`, `@apply`/semantic token utility carve-outs, and token-derived radius carve-outs. Hex-in-interactive-state is applicable only when both an interactive state and a token system are established; border-radius is applicable only when a radius declaration/utility is established.

- [ ] **Step 5.1: Failing test first** -> `src/__tests__/theming-checks.test.ts`:

```typescript
import { THEMING_CHECKS } from '../validators/checks/theming-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };

function run() {
  const hex = THEMING_CHECKS['theming/token-driven-interactive-state'];
  const radius = THEMING_CHECKS['theming/border-radius-consistency'];
  if (!hex || !radius) throw new Error('both theming checks must be present');

  if (hex(empty).status !== 'inconclusive') throw new Error('hex check needs CSS evidence');
  // file defines tokens AND a :hover uses a raw hex -> fail
  const offending = ':root { --c: #abc; } .b:hover { color: #ff0000; }';
  if (hex(ctxCss(offending)).status !== 'fail') throw new Error('hardcoded hex in :hover with tokens defined must fail');
  // tokens defined, interactive state token-driven -> pass
  if (hex(ctxCss(':root { --c: #abc; } .b:hover { color: var(--c); }')).status !== 'pass') throw new Error('token-driven hover must pass');
  // faithful Tailwind/shadcn carve-out: token utility makes incidental hex non-offending
  const tw = '@tailwind base; :root { --primary: 222 47% 11%; } .b:hover { @apply bg-primary/90; color: #fff; }';
  if (hex(ctxCss(tw)).status !== 'pass') throw new Error('Tailwind token utility must not false-positive');
  // no tokens in file at all -> not_applicable (no token system to violate)
  if (hex(ctxCss('.b:hover { color: #ff0000; }')).status !== 'not_applicable') throw new Error('no CSS vars -> N/A');

  // >2 distinct radius literals -> fail; <=2 -> pass
  if (radius(ctxCss('.a{border-radius:3px}.b{border-radius:5px}.c{border-radius:9px}')).status !== 'fail') throw new Error('3 radius literals must fail');
  if (radius(ctxCss('.a{border-radius:4px}.b{border-radius:8px}')).status !== 'pass') throw new Error('<=2 radius literals must pass');
  // no border-radius at all -> not_applicable
  if (radius(ctxCss('.a{color:red}')).status !== 'not_applicable') throw new Error('no radius -> N/A');

  console.log('theming-checks: OK');
}
run();
```

- [ ] **Step 5.2: Run, verify FAIL** -> `both theming checks must be present`.

- [ ] **Step 5.3: Implement** `theming-checks.ts` by calling the exported `taste-validator.ts` scanner helpers and mapping their result to four-status verdicts. The following is wrapper shape only; do not duplicate `blocks`, Tailwind detection, token-reference, or radius-value logic in the adapter:

```typescript
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss } from '../check-context';

export const checkHexInInteractiveState = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const applicability = interactiveTokenApplicability(ctx);
  if (applicability === 'unknown') return inconclusive('cannot establish interactive token applicability', 'unreadable_input');
  if (!applicability) return notApplicable('no interactive token-system target');
  const offenders = scanHexInHoverWithCssVars(ctx.markup, ctx.cssText, ctx.tasteOptions);
  return offenders.length
    ? fail(`interactive state(s) use hardcoded hex while tokens exist: ${offenders.join(', ')}`, offenders, 'Derive the interactive state from a token, e.g. var(--c-brand-hover)')
    : pass('interactive states are token-driven');
};

export const checkBorderRadiusConsistency = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  if (!radiusApplicability(ctx)) return notApplicable('no radius declaration or rounded utility');
  const violations = scanBorderRadiusInconsistency(ctx.markup, ctx.cssText, ctx.tasteOptions);
  return violations.length ? fail(violations[0].message, [], violations[0].remediation) : pass('radius usage satisfies taste scanner');
};

export const THEMING_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'theming/token-driven-interactive-state': checkHexInInteractiveState,
  'theming/border-radius-consistency': checkBorderRadiusConsistency,
};
```

- [ ] **Step 5.4: Verify Task 5** ->

```bash
cd sidecoach
# register:  { rel: 'src/__tests__/theming-checks.test.ts', required: true },
npx ts-node src/__tests__/theming-checks.test.ts             # theming-checks: OK
npm test                                                     # run-tests: 25 suite(s) passed
git add src/taste-validator.ts src/validators/check-context.ts src/validators/checks/theming-checks.ts src/__tests__/theming-checks.test.ts scripts/run-tests.ts
git commit -m "lane-p4a2: adapt faithful taste token scanners"
```

---

## Task 6: anti-pattern slice - port the 6 ban detectors

**Files:** Modify `src/absolute-ban-detector.ts` only to export its six existing scanner functions; Modify `src/validators/checks/anti-pattern-checks.ts`; Test `src/__tests__/anti-pattern-checks.test.ts`.

Reuse the scanners from `absolute-ban-detector.ts`; do not rederive their regexes in the adapter. Export the existing six scanner functions without changing their behavior, then map findings to four-status verdicts. This preserves every source precondition, especially `scanIdenticalCardGrids` requiring `grid-template-columns: repeat(N, 1fr)` with `N >= 3` before repeated cards can match. The three precise CSS detectors scan each applicable file. The three HTML-structural heuristics are declared `scope: 'project'` and scan assembled markup because their source semantics reason over a page shape.

- [ ] **Step 6.1: Failing test first** -> `src/__tests__/anti-pattern-checks.test.ts`:

```typescript
import { ANTI_PATTERN_CHECKS } from '../validators/checks/anti-pattern-checks';
import type { ProductCheckContext } from '../validators/check-context';

const ctxCss = (css: string): ProductCheckContext => ({ cssText: css, markup: '', files: [{ path: 'a.css', sourceKind: 'css', cssText: css, markup: '', evidenceKindsPresent: ['css'] }] });
const ctxMarkup = (html: string): ProductCheckContext => ({ cssText: '', markup: html, files: [{ path: 'a.html', sourceKind: 'html', cssText: '', markup: html, evidenceKindsPresent: ['html'] }] });
const empty: ProductCheckContext = { cssText: '', markup: '', files: [] };

function run() {
  const gt = ANTI_PATTERN_CHECKS['anti-pattern/gradient-text'];
  const gl = ANTI_PATTERN_CHECKS['anti-pattern/glassmorphism-default'];
  const ss = ANTI_PATTERN_CHECKS['anti-pattern/side-stripe-borders'];
  const cg = ANTI_PATTERN_CHECKS['anti-pattern/identical-card-grids'];
  const mo = ANTI_PATTERN_CHECKS['anti-pattern/modal-as-first-thought'];
  for (const [k, f] of Object.entries({ gt, gl, ss, cg, mo })) if (!f) throw new Error(`missing ${k}`);

  // gradient-text: clip + gradient -> fail; clean css -> pass; no css -> inconclusive
  if (gt(ctxCss('.h { background-clip: text; background: linear-gradient(#a,#b); }')).status !== 'fail') throw new Error('gradient-text must fail');
  if (gt(ctxCss('.h { color: red; }')).status !== 'pass') throw new Error('clean css gradient-text must pass');
  if (gt(empty).status !== 'inconclusive') throw new Error('gradient-text no-css must be inconclusive');

  // glassmorphism: blur + low alpha -> fail
  if (gl(ctxCss('.g { backdrop-filter: blur(8px); background: rgba(255,255,255,0.2); }')).status !== 'fail') throw new Error('glassmorphism must fail');

  // markup heuristic: dialog+form -> fail; no markup -> inconclusive (not pass)
  if (mo(ctxMarkup('<div class="modal"><form><input></form></div>')).status !== 'fail') throw new Error('modal-as-first-thought must fail');
  if (mo(empty).status !== 'inconclusive') throw new Error('markup detector with no markup must be inconclusive');
  if (cg(ctxMarkup('<main><p>hi</p></main>')).status !== 'pass') throw new Error('clean markup must pass');
  const repeatedCardsWithoutRepeatGrid = '<main><article class="card"><h2>A</h2><p>x</p></article><article class="card"><h2>B</h2><p>x</p></article><article class="card"><h2>C</h2><p>x</p></article></main>';
  if (cg(ctxMarkup(repeatedCardsWithoutRepeatGrid)).status !== 'pass') throw new Error('identical cards without repeat(...) grid precondition must not find');
  const repeatedCardsWithRepeatGrid = '<style>.grid{display:grid;grid-template-columns:repeat(3,1fr)}</style><main class="grid"><article class="card"><h2>A</h2><p>x</p></article><article class="card"><h2>B</h2><p>x</p></article><article class="card"><h2>C</h2><p>x</p></article></main>';
  if (cg(ctxMarkup(repeatedCardsWithRepeatGrid)).status !== 'fail') throw new Error('repeat(...) grid plus repeated cards must preserve source finding');

  console.log('anti-pattern-checks: OK');
}
run();
```

- [ ] **Step 6.2: Run, verify FAIL** -> `missing gt`.

- [ ] **Step 6.3: Implement** `anti-pattern-checks.ts` as a thin adapter over the exported `absolute-ban-detector.ts` scanner functions. The code below describes the verdict mapping, but DELETE the duplicated regex bodies shown in v1 rather than maintaining two scanners:

```typescript
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss, hasMarkup } from '../check-context';
import {
  scanGradientText, scanGlassmorphism, scanSideStripeBorders,
  scanIdenticalCardGrids, scanHeroMetricTemplate, scanModalAsFirstThought,
} from '../../absolute-ban-detector';
import type { AbsoluteBanFinding } from '../../absolute-ban-detector';

function verdictFromBanFindings(findings: AbsoluteBanFinding[], cleanMessage: string): RuleVerdict {
  return findings.length
    ? fail(findings[0].message, findings.map((f) => `${f.file}:${f.line}`), findings[0].remediation)
    : pass(cleanMessage);
}

export const checkGradientText = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanGradientText(ctx.cssText, '<collected-file>'), 'no gradient-text ban');
};

export const checkGlassmorphism = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanGlassmorphism(ctx.cssText, '<collected-file>'), 'no glassmorphism-default ban');
};

export const checkSideStripeBorders = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return verdictFromBanFindings(scanSideStripeBorders(ctx.cssText, '<collected-file>'), 'no side-stripe-borders ban');
};

// --- HTML-structural heuristics (declared minor; still emit fail when matched) ---
export const checkIdenticalCardGrids = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanIdenticalCardGrids(ctx.markup, '<assembled-markup>'), 'no identical-card-grids shape');
};

export const checkHeroMetricTemplate = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanHeroMetricTemplate(ctx.markup, '<assembled-markup>'), 'no hero-metric-template shape');
};

export const checkModalAsFirstThought = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  return verdictFromBanFindings(scanModalAsFirstThought(ctx.markup, '<assembled-markup>'), 'no modal-as-first-thought shape');
};

export const ANTI_PATTERN_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
  'anti-pattern/gradient-text': checkGradientText,
  'anti-pattern/glassmorphism-default': checkGlassmorphism,
  'anti-pattern/side-stripe-borders': checkSideStripeBorders,
  'anti-pattern/identical-card-grids': checkIdenticalCardGrids,
  'anti-pattern/hero-metric-template': checkHeroMetricTemplate,
  'anti-pattern/modal-as-first-thought': checkModalAsFirstThought,
};
```

- [ ] **Step 6.4: Verify Task 6** ->

```bash
cd sidecoach
# register:  { rel: 'src/__tests__/anti-pattern-checks.test.ts', required: true },
npx ts-node src/__tests__/anti-pattern-checks.test.ts        # anti-pattern-checks: OK
npm test                                                     # run-tests: 26 suite(s) passed
git add src/absolute-ban-detector.ts src/validators/checks/anti-pattern-checks.ts src/__tests__/anti-pattern-checks.test.ts scripts/run-tests.ts
git commit -m "lane-p4a2: adapt faithful absolute-ban scanners"
```

---

## Task 7: Fixtures + end-to-end validateProduct execution

**Files:** Create `sidecoach/fixtures/<validatorId>/{clean,findings,inconclusive}/` files; Test `src/__tests__/validator-fixtures-e2e.test.ts`.

This fulfills the P4a-1 deferral: the manifest declared the three fixture categories per gating validator; this task CREATES the files and a suite EXECUTES `validateProduct` against each, asserting the resulting `status`. Now that all four validators' required checks are implemented, a real `clean` result is achievable.

The e2e suite resolves each manifest path relative to the sidecoach root (`FIXTURE_MANIFEST[i].fixtures.{clean,findings,inconclusive}` are `fixtures/<id>/<cat>`), runs `validateProduct({ projectPath })`, and asserts:
- clean dir -> `status === 'clean'`
- findings dir -> `status === 'findings'` (a blocking-severity fail above tolerance)
- inconclusive dir -> `status === 'inconclusive'` (a required rule could not be measured: empty dir, or unsupported-source-only)

- [ ] **Step 7.1: Failing test first** -> `src/__tests__/validator-fixtures-e2e.test.ts`:

```typescript
import * as path from 'path';
import { VALIDATOR_REGISTRATIONS, FIXTURE_MANIFEST, getValidatorRegistration } from '../flow-validation-capabilities';

const SC = path.resolve(__dirname, '..', '..');

function run() {
  for (const m of FIXTURE_MANIFEST) {
    const reg = getValidatorRegistration(m.validatorId);
    if (!reg || !reg.validateProduct) throw new Error(`${m.validatorId} has no validateProduct`);
    const cases: Array<['clean' | 'findings' | 'inconclusive', string]> = [
      ['clean', m.fixtures.clean], ['findings', m.fixtures.findings], ['inconclusive', m.fixtures.inconclusive],
    ];
    for (const [expected, rel] of cases) {
      const res = reg.validateProduct!({ projectPath: path.resolve(SC, rel) });
      if (res.status !== expected) {
        throw new Error(`${m.validatorId} ${rel}: expected status ${expected}, got ${res.status} (rules: ${res.rules.map((r) => r.ruleId + '=' + r.status).join(', ')})`);
      }
    }
  }
  // a clean result MAY still carry non-blocking findings; consumers read status, not findings.length
  const ap = getValidatorRegistration('anti-pattern')!.validateProduct!({ projectPath: path.resolve(SC, 'fixtures/anti-pattern/clean') });
  if (ap.status !== 'clean') throw new Error('anti-pattern clean fixture must be clean');

  console.log('validator-fixtures-e2e: OK');
}
run();
```

- [ ] **Step 7.2: Run, verify FAIL** -> path-not-found / status mismatch (no fixtures yet).

- [ ] **Step 7.3: Create the fixtures.** Each dir holds the minimal source that produces the target status. Concrete contents:

`fixtures/static-a11y/clean/styles.css` (focus-visible is the only required rule; the dom/contrast rules are non-required so their inconclusive does not block):
```css
:root { --c: #112233; }
a:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
```
`fixtures/static-a11y/findings/styles.css` (CSS present, focus-visible ABSENT -> required blocker fail):
```css
.btn:hover { color: #112233; }
```
`fixtures/static-a11y/inconclusive/` (empty dir, keep with a `.gitkeep` -> no CSS collected -> focus-visible inconclusive -> status inconclusive). NOTE: an empty directory needs a tracked placeholder file; add `fixtures/static-a11y/inconclusive/.gitkeep`.

`fixtures/theming/clean/styles.css`:
```css
:root { --c-brand: #c0392b; --radius: 8px; }
.btn { border-radius: var(--radius); }
.btn:hover { color: var(--c-brand); }
```
`fixtures/theming/findings/styles.css` (tokens defined + hardcoded hex in :hover -> blocker fail):
```css
:root { --c-brand: #c0392b; }
.btn:hover { color: #ff0000; }
```
`fixtures/theming/inconclusive/.gitkeep` (empty -> both required rules inconclusive).

`fixtures/anti-pattern/clean/markup.html` (no bans; CSS + markup present so all 6 required rules measurable and passing):
```html
<style>.h { color: #333; }</style>
<main><section><h1>Title</h1><p>Body copy.</p></section></main>
```
`fixtures/anti-pattern/findings/styles.css` (a precise BLOCKING ban -> status findings):
```css
.hero-title { background-clip: text; -webkit-background-clip: text; background: linear-gradient(#a00, #00a); }
```
NOTE: the findings dir needs markup too so the markup-required rules are measurable (otherwise they would be inconclusive and flip the status to inconclusive, not findings). Add `fixtures/anti-pattern/findings/markup.html`:
```html
<main><p>clean</p></main>
```
`fixtures/anti-pattern/inconclusive/.gitkeep` (empty -> required rules inconclusive).

`fixtures/polish-standard/clean/styles.css` (must satisfy EVERY required polish rule; N/A rules excluded). Transcribe exactly:
```css
:root { --shadow-sm: 0 1px 2px rgba(0,0,0,0.1); --shadow-md: 0 4px 6px rgba(0,0,0,0.1); --shadow-lg: 0 10px 25px rgba(0,0,0,0.1); }
* { -webkit-font-smoothing: antialiased; }
h1 { text-wrap: balance; padding: 8px; }
.btn { padding: 12px; box-shadow: var(--shadow-sm); transition: opacity 200ms, transform 200ms; }
.btn:active { transform: scale(0.96); opacity: 0; filter: blur(2px); }
.card { box-shadow: var(--shadow-md); }
.panel { box-shadow: var(--shadow-lg); }
.list-item { animation-delay: 30ms; }
.exit { opacity: 0; transform: scale(0.96); }
.s:default {} .s:hover {} .s:focus {} .s:active {} .s:disabled {} .s:loading {} .s:error {} .s:success {}
@media (prefers-reduced-motion: reduce) { * { animation: none; transition: none; } }
```
Why this is clean: scale-on-press (scale(0.96)), icon-swap (opacity+scale), no-transition-all (none present), staggered-enter (animation-delay), subtle-exit (opacity:0 + scale(0.96)), font-smoothing, text-wrap-balance, shadows-over-borders (box-shadow(...)), shadow-hierarchy (--shadow tiers + 3+ box-shadow), optical-alignment (padding), state-completeness (8 `:state` substrings), reduced-motion (media query) all pass. image-outline (no img), tabular-nums (no number selectors), animatepresence (no Framer markup) are not_applicable. concentric-radius / typography-rhythm / genericity are non-required (browser-only) so their inconclusive does not block.

`fixtures/polish-standard/findings/styles.css` (drop reduced-motion -> required blocker fail). Copy `clean/styles.css` MINUS the `@media (prefers-reduced-motion ...)` line.

`polish.animatepresence-initial` is a required markup rule, so BOTH Polish clean and findings fixtures must contain inspected markup. Add the same non-Framer file to both; this provides enough evidence for the applicability probe to resolve `not_applicable` rather than `inconclusive`:

`fixtures/polish-standard/clean/markup.html` and `fixtures/polish-standard/findings/markup.html`:
```html
<main><button class="btn" type="button"><span class="icon" aria-hidden="true"></span>Save</button><h1>Settings</h1></main>
```

The e2e test must assert `polish.animatepresence-initial === 'not_applicable'` in both fixtures and must assert each gating validator reaches exactly `clean`, `findings`, and `inconclusive` for its three manifest entries. No CSS-only Polish fixture is accepted.

`fixtures/polish-standard/inconclusive/.gitkeep` (empty -> required rules inconclusive).

- [ ] **Step 7.4: Run, verify PASS** -> iterate until every fixture yields its target status:

```bash
cd sidecoach
# register:  { rel: 'src/__tests__/validator-fixtures-e2e.test.ts', required: true },
npx ts-node src/__tests__/validator-fixtures-e2e.test.ts     # validator-fixtures-e2e: OK
```

If a clean fixture reports `findings` or `inconclusive`, the failure message lists each rule's status; add the missing satisfying CSS/markup or move an unsatisfiable rule's evidence. Do NOT weaken a check to make a fixture pass.

- [ ] **Step 7.5: Verify Task 7** ->

```bash
cd sidecoach
npm test                                                     # run-tests: 27 suite(s) passed
git add fixtures/static-a11y fixtures/theming fixtures/anti-pattern fixtures/polish-standard src/__tests__/validator-fixtures-e2e.test.ts scripts/run-tests.ts
git commit -m "lane-p4a2: add achievable partial-static validator fixtures"
```

---

## Task 8: Final integration check

- [ ] **Step 8.1: Full suite + generators clean** -> verify:

```bash
cd sidecoach
npx ts-node scripts/generate-validators.ts --check     # OK (registry valid, manifest present, no drift)
npx ts-node scripts/generate-lanes.ts --check          # OK (unaffected)
npm run build                                          # exit 0
npm test                                               # run-tests: 27 suite(s) passed
```

`27` = the prior 20 + project-collector + product-validator-pipeline + polish-checks + a11y-checks + theming-checks + anti-pattern-checks + validator-fixtures-e2e. Every new suite present and `required:true`.

- [ ] **Step 8.2: Regenerated artifact is committed and drift-free** -> verify `git status --porcelain src/validators.generated.ts` is empty (the file was regenerated in Task 1 and committed; nothing since changed it).

- [ ] **Step 8.3: Hook regression green** -> verify the dotfiles validation/bash guard regression suites still pass unchanged (no behavior in this plan touches them).

- [ ] **Step 8.4: Scope and staging guard** -> this sub-plan must NOT touch lane execution, the mcp-server, or the deferred `domains/*` adaptation. Compare committed paths to an explicit allowlist, then prove the preexisting-dirty snapshot was not staged, committed, or altered by this work:

```bash
cd /Users/spare3/Documents/Github/improv
cat > /tmp/lane-p4a2-allowed-paths.txt <<'EOF'
sidecoach/fixtures/anti-pattern/
sidecoach/fixtures/polish-standard/
sidecoach/fixtures/static-a11y/
sidecoach/fixtures/theming/
sidecoach/scripts/run-tests.ts
sidecoach/src/__tests__/a11y-checks.test.ts
sidecoach/src/__tests__/anti-pattern-checks.test.ts
sidecoach/src/__tests__/generate-validators.test.ts
sidecoach/src/__tests__/polish-checks.test.ts
sidecoach/src/__tests__/product-rule-registry.test.ts
sidecoach/src/__tests__/product-validator-pipeline.test.ts
sidecoach/src/__tests__/project-collector.test.ts
sidecoach/src/__tests__/theming-checks.test.ts
sidecoach/src/__tests__/validator-fixtures-e2e.test.ts
sidecoach/src/absolute-ban-detector.ts
sidecoach/src/flow-validation-capabilities.ts
sidecoach/src/polish-standard-validator.ts
sidecoach/src/product-rule-registry.ts
sidecoach/src/taste-validator.ts
sidecoach/src/validator-generation.ts
sidecoach/src/validators.generated.ts
sidecoach/src/validators/
EOF
git diff --name-only main..lane-p4a2-validator-adaptation | sort > /tmp/lane-p4a2-committed-paths.txt
bad="$(awk 'NR==FNR { a[++n]=$0; next } { ok=0; for (i=1;i<=n;i++) { if (a[i] ~ /\/$/ ? index($0,a[i])==1 : $0==a[i]) ok=1 } if (!ok) print }' /tmp/lane-p4a2-allowed-paths.txt /tmp/lane-p4a2-committed-paths.txt)"
test -z "$bad" || { printf 'PATH OUTSIDE ALLOWLIST:\n%s\n' "$bad"; exit 1; }
sed -E 's/^.. //' /tmp/lane-p4a2-preexisting-dirty.txt | sort -u > /tmp/lane-p4a2-preexisting-paths.txt
overlap="$(comm -12 /tmp/lane-p4a2-preexisting-paths.txt /tmp/lane-p4a2-committed-paths.txt)"
test -z "$overlap" || { printf 'PREEXISTING DIRTY PATH COMMITTED:\n%s\n' "$overlap"; exit 1; }
git status --porcelain | sort > /tmp/lane-p4a2-postexisting-dirty.txt
diff -u /tmp/lane-p4a2-preexisting-dirty.txt /tmp/lane-p4a2-postexisting-dirty.txt
echo clean
```

Expect `clean`. Every task stages only its listed owned paths; broad staging is forbidden. Wiring the collector into Flow J's handler is P4b.

- [ ] **Step 8.5: dist** -> no dist commit needed; no CLI/runtime path consumes these entry points yet (P4b wires `validateProduct` into `advanceLane`). If `npm run build` left `dist/` dirty, leave it uncommitted.

---

## Acceptance

- The delivered claim is the STATIC-DETERMINABLE PARTIAL floor only. The five browser-evidence rules remain owned-but-non-required, return `inconclusive` without browser evidence, and contribute only to `unverifiedScope`. Copy/linguistic gating is deferred to P4e.
- The registry contains exactly 30 definitions with an exact table assertion over every field and exact resolution assertions for all 22 Polish alias pairs.
- One source-support matrix is consumed by registry authoring, generator validation, and collection. Sass-only and mixed supported/unsupported projects are tested.
- Collection never silently drops discovered inputs. Root collection failure is validator-level `error`; per-file unreadable/oversized gaps remain discovered, populate skipped/unreadable views, and make affected required rules inconclusive.
- Every file-scoped rule executes per applicable file and aggregates honestly. Project-wide execution is used only for rules declared `scope: 'project'`. Coverage observations name the exact applicable/evaluated files.
- `measuredScope` contains only sufficiently-covered, non-inconclusive rule scope; `unverifiedScope` is always the registry-scope difference.
- Every `not_applicable` rule has a concrete, tested applicability probe. Unknown applicability is inconclusive.
- Existing source scanners/predicates are exported and reused. The repeat-grid absence regression and Tailwind token-utility regression pass.
- Each gating validator's clean/findings/inconclusive fixtures reach those exact statuses. Polish clean/findings fixtures include non-Framer markup so `polish.animatepresence-initial` resolves N/A.
- Every commit stages only task-owned paths, and the final allowlist/preexisting-dirty guard passes.

---

## Deferred (later P4 sub-plans)

- **P4b:** wire `validateProduct` into `advanceLane` step/iteration-boundary gating; consume this plan's truthful static `CoverageObservation` / `RunCoverage`; add the browser-evidence collector that turns the `dom`/`computed-style`/`contrast` rules (`min-hit-area`, `color-contrast`, `concentric-radius`, `typography-rhythm`, `genericity`) from owned-non-required/inconclusive into measured; the async lease/lock/outbox/AbortSignal durability (the folded P3); wire `project-collector.ts` into `flow-handler-tactical-polish.ts`. Per spec 610-612, these browser-only rules stay inconclusive and never enter `measuredScope` until that collector exists.
- **P4c:** loop execution + `lane_converge` enablement after the required release-floor phases exist; `ralph-loop.ts` -> `convergence-loop.ts`.
- **P4d:** MCP migration (`classify-intent` / `list-lanes` / `sidecoach_lane`) + `modes.ts` deletion + SKILL/CHEATSHEET/marketing regen.
- **P4e copy/linguistic gating adaptation (explicitly NOT in P4a-2):** adapt `linguistic-ban-validator.ts` into the gating model. Model it as TWO canonical rules (`copy.rhetorical-template` blocker, `copy.slop-word` minor) under a `copy` finding class, not approximately 38 per-pattern rules. Until P4e, this plan is a partial static floor and makes no copy/linguistic clean claim.

---

## Self-Review (P4a-1 review lessons applied)

- **No changelog-vs-body drift (the P4a-1 v2 failure mode):** this plan has no `## What changed` section or separate changelog. The goal/architecture intro matches the task bodies: partial static floor, truthful collection/coverage, browser evidence deferred to P4b, and linguistic gating deferred to P4e.
- **Every new symbol traces to a caller in its own task:** `stampResult`/`pass`/`fail`/`notApplicable`/`inconclusive`/`hasCss`/`hasMarkup` are consumed by the slice checks and tested in Tasks 2-6; `collect`/`collectFromPath` are consumed by `makeProductValidator` and exercised by the pipeline (Task 2) and fixture (Task 7) suites; `makeProductValidator` is attached to every registration and tested end-to-end; every `CHECKS` key is asserted present by its slice test; `missingCheck` is asserted by the pipeline test's unattached-rule case.
- **Four-status honesty (status not findings.length; missing evidence -> inconclusive):** every rule applies its concrete applicability probe before feature evaluation. Missing/unsupported/unreadable/oversized or applicability-unknown evidence is inconclusive; conclusively absent targets are N/A; applicable missing features fail. The pipeline test uses a genuinely throwing proxy and pins `normalizedErrorCategory === 'rule_exception'`.
- **Generated-not-authored:** `cleanPolicy` / `ownedRuleIds` / `requiredRuleIds` / `requiredCoverageByScope` stay generated into `validators.generated.ts` and regenerated after the registry grows (Task 1); the runtime validators READ that policy, they never re-derive it. Attaching `checkProduct`/`validateProduct` functions does not change the generated output (`deriveValidator` and `JSON.stringify` read identity/owner fields only) - verified by `--check` staying green in Steps 2.10 and 8.1.
- **Honor the P4a-1 evidence-compat model + clean-evaluator:** `makeProductValidator` builds `CoverageObservation`/`RunCoverage` and calls `evaluateCleanPolicy`; it does NOT reimplement non-vacuity, coverage, or the 7-step algorithm. File-scoped rules run per applicable file; observations list the actual evaluated files plus applicable gaps; `measuredScope` is derived only from conclusive sufficiently-covered executions and `unverifiedScope` is the registry-scope difference.
- **Exact registry and one source matrix:** Task 1 table-tests every field of all 30 definitions and all 22 Polish alias pairs. One supported-source matrix drives both registry generation and collection, with Sass-only and mixed supported/unsupported regression projects.
- **Ground every id/severity in the real source:** polish ids/severities are `polish-standard-validator.ts` (= `extended-domain-validator.ts` `POLISH_0NN`); ban names are the raw `findingFromBan(...)` strings; taste ids are `taste/hex-in-interactive-state` and `taste/border-radius-inconsistency`; the two severity overrides (`identical-card-grids`, `hero-metric-template`) cite `absolute-ban-detector.ts:19-21`. No invented ids.
- **Incremental honesty:** between Task 2 and Tasks 3-6, unattached required rules resolve to `missingCheck` -> `inconclusive`, so a validator reports `inconclusive` (never a false `clean`) until its whole required set is implemented; the fixture `clean` cases (Task 7) only pass once every required check exists, which is why Task 7 is last.
- **Scope discipline:** no lane-runner / orchestrator / mcp-server / `domains/*` / `flow-handler-tactical-polish.ts` edits; the recursive collector lands as a NEW module and its Flow J wiring is explicitly P4b. Every commit stages task-owned paths only. Step 8.4 compares committed paths to an explicit allowlist and verifies the complete preexisting-dirty snapshot is unchanged.
- **Reviewer watch-items:** (1) after Task 1, RE-RUN `generate-validators.ts` (not just `--check`) and COMMIT `validators.generated.ts`, or `--check` fails on drift; (2) the anti-pattern `findings` and `clean` fixtures need BOTH css and markup files so the markup-required rules are measurable (an omitted channel makes them inconclusive and flips the status); (3) empty `inconclusive` fixture dirs need a tracked `.gitkeep`, since git does not track empty directories; (4) the `${severity}|${findingClass}` tolerance key set by the generator must match what the evaluator counts - unchanged from P4a-1, but the new `major|anti-pattern` and `blocker|theming` pairs are first exercised here.
