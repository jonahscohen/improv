import { useEffect, useState } from 'react';
import { effectFactories, effectAssets } from '../../../runtime/index';
import type { Effect, Manifest } from '../../../runtime/types';
import './thumbnail-preview.css';

/* Poster thumbnails for the browse catalog.

   Why posters, not live canvases: a browser caps active WebGL contexts (~16),
   and mounting one live context per card (26+) loses the extras ("Context
   Lost") and can starve the main preview. A created context is held even while
   off-screen, so RAF/IntersectionObserver pausing does not help the cap.

   Instead we render each effect ONCE to a representative still frame through a
   single short-lived context, snapshot it to a data URL, dispose the effect,
   and free that context before starting the next. Generation is sequential
   (concurrency 1), so at most one effect context exists at any moment - no
   context-lost, and the main preview keeps its own context. Posters are cached
   per effect id, so scrolling / re-renders are instant. A poster is a single
   still image, so it is already reduced-motion friendly. */

const POSTER_PX = 160; // logical cap (CSS scales it into the card)
const SETTLE_FRAMES = 24; // step the effect so it settles into something legible
const FRAME_STEP_MS = 33; // ~30fps of simulated time per step

// 'failed' -> show the dark letter tile; a string is a data-URL poster.
type Poster = string | 'failed';

const posterCache = new Map<string, Poster>();
const listeners = new Map<string, Set<() => void>>();
const queue: Manifest[] = [];
const queued = new Set<string>();
let working = false;

function subscribe(id: string, fn: () => void) {
  let set = listeners.get(id);
  if (!set) {
    set = new Set();
    listeners.set(id, set);
  }
  set.add(fn);
}
function unsubscribe(id: string, fn: () => void) {
  listeners.get(id)?.delete(fn);
}
function notify(id: string) {
  listeners.get(id)?.forEach((fn) => fn());
}

/** Render one effect to a still poster through a short-lived context. Fully
 *  synchronous: init -> settle frames -> snapshot happen in one tick so the
 *  WebGL drawing buffer is still intact at toDataURL time (no preserve needed).
 *  Always disposes the effect and frees any GL context before returning. */
function renderPoster(manifest: Manifest): Poster {
  const factory = effectFactories[manifest.id];
  if (!factory) return 'failed';

  const canvas = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const size = Math.max(1, Math.round(POSTER_PX * dpr));
  canvas.width = size;
  canvas.height = size;

  let effect: Effect | null = null;
  try {
    effect = factory();
    // mount() effects render into a DOM subtree, not a canvas - no poster.
    if (effect.mount) return 'failed';

    const params: Record<string, unknown> = {};
    for (const spec of manifest.params) params[spec.name] = spec.default;
    const assets = effectAssets[manifest.id] ?? {};

    effect.init(canvas, { params, assets });
    effect.resize(size, size);
    for (let i = 0; i <= SETTLE_FRAMES; i++) effect.frame(i * FRAME_STEP_MS);

    const url = canvas.toDataURL('image/png');
    // Guard against a degenerate/empty encode ("data:," or a stub).
    return typeof url === 'string' && url.startsWith('data:image/png') && url.length > 64
      ? url
      : 'failed';
  } catch {
    return 'failed';
  } finally {
    try {
      effect?.dispose();
    } catch {
      /* ignore */
    }
    // Proactively release the GL context so we never drift toward the cap.
    try {
      const gl = (canvas.getContext('webgl2') ||
        canvas.getContext('webgl')) as
        | WebGLRenderingContext
        | WebGL2RenderingContext
        | null;
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      /* ignore */
    }
  }
}

async function pump() {
  if (working) return;
  working = true;
  while (queue.length) {
    const manifest = queue.shift() as Manifest;
    queued.delete(manifest.id);
    if (!posterCache.has(manifest.id)) {
      const poster = renderPoster(manifest);
      posterCache.set(manifest.id, poster);
      notify(manifest.id);
    }
    // Yield between effects so generation never janks the UI thread.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  working = false;
}

function enqueue(manifest: Manifest) {
  if (posterCache.has(manifest.id) || queued.has(manifest.id)) return;
  queued.add(manifest.id);
  queue.push(manifest);
  void pump();
}

interface Props {
  manifest: Manifest;
}

export function ThumbnailPreview({ manifest }: Props) {
  const [poster, setPoster] = useState<Poster | undefined>(() =>
    posterCache.get(manifest.id),
  );

  useEffect(() => {
    const id = manifest.id;
    const cached = posterCache.get(id);
    if (cached !== undefined) {
      setPoster(cached);
      return;
    }
    setPoster(undefined); // pending -> skeleton

    let active = true;
    const onReady = () => {
      if (active) setPoster(posterCache.get(id));
    };
    subscribe(id, onReady);
    enqueue(manifest);

    return () => {
      active = false;
      unsubscribe(id, onReady);
    };
  }, [manifest]);

  return (
    <div className="thumb" aria-hidden="true">
      {poster === undefined ? (
        <div className="thumb__skeleton" />
      ) : poster === 'failed' ? (
        <div className="thumb__fallback">
          <span className="thumb__fallback-glyph">{manifest.name.charAt(0)}</span>
        </div>
      ) : (
        <img className="thumb__img" src={poster} alt="" draggable={false} />
      )}
    </div>
  );
}
