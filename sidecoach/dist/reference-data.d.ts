export interface ComponentPattern {
    name: string;
    type: string;
    systems: string[];
    description: string;
    accessibility: string;
    implementation: string;
    variants: string[];
    constraints?: string[];
}
export interface ComponentLibrary {
    [key: string]: ComponentPattern;
}
export interface Typeface {
    name: string;
    styles: string[];
    weights: string[];
    personality: string[];
    pairing?: string;
    licensing: string;
    source: string;
}
export interface FontCatalog {
    [key: string]: Typeface;
}
/**
 * The concrete family expansion of the font catalog's `system_fonts` entry (name "System Stack",
 * source 'system' - the ONE catalog entry whose source is not `fontshare.com`, i.e. the entry that
 * represents "no typeface was chosen"). The four fontshare.com-sourced entries are CHOSEN typefaces;
 * this list is the vocabulary of the un-chosen alternative.
 *
 * MEMBERSHIP RULE (precision-first, and the reason this is a short list rather than a websafe dump):
 * a token belongs here only if it is BOTH (a) bundled with an OS / a CSS generic - never downloaded,
 * so naming it is not a typeface purchase or a webfont decision - AND (b) realistic as the FIRST
 * family of a stack when nobody chose. Families that only ever appear MID-stack inside the canonical
 * system-stack boilerplate (Roboto, Noto Sans, Ubuntu, Cantarell, Fira Sans, Oxygen, Droid Sans) are
 * DELIBERATELY EXCLUDED: each is a real downloadable typeface that pages choose on purpose (the dev
 * corpus has a page leading with a self-hosted Roboto @font-face), and because the leading family is
 * what a stack resolves to first, excluding them costs nothing on a genuine system stack.
 *
 * Consumed by the rendered `default-typeface` subjective class. That detector runs inside
 * page.evaluate and so must inline its own copy (a serialized in-page function cannot import);
 * `src/__tests__/typeface-vocabulary.test.ts` asserts the two copies stay identical, so this stays
 * the single source of the vocabulary.
 */
export declare const SYSTEM_FONT_STACK_FAMILIES: readonly string[];
export interface MotionPattern {
    name: string;
    category: string;
    description: string;
    code: string;
    dependencies: string[];
    performance: string;
    interruption: string;
}
export interface MotionLibrary {
    [key: string]: MotionPattern;
}
export interface DesignReference {
    id: string;
    title: string;
    category: string;
    patterns: string[];
    feel: string[];
    source: string;
    url: string;
    saved: string;
    description: string;
}
export interface DesignTokens {
    colors?: {
        [key: string]: any;
    };
    typography?: {
        [key: string]: any;
    };
    spacing?: {
        [key: string]: any;
    };
    rounded?: {
        [key: string]: any;
    };
    shadow?: {
        [key: string]: any;
    };
    motion?: {
        [key: string]: any;
    };
    components?: {
        [key: string]: any;
    };
}
export interface DesignReferenceIndex {
    [key: string]: DesignReference;
}
export declare class ReferenceDataService {
    private componentIndex;
    private fontCatalog;
    private motionPatterns;
    private designReferences;
    private designTokens;
    constructor();
    private loadComponentIndex;
    private loadFontCatalog;
    private loadMotionPatterns;
    private loadDesignReferences;
    private loadDesignTokens;
    searchComponents(query: string, personality?: string): ComponentPattern[];
    getComponent(name: string): ComponentPattern | undefined;
    searchFonts(personality: string): Typeface[];
    getFont(name: string): Typeface | undefined;
    getFontPairing(name: string): string | undefined;
    searchMotionPatterns(category: string): MotionPattern[];
    getMotionPattern(name: string): MotionPattern | undefined;
    getAllMotionPatterns(): MotionPattern[];
    getComponentTypes(): string[];
    getFontNames(): string[];
    searchDesignReferences(query: string): DesignReference[];
    getDesignReference(id: string): DesignReference | undefined;
    getDesignReferencesByCategory(category: string): DesignReference[];
    getDesignReferencesByFeel(feel: string): DesignReference[];
    getAllDesignReferences(): DesignReference[];
    getDesignTokens(): DesignTokens;
    getDesignTokensBySection(section: string): any;
    getDesignTokenValue(path: string): any;
    generateComponentTemplate(componentName: string): {
        html: string;
        css: string;
    } | undefined;
    generateMotionTemplate(patternName: string): {
        code: string;
        html: string;
    } | undefined;
    generateTokenTemplate(section: string): string;
}
export declare function createReferenceDataService(): ReferenceDataService;
//# sourceMappingURL=reference-data.d.ts.map