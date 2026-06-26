# Subjective-class labeling RUBRIC (FINALIZED - lead-reviewed 2026-06-23)

LEAD SIGN-OFF: the architect's draft definitions are genuinely descriptive (no px thresholds, no CSS
property names, no selectors, no "if X then") - they describe what each idiom LOOKS LIKE, per common
design understanding, not how to detect it. Approved as-is. The labels these produce are the ground
truth the architect's detection rules are measured against in A5a, so this rubric must stay independent
of those rules. Added below: the LABELING SIGNAL each class is judged from (see that section).

The SUBJECTIVE ground truth for the 22 held classes is set by the lead-run Codex pass, graded in A5a
(taste-detection head-to-head). This rubric describes what each idiom IS, per common design understanding,
so an independent labeler can judge presence NEUTRALLY.

CRITICAL (lead constraint): these are DESCRIPTIVE definitions, NOT detection rules. They must NOT encode
the architect's detection logic (thresholds, CSS properties, selectors, algorithms) - the labels are the
ground truth the architect's rules are MEASURED against, so rubric == rules would be circular. The architect
drafts descriptively; the LEAD finalizes and rewrites anything that reads like a detection rule. No px
numbers, no property names, no "if X then" - just "what the idiom looks like / is."

Judgement: for each class, present (the idiom is a recognizable feature of the page's design) or absent.
The labeler may note confidence + a short rationale. Labeled by Codex (labeledBy=codex); architect is
registered as rule-author for all 22 so the freeze gate rejects any architect-authored label here.

## Taste-idiom classes (15)
- cream-palette: the dominant background is an off-white cream / sand / ivory tone rather than pure white or a saturated color.
- ai-color-palette: the color scheme reads as a generic "AI-generated default" combination (e.g. purple/indigo-to-blue with teal or violet accents) of the kind default AI design tools tend to produce.
- hero-eyebrow-chip: a small pill or chip sits above the main hero headline as an introductory tag/label ("eyebrow").
- repeated-section-kickers: most sections are introduced by a small repeated label/kicker above the heading, used as a template across the page.
- numbered-section-markers: sections or items are marked with prominent decorative numerals (01, 02, 03...) as an organizing motif.
- icon-tile-stack: features are presented as a uniform grid/row of tiles, each led by a small icon in a rounded square, stacked consistently.
- italic-serif-display: large display headings use an italic serif as the signature typographic gesture.
- nested-cards: cards appear inside other cards - layered bordered containers holding sub-containers.
- side-stripe-borders: a colored vertical stripe / side accent border on cards or callouts recurs as a motif.
- glassmorphism-default: frosted-glass surfaces (semi-transparent panels with a blurred backdrop) are used as the default surface treatment.
- hero-metric-template: the hero showcases a row of large numbers/stats (users, uptime, ratings) as a templated trust device.
- gradient-text: headline or display text is filled with a color gradient instead of a single solid color.
- marketing-buzzword: the copy leans on generic marketing buzzwords (seamless, powerful, innovative, effortless, revolutionary) rather than concrete specifics.
- aphoristic-cadence: copy is written as short punchy fragments in a clipped rhythmic cadence ("Build faster. Ship smarter. Scale effortlessly.").
- dark-glow: a dark theme with glowing / neon accents (glow shadows, neon gradients, luminous buttons) as the signature look.

## Typographic / motion classes (7) - moved here because their threshold is taste, not a spec constant
- tiny-text: text set small enough that it strains readability for typical users (notably small body or interface text).
- wide-tracking: letter-spacing loosened enough to noticeably space out words beyond comfortable reading (set aside conventional small-caps/label spacing, which is normal).
- all-caps-body: running body text (sentences/paragraphs, not short labels) set entirely in capitals, which slows reading.
- layout-transition: animated motion that changes elements' size or position in a way that shifts the surrounding content (as opposed to motion that only fades or transforms in place).
- bounce-easing: motion that overshoots and springs back - a bouncy / elastic animation character.
- tight-leading: line spacing on running text set tight enough that the lines feel crowded and harder to read.
- extreme-negative-tracking: letters pulled together strongly enough that they crowd or visually touch.

## LABELING SIGNAL per class (lead requirement - judge from what a human would)
Most of these idioms are VISUAL gestalt judgments. Judging them from HTML/CSS text alone forces the labeler
to mentally-render the CSS - the exact unreliability the objective labeler was rebuilt (rendered, not regex)
to avoid. So the labeler MUST be given the RENDERED SCREENSHOT (the referee's existing Playwright capture)
as the primary signal, with the page markup as a secondary signal. Per class:
- VISUAL (primary signal = SCREENSHOT): cream-palette, ai-color-palette, hero-eyebrow-chip,
  repeated-section-kickers, numbered-section-markers, icon-tile-stack, italic-serif-display, nested-cards,
  side-stripe-borders, glassmorphism-default, hero-metric-template, gradient-text, dark-glow, tiny-text,
  wide-tracking, all-caps-body, tight-leading, extreme-negative-tracking. The labeler looks at the rendered
  page and judges appearance - never parses CSS to infer it.
- TEXTUAL (primary signal = page TEXT): marketing-buzzword, aphoristic-cadence. Judged from the copy.
- MOTION (signal = the animation/transition character in the markup): layout-transition, bounce-easing.
  A static screenshot cannot show motion, so these are judged from the page's motion declarations - this is
  NOT detection logic (it's "does the page have bouncy / size-shifting motion"), and it must not borrow the
  architect's specific rule.
The labeling model MUST actually SEE the screenshot (vision-capable) - verify on known visual cases before
the full run (a known cream/gradient page -> present from the screenshot; a known plain page -> absent).

## Lead review checklist (before the labeling run)
- [ ] Each definition is DESCRIPTIVE (what it is), not a detection rule (no thresholds/properties/selectors).
- [ ] Neutral wording - does not preview or match the architect's detection approach.
- [ ] An independent designer could judge present/absent from the page alone using only this text.
- [ ] Finalized rubric committed; its content SHA recorded with every label (reproducibility).
