# Accessibility Remediation

Sidecoach canonical reference. Loaded whenever an accessibility flow moves from findings to fixes. The accessibility flow produces audit findings, a keyboard-navigation report, and a testing plan. It does not, on its own, apply changes. This file is the protocol for applying them: how to turn a line-anchored violation into the smallest diff that resolves it, and how to prove the resolution.

The governing instinct is restraint. An accessibility fix repairs one specific barrier and touches nothing else. Most regressions introduced during remediation come from doing more than the finding asked for.

---

## Remediation Mode

Remediation mode takes two inputs and produces one output.

- **Input:** a file, or a small set of files, plus a list of violations. Every violation is anchored to a `file:line` and names the barrier it represents.
- **Output:** the minimal diff that resolves each violation, one violation at a time.

The loop:

1. **Order by size, smallest change first.** A missing `aria-hidden` on a decorative icon is a one-attribute edit; a keyboard trap in a custom widget is a structural fix. Clear the one-line edits first so the diff stays legible and the hard changes stand alone for review.
2. **Fix one violation, then stop.** Do not fold two findings into one edit even when they sit on adjacent lines. One violation, one change, one reason. A reviewer must be able to read the diff and map every hunk back to a finding.
3. **Annotate every fix.** Each change records three things: the violation it resolves, the `file:line` it lands on, and a one-line reason. Example: `resolves missing-accessible-name at nav/menu.tsx:42 - icon-only button had no label for screen readers`.
4. **Batch, then verify.** Group related fixes into a batch (for example, all decorative-icon fixes in one component), and after each batch state what to re-run to confirm the barrier is gone.

Every fix must be verifiable by something other than reading the code. Name the check that proves it:

- **Re-run the accessibility audit** - the finding that flagged the violation must no longer appear.
- **Keyboard-only navigation pass** - unplug the pointer. Tab, Shift+Tab, Enter, Space, Escape, and arrow keys must reach and operate every interactive element, in a visible and logical order, with no trap.
- **Screen reader pass** - the element announces its role, name, and state, and state changes are announced when they happen.

If a fix cannot be tied to one of these checks, it is not done. "Looks correct" is not verification for accessibility any more than it is for layout.

---

## Tool Boundaries

This is the discipline the rest of the file rests on. Remediation goes wrong by reaching for a bigger tool than the finding requires.

### Native semantics before ARIA

If an HTML element already expresses the role, use the element. A `<button>` is a button; a `<nav>` is a navigation landmark; `<main>` is the main landmark; a `<th>` is a header cell. Adding `role="button"` to a real button, or `role="navigation"` to a `<nav>`, is noise - it restates what the browser already knows and gives future readers a reason to wonder what is special here.

ARIA is the fallback for when no native element fits, not the first move. And wrong ARIA is worse than no ARIA: a mislabeled role, a stale `aria-expanded`, or an `aria-hidden` on a focusable control actively misleads assistive technology, where a plain element would at least have degraded to something honest. The order is always: reach for the correct element first, correct the markup to earn the native role second, and add ARIA only when neither is possible.

### Minimal diff

An accessibility fix changes accessibility. It does not change architecture. While resolving a finding you do not refactor the surrounding component, restyle it, rename its variables, reorder its props, or "tidy" adjacent code. Those may be worth doing, but they are separate work with separate review - folding them into a remediation diff hides the accessibility change inside unrelated churn and makes the fix impossible to review in isolation. If the true fix genuinely requires a structural change, say so as its own finding rather than smuggling it in.

### Never migrate a library to fix accessibility

When a component library has an accessibility defect - a menu that traps focus, a dialog that will not restore focus, a control with no accessible name - the remediation is to patch the usage locally and record the defect. Wrap it, pass the missing attribute, add the handler the library omitted, and note that the underlying component is deficient.

Swapping the library out is a product decision with cost, risk, and blast radius far beyond one finding. It is not a remediation and must never be performed as one. Record the defect so the product owner can weigh a replacement deliberately; do not force that decision through an accessibility pass.

---

## Micro-Rules

Each rule is small, has one reason, and where useful shows the before and after.

### Decorative icons get `aria-hidden="true"`

An icon that only decorates adjacent text is visual seasoning; a screen reader announcing it adds noise, not meaning.

```html
<!-- before: icon is announced, doubling the label -->
<button><svg class="icon-save">...</svg> Save</button>

<!-- after: icon is skipped, "Save" is announced once -->
<button><svg class="icon-save" aria-hidden="true">...</svg> Save</button>
```

If an icon is the only content (an icon-only button), it is not decorative - it needs an accessible name (`aria-label` or visually hidden text), not `aria-hidden`.

