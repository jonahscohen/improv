import type { Effect, EffectOpts } from '../../types';
import * as THREE from 'three';
import { FluidSolver } from '../../lib/fluid-solver';

/**
 * Fractal Glass - the shared stable-fluid field rendered onto a background
 * plane, viewed through a fluted-glass refraction material. The flute profile
 * is the verbatim GLSL from regent's fractal-glass tool (IndiciumAI lineage),
 * injected into a MeshPhysicalMaterial via onBeforeCompile. The fluid sim is the
 * shared CPU FluidSolver (runtime/lib/fluid-solver.ts). Three.js.
 *
 * Headless-safe: no WebGL context -> dead, methods no-op (CPU solver still steps
 * harmlessly).
 */

// fractal-glass fluid constants (lane-1 report; differ from halftone)
const FLUID = {
  iterations: 2,
  velocityDecay: 4,
  colorDecay: 6.0,
  curlStrength: 0.012,
  curlScale: 1.5,
  curlChangeRate: 0.015,
  pointerStrength: 0.35,
  pointerDrag: 0.32,
  pointerSpread: 150,
};

// verbatim fluted-glass functions injected after #include <common>
const FLUTE_FUNCS = /* glsl */ `
uniform float singleFluteWidth;
uniform float fluteExponent;
uniform float fluteDepth;
const float MAX_FLUTE_GEOMETRY_DEPTH = 0.02;

float getFluteU(float x) {
    float fluteLocal = fract(x / singleFluteWidth + 0.5);
    return fluteLocal * 2.0 - 1.0;
}
float getSquircleZ(float u, float n) {
    float absU = clamp(abs(u), 0.0, 0.999);
    return pow(1.0 - pow(absU, n), 1.0 / n);
}
vec2 getSquircleNormalXZ(float u, float n) {
    float absU = clamp(abs(u), 0.001, 0.999);
    float signU = sign(u);
    float nx = signU * pow(absU, n - 1.0);
    float nz = pow(1.0 - pow(absU, n), (n - 1.0) / n);
    float len = sqrt(nx * nx + nz * nz);
    return vec2(nx, nz) / len;
}
`;

// verbatim normal-perturbation injected after #include <normal_fragment_maps>
const FLUTE_NORMAL = /* glsl */ `
#include <normal_fragment_maps>
{
    float u = getFluteU(vWorldPosition.x);
    vec2 squircleNormalXZ = getSquircleNormalXZ(u, fluteExponent);
    vec3 fluteNormalModel = vec3(squircleNormalXZ.x, 0.0, squircleNormalXZ.y);
    vec3 blendedNormalModel = normalize(mix(vec3(0.0, 0.0, 1.0), fluteNormalModel, fluteDepth));
    normal = normalize(mat3(viewMatrix) * mat3(modelMatrix) * blendedNormalModel);
}
`;

interface GlassParams {
  turbulence: number;
  highlight: number;
  midtone: number;
  shadow: number;
  fluteCount: number;
  fluteExponent: number;
  fluteDepth: number;
  ior: number;
  thickness: number;
  roughness: number;
  envIntensity: number;
}

