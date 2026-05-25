# make-interfaces-feel-better - Core principles (extracted)

This is the canonical extraction of the `make-interfaces-feel-better` skill's `SKILL.md` for sidecoach. The source verbatim lift comes first, followed by an Extension section that increases specificity, then a "What's missing" section that names gaps. Treat this file as the authoritative version for sidecoach orchestration; the original skill is being absorbed and will be retired.

> Note on punctuation: the source uses emdashes throughout. Per CLAUDE.md (no emdashes anywhere), every emdash from the source has been converted to a regular hyphen with surrounding spaces. All other content is byte-for-byte preserved.

---

## Source verbatim lift

The following is copied from `/Users/spare3/.agents/skills/make-interfaces-feel-better/SKILL.md` with emdashes converted to hyphens.

### Frontmatter (source)

```yaml
name: make-interfaces-feel-better
description: Design engineering principles for making interfaces feel polished. Use when building UI components, reviewing frontend code, implementing animations, hover states, shadows, borders, typography, micro-interactions, enter/exit animations, or any visual detail work. Triggers on UI polish, design details, "make it feel better", "feels off", stagger animations, border radius, optical alignment, font smoothing, tabular numbers, image outlines, box shadows.
```

### Details that make interfaces feel better

Great interfaces rarely come from a single thing. It's usually a collection of small details that compound into a great experience. Apply these principles when building or reviewing UI code.

### Quick Reference

| Category | When to Use |
| --- | --- |
| [Typography](typography.md) | Text wrapping, font smoothing, tabular numbers |
| [Surfaces](surfaces.md) | Border radius, optical alignment, shadows, image outlines, hit areas |
| [Animations](animations.md) | Interruptible animations, enter/exit transitions, icon animations, scale on press |
| [Performance](performance.md) | Transition specificity, `will-change` usage |

### Core Principles

#### 1. Concentric Border Radius

Outer radius = inner radius + padding. Mismatched radii on nested elements is the most common thing that makes interfaces feel off.

#### 2. Optical Over Geometric Alignment

When geometric centering looks off, align optically. Buttons with icons, play triangles, and asymmetric icons all need manual adjustment.

#### 3. Shadows Over Borders

Layer multiple transparent `box-shadow` values for natural depth. Shadows adapt to any background; solid borders don't.

#### 4. Interruptible Animations

Use CSS transitions for interactive state changes - they can be interrupted mid-animation. Reserve keyframes for staged sequences that run once.

#### 5. Split and Stagger Enter Animations

Don't animate a single container. Break content into semantic chunks and stagger each with ~100ms delay.

#### 6. Subtle Exit Animations

Use a small fixed `translateY` instead of full height. Exits should be softer than enters.

#### 7. Contextual Icon Animations

Animate icons with `opacity`, `scale`, and `blur` instead of toggling visibility. Use exactly these values: scale from `0.25` to `1`, opacity from `0` to `1`, blur from `4px` to `0px`. If the project has `motion` or `framer-motion` in `package.json`, use `transition: { type: "spring", duration: 0.3, bounce: 0 }` - bounce must always be `0`. If no motion library is installed, keep both icons in the DOM (one absolute-positioned) and cross-fade with CSS transitions using `cubic-bezier(0.2, 0, 0, 1)` - this gives both enter and exit animations without any dependency.

#### 8. Font Smoothing

Apply `-webkit-font-smoothing: antialiased` to the root layout on macOS for crisper text.

#### 9. Tabular Numbers

Use `font-variant-numeric: tabular-nums` for any dynamically updating numbers to prevent layout shift.

#### 10. Text Wrapping

Use `text-wrap: balance` on headings. Use `text-wrap: pretty` for body text to avoid orphans.

#### 11. Image Outlines

Add a subtle `1px` outline with low opacity to images for consistent depth. The color must be pure black in light mode (`rgba(0, 0, 0, 0.1)`) and pure white in dark mode (`rgba(255, 255, 255, 0.1)`) - never a near-black like slate, zinc, or any tinted neutral. A tinted outline picks up the surface color underneath it and reads as dirt on the image edge.

#### 12. Scale on Press

