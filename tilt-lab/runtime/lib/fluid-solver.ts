/**
 * Shared Stam stable-fluid solver (CPU / Float32Array).
 *
 * Ported from the regent lane-1 recon report. The halftone and fractal-glass
 * effects both embed a Three.js fluid sim whose passes are
 * advect -> paintVelocity (decay + curl noise + pointer drag) -> divergence ->
 * Jacobi pressure solve (N iterations) -> gradient subtract -> advect color ->
 * paintColor (decay toward a background texture). Those passes are duplicated
 * across both effects with only constant differences, so the math is extracted
 * here as one CPU module that is unit-testable. The consuming effect uploads
 * this solver's color buffer to a GL texture for rendering.
 *
 * The simplex / curl noise below is the verbatim algorithm from the report's
 * SIMPLEX_NOISE_GLSL block (snoise / snoiseVec3 / curlNoise), reimplemented in
 * JS so the curl-driven velocity paint matches the shader.
 */

export interface FluidSolverOptions {
  /** Grid resolution in cells (sim space). */
  width: number;
  height: number;
  /** Jacobi pressure-solve iterations (FLUID_ITERATIONS). */
  iterations: number;
  /** Velocity decay toward zero (FLUID_VELOCITY_DECAY). */
  velocityDecay: number;
  /** Color decay toward the background texture (FLUID_COLOR_DECAY). */
  colorDecay: number;
  /** Curl-noise strength (FLUID_CURL_STRENGTH). */
  curlStrength: number;
  /** Curl-noise spatial scale (FLUID_CURL_SCALE). */
  curlScale: number;
  /** Curl-noise temporal change rate (FLUID_CURL_CHANGE_RATE). */
  curlChangeRate: number;
  /** Pointer drag strength (FLUID_POINTER_STRENGTH). */
  pointerStrength: number;
  /** Pointer drag falloff (FLUID_POINTER_DRAG). */
  pointerDrag: number;
  /** Pointer influence spread (FLUID_POINTER_SPREAD). */
  pointerSpread: number;
}

const DEFAULTS: FluidSolverOptions = {
  width: 64,
  height: 64,
  iterations: 2,
  velocityDecay: 2.5,
  colorDecay: 4.0,
  curlStrength: 0.035,
  curlScale: 1.5,
  curlChangeRate: 0.025,
  pointerStrength: 0.35,
  pointerDrag: 0.32,
  pointerSpread: 150,
};

// --- 3D simplex noise (canonical scalar Gustavson form of the same Ashima
//     algorithm the report's SIMPLEX_NOISE_GLSL is derived from) ---

const GRAD3 = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

// Deterministic permutation table (Ken Perlin's reference 256-entry table,
// doubled to avoid index wrapping).
const PERM_SOURCE = [
  151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36,
  103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0,
  26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237, 149, 56,
  87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77,
  146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245,
  40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89,
  18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
  52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206,
  59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44,
  154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110,
  79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210,
  144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31,
  181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236,
  205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
];
const PERM = new Uint8Array(512);
for (let i = 0; i < 512; i++) PERM[i] = PERM_SOURCE[i & 255];

function dot3(g: number[], x: number, y: number, z: number): number {
  return g[0] * x + g[1] * y + g[2] * z;
}