export function createFractalGlassEffect(): Effect {
  let dead = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let bgMaterial: THREE.MeshBasicMaterial | null = null;
  let glassMaterial: THREE.MeshPhysicalMaterial | null = null;
  let bgGeo: THREE.PlaneGeometry | null = null;
  let glassGeo: THREE.PlaneGeometry | null = null;
  let dataTex: THREE.DataTexture | null = null;
  let envRT: THREE.WebGLRenderTarget | null = null;
  let solver: FluidSolver | null = null;
  let fluteShader: { uniforms: Record<string, THREE.IUniform> } | null = null;
  let lastT = 0;

  let pointerX = 0.5;
  let pointerY = 0.5;
  let lastPointerX = 0.5;
  let lastPointerY = 0.5;
  let pointerDown = false;

  const p: GlassParams = {
    turbulence: 0.1,
    highlight: 1.0,
    midtone: 1.0,
    shadow: 1.0,
    fluteCount: 50,
    fluteExponent: 2.0,
    fluteDepth: 1.0,
    ior: 1.3,
    thickness: 0.1,
    roughness: 0,
    envIntensity: 1.0,
  };

  function buildBackground(): void {
    if (!solver) return;
    const hi = p.highlight;
    const mid = p.midtone;
    const sh = p.shadow;
    solver.setBackgroundField((u, v) => {
      const dx = u - 0.5;
      const dy = v - 0.5;
      const r = Math.min(1, Math.hypot(dx, dy) * 2);
      const center = 0.22 * hi;
      const middle = 0.12 * mid;
      const edge = 0.04 * sh;
      const val = r < 0.5 ? center + (middle - center) * (r / 0.5) : middle + (edge - middle) * ((r - 0.5) / 0.5);
      return [val * 0.9, val * 0.95, val * 1.15];
    });
  }

  function buildEnvMap(r: THREE.WebGLRenderer): void {
    // Procedural HDR-ish environment: a small vertical-gradient equirect run
    // through PMREMGenerator (simplified createProceduralEnvMap).
    const size = 16;
    const data = new Float32Array(size * size * 4);
    for (let y = 0; y < size; y++) {
      const v = y / (size - 1);
      // dark base + soft top light
      const lum = 0.05 + Math.pow(1 - v, 2) * 1.4;
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        data[i] = lum * 0.95;
        data[i + 1] = lum * 0.98;
        data[i + 2] = lum * 1.1;
        data[i + 3] = 1;
      }
    }
    const equirect = new THREE.DataTexture(data as unknown as BufferSource, size, size, THREE.RGBAFormat, THREE.FloatType);
    equirect.needsUpdate = true;
    const pmrem = new THREE.PMREMGenerator(r);
    pmrem.compileEquirectangularShader();
    envRT = pmrem.fromEquirectangular(equirect);
    if (scene) scene.environment = envRT.texture;
    equirect.dispose();
    pmrem.dispose();
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      for (const k of Object.keys(p) as (keyof GlassParams)[]) {
        if (k in opts.params) this.setParam(k, opts.params[k]);
      }

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
        renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
      } catch {
        dead = true;
        return;
      }
      renderer.toneMapping = THREE.NeutralToneMapping;

      scene = new THREE.Scene();
      scene.environmentRotation = new THREE.Euler(0, -1.73, 0);
      camera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
      camera.position.z = 2;

      const rgba = solver.colorRGBA;
      dataTex = new THREE.DataTexture(rgba as unknown as BufferSource, solver.width, solver.height, THREE.RGBAFormat, THREE.FloatType);
      dataTex.minFilter = THREE.LinearFilter;
      dataTex.magFilter = THREE.LinearFilter;
      dataTex.needsUpdate = true;

      bgMaterial = new THREE.MeshBasicMaterial({ map: dataTex });
      bgGeo = new THREE.PlaneGeometry(1, 1);
      const bgMesh = new THREE.Mesh(bgGeo, bgMaterial);
      bgMesh.position.z = -0.2;
      scene.add(bgMesh);

      glassMaterial = new THREE.MeshPhysicalMaterial({
        transmission: 1.0,
        roughness: p.roughness,
        metalness: 0,
        ior: p.ior,
        thickness: p.thickness,
        specularIntensity: 0,
        clearcoat: 0,
        side: THREE.FrontSide,
        transparent: true,
        envMapIntensity: p.envIntensity,
      });
      glassMaterial.onBeforeCompile = (shader) => {
        shader.uniforms.singleFluteWidth = { value: 1 / p.fluteCount };
        shader.uniforms.fluteExponent = { value: p.fluteExponent };
        shader.uniforms.fluteDepth = { value: p.fluteDepth };
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <common>', `#include <common>\n${FLUTE_FUNCS}`)
          .replace('#include <normal_fragment_maps>', FLUTE_NORMAL);
        fluteShader = shader as unknown as { uniforms: Record<string, THREE.IUniform> };
      };
      glassGeo = new THREE.PlaneGeometry(1, 1);
      const glassMesh = new THREE.Mesh(glassGeo, glassMaterial);
      scene.add(glassMesh);

      buildEnvMap(renderer);
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
      if (dead || !renderer || !scene || !camera || !dataTex || !solver) return;
      dataTex.image.data = solver.colorRGBA as unknown as Uint8Array;
      dataTex.needsUpdate = true;
      renderer.render(scene, camera);
    },

    resize(w: number, h: number) {
      if (dead || !renderer) return;
      renderer.setSize(w, h, false);
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
        case 'fluteCount':
          p.fluteCount = Number(value);
          if (fluteShader) fluteShader.uniforms.singleFluteWidth.value = 1 / p.fluteCount;
          break;
        case 'fluteExponent':
          p.fluteExponent = Number(value);
          if (fluteShader) fluteShader.uniforms.fluteExponent.value = p.fluteExponent;
          break;
        case 'fluteDepth':
          p.fluteDepth = Number(value);
          if (fluteShader) fluteShader.uniforms.fluteDepth.value = p.fluteDepth;
          break;
        case 'ior':
          p.ior = Number(value);
          if (glassMaterial) glassMaterial.ior = p.ior;
          break;
        case 'thickness':
          p.thickness = Number(value);
          if (glassMaterial) glassMaterial.thickness = p.thickness;
          break;
        case 'roughness':
          p.roughness = Number(value);
          if (glassMaterial) glassMaterial.roughness = p.roughness;
          break;
        case 'envIntensity':
          p.envIntensity = Number(value);
          if (glassMaterial) glassMaterial.envMapIntensity = p.envIntensity;
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
      bgGeo?.dispose();
      glassGeo?.dispose();
      bgMaterial?.dispose();
      glassMaterial?.dispose();
      dataTex?.dispose();
      envRT?.dispose();
      renderer?.dispose();
      bgGeo = null;
      glassGeo = null;
      bgMaterial = null;
      glassMaterial = null;
      dataTex = null;
      envRT = null;
      renderer = null;
      scene = null;
      camera = null;
      solver = null;
      fluteShader = null;
      dead = true;
    },
  };
}
