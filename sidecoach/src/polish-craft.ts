// Polish craft corpus - the TEACHING half of the `polish` verb.
//
// WHY THIS FILE EXISTS.
//
// Measured 2026-07-28: the shipped `polish` payload contained no craft instruction. The 16
// tactical-polish principles reached the user as a fixed 40-line block of imperatives with no
// statement of what good looks like, no reason, and no example - emitted identically whether the
// page violated one rule or twenty. The executive report was worse: its "After" column, whose
// entire job is to say what to DO, fell through to the string template
// `resolve the <rule name> issue on the affected element` for every polish rule, and its
// plain-language clause fell through to `it undercuts the finished result`. Twelve rows of each on
// a single real target.
//
// The efficacy trial then measured the consequence. Six polish rule classes dropped to exactly
// zero on every treated page and those six were precisely the rules the payload NAMED. A model
// handed a list of rule names satisfies the rule names; it cannot improve anything the list does
// not name, because nothing else is in the payload.
//
// Jonah had already written the craft. `claude/skills/tactical-polish/` holds 1215 lines of it and
// `src/design-laws.ts` holds 41 prose rules, and `sidecoach-orchestrator.ts` referenced neither.
// This file is the wiring: one note per rule the standard actually checks, each carrying what good
// looks like, why it matters, the concrete fix with real values, and (for the most severe) a short
// example. Every note is drawn from THIS repo and names its source file.
//
// PROPORTIONALITY IS THE DESIGN CONSTRAINT, NOT AN AFTERTHOUGHT.
//
// Dumping 1215 lines into every call is a different failure with the same shape: a payload nobody
// reads teaches nothing. Notes are SELECTED by the findings actually present - a rule that passed
// contributes nothing - ordered by the registry's own severity, and capped at MAX_TAUGHT_NOTES.
// The findings list below the brief still enumerates every violation, so the cap withholds only
// the taught explanation, never a finding.

/** One craft note: what good looks like, why, and the concrete fix. */
export interface PolishCraftNote {
  /** Canonical registry rule key, e.g. `polish/scale-on-press`. */
  ruleKey: string;
  /** Short human title for the brief heading. */
  title: string;
  /** What good looks like. */
  good: string;
  /** Why it matters - the reason a reader can act on, not a restatement of the rule. */
  why: string;
  /** The concrete remediation, with real values. */
  fix: string;
  /** Optional short snippet, emitted only for the highest-severity notes. */
  example?: string;
  /** Provenance: the in-repo file this note's substance comes from. */
  source: string;
}

const TP = 'claude/skills/tactical-polish';

/**
 * The corpus, keyed by canonical registry rule key.
 *
 * Coverage over the 24 `polish-standard:N` rules is asserted at runtime by
 * `craftCoverageGaps()` and in `__tests__/polish-craft.test.ts`, so a rule added to the registry
 * without a note here fails a test rather than silently falling back to the template.
 */
