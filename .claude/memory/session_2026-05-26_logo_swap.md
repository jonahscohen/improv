---
name: marketing-site logo swap to and-dev SVGs
description: Jonah provided two SVG logos (and-dev-white.svg for dark theme, and-dev-black.svg for light theme) to replace yes-and-logo-{light,dark}.webp across the marketing-site wordmark.
type: project
---

Jonah requested logo swap from `yes-and-logo-{light,dark}.webp` to new SVGs in Downloads:
- `and-dev-white.svg` (viewBox 200x76.7, ratio 2.61:1) - for dark theme
- `and-dev-black.svg` (viewBox 150x54, ratio 2.78:1) - for light theme

**Mapping rationale:** white ink renders on dark bg (`wordmark__img--dark`), black ink renders on light bg (`wordmark__img--light`).

**Aspect-ratio mismatch flagged:** the two SVGs have different viewBox ratios. At the CSS-enforced 28px display height, white will be ~73px wide, black will be ~78px wide. ~5px shift on theme toggle - minor, not a blocker, but worth Jonah's attention. Source-file artifact, not something I introduced.

**RESOLVED 2026-05-26 17:35:** Jonah delivered `and-dev-white-final.svg` with matching viewBox 150x54. Overwrote `assets/and-dev-white.svg` with the new file. HTML width/height attrs being updated from `200 77` to `150 54` in all 5 HTML files.

**Scope:** 5 HTML files (index, sidecoach, reference, improv, memory) each have identical wordmark block in header. No footer logo references.

**Steps:**
1. Copied both SVGs to `marketing-site/assets/` (DONE)
2. Update wordmark img src + width/height attrs in 5 HTML files (NEXT)
3. Verify visually in browser (NEXT)
4. Old webp files retained in `assets/` as backup; not deleted unless asked.

CSS already sets `.wordmark__img { height: 28px; width: auto; }` so display height is unchanged. HTML width/height attrs only used for layout-shift reservation; I'll set them to each SVG's viewBox values for correct aspect ratio.
