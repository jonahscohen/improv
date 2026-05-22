"use strict";
// Design References System Implementation
// Provides visual inspiration, patterns from catalog using embedded design references
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignReferencesSystemImpl = void 0;
exports.createDesignReferencesSystem = createDesignReferencesSystem;
const reference_data_1 = require("./reference-data");
class DesignReferencesSystemImpl {
    constructor() {
        this.categoryReflex = new Map([
            ['button', ['gradient fills', 'neon glows', 'glassmorphism', 'neumorphism']],
            ['card', ['shadow stacks', 'border gradients', 'background patterns']],
            ['form', ['label overlays', 'inline validation', 'floating labels']],
            ['modal', ['blur backdrops', 'scale-in animations', 'side slides']],
            ['color', ['monochrome', 'analogous pairs', 'gradient meshes']],
        ]);
        this.dataService = new reference_data_1.ReferenceDataService();
    }
    async searchReferences(query, register, limit) {
        const references = this.dataService.searchDesignReferences(query);
        // Filter by register personality if available
        if (register && references.length > 0) {
            // Prefer references that match register tone
            const filtered = references.filter((ref) => {
                const refFeel = (ref.feel || []).join(' ').toLowerCase();
                const productFeels = ['minimal', 'clean', 'restrained'];
                const brandFeels = ['playful', 'bold', 'energetic'];
                if (register === 'product') {
                    return productFeels.some((f) => refFeel.includes(f));
                }
                else if (register === 'brand') {
                    return brandFeels.some((f) => refFeel.includes(f));
                }
                return true;
            });
            return filtered.slice(0, limit || 5);
        }
        return references.slice(0, limit || 5);
    }
    async getPatternsByCategory(category, register) {
        return this.dataService.getDesignReferencesByCategory(category);
    }
    async getCategoryReflex(category) {
        // Returns oversaturated patterns to avoid in this category
        return this.categoryReflex.get(category.toLowerCase()) || [];
    }
    async addReference(reference) {
        // In production would persist to ~/.claude/design-references/
        // For now this is a no-op as data is embedded
    }
}
exports.DesignReferencesSystemImpl = DesignReferencesSystemImpl;
function createDesignReferencesSystem() {
    return new DesignReferencesSystemImpl();
}
//# sourceMappingURL=design-references-reference.js.map