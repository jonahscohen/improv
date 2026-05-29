# tilt-lab Playground UI Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tilt-lab playground UI: a Vite + React app that browses the effect catalog, previews a live composited layer stack, lets the user add/remove/reorder/tune layers with compatibility enforcement, and exposes project-picker + add-shader entry points (wired to the server in Plan 4).

**Architecture:** A Vite + React + TS app under `tilt-lab/app/`. All non-visual logic lives in framework-free, unit-tested modules: a catalog loader (globs effect manifests), a `stackStore` reducer (add/remove/reorder/setParam, gated by the runtime's `validateStack`), and manifest-driven param-control rendering. React components are thin views over that logic. The live preview mounts the runtime `Compositor` from Plan 1. Visual correctness is verified with cmux screenshots and the sidecoach QA gate, not asserted in unit tests.

**Tech Stack:** Vite, React 19, TypeScript, Vitest + @testing-library/react (jsdom), the tilt-lab runtime from Plan 1.

**Depends on:** Plan 1 (foundation) - complete. Independent of Plan 2 (acquisition): the UI is catalog-driven, so it shows whatever effects exist. With only the gradient reference effect present, the UI is fully exercisable.

---

## File Structure

```
tilt-lab/
  app/
    index.html
    vite.config.ts
    src/
      main.tsx                 React entry, registerBuiltins(), mount <App/>
      App.tsx                  layout shell (top bar, browse, preview, layer stack)
      state/
        catalog.ts             loadCatalog(): Manifest[] via import.meta.glob
        catalog.test.ts
        stackStore.ts          createStackStore(): add/remove/reorder/setParam + validity
        stackStore.test.ts
      components/
        TopBar.tsx             project picker slot, Send, Add shader buttons
        BrowseGrid.tsx         filter/search + effect cards
        BrowseGrid.test.tsx
        PreviewCanvas.tsx      mounts Compositor, RAF loop, reflects store
        LayerStack.tsx         add/remove/reorder + compatibility hint
        ParamControls.tsx      manifest-driven control rendering
        ParamControls.test.tsx
        AddShaderModal.tsx     paste GLSL / module / URL (UI only; save in Plan 4)
        ProjectPicker.tsx      dropdown (data from Plan 4 server; stubbed here)
```

Logic modules (`catalog`, `stackStore`) and the manifest-to-control mapping are unit-tested. Components that are pure rendering over those (TopBar, PreviewCanvas, LayerStack, AddShaderModal, ProjectPicker) are verified visually via cmux.

---

### Task 1: Add Vite + React tooling

**Files:**
- Modify: `tilt-lab/package.json`
- Create: `tilt-lab/app/vite.config.ts`
- Create: `tilt-lab/app/index.html`

- [ ] **Step 1: Add deps + scripts to `tilt-lab/package.json`**

Add to `devDependencies`:
```json
"@testing-library/react": "^16.0.0",
"@types/react": "^19.0.0",
"@types/react-dom": "^19.0.0",
"@vitejs/plugin-react": "^4.3.0",
"jsdom": "^25.0.0",
"react": "^19.0.0",
"react-dom": "^19.0.0",
"vite": "^6.0.0"
```
Add to `scripts`:
```json
"dev": "vite app --port 5180",
"build:app": "vite build app"
```

- [ ] **Step 2: Create `tilt-lab/app/vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'app',
  plugins: [react()],
  server: { port: 5180 },
  build: { outDir: '../dist/app', emptyOutDir: true },
});
```

- [ ] **Step 3: Create `tilt-lab/app/index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>tilt-lab</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Install**

Run: `cd tilt-lab && npm install`
Expected: react, vite, testing-library installed, exit 0.

- [ ] **Step 5: Update vitest config to allow jsdom for app tests**

Replace `tilt-lab/vitest.config.ts` with:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['runtime/**/*.test.ts', 'app/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['app/**', 'jsdom']],
  },
});
```

- [ ] **Step 6: Verify the runtime suite still passes**

Run: `cd tilt-lab && npx vitest run runtime`
Expected: 24 tests pass (no regression).

- [ ] **Step 7: Commit**

```bash
git add tilt-lab/package.json tilt-lab/app/vite.config.ts tilt-lab/app/index.html tilt-lab/vitest.config.ts
git commit -m "chore(tilt-lab): add vite + react app tooling"
```

---

### Task 2: Catalog loader

**Files:**
- Create: `tilt-lab/app/src/state/catalog.ts`
- Test: `tilt-lab/app/src/state/catalog.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { filterCatalog } from './catalog';
import type { Manifest } from '../../../runtime/types';

const m = (id: string, role: Manifest['layerRole'], tags: string[]): Manifest => ({
  id, name: id, category: role, layerRole: role, params: [],
  requiredAssets: [], origin: 'x', license: 'MIT', attribution: 'x',
  redistribution: 'ok', tags,
});

const catalog = [m('grad', 'background', ['gradient']), m('globe', 'midground', ['3d']), m('ascii', 'post', ['retro'])];

describe('filterCatalog', () => {
  it('returns all with no filters', () => {
    expect(filterCatalog(catalog, { query: '', role: null }).length).toBe(3);
  });
  it('filters by layer role', () => {
    const r = filterCatalog(catalog, { query: '', role: 'post' });
    expect(r.map((x) => x.id)).toEqual(['ascii']);
  });
  it('filters by case-insensitive query over name + tags', () => {
    expect(filterCatalog(catalog, { query: 'GRAD', role: null }).map((x) => x.id)).toEqual(['grad']);
    expect(filterCatalog(catalog, { query: '3d', role: null }).map((x) => x.id)).toEqual(['globe']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tilt-lab && npx vitest run app/src/state/catalog.test.ts`
Expected: FAIL, "Failed to resolve import './catalog'".

- [ ] **Step 3: Write minimal implementation**

```ts
import { validateManifest } from '../../../runtime/manifest';
import type { Manifest, LayerRole } from '../../../runtime/types';

export interface CatalogFilter {
  query: string;
  role: LayerRole | null;
}

/** Loads every effect manifest at build time via Vite's glob import. */
export function loadCatalog(): Manifest[] {
  const mods = import.meta.glob('../../../runtime/effects/*/manifest.json', {
    eager: true,
  }) as Record<string, { default: unknown }>;
  return Object.values(mods).map((mod) => validateManifest(mod.default));
}

export function filterCatalog(catalog: Manifest[], filter: CatalogFilter): Manifest[] {
  const q = filter.query.trim().toLowerCase();
  return catalog.filter((m) => {
    if (filter.role && m.layerRole !== filter.role) return false;
    if (!q) return true;
    const haystack = [m.name, m.id, ...m.tags].join(' ').toLowerCase();
    return haystack.includes(q);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tilt-lab && npx vitest run app/src/state/catalog.test.ts`
Expected: PASS, 3 tests green.

Note: `loadCatalog` uses `import.meta.glob` (Vite-only) so it is not unit-tested directly; `filterCatalog` carries the testable logic. `loadCatalog` is exercised at runtime in the browser and verified via cmux in Task 9.

- [ ] **Step 5: Commit**

```bash
git add tilt-lab/app/src/state/catalog.ts tilt-lab/app/src/state/catalog.test.ts
git commit -m "feat(tilt-lab): catalog loader + filter"
```

---

### Task 3: Stack store

**Files:**
- Create: `tilt-lab/app/src/state/stackStore.ts`
- Test: `tilt-lab/app/src/state/stackStore.test.ts`

The store holds the working layer stack and enforces validity using the runtime's `validateStack`. An add that would violate a rule is rejected, returning the reason.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { createStackStore } from './stackStore';
import type { Manifest } from '../../../runtime/types';

const m = (id: string, role: Manifest['layerRole']): Manifest => ({
  id, name: id, category: role, layerRole: role,
  params: [{ name: 'speed', type: 'range', default: 1, min: 0, max: 5 }],
  requiredAssets: [], origin: 'x', license: 'MIT', attribution: 'x',
  redistribution: 'ok', tags: [],
});

describe('createStackStore', () => {
  it('adds a layer and exposes it', () => {
    const s = createStackStore();
    const res = s.add(m('grad', 'background'));
    expect(res.ok).toBe(true);
    expect(s.layers().map((l) => l.effectId)).toEqual(['grad']);
  });

  it('seeds default params on add', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    expect(s.layers()[0].params.speed).toBe(1);
  });

  it('rejects a second background with a reason', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    const res = s.add(m('aurora', 'background'));
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/background/);
    expect(s.layers().length).toBe(1);
  });

  it('removes a layer by index', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    s.add(m('globe', 'midground'));
    s.remove(0);
    expect(s.layers().map((l) => l.effectId)).toEqual(['globe']);
  });

  it('setParam updates a layer param', () => {
    const s = createStackStore();
    s.add(m('grad', 'background'));
    s.setParam(0, 'speed', 3);
    expect(s.layers()[0].params.speed).toBe(3);
  });

  it('notifies subscribers on change', () => {
    const s = createStackStore();
    let calls = 0;
    s.subscribe(() => { calls += 1; });
    s.add(m('grad', 'background'));
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tilt-lab && npx vitest run app/src/state/stackStore.test.ts`
Expected: FAIL, "Failed to resolve import './stackStore'".

- [ ] **Step 3: Write minimal implementation**

```ts
import { validateStack } from '../../../runtime/stack';
import type { LayerConfig, Manifest } from '../../../runtime/types';

export interface AddResult {
  ok: boolean;
  reason?: string;
}

export interface StackStore {
  layers(): LayerConfig[];
  add(manifest: Manifest): AddResult;
  remove(index: number): void;
  reorder(from: number, to: number): void;
  setParam(index: number, key: string, value: unknown): void;
  subscribe(fn: () => void): () => void;
}

function defaultParams(manifest: Manifest): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of manifest.params) out[p.name] = p.default;
  return out;
}

