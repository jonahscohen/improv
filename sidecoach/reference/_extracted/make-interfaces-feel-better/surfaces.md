# make-interfaces-feel-better - Surfaces (extracted)

This file extracts `surfaces.md` from the make-interfaces-feel-better skill. Source verbatim lift comes first, then Extension (operational specificity for radius, alignment, shadows, image outlines, hit areas), then What's missing (surface gaps).

> Note on punctuation: per CLAUDE.md (no emdashes), every emdash from the source has been converted to a regular hyphen with surrounding spaces. All other content is byte-for-byte preserved.

---

## Source verbatim lift

From `/Users/spare3/.agents/skills/make-interfaces-feel-better/surfaces.md`.

### Surfaces

Border radius, optical alignment, shadows, and image outlines.

### Concentric Border Radius

When nesting rounded elements, the outer radius must equal the inner radius plus the padding between them:

```
outerRadius = innerRadius + padding
```

This rule is most useful when nested surfaces are close together. If padding is larger than `24px`, treat the layers as separate surfaces and choose each radius independently instead of forcing strict concentric math.

#### Example

```css
/* Good - concentric radii */
.card {
  border-radius: 20px; /* 12 + 8 */
  padding: 8px;
}
.card-inner {
  border-radius: 12px;
}

/* Bad - same radius on both */
.card {
  border-radius: 12px;
  padding: 8px;
}
.card-inner {
  border-radius: 12px;
}
```

#### Tailwind Example

```tsx
// Good - outer radius accounts for padding
<div className="rounded-2xl p-2">       {/* 16px radius, 8px padding */}
  <div className="rounded-lg">          {/* 8px radius = 16 - 8 ok */}
    ...
  </div>
</div>

// Bad - same radius on both
<div className="rounded-xl p-2">
  <div className="rounded-xl">          {/* same radius, looks off */}
    ...
  </div>
</div>
```

Mismatched border radii on nested elements is one of the most common things that makes interfaces feel off. Always calculate concentrically.

### Optical Alignment

When geometric centering looks off, align optically instead.

#### Buttons with Text + Icon

Use slightly less padding on the icon side to make the button feel balanced. A reliable rule of thumb is:
`icon-side padding = text-side padding - 2px`.

```css
/* Good - less padding on icon side */
.button-with-icon {
  padding-left: 16px;
  padding-right: 14px; /* icon side = text side - 2px */
}

/* Bad - equal padding looks like icon is pushed too far right */
.button-with-icon {
  padding: 0 16px;
}
```

```tsx
// Tailwind
<button className="pl-4 pr-3.5 flex items-center gap-2">
  <span>Continue</span>
  <ArrowRightIcon />
</button>
```

#### Play Button Triangles

Play icons are triangular and their geometric center is not their visual center. Shift slightly right:

```css
/* Good - optically centered */
.play-button svg {
  margin-left: 2px; /* shift right to account for triangle shape */
}

/* Bad - geometrically centered but looks off */
.play-button svg {
  /* no adjustment */
}
```

#### Asymmetric Icons (Stars, Arrows, Carets)

Some icons have uneven visual weight. The best fix is adjusting the SVG directly so no extra margin/padding is needed in the component code.

```tsx
// Best - fix in the SVG itself
// Adjust the viewBox or path to visually center the icon

// Fallback - adjust with margin
<span className="ml-px">
  <StarIcon />
</span>
```

### Shadows Instead of Borders

For **buttons, cards, and containers** that use a border for depth or elevation, prefer replacing it with a subtle `box-shadow`. Shadows adapt to any background since they use transparency; solid borders don't. This also helps when using images or multiple colors as backgrounds - solid border colors don't work well on backgrounds other than the ones they were designed for.

**Do not apply this to dividers** (`border-b`, `border-t`, side borders) or any border whose purpose is layout separation rather than element depth. Those should stay as borders.

#### Shadow as Border (Light Mode)

The shadow is comprised of three layers. The first acts as a 1px border ring, the second adds subtle lift, and the third provides ambient depth:

