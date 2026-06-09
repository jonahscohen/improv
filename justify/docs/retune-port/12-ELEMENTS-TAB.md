# 12 - Elements Tab (ElementTree) - 1:1 Port Blueprint

Author of build plan: Jonah (jonahscohen@gmail.com)
Status: BLUEPRINT (build not started). Replaces the deferred stub in `PropertyPanel.tsx`.

This is the exhaustive, build-ready spec for porting Retune's **Elements** tab
(`ElementTree`) into Justify's Manipulate mode as an exact 1:1 replica. The Design
tab is already shipped 1:1 (specs 01-11). This document is for the build agents -
follow it verbatim. Absolute paths throughout.

---

## 0. The single most important finding (read first)

**ElementTree needs ZERO new icons and ZERO icon substitutions.** Every icon it
draws - the layer-type glyphs (frame-h, frame-v, grid, block, text, image,
component, svg, input), the expand/collapse caret, the live SVG-shape mini-preview,
and the fallback box - is an **inline `<svg>` literal defined inside
`ElementTree.tsx` itself** (lines 185-330, 430-433). There are **no imports from
`ui/icons.tsx`, no `@central-icons-react`, no Lucide**. Porting the component
verbatim carries the icon data with it, character-for-character, which satisfies the
never-fabricate-SVG rule automatically. This removes the single biggest risk class
that the Design port had to manage.

**Second finding:** `getDirectReactComponent` - the only cross-module symbol
ElementTree imports - **already exists** in our ported
`/Users/spare3/Documents/Github/improv/justify/core/selector/identifier.ts`
(line 650), with identical signature and behavior to Retune's. No selector work is
required. On a non-React page it returns `null` and the tree falls back to
class/id/tag labels - exactly as in Retune.

**Net:** this is a near-mechanical React->Preact port of one 923-line file + one CSS
block, plus wiring three callbacks. The only genuine engineering is mapping
drag-reorder/reparent onto our change/queue pipeline (Section 4), which we phase.

---

## 1. Component breakdown of ElementTree

Source of truth: `/Users/spare3/Documents/Github/retune/packages/overlay/src/overlay/ElementTree.tsx` (923 lines).

### 1.1 Exported surface
- `ElementTree(props: ElementTreeProps)` - the panel component (line 464).
- `ReparentEntry` interface (line 11): `{ element, newParent, insertIndex }`.
- `ElementTreeProps` (line 17): `selectedElement`, `onSelect`, `onHover`,
  `visualOrderMap?`, `reparentEntries?`, `onTreeReorder?`, `onTreeReparent?`.
- `getVisibleChildren(el, visualOrderMap?, reparentEntries?)` (line 67) - exported, unit-tested.
- `computeDropIndex(cursorY, siblingRects)` (line 355) - exported, unit-tested.

### 1.2 Tree row (`TreeNode`, memoized - line 384)
Each row is a single flex `div.retune-tree-node` containing, left to right:
1. **Expand/collapse caret** (`span.retune-tree-arrow`): 16x16. Shows the inline
   chevron SVG (line 430-433) only when the node `hasChildren`. CSS rotates it
   `-90deg` collapsed -> `0deg` expanded (`.expanded`). `.empty` when no children
   (`visibility:hidden`, keeps indent). Click toggles, `stopPropagation` so it
   doesn't trigger drag/select.
