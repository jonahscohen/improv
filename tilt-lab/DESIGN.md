---
colors:
  primary: "#5b8cff"       # brand primary == the single accent (alias of accent below)
  bg: "#0b0b0f"            # app canvas, darkest surface
  panel: "#14141a"         # raised panels: top bar, cards, modal, layer items
  control: "#1b1b22"       # default control fill: buttons, selects, search, textarea-adjacent
  control_hover: "#232330" # hover fill for default buttons
  field: "#0e0e13"         # deep-inset field: modal source textarea
  line: "#23232b"          # primary hairline borders / column dividers
  line_2: "#2a2a33"        # control borders, card borders
  text: "#e7e7ea"          # primary text
  muted: "#9a9aa6"         # secondary text: labels, meta, role tags, hints
  accent: "#5b8cff"        # single brand accent: active filter, primary action, selected layer, focus ring
  on_accent: "#08080c"     # text/glyph color on accent fills
  preview: "#000000"       # preview canvas backdrop, pure black so effects read true
  overlay: "rgba(0,0,0,0.6)"   # modal scrim
  alert_text: "#ff9a8c"    # warning/hint text (incompatible-layer notice)
  alert_border: "#5a2a2a"  # warning hint border
  alert_bg: "#2a1414"      # warning hint background

typography:
  body:
    family: "ui-sans-serif, system-ui, -apple-system, sans-serif"
    source: "system"
    license: "system"
    weights: [400, 600]
  mono:
    family: "ui-monospace, SFMono-Regular, Menlo, monospace"
    source: "system"
    license: "system"
    weights: [400]
  scale:
    base: "16px"
    line_height: 1.45
    sizes:
      "2xs": "0.68rem"   # role tags, uppercase meta
      xs: "0.7rem"       # layer-stack action buttons
      sm: "0.75rem"      # role-filter pills
      base: "0.8rem"     # param-control rows
      md: "0.85rem"      # hints, picker label, empty states
      lg: "0.9rem"       # layer name
      xl: "0.95rem"      # layer-stack title
      "2xl": "1.05rem"   # modal title
      body: "1rem"       # browser default body baseline
    weights:
      regular: 400
      semibold: 600

rounded:
  sm: "5px"      # layer-stack action buttons
  md: "6px"      # selects, kind toggles
  lg: "7px"      # buttons, search input, hint box
  xl: "8px"      # modal source textarea
  "2xl": "9px"   # browse/layer cards
  "3xl": "12px"  # modal panel
  full: "999px"  # role-filter pills

spacing:
  scale: "4px"        # loose 4px rhythm, expressed in rem below
  tight: "0.25rem"    # 4px  - tight gaps, action-button rows
  xs: "0.4rem"        # ~6px - control padding, modal action gaps
  sm: "0.5rem"        # 8px  - card internal gaps, list gaps
  card: "0.6rem"      # ~10px - card padding, top-bar vertical
  bar_gap: "0.75rem"  # 12px - top-bar gaps, section spacing
  panel: "0.85rem"    # ~14px - panel padding
  bar_x: "1rem"       # 16px - top-bar horizontal padding
  modal: "1.1rem"     # ~18px - modal panel padding

shadow:
  none: "none"   # the tool is flat; depth comes from surface color + hairlines, not shadow

motion:
  ease:
    out: "ease"   # default transition curve used on hover/press
  duration:
    fast: "100ms"     # transform press feedback
    base: "150ms"     # background / border-color hover transitions
---

# DESIGN.md - tilt-lab

## Overview

tilt-lab is a dark, utilitarian, developer-facing visual-effects workbench. The aesthetic is a precision instrument: near-black surfaces, hairline dividers, a single blue accent (`{colors.accent}`), and dense compact controls. Depth is communicated by stepping surface lightness (`{colors.bg}` -> `{colors.panel}` -> `{colors.control}`) and 1px hairlines, never by shadow. The center preview canvas is the largest region and the visual focus; the two side panels (browse, layers) are quiet neutral chrome that serve it. Nothing decorates; every pixel is a control, a label, or the live preview itself.

## Colors

