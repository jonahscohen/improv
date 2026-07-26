---
colors:
  brand:
    void: "#08090C"
    paper: "#F3F1EC"
    accent: "#FF5B2E"
    spark: "#FFD24A"
  text:
    primary: "#08090C"
    secondary: "#3B3C40"
    inverse: "#F3F1EC"
  surface:
    canvas: "#F3F1EC"
    inverse: "#08090C"
  border:
    soft: "rgba(8,9,12,0.08)"

typography:
  display:
    family: "'Cabinet Grotesk', 'Inter', system-ui, sans-serif"
    weights: [600, 700, 800]
  body:
    family: "'Inter', system-ui, sans-serif"
    weights: [400, 500]
  mono:
    family: "'JetBrains Mono', ui-monospace, monospace"
  scale:
    base: "18px"
    line_height: 1.5
    sizes:
      base: "1rem"
      lg: "1.25rem"
      xl: "1.75rem"
      "2xl": "2.5rem"
      "3xl": "4rem"
      "4xl": "6rem"
      "5xl": "clamp(4rem, 10vw, 9rem)"

rounded:
  none: "0px"
  sm: "6px"
  md: "12px"
  lg: "20px"
  full: "9999px"

spacing:
  scale: "4px"
  sizes:
    "2": "8px"
    "4": "16px"
    "6": "24px"
    "8": "32px"
    "12": "48px"
    "16": "64px"
    "24": "96px"
    "32": "128px"
    "48": "192px"

shadow:
  sm: "0 1px 2px rgba(8,9,12,0.06)"
  md: "0 4px 16px rgba(8,9,12,0.10)"
  lg: "0 16px 48px rgba(8,9,12,0.15)"

motion:
  ease:
    out: "cubic-bezier(0.2, 0, 0, 1)"
    out_quart: "cubic-bezier(0.16, 1, 0.3, 1)"
    out_expo: "cubic-bezier(0.19, 1, 0.22, 1)"
  duration:
    fast: "120ms"
    base: "240ms"
    slow: "560ms"
    hero: "1200ms"
  scroll:
    smooth_duration: "1.2s"
    reveal_threshold: 0.3
    pin_offset: "20vh"
---

# DESIGN.md

## Color

Near-black void canvas paired with cream paper, a hot orange accent for marks and CTAs, and a yellow spark used sparingly as a second accent in scroll reveals.

## Typography

Cabinet Grotesk for display set, Inter for body. Display scales to clamp(4rem, 10vw, 9rem) at hero. Body holds at 18px / 1.5 leading.

## Spacing

4px grid. Section gaps step from 96px on small viewports to 192px between hero and proof sections on desktop.

## Components

Hero, marquee, pinned section, scroll-reveal block, sticky figure, side-by-side compare, video card, footer.

## Motion

Lenis smooth-scroll at 1.2s duration. ScrollTrigger reveals fire at 30% of viewport. Exponential easing only. Every animation has a prefers-reduced-motion path that disables transforms and falls back to opacity fade or no animation.

## States

Hover on CTAs: accent fill + 200ms transition. Active: scale(0.96). Focus: 2px accent ring on dark surfaces.
