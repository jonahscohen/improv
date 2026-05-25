"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectPersonaEngine = void 0;
exports.createPersonaEngine = createPersonaEngine;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
/**
 * Fallback generic personas (5 archetype patterns)
 * Used when PRODUCT.md parsing fails or LLM extraction unavailable
 */
const GENERIC_PERSONAS = [
    {
        name: 'Alex',
        role: 'Power User',
        goals: ['Work efficiently', 'Master all features', 'Customize everything'],
        frustrations: ['Limited options', 'Slow workflows', 'Over-simplification'],
        techComfort: 'high',
        accessibilityNeeds: [],
        testingFocus: 'edge cases and customization',
    },
    {
        name: 'Jordan',
        role: 'Designer',
        goals: ['Create beautiful work', 'Collaborate seamlessly', 'Stay on brand'],
        frustrations: ['Clunky interfaces', 'Misaligned pixels', 'Communication gaps'],
        techComfort: 'medium',
        accessibilityNeeds: ['Color contrast verification'],
        testingFocus: 'visual consistency and responsive behavior',
    },
    {
        name: 'Sam',
        role: 'Manager',
        goals: ['Get results fast', 'Monitor team progress', 'Reduce friction'],
        frustrations: ['Overhead', 'Hidden information', 'Missed deadlines'],
        techComfort: 'low',
        accessibilityNeeds: ['Clear status indicators', 'Readable text'],
        testingFocus: 'critical paths and error recovery',
    },
    {
        name: 'Riley',
        role: 'Developer',
        goals: ['Write clean code', 'Ship quickly', 'Fix bugs fast'],
        frustrations: ['Poor documentation', 'API inconsistency', 'Performance issues'],
        techComfort: 'high',
        accessibilityNeeds: [],
        testingFocus: 'error handling and integration',
    },
    {
        name: 'Casey',
        role: 'New User',
        goals: ['Understand basics', 'Get help when stuck', 'Build confidence'],
        frustrations: ['Steep learning curve', 'Jargon', 'Unhelpful errors'],
        techComfort: 'low',
        accessibilityNeeds: ['Clear labels', 'Context help', 'Readable fonts'],
        testingFocus: 'onboarding and first-run experience',
    },
];
class ProjectPersonaEngine {
    constructor() {
        this.client = new sdk_1.default();
    }
    /**
     * Extract 3 project-specific personas from freeform PRODUCT.md
     * Async - uses Claude to parse unstructured content
     * Fallback to generic personas if extraction fails
     */
    async generate(productMdContent) {
        // If PRODUCT.md is empty or too short, fall back to generic
        if (!productMdContent || productMdContent.length < 100) {
            return GENERIC_PERSONAS;
        }
        try {
            const response = await this.client.messages.create({
                model: 'claude-opus-4-5',
                max_tokens: 2048,
                messages: [
                    {
                        role: 'user',
                        content: `Extract 3 specific user personas from this PRODUCT.md content. Return a JSON array with 3 personas matching this schema:

{
  "name": "string - persona name",
  "role": "string - job title or role",
  "goals": ["string array - 3-4 specific goals"],
  "frustrations": ["string array - 3-4 specific pain points"],
  "techComfort": "high|medium|low",
  "accessibilityNeeds": ["string array - specific accessibility requirements"],
  "testingFocus": "string - what aspect to test for this persona"
}

Focus on extracting from real project context (users, brand, strategy, anti-references). Avoid generic descriptions. Return ONLY valid JSON array.

PRODUCT.md:
${productMdContent}`,
                    },
                ],
            });
            // Extract JSON from response
            const content = response.content[0];
            if (content.type !== 'text') {
                return GENERIC_PERSONAS;
            }
            // Parse JSON - look for array within the text
            const jsonMatch = content.text.match(/\[[\s\S]*\]/);
            if (!jsonMatch) {
                return GENERIC_PERSONAS;
            }
            const parsed = JSON.parse(jsonMatch[0]);
            // Validate structure
            if (!Array.isArray(parsed) || parsed.length === 0) {
                return GENERIC_PERSONAS;
            }
            // Ensure we have exactly 3 personas, pad with generic if needed
            if (parsed.length < 3) {
                return [...parsed, ...GENERIC_PERSONAS.slice(0, 3 - parsed.length)];
            }
            return parsed.slice(0, 3);
        }
        catch (error) {
            // On any error (API, parse, timeout), fall back to generic
            console.error('ProjectPersonaEngine extraction failed:', error);
            return GENERIC_PERSONAS;
        }
    }
    /**
     * Convert personas into a critique prompt for design review
     */
    toCritiquePrompt(personas) {
        const personaDescriptions = personas
            .map((p) => `- **${p.name}** (${p.role}): Goals ${p.goals.join(', ')}. Frustrations: ${p.frustrations.join(', ')}. Tech comfort: ${p.techComfort}. Accessibility: ${p.accessibilityNeeds.length > 0 ? p.accessibilityNeeds.join(', ') : 'none specified'}.`)
            .join('\n');
        return `Review this design through the lens of these project personas:

${personaDescriptions}

For each persona, assess whether the design serves their goals and accommodates their frustrations and accessibility needs.`;
    }
}
exports.ProjectPersonaEngine = ProjectPersonaEngine;
function createPersonaEngine() {
    return new ProjectPersonaEngine();
}
//# sourceMappingURL=persona-engine.js.map