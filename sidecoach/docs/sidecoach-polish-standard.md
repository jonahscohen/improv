# Sidecoach Polish Standard (v2.2)

**Foundation:** 14-point tactical baseline (extracted from industry standard 2025)

**Sidecoach Enhancement:** +8 proprietary rules = 22-point comprehensive framework

**Authority:** Original proprietary research, Sidecoach Design Systems Inc.

---

## Part 1: 14-Point Tactical Baseline

The fourteen foundational polish rules that define production-quality UI interactions and visual refinement.

### 1. Scale on Press
**Rule:** Interactive elements scale down on press state to indicate activation and mechanical feedback.

- Desktop: `scale(0.96)` via `:active` pseudo-state
- Touch: `scale(0.96)` via active touch event
- Duration: 50-80ms (snappy, not sluggish)
- Easing: ease-out
- Recovery: `scale(1.0)` on pointer release (spring-like)

**Rationale:** Provides tactile feedback without vibration. Optical feedback that reduces perceived latency.

---

### 2. Concentric Border Radius
**Rule:** Inner and outer border radius maintain proportional relationship via padding rule.

- Formula: `outer_radius = inner_radius + padding`
- Example: Inner button radius 6px + 8px padding = outer container 14px
- Applies to: Card containers, modals, input wrappers, button groups
- Exception: When explicit design system token specifies otherwise

**Rationale:** Creates visual continuity and avoids radius conflicts. Maintains rhythm across nested components.

---

### 3. Icon Swap via Opacity + Scale + Blur
**Rule:** Icon state transitions use compound animation instead of direct replacement.

- Initial state (icon A): `opacity 1, scale 1, blur 0`
- Exit state: `opacity 0, scale 0.25, blur 4px` (simultaneous)
- Enter state (icon B): `opacity 0, scale 0.25, blur 4px` to `opacity 1, scale 1, blur 0`
- Duration: 200ms per transition
- Easing: ease-out-cubic

**Rationale:** Icon replacement feels organic rather than jarring. Scale and blur together suggest motion depth.

---

### 4. Image Outlines via Neutral Transparency
**Rule:** Placeholder and error image outlines use `rgba(0,0,0,0.1)` - never tinted, never colored.

- Outline width: 1px (accessible, not prominent)
- Color: `rgba(0,0,0,0.1)` on light backgrounds, `rgba(255,255,255,0.1)` on dark
- Use cases: Missing image placeholders, broken image indicators, image gallery frames
- Justification: Neutral outline works on any background color palette

**Rationale:** Maintains design consistency across color contexts. Black plus transparent is visually neutral and accessible.

---

### 5. Minimum Hit Area (40x40px)
**Rule:** All interactive elements have minimum touch target of 40x40 pixels (WCAG AAA standard).

- Desktop: 44x44px recommended (larger margin for mouse users)
- Touch: 40x40px minimum
- Padding rule: `padding: 8px 12px` for small buttons, `padding: 12px 16px` for medium
- Exception: Standalone icon buttons without text (increase padding to meet 44x44)

**Rationale:** Accessibility requirement. Reduces misclick errors on touch devices. Desktop users benefit from larger hover targets.

---

### 6. No `transition: all`
**Rule:** Explicit property transitions instead of catch-all `transition: all`.

- Forbidden: `transition: all 200ms ease-out`
- Preferred: `transition: background-color 200ms ease-out, color 200ms ease-out`
- Per-property timing: Stagger properties that move (slower) vs. color changes (faster)
- Performance: Prevents animating properties that shouldn't (e.g., margin-left during layout shift)

**Rationale:** Performance. Prevents unintended animation side effects. Fine-grained control over timing per property.

---

### 7. Tabular Numbers on Dynamic Data
**Rule:** Numeric fields that change dynamically use `font-variant-numeric: tabular-nums`.

- Use cases: Counters, prices, timers, metrics, quantities, payment forms
- CSS: `font-variant-numeric: tabular-nums` on `<span>` or input element
- Fallback: Works on all modern browsers; no-op on legacy
- Pairing: Often combined with monospace fonts for financial data

