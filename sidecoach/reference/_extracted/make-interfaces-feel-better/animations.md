# make-interfaces-feel-better - Animations (extracted)

This file extracts `animations.md` from the make-interfaces-feel-better skill. Source verbatim lift comes first, then Extension (operational specificity for interruptible animations, enter/exit, icon animations, scale on press, skip-on-load), then What's missing (animation gaps).

> Note on punctuation: per CLAUDE.md (no emdashes), every emdash from the source has been converted to a regular hyphen with surrounding spaces. All other content is byte-for-byte preserved.

---

## Source verbatim lift

From `/Users/spare3/.agents/skills/make-interfaces-feel-better/animations.md`.

### Animations

Interruptible animations, enter/exit transitions, and contextual icon animations.

### Interruptible Animations

Users change intent mid-interaction. If animations aren't interruptible, the interface feels broken.

#### CSS Transitions vs. Keyframes

| | CSS Transitions | CSS Keyframe Animations |
| --- | --- | --- |
| **Behavior** | Interpolate toward latest state | Run on a fixed timeline |
| **Interruptible** | Yes - retargets mid-animation | No - restarts from beginning |
| **Use for** | Interactive state changes (hover, toggle, open/close) | Staged sequences that run once (enter animations, loading) |
| **Duration** | Adapts to remaining distance | Fixed regardless of state |

```css
/* Good - interruptible transition for a toggle */
.drawer {
  transform: translateX(-100%);
  transition: transform 200ms ease-out;
}
.drawer.open {
  transform: translateX(0);
}

/* Clicking again mid-animation smoothly reverses - no jank */
```

```css
/* Bad - keyframe animation for interactive element */
.drawer.open {
  animation: slideIn 200ms ease-out forwards;
}

/* Closing mid-animation snaps or restarts - feels broken */
```

**Rule:** Always prefer CSS transitions for interactive elements. Reserve keyframes for one-shot sequences.

### Enter Animations: Split and Stagger

Don't animate a single large container. Break content into semantic chunks and animate each individually.

#### Step by Step

1. **Split** into logical groups (title, description, buttons)
2. **Stagger** with ~100ms delay between groups
3. **For titles**, consider splitting into individual words with ~80ms stagger
4. **Combine** `opacity`, `blur`, and `translateY` for the enter effect

#### Code Example

```tsx
// Motion (Framer Motion) - staggered enter
function PageHeader() {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.1 } },
      }}
    >
      <motion.h1
        variants={{
          hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
          visible: { opacity: 1, y: 0, filter: "blur(0px)" },
        }}
      >
        Welcome
      </motion.h1>

      <motion.p
        variants={{
          hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
          visible: { opacity: 1, y: 0, filter: "blur(0px)" },
        }}
      >
        A description of the page.
      </motion.p>

      <motion.div
        variants={{
          hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
          visible: { opacity: 1, y: 0, filter: "blur(0px)" },
        }}
      >
        <Button>Get started</Button>
      </motion.div>
    </motion.div>
  );
}
```

#### CSS-Only Stagger

```css
.stagger-item {
  opacity: 0;
  transform: translateY(12px);
  filter: blur(4px);
  animation: fadeInUp 400ms ease-out forwards;
}

.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 100ms; }
.stagger-item:nth-child(3) { animation-delay: 200ms; }

@keyframes fadeInUp {
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}
```

### Exit Animations

Exit animations should be softer and less attention-grabbing than enter animations. The user's focus is moving to the next thing - don't fight for attention.

#### Subtle Exit (Recommended)

```tsx
// Small fixed translateY - indicates direction without drama
<motion.div
  exit={{
    opacity: 0,
    y: -12,
    filter: "blur(4px)",
    transition: { duration: 0.15, ease: "easeIn" },
  }}
>
  {content}
</motion.div>
```

#### Full Exit (When Context Matters)

```tsx
// Slide fully out - use when spatial context is important
// (e.g., a card returning to a list, a drawer closing)
<motion.div
  exit={{
    opacity: 0,
    x: "-100%",
    transition: { duration: 0.2, ease: "easeIn" },
  }}
>
  {content}
</motion.div>
```

#### Good vs. Bad

