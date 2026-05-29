import type { Effect, EffectOpts } from '../../types';
import * as THREE from 'three';
import { FluidSolver } from '../../lib/fluid-solver';

/**
 * Halftone - a stable-fluid field (shared CPU FluidSolver) sampled per-cell by
 * a rotated-dot halftone post shader. Verbatim halftone fragment shader from
 * regent's halftone tool; the fluid sim is the shared Stam solver extracted to
 * runtime/lib/fluid-solver.ts. Three.js for the post pass.
 *
 * The CPU solver produces a color field each frame which is uploaded to a
 * FloatType DataTexture; the halftone shader reads it as uSource. Headless-safe:
 * no WebGL context -> dead, methods no-op (solver still runs CPU-side, harmless).
 */

// halftone fluid constants (lane-1 report)
const FLUID = {
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

const HALFTONE_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const HALFTONE_FRAGMENT = /* glsl */ `
uniform sampler2D uSource;
uniform vec2 uResolution;
uniform float uDotSize;
uniform float uGridAngle;
uniform float uContrast;
uniform float uSoftness;
uniform float uInvert;
varying vec2 vUv;

vec2 rotatePoint(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

void main() {
  vec2 pixelCoord = vUv * uResolution;
  float angleRad = uGridAngle * 3.14159265 / 180.0;
  vec2 rotated = rotatePoint(pixelCoord, angleRad);
  vec2 cellSize = vec2(uDotSize);
  vec2 cell = floor(rotated / cellSize);
  vec2 cellCenter = (cell + 0.5) * cellSize;
  vec2 cellCenterPx = rotatePoint(cellCenter, -angleRad);
  vec2 cellUV = cellCenterPx / uResolution;
  cellUV = clamp(cellUV, vec2(0.0), vec2(1.0));
  vec4 srcColor = texture2D(uSource, cellUV);

  float srcLuma = max(dot(srcColor.rgb, vec3(0.299, 0.587, 0.114)), 0.001);
  float liftedLuma = pow(srcLuma, 0.5);
  float liftScale = liftedLuma / srcLuma;
  vec3 lifted = srcColor.rgb * liftScale;
  float maxChan = max(max(lifted.r, lifted.g), lifted.b);
  if (maxChan > 1.0) lifted /= maxChan;
  float avg = (lifted.r + lifted.g + lifted.b) / 3.0;
  lifted = max(mix(vec3(avg), lifted, 1.5), vec3(0.0));

  float luma = dot(lifted, vec3(0.299, 0.587, 0.114));
  luma = pow(clamp(luma, 0.0, 1.0), 1.0 / max(uContrast, 0.05));
  float sizeFactor = mix(luma, 1.0 - luma, uInvert);
  float maxRadius = uDotSize * 0.5;
  float radius = maxRadius * sqrt(sizeFactor);
  float dist = distance(rotated, cellCenter);
  float edgePx = max(uSoftness * 2.0, 0.5);
  float dotMask = 1.0 - smoothstep(radius - edgePx, radius + edgePx, dist);
  vec3 baseColor = lifted * 0.08;
  vec3 finalColor = mix(baseColor, lifted, dotMask);
  gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface HalftoneParams {
  turbulence: number;
  highlight: number;
  midtone: number;
  shadow: number;
  dotSize: number;
  gridAngle: number;
  contrast: number;
  softness: number;
  invert: boolean;
}

export function createHalftoneEffect(): Effect {
  let dead = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let geometry: THREE.PlaneGeometry | null = null;
  let dataTex: THREE.DataTexture | null = null;
  let solver: FluidSolver | null = null;
  let lastT = 0;

  let pointerX = 0.5;
  let pointerY = 0.5;
  let lastPointerX = 0.5;
  let lastPointerY = 0.5;
  let pointerDown = false;

  const p: HalftoneParams = {
    turbulence: 0.1,
    highlight: 1.2,
    midtone: 1.5,
    shadow: 1.0,
    dotSize: 12,
    gridAngle: 15,
    contrast: 1.0,
    softness: 0.4,
    invert: false,
  };

  function buildBackground(): void {
    if (!solver) return;
    // Procedural radial gradient (center -> edge) weighted by highlight/midtone/
    // shadow, replacing the original justified.jpg. Simplified CPU version of
    // createBackgroundTexture.
    const hi = p.highlight;
    const mid = p.midtone;
    const sh = p.shadow;
    solver.setBackgroundField((u, v) => {
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      // 3-stop blend: center (highlight) -> mid -> edge (shadow)
      const center = 0.18 * hi;
      const middle = 0.10 * mid;
      const edge = 0.03 * sh;
      const t = r;
      const val = t < 0.5 ? center + (middle - center) * (t / 0.5) : middle + (edge - middle) * ((t - 0.5) / 0.5);
      return [val * 1.0, val * 0.85, val * 1.1];
    });
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      for (const k of Object.keys(p) as (keyof HalftoneParams)[]) {
        if (k in opts.params) this.setParam(k, opts.params[k]);
      }

      // CPU fluid solver always created (testable, harmless headless)
      solver = new FluidSolver({
        width: 96,
        height: 96,
        ...FLUID,
        curlStrength: FLUID.curlStrength * (p.turbulence / 0.1),
      });
      buildBackground();

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      try {
        renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
      } catch {
        dead = true;
        return;
      }
      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0, 1);

      const rgba = solver.colorRGBA;
      dataTex = new THREE.DataTexture(rgba as unknown as BufferSource, solver.width, solver.height, THREE.RGBAFormat, THREE.FloatType);
      dataTex.minFilter = THREE.LinearFilter;
      dataTex.magFilter = THREE.LinearFilter;
      dataTex.needsUpdate = true;

      material = new THREE.ShaderMaterial({
        vertexShader: HALFTONE_VERTEX,
        fragmentShader: HALFTONE_FRAGMENT,
        uniforms: {
          uSource: { value: dataTex },
          uResolution: { value: new THREE.Vector2(canvas.width || 256, canvas.height || 256) },
          uDotSize: { value: p.dotSize },
          uGridAngle: { value: p.gridAngle },
          uContrast: { value: p.contrast },
          uSoftness: { value: p.softness },
          uInvert: { value: p.invert ? 1 : 0 },
        },
      });
      geometry = new THREE.PlaneGeometry(1, 1);
      scene.add(new THREE.Mesh(geometry, material));
    },

    frame(t: number) {
      const dt = lastT === 0 ? 1 / 60 : Math.min((t - lastT) / 1000, 1 / 30);
      lastT = t;
      if (solver) {
        if (pointerDown) solver.addPointer(pointerX, pointerY, lastPointerX, lastPointerY, true);
        solver.step(dt, t / 1000);
        lastPointerX = pointerX;
        lastPointerY = pointerY;
      }
      if (dead || !renderer || !scene || !camera || !material || !dataTex || !solver) return;
      dataTex.image.data = solver.colorRGBA as unknown as Uint8ClampedArray;
      dataTex.needsUpdate = true;
      renderer.render(scene, camera);
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !material) return;
      renderer.setSize(w, h, false);
      (material.uniforms.uResolution.value as THREE.Vector2).set(w, h);
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'turbulence':
          p.turbulence = Number(value);
          if (solver) solver.opts.curlStrength = FLUID.curlStrength * (p.turbulence / 0.1);
          break;
        case 'highlight':
          p.highlight = Number(value);
          buildBackground();
          break;
        case 'midtone':
          p.midtone = Number(value);
          buildBackground();
          break;
        case 'shadow':
          p.shadow = Number(value);
          buildBackground();
          break;
        case 'dotSize':
          p.dotSize = Number(value);
          if (material) material.uniforms.uDotSize.value = p.dotSize;
          break;
        case 'gridAngle':
          p.gridAngle = Number(value);
          if (material) material.uniforms.uGridAngle.value = p.gridAngle;
          break;
        case 'contrast':
          p.contrast = Number(value);
          if (material) material.uniforms.uContrast.value = p.contrast;
          break;
        case 'softness':
          p.softness = Number(value);
          if (material) material.uniforms.uSoftness.value = p.softness;
          break;
        case 'invert':
          p.invert = Boolean(value);
          if (material) material.uniforms.uInvert.value = p.invert ? 1 : 0;
          break;
        default:
          break;
      }
    },

    onPointer(x: number, y: number) {
      if (Number.isNaN(x) || Number.isNaN(y)) {
        pointerDown = false;
        return;
      }
      pointerX = x;
      pointerY = y;
      pointerDown = true;
    },

    dispose() {
      geometry?.dispose();
      material?.dispose();
      dataTex?.dispose();
      renderer?.dispose();
      geometry = null;
      material = null;
      dataTex = null;
      renderer = null;
      scene = null;
      camera = null;
      solver = null;
      dead = true;
    },
  };
}
