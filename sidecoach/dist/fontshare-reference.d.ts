import { FontshareReference, FontCandidate } from './reference-systems';
import { Register } from './project-context';
export declare class FontshareReferenceImpl implements FontshareReference {
    private dataService;
    constructor();
    getFontCandidates(typography: string, register: Register): Promise<FontCandidate[]>;
    getPairingRules(brandPersonality: string): Promise<string[]>;
    getOpenTypeFeatures(fontName: string): Promise<string[]>;
    validateFontMetrics(fontName: string): Promise<{
        lineHeight: number;
        descent: number;
        ascent: number;
    }>;
}
export declare function createFontshareReference(): FontshareReference;
//# sourceMappingURL=fontshare-reference.d.ts.map