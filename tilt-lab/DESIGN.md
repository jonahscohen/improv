---
colors:
  primary: "#dc2618"       # brand primary == the single accent (Yes& red), alias of accent
  bg: "#0c0b0a"            # app canvas, warm near-black, darkest surface
  surface_1: "#131210"     # rails / quiet chrome (browse + layers panels, top bar)
  surface_2: "#1b1916"     # raised module: card, control well, channel strip
  surface_3: "#232019"     # hover / pressed well
  preview: "#000000"       # preview canvas backdrop, pure black so effects read true
  input: "#0e0d0b"         # deep-inset field: search, edit input, modal textarea
  line: "#262320"          # primary hairline: column dividers, module rules
  line_2: "#34302a"        # control + card borders (second tier)
  text: "#f2efe9"          # primary text, warm off-white
  muted: "#9c968b"         # secondary text + resting slider fills: labels, meta, role tags
  faint: "#6c665d"         # tertiary / disabled / empty-state text
  accent: "#dc2618"        # Yes& red - the ONE accent, a sparse indicator (active/enabled/focus)
  accent_hover: "#b01f15"  # accent hover/pressed
  on_accent: "#fbf7f0"     # text/glyph on accent fills
  overlay: "rgba(0,0,0,0.6)"   # modal scrim
  alert_text: "#f0a99c"    # warning/hint text (incompatible-layer notice)
  alert_border: "#5a2c22"  # warning hint border
  alert_bg: "#241310"      # warning hint background

typography:
  body:
    family: "'JustifySans', ui-sans-serif, system-ui, -apple-system, sans-serif"
    source: "bundled"
    license: "self-hosted woff2 (Anthropic Sans, via justify) at /fonts/"
    weights: [400, 700]
  mono:
    family: "'JustifyMono', ui-monospace, SFMono-Regular, Menlo, monospace"
    source: "bundled"
    license: "self-hosted woff2 (Anthropic Mono, via justify) at /fonts/"
    weights: [400]
  scale:
    base: "14px"
    line_height: 1.5
    sizes:
      micro: "0.625rem"  # 10px - tracked uppercase mono micro-labels, role/meta tags
      xs: "0.72rem"      # channel index, value readouts
      sm: "0.8125rem"    # buttons, fields, body labels
      base: "0.86rem"    # channel/layer name
      md: "0.9375rem"    # empty-state strong line
    weights:
      regular: 400
      bold: 700

rounded:
  sm: "3px"      # focus ring, value-edit input, channel handle
  md: "5px"      # buttons, icon buttons, fields, channel strip
  lg: "6px"      # search field, larger controls
  full: "999px"  # slider tracks, pills

spacing:
  scale: "4px"        # loose 4px rhythm, expressed in rem below
  tight: "0.25rem"    # 4px  - tightest gaps
  xs: "0.4rem"        # ~6px - icon gaps
  sm: "0.5rem"        # 8px  - card internal gaps, list gaps
  card: "0.6rem"      # ~10px - card padding
  bar_gap: "0.75rem"  # 12px - top-bar gaps, module spacing
  panel: "0.85rem"    # ~14px - panel padding
  bar_x: "1rem"       # 16px - top-bar horizontal padding

shadow:
  none: "none"   # the tool is flat; depth comes from surface step + hairlines, never shadow

motion:
  ease:
    out: "cubic-bezier(0.4, 0, 0.2, 1)"   # rail collapse + standard transitions
  duration:
    fast: "100ms"     # transform press feedback
    base: "140ms"     # background / border-color / color hover transitions
    rail: "220ms"     # rail collapse grid animation
---

# DESIGN.md - tilt-lab

## Overview

tilt-lab is a developer-facing visual-effects workbench styled as a precision instrument, not a dashboard. Warm matte near-black chrome wraps a single luminous subject: the live preview. The point of view is a synth/oscilloscope console - confident, dense, technical-but-humane. Depth is communicated by stepping surface lightness (`{colors.bg}` -> `{colors.surface_1}` -> `{colors.surface_2}` -> `{colors.surface_3}`) and two tiers of 1px hairline, never by shadow. The lone hue is Yes& red (`{colors.accent}`), used as an indicator that lights up only on active/enabled state - never as paint. Type carries the voice: the Anthropic faces (`{typography.body}` for labels/content, `{typography.mono}` for numerics, meta, and the wordmark). The center preview is the dominant region and can collapse the side rails or go fullscreen; nothing decorates.

## Colors