```css
/* Good - subtle exit */
.item-exit {
  opacity: 0;
  transform: translateY(-12px);
  transition: opacity 150ms ease-in, transform 150ms ease-in;
}

/* Bad - dramatic exit that steals focus */
.item-exit {
  opacity: 0;
  transform: translateY(-100%) scale(0.5);
  transition: all 400ms ease-in;
}

/* Bad - no exit animation at all (element just vanishes) */
.item-exit {
  display: none;
}
```

**Key points:**
- Use a small fixed `translateY` (e.g., `-12px`) instead of the full container height
- Keep some directional movement to indicate where the element went
- Exit duration should be shorter than enter duration (150ms vs 300ms)
- Don't remove exit animations entirely - subtle motion preserves context

### Contextual Icon Animations

When icons appear or disappear contextually (on hover, on state change), animate them with `opacity`, `scale`, and `blur` rather than just toggling visibility.

#### Motion Example

```tsx
import { AnimatePresence, motion } from "motion/react";

function IconButton({ isActive, icon: Icon }) {
  return (
    <button>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={isActive ? "active" : "inactive"}
          initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.3, bounce: 0 }}
        >
          <Icon />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
```

#### CSS Transition Approach (No Motion)

If the project doesn't use Motion (Framer Motion), keep both icons in the DOM and cross-fade them with CSS transitions. Because neither icon unmounts, both enter and exit animate smoothly.

The trick: one icon is absolutely positioned on top of the other. Toggling state cross-fades them - the entering icon scales up from `0.25` while the exiting icon scales down to `0.25`, both with opacity and blur.

```tsx
function IconButton({ isActive, ActiveIcon, InactiveIcon }) {
  return (
    <button>
      <div className="relative">
        <div
          className={cn(
            "absolute inset-0 flex items-center justify-center",
            "transition-[opacity,filter,scale] duration-300",
            "cubic-bezier(0.2, 0, 0, 1)",
            isActive
              ? "scale-100 opacity-100 blur-0"
              : "scale-[0.25] opacity-0 blur-[4px]"
          )}
        >
          <ActiveIcon />
        </div>
        <div
          className={cn(
            "transition-[opacity,filter,scale] duration-300",
            "cubic-bezier(0.2, 0, 0, 1)",
            isActive
              ? "scale-[0.25] opacity-0 blur-[4px]"
              : "scale-100 opacity-100 blur-0"
          )}
        >
          <InactiveIcon />
        </div>
      </div>
    </button>
  );
}
```

The non-absolute icon (InactiveIcon) defines the layout size. The absolute icon (ActiveIcon) overlays it without affecting flow.

#### Choosing Between Motion and CSS

| | Motion (Framer Motion) | CSS transitions (both icons in DOM) |
| --- | --- | --- |
| **Enter animation** | Yes | Yes |
| **Exit animation** | Yes (via `AnimatePresence`) | Yes (cross-fade - icon never unmounts) |
| **Spring physics** | Yes | No - use `cubic-bezier(0.2, 0, 0, 1)` as approximation |
| **When to use** | Project already uses `motion/react` | No motion dependency, or keeping bundle small |

**Rule:** Check the project's `package.json` for `motion` or `framer-motion`. If present, use the Motion approach. If not, use the CSS cross-fade pattern - don't add a dependency just for icon transitions.

#### When to Animate Icons

| Animate | Don't animate |
| --- | --- |
| Icons that appear on hover (action buttons) | Static navigation icons |
| State change icons (play -> pause, like -> liked) | Decorative icons |
| Icons in contextual toolbars | Icons that are always visible |
| Loading/success state indicators | Icon labels (text next to icon) |

**Important:** Always use exactly these values for contextual icon animations - do not deviate:
- `scale`: `0.25` -> `1` (never use `0.5` or `0.6`)
- `opacity`: `0` -> `1`
- `filter`: `"blur(4px)"` -> `"blur(0px)"`
- `transition`: `{ type: "spring", duration: 0.3, bounce: 0 }` - **bounce must always be `0`**, never `0.1` or any other value

### Scale on Press

A subtle scale-down on click gives buttons tactile feedback. Always use `scale(0.96)`. Never use a value smaller than `0.95` - anything below feels exaggerated. Use CSS transitions for interruptibility - if the user releases mid-press, it should smoothly return.

Not every button needs this. Add a `static` prop to your button component that disables the scale effect when the motion would be distracting.

