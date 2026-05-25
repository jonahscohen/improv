# Responsive Foundation

Sidecoach canonical reference. Loaded into every craft / shape / adapt / polish flow. No marketing site, dashboard, or product UI ships from sidecoach without a mobile degrade plan that satisfies this file.

---

## The Premise

Responsive is not a polish round. Every component sidecoach emits must include its mobile degrade plan. Every layout must satisfy the breakpoint table. Hit areas must be 44x44px or larger at all breakpoints. If a component cannot function below 480px, sidecoach must say so explicitly with the prescribed alternative.

The discipline is mobile-first by construction. The default code is the mobile code. Larger breakpoints add complexity, never the reverse. Desktop-first CSS (using `max-width` queries to strip features down) is rejected at audit time - it ships unused desktop styles to the most constrained device and treats the smallest target as an exception case instead of the baseline.

---

## The Breakpoint Table

Verbatim from Bencium's `RESPONSIVE-DESIGN.md` (https://github.com/bencium/bencium-marketplace/blob/main/bencium-impact-designer/skills/bencium-impact-designer/RESPONSIVE-DESIGN.md), with sidecoach extensions.

| Range | Pixels | Devices | Strategy |
|---|---|---|---|
| **XS** | 0-479px | Small phones | Single column, stacked nav, 44px touch targets |
| **SM** | 480-767px | Large phones | Single column, bottom nav, simplified UI |
| **MD** | 768-1023px | Tablets | 2 columns possible, sidebar nav |
| **LG** | 1024-1439px | Laptops | Multi-column, full nav, desktop UI |
| **XL** | 1440px+ | Desktop | Max-width containers, multi-panel layouts |

### Sidecoach extensions to the table

- **Test widths (mandatory render points):** 375px, 390px, 414px, 768px, 1024px, 1280px, 1440px. The smallest test width is 375px (iPhone SE / iPhone 14 mini class) not 320px - sites that fit 375 cleanly almost always fit 320 with no further work, but sites that "look fine at 320" frequently break at 375 because designers optimized for the wrong canvas.
- **Tailwind names map straight onto this table.** `sm:` = 480+, `md:` = 768+, `lg:` = 1024+, `xl:` = 1440+. Use the prefix names in code and the range names in conversation. Do not invent custom breakpoints unless the content demands it.
- **Content-driven breakpoints are allowed and preferred when they conflict with the table.** Start narrow, stretch until the design visibly breaks, add a breakpoint there. The table is the default; the content is the source of truth.
- **Three breakpoints are usually enough.** If a layout works at XS, MD, and LG, you do not need SM or XL overrides. Adding breakpoints you do not need is technical debt.
- **`clamp()` removes breakpoints for fluid values.** Use `clamp(min, fluid, max)` for typography, spacing, and container widths to avoid discrete jumps. Reserve breakpoints for layout structure changes (column count, navigation pattern, table-to-card transformation), not for sizing.

---

## Pattern Transitions Per Breakpoint

| Pattern | XS (0-479) | SM (480-767) | MD (768-1023) | LG (1024-1439) | XL (1440+) |
|---|---|---|---|---|---|
| Navigation | hamburger drawer | bottom tab bar | sidebar (collapsible) | full nav bar | full nav + secondary actions |
| Tables | stacked cards | stacked cards | horizontal scroll (with sticky first column) | full table | full table |
| Filters | full-screen modal | bottom drawer | sidebar panel | sidebar panel | sidebar panel |
| Forms | single column | single column | single column | two column where grouped | two column where grouped |
| Hero | stacked (copy above media) | stacked | side-by-side (50/50) | side-by-side (60/40 copy-weighted) | side-by-side with max-width container |
| Cards grid | 1 col | 1 col | 2 col | 3 col | 3-4 col |
| Toast | full-width bottom (above safe area) | full-width bottom | top-right | top-right | top-right |
| Modals | full-screen | full-screen | centered (max 90vw) | centered (max 600px) | centered (max 600px) |
| Action bar | sticky bottom (above safe area) | sticky bottom | inline at top | inline at top | inline at top |
| Search | icon button -> full-screen overlay | icon button -> bottom sheet | inline collapsed | inline expanded | inline expanded + filters |
| Settings | full-screen list -> drill-in detail | drawer + drill-in | two-pane (list + detail) | two-pane | two-pane |
| Dialogs (confirm) | bottom action sheet | bottom action sheet | centered modal | centered modal | centered modal |

### Source pattern -> target pattern examples

Every breakpoint transition needs a runnable example. If the transition is not in code, sidecoach soft-fails the flow.

**Navigation: hamburger drawer (XS) -> sidebar (MD) -> full nav bar (LG)**

