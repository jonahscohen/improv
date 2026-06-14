# Floor-Validator Rule Set + checkProduct/validateProduct Adaptation (Phase 4a-2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. Every task is failing-test-first, then real implementation, then the exact verify command. No task is "done" until its verify clause passes.

**Goal:** Build ON the merged P4a-1 foundation (`product-rule-types.ts`, `product-rule-registry.ts` 6-rule seed, `flow-validation-capabilities.ts`, `validator-generation.ts`, `clean-evaluator.ts`). Three deliverables:

1. EXPAND `product-rule-registry.ts` from the 6-rule seed to the full floor-validator canonical rule set (30 rules): the 22 Polish Standard rules (each canonicalizing its cross-registry `POLISH_0NN` duplicate via `sourceRuleAliases`), split by `findingClass` across the `polish-standard` and `static-a11y` owners, plus the `theming` token slice, the `anti-pattern` CSS/markup ban slice, and the remaining `static-a11y` rule. Keep `generate-validators.ts --check` green.
2. ATTACH a real four-status `checkProduct` to every `ProductRuleDefinition` and a real `validateProduct` to every `ProductValidatorRegistration`. Adapt the EXISTING validator logic (the hardened static checks already in `polish-standard-validator.ts`, the taste checks in `taste-validator.ts`, the ban detectors in `absolute-ban-detector.ts`) into pure per-rule verdicts that emit `pass | fail | not_applicable | inconclusive`. Eliminate the absence-passes (`undefined !== '0px' -> pass`) and the N/A-as-`passed: true` convention: missing, unsupported, or unreadable evidence becomes `inconclusive`, never `pass`. A thrown rule check is CAUGHT and recorded `inconclusive` + `normalizedErrorCategory`.
3. WIRE `validateProduct` to collect a target, run its owned rules' `checkProduct`, build per-file `CoverageObservation`s, and assemble a `ProductValidationResult` by calling the P4a-1 `evaluateCleanPolicy` (do NOT re-implement it). Create the clean/findings/inconclusive fixture files declared by the P4a-1 manifest and make a suite EXECUTE them.

**Out of scope (DEFERRED, do NOT pull forward):** P4b lane EXECUTION wiring (`advanceLane` calling validators) + async/lease/outbox durability; P4c loops/convergence enablement; P4d MCP/cleanup. This plan does NOT call any validator from `lane-runner.ts`. It builds the entry points and proves them through direct unit + fixture tests only.

**Architecture.** Per spec section 7 (lines 367-634, 939-958, 1262-1310). The P4a-1 type already declared `checkProduct?` (on `ProductRuleDefinition`) and `validateProduct?` (on `ProductValidatorRegistration`) as OPTIONAL; this plan fills them in. The single source of each per-validator `cleanPolicy` / `ownedRuleIds` / `requiredRuleIds` stays the GENERATED `validators.generated.ts` (expanded by re-running the generator after the registry grows); the runtime validators READ the generated policy, they never re-derive it. Per-rule check logic is PURE (`context -> verdict`); the collection of files and the orchestration into a `ProductValidationResult` lives in a shared `run-validator.ts`. The four floor validators differ ONLY in which rules they own; orchestration is one shared factory `makeProductValidator(validatorId)`.

**Tech Stack:** TypeScript (`sidecoach/src/`). ts-node runner via `sidecoach/scripts/run-tests.ts` SUITES (explicit, `required:true`). No new deps.

---

## File Structure

