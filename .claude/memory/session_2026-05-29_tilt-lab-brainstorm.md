---
name: tilt-lab brainstorm + design spec
description: Brainstormed and spec'd tilt-lab - a sidecoach-owned, locally-served visual-effects playground that catalogs ~25 effects from 9 sources, layers them, and ships framework-agnostic web-component packages into target projects for Claude to wire up
type: project
relates_to: [session_2026-05-29_new-website-queued.md]
superseded_by: session_2026-06-05_tilt-lab-consolidated.md
---

Collaborator: Jonah. 2026-05-29. Brainstormed via superpowers:brainstorming, then wrote the design spec. Design APPROVED by user; spec written; next step is writing-plans, then a team dispatch for the build.

## What tilt-lab is
A shader/visual-effects playground inspired by basement.studio's shader-lab. Lives in claude-dotfiles, owned by sidecoach, launched on demand into a cmux pane / browser tab, ALWAYS served locally. Browse a catalog of generative effects, preview, layer compatible ones, tune params, pick a target project, and send a self-contained package (framework-agnostic web components + manifest + integration README) into that project. The local server then emits a sidecoach handoff signal so Claude in the target project wires it into a real page on that project's stack.

## The 4 locked foundational decisions (AskUserQuestion)
1. Home/launch: in claude-dotfiles, sidecoach-owned, cmux pane/browser tab, local-only.
2. Output format: framework-agnostic Web Components (`<tilt-aurora>`, `<tilt-stack>`).
3. Sourcing posture: verbatim everything, personal-use; attribution + license + redistribution flag stored per effect as metadata (not hard-enforced in v1).
4. App stack: Vite + React + TS shell; effects stay framework-agnostic web components.

## Name
User named it **tilt-lab** (was working name shader-lab). Effect elements `<tilt-{id}>`, multi-layer wrapper `<tilt-stack>`, package dir `<project>/tilt-assets/<stack-name>/`.

## Core architecture
tilt-lab/{app (Vite+React), runtime (effect contract -> web-component bundles), runtime/effects (per-effect glsl/canvas + manifest.json), catalog, server (local Node: serve, list projects, write package, signal sidecoach), dist}.

Runtime contract: `Effect { init, frame, resize, setParam, dispose }`. Generic manifest-driven web-component wrapper owns canvas mount, RAF, ResizeObserver, prefers-reduced-motion, dispose. Manifest carries id/name/category/layerRole/params/requiredAssets/origin/license/attribution/redistribution/tags.

## Layering model
4 layer roles: background (exclusive, max 1), midground (stackable), pointer (stackable), post (exclusive, max 1, composited last). Valid stack order: background -> midground -> pointer -> post. Playground greys out incompatible adds with a reason. KNOWN HARD PART flagged: the post layer must sample the composited output beneath via a shared offscreen canvas / render-to-texture pipeline; prototype in Phase 2.

## Sources (~25 effects, 9 lanes)
1 regent (own): fluid, fractal-glass, halftone, mesh-gradient, swarm. 2 paper.design: grain-gradient, neuro-noise. 3 spell.sh: animated gradient. 4 cobe (MIT): globe. 5 casberry: particles. 6 unlumen: cursor-image-trail. 7 unlumen: aurora. 8 motion-core: dithered-image, fake-3d-image, glass-slideshow, globe, halo, infinite-gallery, interactive-grid, lava-lamp, neural-noise, plasma-grid, specular-band, water-ripple. 9 ascii-magic: ascii.
Reuse jump-start: the dotfiles `visual-effects` skill already ships source for ~13 of these. Regent already has 5 as working Next.js/Three.js /tools generators ("fully cooked shaders, half-cooked presentation").

## Team plan (executes AFTER writing-plans, not yet dispatched)
Phase 1 acquisition parallel fan-out (1 agent per source lane) -> Phase 2 runtime + web-component layer + offscreen compositor -> Phase 3 Vite+React playground UI -> Phase 4 server + handoff + sidecoach verb wiring -> Phase 5 QA gate (audit->critique->polish + tactical-polish, cmux visual verification).

## Note
content-guard blocked the first spec Write for em dashes; rewrote with hyphens. (Reminder: spec prose must avoid em dashes.)

## Files
- docs/superpowers/specs/2026-05-29-tilt-lab-design.md (new)