```html
<!-- Mobile-first markup. Same DOM at every breakpoint. -->
<nav class="site-nav" aria-label="Primary">
  <button class="nav-toggle" aria-controls="nav-list" aria-expanded="false">
    <svg width="24" height="24" aria-hidden="true">...</svg>
    <span class="visually-hidden">Menu</span>
  </button>
  <ul id="nav-list" class="nav-list">
    <li><a href="/work">Work</a></li>
    <li><a href="/about">About</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</nav>
```

```css
/* XS: drawer. Toggle button visible, list hidden until expanded. */
.nav-toggle { display: inline-flex; min-width: 44px; min-height: 44px; }
.nav-list {
  position: fixed; inset: 0 0 0 auto; width: min(80vw, 320px);
  transform: translateX(100%); transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
  padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom);
}
.nav-toggle[aria-expanded="true"] + .nav-list { transform: translateX(0); }

/* MD: sidebar. Toggle gone, list always visible on the left. */
@media (min-width: 768px) {
  .nav-toggle { display: none; }
  .nav-list { position: static; transform: none; width: 240px; }
}

/* LG: full horizontal nav bar. */
@media (min-width: 1024px) {
  .nav-list { display: flex; gap: 1.5rem; width: auto; }
}
```

**Tables: stacked cards (XS-SM) -> horizontal scroll with sticky first column (MD) -> full table (LG)**

```html
<table class="data-table">
  <thead>
    <tr><th>Name</th><th>Email</th><th>Plan</th><th>Status</th></tr>
  </thead>
  <tbody>
    <tr>
      <td data-label="Name">Alex Chen</td>
      <td data-label="Email">alex@example.com</td>
      <td data-label="Plan">Pro</td>
      <td data-label="Status">Active</td>
    </tr>
  </tbody>
</table>
```

```css
/* XS-SM: stack each row as a card, label cells via data-label. */
@media (max-width: 767px) {
  .data-table thead { position: absolute; left: -9999px; } /* visually hidden, kept for SR */
  .data-table, .data-table tbody, .data-table tr, .data-table td { display: block; width: 100%; }
  .data-table tr { padding: 1rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 0.75rem; }
  .data-table td { display: flex; justify-content: space-between; padding: 0.5rem 0; border: 0; }
  .data-table td::before { content: attr(data-label); font-weight: 600; }
}

/* MD: horizontal scroll inside a wrapper with sticky first column. */
@media (min-width: 768px) and (max-width: 1023px) {
  .data-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .data-table th:first-child, .data-table td:first-child { position: sticky; left: 0; background: var(--surface); }
}

/* LG: native table layout, no scroll. */
```

**Filters: full-screen modal (XS) -> bottom drawer (SM) -> sidebar panel (MD+)**

```html
<button class="filters-trigger" aria-controls="filters" aria-expanded="false">
  Filters <span class="count" aria-label="3 active">(3)</span>
</button>
<aside id="filters" class="filters-panel">
  <header><h2>Filters</h2><button class="close">Done</button></header>
  <form>...</form>
</aside>
```

```css
/* XS: full-screen modal. */
.filters-panel {
  position: fixed; inset: 0; transform: translateY(100%);
  transition: transform 250ms cubic-bezier(0.2, 0, 0, 1);
  padding: env(safe-area-inset-top) 1rem env(safe-area-inset-bottom);
  overflow-y: auto;
}
.filters-trigger[aria-expanded="true"] ~ .filters-panel { transform: translateY(0); }

/* SM: bottom drawer (sheet). */
@media (min-width: 480px) and (max-width: 767px) {
  .filters-panel { top: auto; height: 75vh; border-radius: 16px 16px 0 0; }
}

/* MD+: persistent sidebar, no transform. */
@media (min-width: 768px) {
  .filters-trigger { display: none; }
  .filters-panel { position: static; transform: none; width: 280px; height: auto; }
}
```

---

## Mobile Navigation Patterns (DEEP)

The mobile-nav landscape, synthesized from component.gallery (60 component types, 95 design systems, 2672 examples), iOS Human Interface Guidelines, and 2026 industry research. Sidecoach uses this section as a decision tree before emitting any navigation component.

### Decision tree

1. **3-5 primary destinations users switch between often?** Use a **bottom tab bar** (mobile) that transitions to a **horizontal nav** (desktop). Strongest engagement metrics across the catalog; matches one-handed thumb zone.
2. **6-10 destinations OR multi-level hierarchy?** Use a **drawer / off-canvas sidebar** triggered by a hamburger icon. Acknowledge the discoverability cost.
3. **2-4 mutually exclusive views of the same content?** Use a **segmented control** inside the screen. This is not navigation between sections - it is a filter on the current section. Tab bars and segmented controls do different jobs; do not substitute one for the other.
4. **Power users + searchable command space?** Add a **command palette** as an enhancement layer on top of any of the above. Never replace primary navigation with a palette.
5. **Single dominant action that should always be reachable?** Use a **floating action button (FAB)** for that one action. Maximum one FAB per screen. The FAB is not navigation.
6. **Many destinations, frequent jumps, screen real estate at a premium?** Combine: **bottom tab bar (3-5 most-used)** + **hamburger drawer (everything else)**. This hybrid is the NN/g recommendation for most consumer sites.

