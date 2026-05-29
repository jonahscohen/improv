# tilt-lab Acquisition Implementation Plan (Plan 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. The acquisition phase (Task 5) is a TEAM fan-out, one agent per lane, executed via the cmux agent-teams flow (TeamCreate + named teammates + shared TaskList), NOT run_in_background subagents.

**Goal:** Normalize the ~20-22 recon'd effects into the Plan-1 `Effect` contract: extend the contract for non-frame-driven effects, extract shared primitives, then fan out one agent per source lane to write `runtime/effects/<id>/{index.ts, manifest.json}` + a conformance test, registering each in `effectFactories`.

**Architecture:** Tasks 1-4 are code-complete, sequential, and unblock the fan-out: a backward-compatible contract addendum (optional `onPointer` + shared pointer state + a `mount(host)` DOM escape hatch), runtime renderer deps (three, ogl), and the shared Stam fluid solver. Task 5 is the parallel acquisition: each lane agent reads its recon report at `docs/superpowers/tilt-lab-recon/lane-*.md` and produces contract-conforming effects. Task 6 registers, builds, and verifies a multi-layer composite.

**Tech Stack:** TypeScript, the Plan-1 runtime, Vitest + happy-dom, esbuild. New runtime deps: `three`, `ogl`. Recon source: `docs/superpowers/tilt-lab-recon/` (10 reports, 5293 lines).

**Depends on:** Plan 1 (foundation, complete). Recon (complete). Independent of Plan 3 (UI).

**Grounding decisions:** see beats `session_2026-05-29_tilt-lab-recon-synthesis.md` (driver-kind taxonomy, license reconciliation, dedup, out-of-scope, shared primitives) and `session_2026-05-29_tilt-lab-pointer-contract-gap.md`.

---

## Effect inventory (canonical set after dedup + scope)

| id | lane | role | driver | redistribution | renderer |
|---|---|---|---|---|---|
| fluid | 1 | background | frame | ok | raw WebGL1 |
| mesh-gradient | 1 | background | frame | ok | three |
| halftone | 1 | post | frame | ok | three + fluid-solver |
| fractal-glass | 1 | post | frame | ok | three + fluid-solver |
| swarm | 1 | midground | frame | ok | Canvas2D |
| grain-gradient | 2 | background | frame | ok | WebGL2 (asset: noise) |
| neuro-noise | 2 | background | frame | ok | WebGL2 |
| swirl | 2 | background | frame | ok | WebGL2 (canonical; spell lane 3 is a dup, skip) |
| globe | 4 | midground | frame (cobe@2 update) | ok | cobe (asset: land) |
| particles | 5 | midground | frame | reimplemented | three |
| cursor-trail | 6 | pointer | pointer/DOM | personal-only | DOM (mount host, assets: items) |
| aurora | 7 | background | frame | personal-only | three (R3F shader ported) |
| dithered-image | 8a | post | frame | ok (MIT) | OGL (image-input caveat) |
| halo | 8a | background | frame | ok (MIT) | OGL |
| fake-3d-image | 8a | background+pointer | frame+pointer | ok (MIT) | OGL (asset: image) |
| interactive-grid | 8b | background | frame+pointer | ok (MIT) | OGL |
| lava-lamp | 8b | background | frame | ok (MIT) | OGL |
| plasma-grid | 8b | background | frame | ok (MIT) | OGL |
| specular-band | 8b | background | frame | ok (MIT) | OGL |
| water-ripple | 8b | post | frame | ok (MIT) | OGL |
| ascii | 9 | post | frame | reimplemented | Canvas2D |

Skipped: spell animated-gradient (dup of swirl), motion-core globe (dup of cobe), motion-core neural-noise (dup of neuro-noise; if visibly distinct, keep as `neural-noise`), motion-core glass-slideshow + infinite-gallery (out-of-scope content widgets; salvage shaders as primitives only).

---

### Task 1: Contract addendum for pointer + DOM effects

**Files:**
- Modify: `tilt-lab/runtime/types.ts`
- Create: `tilt-lab/runtime/pointer.ts`
- Test: `tilt-lab/runtime/pointer.test.ts`
- Modify: `tilt-lab/runtime/element.ts`

- [ ] **Step 1: Extend the Effect interface in `types.ts`** (append optional members; existing effects remain valid)

```ts
export interface Effect {
  init(canvas: HTMLCanvasElement, opts: EffectOpts): void;
  frame(t: number): void;
  resize(w: number, h: number): void;
  setParam(key: string, value: unknown): void;
  dispose(): void;
  /** Optional: pointer-driven effects receive pointer moves (canvas coords). */
  onPointer?(x: number, y: number): void;
  /** Optional: DOM/R3F effects render into a host subtree instead of the canvas. */
  mount?(host: HTMLElement, opts: EffectOpts): void;
}
```

