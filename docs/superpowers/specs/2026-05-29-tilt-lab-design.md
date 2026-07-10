# tilt-lab - design spec

Date: 2026-05-29
Collaborator: Jonah
Status: approved (design phase), pending implementation plan

## Summary

`tilt-lab` is a locally-served visual-effects playground that lives inside the
claude-dotfiles repo and is owned by sidecoach. A sidecoach verb (or a relevant
flow) boots a local server and opens the playground in a cmux pane / browser tab.
The user pages through a catalog of generative effects, previews them, layers
compatible effects together, tunes their parameters, picks a target project, and
sends the result to that project as a self-contained package of framework-agnostic
web components plus an integration manifest. Claude in the target project's session
is then signalled that a package was delivered and wires it into a real page on
whatever stack that project uses.

It is explicitly a personal tool. Effects are sourced verbatim from their origins
with attribution stored; the catalog records a redistribution flag so sidecoach
*can* warn before bundling closed-source effects into a shipped project, but the
default behavior is faithful capture.

## Foundational decisions (locked during brainstorming)

1. **Home / launch:** lives in `claude-dotfiles`, owned by sidecoach, launched on
   demand into a cmux pane / browser tab, always served locally, never deployed.
2. **Output format:** every effect ships as a **framework-agnostic Web Component**
   (`<tilt-aurora>`, etc.), so it drops into React / Vue / Svelte / Astro / plain
   HTML with zero adapter code.
3. **Sourcing posture:** verbatim everything, personal-use. Attribution + license +
   a redistribution flag are recorded per effect as metadata.
4. **App stack:** the playground shell is **Vite + React + TypeScript**. The effects
   themselves remain framework-agnostic web components; React is only the shell.

## Architecture

```
claude-dotfiles/
  tilt-lab/
    app/         Vite + React + TS  -> the playground UI
    runtime/     TS effect runtime  -> built to framework-agnostic web-component bundles
      effects/   one dir per effect (glsl/canvas source + manifest.json)
    catalog/     catalog.json index + attribution/license records
    server/      tiny local Node server (serve app, list projects, write handoff, signal sidecoach)
    dist/        built playground + tree-shakeable effect bundles
```

### Launch flow
- A sidecoach verb (proposed `/sidecoach shaders`, final name decided at plan time)
  or a relevant design flow starts the local server (proposed `localhost:5180`).
- The server serves the built playground and opens it in a cmux pane / browser tab.
- Local only. No deploy target.

## The collection format (the spine)

Every effect, regardless of origin technology (GLSL, Three.js, canvas particles,
CSS/SVG, image post-processing), conforms to one **runtime contract**:

```ts
interface Effect {
  init(canvas: HTMLCanvasElement, opts: Record<string, unknown>): void;
  frame(t: number): void;
  resize(w: number, h: number): void;
  setParam(key: string, value: unknown): void;
  dispose(): void;
}
```

Each effect ships with a **`manifest.json`**:

```jsonc
{
  "id": "aurora",
  "name": "Aurora",
  "category": "gradient",
  "layerRole": "background",          // background | midground | pointer | post
  "params": [
    { "name": "intensity", "type": "range", "min": 0, "max": 2, "default": 1 },
    { "name": "hue", "type": "color", "default": "#5b8cff" }
  ],
  "requiredAssets": [],                // e.g. images for cursor-image-trail
  "origin": "https://ui.unlumen.com/components/aurora-card",
  "license": "personal-use",
  "attribution": "unlumen",
  "redistribution": "personal-only",  // ok | personal-only | reimplemented
  "tags": ["aurora", "glow", "card"]
}
```

### Generic web-component layer
The web-component wrapper is **manifest-driven and generic**. It reads the manifest
and renders `<tilt-{id}>` whose attributes map to params, and it owns: canvas mount,
the `requestAnimationFrame` loop, a `ResizeObserver`, `prefers-reduced-motion`
handling, and `dispose()` lifecycle. Because it is generic, browsing, layering,
parameter controls, and the add-a-shader flow are all uniform: they are driven by
the manifest, so heterogeneous sources look identical to the tool.

## Layering & compatibility

Four **layer roles** govern what can stack:

| Role | Meaning | Stacking rule |
|---|---|---|
| `background` | full-bleed (gradients, noise, plasma) | exclusive, max 1 |
| `midground` | transparent objects (globe, particles, aurora) | stackable |
| `pointer` | cursor-driven overlays (image-trail) | stackable |
| `post` | transforms everything beneath (ASCII, dither, halftone, glass) | exclusive, max 1, composited last |

A stack is **valid** when it has at most one `background`, at most one `post`, and
is ordered `background -> midground -> pointer -> post`. The playground enforces
this live: incompatible adds are greyed out with a reason. Each layer has a
blend-mode selector.

**Known hard part:** the `post` layer must sample the composited output of the
layers beneath it via a shared offscreen pipeline (render-to-texture / offscreen
canvas, then post-process samples it). This is the single most technically involved
piece and is called out explicitly so it is planned for, not discovered late. For
v1 the compositor renders the non-post layers to a shared offscreen canvas, then the
post effect samples that canvas as its input texture.

