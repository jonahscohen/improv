---
name: tilt-lab layer cards rework (eye visibility, collapsible, bare grip)
description: Channel cards in the composition rail reworked - enable Switch -> eye/eye-off IconButton moved into the actions row left of trash; cards collapse to a single row (grip + stacked title/type + chevron); drag handle stripped to a bare grip span (no button wrapper, no index number); title with shader type stacked underneath. Done by teammate layer-cards, verified in Chrome.
type: project
relates_to: [session_2026-05-30_tilt-lab-header-and-dnd.md, session_2026-05-29_tilt-lab-qa-gate.md]
---

Collaborator: Jonah. 2026-05-30. First task of the one-teammate-per-task workflow. Teammate "layer-cards" (team tilt-tasks).

## Done (LayerStack.tsx + LayerStack.css + icons.tsx)
1. Eye visibility button replaces the enable Switch: IconButton, EyeIcon (visible) / EyeOffIcon (hidden), onClick onSetEnabled(i,!enabled), aria-label Hide/Show.
2. Eye sits in the actions row, left of trash: [up][down][eye][trash].
3. Collapsible cards via a ChannelCard sub-component (local useState collapsed). Collapsed = single row [grip][title/role stacked][chevron]; expanded adds opacity + actions + ParamControls. Disclosure = real <button> aria-expanded; ChevronDownIcon rotates.
4. Drag handle = bare <span class=channel__handle> (role=button, pointer handlers) - removed the <button> wrapper AND the 01/02 index number. Pointer-drag reorder logic unchanged (handler types widened to HTMLElement).
5. Title stacked: name on top, role/type (.meta) underneath.
- EyeIcon/EyeOffIcon added to icons.tsx, paths VERBATIM from current Lucide (lucide.dev eye / eye-off).

## Verified (Claude-in-Chrome, tab 41): grip+stacked-title+chevron header; collapse -> single row; actions [up][down][eye][trash]; eye click hid Aurora (preview black) + swapped to eye-off. tsc 0, 161 tests.
## Note: chrome MCP coordinate offset (screenshot vs viewport) made small-target clicks miss; ref-based click (find -> ref) is reliable for this tab. Use refs for small buttons.
## Design note: added a subtle chevron disclosure (beyond "just title + handle") for re-expand discoverability, consistent with param accordions - flagged to Jonah.
