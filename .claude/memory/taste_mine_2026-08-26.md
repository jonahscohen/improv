---
name: Taste mine 2026-08-26 - proposed candidates (INERT)
description: 13 net-new + 8 strengthen-existing taste-rule candidates mined into the inert quarantine; 0 restatement(s) dropped by dedup. Not enforced; awaiting human review.
type: project
source: hook
verified: none - proposals are inert data, not enforced; each pre-flighted through validateRegistry in isolation
confidence: low
---

# Taste mine 2026-08-26 (proposed candidates - INERT, awaiting review)

Mined by sidecoach-mine against commit f4ff2ceb. These candidates are INERT DATA in
`sidecoach/data/proposed-rules/` and the queue `sidecoach/data/taste-candidates.json`. Nothing here is
enforced: no source file imports the quarantine, and promotion to a live rule is a separate,
human-gated step. External expert content was read as DATA for provenance and evidence only.

## Corpus
- beats: 438
- measured audit-history rules: 37 (from 167 scan(s))
- expert-external files: 82
- rule-store entries (dedup): 210

## Candidates (ranked: measured > expert > speculative; detectable outranks vibe)
- **ease-in easing on a UI transition or animation** (net-new, minor, expert-external/high)
  - ruleId: `motion.ease-in-on-ui`  minedBy: motion-analyst
  - why: Net-new: the registry has bounce-easing (overshoot curves) and the pending no-scale-zero-enter, but NO rule against ease-in timing on UI. Emil Kowalski flags ease-in as an on-sight block because it delays the exact moment the user is watching. High-precision presence signal: the literal token ease-in in a transition/animation timing function.
  - evidence: reference/_extracted/external/emil-kowalski-skills/skills/animate/SKILL.md: Never `ease-in` on UI. It starts slow, delaying the exact moment the user is watching. `ease-out` at 200ms feels faster than `ease-in` at 200ms.
  - evidence: reference/_extracted/external/emil-kowalski-skills/skills/review-animations/SKILL.md: `ease-in` on UI is a block - it delays the moment the user watches most.
- **Animating a layout property (width, height, top, left, margin, padding) instead of transform/opacity** (net-new, minor, expert-external/high)
  - ruleId: `motion.animate-layout-property`  minedBy: motion-analyst
  - why: Net-new: the registry's no-transition-all bans the `all` keyword but does NOT catch a transition/animation that names a specific layout property. Emil Kowalski treats animating width/height/margin/padding/top/left as a performance finding because those trigger layout+paint off the GPU. Presence signal: a transition-property or transition/animation shorthand naming a geometry property.
  - evidence: reference/_extracted/external/emil-kowalski-skills/skills/animate/SKILL.md: `transform` and `opacity` only. They skip layout and paint and run on the GPU. `width`/`height`/`margin`/`padding`/`top`/`left` trigger all three.
  - evidence: reference/_extracted/external/emil-kowalski-skills/skills/review-animations/SKILL.md: GPU-only properties. Animate `transform` and `opacity` only. Animating `width`/`height`/`margin`/`padding`/`top`/`left` is a performance finding.
- **outline: none (or outline: 0) removing the focus indicator with no verified replacement** (net-new, major, expert-external/high)
  - ruleId: `a11y.outline-none-no-replacement`  minedBy: accessibility-lens
  - why: Net-new: focus-visible checks that a focus STYLE is present; this catches the opposite defect, an explicit outline: none / outline: 0 that STRIPS the default indicator. Jakub Krehel: never remove the outline without a verified replacement. High-precision presence token independent of the focus-visible rule.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-accessibility/SKILL.md: Never use `outline: none` without a verified replacement, and preserve system colors in forced-colors mode.
- **Positive tabindex value (tabindex greater than 0)** (net-new, major, expert-external/high)
  - ruleId: `a11y.positive-tabindex`  minedBy: accessibility-lens
  - why: Net-new: the registry has no tabindex rule at all. Jakub Krehel: only tabindex=0 and tabindex=-1 are legitimate; any positive value breaks the natural tab order. High-precision markup presence signal (tabindex="1" and up).
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-accessibility/SKILL.md: Use only `tabindex="0"` to join the natural tab order and `tabindex="-1"` for programmatic focus. Positive values break that order.
- **Viewport meta locks zoom (user-scalable=no or maximum-scale capping pinch-zoom)** (net-new, major, expert-external/high)
  - ruleId: `a11y.viewport-zoom-locked`  minedBy: accessibility-lens
  - why: Net-new: no registry rule inspects the viewport meta. Jakub Krehel: never let the viewport meta cap how far the reader can zoom, since the page must survive 200% zoom. High-precision markup presence signal on the meta viewport content string.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-accessibility/SKILL.md: The page must work at 200% zoom and reflow at 320px width without horizontal scrolling ... never let the viewport meta cap how far the reader can zoom.
