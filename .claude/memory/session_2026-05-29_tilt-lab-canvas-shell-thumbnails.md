---
name: tilt-lab canvas-dominant shell + live-thumbnail browse (Builder A)
description: App.tsx shell (collapse/fullscreen), BrowseGrid live-thumbnail grid, ThumbnailPreview shared-RAF mini-canvas
type: project
relates_to: [session_2026-05-29_tilt-lab-instrument-foundation.md, session_2026-05-29_tilt-lab-design-direction.md]
---

Collaborator: Jonah

Builder A task (tilt-design team rebuild, "instrument not dashboard"). Scope was App.tsx + BrowseGrid + new ThumbnailPreview + co-located CSS only. styles.css is CD-owned and was NOT touched.

## What was built

- **App.tsx (canvas-dominant shell):** added `railLeftCollapsed`, `railRightCollapsed`, `fullscreen` state. Sets `data-fullscreen` on `.app` and `data-rail-left`/`data-rail-right="collapsed"` on `.app__body` (styles.css already animates the grid + hides chrome off these attrs). Toggle controls are `.icon-btn`s floated over `.app__preview` (position:absolute, inline token-based styles, `background: var(--surface-1)` for legibility over any effect) so they stay reachable in fullscreen where topbar/rails are gone. Rail toggles hidden during fullscreen; fullscreen toggle always visible. Esc exits fullscreen via window keydown listener. All existing wiring (TopBar, PreviewCanvas, LayerStack, AddShaderModal, store.add) left intact.
- **BrowseGrid.tsx:** replaced the blind text list with a responsive thumbnail grid (`repeat(auto-fill, minmax(100px,1fr))`, 2-up in the lean rail, 1-up when tight). Each card = `<ThumbnailPreview>` + name + tracked mono role meta (pointer role tinted accent). Kept the `.field` search, the `Select` role filter (builder C's, consumed only), `filterCatalog`, and a `.value` count readout. Card click still calls `onPick(manifest)`; hover via surface-2/line-2, `:active scale(0.97)`, 40px min.
- **ThumbnailPreview.tsx (NEW):** live mini-canvas. Replicates element.ts lifecycle (params from manifest defaults, `effectAssets[id] ?? {}`, `factory()` -> `init(ctx)` -> resize -> frame). Performance citizenship: ONE module-level shared RAF registry ticks all mounted thumbnails (not one RAF/card); IntersectionObserver pauses off-screen tiles; resolution capped at 160 logical px; ResizeObserver re-syncs. prefers-reduced-motion -> single static `frame(0)`, no loop. init throw / missing factory / frame throw -> caught, renders static monogram fallback tile instead of crashing the grid. (Note: the Effect contract has no `mount()` branch in this codebase - only canvas init - so no mount handling needed.)
- **icons.tsx:** added ChevronLeft, ChevronRight, Maximize, Minimize - paths copied verbatim from Lucide (project's library).
- **BrowseGrid.test.tsx:** updated to new structure - names render, search filter, count readout, onPick-on-card-click, empty state.

## Contract assumptions
- `effectAssets` is `Record<string, Record<string,string>>` keyed by effect id (from assets.d.ts) - usable directly as EffectContext.assets.
- No new design tokens or new shared classes needed; composed `.module__label`, `.meta`, `.value`, `.field`, `.icon-btn`, `.btn`.

## Verification status
PASSED. `npx tsc --noEmit` -> rc=0, zero errors. `npm test` (vitest run) -> 13 files / 56 tests passed, rc=0.

Two real bugs found and fixed during verification (after a transient harness tool-output outage cleared):
1. Misread the Effect contract: it is `init(canvas, opts: EffectOpts)` (sync), params keyed by `ParamSpec.name`, NO `EffectContext`/pointer/reducedMotion in opts. Rewrote ThumbnailPreview to the real lifecycle and treat any `effect.mount` effect as a static-fallback tile (canvas init only).
2. browse-grid.css write did not persist during the outage (vitest could not resolve the import); recreated it. Also rewrote App.tsx after a botched write left a duplicate `style` attribute + stray tags.

## Cross-builder wiring (CD request, 2026-05-29)
- LayerStack enable/opacity: WIRED. Builder B already landed `setEnabled`/`setOpacity` on stackStore + optional `onSetEnabled`/`onSetOpacity` props on LayerStack, so App now passes `onSetEnabled={(i,e)=>store.setEnabled(i,e)}` and `onSetOpacity={(i,o)=>store.setOpacity(i,o)}`. tsc rc=0.
- TopBar server-free export: WIRED. Builder C's TopBar landed (task #6 complete) with a `layers?: LayerConfig[]` prop driving downloadStackConfig/copyStackConfig; onSend/canSend are now deprecated optionals. App passes `layers={layers}` and dropped the dead onSend/canSend (kept projects/selectedProject/onSelectProject/onAddShader, still required). TopBar takes `layers` only, NOT `catalog` (export module needs only the stack). Both cross-builder seams now live; tsc rc=0, 42 files / 160 tests pass.

## CD revision round (2026-05-29) - posters, dark-fail, muted roles
Shell/layout/fullscreen/rail-collapse were APPROVED. Three fixes in my domain (App.tsx/TopBar/styles.css off-limits this round - CD owns):

1. **Thumbnail re-architecture: 26 live WebGL contexts -> cached poster frames.** Root cause of the broken catalog was the ~16 active-context browser cap (THREE "Context Lost", letter-fallback on most cards, main preview starvation); off-screen pausing doesn't help because a created context is held regardless. New design in ThumbnailPreview.tsx: a module-level QUEUE + single async `pump()` worker (concurrency 1) renders each effect ONCE through a short-lived context - `factory()` -> `init(canvas,{params,assets})` at 160px -> step 24 frames @ 33ms simulated to settle -> `canvas.toDataURL('image/png')` -> dispose effect -> free GL via `getContext('webgl2'||'webgl').getExtension('WEBGL_lose_context').loseContext()`. Generation is fully SYNCHRONOUS per effect (no awaits between init/frame/snapshot) so the WebGL drawing buffer is intact at toDataURL (no preserveDrawingBuffer needed). Result cached in module-level `posterCache: Map<id, dataURL|'failed'>`; cards subscribe and re-render when their poster lands. At most one effect context ever exists -> no context-lost, main preview safe. Card renders `<img src=poster>` / shimmer skeleton (pending) / dark letter tile (failed). Posters are stills -> reduced-motion friendly by construction. **Did NOT add hover-live** (CD said optional/low-risk-only; skipped to keep the round clean - posters alone accepted).
   - Why sequential over a pool: a single reused canvas can't switch context types (webgl vs 2d) across mixed effects, and concurrency>1 reintroduces context pressure; sequential fresh-canvas-per-effect + explicit loseContext is the safe minimum.
   - Settle-frame choice: 24 frames stepped at 33ms (~0.8s simulated) settles both pure-time shaders and accumulating sims (particles/fluid) into something recognizable, cheap one-time at 160px.
2. **White-tile fix (1b).** The white+broken Aurora tile was a side effect of the lost context on a live `<canvas>`. Eliminated by removing live canvases entirely; every non-poster state is now DARK (skeleton = surface-2 shimmer, failure = surface-2 letter tile), and `<img>` is only ever given a validated non-empty `data:image/png` URL, so no broken-image white state is reachable.
3. **Role color (2).** Removed the `[data-role='pointer'] { color: var(--accent) }` rule in browse-grid.css; all `.browse-card__role` tags are now uniformly `var(--muted)` (single-accent / no color-only-signaling law).

Verify: tsc rc=0; npm test 42 files / 160 tests pass. BrowseGrid.test.tsx unchanged (structure identical; ThumbnailPreview swaps canvas->img/skeleton/fallback internally, names/count/search/onPick/empty all still assert).

## Files touched
- tilt-lab/app/src/App.tsx (modify)
- tilt-lab/app/src/components/BrowseGrid.tsx (modify)
- tilt-lab/app/src/components/browse-grid.css (new)
- tilt-lab/app/src/components/ThumbnailPreview.tsx (new)
- tilt-lab/app/src/components/thumbnail-preview.css (new)
- tilt-lab/app/src/components/icons.tsx (modify - 4 Lucide icons added)
- tilt-lab/app/src/components/BrowseGrid.test.tsx (modify)
