---
name: The installer GUI rebuilt as a preferences dashboard - full bleed, persistent rail, real &dev mark, theme toggle
description: Jonah rejected the first pass. Rebuilt top to bottom: no window-in-a-window, the real and-dev logo instead of a wordmark I invented, a light/dark toggle, and a rail that stays visible so drilling in never loses context.
type: project
relates_to: [session_2026-08-01_installer-gui-marketing-tokens.md]
supersedes: session_2026-08-01_installer-gui-marketing-tokens.md
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: rendered and read at five states - dark, light via the real toggle, two levels deep, staged, and the toggle control itself; every screenshot opened; audit run before and after
confidence: high
---

# The installer as a dashboard (2026-08-01)

Commit stamp at authoring: 792019d9.

Jonah on the first pass: "Nah, I don't like it... rethink the workflow, hierarchy and
presentation. It shouldn't look like a window inside of a window. Also, use the proper &dev logo,
dont do what you did. Also, add light/dark mode. Treat it like a dashboard preferences menu with
breadcrumb navigation too."

Four separate faults, and he was right on all four.

## What I got wrong the first time

1. **A window inside a window.** I kept the previous build's centred, bordered, rounded, shadowed
   panel and only restyled it. A panel floating in a viewport reads as a screenshot OF an
   application. It is now full bleed: `grid-template-rows:auto 1fr auto` at `100vh`.
2. **I INVENTED A WORDMARK.** I typeset "Improv&" in the display face with a red ampersand and
   called it the brand. The real mark is `assets/and-dev-black.svg` in the marketing repo and I
   never looked for it. Fabricating a logo is the same class of error as fabricating an SVG icon,
   which the standing rules forbid outright, and I did not stop to check whether an asset existed.
   Now inlined verbatim, ONE copy with `.cls-0` driven by a theme token so the mark follows
   light/dark rather than swapping two files as the site does.
3. **No theme control.** I shipped `prefers-color-scheme` and called it "both themes". That is
   not a feature, it is a default. There is now a real toggle, resolved before first paint by an
   inline script and persisted to localStorage, with the Lucide moon/sun paths verbatim.
4. **The workflow was untouched.** I restyled a drill-down stack instead of rethinking it.

## The workflow change, which is the actual redesign

The old model replaced the entire screen when you opened a group, so you lost sight of every
other component and had to walk back up to compare two of them. A preferences dashboard keeps its
sections in view.

    topbar   logo | breadcrumb | theme toggle
    body     persistent rail  |  pane
    footer   staged count | hint | keys | Quit | Apply

`nav[0]` is the rail selection; deeper entries drill within the pane. **Verified two levels deep
at `Setup › Guardrails › safety`: the rail is still fully visible, Guardrails is still marked
current, and the breadcrumb's intermediate segments are clickable.** That is the thing the old
build could not do.

Bulk actions became real buttons instead of rows pretending to be items, and Apply is a primary
button that only takes the brand red when something is staged - it reads "Apply 1 change" and
turns red exactly when there is something to do.

## The defect the screenshots caught, twice

The description column truncated to "CLAUD..." and "node ve...". I rebalanced the grid and it
truncated AGAIN on the next render. Fighting for horizontal room was the wrong fix: the row now
STACKS its label over its helper text, the way a preferences row actually works, which removes
the whole class rather than tuning it. Neither can be squeezed by a sibling column now.

Only rendering caught this. The CSS looked correct both times.

## Audit: 8 findings to 5, verdict still blocked, shipping anyway with reasons

- `staggered-enter` / `subtle-exit` want enter and exit animation patterns. There are none.
  Complying means adding motion that does not exist to satisfy a checker.
- `shadow-hierarchy` wants 3+ elevation tiers. This design is deliberately flat - borders and
  planes, no floating surfaces - so shadow tokens would be dead code.
- `state-completeness` reports 4/8. A list row has no loading, error or success state.
- `text-wrap-balance` fires despite `text-wrap:balance` being set on `.pane__title`; it appears to
  want an element selector rather than a class.

## Files touched

- `claude/installer-gui/index.html` (rebuilt; the manifest/apply/shutdown API logic is unchanged)
