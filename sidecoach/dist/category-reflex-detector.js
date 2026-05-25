"use strict";
// Task #24: Category-Reflex AI Slop Detection
// Detects oversaturated/generic design patterns using genericityScore
// Used by Flow D (Design References) to filter low-value references
// Complies with category-reflex AI slop detection rules
Object.defineProperty(exports, "__esModule", { value: true });
exports.CategoryReflexDetector = void 0;
exports.createCategoryReflexDetector = createCategoryReflexDetector;
// Oversaturated pattern catalog (what NOT to recommend)
// Extracted from design trend analysis and reference files
const OVERSATURATED_PATTERNS = {
    'Hero-Metric Dashboard': {
        patterns: ['big number', 'hero metric', 'supporting stats grid', 'gradient accent'],
        domains: ['color', 'space', 'typography'],
        saturatedUntil: '2027-06-01',
        reasoning: 'Overused SaaS dashboard template from 2023-2026',
    },
    'Glassmorphism Overlay': {
        patterns: ['glassmorphism', 'backdrop filter', 'blur effect', 'frosted glass'],
        domains: ['color'],
        saturatedUntil: '2027-03-01',
        reasoning: 'Peak saturation 2024-2025; moving toward fade-out phase',
    },
    'Identical Card Grids': {
        patterns: ['card grid', 'feature cards', 'service cards', 'uniform cards'],
        domains: ['space', 'interaction'],
        saturatedUntil: '2027-12-01',
        reasoning: 'Generic grid layout used in 80%+ of B2B marketing sites',
    },
    'Colorful Gradient Borders': {
        patterns: ['gradient border', 'neon border', 'glow effect', 'vibrant border'],
        domains: ['color'],
        saturatedUntil: '2027-09-01',
        reasoning: 'Trendy but overused; lacks constraint and sophistication',
    },
    'Side-Stripe Design': {
        patterns: ['left stripe', 'right stripe', 'accent stripe', 'side accent'],
        domains: ['space', 'color'],
        saturatedUntil: '2027-08-01',
        reasoning: 'Visual anti-pattern; clutters and reduces whitespace',
    },
    'Infinite Scroll Feed': {
        patterns: ['infinite scroll', 'endless feed', 'auto-load', 'pagination-less'],
        domains: ['interaction'],
        saturatedUntil: '2027-04-01',
        reasoning: 'Accessibility issues, user control reduction',
    },
    'Floating Action Button': {
        patterns: ['floating action', 'fab', 'floating button', 'sticky button'],
        domains: ['interaction'],
        saturatedUntil: '2027-06-01',
        reasoning: 'Over-relied upon mobile pattern; often obscures content',
    },
    'Parallax Scrolling': {
        patterns: ['parallax', 'depth scroll', 'parallax background', 'layered scroll'],
        domains: ['motion', 'interaction'],
        saturatedUntil: '2027-05-01',
        reasoning: 'Performance issues, reduced accessibility',
    },
    'Bento Grid Layout': {
        patterns: ['bento grid', 'mixed grid', 'masonry layout', 'irregular grid'],
        domains: ['space'],
        saturatedUntil: '2027-10-01',
        reasoning: 'Currently trendy (2025) but emerging oversaturation signal',
    },
    'Animated SVG Icons': {
        patterns: ['animated icon', 'lottie animation', 'svg animation', 'animated icon'],
        domains: ['motion'],
        saturatedUntil: '2027-07-01',
        reasoning: 'Often used without purpose; accessibility concerns',
    },
    'Split-Screen Layout': {
        patterns: ['split screen', '50-50 layout', 'side-by-side', 'two-column hero'],
        domains: ['space'],
        saturatedUntil: '2027-08-01',
        reasoning: 'Overused in landing pages; responsive issues',
    },
    'Neumorphism Design': {
        patterns: ['neumorphism', 'soft shadow', 'emboss effect', 'extruded button'],
        domains: ['color', 'space'],
        saturatedUntil: '2027-02-01',
        reasoning: 'Peak saturation 2024; declining trend',
    },
    'Duotone Imagery': {
        patterns: ['duotone', 'two-color image', 'color overlay image', 'tinted photo'],
        domains: ['color'],
        saturatedUntil: '2027-09-01',
        reasoning: 'Overused effect; reduces photo authenticity',
    },
    'Typography-Heavy Hero': {
        patterns: ['text-heavy hero', 'large typography section', 'typographic hero'],
        domains: ['typography', 'space'],
        saturatedUntil: '2027-11-01',
        reasoning: 'Trendy but often lacks supporting visuals',
    },
};
class CategoryReflexDetector {
    /**
     * Detect if a design reference contains oversaturated/generic patterns
     * Returns genericityScore (0-100) and categorization
     */
    detectSlop(reference) {
        let totalScore = 0;
        let scoreCount = 0;
        const matchedPatterns = [];
        // Check against each oversaturated pattern
        for (const [patternName, patternData] of Object.entries(OVERSATURATED_PATTERNS)) {
            const matchScore = this.matchPatternSignature(reference, patternData.patterns);
            if (matchScore > 0) {
                matchedPatterns.push(patternName);
                totalScore += matchScore;
                scoreCount++;
            }
        }
        // Calculate genericityScore (0-100)
        const genericityScore = scoreCount > 0
            ? Math.round((totalScore / scoreCount) * 100)
            : this.analyzeDescriptionGenericity(reference);
        // Determine verdict
        const verdict = this.determineVerdict(genericityScore);
        const confidence = Math.min(0.95, scoreCount * 0.15 + 0.3); // Higher confidence with more pattern matches
        const reasoning = this.generateReasoning(reference, genericityScore, matchedPatterns);
        return {
            reference,
            genericityScore,
            oversaturatedPatterns: matchedPatterns,
            isSlop: genericityScore >= 70,
            verdict,
            confidence,
            reasoning,
        };
    }
    /**
     * Batch detect slop in multiple references
     * Returns results sorted by genericityScore (lowest/best first)
     */
    detectBatch(references) {
        return references
            .map((ref) => this.detectSlop(ref))
            .sort((a, b) => a.genericityScore - b.genericityScore);
    }
    /**
     * Filter references, removing oversaturated patterns
     * Threshold: genericityScore >= 70 = discard
     */
    filterQualityReferences(references, threshold = 70) {
        return references
            .map((ref) => this.detectSlop(ref))
            .filter((result) => result.genericityScore < threshold)
            .map((result) => result.reference);
    }
    /**
     * Get category-specific reflex data (oversaturated patterns in a category)
     */
    getCategoryReflex(category) {
        const reflexData = [];
        for (const [patternName, patternData] of Object.entries(OVERSATURATED_PATTERNS)) {
            if (patternData.domains.some((d) => category.toLowerCase().includes(d))) {
                reflexData.push(`${patternName} (oversaturated until ${patternData.saturatedUntil})`);
            }
        }
        return reflexData;
    }
    /**
     * Analyze why a reference is generic (detailed report)
     */
    analyzeGenericity(reference) {
        const result = this.detectSlop(reference);
        const factors = [];
        const suggestions = [];
        if (result.genericityScore >= 80) {
            factors.push('Matches multiple oversaturated patterns');
            suggestions.push('Consider finding a more unique reference');
        }
        else if (result.genericityScore >= 70) {
            factors.push('Contains trending but oversaturated elements');
            suggestions.push('Use selectively; extract specific details rather than wholesale copying');
        }
        else if (result.genericityScore >= 50) {
            factors.push('Some generic elements; overall unique approach');
            suggestions.push('Useful reference for specific interactions or color palettes');
        }
        else {
            factors.push('Highly unique design approach');
            suggestions.push('Strong reference for learning novel patterns');
        }
        // Add specific pattern-based factors
        for (const pattern of result.oversaturatedPatterns) {
            factors.push(`Contains: ${pattern}`);
            suggestions.push(this.getSuggestionForPattern(pattern));
        }
        return {
            score: result.genericityScore,
            factors: [...new Set(factors)], // Deduplicate
            suggestions: [...new Set(suggestions)],
        };
    }
    // Private helper methods
    matchPatternSignature(reference, patterns) {
        let matches = 0;
        const referenceText = `${reference.title} ${reference.description} ${reference.category}`.toLowerCase();
        for (const pattern of patterns) {
            if (referenceText.includes(pattern.toLowerCase())) {
                matches++;
            }
        }
        return matches > 0 ? matches / patterns.length : 0;
    }
    analyzeDescriptionGenericity(reference) {
        const genericTerms = [
            'modern',
            'clean',
            'minimal',
            'simple',
            'elegant',
            'beautiful',
            'stunning',
            'gorgeous',
            'amazing',
            'awesome',
            'unique',
            'innovative',
            'cutting-edge',
            'responsive',
            'mobile-friendly',
        ];
        const descLower = reference.description.toLowerCase();
        let score = 0;
        for (const term of genericTerms) {
            if (descLower.includes(term)) {
                score += 5;
            }
        }
        // Penalize lack of specifics
        if (!descLower.includes('color') && !descLower.includes('font') && !descLower.includes('spacing')) {
            score += 10;
        }
        if (reference.description.length < 50) {
            score += 15; // Short descriptions tend to be generic
        }
        if (!reference.colorPalette || reference.colorPalette.length === 0) {
            score += 10;
        }
        return Math.min(100, score);
    }
    determineVerdict(score) {
        if (score >= 80)
            return 'discard'; // Highly generic
        if (score >= 60)
            return 'flag'; // Moderately generic, use cautiously
        return 'keep'; // Unique enough to use
    }
    generateReasoning(reference, score, patterns) {
        if (score >= 80) {
            return `Highly generic design (${score}/100). Matches oversaturated pattern${patterns.length > 1 ? 's' : ''}: ${patterns.slice(0, 2).join(', ')}. Consider finding a more distinctive reference.`;
        }
        if (score >= 60) {
            return `Moderately generic (${score}/100). Contains trending elements: ${patterns.slice(0, 2).join(', ')}. Useful for specific details but avoid wholesale copying.`;
        }
        return `Relatively unique design (${score}/100). Good reference potential for novel patterns and approaches.`;
    }
    getSuggestionForPattern(pattern) {
        const suggestions = {
            'Hero-Metric Dashboard': 'If using this pattern, vary the layout with asymmetric grids',
            'Glassmorphism Overlay': 'Reserve glassmorphism for modal/overlay contexts only',
            'Identical Card Grids': 'Create visual hierarchy with varied card sizes and spacing',
            'Colorful Gradient Borders': 'Use subtle borders; avoid neon gradients',
            'Side-Stripe Design': 'Use bottom border or box-shadow instead of side accents',
            'Infinite Scroll Feed': 'Implement proper pagination with user control',
            'Floating Action Button': 'Consider fixed button bar or sticky footer for mobile',
            'Parallax Scrolling': 'Use sparingly; test accessibility and performance',
            'Bento Grid Layout': 'Balance trendy layout with readability and usability',
            'Animated SVG Icons': 'Only animate if it serves a functional purpose',
            'Split-Screen Layout': 'Ensure responsive behavior; test on mobile devices',
            'Neumorphism Design': 'If using, ensure sufficient contrast for accessibility',
            'Duotone Imagery': 'Use selectively; preserve image authenticity where needed',
            'Typography-Heavy Hero': 'Pair with supporting imagery or visual elements',
        };
        return suggestions[pattern] || 'Review this pattern against current design trends';
    }
}
exports.CategoryReflexDetector = CategoryReflexDetector;
function createCategoryReflexDetector() {
    return new CategoryReflexDetector();
}
//# sourceMappingURL=category-reflex-detector.js.map