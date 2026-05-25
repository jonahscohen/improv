# Impeccable responsive-design.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Responsive Design

## Mobile-First: Write It Right

Start with base styles for mobile, use `min-width` queries to layer complexity. Desktop-first (`max-width`) means mobile loads unnecessary styles first.

## Breakpoints: Content-Driven

Don't chase device sizes; let content tell you where to break. Start narrow, stretch until design breaks, add breakpoint there. Three breakpoints usually suffice (640, 768, 1024px). Use `clamp()` for fluid values without breakpoints.

## Detect Input Method, Not Just Screen Size

**Screen size doesn't tell you input method.** A laptop with touchscreen, a tablet with keyboard. Use pointer and hover queries:

```css
/* Fine pointer (mouse, trackpad) */
@media (pointer: fine) {
  .button { padding: 8px 16px; }
}

/* Coarse pointer (touch, stylus) */
@media (pointer: coarse) {
  .button { padding: 12px 20px; }  /* Larger touch target */
}

/* Device supports hover */
@media (hover: hover) {
  .card:hover { transform: translateY(-2px); }
}

/* Device doesn't support hover (touch) */
@media (hover: none) {
  .card { /* No hover state - use active instead */ }
}
```

**Critical**: Don't rely on hover for functionality. Touch users can't hover.

## Safe Areas: Handle the Notch

Modern phones have notches, rounded corners, and home indicators. Use `env()`:

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}

/* With fallback */
.footer {
  padding-bottom: max(1rem, env(safe-area-inset-bottom));
}
```

**Enable viewport-fit** in your meta tag:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

## Responsive Images: Get It Right

### srcset with Width Descriptors

```html
<img
  src="hero-800.jpg"
  srcset="
    hero-400.jpg 400w,
    hero-800.jpg 800w,
    hero-1200.jpg 1200w
  "
  sizes="(max-width: 768px) 100vw, 50vw"
  alt="Hero image"
>
```

**How it works**:
- `srcset` lists available images with their actual widths (`w` descriptors)
- `sizes` tells the browser how wide the image will display
- Browser picks the best file based on viewport width AND device pixel ratio

### Picture Element for Art Direction

When you need different crops/compositions (not just resolutions):

```html
<picture>
  <source media="(min-width: 768px)" srcset="wide.jpg">
  <source media="(max-width: 767px)" srcset="tall.jpg">
  <img src="fallback.jpg" alt="...">
</picture>
```

## Layout Adaptation Patterns

**Navigation**: Three stages: hamburger + drawer on mobile, horizontal compact on tablet, full with labels on desktop. **Tables**: Transform to cards on mobile using `display: block` and `data-label` attributes. **Progressive disclosure**: Use `<details>/<summary>` for content that can collapse on mobile.

## Testing: Don't Trust DevTools Alone

DevTools device emulation is useful for layout but misses:

- Actual touch interactions
- Real CPU/memory constraints
- Network latency patterns
- Font rendering differences
- Browser chrome/keyboard appearances

**Test on at least**: One real iPhone, one real Android, a tablet if relevant. Cheap Android phones reveal performance issues you'll never see on simulators.

---

**Avoid**: Desktop-first design. Device detection instead of feature detection. Separate mobile/desktop codebases. Ignoring tablet and landscape. Assuming all mobile devices are powerful.

## EXTENSION

### Breakpoint defaults table

| Breakpoint | min-width | Typical context |
|---|---|---|
| (default) | 0 | Mobile portrait |
| sm | 640px | Mobile landscape, small tablet portrait |
| md | 768px | Tablet portrait |
| lg | 1024px | Tablet landscape, laptop |
| xl | 1280px | Desktop |
| 2xl | 1536px | Wide desktop |

Cap layouts at `max-width: 1440px` to ~`1600px`. Stretching to 4K reads as broken.

### Input-method coverage matrix

```css
/* Touch device (no hover available) */
@media (pointer: coarse) and (hover: none) {
  .interactive { padding: 12px 20px; min-height: 44px; }
}

/* Mouse / trackpad (hover works) */
@media (pointer: fine) and (hover: hover) {
  .interactive { padding: 8px 16px; }
  .interactive:hover { transform: translateY(-1px); }
}

/* Touch laptop (touch + hover both available) */
@media (any-pointer: coarse) and (any-hover: hover) {
  /* Often the trickiest case; design both interactions to work */
}
```

### Safe-area inset cheatsheet

```css
:root {
  --safe-top:    env(safe-area-inset-top, 0);
  --safe-right:  env(safe-area-inset-right, 0);
  --safe-bottom: env(safe-area-inset-bottom, 0);
  --safe-left:   env(safe-area-inset-left, 0);
}

/* App shell padding */
body {
  padding-block: var(--safe-top) var(--safe-bottom);
  padding-inline: var(--safe-left) var(--safe-right);
}

/* Bottom tab bar */
.tab-bar {
  position: fixed;
  bottom: 0;
  inset-inline: 0;
  padding-bottom: max(0.5rem, var(--safe-bottom));
}

/* Fullscreen content (e.g., hero) */
.hero {
  height: 100svh; /* small viewport height; respects browser chrome */
}
```

Always pair `viewport-fit=cover` in the meta tag with safe-area-aware padding.

### Responsive image decision tree

```
Same crop at different sizes?
  +-- YES: use srcset + sizes (1 source, multiple resolutions)

Different crops per breakpoint?
  +-- YES: use <picture> with <source media="...">

Animated content?
  +-- YES: use <video> with poster, or animated WebP

Single fixed-size raster?
  +-- Just use <img src="..." width="..." height="..."> with width/height to prevent CLS
```

### Tables on mobile (responsive transform)

```css
/* Default: standard table */
table { width: 100%; }

@media (max-width: 640px) {
  /* Mobile: each row becomes a labeled card */
  table, thead, tbody, tr, th, td { display: block; }
  thead { display: none; }
  tr {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-3);
    padding: var(--space-3);
  }
  td {
    padding: 0;
    margin-bottom: var(--space-2);
  }
  td::before {
    content: attr(data-label) ": ";
    font-weight: 600;
  }
}
```

Markup pattern:
```html
<table>
  <thead><tr><th>Name</th><th>Email</th></tr></thead>
  <tbody>
    <tr>
      <td data-label="Name">Jane Doe</td>
      <td data-label="Email">jane@example.com</td>
    </tr>
  </tbody>
</table>
```

## WHAT'S MISSING

- **No "intrinsic web design" framing.** Container queries + auto-fit grids + clamp() can eliminate most breakpoints; doc treats breakpoints as primary.
- **No PWA / install-to-home prescriptions.** Modern responsive includes the install experience; absent.
- **No print stylesheet section.** Print is in adapt.md but should be cross-referenced here.
- **No keyboard-as-input prescription.** Pointer/hover queries covered but keyboard-specific UI patterns absent.
- **No advice on testing without real devices.** What if you can't get a real Android? BrowserStack, Sauce Labs - not addressed.
