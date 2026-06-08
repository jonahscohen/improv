---
name: manipulate-removable-pill-and-prompt-border
description: Added a removable [icon] tag.class | x selection pill to Manipulate mode (Picker); made Prompt mode's highlight + selection borders 1px square.
type: project
relates_to: [session_2026-06-08_manipulate-tooltip-icons-and-hover-padding.md, session_2026-06-08_prompt-label-centered-above.md]
---

Collaborator: Jonah

## 1. Manipulate removable selection pill (new feature)
Jonah: "build it for manipulate mode" (a removable tag/class pill like Prompt's). Manipulate = the Picker (`selector/picker.ts`); its selection was box + handles + W x H badge + Design panel, no removable pill.
Added a `selectionPill` to the picker chrome (mirrors prompt's selection pill): dark pill `[icon] tag.class | x`, centered ABOVE the element (the W x H badge stays below), built once + content filled per-selection via the existing `renderElementPill` (Elements-tab icon). The X calls `callbacks.onCancel()` -> ManipulateMode.clearSelection() -> picker.clearSelection() (chrome) + renderPanel() (hides Design panel).
Wired: created at init (after selectionLabel); `positionSelectionPill(rect)` centers it above with an in-view top clamp; shown/positioned in `showSelection`, repositioned in `trackSelection`, hidden in `hideSelection`/`suspend`, removed in `destroy`. The X works because `handleClick` returns early when the click path includes the shadow host (line ~2639), so the click reaches the X's listener.

## 2. Prompt highlight border -> 1px square
Jonah: "prompt mode highlight border, make it 1px and dont round border." Changed BOTH (hover highlight + selection box) for consistency:
- `core/overlay.ts` highlight (prompt hover): `border:2px solid #D97757;border-radius:5px` -> `border:1px solid ...;border-radius:0`.
- `core/prompt/index.ts` `_selOverlays` box: `border:2px solid {c}66;border-radius:5px` -> `border:1px ...;border-radius:0` (kept the translucent fill).
(Manipulate's picker box was already 1px solid square.)

## Verify
Built + deployed. Verified on a STATIC test page (`/tmp/justify_pilltest.html` loading the core from :9223, since yesand.lndo.site auto-scrolls/animates and kept deselecting + a heading-link navigated). Manipulate: selecting the <p> showed `T p .lead-text | x` pill above + `480 x 54` badge below + Design panel; clicking the x cleared all of it. Prompt: hover + selection borders render 1px with square corners (zoomed a corner to confirm). Test page + server cleaned up.

VERIFICATION TIP for future Justify UI checks: yesand.lndo.site has heavy scroll-pinning animations that fight coordinate clicks and its headings are links (navigate on click in modes where interception isn't active). Use a static local page that `<script src=http://localhost:9223/justify-core.js>` + POST /activate instead - deterministic.

Files touched: `selector/picker.ts` (pill), `overlay.ts` + `prompt/index.ts` (borders). Rebuilt+deployed. Uncommitted.