- [ ] **Step 2: Write the failing test for shared pointer tracking**

```ts
import { describe, it, expect } from 'vitest';
import { PointerTracker } from './pointer';

describe('PointerTracker', () => {
  it('reports the latest position in element-relative coords', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 10, top: 20, width: 100, height: 100 }),
    });
    const t = new PointerTracker(el);
    el.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 70 }));
    expect(t.position()).toEqual({ x: 50, y: 50 });
    t.dispose();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd tilt-lab && npx vitest run runtime/pointer.test.ts`
Expected: FAIL, "Failed to resolve import './pointer'".

- [ ] **Step 4: Write `tilt-lab/runtime/pointer.ts`**

```ts
export interface PointerPos {
  x: number;
  y: number;
}

/** Tracks the latest pointer position relative to a host element. */
export class PointerTracker {
  private pos: PointerPos = { x: 0, y: 0 };
  private handler = (e: Event) => {
    const me = e as MouseEvent;
    const rect = this.host.getBoundingClientRect();
    this.pos = { x: me.clientX - rect.left, y: me.clientY - rect.top };
  };

  constructor(private host: HTMLElement) {
    host.addEventListener('pointermove', this.handler);
  }

  position(): PointerPos {
    return this.pos;
  }

  dispose(): void {
    this.host.removeEventListener('pointermove', this.handler);
  }
}
```

- [ ] **Step 5: Wire pointer + mount into the wrapper** in `element.ts` `connectedCallback`, after `this.effect.init(...)`:

```ts
// after init(): support DOM-mount effects and pointer effects
if (this.effect.mount) {
  this.effect.mount(this, { params, assets: {} });
}
if (this.effect.onPointer) {
  this.pointer = new PointerTracker(this);
  this.pointerLoop = () => {
    const p = this.pointer!.position();
    this.effect.onPointer!(p.x, p.y);
  };
}
```
Add `import { PointerTracker } from './pointer';`, fields `private pointer?: PointerTracker;` and `private pointerLoop?: () => void;`, call `this.pointerLoop?.()` inside the `loop` before `frame`, and in `disconnectedCallback` add `this.pointer?.dispose();`.

- [ ] **Step 6: Run the full runtime suite (no regression)**

Run: `cd tilt-lab && npx vitest run runtime && npx tsc --noEmit`
Expected: 25 tests pass (24 prior + 1 pointer), tsc exit 0.

- [ ] **Step 7: Commit**

```bash
git add tilt-lab/runtime/types.ts tilt-lab/runtime/pointer.ts tilt-lab/runtime/pointer.test.ts tilt-lab/runtime/element.ts
git commit -m "feat(tilt-lab): contract addendum - optional onPointer + mount(host)"
```

---

### Task 2: Add renderer dependencies

**Files:**
- Modify: `tilt-lab/package.json`

- [ ] **Step 1: Add to `dependencies`** (create the block if absent)

```json
"dependencies": {
  "three": "^0.170.0",
  "ogl": "^1.0.11",
  "cobe": "^0.6.3"
}
```

- [ ] **Step 2: Install**

Run: `cd tilt-lab && npm install`
Expected: three, ogl, cobe present in node_modules, exit 0.

- [ ] **Step 3: Confirm esbuild can bundle a three import** (smoke; no commit yet)

Run: `cd tilt-lab && node -e "require('esbuild').buildSync({entryPoints:[],write:false})" 2>/dev/null; echo deps-ready`
Expected: prints `deps-ready` (the real bundle check happens in Task 6).

- [ ] **Step 4: Commit**

```bash
git add tilt-lab/package.json tilt-lab/package-lock.json
git commit -m "chore(tilt-lab): add three, ogl, cobe renderer deps"
```

---

### Task 3: Shared Stam fluid solver primitive

**Files:**
- Create: `tilt-lab/runtime/lib/fluid-solver.ts`
- Test: `tilt-lab/runtime/lib/fluid-solver.test.ts`

The recon reports for regent halftone + fractal-glass share one Stam-style fluid solver. Extract it once. The acquisition agents for those two effects import this instead of duplicating it. Port the solver verbatim from `docs/superpowers/tilt-lab-recon/lane-1-regent.md`.

- [ ] **Step 1: Write the failing test** (the solver step advances a velocity field deterministically)

