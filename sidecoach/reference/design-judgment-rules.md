# Design Judgment Rules

Sidecoach canonical reference. Loaded into every critique / audit / polish flow. These are the taste calls a trained eye makes instantly and a mechanical checklist misses: they govern whether a screen reads as one deliberate thing or as assembled parts.

Every rule below is written to be checked, not just felt. Each carries a positive detection (what a violation looks like) and a whitelist (the exceptions that are not violations), so a validator can act on the rule without re-deriving the judgment. When these rules become validators, the Violation line is the signal to flag and the Exceptions line is the carve-out that suppresses the flag.

---

## How to read each rule

Every entry has the same four parts:

- **Rule** - the standard, stated as a single checkable claim.
- **Why** - the reasoning, so the rule survives contact with a case it did not anticipate.
- **Violation** - the concrete shape of a failure, so it can be detected on sight.
- **Exceptions** - the cases that look like violations but are not, named explicitly so they can be whitelisted.

A rule with no named exceptions is not finished. If a validator cannot tell a real defect from a legitimate carve-out, it will over-fire and lose trust. The exceptions are load-bearing.

---

## Rule index

| # | Rule | One-line check | Not a violation |
|---|---|---|---|
| 1 | One accent color per view | At most one saturated emphasis hue per viewport | Semantic state colors; data-viz palettes |
| 2 | No mixed primitive systems | One button / input / spacing / radius system per surface | Quarantined third-party embeds; sandboxed style-guide pages |
| 3a | One focal point at a time | One directed motion or highlight per moment | Coordinated group entrance (a stagger is one gesture) |
| 3b | Dim behind modals | Modal sits on a scrim that recedes the page | Non-modal overlays (popovers, dropdowns, toasts) |
| 3c | Respect layer hierarchy | Z-order runs tooltip > popover > modal > sticky chrome > content | Nested self-consistent stacking contexts |
| 4 | Context menus animate on exit only | Rapid-repeat menus open instantly | A sub-100ms opacity fade-in with no hit-test delay |
| 5 | Springs are for overshoot | Springs only where motion carries momentum | Interruptible gesture-driven motion |

---

## 1. One accent color per view

**Rule.** A single view - what fills the viewport at one time - earns exactly one accent: one saturated hue that carries emphasis and points the eye at the primary action or the single thing that matters most here. Everything else is neutral, or a tint of the neutral, or a desaturated shade of the accent itself.

**Why.** An accent works only by contrast against neutrals. When two or more saturated colors compete inside one viewport, neither wins and the eye is given no destination - the hierarchy flattens. When everything is highlighted, nothing is.

**Violation.** Two competing saturated accents fighting for attention in one viewport: a saturated blue primary button and an equally saturated orange badge, both at full chroma, both pulling focus, with no single "look here." The same failure appears when one accent is applied so broadly - accent headings plus accent buttons plus accent links plus accent icons all at once - that it stops functioning as emphasis and becomes the new baseline.

**Exceptions.**
- **Semantic state colors are not accents.** Success green, warning amber, and danger red encode meaning, surface only on state, and are read as a system rather than as competing brand emphasis. A danger-red delete button next to a blue accent is not two accents.
- **Data-visualization palettes are not accents.** Chart series colors and categorical, sequential, or diverging scales are content. A chart legitimately needs many distinguishable hues; the palette is data, not chrome.
- **One accent used consistently in several places is still one accent.** A link color and the primary button sharing the same hue is the accent doing its job, not two accents competing. The count is of distinct competing emphasis hues, not of painted elements.

---

## 2. No mixed primitive systems

**Rule.** One surface draws its primitives from one system. One button family (shared shape, height, radius, and state treatment), one input family, one spacing scale, one radius scale. A surface commits to a single set of atoms and builds everything from them.

**Why.** Consistent primitives are what make a surface read as one designed thing rather than an assembled collage. Two button systems, or spacing values that belong to no scale, signal that pieces arrived from different places. The eye registers the seam as sloppiness even when it cannot name the cause.

**Violation.**
- Two visually different button systems in one flow: pill buttons with a soft shadow next to sharp-cornered flat buttons of the same rank, both used as primary actions.
- Arbitrary spacing alongside a scale: a 4 / 8 / 12 / 16 rhythm in use, then a stray 13px or 17px gap that snaps to no step.
- Mixed radius scales with no semantic reason: some cards at 6px, others at 14px, in the same context.

**Exceptions.**
- **Deliberately quarantined embeds.** A third-party widget that ships its own styling - an embedded payment field, a map, a social embed - is exempt when it is visually fenced off (bordered, boxed, or otherwise signaled as "not ours"). The quarantine must be intentional and visible, not accidental style leakage bleeding into the surrounding surface.
- **Explicitly sandboxed style-guide pages.** A component gallery or design-system page that shows multiple systems side by side on purpose is exempt, provided it is isolated from the app's own styles so nothing inherits across the boundary. Displaying variants is the page's job; that is not the same surface mixing systems by accident.

---

## 3. Staging

Three related rules that govern how a moment of UI is composed in space and time. Staging is the difference between a screen that directs the eye and one that scatters it.

### 3a. One focal point at a time

**Rule.** At any single moment, the UI directs attention to one place. One element moves, pulses, or highlights; the rest holds still.

**Why.** Attention is singular. Two simultaneous competing animations or highlights split it, and the eye ping-pongs instead of landing. A single focal point is what makes a moment legible.

