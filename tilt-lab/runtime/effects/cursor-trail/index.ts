import type { Effect, EffectOpts } from '../../types';

// Ported from unlumen UI "cursor-image-trail" (ui.unlumen.com, author "Leo").
// The original is a React DOM component animated by Framer Motion. tilt-lab has
// no React/Framer Motion runtime, so this is a faithful vanilla-DOM port that
// preserves the exact mechanics and easing:
//   - distance-gated spawning (spawnDistance px of cursor travel)
//   - round-robin item cycling, random rotation within rotationRange
//   - trailLength cap (oldest items animate out)
//   - per-item age scale: 0.6 + 0.4 * (1 - age / trailLength)
//   - enter/exit tweens at duration 0.4s, ease cubic-bezier(0.23, 1, 0.32, 1)
//   - exit adds blur(4px)
// It renders into a DOM host via mount() and is driven by onPointer() rather
// than the canvas/frame loop (this is a pointer-role overlay effect).

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
const DURATION_MS = 400;

interface TrailNode {
  el: HTMLElement;
  removeTimer: number | null;
}

export function createCursorTrailEffect(): Effect {
  let host: HTMLElement | null = null;
  let container: HTMLElement | null = null;
  let imageUrls: string[] = [];
  const trail: TrailNode[] = [];
  let lastPos: { x: number; y: number } | null = null;
  let itemCounter = 0;
  let idCounter = 0;

  const p = {
    itemSize: 120,
    trailLength: 8,
    spawnDistance: 80,
    rotationRange: 20,
  };

  function readParams(params: Record<string, unknown>) {
    if (params.itemSize != null) p.itemSize = Number(params.itemSize);
    if (params.trailLength != null) p.trailLength = Number(params.trailLength);
    if (params.spawnDistance != null) p.spawnDistance = Number(params.spawnDistance);
    if (params.rotationRange != null) p.rotationRange = Number(params.rotationRange);
  }

  function clearTrail() {
    for (const node of trail) {
      if (node.removeTimer != null && typeof clearTimeout !== 'undefined') {
        clearTimeout(node.removeTimer);
      }
      node.el.remove();
    }
    trail.length = 0;
  }

  function exitNode(node: TrailNode, rotation: number) {
    // Exit tween: opacity 0, scale 0.3, rotate*0.5, blur(4px).
    node.el.style.opacity = '0';
    node.el.style.filter = 'blur(4px)';
    node.el.style.transform = `translate(-50%, -50%) rotate(${rotation * 0.5}deg) scale(0.3)`;
    if (typeof setTimeout !== 'undefined') {
      node.removeTimer = setTimeout(() => {
        node.el.remove();
      }, DURATION_MS) as unknown as number;
    } else {
      node.el.remove();
    }
  }

  return {
    init(_canvas: HTMLCanvasElement, opts: EffectOpts) {
      // Pointer/DOM effect: no canvas drawing. mount() does the real work.
      readParams(opts.params);
      imageUrls = Object.values(opts.assets ?? {});
    },

    mount(hostEl: HTMLElement, opts: EffectOpts) {
      readParams(opts.params);
      imageUrls = Object.values(opts.assets ?? {});
      host = hostEl;
      if (typeof document === 'undefined') return;

      container = document.createElement('div');
      container.style.position = 'absolute';
      container.style.inset = '0';
      container.style.overflow = 'hidden';
      container.style.pointerEvents = 'none';
      host.appendChild(container);
    },

    onPointer(x: number, y: number) {
      if (!container || typeof document === 'undefined') return;
      if (imageUrls.length === 0) return;

      // Distance gate: only spawn after travelling spawnDistance px.
      if (lastPos) {
        const dx = x - lastPos.x;
        const dy = y - lastPos.y;
        if (Math.sqrt(dx * dx + dy * dy) < p.spawnDistance) return;
      }
      lastPos = { x, y };

      const rotation = (Math.random() * 2 - 1) * p.rotationRange;
      const itemIndex = itemCounter % imageUrls.length;
      itemCounter += 1;
      idCounter += 1;

      const wrap = document.createElement('div');
      wrap.style.position = 'absolute';
      wrap.style.left = `${x}px`;
      wrap.style.top = `${y}px`;
      wrap.style.width = `${p.itemSize}px`;
      wrap.style.userSelect = 'none';
      wrap.style.pointerEvents = 'none';
      wrap.style.zIndex = String(idCounter);
      wrap.style.transition = `opacity ${DURATION_MS}ms ${EASE}, transform ${DURATION_MS}ms ${EASE}, filter ${DURATION_MS}ms ${EASE}`;
      // Initial state: opacity 0, scale 0.5, rotate*1.5.
      wrap.style.opacity = '0';
      wrap.style.transform = `translate(-50%, -50%) rotate(${rotation * 1.5}deg) scale(0.5)`;

      const img = document.createElement('img');
      img.src = imageUrls[itemIndex];
      img.style.width = '100%';
      img.style.height = 'auto';
      img.draggable = false;
      wrap.appendChild(img);

      container.appendChild(wrap);

      const node: TrailNode = { el: wrap, removeTimer: null };
      trail.push(node);

      // Per-item age scale, computed for the newest item (age 0).
      const scale = 0.6 + 0.4 * (1 - 0 / p.trailLength);
      // Animate to the resting state on the next frame.
      const animateIn = () => {
        wrap.style.opacity = '1';
        wrap.style.transform = `translate(-50%, -50%) rotate(${rotation}deg) scale(${scale})`;
      };
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(animateIn);
      } else {
        animateIn();
      }

      // Cap the trail length: oldest items animate out and are removed.
      while (trail.length > p.trailLength) {
        const oldest = trail.shift();
        if (oldest) exitNode(oldest, rotation);
      }
    },

    frame() {
      // Pointer-driven, event-based. Motion is handled by CSS transitions, so
      // there is nothing to advance on the canvas clock.
    },

    resize() {
      // The overlay is inset:0 and tracks the host automatically.
    },

    setParam(key: string, value: unknown) {
      if (key in p) {
        (p as Record<string, unknown>)[key] = Number(value);
      }
    },

    dispose() {
      clearTrail();
      lastPos = null;
      if (container) {
        container.remove();
        container = null;
      }
      host = null;
    },
  };
}
