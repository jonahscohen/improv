---
name: Is it screen-reader enabled? A real ARIA audit found one significant gap - drilling into a group had no keyboard/screen-reader path at all
description: axe-core reported 0 violations and 32-33 passes across states, which answers "is the ARIA valid" but not "can a screen reader actually use this." Reading the real markup and the real accessibility tree found the actual gap axe cannot see - and fixing it surfaced a genuine bug in the project's own accessibility-testing tool, which was also fixed.
type: project
relates_to: [session_2026-08-02_wcag-aa-508-audit.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations / 33 passes on both a leaf-only page and a page with a drillable group, after the fix; the new Open button confirmed in the real accessibility tree and via a real click that both navigates and moves focus to the new heading (visible focus ring, screenshotted); suite 147/0; sidecoach's own hit-area rule re-run and confirmed 0 blocking after fixing its false positive
confidence: high
---

# "Is it screen-reader enabled? ARIA stuff?" (2026-08-02)

Jonah's question, after the WCAG AA/508 pass already done this session. Axe-core answers the
syntactic half (valid roles, names, states) but not the experiential one - a screen reader can
correctly announce a control that still has no way to be operated. Read the actual rendered
accessibility tree (`snapshot --interactive`) rather than trusting a clean axe run alone.

## What was already there and correct

Landmarks (`<nav aria-label="Components">`, `<nav aria-label="Breadcrumb">`), the logo's
`role="img"`, the theme toggle's action-describing label, `aria-current="true"` on the active rail
item, the checkbox badges' `aria-pressed` + `aria-label` (the standard toggle-button pattern),
toast `role="alert"`/`"status"` + `aria-live="polite"`, and `aria-hidden="true"` on every decorative
icon (11 of them). All of this was genuinely correct going in.

## The gap axe cannot see: no keyboard path into a group

A drillable child row (e.g. "Hooks" inside Sidecoach) had exactly ONE interactive element: its
check badge, which stages a bulk install. Confirmed via the real accessibility tree - `snapshot
--interactive` on that page listed only `"Select Hooks for install"`, nothing else. **A
keyboard-only or screen-reader user had no way to ever open that group.** The only path in was a
mouse click on the row `<div>` itself, which carried no `tabindex` and was never in the Tab order.
The app's own arrow-key navigation scheme (a global `sel` index + keydown listener) is not a
substitute - it corresponds to no ARIA composite-widget pattern, so a screen reader in its normal
browse mode has no reason to hand keyboard control to the page for it.

Fixed by making the chevron a real, separately-focusable `<button aria-label="Open Hooks">`,
sibling to the check button rather than nested inside it (nesting two interactive controls is
invalid and would have been no more reachable than none). Verified in the real tree
(`button "Open Hooks"` now present) and by a real click that both navigated and left a screenshot
proof of a focus ring landing on the new heading.

## The same navigation change surfaced a second, related gap

Every navigation - rail click, breadcrumb click, the back button, drilling into a group - replaces
the entire pane via `render()`, which is the SAME class of bug this session already fixed for
toggling: it drops real focus to `<body>`. Fixed uniformly with `focusPaneTitle()` (the H1 gets
`tabindex="-1"` so it is a valid programmatic focus target without joining the normal Tab order),
wired into all 6 navigation call sites plus `activate()`'s non-leaf branch. `activate()`'s leaf
branch got the matching `refocusCheck()` call it had been missing.

## A real bug found in the project's own tooling, not the page

Fixing this exposed a false positive in `sidecoach`'s own `a11y.min-hit-area` check: its collector
selects `[tabindex]` for "interactive elements needing a real tap-target size," which does not
exclude `tabindex="-1"` - the exact, standard pattern just used for the heading. The rule then
measured a 27px-tall `<h1>` as a failing 44px tap target, which it can never be (it is reachable
only programmatically, never by Tab, never by a pointer). Confirmed by directly measuring every
real interactive element (themeToggle, Quit, Apply, the new go-button, the spacer all genuinely
44px+; only the pre-existing `.check` badge is smaller, and WCAG's target-size criterion is Level
AAA, not required for the AA/508 standard this session is scoped to - and Jonah has repeatedly and
explicitly ordered that badge kept small this session, so it was correctly left alone). Fixed the
selector to `[tabindex]:not([tabindex="-1"])` in both `sidecoach/src` and the compiled
`sidecoach/dist` copy directly, rather than running the project's full build/generator pipeline for
a one-line change in an unfamiliar codebase.

## Files touched

- `claude/installer-gui/index.html` (Open button, focusPaneTitle, activate() split)
- `claude/installer-gui/styles.css` (`.row__go` real 44x44 box, shared by button and spacer)
- `sidecoach/src/validators/browser-evidence-collector.ts`,
  `sidecoach/dist/validators/browser-evidence-collector.js` (tabindex=-1 exclusion)
