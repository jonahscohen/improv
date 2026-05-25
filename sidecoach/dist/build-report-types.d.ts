export type ShipVerdict = 'clean' | 'warnings-only' | 'blocked';
export type LetterGrade = 'A' | 'B' | 'C' | 'D' | 'F';
export interface SeverityCounts {
    blocking: number;
    warning: number;
    info: number;
}
export interface DomainGrade {
    domain: string;
    passRate: number;
    letter: LetterGrade;
    rulesPassed: number;
    rulesTotal: number;
}
export interface FindingEntry {
    severity: 'blocking' | 'warning' | 'info';
    source: string;
    flowId: string;
    rule: string;
    message: string;
    fix?: string;
}
export interface BuildReport {
    reportId: string;
    generatedAt: string;
    composite?: string;
    flowsExecuted: string[];
    verdict: ShipVerdict;
    severityCounts: SeverityCounts;
    overallGrade: LetterGrade;
    overallPassRate: number;
    domainGrades: DomainGrade[];
    findings: FindingEntry[];
    nextSteps: string[];
}
export interface GradingThresholds {
    a: number;
    b: number;
    c: number;
    d: number;
}
export declare const DEFAULT_THRESHOLDS: GradingThresholds;
export declare function passRateToLetter(passRate: number, thresholds?: GradingThresholds): LetterGrade;
export declare function computeOverallGrade(domains: DomainGrade[], thresholds?: GradingThresholds): {
    passRate: number;
    letter: LetterGrade;
};
export declare function computeVerdict(counts: SeverityCounts): ShipVerdict;
//# sourceMappingURL=build-report-types.d.ts.map