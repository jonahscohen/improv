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
const teach_deep_interview_1 = require("./teach-deep-interview");
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
        const rawBrief = this.extractBrief(context.utterance);
        // T-0023: detect --deep / --quick / --standard flag, strip from brief.
        const flagFromBrief = (0, teach_deep_interview_1.parseDeepFlag)(rawBrief);
        const flagFromMeta = context.metadata?.depth;
        const depth = flagFromMeta ?? flagFromBrief.depth;
        const brief = flagFromBrief.brief;
        const isDeep = depth === 'deep';
        const extracted = this.parseBrief(brief, { deep: isDeep });
        const teachAnswers = context.metadata?.teachAnswers || {};
        const merged = this.mergeFromBriefAndAnswers(extracted, teachAnswers, { deep: isDeep });
        // T-0023: demote vague high-confidence answers in deep mode only. Standard
        // (non-deep) mode keeps the pre-T-0023 behavior verbatim - "developers" and
        // similar bare-word answers count as high confidence so existing teach flows
        // continue to write PRODUCT.md without prompting for follow-ups. Deep mode
        // is opt-in and runs the OMC-style weakest-dimension targeting.
        if (isDeep) {
            this.demoteVagueAnswers(merged, isDeep);
        }
        const gaps = this.identifyGaps(merged, { deep: isDeep });
        const ambiguity = (0, teach_deep_interview_1.ambiguityScore)(merged.confidence, this.fieldsForDepth(isDeep));
        if (gaps.length > 0 && !context.metadata?.skipInteractive) {
            // T-0023: weakest-dimension targeting - sort gaps by ambiguity dimension
            // so the user sees the highest-leverage question first.
            const guidanceHeader = isDeep
                ? [
                    'Deep interview mode: extracting 9 fields (5 core + 4 extended).',
                    `Current ambiguity: ${(ambiguity.ambiguity * 100).toFixed(0)}% (target: <=20%).`,
                    ambiguity.weakest
                        ? `Weakest dimension: ${ambiguity.weakest} (clarity: ${(ambiguity.perDimension[ambiguity.weakest] * 100).toFixed(0)}%).`
                        : 'All dimensions are clear.',
                    '',
                ]
                : [];
            return {
                flowId: 'teach',
                flowName: 'Sidecoach Teach',
                status: 'pending',
                message: `Brief partially parsed. ${gaps.length} field(s) need answers.${isDeep ? ' (deep interview mode)' : ''}`,
                guidance: [
                    ...guidanceHeader,
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
                        content: JSON.stringify({ extracted: merged, gaps, ambiguity, depth }, null, 2),
                        description: 'Parsed brief state + outstanding gaps + ambiguity score',
                    },
                ],
            };
        }
        const content = this.generateProductMd(merged, { deep: isDeep });
        fs.writeFileSync(productMdPath, content, 'utf-8');
        // T-0023: structured validation after write.
        const validation = (0, teach_deep_interview_1.validateProductMd)(content, {
            register: merged.register,
            deep: isDeep,
        });
        const guidance = [
            `Register: ${merged.register}`,
            `Users: ${merged.users}`,
            merged.register === 'brand' && merged.brandPersonality
                ? `Brand personality: ${merged.brandPersonality}`
                : '',
            `Anti-references: ${(merged.antiReferences || []).join('; ')}`,
            `Strategic principles: ${(merged.strategicPrinciples || []).join('; ')}`,
        ].filter((s) => s.length > 0);
        if (isDeep) {
            if (merged.problem)
                guidance.push(`Problem: ${merged.problem}`);
            if (merged.successMetrics?.length)
                guidance.push(`Success metrics: ${merged.successMetrics.join('; ')}`);
            if (merged.businessModel)
                guidance.push(`Business model: ${merged.businessModel}`);
            if (merged.technicalConstraints?.length)
                guidance.push(`Technical constraints: ${merged.technicalConstraints.join('; ')}`);
            if (merged.brandVoice)
                guidance.push(`Brand voice: ${merged.brandVoice}`);
            guidance.push('');
            guidance.push(`Ambiguity: ${(ambiguity.ambiguity * 100).toFixed(0)}% (target: <=20%).`);
            if (validation.warnings.length === 0) {
                guidance.push('PRODUCT.md validation: clean.');
            }
            else {
                guidance.push(`PRODUCT.md validation: ${validation.warnings.length} warning(s):`);
                for (const w of validation.warnings)
                    guidance.push(`  - ${w}`);
            }
            // DESIGN.md handoff hint.
            const designMdPath = path.join(projectPath, 'DESIGN.md');
            if (!fs.existsSync(designMdPath)) {
                guidance.push('');
                guidance.push('Next step: PRODUCT.md is set. If the project has CSS, run /sidecoach document to write DESIGN.md.');
            }
        }
        const checklist = [
            { id: 'register', label: 'Register confirmed', required: true, completed: true },
            { id: 'users', label: 'Users documented', required: true, completed: true },
            { id: 'anti', label: 'Anti-references captured', required: true, completed: true },
            { id: 'principles', label: 'Strategic principles documented', required: true, completed: true },
        ];
        if (isDeep) {
            checklist.push({ id: 'problem', label: 'Problem statement documented', required: true, completed: !!merged.problem }, { id: 'metrics', label: 'Success metrics defined', required: true, completed: (merged.successMetrics?.length ?? 0) > 0 }, { id: 'model', label: 'Business model captured', required: true, completed: !!merged.businessModel }, { id: 'tech', label: 'Technical constraints listed', required: true, completed: (merged.technicalConstraints?.length ?? 0) > 0 });
            if (merged.register === 'brand') {
                checklist.push({
                    id: 'voice',
                    label: 'Brand voice documented',
                    required: true,
                    completed: !!merged.brandVoice,
                });
            }
            checklist.push({
                id: 'validation',
                label: `PRODUCT.md validation clean (${validation.warnings.length} warnings)`,
                required: true,
                completed: validation.ok,
            });
        }
        return {
            flowId: 'teach',
            flowName: 'Sidecoach Teach',
            status: 'success',
            message: `PRODUCT.md written to ${productMdPath} from brief + answers.${isDeep ? ' (deep interview mode)' : ''}`,
            guidance,
            checklist,
            artifacts: isDeep
                ? [
                    {
                        type: 'reference',
                        name: 'teach-state',
                        content: JSON.stringify({ extracted: merged, ambiguity, validation, depth }, null, 2),
                        description: 'Final extraction + ambiguity score + validation result',
                    },
                ]
                : undefined,
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
    fieldsForDepth(deep) {
        return deep ? teach_deep_interview_1.DEEP_FIELDS : teach_deep_interview_1.CORE_FIELDS;
    }
    demoteVagueAnswers(merged, deep) {
        const fields = this.fieldsForDepth(deep);
        for (const f of fields) {
            // Skip brandPersonality/brandVoice if register != brand
            if ((f === 'brandPersonality' || f === 'brandVoice') && merged.register !== 'brand')
                continue;
            const value = merged[f];
            if (merged.confidence[f] !== 'high')
                continue;
            // For list-typed fields, vague-check the joined string.
            const strValue = Array.isArray(value) ? value.join('; ') : value;
            if ((0, teach_deep_interview_1.isVagueAnswer)(f, strValue)) {
                merged.confidence[f] = 'low';
            }
        }
    }
    parseBrief(brief, opts = {}) {
        const fields = this.fieldsForDepth(!!opts.deep);
        const e = { confidence: {} };
        if (!brief) {
            fields.forEach((f) => (e.confidence[f] = 'absent'));
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
        // T-0023 extended fields - only parsed in deep mode but always recorded
        // in confidence map (absent) so identifyGaps can use them.
        if (opts.deep) {
            // Problem statement
            const problemMatch = brief.match(/problem:\s*([^.]+\.)/i) ||
                brief.match(/(?:pain|frustration):\s*([^.]+\.)/i);
            if (problemMatch) {
                e.problem = problemMatch[1].trim().replace(/\.$/, '');
                e.confidence.problem = 'high';
            }
            else {
                e.confidence.problem = 'absent';
            }
            // Success metrics
            const metricsMatch = brief.match(/success metrics?:\s*([^.]+\.)/i) ||
                brief.match(/(?:kpis?|metrics?):\s*([^.]+\.)/i);
            if (metricsMatch) {
                const items = metricsMatch[1]
                    .split(/;|,/)
                    .map((s) => s.trim().replace(/\.$/, ''))
                    .filter((s) => s.length > 2);
                e.successMetrics = items;
                e.confidence.successMetrics = items.length > 0 ? 'high' : 'low';
            }
            else {
                e.confidence.successMetrics = 'absent';
            }
            // Business model
            const modelMatch = brief.match(/business model:\s*([^.]+\.)/i) ||
                brief.match(/(?:monetization|pricing):\s*([^.]+\.)/i);
            if (modelMatch) {
                e.businessModel = modelMatch[1].trim().replace(/\.$/, '');
                e.confidence.businessModel = 'high';
            }
            else {
                e.confidence.businessModel = 'absent';
            }
            // Technical constraints
            const techMatch = brief.match(/technical constraints?:\s*([^.]+\.)/i) ||
                brief.match(/(?:browser|platform|stack)(?:\s+constraints?)?:\s*([^.]+\.)/i);
            if (techMatch) {
                const items = techMatch[1]
                    .split(/;|,/)
                    .map((s) => s.trim().replace(/\.$/, ''))
                    .filter((s) => s.length > 2);
                e.technicalConstraints = items;
                e.confidence.technicalConstraints = items.length > 0 ? 'high' : 'low';
            }
            else {
                e.confidence.technicalConstraints = 'absent';
            }
            // Brand voice (brand register only)
            if (e.register === 'brand') {
                const voiceMatch = brief.match(/brand voice:\s*([^.]+\.)/i) ||
                    brief.match(/(?:vocabulary|word\s*choice):\s*([^.]+\.)/i);
                if (voiceMatch) {
                    e.brandVoice = voiceMatch[1].trim().replace(/\.$/, '');
                    e.confidence.brandVoice = 'high';
                }
                else {
                    e.confidence.brandVoice = 'absent';
                }
            }
            else {
                e.confidence.brandVoice = 'absent';
            }
        }
        return e;
    }
    mergeFromBriefAndAnswers(extracted, answers, opts = {}) {
        const m = { ...extracted, confidence: { ...extracted.confidence } };
        const keys = this.fieldsForDepth(!!opts.deep);
        for (const key of keys) {
            if (answers[key] !== undefined && m.confidence[key] !== 'high') {
                m[key] = answers[key];
                m.confidence[key] = 'high';
            }
        }
        return m;
    }
    identifyGaps(e, opts = {}) {
        const gaps = [];
        if (e.confidence.register !== 'high') {
            gaps.push({
                field: 'register',
                question: e.confidence.register === 'low' && e.register
                    ? (0, teach_deep_interview_1.generateFollowUpQuestion)('register', String(e.register))
                    : 'Brand or product register?',
            });
        }
        if (e.confidence.users !== 'high') {
            gaps.push({
                field: 'users',
                question: e.confidence.users === 'low' && e.users
                    ? (0, teach_deep_interview_1.generateFollowUpQuestion)('users', e.users)
                    : 'Who are the primary users?',
            });
        }
        if (e.register === 'brand' && e.confidence.brandPersonality !== 'high') {
            gaps.push({
                field: 'brandPersonality',
                question: e.confidence.brandPersonality === 'low' && e.brandPersonality
                    ? (0, teach_deep_interview_1.generateFollowUpQuestion)('brandPersonality', e.brandPersonality)
                    : 'Brand personality / voice / tone?',
            });
        }
        if (e.confidence.antiReferences !== 'high') {
            gaps.push({
                field: 'antiReferences',
                question: e.confidence.antiReferences === 'low'
                    ? (0, teach_deep_interview_1.generateFollowUpQuestion)('antiReferences', (e.antiReferences || []).join('; '))
                    : 'Anti-references - what should this NOT look like?',
            });
        }
        if (e.confidence.strategicPrinciples !== 'high') {
            gaps.push({
                field: 'strategicPrinciples',
                question: e.confidence.strategicPrinciples === 'low'
                    ? (0, teach_deep_interview_1.generateFollowUpQuestion)('strategicPrinciples', (e.strategicPrinciples || []).join('; '))
                    : 'Strategic principles - 2-4 guiding design principles?',
            });
        }
        if (opts.deep) {
            if (e.confidence.problem !== 'high') {
                gaps.push({
                    field: 'problem',
                    question: e.confidence.problem === 'low' && e.problem
                        ? (0, teach_deep_interview_1.generateFollowUpQuestion)('problem', e.problem)
                        : 'Problem - what specific pain are we solving? (write in "users have to do X, costs them Y" form)',
                });
            }
            if (e.confidence.successMetrics !== 'high') {
                gaps.push({
                    field: 'successMetrics',
                    question: e.confidence.successMetrics === 'low'
                        ? (0, teach_deep_interview_1.generateFollowUpQuestion)('successMetrics', (e.successMetrics || []).join('; '))
                        : 'Success metrics - 1-3 measurable numbers (count, %, ratio) you would check in 30 days?',
                });
            }
            if (e.confidence.businessModel !== 'high') {
                gaps.push({
                    field: 'businessModel',
                    question: e.confidence.businessModel === 'low' && e.businessModel
                        ? (0, teach_deep_interview_1.generateFollowUpQuestion)('businessModel', e.businessModel)
                        : 'Business model - free? paid (one-time / subscription)? B2B / B2C / internal? who pays?',
                });
            }
            if (e.confidence.technicalConstraints !== 'high') {
                gaps.push({
                    field: 'technicalConstraints',
                    question: e.confidence.technicalConstraints === 'low'
                        ? (0, teach_deep_interview_1.generateFollowUpQuestion)('technicalConstraints', (e.technicalConstraints || []).join('; '))
                        : 'Technical constraints - browsers, accessibility tier, framework lock-in, performance budget?',
                });
            }
            if (e.register === 'brand' && e.confidence.brandVoice !== 'high') {
                gaps.push({
                    field: 'brandVoice',
                    question: e.confidence.brandVoice === 'low' && e.brandVoice
                        ? (0, teach_deep_interview_1.generateFollowUpQuestion)('brandVoice', e.brandVoice)
                        : 'Brand voice - 3 example sentences, most-used word, forbidden word?',
                });
            }
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
        if (e.problem)
            out.push(`- problem: ${e.problem}`);
        if (e.successMetrics && e.successMetrics.length > 0) {
            out.push(`- success metrics: ${e.successMetrics.join('; ')}`);
        }
        if (e.businessModel)
            out.push(`- business model: ${e.businessModel}`);
        if (e.technicalConstraints && e.technicalConstraints.length > 0) {
            out.push(`- technical constraints: ${e.technicalConstraints.join('; ')}`);
        }
        if (e.brandVoice)
            out.push(`- brand voice: ${e.brandVoice}`);
        return out;
    }
    generateProductMd(e, opts = {}) {
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
        if (opts.deep && e.problem) {
            lines.push('## Problem');
            lines.push('');
            lines.push(e.problem);
            lines.push('');
        }
        if (e.register === 'brand' && e.brandPersonality) {
            lines.push('## Brand Personality');
            lines.push('');
            lines.push(e.brandPersonality);
            lines.push('');
        }
        if (opts.deep && e.register === 'brand' && e.brandVoice) {
            lines.push('## Brand Voice');
            lines.push('');
            lines.push(e.brandVoice);
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
        if (opts.deep) {
            if (e.successMetrics && e.successMetrics.length > 0) {
                lines.push('## Success Metrics');
                lines.push('');
                for (const m of e.successMetrics)
                    lines.push(`- ${m}`);
                lines.push('');
            }
            if (e.businessModel) {
                lines.push('## Business Model');
                lines.push('');
                lines.push(e.businessModel);
                lines.push('');
            }
            if (e.technicalConstraints && e.technicalConstraints.length > 0) {
                lines.push('## Technical Constraints');
                lines.push('');
                for (const t of e.technicalConstraints)
                    lines.push(`- ${t}`);
                lines.push('');
            }
        }
        return lines.join('\n');
    }
}
exports.TeachCommandHandlerV2 = TeachCommandHandlerV2;
//# sourceMappingURL=teach-command-handler-v2.js.map