Three stacked dark surfaces establish hierarchy: app canvas `{colors.bg}` (#0b0b0f), raised panels `{colors.panel}` (#14141a), and control fills `{colors.control}` (#1b1b22) which lift to `{colors.control_hover}` (#232330) on hover. The preview canvas sits on pure black `{colors.preview}` so effects render true.

Text is `{colors.text}` (#e7e7ea) for primary content and `{colors.muted}` (#9a9aa6) for labels, meta, role tags, and hints.

`{colors.accent}` (#5b8cff) is the ONE accent and is used sparingly: the active role filter, the primary Send action, the active kind toggle, the selected/hovered card border, and the `:focus-visible` ring. Text on accent fills is `{colors.on_accent}` (#08080c). If two things are accented in one view, neither reads as primary.

Borders use two weights: `{colors.line}` (#23232b) for structural column dividers and `{colors.line_2}` (#2a2a33) for control and card outlines.

Warnings (the incompatible-layer hint) are the only non-accent chromatic signal: `{colors.alert_text}` (#ff9a8c) on `{colors.alert_bg}` (#2a1414) with a `{colors.alert_border}` (#5a2a2a) outline.

## Typography

- **Body** (`{typography.body}`): the system UI sans stack (`ui-sans-serif, system-ui`). No web fonts are loaded; a local tool should not pay a font round-trip. Used for all labels, controls, and content. Weights 400 and 600 only.
- **Mono** (`{typography.mono}`): the system monospace stack (`ui-monospace, Menlo`). Used exclusively for the shader source textarea in the Add-shader modal, where character alignment matters.

The type scale is small and information-dense, anchored below the 1rem browser baseline. Role tags and uppercase meta sit at `{typography.scale.sizes.2xs}` (0.68rem); param-control rows at `{typography.scale.sizes.base}` (0.8rem); the modal title is the largest UI text at `{typography.scale.sizes.2xl}` (1.05rem). `-webkit-font-smoothing: antialiased` is applied globally. Use `font-variant-numeric: tabular-nums` on any numeric parameter readout so values do not jitter as they change.

## Layout

- A vertical app shell at `height: 100vh`: a fixed top bar over a three-column body.
- The body is a CSS grid: `280px` browse panel, `1fr` preview, `340px` layers panel. The center column flexes; the side panels are fixed-width neutral chrome.
- Side panels scroll independently (`overflow-y: auto`); the preview is `position: relative` with an absolutely-positioned canvas filling it (`inset: 0`).
- Spacing follows a loose 4px-derived rhythm (`{spacing.scale}`): panels pad at `{spacing.panel}` (~14px), cards at `{spacing.card}` (~10px), the top bar at `{spacing.card}` vertical / `{spacing.bar_x}` horizontal.
- Responsive intent: below ~900px narrow the side panels; below ~640px the side panels collapse or overlay so the preview keeps usable width. The preview must never be crowded out.

## Elevation

tilt-lab is intentionally flat. There is exactly one elevation token, `{shadow.none}`, and it is the rule, not an exception: the design uses NO drop shadows. Depth is expressed entirely through:

- Stepping surface lightness: `{colors.bg}` (recessed) -> `{colors.panel}` (raised) -> `{colors.control}` (interactive).
- 1px hairline borders (`{colors.line}`, `{colors.line_2}`).
- The modal layer, which separates from the app only via the `{colors.overlay}` scrim and a `{colors.line_2}` border, not a shadow.

## Shapes

Corner rounding scales with element size, all small and tight to match the utilitarian feel:

- Layer-stack action buttons: `{rounded.sm}` (5px)
- Selects, kind toggles: `{rounded.md}` (6px)
- Buttons, search input, hint box: `{rounded.lg}` (7px)
- Modal source textarea: `{rounded.xl}` (8px)
- Browse / layer cards: `{rounded.2xl}` (9px)
- Modal panel: `{rounded.3xl}` (12px)
- Role-filter pills: `{rounded.full}` (999px)

## Components

### Primary button (Send)
- Background: `{colors.accent}`, text `{colors.on_accent}`, `font-weight: {typography.scale.weights.semibold}`, transparent border.
- Radius: `{rounded.lg}`, padding `~0.4rem 0.85rem`.
- Disabled: `opacity: 0.45`, `cursor: not-allowed`.
- Min hit area: 40x40px.

### Default button (Add, modal cancel)
- Background: `{colors.control}`, text `{colors.text}`, border 1px `{colors.line_2}`.
- Hover: background `{colors.control_hover}` over `{motion.duration.base} {motion.ease.out}`.
- Radius: `{rounded.lg}`.

### Role-filter pill (browse)
- Inactive: transparent fill, `{colors.muted}` text, 1px `{colors.line_2}` border, `{rounded.full}`, `{typography.scale.sizes.sm}`.
- Active (`data-active='true'`): `{colors.accent}` fill, `{colors.on_accent}` text, transparent border.
- Active state must pair the accent fill with the text-color shift (not hue alone). Min hit area 40x40px.

### Browse card
- Background: `{colors.panel}`, 1px `{colors.line_2}` border, `{rounded.2xl}`, padding `~0.6rem 0.7rem`.
- Layout: flex row, name left, role tag right (`{typography.scale.sizes.2xs}`, uppercase, `{colors.muted}`).
- Hover: border -> `{colors.accent}`, `transform: translateY(-1px)` over `{motion.duration.fast}` (wrap the transform in `prefers-reduced-motion: no-preference`).

### Layer-stack item
- Background: `{colors.panel}`, 1px `{colors.line_2}` border, `{rounded.2xl}`, padding `~0.55rem 0.65rem`.
- Head row: name (`{typography.scale.sizes.lg}`, weight 600) + right-aligned action buttons (up / down / remove) at `{typography.scale.sizes.xs}`, `{rounded.sm}`, min 40x40px hit area.
- Below the head: param-controls grid.

### Param-controls row
- Grid: label column + `1fr` control column, `{typography.scale.sizes.base}`, `{colors.muted}` label.
- The label column must be wide enough (or wrap, with `min-width: 0` on the control) so long names like `atmosphereCoefficient` do not clip.
- Range inputs fill the control column (`width: 100%`).

### Add-shader modal
- Scrim: `{colors.overlay}`, centered panel.
- Panel: `min(560px, 92vw)`, `{colors.panel}`, 1px `{colors.line_2}` border, `{rounded.3xl}`, padding `~1.1rem`.
- Title at `{typography.scale.sizes.2xl}`. Kind toggles use the default-button treatment; active toggle gets an `{colors.accent}` border.
- Source textarea: `{colors.field}` fill, `{typography.mono}`, `{rounded.xl}`, `min-height: 180px`, vertical resize.
- Actions right-aligned; last action is the primary (`{colors.accent}`) button.
- A11y: `role="dialog"`, `aria-modal="true"`, focus the first control on open, trap Tab within the panel, close on Escape and backdrop click.

### Preview canvas
- `position: relative` host on `{colors.preview}`, canvas absolutely positioned `inset: 0`, `width/height: 100%`.
- Accessible name required: `role="img"` with an `aria-label` describing the live composited effect.

## Do's and Don'ts

### Do

- Keep the preview the largest, dominant region. Side panels serve it.
- Use surface lightness steps and hairlines for depth. Stay flat.
- Reserve `{colors.accent}` for the single most relevant thing per view.
- Keep type small and dense; this is a developer tool, not a marketing page.
- Pair every accented/active state with a second non-color cue.
- Give every interactive control a `:focus-visible` ring in `{colors.accent}` and a 40x40px minimum hit area.
- Wrap hover/press transforms in `prefers-reduced-motion: no-preference`.

### Don't

- Don't add drop shadows. Depth is surface + hairline only.
- Don't load web fonts; use the system sans/mono stacks.
- Don't hard-code hex literals in new CSS; reference the `{colors.*}` tokens.
- Don't let side panels grow at the preview's expense, especially on narrow viewports.
- Don't use `transition: all`; transition the exact properties (background, border-color, transform).
- Don't accent more than one element in a view, or the accent stops meaning "important."
