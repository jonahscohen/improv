---
colors:
  brand:
    ink: "#1A1A1A"
    paper: "#FFFFFF"
    accent: "#0040A1"
  status:
    ok: "#0E7C3A"
    warn: "#A65300"
    error: "#A8071A"
    info: "#0040A1"
  text:
    primary: "#1A1A1A"
    secondary: "#444444"
    tertiary: "#6E6E6E"
    inverse: "#FFFFFF"
  surface:
    canvas: "#FFFFFF"
    raised: "#F6F6F6"
    inverse: "#1A1A1A"
  border:
    soft: "#D0D0D0"
    firm: "#8A8A8A"
    strong: "#1A1A1A"

typography:
  display:
    family: "'Atkinson Hyperlegible', 'Inter', system-ui, sans-serif"
    weights: [400, 700]
  body:
    family: "'Atkinson Hyperlegible', 'Inter', system-ui, sans-serif"
    weights: [400, 700]
  mono:
    family: "'JetBrains Mono', ui-monospace, monospace"
  scale:
    base: "18px"
    line_height: 1.6
    measure: "56ch"
    sizes:
      sm: "16px"
      base: "18px"
      lg: "20px"
      xl: "24px"
      "2xl": "32px"

rounded:
  none: "0px"
  sm: "4px"
  md: "6px"

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
  none: "none"
  focus: "0 0 0 3px rgba(0,64,161,0.45)"

motion:
  ease:
    out: "cubic-bezier(0.2, 0, 0, 1)"
  duration:
    fast: "100ms"
    base: "150ms"

accessibility:
  contrast_target: "WCAG AA"
  min_target_size: "44px"
  focus_ring_width: "3px"
---

# DESIGN.md

## Color

High-contrast accessible palette. Ink on white passes WCAG AAA. Status colors all hit 4.5:1 against white. Color is never the sole signal: each status pairs with an icon and a label.

## Typography

Atkinson Hyperlegible primary - designed for low-vision readers. 18px base, 1.6 leading, 56ch measure for long-form prose. Single weight axis: regular and bold only.

## Spacing

4px grid. Form rows at 56px height. Label-to-input gap is 8px. Inline help text 4px below the input. Errors 8px below.

## Components

Input, select, textarea, checkbox, radio group, error summary, inline error, help text, progress indicator, submit button, secondary action, back link.

## Motion

Motion-light. Focus rings appear instantly. Transitions are 100-150ms color-only. prefers-reduced-motion fully disables transitions.

## States

Default: 1px firm border. Focus: 3px accent ring, 2px offset, never an outline-style change that shifts layout. Error: red text + icon + ring. Disabled: 60% opacity, no pointer-events.
