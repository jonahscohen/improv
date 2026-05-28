export type DeepFieldId = 'register' | 'users' | 'brandPersonality' | 'antiReferences' | 'strategicPrinciples' | 'problem' | 'successMetrics' | 'businessModel' | 'technicalConstraints' | 'brandVoice';
export type DeepDimension = 'goal' | 'constraints' | 'criteria' | 'context';
/**
 * Core fields - asked in every teach run (today's behavior is the same).
 */
export declare const CORE_FIELDS: DeepFieldId[];
/**
 * Extended fields - only asked when --deep is enabled. Each one belongs to a
 * dimension (goal / constraints / criteria / context) so we can score
 * ambiguity OMC-style.
 */
export declare const EXTENDED_FIELDS: DeepFieldId[];
export declare const DEEP_FIELDS: DeepFieldId[];
/**
 * Maps each field to its OMC-style ambiguity dimension. Used by ambiguityScore
 * to weight missing/low-confidence fields.
 */
export declare const FIELD_DIMENSION: Record<DeepFieldId, DeepDimension>;
/**
 * Vague answer detection - if a user's answer matches one of these patterns,
 * we treat the field as low-confidence and ask a sharper follow-up. This is
 * the design-domain analog of OMC's weakest-dimension targeting.
 *
 * Patterns are case-insensitive whole-string matches (after trim) OR substring
 * matches when the answer is short (< 30 chars). Long answers escape these
 * because they have enough content to be specific even if they contain a
 * generic word like "modern".
 */
export declare const VAGUE_PATTERNS: Record<DeepFieldId, RegExp[]>;
/**
 * Returns true if the answer is too vague to count as a high-confidence
 * extraction. Long answers (>= 30 chars) bypass the pattern check unless
 * the WHOLE answer matches a pattern (which short patterns wont catch on long
 * inputs anyway).
 */
export declare function isVagueAnswer(field: DeepFieldId, answer: string | undefined): boolean;
export declare function dimensionFor(field: DeepFieldId): DeepDimension;
/**
 * OMC-style ambiguity score across 4 weighted dimensions. Each dimension
 * scores from 0.0 (no fields filled) to 1.0 (all fields filled with high
 * confidence). Ambiguity = 1 - weighted_average_clarity.
 *
 * Weights (greenfield default): goal 0.35, constraints 0.25, criteria 0.25,
 * context 0.15. Matches OMC's brownfield formula.
 */
export declare function ambiguityScore(confidences: Partial<Record<DeepFieldId, 'high' | 'low' | 'absent'>>, fields?: DeepFieldId[]): {
    ambiguity: number;
    perDimension: Record<DeepDimension, number>;
    weakest: DeepDimension | null;
};
/**
 * Returns a sharper follow-up question for a vague answer. The follow-up
 * tries to surface the specific assumption the user made when they typed
 * the vague phrase. Design-domain analog of OMC's challenge agents
 * (contrarian / simplifier / ontologist).
 */
export declare function generateFollowUpQuestion(field: DeepFieldId, vagueAnswer: string): string;
export interface ProductMdValidation {
    ok: boolean;
    warnings: string[];
    missingSections: string[];
    stubSections: string[];
}
export declare function validateProductMd(content: string, options?: {
    register?: 'brand' | 'product';
    deep?: boolean;
}): ProductMdValidation;
/**
 * Parses --deep / --quick / --standard flags out of the brief AND returns the
 * cleaned brief (flag stripped).
 */
export declare function parseDeepFlag(brief: string): {
    brief: string;
    depth: 'quick' | 'standard' | 'deep';
};
//# sourceMappingURL=teach-deep-interview.d.ts.map