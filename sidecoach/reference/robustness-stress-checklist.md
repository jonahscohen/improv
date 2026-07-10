# Robustness Stress Checklist

Sidecoach canonical reference. Loaded by the `harden` verb (`/sidecoach harden <target>`). No product UI ships from a harden pass without surviving every stress axis in this file, or naming the ones it deliberately punts and why.

---

## The Premise

Polish makes a UI feel right when everything goes right. Hardening makes it survive when everything goes wrong - the impatient double-tap, the mid-animation reroute, the 3G stall, the dropped connection, the dragged window edge, the record with a 90-character name. A build that looks finished in the happy path is half a build. The other half is what this file measures.

Hardening is a distinct pass, not a mood inside polish. Polish asks "is this beautiful and correct." Harden asks "does this hold under abuse." The two use different inputs: polish reads the design against the token system; harden reads the design against a hostile user and a hostile network. Run harden after polish, before shipping.

Each axis below is run the same way: reproduce the stress with real input (not a synthetic event, not a mutated state variable - the Verification Protocol's real-input rule applies in full), watch what the interface does, and screenshot the result. A stress you did not actually reproduce did not pass. A screenshot you did not Read does not exist.

The three questions per axis are fixed: **how to run it**, **what failure looks like**, **what a pass requires**. Failure is a defect to fix, not a note to ship with. A pass is observed behavior, not an assumption.

---

## Axis 1 - Spam interaction

Rapid, repeated, overlapping input on the same control. The user who taps twice because the first tap felt slow, the user who mashes a toggle, the user who double-submits a form because nothing told them the first submit landed.

**How to run it**

- Click or tap the primary action as fast as you can, ten times, with real input.
- Double-submit every form: fill it, then trigger submit twice in quick succession before the first response returns.
- Mash every toggle, checkbox, and segmented control back and forth faster than its transition can settle.
- Fire every control that kicks off an async request (save, send, load more, add to cart) repeatedly before the first request resolves.

**What failure looks like**

- Duplicate submissions - two records created, two emails sent, two charges. The most expensive failure on this axis.
- Stuck states - a button frozen in its loading spinner after the request resolved, a toggle that ends visually on but logically off.
- Compounding animations - each tap stacks another transition, so the element jitters, overshoots, or queues a backlog of motion that plays out after the user has stopped.
- Race-condition UI - the response to click 1 arrives after the response to click 3 and overwrites it, so the screen shows stale data.

**What a pass requires**

- The action is idempotent under repeat, or it disables itself on first activation and re-enables only on resolution. Submit buttons go disabled the instant they are pressed and stay disabled until the request settles.
- Toggles retarget from their current state rather than queueing (this is the same interruptibility standard the polish layer enforces on motion - see Axis 2), so mashing lands on a single coherent final state that matches the last real input.
- No async handler can fire twice for one logical intent. In-flight requests are guarded, deduplicated, or cancel their predecessor.
- Screenshot the control mid-spam and after it settles. Confirm one final state, one result, no visual backlog.

---

## Axis 2 - Interrupt animations

The user changes intent mid-motion. They open a drawer and immediately navigate away, toggle a panel and toggle it back before it finished opening, click into a route while its exit animation is still playing.

**How to run it**

- Trigger any entrance animation, then trigger the reverse (or a navigation) before it completes.
- Open and close the same disclosure - accordion, drawer, dropdown, modal - as fast as the animation lets you, repeatedly.
- Start a page or route transition, then immediately start another to a different destination.
- Toggle a control whose icon animates (hamburger to X, chevron rotate, play to pause) faster than the icon morph resolves.

**What failure looks like**

- Orphaned mid-flight state - a drawer stuck half-open, a modal frozen at 60 percent opacity, an accordion caught between heights.
- Restart-from-zero stutter - the animation ignores the interrupt, snaps back to its start frame, and replays from the beginning, so reversing feels like a hard cut instead of a redirect.
- Ghost elements - the exiting view never unmounts because its exit animation was cut off, so it lingers behind the new view.
- Desynced icon and state - the panel is closed but the icon is stuck mid-morph showing the open glyph.

**What a pass requires**

- Every interruptible animation retargets from its current position to the new goal rather than restarting. This is the polish layer's interruptibility standard applied under stress: transitions and springs on interactive state, not keyframes that restart from frame zero. Anything triggered in bursts or by gesture must carry its current value through the interrupt.
- State always lands correctly. After any sequence of interrupts, the final rendered state matches the final logical state - closed panel shows closed icon, active route shows only the active view.
- Nothing orphans. Exiting elements complete their unmount even when their exit is cut short; entering elements that get reversed clean up fully.
- Screenshot the interface immediately after a hard interrupt and again once it settles. Confirm no half-states survive.

---

## Axis 3 - Slow network

The connection is real but slow. Requests take seconds, not milliseconds. This is the median mobile experience, not an edge case.

**How to run it**

- Throttle the connection to a 3G profile in the browser's network panel and reload the target.
- Exercise every data-dependent surface under the throttle: initial load, lazy-loaded sections, images, submit-then-wait forms, load-more pagination, search-as-you-type.
- While a request is pending under throttle, re-click the control that started it, the way an impatient user would.

**What failure looks like**

- No loading state - the surface sits blank or shows stale content for seconds with no signal that work is happening, so the user cannot tell the difference between "loading" and "broken."
- Layout shift on arrival - content lands and shoves the page around because nothing reserved its space. The user taps where a button was and hits what replaced it.
- Double-fire from impatience - the pending request has no visible progress, the user re-clicks, and a second request goes out (this overlaps Axis 1, and both must hold).
- Spinner that never resolves - a loading indicator with no timeout and no error path, spinning forever if the request quietly failed.

**What a pass requires**

- Every async surface shows a loading state within one frame of the request starting - a skeleton, a spinner, a progress indication, or a disabled control with a pending label. The user always knows work is in flight.
- Space is reserved before content arrives. Skeletons and placeholders occupy the final dimensions so nothing shifts when data lands. Cumulative layout shift stays near zero.
- Controls that started a request are inert until it resolves, so impatient re-clicks cannot double-fire (shared requirement with Axis 1).
- A slow request has a ceiling: it either resolves, times out into an error state (see Axis 4), or offers a retry. Nothing spins indefinitely.
- Screenshot the loading state, then the settled state. Confirm the loading state is real and the transition between them does not shift layout.

---

## Axis 4 - Offline

The network is gone entirely. Mid-session the connection drops, a request fires into the void, and then the connection returns.

**How to run it**

- Load the target, then cut the network (offline mode in the network panel, or disable the connection).
- Trigger every action that needs the network while offline: submit a form, save a change, load a new section, refresh data.
- Restore the connection and observe recovery without a manual full reload.

**What failure looks like**

- Silent data loss - the user submits a form offline, it fails without a word, and the content they typed is gone. Unrecoverable and unforgivable.
- Cryptic or absent errors - a raw fetch rejection surfaces as a blank screen, a console error the user never sees, or a generic "something went wrong" with no path forward.
- No recovery - the connection comes back but the UI stays broken until a full manual reload, having latched into a permanent error state.
- Optimistic update with no rollback - the UI shows the action succeeded, the request failed offline, and the two never reconcile, so the screen lies about what was saved.

**What a pass requires**

- Failures are graceful and legible. An offline action surfaces a clear, human error that names what happened and what to do - "You are offline. Your changes are saved and will send when you reconnect," or at minimum "Could not save - check your connection and retry."
- No data is lost. Unsent input is preserved - retained in the form, queued for retry, or held in local state - so the user never re-types what they already entered.
- Recovery happens on reconnect. When the connection returns, the interface either retries automatically or offers an obvious retry, and reconciles optimistic state against the real result.
- Screenshot the offline error state and the recovered state. Confirm the error is readable and the recovery restores correct data.

---

## Axis 5 - Rapid resize

The viewport changes continuously and unpredictably. The user drags a window edge, rotates a phone, splits the screen, or zooms the browser.

**How to run it**

- Grab the window edge and drag it continuously across the full width range, slowly and then fast, watching every breakpoint boundary as it crosses.
- Rotate a phone or emulator between portrait and landscape repeatedly.
- Resize while scrolled partway down a long page, and while a drawer, modal, or dropdown is open.
- Zoom the browser to 200 percent and back while resizing.

**What failure looks like**

- Layout thrash - elements jump, flicker, or reflow violently at breakpoint boundaries because layout is recalculated on every resize event with no settling.
- Stuck breakpoint state - a menu opened at desktop width stays open and broken after shrinking to mobile, or a mobile drawer persists after growing to desktop.
- Scroll position lost or nonsensical - resizing throws the user to the top, or to a random offset, or leaves a fixed element floating over the wrong content.
- Overlap and clipping at in-between widths - the design was verified at named breakpoints but breaks in the continuous space between them, where real dragging spends most of its time.

**What a pass requires**

- Layout stays stable across the continuous range, not just at the named test widths. Dragging through the in-between widths produces no thrash, no flicker, no overlap.
- Breakpoint-dependent state resets correctly when the breakpoint changes. A desktop menu collapses cleanly into the mobile pattern and back; an open mobile drawer resolves sanely when the viewport grows past its breakpoint.
- Scroll position stays sane - the user's place in the content is preserved, or adjusted predictably, never thrown to a random offset.
- Orientation change is handled - portrait-to-landscape reflows without clipping, and safe-area assumptions that differ by orientation still hold.
- Screenshot mid-drag at an in-between width, at each breakpoint boundary, and after a rotation. Confirm no stuck states and no overlap.

---

## Axis 6 - Content extremes

Real data is not the placeholder. Names run long, lists run to hundreds, nesting runs deep, and just as often the data is empty, singular, or missing.

**How to run it**

- Load the maximum case: the longest realistic name and title, a list with ten times the expected item count, the deepest nesting the data model allows, the largest number, the longest unbroken string (a URL, an email, a token).
- Load the minimum case: the empty state (zero items), the single-item case, a record with missing images, a field left blank.
- Combine them: a long name inside an otherwise empty list, a deep nesting with one leaf, a huge number in a narrow column.

**What failure looks like**

- Overflow - long text breaks out of its container, pushes the layout wide, forces horizontal page scroll, or spills over adjacent elements.
- Collapse - the empty state renders as a blank void, a zero-height container, a bare "undefined," or a broken-image icon where a thumbnail should be.
- Broken truncation - text is cut mid-word with no ellipsis, or truncated so aggressively it loses meaning, or a tooltip that should reveal the full value is missing.
- Unstyled extremes - the tenth-times list has no virtualization and janks on scroll, the deep nesting has no indent ceiling and marches off the right edge, the missing image leaves a jagged gap instead of a designed placeholder.

**What a pass requires**

- Truncation rules hold and are designed, not accidental. Long strings clamp with an ellipsis at a defined line count, the full value stays reachable (tooltip, expand, or detail view), and truncation never destroys meaning.
- Empty states are designed, not defaulted. Zero items renders an intentional empty state with an explanation and, where relevant, a primary action. One item looks deliberate, not like a broken list.
- Missing media has a designed placeholder - a fallback image, an initial, a neutral block sized to the real dimensions - never a broken-image glyph or a collapsed gap.
- Nothing overflows the page and nothing collapses to nothing. Maximum content stays inside its container without forcing page scroll; minimum content still occupies a coherent, intentional shape.
- Large lists stay responsive - pagination, virtualization, or a defined ceiling keeps scroll smooth at ten times the expected count.
- Screenshot the maximum case and the minimum case for every surface that takes variable content. Confirm both are contained and intentional.

---

## Harden Pass Checklist

Run every axis against the target. Record the result of each as observed behavior, not assumption.

```
TARGET: <name>

- [ ] Axis 1 - Spam interaction: no duplicate submissions, no stuck states, no compounding animation
- [ ] Axis 2 - Interrupt animations: state lands correctly, nothing orphans mid-flight
- [ ] Axis 3 - Slow network: loading states appear, no layout shift on arrival, no impatient double-fire
- [ ] Axis 4 - Offline: graceful legible errors, no silent data loss, recovery on reconnect
- [ ] Axis 5 - Rapid resize: no layout thrash, no stuck breakpoint state, scroll position sane
- [ ] Axis 6 - Content extremes: truncation holds, empty states designed, nothing overflows or collapses

DELIBERATELY PUNTED (with reason):
- <axis>: <why it is out of scope for this release, and when it comes back>
```

An axis is either passed with a Read screenshot behind it, or explicitly punted with a reason. There is no third option. A harden pass that leaves an axis unaddressed and unnamed is not a harden pass.

---

## What This Covers

The `harden` verb owns production-readiness across errors, edge cases, and abuse. This file is its stress protocol - the observable, reproducible half of that mandate. It sits alongside the accessibility and internationalization checks the verb also runs; those verify the target is reachable and translatable, while this file verifies the target survives hostile input and a hostile network. A harden pass is complete only when both halves are green.

Where an axis overlaps another sidecoach layer, this file defers to that layer's standard and applies it under stress: Axis 2 applies the polish layer's motion interruptibility standard, and Axis 5's breakpoint behavior assumes the responsive foundation's breakpoint table already holds at the named widths - this axis extends it into the continuous space between them.
