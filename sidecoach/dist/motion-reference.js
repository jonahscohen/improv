"use strict";
// Motion Reference Implementation
// Provides easing curves, timing, stagger patterns using embedded motion patterns
Object.defineProperty(exports, "__esModule", { value: true });
exports.MotionReferenceImpl = void 0;
exports.createMotionReference = createMotionReference;
const reference_data_1 = require("./reference-data");
class MotionReferenceImpl {
    constructor() {
        this.dataService = new reference_data_1.ReferenceDataService();
    }
    async getEasingCurves(intensity) {
        const curves = {
            restrained: [
                {
                    name: 'ease-out-quad',
                    description: 'Subtle entrance feedback',
                    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    duration: 150,
                    useCase: 'feedback',
                    staggerBase: 30,
                    reducedMotionFallback: 'none',
                },
                {
                    name: 'ease-in-quad',
                    description: 'Subtle exit motion',
                    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    duration: 120,
                    useCase: 'exit',
                    reducedMotionFallback: 'instant',
                },
            ],
            playful: [
                {
                    name: 'ease-out-quart',
                    description: 'Medium entrance with presence',
                    easing: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
                    duration: 300,
                    useCase: 'entrance',
                    staggerBase: 50,
                    reducedMotionFallback: 'opacity-fade',
                },
                {
                    name: 'ease-out-back',
                    description: 'Bouncy state change',
                    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    duration: 400,
                    useCase: 'state_change',
                    staggerBase: 60,
                    reducedMotionFallback: 'opacity-fade',
                },
            ],
            ambitious: [
                {
                    name: 'ease-out-quint',
                    description: 'Strong entrance with momentum',
                    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                    duration: 500,
                    useCase: 'entrance',
                    staggerBase: 80,
                    reducedMotionFallback: 'opacity-fade',
                },
                {
                    name: 'ease-out-elastic',
                    description: 'Energetic state transition',
                    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                    duration: 600,
                    useCase: 'state_change',
                    staggerBase: 100,
                    reducedMotionFallback: 'instant',
                },
            ],
        };
        return curves[intensity] || [];
    }
    async getMotionPalette(register) {
        // For product register, return restrained motion patterns
        // For brand register, return playful/ambitious patterns
        const intensity = register === 'product' ? 'restrained' : 'playful';
        return this.getEasingCurves(intensity);
    }
    async validateMotionLaws(code) {
        const violations = [];
        // Check for layout animation violations
        if (/width|height|top|left|margin|padding/.test(code) && /animation|transition/.test(code)) {
            violations.push('Motion anti-pattern: animating layout properties (use transform instead)');
        }
        // Check for bounce/elastic easing violations
        if (/bounce|elastic|cubic-bezier.*1\.\d|cubic-bezier.*0\.\d\d\d/.test(code) &&
            !/easings|motion-palette/.test(code)) {
            violations.push('Motion anti-pattern: bounce or elastic easing detected (use exponential only)');
        }
        // Check for overly long durations
        if (/duration|animation-duration.*[5-9]00|[1-9]\d{3}/.test(code)) {
            violations.push('Motion anti-pattern: duration > 500ms (keep under 500ms or make interruptible)');
        }
        // Check for transition: all
        if (/transition\s*:\s*all/.test(code)) {
            violations.push('Motion anti-pattern: transition: all (specify properties explicitly)');
        }
        return violations;
    }
    async getReducedMotionAlternative(pattern) {
        return {
            ...pattern,
            easing: pattern.reducedMotionFallback === 'instant' ? 'none' : 'opacity-fade',
            duration: pattern.reducedMotionFallback === 'instant' ? 0 : 100,
            reducedMotionFallback: 'instant',
        };
    }
}
exports.MotionReferenceImpl = MotionReferenceImpl;
function createMotionReference() {
    return new MotionReferenceImpl();
}
//# sourceMappingURL=motion-reference.js.map