// 3D simplex noise, output in roughly [-1, 1].
function snoise(xin: number, yin: number, zin: number): number {
  const F3 = 1.0 / 3.0;
  const G3 = 1.0 / 6.0;
  const s = (xin + yin + zin) * F3;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const k = Math.floor(zin + s);
  const t = (i + j + k) * G3;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const z0 = zin - (k - t);

  let i1: number, j1: number, k1: number;
  let i2: number, j2: number, k2: number;
  if (x0 >= y0) {
    if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
    else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
  } else {
    if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
  }

  const x1 = x0 - i1 + G3;
  const y1 = y0 - j1 + G3;
  const z1 = z0 - k1 + G3;
  const x2 = x0 - i2 + 2.0 * G3;
  const y2 = y0 - j2 + 2.0 * G3;
  const z2 = z0 - k2 + 2.0 * G3;
  const x3 = x0 - 1.0 + 3.0 * G3;
  const y3 = y0 - 1.0 + 3.0 * G3;
  const z3 = z0 - 1.0 + 3.0 * G3;

  const ii = i & 255;
  const jj = j & 255;
  const kk = k & 255;
  const gi0 = PERM[ii + PERM[jj + PERM[kk]]] % 12;
  const gi1 = PERM[ii + i1 + PERM[jj + j1 + PERM[kk + k1]]] % 12;
  const gi2 = PERM[ii + i2 + PERM[jj + j2 + PERM[kk + k2]]] % 12;
  const gi3 = PERM[ii + 1 + PERM[jj + 1 + PERM[kk + 1]]] % 12;

  const contrib = (gi: number, x: number, y: number, z: number): number => {
    let tt = 0.6 - x * x - y * y - z * z;
    if (tt < 0) return 0;
    tt *= tt;
    return tt * tt * dot3(GRAD3[gi], x, y, z);
  };

  return 32.0 * (
    contrib(gi0, x0, y0, z0) +
    contrib(gi1, x1, y1, z1) +
    contrib(gi2, x2, y2, z2) +
    contrib(gi3, x3, y3, z3)
  );
}

