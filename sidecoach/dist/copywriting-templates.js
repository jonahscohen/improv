"use strict";
// Register + section + slot keyed copywriting templates.
// Pure data + a getDraftOptions() expander. No I/O.
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplate = getTemplate;
exports.getDraftOptions = getDraftOptions;
exports.listSlotsFor = listSlotsFor;
const TEMPLATES = [
    // Brand hero
    {
        register: 'brand',
        sectionId: 'hero',
        slotId: 'headline',
        voicePrompt: 'Evocative, atmospheric. Suggest rather than declare. Single mood per line.',
        wordCountMin: 2,
        wordCountMax: 8,
        samplePatterns: [
            'Quiet work, made with care',
            'Where craft outlasts the brief',
            'A studio for considered design',
        ],
    },
    {
        register: 'brand',
        sectionId: 'hero',
        slotId: 'supporting_line',
        voicePrompt: 'One sentence that extends the mood. No bullet points, no feature lists.',
        wordCountMin: 8,
        wordCountMax: 22,
        samplePatterns: [
            'We design brand systems, websites, and editorial work for clients who value patience.',
            'A small studio building identity and digital products with deliberate restraint.',
            'Independent practice, focused on long-form brand work and crafted interfaces.',
        ],
    },
    {
        register: 'brand',
        sectionId: 'hero',
        slotId: 'primary_cta',
        voicePrompt: 'A single entry verb. Avoid "submit," "click," "buy now."',
        wordCountMin: 1,
        wordCountMax: 3,
        samplePatterns: ['Enter', 'Begin', 'Explore the work', 'See the studio'],
    },
    // Product hero
    {
        register: 'product',
        sectionId: 'hero',
        slotId: 'headline',
        voicePrompt: 'Outcome-specific. Verb + benefit. No metaphor unless concrete.',
        wordCountMin: 3,
        wordCountMax: 10,
        samplePatterns: [
            'Ship faster without losing quality',
            'Run your business in one place',
            'The simplest way to track customer feedback',
        ],
    },
    {
        register: 'product',
        sectionId: 'hero',
        slotId: 'supporting_line',
        voicePrompt: 'One clarifying sentence. Name the user, name the outcome, name the differentiator.',
        wordCountMin: 10,
        wordCountMax: 28,
        samplePatterns: [
            '[Product] helps teams ship reliable releases by automating the manual parts of QA.',
            'Designed for small businesses that have outgrown spreadsheets but cannot afford an ERP.',
            'A single workspace for feedback, bugs, and feature requests, with no plugin sprawl.',
        ],
    },
    {
        register: 'product',
        sectionId: 'hero',
        slotId: 'primary_cta',
        voicePrompt: 'Action + risk-reducer. "Free," "no credit card," "demo" are acceptable.',
        wordCountMin: 2,
        wordCountMax: 5,
        samplePatterns: ['Start free', 'Get started', 'Try [Product] free', 'Start a free trial'],
    },
    {
        register: 'product',
        sectionId: 'hero',
        slotId: 'secondary_cta',
        voicePrompt: 'Lower-commitment alternative. Often "See demo," "Talk to sales," "View pricing."',
        wordCountMin: 2,
        wordCountMax: 4,
        samplePatterns: ['See demo', 'View pricing', 'Talk to sales'],
    },
    // Product feature triad
    {
        register: 'product',
        sectionId: 'feature_triad',
        slotId: 'feature_title',
        voicePrompt: 'Literal title. State the capability, not the feeling.',
        wordCountMin: 2,
        wordCountMax: 6,
        samplePatterns: [
            'Automated changelog generation',
            'Built-in role-based access',
            'One-click rollback',
        ],
    },
    {
        register: 'product',
        sectionId: 'feature_triad',
        slotId: 'feature_body',
        voicePrompt: 'One to two sentences. Mention the user task and the time saved or risk avoided.',
        wordCountMin: 10,
        wordCountMax: 36,
        samplePatterns: [
            'Skip the manual roundup. [Product] aggregates merged PRs into a release-ready changelog every Friday.',
            'Grant access by role, not by exception. Auditors and admins see exactly what they need.',
            'Roll back a bad deploy in one click - no kubectl, no late-night incident channels.',
        ],
    },
];
function getTemplate(register, sectionId, slotId) {
    return (TEMPLATES.find((t) => t.register === register && t.sectionId === sectionId && t.slotId === slotId) || null);
}
function getDraftOptions(register, sectionId, slotId, draftContext = {}) {
    const tmpl = getTemplate(register, sectionId, slotId);
    if (!tmpl)
        return [];
    const productName = draftContext.productName || '[Product]';
    return tmpl.samplePatterns.slice(0, 3).map((p) => p.replace(/\[Product\]/g, productName));
}
function listSlotsFor(register, sectionId) {
    return TEMPLATES.filter((t) => t.register === register && t.sectionId === sectionId);
}
//# sourceMappingURL=copywriting-templates.js.map