export const POLISH_CRAFT: Record<string, PolishCraftNote> = {
  'polish/scale-on-press': {
    ruleKey: 'polish/scale-on-press',
    title: 'Scale on press',
    good: 'A button that moves under the finger. Pressing it scales the element to 0.96 and releasing returns it, driven by a transition so a release mid-press reverses smoothly instead of snapping.',
    why: 'Without it a click produces no physical confirmation, so the interface reads as a picture of a button rather than a control. This is the cheapest tactile signal available and it costs two declarations.',
    fix: 'Add `transition-property: scale; transition-duration: 150ms; transition-timing-function: ease-out` to the control and `scale: 0.96` on `:active`. Use exactly 0.96; never go below 0.95, which feels exaggerated. Skip it on controls where the motion would distract.',
    example: '.button { transition-property: scale; transition-duration: 150ms; transition-timing-function: ease-out; }\n.button:active { scale: 0.96; }',
    source: `${TP}/animations.md`,
  },
  'polish/concentric-radius': {
    ruleKey: 'polish/concentric-radius',
    title: 'Concentric border radius',
    good: 'Nested rounded surfaces whose curves stay parallel: outer radius equals inner radius plus the padding between them.',
    why: 'Mismatched radii on nested elements is the single most common thing that makes an interface feel off, and it is almost never noticed consciously - the reader just senses the corners fighting.',
    fix: 'Compute `outerRadius = innerRadius + padding`. A button at 8px radius inside 4px of padding wants a 12px container. When the padding exceeds 24px treat the layers as separate surfaces and choose each radius independently rather than forcing the math.',
    example: '.card { border-radius: 20px; padding: 8px; }  /* 12 + 8 */\n.card-inner { border-radius: 12px; }',
    source: `${TP}/surfaces.md`,
  },
  'polish/icon-swap-compound': {
    ruleKey: 'polish/icon-swap-compound',
    title: 'Compound icon transitions',
    good: 'An icon that changes state fades, scales and unblurs into place rather than being switched off and on.',
    why: 'Toggling visibility gives the eye a hard cut with no direction, which reads as a glitch. A compound transition tells the reader that one thing became another thing.',
    fix: 'Animate opacity 0 to 1, scale 0.25 to 1, and blur 4px to 0px together. Use those exact values. With no motion library, keep both icons in the DOM (one absolutely positioned) and cross-fade with `cubic-bezier(0.2, 0, 0, 1)` so both directions animate.',
    source: `${TP}/animations.md`,
  },
  'polish/image-outline-neutral': {
    ruleKey: 'polish/image-outline-neutral',
    title: 'Neutral image outlines',
    good: 'A 1px inset outline on images at 10% opacity, pure black in light mode and pure white in dark.',
    why: 'A tinted near-black picks up the surface colour underneath it and reads as dirt on the image edge. The outline is a neutral separator, not a themed element.',
    fix: 'Use `outline: 1px solid rgba(0, 0, 0, 0.1)` with `outline-offset: -1px` in light mode and `rgba(255, 255, 255, 0.1)` in dark. Never a palette near-neutral (slate, zinc, #0a0a0a) and never the accent colour. Outline rather than border so layout size is unchanged.',
    source: `${TP}/surfaces.md`,
  },
  'a11y/min-hit-area': {
    ruleKey: 'a11y/min-hit-area',
    title: 'Minimum hit area',
    good: 'Every interactive target at least 40x40px of actual hit area, extended past the visible element when the visual is smaller.',
    why: 'A 20px checkbox is a target most thumbs miss, and a miss on a small control is indistinguishable from the control not working. This is the failure that makes a page feel broken on a phone.',
    fix: 'Keep the visual size and extend the hit area with a centred pseudo-element sized 40x40px (WCAG 2.5.5 enhanced asks 44x44). If the extension would overlap a neighbouring control, shrink it to the largest size that does not collide - two interactive elements must never share hit area.',
    example: '.checkbox { position: relative; width: 20px; height: 20px; }\n.checkbox::after { content: ""; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 40px; height: 40px; }',
    source: `${TP}/surfaces.md`,
  },
  'polish/no-transition-all': {
    ruleKey: 'polish/no-transition-all',
    title: 'Transition only what changes',
    good: 'Every transition naming its exact properties, with separate timing where the properties want different speeds.',
    why: '`transition: all` makes the browser watch every property, so a padding or colour change you never intended to animate starts sliding, and it blocks optimisations the engine would otherwise make.',
    fix: 'Replace `transition: all` with `transition-property` listing the properties that actually change, for example `transition-property: scale, background-color`. Transform-family properties usually want a faster duration than colour.',
    example: '/* instead of transition: all 150ms ease-out */\n.button { transition-property: scale, background-color; transition-duration: 150ms; transition-timing-function: ease-out; }',
    source: `${TP}/performance.md`,
  },
  'polish/tabular-nums': {
    ruleKey: 'polish/tabular-nums',
    title: 'Tabular numerals',
    good: 'Any number that updates in place rendered with equal-width digits.',
    why: 'Proportional digits change width as the value changes, so a counter or timer shoves its neighbours a pixel at a time. The shift is small enough to feel like a rendering fault rather than a layout choice.',
    fix: 'Set `font-variant-numeric: tabular-nums` on counters, timers, live prices, numeric table columns and dashboard figures. Leave static and decorative numbers alone. Some faces (Inter) recentre the digit 1 under this property, which is expected.',
    source: `${TP}/typography.md`,
  },
  'polish/text-wrap-balance': {
    ruleKey: 'polish/text-wrap-balance',
    title: 'Heading and body text wrapping',
    good: 'Headings whose lines are close to even length, and short body text with no single word dangling on the last line.',
    why: 'A one-word last line on a heading is the most visible typographic defect on a page, and it is entirely free to fix. It is also the fastest read on whether anyone looked at the type.',
    fix: 'Use `text-wrap: balance` on headings; it only applies to blocks of about six lines or fewer, so it is wasted on paragraphs. Use `text-wrap: pretty` as the default for paragraphs, descriptions, captions and list items. On text over ten lines use neither.',
    source: `${TP}/typography.md`,
  },
  'polish/staggered-enter': {
    ruleKey: 'polish/staggered-enter',
    title: 'Split and stagger entrances',
    good: 'Content entering as semantic chunks about 100ms apart, not one container sliding in as a slab.',
    why: 'A single container animation tells the reader nothing about structure. Staggering reveals the reading order, so the entrance does real work instead of decorating.',
    fix: 'Split into logical groups (title, description, actions) and offset each by roughly 100ms; for a display title consider individual words at about 80ms. Combine opacity, a small translateY, and blur 4px to 0. Keep animated blur at or under 8px, with 2-4px the useful range.',
    source: `${TP}/animations.md`,
  },
  'polish/subtle-exit': {
    ruleKey: 'polish/subtle-exit',
    title: 'Subtle exits',
    good: 'Exits shorter and quieter than entrances: a small fixed translateY of about 12px, roughly 150ms against a 300ms enter.',
    why: 'The reader is already moving to the next thing, so a dramatic exit fights the attention it is losing. An exit that slides the full container height reads as the layout collapsing.',
    fix: 'Use a small fixed translateY with `ease-in` at 150ms, keeping enough directional movement to say where the element went. Do not remove the exit entirely; an element that vanishes loses the reader their place.',
    source: `${TP}/animations.md`,
  },
  'polish/font-smoothing': {
    ruleKey: 'polish/font-smoothing',
    title: 'Font smoothing',
    good: 'Antialiased smoothing applied once at the root.',
    why: 'On macOS text renders heavier than designed. Applied per-element it renders inconsistently, so a heading and its body text pick up different weights from the same declaration.',
    fix: 'Set `-webkit-font-smoothing: antialiased` and `-moz-osx-font-smoothing: grayscale` on the root element, not on individual components. Other platforms ignore both, so it is safe to apply universally.',
    source: `${TP}/typography.md`,
  },
  'polish/animatepresence-initial': {
    ruleKey: 'polish/animatepresence-initial',
    title: 'No entrance on first paint for default state',
    good: 'Elements already in their default state sitting still on load, animating only on later state changes.',
    why: 'An icon or toggle that animates itself in on every page load spends the reader\'s first moment on motion that carries no information, and reads as the page still assembling.',
    fix: 'Pass `initial={false}` to `AnimatePresence` for icon swaps, toggles, tabs and segmented controls. Do not apply it where the component relies on its initial prop for a genuine first-time entrance, such as a staggered hero - that removes the entrance entirely. Check a hard refresh after changing it.',
    source: `${TP}/animations.md`,
  },
  'polish/sparse-will-change': {
    ruleKey: 'polish/sparse-will-change',
    title: 'Sparse will-change',
    good: '`will-change` on two or three elements at most, naming only compositable properties.',
    why: 'Each hint costs a compositing layer and its memory. Applied to every hover it buys nothing and can make the page slower than leaving it out, which is the opposite of the intent.',
    fix: 'Limit it to `transform`, `opacity`, `filter`. Never `will-change: all`, and never on properties the GPU cannot composite (`top`, `left`, `width`, `height`, `background`, `color`). Add it after observing first-frame stutter, not before.',
    source: `${TP}/performance.md`,
  },
  'polish/shadows-over-borders': {
    ruleKey: 'polish/shadows-over-borders',
    title: 'Shadows for depth, borders for separation',
    good: 'Cards, buttons and elevated surfaces carrying depth through layered transparent shadows; dividers and table rules staying as borders.',
    why: 'A solid border colour is designed against one background and looks wrong on any other, so it breaks the moment the surface changes. Transparent shadows adapt because they multiply into whatever is behind them.',
    fix: 'Replace a depth border with three layered shadows: a 1px ring, a 1-2px lift, and an ambient spread, all rgba black at 4-8% in light mode, simplifying to a single `0 0 0 1px rgba(255, 255, 255, 0.08)` ring in dark. Leave dividers, table cell boundaries, hairlines and form input outlines as borders.',
    example: '--shadow-border:\n  0px 0px 0px 1px rgba(0, 0, 0, 0.06),\n  0px 1px 2px -1px rgba(0, 0, 0, 0.06),\n  0px 2px 4px 0px rgba(0, 0, 0, 0.04);',
    source: `${TP}/surfaces.md`,
  },
  'polish/optical-alignment': {
    ruleKey: 'polish/optical-alignment',
    title: 'Optical over geometric alignment',
    good: 'Elements centred by eye where geometry and perception disagree: icon-side padding trimmed, triangles nudged toward their mass.',
    why: 'Perceived centre follows visual mass, not the bounding box. A geometrically perfect play triangle sits visibly left of centre, and the reader registers the button as sloppy without being able to say why.',
    fix: 'On a button pairing text with a trailing icon set the icon-side padding about 2px tighter than the text side. Shift a play triangle roughly 2px right of centre. For asymmetric icons (stars, carets) fix the viewBox or path so no per-instance margin is needed.',
    source: `${TP}/surfaces.md`,
  },
  'polish/typography-rhythm': {
    ruleKey: 'polish/typography-rhythm',
    title: 'Typographic scale and rhythm',
    good: 'A scale with a real ratio between consecutive sizes and a measure that stays readable.',
    why: 'A flat scale (14/16/18/20) gives the eye no way to rank the page, so everything reads as the same importance and the reader has to parse rather than scan. Hierarchy is the cheapest usability there is.',
    fix: 'Keep at least a 1.25 ratio between consecutive sizes (14/18/24/32, not 14/16/18/20). Hold body text to 65-75 characters per line. Raise line-height as measure grows. Give ALL-CAPS 5-12% letter-spacing. Scale display sizes with `clamp()` whose preferred value mixes a rem base with a viewport term so browser zoom still works.',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.typography)',
  },
  'polish/shadow-hierarchy': {
    ruleKey: 'polish/shadow-hierarchy',
    title: 'Shadow hierarchy',
    good: 'A small set of named elevation tiers, applied by role, rather than a fresh box-shadow per component.',
    why: 'Without tiers, elevation stops meaning anything: a dropdown and a static card end up at the same depth and the reader loses the cue for what floats above what.',
    fix: 'Define elevation as tokens (`--shadow-sm`, `--shadow-md`, `--shadow-lg`) and reference them. Reserve the deepest tier for genuinely floating surfaces (dropdowns, modals), and keep resting surfaces on the shallowest.',
    source: `${TP}/surfaces.md`,
  },
  'a11y/focus-visible': {
    ruleKey: 'a11y/focus-visible',
    title: 'Visible focus rings',
    good: 'Every interactive element showing a clear ring when reached by keyboard, and not showing one on mouse click.',
    why: 'Without it a keyboard user cannot tell where they are on the page, which makes the interface unusable rather than merely awkward. This is the most consequential defect in this list.',
    fix: 'Style `:focus-visible` (not `:focus`) with a 2-3px ring at 3:1 contrast or better against its surroundings and about 2px of offset. Never remove the outline without replacing it.',
    example: '.button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.interaction)',
  },
  'polish/reduced-motion-respect': {
    ruleKey: 'polish/reduced-motion-respect',
    title: 'Reduced motion',
    good: 'A reduced-motion branch that keeps the interface legible with movement removed, not one that simply disables everything.',
    why: 'For readers with vestibular sensitivity, unrequested motion causes real symptoms. Honouring the preference is the difference between a page they can use and one they must close.',
    fix: 'Add `@media (prefers-reduced-motion: reduce)` and replace transform-based motion with a plain opacity change or no transition at all. Keep state changes visible without movement so nothing becomes ambiguous.',
    example: '@media (prefers-reduced-motion: reduce) {\n  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }\n}',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.motion)',
  },
  'a11y/color-contrast': {
    ruleKey: 'a11y/color-contrast',
    title: 'Text contrast',
    good: 'Body text at 4.5:1 or better against its actual background; large text and UI components at 3:1 or better.',
    why: 'Contrast is the single defect that most reliably makes text unreadable, and it fails first for exactly the readers with the least slack. Grey text on a coloured surface is the usual culprit.',
    fix: 'Measure each text and background pair and raise the darker side until it clears 4.5:1 (3:1 for text at 24px or 19px bold, and for UI component boundaries). Do not solve it with opacity - lowering alpha lowers contrast. Dark mode needs its own measurement, not the light values inverted.',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.color)',
  },
  'polish/state-completeness': {
    ruleKey: 'polish/state-completeness',
    title: 'Complete interactive states',
    good: 'Each interactive element defining the states it can actually reach: default, hover, focus, active, disabled, and where relevant loading, error and success.',
    why: 'A missing state is a moment where the interface stops answering. A button with no loading state gets clicked twice; one with no disabled state looks available when it is not.',
    fix: 'Walk each control and add the reachable states. Do not signal disabled with opacity alone (it usually breaks contrast). Prefer a skeleton over a spinner for loading, since it also holds the layout.',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.interaction)',
  },
  'polish/anti-pattern-genericity': {
    ruleKey: 'polish/anti-pattern-genericity',
    title: 'Category reflex',
    good: 'A look that could not be guessed from the product category alone.',
    why: 'If the palette is predictable from the category (dark blue observability, green fintech, neon-on-black crypto, Linear-clean monochrome productivity) the design is the training-data default rather than a decision, and it will look like every competitor.',
    fix: 'Name the reflex answer for this category and then choose against it deliberately. Check the second order too: with the obvious palette removed, the obvious fallback aesthetic (editorial-typographic, gradient mesh, card stack) is itself a reflex.',
    source: 'src/design-laws.ts (CATEGORY_REFLEX)',
  },
  'polish/interruptible-animations': {
    ruleKey: 'polish/interruptible-animations',
    title: 'Interruptible animations',
    good: 'Interactive state changes driven by transitions, which retarget mid-flight; keyframes reserved for one-shot staged sequences.',
    why: 'Readers change their mind mid-interaction. A keyframe animation runs its fixed timeline regardless, so closing a drawer while it opens snaps or restarts, and the interface reads as broken rather than busy.',
    fix: 'Move `:hover`, `:focus`, `:active` and open/close state changes onto `transition`. Keep `@keyframes` for entrances and loading sequences that genuinely run once.',
    source: `${TP}/animations.md`,
  },
  'polish/skip-load-animation': {
    ruleKey: 'polish/skip-load-animation',
    title: 'No entrance replay on load',
    good: 'An entrance that plays once, gated so a reload or a reduced-motion preference does not replay it.',
    why: 'An ungated entrance keyframe fires on every load, so returning to the page always costs the reader the same wait for content that is already there.',
    fix: 'Gate the entrance: `initial={false}` on `AnimatePresence` for default-state elements, or a reduced-motion guard plus a one-shot class for CSS keyframes. Verify that intentional first-visit entrances still play.',
    source: `${TP}/animations.md`,
  },
};

