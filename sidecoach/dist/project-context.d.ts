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
}
export declare class ContextLoader {
    private cache;
    load(projectPath: string): ProjectContext;
    clear(): void;
    private parseMarkdownFrontmatter;
}
export declare function createContextLoader(): ContextLoader;
//# sourceMappingURL=project-context.d.ts.map