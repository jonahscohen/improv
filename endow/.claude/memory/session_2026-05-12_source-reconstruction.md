---
name: Source reconstruction from dist
description: Reconstructing TypeScript source files from beautified improv-formatted.js dist
type: project
relates_to: [session_2026-05-04_improv-manipulate-reference-tool.md]
---

Jonah requested reconstruction of TypeScript source files from the beautified dist at `dist/improv-formatted.js` (6907 lines).

## Class mapping (dist minified name -> source name)

- `le` (line 29) -> Transport
- `de` (line 136) -> Overlay
- `U` (line 363) -> Toolbar
- `pe` (line 1140) -> AdapterRegistry
- `ue` (line 1170) -> PreviewEngine
- `he` (line 1224) -> ChangeBuffer
- `me` (line 1267) -> ApplyConfirmation (toast notifications, NOT property panel)
- `Le` (line 2565) -> PropertyPanel (the big one with shadow DOM, tabs, tree view)
- `ke` (line 4641) -> ManipulateMode
- `Me` (line 4737) -> InlinePrompt (part of prompt module)
- `Ve` (line 5029) -> MultiSelect (part of prompt module)
- `He` (line 5142) -> PromptMode (prompt/index.ts)
- `Te` (line 6012) -> Markers (annotate/markers.ts)
- `Re` (line 6131) -> Lasso
- `Ie` (line 6252) -> TextSelect
- `Ae` (line 6279) -> AnnotationStore
- `je` (line 6414) -> AnnotateMode
- `Ne` (line 6579) -> ImprovCore

## Key helper functions/vars

- `hn`, `mn` (line 1265-1266) -> SVG icon paths (check, X) used by ApplyConfirmation
- `$()` (line 1524) -> freeze/enableFreeze function
- `_()` (line 1531) -> unfreeze/disableFreeze function  
- `W()` (line 1538) -> elementFromPoint with freeze-aware sheet toggle
- `st()` (line 1550) -> CSS selector generator (finder)
- `Y()` (line 1758) -> generateSelector wrapper
- `Q()` (line 1768) -> shortPath helper
- `X()` (line 1785) -> getComputedStyles
- `ee()` (line 1795) -> getNearbyText
- `te()` (line 1800) -> getAccessibility
- `Mn` (line 1829) -> DESIGN_CONTROLS array
- `Vn` (line 1908) -> TEXT_CONTROLS array
- `Hn` (line 1939) -> LAYOUT_CONTROLS array
- `p` (line ~2500) -> CSS custom property names enum
- `jn` (line ~2550) -> dark theme vars
- `Nn=280` -> panel width
- `G` -> font family
- `ie` -> easing cubic-bezier
- `u()` -> var() wrapper
- `$t()` (line 6349) -> freezeAnimations
- `Qe()` (line 6374) -> unfreezeAnimations
- `jt()` / `zn()` (line 6399) -> isImprovElement check
- `_t()` (line 6409) -> describeElement helper
- `ut()` (line ~1940+) -> getControlsForElement (builds control list based on element type)

## Files to reconstruct

1. `core/manipulate/property-panel.ts` - class Le (~2080 lines, 2565-4640)
2. `core/manipulate/index.ts` - class ke (lines 4641-4736)
3. `core/manipulate/handles.ts` - currently empty/stale, check if embedded
4. `core/manipulate/box-model.ts` - currently empty/stale, check if embedded
5. `core/manipulate/state-toggle.ts` - currently empty/stale, check if embedded
6. `core/manipulate/icons.ts` - currently empty/stale, check if embedded
7. `core/annotate/annotation-store.ts` - class Ae (lines 6279-6336)
8. `core/annotate/index.ts` - class je (lines 6414-6578)
9. `core/annotate/lasso.ts` - class Re (lines 6131-6251)
10. `core/index.ts` - class Ne (lines 6579-6907)

## Status - COMPLETE

All files reconstructed from dist/improv-formatted.js:

| File | Lines | Action |
|---|---|---|
| `core/manipulate/property-panel.ts` | 733 | Full rewrite - new Figma-like panel with tabs, tree, design sections |
| `core/manipulate/index.ts` | 204 | Updated - added hover hint labels with SVG icons |
| `core/annotate/lasso.ts` | 267 | Updated - added setColor(), color-aware overlays and rect |
| `core/annotate/annotation-store.ts` | 80 | Unchanged - already matched dist |
| `core/annotate/index.ts` | 317 | Unchanged - already matched dist |
| `core/index.ts` | 465 | Full rewrite - screen glow, toast, prompt mode color sync |
| `core/manipulate/handles.ts` | 315 | Unchanged - not in dist as separate class |
| `core/manipulate/box-model.ts` | 242 | Unchanged - not in dist as separate class |
| `core/manipulate/state-toggle.ts` | 95 | Unchanged - not in dist as separate class |
| `core/manipulate/icons.ts` | 776 | Unchanged - already matched dist |

Total: 3,494 lines across 10 files
