---
name: motion-reference
description: Build animations, transitions, scroll-driven effects, and motion-rich interactions using the GSAP + Lenis stack. Invoke this skill when the task involves animation work, scroll-driven effects, scroll-feel changes, page transitions, micro-interactions, hover/focus motion, staggered reveals, SVG path draw-in, text reveal animations, FLIP layout transitions, pinned hero sections, scrubbed scroll animations, snap-to-section scrolling, drag interactions, and any task that mentions GSAP, Lenis, ScrollTrigger, Flip, SplitText, DrawSVG, MorphSVG, MotionPath, Draggable, ScrollSmoother, or "smooth scroll". Ships canonical glue patterns (the GSAP + Lenis integration one-liner, React useGSAP hook cleanup, ScrollTrigger pin+scrub, Flip layout transitions, SplitText stagger) and the gotchas that bite (SSR, iOS Safari fixed-position quirks, ScrollTrigger refresh after dynamic content). Use even when the user does not name a library - if the task is motion-rich, this skill is the implementation layer.
---

# Motion Reference (GSAP + Lenis stack)

The default modern motion stack: **GSAP** for the animation engine (tweens, timelines, scroll-driven effects, layout transitions, SVG, text). **Lenis** for the smooth-scroll feel. They pair via one line of glue and cover essentially every motion task that warrants a library.

This skill ships canonical patterns. Read the relevant section, lift the pattern, adapt to the project. The patterns below are the load-bearing ones - the syntax you reach for most often.

## License clarity (matters)

As of Webflow's acquisition of GreenSock, **GSAP is fully free for commercial use**, including the formerly-paid Club plugins: **SplitText, MorphSVG, DrawSVG, MotionPath, ScrollSmoother, Inertia, Physics2D, Physics, CustomEase, CustomBounce, CustomWiggle, Flip**. No paywall, no license check.

Lenis is MIT.

## Routing table

| Task | Tool |
|---|---|
| Single tween or simple animation | `gsap.to() / gsap.from() / gsap.fromTo()` |
| Coordinated sequence | `gsap.timeline()` |
| Scroll-driven animation (pin, scrub, snap, batch) | GSAP `ScrollTrigger` |
| Smooth-scroll feel (lerped wheel scroll) | Lenis |
| Layout change animation (grid -> detail, route change) | GSAP `Flip` |
| SVG path draw-in (signature, logo reveal) | GSAP `DrawSVGPlugin` |
| Animate text by word or character (stagger reveal) | GSAP `SplitText` |
| Drag with momentum + bounds | GSAP `Draggable` |
| Morph one SVG shape into another | GSAP `MorphSVGPlugin` |
| Animate along a path | GSAP `MotionPathPlugin` |
| Native-feel inertia / virtualized smooth scroll with pin support | GSAP `ScrollSmoother` (alternative to Lenis when you need ScrollTrigger-native pinning) |

## Core canonical patterns

### Basic tween + timeline + stagger

```js
import gsap from "gsap";

// Single tween
gsap.to(".box", { x: 200, duration: 1, ease: "power2.out" });

// Timeline with shared defaults
const tl = gsap.timeline({ defaults: { duration: 0.5, ease: "power2.out" } });
tl.from(".a", { opacity: 0, y: 20 })
  .from(".b", { opacity: 0, y: 20 }, "-=0.3")
  .from(".c", { opacity: 0, y: 20 }, "-=0.3");

// Stagger across a set
gsap.from(".item", {
  opacity: 0,
  y: 30,
  duration: 0.6,
  ease: "power2.out",
  stagger: 0.08,
});
```

### ScrollTrigger pin + scrub (the most common scroll animation)

```js
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

gsap.to(".hero-content", {
  scale: 1.2,
  opacity: 0,
  scrollTrigger: {
    trigger: ".hero",
    start: "top top",
    end: "+=100%",     // scroll for one viewport-height
    pin: true,         // pin the trigger while scrubbing
    scrub: 1,          // 1s lag for smooth scrub; true = no lag
    // markers: true,  // turn on while building
  },
});
```

### GSAP + Lenis integration (the one critical glue snippet)

```js
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Lenis from "lenis"; // package is `lenis`; older code may import from `@studio-freight/lenis`

gsap.registerPlugin(ScrollTrigger);

const lenis = new Lenis();

// 1. Tell ScrollTrigger when Lenis scrolls
lenis.on("scroll", ScrollTrigger.update);

// 2. Drive Lenis with GSAP's ticker (single rAF loop for both)
gsap.ticker.add((time) => {
  lenis.raf(time * 1000); // gsap.ticker is seconds, Lenis wants ms
});

// 3. Disable GSAP's lag smoothing - Lenis handles its own smoothing
gsap.ticker.lagSmoothing(0);
```

