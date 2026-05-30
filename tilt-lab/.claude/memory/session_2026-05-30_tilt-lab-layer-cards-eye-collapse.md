---
name: tilt-lab layer/channel cards - eye toggle, collapse, bare grip
description: Reworked LayerStack channel cards - eye visibility button, collapsible cards, stacked title, bare grip handle
type: project
relates_to: [session_2026-05-29_tilt-lab-layer-composition.md, session_2026-05-30_tilt-lab-header-and-dnd.md]
---

Collaborator: Jonah

Reworked the per-layer "channel" cards in the composition right rail (LayerStack).

Changes:
- Replaced the red enable Switch with an EYE IconButton (eye=visible/enabled, eye-off=hidden). Moved it INTO the actions row, immediately left of trash: [up][down][eye][trash]. aria-label "Hide {name}" when visible / "Show {name}" when hidden. Click -> onSetEnabled(i, !enabled).
- Collapsible cards. Each card is now a `ChannelCard` sub-component with its own `useState(false)` collapse flag. Collapsed shows only [grip][title/role][chevron]; expanded shows opacity fader + actions row + ParamControls. Disclosure is a real <button className="channel__disclosure"> with aria-expanded; clicking the title area toggles. ChevronDownIcon rotates (180deg expanded -> 0deg collapsed). `data-collapsed` on the <li> drives the chevron CSS.
- Drag handle: removed the <button> wrapper and the "01"/"02" index number. Now a plain <span className="channel__handle"> with role="button" + aria-label + title, carrying the existing pointer handlers. Pointer handler types widened from HTMLButtonElement to HTMLElement. All pointer-drag reorder logic (dragIndex/overIndex/slotForY, data-drop-before/after) unchanged.
- Title block stacked: name on top, role/type underneath via `.channel__title` grid; role keeps `.meta`.

Why ChannelCard sub-component over a Set<number> of collapsed indices: index-keyed Set shifts meaning on reorder/remove; component-local state is cleaner. Default expanded resets per render identity, acceptable.

Icons: added EyeIcon + EyeOffIcon to icons.tsx, path data copied VERBATIM from Lucide (raw.githubusercontent.com/lucide-icons/lucide/main/icons/eye.svg and eye-off.svg). Matches existing LucideIcon wrapper pattern.

Kept intact: muted-fill opacity fader (red only on active/focus), disabled-channel dimming, up/down keyboard reorder, trash, ParamControls, drop-line affordances.

Verify: `npx tsc --noEmit` 0 errors; `npm test` 161/161 pass (canvas getContext errors are pre-existing ThumbnailPreview jsdom noise). No test referenced the old channel structure, so none needed updating.

Files touched:
- app/src/components/icons.tsx (EyeIcon, EyeOffIcon)
- app/src/components/LayerStack.tsx (ChannelCard component, eye button, collapse, bare grip)
- app/src/components/LayerStack.css (disclosure, title stack, chevron rotation, bare grip styling)
