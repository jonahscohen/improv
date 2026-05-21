---
colors:
  brand:
    red: "#DC2618"          # the Yes& ampersand
    ink: "#1A1F1B"          # the Yes& wordmark - off-black with green undertone
    cream: "#F4EFE4"        # warm off-white background, NOT pure white
    paper: "#FAF7EE"        # lighter cream for surfaces
  text:
    primary: "#1A1F1B"      # = brand.ink
    secondary: "#54564F"    # muted body
    tertiary: "#8B8A82"     # captions, meta
    inverse: "#F4EFE4"      # = brand.cream, on dark
  surface:
    canvas: "#F4EFE4"       # = brand.cream
    raised: "#FAF7EE"       # = brand.paper
    inverse: "#1A1F1B"      # = brand.ink for dark sections
  border:
    soft: "rgba(26,31,27,0.08)"   # 8% ink
    firm: "rgba(26,31,27,0.16)"   # 16% ink
    inverse: "rgba(244,239,228,0.12)"  # cream on dark surfaces
  accent:
    red_subtle: "rgba(220,38,24,0.08)"   # for hover tints
    red_border: "rgba(220,38,24,0.24)"   # for accented borders

typography:
  display:
    family: "'Source Serif 4', 'Source Serif Pro', 'Iowan Old Style', Charter, Cambria, Georgia, serif"
    source: "fonts.google.com/specimen/Source+Serif+4"
    license: "OFL"
    weights: [400, 600, 700]
    fallback_metrics: "size-adjust: 102%; ascent-override: 88%; descent-override: 22%;"
  body:
    family: "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif"
    source: "fonts.google.com/specimen/Hanken+Grotesk"
    license: "OFL"
    weights: [400, 500, 600]
  mono:
    family: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
    source: "jetbrains.com/lp/mono"
    license: "OFL"
    weights: [400, 500]

  scale:
    base: "17px"            # body baseline, slightly above 16 for editorial feel
    line_height: 1.55
    measure: "62ch"         # comfortable reading width
    sizes:
      xs: "0.78rem"         # 13.3px - captions
      sm: "0.88rem"         # 15px - meta, small UI
      base: "1rem"          # 17px - body
      lg: "1.18rem"         # 20px - lead paragraphs
      xl: "1.5rem"          # 25.5px - subheadings
      "2xl": "2rem"         # 34px - section headings
      "3xl": "3rem"         # 51px - section h2 / hero subhead
      "4xl": "4.5rem"       # 76.5px - hero h1 base
      "5xl": "clamp(4rem, 8vw + 1rem, 7rem)"  # fluid hero on marketing pages
    weights:
      regular: 400
      medium: 500
      semibold: 600
      bold: 700

rounded:
  none: "0"
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "20px"                # large surfaces, cards
  full: "9999px"

spacing:
  scale: "4px"              # 4px grid
  sizes:
    "0.5": "2px"
    "1": "4px"
    "2": "8px"
    "3": "12px"
    "4": "16px"
    "5": "20px"
    "6": "24px"
    "8": "32px"
    "10": "40px"
    "12": "48px"
    "16": "64px"
    "20": "80px"
    "24": "96px"
    "32": "128px"
    "40": "160px"
  section: "{spacing.sizes.24}"     # 96px between major sections, comfortable editorial pace

shadow:
  sm: "0 1px 2px rgba(26,31,27,0.04), 0 1px 1px rgba(26,31,27,0.06)"
  md: "0 2px 8px rgba(26,31,27,0.06), 0 1px 2px rgba(26,31,27,0.08)"
  lg: "0 8px 24px rgba(26,31,27,0.08), 0 2px 6px rgba(26,31,27,0.06)"

motion:
  ease:
    out: "cubic-bezier(0.2, 0, 0, 1)"          # main UI easing
    in_out: "cubic-bezier(0.4, 0, 0.2, 1)"     # transitions between states
    spring_quick: "cubic-bezier(0.34, 1.56, 0.64, 1)"   # buttons, snappy
  duration:
    instant: "100ms"
    fast: "180ms"
    medium: "260ms"
    slow: "420ms"
    glacial: "800ms"        # hero entrance, scrubbed scroll
---

# DESIGN.md - claude-dotfiles marketing microsite

## Overview

A serif-leaning, editorial, warm-cream-on-off-black aesthetic. The Yes& wordmark and ampersand are the brand anchors. Everything is structural: type, color, spacing all work in service of the prose. No motion theatre, no gradient meshes, no mesh-gradient hero. The site reads like a confident essay with engineering precision in the layout.

## Colors

Warm cream canvas (`{colors.brand.cream}` = `#F4EFE4`), off-black ink (`{colors.brand.ink}` = `#1A1F1B`), Yes& red as the only accent (`{colors.brand.red}` = `#DC2618`). Used sparingly - the red is the brand signature, not a default CTA color for everything.

