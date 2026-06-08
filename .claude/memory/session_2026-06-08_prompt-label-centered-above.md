---
name: prompt-label-centered-above
description: Repositioned the Justify Prompt-mode selection label from right-of-element to centered directly above the selected element.
type: project
relates_to: [session_2026-06-08_prompt-scroll-jam-fix.md]
---

Collaborator: Jonah

## Request
The selection label/tooltip in Prompt mode sat to the right of the selected element (`rect.right + 4`, top-aligned). Jonah wanted it centered directly above the selected object.

## Change (`claude-dotfiles/justify/core/prompt/index.ts`)
The label-positioning logic was duplicated in 3 places (initial render in `_showSelOverlays`, the `_update` raf, and `_boundScroll`). Extracted ONE helper and pointed all three at it:
```
_positionSelLabel(label, rect):
  x = rect.left + rect.width/2 - labelW/2   // centered horizontally on the element
  clamp x into [4, vpW - labelW - 4]
  y = rect.top - labelH - 6                 // above the element
  if element in view (rect.bottom>0 && rect.top<innerHeight) && y<4 -> y=4  // keep on-screen near top edge
```
- `_showSelOverlays`: call `_positionSelLabel(lb, r)` right after appending the label (offsetWidth valid post-append; no first-frame flash).
- `_update`: replaced the inline right-of-element block with `self._positionSelLabel(tr.label, rect)`.
- `_boundScroll`: replaced its inline block with `this._positionSelLabel(_st.label, _sr)`.
- The in-view-only top clamp preserves the prior scroll-jam fix ([[session_2026-06-08_prompt-scroll-jam-fix.md]]): label stays visible when the element is near the top edge but still scrolls off once the element leaves the viewport.

## Build/deploy/verify
`node build.js --core-only` + `bash deploy.sh --core-only`. Verified live (yesand.lndo.site, Prompt mode): selected the h3 "Yes& is an independent..." heading -> `h3 .fl-module` label pill centered horizontally directly above the heading box, just above its top edge. A single non-shift click also correctly cleared a stray multi-select (the site auto-scrolls, which had accumulated several selections during coordinate clicks) - selection logic intact.

Files touched: `claude-dotfiles/justify/core/prompt/index.ts` (helper + 3 call sites), rebuilt+deployed bundle. Uncommitted working-tree changes.