### `tabindex` is `0` or `-1`, never positive

`tabindex="0"` puts an element in the natural tab order; `tabindex="-1"` makes it focusable by script only. A positive value hijacks the tab order for the whole page, jumping the user to that element ahead of everything before it in the DOM and leaving the rest of the sequence unpredictable.

```html
<!-- before: yanks focus out of document order -->
<div tabindex="3">...</div>

<!-- after: focusable in natural order -->
<div tabindex="0">...</div>
```

If the tab order is wrong, fix the DOM order, not the `tabindex`.

### Dialogs restore focus to their trigger, and set initial focus on open

When a dialog opens, focus moves into it and lands somewhere meaningful - the first field, the primary action, or the dialog's own heading - never left behind on the page underneath. When it closes, focus returns to the element that opened it, so a keyboard or screen reader user resumes exactly where they were instead of being dropped at the top of the document.

```js
// on open: remember the trigger, move focus in
lastFocused = document.activeElement;
dialog.querySelector('[autofocus], input, button')?.focus();

// on close: send focus home
lastFocused?.focus();
```

### Data tables use real `<th>` header cells with `scope`

A header cell tells assistive technology which column or row a data cell belongs to. A `<td>` styled to look like a header carries none of that association, so the screen reader reads a wall of unlabeled values.

```html
<!-- before: looks like a header, means nothing -->
<tr><td class="head">Name</td><td class="head">Status</td></tr>

<!-- after: real headers, scoped -->
<tr><th scope="col">Name</th><th scope="col">Status</th></tr>
```

Use `scope="col"` for column headers and `scope="row"` for row headers.

### Every hover-only interaction has a keyboard-reachable equivalent

Content or actions that appear only on mouse hover are invisible to keyboard and touch users. Whatever a hover reveals, a focus must reveal too, and whatever a hover triggers must also be reachable by tab-and-activate.

```css
/* before: tooltip only on hover */
.has-tip:hover .tip { opacity: 1; }

/* after: hover and keyboard focus both reveal it */
.has-tip:hover .tip,
.has-tip:focus-within .tip { opacity: 1; }
```

If the interaction is more than reveal-on-hover (a menu, a drag handle, a custom control), give it a real focusable trigger and a key handler, not just a `:focus-within` style.

---

## Audit Failure Patterns

Three patterns the audit checklist should catch every pass. Each has a signature to look for and a reason it fails a real user.

### Duplicate IDs in one document

**What it looks like:** the same `id` value on two or more elements in a single page - often from a component rendered in a loop that hard-codes an `id`, or a copy-pasted block.

**Why it fails:** an `id` must be unique in the document. When it is not, `<label for>` binds to whichever element the browser resolves first, `aria-labelledby` and `aria-describedby` point at an ambiguous target, and in-page anchors jump to the wrong place. The association silently attaches to the wrong element, so a control looks labeled in the markup but announces the wrong thing - or nothing - to a screen reader.

### Mouse-only event handlers

**What it looks like:** an `onclick` on a `<div>` or `<span>` with no `role`, no `tabindex`, and no key handler. It clicks fine with a mouse and is completely inert to a keyboard.

**Why it fails:** a keyboard user cannot focus a plain `<div>`, so they can never reach the action, and a screen reader announces it as ordinary text with no hint that it does anything. The fix is almost always to use a real `<button>`; if the element must stay a `<div>`, it needs `role="button"`, `tabindex="0"`, and a handler for Enter and Space - which is exactly the work a native `<button>` does for free.

### Drag interactions with no keyboard alternative

**What it looks like:** reorder, resize, or dismiss that only responds to a pointer drag - drag-to-reorder lists, drag-to-resize panels, swipe-to-dismiss items - with no button, key, or menu path to the same outcome.

**Why it fails:** dragging requires precise sustained pointer control that keyboard users, switch users, and many motor-impaired users do not have, so the entire capability is unreachable for them. Every drag operation needs a non-pointer path: move-up and move-down controls for reorder, an input or key steps for resize, an explicit dismiss button for swipe-away. The drag can stay as an enhancement; it cannot be the only way in.

---

## When Remediation Cannot Reach

Some findings cannot be fixed inside a remediation pass without crossing a boundary this file draws. When that happens, stop and report rather than exceed the mandate:

- The correct fix requires a structural or architectural change (record it as a distinct finding, do not fold it into the diff).
- The barrier lives inside a third-party component that cannot be patched locally (record the library defect; do not migrate).
- Resolving the violation would change behavior a real user depends on (surface the trade-off; do not decide it silently).

Reporting a barrier you did not fix, with the reason it is out of scope, is a valid remediation outcome. Silently exceeding the boundary to force a fix is not.