## Playground UI

- **Left:** filterable browse grid of effect cards (live mini-preview or captured
  poster), category + layer-role filters, search.
- **Center:** large live preview canvas rendering the composited layer stack in real
  time.
- **Right:** the layer stack: add / remove / reorder, per-layer param controls
  auto-generated from each manifest, blend-mode selector, live compatibility hints.
- **Top bar:** project picker, Send to project, Add shader.

## Project association & the Claude handoff package

The local server enumerates target projects by scanning a configured root (default
`~/Documents/Github/*` git repositories) plus a recents list. On **Send to project**
it writes:

```
<project>/tilt-assets/<stack-name>/
  tilt-stack.js     built runtime + chosen effects, tree-shaken
  manifest.json     effects, chosen params, layer order, blend modes, attribution/license/redistribution
  README.md         exact integration snippet (<tilt-stack config-src> + <script type=module>)
  assets/           any required images (image-trail, fake-3d, etc.)
```

The package exposes two integration shapes:
- Individual standalone elements, e.g. `<tilt-aurora intensity="1.2">`.
- A composed `<tilt-stack config-src="./manifest.json">` element that renders the
  full layered stack from the manifest.

After writing, the server **emits a sidecoach handoff signal**: a file that
sidecoach / Claude polls (mirroring the Discord `approved/` marker pattern), so
Claude in the target project's session is told a package was delivered, with the
manifest and integration instructions, and can wire it into a real page on that
project's actual stack.

## Add-a-shader flow

A modal supporting three input methods:
1. Paste **GLSL** (fragment, optional vertex).
2. Paste a **canvas/TS module** conforming to the runtime contract.
3. Point at a **URL or file**.

The user then defines the param schema (sliders / color pickers), picks `layerRole`
and category, and sets attribution / license. Live preview, contract validation, and
save into `catalog/effects/`. The new effect uses the same manifest shape as
everything else, so it is immediately browsable and layerable.

## Source inventory - ~25 effects across 9 acquisition lanes

| Lane | Source | Effects | Likely roles |
|---|---|---|---|
| 1 | regent (own) | fluid, fractal-glass, halftone, mesh-gradient, swarm | bg / post / mid |
| 2 | shaders.paper.design | grain-gradient, neuro-noise | background |
| 3 | spell.sh | animated gradient | background |
| 4 | cobe (MIT) | globe | midground |
| 5 | particles.casberry.in | particles | midground |
| 6 | ui.unlumen.com | cursor-image-trail | pointer |
| 7 | ui.unlumen.com | aurora (card background) | background |
| 8 | motion-core.dev | dithered-image, fake-3d-image, glass-slideshow, globe, halo, infinite-gallery, interactive-grid, lava-lamp, neural-noise, plasma-grid, specular-band, water-ripple | mixed |
| 9 | ascii-magic.com | ascii | post |

Notes:
- A few motion-core items (infinite-gallery, glass-slideshow, fake-3d-image) are
  really **content widgets**, not pure backgrounds; classify precisely during
  acquisition and assign roles then.
- Several effects overlap with the existing dotfiles `visual-effects` skill (dither,
  halftone, particles, fluid, mesh-gradient). Use those as a **jump-start
  reference**, not a re-derivation.
- motion-core and unlumen are commercial/closed component libraries; their effects
  get `redistribution: personal-only` in the manifest.

## Build phases & the team

Per brainstorming discipline, the implementation plan is written before any team is
dispatched. The planned team shape:

- **Phase 1, Acquisition (parallel fan-out):** one agent per source lane (1-9),
  each normalizing its effects into the runtime contract + manifest.
- **Phase 2, Runtime + web-component layer:** the generic manifest-driven
  custom-element wrapper, the RAF/resize/reduced-motion lifecycle, and the offscreen
  compositor that powers layering + the post pipeline.
- **Phase 3, Playground UI:** Vite + React shell (browse grid, preview, layer
  stack, param controls, project picker, add-shader modal).
- **Phase 4, Server + handoff + sidecoach wiring:** local server, project
  enumeration, package writer, handoff signal, and the sidecoach verb/flow that
  launches the tool.
- **Phase 5, QA gate:** since this is UI, run the sidecoach QA triad
  (audit -> critique -> polish) plus tactical-polish, with visual
  verification via cmux screenshots.

Acquisition fans out in parallel; the build phases are sequential.

## Out of scope (v1)

- Public deployment / hosting (always local).
- Authoring effects from a node-graph editor (paste/point-at only for add-a-shader).
- Automatic per-framework adapter generation (web components cover all stacks).
- License-aware bundling enforcement (the redistribution flag is recorded and
  surfaced, but v1 does not hard-block a bundle; sidecoach can add that later).

## Open items to settle in the plan

- Final sidecoach verb name (`/sidecoach shaders` vs alternatives).
- Local server port and whether it reuses any existing dotfiles server harness.
- Exact offscreen-compositor approach for the post layer (single shared canvas vs
  per-layer FBOs); prototype during Phase 2.
- Configurable project-scan root (default `~/Documents/Github`).