```css
:root {
  --shadow-border:
    0px 0px 0px 1px rgba(0, 0, 0, 0.06),
    0px 1px 2px -1px rgba(0, 0, 0, 0.06),
    0px 2px 4px 0px rgba(0, 0, 0, 0.04);
  --shadow-border-hover:
    0px 0px 0px 1px rgba(0, 0, 0, 0.08),
    0px 1px 2px -1px rgba(0, 0, 0, 0.08),
    0px 2px 4px 0px rgba(0, 0, 0, 0.06);
}
```

#### Shadow as Border (Dark Mode)

In dark mode, simplify to a single white ring - layered depth shadows aren't visible on dark backgrounds:

```css
/* Dark mode - adapt to whatever setup the project uses
   (prefers-color-scheme, class, data attribute, etc.) */
--shadow-border: 0 0 0 1px rgba(255, 255, 255, 0.08);
--shadow-border-hover: 0 0 0 1px rgba(255, 255, 255, 0.13);
```

#### Usage with Hover Transition

Apply the variable and add `transition-[box-shadow]` for a smooth hover:

```css
.card {
  box-shadow: var(--shadow-border);
  transition-property: box-shadow;
  transition-duration: 150ms;
  transition-timing-function: ease-out;
}

.card:hover {
  box-shadow: var(--shadow-border-hover);
}
```

#### When to Use Shadows vs. Borders

| Use shadows | Use borders |
| --- | --- |
| Cards, containers with depth | Dividers between list items |
| Buttons with bordered styles | Table cell boundaries |
| Elevated elements (dropdowns, modals) | Form input outlines (for accessibility) |
| Elements on varied backgrounds | Hairline separators in dense UI |
| Hover/focus states for lift effect | |

### Image Outlines

Add a subtle `1px` outline with low opacity to images. This creates consistent depth, especially in design systems where other elements use borders or shadows.

#### Color rules (non-negotiable)

- **Light mode**: pure black - `rgba(0, 0, 0, 0.1)`. Exact values: R=0, G=0, B=0.
- **Dark mode**: pure white - `rgba(255, 255, 255, 0.1)`. Exact values: R=255, G=255, B=255.
- Never use a near-black or near-white from the project palette (e.g. slate-900, zinc-900, `#0a0a0a`, `#111827`, `#f5f5f7`). Tinted outlines pick up the surrounding surface color and read as dirt on the image edge.
- Never match the outline to the project's accent or ink color. The outline is a neutral separator, not a themed element.

#### Light Mode

```css
img {
  outline: 1px solid rgba(0, 0, 0, 0.1);
  outline-offset: -1px; /* inset so it doesn't add to layout */
}
```

#### Dark Mode

```css
img {
  outline: 1px solid rgba(255, 255, 255, 0.1);
  outline-offset: -1px;
}
```

#### Tailwind with Dark Mode

```tsx
<img
  className="outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
  src={src}
  alt={alt}
/>
```

Use `outline-black/10` and `outline-white/10` specifically - not `outline-slate-*`, `outline-zinc-*`, `outline-neutral-*`, or any tinted scale.

**Why outline instead of border?** `outline` doesn't affect layout (no added width/height), and `outline-offset: -1px` keeps it inset so images stay their intended size.

### Minimum Hit Area

Interactive elements should have a minimum hit area of 44x44px (WCAG) or at least 40x40px. If the visible element is smaller (e.g., a 20x20 checkbox), extend the hit area with a pseudo-element.

#### CSS Example

```css
/* Small checkbox with expanded hit area */
.checkbox {
  position: relative;
  width: 20px;
  height: 20px;
}

.checkbox::after {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
}
```

#### Tailwind Example

```tsx
<button className="relative size-5 after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-1/2">
  <CheckIcon />
</button>
```

#### Collision Rule

If the extended hit area overlaps another interactive element, shrink the pseudo-element - but make it as large as possible without colliding. Two interactive elements should never have overlapping hit areas.

---

## Extension - operational specificity

### Concentric border radius - extension

**The formula.** `outerRadius = innerRadius + padding`. Apply when the gap between surfaces is small enough that the eye traces both curves in one sweep.

**Threshold.** When padding (the gap) exceeds `24px`, the surfaces read as independent - skip the formula and choose radii to match the visual register of each layer.

**Tailwind radius mapping (8px scale):**

| Class | Pixels |
| --- | --- |
| `rounded-none` | 0 |
| `rounded-sm` | 2px |
| `rounded` | 4px |
| `rounded-md` | 6px |
| `rounded-lg` | 8px |
| `rounded-xl` | 12px |
| `rounded-2xl` | 16px |
| `rounded-3xl` | 24px |
| `rounded-full` | 9999px |

