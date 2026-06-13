---
name: Hero wordmark shrunk 1/4 (Justify)
description: .hero__wordmark font-size reduced 25% per Justify prompt
type: project
relates_to: [session_2026-06-09_svg3d-offset-param-hero-fullbleed.md]
---

Collaborator: Jonah. 2026-06-10. Via Justify (prompt-1, .hero__wordmark <h1> "Improv"): "shrink font size by 1/4".

Change: `.hero__wordmark` font-size `clamp(5rem, 26vw, 18rem)` -> `clamp(3.75rem, 19.5vw, 13.5rem)` (every clamp stop x0.75 so it shrinks uniformly at all viewport widths, not just min/max).

Status: DONE + verified + justify-done(prompt-1) sent. Visual: "Improv" ~710px->~550px wide (~0.77 = the 1/4 cut), lede/CTA reflowed up, no clipping.

Files: marketing-site/styles.css. Working tree on main, uncommitted.
