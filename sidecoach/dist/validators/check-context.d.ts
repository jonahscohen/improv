import type { ProductRuleDefinition, ProductRuleResult, RuleStatus, EvidenceKind, NormalizedErrorCategory } from '../product-rule-types';
import type { RenderedScanCollection } from './rendered-live-scan';
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
    renderedScan?: RenderedScanCollection;
}
export interface RuleVerdict {
    status: RuleStatus;
    message: string;
    evidenceLocations?: string[];
    /** See ProductRuleResult.locationKind. Defaults to 'defect' when locations are supplied
     *  by a check directly; the applicability wrapper stamps 'anchor' when it fills them in. */
    locationKind?: 'defect' | 'anchor';
    remediation?: string;
    normalizedErrorCategory?: NormalizedErrorCategory;
    evidenceKind?: EvidenceKind;
}
export declare const pass: (message: string, evidenceLocations?: string[]) => RuleVerdict;
/** A check calling fail() with locations is pointing at the DEFECT itself. Absence findings
 *  leave locations empty and let withRuleApplicability fill in the anchor. */
export declare const fail: (message: string, evidenceLocations?: string[], remediation?: string) => RuleVerdict;
/** fail() for an ABSENCE finding whose locations are the FIX SITE, not the defect. Use this
 *  whenever nothing at the reported line is itself wrong. */
export declare const failAnchor: (message: string, evidenceLocations?: string[], remediation?: string) => RuleVerdict;
export declare const notApplicable: (message: string) => RuleVerdict;
export declare const inconclusive: (message: string, category?: NormalizedErrorCategory) => RuleVerdict;
export declare const hasCss: (ctx: ProductCheckContext) => boolean;
export declare const hasMarkup: (ctx: ProductCheckContext) => boolean;
export declare const hasTrustedBrowserEvidence: (ctx: ProductCheckContext, kind: EvidenceKind) => boolean;
export declare const browserNumber: (ctx: ProductCheckContext, key: string) => number | undefined;
export declare function stampResult(def: ProductRuleDefinition, v: RuleVerdict): ProductRuleResult;
export type Applicability = true | false | 'unknown';
export declare const INTERACTIVE_RE: RegExp;
export declare const ICON_RE: RegExp;
export declare const IMAGE_RE: RegExp;
export declare const HEADING_RE: RegExp;
export declare const MOTION_RE: RegExp;
export declare const ROOT_TARGET_RE: RegExp;
export declare const SHADOW_TARGET_RE: RegExp;
export declare const OPTICAL_TARGET_RE: RegExp;
export declare const FOCUSABLE_RE: RegExp;
export declare const TABULAR_TARGET_RE: RegExp;
export declare const TRANSITION_TARGET_RE: RegExp;
export declare const FRAMER_TARGET_RE: RegExp;
export declare const WILL_CHANGE_TARGET_RE: RegExp;
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