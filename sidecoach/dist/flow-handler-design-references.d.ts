import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
export interface DesignReferenceContext {
    referencesFound: number;
    colorDomainRules: string[];
    spatialDomainRules: string[];
    references: {
        title: string;
        category: string;
        hasColorPalette: boolean;
        hasSpacingPattern: boolean;
        slopDetectionResults: {
            categoryReflex: boolean;
            oversaturated: boolean;
            genericityScore: number;
        };
    }[];
}
export interface ConceptSketchOutcome {
    status: 'verified' | 'failed' | 'unverified' | 'unavailable';
    /** Absolute path to the plate, present only when one was written. */
    path?: string;
    provider: string;
    model?: string;
    detail: string;
}
/**
 * Build the sketch prompt from the brief. Deterministic: the same register, approach and utterance always
 * produce the same prompt, so the same brief always produces the same plate (and the same cache key).
 */
export declare function buildSketchPrompt(register: string, approach: string, utterance: string): string;
/**
 * Invoke bin/sidecoach-image.js in offline mode for the brief and map its exit code onto a four-valued outcome.
 * Exit codes are the contract: 0 verified, 1 a check failed, 3 a check could not run, anything else means no
 * plate was produced.
 */
export declare function runConceptSketchLens(context: FlowExecutionContext): ConceptSketchOutcome | null;
/**
 * Whether a sketch outcome may be handed downstream as a usable reference.
 *
 * VERIFIED and nothing else. A failed plate, an unverifiable plate, a step that produced nothing, and a lens
 * that never ran are all withheld. It is a separate exported predicate rather than an inline condition so the
 * rule is testable on all four states, including the two the flow cannot easily be driven into.
 */
export declare function isOfferableSketch(outcome: ConceptSketchOutcome | null): boolean;
/** The guidance lines flow D emits for the sketch step, in every outcome including "it did not run". */
export declare function sketchGuidance(outcome: ConceptSketchOutcome | null): string[];
export declare class FlowDReferenceSearchHandler extends BaseFlowHandler {
    private designReferencesRef;
    private cachedReferenceContext?;
    constructor();
    canExecute(context: FlowExecutionContext): boolean;
    execute(context: FlowExecutionContext): Promise<FlowExecutionResult>;
    getCachedContext(): DesignReferenceContext | undefined;
}
export declare function createFlowDHandler(): FlowDReferenceSearchHandler;
//# sourceMappingURL=flow-handler-design-references.d.ts.map