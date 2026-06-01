import createGlobe from 'cobe';
import type { Effect, EffectOpts } from '../../types';
import { PRESETS } from './presets';

// ---------------------------------------------------------------------------
// cobe null-program guard (third-party compatibility shim, installed once).
//
// cobe v0.6.5 defers its world-map texture upload to an Image.onload that reads
// `gl.getParameter(CURRENT_PROGRAM)` and calls `gl.getUniformLocation(program,
// "H")`. When the globe is torn down before that async image load fires - the
// browse-grid POSTER path inits a globe then disposes it synchronously, well
// before the data-URI map decodes - CURRENT_PROGRAM is null, so cobe calls
// getUniformLocation(null, ...), which fails WebGL's WebGLProgram type check and
// throws an uncaught TypeError. That fired once per page load (the globe poster)
// and polluted every effect's `console-clean` verification check. The WebGL spec
// already defines a null/invalid program to yield a null location, so we make
// getUniformLocation null-safe at the prototype level: only the degenerate null
// case changes (every real call passes straight through). Idempotent.
function installCobeNullProgramGuard(): void {
  const patch = (proto: WebGLRenderingContextBase): void => {
    const p = proto as unknown as {
      getUniformLocation(program: WebGLProgram | null, name: string): WebGLUniformLocation | null;
      __tiltNullSafe?: boolean;
    };
    if (p.__tiltNullSafe) return;
    const orig = p.getUniformLocation;
    p.getUniformLocation = function (
      this: WebGLRenderingContextBase,
      program: WebGLProgram | null,
      name: string,
    ): WebGLUniformLocation | null {
      return program ? orig.call(this, program, name) : null;
    };
    p.__tiltNullSafe = true;
  };
  if (typeof WebGL2RenderingContext !== 'undefined') patch(WebGL2RenderingContext.prototype);
  if (typeof WebGLRenderingContext !== 'undefined') patch(WebGLRenderingContext.prototype);
}
installCobeNullProgramGuard();

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
 *
 * Interaction: cobe's signature is POINTER DRAG to spin. The compositor forwards
 * the unified pointer contract (onPointerDown / onPointer(x,y,pressed) /
 * onPointerUp / onPointerLeave); a pure `GlobeRotation` controller maps drag
 * deltas to phi (longitude) and theta (tilt), keeps auto-rotating when idle, and
 * carries release momentum as decaying inertia - the cobe.vercel.app feel.
 *
 * Control surface (parity rebuild): exposes cobe's full COBEOptions set
 * (phi/theta/dark/diffuse/mapSamples/mapBrightness/mapBaseBrightness/opacity/
 * scale/offset/baseColor/markerColor/glowColor) PLUS:
 *   - a PRESET library reproducing the documented cobe demo looks
 *     (the "dozens of configurations" from cobe.vercel.app),
 *   - selectable MARKER SETS (None / cities / capitals / continents / ...),
 *   - a map-LABEL overlay (an ADDITION beyond stock cobe - cobe ships no text
 *     labels; we draw them on a 2D overlay canvas projected from the same
 *     phi/theta the globe spins by).
 */

type GlobeHandle = ReturnType<typeof createGlobe>;

/** A cobe marker: a lat/lng dot drawn on the globe surface. */
interface GlobeMarker {
  location: [number, number];
  size: number;
  /** Optional place name used by the label overlay (tilt-lab addition). */
  label?: string;
}

// PRESETS (the cobe demo "looks") + the GlobePreset type live in ./presets
// (single source of truth, shared with the central preset registry). Colors are
// hex (converted to cobe's [r,g,b] 0..1 triplets at apply time).