/**
 * Notes for finding classes the polish flow reports that are NOT one of the 24 rules: the copy
 * scan, the named-ban scan, and the responsive gate. Same shape, keyed by the finding rule as it
 * reaches the executive report.
 */
export const POLISH_FINDING_CRAFT: Record<string, PolishCraftNote> = {
  'linguistic-p0-templates': {
    ruleKey: 'linguistic-p0-templates',
    title: 'Rhetorical templates in copy',
    good: 'Sentences that carry a specific claim, written in the product\'s own voice.',
    why: 'The negation template ("Not a platform. A discipline.") and its relatives are the most recognisable shape of generated prose. A reader who has seen it twice stops reading for content.',
    fix: 'Rewrite each flagged sentence as a concrete claim: who does what, and what changes. Delete the antithesis rather than filling it. Every word earns its place.',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.writing)',
  },
  'linguistic-p1-slop-words': {
    ruleKey: 'linguistic-p1-slop-words',
    title: 'Slop words in copy',
    good: 'Verbs and nouns specific enough that swapping in a competitor\'s name would make the sentence false.',
    why: 'The flagged words are the predictable training-data default. They read as filler and weaken trust precisely where copy is trying to earn it.',
    fix: 'Replace each with a concrete verb or noun rooted in this product\'s vocabulary. Where the flag lands on a CSS property name rather than prose (for example `text-transform`), it is a false positive and should be left alone.',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.writing)',
  },
  'absolute-ban-p0': {
    ruleKey: 'absolute-ban-p0',
    title: 'Named anti-patterns',
    good: 'None of the named bans present. Each ban ships its own list of rewrites; the findings below name which one fired.',
    why: 'These are patterns that read as the default answer rather than a choice. They are banned because they are the shapes that appear when nobody decided.',
    fix: 'Take one of the prescribed rewrites listed with the finding rather than inventing a variant of the banned pattern.',
    source: 'src/design-laws.ts (ANTI_PATTERNS)',
  },
  'absolute-ban-p1': {
    ruleKey: 'absolute-ban-p1',
    title: 'Named anti-patterns',
    good: 'None of the named bans present. Each ban ships its own list of rewrites; the findings below name which one fired.',
    why: 'These are patterns that read as the default answer rather than a choice. They are banned because they are the shapes that appear when nobody decided.',
    fix: 'Take one of the prescribed rewrites listed with the finding rather than inventing a variant of the banned pattern.',
    source: 'src/design-laws.ts (ANTI_PATTERNS)',
  },
  'Responsive validation': {
    ruleKey: 'Responsive validation',
    title: 'Responsive behaviour',
    good: 'Layout that breaks where the content stops working, verified by rendering at 375, 768 and 1024, not asserted from the stylesheet.',
    why: 'Breakpoints chosen from a device list land in the wrong places, and a hover-only control has no equivalent on a touch screen at any width.',
    fix: 'Write mobile-first with min-width queries. Gate hover-revealed UI on `(hover: hover)` rather than width. Use `svh`/`dvh` instead of `vh` for full-height elements so the iOS address bar does not shift content, and `env(safe-area-inset-*)` near notches. Then render at each width and check nav fit, hit areas and horizontal overflow.',
    source: 'src/design-laws.ts (SHARED_DESIGN_LAWS.responsive)',
  },
  'violation-count': {
    ruleKey: 'violation-count',
    title: 'Aggregate violation count',
    good: 'Zero. This is the roll-up of the individual rule failures listed separately, not a defect of its own.',
    why: 'It is reported so the total cannot silently drift away from the findings enumerated beneath it, which is how a shrinking list of visible findings once masked a constant number of real ones.',
    fix: 'Do not act on this number directly. Work the individually named findings below it, each of which carries its own measured message and fix, and this count follows them down on the next run.',
    source: 'src/flow-handler-tactical-polish.ts',
  },
};