Without those three lines, ScrollTrigger fires at native scroll positions while Lenis is mid-lerp - animations get out of sync with what the user sees on screen.

### React: useGSAP hook (handles cleanup automatically)

```jsx
import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

function Hero() {
  const container = useRef(null);

  useGSAP(
    () => {
      gsap.from(".heading", { opacity: 0, y: 30, duration: 0.8 });
      gsap.from(".item", { opacity: 0, y: 20, stagger: 0.1, delay: 0.3 });
    },
    { scope: container } // limits selectors to this ref + auto-cleanup on unmount
  );

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

**Why the scope matters:** without it, `.item` selectors leak across the whole document. With `scope`, the hook scopes selectors to the ref AND calls `ctx.revert()` on unmount automatically. Use it for every GSAP-in-React block.

### React + Lenis (root provider)

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

`root` mounts Lenis on `<html>` so it controls page scroll. Without `root`, Lenis scrolls the ReactLenis wrapper element only.

### Flip layout transition (the FLIP technique made trivial)

Use when the DOM rearranges and you want the move to animate (e.g., grid item expanding to detail, list reordering, route transition).

```js
import gsap from "gsap";
import Flip from "gsap/Flip";

gsap.registerPlugin(Flip);

// 1. Capture the "first" state - measurements before the change
const state = Flip.getState(".card");

// 2. Make the DOM change - reorder, toggle a class, swap parents, whatever
gridContainer.classList.add("expanded");

// 3. Animate from the captured state to the new state
Flip.from(state, {
  duration: 0.6,
  ease: "power2.inOut",
  absolute: true, // takes elements out of layout flow during the animation
  scale: true,     // animate scale instead of width/height for performance
});
```

### SplitText word + char stagger

```js
import gsap from "gsap";
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

// Cleanup if you need to re-flow the text later:
// split.revert();
```

### DrawSVG path animation

```js
import gsap from "gsap";
import DrawSVGPlugin from "gsap/DrawSVGPlugin";

gsap.registerPlugin(DrawSVGPlugin);