// ---------------------------------------------------------------------------
// MARKER SETS - curated lat/long dot collections, selectable from a dropdown so
// the user gets marker variety out of the box (parity with cobe's demo marker
// sets). Each marker carries an optional `label` for the overlay.
// ---------------------------------------------------------------------------
const MARKER_SETS: Record<string, GlobeMarker[]> = {
  None: [],
  'SF + NYC (default)': [
    { location: [37.7595, -122.4367], size: 0.03, label: 'San Francisco' },
    { location: [40.7128, -74.006], size: 0.1, label: 'New York' },
  ],
  'World Capitals': [
    { location: [51.5074, -0.1278], size: 0.06, label: 'London' },
    { location: [40.7128, -74.006], size: 0.06, label: 'Washington' },
    { location: [35.6895, 139.6917], size: 0.06, label: 'Tokyo' },
    { location: [48.8566, 2.3522], size: 0.05, label: 'Paris' },
    { location: [55.7558, 37.6173], size: 0.05, label: 'Moscow' },
    { location: [39.9042, 116.4074], size: 0.06, label: 'Beijing' },
    { location: [28.6139, 77.209], size: 0.06, label: 'Delhi' },
    { location: [-15.7939, -47.8828], size: 0.05, label: 'Brasilia' },
    { location: [-35.2809, 149.13], size: 0.04, label: 'Canberra' },
    { location: [30.0444, 31.2357], size: 0.05, label: 'Cairo' },
  ],
  'Tech Hubs': [
    { location: [37.7749, -122.4194], size: 0.08, label: 'San Francisco' },
    { location: [47.6062, -122.3321], size: 0.05, label: 'Seattle' },
    { location: [30.2672, -97.7431], size: 0.05, label: 'Austin' },
    { location: [40.7128, -74.006], size: 0.06, label: 'New York' },
    { location: [51.5074, -0.1278], size: 0.05, label: 'London' },
    { location: [52.52, 13.405], size: 0.05, label: 'Berlin' },
    { location: [12.9716, 77.5946], size: 0.06, label: 'Bangalore' },
    { location: [1.3521, 103.8198], size: 0.05, label: 'Singapore' },
    { location: [35.6895, 139.6917], size: 0.05, label: 'Tokyo' },
    { location: [32.0853, 34.7818], size: 0.04, label: 'Tel Aviv' },
  ],
  Continents: [
    { location: [40, -100], size: 0.1, label: 'N. America' },
    { location: [-15, -60], size: 0.1, label: 'S. America' },
    { location: [50, 10], size: 0.09, label: 'Europe' },
    { location: [2, 20], size: 0.1, label: 'Africa' },
    { location: [45, 90], size: 0.11, label: 'Asia' },
    { location: [-25, 135], size: 0.08, label: 'Oceania' },
  ],
  Americas: [
    { location: [40.7128, -74.006], size: 0.07, label: 'New York' },
    { location: [34.0522, -118.2437], size: 0.06, label: 'Los Angeles' },
    { location: [19.4326, -99.1332], size: 0.06, label: 'Mexico City' },
    { location: [4.711, -74.0721], size: 0.05, label: 'Bogota' },
    { location: [-12.0464, -77.0428], size: 0.05, label: 'Lima' },
    { location: [-23.5505, -46.6333], size: 0.06, label: 'Sao Paulo' },
    { location: [-34.6037, -58.3816], size: 0.05, label: 'Buenos Aires' },
    { location: [43.6532, -79.3832], size: 0.05, label: 'Toronto' },
  ],
  Europe: [
    { location: [51.5074, -0.1278], size: 0.06, label: 'London' },
    { location: [48.8566, 2.3522], size: 0.06, label: 'Paris' },
    { location: [52.52, 13.405], size: 0.06, label: 'Berlin' },
    { location: [40.4168, -3.7038], size: 0.05, label: 'Madrid' },
    { location: [41.9028, 12.4964], size: 0.05, label: 'Rome' },
    { location: [52.3676, 4.9041], size: 0.05, label: 'Amsterdam' },
    { location: [59.3293, 18.0686], size: 0.05, label: 'Stockholm' },
    { location: [52.2297, 21.0122], size: 0.05, label: 'Warsaw' },
  ],
  'Asia Pacific': [
    { location: [35.6895, 139.6917], size: 0.07, label: 'Tokyo' },
    { location: [37.5665, 126.978], size: 0.06, label: 'Seoul' },
    { location: [39.9042, 116.4074], size: 0.06, label: 'Beijing' },
    { location: [31.2304, 121.4737], size: 0.06, label: 'Shanghai' },
    { location: [1.3521, 103.8198], size: 0.05, label: 'Singapore' },
    { location: [-33.8688, 151.2093], size: 0.06, label: 'Sydney' },
    { location: [19.076, 72.8777], size: 0.06, label: 'Mumbai' },
    { location: [-6.2088, 106.8456], size: 0.05, label: 'Jakarta' },
  ],
};

const DEFAULT_MARKERS: GlobeMarker[] = MARKER_SETS['SF + NYC (default)'];

