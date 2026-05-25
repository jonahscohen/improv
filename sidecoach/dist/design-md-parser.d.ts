export interface DesignTokens {
    colors: Record<string, any>;
    typography: Record<string, any>;
    rounded: Record<string, string>;
    spacing: Record<string, any>;
    shadow: Record<string, string>;
    motion: Record<string, any>;
    bodyLineNumbers: {
        frontmatterStart: number;
        frontmatterEnd: number;
        bodyStart: number;
    };
    raw: Record<string, any>;
}
export declare function parseDesignMd(src: string): DesignTokens;
export declare function findTokenLine(src: string, dottedPath: string): number;
//# sourceMappingURL=design-md-parser.d.ts.map