gsap.from(".signature path", {
  drawSVG: 0,           // start with 0% drawn
  duration: 2,
  ease: "power2.inOut",
  stagger: 0.05,        // stagger multiple paths
});
```

The path must have a `stroke` and the SVG must be inline (not a background-image). DrawSVG manipulates `stroke-dasharray` + `stroke-dashoffset`.

### Snap-to-section scrolling

```js
ScrollTrigger.create({
  trigger: "main",
  start: "top top",
  end: "bottom bottom",
  snap: {
    snapTo: 1 / (numSections - 1), // 4 sections -> snap every 1/3
    duration: { min: 0.2, max: 0.6 },
    ease: "power2.inOut",
  },
});
```

## CSS scroll-driven animations (native, no JS)

Modern browsers can bind an animation's progress directly to scroll position or to an element's entry into the viewport, with no JavaScript and no library. Two timeline sources:

- `animation-timeline: scroll()` - progress tracks how far a scroll container has scrolled (0% at the top, 100% at the bottom). Good for reading-progress bars, scroll-linked backgrounds, light parallax.
- `animation-timeline: view()` - progress tracks a target element's passage through the viewport, tunable with `animation-range`. Good for reveal-on-enter and fade-as-it-leaves.

**Prefer native over ScrollTrigger when:** the effect is a simple reveal or a single-element progress mapping, the page is zero-dependency (or you do not want to ship the GSAP bundle for one effect), and you do not need pinning, snap, or cross-element orchestration. This is the lightest possible way to do "animate as it scrolls."

**ScrollTrigger still wins when:** you need pinning, a scrubbed multi-step timeline, scroll snapping, orchestration across several elements, or the widest browser support. Native scroll-driven animations are Chromium-first; Firefox and Safari support lags, so treat them as progressive enhancement.

### `scroll()` progress bar

```css
@keyframes grow-progress { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.reading-progress {
  transform-origin: left;
  animation: grow-progress linear;
  animation-timeline: scroll(root block); /* track the root scroller on the block axis */
}
```

### `view()` reveal with `animation-range`

```css
@keyframes reveal { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }

.card {
  animation: reveal linear both;
  animation-timeline: view();
  animation-range: entry 0% cover 30%; /* start as it enters, finish 30% into view */
}
```

**Always gate on support** so the un-animated state is the correct resting state, never a stuck `opacity: 0`:

```css
@supports (animation-timeline: scroll()) {
  .card { animation: reveal linear both; animation-timeline: view(); }
}
```

Without the `@supports` guard, a browser that does not support `animation-timeline` ignores the property entirely - the animation falls back to the default document (time-driven) timeline and simply plays on load instead of scroll-driving. That is rarely what you want a reveal to do. Author the fallback as the visible, final state, and layer the scroll-driven animation on top only inside `@supports (animation-timeline: view())` (or `scroll()` for the progress case).

## View Transitions API (native shared-element morphs)

`document.startViewTransition()` lets the browser snapshot the page before and after a DOM change and animate between the two - including shared-element morphs, where an element tagged with the same `view-transition-name` in both states smoothly moves and scales between its old and new position. It covers both same-document state changes and, with the multi-page variant, cross-document navigation transitions.

**What it gives you:** browser-native FLIP. The morph, the crossfade of everything else, and the pseudo-element plumbing are handled by the engine. No manual first/last measurement, no cloned ghost node.

**Use it instead of FLIP or manual shared-element work when:** the transition is a state or route change (list -> detail, grid item -> full view, tab swap) and the browser supports it. Reach for GSAP `Flip` instead when you need fine timeline control, coordination with other tweens, interruptibility mid-transition, or support on browsers that lack the API.

### Minimal example

```js
// Wrap the DOM mutation. The browser animates old -> new automatically.
function swap() {
  if (!document.startViewTransition) return applyChange(); // progressive enhancement
  document.startViewTransition(() => applyChange());
}
```

```css
/* Tag the element that should morph across the two states (same name on both sides) */
.hero-image { view-transition-name: hero; }

/* Tune the generated animation */
::view-transition-group(hero) { animation-duration: 300ms; }
```

### Reduced motion

Fold the transition down to a plain crossfade (or nothing) under `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) { animation: none; }
}
```

### Progressive enhancement

Feature-detect (`if (!document.startViewTransition) ...`) and always run the underlying DOM change directly when the API is absent. The app must reach the same end state with or without the transition - the morph is decoration on top of a state change that already works.

## Gotchas - the ones that bite

### SSR (Next.js, Remix, Astro, SvelteKit)

GSAP touches `window` and DOM. **Do not run it during SSR.**

- Next.js App Router: use a Client Component (`"use client"` at the top of the animation file).
- Astro: gate motion code with `client:visible` or `client:load`.
- Dynamic import as a fallback: `const gsap = (await import("gsap")).default;`

### ScrollTrigger after dynamic content changes

If the DOM grows/shrinks (lazy-loaded images, route change without remount, expanded accordion), trigger positions go stale. Call:

```js
ScrollTrigger.refresh();
```

For SPAs, call refresh on route change. For lazy images, listen for `load` events.

### Lenis breaks native scroll-into-view

`element.scrollIntoView()` and CSS `scroll-behavior: smooth` do not respect Lenis - they snap instantly while Lenis is mid-lerp. Use Lenis's own API:

```js
lenis.scrollTo(target, { offset: -80, duration: 1.2 });
```

`target` can be a string selector, a number (pixel offset), or an element.

### Lenis + iOS Safari + `position: fixed`

Pinned headers and fixed elements get janky on iOS Safari with Lenis enabled. Workarounds:

- Use ScrollSmoother (GSAP's smooth-scroll plugin, ScrollTrigger-native pinning) instead of Lenis for sites with heavy fixed positioning.
- Or: detect iOS Safari and disable Lenis on that surface, letting native scroll take over.

### React cleanup without useGSAP

If you are not using `useGSAP`, manual cleanup is required:

```jsx
useEffect(() => {
  const ctx = gsap.context(() => {
    gsap.from(".item", { opacity: 0, y: 20 });
  }, containerRef);
  return () => ctx.revert(); // cleans up tweens + ScrollTriggers on unmount
}, []);
```

Without `ctx.revert()`, ScrollTrigger instances leak across remounts. Prefer `useGSAP` whenever you can.

### Plugin registration

GSAP plugins must be registered ONCE per page load before use. Put this at the top of your animation entry point:

```js
import { gsap } from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import Flip from "gsap/Flip";
import SplitText from "gsap/SplitText";