- **UI transition or animation duration over 300ms with no stated reason** (net-new, minor, expert-external/medium)
  - ruleId: `motion.ui-duration-over-300ms`  minedBy: motion-analyst
  - why: Net-new: the registry has no motion-duration bound. Emil Kowalski holds UI motion under 300ms; anything slower is a finding unless justified (marketing/explanatory is the documented exception). A value-threshold signal, not a pure presence token, so medium: a css-rule detector reads transition/animation duration values above 300ms.
  - evidence: reference/_extracted/external/emil-kowalski-skills/skills/animate/SKILL.md: UI animations stay under 300ms. A 180ms dropdown feels more responsive than a 400ms one.
  - evidence: reference/_extracted/external/emil-kowalski-skills/skills/review-animations/SKILL.md: Sub-300ms UI. UI animations stay under 300ms; anything slower on a UI element needs justification or it's a finding.
- **Icon-only button with no accessible name (missing aria-label)** (net-new, major, expert-external/medium)
  - ruleId: `a11y.icon-button-name`  minedBy: accessibility-lens
  - why: Net-new: button-label-specific (COPY_003) flags generic label TEXT like 'click here'; this is the distinct defect of a button whose only child is an icon and which carries NO accessible name at all. Jakub Krehel: icon-only buttons need a descriptive aria-label. Markup-structural, medium precision (a button containing only an svg/icon and no aria-label / text).
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-accessibility/SKILL.md: Icon-only buttons need a descriptive `aria-label`. Visible label text must appear in the accessible name.
- **A div (or other non-interactive element) used as a control via onClick instead of a real button or link** (net-new, major, expert-external/medium)
  - ruleId: `a11y.interactive-div-onclick`  minedBy: convention-extractor
  - why: Net-new: no registry rule covers the div-onClick anti-pattern. Two pioneers converge: Jakub Krehel says never <div onClick>, and the Vercel guidelines say anything that navigates must be a real <a>, not a div/button with onClick. Markup presence signal (onClick bound to a div/span), medium precision because it is framework-flavored (jsx/tsx).
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-accessibility/SKILL.md: The first rule of ARIA: don't use ARIA when a native element exists. `<button>` for actions, `<a href>` for navigation, never `<div onClick>`.
  - evidence: reference/_extracted/external/vercel-web-interface-guidelines/NAVIGATION-STATE.md: Anything that navigates must be an `<a>` (or framework `<Link>`), not a `<div>`/`<button>` with an onClick.
- **Text input smaller than 16px, which triggers iOS Safari page zoom on focus** (net-new, minor, expert-external/medium)
  - ruleId: `typography.input-font-below-16px`  minedBy: typography-lens
  - why: Net-new: tiny-text flags sub-threshold body text generally, but nothing targets the specific mobile bug where an input under 16px makes iOS Safari zoom the whole page on focus. Jakub Krehel documents the 16px input floor explicitly. Detectable css-rule signal correlating an input/textarea/select selector with a font-size below 16px; medium precision.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-typography/SKILL.md: iOS Safari zooms the whole page when an input's text is smaller than `16px` ... Inputs still need `16px` on mobile.
- **Long-form text with no capped measure (line length runs past ~75 characters)** (net-new, minor, expert-external/medium) [PRE-FLIGHT FAILED - filed with errors]
  - ruleId: `typography.measure-uncapped`  minedBy: typography-lens
  - why: Net-new: the registry has text-wrap-balance and typography-rhythm but no rule on the reading measure. Two pioneers converge on a 45-75 / 60-75 character cap; long lines make the eye lose the next line. A rendered-scan rule (measuring rendered line length on prose blocks); medium because it needs the rendered pass, not a static token.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-typography/SKILL.md: Cap the measure. Long lines make it hard for the eye to find the next one. Cap long-form text around 60-75 characters per line.
  - evidence: reference/_extracted/external/oracle/reference/typeset.md: Keep prose in the 45-75ch range. Tune line height inversely with measure.
  - preflight error: rule typography.measure-uncapped declares rendered-scan evidence but is missing from RENDERED_BACKED_RULE_IDS (it would never be promoted-required or fail-closed)
- **Thin/light font weight (under 300) applied to text-size copy** (net-new, minor, expert-external/medium)
  - ruleId: `typography.thin-weight-text`  minedBy: typography-lens
  - why: Net-new: the registry has no font-weight rule. Jakub Krehel: below 18px stay at weight 400 or heavier, and weights under 300 are display-only and disappear at text sizes. Presence signal on font-weight: 100/200/300; medium precision because 300 at large display sizes is legitimate, so the detector should favor the 100/200 tell.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-typography/SKILL.md: Below `18px`, stay at weight `400` or heavier. Weights under `300` are display-only at `28px`+; they disappear at text sizes.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-typography/SKILL.md: Thin/Light weight on `14px` UI text -> Weight `400`+ below `18px`; thin weights are display-only.
- **Display-P3 color declared with no sRGB fallback ahead of the color-gamut guard** (net-new, minor, expert-external/medium)
  - ruleId: `color.p3-no-srgb-fallback`  minedBy: color-systematist
  - why: Net-new: theming has color-scheme-dark but nothing about wide-gamut fallbacks. Jakub Krehel: a P3 color needs the sRGB value declared first, then overridden inside @media (color-gamut: p3), or non-P3 displays get an undefined color. Presence signal on a color(display-p3 ...) declaration lacking a preceding sRGB fallback; medium precision.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-colors/SKILL.md: P3 color with no sRGB fallback -> Declare the sRGB value first, then override inside `@media (color-gamut: p3)`.