**Canonical pairings:**

| Outer padding (Tailwind) | Outer radius | Inner radius |
| --- | --- | --- |
| `p-1` (4px) | `rounded-xl` (12px) | `rounded-lg` (8px) |
| `p-1.5` (6px) | `rounded-xl` (12px) | `rounded-md` (6px) |
| `p-2` (8px) | `rounded-2xl` (16px) | `rounded-lg` (8px) |
| `p-2.5` (10px) | `rounded-2xl` (16px) | `rounded` (6px) - approximate |
| `p-3` (12px) | `rounded-2xl` (16px) | `rounded` (4px) |
| `p-4` (16px) | `rounded-3xl` (24px) | `rounded-lg` (8px) |
| `p-5` (20px) | `rounded-3xl` (24px) | `rounded` (4px) |
| `p-6` (24px) | At threshold - choose independently | |

**The most common violation.** A card with `rounded-xl` and `p-3` wrapping a button also styled `rounded-xl`. The eye reads the two same-radius curves drifting against each other. Fix: outer `rounded-2xl` (16px) so outer matches inner radius (12px) + padding (12px ≈ 16px close enough).

**Why corners are where the violation shows.** Along the straight edge, the inner and outer surfaces are parallel and the misalignment is invisible. At the corner, the inner and outer curves diverge - one bends faster, one bends slower. The result is a visible "drift" of 2-6px that reads as sloppy alignment even though no element is technically misaligned.

**Three-level nesting.** Apply the formula recursively. Container `p-4 rounded-3xl` (24px) wraps a card `p-3 rounded-2xl` (16px) which wraps a button `rounded-lg` (8px). 24 = 16 + 8 (card check), 16 = 8 + 8 (button check, with 8px inner-card padding implied). Both relationships hold.

### Optical alignment - extension

The geometric center is the centroid of the bounding box. The optical center is where the visual mass concentrates. They differ for any asymmetric shape.

**Where the rule applies:**

1. **Text + trailing icon buttons.** `pl-4 pr-3.5` (16px left, 14px right). The trailing icon's whitespace inside its bounding box pushes the visual mass left; equal padding makes the icon look "pushed out."

2. **Text + leading icon buttons.** `pl-3.5 pr-4`. Mirror of #1.

3. **Icon-only buttons (square).** No optical adjustment needed - the icon's bounding box matches the button's geometric center.

4. **Play button triangle.** `margin-left: 2px` on the SVG (or `pl-px` on the wrapper). The triangle's pointy end shifts the visual mass right; geometric centering puts the centroid in the middle, making the triangle look pushed left.

5. **Asymmetric icons (stars, hearts, carets, chevrons).** Re-center the SVG path inside the viewBox. Fallback: `ml-px` or `mr-px` on the wrapper.

6. **Single-letter avatars/logos.** Letters with descender-shaped or stem-heavy forms (`J`, `Q`, `Y`) drift visually down-left; adjust by 0.5-1px.

**Where the rule does NOT apply (symmetric shapes):**

- Circles, squares, plus signs, cross icons, equal signs, hamburger menu icons, simple grid icons.
- Square photo thumbnails (the bounding box matches the visual mass).
- Symmetric logos.

**Quick test.** Squint at the element. If it looks off-balance, it needs optical adjustment. If it looks centered, leave it.

### Shadows over borders - extension

The three-layer shadow stack (`surfaces.md`) breaks down as:

| Layer | CSS | Role |
| --- | --- | --- |
| Ring | `0px 0px 0px 1px rgba(0, 0, 0, 0.06)` | 1px border replacement, no spread |
| Lift | `0px 1px 2px -1px rgba(0, 0, 0, 0.06)` | Pinched bottom shadow ("sits on page") |
| Ambient | `0px 2px 4px 0px rgba(0, 0, 0, 0.04)` | Indirect light, grounds the element |

**Why three layers.** Each simulates one component of real-world lighting:
- The ring is the contact line where the surface meets the background.
- The lift simulates a small key light above-left.
- The ambient simulates indirect light bouncing off the surface.

Without any one of the three, the element looks "off." Ring without lift: floating without contact. Lift without ambient: harsh. Ambient without ring: undefined edges.

