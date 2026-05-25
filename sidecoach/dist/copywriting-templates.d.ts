import { Register } from './project-context';
export interface CopyTemplate {
    register: Register;
    sectionId: string;
    slotId: string;
    voicePrompt: string;
    wordCountMin: number;
    wordCountMax: number;
    samplePatterns: string[];
}
export interface DraftContext {
    productName?: string;
    productPurpose?: string;
    brandPersonality?: string;
}
export declare function getTemplate(register: Register, sectionId: string, slotId: string): CopyTemplate | null;
export declare function getDraftOptions(register: Register, sectionId: string, slotId: string, draftContext?: DraftContext): string[];
export declare function listSlotsFor(register: Register, sectionId: string): CopyTemplate[];
//# sourceMappingURL=copywriting-templates.d.ts.map