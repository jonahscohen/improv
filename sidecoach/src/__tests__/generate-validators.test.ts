// sidecoach/src/__tests__/generate-validators.test.ts
import { execFileSync } from 'child_process';
import * as path from 'path';
// IMPORT THE PURE LOGIC FROM src/ (inside rootDir ./src) - NEVER from ../../scripts/
// (a src/ test importing scripts/ breaks `tsc` with TS6059, the P2 lane-derivation
// issue). The --check below still drives the SCRIPT, but via the ts-node CLI, not a
// TS import, so it does not cross rootDir.
import {
  deriveValidator, validateRegistry, validateFixtureManifest, gatingValidatorIds,
} from '../validator-generation';
import { LANE_POLICIES, FIXTURE_MANIFEST } from '../flow-validation-capabilities';
import { RULES } from '../product-rule-registry';
import { supportedKindsFor } from '../validators/source-support-matrix';
import type { ProductRuleDefinition } from '../product-rule-types';
import type { ProductValidatorRegistration } from '../flow-validation-capabilities';

const SC = path.resolve(__dirname, '..', '..');

// minimal valid rule template; tweak per fixture
const baseRule = (over: Partial<ProductRuleDefinition>): ProductRuleDefinition => ({
  ruleId: 'x.rule', sourceRuleAliases: ['source:x.rule'], canonicalRuleKey: 'x/rule', ownerValidatorId: 'v',
  sourceVocabulary: 'p012', sourceSeverity: 'P1', severity: 'major', findingClass: 'anti-pattern',
  registryScope: 'scope', evidenceRequirements: ['css-rule'],
  supportedSourceKinds: [{ kind: 'css', level: 'full' }],
  scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable',
  ...over,
});
const reg = (id: string): ProductValidatorRegistration => ({ validatorId: id, label: id });
const expectInvalid = (label: string, rules: ProductRuleDefinition[], regs: ProductValidatorRegistration[], gating: string[] = []) => {
  const res = validateRegistry(rules, regs, gating);
  if (res.ok) throw new Error(`${label}: validateRegistry should have FAILED but passed`);
};