**Violation.** Simultaneous competing animations or highlights that split attention: a toast sliding in from the right while a modal scales in center-screen while a nav item pulses - three independent motions on three unrelated timelines, each demanding the eye, none yielding to another.

**Exception.** A coordinated group entrance counts as one gesture. A stagger - a set of cards entering in sequence on one shared timeline, from one origin - is a single directed motion, not competing focal points, because the eye reads the sequence as one flowing thing. The test is a shared timeline and origin, not the number of elements moving.

### 3b. Dim behind modals

**Rule.** A modal surface sits on a scrim that visibly recedes the page behind it - dimmed (a darkened, lowered-opacity overlay), blurred, or both. The page must read as pushed back and temporarily inert.

**Why.** A modal claims exclusive focus. The scrim is what tells the eye that the page is paused and the modal is the only live surface. Without it, the modal reads as debris floating on a still-active page: foreground and background sit at the same depth and the layering looks broken.

**Violation.** A modal floating on an undimmed page - full-opacity, full-contrast content directly behind a dialog with no scrim - so the dialog and the page occupy the same visual plane and nothing signals which surface is live.

**Exception.** Non-modal overlays take no scrim, because they do not claim exclusive focus and leave the page interactive by design: popovers, dropdowns, menus, toasts, and non-blocking side panels. The scrim requirement is specific to modal, focus-trapping, page-blocking surfaces; applying it to a popover would be a false positive.

### 3c. Respect layer hierarchy

**Rule.** Z-order expresses importance and follows a fixed stack. The most transient, most contextual, most recently user-summoned surface sits highest. Canonical order, top to bottom: tooltips, then popovers and menus, then modals and their scrim, then sticky chrome (sticky headers, toolbars, action bars), then base content.

**Why.** Z-order is a language the user reads without thinking. They rely on the thing they just summoned - the tooltip, the open menu - being on top, because it is the thing they are acting on right now. When an element jumps the hierarchy, the interface contradicts its own depth cues and feels broken.

**Violation.** An element occluded by something that should sit below it: a tooltip rendering under a sticky header, a dropdown clipped behind the content it belongs to, a sticky toolbar painting over an open modal. The symptom is always a higher-priority surface hidden by a lower-priority one - an inversion of the stack.

**Exception.** Nested, self-consistent stacking contexts are fine. A component may establish its own local stacking context - a modal that contains its own tooltips and popovers - as long as the same relative order holds inside it (tooltips still above popovers above the modal's content). The rule forbids inverting the order, not creating independent contexts. A full-screen takeover (a media lightbox, a first-run overlay) that deliberately sits above everything is legitimate when its internal order is preserved.

---

## 4. Context menus animate on exit only

**Rule.** Menus built for rapid, repeated use - context menus and right-click menus - open instantly, with no entrance animation, and may animate only their dismissal. This rule scopes to that class of menu; an occasional dropdown or select is not a rapid-repeat menu and may take a standard entrance.

**Why.** Opening is the hot path. The user right-clicked because they are mid-task and want the target immediately; any entrance animation, however short, taxes the exact moment they are waiting on and makes the interface feel slower than their hands. Dismissal is the cold path - the choice is already made - so a brief exit animation costs the user nothing and softens the disappearance.

**Violation.** A context or right-click menu that plays a scale, slide, or fade-in on open - anything that delays the items becoming clickable after the trigger. The worst form is an open animation long enough that a fast user clicks where an item will land before it arrives, and hits nothing.

**Exceptions.** None for the open delay: opening is always instant for this class of menu, and any transform or slide on open is a violation regardless of duration. The single tolerance is a sub-100ms opacity fade-in, acceptable only when it does not delay hit-testing - the items must be interactive from the first frame while opacity resolves. Movement or scale on open is never covered by this tolerance.

---

## 5. Springs are for overshoot

**Rule.** Reach for spring physics when the motion should visibly carry momentum or settle past its target and back: a drag release, a flung card, a playful emphasis, anything that should feel like it has mass. For a plain state change - a fade, a straight move from A to B, an expand or collapse - a tuned easing curve is cleaner, cheaper, and more predictable than a spring.

**Why.** A spring earns its keep through overshoot and settle - the sense of physical mass. Spent on a routine transition, that same bounce reads as wobble: the element arrives, jiggles, and wastes time the user never asked for. Springs also cost more to compute and are harder to time precisely than a fixed-duration curve.

**Violation.** Springs with bounce on routine fades or moves: a menu that bounces open, a panel that overshoots and settles on a simple slide-in, a fade that wobbles at the end. Bounce applied where nothing is being thrown, dragged, or released.

**Exception.** Interruptible, gesture-driven motion. When motion is driven by a live gesture and must retarget from wherever the user left it - a sheet being dragged, a card being flung, a value being scrubbed - a spring is the correct tool regardless of bounce, because it retargets smoothly from the current position and velocity where a fixed curve would restart or snap. In that case springs are right even without any visible overshoot.

---

## Applying these in a flow

Critique and audit read a target against every rule above and report each hit as the Violation it matches. Polish is where the fixes land. When a finding sits on an Exceptions line, it is not a defect - suppress it and move on. The rules describe the default; a named exception is the sanctioned way to leave the default deliberately, and "deliberately" is the operative word. An exception that is accidental leakage rather than an intentional carve-out is still a violation.