### Hamburger menu (drawer triggered by 3-line icon)

- **What it is.** An off-canvas drawer (usually right-edge or left-edge) hidden behind a three-line icon. Saves screen space, hides navigation.
- **When to use.** Secondary navigation (settings, help, account, infrequent destinations). 6+ destinations. Multi-level menus. When the primary nav is a tab bar and the hamburger is the overflow.
- **When NOT to use.** As the only navigation for a consumer app with 3-5 main sections - documented 30%+ engagement drop vs. visible tab bar. For users with motor or cognitive disabilities, the hidden state is a tax.
- **Canonical implementation.**

```html
<button
  class="hamburger"
  aria-controls="drawer"
  aria-expanded="false"
  aria-label="Open menu"
>
  <svg width="24" height="24" aria-hidden="true">
    <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
  </svg>
</button>
<dialog id="drawer" class="drawer" aria-label="Site navigation">
  <button class="drawer-close" aria-label="Close menu">...</button>
  <nav>...</nav>
</dialog>
```

```css
.hamburger { min-width: 44px; min-height: 44px; display: inline-flex; align-items: center; justify-content: center; }
.drawer {
  position: fixed; inset: 0 0 0 auto; width: min(85vw, 360px); height: 100dvh;
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  transform: translateX(100%);
  transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
  border: 0; max-height: 100dvh;
}
.drawer[open] { transform: translateX(0); }
.drawer::backdrop { background: rgba(0, 0, 0, 0.5); }
```

- **Accessibility.** `aria-controls`, `aria-expanded` on the trigger. `aria-label` on the drawer if no visible heading. Focus moves to the close button (or first focusable element) on open, returns to the trigger on close. `Escape` closes. Trap focus while open. Backdrop click closes.
- **Performance.** Drawer slides in via `transform`, not `left` or `width` - transform composites on the GPU and stays 60fps. Add `will-change: transform` only on the active drawer, not preemptively.
- **Component.gallery examples to study.** Drawer (60+ examples across systems including Shopify Polaris, IBM Carbon, Adobe Spectrum). Navigation (overlapping coverage of the trigger button pattern).

### Bottom navigation bar (tab bar)

- **What it is.** A row of 3-5 destinations fixed to the bottom of the viewport, each with an icon and label. Native iOS and Android pattern.
- **When to use.** 3-5 top-level destinations users switch between often. Apps where discoverability of all primary sections matters more than screen real estate. The default for consumer mobile experiences.
- **When NOT to use.** 6+ destinations (use drawer or tabs + overflow). Content-heavy single-purpose apps (e.g., a reader) where the bar steals reading space. Desktop - bottom nav is a mobile pattern, not a desktop one.
- **Canonical implementation.**

```html
<nav class="bottom-nav" aria-label="Primary">
  <ul>
    <li><a href="/home" aria-current="page">
      <svg width="24" height="24" aria-hidden="true">...</svg>
      <span>Home</span>
    </a></li>
    <li><a href="/search">
      <svg width="24" height="24" aria-hidden="true">...</svg>
      <span>Search</span>
    </a></li>
    <li><a href="/profile">
      <svg width="24" height="24" aria-hidden="true">...</svg>
      <span>Profile</span>
    </a></li>
  </ul>
</nav>
```

```css
.bottom-nav {
  position: fixed; inset: auto 0 0 0;
  padding-bottom: env(safe-area-inset-bottom); /* clear the home indicator */
  background: var(--surface-elevated);
  box-shadow: 0 -1px 0 rgba(0,0,0,0.06), 0 -4px 16px rgba(0,0,0,0.04);
}
.bottom-nav ul { display: flex; justify-content: space-around; list-style: none; margin: 0; padding: 0; }
.bottom-nav a {
  display: flex; flex-direction: column; align-items: center; gap: 0.125rem;
  min-width: 64px; min-height: 56px; /* 56 = comfortable above-44 with label */
  padding: 0.5rem;
  text-decoration: none; color: var(--text-muted);
  font-size: 0.6875rem; /* 11px label */
}
.bottom-nav a[aria-current="page"] { color: var(--text-primary); }
.bottom-nav a:active { transform: scale(0.96); transition: transform 100ms; }

/* Hide on desktop in favor of horizontal nav above. */
@media (min-width: 1024px) {
  .bottom-nav { display: none; }
}
```