Four stacked warm-near-black surfaces establish hierarchy: app canvas `{colors.bg}` (#0c0b0a), rail/chrome `{colors.surface_1}` (#131210), raised modules and control wells `{colors.surface_2}` (#1b1916), and the hover/pressed well `{colors.surface_3}` (#232019). The preview sits on pure black `{colors.preview}` so effects render true. Deep-inset fields use `{colors.input}` (#0e0d0b).

Text steps in three weights: `{colors.text}` (#f2efe9, warm off-white) for primary content, `{colors.muted}` (#9c968b) for labels, meta, role tags, and resting slider fills, and `{colors.faint}` (#6c665d) for tertiary/disabled/empty-state text.

`{colors.accent}` (#dc2618, Yes& red) is the ONE accent and is a sparse indicator, not paint: the enabled toggle, the active/focused slider fill, the drop-target edge, the value-edit border, and the `:focus-visible` ring. Slider fills are `{colors.muted}` at rest and swap to `{colors.accent}` only while the control is actively engaged. Text/glyph on accent fills is `{colors.on_accent}` (#fbf7f0). If two things are accented in one view, neither reads as primary.

Borders use two weights: `{colors.line}` (#262320) for structural dividers and module rules, `{colors.line_2}` (#34302a) for control and card outlines.

Warnings (the incompatible-layer hint) are the only non-accent chromatic signal: `{colors.alert_text}` (#f0a99c) on `{colors.alert_bg}` (#241310) with a `{colors.alert_border}` (#5a2c22) outline.

## Typography

- **Body** (`{typography.body}`): JustifySans, the Anthropic sans face, self-hosted as woff2 at `/fonts/` (no network round-trip). Weights 400 and 700. Used for labels, controls, names, and content.
- **Mono** (`{typography.mono}`): JustifyMono, the Anthropic mono face, self-hosted woff2, weight 400. Used for the `TILT-LAB` wordmark, all tracked uppercase micro-labels, numeric value readouts, the channel index, and the shader-source textarea.

The scale is small and information-dense, anchored below the 14px base. Tracked uppercase mono micro-labels sit at `{typography.scale.sizes.micro}` (10px, letter-spacing ~0.14em); value readouts and the channel index at `{typography.scale.sizes.xs}`; buttons and fields at `{typography.scale.sizes.sm}`. `-webkit-font-smoothing: antialiased` is applied globally. Every numeric readout uses `font-variant-numeric: tabular-nums` so digits do not reflow while dragging.

## Layout

- A vertical app shell at `height: 100vh`: a thin top bar over a canvas-dominant body.
- The body is a CSS grid with collapsible rails: `{spacing}`-lean browse rail (~248px), `1fr` preview, layers rail (~312px). The center column always flexes; either rail collapses to 0 via a `data-rail-left`/`data-rail-right="collapsed"` attribute, animated over `{motion.duration.rail}`.
- Fullscreen (`.app[data-fullscreen="true"]`) hides the top bar and both rails so the preview fills the frame. Floating instrument controls (rail toggles, fullscreen) sit over the preview so they survive every shell state. Escape exits fullscreen.
- Rails scroll independently (`overflow-y: auto`); the preview is `position: relative` with an absolutely-positioned canvas filling it (`inset: 0`).
- Spacing follows a loose 4px-derived rhythm: panels pad at `{spacing.panel}`, cards at `{spacing.card}`, the top bar at `{spacing.bar_x}` horizontal.
- Responsive: below ~900px the rails narrow; below ~640px the body stacks to one column with the preview kept prominent on top. The preview is never crowded out.

## Elevation

tilt-lab is intentionally flat. There is exactly one elevation token, `{shadow.none}`, and it is the rule: NO drop shadows. Depth comes entirely from:

- Stepping surface lightness: `{colors.bg}` -> `{colors.surface_1}` -> `{colors.surface_2}` -> `{colors.surface_3}`.
- Two-tier 1px hairlines (`{colors.line}`, `{colors.line_2}`), including the `border-top` rule that separates module groups.
- Size and position, not shadow. The modal separates from the app only via the `{colors.overlay}` scrim and a `{colors.line_2}` border.

## Shapes

Corner rounding is tight and instrument-like, much smaller than the soft SaaS curve:

- Focus ring, value-edit input, channel handle: `{rounded.sm}` (3px)
- Buttons, icon buttons, fields, channel strip: `{rounded.md}` (5px)
- Search field, larger controls: `{rounded.lg}` (6px)
- Slider/fader tracks and any pill: `{rounded.full}` (999px)

## Components

### Brand mark (top bar)
- The `&dev` wordmark (`/and-dev-white.svg`, red ampersand + white "dev", a verbatim Yes& brand asset) sits left of the `TILT-LAB` wordmark at 18px tall.
- `TILT-LAB` renders in `{typography.mono}`, uppercase, letter-spacing ~0.18em, `{colors.text}`.

### Primary button (export: download / copy config)
- Default treatment; the export actions are server-free and enable as soon as the stack has a layer (disabled with an explanatory `title` at zero layers).

### Button (`.btn`, `.btn--accent`)
- Default: `{colors.surface_2}` fill, `{colors.text}`, 1px `{colors.line_2}` border, `{rounded.md}`, `{typography.scale.sizes.sm}`. Hover -> `{colors.surface_3}` over `{motion.duration.base} {motion.ease.out}`; `:active` `scale(0.97)`.
- Accent variant: `{colors.accent}` fill, `{colors.on_accent}` text, weight 700; hover -> `{colors.accent_hover}`.
- Disabled: `opacity: 0.4`, `cursor: not-allowed`.

### Icon button (`.icon-btn`)
- Square, `min-width/height: 40px`, transparent fill, `{colors.muted}` glyph, 1px `{colors.line_2}` border, `{rounded.md}`. Hover -> `{colors.surface_2}` + `{colors.text}`; `:active` `scale(0.94)`. Icons are sourced verbatim from Lucide.

### Module group + micro-label
- A `border-top: 1px {colors.line}` group with a `{typography.scale.sizes.micro}` tracked uppercase mono label (`{colors.muted}`). Replaces boxed cards; the first group resets its top rule.

### Browse card + live poster
- The browse rail is a thumbnail catalog. Each card renders a POSTER FRAME of the effect: posters are generated through a single shared WebGL context (render a settle frame -> snapshot -> dispose -> cache per id) so only 1-2 contexts ever exist (the browser caps active WebGL contexts near 16). Effects that cannot poster (pointer-driven, or async loaders like cobe) fall back to a DARK letter tile on `{colors.surface_2}` - never a light/broken tile.
- Card: `{colors.surface_2}`-leaning well, name + `{typography.scale.sizes.micro}` uppercase mono role tag in `{colors.muted}` (role is NEVER color-coded - all roles are muted). Hover lifts border to `{colors.accent}`; `:active` `scale(0.97)`.

### Channel strip (layer)
- A module per layer: `{colors.surface_1}` fill, 1px `{colors.line}` border, `{rounded.md}`. Disabled channels drop to `opacity: 0.55` but stay interactive.
- Head row: numbered drag handle (`{typography.scale.sizes.xs}` mono, doubles as compositing-order index), name, `{colors.muted}` role tag, and an enable toggle (Switch). The enable toggle is `{colors.accent}` when on - one of the few places red is intentional, as the enabled indicator.
- Stacking follows the Photoshop/Figma convention: the layer at the TOP of the list is the topmost (rendered last / highest z-order), the layer at the BOTTOM is behind everything (rendered first), and a newly added effect lands at the TOP of the list. The underlying paint-order array is the reverse of this displayed order (index 0 = bottommost); the panel reverses it for display and maps positions back when reordering. The drag handle and up/down buttons move a layer toward the top (more visual priority) or bottom accordingly.
- Drag-to-reorder via native HTML5 drag (drop target gets a `{colors.accent}` edge + `{colors.surface_2}` fill); keyboard reorder via up/down icon buttons.
- Opacity fader: a flat range with a `{colors.muted}` fill (`{colors.accent}` on `:active`/`:focus-visible`) and a tabular-mono % readout.

### Slider (`.tl-slider`) + scrub readout
- Flat range: 4px track, `{colors.line_2}` base, fill `{colors.muted}` at rest swapping to `{colors.accent}` on `:active`/`:focus-visible`; 14px `{colors.text}` thumb. 40px hit area around the thin visual track.
- The tabular-mono readout doubles as a pro-tool scrubber: drag horizontally to adjust (Shift = 10x), double-click to type an exact value (entering edit mode selects-all so typing replaces), or focus and arrow-nudge. All paths funnel through one clamp+step+onChange. The range input remains the canonical accessible control (keeps `aria-label`).

### Param controls
- Above 8 params, controls group into collapsible `<details>` accordions by name prefix, with `{typography.scale.sizes.micro}` mono section labels and a count chip; the first group is open.

### Add-shader modal
- Scrim `{colors.overlay}`; panel `{colors.surface_2}`, 1px `{colors.line_2}` border, padding, mono labels. Source textarea: `{colors.input}` fill, `{typography.mono}`. Actions right-aligned; primary uses `.btn--accent`.

### Preview canvas
- `position: relative` host on `{colors.preview}`; per-layer canvases stack absolutely (`inset: 0`), composited bottom-up (the bottom of the layer list paints first; the top of the list paints last, on top) with per-layer enable + opacity. Accessible name describes the live composite.

## Do's and Don'ts

### Do

- Keep the preview the dominant region; rails are lean chrome that collapse to serve it.
- Use surface steps and two-tier hairlines for depth. Stay flat.
- Reserve `{colors.accent}` for active/enabled/focus state only - it is an indicator LED, not paint.
- Set slider fills to `{colors.muted}` at rest; light them `{colors.accent}` only while engaged.
- Carry the voice in type: `{typography.mono}` for the wordmark, numerics, and tracked uppercase micro-labels; tabular-nums on every readout.
- Give every interactive control a `:focus-visible` ring in `{colors.accent}` and a 40x40px minimum hit area.
- Generate browse posters through a shared/pooled context; cache them; dark letter fallback on failure.
- Wrap hover/press transforms in `prefers-reduced-motion` guards.

### Don't

- Don't add drop shadows. Depth is surface + hairline + size only.
- Don't paint with the accent: no all-red slider fills, no accent-coded role tags, no two-accent views.
- Don't mount a live WebGL context per browse card - the context cap will drop them and show broken tiles.
- Don't hard-code hex literals in CSS; reference the `{colors.*}` tokens (the `&dev` brand SVG is the one verbatim-asset exception).
- Don't load web fonts over the network; the Anthropic faces are bundled woff2.
- Don't use `transition: all`; transition the exact properties.
- Don't let rails grow at the preview's expense, especially on narrow viewports.