// Label-projection orientation constants. cobe's exact phi/longitude sign is
// matched empirically against the rendered globe; if labels read mirrored or
// rotated after visual QA, flip these (one-line fix, isolated here on purpose).
const LON_SIGN = 1;
const PHI_SIGN = 1;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [1, 1, 1];
  let h = m[1];
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// DRAG-TO-SPIN ROTATION CONTROLLER (cobe's hallmark interaction).
//
// Reproduces the canonical cobe demo feel (github.com/shuding/cobe website):
// horizontal drag advances `phi` (longitude), vertical drag tilts `theta`
// (latitude, clamped to avoid pole flips), the globe keeps auto-rotating when
// idle, and releasing a flick carries momentum that decays (inertia). Kept as a
// pure, WebGL-free object so the drag math is unit-testable without a GL context
// (the effect itself is `dead` in headless test environments).
//
// Mapping (matches the demo, sign-isolated for a one-line flip after visual QA):
//   dPhi   = dragDeltaX / DRAG_PHI_PER_PX_DIV     (right drag -> +phi)
//   dTheta = dragDeltaY / DRAG_THETA_PER_PX_DIV   (down drag  -> +theta)
// Per-frame increments sum to the same total as the demo's start-relative
// deltaX/300, so total travel is identical; tracking per-frame deltas also
// yields the release velocity for the inertia pass for free.
// ---------------------------------------------------------------------------
const DRAG_PHI_PER_PX = 1 / 250; // horizontal px -> phi radians
const DRAG_THETA_PER_PX = 1 / 400; // vertical px -> theta radians
const INERTIA_DECAY = 0.92; // per-frame velocity falloff after release
const VEL_PHI_CLAMP = 0.12; // max carried phi velocity (rad/frame)
const VEL_THETA_CLAMP = 0.06; // max carried theta velocity (rad/frame)
const VEL_MIN = 0.0006; // below this, inertia stops
const THETA_LIMIT = 1.4; // clamp effective theta so the poles never flip
const MAX_DT = 100; // cap frame delta so a backgrounded tab does not lurch

export interface GlobeRotation {
  setBasePhi(v: number): void;
  setBaseTheta(v: number): void;
  setSpeed(v: number): void;
  setAutoRotate(v: boolean): void;
  /** Begin a drag at a canvas-relative point. */
  pointerDown(x: number, y: number): void;
  /** Continuous pointer update; only rotates while `pressed` and a drag is live. */
  pointerMove(x: number, y: number, pressed: boolean): void;
  /** End a drag; any residual velocity becomes inertia. */
  pointerUp(): void;
  /** Advance auto-rotation + inertia by `dtMs` milliseconds. */
  tick(dtMs: number): void;
  /** Current effective longitude (base + auto + drag/inertia offset). */
  phi(): number;
  /** Current effective latitude tilt (base + drag/inertia offset, clamped). */
  theta(): number;
  isDragging(): boolean;
}

export function createGlobeRotation(init?: {
  basePhi?: number;
  baseTheta?: number;
  speed?: number;
  autoRotate?: boolean;
}): GlobeRotation {
  let basePhi = init?.basePhi ?? 0;
  let baseTheta = init?.baseTheta ?? 0.3;
  let speed = init?.speed ?? 0.3; // radians/second of auto-rotation
  let autoRotate = init?.autoRotate ?? true;

  let clockPhi = 0; // accumulated auto-rotation
  let phiOffset = 0; // accumulated drag/inertia longitude
  let thetaOffset = 0; // accumulated drag/inertia tilt
  let velPhi = 0;
  let velTheta = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  // Keep `baseTheta + thetaOffset` inside the pole-safe band by absorbing any
  // overflow back into the offset (so the offset cannot wind past the limit).
  function clampThetaOffset(): void {
    const eff = baseTheta + thetaOffset;
    const clamped = clamp(eff, -THETA_LIMIT, THETA_LIMIT);
    thetaOffset += clamped - eff;
  }

  return {
    setBasePhi(v) {
      basePhi = v;
    },
    setBaseTheta(v) {
      baseTheta = v;
      clampThetaOffset();
    },
    setSpeed(v) {
      speed = v;
    },
    setAutoRotate(v) {
      autoRotate = v;
    },
    pointerDown(x, y) {
      dragging = true;
      lastX = x;
      lastY = y;
      velPhi = 0;
      velTheta = 0;
    },
    pointerMove(x, y, pressed) {
      if (!pressed || !dragging) return;
      const dPhi = (x - lastX) * DRAG_PHI_PER_PX;
      const dTheta = (y - lastY) * DRAG_THETA_PER_PX;
      phiOffset += dPhi;
      thetaOffset += dTheta;
      clampThetaOffset();
      // Release velocity = the most recent per-frame movement, clamped so a fast
      // flick spins fast but never uncontrollably.
      velPhi = clamp(dPhi, -VEL_PHI_CLAMP, VEL_PHI_CLAMP);
      velTheta = clamp(dTheta, -VEL_THETA_CLAMP, VEL_THETA_CLAMP);
      lastX = x;
      lastY = y;
    },
    pointerUp() {
      dragging = false; // velPhi/velTheta persist -> inertia in tick()
    },
    tick(dtMs) {
      const dt = clamp(dtMs, 0, MAX_DT);
      if (dragging) return; // base motion is frozen while the user is dragging
      if (Math.abs(velPhi) > VEL_MIN || Math.abs(velTheta) > VEL_MIN) {
        phiOffset += velPhi;
        thetaOffset += velTheta;
        clampThetaOffset();
        velPhi *= INERTIA_DECAY;
        velTheta *= INERTIA_DECAY;
      } else {
        velPhi = 0;
        velTheta = 0;
      }
      if (autoRotate) clockPhi += speed * (dt / 1000);
    },
    phi() {
      return basePhi + clockPhi + phiOffset;
    },
    theta() {
      return clamp(baseTheta + thetaOffset, -THETA_LIMIT, THETA_LIMIT);
    },
    isDragging() {
      return dragging;
    },
  };
}

