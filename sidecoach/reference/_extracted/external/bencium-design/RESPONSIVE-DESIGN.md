---
source: https://github.com/bencium/bencium-claude-code-design-skill/blob/main/bencium-controlled-ux-designer/skills/bencium-controlled-ux-designer/RESPONSIVE-DESIGN.md
captured: 2026-05-25
type: external-taste-skill (responsive foundation)
---

# Bencium - Responsive Design (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

### Mobile-First Approach

Always start with mobile design, then progressively enhance for larger screens.

**Why Mobile-First:**
- Forces focus on essential content
- Easier to scale up than scale down
- Better performance on mobile devices
- Aligns with usage patterns (mobile-first web)

### Standard Breakpoints

```css
/* Mobile First Approach */
/* Base styles: 0-640px (mobile) */

/* Small tablets and large phones */
@media (min-width: 640px) { }

/* Tablets */
@media (min-width: 768px) { }

/* Small laptops */
@media (min-width: 1024px) { }

/* Desktops */
@media (min-width: 1280px) { }

/* Large desktops */
@media (min-width: 1536px) { }
```

### CRITICAL: Specific Breakpoint Ranges (verbatim table)

| Range | Pixels | Target Devices | Layout Strategy |
|-------|--------|----------------|-----------------|
| **XS** | 0-479px | Small phones (iPhone SE, older Android) | Single column, stacked navigation, large touch targets (min 44px) |
| **SM** | 480-767px | Large phones (iPhone 14, most modern phones) | Single column, simplified UI, bottom navigation, reduced complexity |
| **MD** | 768-1023px | Tablets (iPad, Android tablets) | 2 columns possible, sidebar navigation, some desktop features |
| **LG** | 1024-1439px | Small laptops, landscape tablets | Multi-column layouts, full navigation, desktop UI patterns |
| **XL** | 1440px+ | Desktop monitors, large screens | Max-width containers, multi-panel layouts, advanced features visible |

### Mobile Simplification Examples (the prescribed pattern transitions)

- **Navigation**: Hamburger menu (mobile) -> Full nav bar (desktop)
- **Forms**: Stacked fields (mobile) -> Side-by-side fields (desktop)
- **Content**: Single column (mobile) -> Multi-column grid (desktop)
- **Actions**: Fixed bottom bar (mobile) -> Inline buttons (desktop)
- **Tables**: Collapsed cards (mobile) -> Full data table (desktop)
- **Sidebars**: Hidden/collapsible (mobile) -> Always visible (desktop)
- **Filters**: Modal/drawer (mobile) -> Sidebar panel (desktop)

### Responsive Images (with srcset)

```tsx
<img
  src="image-800w.jpg"
  srcSet="
    image-400w.jpg 400w,
    image-800w.jpg 800w,
    image-1200w.jpg 1200w
  "
  sizes="
    (max-width: 640px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  "
  alt="Descriptive alt text"
  loading="lazy"
/>
```

### Fluid Typography with CSS Clamp

```css
h1 {
  /* min: 2rem (32px), preferred: 5vw, max: 4rem (64px) */
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.2;
}

p {
  /* min: 1rem (16px), preferred: 2.5vw, max: 1.25rem (20px) */
  font-size: clamp(1rem, 2.5vw, 1.25rem);
  line-height: 1.6;
}
```

### CSS Grid Responsive Pattern

```tsx
<div className="
  grid
  grid-cols-1        // mobile: 1 column
  sm:grid-cols-2     // small: 2 columns
  md:grid-cols-3     // medium: 3 columns
  lg:grid-cols-4     // large: 4 columns
  gap-4              // consistent gap
">
```

### Touch-Friendly Interfaces

Minimum 44x44px touch targets. Use `touch-manipulation` to prevent 300ms tap delay.

```tsx
<button className="
  min-w-[44px]
  min-h-[44px]
  px-4 py-2
  rounded-lg
  touch-manipulation
">
```

### Touch Gestures

```tsx
<div className="
  overflow-x-auto    // horizontal scroll
  snap-x             // snap scrolling
  snap-mandatory
  overscroll-contain // prevent bounce on mobile
">
```

### Mobile Menu Pattern (complete)

```tsx
import { useState } from 'react';
import { List, X } from '@phosphor-icons/react';

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden p-2"
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={24} /> : <List size={24} />}
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-white md:hidden">
          <nav className="p-6 space-y-4">
            {/* Navigation items */}
          </nav>
        </div>
      )}

      <nav className="hidden md:flex gap-6">
        {/* Navigation items */}
      </nav>
    </>
  );
}
```

### Sticky Navigation Pattern

```tsx
<header className="
  sticky top-0 z-40
  bg-white/80
  backdrop-blur-md
  border-b border-slate-200
">
```

### Testing Responsive Designs

**Essential devices to test:**
- Small phone (iPhone SE, Android small)
- Large phone (iPhone Pro Max, Android large)
- Tablet (iPad, Android tablet)
- Desktop (various resolutions)

**Specific viewport sizes for Playwright:**
- iPhone SE: 375x667
- iPhone 12 Pro: 390x844
- iPad: 768x1024
- iPad Pro: 1024x1366
- Desktop: 1920x1080

### Best Practices Summary

**DO:**
- Start with mobile design first
- Use relative units (rem, em, %) for flexibility
- Test on real devices, not just emulators
- Ensure touch targets are at least 44x44px
- Use semantic HTML
- Implement lazy loading for images and videos
- Optimize assets for mobile networks
- Use CSS Grid and Flexbox for flexible layouts