**Create:**
- `sidecoach/src/validators/check-context.ts` - the per-target evidence type `ProductCheckContext`, the per-file `CollectedFile`, the verdict subtype `RuleVerdict`, the verdict helpers (`pass`/`fail`/`notApplicable`/`inconclusive`), and `stampResult(def, verdict) -> ProductRuleResult` (stamps `ruleId`/`canonicalRuleKey`/`severity`/`findingClass` from the definition so per-rule metadata is never duplicated in a check body). Imports `product-rule-types` only; no fs.
- `sidecoach/src/validators/checks/polish-checks.ts` - the pure verdict functions for the 18 `polish-standard`-owned rules (adapted from `polish-standard-validator.ts` hardened static logic).
- `sidecoach/src/validators/checks/a11y-checks.ts` - the 3 `static-a11y`-owned rule verdicts (`focus-visible` css-rule; `min-hit-area` dom-only -> inconclusive; `color-contrast` contrast-only -> inconclusive).
- `sidecoach/src/validators/checks/theming-checks.ts` - the 2 `theming`-owned rule verdicts (adapted from `taste-validator.ts` `hex-in-interactive-state` + `border-radius-inconsistency`).
- `sidecoach/src/validators/checks/anti-pattern-checks.ts` - the 6 `anti-pattern`-owned rule verdicts (adapted from `absolute-ban-detector.ts` scanners).
- `sidecoach/src/validators/checks/index.ts` - merges the four slices into `CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict>` keyed by `canonicalRuleKey`, plus `missingCheck` (returns `inconclusive` for any unattached key).
- `sidecoach/src/validators/project-collector.ts` - recursive project discovery (supported source types; excludes `node_modules`, dot-dirs, `dist`; 2MB per-file cap) producing `CollectedFile[]` + the joined `cssText`/`markup` + per-file `evidenceKindsPresent` (the file's source kind). Adapts and replaces the one-level-deep collectors in `absolute-ban-detector.ts:189` and `flow-handler-tactical-polish.ts:37`.
- `sidecoach/src/validators/run-validator.ts` - `makeProductValidator(validatorId) -> (context) => ProductValidationResult`: reads the validator's generated `cleanPolicy`/`ownedRuleIds`, collects, runs each owned rule's `checkProduct`, builds one `CoverageObservation` per required rule + a `RunCoverage`, and calls `evaluateCleanPolicy`. Validator-level collection failure routes through `evaluateCleanPolicy`'s `validatorError` path.
- Fixtures under `sidecoach/fixtures/<validatorId>/{clean,findings,inconclusive}/` (the exact paths the P4a-1 `FIXTURE_MANIFEST` already declares).
- Tests (under `src/__tests__/`): `product-validator-pipeline.test.ts`, `polish-checks.test.ts`, `a11y-checks.test.ts`, `theming-checks.test.ts`, `anti-pattern-checks.test.ts`, `validator-fixtures-e2e.test.ts`.

**Modify:**
- `sidecoach/src/product-rule-registry.ts` - EXPAND the `RULES` array from 6 to 30 declarative definitions (Task 1), then change the export so each definition carries a `checkProduct` looked up from `CHECKS` by `canonicalRuleKey` and wrapped in the throw-catch boundary (Task 2). The literal metadata objects stay; only the export wrapping is added.
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

## The complete canonical rule set (transcription table)

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

### Standard `supportedSourceKinds` blocks (transcribe verbatim)

- css-rule rule: `[{ kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' }, { kind: 'less', level: 'full' }, { kind: 'tsx', level: 'partial' }, { kind: 'html', level: 'partial' }]`
- markup rule: `[{ kind: 'html', level: 'full' }, { kind: 'tsx', level: 'partial' }, { kind: 'jsx', level: 'partial' }, { kind: 'vue', level: 'partial' }, { kind: 'svelte', level: 'partial' }]`
- computed-style rule (non-req): `[{ kind: 'computed-style', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' }]`
- dom rule (non-req): `[{ kind: 'dom', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' }]`
- contrast rule (non-req): `[{ kind: 'contrast', level: 'full' }, { kind: 'tsx', level: 'none' }, { kind: 'html', level: 'none' }]`

Every row uses `narrowTargetBehavior: 'evaluate_expanded_context'` (matches the seed; coverage `requireAllDiscoveredApplicableFiles` derives `true`).

---

## Setup

- [ ] **Step 0.1: Branch + dirty snapshot** -> verify: `git branch --show-current` prints `lane-p4a2-validator-adaptation`.

```bash
cd /Users/spare3/Documents/Github/improv
git checkout main && git checkout -b lane-p4a2-validator-adaptation
git branch --show-current
git status --porcelain | grep -v '^??' | sort > /tmp/lane-p4a2-preexisting-dirty.txt
```

- [ ] **Step 0.2: Baseline green** -> verify: `cd sidecoach && npm run build && npm test` gives build exit 0 and `run-tests: 20 suite(s) passed`, AND `npx ts-node scripts/generate-validators.ts --check` prints `OK`. If red, STOP and fix the baseline before touching anything.

```bash
cd sidecoach
npx ts-node scripts/generate-validators.ts --check
npm run build && npm test
```

---

## Task 1: Expand the registry to the full 30-rule floor set (declarative only)

**Files:** Modify `src/product-rule-registry.ts` (6 -> 30 rules); Modify `src/__tests__/product-rule-registry.test.ts` + `src/__tests__/generate-validators.test.ts`; Regenerate `src/validators.generated.ts`.

This task is PURELY declarative (no `checkProduct` yet). It must keep `--check` green and produce a non-empty generated `requiredRuleIds` for all four validators.

- [ ] **Step 1.1: Failing test first.** Append to `src/__tests__/product-rule-registry.test.ts` a block asserting the expanded set. It fails now because the new rules do not exist.

```typescript
// --- P4a-2: full floor rule set (30 rules) ---
{
  if (RULES.length !== 30) throw new Error(`expected 30 canonical rules, got ${RULES.length}`);

  const owners = (id: string) => RULES.filter((r) => r.ownerValidatorId === id);
  if (owners('polish-standard').length !== 19) throw new Error('polish-standard must own 19 rules');
  if (owners('static-a11y').length !== 3) throw new Error('static-a11y must own 3 rules');
  if (owners('theming').length !== 2) throw new Error('theming must own 2 rules');
  if (owners('anti-pattern').length !== 6) throw new Error('anti-pattern must own 6 rules');

  // cross-registry aliasing holds for a representative NEW polish rule (id 1)
  const byNum = resolveSourceAlias('polish-standard:1');
  const byExt = resolveSourceAlias('POLISH_001');
  if (!byNum || !byExt || byNum.canonicalRuleKey !== byExt.canonicalRuleKey) throw new Error('scale-on-press cross-registry aliases must resolve to one canonical rule');
  if (byNum.canonicalRuleKey !== 'polish/scale-on-press') throw new Error('scale-on-press canonical key mismatch');
  if (byNum.severity !== 'major' || byNum.findingClass !== 'polish') throw new Error('id 1 high->major, findingClass polish');

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

  console.log('product-rule-registry (P4a-2 full set): OK');
}
```

- [ ] **Step 1.2: Run, verify FAIL** -> `npx ts-node src/__tests__/product-rule-registry.test.ts` throws `expected 30 canonical rules, got 6`.

- [ ] **Step 1.3: Add the 24 new rules** to `RULES` in `src/product-rule-registry.ts`, transcribing every field from the table above. Each rule is a full `ProductRuleDefinition` literal in the SAME shape as the seed entries (the seed's `polish.reduced-motion-respect`, `a11y.focus-visible`, etc. are the template). Concrete examples to copy the shape from (do all 24):

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
  supportedSourceKinds: [
    { kind: 'css', level: 'full' }, { kind: 'scss', level: 'full' },
    { kind: 'less', level: 'full' }, { kind: 'tsx', level: 'partial' },
    { kind: 'html', level: 'partial' },
  ],
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
  scope: 'page',
  narrowTargetBehavior: 'evaluate_expanded_context',
  applicability: 'not_applicable',
},
```

Use `scope: 'file'` for css-rule rules, `scope: 'component'` for the computed-style/contrast/dom non-required rules, `scope: 'page'` for the markup ban heuristics (matches the seed's `identical-card-grids` page scope), and `scope: 'file'` for `theming.*`, `polish.animatepresence-initial`, `polish.image-outline-neutral`. (Scope only affects the `RequiredCoverageRecord.scope` label; the existing tests do not constrain it beyond non-empty.)

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
```

- [ ] **Step 1.7: Verify Task 1** -> all of:

```bash
cd sidecoach
npx ts-node src/__tests__/product-rule-registry.test.ts     # both OK lines
npx ts-node src/__tests__/generate-validators.test.ts        # generate-validators: OK
npx ts-node scripts/generate-validators.ts --check           # OK
npx ts-node scripts/generate-lanes.ts --check                # unaffected, still OK
git add src/product-rule-registry.ts src/validators.generated.ts src/__tests__/product-rule-registry.test.ts src/__tests__/generate-validators.test.ts
git commit -m "lane-p4a2: expand product-rule-registry to full 30-rule floor set"
```

---

## Task 2: Shared check infrastructure + checkProduct/validateProduct wiring

**Files:** Create `src/validators/check-context.ts`, `src/validators/project-collector.ts`, `src/validators/run-validator.ts`, `src/validators/checks/index.ts`; Modify `src/product-rule-registry.ts` (attach `checkProduct`), `src/flow-validation-capabilities.ts` (attach `validateProduct`), `scripts/run-tests.ts`; Test `src/__tests__/product-validator-pipeline.test.ts`.

This task builds the plumbing and proves the four-status pipeline with ONE representative real check (`polish/reduced-motion-respect`); every other rule resolves to `missingCheck` (inconclusive) until Tasks 3-6 fill them in. That intermediate state is HONEST: an unattached required rule surfaces `inconclusive`, never a false `pass`.

- [ ] **Step 2.1: Failing test first** -> `src/__tests__/product-validator-pipeline.test.ts`:

```typescript
// sidecoach/src/__tests__/product-validator-pipeline.test.ts
import { getValidatorRegistration } from '../flow-validation-capabilities';
import { getRuleById } from '../product-rule-registry';
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
  const failV = rm.checkProduct!(cssNoReducedMotion('.btn { color: red; }'));
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

  // 7. a thrown check is CAUGHT -> inconclusive + rule_exception (inject a context the guard rejects)
  const thrown = rm.checkProduct!(null as unknown as ProductCheckContext);
  if (thrown.status !== 'inconclusive') throw new Error('a thrown check must be caught as inconclusive');

  // 8. validateProduct end-to-end on an empty project -> required rules inconclusive -> status inconclusive
  const res = getValidatorRegistration('polish-standard')!.validateProduct!(emptyCtx);
  if (res.status !== 'inconclusive') throw new Error(`empty project must yield validator status inconclusive, got ${res.status}`);
  // honest coverage is still populated
  if (!res.coverage || !Array.isArray(res.coverage.measuredScope)) throw new Error('coverage must be reproducible even when inconclusive');

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

// The per-target evidence a checkProduct inspects. Browser-collected fields are
// OPTIONAL and absent in P4a-2; a rule that needs them returns inconclusive.
export interface ProductCheckContext {
  cssText: string;               // joined CSS-family text across inspected files
  markup: string;                // joined markup across inspected files
  files: CollectedFile[];
  computedStyle?: Record<string, string>;
  contrast?: { wcagAA: boolean; ratio: number };
  designTokens?: Record<string, unknown>;
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
import { pass, fail, inconclusive, hasCss } from '../check-context';

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
  'polish/reduced-motion-respect': checkReducedMotion,
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
import type { CollectedFile, ProductCheckContext } from './check-context';

const CSS_EXT = /\.(?:css|scss|sass|less)$/i;
const MARKUP_EXT = /\.(?:html?|jsx|tsx|vue|svelte)$/i;
const SKIP_DIR = new Set(['node_modules', 'dist', 'build', '.git']);
const MAX_BYTES = 2 * 1024 * 1024;

function sourceKindOf(file: string): string {
  const ext = path.extname(file).slice(1).toLowerCase();
  return ext === 'htm' ? 'html' : ext;
}

// RECURSIVE discovery with explicit exclusions + size cap (spec 963-966).
function walk(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (e.name.startsWith('.') || SKIP_DIR.has(e.name)) continue;
      walk(path.join(dir, e.name), acc);
    } else if (e.isFile() && (CSS_EXT.test(e.name) || MARKUP_EXT.test(e.name))) {
      acc.push(path.join(dir, e.name));
    }
  }
}

export interface Collected { files: CollectedFile[]; cssText: string; markup: string; }

export function collectFromPath(projectPath: string): Collected {
  const found: string[] = [];
  walk(projectPath, found);   // throws nothing; unreadable dirs are skipped
  const files: CollectedFile[] = [];
  for (const abs of found) {
    try {
      if (fs.statSync(abs).size > MAX_BYTES) continue;
      const content = fs.readFileSync(abs, 'utf-8');
      const rel = path.relative(projectPath, abs);
      const kind = sourceKindOf(abs);
      const isCss = CSS_EXT.test(abs);
      files.push({
        path: rel, sourceKind: kind,
        cssText: isCss ? content : extractInlineCss(content),
        markup: isCss ? '' : content,
        evidenceKindsPresent: [kind],
      });
    } catch { /* skip unreadable file */ }
  }
  return assemble(files);
}

function extractInlineCss(html: string): string {
  let out = '';
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) out += '\n' + m[1];
  return out;
}

function assemble(files: CollectedFile[]): Collected {
  return {
    files,
    cssText: files.map((f) => f.cssText).filter(Boolean).join('\n'),
    markup: files.map((f) => f.markup).filter(Boolean).join('\n'),
  };
}

// Normalize whatever validateProduct received into a Collected. An in-memory
// context (unit tests) is used verbatim; a { projectPath } is walked. A context
// with NEITHER yields an empty collection (-> required rules inconclusive).
export function collect(context: unknown): Collected {
  const c = context as Partial<ProductCheckContext> & { projectPath?: string };
  if (c && Array.isArray(c.files)) return assemble(c.files as CollectedFile[]);
  if (c && typeof c.projectPath === 'string') return collectFromPath(c.projectPath);
  return { files: [], cssText: '', markup: '' };
}
```

- [ ] **Step 2.7: Write `src/validators/run-validator.ts`** (the shared orchestration; CONSUMES `evaluateCleanPolicy`):

```typescript
// sidecoach/src/validators/run-validator.ts
import type { ProductValidationResult, ProductRuleResult } from '../product-rule-types';
import { getRuleById } from '../product-rule-registry';
import { GENERATED_VALIDATORS } from '../validators.generated';
import { evaluateCleanPolicy } from '../clean-evaluator';
import type { CoverageObservation, RunCoverage } from '../clean-evaluator';
import { collect, Collected } from './project-collector';
import type { ProductCheckContext, CollectedFile } from './check-context';

function toCheckContext(c: Collected, raw: unknown): ProductCheckContext {
  const r = raw as Partial<ProductCheckContext>;
  return {
    cssText: c.cssText, markup: c.markup, files: c.files,
    computedStyle: r?.computedStyle, contrast: r?.contrast, designTokens: r?.designTokens,
  };
}

// Discovered-applicable files for a rule = collected files whose source kind is a
// supported alternative for that rule's coverage record.
function observationFor(ruleId: string, record: any, files: CollectedFile[]): CoverageObservation {
  const supported = new Set(record ? record.evidenceAlternativesByRequirement.flat() : []);
  const applicable = files.filter((f) => f.evidenceKindsPresent.some((k) => supported.has(k)));
  return {
    ruleId,
    inspectedFiles: applicable.map((f) => f.path),
    discoveredApplicableFiles: applicable.map((f) => ({ file: f.path, evidenceKindsPresent: f.evidenceKindsPresent })),
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

    const ctx = toCheckContext(collected, context);
    const rules: ProductRuleResult[] = gen.ownedRuleIds
      .map((id) => getRuleById(id))
      .filter((d): d is NonNullable<typeof d> => !!d && typeof d.checkProduct === 'function')
      .map((d) => d.checkProduct!(ctx));

    const recordById = new Map(policy.requiredCoverageByScope.map((c) => [c.ruleId, c]));
    const coverageObservations = policy.requiredRuleIds.map((id) => observationFor(id, recordById.get(id), collected.files));

    const inspectedFiles = collected.files.map((f) => f.path);
    const supportedSourceKinds = [...new Set(collected.files.map((f) => f.sourceKind))];
    const runCoverage: RunCoverage = {
      inspectedFiles, skippedFiles: [],
      supportedSourceKinds, unsupportedSourceKinds: [],
      measuredScope: gen.registryScope, unverifiedScope: [],
    };

    return evaluateCleanPolicy({ validatorId, rules, coverageObservations, runCoverage }, policy);
  };
}

function emptyRun(): RunCoverage {
  return { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [], measuredScope: [], unverifiedScope: [] };
}
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
npx ts-node src/__tests__/product-validator-pipeline.test.ts   # product-validator-pipeline: OK
npx ts-node scripts/generate-validators.ts --check             # OK (no drift from attaching functions)
npm run build && npm test                                      # run-tests: 21 suite(s) passed
git add -A && git commit -m "lane-p4a2: four-status checkProduct/validateProduct pipeline + recursive collector"
```

---

## Task 3: polish-standard slice - port the 18 remaining polish checks

**Files:** Modify `src/validators/checks/polish-checks.ts`; Test `src/__tests__/polish-checks.test.ts`.

Port the HARDENED static logic from `polish-standard-validator.ts` (ids 1-17, 21, 22; id 19 already done in Task 2). The two computed-style rules (2, 16) and the dom rule (22) return `inconclusive` when their browser evidence is absent (which it always is in P4a-2). Every css-rule/markup rule: no evidence collected -> `inconclusive`; evidence present, feature absent -> `fail`; present and satisfied -> `pass`; declared N/A condition met -> `not_applicable`.

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
  if (get('polish/scale-on-press')(ctxCss('.x { color: red; }')).status !== 'fail') throw new Error('scale-on-press missing must fail');
  if (get('polish/scale-on-press')(empty).status !== 'inconclusive') throw new Error('scale-on-press no-css must be inconclusive');

  // NEGATION rule: transition: all present -> fail; absent -> pass (css present)
  if (get('polish/no-transition-all')(ctxCss('.x { transition: all 1s; }')).status !== 'fail') throw new Error('transition:all must fail');
  if (get('polish/no-transition-all')(ctxCss('.x { transition: opacity 1s; }')).status !== 'pass') throw new Error('explicit transition must pass');

  // N/A: tabular-nums is not_applicable when no dynamic-number selectors exist
  if (get('polish/tabular-nums')(ctxCss('.btn { color: red; }')).status !== 'not_applicable') throw new Error('tabular-nums with no number selectors must be N/A');
  if (get('polish/tabular-nums')(ctxCss('.price { font-variant-numeric: tabular-nums; }')).status !== 'pass') throw new Error('tabular-nums present must pass');
  if (get('polish/tabular-nums')(ctxCss('.price { color: red; }')).status !== 'fail') throw new Error('number selector without tabular-nums must fail');

  // ABSENCE-PASS ELIMINATED: concentric-radius (computed-style only) must NOT pass on absence
  const radius = POLISH_CHECKS['polish/concentric-radius'];
  if (radius && radius(empty).status === 'pass') throw new Error('computed-style rule must never pass on absent evidence');
  if (radius && radius(empty).status !== 'inconclusive') throw new Error('computed-style rule must be inconclusive without browser evidence');

  console.log('polish-checks: OK');
}
run();
```

- [ ] **Step 3.2: Run, verify FAIL** -> `no check for polish/scale-on-press`.

- [ ] **Step 3.3: Implement the 18 checks** in `polish-checks.ts`. Each is a small pure function. The PATTERN for a css-rule presence rule:

```typescript
function cssPresence(ctx: ProductCheckContext, needle: (css: string) => boolean, okMsg: string, badMsg: string, fix: string): RuleVerdict {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return needle(ctx.cssText) ? pass(okMsg) : fail(badMsg, [], fix);
}
```

Implement each rule from its `polish-standard-validator.ts` source (the substring/regex tests are copied verbatim; only the absence handling changes from `?? false` to the inconclusive guard). Concrete bodies:

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
  ctx.computedStyle ? (ctx.computedStyle.borderRadius && ctx.computedStyle.borderRadius !== '0px' ? pass('concentric radius set') : fail('border radius should follow the concentric rule', [], 'outer_radius = inner_radius + padding'))
                    : inconclusive('concentric radius needs computed-style evidence (browser collector, P4b)', 'unsupported_runtime');
export const checkTypographyRhythm = (ctx: ProductCheckContext): RuleVerdict =>
  ctx.computedStyle ? (ctx.computedStyle.lineHeight && ctx.computedStyle.lineHeight !== 'normal' ? pass('vertical rhythm set') : fail('establish typography rhythm', [], 'margin-bottom = line-height * font-size'))
                    : inconclusive('typography rhythm needs computed-style evidence (browser collector, P4b)', 'unsupported_runtime');
export const checkGenericity = (ctx: ProductCheckContext): RuleVerdict => {
  const score = (ctx.designTokens as any)?.genericityScore;
  if (typeof score !== 'number') return inconclusive('genericity needs a collected design-token metric (P4b)', 'unsupported_runtime');
  return score < 55 ? pass(`genericityScore ${score}`) : fail(`design genericityScore ${score} too high`, [], 'Add unique design personality');
};

export const POLISH_CHECKS: Record<string, (ctx: ProductCheckContext) => RuleVerdict> = {
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
```

