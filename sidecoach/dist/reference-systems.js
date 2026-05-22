"use strict";
// Reference Systems
// Interfaces for 4 lean reference systems that access live sources
Object.defineProperty(exports, "__esModule", { value: true });
exports.StubReferenceSystemsFactory = exports.ReferenceSystemsFactoryImpl = exports.StubMotionReference = exports.StubDesignReferencesSystem = exports.StubFontshareReference = exports.StubComponentGalleryReference = void 0;
const fontshare_reference_1 = require("./fontshare-reference");
const component_gallery_reference_1 = require("./component-gallery-reference");
const design_references_reference_1 = require("./design-references-reference");
const motion_reference_1 = require("./motion-reference");
// Stub implementations for Phase 1 (will be enhanced in Phase 2)
class StubComponentGalleryReference {
    async getComponentPatterns(componentType, register) {
        // Will be populated from component.gallery in Phase 2
        return [];
    }
    async getSemanticMarkup(componentType) {
        return `<${componentType} aria-label="Description"></${componentType}>`;
    }
    async getA11yPatterns(componentType) {
        return ['aria-label', 'role', 'tabindex', 'aria-disabled'];
    }
    async getInteractionStates(componentType) {
        return ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
    }
    async validateAgainstWcag(componentType) {
        return ['WCAG 2.1 AA: 4.5:1 contrast on text', 'Focus rings visible on keyboard', '44x44px touch targets'];
    }
}
exports.StubComponentGalleryReference = StubComponentGalleryReference;
class StubFontshareReference {
    async getFontCandidates(typography, register) {
        // Will be populated from fontshare.com in Phase 2
        return [];
    }
    async getPairingRules(brandPersonality) {
        return [
            'Pair serif heading with sans-serif body',
            'Stick to 1-2 font families max',
            'Ensure 1.25+ size ratio between hierarchy levels',
        ];
    }
    async getOpenTypeFeatures(fontName) {
        return ['kern', 'liga', 'dlig', 'ss01', 'tabular-nums'];
    }
    async validateFontMetrics(fontName) {
        return { lineHeight: 1.5, descent: -0.2, ascent: 0.8 };
    }
}
exports.StubFontshareReference = StubFontshareReference;
class StubDesignReferencesSystem {
    async searchReferences(query, register, limit) {
        // Will be populated from project design-references catalog in Phase 2
        return [];
    }
    async getPatternsByCategory(category, register) {
        return [];
    }
    async getCategoryReflex(category) {
        // Returns oversaturated patterns for this category from CATEGORY_REFLEX
        return [];
    }
    async addReference(reference) {
        // Will persist to project design-references catalog
    }
}
exports.StubDesignReferencesSystem = StubDesignReferencesSystem;
class StubMotionReference {
    async getEasingCurves(intensity) {
        const curves = {
            restrained: [
                {
                    name: 'ease-out-quad',
                    description: 'Subtle entrance feedback',
                    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    duration: 150,
                    useCase: 'feedback',
                    reducedMotionFallback: 'none',
                },
            ],
            playful: [
                {
                    name: 'ease-out-quart',
                    description: 'Medium entrance with presence',
                    easing: 'cubic-bezier(0.165, 0.84, 0.44, 1)',
                    duration: 300,
                    useCase: 'entrance',
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
                    reducedMotionFallback: 'opacity-fade',
                },
            ],
        };
        return curves[intensity] || [];
    }
    async getMotionPalette(register) {
        // Returns motion patterns for register (restrained for product, playful/ambitious for brand)
        return [];
    }
    async validateMotionLaws(code) {
        const violations = [];
        if (/width|height|top|left|margin/.test(code) && /animation|transition/.test(code)) {
            violations.push('Motion anti-pattern: animating layout properties');
        }
        if (/bounce|elastic|cubic-bezier.*1\.\d/.test(code)) {
            violations.push('Motion anti-pattern: bounce or elastic easing detected');
        }
        return violations;
    }
    async getReducedMotionAlternative(pattern) {
        return {
            ...pattern,
            easing: 'none',
            duration: 0,
            reducedMotionFallback: 'instant',
        };
    }
}
exports.StubMotionReference = StubMotionReference;
// Production factory (Phase 3)
class ReferenceSystemsFactoryImpl {
    async createComponentGallery() {
        return new component_gallery_reference_1.ComponentGalleryReferenceImpl();
    }
    async createFontshare() {
        return new fontshare_reference_1.FontshareReferenceImpl();
    }
    async createDesignReferences() {
        return new design_references_reference_1.DesignReferencesSystemImpl();
    }
    async createMotionReference() {
        return new motion_reference_1.MotionReferenceImpl();
    }
}
exports.ReferenceSystemsFactoryImpl = ReferenceSystemsFactoryImpl;
// Legacy stub for backward compatibility (Phase 1)
class StubReferenceSystemsFactory {
    async createComponentGallery() {
        return new StubComponentGalleryReference();
    }
    async createFontshare() {
        return new StubFontshareReference();
    }
    async createDesignReferences() {
        return new StubDesignReferencesSystem();
    }
    async createMotionReference() {
        return new StubMotionReference();
    }
}
exports.StubReferenceSystemsFactory = StubReferenceSystemsFactory;
//# sourceMappingURL=reference-systems.js.map