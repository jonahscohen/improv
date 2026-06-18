---
name: Justify prompts - nav as semantic ul + process icons above number, 3x bigger
description: Two browser-submitted justify prompts on the marketing site - nav links to a proper ul (company link first, back-to-top last) and process-step icons moved above the number and enlarged ~3x
type: project
relates_to: [session_2026-06-15_justify-marketing-queue.md, session_2026-06-15_justify-validating-stage-diagnosis.md]
---

Two real prompts arrived via the justify browser watch (the forever poller wrote
them to /tmp/justify-inbox.json). Handled through the full loop incl. the Validating
stage.

prompt-1 (nav, selector nav:nth-child(2) > a): "turn this into a proper ul of links,
add the company website at beginning, add back to top link after github."
- index.html: wrapped the 6 nav <a> in <ul class="nav-list"><li>; prepended a
  company link <a href="https://yesandagency.com">Yes&</a> (real URL - found in repo,
  NOT fabricated; the .lndo.site variants are local dev for that same site), appended
  <a href="#top">Back to top</a> after GitHub ("#top" is the HTML spec's special
  top-of-document fragment, no id needed).
- styles.css: moved the flex row off .topbar nav onto a new .nav-list (display:flex,
  gap space-6, list-style none, margin/padding 0) so <nav> keeps owning the mobile
  drawer. Mobile media query: .nav-list flex-direction column + full width + li 100%.
  nav.js unaffected (it selects nav a by descendant, not position).

prompt-2 (process steps, selector .process__step:nth-child(1)): "Icon above number
and make the icon about 3x bigger."
- index.html: reordered all 5 steps so <h3 class="process__name"> (the icon) comes
  BEFORE <span class="process__num"> (DOM reorder, so it holds in both the flex arc
  AND the stacked fallback - CSS order would only affect the flex arc).
- styles.css: .process__icon 2rem -> 6rem (3x).
- Bumped stylesheet cache-buster ?v=30 -> ?v=31 (structural CSS change).

DONE + VERIFIED (2026-06-15): ran both through the Validating stage
(justify-validating -> verify in browser -> justify-done). External curl probe
confirmed served HTML/CSS. Visual proof in a FRESH Chrome tab:
- prompt-1: nav renders as a clean horizontal row "Yes& | justify | sidecoach |
  cheatsheet | beats | reference | GitHub | Back to top" - company first, back-to-top
  last, no bullets, evenly spaced (.nav-list flex works).
- prompt-2: focused "01" card shows the big clipboard icon ABOVE the "01"; fan cards
  (05 brain, 02 palette) same - 6rem icon on top, number beneath, no clipping.

RENDERER NOTE: my original MCP tab wedged (CDP captureScreenshot timed out ~5x) on
the animated dithered-canvas hero when the hero was in-viewport; a FRESH tab
captured fine. Pattern: heavy WebGL/canvas hero chokes CDP screenshot when on
screen - scroll it out of view or use a fresh tab. The user's own tab was unaffected
(daemon stayed connections:2-3). Did NOT click-test the "Back to top" link (native
#top fragment, no JS) because capturing the top freezes the renderer; structure +
position verified.

Both panel entries posted (full +/- diff schema). Collaborator: Jonah.
