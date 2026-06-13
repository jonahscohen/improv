export declare const SCHEMA_VERSION = 1;
export interface LaneScore {
    lane: string;
    label: string;
    score: number;
    scope: string;
    evidenceIds: string[];
}
export interface Decision {
    outcome: string;
    winningLane: string | null;
    verbMatch: string | null;
    diagnosticLane: string | null;
    laneScores: LaneScore[];
    schemaVersion: number;
}
export declare function loadRegistry(p: string): any;
export declare function blankInformational(text: string): string;
export declare function segmentClauses(text: string): Array<[number, number]>;
export declare function evaluateLane(lane: any, prompt: string, reg: any): LaneScore;
export declare function detectVerb(text: string, verbs: any[]): string | null;
export declare function classifyIntent(prompt: string, reg: any, verbs: any[], opts?: {
    intentEligible?: boolean;
}): Decision;
//# sourceMappingURL=lane-classifier.d.ts.map