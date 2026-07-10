---
name: MouseSafeArea submenu pattern - gist eval
description: eldh gist is MouseSafeArea.ts (safe-triangle submenu pattern), not general component guidelines; eval of factoring it into our component build guidance
type: project
relates_to: []
---

Collaborator: Jonah

## What the gist actually is

https://gist.github.com/eldh/51e3825b7aa55694f2a5ffa5f7de8a6a is a single file, `MouseSafeArea.ts` (47 lines). It is the "safe triangle" / mouse-safe-area pattern: an absolutely-positioned, `clipPath`-clipped invisible `<div>` spanning the gap between the cursor and an open submenu, so the cursor can travel diagonally toward the submenu without the parent's `onMouseLeave` firing and closing it. Tracks cursor via a `useMousePosition` hook; computes left/right/width/clipPath from the submenu's `getBoundingClientRect()`. Pattern credited to Linear's "invisible details" blog post (also how Radix UI handles nested menus internally).

This is a submenu/dropdown/popover interaction technique, NOT a general component rulebook.

## Self-analysis (misread)

First WebFetch on the gist HTML page returned a HALLUCINATED summary (invented sections: General/Naming/Props/Styling/Accessibility/State/Testing) because the page exceeded the 100KB fetch cap and got truncated, so the summarizer confabulated. I built an entire AskUserQuestion on that false premise before the raw curl (`.../raw`, 1691 bytes, 47 lines) revealed the truth.
- **Failure mode:** trusted a summarizer's output over the primary source; the curl raw fetch (ground truth) was available in the same batch but I let the WebFetch narrative anchor me.
- **Fix:** for gists/raw files, read the `/raw` bytes first; never let a WebFetch summary of a large HTML page stand in for the actual file. Verify section claims against raw before reasoning on them.

## Integration intent (Jonah: "general guideline layer", chosen under the wrong premise - re-confirm)

Where it belongs: our menu/submenu/dropdown/popover component guidance (component-gallery-reference is the per-component home; sidecoach interaction-domain rules are secondary). It is a specific technique, not a general principle, so the "general guideline layer" answer was given against my mis-framing and needs re-confirmation.

Status: INTEGRATED. Added a "Hover-activated menus - the mouse safe area" note to `claude/skills/component-gallery-reference/SKILL.md` under Step 3 item 3 (Interaction patterns), right where the skill already documents the forgotten-detail class (focus trap, scroll lock, Escape). It covers the safe-triangle, marks it table stakes for hover menus, and adds two guardrails: pointer-only so keyboard/touch access is still required, and prefer Radix/Base UI/Floating UI over a bespoke global mouse-position hook (with eldh's gist as the hand-roll reference).

Why component-gallery-reference and not tactical-polish or sidecoach: it is the per-component "function layer" research skill, lists Dropdown menu / Navigation / Popover / Tooltip as types, and already enumerates exactly this kind of easy-to-miss interaction requirement. tactical-polish (tactical polish) is a viable secondary home if we ever want a polish-checklist entry too.

Files touched: claude/skills/component-gallery-reference/SKILL.md
