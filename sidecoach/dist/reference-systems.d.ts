import { Register } from './project-context';
export interface ComponentPattern {
    name: string;
    description: string;
    semanticMarkup: string;
    ariaRequirements: string[];
    keyboardInteraction: string;
    states: string[];
    wcagRules: string[];
    examples?: string[];
}
export interface ComponentGalleryReference {
    getComponentPatterns(componentType: string, register: Register): Promise<ComponentPattern[]>;
    getSemanticMarkup(componentType: string): Promise<string>;
    getA11yPatterns(componentType: string): Promise<string[]>;
    getInteractionStates(componentType: string): Promise<string[]>;
    validateAgainstWcag(componentType: string): Promise<string[]>;
}
export interface FontCandidate {
    name: string;
    family: string;
    weights: number[];
    category: 'sans-serif' | 'serif' | 'display' | 'monospace';
    pairingStrategy?: string;
    opentypeFeatures?: string[];
    webFontUrl?: string;
    fallback: string;
}
export interface FontshareReference {
    getFontCandidates(typography: string, register: Register): Promise<FontCandidate[]>;
    getPairingRules(brandPersonality: string): Promise<string[]>;
    getOpenTypeFeatures(fontName: string): Promise<string[]>;
    validateFontMetrics(fontName: string): Promise<{
        lineHeight: number;
        descent: number;
        ascent: number;
    }>;
}
export interface DesignReference {
    title: string;
    category: string;
    description: string;
    colorPalette?: string[];
    spacingPattern?: string;
    typographyApproach?: string;
    interactionPattern?: string;
    imageUrl?: string;
    sourceUrl?: string;
}
export interface DesignReferencesSystem {
    searchReferences(query: string, register: Register, limit?: number): Promise<DesignReference[]>;
    getPatternsByCategory(category: string, register: Register): Promise<DesignReference[]>;
    getCategoryReflex(category: string): Promise<string[]>;
    addReference(reference: DesignReference): Promise<void>;
}
export interface MotionPattern {
    name: string;
    description: string;
    easing: string;
    duration: number;
    useCase: string;
    staggerBase?: number;
    reducedMotionFallback: string;
    examples?: string[];
}
export interface MotionReference {
    getEasingCurves(intensity: 'restrained' | 'playful' | 'ambitious'): Promise<MotionPattern[]>;
    getMotionPalette(register: Register): Promise<MotionPattern[]>;
    validateMotionLaws(code: string): Promise<string[]>;
    getReducedMotionAlternative(pattern: MotionPattern): Promise<MotionPattern>;
}
export interface ReferenceSystemsFactory {
    createComponentGallery(): Promise<ComponentGalleryReference>;
    createFontshare(): Promise<FontshareReference>;
    createDesignReferences(): Promise<DesignReferencesSystem>;
    createMotionReference(): Promise<MotionReference>;
}
export declare class StubComponentGalleryReference implements ComponentGalleryReference {
    getComponentPatterns(componentType: string, register: Register): Promise<ComponentPattern[]>;
    getSemanticMarkup(componentType: string): Promise<string>;
    getA11yPatterns(componentType: string): Promise<string[]>;
    getInteractionStates(componentType: string): Promise<string[]>;
    validateAgainstWcag(componentType: string): Promise<string[]>;
}
export declare class StubFontshareReference implements FontshareReference {
    getFontCandidates(typography: string, register: Register): Promise<FontCandidate[]>;
    getPairingRules(brandPersonality: string): Promise<string[]>;
    getOpenTypeFeatures(fontName: string): Promise<string[]>;
    validateFontMetrics(fontName: string): Promise<{
        lineHeight: number;
        descent: number;
        ascent: number;
    }>;
}
export declare class StubDesignReferencesSystem implements DesignReferencesSystem {
    searchReferences(query: string, register: Register, limit?: number): Promise<DesignReference[]>;
    getPatternsByCategory(category: string, register: Register): Promise<DesignReference[]>;
    getCategoryReflex(category: string): Promise<string[]>;
    addReference(reference: DesignReference): Promise<void>;
}
export declare class StubMotionReference implements MotionReference {
    getEasingCurves(intensity: 'restrained' | 'playful' | 'ambitious'): Promise<MotionPattern[]>;
    getMotionPalette(register: Register): Promise<MotionPattern[]>;
    validateMotionLaws(code: string): Promise<string[]>;
    getReducedMotionAlternative(pattern: MotionPattern): Promise<MotionPattern>;
}
export declare class ReferenceSystemsFactoryImpl implements ReferenceSystemsFactory {
    createComponentGallery(): Promise<ComponentGalleryReference>;
    createFontshare(): Promise<FontshareReference>;
    createDesignReferences(): Promise<DesignReferencesSystem>;
    createMotionReference(): Promise<MotionReference>;
}
export declare class StubReferenceSystemsFactory implements ReferenceSystemsFactory {
    createComponentGallery(): Promise<ComponentGalleryReference>;
    createFontshare(): Promise<FontshareReference>;
    createDesignReferences(): Promise<DesignReferencesSystem>;
    createMotionReference(): Promise<MotionReference>;
}
//# sourceMappingURL=reference-systems.d.ts.map