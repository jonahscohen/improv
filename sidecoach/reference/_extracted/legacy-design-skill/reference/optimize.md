# Impeccable optimize.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

Performance is a feature. Identify the actual bottleneck for THIS interface, fix it, then measure. Don't optimize what isn't slow.

## Assess Performance Issues

Understand current performance and identify problems:

1. **Measure current state**:
   - **Core Web Vitals**: LCP, FID/INP, CLS scores
   - **Load time**: Time to interactive, first contentful paint
   - **Bundle size**: JavaScript, CSS, image sizes
   - **Runtime performance**: Frame rate, memory usage, CPU usage
   - **Network**: Request count, payload sizes, waterfall

2. **Identify bottlenecks**:
   - What's slow? (Initial load? Interactions? Animations?)
   - What's causing it? (Large images? Expensive JavaScript? Layout thrashing?)
   - How bad is it? (Perceivable? Annoying? Blocking?)
   - Who's affected? (All users? Mobile only? Slow connections?)

**CRITICAL**: Measure before and after. Premature optimization wastes time. Optimize what actually matters.

## Optimization Strategy

Create systematic improvement plan:

### Loading Performance

**Optimize Images**:
- Use modern formats (WebP, AVIF)
- Proper sizing (don't load 3000px image for 300px display)
- Lazy loading for below-fold images
- Responsive images (`srcset`, `picture` element)
- Compress images (80-85% quality is usually imperceptible)
- Use CDN for faster delivery

```html
<img 
  src="hero.webp"
  srcset="hero-400.webp 400w, hero-800.webp 800w, hero-1200.webp 1200w"
  sizes="(max-width: 400px) 400px, (max-width: 800px) 800px, 1200px"
  loading="lazy"
  alt="Hero image"
/>
```

**Reduce JavaScript Bundle**:
- Code splitting (route-based, component-based)
- Tree shaking (remove unused code)
- Remove unused dependencies
- Lazy load non-critical code
- Use dynamic imports for large components

```javascript
// Lazy load heavy component
const HeavyChart = lazy(() => import('./HeavyChart'));
```

**Optimize CSS**:
- Remove unused CSS
- Critical CSS inline, rest async
- Minimize CSS files
- Use CSS containment for independent regions

**Optimize Fonts**:
- Use `font-display: swap` or `optional`
- Subset fonts (only characters you need)
- Preload critical fonts
- Use system fonts when appropriate
- Limit font weights loaded

```css
@font-face {
  font-family: 'CustomFont';
  src: url('/fonts/custom.woff2') format('woff2');
  font-display: swap; /* Show fallback immediately */
  unicode-range: U+0020-007F; /* Basic Latin only */
}
```

**Optimize Loading Strategy**:
- Critical resources first (async/defer non-critical)
- Preload critical assets
- Prefetch likely next pages
- Service worker for offline/caching
- HTTP/2 or HTTP/3 for multiplexing

### Rendering Performance

**Avoid Layout Thrashing**:
```javascript
// Bad: Alternating reads and writes (causes reflows)
elements.forEach(el => {
  const height = el.offsetHeight; // Read (forces layout)
  el.style.height = height * 2; // Write
});

// Good: Batch reads, then batch writes
const heights = elements.map(el => el.offsetHeight); // All reads
elements.forEach((el, i) => {
  el.style.height = heights[i] * 2; // All writes
});
```

**Optimize Rendering**:
- Use CSS `contain` property for independent regions
- Minimize DOM depth (flatter is faster)
- Reduce DOM size (fewer elements)
- Use `content-visibility: auto` for long lists
- Virtual scrolling for very long lists (react-window, react-virtualized)

**Reduce Paint & Composite**:
- Use `transform` and `opacity` for reliable movement, but allow blur, filters, masks, clip paths, shadows, and color shifts when they create meaningful polish
- Avoid casual animation of layout-driving properties (`width`, `height`, `top`, `left`, margins)
- Use `will-change` sparingly for known expensive operations
- Bound expensive paint areas for blur/filter/shadow effects (smaller and isolated is faster)

### Animation Performance

**GPU Acceleration**:
```css
/* GPU-accelerated (fast) */
.animated {
  transform: translateX(100px);
  opacity: 0.5;
}

/* CPU-bound (slow) */
.animated {
  left: 100px;
  width: 300px;
}
```

**Smooth 60fps**:
- Target 16ms per frame (60fps)
- Use `requestAnimationFrame` for JS animations
- Debounce/throttle scroll handlers
- Use CSS animations when possible
- Avoid long-running JavaScript during animations

**Intersection Observer**:
```javascript
// Efficiently detect when elements enter viewport
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // Element is visible, lazy load or animate
    }
  });
});
```

### React/Framework Optimization

**React-specific**:
- Use `memo()` for expensive components
- `useMemo()` and `useCallback()` for expensive computations
- Virtualize long lists
- Code split routes
- Avoid inline function creation in render
- Use React DevTools Profiler

**Framework-agnostic**:
- Minimize re-renders
- Debounce expensive operations
- Memoize computed values
- Lazy load routes and components

### Network Optimization

**Reduce Requests**:
- Combine small files
- Use SVG sprites for icons
- Inline small critical assets
- Remove unused third-party scripts

**Optimize APIs**:
- Use pagination (don't load everything)
- GraphQL to request only needed fields
- Response compression (gzip, brotli)
- HTTP caching headers
- CDN for static assets

**Optimize for Slow Connections**:
- Adaptive loading based on connection (navigator.connection)
- Optimistic UI updates
- Request prioritization
- Progressive enhancement

## Core Web Vitals Optimization

### Largest Contentful Paint (LCP < 2.5s)
- Optimize hero images
- Inline critical CSS
- Preload key resources
- Use CDN
- Server-side rendering

### First Input Delay (FID < 100ms) / INP (< 200ms)
- Break up long tasks
- Defer non-critical JavaScript
- Use web workers for heavy computation
- Reduce JavaScript execution time

### Cumulative Layout Shift (CLS < 0.1)
- Set dimensions on images and videos
- Don't inject content above existing content
- Use `aspect-ratio` CSS property
- Reserve space for ads/embeds
- Avoid animations that cause layout shifts

```css
/* Reserve space for image */
.image-container {
  aspect-ratio: 16 / 9;
}
```

## Performance Monitoring

**Tools to use**:
- Chrome DevTools (Lighthouse, Performance panel)
- WebPageTest
- Core Web Vitals (Chrome UX Report)
- Bundle analyzers (webpack-bundle-analyzer)
- Performance monitoring (Sentry, DataDog, New Relic)

**Key metrics**:
- LCP, FID/INP, CLS (Core Web Vitals)
- Time to Interactive (TTI)
- First Contentful Paint (FCP)
- Total Blocking Time (TBT)
- Bundle size
- Request count

**IMPORTANT**: Measure on real devices with real network conditions. Desktop Chrome with fast connection isn't representative.

**NEVER**:
- Optimize without measuring (premature optimization)
- Sacrifice accessibility for performance
- Break functionality while optimizing
- Use `will-change` everywhere (creates new layers, uses memory)
- Lazy load above-fold content
- Optimize micro-optimizations while ignoring major issues (optimize the biggest bottleneck first)
- Forget about mobile performance (often slower devices, slower connections)

## Verify Improvements

Test that optimizations worked:

- **Before/after metrics**: Compare Lighthouse scores
- **Real user monitoring**: Track improvements for real users
- **Different devices**: Test on low-end Android, not just flagship iPhone
- **Slow connections**: Throttle to 3G, test experience
- **No regressions**: Ensure functionality still works
- **User perception**: Does it *feel* faster?

When the user-facing numbers move, hand off to `/impeccable polish` for the final pass.

## EXTENSION

### Core Web Vitals targets (concrete)

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5s to 4.0s | > 4.0s |
| INP (Interaction to Next Paint) | < 200ms | 200ms to 500ms | > 500ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1 to 0.25 | > 0.25 |
| FCP (First Contentful Paint) | < 1.8s | 1.8s to 3.0s | > 3.0s |
| TTFB (Time to First Byte) | < 800ms | 800ms to 1800ms | > 1800ms |
| TBT (Total Blocking Time) | < 200ms | 200ms to 600ms | > 600ms |

Targets are based on the 75th percentile of users (mobile + 3G).

### Image optimization decision tree

```
Is the image hero / above-the-fold?
  +-- YES: preload as critical (rel=preload), no lazy, use AVIF+WebP+JPEG with picture
  +-- NO: loading="lazy", decoding="async", use srcset for responsive

Is it photographic?
  +-- YES: AVIF (smallest) or WebP (universal); JPEG fallback at 80% quality
  +-- NO (graphic / logo / icon): SVG if vector; PNG-8 if pixel art; WebP if photo-like

Does it animate?
  +-- YES: WebM video or animated WebP; never GIF (huge files)
  +-- NO: static formats above
```

### Bundle-size budgets (reasonable defaults)

| Type | First-load JS budget | Total page budget |
|---|---|---|
| Marketing landing page | < 70KB gzipped | < 200KB total |
| Product app shell | < 150KB gzipped | < 500KB total |
| Dashboard with charts | < 250KB gzipped | < 800KB total |
| Heavy creative tool (Figma-like) | < 500KB gzipped | several MB acceptable |

Above these thresholds, add justification or split routes.

### will-change discipline

```css
/* Bad: globally hint everything */
* { will-change: transform, opacity; }

/* Bad: persistent hint on idle elements */
.button { will-change: transform; }

/* Good: hint just before the animation */
.button:hover { will-change: transform; }
.button { transition: transform 0.2s; }

/* Better: add via JS just before, remove after */
button.addEventListener('mouseenter', () => button.style.willChange = 'transform');
button.addEventListener('animationend', () => button.style.willChange = 'auto');
```

`will-change` creates a compositor layer per element. Layers cost memory; many layers slow rendering. Use it surgically.

### Lighthouse command-line

```bash
# Quick mobile audit, JSON output
npx lighthouse https://example.com \
  --preset=desktop \
  --output=json \
  --output-path=./lighthouse-report.json \
  --chrome-flags="--headless"

# Mobile preset (more realistic for the average user)
npx lighthouse https://example.com \
  --output=html \
  --output-path=./report.html
```

## WHAT'S MISSING

- **No backend / DB optimization.** This is a UI doc; backend perf is out of scope but the line isn't drawn.
- **No real-user monitoring (RUM) setup.** SaaS tools named but no setup snippet.
- **No CI integration.** Lighthouse-CI or web-vitals report on PRs - not addressed.
- **No specific framework recipes (Next.js Image, Astro <Image />).** Generic prescriptions only.
- **No "perf budget enforcement" workflow.** Once a budget is set, how does it get enforced? Not described.
