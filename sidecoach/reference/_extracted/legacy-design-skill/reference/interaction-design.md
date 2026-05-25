# Impeccable interaction-design.md (extracted)

Note: long dashes replaced with regular hyphens per repo policy.

## VERBATIM LIFT

# Interaction Design

## The Eight Interactive States

Every interactive element needs these states designed:

| State | When | Visual Treatment |
|-------|------|------------------|
| **Default** | At rest | Base styling |
| **Hover** | Pointer over (not touch) | Subtle lift, color shift |
| **Focus** | Keyboard/programmatic focus | Visible ring (see below) |
| **Active** | Being pressed | Pressed in, darker |
| **Disabled** | Not interactive | Reduced opacity, no pointer |
| **Loading** | Processing | Spinner, skeleton |
| **Error** | Invalid state | Red border, icon, message |
| **Success** | Completed | Green check, confirmation |

**The common miss**: Designing hover without focus, or vice versa. They're different. Keyboard users never see hover states.

## Focus Rings: Do Them Right

**Never `outline: none` without replacement.** It's an accessibility violation. Instead, use `:focus-visible` to show focus only for keyboard users:

```css
/* Hide focus ring for mouse/touch */
button:focus {
  outline: none;
}

/* Show focus ring for keyboard */
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

**Focus ring design**:
- High contrast (3:1 minimum against adjacent colors)
- 2-3px thick
- Offset from element (not inside it)
- Consistent across all interactive elements

## Form Design: The Non-Obvious

**Placeholders aren't labels.** They disappear on input. Always use visible `<label>` elements. **Validate on blur**, not on every keystroke (exception: password strength). Place errors **below** fields with `aria-describedby` connecting them.

## Loading States

**Optimistic updates**: Show success immediately, rollback on failure. Use for low-stakes actions (likes, follows), not payments or destructive actions. **Skeleton screens > spinners**: they preview content shape and feel faster than generic spinners.

## Modals: The Inert Approach

Focus trapping in modals used to require complex JavaScript. Now use the `inert` attribute:

```html
<!-- When modal is open -->
<main inert>
  <!-- Content behind modal can't be focused or clicked -->
</main>
<dialog open>
  <h2>Modal Title</h2>
  <!-- Focus stays inside modal -->
</dialog>
```

Or use the native `<dialog>` element:

```javascript
const dialog = document.querySelector('dialog');
dialog.showModal();  // Opens with focus trap, closes on Escape
```

## The Popover API

For tooltips, dropdowns, and non-modal overlays, use native popovers:

```html
<button popovertarget="menu">Open menu</button>
<div id="menu" popover>
  <button>Option 1</button>
  <button>Option 2</button>
</div>
```

**Benefits**: Light-dismiss (click outside closes), proper stacking, no z-index wars, accessible by default.

## Dropdown & Overlay Positioning

Dropdowns rendered with `position: absolute` inside a container that has `overflow: hidden` or `overflow: auto` will be clipped. This is the single most common dropdown bug in generated code.

### CSS Anchor Positioning

The modern solution uses the CSS Anchor Positioning API to tether an overlay to its trigger without JavaScript:

```css
.trigger {
  anchor-name: --menu-trigger;
}

.dropdown {
  position: fixed;
  position-anchor: --menu-trigger;
  position-area: block-end span-inline-end;
  margin-top: 4px;
}

/* Flip above if no room below */
@position-try --flip-above {
  position-area: block-start span-inline-end;
  margin-bottom: 4px;
}
```

Because the dropdown uses `position: fixed`, it escapes any `overflow` clipping on ancestor elements. The `@position-try` block handles viewport edges automatically. **Browser support**: Chrome 125+, Edge 125+. Not yet in Firefox or Safari - use a fallback for those browsers.

### Popover + Anchor Combo

Combining the Popover API with anchor positioning gives you stacking, light-dismiss, accessibility, and correct positioning in one pattern:

```html
<button popovertarget="menu" class="trigger">Open</button>
<div id="menu" popover class="dropdown">
  <button>Option 1</button>
  <button>Option 2</button>
