# Impeccable spatial-design.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Spatial Design

## Spacing Systems

### Use 4pt Base, Not 8pt

8pt systems are too coarse; you'll frequently need 12px (between 8 and 16). Use 4pt for granularity: 4, 8, 12, 16, 24, 32, 48, 64, 96px.

### Name Tokens Semantically

Name by relationship (`--space-sm`, `--space-lg`), not value (`--spacing-8`). Use `gap` instead of margins for sibling spacing; it eliminates margin collapse and cleanup hacks.

## Grid Systems

### The Self-Adjusting Grid

Use `repeat(auto-fit, minmax(280px, 1fr))` for responsive grids without breakpoints. Columns are at least 280px, as many as fit per row, leftovers stretch. For complex layouts, use named grid areas (`grid-template-areas`) and redefine them at breakpoints.

## Visual Hierarchy

### The Squint Test

Blur your eyes (or screenshot and blur). Can you still identify:
- The most important element?
- The second most important?
- Clear groupings?

If everything looks the same weight blurred, you have a hierarchy problem.

### Hierarchy Through Multiple Dimensions

Don't rely on size alone. Combine:

| Tool | Strong Hierarchy | Weak Hierarchy |
|------|------------------|----------------|
| **Size** | 3:1 ratio or more | <2:1 ratio |
| **Weight** | Bold vs Regular | Medium vs Regular |
| **Color** | High contrast | Similar tones |
| **Position** | Top/left (primary) | Bottom/right |
| **Space** | Surrounded by white space | Crowded |

**The best hierarchy uses 2-3 dimensions at once**: A heading that's larger, bolder, AND has more space above it.

### Cards Are Not Required

Cards are overused. Spacing and alignment create visual grouping naturally. Use cards only when content is truly distinct and actionable, items need visual comparison in a grid, or content needs clear interaction boundaries. **Never nest cards inside cards.** Use spacing, typography, and subtle dividers for hierarchy within a card.

## Container Queries

Viewport queries are for page layouts. **Container queries are for components**:

```css
.card-container {
  container-type: inline-size;
}

.card {
  display: grid;
  gap: var(--space-md);
}

/* Card layout changes based on its container, not viewport */
@container (min-width: 400px) {
  .card {
    grid-template-columns: 120px 1fr;
  }
}
```

**Why this matters**: A card in a narrow sidebar stays compact, while the same card in a main content area expands automatically, without viewport hacks.

## Optical Adjustments

Text at `margin-left: 0` looks indented due to letterform whitespace; use negative margin (`-0.05em`) to optically align. Geometrically centered icons often look off-center; play icons need to shift right, arrows shift toward their direction.

### Touch Targets vs Visual Size

Buttons can look small but need large touch targets (44px minimum). Use padding or pseudo-elements:

```css
.icon-button {
  width: 24px;  /* Visual size */
  height: 24px;
  position: relative;
}

.icon-button::before {
  content: '';
  position: absolute;
  inset: -10px;  /* Expand tap target to 44px */
}
```

## Depth & Elevation

Create semantic z-index scales (dropdown -> sticky -> modal-backdrop -> modal -> toast -> tooltip) instead of arbitrary numbers. For shadows, create a consistent elevation scale (sm -> md -> lg -> xl). **Key insight**: Shadows should be subtle. If you can clearly see it, it's probably too strong.

---

**Avoid**: Arbitrary spacing values outside your scale. Making all spacing equal (variety creates hierarchy). Creating hierarchy through size alone - combine size, weight, color, and space.

## EXTENSION

### 4pt scale, full ramp (token-ready)

```css
:root {
  --space-0: 0;
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.5rem;    /* 24px */
  --space-6: 2rem;      /* 32px */
  --space-7: 3rem;      /* 48px */
  --space-8: 4rem;      /* 64px */
  --space-9: 6rem;      /* 96px */
  --space-10: 8rem;     /* 128px */
}
```

Notes:
- Skip 5 and 7 in the value series (no 20px, no 56px) to keep contrast meaningful.
- 4px and 8px appear in borders, hairlines, fine internal padding.
- 16px and 24px do the heavy lifting in component internals.
- 48px+ separates sections.

### Container-query worked pattern

Build components against the container they live in, not the viewport:

```css
.card {
  container-type: inline-size;
  container-name: card-wrap;
}

.card__inner {
  display: grid;
  gap: var(--space-3);
}

@container card-wrap (min-width: 320px) {
  .card__inner {
    grid-template-columns: 80px 1fr;
    align-items: start;
  }
}

@container card-wrap (min-width: 480px) {
  .card__inner {
    grid-template-columns: 120px 1fr auto;
  }
}
```

The same card auto-adapts whether it lives in a 300px sidebar, an 800px content area, or a 1200px hero.

### Touch-target expansion pattern (pseudo-element)

```css
.tap {
  /* Visual element can stay small */
  width: 24px;
  height: 24px;
  position: relative;
}

.tap::before {
  /* Invisible hit area expanded to 44x44 */
  content: '';
  position: absolute;
  inset: -10px;
  /* Optional: helpful during dev to visualize */
  /* background: rgba(255, 0, 0, 0.2); */
}
```

Works for icon buttons, close (X) buttons, small toggle switches, anything below 40px visual size.

### Shadow scale (subtle, prescribed)

```css
:root {
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 6px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
  --shadow-lg: 0 8px 20px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 40px rgba(0, 0, 0, 0.10), 0 4px 12px rgba(0, 0, 0, 0.06);
}
```

Use two-layer shadows (one short and sharp + one long and soft) for natural depth. Single-layer shadows look flat or harsh.

For dark mode, shadows are usually invisible. Use lighter surface tones for depth instead.

## WHAT'S MISSING

- **No baseline grid alignment system.** Vertical rhythm referenced in typography.md but no `--baseline: 24px` to coordinate.
- **No advice on responsive spacing.** Should `--space-9` be 96px on mobile? Or 48px? Not addressed.
- **No relationship between spacing scale and type scale.** Math harmony (8/16/24/32 matches type at 16/24/32/48) isn't drawn out.
- **No use cases for asymmetric spacing.** Equal padding-block all around vs. heavier top vs. heavier bottom; not addressed.
- **No explicit dark-mode shadow guidance.** Mentioned in passing but no concrete recipe.
