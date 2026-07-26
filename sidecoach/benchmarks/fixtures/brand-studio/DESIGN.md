---
colors:
  brand:
    ink: "#0F0E0C"
    cream: "#F2EFE6"
    accent: "#B23A14"
  text:
    primary: "#0F0E0C"
    secondary: "#54524C"
    tertiary: "#8B8780"
    inverse: "#F2EFE6"
  surface:
    canvas: "#F2EFE6"
    raised: "#FBF8F0"
    inverse: "#0F0E0C"
  border:
    soft: "rgba(15,14,12,0.08)"
    firm: "rgba(15,14,12,0.16)"

typography:
  display:
    family: "'GT Sectra', 'Source Serif 4', Charter, Georgia, serif"
    weights: [400, 700]
  body:
    family: "'Inter', system-ui, sans-serif"
    weights: [400, 500]
  mono:
    family: "'JetBrains Mono', ui-monospace, monospace"
  scale:
    base: "17px"
    line_height: 1.55
    measure: "62ch"
    sizes:
      xs: "0.78rem"
      sm: "0.88rem"
      base: "1rem"
      lg: "1.18rem"
      xl: "1.5rem"
      "2xl": "2rem"
      "3xl": "3rem"
      "4xl": "4.5rem"

rounded:
  none: "0px"
  sm: "4px"
  md: "8px"
  lg: "12px"
  full: "9999px"

spacing:
  scale: "4px"
  sizes:
    "1": "4px"
    "2": "8px"
    "3": "12px"
    "4": "16px"
    "6": "24px"
    "8": "32px"
    "12": "48px"
    "16": "64px"
    "24": "96px"

shadow:
  sm: "0 1px 2px rgba(15,14,12,0.06)"
  md: "0 2px 8px rgba(15,14,12,0.08)"

motion:
  ease:
    out: "cubic-bezier(0.2, 0, 0, 1)"
    in_out: "cubic-bezier(0.4, 0, 0.2, 1)"
  duration:
    fast: "120ms"
    base: "200ms"
    slow: "400ms"
---

# DESIGN.md

## Color

Two-color brand: warm ink and cream, with a single tactical accent reserved for headlines or marks that need to land. Body type is ink-on-cream; surfaces step up to paper for raised cards.

## Typography

Serif display, neutral sans body, monospace for captions and metadata. Tracking and leading tuned for an editorial cadence: 17px base, 1.55 leading, 62ch measure. Display sizes step on a 1.25 ratio.

## Spacing

4px base grid. Vertical rhythm at 8px increments. Section gaps default to 96px on desktop, 48px on small screens.

## Components

Restrained component vocabulary: heading, paragraph, eyebrow, button, link, image, caption, footnote. No marketing widgets.

## Motion

Reduced-motion respects user preference. Default transition is 200ms ease-out; cross-fades for image swaps, no scroll-driven theatrics.

## States

Hover: 8% ink tint on surfaces, 100% accent on links. Active: scale(0.96) on buttons. Focus: 2px accent ring. Disabled: 40% opacity.