A subtle `scale(0.96)` on click gives buttons tactile feedback. Always use `0.96`. Never use a value smaller than `0.95` - anything below feels exaggerated. Add a `static` prop to disable it when motion would be distracting.

#### 13. Skip Animation on Page Load

Use `initial={false}` on `AnimatePresence` to prevent enter animations on first render. Verify it doesn't break intentional entrance animations.

#### 14. Never Use `transition: all`

Always specify exact properties: `transition-property: scale, opacity`. Tailwind's `transition-transform` covers `transform, translate, scale, rotate`.

#### 15. Use `will-change` Sparingly

Only for `transform`, `opacity`, `filter` - properties the GPU can composite. Never use `will-change: all`. Only add when you notice first-frame stutter.

#### 16. Minimum Hit Area

Interactive elements need at least 40x40px hit area. Extend with a pseudo-element if the visible element is smaller. Never let hit areas of two elements overlap.

### Common Mistakes

| Mistake | Fix |
| --- | --- |
| Same border radius on parent and child | Calculate `outerRadius = innerRadius + padding` |
| Icons look off-center | Adjust optically with padding or fix SVG directly |
| Hard borders between sections | Use layered `box-shadow` with transparency |
| Jarring enter/exit animations | Split, stagger, and keep exits subtle |
| Numbers cause layout shift | Apply `tabular-nums` |
| Heavy text on macOS | Apply `antialiased` to root |
| Animation plays on page load | Add `initial={false}` to `AnimatePresence` |
| `transition: all` on elements | Specify exact properties |
| First-frame animation stutter | Add `will-change: transform` (sparingly) |
| Tiny hit areas on small controls | Extend with pseudo-element to 40x40px |

### Review Output Format

Always present changes as a markdown table with **Before** and **After** columns. Include every change you made - not just a subset. Never list findings as separate "Before:" / "After:" lines outside of a table. Group changes by principle using a heading above each table, and keep each row focused on a single diff so the reader can scan the whole list quickly.

#### Example

##### Concentric border radius
| Before | After |
| --- | --- |
| `rounded-xl` on card + `rounded-xl` on inner button (`p-2`) | `rounded-2xl` on card (`12 + 8`), `rounded-lg` on inner button |
| `border-radius: 16px` on both nested surfaces | Outer `24px`, inner `16px` with `8px` padding |

##### Tabular numbers
| Before | After |
| --- | --- |
| `<span>{count}</span>` on animated counter | `<span className="tabular-nums">{count}</span>` |
| Default numerals on timer | Added `font-variant-numeric: tabular-nums` to root |

##### Scale on press
| Before | After |
| --- | --- |
| `<button className="...">` | Added `active:scale-[0.96] transition-transform` |
| `scale(0.9)` on press | Raised to `scale(0.96)` - anything below `0.95` feels exaggerated |

Rows should cite the specific file and the specific property that changed when it isn't obvious from the snippet. If a principle was reviewed but nothing needed to change, omit that table entirely - empty tables add noise.

### Review Checklist

- [ ] Nested rounded elements use concentric border radius
- [ ] Icons are optically centered, not just geometrically
- [ ] Shadows used instead of borders where appropriate
- [ ] Enter animations are split and staggered
- [ ] Exit animations are subtle
- [ ] Dynamic numbers use tabular-nums
- [ ] Font smoothing is applied
- [ ] Headings use text-wrap: balance
- [ ] Images have subtle outlines
- [ ] Buttons use scale on press where appropriate
- [ ] AnimatePresence uses `initial={false}` for default-state elements
- [ ] No `transition: all` - only specific properties
- [ ] `will-change` only on transform/opacity/filter, never `all`
- [ ] Interactive elements have at least 40x40px hit area

### Reference Files (source)

- [typography.md](typography.md) - Text wrapping, font smoothing, tabular numbers
- [surfaces.md](surfaces.md) - Border radius, optical alignment, shadows, image outlines
- [animations.md](animations.md) - Interruptible animations, enter/exit transitions, icon animations, scale on press
- [performance.md](performance.md) - Transition specificity, `will-change` usage

---

## Extension - increasing specificity on each principle

The 16 principles above are intentionally short. Each one collapses a sizable amount of design-engineering reasoning into a single line. This section unfolds that reasoning so sidecoach can apply each principle without ambiguity and so a reviewer can flag a violation in a single grep.

