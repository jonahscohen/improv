---
name: Justify footer-selection input flip - three writers, one clamp
description: Jonah reported the prompt input bleeds off-viewport when selecting bottom-dwelling elements; fixed by flipping the input above the selection - but the real lesson is the input's position had THREE writers (show + two rAF trackers) and patching one was silently overwritten per-frame; unified into exported clampPromptTop, unit-tested, verified live
type: project
relates_to: [session_2026-07-04_justify-toggle-seeding-fix.md]
---

Collaborator: Jonah. 2026-07-04.

Jonah: selecting footer/bottom elements leaves the prompt input off-viewport and inaccessible - accommodate by moving the input ABOVE the selection.

## The fix that shipped
- NEW exported helper clampPromptTop(bottomY, topY, h) in inline-prompt.ts - the single source of truth for the input's vertical position: default below the selection; if bottom + height + a 28px reserve (the queue/send button row that appears while typing) would cross innerHeight - 8, flip to selection-top - height - 12; clamp inside the viewport when there is no room above either.
- ALL THREE writers of container.style.top now route through it: InlinePrompt.show() (which also measures hidden-first so height is real before positioning), and BOTH selection-follow rAF trackers in prompt/index.ts (which recompute the position every frame and also now track the selections' min-top).
- Call sites pass the selection top: lasso path, click path, edit path (pr.top).

## Why fix #1 failed (self-analysis - the load-bearing lesson)
The first implementation put the flip only in show(). It was correct and unit-provable - and invisible in the browser, because a selection-follow tracker re-writes container.style.top = bottom + 12 EVERY ANIMATION FRAME, overwriting the flip within 16ms. LESSON: before changing a positioned element's behavior, grep for every writer of that style property first (three here: show, a one-off repositioner, a rAF tracker). A property with multiple writers needs the rule in a shared helper, not in one caller.

## Verification journey (recorded because the dead ends cost real time)
- Unit tests: justify/__tests__/core/inline-prompt-position.test.ts - 6 cases via pure fakes (below-fits, overflow-flips, EDGE-HUG regression case with the button-row reserve, no-aboveY clamp, no-room-above clamp, visibility). 6/6 green; suite baseline unchanged (same 2 pre-existing failures).
- Browser dead ends worth remembering: (1) grepping a minified bundle for an IDENTIFIER proves nothing - identifiers are renamed; grep for string literals or distinctive property chains (offsetHeight||48). (2) The chrome MCP screenshots are SCALED captures - the real CSS viewport (read_page reported 1819x850) is larger than the 1568-wide screenshot; pixel math on screenshots misleads. (3) Clicks fired immediately after the justify toolbar expansion animation MISS - wait ~1s after expanding before clicking icons. (4) One transient false lead: a plain MCP navigate can serve the script from browser cache; cmd+shift+r + read_network_requests (fresh 200) settles bundle-freshness questions.
- Live E2E (real inputs): prompt mode, selected p.site-footer__copyright (bottom-most element), input rendered ABOVE the selection fully in-viewport (screenshot examined); pre-fix it rendered below and was clipped by the viewport edge. The rAF tracker holds the flipped position (no per-frame fighting).
- Deployed via npm run deploy.

Files touched: justify/core/prompt/inline-prompt.ts (clampPromptTop + show flip); justify/core/prompt/index.ts (two trackers + three call sites); justify/__tests__/core/inline-prompt-position.test.ts (NEW); deployed bundles; this beat + MEMORY.md.
