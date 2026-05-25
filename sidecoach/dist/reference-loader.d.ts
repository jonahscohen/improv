/**
 * Reference Loader
 *
 * Loads the absorbed library content at `sidecoach/reference/_extracted/`
 * and `sidecoach/reference/*.md` into flow handler context at runtime.
 *
 * Before this module existed, the absorbed content lived on disk but no
 * flow handler read it - the SKILL_REF constant in verb-command-registry.ts
 * was a string template the orchestrator stringified into help text, nothing
 * more. This module is the wiring layer that makes the library a runtime
 * input, not just a documentation artifact.
 *
 * Path conventions:
 * - REFERENCE_ROOT: sidecoach/reference (resolved from this module's location)
 * - EXTRACTED_ROOT: sidecoach/reference/_extracted (the source-attributed layer)
 * - Canonical: sidecoach/reference/<domain>.md (e.g. responsive-foundation.md)
 *
 * Caching: per-process, file content cached after first read. Cache survives
 * the lifetime of a chain execution. Cache can be cleared via clearCache()
 * if a flow handler needs a fresh read (rare).
 *
 * Error policy: soft-fail. A missing file logs to stderr and returns null
 * or an empty array. Flow handlers are expected to degrade gracefully
 * rather than throw on missing reference content - the library is additive,
 * never load-bearing for chain execution.
 */
/**
 * Load a canonical reference file by name (e.g. "responsive-foundation").
 * Looks under sidecoach/reference/<name>.md.
 */
export declare function loadCanonical(name: string): string | null;
/**
 * Load an extracted reference file by source + relative path.
 * Source values: 'legacy-design-skill', 'make-interfaces-feel-better',
 * 'external/emil-design-eng', 'external/typeui-fundamentals',
 * 'external/taste-skill', 'external/bencium-design',
 * 'external/refactoring-ui', 'local-skills/<skill-name>'.
 */
export declare function loadExtracted(source: string, relativePath: string): string | null;
/**
 * Clear the per-process cache. Call from a flow handler that needs to
 * pick up a file edit mid-chain (rare).
 */
export declare function clearCache(): void;
export declare function loadSlopWordList(): string[];
/**
 * Rhetorical-template patterns that signal AI-generated copy. Each pattern
 * is a regex with a human-readable name. Flow handlers and validators use
 * this to detect template-y output.
 */
export interface RhetoricalPattern {
    name: string;
    regex: RegExp;
    why: string;
}
export declare function loadRhetoricalPatterns(): RhetoricalPattern[];
/**
 * Emil Kowalski's three named strong easings, prescribed in flow-handler-motion-*.ts.
 * Use exactly these values - do not substitute. The Material curve
 * `cubic-bezier(0.4, 0, 0.2, 1)` is explicitly weaker than these and should
 * be flagged by motion validators when found in generated code.
 */
export interface NamedEasing {
    name: string;
    cssValue: string;
    use: string;
}
export declare function loadPrescribedEasings(): NamedEasing[];
/**
 * Easing curves that should NEVER appear in production CSS. Includes built-in
 * weak curves Emil bans plus bounce/elastic which the predecessor's design
 * laws ban for UI motion.
 */
export declare function loadBannedEasings(): {
    regex: RegExp;
    reason: string;
}[];
/**
 * The font reflex-reject list. Typefaces that have become AI-generated
 * defaults and should be refused as primary type choices on greenfield work.
 * Sourced from the absorbed legacy-design-skill brand.md and fontshare-reference
 * skill integration.
 */
export declare function loadFontReflexReject(): {
    name: string;
    reason: string;
}[];
/**
 * The six absolute bans from the absorbed legacy-design-skill content.
 * Match-and-refuse. If generated code matches one of these patterns, the
 * element should be rewritten with different structure.
 */
export interface AbsoluteBan {
    name: string;
    description: string;
    detectionHint: string;
    rewriteOptions: string[];
}
export declare function loadAbsoluteBans(): AbsoluteBan[];
/**
 * The saturated-aesthetic lanes from the absorbed legacy-design-skill brand.md.
 * Used by flowD's two-altitude category-reflex check. Generated UI matching
 * these lanes triggers a second-altitude finding.
 */
export interface AestheticLane {
    name: string;
    description: string;
    tells: string[];
}
export declare function loadSaturatedAestheticLanes(): AestheticLane[];
/**
 * TypeUI's line-height-by-size tier table. Validators should reject heading
 * line-heights outside these tiers.
 */
export interface LineHeightTier {
    context: string;
    fontSizeRange: string;
    lineHeightRange: [number, number];
    why: string;
}
export declare function loadLineHeightTiers(): LineHeightTier[];
/**
 * The Bencium 5-tier breakpoint table.
 */
export interface BreakpointTier {
    name: string;
    range: string;
    primaryPattern: string;
    navPattern: string;
    tablePattern: string;
}
export declare function loadBreakpointTable(): BreakpointTier[];
//# sourceMappingURL=reference-loader.d.ts.map