import createGlobe from 'cobe';
import type { Effect, EffectOpts } from '../../types';

/**
 * Globe (cobe) - an interactive dotted WebGL globe by Shu Ding.
 *
 * Loop adaptation: the installed cobe (v0.6.5) is the phenomenon-based v1 API.
 * `createGlobe` returns a phenomenon Renderer that owns an internal
 * requestAnimationFrame loop driven by `onRender`. tilt-lab effects must NOT
 * own a RAF, so we call `renderer.toggle(false)` right after construction to
 * stop the internal loop, then drive a single `renderer.render()` pass from
 * `frame(t)`. Rotation is advanced from the external clock and pushed into the
 * uniforms through cobe's `onRender` bridge.
 */

type GlobeHandle = ReturnType<typeof createGlobe>;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function createGlobeEffect(): Effect {
  let globe: GlobeHandle | null = null;
  let dead = false;
  let dpr = 1;

  // Rotation state (driven from the external clock, not cobe's RAF).
  let speed = 0.3; // radians/second of auto-rotation
  let basePhi = 0;
  let clockPhi = 0;
  let theta = 0.3;

  // Live param changes queued for the next render pass.
  const pending: Record<string, unknown> = {};

  // Resolution to push into the uResolution uniform on the next pass.
  let resW = 0;
  let resH = 0;
  let resDirty = false;

  // Bridge invoked by cobe each render pass. We mutate `state` in place; cobe
  // copies recognised keys into its GL uniforms.
  function onRenderBridge(state: Record<string, unknown>): void {
    state.phi = basePhi + clockPhi;
    state.theta = theta;
    for (const k in pending) {
      state[k] = pending[k];
      delete pending[k];
    }
    if (resDirty) {
      state.width = resW;
      state.height = resH;
      resDirty = false;
    }
  }

  return {
    init(c: HTMLCanvasElement, opts: EffectOpts) {
      // Headless guard: happy-dom has no WebGL, so getContext returns null.
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

      const p = opts.params;
      speed = Number(p.speed ?? 0.3);
      basePhi = Number(p.phi ?? 0);
      theta = Number(p.theta ?? 0.3);

      const cw = c.clientWidth || c.width || 300;
      const ch = c.clientHeight || c.height || 150;
      resW = Math.max(1, Math.round(cw * dpr));
      resH = Math.max(1, Math.round(ch * dpr));

      globe = createGlobe(c, {
        width: resW,
        height: resH,
        devicePixelRatio: dpr,
        phi: basePhi,
        theta,
        dark: Number(p.dark ?? 1),
        diffuse: Number(p.diffuse ?? 1.2),
        mapSamples: Number(p.mapSamples ?? 16000),
        mapBrightness: Number(p.mapBrightness ?? 6),
        mapBaseBrightness: Number(p.mapBaseBrightness ?? 0),
        opacity: Number(p.opacity ?? 1),
        scale: Number(p.scale ?? 1),
        baseColor: hexToRgb(String(p.baseColor ?? '#346df0')),
        markerColor: hexToRgb(String(p.markerColor ?? '#ff7a00')),
        glowColor: hexToRgb(String(p.glowColor ?? '#aab6ff')),
        markers: [],
        onRender: onRenderBridge,
      });

      // Stop cobe's internal RAF loop; tilt-lab drives frame() instead.
      globe.toggle(false);
    },

    frame(t: number) {
      if (dead || !globe) return;
      clockPhi = (t / 1000) * speed;
      globe.render();
    },

    resize(w: number, h: number) {
      if (dead || !globe) return;
      resW = Math.max(1, Math.round(w * dpr));
      resH = Math.max(1, Math.round(h * dpr));
      resDirty = true;
      // phenomenon recomputes the gl viewport + projection from the laid-out
      // canvas; we push the matching uResolution via onRenderBridge.
      globe.resize();
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'speed':
          speed = Number(value);
          break;
        case 'phi':
          basePhi = Number(value);
          break;
        case 'theta':
          theta = Number(value);
          break;
        case 'baseColor':
        case 'markerColor':
        case 'glowColor':
          pending[key] = hexToRgb(String(value));
          break;
        case 'mapSamples':
        case 'mapBrightness':
        case 'mapBaseBrightness':
        case 'diffuse':
        case 'dark':
        case 'opacity':
        case 'scale':
          pending[key] = Number(value);
          break;
        default:
          break;
      }
    },

    dispose() {
      if (globe) {
        try {
          globe.destroy();
        } catch {
          /* releasing a dead GL context can throw; ignore */
        }
        globe = null;
      }
      dead = true;
    },
  };
}
