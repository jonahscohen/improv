---
source: https://github.com/bencium/bencium-claude-code-design-skill/blob/main/bencium-controlled-ux-designer/skills/bencium-controlled-ux-designer/ACCESSIBILITY.md
captured: 2026-05-25
type: external-taste-skill (a11y reference)
---

# Bencium - Accessibility (VERBATIM + EXTENSION)

## SECTION 1: VERBATIM LIFT

WCAG 2.1 AA standards reference.

### Core Principles (POUR)

- **Perceivable** - Information and UI components must be presentable in ways users can perceive.
- **Operable** - UI components and navigation must be operable by all users.
- **Understandable** - Information and operation of UI must be understandable.
- **Robust** - Content must be robust enough for a wide variety of user agents, including assistive technologies.

### Semantic HTML

Use real elements: `<header>`, `<nav>`, `<main>`, `<article>`, `<aside>`, `<footer>`, `<section>`. Never use `<div class="header">` when `<header>` exists.

### Heading Hierarchy

Correct:
```
<h1>Page Title</h1>
  <h2>Section 1</h2>
    <h3>Subsection 1.1</h3>
  <h2>Section 2</h2>
```

Incorrect (skips levels): `<h1>` -> `<h4>`. NEVER skip.

### Keyboard Navigation

```tsx
<button
  className="focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2 rounded-lg"
  tabIndex={0}
>

// Custom interactive elements need tabindex AND keyboard handlers
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') handleClick();
  }}
>
```

`tabIndex={-1}` removes from tab order but allows programmatic focus.

### Skip Links (mandatory for keyboard users)

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg"
>
  Skip to main content
</a>
<main id="main-content">
```

### ARIA Landmark Roles

```tsx
<nav role="navigation" aria-label="Main navigation">
<header role="banner">
<main role="main">
<aside role="complementary" aria-label="Related articles">
<footer role="contentinfo">
<form role="search" aria-label="Site search">
```

### ARIA Labels

```tsx
// aria-label for elements without visible text
<button aria-label="Close dialog"><X size={24} /></button>

// aria-labelledby to reference another element
<div role="dialog" aria-labelledby="dialog-title">
  <h2 id="dialog-title">Confirm Action</h2>
</div>

// aria-describedby for additional description
<input type="password" aria-describedby="password-requirements" />
<p id="password-requirements">Password must be at least 8 characters</p>
```

### ARIA States (critical patterns)

```tsx
// aria-expanded for expandable elements
<button aria-expanded={isOpen} aria-controls="dropdown-menu">

// aria-pressed for toggle buttons
<button aria-pressed={isPressed}>

// aria-selected for selectable items
<div role="tab" aria-selected={isActive}>

// aria-checked for custom checkboxes
<div role="checkbox" aria-checked={isChecked} tabIndex={0}>

// aria-invalid for form validation
<input type="email" aria-invalid={hasError} aria-describedby={hasError ? 'email-error' : undefined} />
```

### ARIA Live Regions

```tsx
// Polite announcements (status messages)
<div role="status" aria-live="polite" aria-atomic="true">

// Urgent announcements (errors)
<div role="alert" aria-live="assertive" aria-atomic="true">
```

### Color Contrast (WCAG AA)

- **Normal text:** 4.5:1
- **Large text (18pt+ or 14pt+ bold):** 3:1
- **UI components and graphics:** 3:1

Don't rely on color alone - pair with icons or text labels.

### Focus Management

```tsx
<button className="focus:outline-none focus:ring-4 focus:ring-blue-500 focus:ring-offset-2">
```

The `ring-offset-2` prevents the ring from touching the button border.

---

## SECTION 2: EXTENSION

### The POUR framework as a triage tool

When auditing accessibility, walk through POUR in order:

1. **Perceivable**: Can the user see/hear/sense it?
   - Contrast ratios (4.5:1 / 3:1)
   - Alt text on images
   - Captions on video
   - No info-by-color-alone

2. **Operable**: Can the user actually use it?
   - Keyboard reachable
   - Focus visible
   - Touch targets >= 44x44px
   - No keyboard traps

3. **Understandable**: Does the user comprehend it?
   - Labels on form fields
   - Error messages that say what's wrong AND how to fix it
   - Consistent navigation patterns
   - Plain language

4. **Robust**: Does it work with assistive tech?
   - Real semantic HTML
   - ARIA labels where semantics insufficient
   - Tested with screen reader (VoiceOver / NVDA)
   - No keyboard-only or mouse-only interactions

### The "aria-expanded + aria-controls" pattern

For dropdowns, accordions, disclosures:

```tsx
<button
  aria-expanded={isOpen}
  aria-controls="dropdown-menu-id"
  onClick={() => setIsOpen(!isOpen)}
>
  Menu
</button>
<div id="dropdown-menu-id" hidden={!isOpen}>
  ...
</div>
```

`aria-expanded` tells the screen reader the current state. `aria-controls` tells it WHICH element this button controls. Both are needed for the pattern to work.

### Live region timing

- `aria-live="polite"` - screen reader announces AFTER current speech finishes
- `aria-live="assertive"` - screen reader interrupts current speech
- Reserve "assertive" for true errors. Status updates use "polite".

`aria-atomic="true"` makes the screen reader read the ENTIRE region, not just the changed part. Use for status messages that change ("Saved at 2:34 PM" -> "Saved at 2:35 PM" should re-read in full).

---

## SECTION 3: What this covers that oracle + make-interfaces-feel-better don't

1. **The POUR framework as a structured audit tool.** Sidecoach a11y handler validates against WCAG checklist; Bencium provides the conceptual triage layer.

2. **The complete ARIA landmark role table.** Specific roles for nav/header/main/aside/footer/search with example aria-labels.

3. **The aria-expanded + aria-controls dropdown pattern.** Specific, copyable.

4. **The aria-live polite vs assertive distinction with usage guidance.**

5. **The skip-link CSS pattern with focus-only visibility** (`sr-only focus:not-sr-only`). Specific Tailwind pattern.

6. **The custom-checkbox pattern with role + aria-checked + keyboard handler.** A specific recipe for when you can't use the native `<input type="checkbox">`.

7. **The aria-invalid + aria-describedby form validation pattern.** Links the input error state to the error message for screen readers.
