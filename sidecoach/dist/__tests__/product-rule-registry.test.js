"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// sidecoach/src/__tests__/product-rule-registry.test.ts
const product_rule_types_1 = require("../product-rule-types");
const product_rule_registry_1 = require("../product-rule-registry");
const source_support_matrix_1 = require("../validators/source-support-matrix");
function run() {
    const blocker = 'blocker';
    if (!(0, product_rule_types_1.isBlocking)(blocker, ['blocker', 'major']))
        throw new Error('blocker must block under [blocker,major]');
    if ((0, product_rule_types_1.isBlocking)('minor', ['blocker', 'major']))
        throw new Error('minor must not block');
    if ((0, product_rule_types_1.isBlocking)('advisory', ['blocker', 'major']))
        throw new Error('advisory must not block');
    // evidence-compatibility model: browser-only evidence maps to NO static source kind
    if (product_rule_types_1.EVIDENCE_SOURCE_COMPATIBILITY['dom'].length !== 0)
        throw new Error('dom must map to no static source kind');
    if (product_rule_types_1.EVIDENCE_SOURCE_COMPATIBILITY['computed-style'].length !== 0)
        throw new Error('computed-style must be browser-only');
    if (product_rule_types_1.EVIDENCE_SOURCE_COMPATIBILITY['contrast'].length !== 0)
        throw new Error('contrast must be browser-only');
    if (!product_rule_types_1.EVIDENCE_SOURCE_COMPATIBILITY['css-rule'].includes('css'))
        throw new Error('css-rule must be satisfiable from css source');
    // a css-rule rule is statically satisfiable; a dom rule is not. isStaticallySatisfiable
    // is AND-across-requirements: EVERY required kind must be statically satisfiable.
    if (!(0, product_rule_types_1.isStaticallySatisfiable)(['css-rule']))
        throw new Error('css-rule must be statically satisfiable');
    if (!(0, product_rule_types_1.isStaticallySatisfiable)(['css-rule', 'markup']))
        throw new Error('css-rule + markup are BOTH static -> statically satisfiable');
    if ((0, product_rule_types_1.isStaticallySatisfiable)(['css-rule', 'dom']))
        throw new Error('any dom requirement makes a rule non-statically-satisfiable (AND across requirements)');
    if ((0, product_rule_types_1.sourceKindsForEvidence)(['markup']).includes('css'))
        throw new Error('css cannot satisfy a markup-only requirement');
    console.log('product-rule-types: OK');
}
run();
// --- canonical registry + alias resolution ---
{
    // exactly one executable definition per canonicalRuleKey
    const keys = product_rule_registry_1.RULES.map((r) => r.canonicalRuleKey);
    if (new Set(keys).size !== keys.length)
        throw new Error('duplicate canonicalRuleKey - one executable def per key');
    // every source alias maps to exactly one canonical rule (no conflict in the real seed)
    const seen = new Map();
    for (const r of product_rule_registry_1.RULES)
        for (const a of r.sourceRuleAliases) {
            if (seen.has(a))
                throw new Error(`source alias ${a} maps to two canonical keys`);
            seen.set(a, r.canonicalRuleKey);
        }
    // representative CROSS-REGISTRY aliasing: the polish-standard numeric id and the
    // extended-domain POLISH_0NN both resolve to the SAME canonical rule.
    const byNum = (0, product_rule_registry_1.resolveSourceAlias)('polish-standard:18');
    const byExt = (0, product_rule_registry_1.resolveSourceAlias)('POLISH_018');
    if (!byNum || !byExt)
        throw new Error('focus-visible aliases must resolve');
    if (byNum.canonicalRuleKey !== byExt.canonicalRuleKey)
        throw new Error('cross-registry aliases must resolve to ONE canonical rule');
    if (byNum.canonicalRuleKey !== 'a11y/focus-visible')
        throw new Error('focus-visible canonical key mismatch');
    // getRule / getRuleById round-trip
    if ((0, product_rule_registry_1.getRule)(byNum.canonicalRuleKey)?.canonicalRuleKey !== 'a11y/focus-visible')
        throw new Error('getRule round-trip failed');
    if ((0, product_rule_registry_1.getRuleById)('a11y.focus-visible')?.canonicalRuleKey !== 'a11y/focus-visible')
        throw new Error('getRuleById round-trip failed');
    // every rule carries required metadata
    for (const r of product_rule_registry_1.RULES) {
        if (!r.ruleId || !r.canonicalRuleKey || !r.ownerValidatorId || !r.severity || !r.findingClass || !r.scope) {
            throw new Error(`rule ${r.ruleId || '(no id)'} missing required metadata`);
        }
    }
    // the seed exercises the model: a DOM-only owned-non-required rule + a declared severity override
    const domOnly = (0, product_rule_registry_1.getRuleById)('a11y.min-hit-area');
    if (!domOnly || (0, product_rule_types_1.isStaticallySatisfiable)(domOnly.evidenceRequirements))
        throw new Error('a11y.min-hit-area must be DOM-only (not statically satisfiable)');
    const override = (0, product_rule_registry_1.getRuleById)('anti-pattern.identical-card-grids');
    if (!override || override.severity !== 'minor' || !override.severityOverrideReason)
        throw new Error('identical-card-grids must declare a minor override with a reason');
    if (product_rule_types_1.SEVERITY_TABLE[override.sourceSeverity] === override.severity)
        throw new Error('override rule must diverge from the table default');
    console.log('product-rule-registry: OK');
}
// --- P4a-2: partial-static registry slice (exact 30-row assertion) ---
{
    const OVERRIDE_REASON = 'HTML-structural detector flags pattern shapes, not certainties; false positives are possible (absolute-ban-detector.ts:19-21). Demoted from the table default major to non-blocking minor.';
    const P = (id, n, key, srcSev, sev, scope_, evidence, applicability) => ({
        ruleId: id, sourceRuleAliases: [`polish-standard:${n}`, `POLISH_0${n < 10 ? '0' + n : n}`], canonicalRuleKey: key,
        ownerValidatorId: 'polish-standard', sourceVocabulary: 'polish-extended-antipattern', sourceSeverity: srcSev,
        severity: sev, findingClass: 'polish', registryScope: scope_, evidenceRequirements: [evidence],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)(evidence), scope: '__scope__', narrowTargetBehavior: 'evaluate_expanded_context',
        applicability,
    });
    // owner polish-standard (19)
    const polish = [
        { ...P('polish.scale-on-press', 1, 'polish/scale-on-press', 'high', 'major', '', 'css-rule', 'not_applicable'), registryScope: 'polished-press-feedback', scope: 'file' },
        { ...P('polish.concentric-radius', 2, 'polish/concentric-radius', 'medium', 'minor', '', 'computed-style', 'inconclusive'), registryScope: 'polished-radius-concentricity', scope: 'component' },
        { ...P('polish.icon-swap-compound', 3, 'polish/icon-swap-compound', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-icon-transition', scope: 'file' },
        { ...P('polish.image-outline-neutral', 4, 'polish/image-outline-neutral', 'low', 'advisory', '', 'css-rule', 'not_applicable'), registryScope: 'polished-image-outline', scope: 'file' },
        { ...P('polish.no-transition-all', 6, 'polish/no-transition-all', 'high', 'major', '', 'css-rule', 'not_applicable'), registryScope: 'polished-explicit-transition', scope: 'file' },
        { ...P('polish.tabular-nums', 7, 'polish/tabular-nums', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-tabular-numerics', scope: 'file' },
        { ...P('polish.text-wrap-balance', 8, 'polish/text-wrap-balance', 'low', 'advisory', '', 'css-rule', 'not_applicable'), registryScope: 'polished-heading-balance', scope: 'file' },
        { ...P('polish.staggered-enter', 9, 'polish/staggered-enter', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-enter-stagger', scope: 'file' },
        { ...P('polish.subtle-exit', 10, 'polish/subtle-exit', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-exit-choreography', scope: 'file' },
        { ...P('polish.font-smoothing', 11, 'polish/font-smoothing', 'low', 'advisory', '', 'css-rule', 'not_applicable'), registryScope: 'polished-font-smoothing', scope: 'file' },
        { ...P('polish.animatepresence-initial', 12, 'polish/animatepresence-initial', 'medium', 'minor', '', 'markup', 'not_applicable'), registryScope: 'polished-first-load-suppression', scope: 'file' },
        { ...P('polish.sparse-will-change', 13, 'polish/sparse-will-change', 'low', 'advisory', '', 'css-rule', 'not_applicable'), registryScope: 'polished-sparse-will-change', scope: 'file' },
        { ...P('polish.shadows-over-borders', 14, 'polish/shadows-over-borders', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-elevation-shadow', scope: 'file' },
        { ...P('polish.optical-alignment', 15, 'polish/optical-alignment', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-optical-alignment', scope: 'file' },
        { ...P('polish.typography-rhythm', 16, 'polish/typography-rhythm', 'medium', 'minor', '', 'computed-style', 'inconclusive'), registryScope: 'polished-vertical-rhythm', scope: 'component' },
        { ...P('polish.shadow-hierarchy', 17, 'polish/shadow-hierarchy', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-shadow-hierarchy', scope: 'file' },
        { ...P('polish.reduced-motion-respect', 19, 'polish/reduced-motion-respect', 'critical', 'blocker', '', 'css-rule', 'not_applicable'), registryScope: 'polished-motion-respect', scope: 'file' },
        { ...P('polish.state-completeness', 21, 'polish/state-completeness', 'high', 'major', '', 'css-rule', 'not_applicable'), registryScope: 'polished-state-completeness', scope: 'file' },
        { ...P('polish.anti-pattern-genericity', 22, 'polish/anti-pattern-genericity', 'medium', 'minor', '', 'dom', 'inconclusive'), registryScope: 'polished-genericity-floor', scope: 'component' },
    ];
    // owner static-a11y (3): aliases stay polish-standard:N / POLISH_0NN
    const a11y = [
        { ruleId: 'a11y.focus-visible', sourceRuleAliases: ['polish-standard:18', 'POLISH_018'], canonicalRuleKey: 'a11y/focus-visible', ownerValidatorId: 'static-a11y', sourceVocabulary: 'polish-extended-antipattern', sourceSeverity: 'critical', severity: 'blocker', findingClass: 'a11y', registryScope: 'keyboard-accessibility-floor', evidenceRequirements: ['css-rule'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'), scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: 'a11y.min-hit-area', sourceRuleAliases: ['polish-standard:5', 'POLISH_005'], canonicalRuleKey: 'a11y/min-hit-area', ownerValidatorId: 'static-a11y', sourceVocabulary: 'polish-extended-antipattern', sourceSeverity: 'critical', severity: 'blocker', findingClass: 'a11y', registryScope: 'touch-target-floor', evidenceRequirements: ['dom'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('dom'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        { ruleId: 'a11y.color-contrast', sourceRuleAliases: ['polish-standard:20', 'POLISH_020'], canonicalRuleKey: 'a11y/color-contrast', ownerValidatorId: 'static-a11y', sourceVocabulary: 'polish-extended-antipattern', sourceSeverity: 'critical', severity: 'blocker', findingClass: 'a11y', registryScope: 'contrast-floor', evidenceRequirements: ['contrast'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('contrast'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
    ];
    // owner theming (2)
    const theming = [
        { ruleId: 'theming.hex-in-interactive-state', sourceRuleAliases: ['taste/hex-in-interactive-state'], canonicalRuleKey: 'theming/token-driven-interactive-state', ownerValidatorId: 'theming', sourceVocabulary: 'taste', sourceSeverity: 'error', severity: 'blocker', findingClass: 'theming', registryScope: 'token-consistency', evidenceRequirements: ['css-rule'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'), scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: 'theming.border-radius-consistency', sourceRuleAliases: ['taste/border-radius-inconsistency'], canonicalRuleKey: 'theming/border-radius-consistency', ownerValidatorId: 'theming', sourceVocabulary: 'taste', sourceSeverity: 'error', severity: 'blocker', findingClass: 'theming', registryScope: 'token-consistency', evidenceRequirements: ['css-rule'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'), scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    ];
    // owner anti-pattern (6)
    const ap = (id, key, ban, srcSev, sev, scope_, evidence, override) => ({
        ruleId: id, sourceRuleAliases: [ban], canonicalRuleKey: key, ownerValidatorId: 'anti-pattern', sourceVocabulary: 'p012',
        sourceSeverity: srcSev, severity: sev, ...(override ? { severityOverrideReason: override } : {}), findingClass: 'anti-pattern',
        registryScope: 'named-ban-compliance', evidenceRequirements: [evidence], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)(evidence),
        scope: scope_, narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable',
    });
    const antiPattern = [
        ap('anti-pattern.gradient-text', 'anti-pattern/gradient-text', 'gradient-text', 'P1', 'major', 'file', 'css-rule'),
        ap('anti-pattern.glassmorphism-default', 'anti-pattern/glassmorphism-default', 'glassmorphism-default', 'P1', 'major', 'file', 'css-rule'),
        ap('anti-pattern.side-stripe-borders', 'anti-pattern/side-stripe-borders', 'side-stripe-borders', 'P1', 'major', 'file', 'css-rule'),
        ap('anti-pattern.identical-card-grids', 'anti-pattern/identical-card-grids', 'identical-card-grids', 'P1', 'minor', 'project', 'markup', OVERRIDE_REASON),
        ap('anti-pattern.hero-metric-template', 'anti-pattern/hero-metric-template', 'hero-metric-template', 'P1', 'minor', 'project', 'markup', OVERRIDE_REASON),
        ap('anti-pattern.modal-as-first-thought', 'anti-pattern/modal-as-first-thought', 'modal-as-first-thought', 'P2', 'minor', 'project', 'markup'),
    ];
    const EXPECTED_RULES = [...polish, ...a11y, ...theming, ...antiPattern];
    const FIELD_ORDER = [
        'ruleId', 'sourceRuleAliases', 'canonicalRuleKey', 'ownerValidatorId', 'sourceVocabulary', 'sourceSeverity',
        'severity', 'severityOverrideReason', 'findingClass', 'registryScope', 'evidenceRequirements',
        'supportedSourceKinds', 'scope', 'narrowTargetBehavior', 'applicability',
    ];
    const canon = (r) => JSON.stringify(FIELD_ORDER.reduce((o, k) => { if (r[k] !== undefined)
        o[k] = r[k]; return o; }, {}));
    const byId = (a, b) => a.ruleId.localeCompare(b.ruleId);
    const actual = [...product_rule_registry_1.RULES].sort(byId).map(canon);
    const expected = [...EXPECTED_RULES].sort(byId).map(canon);
    for (let i = 0; i < Math.max(actual.length, expected.length); i++) {
        if (actual[i] !== expected[i])
            throw new Error(`registry row ${i} mismatch:\n  actual:   ${actual[i]}\n  expected: ${expected[i]}`);
    }
    const EXPECTED_POLISH_ALIAS_PAIRS = [
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
        if ((0, product_rule_registry_1.resolveSourceAlias)(numeric)?.canonicalRuleKey !== key)
            throw new Error(`bad alias ${numeric}`);
        if ((0, product_rule_registry_1.resolveSourceAlias)(extended)?.canonicalRuleKey !== key)
            throw new Error(`bad alias ${extended}`);
    }
    if (product_rule_registry_1.RULES.length !== 30)
        throw new Error(`expected 30 canonical rules, got ${product_rule_registry_1.RULES.length}`);
    const owners = (id) => product_rule_registry_1.RULES.filter((r) => r.ownerValidatorId === id);
    if (owners('polish-standard').length !== 19)
        throw new Error('polish-standard must own 19 rules');
    if (owners('static-a11y').length !== 3)
        throw new Error('static-a11y must own 3 rules');
    if (owners('theming').length !== 2)
        throw new Error('theming must own 2 rules');
    if (owners('anti-pattern').length !== 6)
        throw new Error('anti-pattern must own 6 rules');
    const contrast = (0, product_rule_registry_1.getRuleById)('a11y.color-contrast');
    if (!contrast || contrast.ownerValidatorId !== 'static-a11y')
        throw new Error('color-contrast owned by static-a11y');
    if ((0, product_rule_types_1.isStaticallySatisfiable)(contrast.evidenceRequirements))
        throw new Error('color-contrast must be non-required (contrast-only)');
    const hero = (0, product_rule_registry_1.getRuleById)('anti-pattern.hero-metric-template');
    if (!hero || hero.severity !== 'minor' || !hero.severityOverrideReason)
        throw new Error('hero-metric-template must declare a minor override with a reason');
    if (product_rule_types_1.SEVERITY_TABLE[hero.sourceSeverity] === hero.severity)
        throw new Error('hero-metric override must diverge from table default');
    const glass = (0, product_rule_registry_1.getRuleById)('anti-pattern.glassmorphism-default');
    if (!glass || glass.severity !== 'major' || glass.severityOverrideReason)
        throw new Error('glassmorphism-default stays major with no override');
    const br = (0, product_rule_registry_1.getRuleById)('theming.border-radius-consistency');
    if (!br || br.severity !== 'blocker' || !(0, product_rule_types_1.isStaticallySatisfiable)(br.evidenceRequirements))
        throw new Error('border-radius-consistency must be a required blocker');
    if (!(0, product_rule_registry_1.resolveSourceAlias)('taste/border-radius-inconsistency'))
        throw new Error('taste alias must resolve');
    // the one shared matrix is the single source of supportedSourceKinds for every rule
    for (const r of product_rule_registry_1.RULES) {
        if (JSON.stringify(r.supportedSourceKinds) !== JSON.stringify((0, source_support_matrix_1.supportedKindsFor)(...r.evidenceRequirements))) {
            throw new Error(`source matrix drift for ${r.ruleId}`);
        }
    }
    console.log('product-rule-registry (P4a-2 partial-static slice): OK');
}
//# sourceMappingURL=product-rule-registry.test.js.map