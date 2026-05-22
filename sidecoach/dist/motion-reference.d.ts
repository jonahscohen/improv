import { MotionReference, MotionPattern } from './reference-systems';
import { Register } from './project-context';
export declare class MotionReferenceImpl implements MotionReference {
    private dataService;
    constructor();
    getEasingCurves(intensity: 'restrained' | 'playful' | 'ambitious'): Promise<MotionPattern[]>;
    getMotionPalette(register: Register): Promise<MotionPattern[]>;
    validateMotionLaws(code: string): Promise<string[]>;
    getReducedMotionAlternative(pattern: MotionPattern): Promise<MotionPattern>;
}
export declare function createMotionReference(): MotionReference;
//# sourceMappingURL=motion-reference.d.ts.map