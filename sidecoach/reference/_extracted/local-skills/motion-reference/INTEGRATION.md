# motion-reference - Sidecoach Integration

Source: `/Users/spare3/.claude/skills/motion-reference/SKILL.md`

## What this skill provides

Canonical implementation patterns for the **GSAP + Lenis** motion stack. GSAP is the animation engine (tweens, timelines, scroll-driven, layout transitions, SVG, text). Lenis is the smooth-scroll feel. The skill ships the load-bearing glue code so the agent doesn't reinvent it each time.

### License clarity (matters for project recommendations)

As of Webflow's acquisition of GreenSock, **GSAP is fully free for commercial use**, including the formerly-paid Club plugins: SplitText, MorphSVG, DrawSVG, MotionPath, ScrollSmoother, Inertia, Physics2D, Physics, CustomEase, CustomBounce, CustomWiggle, Flip.

Lenis is MIT.

## Routing table (what tool for what task)

| Task | Tool |
|---|---|
| Single tween or simple animation | `gsap.to() / gsap.from() / gsap.fromTo()` |
| Coordinated sequence | `gsap.timeline()` |
| Scroll-driven (pin, scrub, snap, batch) | GSAP `ScrollTrigger` |
| Smooth-scroll feel (lerped wheel) | Lenis |
| Layout change animation (grid → detail, route change) | GSAP `Flip` |
| SVG path draw-in (signature, logo reveal) | GSAP `DrawSVGPlugin` |
| Word/char stagger reveal | GSAP `SplitText` |
| Drag with momentum + bounds | GSAP `Draggable` |
| Morph one SVG shape into another | GSAP `MorphSVGPlugin` |
| Animate along a path | GSAP `MotionPathPlugin` |
| Smooth scroll with ScrollTrigger-native pinning | GSAP `ScrollSmoother` (alternative to Lenis) |

## Canonical patterns (the ones sidecoach should lift verbatim)

### Pattern 1: GSAP + Lenis integration (THE critical glue snippet)

Without these three lines, ScrollTrigger fires at native scroll positions while Lenis is mid-lerp - animations get out of sync with what the user sees.

```js
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis"; // older: @studio-freight/lenis

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis();
lenis.on("scroll", ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

### Pattern 2: ScrollTrigger pin + scrub (most common scroll animation)

```js
gsap.to(".hero-content", {
  scale: 1.2,
  opacity: 0,
  scrollTrigger: {
    trigger: ".hero",
    start: "top top",
    end: "+=100%",
    pin: true,
    scrub: 1,
  },
});
```

### Pattern 3: React useGSAP hook (auto-cleanup, scoped selectors)

```jsx
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

function Hero() {
  const container = useRef(null);
  useGSAP(() => {
    gsap.from(".heading", { opacity: 0, y: 30, duration: 0.8 });
    gsap.from(".item", { opacity: 0, y: 20, stagger: 0.1, delay: 0.3 });
  }, { scope: container });
  return (
    <section ref={container}>
      <h1 className="heading">Title</h1>
      <ul>
        <li className="item">One</li>
        <li className="item">Two</li>
      </ul>
    </section>
  );
}
```

**Without `scope`**, selectors leak across the whole document AND cleanup doesn't fire on unmount. Always pass `scope`.

### Pattern 4: ReactLenis root provider

```jsx
import { ReactLenis } from "@studio-freight/react-lenis";

export default function RootLayout({ children }) {
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: true }}>
      {children}
    </ReactLenis>
  );
}
```

`root` mounts Lenis on `<html>`. Without `root`, Lenis only scrolls the wrapper.

### Pattern 5: Flip layout transition (FLIP technique made trivial)

```js
import Flip from "gsap/Flip";
gsap.registerPlugin(Flip);

const state = Flip.getState(".card");        // capture "first" state
gridContainer.classList.add("expanded");      // make the DOM change
Flip.from(state, {                            // animate from captured state to new
  duration: 0.6,
  ease: "power2.inOut",
  absolute: true,
  scale: true,
});
```

### Pattern 6: SplitText word + char stagger

```js
import SplitText from "gsap/SplitText";
gsap.registerPlugin(SplitText);