#### CSS Example

```css
.button {
  transition-property: scale;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.button:active {
  scale: 0.96;
}
```

#### Tailwind Example

```tsx
<button className="transition-transform duration-150 ease-out active:scale-[0.96]">
  Click me
</button>
```

#### Motion Example

```tsx
<motion.button whileTap={{ scale: 0.96 }}>
  Click me
</motion.button>
```

#### Static Prop Pattern

Extract the scale class into a variable and conditionally apply it based on a `static` prop:

```tsx
const tapScale = "active:not-disabled:scale-[0.96]";

function Button({ static: isStatic, className, children, ...props }) {
  return (
    <button
      className={cn(
        "transition-transform duration-150 ease-out",
        !isStatic && tapScale,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Usage
<Button>Click me</Button>           {/* scales on press */}
<Button static>Submit</Button>       {/* no scale */}
```

### Skip Animation on Page Load

Use `initial={false}` on `AnimatePresence` to prevent enter animations from firing on first render. Elements that are already in their default state shouldn't animate in on page load - only on subsequent state changes.

#### When It Works

```tsx
// Good - icon doesn't animate in on mount, only on state change
<AnimatePresence initial={false} mode="popLayout">
  <motion.span
    key={isActive ? "active" : "inactive"}
    initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
    exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
  >
    <Icon />
  </motion.span>
</AnimatePresence>
```

Works well for: icon swaps, toggles, tabs, segmented controls - anything that has a default state on page load.

#### When It Breaks

Don't use `initial={false}` when the component relies on its `initial` prop to set up a first-time enter animation, like a staggered page hero or a loading state. In those cases, removing the initial animation skips the entire entrance.

```tsx
// Bad - initial={false} would skip the staggered page enter entirely
<AnimatePresence initial={false}>
  <motion.div initial="hidden" animate="visible" variants={...}>
    ...
  </motion.div>
</AnimatePresence>
```

Verify the component still looks right on a full page refresh before applying this.

---

## Extension - operational specificity

### Interruptible animations - extension

**The mental model.** A CSS transition is "go to here from wherever I currently am." A keyframe animation is "play this script start to finish." If the user can re-trigger or reverse the animation mid-flight, the transition retargets smoothly. The keyframe restarts or fights itself.

**Operational decision tree:**

| If the animation runs... | Use |
| --- | --- |
| When user toggles, hovers, opens, closes, drags | CSS transition |
| On state change that the user can re-trigger | CSS transition |
| Once per page load (enter), once per event (toast pop), looped (spinner) | CSS keyframe |
| As a one-shot reveal that won't be re-triggered | CSS keyframe |

**Where the rule applies:**

- Drawer open/close - transition.
- Accordion expand/collapse - transition.
- Dropdown reveal - transition.
- Hover lift - transition.
- Tab switch (indicator slide) - transition.
- Modal scrim fade - transition.
- Page enter / hero stagger - keyframe.
- Loading spinner - keyframe (looped).
- Skeleton shimmer - keyframe (looped).
- Success checkmark draw-in - keyframe.
- Toast pop - keyframe.

**Why keyframes break interruptibility.** A keyframe runs on a fixed timeline. When you re-add the class mid-flight, the browser restarts the animation from `0%`. The visible effect: the element snaps back, then plays again. Users experience this as "jank."

**Duration calibration for interruptible state changes:**

| UI scale | Duration | Notes |
| --- | --- | --- |
| Small UI (toggles, switches, hover, color swap) | 100-150ms | Faster than user perception of "wait" |
| Medium UI (dropdowns, drawers opening) | 200-250ms | Long enough to read direction |
| Large UI (modals, full-page reveals) | 250-300ms | Heavier elements demand longer enters |
| Anything above 300ms | Don't | User starts feeling wait |

**Easing for transitions.** `ease-out` (deceleration into target) for enters, hovers, opens. `ease-in` (acceleration away) for exits. `ease-in-out` reads as "robotic" - avoid.

### Split and stagger enter - extension

**The 100ms inter-chunk rule explained.** Below 60ms, the chunks blur into a single event - the stagger is wasted. Above 150ms, the chunks feel disconnected, like distinct events. 100ms is the perceptual sweet spot where each chunk reads as "next" without "wait."

**Granularity.** Split at semantic boundaries:

- Page hero: title -> description -> CTAs.
- Modal: header -> body -> footer.
- Card grid: each card (not each card's contents).
- Form section: heading -> fields -> submit.

**Do not split:**

- Within a sentence (word-by-word stagger is for headlines only, see below).
- Within a single visual block (one card, one button, one input).
- A small UI element with no perceptual sections.

**Per-word stagger for headlines.** Use ~80ms per word for hero/marketing headlines. Apply only on:
- Landing page heros
- Splash screens
- Marketing pages
- Splash modals (onboarding first screen)

Do NOT apply per-word stagger on:
- Product UI (dashboard, settings, profile pages)
- Modal titles in workflow
- Toast messages
- In-context labels

Per-word stagger in product chrome reads as theatrical and slow.

**The exact enter composition (canonical):**

| Property | From | To | Notes |
| --- | --- | --- | --- |
| `opacity` | 0 | 1 | Always |
| `translateY` | 12px | 0 | Downward arrival reads as "settling in" |
| `filter` | `blur(4px)` | `blur(0)` | "Coming into focus" |

The blur is what differentiates a polished enter from a generic fade. Skip it and the enter reads as "ordinary slide-in."

**Duration per chunk:**

- 400ms: luxurious, marketing-grade. Use for hero and splash.
- 300ms: brisk, product-grade. Use for in-app modals, page enters.
- 250ms: efficient. Use for densely-staggered lists (>4 items).

**Easing:** `ease-out` always. Never `ease-in` for enters.

**CSS-only stagger pattern.** When Motion isn't available, use `nth-child` delays:

```css
.stagger-item { animation: fadeInUp 400ms ease-out forwards; opacity: 0; }
.stagger-item:nth-child(1) { animation-delay: 0ms; }
.stagger-item:nth-child(2) { animation-delay: 100ms; }
.stagger-item:nth-child(3) { animation-delay: 200ms; }
.stagger-item:nth-child(4) { animation-delay: 300ms; }
```

Note: this is a CSS keyframe, which means it's NOT interruptible. That's fine for one-shot enters - the user can't interrupt the page mounting.

### Exit animations - extension

**Magnitude.** `-12px` translateY for subtle exits. Never the full container height - that reads as "the system rejected this."

**Duration.** 150ms exit vs 300ms enter. Exits should be roughly half the enter.

**Easing.** `ease-in` on exits. The element accelerates away. This is one of the few times `ease-in` is the right choice - the element is leaving the user's attention, so accelerating out matches the intent.

**Direction.** Exit in the direction the element came from, or upward (`y: -12`) for content fading out of view. Never sideways unless the element is a slot in a horizontal list (e.g., a removed item from a horizontal carousel).

**Subtle vs full exit decision:**

| Use subtle exit (small translateY) | Use full exit (slide off-screen) |
| --- | --- |
| Toast dismissal | Drawer closing |
| Modal close | Sheet closing (mobile) |
| Dropdown close | Card returning to source location |
| Tooltip hide | Carousel item exiting frame |
| Snackbar fade | Page transition out |

**Never `display: none` without an exit.** The pop-out break in continuity reads as a bug. Even a 100ms opacity fade is better than nothing.

**Combine opacity + translate + blur on subtle exits** to match the enter composition. This makes the exit feel like "a reverse" of the enter (visually consistent), even though the magnitudes differ.

### Icon animations - extension

The canonical values for state-change icon animations are non-negotiable:

| Property | From | To | Why this value |
| --- | --- | --- | --- |
| `scale` | 0.25 | 1 | Smaller starting scale exaggerates "materializing"; 0.5/0.6 reads as generic pop-in |
| `opacity` | 0 | 1 | Always |
| `filter` | `blur(4px)` | `blur(0)` | "Focus pull" effect from camera optics; 4px is enough at 16-24px icon sizes |
| `transition` | spring, 300ms, bounce: 0 | | Spring physics without overshoot |

**Why `bounce: 0`.** Framer Motion's default bounce produces overshoot - the icon scales past 1 and settles back. Overshoot on icons reads as glitchy or excessively playful in product chrome. Set bounce to 0 explicitly; the spring becomes a damped interpolation without overshoot.

**Why 300ms duration.** Below 200ms, the blur effect disappears (the eye can't perceive the focus pull). Above 400ms, the icon feels sluggish. 300ms is the sweet spot for the "materializing" effect.

**CSS cross-fade fallback (two-icon DOM technique).** When no motion library is installed, mount both icons. One is absolute-positioned (the entering state). The exiting icon scales down to 0.25 while the entering icon scales up from 0.25. Both have opacity 0/1 and blur 4px/0.

The non-absolute icon defines the layout size. The absolute icon overlays without affecting flow.

```tsx
<div className="relative">
  <div className={cn(
    "absolute inset-0 flex items-center justify-center",
    "transition-[opacity,filter,scale] duration-300",
    isActive ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]"
  )}>
    <ActiveIcon />
  </div>
  <div className={cn(
    "transition-[opacity,filter,scale] duration-300",
    isActive ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0"
  )}>
    <InactiveIcon />
  </div>
</div>
```

Use `cubic-bezier(0.2, 0, 0, 1)` as the timing function for CSS (approximates spring-without-overshoot).

**When to animate icons:**

| Animate | Don't animate |
| --- | --- |
| Hover-revealed action icons | Static navigation icons |
| State-change icons (play <-> pause, like <-> liked, follow <-> following) | Decorative icons |
| Toolbar contextual icons | Always-visible icons |
| Loading/success state icons | Icon labels (text adjacent to icon) |

**Decision rule.** Check `package.json` for `motion` or `framer-motion`. If present, use Motion. If not, use CSS cross-fade. Do NOT add Motion as a dependency just for icon transitions.

### Scale on press - extension

**The value.** `scale(0.96)` always. The 0.95 floor is the perceptual just-noticeable-difference (JND) for transform-scale on small UI:

- Below 0.95 (>5% scale): the press becomes overtly visible - the button "shrinks" in a way users register as drama.
- 0.95-0.96 (4-5%): the press is subliminally felt. The user knows the button responded; they shouldn't be surprised by how much.
- Above 0.97 (<3%): the press is invisible. The user can't tell the button registered.

**Which elements get scale-on-press:**

- `<button>` (all variants: primary, secondary, ghost, icon)
- `<a role="button">` (links styled as buttons)
- Icon buttons (close, dismiss, action)
- Action chips
- Segmented control segments
- Tap-able cards with `cursor: pointer` (intentional cardiness)
- Tap-able list items in a touch UI

**Which elements do NOT get scale-on-press:**

- Plain `<a>` text links (the underline/color change is the feedback)
- Form inputs (`<input>`, `<textarea>`, `<select>`) - they have their own native press feedback
- Navigation tabs (the underline/background change is the feedback)
- Disabled buttons
- Drag handles (the drag IS the feedback)
- Checkboxes, radios (the check is the feedback)

**Exact CSS transition property.**

```css
.button {
  transition: transform 100ms cubic-bezier(0.2, 0, 0, 1);
}
.button:active {
  scale: 0.96;
}
```

The source uses 150ms ease-out; 100ms with the spring-approximation curve feels slightly more responsive. Both are acceptable.

**Static prop pattern.** A `static` prop disables scale-on-press where the motion is distracting:

```tsx
const tapScale = "active:not-disabled:scale-[0.96]";

function Button({ static: isStatic, className, ...props }) {
  return (
    <button
      className={cn(
        "transition-transform duration-150 ease-out",
        !isStatic && tapScale,
        className,
      )}
      {...props}
    />
  );
}
```

Use cases for `static`:
- A button inside a draggable element (the drag affordance shouldn't conflict)
- A button in a tight loop of microinteractions (e.g., increment/decrement steppers)
- A button that's already animating (avoid stacked transforms)

**`not-disabled` qualifier.** `active:not-disabled:scale-[0.96]` so disabled buttons don't visually respond to clicks.

**Why CSS transition (not keyframe).** Press is interruptible - the user can release mid-press, swipe off, etc. The transition smoothly returns to scale(1) when `:active` is released. A keyframe would restart and look glitchy.

### Skip animation on page load - extension

**`initial={false}` on `AnimatePresence`** prevents the first-render enter animation. The element appears in its `animate` state instantly.

**Apply to:**

- Icon swaps (the icon shouldn't pop-in on every page load)
- Toggles (the toggle's current state is the page's current state)
- Segmented controls (the selected segment is just there)
- Tabs (the active tab is just there)
- Accordion-default-open panels

**Do NOT apply to:**

- Page heros (the entrance IS the animation)
- Staggered marketing reveals
- Splash screens
- Loading-to-loaded transitions (the "loaded" state needs the enter animation)
- First-time onboarding modals

**Failure modes:**

- Missing `initial={false}` on icon swap = the icon plays its enter animation on every page load. Page feels jumpy.
- Applied `initial={false}` to a staggered hero = the hero text snaps in fully formed, skipping the intentional reveal. Marketing feels broken.

**Verification.** Full page refresh on the route. Watch:
- `initial={false}` correct: element appears smoothly, no pop.
- `initial={false}` missing on a toggle: element pops in.
- `initial={false}` mis-applied to a hero: hero snaps in fully formed.

---

## What's missing - animation gaps in MIFB

The animations section covers interruptibility, enter/exit, icon animations, scale-on-press, and skip-on-load. Notable gaps:

1. **`prefers-reduced-motion`.** The single largest gap. None of the animation principles have a reduced-motion variant. WCAG 2.1 AA requires honoring `prefers-reduced-motion: reduce`. Every transition/keyframe should be wrapped in a `@media (prefers-reduced-motion: no-preference) { ... }` block or programmatically conditional in motion libraries.

2. **Motion library guidance beyond Framer Motion.** The skill assumes Motion (Framer Motion). No mention of GSAP, Anime.js, React Spring, Lottie, Rive, native Web Animations API. The motion-reference skill in sidecoach fills this; MIFB does not.

3. **Scroll-driven animations.** No coverage of ScrollTrigger patterns, parallax, scroll-snap, scroll-linked animations (`animation-timeline: scroll()`), intersection-observer triggers.

4. **Page transitions.** No coverage of full-page transition patterns (View Transitions API, framework-specific patterns like Next.js, Astro, Remix).

5. **List reorder animations.** No FLIP technique coverage (First-Last-Invert-Play). Drag-to-reorder list animations are silent in MIFB.

6. **Spring physics tuning beyond `bounce: 0`.** No coverage of stiffness, damping, mass, restDelta, or when to use a physics simulation vs a fixed-duration tween.

7. **Sequential timeline construction.** No coverage of how to chain animations across multiple elements (e.g., animate A, then on completion animate B). Framer Motion's `useAnimate` and `sequence` APIs are silent.

8. **Spatial continuity (shared element transitions).** No coverage of "an element appears in one place and continues from there to another" - the visual handoff pattern (View Transitions API, Magic Move).

9. **Drag and gesture animations.** No coverage of `whileDrag`, `dragConstraints`, momentum scrolling, snap-to-grid, gesture-driven motion.

10. **Easing curve glossary.** No catalog of named easings (ease-in-quad, ease-out-cubic, ease-in-out-circ, etc.) and when to use each. Only `ease-out`, `ease-in`, and one cubic-bezier are mentioned.

11. **Loading state animations.** Spinners and skeletons are mentioned in passing but no concrete patterns - which spinner geometry to use, what duration, when to switch from spinner to skeleton.

12. **Error/success feedback animations.** No coverage of success checkmark draw-in patterns, error shake, validation feedback timing.

13. **Hover lift specifics.** Mentioned in the shadow rule, but no specific lift transform values, lift duration, lift origin (top vs center), lift combined with shadow opacity.

14. **Microinteraction patterns.** No coverage of like-button heart burst, copy-button checkmark, follow-button morph, retweet rotation - the "small delight" patterns that compound into brand feel.

15. **Performance budgets.** No guidance on animation frame budgets (60fps = 16.67ms/frame, 120fps = 8.33ms/frame), on counting concurrent animations, on when to fall back to simpler animations on low-end devices.

16. **3D and z-axis transforms.** No coverage of `perspective`, `rotateX/Y/Z`, `translateZ`, when to use 3D for depth, when to avoid.

17. **Color transitions.** No coverage of color interpolation gotchas (HSL vs RGB vs LCH transitions), gradient transitions, accent color theme switching.

Sidecoach should layer these via `motion-reference` (GSAP/Lenis, scroll-driven, FLIP, spring tuning), the 159-rule extended-domain validator (reduced-motion enforcement, frame budget), and the design-references catalog for microinteraction patterns.