2. **Layer-type icon** (`span.retune-tree-icon`): 16x16, `opacity:0.5` default,
   `opacity:1` on hover/selected/descendant-selected. Either `<LayerIcon type>` or,
   for SVG nodes, `<SvgShapeIcon element>` (a LIVE mini-preview rendered from the
   element's own path/points/viewBox). `--component` modifier recolors to blue.
3. **Name** (`span.retune-tree-name`): the display label (Section 1.4). `--component`
   modifier -> blue, weight 500. Ellipsis-truncated.
4. **"moved" badge** (`span.retune-tree-moved`): shown only when this element has a
   pending reparent (`isReparented`). Small blue pill.

Row geometry (from CSS, Section 7): `height:32px`, `gap:4px`,
`padding-left: 12 + depth*20` (inline style, line 413), `padding-right:12px`.

### 1.3 Indentation / depth
`paddingLeft = 12 + depth * 20` px, applied inline on each row (line 413). Depth is
passed down recursively; body's direct children render at `depth=0` (line 907).
The drop-indicator indent mirrors this: `12 + depth*20` for reorder (line 590), and
`12 + targetDepth*16` for reparent indicators (lines 744, 759) - **note the
intentional 20 vs 16 discrepancy in Retune; preserve it verbatim**.

### 1.4 Label resolution (`formatNodeLabel`, line 147)
Priority order (1:1):
1. If `getDirectReactComponent(el)` returns a name -> use it, icon = `component`.
2. Else if text tag (`TEXT_TAGS`, line 96) with direct text -> first 24 chars (22 +
   "...") of the text, icon = `text`.
3. Else if `el.className` (string) -> first class token.
4. Else if `el.id` -> `#id`.
5. Else -> lowercased tag name.

### 1.5 Layer-icon type resolution (`getLayerIcon`, line 112)
1. `component` if it is a React component root.
2. `text` for `TEXT_TAGS`.
3. `image` for `IMAGE_TAGS` (IMG/PICTURE/VIDEO/CANVAS).
4. `svg-shape` for `<svg>` and SVG shape tags (path/circle/ellipse/rect/line/polyline/polygon).
5. `input` for INPUT/SELECT/TEXTAREA/BUTTON.
6. Layout-derived for containers (reads `getComputedStyle`): `grid` for grid;
   `frame-h`/`frame-v` for flex row/column; else `block`.

### 1.6 Live SVG preview (`SvgShapeIcon`, line 186)
Renders a 16x16 stroked mini-preview built from the element's own geometry
(`getBBox`, viewBox parsing, `dangerouslySetInnerHTML` for `<svg>` roots).
**Preact gotcha:** `dangerouslySetInnerHTML` is supported in Preact (same prop
name). Keep verbatim. `getBBox` can throw on unrendered nodes -> wrapped in
try/catch -> `<LayerIconFallback/>`.

### 1.7 Hover / selected / descendant state
- Hover: `onPointerEnter`/`onPointerLeave` call `onHover(element)` / `onHover(null)`
  (suppressed while a drag is active). CSS `.retune-tree-node:hover` background.
- Selected: `element === selectedElement` -> `.selected` (blue bg).
- Descendant-of-selected: `selectedElement.contains(element)` -> `.descendant-selected`
  (faint blue). Computed per row (line 403).

### 1.8 Expand/collapse state (`ElementTree`, line 465)
`expandedSet: Set<Element>` in component state. `handleToggle` flips membership.
**Auto-expand-on-select** (line 498): a `useEffect` on `selectedElement` adds all
ancestors of the new selection to `expandedSet`, then `requestAnimationFrame` ->
`scrollIntoView({block:'nearest', behavior:'smooth'})` on `.selected`. This is the
reverse-sync (page-select -> tree reveals + scrolls).

### 1.9 Tree construction (root walk)
`bodyChildren = getVisibleChildren(document.body, undefined, reparentEntries)` (line
896). Recursion renders children only when `isExpanded`. `getVisibleChildren`
(line 67):
- Source = `visualOrderMap.get(el)` if present, else `Array.from(el.children)`.
- Skips `SKIP_TAGS` (SCRIPT/STYLE/LINK/META/TITLE/HEAD/NOSCRIPT/BR/WBR/COL).
- Skips `isRetuneElement` overlay nodes (Section 3.3 - **must be re-pointed to
  Justify's overlay markers**).
- Applies pending reparents (removes reparented-away, inserts reparented-in).

### 1.10 Stable keys
`getStableKey(el)` (line 38) assigns a monotonic id per Element via WeakMap, with a
reverse `Map<number,Element>` so drag hit-testing can recover the Element from a
`data-retune-tree-key` DOM attribute (line 411, 622). Avoids index-key reorder bugs.
**Rename note:** keep the data attribute name consistent with our overlay markers
(Section 3.3); the test file references `data-retune-tree-key` but it is internal -
we may keep `data-retune-tree-key` or switch to `data-justify-tree-key`. Pick one and
keep the reader (line 620) and writer (line 411) in sync. Recommend
`data-justify-tree-key` for brand hygiene; this is the ONLY rename that touches logic.

### 1.11 Drag machinery (lines 363-894)
All drag state lives in a single `dragRef` (no re-renders mid-drag). Covers:
threshold activation (5px), ghost element, drop-indicator line, sibling-rect
snapshotting, reorder vs reparent mode detection, expand-on-hover (500ms),
auto-scroll near edges (30px zone, 8px/frame), and pointer-capture via
`document.addEventListener("pointermove"/"pointerup", ..., true)`. Full behavior in
Section 4.

---

## 2. Exact file map (Retune source -> Justify target)

| # | Retune source | Justify target | Action |
|---|---|---|---|
| 1 | `retune/packages/overlay/src/overlay/ElementTree.tsx` | `improv/justify/core/manipulate/ui/ElementTree.tsx` | CREATE - port React->Preact |
| 2 | `retune/.../selector/identifier.ts` `getDirectReactComponent` | `improv/justify/core/selector/identifier.ts` (line 650) | ALREADY EXISTS - import from here |
| 3 | `retune/.../overlay/overlay.css` lines 665-817 (`.retune-tree*`) | `improv/justify/core/manipulate/styles/elements-tree.css` | CREATE - port CSS block verbatim |
| 4 | n/a | `improv/justify/core/manipulate/PropertyPanel.tsx` (lines 301-305 stub) | MODIFY - replace stub with `<ElementTree/>`; thread new props |
| 5 | n/a | `improv/justify/core/manipulate/index.ts` (`renderPanel`, `activate`) | MODIFY - pass tree callbacks; wire picker hover highlight; add reorder/reparent handlers |
| 6 | `retune/.../__tests__/tree-drag.test.ts` | `improv/justify/core/manipulate/__tests__/tree-drag.test.ts` (or co-located) | PORT - import path `../ui/ElementTree`; behavior identical |

**Import target for #1:** `import { getDirectReactComponent } from '../../selector/identifier.js'`
(from `core/manipulate/ui/` to `core/selector/`). Note the `.js` extension
convention used everywhere in our core (see `index.ts` lines 1-17).

**Why `ui/ElementTree.tsx` (not `manipulate/ElementTree.tsx`):** the Preact
components/sections all live under `core/manipulate/ui/`. ElementTree is a Preact
component; it belongs with `ui/sections/*`. Keep it directly in `ui/` (it is not a
Design section).

**CSS loading:** `elements-tree.css` is added to the `installPanelChrome` constructable
stylesheet array in `index.ts` (line 539): append it to the
`[panelShellCss, sectionsCss, controlsCss, colorGradientCss, typographyCss]` list.
The `css.d.ts` ambient module (already present, `styles/css.d.ts`) lets esbuild's
`.css` text loader import it as a string. Add
`import elementsTreeCss from './styles/elements-tree.css';` at the top of `index.ts`.

---

## 3. Data flow

### 3.1 Tree build (live DOM)
- **Root:** `document.body`. `getVisibleChildren(document.body, ...)` -> depth-0 rows.
- **Children walk:** recursive, lazy (only expanded nodes recurse). Pure DOM reads
  (`Array.from(el.children)` + `getComputedStyle` for layout icons).
- **Excluded:** `SKIP_TAGS` (meta/invisible) + Justify overlay nodes (Section 3.3).
- **No virtualization** in Retune - rows render eagerly within expanded branches.
  Acceptable; match it.

### 3.2 Two-way selection sync
- **Tree -> page (forward):** row pointerup below threshold (or click) ->
  `onSelect(element)`. In Justify this routes to
  `ManipulateMode.selectElement(element as HTMLElement)` (index.ts line 163), which:
  rebuilds scope levels, refreshes scoped styles, paints picker selection chrome
  (`picker.selectElement`/`refreshSelection`), and re-renders the panel. The picker's
  box/badge highlight on the page is the visual confirmation.
- **Page -> tree (reverse):** the picker's `onSelect` already calls
  `selectElement`, which calls `renderPanel`, which passes the new
  `selectedElement` into `<PropertyPanel>` -> `<ElementTree selectedElement=...>`.
  ElementTree's `useEffect` (line 498) then auto-expands ancestors and
  `scrollIntoView` the selected row. **This works for free** as long as the tree is
  not remounted on selection (Section 6.2).

### 3.3 Overlay-node exclusion (MUST re-point)
Retune's `isRetuneElement` (line 55) checks `data-retune-host`,
`data-retune-highlight`, `data-retune-selection`, `data-retune-label`,
`data-retune-selection-label`. **Justify uses different markers.** The picker creates
its highlight with `data-justify-highlight` (picker.ts line 163) and the panel mount
uses `dataset.justify` (`data-justify`, index.ts line 561); the overlay host is the
shadow host. ACTION: rewrite `isRetuneElement` -> `isJustifyOverlayElement` to test
the Justify markers. Grep the picker + overlay for every `data-justify*` /
`setAttribute` marker and exclude them all. Concretely, exclude any element with a
`data-justify*` attribute (the panel container, highlight, selection, scope
highlights, labels) AND the overlay shadow host. **Verify by inspecting the live
overlay DOM** during validation - any stray Justify chrome appearing as a tree row is
a bug.

### 3.4 Hover sync
- Tree row hover -> `onHover(element)` -> ManipulateMode wires this to
  `picker.highlightElement(element)` (picker.ts line 2843, exposed on the public
  surface line 2901). `onHover(null)` -> `picker.highlightElement(null)` clears it.
- Currently `activate()` registers `.onHover(() => {})` (index.ts line 123) - a
  no-op. Leave the picker's own page-hover as-is; the TREE hover is a SEPARATE
  channel passed through PropertyPanel props (do not confuse the two). The tree calls
  the ManipulateMode hover handler directly, which calls `picker.highlightElement`.

### 3.5 Expand/collapse state ownership
Lives inside ElementTree (`expandedSet`). It is NOT lifted to ManipulateMode. This is
correct and 1:1 - just ensure ElementTree is not keyed/remounted per selection
(Section 6.2), or expand state resets on every click.

---

## 4. Drag / reorder / reparent

### 4.1 Visual drag behavior (self-contained in ElementTree - port verbatim)
From `ElementTree.tsx` + confirmed by `tree-drag.test.ts`:
- **Activation:** pointerdown on a row arms `dragRef`; movement past
  `DRAG_THRESHOLD=5px` activates. On activation: select the dragged element,
  auto-collapse it if expanded, snapshot sibling rects, add `.dragging`, spawn ghost
  + indicator.
- **Reorder (same parent):** `computeDropIndex(cursorY, siblingRects)` via midpoint
  comparison (tested: returns 0..length; cursor exactly at midpoint -> next index).
  Indicator line drawn between siblings at sibling depth. On drop, if
  `dropIndex !== dragIndex` -> `onTreeReorder(element, fromIndex, toIndex)`.
- **Reparent (different parent):** relative-Y zones on the target row - `<0.25`
  insert-before, `>0.75` insert-after (both into target's parent), middle = drop INTO
  target as last child (`.reparent-target` dashed outline). `getVisibleChildren`
  computes insert index. On drop -> `onTreeReparent(element, newParent, insertIndex)`.
- **Guards:** never drop onto self, a descendant, or an ancestor (`isAncestor`,
  tested). Expand-on-hover after 500ms over a collapsed node with children.
- **Auto-scroll:** within 30px of scroller top/bottom, scroll 8px/frame and
  re-snapshot rects.
- **Reorder index math (tested):** `arr.splice(from,1); arr.splice(to>from?to-1:to,0,moved)`.
- **Reparent encoding (tested):** `oldParentSelector@oldIndex` ->
  `newParentSelector@insertIndex`, parsed with `lastIndexOf("@")` to tolerate `@` in
  selectors.

### 4.2 What Retune's handlers do (heavy - the upstream reference)
`handleTreeReorder` (Retune.tsx 3313) and `handleTreeReparent` (3411):
- **Reorder:** flex/grid parents use `style.order`; block parents use `style.translate`
  (FLIP-style). Records a `__reorder` pseudo-property on a ChangeTracker
  (`ensureOriginalValue` -> `recordChange(toIndex)`), pushes an undo entry capturing
  every sibling's prior `order`/`translate`, optionally bulk-applies to all matching
  parents (scope propagation), then refreshes selection + bumps `changeRevision`
  (which recomputes `visualOrderMap`, the memo at 2753).
- **Reparent:** actual `insertBefore`/`appendChild` DOM move, a MutationObserver
  safety net (removes React-recreated duplicates in old parent; re-inserts if React
  removes the moved node from new parent), records `__reparent` pseudo-prop, stores
  undo, bulk-applies, updates `reparentEntries` for the tree preview.

### 4.3 How this maps onto Justify (PHASED - this is the real decision)

Justify's pipeline is **selector + property -> changeBuffer.add -> syncQueue -> one
task per selector** (index.ts 334-416). It does NOT have Retune's ChangeTracker
`__reorder`/`__reparent` pseudo-property machinery, FLIP translate engine, bulk-scope
propagation, or undo stacks. Recommendation:

**Phase A (ship first - the 1:1 navigator):** Render `<ElementTree>` with
`selectedElement`, `onSelect`, `onHover` ONLY. Omit `onTreeReorder`/`onTreeReparent`.
ElementTree's `handleDragStart` early-returns when both are undefined (line 849), so
**drag is cleanly disabled and pointerdown falls through to click-select** - no dead
UI, no half-built drag. This delivers the full visual + navigation 1:1 (icons, rows,
indent, carets, hover/selected, two-way sync, expand/collapse, scroll). This is the
bulk of the "Elements tab" value and is low-risk.

**Phase B (wire drag -> change/task):** Add `onTreeReorder`/`onTreeReparent` handlers
on ManipulateMode that translate a tree drag into a tracked change/task:
- Mount `visualOrderMap` + `reparentEntries` as state (in PropertyPanel or, cleaner,
  in ManipulateMode and passed down) so the tree shows the pending preview.
- `onTreeReorder(el, from, to)`: apply the live visual reorder (port Retune's
  flex-`order` / block-`translate` logic, or a simplified `order`-only first pass),
  update `visualOrderMap`, and record ONE change via a new pseudo-property on the
  changeBuffer: `changeBuffer.add(selector, '__reorder', String(originalIndex),
  String(to))`. Extend `syncQueue` to emit a human-readable line for `__reorder`
  (e.g. "Move `<selector>` to index N among its siblings") instead of the CSS-change
  template.
- `onTreeReparent(el, newParent, idx)`: perform the DOM move + MutationObserver safety
  net (port verbatim), update `reparentEntries`, record
  `changeBuffer.add(selector, '__reparent', oldParentSel@oldIdx, newParentSel@idx)`,
  and have `syncQueue` emit "Move `<selector>` into `<newParentSel>` at index N".
- **Bulk-scope propagation and the full undo stack are OUT of scope for B** (flag as
  Phase C / deferred) unless the lead wants exact parity. Justify already has
  per-selector revert via `revertSelector` (index.ts 424); a reorder/reparent task
  reverts by restoring the DOM/visual state - note this requires storing the inverse
  op, which `revertSelector` does not yet do for non-CSS changes. Flag as a known gap.

**Recommendation to lead:** Ship Phase A as "Elements tab 1:1 (navigation)", land
Phase B as a follow-up. The user's "1:1 icons, functionality, presentation" mandate
is fully met for presentation + navigation in A; drag-as-tracked-change is the one
piece with real pipeline-integration cost and should be its own validated unit.

---

## 5. Icons (the exact 1:1 list + source)

**Every icon is inline-verbatim inside `ElementTree.tsx`. No external icon files, no
substitutions.** Port the file -> icons come with it. Inventory (all
`viewBox="0 0 16 16"` unless noted, `currentColor`):

| Icon | Source location in ElementTree.tsx | Notes |
|---|---|---|
| Expand caret (chevron) | line 430-433 | rotated by CSS |
| `frame-v` | LayerIcon case, ~273 | flex column |
| `frame-h` | ~279 | flex row |
| `grid` | ~285 | 4 rects |
| `block` | ~294 | rounded square |
| `text` | ~300 | "T" glyph |
| `image` | ~306 | mountain/sun |
| `component` | ~312 | Figma-style component diamond |
| `svg` | ~318 | (same box as block; rarely hit - svg routes to svg-shape) |
| `input` | ~324 | (same box as block) |
| `LayerIconFallback` | line 261 | rounded square |
| `SvgShapeIcon` (live preview) | line 186 | generated FROM the page element's own geometry at render time - not a static asset; port the generator verbatim |

**Cross-check against 00-PLAN / 08-icons:** the Design port's 41-icon inventory does
NOT include any of these tree icons - they are exclusive to ElementTree and
self-contained. No additions to `core/manipulate/ui/icons.tsx` or `section-icons.tsx`
are required. **Do not** route these through the shared icon library; keep them inline
exactly as Retune does (the tree icons are tuned to the 16px tree grid).

---

## 6. Wiring

### 6.1 Replace the stub in PropertyPanel.tsx
Current stub (lines 301-305):
```
{panelTab === 'elements' && (
  <div style={{ padding:'16px', ...}}>Elements tree (deferred)</div>
)}
```
Replace with:
```
{panelTab === 'elements' && (
  <ElementTree
    selectedElement={element}
    onSelect={onElementSelect}
    onHover={onElementHover}
    visualOrderMap={visualOrderMap}        // Phase B only
    reparentEntries={reparentEntries}      // Phase B only
    onTreeReorder={onTreeReorder}          // Phase B only (omit in A)
    onTreeReparent={onTreeReparent}        // Phase B only (omit in A)
  />
)}
```
- `import { ElementTree } from './ui/ElementTree';` at top of PropertyPanel.tsx.
- Extend `PropertyPanelProps` with: `onElementSelect?: (el: Element) => void`,
  `onElementHover?: (el: Element | null) => void`, and (Phase B)
  `visualOrderMap?`, `reparentEntries?`, `onTreeReorder?`, `onTreeReparent?`.
- `element` prop is already `HTMLElement | null`; ElementTree accepts
  `Element | null`. Compatible.

### 6.2 Do NOT remount the tree on selection (critical)
The Design body is wrapped in `<div key={selector ?? 'none'}>` (line 275) to force
remount per element. **The Elements tab must NOT be inside that keyed div** (it
already is not - it is a separate `panelTab === 'elements'` branch). Ensure the
Elements branch is never given a `key` tied to selector, or `expandedSet` resets on
every page click. The tree should persist as long as the panel is mounted. Note: the
panel only renders when `visible` (an element is selected) - so the tree exists
whenever there is a selection, which is when the user can be on the Elements tab.
(If the lead later wants the Elements tab usable with no selection, the panel's
`visible` gate must change - out of scope here.)

### 6.3 ManipulateMode.renderPanel - pass the callbacks
In `index.ts` `renderPanel` (line 573), add to the `h(PropertyPanel, {...})` props:
- `onElementSelect: (el) => this.selectElement(el as HTMLElement)`
- `onElementHover: (el) => this.picker?.highlightElement(el)`
- Phase B: `visualOrderMap: this.visualOrderMap`,
  `reparentEntries: this.reparentEntries`,
  `onTreeReorder: this.handleTreeReorder`,
  `onTreeReparent: this.handleTreeReparent`.

### 6.4 Shared shadow root / stylesheets / theme
ElementTree renders inside the SAME `<PropertyPanel>` tree, into the SAME
`panelContainer` inside the overlay shadow root, under the SAME
`adoptedStyleSheets` + `.dark` host class as the Design tab (index.ts 531-565).
Adding `elements-tree.css` to the sheet array (Section 2) is the only chrome change.
The tree's ghost/drop-indicator append to the shadow root (ElementTree lines 553-558,
565) - which is correct for our setup (Retune does the same), giving them token
access. Verify `scrollRef.current.getRootNode() instanceof ShadowRoot` holds in our
mount (it does - the panel lives in the overlay shadow root).

---

## 7. Styling parity

### 7.1 Port the CSS block verbatim
`overlay.css` lines 665-817 -> `core/manipulate/styles/elements-tree.css`. Classes:
`.retune-tree`, `.retune-tree-inner`, `.retune-tree-node` (+`:hover`, `.selected`,
`.descendant-selected`, `.dragging`, `.reparent-target`), `.retune-tree-arrow`
(+`.expanded`, `.empty`), `.retune-tree-icon` (+`--component`), `.retune-tree-name`
(+`--component`), `.retune-tree-moved`, `.retune-tree-drop-indicator` (+`::before`),
`.retune-tree-ghost`.

### 7.2 Token mapping (ALL already defined in panel-shell.css - verified)
Every token the tree CSS references already exists in
`core/manipulate/styles/panel-shell.css`:
- `--retune-surface-hover` (row hover) - line 114/147
- `--retune-blue-bg` (selected row) - line 128/160
- `--retune-blue-500` (caret/indicator/outline; `#D97757` - Justify's accent) - line 79
- `--retune-blue-text` (component name/icon) - line 127/159
- `--retune-text` / `--retune-text-tertiary` (name / icon+caret) - line 107-109/140-142
- `--retune-surface` (ghost bg) - line 113/146 (dark = `#1a1a1a`, matches claudebar)
- `--retune-border` (not used by tree directly but section CSS shares it)
No new tokens needed. The dark theme already maps `--retune-surface:#1a1a1a` so the
tree chrome matches the panel/claudebar background requirement.

### 7.3 Font parity
- **Names/labels:** `.retune-tree-name` uses `font-size:11px; weight:400;
  letter-spacing:0.005em` inheriting the panel base `JustifySans` (panel-shell line
  16). 1:1 with Retune's tree.
- **JustifyMono for identifiers:** Retune's tree does NOT use a mono font for the
  name/tag/class labels - it uses the sans base. To stay 1:1 with RETUNE, keep
  `JustifySans`. **Do not** force JustifyMono on tree labels just because the
  team-rule mentions mono for "value/data fields" - the tree label is a layer name,
  not a value field, and Retune renders it in sans. (Flag for the lead: if Justify
  house-style wants class/id tokens in mono, that is a DEVIATION from 1:1 and should
  be an explicit, separate decision. Default: match Retune = sans.)

### 7.4 Visual geometry checklist (vs Retune)
Row height 32px; caret 16px; icon 16px @ 0.5 opacity (1 on hover/select); name 11px;
indent 12 + depth*20; "moved" pill 9px. Drop indicator 2px blue line with 8px dot
(`::before`). Ghost: blue 1.5px border, 6px radius, 6/12 padding, 0.85 opacity,
shadow. Reparent target: 15% blue fill + 1.5px dashed blue outline, 4px radius.

---

## 8. Build decomposition (TaskCreate candidates) + validation

### 8.1 Tasks (dependencies noted; [P] = parallelizable without file conflict)

**T1 - Port ElementTree.tsx to Preact** (CREATE `core/manipulate/ui/ElementTree.tsx`).
- React->Preact: `import { useState, useCallback, useRef, useEffect } from 'preact/hooks'`;
  `import { memo } from 'preact/compat'`.
- **Gotcha 1 (events):** `onPointerDown` passes `e.nativeEvent` (line 417). In Preact
  the handler receives the native event directly; `e.nativeEvent` is undefined. Use
  `onDragStart((e as any).nativeEvent ?? e, element)`. Audit every `.nativeEvent`.
- **Gotcha 2:** `dangerouslySetInnerHTML` -> supported in Preact, keep.
- **Gotcha 3:** `className`/`style` object + inline `paddingLeft` number -> Preact OK.
- Re-point `isRetuneElement` -> Justify overlay markers (Section 3.3).
- Optional rename `data-retune-tree-key` -> `data-justify-tree-key` (keep reader +
  writer in sync; line 411 + 620).
- Import `getDirectReactComponent` from `../../selector/identifier.js`.
- Depends on: nothing (identifier already exists). FOUNDATION.

**T2 [P] - Port tree CSS** (CREATE `core/manipulate/styles/elements-tree.css`) from
overlay.css 665-817 verbatim. Independent file -> parallel with T1.

**T3 - Load CSS + thread props in PropertyPanel** (MODIFY `PropertyPanel.tsx`):
replace stub with `<ElementTree>` (Phase A props), extend `PropertyPanelProps`,
import ElementTree. Depends on T1 (component must exist).

**T4 - Wire ManipulateMode (Phase A)** (MODIFY `index.ts`): import + register
`elements-tree.css` in `installPanelChrome` sheet array; pass `onElementSelect` ->
`selectElement` and `onElementHover` -> `picker.highlightElement` in `renderPanel`.
Depends on T2 (css) + T3 (props).

**T5 [P] - Port the drag unit test** (`__tests__/tree-drag.test.ts`): fix import to
`../ui/ElementTree`; run vitest. Validates `computeDropIndex` + `getVisibleChildren` +
index math. Depends on T1. Parallel with T3/T4.

**T6 - Phase B: reorder/reparent -> change/task** (MODIFY `index.ts` + `PropertyPanel.tsx`):
add `visualOrderMap`/`reparentEntries` state, `handleTreeReorder`/`handleTreeReparent`,
extend `syncQueue` for `__reorder`/`__reparent` lines, pass the four extra props.
Depends on T1-T4 shipped + validated. SEPARATE validation cycle.

**T7 - Phase B revert gap** (MODIFY `index.ts` `revertSelector`/`revertAll`): teach
revert to undo a reorder/reparent (restore DOM order / move back). Depends on T6.

### 8.2 Parallelization summary
- Wave 1: **T1** + **T2** (different files, fully parallel).
- Wave 2: **T3** then **T4** (T4 needs T3); **T5** parallel to T3/T4.
- Wave 3 (after A validated): **T6** then **T7**.

### 8.3 Validation checklist (validate phase - real input only)
Run against the Retune playground for side-by-side: `cd retune/playground && npm run
dev` -> localhost:3002. Justify: load the core on a real React page + a non-React page.

**Phase A gate (visual + navigation 1:1):**
1. **Visual 1:1:** screenshot Elements tab in Justify vs Retune. Confirm row height,
   indent, caret, icon set, hover bg, selected bg, name typography, "component" blue.
2. **Icons:** every layer type renders the correct glyph (flex row/col, grid, block,
   text preview, image, component, live SVG preview, input). Compare to Retune on the
   same DOM.
3. **Expand/collapse:** click carets - rows reveal/hide; caret rotates. Click a deep
   element on the PAGE - tree auto-expands ancestors and scrolls the row into view.
4. **Two-way select:** (a) click a tree row -> page selection chrome appears on that
   element + Design tab reflects it. (b) click an element on the page -> tree
   highlights + scrolls to that row.
5. **Hover sync:** hover a tree row -> the page element highlights (picker box);
   leave -> clears.
6. **Overlay exclusion:** confirm NO Justify chrome (panel, highlight, labels)
   appears as a tree row.
7. **Theme:** dark mode - tree bg matches `#1a1a1a` panel; light mode tokens correct.
8. **Scroll:** a tall tree scrolls vertically within the panel body (see Risk R4).
9. **Non-React page:** labels fall back to class/id/tag; no errors; `component` icon
   never appears.

**Phase B gate (drag):**
10. **Reorder:** drag a row among siblings - ghost + drop indicator track the cursor;
    drop reorders the live page element AND creates one queued task ("Move ... to
    index N"). Midpoint behavior matches Retune.
11. **Reparent:** drag into another container (middle = into, top/bottom = before/
    after) - dashed target outline; drop moves the DOM node, shows "moved" pill, and
    queues a reparent task. Guard: cannot drop onto self/descendant/ancestor.
12. **Expand-on-hover:** hold a drag over a collapsed parent 500ms -> it expands.
13. **Auto-scroll:** drag near top/bottom edge -> tree scrolls.
14. **Revert (T7):** discard the reorder/reparent task -> element returns to original
    position.

---

## 9. Open questions / risks

- **R1 - Phase B pipeline cost (MEDIUM).** Retune's reorder/reparent ride a bespoke
  ChangeTracker with `__reorder`/`__reparent` pseudo-props, a FLIP translate engine,
  bulk-scope propagation, and undo stacks. Justify's pipeline is CSS-prop-centric.
  Phase B requires extending `changeBuffer`/`syncQueue` to carry non-CSS pseudo-props
  and teaching `revertSelector` to invert a move. Decision for lead: full parity
  (bulk propagation + undo) or the lean single-element version proposed here?
  **Recommendation: ship A now, lean B next, defer bulk/undo (C).**
- **R2 - Preact event `.nativeEvent` (LOW, but a guaranteed bug if missed).**
  ElementTree passes `e.nativeEvent` to `onDragStart` (line 417). Undefined in Preact.
  Fix in T1; covered above. Without the fix, drag silently never starts.
- **R3 - Overlay-marker exclusion (LOW-MEDIUM).** `isRetuneElement` must become
  `isJustifyOverlayElement` covering ALL `data-justify*` markers + the shadow host,
  or Justify's own chrome shows up as tree rows. Verify against live overlay DOM.
- **R4 - Vertical scroll ownership (LOW).** `.retune-tree` has `overflow-x:auto` but
  NOT `overflow-y` - in Retune the PANEL BODY is the vertical scroller, and the
  drag auto-scroll reads `scrollRef.current.scrollTop` (the `.retune-tree` element).
  Confirm our panel-body lets the tree scroll vertically (the Design tab already
  scrolls). If `.retune-tree` itself must be the scroller for auto-scroll-during-drag
  to work, add `overflow-y:auto` + a height constraint to `.retune-tree` in
  `elements-tree.css`. Verify by wheel-scrolling a tall tree AND by drag-to-edge.
- **R5 - `getDirectReactComponent` parity (RESOLVED).** Already ported and identical
  (identifier.ts line 650). Returns null off-React. No action.
- **R6 - React fiber detection on the host page (INFORMATIONAL).** The `component`
  label/icon only appears when the inspected page is a React app exposing
  `__reactFiber$*` keys (production React with stripped names may yield fewer
  component names). This is inherent to the technique and matches Retune exactly -
  not a defect. Note in validation: test on a dev-mode React page for full labels.
- **R7 - JustifyMono vs sans for tree labels (DECISION).** Section 7.3: Retune uses
  sans for tree labels. Team house-style mentions mono for value/data fields. Default
  to 1:1 (sans). If the lead wants mono for class/id tokens specifically, that is an
  explicit deviation to log - not a 1:1 requirement.
- **R8 - `data-retune-tree-key` rename (TRIVIAL).** Internal attribute; rename to
  `data-justify-tree-key` for brand hygiene OR keep as-is. Either is fine; just keep
  the writer (line 411) and the drag hit-test reader (line 620) in sync. The ported
  test references it only conceptually.

---

## 10. One-paragraph summary for the builder

Create `core/manipulate/ui/ElementTree.tsx` by porting Retune's 923-line
`ElementTree.tsx` React->Preact (hooks from `preact/hooks`, `memo` from
`preact/compat`, fix `e.nativeEvent`, re-point overlay-node exclusion to
`data-justify*`); it imports only `getDirectReactComponent` which already exists in
our `core/selector/identifier.ts`. Port the `.retune-tree*` CSS block (overlay.css
665-817) verbatim into `core/manipulate/styles/elements-tree.css` - every token it
needs is already in `panel-shell.css`. Register that CSS in `installPanelChrome`'s
sheet array and replace the `Elements tree (deferred)` stub in `PropertyPanel.tsx`
(lines 301-305) with `<ElementTree selectedElement onSelect onHover/>`, threading
`onElementSelect -> ManipulateMode.selectElement` and
`onElementHover -> picker.highlightElement` from `renderPanel`. That is Phase A: a
pixel-1:1 navigator with two-way selection, hover sync, expand/collapse, live SVG
icons, and theme parity - zero new icons, zero substitutions. Phase B wires
drag-reorder/reparent into the changeBuffer/syncQueue as `__reorder`/`__reparent`
tasks (separate validation), with bulk-scope + undo deferred to Phase C.