### 1. Concentric Border Radius - extension

The formula is `outerRadius = innerRadius + padding`. The rule applies when nested surfaces are visually adjacent - close enough that the eye traces both curves in one sweep.

- **Why concentric matters perceptually.** When two curves share visual proximity, the eye reads them as a single shape with a stroke. If the curves are non-concentric, the inner curve appears to drift inside the outer curve. The drift is most visible at the corners, where a 2px mismatch reads as a 4-6px misalignment because the eye fills in the wrong tangent.
- **Threshold above which the rule stops applying.** When the gap between surfaces exceeds `24px`, the eye stops tracing them as one shape and the curves can be chosen independently. This is the same threshold the source names in `surfaces.md`.
- **Tailwind exact mapping (8px scale).** `rounded-sm` = 2px, `rounded` = 4px, `rounded-md` = 6px, `rounded-lg` = 8px, `rounded-xl` = 12px, `rounded-2xl` = 16px, `rounded-3xl` = 24px. With `p-2` (8px) padding, an outer `rounded-2xl` (16px) pairs with an inner `rounded-lg` (8px). With `p-1` (4px) padding, outer `rounded-xl` (12px) pairs with inner `rounded-lg` (8px).
- **Common false-positive.** A card with `p-6` (24px) padding wrapping a button is at the threshold. The rule technically holds (`outerRadius = innerRadius + 24`) but the visual sweep is broken, so picking radii independently is acceptable.

### 2. Optical Over Geometric Alignment - extension

Manual optical adjustment is required on these element classes:

- **Text + trailing icon buttons.** Right padding = left padding - 2px. Example: `pl-4 pr-3.5`.
- **Text + leading icon buttons.** Left padding = right padding - 2px. Example: `pl-3.5 pr-4`.
- **Play triangle inside a circular button.** Shift the SVG by `margin-left: 2px` (or 3px on icons above 24px).
- **Asymmetric icons (stars, arrows, carets, chevrons, hearts with offset).** Best fix is to re-center the SVG path in its viewBox so the optical center matches the geometric center. Fallback is `ml-px` or `mr-px` on the wrapper.
- **Capital letters used as logos or single-letter avatars.** Letters with descender-shaped or stem-heavy forms (`J`, `Q`, `Y`) drift visually downward and to one side; adjust by `0.5-1px`.

The rule does not apply to symmetric icons (circles, squares, plus, cross, equal sign) - geometric centering matches optical centering for these.

### 3. Shadows Over Borders - extension

The three-layer shadow stack in `surfaces.md` is the canonical implementation. Apply it to depth-bearing elements (buttons, cards, dropdowns, modals, popovers, toasts). Do not apply it to layout-separator borders (`border-b` between list items, `border-t` on table rows, `border-r` on sidebars).

- **The "ring" layer (`0 0 0 1px`)** functionally replaces the border. Its negative spread and inset-like behavior keeps the element's footprint identical.
- **The lift layer (`0 1px 2px -1px`)** simulates a small light source above-left. The negative y-offset and negative spread produce a pinched bottom shadow that reads as "object sits on the page."
- **The ambient layer (`0 2px 4px 0`)** simulates indirect light and grounds the element. Without it, the element looks taped to the background.
- **Dark mode simplification.** A single white ring at 8% opacity (12-13% on hover) is enough; depth shadows are invisible against dark surfaces. This is intentional, not an oversight.
- **Hover delta.** Each layer's opacity rises by `0.02` on hover. The change is subliminal but is what makes the element feel "alive."

### 4. Interruptible Animations - extension

The decision tree is binary: if the user can re-trigger the animation while it's running, use a CSS transition. If the animation runs once and the user can't retrigger, use a keyframe.

- **Use a CSS transition for:** drawer open/close, accordion expand/collapse, dropdown reveal, hover lift, tab switch, button state, toggle, slider drag, modal scrim fade, menu reveal, popover.
- **Use a keyframe animation for:** loading spinner, skeleton shimmer, success checkmark draw, page enter, hero text staggered reveal, confetti, success/error toast pop.
- **Why transitions retarget.** A CSS transition tracks the current computed value as its "from" and the new value as its "to" - when the property changes mid-flight, the browser interpolates from wherever it currently is to the new target. Keyframes run on a fixed `from -> to` timeline regardless of state, so a re-trigger restarts.
- **The duration that feels right for interruptible state changes.** 150-200ms for small UI (toggles, hovers), 200-250ms for medium (dropdowns, drawers), 300ms maximum for staged reveals. Above 300ms, the user feels the wait.