- **Accessibility.** `aria-current="page"` on the active tab (NOT `aria-selected` - that is for tablist roles). Labels are required - icon-only tabs fail screen readers and confuse first-time users. Hit target per tab is at least 44x44, and the whole bar plus safe-area padding clears the iOS home indicator.
- **Performance.** Position: fixed forces a new compositor layer. Avoid heavy backdrop-filter unless tested on low-end Android.
- **Component.gallery examples to study.** Navigation (95 systems' takes), Tabs (close cousin, different semantics).

### Drawer / off-canvas sidebar

- **What it is.** A panel that slides in from an edge (left, right, top, or bottom). Larger than a drawer-menu - can contain full UI (filter panels, settings, secondary content).
- **When to use.** Filters, settings, secondary navigation, contextual detail panels. When the content is too large for a popover but should not take over the whole screen on desktop.
- **When NOT to use.** Primary navigation on a small viewport where the user expects a tab bar. Triggered by hover (touch users cannot hover).
- **Canonical implementation.** Use the native `<dialog>` element with the `:modal` capability for free focus trapping and Escape handling.

```html
<button data-drawer-trigger="filters">Filters</button>
<dialog id="filters" class="drawer" aria-labelledby="filters-title">
  <header>
    <h2 id="filters-title">Filters</h2>
    <button data-drawer-close>Close</button>
  </header>
  <form>...</form>
</dialog>
```

- **Accessibility.** `<dialog>` with `.showModal()` handles focus trap and Escape. If a polyfill or non-dialog implementation, implement manually: trap focus, restore focus on close, `aria-modal="true"`, `Escape` to dismiss.
- **Performance.** Same `transform` rule as the drawer menu.
- **Component.gallery examples to study.** Drawer (the dedicated component type).

### Segmented control

- **What it is.** A row of 2-4 mutually exclusive options styled as a single horizontal control. NOT navigation - a filter or view-switcher within the current screen.
- **When to use.** Switching contexts within one screen: "All / Mentions / Unread" on a message list. "Day / Week / Month" on a calendar. "List / Grid" view toggle.
- **When NOT to use.** Navigation between distinct sections of an app - that is what a tab bar does. With more than 4 options - the segments become too narrow to tap. With more than 1 selected item - segmented controls are single-select.
- **Canonical implementation.**

```html
<div role="radiogroup" aria-label="View" class="segmented">
  <input type="radio" id="seg-list" name="view" value="list" checked />
  <label for="seg-list">List</label>
  <input type="radio" id="seg-grid" name="view" value="grid" />
  <label for="seg-grid">Grid</label>
</div>
```

```css
.segmented { display: inline-flex; padding: 0.125rem; background: var(--surface-muted); border-radius: 8px; }
.segmented input { position: absolute; opacity: 0; pointer-events: none; }
.segmented label {
  min-width: 44px; min-height: 36px;
  padding: 0.5rem 1rem;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px;
  cursor: pointer;
}
.segmented input:checked + label {
  background: var(--surface-elevated);
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}
```

- **Accessibility.** Native radio inputs - no custom ARIA needed. Arrow keys move selection (free with radio inputs).
- **Component.gallery examples to study.** Segmented control (dedicated type).

### Tab bar (within-screen tabs, not bottom nav)

- **What it is.** A row of tabs that switches the visible panel beneath them. ARIA `tablist` semantics.
- **When to use.** 2-6 related views of the same content, where context is preserved across tabs (e.g., "Overview / Reviews / Q&A" on a product page).
- **When NOT to use.** Tabs that lead to different URLs (that is navigation, use `<nav>` with links). When tab labels are long and would overflow on mobile - switch to a `<select>` or segmented control with the same options.
- **Canonical implementation.** Use `role="tablist"`, `role="tab"`, `role="tabpanel"`, manage `aria-selected`, manage focus with arrow keys. Component.gallery's Tabs page has 80+ examples - study one with the "Accessibility" feature tag.
- **Mobile fallback.** When 4+ tabs overflow at 375px, enable horizontal scroll with the active tab scrolled into view, OR collapse to an accordion. Never let tab labels truncate with ellipsis - the user cannot read what they are choosing.

### Command palette (mobile invocation)

- **What it is.** A keyboard-first overlay (`Cmd+K`, `Cmd+P`, `/`) that lets users search and execute any command. Linear, Slack, Superhuman, GitHub, Raycast.
- **When to use.** As an enhancement on top of primary navigation, for power users. When the destination space is large enough that scanning a menu is slower than typing.
- **When NOT to use.** As primary navigation. As the only way to reach a destination. On mobile-only experiences without a meaningful keyboard.
- **Mobile invocation.** On touch devices, expose the palette with a visible trigger: a search bar in the header, a magnifying-glass icon in the bottom nav, or a floating button. The `Cmd+K` shortcut still works for users with attached keyboards (iPad with Magic Keyboard, Android with Bluetooth keyboard) but cannot be the only trigger.
- **Canonical implementation.** Component.gallery does not yet have a dedicated Command Palette type; the closest catalog entries are Combobox + Modal. Study Linear's, Raycast's, Superhuman's. Maggie Appleton's "Command Bar" essay and uxpatterns.dev's Command Palette page document the interaction.
- **Accessibility.** `role="combobox"` on the input, `role="listbox"` on the results, `role="option"` on each result. `aria-activedescendant` follows the highlighted result without moving DOM focus. Arrow keys move highlight, Enter executes, Escape closes.

### Floating action button (FAB)

- **What it is.** A circular button floating above content, anchored bottom-right (LTR), representing the single most important action on the screen.
- **When to use.** One dominant action that is exercised frequently (compose mail, create note, scan barcode). Used in Material Design products and many Google apps.
- **When NOT to use.** When there is no single dominant action. When the screen has multiple equally important actions (use a sticky action bar instead). Above content that the user needs to read - position to clear safe areas, avoid covering interactive content.
- **Canonical implementation.**

```html
<button class="fab" aria-label="New message">
  <svg width="24" height="24" aria-hidden="true">...</svg>
</button>
```

```css
.fab {
  position: fixed;
  right: max(1rem, env(safe-area-inset-right));
  bottom: calc(env(safe-area-inset-bottom) + 1rem + 56px); /* clear bottom nav too */
  width: 56px; height: 56px; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15), 0 2px 4px rgba(0,0,0,0.1);
}
.fab:active { transform: scale(0.96); }
```

---

## Hit Area Rules

The standard sidecoach enforces is 44x44px minimum at all breakpoints. This is the WCAG 2.5.5 "enhanced" target size, the iOS Human Interface Guidelines minimum, and the size shown by industry research to reduce motor-impairment tap errors to near zero.

The make-interfaces-feel-better skill specifies 40x40px as a floor. Sidecoach overrides that to 44x44 for consistency with WCAG 2.5.5, iOS HIG, and the bencium responsive table. Use 44 anywhere the platform does not specify a larger native minimum (Android's 48dp). When a project's design language demands a smaller visible control (an icon button at 24px, a checkbox at 20px), extend the hit area with a pseudo-element to 44x44 - never shrink the hit area.

### Rules

1. **44x44px minimum, all breakpoints.** Not 40, not 32, not "compensated by spacing." The minimum is the minimum.
2. **Hit areas may not overlap.** If two 44x44 hit areas would collide, increase the spacing between the visible controls until they do not.
3. **Visible can be smaller, hit area cannot.** Use a pseudo-element to extend the hit area when the visible control is small.
4. **Touch targets at the bottom edge need extra clearance.** Add `env(safe-area-inset-bottom)` padding so the home indicator does not eat the bottom row.
5. **For `pointer: coarse` (touch), grow padding.** For `pointer: fine` (mouse/trackpad), the minimum can be relaxed to 32x32 if and only if the visible target is at least 24x24. Use the media-query split below.

### Pseudo-element extension pattern

```css
/* Visible icon button at 24x24, hit area extended to 44x44. */
.icon-btn {
  position: relative;
  width: 24px; height: 24px;
  display: inline-flex; align-items: center; justify-content: center;
}
.icon-btn::before {
  content: "";
  position: absolute;
  inset: 50% auto auto 50%;
  width: 44px; height: 44px;
  transform: translate(-50%, -50%);
  /* Invisible but tappable. */
}
```

### Touch-vs-mouse density split

```css
/* Default to touch-friendly sizing. */
.btn { min-width: 44px; min-height: 44px; padding: 0.75rem 1rem; }

/* Tighten for fine pointers. */
@media (pointer: fine) {
  .btn { min-width: 32px; min-height: 32px; padding: 0.5rem 0.875rem; }
}
```

---

## Fluid Type

Bencium's `clamp()` formulas, plus the ratio-swap-by-breakpoint pattern for type systems with multiple scales.

### Clamp formula

`clamp(min, fluid, max)` - the fluid argument is `1rem + Xvw` where X scales between min and max across the viewport range you want.

```css
:root {
  --step--1: clamp(0.875rem, 0.85rem + 0.125vw, 1rem);     /* 14 -> 16 */
  --step-0:  clamp(1rem,     0.95rem + 0.25vw,  1.125rem); /* 16 -> 18 */
  --step-1:  clamp(1.25rem,  1.15rem + 0.5vw,   1.5rem);   /* 20 -> 24 */
  --step-2:  clamp(1.5rem,   1.35rem + 0.75vw,  2rem);     /* 24 -> 32 */
  --step-3:  clamp(2rem,     1.7rem + 1.5vw,    3rem);     /* 32 -> 48 */
  --step-4:  clamp(2.5rem,   2rem + 2.5vw,      4rem);     /* 40 -> 64 */
}

h1 { font-size: var(--step-4); }
h2 { font-size: var(--step-3); }
h3 { font-size: var(--step-2); }
p  { font-size: var(--step-0); }
small { font-size: var(--step--1); }
```

A typescale calculator (utopia.fyi) produces these values mechanically. Plug in min screen, max screen, min size, max size, ratio. Paste the output.

### Ratio swap by breakpoint

Some type systems use a tighter scale on mobile and an opener scale on desktop, on the theory that long-form reading at 1.125 on desktop needs more h2/h1 contrast than at 1.06 on mobile.

```css
:root {
  --scale-ratio: 1.125; /* minor third, mobile */
}
@media (min-width: 1024px) {
  :root { --scale-ratio: 1.25; /* major third, desktop */ }
}
/* Each step recomputed via calc when needed, or generated build-time. */
```

Most projects do not need this. Use it when the brand register is bold-editorial and the mobile defaults feel cramped relative to the desktop hero.

### Body text rules at all breakpoints

- Body text minimum 16px on mobile. Below 16, iOS Safari auto-zooms inputs on focus (because it assumes the text is too small to read), which is a worse experience than slightly larger text.
- Line length 45-75 characters for body. Constrain via `max-width` on text containers: `max-width: 65ch` is the common token.
- Line height 1.5-1.6 for body, 1.1-1.25 for headings. Heading line-height tightens as size grows.

---

## Responsive Anti-Patterns (NAMED)

Sidecoach flags these by name during audit. Each has a known better alternative.

1. **Desktop-first CSS with `min-width` queries adding mobile as the exception.** The mobile experience pays a tax (downloading and parsing desktop styles) to be the special case. Flip it: write mobile as the default, add complexity at larger breakpoints with `min-width`.
2. **Hiding content with `display: none` on mobile without an alternative path.** If the content was important enough to ship to desktop, it is important enough to be reachable on mobile. Use progressive disclosure (accordion, drill-in, drawer) instead of vanishing.
3. **Tap targets smaller than 44x44 with claim of "compensated by spacing."** Spacing helps targeting but does not satisfy WCAG 2.5.5 or iOS HIG. Hit area is hit area.
4. **Horizontal scroll on a vertical-content layout.** Body scrolling horizontally is a bug. Tables, image galleries, and explicitly designed carousels can scroll horizontally inside their own region, but the page must not.
5. **Modal overlays that do not fit the smallest target viewport.** A modal at 600px with no responsive override breaks at 375px. Use `width: min(600px, calc(100vw - 2rem))` or transition to full-screen on XS-SM.
6. **Tables that require horizontal scroll without a card-stacked alternative.** Horizontal-scroll tables can be a fallback at MD, but XS and SM need the card pattern (see Pattern Transitions).
7. **Hover-only interactions with no touch equivalent.** Hover-revealed action menus, hover-only tooltips with information that is not visually labelled, hover-only dropdowns. Use `@media (hover: none)` and `@media (pointer: coarse)` to confirm the touch path works.
8. **Fixed-position elements that overlap content on iOS Safari (the address-bar shrink gotcha).** `100vh` does not equal the visible area when iOS Safari's address bar collapses on scroll - the element ends up taller than expected and overlaps the bottom bar. Use `100svh` (small viewport height) for "fit on initial render," `100dvh` (dynamic viewport height) for "follow the viewport as the bars expand and collapse," `100lvh` (large viewport height) for "be as tall as the viewport ever gets." See WebKit bug 261185 for the long history. The legacy fallback `min-height: -webkit-fill-available` is still useful for older Safari support.
9. **Using viewport size to infer input method.** A 1024px viewport could be a desktop, a touch laptop, a Surface tablet, or an iPad with Magic Keyboard. Detect input method with `@media (pointer: coarse)` and `@media (hover: none)`, not with screen width.
10. **Ignoring `prefers-reduced-motion` on responsive transitions.** Drawer slide-ins, accordion expansions, and FAB scale-on-press should respect `@media (prefers-reduced-motion: reduce)` by removing or shortening the transition.
11. **Breakpoint values chosen to match a device list (iPhone 14 = 390px).** Devices change. Content does not. Choose breakpoints where the content breaks, then verify they roughly align with common device sizes.
12. **Forgetting landscape orientation on mobile.** Test at 812x375 (iPhone landscape) and 1024x768 (iPad landscape). The home indicator and the safe area are on a different edge in landscape - assumptions about `env(safe-area-inset-bottom)` may be wrong.
13. **Cramming the navigation drawer with everything.** A drawer with 30 items defeats the discoverability argument for hiding it in the first place. If the drawer would have more than 12 items, restructure: most-used go in a bottom tab bar, the rest in a drawer organized by category.
14. **Bottom nav with more than 5 tabs.** Each additional tab shrinks the others below 44px width. The pattern's selling point - thumb-reachable, scannable - dies at 6+.
15. **Reading tap-state width from JS at first paint.** `window.matchMedia('(pointer: coarse)').matches` is safe to read in JS, but reading `window.innerWidth` to pick layouts ships layout shift. Prefer CSS media queries, accept that the server cannot know the viewport.

---

## Touch vs Mouse Detection

Detect input method, not screen size. A device with `(pointer: coarse)` (touch primary) gets the larger hit areas; a device with `(pointer: fine)` (mouse/trackpad primary) gets the tighter density.

```css
/* Coarse pointer (touch, stylus) - larger touch targets. */
@media (pointer: coarse) {
  button, a.button, [role="button"] {
    min-width: 44px;
    min-height: 44px;
    padding: 0.75rem 1.25rem;
  }
}

/* Fine pointer (mouse, trackpad) - tighter density. */
@media (pointer: fine) {
  button, a.button, [role="button"] {
    min-width: 32px;
    min-height: 32px;
    padding: 0.5rem 1rem;
  }
}

/* Hover-only interactions - gate behind hover capability. */
@media (hover: hover) {
  .card:hover { transform: translateY(-2px); }
}

/* No hover (touch) - use :active or explicit toggle instead. */
@media (hover: none) {
  .card:active { transform: translateY(-1px); }
}
```

### The hover-availability rule

If a feature is only reachable on hover, it does not exist on touch devices. Confirm every hover interaction has an equivalent touch path:

- Hover-revealed action menu -> long-press, or always-visible icon, or explicit "More" button.
- Hover-revealed tooltip -> tap-to-show with `aria-describedby` and `Escape` to dismiss; OR move the information into a visible caption.
- Hover-only dropdown -> click-triggered dropdown that also opens on hover (the additive pattern).

### Safe-area insets (notch, home indicator, rounded corners)

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
```

```css
body {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
  padding-left: env(safe-area-inset-left);
  padding-right: env(safe-area-inset-right);
}
/* With a sensible fallback for non-notched devices. */
.footer { padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
```

Without `viewport-fit=cover` in the meta tag, `env()` returns 0 on iOS Safari. The meta tag is mandatory for safe-area to work at all.

---

## Container Queries Note

Media queries are the right tool for **page-level layout** and **OS-level preferences** (`prefers-color-scheme`, `prefers-reduced-motion`). Container queries are the right tool for **components that need to adapt based on their container, not the viewport** - a card that renders 1-column in a sidebar but 3-column in a hero, a navigation bar that collapses based on the space it has, a button group that wraps based on its parent width.

```css
.card-grid {
  container-type: inline-size;
}
.card { /* 1 column by default */ display: grid; gap: 1rem; }
@container (min-width: 600px) { .card { grid-template-columns: 1fr 1fr; } }
@container (min-width: 900px) { .card { grid-template-columns: repeat(3, 1fr); } }
```

Use both. Page-level: media queries. Component-level: container queries when the component is reused at different sizes. The two are complementary, not competitive.

---

## Responsive Degrade Plan Template

Every component sidecoach emits must accompany the code with a degrade plan. Either inline as a code comment block at the top of the file, or as an adjacent `responsive.md`.

```
COMPONENT: <name>

DEGRADE PLAN:
- XS (0-479px):  <explicit behavior>
- SM (480-767px): <explicit behavior>
- MD (768-1023px): <explicit behavior>
- LG (1024-1439px): <explicit behavior>
- XL (1440px+): <explicit behavior>

TOUCH TARGETS:
- All breakpoints: <smallest hit area, must be >= 44x44px>
- Coarse pointer override: <if different>
- Fine pointer override: <if tighter>

CONTENT BEHAVIOR:
- Hides on XS/SM: <none | itemized list with alternate path>
- Drill-in / progressive disclosure points: <itemized>
- Reflows: <which sections change column count, where>

TEST CASES:
- [ ] Renders at 375px without horizontal page scroll
- [ ] Renders at 768px without horizontal page scroll
- [ ] Renders at 1024px without horizontal page scroll
- [ ] All interactive elements measure >= 44x44px at 375px
- [ ] All interactive elements measure >= 44x44px at 768px
- [ ] Hover interactions have touch equivalents (manual check)
- [ ] Respects prefers-reduced-motion on transitions
- [ ] env(safe-area-inset-bottom) clears the home indicator on iOS
- [ ] No content disappears below 480px without an alternate path
```

Without a degrade plan, the component is incomplete. Sidecoach should soft-fail the implementation flow (Flow G in the sidecoach taxonomy) until the degrade plan is documented in code comments or in an accompanying responsive.md.

---

## Mandatory Verification Steps

Before Flow J (tactical polish) completes, sidecoach must:

1. **Render at 375px and screenshot.** Read the screenshot, describe what is on screen, and confirm nothing critical is cut off, hidden, or overlapping.
2. **Render at 768px and screenshot.** Same.
3. **Render at 1024px and screenshot.** Same.
4. **Confirm the nav fits at 375px without overflow.** No horizontal page scroll. If a top nav, the hamburger toggle is visible; if a bottom nav, all tabs fit and clear the home indicator.
5. **Confirm hit areas measure 44x44px at 375px.** Use the browser inspector to measure the smallest interactive element. If under 44, fail and fix.
6. **Confirm no unintentional horizontal scroll.** Scrollable regions (carousels, horizontal tables on MD) are fine if they are intentional and visually contained. The `<body>` scrolling horizontally is a fail.
7. **Confirm hover interactions have touch equivalents.** Spot-check by toggling Chrome DevTools' "emulate touch" device mode and confirming all hover-triggered actions are reachable via tap.
8. **Confirm safe-area insets are respected on iOS Safari.** Either via a real device, or by simulating with `env()` and `viewport-fit=cover` and checking that bottom-fixed elements clear ~34px (iPhone 14 home indicator height).
9. **Confirm `prefers-reduced-motion` softens transitions.** Toggle the macOS / iOS / Android "reduce motion" setting and confirm slide-in drawers, accordion expansions, and other animated transitions either disable or shorten under 100ms.

These are not optional. The Verification Protocol in CLAUDE.md applies in full: take the screenshot, Read it (not just save it), describe what you see. A screenshot you did not Read does not exist.

---

## What This Covers Better Than Each Source

- **Beyond Bencium's RESPONSIVE-DESIGN.md.** Adds the named anti-pattern catalogue, the touch-vs-mouse detection rules with the hover-availability check, the iOS safe-area + notch implementation pattern, the mandatory verification steps tied to Flow J, the per-pattern source-to-target code examples, and the deep mobile-nav decision tree.
- **Beyond the predecessor adapt reference.** Adds the exact breakpoint values (Bencium's table), the exact pattern transitions per breakpoint with code, the WCAG 2.5.5 44x44 standard (the predecessor allows 44 but does not specify a single canonical floor), and the named anti-patterns.
- **Beyond the predecessor responsive reference.** Adds the deep nav-pattern landscape, the segmented-control vs tab-bar distinction from iOS HIG, the command-palette mobile invocation rules, the FAB rules, container queries vs media queries guidance, and the degrade-plan template.
- **Beyond make-interfaces-feel-better.** Raises the hit-area floor from 40 to 44 (WCAG 2.5.5), adds the breakpoint-aware density split (coarse vs fine pointer), and turns the single rule into an enforceable degrade-plan checkpoint.
- **Beyond component.gallery.** Synthesizes the mobile-nav landscape (Navigation, Drawer, Tabs, Segmented control, plus Combobox + Modal for command palette) into a single decision tree with explicit "when to use / when not to use" guidance. The gallery catalogues; this reference decides.

---

## Sources

- Bencium responsive table: https://github.com/bencium/bencium-marketplace/blob/main/bencium-impact-designer/skills/bencium-impact-designer/RESPONSIVE-DESIGN.md
- WCAG 2.5.5 Target Size (Enhanced): https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- iOS Human Interface Guidelines, Tab Views: https://developer.apple.com/design/human-interface-guidelines/tab-views
- iOS Human Interface Guidelines, Segmented Controls: https://developer.apple.com/design/human-interface-guidelines/segmented-controls
- CSS Working Group, small / large / dynamic viewport units: https://www.bram.us/2021/07/08/the-large-small-and-dynamic-viewports/
- WebKit bug 261185 (svh / dvh history): https://bugs.webkit.org/show_bug.cgi?id=261185
- Mobile navigation patterns research, 2026: https://www.uxpin.com/studio/blog/mobile-navigation-examples/ and https://phone-simulator.com/blog/mobile-navigation-patterns-in-2026
- Container queries 2026 guidance: https://blog.logrocket.com/container-queries-2026/
- Command palette pattern: https://uxpatterns.dev/patterns/advanced/command-palette and https://maggieappleton.com/command-bar
- Component.gallery (mobile nav patterns catalogue): https://component.gallery/components/navigation/, /drawer/, /tabs/, /segmented-control/
- Predecessor adapt and responsive-design references (extracted at sidecoach/reference/_extracted/legacy-design-skill/reference/)
- Make-interfaces-feel-better, hit area rule (local: /Users/spare3/.agents/skills/make-interfaces-feel-better/SKILL.md, principle 16)
