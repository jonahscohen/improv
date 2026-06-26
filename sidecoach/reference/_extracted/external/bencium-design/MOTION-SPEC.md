---
source: https://github.com/bencium/bencium-claude-code-design-skill/blob/main/bencium-controlled-ux-designer/skills/bencium-controlled-ux-designer/MOTION-SPEC.md
captured: 2026-05-25
type: external-taste-skill (motion specification)
---

# Bencium - Motion Specification (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### Easing Curves (exact bezier values)

**Ease-out (Entrances)** - `cubic-bezier(0.0, 0.0, 0.2, 1)` - Elements entering view, expanding, appearing
**Ease-in (Exits)** - `cubic-bezier(0.4, 0.0, 1, 1)` - Elements leaving view, collapsing, disappearing
**Ease-in-out (Transitions)** - `cubic-bezier(0.4, 0.0, 0.2, 1)` - State changes, transformations, element swaps
**Linear (Continuous)** - `linear` - Loading spinners, continuous animations, marquee scrolls
**Spring (Bouncy)** - `cubic-bezier(0.68, -0.55, 0.265, 1.55)` - Playful interactions, game-like UIs, attention-grabbing
**Sharp (Quick snap)** - `cubic-bezier(0.4, 0.0, 0.6, 1)` - Mechanical interactions, precise movements

### Duration Table by Interaction Type (CRITICAL TABLE)

| Interaction | Duration | Easing | Example |
|-------------|----------|--------|---------|
| Button press | 100ms | ease-out | Background color change |
| Hover state | 150ms | ease-out | Underline appearing |
| Checkbox toggle | 150ms | ease-out | Checkmark animation |
| Tooltip appear | 200ms | ease-out | Tooltip fade in |
| Tab switch | 250ms | ease-in-out | Content swap |
| Accordion expand | 300ms | ease-out | Height animation |
| Modal open | 300ms | ease-out | Fade + scale up |
| Modal close | 250ms | ease-in | Fade + scale down |
| Page transition | 400ms | ease-in-out | Route change |
| Sheet slide-in | 300ms | ease-out | Bottom sheet |
| Toast notification | 300ms | ease-out | Slide in from top |

### Duration by Element Weight

| Element Weight | Duration | Example |
|----------------|----------|---------|
| Lightweight (< 100px) | 150ms | Icons, badges, chips |
| Standard (100-500px) | 300ms | Cards, panels, list items |
| Weighty (> 500px) | 500ms | Modals, full-page transitions |

### State Animations (verbatim implementations)

**Button Press (Framer Motion):**
```tsx
<motion.button
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.1, ease: "easeIn" }}
>
```

**Loading Spinner:**
```css
@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spinner { animation: spin 1s linear infinite; }
```

**Skeleton Loader:**
```css
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
.animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
```

**Shake Animation (Error):**
```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-4px); }
  40%, 80% { transform: translateX(4px); }
}
.shake { animation: shake 0.3s ease-in-out; }
```

**Modal Scale + Fade:**
```tsx
<motion.div
  initial={{ opacity: 0, scale: 0.95 }}
  animate={{ opacity: 1, scale: 1 }}
  exit={{ opacity: 0, scale: 0.95 }}
  transition={{ duration: 0.3, ease: "easeOut" }}
>
```

**Stagger Children (Framer Motion):**
```tsx
<motion.ul
  initial="hidden"
  animate="visible"
  variants={{
    visible: { transition: { staggerChildren: 0.1 } }
  }}
>
```

### Performance Checklist

- [ ] Only animate `transform` and `opacity`
- [ ] Avoid animating `width`, `height`, `top`, `left`, `margin`, `padding`
- [ ] Test on mobile devices (target 60fps)
- [ ] Use `will-change` only for complex animations
- [ ] Implement `prefers-reduced-motion` media query
- [ ] Keep animation duration under 500ms for UI interactions
- [ ] Use CSS animations for simple transitions (better performance)
- [ ] Use JS animation libraries for complex, choreographed sequences

