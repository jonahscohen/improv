import { Register } from './project-context';
export interface SlotDescriptor {
    id: string;
    label: string;
    required: boolean;
}
export interface SectionDescriptor {
    id: string;
    name: string;
    purpose: string;
    slots: SlotDescriptor[];
}
export interface RhythmRules {
    verticalGapPx: number;
    maxSectionsPerScreen: number;
    hierarchyGuidance: string;
}
export declare function getSectionTaxonomy(register: Register): SectionDescriptor[];
export declare function getRhythmRules(register: Register): RhythmRules;
export declare function getAntiPatternCallouts(register: Register): string[];
export declare function findSection(register: Register, sectionId: string): SectionDescriptor | null;
//# sourceMappingURL=landing-composition-data.d.ts.map