/**
 * The per-ban finding rules (`anti-patterns:ban-<name>`) are resolved DYNAMICALLY from
 * `reference-loader.loadAbsoluteBans()` rather than restated here, because that list already owns
 * each ban's description and its prescribed rewrites. Restating them would create a second source
 * of truth that drifts the first time a ban is added, which is the failure that once let the
 * payload certify a ban whose scanner had been deleted.
 */
export const BAN_RULE_PREFIX = 'anti-patterns:ban-';

const BAN_WHY =
  'A named ban is a pattern that reads as the default answer rather than a decision, which is why ' +
  'the standard forbids it outright instead of weighing it case by case. Each ban ships its own ' +
  'rewrites, so the fix is a choice from a list rather than something to invent.';

let _bans: Array<{ name: string; description: string; rewriteOptions: string[] }> | null = null;
function absoluteBans(): Array<{ name: string; description: string; rewriteOptions: string[] }> {
  if (_bans === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { loadAbsoluteBans } = require('./reference-loader');
      _bans = loadAbsoluteBans();
    } catch (e) {
      _bans = [];
      warnUnavailable('reference-loader absolute bans', e);
    }
  }
  return _bans || [];
}

/** A craft note for `anti-patterns:ban-<name>`, built from the ban reference. */
export function banCraftNote(rule: string): PolishCraftNote | undefined {
  if (!rule.startsWith(BAN_RULE_PREFIX)) return undefined;
  const name = rule.slice(BAN_RULE_PREFIX.length);
  const ban = absoluteBans().find((b) => b.name === name);
  if (!ban) return undefined;
  return {
    ruleKey: rule,
    title: `Named anti-pattern: ${ban.name}`,
    good: `The pattern is absent. What the ban covers: ${ban.description}`,
    why: BAN_WHY,
    fix: `Replace it with one of the prescribed rewrites: ${ban.rewriteOptions.join('; ')}. Do not ship a variant of the banned pattern instead.`,
    source: 'src/reference-loader.ts (loadAbsoluteBans)',
  };
}

