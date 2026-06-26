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
    // (identical-card-grids DELETED Stage-2 2026-06-24; hero-metric-template carries the same minor-override shape.)
    if ((0, product_rule_registry_1.getRuleById)('anti-pattern.identical-card-grids'))
        throw new Error('anti-pattern.identical-card-grids should be DELETED (Stage-2)');
    const override = (0, product_rule_registry_1.getRuleById)('anti-pattern.hero-metric-template');
    if (!override || override.severity !== 'minor' || !override.severityOverrideReason)
        throw new Error('hero-metric-template must declare a minor override with a reason');
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
    // owner polish-standard (23): 21 static polish rules + polish.tiny-text + polish.marketing-buzzword
    // (rendered-scan: Stage 1 tiny-text, Stage 5a marketing-buzzword)
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
        { ...P('polish.interruptible-animations', 23, 'polish/interruptible-animations', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-interruptible-state', scope: 'file' },
        { ...P('polish.skip-load-animation', 24, 'polish/skip-load-animation', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-load-animation-gating', scope: 'file' },
        { ...P('polish.sparse-will-change', 13, 'polish/sparse-will-change', 'low', 'advisory', '', 'css-rule', 'not_applicable'), registryScope: 'polished-sparse-will-change', scope: 'file' },
        { ...P('polish.shadows-over-borders', 14, 'polish/shadows-over-borders', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-elevation-shadow', scope: 'file' },
        { ...P('polish.optical-alignment', 15, 'polish/optical-alignment', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-optical-alignment', scope: 'file' },
        { ...P('polish.typography-rhythm', 16, 'polish/typography-rhythm', 'medium', 'minor', '', 'computed-style', 'inconclusive'), registryScope: 'polished-vertical-rhythm', scope: 'component' },
        { ...P('polish.shadow-hierarchy', 17, 'polish/shadow-hierarchy', 'medium', 'minor', '', 'css-rule', 'not_applicable'), registryScope: 'polished-shadow-hierarchy', scope: 'file' },
        { ...P('polish.reduced-motion-respect', 19, 'polish/reduced-motion-respect', 'critical', 'blocker', '', 'css-rule', 'not_applicable'), registryScope: 'polished-motion-respect', scope: 'file' },
        { ...P('polish.state-completeness', 21, 'polish/state-completeness', 'high', 'major', '', 'css-rule', 'not_applicable'), registryScope: 'polished-state-completeness', scope: 'file' },
        { ...P('polish.anti-pattern-genericity', 22, 'polish/anti-pattern-genericity', 'medium', 'minor', '', 'dom', 'inconclusive'), registryScope: 'polished-genericity-floor', scope: 'component' },
        { ruleId: 'polish.tiny-text', sourceRuleAliases: ['rendered-scanner:tiny-text'], canonicalRuleKey: 'polish/tiny-text', ownerValidatorId: 'polish-standard', sourceVocabulary: 'rendered-scanner', sourceSeverity: 'medium', severity: 'minor', findingClass: 'polish', registryScope: 'rendered-tiny-text', evidenceRequirements: ['rendered-scan'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        { ruleId: 'polish.marketing-buzzword', sourceRuleAliases: ['rendered-scanner:marketing-buzzword'], canonicalRuleKey: 'polish/marketing-buzzword', ownerValidatorId: 'polish-standard', sourceVocabulary: 'rendered-scanner', sourceSeverity: 'medium', severity: 'minor', findingClass: 'polish', registryScope: 'rendered-marketing-buzzword', evidenceRequirements: ['rendered-scan'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
    ];
    // owner static-a11y (7): focus-visible (css) + min-hit-area (dom collector) + 5 rendered-scan classes
    // (broken-image, skipped-heading, gray-on-color, justified-text, and - Stage 6 - color-contrast, MIGRATED off
    // the collector contrast probe onto the rendered scanner's low-contrast finding to close the one-engine hole).
    const a11y = [
        { ruleId: 'a11y.focus-visible', sourceRuleAliases: ['polish-standard:18', 'POLISH_018'], canonicalRuleKey: 'a11y/focus-visible', ownerValidatorId: 'static-a11y', sourceVocabulary: 'polish-extended-antipattern', sourceSeverity: 'critical', severity: 'blocker', findingClass: 'a11y', registryScope: 'keyboard-accessibility-floor', evidenceRequirements: ['css-rule'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'), scope: 'file', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: 'a11y.min-hit-area', sourceRuleAliases: ['polish-standard:5', 'POLISH_005'], canonicalRuleKey: 'a11y/min-hit-area', ownerValidatorId: 'static-a11y', sourceVocabulary: 'polish-extended-antipattern', sourceSeverity: 'critical', severity: 'blocker', findingClass: 'a11y', registryScope: 'touch-target-floor', evidenceRequirements: ['dom'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('dom'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        { ruleId: 'a11y.color-contrast', sourceRuleAliases: ['polish-standard:20', 'POLISH_020'], canonicalRuleKey: 'a11y/color-contrast', ownerValidatorId: 'static-a11y', sourceVocabulary: 'polish-extended-antipattern', sourceSeverity: 'critical', severity: 'blocker', findingClass: 'a11y', registryScope: 'contrast-floor', evidenceRequirements: ['rendered-scan'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        { ruleId: 'a11y.broken-image', sourceRuleAliases: ['rendered-scanner:broken-image'], canonicalRuleKey: 'a11y/broken-image', ownerValidatorId: 'static-a11y', sourceVocabulary: 'rendered-scanner', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'rendered-broken-image', evidenceRequirements: ['rendered-scan'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        { ruleId: 'a11y.skipped-heading', sourceRuleAliases: ['rendered-scanner:skipped-heading'], canonicalRuleKey: 'a11y/heading-order', ownerValidatorId: 'static-a11y', sourceVocabulary: 'rendered-scanner', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'rendered-heading-order', evidenceRequirements: ['rendered-scan'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        { ruleId: 'a11y.gray-on-color', sourceRuleAliases: ['rendered-scanner:gray-on-color'], canonicalRuleKey: 'a11y/gray-on-color', ownerValidatorId: 'static-a11y', sourceVocabulary: 'rendered-scanner', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'rendered-gray-on-color', evidenceRequirements: ['rendered-scan'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        { ruleId: 'a11y.justified-text', sourceRuleAliases: ['rendered-scanner:justified-text'], canonicalRuleKey: 'a11y/justified-text', ownerValidatorId: 'static-a11y', sourceVocabulary: 'rendered-scanner', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'rendered-justified-text', evidenceRequirements: ['rendered-scan'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'), scope: 'component', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'inconclusive' },
        // absorbed forms-a11y (Stage 2): markup-evidence, scope project, N/A when no form controls
        { ruleId: 'a11y.form-control-labelled', sourceRuleAliases: ['extended-domain:FORMS_016', 'FORMS_016'], canonicalRuleKey: 'a11y/form-control-labelled', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'critical', severity: 'blocker', findingClass: 'a11y', registryScope: 'forms-labelling', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: 'a11y.form-error-association', sourceRuleAliases: ['extended-domain:FORMS_018', 'FORMS_018'], canonicalRuleKey: 'a11y/form-error-association', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'forms-error-association', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: 'a11y.form-placeholder-not-label', sourceRuleAliases: ['extended-domain:FORMS_019', 'FORMS_019'], canonicalRuleKey: 'a11y/form-placeholder-not-label', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'forms-placeholder', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: 'a11y.form-input-type', sourceRuleAliases: ['extended-domain:FORMS_002', 'FORMS_002'], canonicalRuleKey: 'a11y/form-input-type', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'minor', severityOverrideReason: 'input-type is a UX keyboard/validation hint, not a blocking a11y failure; advisory-not-gating by design', findingClass: 'a11y', registryScope: 'forms-input-type', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: 'a11y.form-choice-label-target', sourceRuleAliases: ['extended-domain:FORMS_015', 'FORMS_015'], canonicalRuleKey: 'a11y/form-choice-label-target', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'forms-choice-target', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-autocomplete", sourceRuleAliases: ["extended-domain:FORMS_001", "FORMS_001"], canonicalRuleKey: "a11y/form-autocomplete", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "high", severity: "major", findingClass: 'a11y', registryScope: "forms-autocomplete", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-inputmode", sourceRuleAliases: ["extended-domain:FORMS_003", "FORMS_003"], canonicalRuleKey: "a11y/form-inputmode", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: 'a11y', registryScope: "forms-inputmode", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-never-block-paste", sourceRuleAliases: ["extended-domain:FORMS_004", "FORMS_004"], canonicalRuleKey: "a11y/form-never-block-paste", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "high", severity: "major", findingClass: 'a11y', registryScope: "forms-paste", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-spellcheck-off", sourceRuleAliases: ["extended-domain:FORMS_005", "FORMS_005"], canonicalRuleKey: "a11y/form-spellcheck-off", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: 'a11y', registryScope: "forms-spellcheck", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-idempotent-submit", sourceRuleAliases: ["extended-domain:FORMS_007", "FORMS_007"], canonicalRuleKey: "a11y/form-idempotent-submit", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: 'a11y', registryScope: "forms-idempotent-submit", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-inline-errors", sourceRuleAliases: ["extended-domain:FORMS_008", "FORMS_008"], canonicalRuleKey: "a11y/form-inline-errors", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "high", severity: "major", findingClass: 'a11y', registryScope: "forms-inline-errors", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-focus-first-error", sourceRuleAliases: ["extended-domain:FORMS_009", "FORMS_009"], canonicalRuleKey: "a11y/form-focus-first-error", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "high", severity: "minor", severityOverrideReason: "detected via keyword-presence proxy (focus/setFocus/scrollIntoView near error); advisory-not-gating until a stronger signal exists", findingClass: 'a11y', registryScope: "forms-focus-first-error", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-no-pm-non-auth", sourceRuleAliases: ["extended-domain:FORMS_011", "FORMS_011"], canonicalRuleKey: "a11y/form-no-pm-non-auth", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: 'a11y', registryScope: "forms-no-pm", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-textarea-submit", sourceRuleAliases: ["extended-domain:FORMS_014", "FORMS_014"], canonicalRuleKey: "a11y/form-textarea-submit", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: 'a11y', registryScope: "forms-textarea-submit", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-no-pre-disable-submit", sourceRuleAliases: ["extended-domain:FORMS_017", "FORMS_017"], canonicalRuleKey: "a11y/form-no-pre-disable-submit", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: 'a11y', registryScope: "forms-no-pre-disable", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.form-autofocus-sparingly", sourceRuleAliases: ["extended-domain:FORMS_020", "FORMS_020"], canonicalRuleKey: "a11y/form-autofocus-sparingly", ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: "low", severity: "advisory", findingClass: 'a11y', registryScope: "forms-autofocus", evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
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
        ap('anti-pattern.hero-metric-template', 'anti-pattern/hero-metric-template', 'hero-metric-template', 'P1', 'minor', 'project', 'markup', OVERRIDE_REASON),
        ap('anti-pattern.modal-as-first-thought', 'anti-pattern/modal-as-first-thought', 'modal-as-first-thought', 'P2', 'minor', 'project', 'markup'),
    ];
    // owner page-quality (6): cherry-picked DOM-evidence Tier-2 keepers (Stage 2 convergence)
    const pageQuality = [
        { ruleId: "perf.image-dimensions", sourceRuleAliases: ["extended-domain:IMGPERF_001", "IMGPERF_001"], canonicalRuleKey: "perf/image-dimensions", ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: "high", severity: "major", findingClass: "polish", registryScope: "pq-image-dimensions", evidenceRequirements: ["markup"], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)("markup"), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "perf.image-lazy-load", sourceRuleAliases: ["extended-domain:IMGPERF_002", "IMGPERF_002"], canonicalRuleKey: "perf/image-lazy-load", ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: "polish", registryScope: "pq-image-lazy", evidenceRequirements: ["markup"], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)("markup"), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "polish.text-overflow-strategy", sourceRuleAliases: ["extended-domain:CONTENT_002", "CONTENT_002"], canonicalRuleKey: "polish/text-overflow-strategy", ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: "polish", registryScope: "pq-text-overflow", evidenceRequirements: ["css-rule"], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)("css-rule"), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "theming.color-scheme-dark", sourceRuleAliases: ["extended-domain:DARKMODE_001", "DARKMODE_001"], canonicalRuleKey: "theming/color-scheme-dark", ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: "theming", registryScope: "pq-color-scheme", evidenceRequirements: ["css-rule"], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)("css-rule"), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.chart-text-fallback", sourceRuleAliases: ["extended-domain:CHART_003", "CHART_003"], canonicalRuleKey: "a11y/chart-text-fallback", ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: "a11y", registryScope: "pq-chart-fallback", evidenceRequirements: ["markup"], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)("markup"), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
        { ruleId: "a11y.button-label-specific", sourceRuleAliases: ["extended-domain:COPY_003", "COPY_003"], canonicalRuleKey: "a11y/button-label-specific", ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: "medium", severity: "minor", findingClass: "a11y", registryScope: "pq-button-label", evidenceRequirements: ["markup"], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)("markup"), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    ];
    const EXPECTED_RULES = [...polish, ...a11y, ...theming, ...antiPattern, ...pageQuality];
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
        ['polish-standard:23', 'POLISH_023', 'polish/interruptible-animations'],
        ['polish-standard:24', 'POLISH_024', 'polish/skip-load-animation'],
    ];
    for (const [numeric, extended, key] of EXPECTED_POLISH_ALIAS_PAIRS) {
        if ((0, product_rule_registry_1.resolveSourceAlias)(numeric)?.canonicalRuleKey !== key)
            throw new Error(`bad alias ${numeric}`);
        if ((0, product_rule_registry_1.resolveSourceAlias)(extended)?.canonicalRuleKey !== key)
            throw new Error(`bad alias ${extended}`);
    }
    if (product_rule_registry_1.RULES.length !== 59)
        throw new Error(`expected 59 canonical rules, got ${product_rule_registry_1.RULES.length}`); // 58 -> 59: +polish.marketing-buzzword (Stage 5a rendered-scan, 2026-06-25); 52 -> 58: +6 page-quality Tier-2 keepers (Stage 2, 2026-06-25); 41->52 = 11 more forms; 36->41 = first 5 forms; 31->36 = Stage 1 rendered
    const owners = (id) => product_rule_registry_1.RULES.filter((r) => r.ownerValidatorId === id);
    if (owners('polish-standard').length !== 23)
        throw new Error('polish-standard must own 23 rules');
    if (owners('static-a11y').length !== 7)
        throw new Error('static-a11y must own 7 rules');
    if (owners('forms').length !== 16)
        throw new Error('forms must own 16 absorbed forms-a11y rules'); // Stage 2 dedicated forms validator (5 + 11 batch 2)
    if (owners('page-quality').length !== 6)
        throw new Error('page-quality must own 6 Tier-2 keeper rules'); // Stage 2 cherry-picked DOM-evidence keepers
    if (owners('theming').length !== 2)
        throw new Error('theming must own 2 rules');
    if (owners('anti-pattern').length !== 5)
        throw new Error('anti-pattern must own 5 rules'); // 6 -> 5: identical-card-grids DELETED (Stage-2)
    const contrast = (0, product_rule_registry_1.getRuleById)('a11y.color-contrast');
    if (!contrast || contrast.ownerValidatorId !== 'static-a11y')
        throw new Error('color-contrast owned by static-a11y');
    // Stage 6: color-contrast is rendered-scan-backed (non-static), promoted-required only when a renderUrl is present.
    if ((0, product_rule_types_1.isStaticallySatisfiable)(contrast.evidenceRequirements))
        throw new Error('color-contrast must be non-static (rendered-scan-backed)');
    if (contrast.evidenceRequirements[0] !== 'rendered-scan')
        throw new Error('color-contrast must declare rendered-scan evidence after Stage 6 migration');
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