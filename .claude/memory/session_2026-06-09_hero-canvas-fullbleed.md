---
name: Hero FX canvas extended to full viewport (ampersand held in place)
description: .hero__fx host made full-bleed width while keeping the svg-3d ampersand at its ~69% position
type: project
relates_to: [session_2026-06-09_hero-svg3d-ampersand-retrofit.md]
---

Collaborator: Jonah. 2026-06-09. Repo: ~/Documents/Github/improv.

User (with an annotated screenshot, dark mode): the FX canvas should extend to the end of the viewport, but the ampersand should remain in position.

**Key constraint:** svg-3d AUTO-CENTERS the object in its host. So setting the host to full width (left:0;right:0) would recenter the ampersand to 50% (move it left) - not allowed.

**Fix (1 line, CSS):** `.hero__fx` was `left:38%; right:0` (band, center 69%). Changed to `left:0; right:-38%` -> host spans 0..138% of viewport, center still 69%, so the centered ampersand holds its exact position while the rendering surface now reaches the LEFT viewport edge (and extends past the right, clipped by .hero--fx overflow:hidden at 100%). Object size unchanged (camera fov fills canvas height; height unchanged; aspect>1 both ways so responsive-zoom factor stays 1).

**Verified (Chrome desktop, fresh load):** ampersand in the same right-quadrant spot/size; canvas host now full-bleed. NOTE: visually near-identical because the canvas is transparent over the uniform dark page bg - the change is structural (host bounds), not a color change. Flagged to user in case they expected a visible diff or also want full viewport HEIGHT (currently hero min-height clamp(540px,82vh,860px); could go 100vh).

Files: marketing-site/styles.css (.hero__fx). Working tree on main, uncommitted.