Dark sections inverse the palette: ink canvas, cream text, red still as the only accent.

**No tinted neutrals.** Borders are pure black/white at low opacity, never tinted blue or warm gray. This is a `make-interfaces-feel-better` rule and the brand demands it.

## Typography

- **Display** (`{typography.display}`): Source Serif 4. Used for hero `h1`, section `h2`. Italic permitted but used VERY sparingly - the brand isn't an editorial-italic brand.
- **Body** (`{typography.body}`): Hanken Grotesk. Used for prose, captions, UI labels, code-adjacent meta.
- **Mono** (`{typography.mono}`): JetBrains Mono. Used for inline code, install commands, file paths.

`font-optical-sizing: auto` on the display where the variable font supports it. `font-variant-numeric: tabular-nums` on any data tables. `text-wrap: balance` on hero headings, `text-wrap: pretty` on body paragraphs.

## Layout

- 8-point baseline grid (well, 4-point, with major rhythm on 8). Section gaps are 96px (`{spacing.section}`).
- Max content width: 1200px outer, 740px text-column inner. Reading column hits ~62ch at body size.
- Sections alternate cream / paper to break visual blocks without using borders.
- Dark sections use ink canvas with cream text, sparingly.

## Elevation

Two elevation levels only:
- Floating cards / important callouts use `shadow.md`.
- Sticky / overlay elements use `shadow.lg`.

Shadows over borders, per `make-interfaces-feel-better`. Borders ONLY where structurally required (table cells, form inputs).

## Shapes

- Cards / large surfaces: `{rounded.xl}` (20px)
- Buttons / pills / inputs: `{rounded.md}` (8px)
- Code blocks: `{rounded.sm}` (4px)
- Concentric radius applied throughout: outer = inner + padding.

## Components

### Button (primary CTA)
- Background: `{colors.brand.ink}`
- Text: `{colors.brand.cream}`
- Radius: `{rounded.md}`
- Padding: `12px 20px` (3rem horizontal, 1.5rem vertical on `spacing.scale`)
- Press state: `scale(0.96)` with `{motion.duration.fast}` `{motion.ease.spring_quick}` per `make-interfaces-feel-better`
- Min hit area: 44x44 (well above 40x40 floor)

### Button (secondary)
- Background: transparent
- Text: `{colors.text.primary}`
- Border: 1px solid `{colors.border.firm}`
- Same radius / padding / press / hit-area as primary

### Inline code (`<code>`)
- Background: `{colors.brand.paper}`
- Font: `{typography.mono}`
- Padding: `2px 6px`
- Radius: `{rounded.sm}`
- Size: `0.88em` (relative to surrounding)

### Code block (`<pre>`)
- Background: `{colors.surface.inverse}` (ink) on cream sections, `{colors.brand.paper}` on dark sections
- Font: `{typography.mono}`
- Padding: `{spacing.sizes.5}` (20px)
- Radius: `{rounded.lg}` (12px - concentric: outer 12 = inner 8 + padding adjustment, close enough at this size)

### Curl install block (special component, hero-adjacent)
- Background: ink with red accent border-left (3px solid `{colors.brand.red}`)
- Copy button: monospace, cream-on-ink, hover state pulls Yes& red
- Click-to-copy fires a `make-interfaces-feel-better` 240ms acknowledgment

### Section heading
- `{typography.display}` at `{typography.scale.sizes.3xl}` (3rem / 51px)
- `text-wrap: balance`
- `font-weight: 600`
- Color: `{colors.text.primary}`

### Hero h1
- `{typography.display}` at fluid `{typography.scale.sizes.5xl}` - clamps 4rem to 7rem
- `text-wrap: balance`
- `font-weight: 700`
- Color: `{colors.text.primary}`
- Underlined word: one or two key words in the hero h1 get a `text-decoration-color: {colors.brand.red}; text-decoration-thickness: 4px; text-underline-offset: 0.1em`

## Do's and Don'ts

### Do

- Use the cream canvas as the default. Pure white feels generic; cream is on-brand.
- Use the red ampersand from the brand asset as a single visual anchor per fold. Once per section maximum.
- Use serif for emphasis, never bold-only.
- Use `text-wrap: balance` on every heading; `pretty` on every paragraph.
- Use tabular numbers in any data display.
- Use Lenis smooth scroll - editorial flow demands it.

### Don't

- Don't use mesh gradients, animated backgrounds, or anything that reads as Vercel-aesthetic.
- Don't tint borders. Use ink/cream at low opacity only.
- Don't use Inter or Fraunces - both on the reflex-reject list.
- Don't put the red ampersand on every section - it loses its weight.
- Don't use icons heroically. Icons are functional ornaments, not decorations.
- Don't use `transition: all`. Specify exact properties.
- Don't ship without `font-optical-sizing: auto` on the display.
