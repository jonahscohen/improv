---
name: The justify inline prompt had vertical viewport protection and no horizontal equivalent
description: clampPromptTop existed and was applied at all three writers of container.top; nothing clamped container.left, so a selection near either edge pushed the prompt off-screen. Added clampPromptLeft plus a max-width so it can shrink, applied at all three left writers and on resize.
type: project
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: 6 named cases plus an exhaustive sweep over 258 viewport widths x 77 positions, all pass; string literals confirmed in the minified bundle with a negative control on the removed value; deployed copy re-checked; VISUALLY CONFIRMED by Jonah on the reported page
confidence: high
---

# Horizontal protection for the inline prompt (2026-07-31)

Commit stamp at authoring: 23a83e71.

Reported by Jonah with a screenshot: the prompt field bleeding off the right edge of the
viewport, its left rounded corner clipped.

## The asymmetry

The VERTICAL axis was already fully protected. `clampPromptTop(y, aboveY, h)` is exported
specifically so that every writer of `container.top` applies it, with a comment saying the
selection-follow trackers overwrite it within a frame otherwise.

There was no horizontal equivalent. Three sites write `container.left`, all unclamped:

    core/prompt/inline-prompt.ts:335   show()
    core/prompt/index.ts:351           selection-follow tracker
    core/prompt/index.ts:888           selection-follow tracker (rAF loop)

Callers derive x by centring a 300px input on the selection - `rect.left + rect.width/2 - 150` -
so a selection near the left edge produces a negative x and one near the right edge pushes the
panel past `innerWidth`.

## Two halves, because clamping alone is not enough

1. `clampPromptLeft(x, w)`, mirroring `clampPromptTop`'s shape, applied at all three writers plus
   the resize handler.
2. The panel could not fit at all below about 404px, because the input carried
   `min-width:300px` alongside two 36px non-shrinking buttons and two 8px gaps. Clamping cannot
   save a panel wider than the viewport. So the container gained
   `max-width:calc(100vw - 16px)` and the input went from `min-width:300px` to
   `min-width:0;flex:0 1 300px` - it still gets 300px at any normal viewport, and yields first
   when space runs out so the buttons stay reachable.

The resize case was genuinely uncovered: the existing resize handler only refreshed selection
overlays, and the rAF trackers run only while a selection is being followed, so a viewport
narrowing under an already-open prompt would leave it overflowing.

## TWO TRAPS THIS SESSION ALMOST WALKED INTO

**1. `src/` is a stale legacy copy; `core/` is authoritative.** Both trees contain
`core/prompt/inline-prompt.ts`. `build.js` entry is `core/index.ts`. `core/` is 547 lines with a
recent commit; `src/core/` is 463 lines whose last commit is an old rename. Editing `src/` would
have changed nothing and looked like a fix. Anyone touching justify should confirm which tree
builds before editing.

**2. The first bundle check read 0 hits and was wrong.** Grepping the minified bundle for
`clampPromptLeft` returned zero, because a prod esbuild mangles identifiers. Checking STRING
LITERALS instead - `max-width:calc(100vw - 16px)`, `flex:0 1 300px` - found them, plus the
inlined arithmetic under mangled names (`innerWidth-w-8`). A negative control confirmed the old
`min-width:300px` is gone. **In a minified artifact, verify with string literals, never with
identifiers.**

## The deploy step that would have made the fix invisible

`~/.claude/justify/dist/` is a real directory, not a symlink to the repo. A rebuild alone left
the served copy stale at 0 hits. The four bundles were copied across and re-verified in place.
This is the same copy-not-link propagation shape recorded for hooks and settings.

## Test evidence

    pass  selection mid-screen, no clamp needed      x=400  vw=1440 -> 400
    pass  selection at far left, negative x          x=-120 vw=1440 -> 8
    pass  selection at far right, overflow           x=1300 vw=1440 -> 1044
    pass  the reported screenshot case               x=620  vw=646  -> 250
    pass  viewport narrower than the panel           x=500  vw=360  -> 8
    pass  exactly flush right                        x=1044 vw=1440 -> 1044
    ALL PASS + exhaustive sweep, 258 viewports x 77 positions, never off-screen either side

## Visual confirmation

Jonah reloaded the reported page and confirmed the fix renders correctly. No headless browser is
installed in justify and no cmux browser surface was open, so the render was checked by the human
rather than by this session.

**Worth fixing before the next justify UI change:** there is no way for a session to screenshot
justify's own overlay. Every visual claim about it currently depends on Jonah looking. Adding a
headless browser to justify, or recording a cmux surface id in its beats, would close that.

Pre-existing and untouched: 3 typecheck errors in `core/freeze-animations.ts` and
`core/index.ts`, neither of which this change touches.

## Files touched

- `justify/core/prompt/inline-prompt.ts` (clampPromptLeft, container max-width, input min-width, show() clamp)
- `justify/core/prompt/index.ts` (import, two tracker sites, resize re-clamp)
- `justify/dist/*` rebuilt; `~/.claude/justify/dist/*` deployed
