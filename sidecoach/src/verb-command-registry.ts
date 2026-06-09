/**
 * Verb Command Registry
 *
 * Maps verb commands (craft, polish, audit, ...) onto sidecoach
 * flow chains. Each entry carries:
 *  - flowIds: sidecoach FlowIds the verb orchestrates (in execution order)
 *  - guidanceAppend: extra guidance lines the orchestrator appends after the
 *      flow chain finishes (these turn raw flow output into a verb-shaped
 *      response that matches the verb voice)
 *  - parityChecklist: real substrings from canonical reference files
 *      that MUST appear in the final output so the parity test passes
 *  - parityPlus: substrings that prove sidecoach added something beyond
 *      legacy skill (validators, BuildReport, taste rules, memory entry, etc.)
 *
 * Sprint 8 T1 ships the registry skeleton + 5 prototype entries (craft,
 * polish, audit, critique, document). T5 fills in the remaining 17 verbs.
 *
 * SKILL_REF resolves to sidecoach's reference directory.
 * Each entry's skillRefPath points at the canonical reference file
 * those strings were derived from, so a future drift-audit can diff entries
 * against the current canonical reference.
 */

import type { FlowId } from './types';

export interface VerbCommandEntry {
  command: string;
  description: string;
  skillRefPath: string;
  phase: 'shape' | 'craft' | 'review' | 'tone' | 'docs' | 'tactical';
  flowIds: FlowId[];
  guidanceAppend: string[];
  parityChecklist: string[];
  parityPlus: string[];
}

const SKILL_REF =
  '~/Documents/Github/improv/sidecoach/reference/_extracted/legacy-design-skill/reference';

