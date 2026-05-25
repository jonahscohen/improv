# make-interfaces-feel-better - Performance (extracted)

This file extracts `performance.md` from the make-interfaces-feel-better skill. Source verbatim lift comes first, then Extension (operational specificity for transition specificity and `will-change`), then What's missing (performance gaps).

> Note on punctuation: per CLAUDE.md (no emdashes), every emdash from the source has been converted to a regular hyphen with surrounding spaces. All other content is byte-for-byte preserved.

---

## Source verbatim lift

From `/Users/spare3/.agents/skills/make-interfaces-feel-better/performance.md`.

### Performance

Transition specificity and GPU compositing hints.

### Transition Only What Changes

Never use `transition: all` or Tailwind's `transition` shorthand (which maps to `transition-property: all`). Always specify the exact properties that change.

#### Why

- `transition: all` forces the browser to watch every property for changes
- Causes unexpected transitions on properties you didn't intend to animate (colors, padding, shadows)
- Prevents browser optimizations

#### CSS Example

```css
/* Good - only transition what changes */
.button {
  transition-property: scale, background-color;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

/* Bad - transition everything */
.button {
  transition: all 150ms ease-out;
}
```

#### Tailwind

```tsx
// Good - explicit properties
<button className="transition-[scale,background-color] duration-150 ease-out">

// Bad - transition all
<button className="transition duration-150 ease-out">
```

#### Tailwind `transition-transform` Note

`transition-transform` in Tailwind maps to `transition-property: transform, translate, scale, rotate` - it covers all transform-related properties, not just `transform`. Use this when you're only animating transforms. For multiple non-transform properties, use the bracket syntax: `transition-[scale,opacity,filter]`.

### Use `will-change` Sparingly

`will-change` hints the browser to pre-promote an element to its own GPU compositing layer. Without it, the browser promotes the element only when the animation starts - that one-time layer promotion can cause a micro-stutter on the first frame.

This particularly helps when an element is changing `scale`, `rotation`, or moving around with `transform`. For other properties, it doesn't help much - the browser can't composite them on the GPU anyway.

#### Rules

```css
/* Good - specific property that benefits from GPU compositing */
.animated-card {
  will-change: transform;
}

/* Good - multiple compositor-friendly properties */
.animated-card {
  will-change: transform, opacity;
}

/* Bad - never use will-change: all */
.animated-card {
  will-change: all;
}

/* Bad - properties that can't be GPU-composited anyway */
.animated-card {
  will-change: background-color, padding;
}
```

#### Useful Properties

| Property | GPU-compositable | Worth using `will-change` |
| --- | --- | --- |
| `transform` | Yes | Yes |
| `opacity` | Yes | Yes |
| `filter` (blur, brightness) | Yes | Yes |
| `clip-path` | Yes | Yes |
| `top`, `left`, `width`, `height` | No | No |
| `background`, `border`, `color` | No | No |

#### When to Skip

Modern browsers are already good at optimizing on their own. Only add `will-change` when you notice first-frame stutter - Safari in particular benefits from it. Don't add it preemptively to every animated element; each extra compositing layer costs memory.

---

## Extension - operational specificity

### Transition specificity - extension

**The dangerous Tailwind utility.** `transition` (no suffix) maps to `transition-property: all`. Banned.

**The safe Tailwind utilities (scoped, no leakage):**

| Tailwind class | Properties transitioned | Safe to use |
| --- | --- | --- |
| `transition-none` | none | always safe |
| `transition-transform` | transform, translate, scale, rotate | safe |
| `transition-colors` | color, background-color, border-color, text-decoration-color, fill, stroke | safe |
| `transition-opacity` | opacity | safe |
| `transition-shadow` | box-shadow | safe |
| `transition` | ALL properties | **never** |

**Bracket syntax for mixed property lists.** When you need to transition across categories (e.g., scale + opacity + filter for an icon swap), use bracket syntax:

