---
source: https://github.com/emilkowalski/skill/blob/main/skills/emil-design-eng/SKILL.md
author: Emil Kowalski (Sonner, Vaul, Vercel)
captured: 2026-05-25
type: external-taste-skill
note: em-dashes in source replaced with hyphens or commas (project rule)
---

# Emil Kowalski - Design Engineering (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### Core Philosophy

> Taste is trained, not innate. Good taste is not personal preference. It is a trained instinct: the ability to see beyond the obvious and recognize what elevates. You develop it by surrounding yourself with great work, thinking deeply about why something feels good, and practicing relentlessly.

> Unseen details compound. Most details users never consciously notice. That is the point. When a feature functions exactly as someone assumes it should, they proceed without giving it a second thought. That is the goal.

> "All those unseen details combine to produce something that's just stunning, like a thousand barely audible voices all singing in tune." - Paul Graham

> Beauty is leverage. People select tools based on the overall experience, not just functionality. Good defaults and good animations are real differentiators. Beauty is underutilized in software. Use it as leverage to stand out.

### MANDATORY Review Format

When reviewing UI code, MUST use a markdown table with Before/After columns:

| Before | After | Why |
| --- | --- | --- |
| `transition: all 300ms` | `transition: transform 200ms ease-out` | Specify exact properties; avoid `all` |
| `transform: scale(0)` | `transform: scale(0.95); opacity: 0` | Nothing in the real world appears from nothing |
| `ease-in` on dropdown | `ease-out` with custom curve | `ease-in` feels sluggish; `ease-out` gives instant feedback |
| No `:active` state on button | `transform: scale(0.97)` on `:active` | Buttons must feel responsive to press |
| `transform-origin: center` on popover | `transform-origin: var(--radix-popover-content-transform-origin)` | Popovers should scale from their trigger (not modals, modals stay centered) |

WRONG format (banned): "Before:" / "After:" on separate lines as a list.

### Animation Decision Framework

**Step 1: Should this animate at all?** (Frequency-first matrix)

| Frequency                                                   | Decision                     |
| ----------------------------------------------------------- | ---------------------------- |
| 100+ times/day (keyboard shortcuts, command palette toggle) | No animation. Ever.          |
| Tens of times/day (hover effects, list navigation)          | Remove or drastically reduce |
| Occasional (modals, drawers, toasts)                        | Standard animation           |
| Rare/first-time (onboarding, feedback forms, celebrations)  | Can add delight              |

> Never animate keyboard-initiated actions. These actions are repeated hundreds of times daily. Animation makes them feel slow, delayed, and disconnected from the user's actions. Raycast has no open/close animation. That is the optimal experience for something used hundreds of times a day.

**Step 2: What is the purpose?** Every animation must have a clear answer to "why does this animate?"

Valid purposes:
- **Spatial consistency**: toast enters and exits from the same direction, making swipe-to-dismiss feel intuitive
- **State indication**: a morphing feedback button shows the state change
- **Explanation**: a marketing animation that shows how a feature works
- **Feedback**: a button scales down on press, confirming the interface heard the user
- **Preventing jarring changes**: elements appearing or disappearing without transition feel broken

If the purpose is just "it looks cool" and the user will see it often, don't animate.

**Step 3: What easing should it use?**

```
Is the element entering or exiting?
  Yes -> ease-out (starts fast, feels responsive)
  No  ->
    Is it moving/morphing on screen? -> ease-in-out (natural acceleration/deceleration)
    Is it a hover/color change? -> ease
    Is it constant motion (marquee, progress bar)? -> linear
    Default -> ease-out
```

CRITICAL: Custom easing curves (the built-in CSS easings are too weak):