/**
 * Severity order used to rank notes. Mirrors the registry's CanonicalSeverity ladder; a rule
 * outside the registry (the finding classes above) sorts after `advisory`.
 */
const SEVERITY_RANK: Record<string, number> = { blocker: 0, major: 1, minor: 2, advisory: 3 };
const UNRANKED = 4;

/**
 * How many notes may be TAUGHT in one brief, and how many of those carry an example.
 *
 * Not a guess. The brief has to stay short enough to be read in full by a producer that also has a
 * page and a task in front of it; past roughly eight principles a reader skims, and a skimmed
 * brief is the failure this file exists to fix. The findings list below the brief still enumerates
 * every violation, so the cap costs the reader an explanation, never a finding.
 */
export const MAX_TAUGHT_NOTES = 8;
export const MAX_EXAMPLES = 3;

interface RegistryPolishRule { n: number; key: string; severity: string }

/**
 * A dependency this module could not load. Cross-model review 2026-07-29 (Medium): both lazy requires
 * below swallowed every failure into an empty list, which silently disabled numeric rule mapping,
 * note selection, severity ranking and the report enrichment all at once, and looked exactly like a
 * product regression. Returning empty is still correct - a guidance build must not crash because a
 * reference module failed to load - but it now announces itself ONCE on stderr with the underlying
 * error, so the cause is diagnosable.
 */
