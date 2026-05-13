---
name: Improv changes panel detail view
description: Replaced inline expand/preview with clickable list items and slide-in detail subpage
type: project
relates_to: [session_2026-05-13_improv-changes-panel.md]
---

## Changes (Jonah, 2026-05-13)

- Removed "Show Changes" / "Hide Changes" button and associated expandedPrompts Set / expand/collapse logic
- Removed "Preview" toggle button and previewingPrompts Set / preview logic
- Removed inline detail rows (the expanded diff view inside list items)
- Removed onPreviewToggleCallback property and setter
- Replaced property diff pills with compact diff stats: `+N -N` in green/red monospace
- Made list items clickable to open detail view via onItemClick(index) callback
- Added showDetail(entry, index) method: hides list, shows slide-in detail container
- Detail view: back button, entry summary, file-grouped diffs (selector, property, old->new)
- Added hideDetail() method to reverse detail view
- Detail view styled with dark glass aesthetic (#1a1a1a bg, rgba borders, 12px mono)

### Files touched
- improv/core/changes-panel.ts
