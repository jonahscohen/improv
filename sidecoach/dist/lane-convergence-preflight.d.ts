import type { RequiredCoverageRecord } from './product-rule-types';
export interface PreflightGap {
    validatorId: string;
    ruleId: string;
    sourceFile?: string;
    sourceKind?: string;
    missingRequirements: {
        requirementIndex: number;
        alternatives: string[];
    }[];
    reason: 'missing_rule' | 'no_applicable_source' | 'uninspected_applicable_file' | 'unsupported_source' | 'missing_evidence_requirement';
}
export interface PreflightResult {
    ok: boolean;
    gaps: PreflightGap[];
    message?: string;
}
export declare function convergencePreflight(projectPath: string, laneId: string): Promise<PreflightResult>;
export declare function evaluateCoverageRecordForTest(rec: RequiredCoverageRecord, files: {
    path: string;
    sourceKind: string;
    outcome: string;
}[]): {
    ok: boolean;
    missingRequirements: {
        requirementIndex: number;
        alternatives: string[];
    }[];
};
//# sourceMappingURL=lane-convergence-preflight.d.ts.map