---
name: tilt-lab header refresh + layer drag-and-drop (Jonah punch list)
description: 5 edits - header to 60px, project picker -> centered contextual menu, rightmost actions -> icon-only (Lucide), removed paint-order caption, pointer-based drag-and-drop reorder on the layer list with grip handle + drop-line.
type: project
relates_to: [session_2026-05-29_tilt-lab-qa-gate.md, session_2026-05-29_tilt-lab-cd-review.md]
---

Collaborator: Jonah. 2026-05-30. Punch list after the redesign + QA pass. CD direct edits (builders idle).

## Done
1. Header 60px: styles.css .top-bar min-height 44->60, now a 3-zone grid `1fr auto 1fr` (left identity / center project / right actions); removed dead .top-bar__spacer.
2. Project picker -> CENTERED CONTEXTUAL MENU: ProjectPicker.tsx rewritten from native <select> to a trigger button + popover (role=menu), outside-click + Escape close, caret rotates, check on selected item; empty "No projects (server offline)" state. ProjectPicker.css new popover styling. Sits in grid center column.
3. Rightmost actions ICON-ONLY: TopBar.tsx -> .icon-btn buttons with PlusIcon (Add shader), DownloadIcon (Download config), CopyIcon/CheckIcon-when-copied (Copy config); aria-label + title carry the text. Added Lucide PlusIcon/DownloadIcon/CopyIcon/GripVerticalIcon/CheckIcon to icons.tsx (verbatim paths).
4. Removed "Paint order / background to post" caption from LayerStack.tsx + its .layer-stack__order CSS.
5. Drag-and-drop reorder: replaced native HTML5 DnD (not reliably automatable/verifiable) with POINTER-based reorder. Grip handle (GripVerticalIcon + index) with setPointerCapture; onPointerMove measures each .channel mid-line (getBoundingClientRect) to pick the drop slot; drop-line affordance via data-drop-before/after box-shadow accent rule; touch-action:none on handle. Insertion-slot -> store index conversion (to = from < slot ? slot-1 : slot). Keyboard up/down reorder buttons retained for a11y.

## VERIFIED in Chrome (all 5): tsc 0 / 161 tests. Header taller (60px). Project menu centered, click opens popover ("No projects (server offline)"), caret flips. Rightmost = 3 icon-only buttons (plus/download/copy, export pair dimmed at 0 layers). No paint-order caption. Grip handle (6-dot + index) renders. DRAG-AND-DROP CONFIRMED: added Aurora(01)+ASCII(02), dragged ASCII grip up -> ASCII became 01 (reorder fired correctly via pointer-based slotForY).
## Files: icons.tsx, ProjectPicker.tsx+css, TopBar.tsx, styles.css, LayerStack.tsx+css.
## Note: old Chrome tab 1827119023 wedged (GPU freeze on poster-gen reload, unrelated to code) - verified in fresh tab 1827119041. Drag across very tall param lists needs the rail scrolled (collapse accordions to bring distant channels together).