```ts
import { describe, it, expect } from 'vitest';
import { createFluidSolver } from './fluid-solver';

describe('createFluidSolver', () => {
  it('produces a solver with the documented public surface', () => {
    const s = createFluidSolver({ size: 16 });
    expect(typeof s.step).toBe('function');
    expect(typeof s.addForce).toBe('function');
    expect(typeof s.dispose).toBe('function');
  });

  it('step advances without throwing on a fresh field', () => {
    const s = createFluidSolver({ size: 16 });
    s.addForce(8, 8, 1, 0);
    expect(() => s.step(0.016)).not.toThrow();
    s.dispose();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tilt-lab && npx vitest run runtime/lib/fluid-solver.test.ts`
Expected: FAIL, "Failed to resolve import './fluid-solver'".

- [ ] **Step 3: Port the solver** from the lane-1 recon report into `tilt-lab/runtime/lib/fluid-solver.ts`, exposing:

```ts
export interface FluidSolverOptions { size: number; }
export interface FluidSolver {
  step(dt: number): void;
  addForce(x: number, y: number, dx: number, dy: number): void;
  density(): Float32Array;
  dispose(): void;
}
export function createFluidSolver(opts: FluidSolverOptions): FluidSolver { /* verbatim Stam solver from lane-1 report */ }
```
(Implementation is the verbatim advect/diffuse/project Stam routine captured in `lane-1-regent.md`. Keep it CPU/Float32Array-based so it is unit-testable; the GL upload of `density()` happens in the consuming effect.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tilt-lab && npx vitest run runtime/lib/fluid-solver.test.ts`
Expected: PASS, 2 tests green.

- [ ] **Step 5: Commit**

```bash
git add tilt-lab/runtime/lib/fluid-solver.ts tilt-lab/runtime/lib/fluid-solver.test.ts
git commit -m "feat(tilt-lab): shared Stam fluid solver primitive"
```

---

### Task 4: Acquisition conformance-test template

**Files:**
- Create: `tilt-lab/runtime/effects/_TEMPLATE.test.ts.md`

This is the contract every acquired effect's test must satisfy. It is documentation (`.md`) so it does not run; each lane agent copies it into `runtime/effects/<id>/index.test.ts` and fills the id.

- [ ] **Step 1: Write `tilt-lab/runtime/effects/_TEMPLATE.test.ts.md`**

````markdown
Every acquired effect MUST ship `index.test.ts` proving contract conformance:

```ts
import { describe, it, expect } from 'vitest';
import { create<Name>Effect } from './index';
import manifest from './manifest.json';
import { validateManifest } from '../../manifest';

describe('<id> effect', () => {
  it('has a valid manifest', () => {
    expect(() => validateManifest(manifest)).not.toThrow();
  });
  it('init + resize + frame run without throwing', () => {
    const e = create<Name>Effect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    e.resize(64, 64);
    expect(() => e.frame(16)).not.toThrow();
  });
  it('dispose is idempotent', () => {
    const e = create<Name>Effect();
    const canvas = document.createElement('canvas');
    const params = Object.fromEntries(manifest.params.map((p) => [p.name, p.default]));
    e.init(canvas, { params, assets: {} });
    expect(() => { e.dispose(); e.dispose(); }).not.toThrow();
  });
});
```

WebGL/three/OGL effects: guard `frame` so it no-ops when the GL context is unavailable (happy-dom has no real WebGL), e.g. `if (!this.gl) return;`. The test asserts no-throw, so a guarded effect passes headlessly; real rendering is verified visually via cmux in Plan 3.
````

- [ ] **Step 2: Commit**

```bash
git add tilt-lab/runtime/effects/_TEMPLATE.test.ts.md
git commit -m "docs(tilt-lab): acquisition conformance-test template"
```

---

### Task 5: Acquisition fan-out (TEAM)

This is the parallel phase. Create a `tilt-acquire` team and one task per lane in the shared TaskList. Each lane agent:

1. Reads `docs/superpowers/tilt-lab-recon/RECON-BRIEF.md` (the contract) + its lane report `docs/superpowers/tilt-lab-recon/lane-<N>-*.md` + `tilt-lab/runtime/effects/gradient/` (the reference template) + `tilt-lab/runtime/effects/_TEMPLATE.test.ts.md`.
2. For each canonical effect in its lane (per the inventory table above; skip dups/out-of-scope), creates `tilt-lab/runtime/effects/<id>/index.ts` (a `create<Name>Effect(): Effect` factory porting the verbatim recon source, using the chosen renderer dep, guarding `frame` when GL is unavailable, honoring the driver kind via `frame`/`onPointer`/`mount`), `tilt-lab/runtime/effects/<id>/manifest.json` (with the correct `layerRole`, `redistribution`, `requiredAssets`, and params from the report), and `index.test.ts` (from the template).
3. halftone + fractal-glass import `runtime/lib/fluid-solver`.
4. Runs `npx vitest run runtime/effects/<id>` and confirms green before marking its task complete.
5. Does NOT edit `runtime/index.ts` (the shared registry) to avoid write conflicts; registration is centralized in Task 6.

**Lane tasks (one per row, assigned in the cmux team flow):**

- [ ] Lane 1 (regent): fluid, mesh-gradient, halftone, fractal-glass, swarm
- [ ] Lane 2 (paper): grain-gradient, neuro-noise, swirl
- [ ] Lane 4 (cobe): globe (use cobe@2 `update()` driven by frame(t))
- [ ] Lane 5 (casberry): particles
- [ ] Lane 6 (unlumen): cursor-trail (DOM via `mount` + `onPointer`)
- [ ] Lane 7 (unlumen): aurora (port R3F shader to a plain three or raw-GL fullscreen quad)
- [ ] Lane 8a (motion-core): dithered-image, halo, fake-3d-image
- [ ] Lane 8b (motion-core): interactive-grid, lava-lamp, plasma-grid, specular-band, water-ripple, neural-noise (only if visibly distinct from neuro-noise)
- [ ] Lane 9 (ascii-magic): ascii

Each lane agent commits its own effect dirs (one commit per effect or per lane) with a beat note. The team lead reviews each completed lane (spot-check manifest validity + test green) before the next.

---

### Task 6: Central registration + integration verification

**Files:**
- Modify: `tilt-lab/runtime/index.ts`
- Test: `tilt-lab/runtime/integration.test.ts`

- [ ] **Step 1: Register every acquired effect in `runtime/index.ts`** by importing each factory + manifest and adding to `effectFactories` and `registerBuiltins()`. Follow the existing gradient pattern exactly, one entry per effect in the inventory table.

- [ ] **Step 2: Write the integration test**

```ts
import { describe, it, expect } from 'vitest';
import { registerBuiltins, effectFactories } from './index';
import { Compositor } from './compositor';
import type { Effect, LayerConfig } from './types';

describe('acquired effects integration', () => {
  it('registers a tilt-{id} element for every factory', () => {
    registerBuiltins();
    for (const id of Object.keys(effectFactories)) {
      expect(customElements.get(`tilt-${id}`), `tilt-${id}`).toBeDefined();
    }
  });

  it('composites a valid background+midground+post stack without throwing', () => {
    const root = document.createElement('div');
    const c = new Compositor(root, (id): Effect => effectFactories[id]());
    const layers: LayerConfig[] = [
      { effectId: 'gradient', layerRole: 'background', params: {}, blendMode: 'source-over' },
      { effectId: 'swarm', layerRole: 'midground', params: {}, blendMode: 'source-over' },
      { effectId: 'ascii', layerRole: 'post', params: {}, blendMode: 'source-over' },
    ];
    expect(() => { c.setLayers(layers); c.renderFrame(16); c.clear(); }).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the full suite + typecheck + build**

Run: `cd tilt-lab && npx vitest run && npx tsc --noEmit && node build.js`
Expected: all tests pass, tsc exit 0, `dist/tilt-runtime.js` written.

- [ ] **Step 4: Bundle smoke test**

Run the Plan-1 Task-9 happy-dom subprocess smoke, asserting `customElements.get('tilt-aurora')` (and a sample of others) are `true`.

- [ ] **Step 5: Commit**

```bash
git add tilt-lab/runtime/index.ts tilt-lab/runtime/integration.test.ts
git commit -m "feat(tilt-lab): register acquired effects + integration verification"
```

---

## Self-Review

- **Spec coverage:** the spec's "acquisition of the nine sources" is Task 5; the manifest/contract normalization is Tasks 1+5; shared-primitive extraction (spec note) is Task 3; license/redistribution metadata is captured per-effect in Task 5 per the synthesis reconciliation. Dedup + out-of-scope decisions are encoded in the inventory table.
- **Type consistency:** the `Effect` addendum (`onPointer?`, `mount?`) is optional, so the Plan-1 effects and tests stay valid (verified in Task 1 Step 6). `effectFactories`, `registerBuiltins`, `Compositor`, `validateManifest` reused from Plan 1 with identical signatures. `create<Name>Effect` factory naming is consistent with `createGradientEffect`.
- **Placeholders:** the per-effect implementation is intentionally not inlined - it is ported verbatim from named recon report files by the lane agents, which is the correct source of truth (the plan cannot duplicate 5293 lines of captured source). Every code-complete task (1, 3, 4, 6) has full code.
- **Team discipline:** Task 5 explicitly uses the cmux agent-teams flow and centralizes registry edits in Task 6 to avoid parallel write conflicts on `runtime/index.ts`.
