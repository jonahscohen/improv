import { DesignReferencesSystem, DesignReference } from './reference-systems';
import { Register } from './project-context';
export declare class DesignReferencesSystemImpl implements DesignReferencesSystem {
    private dataService;
    private categoryReflex;
    constructor();
    searchReferences(query: string, register: Register, limit?: number): Promise<DesignReference[]>;
    getPatternsByCategory(category: string, register: Register): Promise<DesignReference[]>;
    getCategoryReflex(category: string): Promise<string[]>;
    addReference(reference: DesignReference): Promise<void>;
}
export declare function createDesignReferencesSystem(): DesignReferencesSystem;
//# sourceMappingURL=design-references-reference.d.ts.map