export function createGlobeEffect(): Effect {
  let globe: GlobeHandle | null = null;
  let dead = false;
  let dpr = 1;

  // Rotation + drag-to-spin, driven from the external clock (not cobe's RAF).
  // The controller is the single source of truth for the live phi/theta the
  // globe (and the label overlay) render by.
  const rot = createGlobeRotation();
  let lastFrameT = 0;

  // cobe `offset` ([x, y] in backing-store pixels, default [0, 0]) and markers.
  let offsetX = 0;
  let offsetY = 0;
  let scale = 1;
  let markers: GlobeMarker[] = DEFAULT_MARKERS;

  // Label overlay state (tilt-lab addition).
  let showLabels = false;
  let labelColor = '#ffffff';
  let labelSize = 11;
  let overlay: HTMLCanvasElement | null = null;
  let octx: CanvasRenderingContext2D | null = null;
  let hostCanvas: HTMLCanvasElement | null = null;

  // Live param changes queued for the next render pass.
  const pending: Record<string, unknown> = {};

  // Resolution to push into the uResolution uniform on the next pass.
  let resW = 0;
  let resH = 0;
  let resDirty = false;

  function applyPreset(name: string): void {
    const preset = PRESETS[name];
    if (!preset) return; // "Custom" or unknown -> leave live values untouched.
    rot.setBaseTheta(preset.theta);
    scale = preset.scale;
    pending.baseColor = hexToRgb(preset.baseColor);
    pending.markerColor = hexToRgb(preset.markerColor);
    pending.glowColor = hexToRgb(preset.glowColor);
    pending.dark = preset.dark;
    pending.diffuse = preset.diffuse;
    pending.mapBrightness = preset.mapBrightness;
    pending.mapBaseBrightness = preset.mapBaseBrightness;
    pending.scale = preset.scale;
    pending.opacity = preset.opacity;
  }

  function ensureOverlay(): void {
    if (overlay || !hostCanvas || typeof document === 'undefined') return;
    const parent = hostCanvas.parentElement;
    if (!parent) return;
    try {
      const c = document.createElement('canvas');
      c.style.position = 'absolute';
      c.style.left = '0';
      c.style.top = '0';
      c.style.width = '100%';
      c.style.height = '100%';
      c.style.pointerEvents = 'none';
      const ctx = c.getContext('2d');
      if (!ctx) return;
      parent.appendChild(c);
      overlay = c;
      octx = ctx;
    } catch {
      overlay = null;
      octx = null;
    }
  }

  function teardownOverlay(): void {
    if (overlay) {
      try {
        overlay.remove();
      } catch {
        /* ignore */
      }
    }
    overlay = null;
    octx = null;
  }

  // Project a lat/long onto the 2D overlay using the same phi/theta the globe
  // spins by. Returns null for back-hemisphere points (hidden behind the globe).
  function project(lat: number, long: number): { x: number; y: number; front: number } | null {
    const phiNow = rot.phi() * PHI_SIGN;
    const latR = (lat * Math.PI) / 180;
    const lonR = (long * Math.PI) / 180 * LON_SIGN + phiNow;
    const x0 = Math.cos(latR) * Math.sin(lonR);
    const y0 = Math.sin(latR);
    const z0 = Math.cos(latR) * Math.cos(lonR);
    // Tilt by the live theta around the X axis.
    const ct = Math.cos(rot.theta());
    const st = Math.sin(rot.theta());
    const y1 = y0 * ct - z0 * st;
    const z1 = y0 * st + z0 * ct;
    if (z1 <= 0.02) return null; // behind the globe / on the limb
    const radius = Math.min(resW, resH) * 0.4 * scale;
    const cx = resW / 2 + offsetX * dpr;
    const cy = resH / 2 - offsetY * dpr;
    return { x: cx + x0 * radius, y: cy - y1 * radius, front: z1 };
  }

  function drawLabels(): void {
    ensureOverlay();
    if (!octx || !overlay) return;
    if (overlay.width !== resW || overlay.height !== resH) {
      overlay.width = resW;
      overlay.height = resH;
    }
    octx.clearRect(0, 0, resW, resH);
    if (!showLabels) return;
    const px = Math.max(6, labelSize) * dpr;
    octx.font = `${px}px -apple-system, system-ui, sans-serif`;
    octx.textBaseline = 'middle';
    octx.lineWidth = Math.max(1, dpr * 2);
    octx.strokeStyle = 'rgba(0,0,0,0.55)';
    octx.fillStyle = labelColor;
    const dot = Math.max(1.5, dpr * 2);
    for (const m of markers) {
      if (!m.label) continue;
      const p = project(m.location[0], m.location[1]);
      if (!p) continue;
      octx.globalAlpha = Math.min(1, 0.35 + p.front);
      // marker dot
      octx.beginPath();
      octx.arc(p.x, p.y, dot, 0, Math.PI * 2);
      octx.fill();
      // label text with a dark stroke for legibility
      const tx = p.x + dot * 2.2;
      octx.strokeText(m.label, tx, p.y);
      octx.fillText(m.label, tx, p.y);
    }
    octx.globalAlpha = 1;
  }

  // Bridge invoked by cobe each render pass. We mutate `state` in place; cobe
  // copies recognised keys into its GL uniforms.
  function onRenderBridge(state: Record<string, unknown>): void {
    state.phi = rot.phi();
    state.theta = rot.theta();
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
      hostCanvas = c;
      // Headless guard: happy-dom/jsdom have no WebGL, so getContext is null.
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;

      const p = opts.params;
      // Markers: an explicit 'marker-list' value (live-editable list) wins; else
      // fall back to the named markerSet preset (which also carries overlay
      // labels). The label-less editor markers simply render as dots.
      const ms = String(p.markerSet ?? 'SF + NYC (default)');
      const fromSet = MARKER_SETS[ms] ? MARKER_SETS[ms].slice() : DEFAULT_MARKERS;
      markers = Array.isArray(p.markers)
        ? (p.markers as GlobeMarker[])
            .filter((m) => Array.isArray(m?.location))
            .map((m) => ({ location: [Number(m.location[0]), Number(m.location[1])] as [number, number], size: Number(m.size) }))
        : fromSet;

      rot.setSpeed(Number(p.speed ?? 0.3));
      rot.setAutoRotate(p.autoRotate === undefined ? true : Boolean(p.autoRotate));
      rot.setBasePhi(Number(p.phi ?? 0));
      rot.setBaseTheta(Number(p.theta ?? 0.3));
      offsetX = Number(p.offsetX ?? 0);
      offsetY = Number(p.offsetY ?? 0);
      scale = Number(p.scale ?? 1);
      showLabels = Boolean(p.showLabels ?? false);
      labelColor = String(p.labelColor ?? '#ffffff');
      labelSize = Number(p.labelSize ?? 11);

      // A non-"Custom" initial preset overrides the colour/lighting defaults.
      // Ships as "Cobe Default" so the globe boots to cobe's true library look.
      const presetName = String(p.preset ?? 'Cobe Default');

      const cw = c.clientWidth || c.width || 300;
      const ch = c.clientHeight || c.height || 150;
      resW = Math.max(1, Math.round(cw * dpr));
      resH = Math.max(1, Math.round(ch * dpr));

      globe = createGlobe(c, {
        width: resW,
        height: resH,
        devicePixelRatio: dpr,
        phi: rot.phi(),
        theta: rot.theta(),
        dark: Number(p.dark ?? 0),
        diffuse: Number(p.diffuse ?? 1),
        mapSamples: Number(p.mapSamples ?? 10000),
        mapBrightness: Number(p.mapBrightness ?? 1),
        mapBaseBrightness: Number(p.mapBaseBrightness ?? 0),
        opacity: Number(p.opacity ?? 1),
        scale,
        offset: [offsetX, offsetY],
        baseColor: hexToRgb(String(p.baseColor ?? '#ffffff')),
        markerColor: hexToRgb(String(p.markerColor ?? '#ff8000')),
        glowColor: hexToRgb(String(p.glowColor ?? '#ffffff')),
        markers: markers.map((m) => ({ location: m.location, size: m.size })),
        onRender: onRenderBridge,
      });

      if (presetName !== 'Custom') applyPreset(presetName);

      // Drag affordance: cobe globes are grabbable. The host canvas shows a grab
      // cursor at rest and grabbing mid-drag (set in the pointer handlers).
      c.style.cursor = 'grab';

      // Stop cobe's internal RAF loop; tilt-lab drives frame() instead.
      globe.toggle(false);
    },

    frame(t: number) {
      if (dead || !globe) return;
      // Advance auto-rotation + inertia by the real elapsed time so a drag pause
      // (or a backgrounded tab) does not make the globe jump on resume.
      const dt = lastFrameT ? t - lastFrameT : 16;
      lastFrameT = t;
      rot.tick(dt);
      globe.render();
      drawLabels();
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
        case 'preset':
          applyPreset(String(value));
          break;
        case 'markerSet': {
          const set = MARKER_SETS[String(value)];
          markers = set ? set.slice() : [];
          pending.markers = markers.map((m) => ({ location: m.location, size: m.size }));
          break;
        }
        case 'markers': {
          // Live marker-list edit: rebuild cobe's marker buffer from the array.
          markers = Array.isArray(value)
            ? (value as GlobeMarker[])
                .filter((m) => Array.isArray(m?.location))
                .map((m) => ({
                  location: [Number(m.location[0]), Number(m.location[1])] as [number, number],
                  size: Number(m.size),
                }))
            : [];
          pending.markers = markers.map((m) => ({ location: m.location, size: m.size }));
          break;
        }
        case 'autoRotate':
          rot.setAutoRotate(Boolean(value));
          break;
        case 'speed':
          rot.setSpeed(Number(value));
          break;
        case 'phi':
          rot.setBasePhi(Number(value));
          break;
        case 'theta':
          rot.setBaseTheta(Number(value));
          break;
        case 'scale':
          scale = Number(value);
          pending.scale = scale;
          break;
        case 'offsetX':
          offsetX = Number(value);
          pending.offset = [offsetX, offsetY];
          break;
        case 'offsetY':
          offsetY = Number(value);
          pending.offset = [offsetX, offsetY];
          break;
        case 'showLabels':
          showLabels = Boolean(value);
          break;
        case 'labelColor':
          labelColor = String(value);
          break;
        case 'labelSize':
          labelSize = Number(value);
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
          pending[key] = Number(value);
          break;
        default:
          break;
      }
    },

    // --- Drag-to-spin (cobe's signature interaction) -----------------------
    // Coords arrive canvas-relative from the compositor's PointerTracker, which
    // unifies mouse + touch + pen. A press starts a drag; continuous moves while
    // pressed rotate the globe; release carries inertia.
    onPointerDown(x: number, y: number) {
      rot.pointerDown(x, y);
      if (hostCanvas) hostCanvas.style.cursor = 'grabbing';
    },

    onPointer(x: number, y: number, pressed?: boolean) {
      rot.pointerMove(x, y, Boolean(pressed));
    },

    onPointerUp() {
      rot.pointerUp();
      if (hostCanvas) hostCanvas.style.cursor = 'grab';
    },

    onPointerLeave() {
      // A drag that wanders off-host keeps spinning (window pointerup releases
      // it); only reset the resting cursor when no drag is in flight.
      if (!rot.isDragging() && hostCanvas) hostCanvas.style.cursor = 'grab';
    },

    dispose() {
      teardownOverlay();
      hostCanvas = null;
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
