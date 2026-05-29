# tilt-lab recon - shared brief

You are a recon teammate for **tilt-lab**, a visual-effects playground. Your job is **RECON ONLY**: fetch and characterize the actual source of specific visual effects so a later acquisition phase can normalize them into a single runtime contract. Do NOT write any tilt-lab runtime code. Do NOT modify anything outside your assigned report file.

## The contract every effect will be normalized into (characterize each effect against it)

```ts
interface Effect {
  init(canvas: HTMLCanvasElement, opts: { params: Record<string, unknown>; assets: Record<string, string> }): void;
  frame(t: number): void;           // externally driven; the effect must NOT own its own RAF loop
  resize(w: number, h: number): void;
  setParam(key: string, value: unknown): void;
  dispose(): void;
}
```

Manifest fields each effect needs: `id, name, category, layerRole, params[], requiredAssets[], origin, license, attribution, redistribution, tags[]`.

- **layerRole** is one of:
  - `background` - full-bleed background, max 1 per stack
  - `midground` - a transparent object (globe, particles, aurora over content)
  - `pointer` - cursor/pointer-driven overlay
  - `post` - transforms everything beneath it (ASCII, dither, halftone), max 1 per stack
- **param types**: `range` (min/max/step), `color`, `toggle`, `select` (options[])
- **redistribution**: `ok` | `personal-only` | `reimplemented`

## Sourcing posture

Verbatim, personal-use. Capture the ACTUAL source faithfully. Record attribution + license honestly. Redistribution defaults: cobe and paper.design = `ok` (confirm the real license), motion-core and unlumen = `personal-only`, regent = `ok` (we own it), everything else = note the real license you find.

## What every report must contain, per effect

1. **Source URL(s) / file path(s)** and the **tech** (WebGL / Three.js / Canvas2D / CSS / SVG / named library + version).
2. **VERBATIM source** in fenced code blocks: the GLSL fragment/vertex shaders and/or the JS/canvas logic. If the live site only exposes minified/bundled JS, capture the relevant chunk AND find + link the original unminified source (GitHub repo, npm package on unpkg.com / cdn.jsdelivr.net).
3. **Proposed manifest**: layerRole, a params table (name / type / default / min / max), requiredAssets, category, tags.
4. **License + attribution** (author, repo/site, license type).
5. **Integration notes / gotchas** (deps like three.js; pointer-event needs; requires an `<img>` or video; WebGL2-only; devicePixelRatio handling; etc.).
6. **Normalization sketch**: how the effect maps onto `init / frame / resize / setParam / dispose`. If the source owns its own animation loop (e.g. cobe's onRender), note how to adapt it to our externally-driven `frame(t)`.

## Output

Write your full report to the file path named in your task (under `docs/superpowers/tilt-lab-recon/`). Use hyphens, never em dashes (a repo hook blocks them). Capturing real source beats guessing. Use WebFetch / WebSearch to retrieve pages, bundles, and original repos.

When done with a task: mark it completed via TaskUpdate, then claim the next available task from TaskList in ID order. When no tasks remain, send team-lead a short message and go idle.