```css
/* Strong ease-out for UI interactions */
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);

/* Strong ease-in-out for on-screen movement */
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);

/* iOS-like drawer curve (from Ionic Framework) */
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

> Never use ease-in for UI animations. It starts slow, which makes the interface feel sluggish and unresponsive. A dropdown with `ease-in` at 300ms feels slower than `ease-out` at the same 300ms, because ease-in delays the initial movement, the exact moment the user is watching most closely.

Easing curve resources: [easing.dev](https://easing.dev/), [easings.co](https://easings.co/).

**Step 4: How fast should it be?**

| Element                  | Duration      |
| ------------------------ | ------------- |
| Button press feedback    | 100-160ms     |
| Tooltips, small popovers | 125-200ms     |
| Dropdowns, selects       | 150-250ms     |
| Modals, drawers          | 200-500ms     |
| Marketing/explanatory    | Can be longer |

> Rule: UI animations should stay under 300ms. A 180ms dropdown feels more responsive than a 400ms one. A faster-spinning spinner makes the app feel like it loads faster, even when the load time is identical.

### Perceived Performance

- A fast-spinning spinner makes loading feel faster (same load time, different perception)
- A 180ms select animation feels more responsive than a 400ms one
- Instant tooltips after the first one is open (skip delay + skip animation) make the whole toolbar feel faster

`ease-out` at 200ms feels faster than `ease-in` at 200ms because the user sees immediate movement.

### Spring Animations

When to use springs:
- Drag interactions with momentum
- Elements that should feel "alive" (like Apple's Dynamic Island)
- Gestures that can be interrupted mid-animation
- Decorative mouse-tracking interactions

Apple-style spring (recommended): `{ type: "spring", duration: 0.5, bounce: 0.2 }`
Traditional physics (more control): `{ type: "spring", mass: 1, stiffness: 100, damping: 10 }`
Keep bounce subtle (0.1-0.3). Avoid bounce in most UI contexts. Use for drag-to-dismiss and playful interactions.

Interruptibility: Springs maintain velocity when interrupted. CSS animations and keyframes restart from zero.

### Component Building Principles

**Buttons must feel responsive.** Add `transform: scale(0.97)` on `:active`. Subtle (0.95-0.98).

```css
.button { transition: transform 160ms ease-out; }
.button:active { transform: scale(0.97); }
```

**Never animate from scale(0).** Nothing in the real world disappears and reappears completely. Start from `scale(0.9)` or higher with opacity:

```css
/* Bad */  .entering { transform: scale(0); }
/* Good */ .entering { transform: scale(0.95); opacity: 0; }
```

**Make popovers origin-aware.** Popovers should scale in from their trigger, not from center. EXCEPTION: modals (modals stay `transform-origin: center` because they're not anchored to a trigger).

```css
.popover { transform-origin: var(--radix-popover-content-transform-origin); }
.popover { transform-origin: var(--transform-origin); } /* Base UI */
```

**Tooltips: skip delay on subsequent hovers.** Initial tooltip delays to prevent accidental activation. Subsequent tooltips open instantly with no animation.

```css
.tooltip { transition: transform 125ms ease-out, opacity 125ms ease-out; transform-origin: var(--transform-origin); }
.tooltip[data-starting-style], .tooltip[data-ending-style] { opacity: 0; transform: scale(0.97); }
.tooltip[data-instant] { transition-duration: 0ms; }
```

**Use CSS transitions over keyframes for interruptible UI.** Transitions can be interrupted and retargeted mid-animation. Keyframes restart from zero.

**Use blur to mask imperfect transitions.** When crossfade feels off, add `filter: blur(2px)` during transition. Blur bridges the visual gap by blending the two states. Keep blur under 20px (heavy blur is expensive in Safari).

```css
.button-content { transition: filter 200ms ease, opacity 200ms ease; }
.button-content.transitioning { filter: blur(2px); opacity: 0.7; }
```

**Animate enter states with @starting-style:**

```css
.toast {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;
  @starting-style {
    opacity: 0;
    transform: translateY(100%);
  }
}
```

### CSS Transform Mastery

- **translateY with percentages**: relative to element's own size. `translateY(100%)` moves by element's own height regardless of dimensions. How Sonner positions toasts and Vaul hides drawers.
- **scale() scales children too**: font size, icons, content all scale proportionally. Feature, not bug.
- **3D transforms**: `rotateX()`, `rotateY()` with `transform-style: preserve-3d` create real 3D in CSS.
- **transform-origin**: every element has an anchor point. Default center. Set to match trigger location.

### clip-path for Animation

`clip-path: inset(top right bottom left)` defines rectangular clipping. Each value eats from that side.

```css
.hidden  { clip-path: inset(0 100% 0 0); }   /* Fully hidden from right */
.visible { clip-path: inset(0 0 0 0); }      /* Fully visible */
```

Applications:
- **Tabs with perfect color transitions**: Duplicate the tab list. Style copy as "active". Clip the copy so only active tab is visible. Animate the clip on tab change.
- **Hold-to-delete**: `clip-path: inset(0 100% 0 0)` on colored overlay. On `:active`, transition to `inset(0 0 0 0)` over 2s linear. On release, snap back with 200ms ease-out. Add `scale(0.97)` for press feedback.
- **Image reveals on scroll**: Start with `clip-path: inset(0 0 100% 0)`. Animate to `inset(0 0 0 0)` on viewport entry.
- **Comparison sliders**: Overlay two images. Clip the top with `clip-path: inset(0 50% 0 0)`. Adjust right inset based on drag.

### Gesture and Drag

**Momentum-based dismissal.** Don't require dragging past a threshold. Calculate velocity: `Math.abs(dragDistance) / elapsedTime`. If velocity > ~0.11, dismiss regardless of distance.

```js
const velocity = Math.abs(swipeAmount) / timeTaken;
if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) dismiss();
```

- **Damping at boundaries**: more drag = less movement. Real life slows before stopping.
- **Pointer capture for drag**: ensures dragging continues even if pointer leaves element bounds.
- **Multi-touch protection**: ignore additional touch points after initial drag begins (prevents jumping when switching fingers).
- **Friction instead of hard stops**: more natural than hitting an invisible wall.

### Performance Rules

**Only animate transform and opacity.** These skip layout and paint, run on GPU. Animating `padding`, `margin`, `height`, `width` triggers all three rendering steps.

**CSS variables are inheritable.** Changing a CSS variable on a parent recalculates styles for all children. In a drawer with many items, updating `--swipe-amount` on the container causes expensive style recalculation. Update `transform` directly:

```js
// Bad: triggers recalc on all children
element.style.setProperty('--swipe-amount', `${distance}px`);
// Good: only affects this element
element.style.transform = `translateY(${distance}px)`;
```

**Framer Motion hardware-acceleration caveat (CRITICAL).** Framer Motion's shorthand properties (`x`, `y`, `scale`) are NOT hardware-accelerated. They use `requestAnimationFrame` on main thread. For hardware acceleration, use full `transform` string:

```jsx
// NOT hardware accelerated (drops frames under load)
<motion.div animate={{ x: 100 }} />