export function createStackStore(): StackStore {
  let layers: LayerConfig[] = [];
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((fn) => fn());

  return {
    layers: () => layers,
    add(manifest) {
      const candidate: LayerConfig = {
        effectId: manifest.id,
        layerRole: manifest.layerRole,
        params: defaultParams(manifest),
        blendMode: 'source-over',
      };
      const validity = validateStack([...layers, candidate]);
      if (!validity.valid) return { ok: false, reason: validity.reason };
      layers = [...layers, candidate];
      notify();
      return { ok: true };
    },
    remove(index) {
      layers = layers.filter((_, i) => i !== index);
      notify();
    },
    reorder(from, to) {
      const next = [...layers];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      layers = next;
      notify();
    },
    setParam(index, key, value) {
      layers = layers.map((l, i) =>
        i === index ? { ...l, params: { ...l.params, [key]: value } } : l,
      );
      notify();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tilt-lab && npx vitest run app/src/state/stackStore.test.ts`
Expected: PASS, 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add tilt-lab/app/src/state/stackStore.ts tilt-lab/app/src/state/stackStore.test.ts
git commit -m "feat(tilt-lab): stack store with validity-gated add"
```

---

### Task 4: Manifest-driven param controls

**Files:**
- Create: `tilt-lab/app/src/components/ParamControls.tsx`
- Test: `tilt-lab/app/src/components/ParamControls.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ParamControls } from './ParamControls';
import type { ParamSpec } from '../../../runtime/types';

const specs: ParamSpec[] = [
  { name: 'speed', type: 'range', default: 1, min: 0, max: 5, step: 0.5 },
  { name: 'colorA', type: 'color', default: '#ff0000' },
  { name: 'loop', type: 'toggle', default: true },
];

describe('ParamControls', () => {
  it('renders a labelled control per spec', () => {
    render(<ParamControls specs={specs} values={{ speed: 1, colorA: '#ff0000', loop: true }} onChange={() => {}} />);
    expect(screen.getByLabelText('speed')).toBeTruthy();
    expect(screen.getByLabelText('colorA')).toBeTruthy();
    expect(screen.getByLabelText('loop')).toBeTruthy();
  });

  it('emits onChange with coerced numeric value for a range', () => {
    const onChange = vi.fn();
    render(<ParamControls specs={specs} values={{ speed: 1, colorA: '#ff0000', loop: true }} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('speed'), { target: { value: '3.5' } });
    expect(onChange).toHaveBeenCalledWith('speed', 3.5);
  });

  it('emits onChange with boolean for a toggle', () => {
    const onChange = vi.fn();
    render(<ParamControls specs={specs} values={{ speed: 1, colorA: '#ff0000', loop: true }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('loop'));
    expect(onChange).toHaveBeenCalledWith('loop', false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tilt-lab && npx vitest run app/src/components/ParamControls.test.tsx`
Expected: FAIL, "Failed to resolve import './ParamControls'".

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ParamSpec } from '../../../runtime/types';

interface Props {
  specs: ParamSpec[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function ParamControls({ specs, values, onChange }: Props) {
  return (
    <div className="param-controls">
      {specs.map((spec) => {
        const value = values[spec.name];
        if (spec.type === 'range') {
          return (
            <label key={spec.name}>
              <span>{spec.name}</span>
              <input
                aria-label={spec.name}
                type="range"
                min={spec.min ?? 0}
                max={spec.max ?? 1}
                step={spec.step ?? 0.01}
                value={Number(value)}
                onChange={(e) => onChange(spec.name, Number(e.target.value))}
              />
            </label>
          );
        }
        if (spec.type === 'color') {
          return (
            <label key={spec.name}>
              <span>{spec.name}</span>
              <input
                aria-label={spec.name}
                type="color"
                value={String(value)}
                onChange={(e) => onChange(spec.name, e.target.value)}
              />
            </label>
          );
        }
        if (spec.type === 'toggle') {
          return (
            <label key={spec.name}>
              <span>{spec.name}</span>
              <input
                aria-label={spec.name}
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(spec.name, e.target.checked)}
              />
            </label>
          );
        }
        return (
          <label key={spec.name}>
            <span>{spec.name}</span>
            <select
              aria-label={spec.name}
              value={String(value)}
              onChange={(e) => onChange(spec.name, e.target.value)}
            >
              {(spec.options ?? []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tilt-lab && npx vitest run app/src/components/ParamControls.test.tsx`
Expected: PASS, 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add tilt-lab/app/src/components/ParamControls.tsx tilt-lab/app/src/components/ParamControls.test.tsx
git commit -m "feat(tilt-lab): manifest-driven param controls"
```

---

### Task 5: BrowseGrid

**Files:**
- Create: `tilt-lab/app/src/components/BrowseGrid.tsx`
- Test: `tilt-lab/app/src/components/BrowseGrid.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowseGrid } from './BrowseGrid';
import type { Manifest } from '../../../runtime/types';

const m = (id: string, role: Manifest['layerRole']): Manifest => ({
  id, name: id, category: role, layerRole: role, params: [],
  requiredAssets: [], origin: 'x', license: 'MIT', attribution: 'x',
  redistribution: 'ok', tags: [],
});
const catalog = [m('grad', 'background'), m('globe', 'midground')];

describe('BrowseGrid', () => {
  it('renders a card per catalog entry', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    expect(screen.getByText('grad')).toBeTruthy();
    expect(screen.getByText('globe')).toBeTruthy();
  });

  it('calls onPick with the manifest when a card is clicked', () => {
    const onPick = vi.fn();
    render(<BrowseGrid catalog={catalog} onPick={onPick} />);
    fireEvent.click(screen.getByText('grad'));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: 'grad' }));
  });

  it('filters by search query', () => {
    render(<BrowseGrid catalog={catalog} onPick={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Search effects'), { target: { value: 'globe' } });
    expect(screen.queryByText('grad')).toBeNull();
    expect(screen.getByText('globe')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd tilt-lab && npx vitest run app/src/components/BrowseGrid.test.tsx`
Expected: FAIL, "Failed to resolve import './BrowseGrid'".

- [ ] **Step 3: Write minimal implementation**

```tsx
import { useState } from 'react';
import type { LayerRole, Manifest } from '../../../runtime/types';
import { filterCatalog } from '../state/catalog';

interface Props {
  catalog: Manifest[];
  onPick: (manifest: Manifest) => void;
}

const ROLES: LayerRole[] = ['background', 'midground', 'pointer', 'post'];

export function BrowseGrid({ catalog, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<LayerRole | null>(null);
  const shown = filterCatalog(catalog, { query, role });

  return (
    <div className="browse-grid">
      <div className="browse-grid__filters">
        <input
          placeholder="Search effects"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="browse-grid__roles">
          <button data-active={role === null} onClick={() => setRole(null)}>all</button>
          {ROLES.map((r) => (
            <button key={r} data-active={role === r} onClick={() => setRole(r)}>{r}</button>
          ))}
        </div>
      </div>
      <ul className="browse-grid__cards">
        {shown.map((mft) => (
          <li key={mft.id}>
            <button className="browse-grid__card" onClick={() => onPick(mft)}>
              <span className="browse-grid__card-name">{mft.name}</span>
              <span className="browse-grid__card-role">{mft.layerRole}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd tilt-lab && npx vitest run app/src/components/BrowseGrid.test.tsx`
Expected: PASS, 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add tilt-lab/app/src/components/BrowseGrid.tsx tilt-lab/app/src/components/BrowseGrid.test.tsx
git commit -m "feat(tilt-lab): browse grid with search + role filter"
```

---

### Task 6: PreviewCanvas (mounts the runtime Compositor)

**Files:**
- Create: `tilt-lab/app/src/components/PreviewCanvas.tsx`

This component bridges React to the framework-free runtime. It owns a `Compositor`, re-calls `setLayers` when the store changes, and runs the RAF loop. No unit test (it is glue over the already-tested Compositor); verified via cmux in Task 9.

- [ ] **Step 1: Write `tilt-lab/app/src/components/PreviewCanvas.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Compositor } from '../../../runtime/compositor';
import { effectFactories } from '../../../runtime/index';
import type { Effect, LayerConfig } from '../../../runtime/types';

interface Props {
  layers: LayerConfig[];
}

export function PreviewCanvas({ layers }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const compRef = useRef<Compositor | null>(null);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!hostRef.current) return;
    const comp = new Compositor(hostRef.current, (id): Effect => {
      const factory = effectFactories[id];
      if (!factory) throw new Error(`unknown effect id: ${id}`);
      return factory();
    });
    compRef.current = comp;
    const loop = (t: number) => {
      comp.renderFrame(t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(rafRef.current);
      comp.clear();
    };
  }, []);

  useEffect(() => {
    compRef.current?.setLayers(layers);
  }, [layers]);

  return <div className="preview-canvas" ref={hostRef} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd tilt-lab && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add tilt-lab/app/src/components/PreviewCanvas.tsx
git commit -m "feat(tilt-lab): preview canvas bridging React to the runtime compositor"
```

---

### Task 7: LayerStack, TopBar, ProjectPicker, AddShaderModal (view components)

**Files:**
- Create: `tilt-lab/app/src/components/LayerStack.tsx`
- Create: `tilt-lab/app/src/components/TopBar.tsx`
- Create: `tilt-lab/app/src/components/ProjectPicker.tsx`
- Create: `tilt-lab/app/src/components/AddShaderModal.tsx`

These are rendering views over already-tested logic. Verified via cmux in Task 9. Server-backed behavior (project list, save shader) is stubbed with props/callbacks wired in Plan 4.

- [ ] **Step 1: Write `tilt-lab/app/src/components/LayerStack.tsx`**

```tsx
import type { LayerConfig, Manifest } from '../../../runtime/types';
import { ParamControls } from './ParamControls';

interface Props {
  layers: LayerConfig[];
  catalog: Manifest[];
  lastReason: string | null;
  onRemove: (index: number) => void;
  onReorder: (from: number, to: number) => void;
  onParam: (index: number, key: string, value: unknown) => void;
}

export function LayerStack({ layers, catalog, lastReason, onRemove, onReorder, onParam }: Props) {
  return (
    <div className="layer-stack">
      <h2 className="layer-stack__title">Layers</h2>
      {lastReason && <p className="layer-stack__hint" role="alert">{lastReason}</p>}
      <ol className="layer-stack__list">
        {layers.map((layer, i) => {
          const manifest = catalog.find((m) => m.id === layer.effectId);
          return (
            <li key={`${layer.effectId}-${i}`} className="layer-stack__item">
              <header>
                <span>{manifest?.name ?? layer.effectId}</span>
                <span className="layer-stack__role">{layer.layerRole}</span>
                <button aria-label={`move up ${i}`} disabled={i === 0} onClick={() => onReorder(i, i - 1)}>up</button>
                <button aria-label={`move down ${i}`} disabled={i === layers.length - 1} onClick={() => onReorder(i, i + 1)}>down</button>
                <button aria-label={`remove ${i}`} onClick={() => onRemove(i)}>remove</button>
              </header>
              {manifest && (
                <ParamControls
                  specs={manifest.params}
                  values={layer.params}
                  onChange={(key, value) => onParam(i, key, value)}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Write `tilt-lab/app/src/components/ProjectPicker.tsx`**

```tsx
interface Props {
  projects: string[];
  selected: string | null;
  onSelect: (project: string) => void;
}

export function ProjectPicker({ projects, selected, onSelect }: Props) {
  return (
    <label className="project-picker">
      <span>Project</span>
      <select
        aria-label="target project"
        value={selected ?? ''}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>Select a project</option>
        {projects.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 3: Write `tilt-lab/app/src/components/AddShaderModal.tsx`**

```tsx
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { kind: 'glsl' | 'module' | 'url'; source: string }) => void;
}

export function AddShaderModal({ open, onClose, onSubmit }: Props) {
  const [kind, setKind] = useState<'glsl' | 'module' | 'url'>('glsl');
  const [source, setSource] = useState('');
  if (!open) return null;
  return (
    <div className="add-shader-modal" role="dialog" aria-label="Add shader">
      <div className="add-shader-modal__panel">
        <div className="add-shader-modal__kinds">
          {(['glsl', 'module', 'url'] as const).map((k) => (
            <button key={k} data-active={kind === k} onClick={() => setKind(k)}>{k}</button>
          ))}
        </div>
        <textarea
          aria-label="shader source"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={kind === 'url' ? 'https://...' : 'paste source'}
        />
        <div className="add-shader-modal__actions">
          <button onClick={onClose}>Cancel</button>
          <button onClick={() => onSubmit({ kind, source })} disabled={!source.trim()}>Add</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `tilt-lab/app/src/components/TopBar.tsx`**

```tsx
import { ProjectPicker } from './ProjectPicker';

interface Props {
  projects: string[];
  selectedProject: string | null;
  onSelectProject: (project: string) => void;
  onSend: () => void;
  onAddShader: () => void;
  canSend: boolean;
}

export function TopBar({ projects, selectedProject, onSelectProject, onSend, onAddShader, canSend }: Props) {
  return (
    <header className="top-bar">
      <span className="top-bar__brand">tilt-lab</span>
      <ProjectPicker projects={projects} selected={selectedProject} onSelect={onSelectProject} />
      <button className="top-bar__send" onClick={onSend} disabled={!canSend}>Send to project</button>
      <button className="top-bar__add" onClick={onAddShader}>Add shader</button>
    </header>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `cd tilt-lab && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add tilt-lab/app/src/components/LayerStack.tsx tilt-lab/app/src/components/TopBar.tsx tilt-lab/app/src/components/ProjectPicker.tsx tilt-lab/app/src/components/AddShaderModal.tsx
git commit -m "feat(tilt-lab): layer stack, top bar, project picker, add-shader modal views"
```

---

### Task 8: App shell + entry point

**Files:**
- Create: `tilt-lab/app/src/App.tsx`
- Create: `tilt-lab/app/src/main.tsx`

- [ ] **Step 1: Write `tilt-lab/app/src/App.tsx`**

```tsx
import { useMemo, useState, useSyncExternalStore } from 'react';
import { loadCatalog } from './state/catalog';
import { createStackStore } from './state/stackStore';
import { BrowseGrid } from './components/BrowseGrid';
import { PreviewCanvas } from './components/PreviewCanvas';
import { LayerStack } from './components/LayerStack';
import { TopBar } from './components/TopBar';
import { AddShaderModal } from './components/AddShaderModal';

export function App() {
  const catalog = useMemo(() => loadCatalog(), []);
  const store = useMemo(() => createStackStore(), []);
  const layers = useSyncExternalStore(store.subscribe, store.layers, store.layers);
  const [reason, setReason] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [project, setProject] = useState<string | null>(null);

  return (
    <div className="app">
      <TopBar
        projects={[]}
        selectedProject={project}
        onSelectProject={setProject}
        onSend={() => { /* wired in Plan 4 */ }}
        onAddShader={() => setModalOpen(true)}
        canSend={!!project && layers.length > 0}
      />
      <main className="app__body">
        <aside className="app__browse">
          <BrowseGrid
            catalog={catalog}
            onPick={(m) => {
              const res = store.add(m);
              setReason(res.ok ? null : res.reason ?? 'Cannot add layer.');
            }}
          />
        </aside>
        <section className="app__preview">
          <PreviewCanvas layers={layers} />
        </section>
        <aside className="app__layers">
          <LayerStack
            layers={layers}
            catalog={catalog}
            lastReason={reason}
            onRemove={store.remove}
            onReorder={store.reorder}
            onParam={store.setParam}
          />
        </aside>
      </main>
      <AddShaderModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={() => setModalOpen(false) /* save wired in Plan 4 */}
      />
    </div>
  );
}
```

- [ ] **Step 2: Write `tilt-lab/app/src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerBuiltins } from '../../runtime/index';
import { App } from './App';
import './styles.css';

registerBuiltins();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 3: Create a minimal `tilt-lab/app/src/styles.css`**

```css
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #0b0b0f; color: #e7e7ea; }
.app { display: flex; flex-direction: column; height: 100vh; }
.top-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem 1rem; border-bottom: 1px solid #23232b; }
.top-bar__brand { font-weight: 600; letter-spacing: 0.02em; }
.app__body { flex: 1; display: grid; grid-template-columns: 280px 1fr 320px; min-height: 0; }
.app__browse, .app__layers { overflow-y: auto; padding: 0.75rem; }
.app__browse { border-right: 1px solid #23232b; }
.app__layers { border-left: 1px solid #23232b; }
.app__preview { position: relative; }
.preview-canvas { position: absolute; inset: 0; }
.preview-canvas canvas { width: 100%; height: 100%; display: block; }
.browse-grid__cards { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.5rem; }
.browse-grid__card { width: 100%; text-align: left; padding: 0.6rem; border: 1px solid #2a2a33; border-radius: 8px; background: #14141a; color: inherit; cursor: pointer; display: flex; justify-content: space-between; }
```

- [ ] **Step 4: Typecheck + build the app**

Run: `cd tilt-lab && npx tsc --noEmit && npm run build:app`
Expected: tsc exit 0; Vite writes `dist/app/`.

- [ ] **Step 5: Commit**

```bash
git add tilt-lab/app/src/App.tsx tilt-lab/app/src/main.tsx tilt-lab/app/src/styles.css
git commit -m "feat(tilt-lab): playground app shell + entry"
```

---

### Task 9: Visual verification + QA gate

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite + typecheck**

Run: `cd tilt-lab && npx vitest run && npx tsc --noEmit`
Expected: all runtime + app tests pass; tsc exit 0.

- [ ] **Step 2: Start the dev server**

Run (background): `cd tilt-lab && npm run dev`
Expected: Vite serves on http://localhost:5180.

- [ ] **Step 3: Open in cmux and screenshot**

Navigate the cmux browser surface (see the project's `reference_cmux_surface` beat - surface:19 for dotfiles, or ask the user for the tilt-lab surface) to http://localhost:5180, screenshot to `/tmp/tilt-lab-ui.png`, and Read it. Confirm: three-column layout, gradient card in the browse grid, empty layer panel, top bar with project picker + buttons.

- [ ] **Step 4: Interactive verification (real input only)**

Using cmux/chrome click + type (NOT JS injection): click the gradient card, confirm the preview canvas shows an animated gradient and a layer appears in the right panel. Drag the speed slider and confirm the gradient animation speed changes. Screenshot each state to `/tmp/` and Read it.

- [ ] **Step 5: sidecoach QA gate (substantive UI)**

Run, in order, addressing findings above "minor":
- `/sidecoach audit tilt-lab/app` (fix all Critical + High)
- `/sidecoach critique tilt-lab/app`
- `/sidecoach polish tilt-lab/app` (last)
- `/make-interfaces-feel-better` 14-point pass, recording before/after.
- If a DESIGN.md exists for tilt-lab: `npx @google/design.md lint DESIGN.md` to zero findings.

- [ ] **Step 6: Commit any QA fixes**

```bash
git add -A tilt-lab/app
git commit -m "polish(tilt-lab): QA gate fixes for playground UI"
```

---

## Self-Review

- **Spec coverage:** browse grid + filters (Task 5), live composited preview (Task 6), layer stack add/remove/reorder + compatibility hint (Tasks 3, 7), manifest-driven param controls (Task 4), project picker + send + add-shader entry points (Task 7, wired in Plan 4), app shell three-column layout (Task 8), QA gate (Task 9). Server-backed behavior (project enumeration, package write, handoff) is explicitly deferred to Plan 4.
- **Type consistency:** `Manifest`, `ParamSpec`, `LayerConfig`, `LayerRole`, `Effect` all imported from the Plan 1 runtime. `createStackStore`/`StackStore` API (`layers/add/remove/reorder/setParam/subscribe`), `filterCatalog`/`loadCatalog`, `ParamControls` props (`specs/values/onChange`), and component prop names are consistent across tasks and the App shell.
- **Placeholders:** none. Server-dependent callbacks are intentionally no-ops with an inline comment naming Plan 4; this is a documented seam, not an unfinished requirement.
- **Verification:** logic is unit-tested (catalog filter, stack store, param controls, browse grid); visual + interactive correctness goes through cmux screenshots and the sidecoach QA gate per the team's Verification Protocol, since unit tests cannot confirm a gradient actually renders.
