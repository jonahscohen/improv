# Performance

Transition specificity and GPU compositing hints.

## Transition Only What Changes

Never use `transition: all` or Tailwind's `transition` shorthand (which maps to `transition-property: all`). Always specify the exact properties that change.

### Why

- `transition: all` forces the browser to watch every property for changes
- Causes unexpected transitions on properties you didn't intend to animate (colors, padding, shadows)
- Prevents browser optimizations

### CSS Example

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

### Tailwind

```tsx
// Good - explicit properties
<button className="transition-[scale,background-color] duration-150 ease-out">

// Bad - transition all
<button className="transition duration-150 ease-out">
```

### Tailwind `transition-transform` Note

`transition-transform` in Tailwind maps to `transition-property: transform, translate, scale, rotate` - it covers all transform-related properties, not just `transform`. Use this when you're only animating transforms. For multiple non-transform properties, use the bracket syntax: `transition-[scale,opacity,filter]`.

## Use `will-change` Sparingly

`will-change` hints the browser to pre-promote an element to its own GPU compositing layer. Without it, the browser promotes the element only when the animation starts - that one-time layer promotion can cause a micro-stutter on the first frame.

This particularly helps when an element is changing `scale`, `rotation`, or moving around with `transform`. For other properties, it doesn't help much - the browser can't composite them on the GPU anyway.

### Rules

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

### Useful Properties

| Property | GPU-compositable | Worth using `will-change` |
| --- | --- | --- |
| `transform` | Yes | Yes |
| `opacity` | Yes | Yes |
| `filter` (blur, brightness) | Yes | Yes |
| `clip-path` | Partial - modern engines composite simple shapes (inset, circle); complex paths can still repaint | Only after profiling shows first-frame stutter |
| `top`, `left`, `width`, `height` | No | No |
| `background`, `border`, `color` | No | No |

### When to Skip

Modern browsers are already good at optimizing on their own. Only add `will-change` when you notice first-frame stutter - Safari in particular benefits from it. Don't add it preemptively to every animated element; each extra compositing layer costs memory.

## Pause Off-Screen Loops

Any infinitely looping animation - marquee, pulse, float, shimmer, orbit, a spinner on a collapsed panel - must pause when it scrolls out of the viewport. Motion the user cannot see still burns main-thread and GPU time on every frame, and on laptops it drains the battery for nothing.

### Why

- An off-screen `@keyframes` loop keeps compositing and repainting even though no one is watching
- Several looping decorations on a long page compound into steady background CPU and GPU load
- Battery and thermals pay for frames that never reach a user's eye

### How

Drive CSS `animation-play-state` from an `IntersectionObserver`: run while intersecting, pause otherwise.

```css
.marquee { animation: scroll-x 20s linear infinite; }
.marquee.is-paused { animation-play-state: paused; }
```

```js
const io = new IntersectionObserver((entries) => {
 for (const entry of entries) {
 entry.target.classList.toggle("is-paused", !entry.isIntersecting);
 }
});
document.querySelectorAll(".marquee").forEach((el) => io.observe(el));
```

In a JS-driven library (GSAP, Motion), use the equivalent: pause the tween or timeline when the trigger element leaves the viewport (ScrollTrigger's `onEnter` / `onLeave`, or `toggleActions`) and resume on re-entry.

## Every rAF Loop Needs a Stop Condition

A `requestAnimationFrame` loop with no exit path runs for the life of the page. Every rAF loop must have an explicit termination or pause condition: the element was removed, it scrolled off-screen, the animation settled within an epsilon, or the tab is hidden. A loop that only ever schedules itself again is a leak.

### Why

- An unterminated loop keeps waking the main thread every frame long after its work is done
- A loop tied to a removed element keeps running against nothing, holding references and leaking memory
- Browsers pause rAF in hidden tabs for you, but that is suspension, not termination - the loop resumes the instant the tab foregrounds. The stop condition is about logical cleanup and resume control: deciding whether the loop SHOULD continue, not trusting the browser to decide for you. And an off-screen element in a VISIBLE tab gets no such mercy - that loop burns every frame

### How

Store the frame id so you can cancel, and gate the loop on real stop conditions.

```js
let rafId = null;

function tick() {
 if (document.hidden || !el.isConnected) { rafId = null; return; } // stop
 const settled = step(); // advance one frame; return true when done
 if (settled) { rafId = null; return; }
 rafId = requestAnimationFrame(tick);
}

function start() { if (rafId == null) rafId = requestAnimationFrame(tick); }

// Pause when the tab is hidden; resume when it returns
document.addEventListener("visibilitychange", () => {
 if (document.hidden) { cancelAnimationFrame(rafId); rafId = null; }
 else start();
});
```

Pair the same loop with an `IntersectionObserver` so it also stops while off-screen (see Pause Off-Screen Loops above). A visible target and unfinished work are the two conditions that justify a rAF loop running at all - when neither holds, stop it.
