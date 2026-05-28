---
name: Toolbar and icons TypeScript reconstruction from dist
description: Reconstructing core/toolbar.ts and core/icons.ts from beautified dist/improv-formatted.js lines 200-1139
type: project
relates_to: []
---

Collaborator: Jonah

Task: Rewrite core/toolbar.ts and create core/icons.ts to match the dist exactly.

Key differences from the old toolbar.ts (791 lines) vs dist (class U, lines 363-1139):
- Dist uses MODES = ["prompt", "manipulate"] (only 2 modes, no annotate); old source had 3
- Dist has MODE_LABELS with manipulate/prompt/layout (layout exists as label but not in MODES array)
- Dist has close/expand button with SVG path morphing (I/X) and collapse/expand behavior
- Dist has tooltip element (_tt) instead of native title attribute
- Dist has markerColor with localStorage persistence, default #3b82f6
- Dist has WCAG contrast logic for icon colors on light marker backgrounds
- Dist has settings button active state tracking with markerColor background
- Dist has Hints toggle and Selection Labels toggle in settings panel
- Dist has buildToggle() method for toggle switches
- Dist has showHints/showSelectionLabels state with callback arrays
- Dist has elaborate hover animations: slider knob animation for manipulate, wiggle for prompt, spin for settings, nudge for send, shake for clear
- Dist padding is "6px 40px 6px 6px" (right padding for absolute-positioned close button)
- Dist has overflow:hidden and width transition for collapse
- Dist starts collapsed (width 44px, I-beam icon)
- Dist initDrag() is empty (no-op)
- SVG icons extracted to separate functions (z, J, P, ce, nn, on, rn, sn, an, ln, dn, cn, pn)
- Icon builders use data-sl attributes on manipulate icon lines for animation targeting
- Badge button and send button hidden with display:none initially, not appended to DOM flow

Status: COMPLETE - both files written and verified

Verification:
- tsc --noEmit reports zero errors from toolbar.ts and icons.ts
- All methods used by index.ts are present in the new Toolbar class
- Line counts: icons.ts = 175 lines, toolbar.ts = 1004 lines (1179 total)
- Dist source range: lines 200-362 (icons/helpers) + lines 363-1139 (class U) = ~940 lines of JS -> 1179 lines of TS

Files touched:
- core/icons.ts (new) - SVG icon builder functions extracted from dist lines 224-358
- core/toolbar.ts (rewrite) - Toolbar class matching dist class U lines 363-1139
