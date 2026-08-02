---
name: A real boot loader, and a first-paint stagger reveal - fixed once, live, from user feedback
description: Direct order - "Show a loader until installer is completely finished initializing/loading, then fade out loader, and stagger fade everything else in." First attempt had a real sequencing bug the user caught live; fixed, then tuned pacing on further live feedback.
type: project
relates_to: [session_2026-08-02_home-dashboard-view.md]
author_human: Jonah
author_model: claude-sonnet-5
source: session
verified: axe-core 0 violations/35 passes on the final page; test-component-browser.sh 147/0; sidecoach directory audit 0 blocking findings; the sequencing bug reproduced and then disproven live via a temporarily exaggerated per-row delay (220ms, reverted to 30ms before shipping) - confirmed content genuinely invisible behind the loader while it fades, confirmed the loader itself pulses via three back-to-back screenshots each catching a different point in its animation cycle
confidence: high
---

# A loader that actually covers loading, then a reveal that actually waits (2026-08-02)

Jonah: "Show a loader until installer is completely finished initializing/loading, then
fade out loader, and stagger fade everything else in."

## What was there before

Nothing covered the gap between the static HTML shell and the manifest actually
resolving. For however long `install.sh --manifest` took to run (a real shell probe
across the whole tree, not instant), the page showed its bare pre-JS markup: empty rail,
the literal word "Setup", "Nothing to configure here." Every screenshot taken earlier
this session that looked "blank" was this exact gap, just never named as a problem until
now.

## The loader itself

A `.loader` full-viewport overlay (`position:fixed; inset:0`, `background:var(--canvas)`
so it matches the page exactly, `z-index:100`) shown by default in the static HTML,
centered on just the ampersand glyph from the header's own `and-dev` logo mark (cropped
to `viewBox="0 0 44 54"` to isolate it from the "dev" wordmark) rather than a generic
spinner - verbatim-sourced, not fabricated, and on-brand rather than a stock loading
icon. It pulses (`loader-pulse`, opacity+scale, infinite) so a slow load still reads as
"working," not "frozen."

## The bug the user caught live, and the actual root cause

First shipped version: `render()` built the Home page at its normal opacity (1) the
instant the manifest resolved, still hidden behind the opaque loader. `hideLoader()`
then faded the loader out over 360ms and only added the stagger-reveal classes
afterward. Jonah, watching it happen: "loader fades out showing everything, then
staggers everything in very quickly. loader should fade out, and i should see zero
content, no flash of the content beforehand. then stagger everything in."

The bug: opacity is not binary while something is transitioning. For the entire 360ms
the loader was fading, it was semi-transparent - and the content sitting underneath it
was ALREADY at full opacity, so it showed straight through the "disappearing" loader.
The user watched the finished page reveal itself as the loader thinned out, THEN watched
everything flash to invisible and stutter back in via the stagger classes being applied
after the fact - exactly backwards from the request.

Fix: added `.pre-reveal{opacity:0;}`, a static (non-animated) hidden state applied to
every reveal target the INSTANT `render()` first builds them - before the loader ever
starts fading, not after. `hideLoader()`'s existing 360ms timer still gates when the
real stagger begins; `revealContent()` now removes `.pre-reveal` and adds `.stagger-in`
in the same step, so the swap from "hidden" to "animating in" happens atomically, only
once the loader is confirmed gone.

## Verifying an animation that finishes in under a second

Screenshotting between separate tool calls could not reliably catch a genuine mid-
animation frame - total sequence time (revealed content only) was well under a second,
and tool round-trip latency made it a coin flip whether any given screenshot landed
before, during, or after. Solved by temporarily multiplying the per-row stagger delay
from 30ms to 220ms (`sed`, reverted before shipping), which stretched the whole sequence
long enough to reliably screenshot mid-flight - confirming BEFORE the fix that content
was visible through the fading loader, and AFTER the fix that it stayed at true opacity
0 behind it. Also hit a real cache-staleness trap mid-verification: repeated edits to the
same `styles.css` URL within one long-lived browser tab meant a plain reload sometimes
re-served an EARLIER cached copy rather than the current file (confirmed by diffing
server-side content via curl against what the browser was actually applying) - worked
around with a temporary `?bust=N` query string on the stylesheet link during testing
only, removed before the file shipped clean.

## Final pacing, tuned live

Jonah, watching the corrected (but still 220ms-delay) sequence: "Let that stagger in
happen a little more quickly." Reverted to the original 30ms-per-row value - the same
figure sidecoach's own polish convention already recommends for staggered entrances
elsewhere in this codebase (`calc(30ms * var(--index))`), not a new guess.

## Codex review, folded

Independent review (read-only, given the diff plus surrounding files) before this
shipped. Four findings folded, one declined:

- **Folded** - `revealTargets()` never included `.actionbar` (the Quit/Apply footer), so
  it sat at full opacity the whole time, visible through the loader's fade - the exact
  bug class this session already fixed once. Added it to the target list.
- **Folded** - `.loader.is-out` and `.pre-reveal` hid content with opacity alone, leaving
  real focusable/clickable controls sitting there at opacity:0 - a fast keyboard user
  could reach and activate one before it visually existed, and under reduced motion the
  loader goes invisible instantly but the JS timer still waits the full 360ms before
  removing it, leaving a dead invisible click-blocking layer. Added
  `pointer-events:none` to both.
- **Folded** - the manifest-load failure path wrote into `#paneDesc` with no live region,
  so a screen reader user would not hear it. Added `role="alert"` but only inside the
  catch block, not on the element permanently - `paneDesc` changes on every ordinary
  navigation too, and alerting on all of those would be noise for the one real failure
  case.
- **Declined** - no timeout on the `/manifest` fetch, so a fetch that stalls forever
  would leave the loader up forever. Real risk, but this is a same-machine dev tool
  talking to a server it just spawned itself - a genuine network hang here is
  vanishingly unlikely, and the loader already fails safer than what it replaced (the
  old code showed nothing at all while waiting; this at least shows a pulsing "still
  working" state). Adding `AbortController` timeout handling is real scope beyond what
  was asked for a problem this session has no evidence actually occurs.

## Files touched

- `claude/installer-gui/index.html` (loader markup, `hideLoader()`/`revealTargets()`/
  `revealContent()`, `boot()` now marks `.pre-reveal` before the try block's `render()`
  returns, `.actionbar` added to reveal targets, `role="alert"` on the catch-path error)
- `claude/installer-gui/styles.css` (`.loader`/`.loader__mark`/`.sr-only`/`.pre-reveal`/
  `.stagger-in` plus the `loader-pulse`/`stagger-in` keyframes, `pointer-events:none` on
  both hidden states)
