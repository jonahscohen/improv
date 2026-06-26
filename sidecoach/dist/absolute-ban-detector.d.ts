/**
 * Absolute Ban Detector
 *
 * Operationalizes the 6 absolute bans from the absorbed legacy-design-skill
 * reference (now exposed by reference-loader as loadAbsoluteBans). Pre-wiring
 * these bans existed as descriptive strings in design-laws.ts but no validator
 * actually scanned project files for the patterns. This module scans CSS +
 * HTML in a project directory and produces findings.
 *
 * Coverage by ban:
 *
 * - side-stripe-borders: CSS scan for `border-left|border-right > 1px solid <colored>` on cards/lists/callouts/alerts
 * - gradient-text: CSS scan for `background-clip: text` combined with `linear-gradient` or `radial-gradient`
 * - glassmorphism-default: CSS scan for `backdrop-filter: blur(...)` combined with low-alpha rgba/hsla background
 * - identical-card-grids: HTML scan for grid container with >=3 children of the same class containing the same structural triplet (icon/svg + heading + paragraph)
 * - hero-metric-template: HTML scan for a parent with >=3 children each containing a large-numeric child + small-label child
 * - modal-as-first-thought: HTML scan for <dialog> or [role="dialog"] containing forms/menus that could be inline
 *
 * The CSS-side detectors are precise. The HTML-structural detectors are
 * heuristic - they flag pattern shapes, not certainties. P1 by default
 * because false positives are possible.
 */
export type BanFindingSeverity = 'P0' | 'P1' | 'P2';
export interface AbsoluteBanFinding {
    severity: BanFindingSeverity;
    banName: string;
    file: string;
    line?: number;
    matchedText: string;
    reason: string;
    rewriteOptions: string[];
}
export interface AbsoluteBanReport {
    scannedFiles: number;
    findings: AbsoluteBanFinding[];
    summary: string;
}
export declare function scanSideStripeBorders(content: string, file: string): AbsoluteBanFinding[];
export declare function scanGradientText(content: string, file: string): AbsoluteBanFinding[];
export declare function scanGlassmorphism(content: string, file: string): AbsoluteBanFinding[];
export declare function scanHeroMetricTemplate(content: string, file: string): AbsoluteBanFinding[];
export declare function scanModalAsFirstThought(content: string, file: string): AbsoluteBanFinding[];
export declare function scanForAbsoluteBans(projectPath: string): AbsoluteBanReport;
/**
 * Adapter: convert an AbsoluteBanReport into the BuildReport's ValidationResult
 * shape so the BuildReport aggregator produces an "anti-patterns" domain
 * letter grade. Mirrors PolishStandardValidator.toValidationResult().
 */
export declare function absoluteBanToValidationResult(report: AbsoluteBanReport): {
    domain: 'anti-patterns';
    status: 'pass' | 'fail' | 'partial';
    passedRules: string[];
    failedRules: string[];
    message: string;
};
export declare function banFindingsToGuidance(report: AbsoluteBanReport): string[];
//# sourceMappingURL=absolute-ban-detector.d.ts.map