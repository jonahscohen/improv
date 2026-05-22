import { ComponentGalleryReference, ComponentPattern } from './reference-systems';
import { Register } from './project-context';
export declare class ComponentGalleryReferenceImpl implements ComponentGalleryReference {
    private dataService;
    constructor();
    getComponentPatterns(componentType: string, register: Register): Promise<ComponentPattern[]>;
    getSemanticMarkup(componentType: string): Promise<string>;
    getA11yPatterns(componentType: string): Promise<string[]>;
    getInteractionStates(componentType: string): Promise<string[]>;
    validateAgainstWcag(componentType: string): Promise<string[]>;
    private generateSemanticMarkup;
    private extractAriaRequirements;
    private extractKeyboardInteraction;
    private extractWcagRules;
}
export declare function createComponentGalleryReference(): ComponentGalleryReference;
//# sourceMappingURL=component-gallery-reference.d.ts.map