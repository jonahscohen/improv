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

## Stage 4a addition (default-typeface) - added 2026-07-24 for the A5a taste-detection gate
This class postdates the original lead-reviewed 22 above; it is added here so an independent Codex pass can set
its subjective ground truth (the 22-class rubric predated the class). Same constraints as every class above -
descriptive, screenshot-judgeable, no thresholds/properties/selectors.
- default-typeface: the page never ASKS for a typeface for its body and content text - the font stack it requests is only the browser/operating-system default (or a generic websafe family like Times, Arial, Helvetica, Georgia, Verdana), rather than naming a deliberately selected typeface. Judge what the page REQUESTS, not what it happens to look like: a page that names a chosen family is ABSENT even if that font is unavailable and the text paints as a plain system face.

## Stage 4b/4c/4d additions (11 rendered taste classes) - added 2026-07-25 for the A5a taste-detection gate
These 11 classes postdate the original lead-reviewed 22 (like default-typeface), so an independent Codex pass sets
their subjective ground truth here. Four sibling classes in this same A5a batch are ALREADY defined above and are
NOT repeated: all-caps-body, tight-leading, extreme-negative-tracking (Typographic/motion), numbered-section-markers
(Taste-idiom). Same constraints as every class above: DESCRIPTIVE - what the idiom LOOKS LIKE, or for motion/hover
what it DOES - per common design understanding, with no thresholds, property names, or selectors.
- oversized-h1: the main heading is set so large that it dominates the opening screen, far bigger than a conventional page title or section heading.
- sub-11px-ui: small interface and chrome text - navigation, labels, badges, captions, footnotes, legal lines - set small enough to strain legibility for typical users.
- thin-border-wide-shadow: panels or cards pair a faint hairline outline with a large, soft, spread-out drop shadow, so a thin edge appears to float on a wide diffuse shadow.
- repeating-stripe-gradients: the background is built from repeated gradient stripes - banded, striped color transitions tiled as a recurring pattern.
- text-under-overlay: headline or body text is laid over an image with a darkening scrim or tint between them, so the words read against a muted, shaded panel.
- first-viewport-overflow: the opening screen does not fit its own content - something in the first view is cut off, clipped, or spills past the visible edge.
- decorative-dot-grid: the background is ornamented with a regular grid of small, evenly-spaced dots as a decorative texture.
- soft-radial-glow: a soft circular glow or halo of light bleeds from behind an element - a diffuse radial luminance sitting in the background.
- marquee: content slides or scrolls sideways continuously, ticker-style, looping across the page without stopping.
- blinking-cursor: an element flashes on and off repeatedly in a hard, full on/off blink, like a terminal cursor - as opposed to a gentle fade or slow pulse.
- image-hover-transform: pointing at (hovering) an image makes it move, grow, or tilt - a zoom or shift that triggers on hover rather than being always present.

## LABELING SIGNAL per class (lead requirement - judge from what a human would)
Most of these idioms are VISUAL gestalt judgments. Judging them from HTML/CSS text alone forces the labeler
to mentally-render the CSS - the exact unreliability the objective labeler was rebuilt (rendered, not regex)
to avoid. So the labeler MUST be given the RENDERED SCREENSHOT (the referee's existing Playwright capture)
as the primary signal, with the page markup as a secondary signal. Per class:
- VISUAL (primary signal = SCREENSHOT): cream-palette, ai-color-palette, hero-eyebrow-chip,
  repeated-section-kickers, numbered-section-markers, icon-tile-stack, italic-serif-display, nested-cards,
  side-stripe-borders, glassmorphism-default, hero-metric-template, gradient-text, dark-glow, tiny-text,
  wide-tracking, all-caps-body, tight-leading, extreme-negative-tracking, oversized-h1, sub-11px-ui,
  thin-border-wide-shadow, repeating-stripe-gradients, text-under-overlay, first-viewport-overflow,
  decorative-dot-grid, soft-radial-glow. The labeler looks at the rendered page and judges appearance -
  never parses CSS to infer it. (These idioms are geometry/computed-style the hermetic render paints
  faithfully - letter/line spacing, caps, heading scale, borders/shadows, stripe/dot/glow backgrounds,
  first-view overflow - so the screenshot IS the construct. NOTE for text-under-overlay: the darkening
  scrim renders, but the underlying photo aborts in the hermetic capture, so the labeler judges the
  overlay it can see; if the idiom is unrecognizable without the image, that is reported as a recall limit,
  not forced to present.)
- TEXTUAL (primary signal = page TEXT): marketing-buzzword, aphoristic-cadence. Judged from the copy.
- MOTION (signal = the animation/transition character in the markup): layout-transition, bounce-easing,
  marquee, blinking-cursor. A static screenshot cannot show motion (a marquee scrolls sideways, a cursor
  blinks on and off - both invisible in one frame), so these are judged from the page's motion declarations:
  <marquee> elements, and keyframe animation bodies (so the labeler sees the actual horizontal-slide or
  opacity on/off, not just that an animation exists). This is NOT detection logic (it's "does the page slide
  content sideways forever" / "does something hard-blink on and off"), and it must not borrow the architect's
  specific thresholds.
- HOVER (signal = the page's :hover transform declarations): image-hover-transform. A hover effect is invisible
  in a static screenshot (the pointer is not over anything) and is not a keyframe animation, so it is judged
  from the page's :hover rules that transform an image - what the page DOES when an image is pointed at. This
  is NOT detection logic (it's "does hovering an image move or resize it"), not the architect's count/threshold.
- TYPEFACE (signal = the page's declared font-family stacks): default-typeface. This class is about what the
  page REQUESTS, not what it paints, so a screenshot is the WRONG signal for it: the hermetic render blocks
  webfonts, so a page that deliberately names a custom family still paints as a plain system face, and a
  screenshot-only labeler reads that as "default" when the page in fact chose a typeface. (Recorded 2026-07-24:
  the first A5a pass labeled this class from screenshots and flipped six deliberately-branded fixtures to
  present, because they name fictional families that paint as generic system sans.) So it is judged from the
  page's declared font-family declarations. This is NOT detection logic - the labeler is asked "does the page
  ever ask for a chosen typeface for its content text", not to apply any share threshold or selector rule.
The labeling model MUST actually SEE the screenshot (vision-capable) - verify on known visual cases before
the full run (a known cream/gradient page -> present from the screenshot; a known plain page -> absent).

## Lead review checklist (before the labeling run)
- [ ] Each definition is DESCRIPTIVE (what it is), not a detection rule (no thresholds/properties/selectors).
- [ ] Neutral wording - does not preview or match the architect's detection approach.
- [ ] An independent designer could judge present/absent from the page alone using only this text.
- [ ] Finalized rubric committed; its content SHA recorded with every label (reproducibility).
