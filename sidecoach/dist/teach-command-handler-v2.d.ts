import type { FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface TeachExtraction {
    register?: 'brand' | 'product';
    users?: string;
    brandPersonality?: string;
    antiReferences?: string[];
    strategicPrinciples?: string[];
    confidence: {
        [field: string]: 'high' | 'low' | 'absent';
    };
}
/**
 * TeachCommandHandlerV2 - brief-driven hybrid handler.
 *
 * Replaces the old hardcoded-default stub. The handler parses a user's brief from
 * `context.utterance`, extracts the five PRODUCT.md fields (register, users,
 * brandPersonality, antiReferences, strategicPrinciples), identifies gaps, and
 * either returns a pending-with-questions result OR writes PRODUCT.md when the
 * brief plus any supplied teachAnswers cover all required fields.
 *
 * Constraints honored in the generated PRODUCT.md:
 * - No self-attribution lines
 * - No references to /sidecoach
 * - Brand Personality section only present when register=brand
 * - Will not overwrite a real existing PRODUCT.md (>=200 chars, no [TODO]
 *   placeholders) unless metadata.forceOverwrite is true.
 */
export declare class TeachCommandHandlerV2 {
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    private hasRealProductMd;
    private extractBrief;
    private parseBrief;
    private mergeFromBriefAndAnswers;
    private identifyGaps;
    private summarizeExtracted;
    private generateProductMd;
}
//# sourceMappingURL=teach-command-handler-v2.d.ts.map