---
name: prompt-elements-tab-icons
description: Prompt-mode tooltips now use the Manipulate Elements-tab layer icons (text=T, image, grid, frame-h/v, block) instead of the old stroked getElementIcon glyphs.
type: project
relates_to: [session_2026-06-08_prompt-label-centered-above.md]
---

Collaborator: Jonah

## Request
Make the Prompt-mode tooltips (selection label + hover label) use the appropriate element-type icon sourced from the Manipulate pane's Elements tab.

## Where the Elements-tab icons live
`manipulate/ui/ElementTree.tsx`: `getLayerIcon(el)` -> a `LayerIconType` (frame-h | frame-v | grid | block | text | image | component | svg | svg-shape | input), then `LayerIcon` renders a filled 16x16 currentColor SVG per type. These are Preact/TSX (JSX) - not callable from Prompt's vanilla DOM code.

## Change (`claude-dotfiles/justify/core/prompt/index.ts`)
Ported the classification + path data verbatim into vanilla helpers next to `getElementIcon`:
- `LAYER_TEXT_TAGS` / `LAYER_IMAGE_TAGS` / `LAYER_SVG_SHAPE_TAGS` sets (copied from ElementTree).
- `getLayerIconType(el)` - same logic (text/image/svg/input/grid/frame-h/frame-v/block; component detection dropped since this is a non-React WP site, svg-shape folded into svg).
- `LAYER_ICON_PATHS` - the exact filled path `d` strings for frame-v/frame-h/block/text/image (svg+input reuse block, same as the tab).
- `createLayerIconSvg(el, size)` - builds the 16x16 currentColor SVG (grid = 4 stroked rects; others = one filled evenodd path).
Replaced the two stroked-`getElementIcon` icon builders with `createLayerIconSvg(el, 12)` (selection label in `_showSelOverlays`) and `createLayerIconSvg(t, 14)` (hover label in `_onHover`). `getElementIcon` is now unused but left in place.

## Build/deploy/verify
`node build.js --core-only` + `bash deploy.sh --core-only`. Verified live (yesand.lndo.site, Prompt mode):
- Selected the h3 "Yes&..." heading -> label shows the filled "T" text icon ("T h3 .fl-module"), matching the Elements tab (was the old heading-lines glyph before).
- Selected `div .fl-row-content-wrap` (a flex row) -> label shows the frame-h two-bar layout icon. Type-correct.

Files touched: `claude-dotfiles/justify/core/prompt/index.ts` (helper block + 2 call sites), rebuilt+deployed bundle. Uncommitted working-tree changes.