// Hardware accelerated (smooth even when main thread is busy)
<motion.div animate={{ transform: "translateX(100px)" }} />
```

**CSS animations beat JS under load.** Vercel dashboard tab animation used Shared Layout Animations and dropped frames during page loads. Switching to CSS animations (off main thread) fixed it.

**Use WAAPI for programmatic CSS animations.** Web Animations API gives JS control with CSS performance.

### Accessibility

**prefers-reduced-motion.** Reduced motion means fewer and gentler animations, NOT zero. Keep opacity and color transitions that aid comprehension. Remove movement and position animations.

```css
@media (prefers-reduced-motion: reduce) {
  .element {
    animation: fade 0.2s ease;
    /* No transform-based motion */
  }
}
```

**Touch device hover states.** Gate hover behind:
```css
@media (hover: hover) and (pointer: fine) { ... }
```
Touch devices trigger hover on tap -> false positives without this.

### The Sonner Principles (Loved Components)

1. **Developer experience is key.** No hooks, no context, no complex setup.
2. **Good defaults matter more than options.** Ship beautiful out of the box.
3. **Naming creates identity.** "Sonner" (French for "to ring") feels more elegant than "react-toast".
4. **Handle edge cases invisibly.** Pause timers on hidden tab. Fill gaps between stacked toasts with pseudo-elements to maintain hover state. Capture pointer events during drag.
5. **Use transitions, not keyframes, for dynamic UI.**
6. **Build a great documentation site.** Interactive examples lower adoption barrier.

**Cohesion matters.** Sonner is slightly slower than typical UI animations and uses `ease` rather than `ease-out` to feel more elegant. The animation style matches the toast design, the page design, the name. Match motion to mood.

**Review your work the next day.** Fresh eyes catch imperfections. Play animations in slow motion or frame by frame.

**Asymmetric enter/exit timing.** Pressing slow when deliberate (hold-to-delete: 2s linear), release always snappy (200ms ease-out). Slow where user is deciding, fast where system is responding.

### Stagger Animations

Keep stagger delays short (30-80ms between items). Long delays make the interface feel slow. Stagger is decorative, never block interaction while stagger animations play.

```css
.item:nth-child(1) { animation-delay: 0ms; }
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }
.item:nth-child(4) { animation-delay: 150ms; }
```

### Debugging Animations

**Slow motion testing** - things to look for:
- Do colors transition smoothly, or do you see two distinct states overlapping?
- Does the easing feel right?
- Is the transform-origin correct?
- Are multiple animated properties (opacity, transform, color) in sync?

**Frame-by-frame inspection** in Chrome DevTools (Animations panel).
**Test on real devices** for touch interactions. Connect phone via USB. Xcode Simulator is alternative but real hardware is better.

### Review Checklist

| Issue                                      | Fix                                                              |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `transition: all`                          | Specify exact properties                                          |
| `scale(0)` entry animation                 | Start from `scale(0.95)` with `opacity: 0`                       |
| `ease-in` on UI element                    | Switch to `ease-out` or custom curve                             |
| `transform-origin: center` on popover      | Set to trigger location (modals exempt, keep centered)            |
| Animation on keyboard action               | Remove animation entirely                                        |
| Duration > 300ms on UI element             | Reduce to 150-250ms                                              |
| Hover animation without media query        | Add `@media (hover: hover) and (pointer: fine)`                  |
| Keyframes on rapidly-triggered element     | Use CSS transitions for interruptibility                         |
| Framer Motion `x`/`y` props under load     | Use `transform: "translateX()"` for hardware acceleration        |
| Same enter/exit transition speed           | Make exit faster (e.g., enter 2s, exit 200ms)                    |
| Elements all appear at once                | Add stagger delay (30-80ms between items)                        |

---

## SECTION 2: EXTENSION (added specificity, examples, WHY)

### Surfaces that hit 100+/day (zero-animation tier)

Emil says "no animation. Ever." for 100+/day surfaces. Concrete inventory of which UI elements actually hit that volume:

1. **Command palette open/close** (CMD+K, CTRL+K) - power users invoke 50-200x/day; Raycast is the canonical zero-animation reference.
2. **Dock icons** (macOS/Windows app launcher) - hover and click happen constantly; the magnify-on-hover animation is the famous exception, but the launch itself is instant.
3. **Navigation tabs in app shells** - Slack channel switch, browser tab switch, IDE file tab switch. Should be instant; the active-indicator can transition (color/border) but the panel swap shouldn't fade.
4. **Primary CTA on dashboards** ("Send", "Save", "Submit" buttons hit hundreds of times) - press feedback (`scale(0.97)`) is fine because that IS the responsiveness signal; modal-after-click animations are not.
5. **Search input focus** - every form on every page. Focus ring should appear instantly; no `transition: outline 200ms`.
6. **Dropdown open in select form fields** (e.g., country picker, status filter) - if the user opens 20+ dropdowns to fill a form, even 150ms compounds painfully.
7. **Toggle/switch flip** (settings, dark mode, filter chips) - state change should be visible but ideally on the same frame as the click.
8. **Tab key focus traversal** through forms - never animate focus ring movement; users need instant landmark feedback.
9. **Sidebar collapse/expand** (when used as a layout primitive) - debatable; if the user toggles it once and forgets, it's occasional. If they're flipping repeatedly to compare, it's frequent and should be 150ms or less.
10. **Toast stacking/dismissal** - Sonner exception: the animation IS the affordance for swipe-to-dismiss, so it stays.

The rule of thumb: **if it's bound to a keyboard shortcut, treat it as 100+/day by default.**

### Custom easing - what makes each curve "stronger"

The three Emil curves and what makes them feel right:

- `cubic-bezier(0.23, 1, 0.32, 1)` (ease-out): the first control point is high on the Y axis (1.0), meaning the animation overshoots almost immediately, then the second control point pulls it back to settle. Translation: explosive start, gentle settle. This is the curve for UI that should feel like it's already moving when you blink.
- `cubic-bezier(0.77, 0, 0.175, 1)` (ease-in-out): aggressive S-curve. Both control points are extreme (0.77 horizontal start, 1.0 vertical end). Slow-start AND slow-end, but fast through the middle. Feels deliberate, mechanical, premium.
- `cubic-bezier(0.32, 0.72, 0, 1)` (ease-drawer): the Ionic curve. The second control point's X is 0 (vertical), meaning it "lifts off" at the end. Drawers and sheets feel like they're being pulled into place by a gentle invisible hand.

Browser-default `ease-out` is `cubic-bezier(0, 0, 0.58, 1)` - much weaker first control point (Y=0). That's why it feels limp.

### The `scale(0.97)` press - why 0.97 specifically

- `scale(1.0)` to `scale(0.95)` is 5%, big enough to look like a glitch on small buttons (e.g., 32x32 icon button).
- `scale(0.97)` is 3% - perceptible but not deformative.
- `scale(0.98)` is 2% - works on large surfaces (cards, hero buttons) where 3% is too much.
- Below `scale(0.94)` looks broken on text buttons (text becomes blurrily small).
- For ICON-only buttons, `scale(0.92)` is acceptable because there's no text to blur.

### The transform-origin trap (popovers vs modals)

The Radix/Base UI CSS variable system exposes `--radix-popover-content-transform-origin` which is computed PER OPEN based on trigger position. If your popover is in the bottom-right of the screen, the origin will be roughly "bottom right" and the popover will scale-in from that corner, AIMED at the trigger. Without this, every popover scales from its own center and feels disconnected from the click point.

Modals are exempt because modals have NO trigger relationship - they're a viewport-centered surface that exists independently of what was clicked to summon them. Modals scaling from their own center is correct.

### Framer Motion `x` vs `transform: translateX()` - when it actually matters

Emil flags this but doesn't quantify. Real-world threshold: if any of the following are true at the moment your animation runs, use the full `transform` string:
- A route transition is happening (Next.js dynamic import loading)
- A list is rendering more than ~50 items
- An image is decoding (large `<img>` not preloaded)
- The user is scrolling
- A web worker is busy
- A canvas is painting

In all other cases, `x`/`y` shorthand is fine and more readable. The Vercel dashboard incident happened because tab animations co-occurred with page navigations - both used main thread.

---

## SECTION 3: What this covers that impeccable + make-interfaces-feel-better don't

**make-interfaces-feel-better's 14-point checklist is structural** (concentric radius, optical alignment, hit-area minimums, scale-on-press). It tells you WHAT to do.

**Emil's contribution is the frequency-first decision tree.** Before any of those tactical rules apply, Emil asks "should this animate AT ALL?" - and his answer is often "no, especially if it's a keyboard surface." That's a category-defining filter neither in-house skill has codified.

**Specific gap-fills Emil provides:**

1. **The frequency matrix as a first-pass animation gate.** Impeccable's `/animate` command doesn't ask "is this a 100+/day surface?" before adding motion. Emil's matrix turns "should I animate this?" from a vibes call into a lookup.

2. **The three named custom easings with verbatim bezier curves.** Sidecoach references "exponential easing" generally; make-interfaces-feel-better mentions easing in passing. Neither names `(0.23, 1, 0.32, 1)` as the canonical ease-out, `(0.77, 0, 0.175, 1)` as ease-in-out, or `(0.32, 0.72, 0, 1)` as the iOS drawer curve. These are concrete, copyable values.

3. **The asymmetric enter/exit principle.** Make-interfaces-feel-better says "subtle exits" but doesn't articulate the WHY: slow where the user is deciding, fast where the system is responding. Hold-to-delete is the canonical example.

4. **The Framer Motion `x`/`y` hardware-accel gotcha.** This is a production-grade bug that almost nobody knows about. Sidecoach motion docs don't mention it. It's the difference between smooth and janky on Vercel-scale apps.

5. **The popover transform-origin pattern with the modal exemption.** Most tutorials say "set transform-origin to match trigger" - Emil specifically calls out modals as the exception because they don't have an anchor relationship to a trigger.

6. **The blur-during-crossfade trick.** A polish move neither in-house skill documents. When two states overlap mid-transition, `filter: blur(2px)` blends them into a single visual transformation. Keep under 20px (Safari).

7. **clip-path as an animation primitive.** Hold-to-delete, image reveals, tab color transitions, comparison sliders - all using inset clipping rather than layered DOM. Sidecoach motion library doesn't reference clip-path patterns.

8. **The Sonner principles for "loved components".** A philosophical layer about DX, defaults, naming, and edge-case handling that sits ABOVE Impeccable's tactical layer. This is the "why people choose to adopt your library" wisdom.

9. **The "review your work the next day" rule.** A workflow discipline that catches what fatigue hides.

10. **Pointer capture + multi-touch protection for drag gestures.** Two specific failure modes (pointer leaves element bounds, user switches fingers mid-drag) with concrete fixes. Sidecoach gesture coverage is thin.
