---
name: Justify - input text-drag + non-selectable active glow
description: lasso no longer hijacks drag-to-select-text in the prompt input; the active screen glow is invisible to selection
type: project
relates_to: [session_2026-06-18_justify-scroll-clearall-heartbeat.md]
---

Collaborator: Jonah

Two selection bugs, both fixed in core (no daemon change).

## #1 - dragging to select text in the prompt input drag-selected DOM elements
Root cause: `LassoSelect._onMousedown` (annotate/lasso.ts) is a document capture-phase
handler that started a drag-rectangle on ANY mousedown, including inside Justify's own UI.
The prompt input lives in the overlay's OPEN shadow root (host carries [data-justify]), so a
mousedown there started a lasso instead of native text selection.
Fix: guard at the top of `_onMousedown` - walk `e.composedPath()`; bail (return, no lasso) if
any node is `[data-justify]` OR an INPUT/TEXTAREA/SELECT/contentEditable. Open shadow + the
[data-justify] host means the composed path surfaces both the input and the host, so the guard
fires reliably. The prompt-mode click/hover handlers already used isJustifyElement, so only the
lasso needed it.

## #2 - the active viewport glow was selectable
Root cause: `#justify-screen-glow` (index.ts _showScreenGlow) is a full-viewport `inset:0` div
appended to <body> with NO [data-justify]. The lasso's `_findIntersecting` does
`querySelectorAll('*')` + rect-intersection and only skips `closest('[data-justify]')`, so the
glow (covering everything) was caught by every lasso. (Click/hover already skip it via
pointer-events:none + elementFromPoint.)
Fix: give the glow `dataset.justify = ''` so selection skips it everywhere, AND set inline
`pointer-events:none !important` so the event-intercept rule
(`[data-justify]{pointer-events:auto !important}`) can't turn the full-viewport overlay into a
click-eating layer (inline !important beats author-stylesheet !important). Also keeps the glow
out of freeze (data-justify elements aren't paused), so it keeps pulsing.

Verified: both changes present in the rebuilt dist/justify-core.js (composedPath/isContentEditable/
TEXTAREA for the guard; `_screenGlow.dataset.justify=""` + `pointer-events:none !important` for the
glow). Deployed to ~/.claude/justify + public/justify-core.js. Full interactive e2e (a real lasso
drag over the glow / a real text-drag in the input) needs a tab reload + real input; the exclusion
logic itself is deterministic and bundle-confirmed.

Files: justify/core/annotate/lasso.ts, justify/core/index.ts. Rebuilt + deployed.
