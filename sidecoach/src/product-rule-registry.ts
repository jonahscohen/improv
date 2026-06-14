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
  //    The alias is the RAW banName the live detector emits (no prefix):
  //    findingFromBan('gradient-text', ...) at absolute-ban-detector.ts:110.
  {
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
  //    The alias is the RAW banName the live detector emits (no prefix):
  //    findingFromBan('identical-card-grids', ...) at absolute-ban-detector.ts:159.
  {
    ruleId: 'anti-pattern.identical-card-grids',
    sourceRuleAliases: ['identical-card-grids'],
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