</div>
```

The `popover` attribute places the element in the **top layer**, which sits above all other content regardless of z-index or overflow. No portal needed.

### Portal / Teleport Pattern

In component frameworks, render the dropdown at the document root and position it with JavaScript:

- **React**: `createPortal(dropdown, document.body)`
- **Vue**: `<Teleport to="body">`
- **Svelte**: Use a portal library or mount to `document.body`

Calculate position from the trigger's `getBoundingClientRect()`, then apply `position: fixed` with `top` and `left` values. Recalculate on scroll and resize.

### Fixed Positioning Fallback

For browsers without anchor positioning support, `position: fixed` with manual coordinates avoids overflow clipping:

```css
.dropdown {
  position: fixed;
  /* top/left set via JS from trigger's getBoundingClientRect() */
}
```

Check viewport boundaries before rendering. If the dropdown would overflow the bottom edge, flip it above the trigger. If it would overflow the right edge, align it to the trigger's right side instead.

### Anti-Patterns

- **`position: absolute` inside `overflow: hidden`** - The dropdown will be clipped. Use `position: fixed` or the top layer instead.
- **Arbitrary z-index values** like `z-index: 9999` - Use a semantic z-index scale: `dropdown (100) -> sticky (200) -> modal-backdrop (300) -> modal (400) -> toast (500) -> tooltip (600)`.
- **Rendering dropdown markup inline** without an escape hatch from the parent's stacking context. Either use `popover` (top layer), a portal, or `position: fixed`.

## Destructive Actions: Undo > Confirm

**Undo is better than confirmation dialogs.** Users click through confirmations mindlessly. Remove from UI immediately, show undo toast, actually delete after toast expires. Use confirmation only for truly irreversible actions (account deletion), high-cost actions, or batch operations.

## Keyboard Navigation Patterns

### Roving Tabindex

For component groups (tabs, menu items, radio groups), one item is tabbable; arrow keys move within:

```html
<div role="tablist">
  <button role="tab" tabindex="0">Tab 1</button>
  <button role="tab" tabindex="-1">Tab 2</button>
  <button role="tab" tabindex="-1">Tab 3</button>
</div>
```

Arrow keys move `tabindex="0"` between items. Tab moves to the next component entirely.

### Skip Links

Provide skip links (`<a href="#main-content">Skip to main content</a>`) for keyboard users to jump past navigation. Hide off-screen, show on focus.

## Gesture Discoverability

Swipe-to-delete and similar gestures are invisible. Hint at their existence:

- **Partially reveal**: Show delete button peeking from edge
- **Onboarding**: Coach marks on first use
- **Alternative**: Always provide a visible fallback (menu with "Delete")

Don't rely on gestures as the only way to perform actions.

---

**Avoid**: Removing focus indicators without alternatives. Using placeholder text as labels. Touch targets <44x44px. Generic error messages. Custom controls without ARIA/keyboard support.

## EXTENSION

### 8 states + 1 selected = 9 (the canonical state vocabulary)

| State | Trigger | Cue prescription |
|---|---|---|
| Default | At rest | Base style |
| Hover | Pointer-only enter | Subtle scale (1.02) or color/shadow shift; 100-150ms |
| Focus-visible | Keyboard focus | 2-3px outline, 2px offset, accent color, 3:1+ contrast |
| Active | Pressed | scale(0.96) + slight darken; 75-100ms transition |
| Disabled | Cannot use | opacity 0.4-0.5, cursor not-allowed, aria-disabled |
| Loading | Async action in flight | Inline spinner OR skeleton; preserve layout |
| Error | Invalid input or operation | Red border, inline message via aria-describedby |
| Success | Completed | Green border or check icon; transient toast |
| Selected | Currently active in a set | Filled background OR check OR indicator bar |

Implement all 9 for every button, input, link, and selectable item. Omitting one creates "what's going on?" moments.

### Focus-ring prescribed values

```css
:root {
  --focus-ring-color: var(--color-accent);
  --focus-ring-width: 2px;
  --focus-ring-offset: 2px;
}

*:focus { outline: none; }

*:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}

/* For dark surfaces, increase ring contrast */
[data-theme="dark"] *:focus-visible {
  outline-color: var(--color-accent-bright);
}
```

### Modal pattern (native dialog + inert)

```html
<main id="app">
  <button id="open">Open dialog</button>
</main>
<dialog id="modal">
  <h2>Title</h2>
  <p>Body</p>
  <button>Confirm</button>
  <button data-close>Cancel</button>
</dialog>

<script>
  const main = document.getElementById('app');
  const modal = document.getElementById('modal');
  document.getElementById('open').onclick = () => {
    main.inert = true;
    modal.showModal();
  };
  modal.addEventListener('close', () => { main.inert = false; });
  modal.querySelector('[data-close]').onclick = () => modal.close();
</script>
```

Escape key closes for free; focus trap is automatic; backdrop click is opt-in via `dialog::backdrop` listener.

### Anchor-positioning popover pattern (modern stack)

```html
<button popovertarget="menu" class="trigger">Open</button>
<div id="menu" popover>...</div>

<style>
  .trigger { anchor-name: --t1; }
  [popover] {
    position-anchor: --t1;
    position-area: block-end span-inline-end;
    margin-top: 4px;
  }
  @position-try --flip-above {
    position-area: block-start span-inline-end;
    margin-bottom: 4px;
  }
</style>
```

Stacks above everything, light-dismisses, escapes overflow.

## WHAT'S MISSING

- **No drag-and-drop catalog.** Mentioned for delight but no prescribed pattern (sortable lists, kanban, file drop zones).
- **No multi-touch gesture prescription.** Pinch, rotate, two-finger pan - not addressed.
- **No virtualization recipes for long lists.** Mentioned in optimize.md; not surfaced here.
- **No clipboard / paste interaction guidance.** Common UX but absent.
- **No "context menu" prescriptions.** Mentioned in adapt for desktop; no implementation pattern.
