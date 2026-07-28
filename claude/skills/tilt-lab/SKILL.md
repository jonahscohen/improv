---
name: tilt-lab
description: Launch the tilt-lab visual-effects workbench and wire its exports into a build. Use when the user wants to open tilt-lab, audition or explore shader/visual effects, or add an animated/shader background to a hero, banner, or section. Invoke this skill when the task involves "open tiltlab", "open tilt lab", "open tilt-lab", "spin up tiltlab", "launch tilt lab", "build a tilt", "shader wizard", "audition a shader", "explore shaders", "shader background", "tilt a hero", "tilt-lab export", and when the user pastes a tilt-lab/stack config or embed snippet to retrofit. tilt-lab is the local playground for browsing ~25 effects, stacking + tuning them live, and exporting a paste-anywhere web-component package.
---

# tilt-lab

tilt-lab is a personal, locally-served visual-effects playground in this repo (`tilt-lab/`). The loop it exists for: open it, browse ~25 effects across four roles (background, midground, pointer, post), stack and tune them against a live preview, then export the assembled stack as a self-contained package you drop into another project. The preview is the export - what renders in the canvas is exactly what the export renders.

This skill does two jobs: (1) **launch** tilt-lab so the user can explore, and (2) **retrofit** a tilt-lab export into whatever you are building.

**tilt-lab is a dependent capability of sidecoach.** It owns generative/shader backgrounds within the design system. When you arrive here from a sidecoach flow (a hero or section that wants an animated backdrop), keep the design tokens that flow established and return the mounted background to it - this is sidecoach delegating the backdrop, not a separate task. You can also invoke tilt-lab directly via the launch triggers above.

## 1. Launch tilt-lab

When the user wants to open/explore tilt-lab:

1. Start the dev server in the background (Vite, port 5180):
   ```bash
   cd tilt-lab && npm run dev
   ```
   Run it with `run_in_background`. If it fails on a NODE_OPTIONS error, that is the known shim issue - see `session_2026-05-31_node-options-shim-fix.md`.
2. Open `http://localhost:5180` in the browser (cmux browser surface, or the claude-in-chrome MCP) and take a screenshot so the user sees it loaded.
3. Orient the user on the loop, briefly: browse effects -> add layers to the stack -> tune params live -> **Copy embed** (the code-xml button in the top bar) -> paste the snippet back here and ask to retrofit it.

Do not rebuild or edit tilt-lab source just to launch it. Only build (`npm run build`) when the runtime bundle is stale (see below).

## 2. Retrofit a tilt-lab export

When the user pastes a tilt-lab export, it is one of two things:

- An **embed snippet** (HTML block with an inline config + a `<script>` that calls `mountStack`). This is the self-contained form from the **Copy embed** button. Prefer this.
- A **stack config JSON** (`{"format":"tilt-lab/stack","version":1,"layers":[...]}`) from the Copy/Download config button. A recipe, not runnable on its own.

### The retrofit contract (do not deviate)

1. **Vendor the runtime, never reimplement the effect.** Copy `tilt-lab/dist/tilt-runtime.js` into the target project and serve it (e.g. at `./tilt-runtime.js`). The fidelity guarantee ("what you saw is what renders") only holds when the same runtime renders it. Do NOT read the `effectId` and hand-write the shader - that drifts from the preview and defeats the export.
2. **Mount via `mountStack`.** The runtime exports `mountStack(host, config, opts?)`. Given a host element and the stack config, it composites the layers and runs the animation loop, honoring `prefers-reduced-motion` (paints one static frame instead of looping). It returns a disposer - call it on teardown (e.g. React effect cleanup, component unmount).
3. **Position as a background.** The host fills its positioned parent: `position:absolute; inset:0; z-index:0; pointer-events:none` (drop `pointer-events:none` only if the stack has an interactive pointer effect the user wants live). Give the parent `position:relative` and render the real content at `z-index:1` or above so it sits over the effect.
4. **Honor reduced-motion.** `mountStack` already guards it; do not bypass with `respectReducedMotion:false` unless the user explicitly asks for always-on motion.
5. **Match the host's tokens.** Size, radius, and any overlay/scrim should use the target project's design tokens, not hard-coded values.

### Embed-snippet shape (for reference)

The Copy-embed button emits exactly this (a classic `<script>`, because `document.currentScript` is null in ES modules):

```html
<div class="tilt-bg" style="position:absolute; inset:0; z-index:0; pointer-events:none; overflow:hidden"></div>
<script>
  (function () {
    var host = document.currentScript.previousElementSibling;
    var config = { "format": "tilt-lab/stack", "version": 1, "layers": [ /* ... */ ] };
    import("./tilt-runtime.js").then(function (m) { m.mountStack(host, config); });
  })();
</script>
```

For a framework target (React/Vue/Svelte), translate this: a ref'd host div, `import { mountStack } from '<runtime path>'`, call it in a mount effect with the config object, and call the returned disposer on cleanup.

### Refresh the bundle if stale

If `mountStack` is missing from `tilt-lab/dist/tilt-runtime.js`, or effects were changed, rebuild it:

```bash
cd tilt-lab && npm run build
```

This regenerates `dist/tilt-runtime.js` (ESM, assets inlined as data URLs - fully self-contained).

## Verify before reporting done

A retrofit is a UI change: serve the target, screenshot it, and confirm the effect renders behind the content (not covering it, not clipped, content legible). Per the project verification protocol, do not report completion without a screenshot you have looked at.
