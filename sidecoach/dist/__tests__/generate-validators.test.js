"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/generate-validators.test.ts
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
// IMPORT THE PURE LOGIC FROM src/ (inside rootDir ./src) - NEVER from ../../scripts/
// (a src/ test importing scripts/ breaks `tsc` with TS6059, the P2 lane-derivation
// issue). The --check below still drives the SCRIPT, but via the ts-node CLI, not a
// TS import, so it does not cross rootDir.
const validator_generation_1 = require("../validator-generation");
const flow_validation_capabilities_1 = require("../flow-validation-capabilities");
const product_rule_registry_1 = require("../product-rule-registry");
const source_support_matrix_1 = require("../validators/source-support-matrix");
const SC = path.resolve(__dirname, '..', '..');
// minimal valid rule template; tweak per fixture
const baseRule = (over) => ({
    ruleId: 'x.rule', sourceRuleAliases: ['source:x.rule'], canonicalRuleKey: 'x/rule', ownerValidatorId: 'v',
    sourceVocabulary: 'p012', sourceSeverity: 'P1', severity: 'major', findingClass: 'anti-pattern',
    registryScope: 'scope', evidenceRequirements: ['css-rule'],
    supportedSourceKinds: [{ kind: 'css', level: 'full' }],
    scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable',
    ...over,
});
const reg = (id) => ({ validatorId: id, label: id });
const expectInvalid = (label, rules, regs, gating = [], browser = []) => {
    const res = (0, validator_generation_1.validateRegistry)(rules, regs, gating, browser);
    if (res.ok)
        throw new Error(`${label}: validateRegistry should have FAILED but passed`);
};
// A matrix-consistent rule (supportedSourceKinds derived from the shared matrix) so a
// fixture is valid EXCEPT for the one defect under test - lets the browser-allowlist
// fixtures isolate their specific rejection rather than tripping the drift guard.
const okRule = (over) => {
    const reqs = over.evidenceRequirements ?? ['css-rule'];
    return baseRule({ ...over, evidenceRequirements: reqs, supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)(...reqs) });
};
function run() {
    // --check passes on the committed generated file (no drift) AND the real registry
    // + fixture manifest are valid. Driven through the SCRIPT CLI (not a TS import).
    (0, child_process_1.execFileSync)('npx', ['ts-node', 'scripts/generate-validators.ts', '--check'], { cwd: SC, stdio: 'pipe' });
    // generated cleanPolicy for polish-standard is non-vacuous
    const gen = require('../validators.generated');
    const pol = gen.GENERATED_VALIDATORS.find((v) => v.validatorId === 'polish-standard');
    if (!pol || pol.cleanPolicy.requiredRuleIds.length === 0)
        throw new Error('generated requiredRuleIds must be non-empty');
    // the DOM-only rule is OWNED by static-a11y but NOT required
    const a11y = gen.GENERATED_VALIDATORS.find((v) => v.validatorId === 'static-a11y');
    if (!a11y.ownedRuleIds.includes('a11y.min-hit-area'))
        throw new Error('static-a11y must OWN the dom-only rule');
    if (a11y.cleanPolicy.requiredRuleIds.includes('a11y.min-hit-area'))
        throw new Error('DOM-only rule must NOT be required');
    if (!a11y.browserRuleIds.includes('a11y.min-hit-area'))
        throw new Error('DOM rule must be generated as a browser rule');
    // Stage 6: a11y.color-contrast MIGRATED from the collector contrast probe to the rendered scan, so it is now a
    // RENDERED rule (driven by scanRenderedLive's low-contrast finding), never a browser rule.
    if (a11y.browserRuleIds.includes('a11y.color-contrast'))
        throw new Error('contrast rule must NOT be a browser rule after Stage 6 migration');
    if (!a11y.renderedRuleIds.includes('a11y.color-contrast'))
        throw new Error('contrast rule must be generated as a rendered rule');
    if (a11y.browserCoverageByScope.find((c) => c.ruleId === 'a11y.min-hit-area')?.evidenceAlternativesByRequirement[0][0] !== 'dom') {
        throw new Error('DOM browser coverage must use the dom evidence kind');
    }
    if (pol.browserRuleIds.sort().join(',') !== [
        'polish.concentric-radius',
        'polish.typography-rhythm',
    ].sort().join(','))
        throw new Error('polish browser rule split drifted');
    if (!pol.ownedRuleIds.includes('polish.anti-pattern-genericity'))
        throw new Error('genericity must remain owned');
    if (pol.browserRuleIds.includes('polish.anti-pattern-genericity'))
        throw new Error('genericity must remain excluded from browser policy');
    if (pol.cleanPolicy.requiredRuleIds.includes('polish.anti-pattern-genericity'))
        throw new Error('genericity must remain non-required');
    // toleratedFindingCounts is EXPLICIT 0 per owned blocking (severity,class) pair (not {})
    if (Object.keys(a11y.cleanPolicy.toleratedFindingCounts).length === 0)
        throw new Error('tolerated counts must be explicit, not empty');
    if (a11y.cleanPolicy.toleratedFindingCounts['blocker|a11y'] !== 0)
        throw new Error('explicit 0 expected for blocker|a11y');
    // generated coverage is PER-REQUIREMENT (evidenceAlternativesByRequirement), never
    // a flat union, and defaults requireAll=true (no blanket component/page=false).
    const focus = pol.cleanPolicy.requiredCoverageByScope.find((c) => c.ruleId === 'polish.reduced-motion-respect')
        || a11y.cleanPolicy.requiredCoverageByScope.find((c) => c.ruleId === 'a11y.focus-visible');
    if (!focus || !Array.isArray(focus.evidenceAlternativesByRequirement) || focus.evidenceAlternativesByRequirement.length === 0) {
        throw new Error('coverage must carry per-requirement evidence alternatives');
    }
    if (focus.requireAllDiscoveredApplicableFiles !== true)
        throw new Error('a evaluate_expanded_context rule must requireAll=true');
    // deriveValidator is pure: an all-dom-only owner yields EMPTY requiredRuleIds
    const domOwner = (0, validator_generation_1.deriveValidator)(reg('v'), [baseRule({ ruleId: 'v.dom', canonicalRuleKey: 'v/dom', ownerValidatorId: 'v', evidenceRequirements: ['dom'], supportedSourceKinds: [{ kind: 'dom', level: 'full' }] })]);
    if (domOwner.cleanPolicy.requiredRuleIds.length !== 0)
        throw new Error('all-dom-only owner must derive empty requiredRuleIds');
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
    const requiredFieldFixtures = [
        ['missing-ruleId', { ruleId: '' }],
        ['missing-sourceRuleAliases', { sourceRuleAliases: [] }],
        ['missing-severity', { severity: '' }],
        ['missing-findingClass', { findingClass: '' }],
        ['missing-sourceVocabulary', { sourceVocabulary: '' }],
        ['missing-sourceSeverity', { sourceSeverity: '' }],
        ['missing-registryScope', { registryScope: '' }],
        ['missing-narrowTargetBehavior', { narrowTargetBehavior: '' }],
        ['missing-applicability', { applicability: '' }],
        ['missing-supportedSourceKinds', { supportedSourceKinds: [] }],
        ['missing-scope', { scope: '' }],
        ['missing-ownerValidatorId', { ownerValidatorId: '' }],
        ['missing-canonicalRuleKey', { canonicalRuleKey: '' }],
        ['missing-evidenceRequirements', { evidenceRequirements: [] }],
    ];
    for (const [label, over] of requiredFieldFixtures)
        expectInvalid(label, [baseRule(over)], [reg('v')]);
    // 8. a GATING registration that owns zero rules must fail. A generated gate
    //    with no owned rules would have empty requiredRuleIds and be vacuous.
    const zeroRuleGatePolicies = [{ laneId: 'test-lane', requiredProductValidatorIds: ['gate'], excludedProductValidatorIds: [] }];
    expectInvalid('gating-zero-owned-rules', [baseRule({ ownerValidatorId: 'v' })], [reg('v'), reg('gate')], (0, validator_generation_1.gatingValidatorIds)(zeroRuleGatePolicies));
    // --- fixture-manifest PRESENCE only (spec 628-634; P4a-2 creates and executes
    //     the referenced fixture files) ---
    // the REAL manifest covers every gating validator across all three categories
    if (!(0, validator_generation_1.validateFixtureManifest)((0, validator_generation_1.gatingValidatorIds)(flow_validation_capabilities_1.LANE_POLICIES), flow_validation_capabilities_1.FIXTURE_MANIFEST).ok) {
        throw new Error('real fixture manifest must be complete for every gating validator');
    }
    // failing-first: a gating validator missing its inconclusive fixture entry
    const missingCat = flow_validation_capabilities_1.FIXTURE_MANIFEST.map((m) => m.validatorId === 'static-a11y' ? { ...m, fixtures: { ...m.fixtures, inconclusive: '' } } : m);
    if ((0, validator_generation_1.validateFixtureManifest)((0, validator_generation_1.gatingValidatorIds)(flow_validation_capabilities_1.LANE_POLICIES), missingCat).ok) {
        throw new Error('a missing inconclusive fixture-manifest entry must FAIL --check');
    }
    // failing-first: a gating validator with NO manifest entry at all
    const droppedEntry = flow_validation_capabilities_1.FIXTURE_MANIFEST.filter((m) => m.validatorId !== 'theming');
    if ((0, validator_generation_1.validateFixtureManifest)((0, validator_generation_1.gatingValidatorIds)(flow_validation_capabilities_1.LANE_POLICIES), droppedEntry).ok) {
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
    expectInvalid('unregistered-gating', [baseRule({ ownerValidatorId: 'v' })], [reg('v')], (0, validator_generation_1.gatingValidatorIds)([{ laneId: 'l', requiredProductValidatorIds: ['ghost-gate'], excludedProductValidatorIds: [] }]));
    // 12. (P4b-2) browser-allowlist consistency, ONE per rejection. The base registry
    //     is matrix-consistent and otherwise valid, so the ONLY defect is the browser
    //     allowlist passed explicitly as the 5th arg.
    // 12a. an allowlisted id that no rule declares/owns
    expectInvalid('browser-allowlist-absent', [okRule({ ruleId: 'v.css', canonicalRuleKey: 'v/css' })], [reg('v')], [], ['v.ghost']);
    // 12b. an allowlisted rule that is statically satisfiable (belongs in cleanPolicy, not browser policy)
    expectInvalid('browser-allowlist-static', [okRule({ ruleId: 'v.css', canonicalRuleKey: 'v/css' })], [reg('v')], [], ['v.css']);
    // 12c. an allowlisted rule whose declared evidence is not a collector-produced kind
    //      ('markup'). Mixed ['dom','markup'] is non-static (dom has no static source) so
    //      this isolates the non-collector-evidence rejection from the static-satisfiable one.
    expectInvalid('browser-allowlist-noncollector', [
        okRule({ ruleId: 'v.css', canonicalRuleKey: 'v/css', sourceRuleAliases: ['source:v.css'] }),
        okRule({ ruleId: 'v.mixed', canonicalRuleKey: 'v/mixed', sourceRuleAliases: ['source:v.mixed'], evidenceRequirements: ['dom', 'markup'] }),
    ], [reg('v')], [], ['v.mixed']);
    // --- P4a-2: the four gating validators are non-vacuous and matrix-consistent ---
    for (const id of ['polish-standard', 'theming', 'anti-pattern', 'static-a11y']) {
        const v = gen.GENERATED_VALIDATORS.find((x) => x.validatorId === id);
        if (!v || v.cleanPolicy.requiredRuleIds.length === 0)
            throw new Error(`gating validator ${id} must have non-empty requiredRuleIds`);
    }
    // anti-pattern: the heuristic markup rules are owned but the precise css bans are the blocking required ones
    const apGen = gen.GENERATED_VALIDATORS.find((x) => x.validatorId === 'anti-pattern');
    if (!apGen.cleanPolicy.requiredRuleIds.includes('anti-pattern.gradient-text'))
        throw new Error('gradient-text must be required');
    if (apGen.cleanPolicy.toleratedFindingCounts['major|anti-pattern'] !== 0)
        throw new Error('explicit 0 tolerance for major|anti-pattern');
    // generated support records must exactly reflect the one shared matrix
    for (const rule of product_rule_registry_1.RULES) {
        const expected = (0, source_support_matrix_1.supportedKindsFor)(...rule.evidenceRequirements);
        if (JSON.stringify(rule.supportedSourceKinds) !== JSON.stringify(expected))
            throw new Error(`source matrix drift for ${rule.ruleId}`);
    }
    console.log('generate-validators: OK');
}
run();
//# sourceMappingURL=generate-validators.test.js.map