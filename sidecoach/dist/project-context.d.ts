import { DesignTokens } from './design-md-parser';
export type Register = 'brand' | 'product';
export interface ProductMetadata {
    register?: Register;
    users?: string;
    purpose?: string;
    brandPersonality?: string;
    antiReferences?: string[];
    strategicPrinciples?: string[];
    [key: string]: any;
}
export interface DesignMetadata {
    colors?: Record<string, any>;
    typography?: Record<string, any>;
    spacing?: Record<string, any>;
    elevation?: Record<string, any>;
    components?: Record<string, any>;
    breakpoints?: Record<string, number>;
    parsedTokens?: DesignTokens;
    [key: string]: any;
}
export interface ProjectContext {
    projectPath: string;
    register: Register;
    product: ProductMetadata;
    design: DesignMetadata;
    loaded: {
        productMd: boolean;
        designMd: boolean;
    };
    errors: string[];
    techStack?: TechStack;
}
export declare class ContextLoader {
    private cache;
    load(projectPath: string): ProjectContext;
    clear(): void;
    private parseMarkdownFrontmatter;
}
export declare function createContextLoader(): ContextLoader;
export interface TechStack {
    framework: 'react' | 'next' | 'vue' | 'svelte' | 'astro' | 'remix' | 'angular' | 'wordpress' | 'drupal' | 'hubspot' | 'vanilla' | 'unknown';
    hasAnimationLib: boolean;
    animationLib?: 'gsap' | 'framer-motion' | 'motion' | 'lenis' | 'anime' | null;
    hasTypescript: boolean;
    packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
}
/**
 * Detect CMS / Angular projects by sniffing the project root for marker files.
 * Runs BEFORE the package.json sniff inside detectTechStack so CMS markers
 * win over a package.json that may also be present (e.g. a WordPress project
 * with @wordpress/scripts for Gutenberg block work).
 *
 * Returns null if no CMS / Angular marker is found - the caller should then
 * fall through to the existing package.json detection.
 */
export declare function detectStackFromFilesystem(projectPath: string): 'angular' | 'wordpress' | 'drupal' | 'hubspot' | null;
export declare function detectTechStack(projectPath: string): TechStack;
/**
 * The CONTENT families a DESIGN.md typography block commits to. Reads the LEAD
 * family of every typography.<role>.family stack (display, body, mono, and any
 * other role that declares a `family`; scale/weights carry none and are skipped).
 *
 * System/generic leads (sans-serif, system-ui, Arial, ...) are DROPPED: a
 * "commitment" to a system stack is the ABSENCE of a chosen typeface, which is
 * Ground A's domain, not a brand family Ground B can mismatch against. Reusing
 * the scanner's own SYSTEM_FONT_STACK_FAMILIES keeps this classification
 * single-sourced with the detector.
 *
 * Returns deduped, original-case families (so the finding message reads cleanly;
 * the scanner lowercases for matching). [] when nothing qualifies.
 */
export declare function committedFontFamilies(typography: unknown): string[];
/**
 * Load the brand's committed font families from a project's DESIGN.md.
 *
 * FAIL-SAFE by construction: a missing / unreadable / frontmatter-less DESIGN.md
 * yields [] so Ground B stays inert rather than inventing a brand. Resolves
 * DESIGN.md at the project ROOT with the same case variants ContextLoader uses
 * (root-only, no docs/ fallback - the validator/audit callers pass a concrete
 * project root).
 */
export declare function loadCommittedFontFamilies(projectPath: string): string[];
//# sourceMappingURL=project-context.d.ts.map