**DO NOT:**
- Design for desktop first and scale down
- Use fixed pixel widths for layout containers
- Rely solely on browser DevTools for testing
- Make touch targets too small
- Forget keyboard navigation
- Load all images eagerly
- Use large unoptimized images on mobile
- Use complex nested tables for layout

---

## SECTION 2: EXTENSION

### The 5-tier breakpoint table - why these specific values

Bencium uses 480 / 768 / 1024 / 1440 px breakpoints with Tailwind names (XS / SM / MD / LG / XL). The reasoning:

- **480px** = the boundary between "small phone" (iPhone SE) and "large phone" (iPhone 14 Pro at 393pt = 393px portrait, 852px landscape). Below 480px, even a single 2-column grid is risky.
- **768px** = iPad portrait. Below this, hamburger menu is mandatory. Above, you can fit a horizontal nav bar.
- **1024px** = iPad landscape / small laptop. The first viewport where multi-column dashboards become viable.
- **1440px** = standard "Retina MacBook" / large monitor. Above this, content must be max-width capped or it sprawls.

The implicit 6th tier is **>=1920px** (4K monitors) where you must explicitly cap content with `max-w-[1400px] mx-auto` or content becomes line-length unreadable.

### Pattern transitions per breakpoint (extended from source)

The source has 7 simplifications. Extended decision table:

| Element | XS (0-479) | SM (480-767) | MD (768-1023) | LG (1024-1439) | XL (1440+) |
|---|---|---|---|---|---|
| Navigation | Hamburger + drawer | Hamburger + drawer | Horizontal nav | Horizontal nav | Horizontal nav |
| Sidebar | Hidden, accessed via drawer | Hidden | Collapsible | Always visible | Always visible |
| Data table | Collapsed cards (stacked rows) | Collapsed cards | Horizontal scroll | Full table | Full table |
| Forms | Stacked fields | Stacked fields | 2-column for short pairs | Side-by-side | Side-by-side |
| Filters | Modal/full-screen drawer | Bottom drawer | Right-side drawer | Sidebar panel | Sidebar panel |
| Action bar | Fixed bottom | Fixed bottom | Inline | Inline | Inline |
| Modal | Full-screen | Full-screen | Centered with backdrop | Centered with backdrop | Centered with backdrop |
| Carousel | 1 visible + swipe | 1 visible + swipe | 2 visible + arrows | 3 visible + arrows | 4+ visible |
| Card grid | 1 col | 1 col | 2 col | 3 col | 4 col |
| Image | Full-width crop | Full-width crop | 1:1 or 16:9 | Original aspect | Original aspect with margins |
| Footer | 1 col | 1 col | 2 col | 4 col | 4 col with social row |
| Search input | Full-width | Full-width | Inline 50% width | Inline 30% width | Inline 30% width with shortcut hint |

### Touch target reality - why 44x44 isn't always enough

Apple HIG: 44pt. Google Material: 48dp. WCAG 2.5.5: 44 CSS pixels. WCAG 2.5.8 (AAA): 44 CSS pixels with 24px clear space.

The 44px floor is just MINIMUM. Real-world thumb-zone analysis (Steven Hoober's research):
- The bottom 1/3 of the phone screen is where 75% of touches happen.
- Top corners are unreachable for one-handed use on phones > 6 inches.
- Place primary CTAs in the bottom 1/3 of the viewport for mobile.

### Container max-width strategy

Sidecoach's `max-w-[1400px] mx-auto` rule from the taste-skill is the right ceiling for most marketing content. Bencium's "Max-width containers" at XL doesn't specify a number. Practical values:

- Marketing content: `max-w-[1280px]` (text-heavy, prevents long line measure)
- Dashboard: `max-w-[1536px]` or even `max-w-full` if information density justifies it
- Editorial/blog: `max-w-[768px]` for body, `max-w-[1024px]` for hero
- Image-heavy portfolio: `max-w-[1920px]` (or full-width) to let images breathe

---

## SECTION 3: What this covers that oracle + make-interfaces-feel-better don't

**This is the foundational gap in sidecoach.** Sidecoach has a "responsive review" flow handler but no codified breakpoint TABLE with PATTERN TRANSITIONS per tier.

**Specific gap-fills:**

1. **The EXACT 5-tier breakpoint table (XS 0-479 / SM 480-767 / MD 768-1023 / LG 1024-1439 / XL 1440+) with prescribed device targets.** This is the table the user explicitly called out as missing.

2. **The 7 prescribed pattern transitions** (Navigation hamburger -> full nav, Tables -> cards, Filters -> drawer, etc.). Each one is a concrete responsive design pattern.

3. **The Tailwind class equivalence table** (sm: / md: / lg: / xl:) tied to specific viewports.

4. **The touch target 44x44px rule with `touch-manipulation` to prevent 300ms tap delay.** Specific and copyable.

5. **The `overscroll-contain` CSS to prevent mobile bounce** on snap scrolling. A specific gotcha.

6. **The complete Mobile Menu pattern as production-ready React code.**

7. **The Sticky Nav pattern with `backdrop-blur-md` and `bg-white/80`** - a specific glass-nav implementation.

8. **The Playwright viewport test sequence** (375x667, 768x1024, 1920x1080) - copyable test scaffold.

9. **The DO/DO NOT summary** as a final pre-ship checklist for responsive work.
