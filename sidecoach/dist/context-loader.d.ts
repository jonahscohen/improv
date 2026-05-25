import { DesignTokens } from './design-md-parser';
import { ProductMetadata, DesignMetadata } from './project-context';
export interface ContextLoadResult {
    hasProduct: boolean;
    product: string | null;
    productPath: string | null;
    hasDesign: boolean;
    design: string | null;
    designPath: string | null;
    migrated: boolean;
    contextDir: string;
}
export interface ProjectContext {
    cwd: string;
    contextDir: string;
    productContent: string | null;
    designContent: string | null;
    register: 'brand' | 'product' | null;
    hasFullContext: boolean;
    parsedDesignTokens: DesignTokens | null;
    techStack?: {
        framework: string;
        hasAnimationLib: boolean;
        animationLib?: string | null;
        hasTypescript: boolean;
        packageManager: string;
    };
    product?: ProductMetadata;
    design?: DesignMetadata;
}
export declare function resolveContextDir(cwd?: string): string;
export declare function loadContext(cwd?: string): ContextLoadResult;
export declare function detectRegister(productContent: string | null): 'brand' | 'product' | null;
export declare function buildProjectContext(cwd?: string): ProjectContext;
//# sourceMappingURL=context-loader.d.ts.map