- **Physical directional inset (margin-left/right, padding-left/right) where a logical property belongs** (net-new, minor, expert-external/low)
  - ruleId: `layout.physical-inset-not-logical`  minedBy: layout-lens
  - why: Net-new: the registry has no logical-property / RTL rule. Jakub Krehel: use logical properties for direction-dependent layout and reserve physical left/right for genuinely physical geometry, or the layout breaks when mirrored for RTL. Deliberately low confidence: this is a broad presence signal (physical directional props are common and often legitimate in LTR-only work), so it is a human-gated candidate that only earns enforcement in an RTL-targeting project.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-layout/SKILL.md: Use logical properties for direction-dependent layout: `padding-inline-start`, `margin-inline-end`. Reserve physical left and right for genuinely physical geometry.
  - evidence: reference/_extracted/external/jakub-krehel-skills/skills/better-layout/SKILL.md: `margin-left` / `padding-right` in a localizable layout -> `margin-inline-start` / `padding-inline-end`.
- **polish/text-wrap-balance** (strengthen-existing, minor, measured-audit-history/high)
  - ruleId: `polish.text-wrap-balance`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.text-wrap-balance
  - why: Rule polish.text-wrap-balance fired 45x across our own audits (severities {"warning":45}); measured recurrence suggests reviewing whether advisory is strong enough.
  - evidence: data/audit-history.jsonl: polish.text-wrap-balance fired 45x, last 2026-08-25T21:54:40.069Z
- **polish/shadows-over-borders** (strengthen-existing, major, measured-audit-history/high)
  - ruleId: `polish.shadows-over-borders`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.shadows-over-borders
  - why: Rule polish.shadows-over-borders fired 27x across our own audits (severities {"warning":27}); measured recurrence suggests reviewing whether minor is strong enough.
  - evidence: data/audit-history.jsonl: polish.shadows-over-borders fired 27x, last 2026-08-25T21:54:39.469Z
- **polish/shadow-hierarchy** (strengthen-existing, major, measured-audit-history/high)
  - ruleId: `polish.shadow-hierarchy`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.shadow-hierarchy
  - why: Rule polish.shadow-hierarchy fired 27x across our own audits (severities {"warning":27}); measured recurrence suggests reviewing whether minor is strong enough.
  - evidence: data/audit-history.jsonl: polish.shadow-hierarchy fired 27x, last 2026-08-25T21:54:39.469Z
- **polish/marketing-buzzword** (strengthen-existing, major, measured-audit-history/medium)
  - ruleId: `polish.marketing-buzzword`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.marketing-buzzword
  - why: Rule polish.marketing-buzzword fired 11x across our own audits (severities {"warning":11}); measured recurrence suggests reviewing whether minor is strong enough.
  - evidence: data/audit-history.jsonl: polish.marketing-buzzword fired 11x, last 2026-08-25T21:54:31.542Z
- **polish/tiny-text** (strengthen-existing, major, measured-audit-history/medium)
  - ruleId: `polish.tiny-text`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.tiny-text
  - why: Rule polish.tiny-text fired 11x across our own audits (severities {"warning":11}); measured recurrence suggests reviewing whether minor is strong enough.
  - evidence: data/audit-history.jsonl: polish.tiny-text fired 11x, last 2026-08-25T21:54:36.752Z
- **polish/icon-swap-compound** (strengthen-existing, major, measured-audit-history/medium)
  - ruleId: `polish.icon-swap-compound`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.icon-swap-compound
  - why: Rule polish.icon-swap-compound fired 7x across our own audits (severities {"warning":7}); measured recurrence suggests reviewing whether minor is strong enough.
  - evidence: data/audit-history.jsonl: polish.icon-swap-compound fired 7x, last 2026-08-25T22:42:40.099Z
- **polish/subtle-exit** (strengthen-existing, major, measured-audit-history/medium)
  - ruleId: `polish.subtle-exit`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.subtle-exit
  - why: Rule polish.subtle-exit fired 6x across our own audits (severities {"warning":6}); measured recurrence suggests reviewing whether minor is strong enough.
  - evidence: data/audit-history.jsonl: polish.subtle-exit fired 6x, last 2026-08-25T22:42:40.099Z
- **polish/typography-rhythm** (strengthen-existing, major, measured-audit-history/medium)
  - ruleId: `polish.typography-rhythm`  minedBy: recurring-defect
  - matched existing: product-rule-registry:polish.typography-rhythm
  - why: Rule polish.typography-rhythm fired 17x across our own audits (severities {"warning":17}); measured recurrence suggests reviewing whether minor is strong enough.
  - evidence: data/audit-history.jsonl: polish.typography-rhythm fired 17x, last 2026-08-25T21:54:31.542Z

## Next
A human reviews each candidate (rule body + provenance + evidence + pre-flight) and promotes the
accepted ones through the separate, consent-gated promotion path. This miner never promotes.
