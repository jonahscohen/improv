"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.TeachCommandHandlerV2 = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * TeachCommandHandlerV2 - brief-driven hybrid handler.
 *
 * Replaces the old hardcoded-default stub. The handler parses a user's brief from
 * `context.utterance`, extracts the five PRODUCT.md fields (register, users,
 * brandPersonality, antiReferences, strategicPrinciples), identifies gaps, and
 * either returns a pending-with-questions result OR writes PRODUCT.md when the
 * brief plus any supplied teachAnswers cover all required fields.
 *
 * Constraints honored in the generated PRODUCT.md:
 * - No self-attribution lines
 * - No references to /sidecoach
 * - Brand Personality section only present when register=brand
 * - Will not overwrite a real existing PRODUCT.md (>=200 chars, no [TODO]
 *   placeholders) unless metadata.forceOverwrite is true.
 */
class TeachCommandHandlerV2 {
    async execute(context) {
        const projectPath = context.projectPath || process.cwd();
        const productMdPath = path.join(projectPath, 'PRODUCT.md');
        // Refuse to overwrite real PRODUCT.md without explicit force.
        if (this.hasRealProductMd(productMdPath) && !context.metadata?.forceOverwrite) {
            return {
                flowId: 'teach',
                flowName: 'Sidecoach Teach',
                status: 'error',
                message: `PRODUCT.md exists at ${productMdPath} (>=200 chars of real content). Pass metadata.forceOverwrite=true to replace.`,
                error: 'PRODUCT.md exists',
                guidance: [],
                checklist: [],
            };
        }
        const brief = this.extractBrief(context.utterance);
        const extracted = this.parseBrief(brief);
        const teachAnswers = context.metadata?.teachAnswers || {};
        const merged = this.mergeFromBriefAndAnswers(extracted, teachAnswers);
        const gaps = this.identifyGaps(merged);
        if (gaps.length > 0 && !context.metadata?.skipInteractive) {
            return {
                flowId: 'teach',
                flowName: 'Sidecoach Teach',
                status: 'pending',
                message: `Brief partially parsed. ${gaps.length} field(s) need answers.`,
                guidance: [
                    'Brief extracted these fields:',
                    ...this.summarizeExtracted(merged),
                    '',
                    'Missing or low-confidence fields - awaiting answers:',
                    ...gaps.map((g) => `- ${g.field}: ${g.question}`),
                ],
                checklist: gaps.map((g) => ({
                    id: g.field,
                    label: `Answer: ${g.question}`,
                    required: true,
                    completed: false,
                })),
                artifacts: [
                    {
                        type: 'reference',
                        name: 'teach-state',
                        content: JSON.stringify({ extracted: merged, gaps }, null, 2),
                        description: 'Parsed brief state + outstanding gaps',
                    },
                ],
            };
        }
        const content = this.generateProductMd(merged);
        fs.writeFileSync(productMdPath, content, 'utf-8');
        return {
            flowId: 'teach',
            flowName: 'Sidecoach Teach',
            status: 'success',
            message: `PRODUCT.md written to ${productMdPath} from brief + answers.`,
            guidance: [
                `Register: ${merged.register}`,
                `Users: ${merged.users}`,
                merged.register === 'brand' && merged.brandPersonality
                    ? `Brand personality: ${merged.brandPersonality}`
                    : '',
                `Anti-references: ${(merged.antiReferences || []).join('; ')}`,
                `Strategic principles: ${(merged.strategicPrinciples || []).join('; ')}`,
            ].filter((s) => s.length > 0),
            checklist: [
                { id: 'register', label: 'Register confirmed', required: true, completed: true },
                { id: 'users', label: 'Users documented', required: true, completed: true },
                { id: 'anti', label: 'Anti-references captured', required: true, completed: true },
                { id: 'principles', label: 'Strategic principles documented', required: true, completed: true },
            ],
        };
    }
    hasRealProductMd(productPath) {
        if (!fs.existsSync(productPath))
            return false;
        const content = fs.readFileSync(productPath, 'utf-8');
        if (content.length < 200)
            return false;
        if (/\[TODO\]/i.test(content))
            return false;
        return true;
    }
    extractBrief(utterance) {
        // Strip the leading slash command if present.
        return (utterance || '').replace(/^\/sidecoach\s+teach\s*/i, '').trim();
    }
    parseBrief(brief) {
        const e = { confidence: {} };
        if (!brief) {
            ['register', 'users', 'brandPersonality', 'antiReferences', 'strategicPrinciples'].forEach((f) => (e.confidence[f] = 'absent'));
            return e;
        }
        // Register - explicit "register: brand" or "register: product" wins;
        // bare "brand" / "product" only counts if exactly one appears.
        const registerExplicit = brief.match(/register:\s*(brand|product)\b/i);
        if (registerExplicit) {
            e.register = registerExplicit[1].toLowerCase();
            e.confidence.register = 'high';
        }
        else {
            const hasBrand = /\bbrand\b/i.test(brief);
            const hasProduct = /\b(?:product|saas|app|tool)\b/i.test(brief);
            if (hasBrand && !hasProduct) {
                e.register = 'brand';
                e.confidence.register = 'high';
            }
            else if (hasProduct && !hasBrand) {
                e.register = 'product';
                e.confidence.register = 'high';
            }
            else {
                e.confidence.register = 'absent';
            }
        }
        // Users - look for "users:" or "for X" / "audience:" / "target:" patterns.
        const usersMatch = brief.match(/users?:\s*([^.]+\.)/i) ||
            brief.match(/(?:for|target|audience:?)\s+([^.]{8,}\.)/i);
        if (usersMatch) {
            e.users = usersMatch[1].trim().replace(/\.$/, '');
            e.confidence.users = 'high';
        }
        else {
            e.confidence.users = 'absent';
        }
        // Brand personality (only when register=brand)
        if (e.register === 'brand') {
            const personalityMatch = brief.match(/brand\s+personality:\s*([^.]+\.)/i) ||
                brief.match(/(?:voice|tone|personality|feel):\s*([^.]+\.)/i);
            if (personalityMatch) {
                e.brandPersonality = personalityMatch[1].trim().replace(/\.$/, '');
                e.confidence.brandPersonality = 'high';
            }
            else {
                e.confidence.brandPersonality = 'absent';
            }
        }
        else {
            // For product register, brand personality is not required - mark absent
            // but identifyGaps will skip it.
            e.confidence.brandPersonality = 'absent';
        }
        // Anti-references
        const antiMatch = brief.match(/anti-?references?:\s*([^.]+\.)/i);
        if (antiMatch) {
            const items = antiMatch[1]
                .split(/,|;/)
                .map((s) => s.trim().replace(/\.$/, ''))
                .filter((s) => s.length > 2);
            e.antiReferences = items;
            e.confidence.antiReferences = items.length > 0 ? 'high' : 'low';
        }
        else {
            e.confidence.antiReferences = 'absent';
        }
        // Strategic principles
        const stratMatch = brief.match(/strategic principles?:\s*([^.]+\.?)$/i) ||
            brief.match(/strategic principles?:\s*([^.]+\.)/i);
        if (stratMatch) {
            const items = stratMatch[1]
                .split(/;|,/)
                .map((s) => s.trim().replace(/\.$/, ''))
                .filter((s) => s.length > 4);
            e.strategicPrinciples = items;
            e.confidence.strategicPrinciples = items.length > 0 ? 'high' : 'low';
        }
        else {
            e.confidence.strategicPrinciples = 'absent';
        }
        return e;
    }
    mergeFromBriefAndAnswers(extracted, answers) {
        const m = { ...extracted, confidence: { ...extracted.confidence } };
        for (const key of [
            'register',
            'users',
            'brandPersonality',
            'antiReferences',
            'strategicPrinciples',
        ]) {
            if (answers[key] !== undefined && m.confidence[key] !== 'high') {
                m[key] = answers[key];
                m.confidence[key] = 'high';
            }
        }
        return m;
    }
    identifyGaps(e) {
        const gaps = [];
        if (e.confidence.register !== 'high') {
            gaps.push({ field: 'register', question: 'Brand or product register?' });
        }
        if (e.confidence.users !== 'high') {
            gaps.push({ field: 'users', question: 'Who are the primary users?' });
        }
        if (e.register === 'brand' && e.confidence.brandPersonality !== 'high') {
            gaps.push({ field: 'brandPersonality', question: 'Brand personality / voice / tone?' });
        }
        if (e.confidence.antiReferences !== 'high') {
            gaps.push({
                field: 'antiReferences',
                question: 'Anti-references - what should this NOT look like?',
            });
        }
        if (e.confidence.strategicPrinciples !== 'high') {
            gaps.push({
                field: 'strategicPrinciples',
                question: 'Strategic principles - 2-4 guiding design principles?',
            });
        }
        return gaps;
    }
    summarizeExtracted(e) {
        const out = [];
        if (e.register)
            out.push(`- register: ${e.register}`);
        if (e.users)
            out.push(`- users: ${e.users}`);
        if (e.brandPersonality)
            out.push(`- brand personality: ${e.brandPersonality}`);
        if (e.antiReferences && e.antiReferences.length > 0) {
            out.push(`- anti-references: ${e.antiReferences.join('; ')}`);
        }
        if (e.strategicPrinciples && e.strategicPrinciples.length > 0) {
            out.push(`- strategic principles: ${e.strategicPrinciples.join('; ')}`);
        }
        return out;
    }
    generateProductMd(e) {
        const lines = [];
        lines.push('# PRODUCT.md');
        lines.push('');
        lines.push('## Register');
        lines.push('');
        lines.push(e.register === 'brand' ? '**Brand**' : '**Product**');
        lines.push('');
        lines.push('## Primary Users');
        lines.push('');
        lines.push(e.users || '');
        lines.push('');
        if (e.register === 'brand' && e.brandPersonality) {
            lines.push('## Brand Personality');
            lines.push('');
            lines.push(e.brandPersonality);
            lines.push('');
        }
        lines.push('## Anti-References');
        lines.push('');
        lines.push('What this should NOT look like:');
        lines.push('');
        for (const a of e.antiReferences || []) {
            lines.push(`- ${a}`);
        }
        lines.push('');
        lines.push('## Strategic Principles');
        lines.push('');
        for (const p of e.strategicPrinciples || []) {
            lines.push(`- ${p}`);
        }
        lines.push('');
        return lines.join('\n');
    }
}
exports.TeachCommandHandlerV2 = TeachCommandHandlerV2;
//# sourceMappingURL=teach-command-handler-v2.js.map