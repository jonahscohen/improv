// Design Laws System
// Shared design rules extracted from prior design references, organized by domain and register

import { Register } from './project-context';

// 27 Deterministic Anti-Patterns (Absolute Bans)
export const ANTI_PATTERNS = {
  // Visual & Layout
  side_stripe_borders: {
    id: 'anti_001',
    name: 'Side-stripe borders',
    description: 'Colored left/right borders >1px on cards, callouts, alerts',
    severity: 'critical',
    checker: (code: string) => /border-(left|right):\s*\d+px|^[^{]*left:\s*\d+px\s*solid\s*#|border-left-color|border-right-color/.test(code),
  },
  gradient_text: {
    id: 'anti_002',
    name: 'Gradient text',
    description: 'background-clip: text + gradient on typography',
    severity: 'critical',
    checker: (code: string) => /background-clip:\s*text|text\s+gradient/.test(code),
  },
  glassmorphism_default: {
    id: 'anti_003',
    name: 'Glassmorphism as default',
    description: 'Blur + glass decorative effects used as primary aesthetic',
    severity: 'high',
    checker: (code: string) => /backdrop-filter:|backdropFilter:|glass|blur\(\d+px\)/.test(code),
  },
  hero_metric_template: {
    id: 'anti_004',
    name: 'Hero-metric template',
    description: 'Big number + supporting stats grid + gradient accent',
    severity: 'high',
    checker: (code: string) => /hero|metric|big\s*number|stats\s*grid/.test(code.toLowerCase()),
  },
  identical_card_grids: {
    id: 'anti_005',
    name: 'Identical card grids',
    description: 'Repeated same-size cards with icon+heading+text pattern',
    severity: 'high',
    checker: (code: string) => /grid|repeat.*card|same.*card/.test(code.toLowerCase()),
  },
  modal_as_first_thought: {
    id: 'anti_006',
    name: 'Modal as first thought',
    description: 'Modal used as default pattern instead of inline or progressive disclosure',
    severity: 'medium',
    checker: (code: string) => /modal|dialog/.test(code.toLowerCase()),
  },

  // Typography
  flat_scales: {
    id: 'anti_007',
    name: 'Flat typography scales',
    description: 'Typography hierarchy without sufficient ratio between sizes (needs >=1.25)',
    severity: 'high',
    checker: (code: string) => /font-size|--fs-|line-height/.test(code),
  },
  body_too_wide: {
    id: 'anti_008',
    name: 'Body text exceeds 75ch',
    description: 'Paragraph text wider than 75 characters reduces readability',
    severity: 'medium',
    checker: (code: string) => /max-width|width.*\d{3,}/i.test(code), // heuristic
  },

  // Color
  pure_black_white: {
    id: 'anti_009',
    name: 'Pure black or white',
    description: 'Using #000 or #fff instead of tinted neutrals with chroma 0.005-0.01',
    severity: 'high',
    checker: (code: string) => /#000000|#fff|#ffffff|rgb\(0,\s*0,\s*0\)|rgb\(255,\s*255,\s*255\)/.test(code),
  },
  alpha_abuse: {
    id: 'anti_010',
    name: 'Alpha as design substitute',
    description: 'Using opacity/alpha to lighten/darken instead of proper palette',
    severity: 'medium',
    checker: (code: string) => /rgba\(.*,\s*0\.[1-4]\)|opacity:.*0\.[1-4]|--.*alpha/.test(code),
  },
  missing_wcag_contrast: {
    id: 'anti_011',
    name: 'WCAG contrast failure',
    description: 'Text or interactive elements below 4.5:1 AA ratio (body) or 3:1 (large/UI)',
    severity: 'critical',
    checker: (code: string) => /contrast|wcag|a11y|accessibility/.test(code.toLowerCase()),
  },

  // Spacing & Layout
  inconsistent_spacing: {
    id: 'anti_012',
    name: 'Inconsistent spacing rhythm',
    description: 'Spacing values that don\'t follow 4pt or modular system (same padding everywhere)',
    severity: 'high',
    checker: (code: string) => /padding:|margin:|gap:|space-/.test(code),
  },
  nested_cards: {
    id: 'anti_013',
    name: 'Nested cards',
    description: 'Cards inside cards creates confusion and lazy composition',
    severity: 'high',
    checker: (code: string) => /card.*card|border.*border/.test(code.toLowerCase()),
  },

  // Motion
  animated_layout_properties: {
    id: 'anti_014',
    name: 'Animating layout properties',
    description: 'Animating width, height, top, left, margins causes jank',
    severity: 'high',
    checker: (code: string) => /animate.*(?:width|height|top|left|margin)|transition.*(?:width|height|top|left)/.test(code),
  },
  bounce_elastic_easing: {
    id: 'anti_015',
    name: 'Bounce or elastic easing',
    description: 'Using cubic-bezier easing with bounce/elastic overshoots',
    severity: 'high',
    checker: (code: string) => /bounce|elastic|cubic-bezier.*1\.\d/.test(code),
  },
  excessive_motion: {
    id: 'anti_016',
    name: 'Excessive motion',
    description: 'Durations >500ms entrance or missing reduced-motion support',
    severity: 'medium',
    checker: (code: string) => /animation-duration|transition-duration/.test(code),
  },

  // Interaction
  missing_focus_state: {
    id: 'anti_017',
    name: 'Missing focus rings',
    description: 'Interactive elements without visible focus ring for keyboard users',
    severity: 'critical',
    checker: (code: string) => /:focus|focus-visible|outline/.test(code),
  },
  placeholder_as_label: {
    id: 'anti_018',
    name: 'Placeholder as label',
    description: 'Using placeholder attribute instead of visible <label>',
    severity: 'high',
    checker: (code: string) => /placeholder=(?!.*<label)/.test(code),
  },

  // Forms
  no_error_messages: {
    id: 'anti_019',
    name: 'Missing error messages',
    description: 'Form validation without helpful error text',
    severity: 'high',
    checker: (code: string) => /input|form|validation/.test(code.toLowerCase()),
  },

  // Copy & Content
  redundant_copy: {
    id: 'anti_020',
    name: 'Redundant copy',
    description: 'Headings restated in body text or filler language',
    severity: 'medium',
    checker: (code: string) => false, // LLM check
  },
  no_word_earns_place: {
    id: 'anti_021',
    name: 'Filler words',
    description: 'Words that don\'t add meaning or specificity',
    severity: 'medium',
    checker: (code: string) => false, // LLM check
  },

  // Responsive
  desktop_first: {
    id: 'anti_022',
    name: 'Desktop-first approach',
    description: 'Building large-screen first instead of mobile-first',
    severity: 'high',
    checker: (code: string) => /max-width.*media/.test(code), // heuristic
  },
  touch_targets_small: {
    id: 'anti_023',
    name: 'Touch targets <40px',
    description: 'Interactive elements smaller than 40x40px minimum',
    severity: 'high',
    checker: (code: string) => false, // geometric check
  },

  // Images
  tinted_images: {
    id: 'anti_024',
    name: 'Tinted image overlays',
    description: 'Images with color overlays instead of proper solid backgrounds',
    severity: 'medium',
    checker: (code: string) => /background-blend-mode|mix-blend-mode/.test(code),
  },

  // Components
  generic_component_names: {
    id: 'anti_025',
    name: 'Generic component names',
    description: 'Components named "Button1", "Box", "Container" instead of semantic names',
    severity: 'low',
    checker: (code: string) => /button1|box|container\d/.test(code.toLowerCase()),
  },

  // Performance
  will_change_abuse: {
    id: 'anti_026',
    name: 'will-change on non-animated',
    description: 'will-change applied broadly instead of only before animation start',
    severity: 'low',
    checker: (code: string) => /will-change/.test(code),
  },

  transition_all: {
    id: 'anti_027',
    name: 'transition: all',
    description: 'Blanket transition rule instead of specific properties',
    severity: 'medium',
    checker: (code: string) => /transition:\s*all|transition-property:\s*all/.test(code),
  },
};

// Shared Design Laws by Domain
export const SHARED_DESIGN_LAWS = {
  color: {
    domain: 'Color & Contrast',
    rules: [
      'Use OKLCH color space, never HSL or RGB for strategic colors',
      'Tint every neutral with chroma 0.005-0.015 toward brand hue',
      'Reduce chroma near white/black to avoid garish appearance',
      '4 color commitment levels: Restrained(<=10% accent only), Committed(30-60%), Full(3-4 named), Drenched(surface IS color)',
      'WCAG AA minimum: 4.5:1 on body text, 3:1 on large text and UI components',
      'Never use pure gray, black (#000), or white (#fff)',
      'Dark mode differs from light: surfaces for depth, reduced text weight, adjusted saturation',
      'Alpha is design smell: indicates incomplete palette',
    ],
  },
  typography: {
    domain: 'Typography',
    rules: [
      'Body text max 65-75 characters per line',
      'Hierarchy via scale AND weight: >=1.25 ratio between consecutive sizes',
      'No flat scales (e.g., 14/16/18/20 is flat; 14/18/24/32 has ratio)',
      'Line-height adjusts with measure: longer lines need taller line-height',
      'Light-on-dark: +0.05-0.1 line-height, +0.01-0.02em letter-spacing, weight bump',
      'ALL-CAPS needs 5-12% letter-spacing',
      'Semantic token naming: --text-body not --font-size-16',
      'Minimum 16px for web, 44px+ touch targets, rem/em sizing for accessibility',
    ],
  },
  spatial: {
    domain: 'Spatial Design',
    rules: [
      '4pt base spacing system: 4/8/12/16/24/32/48/64/96px',
      'Use gap property over margins to eliminate margin-collapse',
      'Vary spacing for visual rhythm; identical padding = monotony',
      'Cards are lazy answer: use only when truly best affordance, never nested',
      'Hierarchy through multiple dimensions: size 3:1+, weight contrast, color, position, space',
      'Squint test validates visual hierarchy from distance',
      'Touch targets minimum 40x40px via padding or pseudo-element',
      'Container queries for component-relative layouts',
    ],
  },
  motion: {
    domain: 'Motion Design',
    rules: [
      'Duration rule: 100-150ms feedback, 200-300ms state changes, 300-500ms layout, 500-800ms entrance',
      'Exit animations: 75% of enter duration',
      'Easing curves: ease-out for entrance, ease-in for exit, ease-in-out for toggle',
      'Only exponential easing: ease-out-quart, quint, expo (no bounce/elastic)',
      'Never animate CSS layout properties (width, height, top, left, margin)',
      'Stagger with CSS custom properties: animation-delay: calc(var(--i) * 50ms)',
      'Reduced motion support required: @media prefers-reduced-motion with fade alternative',
      'Will-change only when animation imminent (:hover, .animating state)',
    ],
  },
  interaction: {
    domain: 'Interaction Design',
    rules: [
      '8 interactive states required: Default, Hover, Focus, Active, Disabled, Loading, Error, Success',
      'Focus rings via :focus-visible (keyboard only), 2-3px, high contrast 3:1+, offset 2px',
      'Placeholders ≠ labels; always use visible <label>',
      'Validate on blur not keystroke (exception: password strength real-time)',
      'Skeleton screens > spinners for perceived performance',
      '<dialog> native or `inert` attribute for focus trapping in modals',
      'Popover API for tooltips/dropdowns/light-dismiss overlays',
      'Undo > Confirm for destructive actions',
    ],
  },
  responsive: {
    domain: 'Responsive Design',
    rules: [
      'Mobile-first: base styles for mobile, min-width queries for complexity',
      'Breakpoints content-driven (3 usually suffice); let content tell you where to break',
      'Detect input method not just screen size: @media (pointer: fine/coarse, hover: hover/none)',
      'Safe areas: env(safe-area-inset-*) for notches, rounded corners, home indicators',
      'Responsive images: srcset with width descriptors, sizes attribute, picture element for art direction',
      'Layout adaptation: hamburger->compact->full nav, tables->cards, progressive disclosure',
      'Test on real devices: DevTools misses touch, CPU, network, font rendering',
      'Avoid: desktop-first, device detection, separate mobile/desktop, ignoring tablet/landscape',
    ],
  },
  writing: {
    domain: 'UX Writing',
    rules: [
      'Button labels: specific verb + object ("Save changes" not "OK")',
      'Destructive actions name the destruction ("Delete 5 items" not "Proceed")',
      'Error messages: what happened, why, how to fix (don\'t blame user)',
      'Empty states are onboarding: acknowledge, explain value, provide action',
      'Voice constant, tone adapts to moment (success: celebratory, error: empathetic)',
      'Never humor for errors (users frustrated, be helpful not cute)',
      'Icon buttons need aria-label for screen readers',
      'Avoid redundant copy and filler words; every word earns its place',
    ],
  },
};

// Category-Reflex Checks for AI Slop Detection
//
// The first-order check (color palette guessable from category) lives inline
// here as a stable color-domain mapping.
//
// The second-order check (aesthetic family guessable from category + anti-references)
// now pulls its `oversaturated_families` list from the absorbed library via
// reference-loader, so the lanes that count as "saturated" stay in sync with
// what we extracted from the predecessor's brand.md plus the emerging-lane
// research (Linear-clean, Notion-clone-minimalism, Vercel-marketing,
// Spotify-card-stack). Adding a new saturated lane is now an edit in one
// place: src/reference-loader.ts:loadSaturatedAestheticLanes().
import { loadSaturatedAestheticLanes } from './reference-loader';

const SATURATED_LANE_STRINGS = loadSaturatedAestheticLanes().map(
  (lane) => `${lane.name} (${lane.description}). Tells: ${lane.tells.join('; ')}`
);

export const CATEGORY_REFLEX = {
  first_order: {
    question: 'Can someone guess the color palette from the category alone?',
    examples: {
      observability: 'dark blue / dark theme is predictable',
      fintech: 'green for money / trust is cliche',
      ecommerce: 'orange / red for CTAs is reflexive',
      healthcare: 'blue for trust / care is default',
      ai_workflows: 'cream / beige SaaS look is oversaturated',
      crypto: 'neon-on-black is the immediate training-data default',
      productivity: 'Linear-clean monochrome zinc/slate is the new reflex',
    },
  },
  second_order: {
    question: 'Can someone guess the aesthetic family from category + anti-references?',
    examples: {
      'observability without dark blues': 'Defaults to Linear-clean or editorial-typographic',
      'fintech avoiding green': 'Defaults to Vercel-marketing gradient mesh or terminal-native',
      'ecommerce without red': 'Defaults to Spotify-card-stack or acid-maximalism',
      'AI workflow tool that is not SaaS-cream': 'Defaults to editorial-typographic',
      'productivity tool that is not Linear': 'Defaults to Notion-clone-minimalism',
    },
  },
  oversaturated_families: SATURATED_LANE_STRINGS,
};

// Register-Specific Laws
export const REGISTER_SPECIFIC_LAWS = {
  brand: {
    register: 'brand',
    description: 'Design IS the product (marketing, landing, campaigns, portfolio)',
    color_strategy: 'Full palette or Drenched (30-100% color usage encouraged)',
    typography_personality: 'Serif or distinctive headlines allowed, fluid type common',
    component_approach: 'Unique custom components, less constraint library reliance',
    motion_intensity: 'Ambitious motion encouraged (entrance, scroll, interactions)',
    tone: 'Voice-forward, personality-driven, distinctive brand perspective',
    validation_focus: 'Category-reflex check more critical (avoid generic brand look)',
  },
  product: {
    register: 'product',
    description: 'Design SERVES the product (app UI, admin, dashboard, tool)',
    color_strategy: 'Restrained or Committed (10-60% color, focus on clarity)',
    typography_personality: 'Sans-serif, clarity-optimized, fixed rem sizing',
    component_approach: 'Constraint library + design system tokens',
    motion_intensity: 'Restrained motion (feedback + state changes only)',
    tone: 'Utility-focused, clear, supportive, functional',
    validation_focus: 'Accessibility and responsiveness critical for usability',
  },
};

// 12-Rule Critique Framework
export const CRITIQUE_RULES = [
  {
    id: 'hierarchy',
    name: 'Visual Hierarchy',
    description: 'Can user identify primary, secondary, groupings at a glance?',
    weight: 1.0,
  },
  {
    id: 'cognitive_load',
    name: 'Cognitive Load',
    description: 'Information chunked appropriately, decision density manageable?',
    weight: 1.0,
  },
  {
    id: 'visual_weight',
    name: 'Visual Weight Distribution',
    description: 'Does 60-30-10 rule apply correctly?',
    weight: 0.8,
  },
  {
    id: 'color_commitment',
    name: 'Color Strategy Commitment',
    description: 'Is palette commitment level intentional and consistent?',
    weight: 0.8,
  },
  {
    id: 'typography',
    name: 'Typography Consistency',
    description: 'Does typography follow modular scale rules?',
    weight: 0.8,
  },
  {
    id: 'affordances',
    name: 'Interaction Affordances',
    description: 'Are interactive elements clearly discoverable?',
    weight: 1.0,
  },
  {
    id: 'emotional_journey',
    name: 'Emotional Journey',
    description: 'Does design match brand tone and context?',
    weight: 0.9,
  },
  {
    id: 'nielsen_heuristics',
    name: 'Nielsen Heuristics',
    description: 'User control, feedback, standards, error prevention present?',
    weight: 1.0,
  },
  {
    id: 'accessibility',
    name: 'Accessibility Inclusion',
    description: 'WCAG + usability for diverse users (not just compliance)?',
    weight: 1.0,
  },
  {
    id: 'perceived_performance',
    name: 'Perceived Performance',
    description: 'Feels fast through feedback, optimistic UI, skeleton screens?',
    weight: 0.7,
  },
  {
    id: 'copy_precision',
    name: 'Copy Precision',
    description: 'Every word earns its place, no filler or redundancy?',
    weight: 0.8,
  },
  {
    id: 'register_alignment',
    name: 'Register Alignment',
    description: 'Design laws for register (brand/product) applied correctly?',
    weight: 1.0,
  },
];

export function getAntiPatternById(id: string) {
  return Object.values(ANTI_PATTERNS).find((ap) => ap.id === id);
}

export function getDesignLawsForRegister(register: Register) {
  return REGISTER_SPECIFIC_LAWS[register];
}

export function getSharedLawsForDomain(domain: string) {
  return SHARED_DESIGN_LAWS[domain as keyof typeof SHARED_DESIGN_LAWS];
}
