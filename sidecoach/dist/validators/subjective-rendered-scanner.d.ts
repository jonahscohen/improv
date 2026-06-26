import type { Browser } from 'playwright';
export type SubjectiveRule = 'tiny-text' | 'nested-cards' | 'marketing-buzzword';
export interface SubjectiveFinding {
    rule: SubjectiveRule;
    severity: 'warning';
    selector?: string;
    detail?: string;
}
export type SubjectiveScan = {
    available: true;
    findings: SubjectiveFinding[];
} | {
    available: false;
    reason: string;
};
export declare const SUBJECTIVE_RULES: SubjectiveRule[];
export declare function stripScripts(html: string): string;
export declare function inPageSubjective(): SubjectiveFinding[];
export interface BuzzwordScore {
    density: number;
    effectiveDensity: number;
    words: number;
    weighted: number;
    distinctTerms: number;
    hasStrongOrPeak: boolean;
    matched: string[];
    selector?: string;
}
/**
 * marketing-buzzword (v2): the SINGLE SOURCE of the buzzword taxonomy + weighted-density computation, serialized
 * into the browser by page.evaluate. Returns the SCORE only - the firing THRESHOLD (BUZZ_DENSITY_THRESHOLD) is
 * applied in Node by BOTH the production scan (buzzwordFindingFromScore) AND the calibration harness, so the harness
 * sweeps EXACTLY what ships (no reimplementation - the integrity fix).
 *
 * The page LEANS on generic marketing buzzwords rather than concrete specifics - a HOLISTIC density over the content
 * copy (v1's tight prominent-cluster overfit a homogeneous corpus and collapsed on the diverse held-out). SCOPE =
 * all VISIBLE, non-peripheral content text, EXCLUDING testimonial/quote/review/case-study regions (customer social
 * proof != the brand's own copy). SCORE = (sum of VACUITY-tier weights over ALL occurrences) / content_words * 100,
 * tiers PEAK 4 / STRONG 2 / MILD 0.5 (v3 reweight). WHY vacuity-weighting: v2's FP mode (frozen p=0.333) = pages
 * that USE marketing vocabulary CONCRETELY (nasa "groundbreaking discoveries" = real science; onepassword "powerful
 * security" = a real feature) rather than leaning on empty fluff. The dev-FP analysis showed the FPs fire on
 * concrete-prone STRONG/MILD words (modern/advanced/enterprise-grade/ai-powered) with ~0 pure-hype PEAK terms (FP
 * peak=0.33 vs TP peak=1.36), while the TP fluff leans on PEAK clichés (seamless/supercharge/revolution/world-class).
 * So PEAK (content-free hype, impossible to use concretely) is upweighted and the concrete-prone MILD tier is
 * heavily discounted. QUALIFY guard (precision): a page firing WITHOUT any pure-hype/strong term (MILD-only product
 * descriptors) is not "leaning on buzzwords" - require >=1 STRONG/PEAK term. Each term is a bounded regex matched
 * with non-consuming lookarounds (counts ALL occurrences incl. adjacent repeats) - linear, ReDoS-safe.
 */
export declare function inPageBuzzword(): BuzzwordScore;
export declare const BUZZ_DENSITY_THRESHOLD = 0.75;
/** Node-side: turn a buzzword score into a marketing-buzzword finding (or null). The ONE place the production
 * threshold is applied; the calibration harness sweeps the same effectiveDensity. */
export declare function buzzwordFindingFromScore(s: BuzzwordScore): SubjectiveFinding | null;
export interface RenderOpts {
    stripScripts?: boolean;
    abortExternal?: boolean;
    viewport?: {
        width: number;
        height: number;
    };
}
export declare function analyzeHtmlOnBrowserSubjective(browser: Browser, html: string, timeoutMs?: number, render?: RenderOpts): Promise<SubjectiveFinding[]>;
export interface ScanOptions {
    timeoutMs?: number;
    launcher?: () => Promise<Browser>;
    render?: RenderOpts;
}
/** Render an HTML string deterministically and return subjective findings. FAIL-CLOSED: a launch/render error or
 * timeout returns { available:false } - never a false "clean". */
export declare function scanSubjectiveRendered(html: string, opts?: ScanOptions): Promise<SubjectiveScan>;
//# sourceMappingURL=subjective-rendered-scanner.d.ts.map