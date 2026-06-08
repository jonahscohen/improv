---
name: manipulate-tooltip-icons-and-hover-padding
description: Ported Elements-tab icons to the Manipulate (Picker) hover tooltip via a shared layer-icon module; tightened left padding on the hover pills in BOTH prompt and manipulate modes.
type: project
relates_to: [session_2026-06-08_prompt-elements-tab-icons.md, session_2026-06-08_prompt-tooltip-padding-divider.md]
---

Collaborator: Jonah

## Request(s)
1. "Make these [tooltip] changes make their way to the tooltips in manipulate mode as well."
2. (mid-task) "The hover tooltip for both prompt and manipulate mode, decrease leftmost padding so icon sits snugly left."

## Findings (what tooltips manipulate actually has)
Manipulate mode = the Picker (`selector/picker.ts`). Its tooltips: a HOVER pill (`renderElementPill` -> `[icon] tag.class` dark pill) and a SELECTION badge (terracotta W x H, via `formatLabel`). There is NO removable selection pill in manipulate (selection = box + handles + W x H badge + Design panel; you deselect by clicking away). So the prompt selection-label features (divider, X, larger X target, centered-above) have no analog in manipulate. The one shared/applicable change is the ELEMENT-TYPE ICON: the Picker hover pill used the OLD stroked `getElementIcon`; prompt now uses the Elements-tab `LayerIcon`.

## Changes
- NEW shared module `core/selector/layer-icon.ts` exporting `getLayerIconType(el)` + `createLayerIconSvg(el, size)` (vanilla port of ElementTree.tsx getLayerIcon+LayerIcon). Single source for the non-JSX callers.
- `prompt/index.ts`: removed its local copy of the helper (71 lines) and now `import { createLayerIconSvg } from '../selector/layer-icon'` (call sites unchanged).
- `selector/picker.ts` `renderElementPill`: replaced the stroked `getElementIcon` SVG with `createLayerIconSvg(el, 14)` -> manipulate hover pill now shows the Elements-tab icon (T/image/grid/frame/block). (`getElementIcon` left in picker, now unused.)
- Hover-pill left padding (both modes): `padding:5px 14px` -> `padding:5px 14px 5px 6px` so the icon sits snug left. Prompt `_hLabel` (index.ts ~236) and Picker `label` (picker.ts ~475). NOTE prompt's `_apTip` (index.ts ~404) is a different hint tooltip and was left alone.

## Build/deploy/verify
`node build.js --core-only` + `bash deploy.sh --core-only` (bundle 556216). Verified live (yesand.lndo.site): in Manipulate mode hovering the h3 -> pill `T h3 .fl-module` with the Elements-tab T icon snug left; switched to Prompt mode, same pill `T h3 .fl-module` icon snug left. Both modes match.

## Note for Jonah (structural)
The divider/X/larger-X-target/centered-above changes are specific to Prompt's removable SELECTION pill. Manipulate has no such pill (it uses a dimensions badge + Design panel). Those did NOT carry over because there's nowhere for them to go. If you want Manipulate's selection to also show a removable tag/class pill, that's a new feature (not a port) - flag it and I'll add it.

Files touched: NEW `core/selector/layer-icon.ts`; `core/prompt/index.ts` (import + dedupe + hover padding); `core/selector/picker.ts` (import + hover icon + hover padding). Rebuilt+deployed. Uncommitted working-tree changes.