### Accessibility (prefers-reduced-motion)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
import { useReducedMotion } from 'framer-motion';

function MyComponent() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      transition={{ duration: shouldReduceMotion ? 0.01 : 0.3, ease: "easeOut" }}
    />
  );
}
```

### Animation & Gestalt Principles

- **Proximity:** Animated elements that are near each other should move together to reinforce grouping
- **Similarity:** Similar elements should have similar animation characteristics
- **Continuity:** Movement should follow natural, smooth paths
- **Figure-Ground:** Important elements animate while backgrounds stay stable

---

## SECTION 2: EXTENSION

### Bencium vs Emil easing comparison

Bencium ease-out: `cubic-bezier(0.0, 0.0, 0.2, 1)` (Material Design Standard)
Emil ease-out: `cubic-bezier(0.23, 1, 0.32, 1)` (custom strong)

Emil's is stronger because the first control point has Y=1 (immediate overshoot). Bencium's is the Material Design v2 default - softer, more conservative. Use Bencium's for general product UI; use Emil's for animations that should feel snappy/premium.

Bencium ease-in-out: `cubic-bezier(0.4, 0.0, 0.2, 1)` (Material Design)
Emil ease-in-out: `cubic-bezier(0.77, 0, 0.175, 1)` (custom aggressive)

Same pattern: Bencium = Material default; Emil = aggressive S-curve.

The choice matters for brand personality:
- Bencium (Material) easings = "this is a polished product"
- Emil easings = "this is a premium tool, every animation has confidence"

### Duration table vs Emil's table

Bencium provides duration by INTERACTION TYPE. Emil provides by ELEMENT CATEGORY. They overlap but Bencium is more granular (Checkbox toggle, Tab switch, Toast notification are all distinct).

Composite "best of both" duration table:

| Surface | Bencium | Emil | Recommended |
|---|---|---|---|
| Button press | 100ms | 100-160ms | **100ms** |
| Hover state | 150ms | - | **150ms** |
| Tooltip | 200ms | 125-200ms | **150-200ms** |
| Dropdown | - | 150-250ms | **200ms** |
| Tab switch | 250ms | - | **250ms** |
| Accordion | 300ms | - | **300ms** |
| Modal open | 300ms | 200-500ms | **300ms** |
| Modal close | 250ms | (asymmetric) | **200ms** (exit faster than enter) |
| Page transition | 400ms | - | **400ms** |
| Toast | 300ms | - | **300ms** |

### Shake error pattern - the WHY

The shake values (20%, 60% to -4px; 40%, 80% to +4px) over 0.3s are deliberate:
- 0.3s is fast enough to NOT look like a glitch but slow enough to register.
- The 4px amplitude is enough to be visible on mobile (1.5-2mm) but not jarring.
- The asymmetric keyframe distribution (20%/40%/60%/80%) creates an irregular shake that feels natural rather than mechanical.

A "clean" symmetric shake (25%/50%/75%/100%) actually looks WORSE because it's too regular.

---

## SECTION 3: What this covers that oracle + make-interfaces-feel-better don't

1. **The interaction-type duration table.** Make-interfaces-feel-better doesn't have a "Button press = 100ms, Hover = 150ms, Tab switch = 250ms" lookup. Bencium provides this as a cheat sheet.

2. **The 6 named easings with bezier values** (ease-out, ease-in, ease-in-out, linear, spring, sharp). Complementary to Emil's three; together they cover Material Design defaults AND aggressive custom curves.

3. **The shake error animation pattern** (specific keyframes, 0.3s duration, 4px amplitude). A reusable pattern for form validation feedback.

4. **The element-weight duration tier** (Lightweight <100px = 150ms, Standard 100-500px = 300ms, Weighty >500px = 500ms). A specific heuristic for matching duration to physical size.

5. **The Gestalt-applied-to-motion principles** (Proximity, Similarity, Continuity, Figure-Ground). Sidecoach motion handler doesn't have this layer.

6. **The Framer Motion useReducedMotion hook usage** as a complete pattern.