**Rationale:** Prevents number width changes that cause layout reflow. Numbers stay aligned as they update.

---

### 8. Text Wrap Balance on Headings
**Rule:** Headings and display text use `text-wrap: balance` for even line breaks.

- Applied to: `<h1>`, `<h2>`, `<h3>`, display-size text (36px+)
- CSS: `text-wrap: balance`
- Exceptions: Very long headings (>100 chars) where balance costs readability
- Browser support: Supported in modern browsers (2024+); graceful fallback to normal wrapping

**Rationale:** Prevents orphaned words or awkward line breaks. Creates optical balance in heading hierarchy.

---

### 9. Staggered Enter Animations (Split/Sequential)
**Rule:** Multiple elements entering simultaneously use stagger delay for visual rhythm.

- Stagger base (restrained): 30ms per element
- Stagger base (playful): 50ms per element
- Stagger base (ambitious): 80ms per element
- Max total animation: 200-300ms (no more than 5-6 elements)
- Direction: Top-to-bottom or left-to-right (logical reading order)

**Rationale:** Sequential entry creates perceived speed and intentionality. Prevents visual overload of simultaneous animations.

---

### 10. Subtle Exit Animations (Fade/Scale Down)
**Rule:** Exiting elements fade and scale down to suggest removal (not erase).

- Pattern: `opacity 1 to 0` and `scale 1 to 0.8` (simultaneous)
- Duration: 150ms (faster than enter)
- Easing: ease-in-cubic (accelerating exit)
- Justification: Asymmetry (slower enter, faster exit) feels natural

**Rationale:** Exit animations create continuity and acknowledge element removal. Fast exit prevents lingering distraction.

---

### 11. Font Smoothing and Anti-aliasing
**Rule:** Text rendering optimized for platform using `-webkit-font-smoothing` and `text-rendering`.

- Desktop: `-webkit-font-smoothing: antialiased` for sharp, thin text
- Fallback: `text-rendering: optimizeLegibility` for browser-native rendering
- Mobile: `-webkit-font-smoothing: subpixel-antialiased` (natural mobile rendering)
- Caveat: `-webkit-font-smoothing: antialiased` can make thin fonts harder to read on some displays; test per font

**Rationale:** Platform-appropriate rendering. Thin weights (300, 400) benefit from antialiasing; bolder weights (600+) less so.

---

### 12. Initial State Constraint in AnimatePresence (Framer Motion)
**Rule:** All AnimatePresence children must set `initial={false}` to prevent exit animations on first load.

- Pattern: `<motion.div initial={false} animate={{ ... }} exit={{ ... }} />`
- Justification: Without `initial={false}`, exit animations play on mount (unwanted)
- Framework: Framer Motion 10+ convention

**Rationale:** Prevents phantom animations on page load. Exit animations only trigger on actual removal.

---

### 13. Sparse `will-change` Declaration
**Rule:** Use `will-change` selectively for animated properties (not prophylactically).

- Forbidden: `will-change: all` or `will-change: transform, opacity` on every interactive element
- Correct: `will-change: transform` only on elements with known animations (e.g., hover scale, position change)
- Caveat: Overuse of `will-change` creates memory overhead and GPU thrashing
- Test: Measure performance impact via Chrome DevTools Performance tab

**Rationale:** GPU optimization for known animations only. Prevents layer explosion from over-declaration.

---

### 14. Shadows Over Borders for Depth
**Rule:** Use box-shadow for elevation and depth; reserve borders for structural definition.

- Elevation pattern: `box-shadow: 0 1px 3px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)` (shallow), escalate for greater depth
- Borders: Use for input fields, cards with structural importance (not elevation)
- Justification: Shadows suggest floating/layering; borders suggest boundaries
- Hierarchy: Shadow opacity increases with elevation (1px, 4px, 8px offset ranges)

**Rationale:** Visual clarity. Shadows create perception of floating layers. Borders define structure. Mixing improves visual hierarchy.

