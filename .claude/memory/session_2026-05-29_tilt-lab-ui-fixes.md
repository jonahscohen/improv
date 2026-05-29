---
name: tilt-lab UI audit fixes landed (tilt-ui team)
description: All 4 P0-P3 fix tasks done + integrated green. Responsive breakpoints, focus-visible, param-label wrap, 40x40 hit targets, reduced-motion, hex->tokens, modal a11y, preview aria, vendor chunking, PRODUCT.md+DESIGN.md. QA gate (critique+polish) + Chrome verify next.
type: project
relates_to: [session_2026-05-29_tilt-lab-ui-audit.md, session_2026-05-29_tilt-lab-media-and-post-pipeline.md]
---

Collaborator: Jonah. 2026-05-29. tilt-ui team, tasks 1-4 done (strict per-file ownership, no conflicts).

## Fixes landed
- ui-css (styles.css): P0 responsive @media (<=900px narrows rails 280/1fr/340->200/1fr/240; <=640px single-column stack, preview order:-1 min-height:45vh, app height:auto, top-bar wraps); P1 :focus-visible accent ring; P1 param-label wrap (minmax + min-width:0 + overflow-wrap); P2 40x40 hit targets (--hit-min token, inline-flex); P2 prefers-reduced-motion guard; P3 all 21 hardcoded hex -> :root vars (zero raw hex outside :root).
- ui-a11y (AddShaderModal.tsx + PreviewCanvas.tsx): modal aria-modal + autofocus + Tab focus-trap + Escape + backdrop-close; PreviewCanvas role=img + aria-label.
- ui-perf (vite.config.ts): manualChunks split -> app 244KB (was 1005KB single) + vendor-three 492 / react 194 / ogl 60 / cobe 12; 500KB warning gone (total bytes ~same, better cache/parse).
- ui-docs (NEW PRODUCT.md + DESIGN.md): tilt-lab brand + Google-spec tokens from styles.css; design.md lint 0 errors/0 warnings.

## Integrated verify: tsc exit 0, vitest 137/137 (39 files), vite build OK (5 chunks).

## TOOLING FINDING (backlog): design.md v0.2.0 linter crashes on NESTED color/spacing groups (colorStr.trim / raw.match errors). Existing marketing-site/ + reference/ DESIGN.md FAIL lint for this. ui-docs worked around with FLAT tokens. Worth fixing/refactoring those files. -> queue.

## Next (Phase 2): task #5 /sidecoach critique + polish on tilt-lab/app (now with PRODUCT.md/DESIGN.md present) + Claude-in-Chrome visual verification: resize window for responsive, focus rings, param-label wrap on aurora/mc-globe, modal Escape/trap.

## Files
- app/src/styles.css, app/src/components/AddShaderModal.tsx, app/src/components/PreviewCanvas.tsx, app/vite.config.ts, PRODUCT.md (new), DESIGN.md (new)