```tsx
<div className="transition-[scale,opacity,filter] duration-300">
```

This generates `transition-property: scale, opacity, filter`. Pick exactly what you're animating; no more.

**The cascade hazard of `transition: all`.** When `all` is applied, any property change cascades a transition. A theme switch transitions colors (intentional) AND borders, padding, shadows, font-weight (unintentional). Result: visible lag on unrelated property changes. The page feels "soupy."

**The grep test for a healthy project:**

```bash
rg "transition: all" --type css
rg 'className="[^"]*\btransition\b[^"]*"' --type tsx
```

Both should return zero results. Both should be added to CI/lint or a sidecoach validator.

**`transition-transform` is broader than its name suggests.** It maps to `transition-property: transform, translate, scale, rotate`. This means a single class handles the most common transform animations (move, resize, rotate). Use it for anything that's purely transform-based.

**Why explicit properties enable browser optimization.** Modern browsers can pre-allocate GPU compositing layers for animated properties at parse time. With `transition: all`, the browser doesn't know which properties will change, so it can't pre-allocate. With explicit properties, the browser knows exactly what to optimize.

### will-change - extension

**The mental model.** `will-change` is a promise to the browser: "I'm about to animate this property; please prepare the GPU compositing layer in advance." Without it, the browser allocates the layer on the first animation frame, which causes a one-frame stutter visible to users.

**When to add `will-change`:**

1. The element animates a GPU-compositable property (transform, opacity, filter, clip-path).
2. You've observed a first-frame stutter on the animation (Safari especially).
3. The animation is triggered by a user interaction (hover, click, scroll - where the stutter would be felt).

**When NOT to add `will-change`:**

1. The animation is one-shot on page load - the user can't perceive the stutter because the page is still loading.
2. The animated property isn't GPU-compositable (background-color, padding, color, width, height, top, left). These get repainted by the CPU regardless.
3. The element is part of a list of >50 items - each `will-change` allocates a compositing layer, and 50+ layers exhaust GPU memory.

**The forbidden value.** `will-change: all`. Promotes every property; defeats the purpose; allocates the largest possible compositing layer.

**GPU-compositable property table:**

| Property | GPU-compositable | `will-change` worth using |
| --- | --- | --- |
| `transform` | Yes | Yes |
| `translate` | Yes | Yes |
| `scale` | Yes | Yes |
| `rotate` | Yes | Yes |
| `opacity` | Yes | Yes |
| `filter` (blur, brightness, contrast, drop-shadow, etc.) | Yes | Yes |
| `backdrop-filter` | Yes | Yes |
| `clip-path` | Yes | Yes |
| `mask` | Yes | Yes |
| `top`, `left`, `right`, `bottom` | No - layout-triggering | No |
| `width`, `height` | No - layout-triggering | No |
| `margin`, `padding` | No - layout-triggering | No |
| `background-color`, `border-color`, `color` | No - paint-only | No |
| `font-size`, `font-weight` | No - layout-triggering | No |
| `box-shadow` | No - paint-only | No |
| `border-radius` | No - paint-only | No |

**Apply only during the active animation.** With Motion/Framer Motion, the library handles this automatically (adds `will-change` on mount, removes on unmount). With raw CSS, consider scoping `will-change` to the active state class:

```css
.card {
  /* No will-change at rest */
}
.card.animating {
  will-change: transform;
}
```

Or scope it via parent hover (for hover-triggered animations):

```css
.card-list:hover .card {
  will-change: transform;
}
```

**Why memory cost matters.** Each `will-change` value allocates a GPU compositing layer. Each layer occupies (width * height * 4) bytes minimum (RGBA). A 300x200 card = 240KB. A list of 50 cards with `will-change: transform` = 12MB of GPU memory just for compositing. On low-end devices, this evicts other layers and degrades scrolling.