**Hover delta.** Each opacity rises by `0.02` on hover (`0.06 -> 0.08`, `0.06 -> 0.08`, `0.04 -> 0.06`). The change is sub-perceptual when stated as a number but the cumulative effect is "the element woke up." Transition the box-shadow with `150ms ease-out`.

**Dark mode collapse to single ring.** Layered shadows are invisible against dark backgrounds (the shadow is darker than the surface). Replace with a single white ring at `rgba(255, 255, 255, 0.08)` for default, `0.13` for hover. The ring becomes the entire elevation cue in dark mode.

**Where to apply (depth bearing):**

- Buttons (primary, secondary, tertiary if they have any elevation)
- Cards
- Dropdowns, popovers, menus
- Modals, dialogs, sheets
- Toasts, notifications
- Floating action buttons
- Tooltips with depth

**Where NOT to apply (layout separator):**

- `border-b` between list items - stays as border
- `border-t` on table rows
- `border-r` on sidebars
- Form input outlines (accessibility focus rings need to be borders, not shadows)
- Hairline separators in dense UI

**CSS variable pattern (recommended):**

```css
:root {
  --shadow-border:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 1px 2px -1px rgba(0, 0, 0, 0.06),
    0 2px 4px 0 rgba(0, 0, 0, 0.04);
  --shadow-border-hover:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 1px 2px -1px rgba(0, 0, 0, 0.08),
    0 2px 4px 0 rgba(0, 0, 0, 0.06);
}

[data-theme="dark"] {
  --shadow-border: 0 0 0 1px rgba(255, 255, 255, 0.08);
  --shadow-border-hover: 0 0 0 1px rgba(255, 255, 255, 0.13);
}
```

### Image outlines - extension

**The color rule is non-negotiable.** Pure black `rgba(0, 0, 0, 0.1)` in light mode, pure white `rgba(255, 255, 255, 0.1)` in dark mode. Reasoning:

- **Tinted outlines (slate-900, zinc-900, neutral-900, anything with chroma) pick up the surface color underneath them at low opacity.** A `rgba(15, 23, 42, 0.1)` (slate-900) outline on a white surface produces a very-slightly-blue thin line. On a yellow surface, it produces a slightly-greenish line. The eye reads this as "dirt on the photo edge."

- **Pure neutral at 10% opacity reads as shadow.** Shadow is a universal language - the eye accepts it regardless of surface color.

- **Black/white tones to 10% intentionally.** Lower than 10% disappears on light surfaces; higher than 10% reads as a hard border.

**Why `outline` not `border`.** Borders participate in the box model (they add to width/height). Outlines do not. `outline-offset: -1px` insets the outline so the image stays its intended pixel dimensions exactly.

**Tailwind canonical form:**
```tsx
<img
  className="outline outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
  ...
/>
```

**Forbidden Tailwind classes for image outlines:**
- `outline-slate-*`
- `outline-zinc-*`
- `outline-neutral-*`
- `outline-gray-*`
- Any colored outline that matches a brand accent
- `outline-{number}` greater than 1 (`outline-2`, etc.) - reads as a designed border, not a separator

**Applies to:**
- Photos, thumbnails, avatars
- Video posters, video thumbnails
- Hero images
- Illustrations with light edges (where the illustration could blend into a light background)

**Does NOT apply to:**
- SVG icons (no "edge" to dirty)
- Images with intentional hard borders (e.g., a polaroid frame)
- Images on a transparent background where the image itself defines its edge

**Hover state (optional).** Raise to 15% opacity (`outline-black/15`) on hover. Not required, but worth adding for tap-able image cards.

### Hit areas - extension