const _warned = new Set<string>();
function warnUnavailable(what: string, err: unknown): void {
  if (_warned.has(what)) return;
  _warned.add(what);
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(
    `polish-craft: ${what} unavailable (${msg}). Craft notes for the affected rules will be omitted ` +
    'from the brief and the report will fall back to its generic template.\n');
}

let _registryRules: RegistryPolishRule[] | null = null;

/**
 * The `polish-standard:N` rules as the registry itself defines them: number, canonical key, and
 * severity. Read from the registry rather than restated here so the mapping cannot drift.
 *
 * Lazily required for the same reason `polish-standard-validator.ts` does it: the registry's check
 * modules import from that validator, and a static import chain through this file risks the same
 * cycle. Failure is non-fatal - an unreadable registry degrades to an empty mapping, and the
 * caller falls back to unranked ordering rather than throwing inside a guidance build.
 */
export function registryPolishRules(): RegistryPolishRule[] {
  if (_registryRules === null) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { RULES } = require('./product-rule-registry');
      _registryRules = (RULES as Array<Record<string, unknown>>)
        .map((r) => {
          const aliases = (r.sourceRuleAliases as string[] | undefined) || [];
          const alias = aliases.find((a) => /^polish-standard:\d+$/.test(a));
          if (!alias) return null;
          return {
            n: parseInt(alias.split(':')[1], 10),
            key: String(r.canonicalRuleKey),
            severity: String(r.severity),
          };
        })
        .filter((x): x is RegistryPolishRule => x !== null)
        .sort((a, b) => a.n - b.n);
      if (_registryRules.length === 0) warnUnavailable('product-rule-registry polish rules', 'registry exposed no polish-standard:N aliases');
    } catch (e) {
      _registryRules = [];
      warnUnavailable('product-rule-registry', e);
    }
  }
  return _registryRules;
}