function run() {
  // --check passes on the committed generated file (no drift) AND the real registry
  // + fixture manifest are valid. Driven through the SCRIPT CLI (not a TS import).
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

  // generated coverage is PER-REQUIREMENT (evidenceAlternativesByRequirement), never
  // a flat union, and defaults requireAll=true (no blanket component/page=false).
  const focus = pol.cleanPolicy.requiredCoverageByScope.find((c: any) => c.ruleId === 'polish.reduced-motion-respect')
    || a11y.cleanPolicy.requiredCoverageByScope.find((c: any) => c.ruleId === 'a11y.focus-visible');
  if (!focus || !Array.isArray(focus.evidenceAlternativesByRequirement) || focus.evidenceAlternativesByRequirement.length === 0) {
    throw new Error('coverage must carry per-requirement evidence alternatives');
  }
  if (focus.requireAllDiscoveredApplicableFiles !== true) throw new Error('a evaluate_expanded_context rule must requireAll=true');

  // deriveValidator is pure: an all-dom-only owner yields EMPTY requiredRuleIds
  const domOwner = deriveValidator(reg('v'), [baseRule({ ruleId: 'v.dom', canonicalRuleKey: 'v/dom', ownerValidatorId: 'v', evidenceRequirements: ['dom'], supportedSourceKinds: [{ kind: 'dom', level: 'full' }] })]);
  if (domOwner.cleanPolicy.requiredRuleIds.length !== 0) throw new Error('all-dom-only owner must derive empty requiredRuleIds');

  // --- failing-first negative fixtures, ONE per rejection case (spec 628-634) ---
  // 1. empty requiredRuleIds (only owned rule is dom-only)
  expectInvalid('empty-required', [baseRule({ ruleId: 'v.dom', canonicalRuleKey: 'v/dom', evidenceRequirements: ['dom'], supportedSourceKinds: [{ kind: 'dom', level: 'full' }] })], [reg('v')]);
  // 2. canonicalRuleKey with two owners (same key, different ownerValidatorId)
  expectInvalid('two-owners', [baseRule({ ruleId: 'a', canonicalRuleKey: 'dup/key', ownerValidatorId: 'v' }), baseRule({ ruleId: 'b', canonicalRuleKey: 'dup/key', ownerValidatorId: 'w' })], [reg('v'), reg('w')]);
  // 3. conflicting alias (one source id mapped to two canonical keys)
  expectInvalid('conflicting-alias', [baseRule({ ruleId: 'a', canonicalRuleKey: 'k/a', sourceRuleAliases: ['DUP'] }), baseRule({ ruleId: 'b', canonicalRuleKey: 'k/b', sourceRuleAliases: ['DUP'] })], [reg('v')]);
  // 4. unsatisfiable coverage (markup evidence but only css supported -> empty
  //    alternatives for the markup requirement under per-requirement AND-semantics)
  expectInvalid('unsatisfiable-coverage', [baseRule({ ruleId: 'v.m', canonicalRuleKey: 'v/m', evidenceRequirements: ['markup'], supportedSourceKinds: [{ kind: 'css', level: 'full' }] })], [reg('v')]);
  // 5. undocumented severity divergence (table says major, declares minor, no reason)
  expectInvalid('severity-divergence', [baseRule({ severity: 'minor' })], [reg('v')]);
  // 6. duplicate canonical ruleId (two definitions share a ruleId; distinct keys)
  expectInvalid('duplicate-ruleId', [baseRule({ ruleId: 'dup', canonicalRuleKey: 'k/a' }), baseRule({ ruleId: 'dup', canonicalRuleKey: 'k/b' })], [reg('v')]);

  // 7. FULL field-completeness: EACH required field, when empty, must fail.
  //    ruleId, severity, and sourceRuleAliases are explicit fixtures rather than
  //    relying only on implementation branches.
  const requiredFieldFixtures: Array<[string, Partial<ProductRuleDefinition>]> = [
    ['missing-ruleId', { ruleId: '' }],
    ['missing-sourceRuleAliases', { sourceRuleAliases: [] }],
    ['missing-severity', { severity: '' as any }],
    ['missing-findingClass', { findingClass: '' as any }],
    ['missing-sourceVocabulary', { sourceVocabulary: '' as any }],
    ['missing-sourceSeverity', { sourceSeverity: '' }],
    ['missing-registryScope', { registryScope: '' }],
    ['missing-narrowTargetBehavior', { narrowTargetBehavior: '' as any }],
    ['missing-applicability', { applicability: '' as any }],
    ['missing-supportedSourceKinds', { supportedSourceKinds: [] }],
    ['missing-scope', { scope: '' as any }],
    ['missing-ownerValidatorId', { ownerValidatorId: '' }],
    ['missing-canonicalRuleKey', { canonicalRuleKey: '' }],
    ['missing-evidenceRequirements', { evidenceRequirements: [] }],
  ];
  for (const [label, over] of requiredFieldFixtures) expectInvalid(label, [baseRule(over)], [reg('v')]);

  // 8. a GATING registration that owns zero rules must fail. A generated gate
  //    with no owned rules would have empty requiredRuleIds and be vacuous.
  const zeroRuleGatePolicies = [{ laneId: 'test-lane', requiredProductValidatorIds: ['gate'], excludedProductValidatorIds: [] }];
  expectInvalid(
    'gating-zero-owned-rules',
    [baseRule({ ownerValidatorId: 'v' })],
    [reg('v'), reg('gate')],
    gatingValidatorIds(zeroRuleGatePolicies),
  );

  // --- fixture-manifest PRESENCE only (spec 628-634; P4a-2 creates and executes
  //     the referenced fixture files) ---
  // the REAL manifest covers every gating validator across all three categories
  if (!validateFixtureManifest(gatingValidatorIds(LANE_POLICIES), FIXTURE_MANIFEST).ok) {
    throw new Error('real fixture manifest must be complete for every gating validator');
  }
  // failing-first: a gating validator missing its inconclusive fixture entry
  const missingCat = FIXTURE_MANIFEST.map((m) => m.validatorId === 'static-a11y' ? { ...m, fixtures: { ...m.fixtures, inconclusive: '' } } : m);
  if (validateFixtureManifest(gatingValidatorIds(LANE_POLICIES), missingCat).ok) {
    throw new Error('a missing inconclusive fixture-manifest entry must FAIL --check');
  }
  // failing-first: a gating validator with NO manifest entry at all
  const droppedEntry = FIXTURE_MANIFEST.filter((m) => m.validatorId !== 'theming');
  if (validateFixtureManifest(gatingValidatorIds(LANE_POLICIES), droppedEntry).ok) {
    throw new Error('a gating validator with no manifest entry must FAIL --check');
  }

  // 9. (P2) a blank/empty sourceRuleAlias entry must be rejected. A non-empty
  //    array whose only entry is '' would otherwise pass the array-length check.
  expectInvalid('blank-alias', [baseRule({ sourceRuleAliases: [''] })], [reg('v')]);
  expectInvalid('whitespace-alias', [baseRule({ sourceRuleAliases: ['   '] })], [reg('v')]);

  // 10. (P2) an unknown/typoed sourceSeverity has no SEVERITY_TABLE entry, so it
  //     cannot be normalized or compared - it must be rejected, not silently
  //     bypass the divergence guard.
  expectInvalid('unknown-source-severity', [baseRule({ sourceSeverity: 'sev9000' })], [reg('v')]);

  // 11. (P2) a gating validator id with NO ProductValidatorRegistration must be
  //     rejected. Previously only registered validators were checked, so a
  //     lane-required id that nothing registers slipped through unguarded.
  expectInvalid(
    'unregistered-gating',
    [baseRule({ ownerValidatorId: 'v' })],
    [reg('v')],
    gatingValidatorIds([{ laneId: 'l', requiredProductValidatorIds: ['ghost-gate'], excludedProductValidatorIds: [] }]),
  );

  // --- P4a-2: the four gating validators are non-vacuous and matrix-consistent ---
  for (const id of ['polish-standard', 'theming', 'anti-pattern', 'static-a11y']) {
    const v = gen.GENERATED_VALIDATORS.find((x: any) => x.validatorId === id);
    if (!v || v.cleanPolicy.requiredRuleIds.length === 0) throw new Error(`gating validator ${id} must have non-empty requiredRuleIds`);
  }
  // anti-pattern: the heuristic markup rules are owned but the precise css bans are the blocking required ones
  const apGen = gen.GENERATED_VALIDATORS.find((x: any) => x.validatorId === 'anti-pattern');
  if (!apGen.cleanPolicy.requiredRuleIds.includes('anti-pattern.gradient-text')) throw new Error('gradient-text must be required');
  if (apGen.cleanPolicy.toleratedFindingCounts['major|anti-pattern'] !== 0) throw new Error('explicit 0 tolerance for major|anti-pattern');
  // generated support records must exactly reflect the one shared matrix
  for (const rule of RULES) {
    const expected = supportedKindsFor(...rule.evidenceRequirements);
    if (JSON.stringify(rule.supportedSourceKinds) !== JSON.stringify(expected)) throw new Error(`source matrix drift for ${rule.ruleId}`);
  }

  console.log('generate-validators: OK');
}
run();
