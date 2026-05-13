---
name: Improv changes panel (Phase 2)
description: Claude button + scrollable changes panel with Done/Reply, keyboard shortcuts P/M/C/J/K/D/R
type: project
relates_to: [session_2026-05-13_improv-loop-phase1.md, session_2026-05-13_improv-claude-connection.md]
---

Built Phase 2 of the improv-claude loop: Claude button and changes panel.

**What was built:**
- `core/changes-panel.ts` (new, ~280 lines): scrollable panel with dark glass aesthetic, ARIA roles, keyboard navigation
- Claude button: appears at bottom-left when unreviewed changes exist, badge shows count with markerColor
- Panel shows each change entry with: status dot (green/markerColor/red), summary, files, property pills, question callout for needsInfo
- Done/Reply actions per entry, reply input with markerColor focus border
- Keyboard: J/K navigate entries, D marks done, R opens reply, Escape closes panel, all suppressed in text inputs
- `_updateClaudeBadge` method: creates/removes Claude button based on unreviewed count

**Keyboard shortcuts added to ImprovCore:**
- P: toggle prompt mode
- M: toggle manipulate mode
- C: toggle changes panel
- All suppressed when input/textarea/contenteditable is focused
- Only fire when toolbar is expanded (not collapsed)

**Visually verified:** Screenshot shows panel with 2 entries (completed + needsInfo), Claude button with badge, correct styling matching dark glass aesthetic.

**Additional iteration (ralph loop):**
- Auto-reload on `status: completed` (1.5s delay for toast visibility)
- MarkerColor live update on Claude button via `_updateClaudeBadge` call in `_syncPromptModeColor`
- Verified: auto-reload triggers, history persists across reload, Claude button reappears with correct badge count

**Phase 3: Element highlights**
- `_highlightChangedElements`: finds elements by selector, draws markerColor border + glow box-shadow
- Change pills above elements showing property: newValue
- Pulse animation (2 cycles), fades out after 1.2s, removes after 1.6s
- Respects `prefers-reduced-motion` (skips animation)

**Phase 4: Live CSS preview**
- `_previewChanges`: injects CSS changes via PreviewEngine constructable stylesheets
- User sees changes instantly before page reload
- Reload delay bumped to 2s to show both preview and highlights

**Accessibility:**
- `prefers-reduced-motion` media query in toolbar stylesheet: disables all animations/transitions
- `focus-visible` rings on all buttons using `--improv-marker` CSS variable (follows markerColor)
- CSS variable updated in `updateModeButtonStyles` when markerColor changes

**Files touched:**
- improv/core/changes-panel.ts (new)
- improv/core/index.ts (all phases wired)
- improv/core/toolbar.ts (reduced motion, focus rings, --improv-marker CSS var, _collapsed public)
- improv/core/annotate/index.ts (fixed imports: selection -> element-utils)

**Ralph loop iteration 2:** Fixed TypeScript errors (_collapsed private, annotate imports), added Q shortcut for queue panel, bumped auto-reload to 2s. All 4 phases + all design principles verified in browser screenshot.