/** `polish-standard:N` / `N` to the canonical rule key, or undefined when N is not a polish rule. */
export function polishRuleKeyForNumber(n: number): string | undefined {
  return registryPolishRules().find((r) => r.n === n)?.key;
}

/**
 * Normalise any of the shapes a polish rule arrives in to a craft-corpus key.
 *
 * Accepted: the canonical key (`polish/scale-on-press`), the BuildReport finding rule
 * (`polish-standard:rule-1`), the bare alias (`polish-standard:1`), and the finding-class keys in
 * POLISH_FINDING_CRAFT. Anything else returns undefined and the caller keeps its own fallback.
 */
export function normalizeCraftKey(rule: string | number | null | undefined): string | undefined {
  if (rule === null || rule === undefined) return undefined;
  if (typeof rule === 'number') return polishRuleKeyForNumber(rule);
  const raw = String(rule).trim();
  if (!raw) return undefined;
  if (POLISH_CRAFT[raw] || POLISH_FINDING_CRAFT[raw]) return raw;
  const m = /^polish-standard:(?:rule-)?(\d+)$/.exec(raw);
  if (m) return polishRuleKeyForNumber(parseInt(m[1], 10));
  if (banCraftNote(raw)) return raw;
  return undefined;
}

/** The note for a rule in any accepted shape, or undefined. */
export function craftNote(rule: string | number | null | undefined): PolishCraftNote | undefined {
  const key = normalizeCraftKey(rule);
  if (!key) return undefined;
  return POLISH_CRAFT[key] || POLISH_FINDING_CRAFT[key] || banCraftNote(key);
}

/** The concrete remediation for a rule, for the executive report's "After" column. */
export function craftRemediation(rule: string | number | null | undefined): string | undefined {
  return craftNote(rule)?.fix;
}

/**
 * The reason a rule matters, shaped for the executive report's plain-language CLAUSE.
 *
 * The renderer composes `<N> findings flagged; ` + this + `.`, and its own RULE_WHY map holds
 * lowercase sentence fragments for exactly that reason. A note's `why` is a full sentence because the
 * craft brief prints it as one, so handing it over raw produced
 * `flagged; It is reported so the total cannot drift..` - a capital mid-sentence and a doubled stop.
 * This converts sentence to clause: lowercase the first word unless it is an acronym or a code token,
 * and drop one trailing period. Only the FIRST sentence is used, so a two-sentence `why` cannot
 * smuggle a second full stop into the middle of the renderer's line.
 */