---

## Part 2: 8 Proprietary Sidecoach Extensions

Eight additional rules that extend the baseline into comprehensive, opinionated polish framework. These are original Sidecoach Research.

### 15. Optical Alignment (Baseline Correction)
**Rule:** Optical alignment corrects visual imbalance caused by letter shapes, not mathematical alignment.

- Icon to text: Optical center of icon aligns with cap height of text (not mathematical baseline)
- Justified text: Add `letter-spacing: 0.02em` to prevent visual rivers and holes
- Descender allowance: Subtract 2-4px from top padding on inputs with labels (descenders like 'g', 'y', 'p' create illusion of bottom-heavy alignment)
- Circular elements: Place 2-3px higher than square elements of same size (optical illusion of vertical centering)

**Rationale:** Human perception is not mathematical. Optical balance creates professional polish. Eye reads shapes, not coordinates.

---

### 16. Typography Rhythm (Modular Scale + Breathing)
**Rule:** Paragraph spacing, line height, and font size form a coherent vertical rhythm.

- Line height multiplier: `1.6` for body text, `1.2` for headings, `1.0` for display
- Paragraph spacing: Set to `line-height * font-size` (e.g., 24px font at 1.6 LH = 38.4px paragraph gap)
- Scale progression: Use Major Third (1.25) or Perfect Fourth (1.33) for heading sizes
- Breathing room: Never compress headings directly above body copy (add 20% extra margin below heading)

**Rationale:** Predictable rhythm feels intentional. Readers can focus on content, not scanning disparate spacing values.

---

### 17. Shadow Hierarchy (Elevation Levels)
**Rule:** Shadow opacity, blur, and offset scale with elevation level (0-5).

- Level 0 (flat): No shadow
- Level 1 (card): `0 1px 2px rgba(0,0,0,0.05)`
- Level 2 (dropdown): `0 4px 6px rgba(0,0,0,0.1)`
- Level 3 (modal backdrop): `0 10px 25px rgba(0,0,0,0.2)`
- Level 4 (notification): `0 20px 40px rgba(0,0,0,0.3)`
- Level 5 (full-screen overlay): `0 40px 80px rgba(0,0,0,0.4)`

**Rationale:** Consistent shadow vocabulary creates visual hierarchy. Users intuitively understand depth via shadow scale.

---

### 18. Focus Visible (Keyboard Navigation)
**Rule:** Focus states are visible, high-contrast, and keyboard-accessible via `:focus-visible` (not `:focus`).

- CSS: `:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }`
- Color: Use accent color or invert background for high contrast
- Outline offset: 2px minimum (prevents clipping on rounded corners)
- Justification: `:focus-visible` shows keyboard focus only (not mouse focus), reducing visual clutter

**Rationale:** Accessibility requirement (WCAG 2.1). Keyboard users need clear focus indicator. Mouse users don't see distracting focus ring.

---

### 19. Reduced Motion Respect (@prefers-reduced-motion)
**Rule:** Animations disable completely for users with motion sensitivity (not "duration: 0").

- CSS: `@media (prefers-reduced-motion: reduce) { * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }`
- Caveat: This is a nuclear option; better practice is selective removal:
  ```css
  @media (prefers-reduced-motion: reduce) {
    .fade-in { animation: none; }
    .slide-up { animation: none; }
  }
  ```
- Testing: Test with `prefers-reduced-motion: reduce` in browser DevTools

**Rationale:** Ethical requirement. Vestibular disorders can cause vertigo from animations. Respecting this setting is non-negotiable.

---

### 20. Color Contrast Verification (WCAG AA/AAA)
**Rule:** All text-to-background and interactive-element combinations meet WCAG AA (4.5:1 for text) or AAA (7:1) contrast.

- Tools: Use WebAIM contrast checker, axe DevTools, Figma accessibility plugin
- Minimum: 4.5:1 for small text (<18px), 3:1 for large text (18px+)
- AAA target: 7:1 for small text, 4.5:1 for large text
- Caveat: Gradients over images are hard to measure; test with actual overlays in-browser

