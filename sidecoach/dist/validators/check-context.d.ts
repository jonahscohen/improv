import type { ProductRuleDefinition, ProductRuleResult, RuleStatus, EvidenceKind, NormalizedErrorCategory } from '../product-rule-types';
export interface CollectedFile {
    path: string;
    sourceKind: string;
    cssText: string;
    markup: string;
    evidenceKindsPresent: string[];
}
export type CollectionOutcome = 'inspected' | 'policy_skipped' | 'unreadable' | 'oversized' | 'unsupported';
export interface DiscoveredFile {
    path: string;
    sourceKind: string;
    outcome: CollectionOutcome;
    reason?: string;
}
export interface BrowserDomEvidence {
    minHitArea: {
        checked: number;
        failing: number;
        smallestWidth: number;
        smallestHeight: number;
    };
}
export interface BrowserEvidenceMeta {
    available: true;
    kinds: EvidenceKind[];
    renderUrl: string;
}
export interface ProductCheckContext {
    cssText: string;
    markup: string;
    files: CollectedFile[];
    discoveredFiles?: DiscoveredFile[];
    computedStyle?: Record<string, string>;
    contrast?: {
        wcagAA: boolean;
        ratio: number;
    };
    designTokens?: Record<string, unknown>;
    tasteOptions?: {
        tailwindDetected?: boolean;
        componentsJson?: boolean;
    };
    renderUrl?: string;
    browserEvidence?: BrowserEvidenceMeta;
    dom?: BrowserDomEvidence;
}
export interface RuleVerdict {
    status: RuleStatus;
    message: string;
    evidenceLocations?: string[];
    remediation?: string;
    normalizedErrorCategory?: NormalizedErrorCategory;
    evidenceKind?: EvidenceKind;
}
export declare const pass: (message: string, evidenceLocations?: string[]) => RuleVerdict;
export declare const fail: (message: string, evidenceLocations?: string[], remediation?: string) => RuleVerdict;
export declare const notApplicable: (message: string) => RuleVerdict;
export declare const inconclusive: (message: string, category?: NormalizedErrorCategory) => RuleVerdict;
export declare const hasCss: (ctx: ProductCheckContext) => boolean;
export declare const hasMarkup: (ctx: ProductCheckContext) => boolean;
export declare const hasTrustedBrowserEvidence: (ctx: ProductCheckContext, kind: EvidenceKind) => boolean;
export declare const browserNumber: (ctx: ProductCheckContext, key: string) => number | undefined;
export declare function stampResult(def: ProductRuleDefinition, v: RuleVerdict): ProductRuleResult;
export type Applicability = true | false | 'unknown';
export declare const interactiveTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const iconTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const imageTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const transitionTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const tabularTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const headingTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const motionTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const rootStyleApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const framerApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const willChangeApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const shadowTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const opticalTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare const focusableTargetApplicability: (ctx: ProductCheckContext) => Applicability;
export declare function withRuleApplicability(canonicalRuleKey: string, rawCheck: (ctx: ProductCheckContext) => RuleVerdict): (ctx: ProductCheckContext) => RuleVerdict;
//# sourceMappingURL=check-context.d.ts.map