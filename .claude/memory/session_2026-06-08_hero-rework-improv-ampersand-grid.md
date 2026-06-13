---
name: Hero rework - "build with / Improv" + 8-bit ampersand + interactive-grid post (Option A)
description: Marketing-site hero rebuilt; ampersand lives inside the tilt-lab stack so the post grid distorts it
type: project
relates_to: [session_2026-06-08_tiltlab-interactive-grid-post.md]
---

Collaborator: Jonah. 2026-06-08 (late-night build). Repo: ~/Documents/Github/improv.

User asked: rework marketing-site hero -> "build with" (small) / "Improv" (huge); 8-bit red ampersand SVG (from ~/Downloads) as a bg object offset to the RIGHT quadrant; overlay bg with the interactive-grid post stack (grid:8, mouseSize:0.44, strength:0.05, relaxation:0.9); text/CTA on top. Chose **Option A**: ampersand is a `media` layer INSIDE the tilt-lab stack so the post grid actually distorts it (vs B = plain DOM img, grid floats over nothing).

**Key constraint found:** tilt-lab `media` effect draws CENTERED (cover/contain), no offset param. So I wrapped the ampersand's 8 source shapes VERBATIM in a hero-aspect wrapper SVG (`marketing-site/assets/ampersand-hero.svg`, viewBox 1600x900, `<g transform="translate(840 150) scale(5)">`) to pre-place it right-of-center. Path data unchanged (icon-source rule: reposition the group, never redraw).

**Stack mounted on a host behind the text:** `[ media(source: ./assets/ampersand-hero.svg, fit: contain) -> interactive-grid(post, the given params) ]` via `mountStack` from vendored `marketing-site/tilt-runtime.js` (copied from tilt-lab/dist).

**Known risk to verify:** sparse subject + post grid can GHOST (grid draws displaced ampersand over the static media canvas beneath). strength is only 0.05 so likely subtle - VERIFY under cursor motion; if visible, address.

**Pointer plan:** host z0 pointer-events:auto; .hero__inner z1 pointer-events:none so cursor passes through to the grid; .hero__cta-row re-enables pointer-events for clicks. Verify the grid tracks the cursor and the CTA still clicks.

**Build landed + verified at desktop width (Chrome MCP, fresh tab):** wrapper SVG, vendored tilt-runtime.js, hero markup (kicker + wordmark + fx host), CSS (huge clamp wordmark, layering, pointer-through), mount script. Screenshot confirmed: "BUILD WITH" mono caps, huge serif "Improv", 8-bit red ampersand in the RIGHT quadrant behind the wordmark, lede+install+CTA on top. No console errors. (First cmux screenshot looked wrong = stale CSS cache + 340px split pane, not a real bug.)

**User reaction: "I don't like it."** Pivoted to copy first. Via AskUserQuestion chose intro line **"build the scene with"** (over "yes, and -", "no script just", "make your build look good"). Noted the brand IS improv: Yes& Agency / &dev, tools named Justify/Sidecoach/Tilt/Endow = improv glossary. Updated `hero__kicker` text -> "build the scene with". The grid-distortion interaction test was interrupted before confirmation.

Status: IN PROGRESS. Copy updated. STILL OPEN: user said "First..." (more changes coming) - need to learn what specifically they dislike about the hero visual before more building; grid-on-cursor distortion not yet visually confirmed.

Files (so far): marketing-site/assets/ampersand-hero.svg. Pending: marketing-site/index.html, styles.css, tilt-runtime.js (vendored).
