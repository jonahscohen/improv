---
name: Verify every scrollable region, not just sticky nav clicks
description: A sidebar with overflow-y:auto and a visible scrollbar that does not actually scroll is a real failure mode. Lenis (or any global scroll hijacker) intercepts wheel events at the document level and blocks native scroll inside child containers. Verification protocol must include "wheel/scroll over every scrollable region" not just "click every link."
type: feedback
relates_to: [session_2026-05-20_polish-pass-reference.md, reflection_2026-05-20.md]
---

## Rule

When verifying a UI build, every scrollable region (any element with `overflow: auto/scroll` plus content taller than its container) must be tested with an actual wheel/scroll gesture, not just inferred from "the scrollbar is visible." A visible scrollbar that doesn't respond to wheel input is the bug.

This is in addition to the existing verification protocol (click every interactive element, hover every interactive state). Scrolling is an interaction; treat it as one.

## Why

Jonah caught a real bug in the polish-pass verification: the reference site's left sidebar shows a scrollbar (because content > container height) but does not scroll when you try. Root cause: Lenis hijacks `wheel` events at `document.documentElement`, prevents default, and applies the delta to the window. Wheel events bubbling up from inside the sidebar are intercepted before the native scroll fires on the sidebar itself.

I had clicked sidebar links during the polish verification - that uses Lenis's `scrollTo`, which works fine. I never tried to wheel-scroll the sidebar directly. The bug was invisible to "click-based" verification.

## How to apply

Verification checklist additions for any UI with overflow regions:

1. Identify every region with `overflow: auto`, `overflow: scroll`, `overflow-y: auto`, or `overflow-y: scroll` whose content exceeds the container.
2. Place the cursor inside each region and emit a wheel scroll (via cmux scroll command targeted at a child element, or computer-use scroll inside the region's bounding box).
3. Screenshot before and after. Compare the scroll position visually.
4. If the region does NOT respond: the smooth-scroll library is probably eating the event. Apply the library's escape hatch (`data-lenis-prevent` for Lenis, equivalent for others).

Specific to Lenis (the canonical motion-reference stack):
- Add `data-lenis-prevent` to any container that should scroll natively (sidebars, modals, code blocks with horizontal overflow, dropdowns with vertical overflow).
- Document this in the motion-reference skill if not already there.

## What this changes about the workflow

The /design-build skill's Phase 9 (Verification) currently says "click every interactive element, hover every interactive state." Add: "scroll-wheel every overflow region."

The motion-reference skill should document the Lenis + nested-scroll interaction explicitly: "Lenis hijacks wheel events. Any child element that needs to scroll natively needs `data-lenis-prevent`."

## Documentation updates landed (2026-05-20)

- `~/.claude/CLAUDE.md` Verification Protocol point #2: appended the "scrolling counts as an interaction" rule with the Lenis-prevent escape hatch.
- `~/.claude/skills/motion-reference/SKILL.md` Gotchas: added a new section "Lenis blocks native scroll inside child containers (`data-lenis-prevent`)" with HTML example.
- `reference/index.html`: added `data-lenis-prevent` to the `<aside class="sidebar">` element. Verified via cmux `scroll --selector ".sidebar" --dy 800` that the sidebar now scrolls (showed House 3 - Design items: pipeline / orchestrator / strategy / research / typography / references / motion / tokens / tactical / peer skills / PRODUCT.md spec) while the main hero stayed put.

## Collaborator

Jonah
