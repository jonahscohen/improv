export type DistilledRuleType = 'hard-prohibitive' | 'design-direction' | 'standard-measurement' | 'principle-guidance';
export declare const DISTILLED_RULE_TYPES: readonly DistilledRuleType[];
/** For a hard-prohibitive: is the absolute a ban ("never") or a mandate ("always")? */
export type Polarity = 'ban' | 'mandate';
/** A measured knob and the value/range a standard-measurement rule pins it to. */
export interface MeasuredValue {
    property: string;
    value?: string | number;
    unit?: string;
    range?: [number, number] | string;
}
/**
 * One distilled rule - the irreducibly-semantic distillation of one prose source into one typed
 * record. The live FLOW produces the semantics (type/claim/measured); the deterministic engine
 * GATES directionLabel + the design-direction type from provenance and RE-TYPES every contradiction
 * from these structured fields.
 */
export interface DistilledRule {
    id: string;
    sourceKind: string;
    source: string;
    sourceFile?: string;
    type: DistilledRuleType;
    concept: string;
    claim: string;
    polarity?: Polarity;
    axisSubject: string;
    directionLabel?: string;
    measured?: MeasuredValue;
    evidence: string[];
    provenance?: Record<string, unknown>;
    confidence?: 'high' | 'medium' | 'low';
    normalizationWarnings?: string[];
}
export type ContradictionType = 'direction-pair' | 'hard-vs-hard' | 'standard-calibration' | 'cross-type';
export type Disposition = 'menu' | 'resolve' | 'calibrate' | 'note';
export interface ContradictionRecord {
    type: ContradictionType;
    isConflict: boolean;
    axisSubject: string;
    members: DistilledRule[];
    values?: MeasuredValue[];
    recommendation: string;
    disposition: Disposition;
}
/** How a distilled cluster relates to our live rules. */
export interface ClusterOverlap {
    concept: string;
    status: 'covered' | 'additive' | 'single-source';
    liveMatch: string | null;
    sources: string[];
    memberCount: number;
}
export interface OverlapView {
    covered: ClusterOverlap[];
    additive: ClusterOverlap[];
    singleSource: ClusterOverlap[];
}
export interface TasteMapCluster {
    concept: string;
    axisSubject: string;
    members: DistilledRule[];
    overlap: ClusterOverlap;
    contradictions: ContradictionRecord[];
}
export interface ContradictionsByType {
    'direction-pair': ContradictionRecord[];
    'hard-vs-hard': ContradictionRecord[];
    'standard-calibration': ContradictionRecord[];
    'cross-type': ContradictionRecord[];
}
export interface TasteMap {
    schema: string;
    clusters: TasteMapCluster[];
    overlap: OverlapView;
    contradictionsByType: ContradictionsByType;
}
/**
 * Lowercase, collapse every non-alphanumeric run to a single space, trim. This MATCHES the miner's
 * normalizeKey (bin/sidecoach-mine.js) byte-for-byte, so a distilled concept can be tested against
 * the miner's dedup index (buildDedupIndex) with the same key shape.
 */
export declare function normalizeConcept(s: string): string;
/**
 * Seed a concept + axisSubject from a rule-store entry (a registry rule or a guidance entry). Uses
 * the canonical-key TAIL, the same human-readable slug the miner's dedup uses as its weak key, so
 * the seeded concept lines up with a distilled rule's concept when they describe the same thing.
 */
export declare function seedConceptFromKey(entry: {
    canonicalRuleKey?: string;
    ruleId?: string;
    registryScope?: string;
    name?: string | null;
    id?: string | null;
}): {
    concept: string;
    axisSubject: string;
};
/**
 * Classify the contradiction (if any) between two distilled rules, PURELY from their structured
 * fields. Returns a full ContradictionRecord or null.
 *
 * null means "no contradiction to flag" - either the two rules are about DIFFERENT subjects
 * (different axisSubject), or they are about the same subject and AGREE (two same-polarity bans,
 * two identical measurements, a soft principle sharing an axis with a prescriptive rule).
 *
 * The classification order is deliberate:
 *   1. Same-axis gate. Different axisSubject => null (unrelated concepts).
 *   2. DIRECTION gate FIRST (load-bearing). If both rules are design-directions => direction-pair,
 *      no matter what their prose says. If exactly one is a direction, only a PRESCRIPTIVE other
 *      (a hard ban/mandate or a measured standard) stands in tension => cross-type; a soft principle
 *      sharing the axis is not a conflict => null.
 *   3. Two hard-prohibitives => hard-vs-hard only when their polarity OPPOSES (ban vs mandate).
 *   4. Two standard-measurements => standard-calibration only when they pin the same knob differently.
 *   5. A hard-prohibitive vs a standard-measurement => cross-type (a prescriptive tension).
 *   6. Anything else (a principle-guidance is involved) => null (too soft to be a hard conflict).
 */
export declare function classifyContradiction(a: DistilledRule, b: DistilledRule): ContradictionRecord | null;
/** Empty, fully-typed contradiction buckets - the deterministic engine fills these. */
export declare function emptyContradictionsByType(): ContradictionsByType;
//# sourceMappingURL=taste-map-types.d.ts.map