const split = new SplitText(".heading", { type: "words,chars" });
gsap.from(split.chars, {
  opacity: 0,
  y: 20,
  rotateX: -90,
  stagger: 0.02,
  duration: 0.6,
  ease: "power2.out",
});
// Cleanup: split.revert();
```

### Pattern 7: DrawSVG path animation

```js
import DrawSVGPlugin from "gsap/DrawSVGPlugin";
gsap.registerPlugin(DrawSVGPlugin);

gsap.from(".signature path", {
  drawSVG: 0,
  duration: 2,
  ease: "power2.inOut",
  stagger: 0.05,
});
```

Path must have a `stroke`; SVG must be inline (not background-image).

### Pattern 8: Snap-to-section scrolling

```js
ScrollTrigger.create({
  trigger: "main",
  start: "top top",
  end: "bottom bottom",
  snap: {
    snapTo: 1 / (numSections - 1),
    duration: { min: 0.2, max: 0.6 },
    ease: "power2.inOut",
  },
});
```

### Pattern 9: Basic stagger across a set

```js
gsap.from(".item", {
  opacity: 0,
  y: 30,
  duration: 0.6,
  ease: "power2.out",
  stagger: 0.08,
});
```

## The gotchas (the ones that bite)

### SSR (Next.js / Remix / Astro / SvelteKit)
GSAP touches `window` and DOM. Do NOT run during SSR.
- Next.js App Router: `"use client"` at top of animation file
- Astro: `client:visible` or `client:load`
- Dynamic import fallback: `const gsap = (await import("gsap")).default;`

### ScrollTrigger after dynamic content
DOM grows/shrinks → trigger positions go stale. Call `ScrollTrigger.refresh()`. For SPAs, on route change. For lazy images, on `load` events.

### Lenis breaks native scroll-into-view
`element.scrollIntoView()` and CSS `scroll-behavior: smooth` snap instantly while Lenis is mid-lerp. Use:
```js
lenis.scrollTo(target, { offset: -80, duration: 1.2 });
```

### Lenis blocks scroll inside child containers (`data-lenis-prevent`)
Lenis hijacks wheel events at document level. Any child with `overflow: auto/scroll` shows a scrollbar but won't respond. Fix:
```html
<aside class="sidebar" data-lenis-prevent>...</aside>
```
**During verification, wheel-test every overflow region.** A visible scrollbar is NOT proof of working scroll.

### Lenis + iOS Safari + position: fixed
Pinned headers get janky. Workarounds: use ScrollSmoother instead, or detect iOS Safari and disable Lenis.

### React cleanup without useGSAP
Manual cleanup required:
```jsx
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.from(".item", { opacity: 0, y: 20 });
  }, containerRef);
  return () => ctx.revert();
}, []);
```

### Plugin registration
Register ONCE per page load at top of animation entry:
```js
gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
```
Don't register inside per-render component paths.

## Anti-patterns

- Don't use GSAP for trivial CSS transitions (200ms hover color = CSS transition, not GSAP)
- Don't enable Lenis on scroll-snap-dependent flows without testing
- Don't pin without `end: "+=Xpx"` or `end: "+=100%"`
- Don't animate `width`/`height` when `scale` is available
- Don't chain `gsap.to(elem).delay(N)` - use `delay: N` in vars
- Don't forget `split.revert()` before re-running or page leave

## How sidecoach should query this skill

### Trigger conditions

Sidecoach should consult motion-reference when the task involves:
- Scroll-driven effects (pin, scrub, snap, batch)
- Scroll feel changes (smooth scroll, lerped)
- Page transitions / view transitions
- Micro-interactions (hover, focus motion)
- Staggered reveals
- SVG path draw-in
- Text reveal animations
- FLIP layout transitions
- Pinned hero sections
- Drag interactions with momentum
- Any mention of: GSAP, Lenis, ScrollTrigger, Flip, SplitText, DrawSVG, MorphSVG, MotionPath, Draggable, ScrollSmoother, "smooth scroll"

### Which sidecoach flows should query this skill

| Sidecoach flow | When to query | What to extract |
|---|---|---|
| **Flow E (motion-patterns)** | ALWAYS on entry | Routing-table tool match, canonical pattern, gotcha list |
| **Flow H (motion-integration)** | When wiring motion into a component | The relevant canonical snippet verbatim |
| **Flow G (component-implementation)** | When the component has motion needs | Pattern 1 (Lenis glue), Pattern 3 (useGSAP), Pattern 6 (SplitText) as appropriate |
| **Flow N (audit triad)** | During performance audit | Anti-pattern check, `data-lenis-prevent` wheel-test, ScrollTrigger.refresh() check |
| **Flow tactical-polish** | When tightening interactions | Reduced-motion handling, exponential easing |

### Query shape

```typescript
{
  source: 'motion-reference',
  motionNeed: 'scroll-driven' | 'micro-interaction' | 'page-transition'
    | 'layout-transition' | 'text-reveal' | 'svg-draw' | 'drag' | 'stagger',
  framework: 'react' | 'vanilla' | 'vue' | 'svelte',
  ssr: boolean,           // affects Next.js / Astro guidance
  hasLenis: boolean,
  hasOverflowChildren: boolean,  // triggers data-lenis-prevent check
  expectedOutput: {
    canonicalPattern: string,    // verbatim snippet
    requiredPlugins: string[],   // ScrollTrigger, Flip, etc.
    gotchas: string[],           // applicable gotchas
    reducedMotionHandling: string,
  },
}
```

### Reduced-motion handling (sidecoach should enforce)

Every motion sidecoach generates must respect `prefers-reduced-motion`. The skill doesn't make this fully explicit but sidecoach's existing motion-domain rules require it. Pattern:

```js
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