**Rationale:** Accessibility plus readability. Even users without vision impairments benefit from higher contrast (outdoor readability, eye strain reduction).

---

### 21. Component State Completeness (8-State Validation)
**Rule:** Every interactive component has 8 defined states with explicit styling.

- States: default, hover, focus, active (press), disabled, loading, error, success
- Disabled state: Opacity 50-60%, cursor: not-allowed, no hover effect
- Loading state: Spinner or skeleton, disabled interactions, brief delay (100ms+) to prevent flashing
- Error state: Red/orange border, error icon, error message below, aria-invalid="true"
- Success state: Green checkmark, brief duration (3-5s), auto-dismiss
- Completeness check: Verify all 8 states in browser before shipping

**Rationale:** Incomplete state coverage creates user confusion. Users don't know what's interactive or why something stopped responding.

---

### 22. Anti-Pattern Flagging (AI Slop Detection in UI)
**Rule:** Detect and reject generic/default design patterns (genericityScore > 70).

- Pattern: Generic neutral gray palette with no color personality
- Pattern: Default Material Design blue (100% match to #2196F3 or close derivative)
- Pattern: Rounded corners everywhere (8px radius on every element with no variation)
- Pattern: Same font pairing as 50% of products (Inter plus Merriweather)
- Pattern: Standard 8pt grid with zero customization or exceptions
- Pattern: Excessive animations (10+ simultaneous or 300ms+ duration)

**Scoring:** If implementation matches 3+ generic indicators, escalate for design review before shipping.

**Rationale:** Polish requires distinction. Generic equals invisible. Branded products have design personality. Use genericityScore framework (from design-references bundle) to validate.

---

## Application Checklist

### Before Shipping Any UI Feature

- [ ] All interactive elements scale on press (scale 0.96)
- [ ] Border radii follow concentric rule (outer = inner + padding)
- [ ] Icon transitions use opacity + scale + blur (not direct swap)
- [ ] Image placeholders outlined in rgba(0,0,0,0.1), never tinted
- [ ] Touch targets are minimum 40x40px (buttons 44x44px)
- [ ] No `transition: all` - explicit property transitions only
- [ ] Dynamic numbers use `font-variant-numeric: tabular-nums`
- [ ] Headings use `text-wrap: balance`
- [ ] Enter animations staggered at 30ms-80ms base (depending on brand intensity)
- [ ] Exit animations fade + scale down (opacity 0, scale 0.8)
- [ ] Font smoothing applied (`-webkit-font-smoothing: antialiased` desktop, `subpixel-antialiased` mobile)
- [ ] AnimatePresence children set `initial={false}`
- [ ] `will-change` used selectively (animated properties only)
- [ ] Shadows used for elevation, borders for structure
- [ ] Optical alignment verified (icons, text baselines, descenders)
- [ ] Typography rhythm established (line-height, paragraph spacing, scale progression)
- [ ] Shadow hierarchy applies correct elevation levels (0-5)
- [ ] Focus states visible via `:focus-visible` with 2px outline offset
- [ ] @prefers-reduced-motion respected (animations disabled, not "duration: 0")
- [ ] Contrast verified (WCAG AA minimum, AAA target)
- [ ] All 8 component states defined (default, hover, focus, active, disabled, loading, error, success)
- [ ] genericityScore < 55 (no AI slop, design has personality)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.2 | 2026-05-23 | Complete 22-point framework: 14-point baseline + 8 proprietary extensions |
| 2.0 | 2026-05-22 | 14-point baseline extracted from industry standard |

---

## Authority and Licensing

**Sidecoach Polish Standard v2.2** is proprietary intellectual property of Sidecoach Design Systems.

Permission to use and reference in internal projects only. Not for public distribution or commercial license without written consent.

Built on industry baseline (tactical-polish pattern library), enhanced with original research into optical alignment, typography rhythm, shadow hierarchy, focus visibility, motion respect, contrast verification, state completeness, and anti-pattern detection.
