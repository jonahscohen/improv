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
//# sourceMappingURL=project-context.d.ts.map