(Add the `cssPresence` helper + the `import { pass, fail, notApplicable, inconclusive, hasCss, hasMarkup } from '../check-context';` line. Keep `checkReducedMotion` from Task 2.)

- [ ] **Step 3.4: Verify Task 3** ->

```bash
cd sidecoach
# register the suite in scripts/run-tests.ts first:  { rel: 'src/__tests__/polish-checks.test.ts', required: true },
npx ts-node src/__tests__/polish-checks.test.ts                # polish-checks: OK
npx ts-node src/__tests__/product-validator-pipeline.test.ts   # still OK (reduced-motion unchanged)
npm test                                                       # run-tests: 22 suite(s) passed
git add -A && git commit -m "lane-p4a2: port 18 polish-standard checks to four-status verdicts"
```

---

## Task 4: static-a11y slice - focus-visible (css) + min-hit-area / color-contrast (browser-only)

**Files:** Modify `src/validators/checks/a11y-checks.ts`; Test `src/__tests__/a11y-checks.test.ts`.

`focus-visible` (id 18) is a real css-rule check. `min-hit-area` (id 5, dom) and `color-contrast` (id 20, contrast) have NO static source: they return `inconclusive` (never pass) until a browser collector exists, EXCEPT when the optional browser evidence is supplied (then they produce a real pass/fail). Because they are non-required, an inconclusive on them does NOT block the validator; only `focus-visible` gates.

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
  if (fv(ctxCss('.x { color: red; }')).status !== 'fail') throw new Error('focus-visible missing (css present) must fail');
  if (fv(empty).status !== 'inconclusive') throw new Error('focus-visible no-css must be inconclusive');

  // dom-only rule: inconclusive without DOM evidence, never pass
  if (mh(ctxCss('.btn { min-height: 48px; }')).status !== 'inconclusive') throw new Error('min-hit-area must be inconclusive without DOM evidence');
  // contrast-only rule: inconclusive without contrast evidence; real verdict when supplied
  if (cc(empty).status !== 'inconclusive') throw new Error('color-contrast must be inconclusive without contrast evidence');
  if (cc({ ...empty, contrast: { wcagAA: true, ratio: 5 } }).status !== 'pass') throw new Error('color-contrast with AA evidence must pass');
  if (cc({ ...empty, contrast: { wcagAA: false, ratio: 2 } }).status !== 'fail') throw new Error('color-contrast below AA must fail');

  console.log('a11y-checks: OK');
}
run();
```

- [ ] **Step 4.2: Run, verify FAIL** -> `all three a11y checks must be present`.

- [ ] **Step 4.3: Implement** `a11y-checks.ts`:

```typescript
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss } from '../check-context';

