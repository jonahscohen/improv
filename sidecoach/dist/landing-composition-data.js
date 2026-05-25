"use strict";
// Register-aware landing-page composition data.
// Brand register: atmospheric, fewer/larger sections, more whitespace.
// Product register: more sections, social proof and FAQ patterns, denser rhythm.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSectionTaxonomy = getSectionTaxonomy;
exports.getRhythmRules = getRhythmRules;
exports.getAntiPatternCallouts = getAntiPatternCallouts;
exports.findSection = findSection;
const BRAND_TAXONOMY = [
    {
        id: 'hero',
        name: 'Hero',
        purpose: 'Establish mood and identity in one breath',
        slots: [
            { id: 'headline', label: 'Headline (<=8 words, evocative)', required: true },
            { id: 'supporting_line', label: 'Supporting line (mood, not feature)', required: true },
            { id: 'primary_cta', label: 'Single CTA (entry verb: enter / begin / explore)', required: true },
        ],
    },
    {
        id: 'manifesto',
        name: 'Manifesto / Philosophy',
        purpose: 'State the worldview that shapes the work',
        slots: [
            { id: 'lede', label: 'Opening sentence (declarative)', required: true },
            { id: 'body_paragraph', label: 'Supporting paragraph (2-4 sentences)', required: true },
        ],
    },
    {
        id: 'selected_work',
        name: 'Selected Work',
        purpose: 'Curated proof - 3 to 6 projects, generous spacing',
        slots: [
            { id: 'section_label', label: 'Section label (small caps, sparse)', required: false },
            { id: 'project_caption', label: 'Per-project caption (title + 1 line)', required: true },
        ],
    },
    {
        id: 'about',
        name: 'About',
        purpose: 'Origin, point of view, one human note',
        slots: [
            { id: 'heading', label: 'Heading (1-3 words)', required: true },
            { id: 'body', label: 'Body (single paragraph, <=80 words)', required: true },
        ],
    },
    {
        id: 'contact',
        name: 'Contact',
        purpose: 'One clear way in - email, form, or booking link',
        slots: [
            { id: 'invitation', label: 'Invitation line (warm, specific)', required: true },
            { id: 'method', label: 'Method (mailto, link, or form)', required: true },
        ],
    },
];
const PRODUCT_TAXONOMY = [
    {
        id: 'hero',
        name: 'Hero',
        purpose: 'Deliver clear value prop + two CTAs (primary + secondary)',
        slots: [
            { id: 'headline', label: 'Headline (outcome-specific, <=10 words)', required: true },
            { id: 'supporting_line', label: 'Supporting line (clarifying sentence)', required: true },
            { id: 'primary_cta', label: 'Primary CTA (Start free / Get started)', required: true },
            { id: 'secondary_cta', label: 'Secondary CTA (See demo / Pricing)', required: false },
        ],
    },
    {
        id: 'social_proof',
        name: 'Social Proof',
        purpose: 'Logos, customer count, or notable mention - reduce hesitation',
        slots: [
            { id: 'attribution_label', label: 'Attribution label ("Trusted by" / "Used at")', required: true },
            { id: 'logos_or_count', label: 'Logo strip or count claim', required: true },
        ],
    },
    {
        id: 'feature_triad',
        name: 'Feature Triad',
        purpose: 'Three concrete benefits, each with a literal title',
        slots: [
            { id: 'feature_title', label: 'Feature title (literal, no metaphor)', required: true },
            { id: 'feature_body', label: 'Feature body (1-2 sentences)', required: true },
            { id: 'feature_icon', label: 'Feature icon (sourced from icon library)', required: false },
        ],
    },
    {
        id: 'how_it_works',
        name: 'How It Works',
        purpose: 'Reduce activation friction - 3 to 5 sequential steps',
        slots: [
            { id: 'step_label', label: 'Step label (verb-led, ordered)', required: true },
            { id: 'step_body', label: 'Step body (one sentence)', required: true },
        ],
    },
    {
        id: 'testimonials',
        name: 'Testimonials',
        purpose: 'Specific quotes with attribution, not generic praise',
        slots: [
            { id: 'quote', label: 'Quote (specific outcome named)', required: true },
            { id: 'attribution', label: 'Attribution (name, role, company)', required: true },
        ],
    },
    {
        id: 'faq',
        name: 'FAQ',
        purpose: 'Answer the 4-6 highest-friction questions',
        slots: [
            { id: 'question', label: 'Question (user voice, not marketing voice)', required: true },
            { id: 'answer', label: 'Answer (direct, <=60 words)', required: true },
        ],
    },
    {
        id: 'final_cta',
        name: 'Final CTA',
        purpose: 'Repeat the primary action with a short reinforcement line',
        slots: [
            { id: 'closing_headline', label: 'Closing headline (echo hero, do not duplicate)', required: true },
            { id: 'primary_cta', label: 'Primary CTA (matches hero CTA)', required: true },
        ],
    },
];
const BRAND_RHYTHM = {
    verticalGapPx: 200,
    maxSectionsPerScreen: 1,
    hierarchyGuidance: 'One idea per viewport. Type carries the weight; spacing carries the mood.',
};
const PRODUCT_RHYTHM = {
    verticalGapPx: 96,
    maxSectionsPerScreen: 2,
    hierarchyGuidance: 'Two sections per viewport on desktop. Anchor each with a clear H2 and a single primary action.',
};
const BRAND_ANTI_PATTERNS = [
    'Do not add a "Pricing" table to a portfolio - it cheapens curation',
    'Do not stack three CTAs in the hero - brand register survives on a single invitation',
    'Do not run a generic logo strip - brand sites earn trust through the work, not external badges',
    'Do not pad with FAQ-style sections - brand voice answers questions through copy, not Q&A scaffolding',
];
const PRODUCT_ANTI_PATTERNS = [
    'Do not lead with an abstract manifesto - product users want clarity in the first viewport',
    'Do not write feature titles as metaphors - state the literal outcome',
    'Do not gate the hero behind a video - inline value first, demo second',
    'Do not duplicate the hero headline at the final CTA - echo the action, not the wording',
];
function getSectionTaxonomy(register) {
    return register === 'brand' ? BRAND_TAXONOMY : PRODUCT_TAXONOMY;
}
function getRhythmRules(register) {
    return register === 'brand' ? BRAND_RHYTHM : PRODUCT_RHYTHM;
}
function getAntiPatternCallouts(register) {
    return register === 'brand' ? BRAND_ANTI_PATTERNS : PRODUCT_ANTI_PATTERNS;
}
function findSection(register, sectionId) {
    return getSectionTaxonomy(register).find((s) => s.id === sectionId) || null;
}
//# sourceMappingURL=landing-composition-data.js.map