**Removing `will-change` after animation.** When the animation ends, remove the class (or remove the property) to release the compositing layer. The browser will repaint once into the regular paint layer; this is cheap compared to the cost of holding the layer open.

**Safari benefit specifically.** WebKit (Safari) has historically been slower than Chromium and Gecko at promoting elements to compositing layers on-demand. `will-change` is most beneficial on Safari and least beneficial on Chromium (which is faster at on-demand promotion). For cross-browser parity, optimize for Safari.

---

## What's missing - performance gaps in MIFB

The performance section covers transition specificity and `will-change`. Notable gaps:

1. **Frame budget and 60fps.** No mention of the 16.67ms per-frame budget at 60fps (or 8.33ms at 120fps), no guidance on profiling animation cost, no Lighthouse/DevTools workflow.

2. **Layout, paint, composite cost model.** No coverage of the browser rendering pipeline (Style -> Layout -> Paint -> Composite), no guidance on which CSS properties trigger which stages, no `csstriggers.com` reference.

3. **Reflow and repaint avoidance.** No coverage of layout-triggering properties (`width`, `height`, `top`, `left`, `padding`) vs paint-only (`color`, `background`) vs composite-only (`transform`, `opacity`). The will-change table touches this but doesn't unpack it.

4. **Bundle size and motion library cost.** No coverage of Framer Motion's bundle weight (~50KB gzipped), tree-shaking strategies, when to use lightweight alternatives (Motion One, animejs).

5. **Image performance.** No coverage of `<img loading="lazy">`, `<img decoding="async">`, `srcset` and `sizes`, modern formats (AVIF, WebP), responsive images.

6. **Layout shift prevention.** Only tabular-nums (in typography.md) addresses layout shift. No coverage of `aspect-ratio` for media, `min-height` for variable content, explicit dimensions on images/videos, CLS measurement.

7. **Critical CSS and render-blocking resources.** No coverage of above-the-fold CSS inlining, preloading critical resources, deferring non-critical CSS/JS.

8. **Font loading performance.** No coverage of `font-display: swap`, `font-display: optional`, `font-display: fallback`, FOIT/FOUT, preloading critical fonts.

9. **Network performance.** No coverage of HTTP/2 push, resource hints (`<link rel="preconnect">`, `prefetch`, `preload`), CDN strategy, edge caching.

10. **JavaScript performance for animations.** No coverage of `requestAnimationFrame` vs `setTimeout`, of off-main-thread animation (Web Animations API), of avoiding JS-driven animation when CSS suffices.

11. **Memory leaks in animations.** No coverage of removing event listeners, cleaning up ScrollTrigger instances, releasing motion-library refs on unmount.

12. **Concurrent animation limits.** No guidance on how many simultaneous animations a page can support before degrading. Rough rule: <10 simultaneous animations on modern devices, <5 on low-end.

13. **Low-end device strategy.** No `@media (prefers-reduced-data)` rule, no `navigator.connection.effectiveType` check, no progressive enhancement for slow networks/devices.

14. **GPU memory budgeting.** Touched on briefly in the will-change extension (above), but the source doesn't address it. Each compositing layer occupies GPU memory; the budget is finite (~256MB on mobile, ~1GB on desktop).

15. **Profiling tools and workflow.** No mention of Chrome DevTools Performance tab, Safari's Web Inspector Timelines, React DevTools Profiler, Lighthouse audits.

16. **Server-side rendering performance.** No coverage of SSR-vs-CSR animation gotchas (hydration mismatch, animation-on-mount jank), Next.js/Astro/Remix-specific patterns.

17. **Build-time vs runtime performance.** No coverage of build-time CSS extraction (vs Tailwind JIT), CSS-in-JS runtime cost, static vs dynamic style generation.

Sidecoach should layer these via the 159-rule extended-domain validator (frame budget warnings, CLS detection, image lazy-loading enforcement) and via direct flow extensions for `polish` and `audit` phases.