gsap.registerPlugin(ScrollTrigger, Flip, SplitText);
```

In React, register inside `useGSAP` or at the module level - just not inside a per-component render path that re-runs.

### CDN ESM: use `esm.sh`, not `cdn.skypack.dev`

When loading these libraries from a CDN rather than a bundler, use `esm.sh`. In the
2026-05-20 marketing-site build `cdn.skypack.dev` **failed silently on `lenis`** - no console
error, no thrown exception, just no smooth scroll. A silent CDN failure looks exactly like a
bug in your own glue code and will cost an hour before you suspect the import.

```html
<script type="module">
  import Lenis from "https://esm.sh/lenis";
</script>
```

### Reveal-on-scroll must fail VISIBLE, not hidden

The natural way to write a scroll reveal is to hide the element in CSS (`[data-reveal] {
opacity: 0 }`) and let JS animate it in. **Do not.** If the JS never runs - a bundler error,
a CDN failure like the one above, a thrown exception earlier on the page, JS disabled - the
content stays at `opacity: 0` forever and the page renders blank with no error anywhere.
The failure is invisible precisely when something has already gone wrong.

Invert it: items are visible by default, and are hidden ONLY once JS has confirmed it is
running, by which point it can also be trusted to reveal them again.

```css
/* not [data-reveal] { opacity: 0 } */
.js [data-reveal] { opacity: 0; transform: translateY(1rem); }
```

```js
document.documentElement.classList.add("js"); // first line of the entry point
```

**What this does and does not buy you.** It covers the whole class of "the script never ran
at all" - a failed import, a dead CDN, a syntax error, JS disabled - because the class is
added before any of the animation setup. It does NOT cover an exception thrown AFTER the
class is set but before the reveal is wired, which still leaves content hidden. If the
reveal setup can realistically throw, wrap it and drop the class again in the `catch` so the
page degrades to plain visible content rather than a blank one.

Validated in the 2026-05-20 marketing-site build, preserved here from the retired
`design-build` skill.

### Verifying a page that runs Lenis

Lenis hijacks wheel events at the document level, so a scroll driven by a verification tool
can do nothing while the page looks perfectly scrollable. Either click nav links (which go
through `lenis.scrollTo`), or put `data-lenis-prevent` on the scrollable child, or disable
Lenis behind a feature flag for the verification pass and re-enable it after. A scrollbar
that does not respond to a wheel event is this, not a broken tool.

## Naming an effect

When the task is to NAME a motion effect rather than build one ("what's it called when...", a description of an effect by feel), use [VOCABULARY.md](VOCABULARY.md) - the reverse-lookup glossary that maps sensations to precise terms, with disambiguation for close pairs. Lead with the term, keep it tight.

## Anti-patterns

- **Do not use GSAP for trivial CSS transitions.** A 200ms hover color change does not need GSAP. CSS transitions are fine; only reach for GSAP when you need timeline coordination, scroll-driving, or features CSS does not have.
- **Do not enable Lenis on apps with scroll-snap-dependent flows** (image galleries, vertical-scroll product configurators) without testing. Lenis overrides the native scroll model.
- **Do not pin without a defined end position.** ScrollTrigger pins use `end: "+=Xpx"` or `end: "+=100%"` to define how long the pin lasts. Forgetting `end` leaves the user stuck.
- **Do not animate `width` / `height` when `scale` is available.** Layout-affecting properties trigger reflow on every frame; transforms do not.
- **Do not chain `gsap.to(elem).delay(N)` style.** Use `delay: N` inside the vars object - the chained form is older API and can confuse the parser.
- **Do not forget to call `split.revert()`** on SplitText before the page leaves OR re-runs the split. The wrapping spans stay otherwise.

## Integration with other skills

- `sidecoach` provides the brand strategy (what should this feel like? what register?). This skill provides the implementation tools (how do I make it feel that way?).
- `tactical-polish` overlaps on tactical motion polish (timing, easing, scale-on-press, stagger windows). When both apply, defer to tactical-polish for specific timing values; use this skill for the API calls. For looping-animation pause rules, rAF stop conditions, and the blur budget, see tactical-polish performance.md and motion-review.md.
- `curate` (Recall mode) may surface captured patterns from the personal catalog that use these libraries; consult both when matching feel from a reference.

## When NOT to use this stack

- The page has 1-2 simple animations and no scroll-driven anything. Use CSS transitions or `@keyframes`.
- The project has a strict bundle-size budget and no scroll work. CSS or a tiny custom rAF tween is enough.
- The animation is purely declarative state-driven and the project uses Framer Motion / Motion.dev (the React-flavored animation lib). GSAP and Motion can coexist but should not animate the same `transform` on the same element. Pick one per element.