**The minimum: 40x40px.** The recommendation: 44x44px (WCAG 2.5.5 AAA, also matches Apple's HIG and Material Design touch target). Use 44x44 by default on touch surfaces; 40x40 acceptable on desktop-primary surfaces.

**When the visible element is smaller (most icon buttons, checkboxes, close buttons):**

```tsx
// Pattern: parent is `relative`, pseudo `::after` extends invisible hit zone
<button className="relative size-5 after:absolute after:top-1/2 after:left-1/2 after:size-10 after:-translate-1/2">
  <CloseIcon />
</button>
```

The button is visually 20x20 (`size-5`). The hit zone is 40x40 (`after:size-10`). The pseudo-element is centered with absolute positioning + `-translate-1/2`.

**The pseudo-element pattern explained:**
1. `position: relative` on the parent.
2. `::after` with `position: absolute`.
3. `top: 50%; left: 50%; transform: translate(-50%, -50%)` to center.
4. `width: 40px; height: 40px` for the hit zone.
5. No background, no visible style - it's pure click target.

**Collision rule.** Two interactive elements must never have overlapping hit areas. If two 20x20 icons are 10px apart (center-to-center 30px), each can have at most a 30x30 hit area without overlap. Shrink the pseudo to the largest non-overlapping size.

**Real-world densely-packed-toolbar exception.** File managers, image editors, and pro-tool palettes often have 24x24 icons in 4px-spaced rows. Honoring 40x40 hit zones is impossible. Accept smaller hit areas (32x32 minimum) and pair with strong hover affordance (color shift, tooltip) so the target is discoverable.

**Verification.** Use browser dev tools to inspect the bounding rect of the pseudo-element, or hover-test the periphery: click 18px from the visible button - it should still register.

**Why this matters.** Fitts's Law: time to acquire a target is a function of distance and target size. A 20x20 visible icon at 30px hand-target-distance has a roughly 2x longer acquisition time than a 40x40 hit area at the same distance. On mobile, missed taps cascade into user frustration.

---

## What's missing - surface gaps in MIFB

The surfaces section covers radius, alignment, shadows, image outlines, and hit areas. Notable gaps:

1. **Border-radius vocabulary beyond 8px scale.** No guidance on non-standard radius scales (e.g., a brand that uses 6/14/22/30 instead of 4/8/12/16). The concentric formula still applies, but the Tailwind class lookup table doesn't.

2. **Asymmetric border radius (`rounded-tl-lg rounded-tr-lg rounded-bl-none rounded-br-none`).** No guidance on when to use mixed corner radii (toast docking to bottom, sheet sliding from edge, segmented control endpoints).

3. **Color theory and palette.** No mention of accent colors, semantic colors (success, warning, error, info), color harmonies, contrast ratios for hover states.

4. **Spacing scale.** Concentric radius requires knowing the padding, but no guidance on the spacing scale itself (4/8/12/16/24/32/48/64 vs Tailwind's 4-step scale vs golden-ratio scale).

5. **Z-index and stacking.** No guidance on layering rules (modal above dropdown above tooltip above sticky header), no recommended stacking-context tokens.

6. **Focus states.** Hit area is mentioned but focus visibility is not. The shadow-as-border rule conflicts with focus-ring requirements (you cannot have both a 3-layer shadow and a 2px focus ring without one fighting the other). MIFB is silent on resolution.

7. **Backdrop blur and glass effects.** No guidance on `backdrop-filter: blur(...)`, on glass surfaces, on layered glass elevation.

8. **Skeleton and loading state surfaces.** No skeleton patterns, no shimmer overlays, no loading-state visual treatment.

9. **Form input surfaces specifically.** Input chrome (the border, the focus ring, the background) is a surface concern not covered. The skill explicitly excludes form-input outlines from the shadow rule but doesn't say what to do instead.

10. **Tab, segmented control, and chip surfaces.** No guidance on the visual treatment of selected vs unselected tabs, of pill-shaped chips, of segmented control divisions.

11. **Avatar specifications.** Image outlines apply to avatars but the avatar-specific concerns (status indicators, fallback initials, group avatars with overlap) are not covered.

12. **Card composition.** A card surface is mentioned but card composition (header / body / footer structure, padding rhythm inside, divider treatment) is not.

13. **Modal and sheet specifications.** Shadow rules apply but modal-specific concerns (scrim color, sheet snap points, drag handle, safe-area insets) are not.

14. **Hover lift specifications.** "Hover state for lift effect" is mentioned in the shadows-vs-borders table but no specific lift transform values, lift duration, or lift origin guidance.

15. **Glow effects.** No guidance on glow/aura (a blurred colored shadow used for focus, hover, or branding accent).

Sidecoach should layer these via `component-gallery-reference` (form inputs, tabs, modals, avatars), the 159-rule extended-domain validator (focus rings, color contrast, semantic colors), and direct flow extensions.