export const checkFocusVisible = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  return ctx.cssText.includes(':focus-visible')
    ? pass(':focus-visible present')
    : fail('implement :focus-visible for keyboard navigation', [], 'Add :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }');
};

// dom-only: no static source can provide hit-area geometry (spec 98-119). Honest
// inconclusive until a browser collector (P4b). Optional DOM evidence is allowed.
export const checkMinHitArea = (ctx: ProductCheckContext): RuleVerdict =>
  inconclusive('hit-area geometry needs DOM evidence (browser collector, P4b)', 'unsupported_runtime');

// contrast-only: same. Honors optional contrast evidence when present.
export const checkColorContrast = (ctx: ProductCheckContext): RuleVerdict => {
  if (!ctx.contrast) return inconclusive('contrast ratio needs measured contrast evidence (browser collector, P4b)', 'unsupported_runtime');
  return ctx.contrast.wcagAA ? pass(`contrast ${ctx.contrast.ratio.toFixed(2)}:1 meets AA`) : fail(`contrast ${ctx.contrast.ratio.toFixed(2)}:1 below AA`, [], 'Achieve WCAG AA minimum (4.5:1 for text)');
};

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
npm test                                                      # run-tests: 23 suite(s) passed
git add -A && git commit -m "lane-p4a2: static-a11y checks (focus-visible css; min-hit-area/contrast inconclusive)"
```

---

## Task 5: theming slice - port the taste token checks

**Files:** Modify `src/validators/checks/theming-checks.ts`; Test `src/__tests__/theming-checks.test.ts`.

Port `taste-validator.ts` `checkHexInHoverWithCssVars` (line 226) and `checkBorderRadiusInconsistency` (line 289) into per-rule verdicts. The taste source iterates CSS blocks via `iterateCssBlocks`; the adapted check operates on `ctx.cssText`. Faithfully preserve: hex-in-interactive-state only fires when the file ALSO defines CSS custom properties (otherwise there is no token system to violate); border-radius fires when more than 2 distinct non-var radius literals appear.

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

- [ ] **Step 5.3: Implement** `theming-checks.ts` (adapted from `taste-validator.ts`; uses a lightweight block iterator over `cssText`):

```typescript
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss } from '../check-context';

