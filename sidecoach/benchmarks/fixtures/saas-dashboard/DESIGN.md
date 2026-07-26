---
colors:
  brand:
    blue: "#2563EB"
    slate: "#0F172A"
    fog: "#F8FAFC"
  status:
    ok: "#16A34A"
    warn: "#D97706"
    error: "#DC2626"
    info: "#0EA5E9"
  text:
    primary: "#0F172A"
    secondary: "#475569"
    tertiary: "#94A3B8"
    inverse: "#F8FAFC"
  surface:
    canvas: "#F8FAFC"
    raised: "#FFFFFF"
    inverse: "#0F172A"
  border:
    soft: "rgba(15,23,42,0.06)"
    firm: "rgba(15,23,42,0.12)"
    strong: "rgba(15,23,42,0.20)"

typography:
  display:
    family: "'Inter', system-ui, sans-serif"
    weights: [500, 600, 700]
  body:
    family: "'Inter', system-ui, sans-serif"
    weights: [400, 500, 600]
  mono:
    family: "'JetBrains Mono', ui-monospace, monospace"
    weights: [400, 500]
  scale:
    base: "14px"
    line_height: 1.45
    measure: "72ch"
    sizes:
      xs: "11px"
      sm: "12px"
      base: "14px"
      lg: "16px"
      xl: "20px"
      "2xl": "24px"
      "3xl": "30px"

rounded:
  none: "0px"
  sm: "4px"
  md: "6px"
  lg: "8px"
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

shadow:
  sm: "0 1px 2px rgba(15,23,42,0.05)"
  md: "0 2px 4px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.04)"
  popover: "0 8px 24px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.08)"

motion:
  ease:
    out: "cubic-bezier(0.2, 0, 0, 1)"
  duration:
    fast: "100ms"
    base: "150ms"
---

# DESIGN.md

## Color

Cool slate canvas, white raised surfaces, accent blue for primary actions. Status palette is colorblind-tested.

## Typography

Single-family Inter, sized for density. 14px base, 1.45 leading, tabular numerals on all metric displays. Mono for hashes, identifiers, timestamps.

## Spacing

4px grid. Table rows at 32px height with 8px horizontal padding. Sidebar items at 28px with 12px horizontal padding.

## Components

Table, sidebar nav, breadcrumb, popover, toast, dropdown, segmented control, status pill, metric card, log line, command palette.

## Motion

Motion-light by design. 100-150ms transitions on color changes only. No scroll animations. Reduced-motion is the default - opt in via the user-prefs menu.

## States

Hover: 6% slate tint on rows, 8% on buttons. Active: scale(0.96) on buttons. Focus: 2px blue ring, 2px offset. Disabled: 40% opacity, no pointer-events.