if (prefersReducedMotion) {
  // Set final state instantly, skip the tween
  gsap.set(".item", { opacity: 1, y: 0 });
} else {
  gsap.from(".item", { opacity: 0, y: 20, stagger: 0.08 });
}
```

Or use GSAP's `gsap.matchMedia()`:
```js
let mm = gsap.matchMedia();
mm.add("(prefers-reduced-motion: no-preference)", () => {
  gsap.from(".item", { opacity: 0, y: 20, stagger: 0.08 });
});
```

## What sidecoach is currently missing

1. **Flow H (motion-integration) does not embed the canonical glue snippet.** The current handler generates motion code without grounding it in the Pattern 1 (Lenis + ScrollTrigger glue). If a project uses both, the integration must follow the 3-line pattern exactly.
2. **No `data-lenis-prevent` audit step.** Scrollable children get a visible scrollbar but no wheel response - sidecoach's audit triad does not check for this. Add to Flow N.
3. **No SSR guard.** Sidecoach does not currently detect Next.js / Remix / Astro / SvelteKit and inject the `"use client"` or dynamic-import pattern.
4. **No plugin-registration check.** Generated GSAP code sometimes omits `gsap.registerPlugin(...)`. Should be a lint rule in Flow N.
5. **Reduced-motion handling is partial.** Sidecoach has motion-domain rules for exponential easing but does not enforce the `prefers-reduced-motion` short-circuit pattern in generated code.

## Integration with other skills

The skill's own integration notes:

- **impeccable / sidecoach** provides the brand strategy (what should this feel like? what register?). motion-reference provides the implementation tools (how to make it feel that way?).
- **make-interfaces-feel-better** overlaps on tactical motion polish (timing, easing, scale-on-press, stagger windows). When both apply, defer to make-interfaces-feel-better for specific timing values; use motion-reference for the API calls.
- **design-references** may surface captured patterns that use these libraries; consult both when matching feel from a reference.

## When NOT to use this stack

- 1-2 simple animations, no scroll work → CSS transitions or `@keyframes`
- Strict bundle-size budget, no scroll work → CSS or tiny custom rAF tween
- React project using Framer Motion / Motion.dev → don't animate the same transform on the same element with both libraries; pick one per element