### 5. Split and Stagger Enter Animations - extension

The 100ms inter-chunk delay is the perceptual sweet spot - fast enough that the user doesn't wait, slow enough that each chunk is perceived as a distinct event.

- **Granularity.** Split at semantic boundaries: title -> description -> action group. Do not split mid-sentence or within a single visual block.
- **Per-word stagger on titles.** The source allows ~80ms per word for headline animations. Apply only on hero/marketing surfaces, never on product UI - per-word animations in a product chrome feel theatrical.
- **The exact enter composition.** Each chunk transitions `opacity: 0 -> 1`, `translateY: 12px -> 0`, `filter: blur(4px) -> blur(0)`. The blur is what makes the chunk feel like it's "coming into focus" rather than "sliding in."
- **Duration per chunk.** 400ms feels expensive and luxurious; 300ms feels brisk; 250ms feels efficient. The source uses 400ms in CSS examples and ~300ms in Motion examples. Pick one per project and stick.
- **Easing.** `ease-out` for CSS or `cubic-bezier(0.2, 0, 0, 1)` for hand-tuned. Never use `ease-in` for enters (the element drags into place feeling like it's being shoved).

### 6. Subtle Exit Animations - extension

Exit animation rules from the source compressed into operational defaults:

- **Translate magnitude.** `-12px` for a subtle exit, never the element's full height or width (which reads as "the system rejected this thing").
- **Duration.** 150ms exit vs 300ms enter. Exits should always be roughly half the enter duration.
- **Easing.** `ease-in` on exits (the element accelerates away). This is the one place `ease-in` is correct.
- **Direction.** Exit in the direction the element came from, or upward (-y) for content that fades out of view. Never sideways unless the element is a slot in a horizontal list.
- **Never `display: none` without an exit.** The pop-out break in continuity feels like a bug.

### 7. Contextual Icon Animations - extension

The source pins exact values: `scale 0.25 -> 1`, `opacity 0 -> 1`, `blur 4px -> 0px`, `transition { type: "spring", duration: 0.3, bounce: 0 }`. Reasoning for each:

- **`scale: 0.25` (not 0.5 or 0.6).** A smaller starting scale exaggerates the perceptual zoom and makes the icon read as "materializing" rather than "growing." Values above 0.5 read as a generic pop-in.
- **`blur(4px)`.** Pairs with the scale-up to produce a "focus pull" effect borrowed from camera optics. 4px is enough to read as blurred at common icon sizes (16-24px) without obliterating the icon shape mid-animation.
- **`bounce: 0`.** Spring physics with bounce produces overshoot. Overshoot on icons reads as glitchy or playful in a way that mismatches most product chrome. Bounce 0 is critical override - the framer-motion default is non-zero.
- **`duration: 0.3` (300ms).** Long enough to register, short enough to not delay user feedback. Below 200ms the blur effect disappears; above 400ms the icon feels sluggish.
- **CSS cross-fade fallback.** The two-icon DOM technique is required when no motion library is installed. Both icons mount; one is absolute-positioned. The exit-fading icon scales down to `0.25` while the entering icon scales up from `0.25`. This is the only way to get a true exit animation in pure CSS without `AnimatePresence`.
- **The bezier `cubic-bezier(0.2, 0, 0, 1)`.** Approximates spring damping without overshoot. Use this exact curve for any CSS approximation of motion-library easings.

### 8. Font Smoothing - extension

- **Apply once at `<html>`,** never per-element. Per-element application creates visible weight inconsistency where smoothed and unsmoothed text sit next to each other.
- **`-webkit-font-smoothing: antialiased`** is the macOS Safari/Chrome rule. **`-moz-osx-font-smoothing: grayscale`** is the Firefox-on-macOS rule. Both should be present.
- **Cross-platform safety.** Windows and Linux ignore these properties entirely. There is no penalty for applying them universally.
- **The visual delta.** Antialiased text is approximately 5-10% thinner than the default subpixel-rendered text. Designs done in Figma assume antialiased rendering, so without it the live UI looks heavier than the design.

### 9. Tabular Numbers - extension

The rule: any number that updates without a page load gets `tabular-nums`. Without it, the digit `1` is narrower than `0-9`, so a counter going `9 -> 10` shifts every element to its right.

- **Apply at the smallest scope that covers the dynamic numeric.** Inline on the changing `<span>` is best; root-level application changes all numerals in the document and breaks intentional proportional rendering on phone numbers, prices in marketing copy, version strings, and numeric IDs.
- **Tailwind class.** `tabular-nums`.
- **The Inter caveat.** With Inter, tabular `1` is wider and centered. This is correct behavior - the goal is column alignment, not preserving the original glyph.
- **Other fonts to verify.** Geist, JetBrains Mono, Space Grotesk, SF Pro: tabular variants render correctly. Some script and display fonts lack a tabular variant and the property is silently ignored - verify with a `9 -> 10` counter test.

### 10. Text Wrapping - extension

Two related but distinct rules: `balance` for headings, `pretty` for body.

- **`text-wrap: balance` browser limits.** Chromium: 6 lines max. Firefox: 10 lines max. Safari: same as Chromium since 17.4. Above the limit, the property is silently ignored. Applying balance to a long article body wastes intent.
- **`text-wrap: pretty` is the default for body.** Adjusts only the final 1-2 lines to prevent orphans. No line-count limit, low cost.
- **When to use neither.** Long-form text (10+ lines), code blocks, `<pre>`-formatted content. The browser's default greedy wrap is appropriate and cheap.
- **Tailwind classes.** `text-balance`, `text-pretty`.
- **Combine with line-length.** Balance/pretty without a `max-width` is wasted - set `max-w-prose` (65ch) on body text and `max-w-2xl` or similar on headings so the balancing algorithm has line breaks to balance across.

### 11. Image Outlines - extension

Non-negotiable color rule: pure black `rgba(0, 0, 0, 0.1)` in light mode, pure white `rgba(255, 255, 255, 0.1)` in dark mode. Reasoning:

- **Why pure, not tinted.** A tinted outline (slate-900, zinc-900, neutral-900) reads as colored pigment against the image's edge color. The eye interprets it as "dirt on the photo edge." Pure neutral at 10% opacity reads as shadow.
- **Why `outline` not `border`.** Outline doesn't participate in box-model size calculations. `outline-offset: -1px` insets the outline so the image stays its intended dimensions.
- **Tailwind canonical form.** `outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10`. Never `outline-slate-*` or `outline-zinc-*`.
- **Applies to.** Photos, thumbnails, avatars, video posters, illustrations with light edges. Does not apply to SVG icons (which have no "edge" to dirty) or to images with intentionally hard borders for branding.
- **Hover state.** Optional: raise to 15% opacity (`outline-black/15`) on hover. Not required.

### 12. Scale on Press - extension

`scale(0.96)` always. Never below `0.95`.

- **Why 0.95 is the floor (perceptual JND).** The just-noticeable-difference threshold for transform-scale on small UI is roughly 4%. Below 0.96 (the 4% threshold), the press becomes overtly visible - the button "shrinks" in a way users register as drama. The user knows the button responded; they shouldn't be surprised by how much.
- **Which elements get scale-on-press.** Buttons (`<button>`), links with `role="button"`, icon buttons, action chips, segment buttons in segmented controls, tap-able cards (with intentional `cursor: pointer`), tap-able list items.
- **Which elements do NOT get scale-on-press.** Plain text links (`<a>` without `role="button"`), form inputs (text, checkbox, radio - these have their own native press feedback), navigation tabs (the underline/background change is the feedback), disabled buttons, drag handles.
- **Exact CSS transition property.** `transition: transform 100ms cubic-bezier(0.2, 0, 0, 1)`. The source uses 150ms ease-out; 100ms with the smoother curve feels slightly more responsive. Either is acceptable.
- **Static prop pattern.** A `static` prop on the Button component disables scale-on-press for cases where the motion is contextually distracting (e.g., a button inside a draggable element, a button in a tight loop of microinteractions).
- **`not-disabled` qualifier.** `active:not-disabled:scale-[0.96]` so disabled buttons don't visually respond.

### 13. Skip Animation on Page Load - extension

`initial={false}` on `AnimatePresence` prevents the first-render enter animation. The element appears in its `animate` state instantly.

- **Apply to.** Components whose default state is "visible" and which animate only on state changes (icon swaps, toggles, segmented controls, tabs, accordion-default-open panels).
- **Do NOT apply to.** Components whose initial appearance IS the animation (page heros, staggered enters, splash screens, loading-to-loaded transitions).
- **The failure mode if misapplied.** Removing `initial={false}` from an icon swap = the icon plays its enter animation on page load, which makes the page feel jumpy. Adding `initial={false}` to a staggered hero = the hero text snaps in fully formed, skipping the intentional reveal.
- **The verification.** Full page refresh on the route containing the component. Watch whether the element appears smoothly (`initial={false}` correct) or pops in suddenly (missing) or animates when it shouldn't (mis-included).

### 14. Never Use `transition: all` - extension

- **The dangerous Tailwind utility.** `transition` (no suffix) = `transition-property: all`. Banned.
- **The safe Tailwind utility.** `transition-transform` = `transition-property: transform, translate, scale, rotate`. Safe for any element animating purely on transform.
- **The other safe Tailwind utilities.** `transition-colors` (colors only), `transition-opacity` (opacity only), `transition-shadow` (box-shadow only). All scoped, all safe.
- **Bracket syntax for multi-property.** `transition-[scale,opacity,filter]` for hand-picked property lists. Use when animating across categories.
- **Why `all` breaks UI.** A parent class change (a theme switch, a focus state, a hover that adds a border) cascades transitions on every property - colors, padding, shadows, fonts - that wasn't intended to animate. The result is visible lag on the unrelated property changes.
- **The grep test.** `rg "transition: all" --type css` and `rg 'className="[^"]*\\btransition\\b[^"]*"' --type tsx` should both return zero results in a healthy project.

### 15. Use `will-change` Sparingly - extension

`will-change` is a hint that pre-promotes an element to a GPU compositing layer. Each layer costs memory; over-application degrades performance.

- **Properties that benefit.** `transform`, `opacity`, `filter`, `clip-path`. The GPU can composite these.
- **Properties that do NOT benefit.** `background`, `color`, `border`, `padding`, `width`, `height`, `top`, `left`. The CPU has to repaint these regardless of `will-change`.
- **The forbidden value.** `will-change: all`. Promotes every property; defeats the purpose.
- **When to add.** After observing first-frame stutter on an animation. Safari especially benefits. Don't add preemptively.
- **When to remove.** After the animation ends, remove the `will-change` to release the compositing layer. With Motion/Framer Motion, the library handles this automatically. With raw CSS, consider adding `will-change` only during the active state.

### 16. Minimum Hit Area - extension

40x40px minimum. 44x44px is the WCAG 2.1 AA recommendation for touch targets.

- **The visible element can be smaller** (e.g., a 20x20 checkbox or a 16x16 close icon). The hit area is extended with a pseudo-element.
- **Pseudo-element pattern.** `position: relative` on the parent, `::after` with `position: absolute`, `top: 50%; left: 50%; transform: translate(-50%, -50%)`, `width: 40px; height: 40px`. The pseudo has no visible style - it's purely an invisible click target.
- **Tailwind one-liner.** `relative size-5 after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-1/2`.
- **The non-overlap rule.** Two interactive elements should never have overlapping hit areas. If two 20x20 icons are 10px apart, extending each to 40x40 creates overlap. Shrink the pseudo-element to the largest non-overlapping size (in that example, 30x30 for each, divided by the 10px gap).
- **Where this fails.** Toolbars with densely-packed icons (file managers, image editors), where 40x40 hit areas would overlap. Accept smaller hit areas, but never below 32x32 and pair with hover affordance so the target is discoverable.

---

## Review Output Format - extension

The source mandates the `| Before | After |` table per principle, grouped by principle heading. Operational rules for sidecoach:

- **One row per diff.** Two changes to the same element are two rows.
- **Cite the file path** (`button.tsx`, `card-list.css`, etc.) when not obvious from the snippet.
- **Cite the property** that changed, not just the visual outcome.
- **Omit empty tables.** If a principle was reviewed and nothing changed, do not include the heading.
- **Order by impact.** Concentric border radius and shadows-over-borders typically come first because they're the most visible. Performance/`will-change` typically last.
- **Group by principle, not by file.** Sidecoach reviews are about principle adherence, not file-by-file diffs.

---

## What's missing - gaps in make-interfaces-feel-better

The 16-point list is intentionally focused on visual polish. It is light on the following dimensions, which sidecoach must cover from other sources or extend explicitly:

1. **Information architecture.** No guidance on element grouping, visual hierarchy at the layout level, gestalt principles, density vs whitespace tradeoffs. The skill assumes the IA is already correct and focuses on the polish layer.

2. **Copy and voice.** No guidance on button labels, error messages, empty states, microcopy, tone, voice consistency. A button that scales correctly with `scale(0.96)` but says "OK" instead of the brand voice is still a failure.

3. **Accessibility beyond hit area.** Hit area (#16) is the only a11y rule in the list. Missing: color contrast computation, focus visibility, focus trap behavior in modals, ARIA labeling, keyboard navigation patterns, screen-reader semantics, reduced-motion respect, prefers-color-scheme handling, prefers-contrast handling.

4. **Responsive degrade plans.** No guidance on what happens at narrow viewports - when do staggered animations get skipped? When does the 40x40 hit area shrink to fit a mobile toolbar? When do shadows simplify on low-DPI displays? The skill assumes a single canonical viewport.

5. **Color contrast computation.** Image outlines specify pure black/white at 10%, but there's no rule for foreground/background contrast minimums, no WCAG ratio targets (4.5:1 body, 3:1 large), no guidance on contrast in dark mode vs light mode.

6. **Dark-mode-specific rules.** The image-outline and shadow rules each have a dark-mode variant. Missing: dark-mode color token philosophy, dark-mode photography treatment (avoid pure white edges on images that bleed), dark-mode shadow elevation (which doesn't work - shadows are usually replaced by borders or lifts in dark mode), dark-mode reduced motion implications.

7. **Loading and skeleton states.** The skill mentions "loading state" once in the keyframe-vs-transition decision but provides no skeleton patterns, no shimmer timing, no progressive-disclosure rules, no spinner-vs-skeleton choice criteria.

8. **Error, empty, and edge states.** No guidance on error message visual treatment, empty state composition, zero-data UI, "you've reached the end" affordances.

9. **Forms.** No coverage of input affordances beyond hit area, label-input proximity, validation timing (blur vs submit vs on-change), error placement, success confirmation patterns, required-field indication, helper text spacing.

10. **Motion accessibility.** No `prefers-reduced-motion` rule. Every animation principle (#4-7, #12-13) should have a reduced-motion variant. The source assumes motion is always wanted.

11. **Brand register.** No guidance on adjusting these defaults for a brand voice (more playful = higher bounce, more serious = lower contrast hover deltas). The skill is voice-agnostic; sidecoach needs to layer brand context on top.

12. **Layout primitives.** No guidance on grid systems, flexbox patterns, spacing scales beyond border-radius nesting, container queries, multi-column composition.

13. **Data visualization.** Tabular numbers (#9) is the only data-related rule. Missing: chart conventions, table density, sortable headers, pagination patterns, infinite-scroll affordances.

14. **Internationalization.** No guidance on RTL layouts (which break the optical-alignment padding asymmetry rule #2), no character-set considerations for `text-wrap: pretty` (which behaves differently on CJK), no number formatting beyond `tabular-nums`.

15. **Performance beyond `will-change` and `transition`.** No mention of image lazy-loading, content-visibility, layout-shift prevention beyond `tabular-nums`, bundle-size implications of motion-library choices, render-blocking resources.

These gaps are not failures of the source - the skill is scoped to "visual polish" and is excellent at that scope. Sidecoach should layer the missing dimensions on top via the other reference systems (component-gallery for IA, design-references for brand register, motion-reference for advanced motion-a11y, etc.) and via Sprint 4's 159-rule extended-domain validator.