export function craftReason(rule: string | number | null | undefined): string | undefined {
  const why = craftNote(rule)?.why;
  if (!why) return undefined;
  const first = why.trim().split(/(?<=\.)\s+/)[0].replace(/\.\s*$/, '').trim();
  if (!first) return undefined;
  const head = first.split(/\s+/)[0];
  // Leave an acronym (WCAG), a backticked token (`transition: all`) or an already-lowercase word alone.
  const keepCase = /^[A-Z]{2,}/.test(head) || head.startsWith('`') || /^[a-z]/.test(head);
  return keepCase ? first : first.charAt(0).toLowerCase() + first.slice(1);
}

/**
 * Registry polish rules with no craft note. Empty is the invariant; a non-empty return means a rule
 * was added to the registry without teaching content and the payload would fall back to a template.
 */
export function craftCoverageGaps(): string[] {
  return registryPolishRules().filter((r) => !POLISH_CRAFT[r.key]).map((r) => `${r.n}:${r.key}`);
}

/**
 * Select the notes to teach for a set of failing rules.
 *
 * Ordered by registry severity (blocker first), then by rule number so the order is stable across
 * runs, then capped. Unknown rules are dropped rather than guessed at.
 */
export function selectCraftNotes(
  rules: Array<string | number>,
  limit: number = MAX_TAUGHT_NOTES,
): PolishCraftNote[] {
  const registry = registryPolishRules();
  const seen = new Set<string>();
  const picked: Array<{ note: PolishCraftNote; rank: number; n: number }> = [];
  for (const rule of rules) {
    const key = normalizeCraftKey(rule);
    if (!key || seen.has(key)) continue;
    const note = POLISH_CRAFT[key] || POLISH_FINDING_CRAFT[key] || banCraftNote(key);
    if (!note) continue;
    seen.add(key);
    const entry = registry.find((r) => r.key === key);
    picked.push({
      note,
      rank: entry ? (SEVERITY_RANK[entry.severity] ?? UNRANKED) : UNRANKED,
      n: entry ? entry.n : Number.MAX_SAFE_INTEGER,
    });
  }
  picked.sort((a, b) => a.rank - b.rank || a.n - b.n);
  return picked.slice(0, Math.max(0, limit)).map((p) => p.note);
}

/**
 * Render the craft brief: the TEACH half of the polish payload, selected by what actually failed.
 *
 * Returns [] when nothing failed, because a page that passes has nothing to be taught and a
 * constant block appended to every run is the defect this replaces.
 */
export function craftBriefLines(
  rules: Array<string | number>,
  opts: { limit?: number; examples?: number } = {},
): string[] {
  const limit = opts.limit ?? MAX_TAUGHT_NOTES;
  const exampleBudget = opts.examples ?? MAX_EXAMPLES;
  const notes = selectCraftNotes(rules, limit);
  if (notes.length === 0) return [];

  const distinct = new Set(
    rules.map((r) => normalizeCraftKey(r)).filter((k): k is string => !!k),
  ).size;
  const lines: string[] = [];
  lines.push('CRAFT BRIEF - what good looks like on the points this page missed.');
  // The disclosure names the CONFIGURED limit, not the post-slice count. Cross-model review
  // 2026-07-29 (Low): reporting the slice size read as "capped at N" even when the cap never bound.
  lines.push(
    `Selected from the ${distinct} rule${distinct === 1 ? '' : 's'} that failed on THIS page, hardest-first` +
      (distinct > limit ? `, capped at ${limit} taught here` : '') +
      '. Rules that passed are omitted. Every finding is still enumerated below the brief.',
  );
  lines.push('Read this before the findings: the fix is the principle, not the rule name.');
  lines.push('');

  let examplesUsed = 0;
  notes.forEach((note, i) => {
    lines.push(`${i + 1}. ${note.title.toUpperCase()}`);
    lines.push(`   Good: ${note.good}`);
    lines.push(`   Why:  ${note.why}`);
    lines.push(`   Do:   ${note.fix}`);
    if (note.example && examplesUsed < exampleBudget) {
      examplesUsed++;
      for (const l of note.example.split('\n')) lines.push(`     ${l}`);
    }
    lines.push('');
  });
  return lines;
}
