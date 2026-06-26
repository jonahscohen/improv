export type CanonicalSeverity = 'blocker' | 'major' | 'minor' | 'advisory';
export type NormalizedErrorCategory = 'unreadable_input' | 'registry_fault' | 'validator_exception' | 'rule_exception' | 'timeout' | 'aborted' | 'unsupported_runtime' | 'other';
export type RuleStatus = 'pass' | 'fail' | 'not_applicable' | 'inconclusive';
export type EvidenceKind = 'css-rule' | 'computed-style' | 'dom' | 'markup' | 'contrast' | 'rendered-scan';
export type RuleScope = 'file' | 'component' | 'page' | 'project';
export type SourceVocabulary = 'polish-extended-antipattern' | 'p012' | 'taste' | 'rendered-scanner' | 'extended-domain';
export interface SourceKindSupport {
    kind: string;
    level: 'full' | 'partial' | 'none';
}
export interface ProductRuleDefinition {
    ruleId: string;
    sourceRuleAliases: string[];
    canonicalRuleKey: string;
    ownerValidatorId: string;
    sourceVocabulary: SourceVocabulary;
    sourceSeverity: string;
    severity: CanonicalSeverity;
    severityOverrideReason?: string;
    findingClass: string;
    registryScope: string;
    evidenceRequirements: EvidenceKind[];
    supportedSourceKinds: SourceKindSupport[];
    scope: RuleScope;
    narrowTargetBehavior: 'evaluate_expanded_context' | 'exclude_and_disclose' | 'reject_target';
    applicability: 'not_applicable' | 'inconclusive';
    checkProduct?: (context: unknown) => ProductRuleResult;
}
export interface ProductRuleResult {
    ruleId: string;
    canonicalRuleKey: string;
    status: RuleStatus;
    normalizedErrorCategory?: NormalizedErrorCategory;
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
    evidenceAlternativesByRequirement: string[][];
    requireAllDiscoveredApplicableFiles: boolean;
}
export interface CleanPolicy {
    requiredRuleIds: string[];
    blockingSeverities: CanonicalSeverity[];
    toleratedFindingCounts: Record<string, number>;
    requiredCoverageByScope: RequiredCoverageRecord[];
    inconclusiveBehavior: 'block';
    notApplicableBehavior: 'exclude_and_report';
}
export interface ProductValidationCoverage {
    inspectedFiles: string[];
    skippedFiles: string[];
    supportedSourceKinds: string[];
    unsupportedSourceKinds: string[];
    ruleCounts: {
        pass: number;
        fail: number;
        notApplicable: number;
        inconclusive: number;
    };
    findingCounts: {
        blockingExcess: number;
        withinTolerance: number;
        nonBlocking: number;
    };
    measuredScope: string[];
    unverifiedScope: string[];
    discoveredFiles?: string[];
    unreadableFiles?: string[];
    unsupportedFiles?: string[];
}
interface ProductValidationBase {
    rules: ProductRuleResult[];
    findings: ProductFinding[];
    coverage: ProductValidationCoverage;
}
export interface ProductValidationOk extends ProductValidationBase {
    status: 'clean' | 'findings' | 'inconclusive';
}
export interface ProductValidationError extends ProductValidationBase {
    status: 'error';
    normalizedErrorCategory: NormalizedErrorCategory;
    error: string;
}
export type ProductValidationResult = ProductValidationOk | ProductValidationError;
export declare function isBlocking(sev: CanonicalSeverity, blocking: CanonicalSeverity[]): boolean;
export declare const SEVERITY_TABLE: Record<string, CanonicalSeverity>;
export declare const EVIDENCE_SOURCE_COMPATIBILITY: Record<EvidenceKind, string[]>;
export declare function sourceKindsForEvidence(reqs: EvidenceKind[]): string[];
export declare function isStaticallySatisfiable(reqs: EvidenceKind[]): boolean;
export {};
//# sourceMappingURL=product-rule-types.d.ts.map