"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RULES = void 0;
exports.getRule = getRule;
exports.getRuleById = getRuleById;
exports.resolveSourceAlias = resolveSourceAlias;
exports.resolveRenderedRule = resolveRenderedRule;
exports.renderedScannerRules = renderedScannerRules;
exports.listRenderedManifest = listRenderedManifest;
const product_rule_types_1 = require("./product-rule-types");
const source_support_matrix_1 = require("./validators/source-support-matrix");
const checks_1 = require("./validators/checks");
const check_context_1 = require("./validators/check-context");
// The shared HTML-structural-detector override reason (absolute-ban-detector.ts).
// The heuristic markup ban (hero-metric-template) cites it.
const STRUCTURAL_OVERRIDE_REASON = 'HTML-structural detector flags pattern shapes, not certainties; false positives are possible (absolute-ban-detector.ts:19-21). Demoted from the table default major to non-blocking minor.';
// 36 canonical rules across four owners. supportedSourceKinds is sourced from the ONE shared matrix
// (supportedKindsFor) so registry generation and project collection cannot drift. Browser-evidence rules
// (computed-style/dom/contrast) are owned-but-non-required and surface inconclusive until the collector runs.
// Rendered-scan rules (Stage 1 convergence: the 5 NEW classes) are promoted to required when a renderUrl is
// present and read the live rendered scan (run-validator activateRenderedPolicy).
const RAW_RULES = [
    // ====================== owner polish-standard (23) ======================
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
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
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
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('computed-style'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        ruleId: 'polish.icon-swap-compound',
        sourceRuleAliases: ['polish-standard:3', 'POLISH_003'],
        canonicalRuleKey: 'polish/icon-swap-compound',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-icon-transition',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.image-outline-neutral',
        sourceRuleAliases: ['polish-standard:4', 'POLISH_004'],
        canonicalRuleKey: 'polish/image-outline-neutral',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'low',
        severity: 'advisory',
        findingClass: 'polish',
        registryScope: 'polished-image-outline',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.no-transition-all',
        sourceRuleAliases: ['polish-standard:6', 'POLISH_006'],
        canonicalRuleKey: 'polish/no-transition-all',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'polish',
        registryScope: 'polished-explicit-transition',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.tabular-nums',
        sourceRuleAliases: ['polish-standard:7', 'POLISH_007'],
        canonicalRuleKey: 'polish/tabular-nums',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-tabular-numerics',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.text-wrap-balance',
        sourceRuleAliases: ['polish-standard:8', 'POLISH_008'],
        canonicalRuleKey: 'polish/text-wrap-balance',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'low',
        severity: 'advisory',
        findingClass: 'polish',
        registryScope: 'polished-heading-balance',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.staggered-enter',
        sourceRuleAliases: ['polish-standard:9', 'POLISH_009'],
        canonicalRuleKey: 'polish/staggered-enter',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-enter-stagger',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.subtle-exit',
        sourceRuleAliases: ['polish-standard:10', 'POLISH_010'],
        canonicalRuleKey: 'polish/subtle-exit',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-exit-choreography',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.font-smoothing',
        sourceRuleAliases: ['polish-standard:11', 'POLISH_011'],
        canonicalRuleKey: 'polish/font-smoothing',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'low',
        severity: 'advisory',
        findingClass: 'polish',
        registryScope: 'polished-font-smoothing',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.animatepresence-initial',
        sourceRuleAliases: ['polish-standard:12', 'POLISH_012'],
        canonicalRuleKey: 'polish/animatepresence-initial',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-first-load-suppression',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.interruptible-animations',
        sourceRuleAliases: ['polish-standard:23', 'POLISH_023'],
        canonicalRuleKey: 'polish/interruptible-animations',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-interruptible-state',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.skip-load-animation',
        sourceRuleAliases: ['polish-standard:24', 'POLISH_024'],
        canonicalRuleKey: 'polish/skip-load-animation',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-load-animation-gating',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.sparse-will-change',
        sourceRuleAliases: ['polish-standard:13', 'POLISH_013'],
        canonicalRuleKey: 'polish/sparse-will-change',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'low',
        severity: 'advisory',
        findingClass: 'polish',
        registryScope: 'polished-sparse-will-change',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.shadows-over-borders',
        sourceRuleAliases: ['polish-standard:14', 'POLISH_014'],
        canonicalRuleKey: 'polish/shadows-over-borders',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-elevation-shadow',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.optical-alignment',
        sourceRuleAliases: ['polish-standard:15', 'POLISH_015'],
        canonicalRuleKey: 'polish/optical-alignment',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-optical-alignment',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.typography-rhythm',
        sourceRuleAliases: ['polish-standard:16', 'POLISH_016'],
        canonicalRuleKey: 'polish/typography-rhythm',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-vertical-rhythm',
        evidenceRequirements: ['computed-style'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('computed-style'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        ruleId: 'polish.shadow-hierarchy',
        sourceRuleAliases: ['polish-standard:17', 'POLISH_017'],
        canonicalRuleKey: 'polish/shadow-hierarchy',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-shadow-hierarchy',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        // SEED (unchanged): id 19, critical -> blocker.
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
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.state-completeness',
        sourceRuleAliases: ['polish-standard:21', 'POLISH_021'],
        canonicalRuleKey: 'polish/state-completeness',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'polish',
        registryScope: 'polished-state-completeness',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'polish.anti-pattern-genericity',
        sourceRuleAliases: ['polish-standard:22', 'POLISH_022'],
        canonicalRuleKey: 'polish/anti-pattern-genericity',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'polished-genericity-floor',
        evidenceRequirements: ['dom'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('dom'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    // ============ owner static-a11y: 3 static/browser-backed here (+4 rendered a11y classes below = 7 total) ============
    {
        // SEED: id 18, css-rule blocker (the only required static-a11y rule).
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
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        // SEED: id 5, dom-only -> owned non-required -> inconclusive until P4b.
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
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('dom'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        // id 20. Stage 6 convergence: MIGRATED off the collector contrast probe onto the rendered scanner's
        // low-contrast finding - the SAME detector the eval harness scores (objective-rendered-scanner). This closes
        // the eval-only hole the one-engine audit found (low-contrast was the biggest objective class but had no live
        // consumer). Now rendered-scan-backed like its gray-on-color sibling: promoted-required when a renderUrl is
        // present (activateRenderedPolicy); inconclusive when no scan (fail-closed). The old collector contrast probe
        // is orphaned (no live rule reads ctx.contrast). DETECTION-PRESERVING for eval: the eval calls the scanner
        // directly, not the registry, so frozen-90 numbers are unchanged.
        ruleId: 'a11y.color-contrast',
        // rendered-scanner:low-contrast makes the scanner-emitted rule name resolvable to this rule, matching the
        // rendered-scanner:<name> alias every other rendered decision rule carries (Stage 3c consolidation). The
        // rendered scanner emits 'low-contrast'; checkLowContrast (rendered-checks.ts) drives THIS rule from it.
        sourceRuleAliases: ['polish-standard:20', 'POLISH_020', 'rendered-scanner:low-contrast'],
        canonicalRuleKey: 'a11y/color-contrast',
        ownerValidatorId: 'static-a11y',
        sourceVocabulary: 'polish-extended-antipattern',
        sourceSeverity: 'critical',
        severity: 'blocker',
        findingClass: 'a11y',
        registryScope: 'contrast-floor',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    // ====================== owner rendered-scan classes (Stage 1 convergence) ======================
    // Five NEW rendered-scan-backed rules driven by the live scan (scanRenderedLive) - the SAME detector logic the
    // eval harness runs, now in the live path. Each declares evidenceRequirements ['rendered-scan'] and is promoted
    // to required when a renderUrl is present (run-validator activateRenderedPolicy). These classes had ZERO live
    // detection before Stage 1 (pure additions, detection-preserving). a11y.color-contrast (above) is NOT among
    // them - its migration to the rendered engine is deferred to a later stage.
    {
        ruleId: 'a11y.broken-image',
        sourceRuleAliases: ['rendered-scanner:broken-image'],
        canonicalRuleKey: 'a11y/broken-image',
        ownerValidatorId: 'static-a11y',
        sourceVocabulary: 'rendered-scanner',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'a11y',
        registryScope: 'rendered-broken-image',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        ruleId: 'a11y.skipped-heading',
        sourceRuleAliases: ['rendered-scanner:skipped-heading'],
        canonicalRuleKey: 'a11y/heading-order',
        ownerValidatorId: 'static-a11y',
        sourceVocabulary: 'rendered-scanner',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'a11y',
        registryScope: 'rendered-heading-order',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        ruleId: 'a11y.gray-on-color',
        sourceRuleAliases: ['rendered-scanner:gray-on-color'],
        canonicalRuleKey: 'a11y/gray-on-color',
        ownerValidatorId: 'static-a11y',
        sourceVocabulary: 'rendered-scanner',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'a11y',
        registryScope: 'rendered-gray-on-color',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        ruleId: 'a11y.justified-text',
        sourceRuleAliases: ['rendered-scanner:justified-text'],
        canonicalRuleKey: 'a11y/justified-text',
        ownerValidatorId: 'static-a11y',
        sourceVocabulary: 'rendered-scanner',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'a11y',
        registryScope: 'rendered-justified-text',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        ruleId: 'polish.tiny-text',
        sourceRuleAliases: ['rendered-scanner:tiny-text'],
        canonicalRuleKey: 'polish/tiny-text',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'rendered-scanner',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'rendered-tiny-text',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        // Stage 5a (reimplement-and-own): the rendered-subjective marketing-buzzword detector, now driving the live
        // NL path too (same in-page logic the eval harness scores). findingClass 'polish' + owner 'polish-standard'
        // mirror tiny-text (the registry has no dedicated taste class; this is the closest existing slot for a
        // rendered taste finding). Precision-first operating point lives in subjective-rendered-scanner.ts.
        ruleId: 'polish.marketing-buzzword',
        sourceRuleAliases: ['rendered-scanner:marketing-buzzword'],
        canonicalRuleKey: 'polish/marketing-buzzword',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'rendered-scanner',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'rendered-marketing-buzzword',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    {
        // Stage 4a (taste rule-count delta): the rendered-subjective default-typeface detector - the page's
        // content text is not set in a typeface anyone chose (bare system/default stack, or a known committed
        // family that never reaches the content). findingClass 'polish' + owner 'polish-standard' mirror
        // tiny-text / marketing-buzzword (the registry has no dedicated taste class). The precision-first
        // operating point (DEFAULT_STACK_SHARE) lives in subjective-rendered-scanner.ts.
        ruleId: 'polish.default-typeface',
        sourceRuleAliases: ['rendered-scanner:default-typeface'],
        canonicalRuleKey: 'polish/default-typeface',
        ownerValidatorId: 'polish-standard',
        sourceVocabulary: 'rendered-scanner',
        sourceSeverity: 'medium',
        severity: 'minor',
        findingClass: 'polish',
        registryScope: 'rendered-default-typeface',
        evidenceRequirements: ['rendered-scan'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('rendered-scan'),
        scope: 'component',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'inconclusive',
    },
    // ============ owner forms: absorbed FORMS rules (Stage 2 convergence) ============
    // The 5 highest-signal forms-a11y rules absorbed from ExtendedDomainValidator's FORMS_* (the one genuinely-real
    // domain it owned; the other ~190 rules were theater/redundant and are retired). Markup-evidence, scope:project
    // (reason over the assembled page markup), N/A when the page has no form controls. Reimplemented registry-quality
    // (forms-checks.ts), not the verbatim global-haystack regex. Aliases keep the old FORMS_NNN ids resolvable.
    {
        ruleId: 'a11y.form-control-labelled',
        sourceRuleAliases: ['extended-domain:FORMS_016', 'FORMS_016'],
        canonicalRuleKey: 'a11y/form-control-labelled',
        ownerValidatorId: 'forms',
        sourceVocabulary: 'extended-domain',
        sourceSeverity: 'critical',
        severity: 'blocker',
        findingClass: 'a11y',
        registryScope: 'forms-labelling',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'project',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'a11y.form-error-association',
        sourceRuleAliases: ['extended-domain:FORMS_018', 'FORMS_018'],
        canonicalRuleKey: 'a11y/form-error-association',
        ownerValidatorId: 'forms',
        sourceVocabulary: 'extended-domain',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'a11y',
        registryScope: 'forms-error-association',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'project',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'a11y.form-placeholder-not-label',
        sourceRuleAliases: ['extended-domain:FORMS_019', 'FORMS_019'],
        canonicalRuleKey: 'a11y/form-placeholder-not-label',
        ownerValidatorId: 'forms',
        sourceVocabulary: 'extended-domain',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'a11y',
        registryScope: 'forms-placeholder',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'project',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'a11y.form-input-type',
        sourceRuleAliases: ['extended-domain:FORMS_002', 'FORMS_002'],
        canonicalRuleKey: 'a11y/form-input-type',
        ownerValidatorId: 'forms',
        sourceVocabulary: 'extended-domain',
        sourceSeverity: 'high',
        severity: 'minor',
        // DELIBERATE downgrade from the legacy FORMS_002 'high'/major (Codex P1): a bare type="text" where a typed
        // input belongs is a keyboard/validation UX hint, not a blocking accessibility failure - it should advise,
        // not gate convergence. Provenance kept as sourceSeverity 'high'; the override documents the intent.
        severityOverrideReason: 'input-type is a UX keyboard/validation hint, not a blocking a11y failure; advisory-not-gating by design',
        findingClass: 'a11y',
        registryScope: 'forms-input-type',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'project',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'a11y.form-choice-label-target',
        sourceRuleAliases: ['extended-domain:FORMS_015', 'FORMS_015'],
        canonicalRuleKey: 'a11y/form-choice-label-target',
        ownerValidatorId: 'forms',
        sourceVocabulary: 'extended-domain',
        sourceSeverity: 'high',
        severity: 'major',
        findingClass: 'a11y',
        registryScope: 'forms-choice-target',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'project',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    // forms batch 2 (FORMS_001/003/004/005/007/008/009/011/014/017/020). Weaker keyword-presence proxies stay
    // non-blocking (minor/advisory); strong markup checks (paste-block, inline-errors, autocomplete) are major.
    { ruleId: 'a11y.form-autocomplete', sourceRuleAliases: ['extended-domain:FORMS_001', 'FORMS_001'], canonicalRuleKey: 'a11y/form-autocomplete', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'forms-autocomplete', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-inputmode', sourceRuleAliases: ['extended-domain:FORMS_003', 'FORMS_003'], canonicalRuleKey: 'a11y/form-inputmode', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'forms-inputmode', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-never-block-paste', sourceRuleAliases: ['extended-domain:FORMS_004', 'FORMS_004'], canonicalRuleKey: 'a11y/form-never-block-paste', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'forms-paste', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-spellcheck-off', sourceRuleAliases: ['extended-domain:FORMS_005', 'FORMS_005'], canonicalRuleKey: 'a11y/form-spellcheck-off', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'forms-spellcheck', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-idempotent-submit', sourceRuleAliases: ['extended-domain:FORMS_007', 'FORMS_007'], canonicalRuleKey: 'a11y/form-idempotent-submit', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'forms-idempotent-submit', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-inline-errors', sourceRuleAliases: ['extended-domain:FORMS_008', 'FORMS_008'], canonicalRuleKey: 'a11y/form-inline-errors', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'major', findingClass: 'a11y', registryScope: 'forms-inline-errors', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-focus-first-error', sourceRuleAliases: ['extended-domain:FORMS_009', 'FORMS_009'], canonicalRuleKey: 'a11y/form-focus-first-error', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'minor', severityOverrideReason: 'detected via keyword-presence proxy (focus/setFocus/scrollIntoView near error); advisory-not-gating until a stronger signal exists', findingClass: 'a11y', registryScope: 'forms-focus-first-error', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-no-pm-non-auth', sourceRuleAliases: ['extended-domain:FORMS_011', 'FORMS_011'], canonicalRuleKey: 'a11y/form-no-pm-non-auth', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'forms-no-pm', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-textarea-submit', sourceRuleAliases: ['extended-domain:FORMS_014', 'FORMS_014'], canonicalRuleKey: 'a11y/form-textarea-submit', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'forms-textarea-submit', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-no-pre-disable-submit', sourceRuleAliases: ['extended-domain:FORMS_017', 'FORMS_017'], canonicalRuleKey: 'a11y/form-no-pre-disable-submit', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'forms-no-pre-disable', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.form-autofocus-sparingly', sourceRuleAliases: ['extended-domain:FORMS_020', 'FORMS_020'], canonicalRuleKey: 'a11y/form-autofocus-sparingly', ownerValidatorId: 'forms', sourceVocabulary: 'extended-domain', sourceSeverity: 'low', severity: 'advisory', findingClass: 'a11y', registryScope: 'forms-autofocus', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    // ============ owner page-quality: the genuinely-strong DOM-evidence Tier-2 keepers (Stage 2 convergence) ============
    // Cherry-picked from ExtendedDomainValidator's Tier-2 set; the rest (JS-keyword proxies, always-pass, NLP
    // heuristics) were RETIRED with the theater. All non-blocking (minor) quality advisories - they advise, not
    // gate - and N/A when their target element is absent. DOM-visible evidence only (img attrs / CSS props / aria).
    { ruleId: 'perf.image-dimensions', sourceRuleAliases: ['extended-domain:IMGPERF_001', 'IMGPERF_001'], canonicalRuleKey: 'perf/image-dimensions', ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: 'high', severity: 'major', findingClass: 'polish', registryScope: 'pq-image-dimensions', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'perf.image-lazy-load', sourceRuleAliases: ['extended-domain:IMGPERF_002', 'IMGPERF_002'], canonicalRuleKey: 'perf/image-lazy-load', ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'polish', registryScope: 'pq-image-lazy', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'polish.text-overflow-strategy', sourceRuleAliases: ['extended-domain:CONTENT_002', 'CONTENT_002'], canonicalRuleKey: 'polish/text-overflow-strategy', ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'polish', registryScope: 'pq-text-overflow', evidenceRequirements: ['css-rule'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'theming.color-scheme-dark', sourceRuleAliases: ['extended-domain:DARKMODE_001', 'DARKMODE_001'], canonicalRuleKey: 'theming/color-scheme-dark', ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'theming', registryScope: 'pq-color-scheme', evidenceRequirements: ['css-rule'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.chart-text-fallback', sourceRuleAliases: ['extended-domain:CHART_003', 'CHART_003'], canonicalRuleKey: 'a11y/chart-text-fallback', ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'pq-chart-fallback', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    { ruleId: 'a11y.button-label-specific', sourceRuleAliases: ['extended-domain:COPY_003', 'COPY_003'], canonicalRuleKey: 'a11y/button-label-specific', ownerValidatorId: 'page-quality', sourceVocabulary: 'extended-domain', sourceSeverity: 'medium', severity: 'minor', findingClass: 'a11y', registryScope: 'pq-button-label', evidenceRequirements: ['markup'], supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'), scope: 'project', narrowTargetBehavior: 'evaluate_expanded_context', applicability: 'not_applicable' },
    // ====================== owner theming (2) ======================
    {
        // SEED: taste/hex-in-interactive-state, error -> blocker.
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
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'theming.border-radius-consistency',
        sourceRuleAliases: ['taste/border-radius-inconsistency'],
        canonicalRuleKey: 'theming/border-radius-consistency',
        ownerValidatorId: 'theming',
        sourceVocabulary: 'taste',
        sourceSeverity: 'error',
        severity: 'blocker',
        findingClass: 'theming',
        registryScope: 'token-consistency',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    // ====================== owner anti-pattern (5) ======================
    {
        // SEED: gradient-text, P1 -> major (precise CSS detector, blocking).
        ruleId: 'anti-pattern.gradient-text',
        sourceRuleAliases: ['gradient-text'],
        canonicalRuleKey: 'anti-pattern/gradient-text',
        ownerValidatorId: 'anti-pattern',
        sourceVocabulary: 'p012',
        sourceSeverity: 'P1',
        severity: 'major',
        findingClass: 'anti-pattern',
        registryScope: 'named-ban-compliance',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'anti-pattern.glassmorphism-default',
        sourceRuleAliases: ['glassmorphism-default'],
        canonicalRuleKey: 'anti-pattern/glassmorphism-default',
        ownerValidatorId: 'anti-pattern',
        sourceVocabulary: 'p012',
        sourceSeverity: 'P1',
        severity: 'major',
        findingClass: 'anti-pattern',
        registryScope: 'named-ban-compliance',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        ruleId: 'anti-pattern.side-stripe-borders',
        sourceRuleAliases: ['side-stripe-borders'],
        canonicalRuleKey: 'anti-pattern/side-stripe-borders',
        ownerValidatorId: 'anti-pattern',
        sourceVocabulary: 'p012',
        sourceSeverity: 'P1',
        severity: 'major',
        findingClass: 'anti-pattern',
        registryScope: 'named-ban-compliance',
        evidenceRequirements: ['css-rule'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('css-rule'),
        scope: 'file',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    // (anti-pattern.identical-card-grids registry entry DELETED Stage-2 2026-06-24 with its scanner - ReDoS +
    // low-precision over-firing; no replacement.)
    {
        ruleId: 'anti-pattern.hero-metric-template',
        sourceRuleAliases: ['hero-metric-template'],
        canonicalRuleKey: 'anti-pattern/hero-metric-template',
        ownerValidatorId: 'anti-pattern',
        sourceVocabulary: 'p012',
        sourceSeverity: 'P1',
        severity: 'minor',
        severityOverrideReason: STRUCTURAL_OVERRIDE_REASON,
        findingClass: 'anti-pattern',
        registryScope: 'named-ban-compliance',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'project',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
    {
        // P2 -> minor (table default; heuristic but no override needed).
        ruleId: 'anti-pattern.modal-as-first-thought',
        sourceRuleAliases: ['modal-as-first-thought'],
        canonicalRuleKey: 'anti-pattern/modal-as-first-thought',
        ownerValidatorId: 'anti-pattern',
        sourceVocabulary: 'p012',
        sourceSeverity: 'P2',
        severity: 'minor',
        findingClass: 'anti-pattern',
        registryScope: 'named-ban-compliance',
        evidenceRequirements: ['markup'],
        supportedSourceKinds: (0, source_support_matrix_1.supportedKindsFor)('markup'),
        scope: 'project',
        narrowTargetBehavior: 'evaluate_expanded_context',
        applicability: 'not_applicable',
    },
];
// Attach the four-status checkProduct to every definition. The wrapper looks up the
// verdict fn by canonicalRuleKey, stamps per-rule metadata from the definition, and
// CATCHES a throwing rule check as inconclusive + rule_exception (spec 479-483). The
// generated file is unaffected: deriveValidator reads identity/owner fields and
// JSON.stringify drops functions.
exports.RULES = RAW_RULES.map((def) => ({
    ...def,
    checkProduct: (context) => {
        const fn = checks_1.CHECKS[def.canonicalRuleKey] ?? checks_1.missingCheck;
        try {
            return (0, check_context_1.stampResult)(def, fn(context));
        }
        catch (e) {
            return (0, check_context_1.stampResult)(def, {
                status: 'inconclusive',
                message: `rule check threw: ${String(e instanceof Error ? e.message : e)}`.slice(0, 200),
                normalizedErrorCategory: 'rule_exception',
            });
        }
    },
}));
function getRule(canonicalRuleKey) {
    return exports.RULES.find((r) => r.canonicalRuleKey === canonicalRuleKey) ?? null;
}
function getRuleById(ruleId) {
    return exports.RULES.find((r) => r.ruleId === ruleId) ?? null;
}
function resolveSourceAlias(sourceId) {
    return exports.RULES.find((r) => r.sourceRuleAliases.includes(sourceId)) ?? null;
}
// The blocking severity set the rendered audit maps a canonical severity to blocking|warning through. It is the
// SAME set every generated validator carries (validator-generation BLOCKING), so a rendered rule's blocking-ness
// matches the severity the registry authored for it.
const RENDERED_BLOCKING_SEVERITIES = ['blocker', 'major'];
const RENDERED_RULE_MANIFEST = [
    // objective lens (WCAG / rendered quality) - each consumes a validator-owned static-a11y rule.
    { scannerRule: 'broken-image', lens: 'objective', ruleId: 'a11y.broken-image' },
    { scannerRule: 'skipped-heading', lens: 'objective', ruleId: 'a11y.skipped-heading' },
    { scannerRule: 'low-contrast', lens: 'objective', ruleId: 'a11y.color-contrast' },
    { scannerRule: 'gray-on-color', lens: 'objective', ruleId: 'a11y.gray-on-color' },
    { scannerRule: 'justified-text', lens: 'objective', ruleId: 'a11y.justified-text' },
    // subjective lens (taste) - three consume a validator-owned polish-standard rule; nested-cards is audit-only.
    { scannerRule: 'tiny-text', lens: 'subjective', ruleId: 'polish.tiny-text' },
    { scannerRule: 'marketing-buzzword', lens: 'subjective', ruleId: 'polish.marketing-buzzword' },
    { scannerRule: 'default-typeface', lens: 'subjective', ruleId: 'polish.default-typeface' },
    {
        scannerRule: 'nested-cards', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-nested-cards',
        note: 'card-in-card taste finding surfaced by the audit/subjective lens; no run-validator consumer (audit-only)',
    },
    // Stage 4b typographic-extreme classes - all AUDIT-ONLY (ruleId:null), for the same reason as nested-cards:
    // modeling any as a rendered-scan RAW_RULE trips the inverse invariant -> RENDERED_BACKED_RULE_IDS -> run-validator
    // would newly consume it as a required decision rule. These are precision-first taste rules whose A5a gate is
    // PENDING, so that promotion is not intended. Their frozen operating points live in subjective-rendered-scanner.ts.
    {
        scannerRule: 'extreme-negative-tracking', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-extreme-negative-tracking',
        note: 'letter-spacing crowded strongly negative on a share of content text; audit-only (A5a pending)',
    },
    {
        scannerRule: 'tight-leading', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-tight-leading',
        note: 'line-height on running body text set tight enough to crowd; audit-only (A5a pending)',
    },
    {
        scannerRule: 'all-caps-body', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-all-caps-body',
        note: 'long runs of body/content text set all-caps (slows reading); audit-only (A5a pending)',
    },
    {
        scannerRule: 'oversized-h1', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-oversized-h1',
        note: 'h1 rendered font-size beyond a taste threshold vs the viewport; audit-only (A5a pending)',
    },
    {
        scannerRule: 'sub-11px-ui', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-sub-11px-ui',
        note: 'a substantial body of interface text rendered below the legibility floor; audit-only (A5a pending)',
    },
    // Stage 4c structural taste classes - all AUDIT-ONLY (ruleId:null), same reason as nested-cards / the 4b set:
    // modeling any as a rendered-scan RAW_RULE trips the inverse invariant -> RENDERED_BACKED_RULE_IDS -> run-validator
    // would newly consume it as a required decision rule. Precision-first taste rules whose A5a gate is PENDING, so
    // that promotion is not intended. Frozen operating points live in subjective-rendered-scanner.ts.
    {
        scannerRule: 'thin-border-wide-shadow', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-thin-border-wide-shadow',
        note: 'a hairline border under a wide-spread shadow (muddy double-elevation); audit-only (A5a pending)',
    },
    {
        scannerRule: 'repeating-stripe-gradients', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-repeating-stripe-gradients',
        note: 'a repeating / many-hard-stop linear-gradient striped background; audit-only (A5a pending)',
    },
    {
        scannerRule: 'text-under-overlay', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-text-under-overlay',
        note: 'content text over a translucent scrim layered on a background image (structure, not measured contrast); audit-only (A5a pending)',
    },
    {
        scannerRule: 'first-viewport-overflow', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-first-viewport-overflow',
        note: 'a viewport-height top section that clips content overflowing the first screen; audit-only (A5a pending)',
    },
    {
        scannerRule: 'decorative-dot-grid', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-decorative-dot-grid',
        note: 'a small-tiled radial/grid decorative background field; audit-only (A5a pending)',
    },
    {
        scannerRule: 'soft-radial-glow', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-soft-radial-glow',
        note: 'a large soft radial-gradient glow / heavy-blur decorative blob; audit-only (A5a pending)',
    },
    {
        scannerRule: 'image-hover-transform', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-image-hover-transform',
        note: 'a :hover rule transforming an image (hover zoom/slide); audit-only (A5a pending)',
    },
    // Stage 4d detectable motion/marker classes - AUDIT-ONLY (ruleId:null), same invariant reasoning; A5a PENDING.
    {
        scannerRule: 'marquee', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-marquee',
        note: 'a <marquee> element or an infinite horizontal-scroll (CSS marquee) animation; audit-only (A5a pending)',
    },
    {
        scannerRule: 'blinking-cursor', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-blinking-cursor',
        note: 'an infinite opacity/visibility blink animation; audit-only (A5a pending)',
    },
    {
        scannerRule: 'numbered-section-markers', lens: 'subjective', ruleId: null,
        severity: 'minor', findingClass: 'polish', registryScope: 'rendered-numbered-section-markers',
        note: 'prominent decorative section numerals (01/02/03) as an organizing motif; audit-only (A5a pending)',
    },
];
// Resolve a rendered SCANNER rule name to its registry descriptor. Returns null for a name the manifest does not
// cover (the no-orphan test forbids that for any real scanner rule; a caller that still hits null must fall back
// to its own honest default rather than treat the finding as absent).
function resolveRenderedRule(scannerRule) {
    const entry = RENDERED_RULE_MANIFEST.find((m) => m.scannerRule === scannerRule);
    if (!entry)
        return null;
    if (entry.ruleId) {
        const def = getRuleById(entry.ruleId);
        if (!def)
            return null; // manifest points at a rule that no longer exists - surfaced by the no-orphan test
        return {
            scannerRule: entry.scannerRule, lens: entry.lens, ruleId: def.ruleId, canonicalRuleKey: def.canonicalRuleKey,
            severity: def.severity, blocking: (0, product_rule_types_1.isBlocking)(def.severity, RENDERED_BLOCKING_SEVERITIES),
            findingClass: def.findingClass, registryScope: def.registryScope, source: 'validator-owned',
        };
    }
    return {
        scannerRule: entry.scannerRule, lens: entry.lens, ruleId: null, canonicalRuleKey: null,
        severity: entry.severity, blocking: (0, product_rule_types_1.isBlocking)(entry.severity, RENDERED_BLOCKING_SEVERITIES),
        findingClass: entry.findingClass, registryScope: entry.registryScope, source: 'audit-only',
    };
}
// Every rendered scanner rule name the registry knows about (the manifest's key set), for a completeness cross-check.
function renderedScannerRules() {
    return RENDERED_RULE_MANIFEST.map((m) => m.scannerRule);
}
// The full resolved rendered manifest, for enumeration (--list-rules) and the no-orphan test.
function listRenderedManifest() {
    return RENDERED_RULE_MANIFEST
        .map((m) => resolveRenderedRule(m.scannerRule))
        .filter((r) => r !== null);
}
//# sourceMappingURL=product-rule-registry.js.map