export const VERB_REGISTRY: Record<string, VerbCommandEntry> = {
  craft: {
    command: 'craft',
    description:
      'Build a feature with exceptional UX and UI quality: shape the design, land the visual direction, build real production code, inspect and improve in-browser until it meets a high-end studio bar.',
    skillRefPath: `${SKILL_REF}/craft.md`,
    phase: 'craft',
    flowIds: [
      'flowA_brand_verify',
      'flowB_component_research',
      'flowE_motion_patterns',
      'flowF_design_tokens',
      'flowG_component_implementation',
      'flowH_motion_integration',
      'flowI_accessibility',
      'flowM_responsive_validation',
      'flowJ_tactical_polish',
    ],
    guidanceAppend: [
      'Shape brief confirmed before any code was written; gates were not compressed.',
      'Component patterns researched before any UI was built; design references vetted for AI-slop.',
      'Motion patterns researched before motion was integrated; easing tokens selected, not invented.',
      'Production bar enforced: real content, semantic-first markup, deliberate spacing, full state coverage.',
      'Motion integrated: easing tokens applied to interactive components, reduced-motion respected.',
      'Accessibility verified: WCAG 2.1 AA scan complete, contrast and focus ring checks passed.',
      'Responsive verified: rendered at XS/SM/MD/LG/XL, 44x44 hit areas measured, nav pattern transitions confirmed, iOS svh/dvh checked.',
      'After the first pass, iterate visually against the brief and the approved direction; patch material defects and re-inspect.',
    ],
    parityChecklist: [
      'Shape brief confirmed',
      'component research',
      'motion patterns researched',
      'Production bar',
      'Real content',
      'Semantic first',
      'Iterate Visually',
      'motion integrated',
      'accessibility verified',
      'responsive verified',
    ],
    parityPlus: [
      'sidecoach brand verification gate',
      'BuildReport',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  polish: {
    command: 'polish',
    description:
      'Perform a meticulous final pass to catch all the small details that separate good work from great work. The difference between shipped and polished.',
    skillRefPath: `${SKILL_REF}/polish.md`,
    phase: 'tactical',
    flowIds: ['flowJ_tactical_polish', 'flowM_responsive_validation'],
    guidanceAppend: [
      'Design system discovery ran first; drift was named by root cause (missing token vs one-off vs conceptual misalignment).',
      'Pre-polish assessment confirmed functional completeness before any cosmetic work.',
      'Polished systematically across visual alignment, typography, color, interaction states, motion, copy, icons, forms, edge cases, responsiveness, performance, and code quality.',
    ],
    parityChecklist: [
      'Design System Discovery',
      'Pre-Polish Assessment',
      'Polish Systematically',
      'Polish Checklist',
      'Final Verification',
    ],
    parityPlus: [
      'polish-standard domain grade',
      'taste validation',
      'BuildReport',
      'memory entry',
    ],
  },

  audit: {
    command: 'audit',
    description:
      'Run systematic technical quality checks and generate a comprehensive report. Code-level audit across 5 dimensions; do not fix issues, document them.',
    skillRefPath: `${SKILL_REF}/audit.md`,
    phase: 'review',
    flowIds: ['flowK_multi_lens_audit', 'flowI_accessibility'],
    guidanceAppend: [
      'Diagnostic scan ran across accessibility, performance, theming, responsive, and anti-patterns; each scored 0-4.',
      'Anti-patterns verdict opens the report (pass/fail on the "does this look AI-generated" question) with specific tells named.',
      'Findings tagged P0-P3 with location, impact, WCAG standard, recommended fix, and the suggested follow-up command.',
    ],
    parityChecklist: [
      'Diagnostic Scan',
      'Audit Health Score',
      'Anti-Patterns Verdict',
      'Executive Summary',
      'Detailed Findings by Severity',
    ],
    parityPlus: [
      'BuildReport',
      'category-reflex detector',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  critique: {
    command: 'critique',
    description:
      'Design review via two independent assessments (LLM design director + automated detector). Combined into a single honest report with heuristic scoring, anti-patterns verdict, and persona red flags.',
    skillRefPath: `${SKILL_REF}/critique.md`,
    phase: 'review',
    flowIds: ['flowL_design_critique', 'flowK_multi_lens_audit'],
    guidanceAppend: [
      'Two independent assessments gathered (LLM design review and automated detection); neither saw the other before synthesis.',
      'Nielsen heuristics scored 0-4 across all 10 with key issues called out per heuristic.',
      'Persona red flags walked the primary user action for 2-3 personas relevant to this interface type.',
    ],
    parityChecklist: [
      'Gather Assessments',
      'Assessment A: LLM Design Review',
      'Assessment B: Automated Detection',
      'Design Health Score',
      'Persona Red Flags',
    ],
    parityPlus: [
      'taste validation',
      'category-reflex detector',
      'BuildReport',
      'memory entry',
    ],
  },

  shape: {
    command: 'shape',
    description:
      'Shape the UX and UI for a feature before any code is written. Produces a structured design brief that guides implementation through discovery, not guesswork.',
    skillRefPath: `${SKILL_REF}/shape.md`,
    phase: 'shape',
    flowIds: ['flowA_brand_verify'],
    guidanceAppend: [
      'Discovery interview ran with 2-3 questions per round before any decisions were made.',
      'Visual Direction Probe was either run or its skip was announced in one line; the decision was conscious.',
      'Brief presented and response stopped to wait for explicit confirmation before any implementation.',
    ],
    parityChecklist: [
      'Discovery Interview',
      'Visual Direction Probe',
      'Design Brief',
      'Primary User Action',
      'Anti-Goals',
    ],
    parityPlus: [
      'sidecoach brand verification gate',
      'memory entry',
    ],
  },

  onboard: {
    command: 'onboard',
    description:
      'Design first-run flows that get users to first value as fast as possible. Onboarding\'s job is not to teach the product; it is to reach the aha moment that proves the product is worth the time.',
    skillRefPath: `${SKILL_REF}/onboard.md`,
    phase: 'shape',
    flowIds: ['flowG_component_implementation', 'flowI_accessibility', 'flowX_copywriting'],
    guidanceAppend: [
      'Aha moment named explicitly and the path to it minimized; no upfront teaching of features users have not yet asked for.',
      'Empty states designed as onboarding opportunities: what will appear here, why it matters, clear CTA, visual interest, contextual help.',
      'Dismissals respected; same tooltip never shown twice; experienced users can skip.',
    ],
    parityChecklist: [
      'Time to Value',
      'Show, Don\'t Tell',
      'aha moment',
      'Empty State Design',
      'Respect User Intelligence',
    ],
    parityPlus: [
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  animate: {
    command: 'animate',
    description:
      'Add motion that conveys state, gives feedback, and clarifies hierarchy. Cut motion that exists only for decoration; animation fatigue is a real cost.',
    skillRefPath: `${SKILL_REF}/animate.md`,
    phase: 'craft',
    flowIds: ['flowH_motion_integration', 'flowT_ambitious_motion'],
    guidanceAppend: [
      'Hero moment chosen first; scattered micro-interactions resisted in favor of one well-orchestrated experience.',
      'Easing curves drawn from ease-out-quart/quint/expo; bounce and elastic explicitly rejected as dated.',
      'prefers-reduced-motion handled and exit animations clocked at roughly 75% of enter duration.',
    ],
    parityChecklist: [
      'Hero moment',
      'Feedback layer',
      'ease-out-quart',
      'prefers-reduced-motion',
      'Exit animations are faster than entrances',
    ],
    parityPlus: [
      'motion validator (exponential easing)',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  bolder: {
    command: 'bolder',
    description:
      'Increase visual impact and personality through stronger hierarchy, committed scale, and decisive type. Reject the AI defaults (cyan-purple gradients, glassmorphism, neon accents) first, then amplify.',
    skillRefPath: `${SKILL_REF}/bolder.md`,
    phase: 'craft',
    flowIds: ['flowJ_tactical_polish'],
    guidanceAppend: [
      'AI-slop reflex moves rejected up front (purple-to-blue gradients, glassmorphism, neon accents on dark backgrounds).',
      'One focal point chosen and amplified; hierarchy widened with 3x-5x scale jumps and committed weight contrast (900 vs 200).',
      'Bold means distinctive, not chaotic; functional readability preserved while drama was added.',
    ],
    parityChecklist: [
      'AI SLOP TRAP',
      'Typography Amplification',
      'Spatial Drama',
      'Composition Boldness',
      'Bold means distinctive',
    ],
    parityPlus: [
      'category-reflex detector',
      'taste validation',
      'memory entry',
    ],
  },

  colorize: {
    command: 'colorize',
    description:
      'Replace timid grayscale or single-accent designs with a strategic palette. Pick a color strategy, choose a hue family that fits the brand, then apply color with intent. Strategic color beats rainbow vomit.',
    skillRefPath: `${SKILL_REF}/colorize.md`,
    phase: 'craft',
    flowIds: ['flowF_design_tokens'],
    guidanceAppend: [
      'Color strategy chosen explicitly (Restrained / Committed / Full palette / Drenched) before any hue decisions.',
      'OKLCH used for color generation so equal lightness steps look perceptually equal.',
      'No border-left or border-right greater than 1px as a colored accent stripe; full hairline border, background tint, or leading glyph used instead.',
    ],
    parityChecklist: [
      'Color Strategy',
      'Semantic Color',
      'Dominant color strategy',
      'OKLCH',
      'side-stripes',
    ],
    parityPlus: [
      'design-token validator',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  delight: {
    command: 'delight',
    description:
      'Find the moments where personality and unexpected polish would turn a functional interface into one users remember. Add only where the moment earns it; delight everywhere reads as noise.',
    skillRefPath: `${SKILL_REF}/delight.md`,
    phase: 'craft',
    flowIds: ['flowH_motion_integration'],
    guidanceAppend: [
      'Delight applied at specific moments (completion, first-time actions, error recovery, milestones), not pages.',
      'Copy personality matched to the brand; cliched AI-slop loading messages explicitly avoided.',
      'Delight remains skippable, brief (<1s), and never blocks core functionality.',
    ],
    parityChecklist: [
      'Delight Amplifies, Never Blocks',
      'Surprise and Discovery',
      'Easter Eggs',
      'Celebration Moments',
      'AI-slop copy',
    ],
    parityPlus: [
      'taste validation',
      'memory entry',
    ],
  },

  layout: {
    command: 'layout',
    description:
      'Find the layout\'s actual problem (monotone spacing, weak hierarchy, identical card grids, the centered-stack default) and fix the structure, not the surface. Space is the most underused design tool.',
    skillRefPath: `${SKILL_REF}/layout.md`,
    phase: 'craft',
    flowIds: ['flowR_layout_optimization'],
    guidanceAppend: [
      'Squint test ran: primary element, secondary element, and groupings remained identifiable under blurred vision.',
      'Spacing came from a consistent scale; flex used for 1D layouts, grid reserved for genuine 2D coordination.',
      'Card grid monotony broken: cards used only when content is truly distinct, never nested.',
    ],
    parityChecklist: [
      'Squint test',
      'Spacing System',
      'Visual Rhythm',
      'Card Grid Monotony',
      'semantic z-index scale',
    ],
    parityPlus: [
      'polish-standard domain grade',
      'BuildReport',
      'memory entry',
    ],
  },

  overdrive: {
    command: 'overdrive',
    description:
      'Push an interface past conventional limits. Use the full power of the browser to make any part of an interface feel extraordinary - a table that handles a million rows, a dialog that morphs from its trigger, a cinematic page transition.',
    skillRefPath: `${SKILL_REF}/overdrive.md`,
    phase: 'craft',
    flowIds: ['flowT_ambitious_motion'],
    guidanceAppend: [
      'Two or three directions proposed and confirmed with the user before any implementation; the misfire risk was respected.',
      'Browser automation iteration used to close the gap between technically works and looks extraordinary.',
      'Progressive enhancement non-negotiable; every technique degrades gracefully and the experience without it is still good.',
    ],
    parityChecklist: [
      'Entering overdrive mode',
      'Propose Before Building',
      'Progressive enhancement is non-negotiable',
      'View Transitions API',
      'The wow test',
    ],
    parityPlus: [
      'motion validator (exponential easing)',
      'BuildReport',
      'memory entry',
    ],
  },

  quieter: {
    command: 'quieter',
    description:
      'Reduce visual intensity in designs that are too loud, aggressive, or overstimulating without losing personality or making the result generic. Subtlety needs precision; quiet is harder than bold.',
    skillRefPath: `${SKILL_REF}/quieter.md`,
    phase: 'tone',
    flowIds: ['flowJ_tactical_polish'],
    guidanceAppend: [
      'Intensity sources catalogued (color saturation, contrast extremes, visual weight, animation excess) before reducing.',
      'Saturation pulled to 70-85% and tinted grays used instead of pure gray for restrained depth.',
      'Quieter does not mean grayscale or generic; the POV survived the cuts.',
    ],
    parityChecklist: [
      'Color Refinement',
      'Visual Weight Reduction',
      'Tinted grays',
      'Restrained, not absent',
      'luxury, not laziness',
    ],
    parityPlus: [
      'polish-standard domain grade',
      'taste validation',
      'memory entry',
    ],
  },

  typeset: {
    command: 'typeset',
    description:
      'Replace generic defaults (Inter, Roboto, system fallback at flat scale) with type that reflects the brand and scales with intentional contrast. Typography carries most of the information on the page.',
    skillRefPath: `${SKILL_REF}/typeset.md`,
    phase: 'craft',
    flowIds: ['flowS_typography_excellence'],
    guidanceAppend: [
      'Type scale built with a consistent ratio (1.25, 1.333, or 1.5) and 5 sizes covering caption through heading.',
      'Fluid clamp() reserved for marketing/content headings; app UIs used a fixed rem scale for spatial predictability.',
      'Default to Inter/Roboto/Open Sans explicitly resisted when personality mattered.',
    ],
    parityChecklist: [
      'Establish Hierarchy',
      'Fix Readability',
      'tabular-nums',
      'font-display: swap',
      'invisible defaults',
    ],
    parityPlus: [
      'fontshare reference',
      'typography validator',
      'memory entry',
    ],
  },

  clarify: {
    command: 'clarify',
    description:
      'Find the unclear, confusing, or poorly written interface text and rewrite it. Vague copy creates support tickets and abandonment; specific copy gets users through the task.',
    skillRefPath: `${SKILL_REF}/clarify.md`,
    phase: 'craft',
    flowIds: ['flowX_copywriting'],
    guidanceAppend: [
      'Active voice and specific labels preferred; "Click here", "Submit", "OK" replaced with verb-plus-noun CTAs.',
      'Error messages explain what went wrong and suggest how to fix it, without blaming the user.',
      'Confirmation dialogs state the specific action and consequences instead of "Are you sure?".',
    ],
    parityChecklist: [
      'Error Messages',
      'Button & CTA Text',
      'Confirmation Dialogs',
      'Apply Clarity Principles',
      'Tell users what to do',
    ],
    parityPlus: [
      'taste validation',
      'memory entry',
    ],
  },

  harden: {
    command: 'harden',
    description:
      'Make a design production-ready against the inputs, errors, languages, and network conditions real users will throw at it. Designs that only work with perfect data are not done.',
    skillRefPath: `${SKILL_REF}/harden.md`,
    phase: 'review',
    flowIds: ['flowV_all_seven_qa'],
    guidanceAppend: [
      'Extreme inputs tested (very long names, empty fields, emoji, RTL, CJK, large numbers, 1000+ items).',
      'Internationalization handled with logical properties (margin-inline-start, padding-inline) and Intl APIs for dates and numbers.',
      'Error states cover network, 4xx, 5xx, validation, rate limiting, and concurrent operations with recovery paths.',
    ],
    parityChecklist: [
      'Text Overflow & Wrapping',
      'Internationalization',
      'Error Handling',
      'Edge Cases & Boundary Conditions',
      'Accessibility Resilience',
    ],
    parityPlus: [
      'BuildReport',
      'accessibility validator',
      'memory entry',
    ],
  },

  adapt: {
    command: 'adapt',
    description:
      'Adapt an existing design to a different context: another screen size, device, platform, or use case. The trap is treating adaptation as scaling. The job is rethinking the experience for the new context.',
    skillRefPath: `${SKILL_REF}/adapt.md`,
    phase: 'review',
    flowIds: ['flowM_responsive_validation'],
    guidanceAppend: [
      'Source and target contexts named explicitly (device, input method, screen, connection, usage) before any changes.',
      'Touch targets at 44x44px minimum and hover-dependent interactions replaced for touch contexts.',
      'Tested on real devices in both orientations, not just DevTools emulation.',
    ],
    parityChecklist: [
      'Mobile Adaptation',
      'Tablet Adaptation',
      'Desktop Adaptation',
      'Touch Adaptation',
      'Responsive Breakpoints',
    ],
    parityPlus: [
      'responsive validator',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  distill: {
    command: 'distill',
    description:
      'Strip a design to its essence. Remove anything that does not earn its place: redundant elements, repeated information, decorative noise, cosmetic complexity.',
    skillRefPath: `${SKILL_REF}/distill.md`,
    phase: 'tone',
    flowIds: ['flowJ_tactical_polish'],
    guidanceAppend: [
      'Core purpose named as ONE thing; everything else evaluated against whether it earns its place.',
      'Progressive disclosure used to hide complexity behind clear entry points instead of removing necessary features.',
      'Cards never nested inside cards; spacing and dividers carry hierarchy within sections.',
    ],
    parityChecklist: [
      'Information Architecture',
      'Visual Simplification',
      'Interaction Simplification',
      'Content Simplification',
      'paradox of choice',
    ],
    parityPlus: [
      'polish-standard domain grade',
      'taste validation',
      'memory entry',
    ],
  },

  optimize: {
    command: 'optimize',
    description:
      'Identify the actual performance bottleneck for THIS interface, fix it, then measure. Performance is a feature; do not optimize what is not slow.',
    skillRefPath: `${SKILL_REF}/optimize.md`,
    phase: 'review',
    flowIds: ['flowJ_tactical_polish'],
    guidanceAppend: [
      'Measured before and after; the biggest bottleneck targeted first instead of micro-optimizations.',
      'Core Web Vitals (LCP, INP, CLS) tracked; layout shifts prevented with aspect-ratio and reserved space.',
      'GPU-accelerated properties (transform, opacity) preferred over layout-driving properties (width, height, top, left).',
    ],
    parityChecklist: [
      'Core Web Vitals',
      'Avoid Layout Thrashing',
      'GPU Acceleration',
      'Largest Contentful Paint',
      'Cumulative Layout Shift',
    ],
    parityPlus: [
      'BuildReport',
      'polish-standard domain grade',
      'memory entry',
    ],
  },

  extract: {
    command: 'extract',
    description:
      'Identify reusable patterns, components, and design tokens, then extract and consolidate them into the design system for systematic reuse. Premature abstraction is worse than duplication; extract what is used 3+ times with the same intent.',
    skillRefPath: `${SKILL_REF}/extract.md`,
    phase: 'docs',
    flowIds: ['flowU_curate'],
    guidanceAppend: [
      'Design system discovered first; extraction respected existing conventions, organization, and naming.',
      'Only patterns used 3+ times with the same intent were extracted; one-off implementations stayed put.',
      'Migration step replaced every existing use and deleted dead code before the extraction was called done.',
    ],
    parityChecklist: [
      'Discover the Design System',
      'Identify Patterns',
      'Plan Extraction',
      'Extract & Enrich',
      'Migrate',
    ],
    parityPlus: [
      'design-token validator',
      'BuildReport',
      'memory entry',
    ],
  },

  live: {
    command: 'live',
    description:
      'Interactive live variant mode: select elements in the browser, pick a design action, and get AI-generated HTML+CSS variants hot-swapped via the dev server\'s HMR.',
    skillRefPath: `${SKILL_REF}/live.md`,
    phase: 'tactical',
    flowIds: ['flowN_rapid_iteration_refined'],
    guidanceAppend: [
      'Identity lock extracted from DESIGN.md, CSS custom properties, computed styles, or sibling components before any planning.',
      'Default mode (preserve identity, vary axes) used for ~90% of sessions; departure mode triggered only by explicit anti-references or freeform prompt.',
      'Three variants committed to three DIFFERENT primary axes; squint test confirmed they read as the same brand at three angles.',
    ],
    parityChecklist: [
      'identity lock',
      'Default mode',
      'Departure mode',
      'Squint test',
      'Signature params',
    ],
    parityPlus: [
      'rapid-iteration flow integration',
      'memory entry',
    ],
  },

  document: {
    command: 'document',
    description:
      'Generate a DESIGN.md at the project root that captures the current visual design system per the Google Stitch DESIGN.md format: YAML token frontmatter plus a six-section markdown body.',
    skillRefPath: `${SKILL_REF}/document.md`,
    phase: 'docs',
    // document uses a dedicated handler (T4) rather than a flow chain - it
    // reads project code and writes DESIGN.md. flowIds intentionally empty.
    flowIds: [],
    guidanceAppend: [
      'DESIGN.md follows the Google Stitch format: YAML frontmatter for tokens, markdown body with six sections in fixed order.',
      'Scan mode auto-extracted tokens from the codebase; descriptive language was confirmed with the user before writing.',
      'Output validated against the Google DESIGN.md schema lint before reporting done.',
    ],
    parityChecklist: [
      'frontmatter: token schema',
      'six sections',
      'Scan mode',
      'Seed mode',
      'design.json sidecar',
    ],
    parityPlus: [
      'Google spec lint',
      'sidecoach brand verification gate',
      'memory entry',
    ],
  },
};

export function getVerbList(): string[] {
  return Object.keys(VERB_REGISTRY);
}

export function getVerbEntry(
  command: string,
): VerbCommandEntry | undefined {
  return VERB_REGISTRY[command];
}