function* blocks(css: string): Generator<{ selector: string; body: string }> {
  const re = /([^{}]+)\{([^}]*)\}/g;
  for (const m of css.matchAll(re)) yield { selector: m[1].trim(), body: m[2] };
}

export const checkHexInInteractiveState = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const hasVars = /--[\w-]+\s*:/.test(ctx.cssText) || /var\(\s*--[\w-]+/.test(ctx.cssText);
  if (!hasVars) return notApplicable('no CSS custom properties defined; no token system to violate');
  const offenders: string[] = [];
  for (const b of blocks(ctx.cssText)) {
    if (!/(:hover|:active)\b/.test(b.selector)) continue;
    if (/var\(\s*--[\w-]+/.test(b.body)) continue;       // token-driven state is compliant
    if (/#[0-9a-fA-F]{3,8}\b/.test(b.body)) offenders.push(b.selector.slice(0, 60));
  }
  return offenders.length
    ? fail(`interactive state(s) use hardcoded hex while tokens exist: ${offenders.join(', ')}`, offenders, 'Derive the interactive state from a token, e.g. var(--c-brand-hover)')
    : pass('interactive states are token-driven');
};

export const checkBorderRadiusConsistency = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  const values = new Set<string>();
  for (const m of ctx.cssText.matchAll(/border-radius\s*:\s*([^;}]+)/g)) {
    const v = m[1].trim();
    if (v.startsWith('var(')) continue;
    values.add(v);
  }
  if (values.size === 0) return notApplicable('no border-radius literals to check');
  return values.size > 2
    ? fail(`${values.size} distinct border-radius literals (${[...values].join(', ')})`, [], 'Use 1-2 named radius tokens; concentric radii derive from those')
    : pass(`${values.size} border-radius literal(s) within tolerance`);
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
npm test                                                     # run-tests: 24 suite(s) passed
git add -A && git commit -m "lane-p4a2: theming token checks ported from taste-validator"
```

---

## Task 6: anti-pattern slice - port the 6 ban detectors

**Files:** Modify `src/validators/checks/anti-pattern-checks.ts`; Test `src/__tests__/anti-pattern-checks.test.ts`.

Port the scanners from `absolute-ban-detector.ts`. The three precise CSS detectors (`gradient-text`, `glassmorphism-default`, `side-stripe-borders`) scan `ctx.cssText`; the three HTML-structural heuristics (`identical-card-grids`, `hero-metric-template`, `modal-as-first-thought`) scan `ctx.markup`. Evidence-absence rule: a css-detector with no CSS collected -> `inconclusive`; a markup-detector with no markup collected -> `inconclusive`. Evidence present without the ban -> `pass`. Ban present -> `fail` (the markup heuristics are still `fail` results, but their declared `minor` severity makes them non-blocking by construction, so a clean validator can tolerate them).

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

  console.log('anti-pattern-checks: OK');
}
run();
```

- [ ] **Step 6.2: Run, verify FAIL** -> `missing gt`.

- [ ] **Step 6.3: Implement** `anti-pattern-checks.ts` (regexes transcribed from `absolute-ban-detector.ts` scan functions):

```typescript
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, inconclusive, hasCss, hasMarkup } from '../check-context';

// --- precise CSS detectors (operate per CSS rule body) ---
function* cssBlocks(css: string): Generator<{ selector: string; body: string }> {
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) yield { selector: m[1].trim(), body: m[2] };
}

export const checkGradientText = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  for (const b of cssBlocks(ctx.cssText)) {
    const clip = /background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/i.test(b.body);
    const grad = /(?:linear|radial|conic)-gradient\s*\(/i.test(b.body);
    if (clip && grad) return fail(`gradient text in "${b.selector.slice(0, 60)}"`, [b.selector.slice(0, 60)], 'Use the gradient on a background element, not the text');
  }
  return pass('no gradient-text ban');
};

export const checkGlassmorphism = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  for (const b of cssBlocks(ctx.cssText)) {
    const blur = /backdrop-filter\s*:\s*[^;]*\bblur\s*\(/i.test(b.body);
    let lowAlpha = false;
    for (const v of b.body.matchAll(/(?:rgba|hsla)\s*\(\s*[\d.,%\s]+,\s*(0?\.\d+|0|1)\s*\)/gi)) {
      if (parseFloat(v[1]) <= 0.4) { lowAlpha = true; break; }
    }
    if (blur && lowAlpha) return fail(`glassmorphism default in "${b.selector.slice(0, 60)}"`, [b.selector.slice(0, 60)], 'Reserve glassmorphism for overlay/modal contexts');
  }
  return pass('no glassmorphism-default ban');
};

export const checkSideStripeBorders = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasCss(ctx)) return inconclusive('no CSS source collected', 'unreadable_input');
  for (const b of cssBlocks(ctx.cssText)) {
    const border = /border-(?:left|right)\s*:\s*([2-9]|[1-9][0-9]+)\s*px\s+(?:solid|dashed|dotted|double)\s+(?!transparent|inherit|currentColor)/i.test(b.body);
    const targetable = /\.(?:card|alert|callout|notice|banner|install|tile|list-item|message|toast|tip)\b|aside\b|blockquote\b/i.test(b.selector);
    if (border && targetable) return fail(`side-stripe border on "${b.selector.slice(0, 60)}"`, [b.selector.slice(0, 60)], 'Use border-bottom or box-shadow, not a colored side stripe');
  }
  return pass('no side-stripe-borders ban');
};

// --- HTML-structural heuristics (declared minor; still emit fail when matched) ---
export const checkIdenticalCardGrids = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  const re = /(<(?:a|div|article|li)\s+[^>]*class\s*=\s*["']([^"']*\b(?:tool-card|card|tile|feature|item|service|capability)\b[^"']*)["'][^>]*>[\s\S]*?<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>[\s\S]*?<p[^>]*>[\s\S]*?<\/p>[\s\S]*?<\/(?:a|div|article|li)>\s*){3,}/i;
  return re.test(ctx.markup) ? fail('3+ identical card-grid triplets', [], 'Vary card sizes/layout to create hierarchy') : pass('no identical-card-grids shape');
};

export const checkHeroMetricTemplate = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  const re = /(<(?:div|article|section|li)\s+[^>]*class\s*=\s*["'][^"']*\b(?:stat|metric|kpi|number|count)\b[^"']*["'][^>]*>[\s\S]*?<\/(?:div|article|section|li)>\s*){3,}/i;
  return re.test(ctx.markup) ? fail('3+ stat/metric blocks (hero-metric template shape)', [], 'Use asymmetric proportions; avoid the SaaS hero-metric template') : pass('no hero-metric-template shape');
};

export const checkModalAsFirstThought = (ctx: ProductCheckContext): RuleVerdict => {
  if (!hasMarkup(ctx)) return inconclusive('no markup source collected', 'unreadable_input');
  const re = /<(?:dialog|div)\s+[^>]*(?:role\s*=\s*["']dialog["']|class\s*=\s*["'][^"']*\b(?:modal|dialog|popup)\b[^"']*["'])[^>]*>[\s\S]*?<form\b[\s\S]*?<\/form>[\s\S]*?<\/(?:dialog|div)>/i;
  return re.test(ctx.markup) ? fail('modal containing a form', [], 'Consider inline editing or progressive disclosure first') : pass('no modal-as-first-thought shape');
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
npm test                                                     # run-tests: 25 suite(s) passed
git add -A && git commit -m "lane-p4a2: anti-pattern ban detectors ported to four-status verdicts"
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
.btn { color: #112233; }
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
npm test                                                     # run-tests: 26 suite(s) passed
git add -A && git commit -m "lane-p4a2: fixtures + end-to-end validateProduct execution (clean/findings/inconclusive)"
```

---

## Task 8: Final integration check

- [ ] **Step 8.1: Full suite + generators clean** -> verify:

```bash
cd sidecoach
npx ts-node scripts/generate-validators.ts --check     # OK (registry valid, manifest present, no drift)
npx ts-node scripts/generate-lanes.ts --check          # OK (unaffected)
npm run build                                          # exit 0
npm test                                               # run-tests: 26 suite(s) passed
```

`26` = the prior 20 + product-validator-pipeline + polish-checks + a11y-checks + theming-checks + anti-pattern-checks + validator-fixtures-e2e. Every new suite present and `required:true`.

- [ ] **Step 8.2: Regenerated artifact is committed and drift-free** -> verify `git status --porcelain src/validators.generated.ts` is empty (the file was regenerated in Task 1 and committed; nothing since changed it).

- [ ] **Step 8.3: Hook regression green** -> verify the dotfiles validation/bash guard regression suites still pass unchanged (no behavior in this plan touches them).

- [ ] **Step 8.4: Scope guard** -> this sub-plan must NOT touch lane execution, the mcp-server, or the deferred `domains/*` adaptation. Run the failing blacklist:

```bash
cd /Users/spare3/Documents/Github/improv
leaks="$(git diff --name-only main..lane-p4a2-validator-adaptation \
  | grep -E 'lane-runner|lane-checkpoint|sidecoach-orchestrator|mcp-server/|src/domains/|flow-handler-tactical-polish|convergence-loop|ralph-loop' || true)"
test -z "$leaks" || { printf 'SCOPE LEAK:\n%s\n' "$leaks"; exit 1; }
echo clean
```

Expect `clean`. (The plan deliberately ADAPTS the collector logic into the NEW `src/validators/project-collector.ts` rather than editing `flow-handler-tactical-polish.ts`; wiring the collector into Flow J's handler is P4b.)

- [ ] **Step 8.5: dist** -> no dist commit needed; no CLI/runtime path consumes these entry points yet (P4b wires `validateProduct` into `advanceLane`). If `npm run build` left `dist/` dirty, leave it uncommitted.

---

## Deferred (later P4 sub-plans)

- **P4b:** wire `validateProduct` into `advanceLane` step/iteration-boundary gating; build the REAL `CoverageObservation` / `RunCoverage` from the live run (including `skippedFiles` and `unsupportedSourceKinds`, which this plan leaves empty); add the browser-evidence collector that turns the `dom`/`computed-style`/`contrast` rules (`min-hit-area`, `color-contrast`, `concentric-radius`, `typography-rhythm`, `genericity`) from owned-non-required into measured; the async lease/lock/outbox/AbortSignal durability (the folded P3); wire `project-collector.ts` into `flow-handler-tactical-polish.ts` and surface linguistic/absolute-ban findings through Flow J's collector.
- **P4c:** loop execution + `lane_converge` enablement gated by the release floor (`polish-standard` + `theming` + `anti-pattern` + `static-a11y` all `clean`); `ralph-loop.ts` -> `convergence-loop.ts`.
- **P4d:** MCP migration (`classify-intent` / `list-lanes` / `sidecoach_lane`) + `modes.ts` deletion + SKILL/CHEATSHEET/marketing regen.
- **Copy/linguistic slice (explicitly NOT in P4a-2):** the `linguistic-ban-validator.ts` slop-word / rhetorical-template findings that Flow J's collector exposes are NOT modeled as canonical registry rules here (the task scope is the 22 polish rules + theming/anti-pattern/static-a11y slices). If a future phase wants them as gating registry rules, model them as TWO canonical rules (`copy.rhetorical-template` blocker, `copy.slop-word` minor) under a `copy` finding class, not 38 per-pattern rules.

---

## Self-Review (P4a-1 review lessons applied)

- **No changelog-vs-body drift (the P4a-1 v2 failure mode):** this plan has no separate changelog. The only summary is the goal/architecture intro, which describes (never restates the code of) the task bodies. The task bodies carry the actual correct code.
- **Every new symbol traces to a caller in its own task:** `stampResult`/`pass`/`fail`/`notApplicable`/`inconclusive`/`hasCss`/`hasMarkup` are consumed by the slice checks and tested in Tasks 2-6; `collect`/`collectFromPath` are consumed by `makeProductValidator` and exercised by the pipeline (Task 2) and fixture (Task 7) suites; `makeProductValidator` is attached to every registration and tested end-to-end; every `CHECKS` key is asserted present by its slice test; `missingCheck` is asserted by the pipeline test's unattached-rule case.
- **Four-status honesty (status not findings.length; missing evidence -> inconclusive):** every css/markup check guards `hasCss`/`hasMarkup` FIRST and returns `inconclusive` on absent evidence; the absence-pass (`undefined !== '0px' -> pass`, `?? false`) and the N/A-as-`passed:true` conventions are eliminated. The pipeline test pins "css present + feature absent -> fail" AND "no css -> inconclusive" AND "computed-style rule never passes on absence". A thrown check is caught at the registry boundary -> `inconclusive` + `rule_exception`.
- **Generated-not-authored:** `cleanPolicy` / `ownedRuleIds` / `requiredRuleIds` / `requiredCoverageByScope` stay generated into `validators.generated.ts` and regenerated after the registry grows (Task 1); the runtime validators READ that policy, they never re-derive it. Attaching `checkProduct`/`validateProduct` functions does not change the generated output (`deriveValidator` and `JSON.stringify` read identity/owner fields only) - verified by `--check` staying green in Steps 2.10 and 8.1.
- **Honor the P4a-1 evidence-compat model + clean-evaluator:** `makeProductValidator` builds `CoverageObservation`/`RunCoverage` and calls `evaluateCleanPolicy`; it does NOT reimplement non-vacuity, coverage, or the 7-step algorithm. Per-file `evidenceKindsPresent` carries SOURCE kinds (e.g. `['css']`) so `isCoverageSatisfied` matches the generated `evidenceAlternativesByRequirement` exactly.
- **Representative-plus-table, not "author the rest":** Task 1 gives the COMPLETE 30-rule id/severity/owner/evidence table to transcribe plus three fully-written literal examples and the five canonical `supportedSourceKinds` blocks. Tasks 3-6 write EVERY check body concretely (no "...and similarly for the others").
- **Ground every id/severity in the real source:** polish ids/severities are `polish-standard-validator.ts` (= `extended-domain-validator.ts` `POLISH_0NN`); ban names are the raw `findingFromBan(...)` strings; taste ids are `taste/hex-in-interactive-state` and `taste/border-radius-inconsistency`; the two severity overrides (`identical-card-grids`, `hero-metric-template`) cite `absolute-ban-detector.ts:19-21`. No invented ids.
- **Incremental honesty:** between Task 2 and Tasks 3-6, unattached required rules resolve to `missingCheck` -> `inconclusive`, so a validator reports `inconclusive` (never a false `clean`) until its whole required set is implemented; the fixture `clean` cases (Task 7) only pass once every required check exists, which is why Task 7 is last.
- **Scope discipline:** no lane-runner / orchestrator / mcp-server / `domains/*` / `flow-handler-tactical-polish.ts` edits; the recursive collector lands as a NEW module and its Flow J wiring is explicitly P4b. Step 8.4 enforces this with a failing blacklist.
- **Reviewer watch-items:** (1) after Task 1, RE-RUN `generate-validators.ts` (not just `--check`) and COMMIT `validators.generated.ts`, or `--check` fails on drift; (2) the anti-pattern `findings` and `clean` fixtures need BOTH css and markup files so the markup-required rules are measurable (an omitted channel makes them inconclusive and flips the status); (3) empty `inconclusive` fixture dirs need a tracked `.gitkeep`, since git does not track empty directories; (4) the `${severity}|${findingClass}` tolerance key set by the generator must match what the evaluator counts - unchanged from P4a-1, but the new `major|anti-pattern` and `blocker|theming` pairs are first exercised here.