// curlNoise(vec3 p) from the report, returning the 2D xy used by paintVelocity.
function curlNoise2D(px: number, py: number, pz: number, out: [number, number]): void {
  const e = 0.1;
  const sv = (x: number, y: number, z: number): [number, number, number] => {
    const s = snoise(x, y, z);
    const s1 = snoise(y - 19.1, z + 33.4, x + 47.2);
    const s2 = snoise(z + 74.2, x - 124.5, y + 99.4);
    return [s, s1, s2];
  };
  const px0 = sv(px - e, py, pz);
  const px1 = sv(px + e, py, pz);
  const py0 = sv(px, py - e, pz);
  const py1 = sv(px, py + e, pz);
  const pz0 = sv(px, py, pz - e);
  const pz1 = sv(px, py, pz + e);
  const x = py1[2] - py0[2] - pz1[1] + pz0[1];
  const y = pz1[0] - pz0[0] - px1[2] + px0[2];
  const z = px1[1] - px0[1] - py1[0] + py0[0];
  const len = Math.hypot(x, y, z) || 1;
  out[0] = x / len;
  out[1] = y / len;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * CPU stable-fluid solver. Operates on a width x height grid of cells.
 * Coordinates passed to addPointer / setBackground are normalized [0,1].
 */
export class FluidSolver {
  readonly opts: FluidSolverOptions;
  private readonly w: number;
  private readonly h: number;
  private readonly n: number;

  private vx: Float32Array;
  private vy: Float32Array;
  private vx0: Float32Array;
  private vy0: Float32Array;
  private pressure: Float32Array;
  private pressure0: Float32Array;
  private divergence: Float32Array;

  // color field (rgb per cell) + background it decays toward
  private cr: Float32Array;
  private cg: Float32Array;
  private cb: Float32Array;
  private cr0: Float32Array;
  private cg0: Float32Array;
  private cb0: Float32Array;
  private bgr: Float32Array;
  private bgg: Float32Array;
  private bgb: Float32Array;

  private rgba: Float32Array;
  private time = 0;

  constructor(options: Partial<FluidSolverOptions> = {}) {
    this.opts = { ...DEFAULTS, ...options };
    this.w = Math.max(2, Math.floor(this.opts.width));
    this.h = Math.max(2, Math.floor(this.opts.height));
    this.n = this.w * this.h;
    const f = () => new Float32Array(this.n);
    this.vx = f();
    this.vy = f();
    this.vx0 = f();
    this.vy0 = f();
    this.pressure = f();
    this.pressure0 = f();
    this.divergence = f();
    this.cr = f();
    this.cg = f();
    this.cb = f();
    this.cr0 = f();
    this.cg0 = f();
    this.cb0 = f();
    this.bgr = f();
    this.bgg = f();
    this.bgb = f();
    this.rgba = new Float32Array(this.n * 4);
  }

  get width(): number {
    return this.w;
  }

  get height(): number {
    return this.h;
  }

  private idx(x: number, y: number): number {
    return y * this.w + x;
  }

  /** Set the background color (normalized rgb) that the color field decays toward. */
  setBackground(r: number, g: number, b: number): void {
    this.bgr.fill(r);
    this.bgg.fill(g);
    this.bgb.fill(b);
  }

  /** Set a per-cell background from a callback returning [r,g,b] for normalized uv. */
  setBackgroundField(fn: (u: number, v: number) => [number, number, number]): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const [r, g, b] = fn((x + 0.5) / this.w, (y + 0.5) / this.h);
        const i = this.idx(x, y);
        this.bgr[i] = r;
        this.bgg[i] = g;
        this.bgb[i] = b;
      }
    }
  }

  /**
   * Inject pointer-driven velocity along the segment from last -> current.
   * Coords normalized [0,1]; `down` mirrors the shader's uPointer.z gating.
   */
  addPointer(x: number, y: number, lastX: number, lastY: number, down: boolean): void {
    if (!down) return;
    const ax = lastX * this.w;
    const ay = lastY * this.h;
    const bx = x * this.w;
    const by = y * this.h;
    const ux = (x - lastX) * this.w;
    const uy = (y - lastY) * this.h;
    const spread = this.opts.pointerSpread / (this.w * this.h);
    const drag = this.opts.pointerDrag;
    const strength = this.opts.pointerStrength;
    for (let gy = 0; gy < this.h; gy++) {
      for (let gx = 0; gx < this.w; gx++) {
        // distance from cell center to the pointer segment
        const px = gx + 0.5;
        const py = gy + 0.5;
        const abx = bx - ax;
        const aby = by - ay;
        const axx = px - ax;
        const axy = py - ay;
        const abLen2 = abx * abx + aby * aby || 1;
        const alpha = clamp((abx * axx + aby * axy) / abLen2, 0, 1);
        const dx = axx - alpha * abx;
        const dy = axy - alpha * aby;
        const d = Math.hypot(dx, dy);
        const m = Math.exp(-d * d * spread) * drag;
        const i = this.idx(gx, gy);
        this.vx[i] += (ux * strength - this.vx[i]) * m;
        this.vy[i] += (uy * strength - this.vy[i]) * m;
      }
    }
  }

  private sampleBilinear(field: Float32Array, fx: number, fy: number): number {
    const x = clamp(fx, 0, this.w - 1.001);
    const y = clamp(fy, 0, this.h - 1.001);
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const tx = x - x0;
    const ty = y - y0;
    const i00 = this.idx(x0, y0);
    const i10 = this.idx(x1, y0);
    const i01 = this.idx(x0, y1);
    const i11 = this.idx(x1, y1);
    const a = field[i00] * (1 - tx) + field[i10] * tx;
    const b = field[i01] * (1 - tx) + field[i11] * tx;
    return a * (1 - ty) + b * ty;
  }

  private advect(dst: Float32Array, src: Float32Array, dt: number): void {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = this.idx(x, y);
        const fx = x - dt * this.vx[i];
        const fy = y - dt * this.vy[i];
        dst[i] = this.sampleBilinear(src, fx, fy);
      }
    }
  }

  private project(): void {
    const w = this.w;
    const h = this.h;
    // divergence
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = this.vx[this.idx(Math.max(x - 1, 0), y)];
        const r = this.vx[this.idx(Math.min(x + 1, w - 1), y)];
        const b = this.vy[this.idx(x, Math.max(y - 1, 0))];
        const t = this.vy[this.idx(x, Math.min(y + 1, h - 1))];
        this.divergence[this.idx(x, y)] = 0.5 * ((r - l) + (t - b));
        this.pressure[this.idx(x, y)] = 0;
      }
    }
    // Jacobi pressure solve
    for (let k = 0; k < this.opts.iterations; k++) {
      this.pressure0.set(this.pressure);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const l = this.pressure0[this.idx(Math.max(x - 1, 0), y)];
          const r = this.pressure0[this.idx(Math.min(x + 1, w - 1), y)];
          const b = this.pressure0[this.idx(x, Math.max(y - 1, 0))];
          const t = this.pressure0[this.idx(x, Math.min(y + 1, h - 1))];
          const bC = this.divergence[this.idx(x, y)];
          this.pressure[this.idx(x, y)] = (l + r + b + t - bC) * 0.25;
        }
      }
    }
    // gradient subtract
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = this.pressure[this.idx(Math.max(x - 1, 0), y)];
        const r = this.pressure[this.idx(Math.min(x + 1, w - 1), y)];
        const b = this.pressure[this.idx(x, Math.max(y - 1, 0))];
        const t = this.pressure[this.idx(x, Math.min(y + 1, h - 1))];
        const i = this.idx(x, y);
        this.vx[i] -= 0.5 * (r - l);
        this.vy[i] -= 0.5 * (t - b);
      }
    }
  }

  /** Advance the simulation by dt seconds (timeSeconds drives curl noise). */
  step(dt: number, timeSeconds: number): void {
    this.time = timeSeconds;
    const o = this.opts;

    // advect velocity (semi-Lagrangian)
    this.vx0.set(this.vx);
    this.vy0.set(this.vy);
    this.advect(this.vx, this.vx0, dt);
    this.advect(this.vy, this.vy0, dt);

    // paintVelocity: decay toward zero + curl noise injection
    const decay = clamp(o.velocityDecay * dt, 0, 1);
    const out: [number, number] = [0, 0];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const i = this.idx(x, y);
        this.vx[i] += (0 - this.vx[i]) * decay;
        this.vy[i] += (0 - this.vy[i]) * decay;
        if (o.curlStrength > 0) {
          const u = (x / this.w) * o.curlScale;
          const v = (y / this.h) * o.curlScale;
          curlNoise2D(u, v, this.time * o.curlChangeRate, out);
          this.vx[i] += o.curlStrength * out[0] * this.w;
          this.vy[i] += o.curlStrength * out[1] * this.h;
        }
      }
    }

    // projection (divergence -> Jacobi pressure -> gradient subtract)
    this.project();

    // advect color
    this.cr0.set(this.cr);
    this.cg0.set(this.cg);
    this.cb0.set(this.cb);
    this.advect(this.cr, this.cr0, dt);
    this.advect(this.cg, this.cg0, dt);
    this.advect(this.cb, this.cb0, dt);

    // paintColor: decay toward background
    const cdecay = clamp(o.colorDecay * dt, 0, 1);
    for (let i = 0; i < this.n; i++) {
      this.cr[i] += (this.bgr[i] - this.cr[i]) * cdecay;
      this.cg[i] += (this.bgg[i] - this.cg[i]) * cdecay;
      this.cb[i] += (this.bgb[i] - this.cb[i]) * cdecay;
    }
  }

  /** Packed RGBA float buffer (alpha 1) for GL DataTexture upload. */
  get colorRGBA(): Float32Array {
    for (let i = 0; i < this.n; i++) {
      this.rgba[i * 4] = this.cr[i];
      this.rgba[i * 4 + 1] = this.cg[i];
      this.rgba[i * 4 + 2] = this.cb[i];
      this.rgba[i * 4 + 3] = 1;
    }
    return this.rgba;
  }

  /** Max absolute velocity magnitude (used by tests / diagnostics). */
  maxSpeed(): number {
    let m = 0;
    for (let i = 0; i < this.n; i++) {
      const s = Math.hypot(this.vx[i], this.vy[i]);
      if (s > m) m = s;
    }
    return m;
  }

  /** Sum of absolute divergence across the grid (drops after projection). */
  totalDivergence(): number {
    const w = this.w;
    const h = this.h;
    let sum = 0;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = this.vx[this.idx(Math.max(x - 1, 0), y)];
        const r = this.vx[this.idx(Math.min(x + 1, w - 1), y)];
        const b = this.vy[this.idx(x, Math.max(y - 1, 0))];
        const t = this.vy[this.idx(x, Math.min(y + 1, h - 1))];
        sum += Math.abs(0.5 * ((r - l) + (t - b)));
      }
    }
    return sum;
  }

  reset(): void {
    this.vx.fill(0);
    this.vy.fill(0);
    this.pressure.fill(0);
    this.cr.fill(0);
    this.cg.fill(0);
    this.cb.fill(0);
  }
}

/** Expose the ported simplex noise for unit tests / shared use. */
export const noise = { snoise, curlNoise2D };
