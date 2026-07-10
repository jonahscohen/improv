---
name: Prompt-mode hover child outlines (manipulate parity)
description: Jonah wants prompt-mode hover to show the manipulate picker's detail level - dotted outlines on the hovered element's direct children; ported the picker's child-outline recipe into the shared Overlay behind a setChildOutlines flag, and switched prompt hover from the trackless showHighlight(rect) path to trackElement so the feature (and rAF scroll-tracking) actually engage
type: project
relates_to: [session_2026-07-05_justify-marker-repaint-and-selection-boxes.md]
---

Collaborator: Jonah. 2026-07-05.

Jonah (two screenshots, same li in both modes): "bring that same hover detail over from manipulate mode to prompt mode" - dotted borders on children of the hovered object.

## How
- Source recipe: picker.ts showChildOutlines - direct element children, filtered (skip justify hosts, display:none/visibility:hidden, zero-size rects), 1px dotted marker-colored fixed-position outlines from a div pool (cap 20), unused entries hidden.
- Ported into core/overlay.ts as an opt-in: setChildOutlines(enabled), child list computed ONCE per hover target (getComputedStyle per child is too heavy per frame), rects refreshed in the existing rAF tick so outlines stay glued through scroll; pool created lazily with (this._hlColor || default) border; setHighlightColor repaints the pool; hideHighlight/showHighlight(rect)/disable all hide it.
- Wire-up: core/index.ts prompt branch enables it; switchMode disables it for every other mode (manipulate's picker draws its own chrome - doubles would result if both ran).
- KEY BUG FOUND DURING VERIFICATION: prompt-mode hover never used trackElement - it used overlay.showHighlight(rect), the trackless path (trackElement only ran on click/select). First browser check showed the solid box but zero child outlines; the served bundle was proven fresh (curl grep for the new symbol), which forced the code-path re-read that found it. Fix: _onHover now calls overlay.trackElement(t). Side benefit: the hover box now rAF-tracks its element instead of freezing at hover-time rect.

## Verified (browser, real hovers, fresh hard reload)
- Paragraph with four inline code children ("If you would rather do it by hand..." on justify.html): solid marker border on the paragraph + dotted marker outlines on every code chip, marker-colored (blue at test time) - visually matches Jonah's manipulate-mode reference.
- Hovering an element with no element children (the code chip itself): solid box only, no stray outlines.
- Escape exits prompt mode: box, dotted outlines, glow all clear - no residue (switchMode disable + hideHighlight both cover the pool).
- Gates: tsc 160 (zero new), vitest __tests__/core 1 pre-existing failed file | 8 passed, deployed to daemon + site.

Files touched: justify/core/overlay.ts (child-outline pool + flag), justify/core/index.ts (enable in prompt branch, disable in switchMode), justify/core/prompt/index.ts (_onHover showHighlight -> trackElement); deployed bundles; this beat + MEMORY.md.
