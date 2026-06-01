import type { Effect, EffectOpts } from '../../types';
import * as THREE from 'three';
import { rgb01 } from '../../color';
import {
  createFluidSim,
  stepFluidSim,
  disposeFluidSim,
  createBackgroundTexture,
  hexToLinearRGB,
  smoothstepJS,
  normalize3,
  dist3,
  pointerUVFromPixel,
  type FluidSimState,
  type FluidConstants,
} from '../../lib/fluid-solver';
import {
  FRACTAL_GLASS_PRESETS as SCENE_PRESETS,
  FRACTAL_GLASS_SCENE_NAMES as SCENE_NAMES,
} from './presets';

/**
 * Fractal Glass - the verbatim regent fractal-glass tool (IndiciumAI bundle
 * chunk 386: FlutedGlassMaterial / FluidSimulation / MainScene). The shared
 * Three.js GPU fluid field (runtime/lib/fluid-solver) is shown on a background
 * plane and viewed through a fluted-glass MeshPhysicalMaterial (transmission=1)
 * whose surface normal is perturbed into a squircle flute profile via
 * onBeforeCompile. Lit by a procedural HDR environment map (PMREM-prefiltered).
 *
 * The wrapper drives frame(t); no RAF is owned. Pointer arrives via onPointer.
 * Headless-safe: with no WebGL context (happy-dom) init marks the effect dead
 * and every method no-ops.
 */

// Fluid sim constants (verbatim from the original MainScene constructor).
const FLUID: FluidConstants = {
  iterations: 2, // FLUID_ITERATIONS
  timeScale: 0.1, // FLUID_TIME_SCALE
  velocityDecay: 4, // FLUID_VELOCITY_DECAY
  colorDecay: 6.0, // FLUID_COLOR_DECAY
  pointerSpread: 150, // FLUID_POINTER_SPREAD
  curlStrength: 0.012, // FLUID_CURL_STRENGTH
  curlScale: 1.5, // FLUID_CURL_SCALE
  curlChangeRate: 0.015, // FLUID_CURL_CHANGE_RATE
  pointerStrength: 0.35, // FLUID_POINTER_STRENGTH
  pointerDrag: 0.32, // FLUID_POINTER_DRAG
  simTextureScale: 0.25, // FLUID_SIM_TEXTURE_SCALE
  physicsScale: 1, // FLUID_PHYSICS_SCALE (dx)
};
const FLUID_CURL_STRENGTH = FLUID.curlStrength;

// Verbatim fluted-glass functions (from original FlutedGlassMaterial).
const FLUTE_FUNCTIONS_GLSL = /* glsl */ `
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

interface GlassParams {
  scene: number;
  fluidInfluence: number;
  turbulence: number;
  glassAmount: number;
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
  bloomStrength: number;
  // Live palette: 4 base colors drive the radial background, 3 env colors tint
  // the procedural environment map. Named presets seed both; the pickers (the
  // original's GRADIENT BUILDER custom mode, scene === -1) override live.
  baseColor1: string;
  baseColor2: string;
  baseColor3: string;
  baseColor4: string;
  envColor1: string;
  envColor2: string;
  envColor3: string;
  // When true, env colors are auto-derived from base colors via deriveEnvColors
  // (the original AUTO ENV COLORS toggle).
  autoEnv: boolean;
}

// SCENE_NAMES / SCENE_PRESETS imported from ./presets (single source of truth,
// shared with the central preset registry and the fractal-glass-post variant).

// ---- Color derivation, ported verbatim from the regent original
// (app/(app)/tools/fractal-glass/colorUtils.ts). ----
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Shared parser handles 8-digit #rrggbbaa (transparent picker values).
  const [r, g, b] = rgb01(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;
  if (sNorm === 0) {
    const v = Math.round(lNorm * 255);
    return `#${v.toString(16).padStart(2, '0').repeat(3)}`;
  }
  const hue2rgb = (pp: number, q: number, t: number): number => {
    let tAdj = t;
    if (tAdj < 0) tAdj += 1;
    if (tAdj > 1) tAdj -= 1;
    if (tAdj < 1 / 6) return pp + (q - pp) * 6 * tAdj;
    if (tAdj < 1 / 2) return q;
    if (tAdj < 2 / 3) return pp + (q - pp) * (2 / 3 - tAdj) * 6;
    return pp;
  };
  const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
  const pp = 2 * lNorm - q;
  const r = Math.round(hue2rgb(pp, q, hNorm + 1 / 3) * 255);
  const g = Math.round(hue2rgb(pp, q, hNorm) * 255);
  const b = Math.round(hue2rgb(pp, q, hNorm - 1 / 3) * 255);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

function deriveEnvColors(
  base1: string,
  base2: string,
  base3: string,
): { envColor1: string; envColor2: string; envColor3: string } {
  const h1 = hexToHSL(base1);
  const h2 = hexToHSL(base2);
  const h3 = hexToHSL(base3);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    envColor1: hslToHex(h1.h, clamp(h1.s + 10, 0, 100), clamp(h1.l + 3, 0, 100)),
    envColor2: hslToHex(h2.h, clamp(h2.s + 15, 0, 100), clamp(h2.l + 5, 0, 100)),
    envColor3: hslToHex(h3.h, clamp(h3.s + 20, 0, 100), clamp(h3.l + 15, 0, 100)),
  };
}

type ScenePreset = (typeof SCENE_PRESETS)[number];

// ================================================================
// Procedural HDR environment map - verbatim from the original
// ================================================================
function createProceduralEnvMap(renderer: THREE.WebGLRenderer, preset: ScenePreset): THREE.Texture {
  const size = 512;
  const data = new Float32Array(size * size * 4);

  const envCol1 = hexToLinearRGB(preset.envColor1);
  const envCol2 = hexToLinearRGB(preset.envColor2);
  const envCol3 = hexToLinearRGB(preset.envColor3);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const phi = (u - 0.5) * 2 * Math.PI;
      const theta = v * Math.PI;
      const dirX = Math.sin(theta) * Math.cos(phi);
      const dirY = Math.cos(theta);
      const dirZ = Math.sin(theta) * Math.sin(phi);

      // Dark base
      let r = envCol1[0] * 0.03;
      let g = envCol1[1] * 0.03;
      let b = envCol1[2] * 0.03;

      // Broad ceiling light
      const ceiling = smoothstepJS(-0.1, 0.7, dirY);
      r += ceiling * envCol2[0] * 0.6;
      g += ceiling * envCol2[1] * 0.6;
      b += ceiling * envCol2[2] * 0.6;

      // Main softbox (soft-room.hdr style peaks)
      const sbDir = normalize3(0.4, 0.75, -0.2);
      const sbDist = dist3(dirX - sbDir[0], dirY - sbDir[1], dirZ - sbDir[2]);
      const softboxCore = Math.exp(-sbDist * sbDist * 8.0);
      const softboxMid = Math.exp(-sbDist * sbDist * 2.0);
      const softboxWide = Math.exp(-sbDist * sbDist * 0.5);
      r += softboxCore * envCol3[0] * 400.0;
      g += softboxCore * envCol3[1] * 400.0;
      b += softboxCore * envCol3[2] * 400.0;
      r += softboxMid * envCol2[0] * 60.0;
      g += softboxMid * envCol2[1] * 60.0;
      b += softboxMid * envCol2[2] * 60.0;
      r += softboxWide * envCol3[0] * 8.0;
      g += softboxWide * envCol3[1] * 8.0;
      b += softboxWide * envCol3[2] * 8.0;

      // Fill light
      const flDir = normalize3(-0.5, 0.3, 0.4);
      const flDist = dist3(dirX - flDir[0], dirY - flDir[1], dirZ - flDir[2]);
      const fill = Math.exp(-flDist * flDist * 4.0);
      r += fill * envCol2[0] * 30.0;
      g += fill * envCol2[1] * 30.0;
      b += fill * envCol2[2] * 30.0;

      // Floor bounce
      const floorBounce = Math.max(-dirY, 0.0);
      r += floorBounce * envCol1[0] * 0.08;
      g += floorBounce * envCol1[1] * 0.08;
      b += floorBounce * envCol1[2] * 0.08;

      const idx = (y * size + x) * 4;
      data[idx] = Math.max(0, r);
      data[idx + 1] = Math.max(0, g);
      data[idx + 2] = Math.max(0, b);
      data[idx + 3] = 1.0;
    }
  }

  const envTexture = new THREE.DataTexture(data as unknown as BufferSource, size, size, THREE.RGBAFormat, THREE.FloatType);
  envTexture.mapping = THREE.EquirectangularReflectionMapping;
  envTexture.needsUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileCubemapShader();
  const envMap = pmrem.fromEquirectangular(envTexture).texture;
  envTexture.dispose();
  pmrem.dispose();
  return envMap;
}

// ================================================================
// Fluted glass material - verbatim from the original FlutedGlassMaterial
// ================================================================
function createFlutedGlassMaterial(
  singleFluteWidth: number,
  params: GlassParams,
): THREE.MeshPhysicalMaterial {
  const mat = new THREE.MeshPhysicalMaterial({
    transmission: 1.0,
    roughness: 0,
    metalness: 0,
    ior: params.ior,
    thickness: params.thickness,
    specularIntensity: 0,
    specularColor: new THREE.Color(1, 1, 1),
    clearcoat: 0,
    clearcoatRoughness: 0,
    side: THREE.FrontSide,
    transparent: true,
    envMapIntensity: params.envIntensity,
  });

  const customUniforms = {
    singleFluteWidth: { value: singleFluteWidth },
    fluteExponent: { value: params.fluteExponent },
    fluteDepth: { value: params.fluteDepth },
  };

  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, customUniforms);

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
${FLUTE_FUNCTIONS_GLSL}`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
{
    // Flute normal computation (direct port from original)
    float u = getFluteU(vWorldPosition.x);
    vec2 squircleNormalXZ = getSquircleNormalXZ(u, fluteExponent);
    vec3 fluteNormalModel = vec3(squircleNormalXZ.x, 0.0, squircleNormalXZ.y);
    vec3 blendedNormalModel = normalize(mix(vec3(0.0, 0.0, 1.0), fluteNormalModel, fluteDepth));
    normal = normalize(mat3(viewMatrix) * mat3(modelMatrix) * blendedNormalModel);
}`,
    );

    mat.userData.shader = shader;
  };

  mat.needsUpdate = true;
  return mat;
}

export function createFractalGlassEffect(options?: { post?: boolean }): Effect {
  // Post-overlay variant (layerRole 'post'): instead of decaying the fluid color
  // toward a self-generated radial background, the fluid decays toward the
  // COMPOSITED SCENE BENEATH this layer (delivered by the compositor each frame
  // via onBeneath). The fluted glass then refracts that beneath-scene, with the
  // pointer still stirring the fluid - so it reads as a live glass overlay on top
  // of whatever lower layers render. Falls back to the generated background until
  // a beneath frame arrives (e.g. when run as a standalone single effect).
  const postMode = options?.post === true;
  let dead = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let glassMaterial: THREE.MeshPhysicalMaterial | null = null;
  let bgMaterial: THREE.MeshBasicMaterial | null = null;
  let glassGeo: THREE.PlaneGeometry | null = null;
  let bgGeo: THREE.PlaneGeometry | null = null;
  let glassMesh: THREE.Mesh | null = null;
  let bgMesh: THREE.Mesh | null = null;
  let bgTex: THREE.DataTexture | null = null;
  let envMap: THREE.Texture | null = null;
  let sim: FluidSimState | null = null;

  let viewW = 256;
  let viewH = 256;
  let sizeWidth = 1; // = aspect
  let lastT = 0;
  let timeAccum = 0;
  let lastBgRebuild = 0;
  let lastTonalKey = '';
  let sceneDirty = false;
  const phase = { x: Math.random() * Math.PI * 2, y: Math.random() * Math.PI * 2 };

  const pointerLatest = new THREE.Vector3(0.5, 0.5, 1);
  const pointerUV = new THREE.Vector3(0.5, 0.5, 1);
  const pointerUVLast = new THREE.Vector3(0.5, 0.5, 1);

  // Live canvas (for normalizing pixel pointer coords by CSS size) + the
  // beneath-scene texture used by the post-overlay variant.
  let canvasEl: HTMLCanvasElement | null = null;
  let beneathTex: THREE.CanvasTexture | null = null;

  let sceneIdx = 0;

  const p: GlassParams = {
    scene: 0,
    fluidInfluence: 0.3,
    turbulence: 0.1,
    glassAmount: 0.5,
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
    bloomStrength: 0.3,
    baseColor1: SCENE_PRESETS[0].baseColor1,
    baseColor2: SCENE_PRESETS[0].baseColor2,
    baseColor3: SCENE_PRESETS[0].baseColor3,
    baseColor4: SCENE_PRESETS[0].baseColor4,
    envColor1: SCENE_PRESETS[0].envColor1,
    envColor2: SCENE_PRESETS[0].envColor2,
    envColor3: SCENE_PRESETS[0].envColor3,
    autoEnv: true,
  };

  // Active palette from the live params (preset-seeded or picker-overridden).
  function preset(): ScenePreset {
    return {
      baseColor1: p.baseColor1,
      baseColor2: p.baseColor2,
      baseColor3: p.baseColor3,
      baseColor4: p.baseColor4,
      envColor1: p.envColor1,
      envColor2: p.envColor2,
      envColor3: p.envColor3,
    };
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      for (const k of Object.keys(p) as (keyof GlassParams)[]) {
        if (k in opts.params) this.setParam(k, opts.params[k]);
      }
      sceneDirty = false;

      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      canvasEl = canvas;
      try {
        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        });
      } catch {
        dead = true;
        return;
      }
      viewW = canvas.width || 256;
      viewH = canvas.height || 256;
      renderer.setSize(viewW, viewH, false);
      renderer.toneMapping = THREE.NeutralToneMapping;
      renderer.toneMappingExposure = 1.0;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.autoClear = false;

      const aspect = viewW / Math.max(1, viewH);
      sizeWidth = aspect;
      const sizeHeight = 1;
      const singleFluteWidth = sizeWidth / p.fluteCount;

      camera = new THREE.OrthographicCamera(
        -sizeWidth / 2, sizeWidth / 2,
        sizeHeight / 2, -sizeHeight / 2,
        0.0001, 5,
      );
      camera.position.set(0, 0, 1);
      camera.lookAt(0, 0, 0);

      scene = new THREE.Scene();
      scene.backgroundIntensity = 0;
      scene.backgroundBlurriness = 0.7;

      // Environment map (procedural HDR, PMREM-prefiltered).
      envMap = createProceduralEnvMap(renderer, preset());
      scene.environment = envMap;
      scene.environmentIntensity = 1.0;
      scene.environmentRotation = new THREE.Euler(0, -1.73, 0);

      // Background texture (drifting 4-stop radial the fluid color decays toward).
      const initCx = 0.5 + 0.18 * Math.sin(phase.x);
      const initCy = 0.5 + 0.18 * Math.cos(phase.y);
      bgTex = createBackgroundTexture(preset(), 512, 512, {
        highlight: p.highlight, midtone: p.midtone, shadow: p.shadow,
      }, { x: initCx, y: initCy });

      // Fluid sim (color buffer 512, sim 0.25 -> 128).
      sim = createFluidSim(renderer, 512, 512, false, FLUID);
      sim.sharedUniforms.velocityBoundaryEnabled.value = false;
      sim.paintColorMat.uniforms.uBackgroundTexture.value = bgTex;

      // Fluid display plane (visible through the glass).
      bgMaterial = new THREE.MeshBasicMaterial({
        map: sim.color.getTexture(),
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      bgGeo = new THREE.PlaneGeometry(sizeWidth, sizeHeight, 1, 1);
      bgMesh = new THREE.Mesh(bgGeo, bgMaterial);
      bgMesh.position.z = -0.01;
      bgMesh.frustumCulled = false;
      scene.add(bgMesh);

      // Fluted glass plane.
      glassMaterial = createFlutedGlassMaterial(singleFluteWidth, p);
      glassGeo = new THREE.PlaneGeometry(sizeWidth, sizeHeight, 1, 1);
      glassMesh = new THREE.Mesh(glassGeo, glassMaterial);
      glassMesh.frustumCulled = false;
      scene.add(glassMesh);

      lastTonalKey = `s${sceneIdx}:${p.highlight}:${p.midtone}:${p.shadow}:${p.baseColor1}${p.baseColor2}${p.baseColor3}${p.baseColor4}`;
    },

    frame(t: number) {
      if (dead || !renderer || !scene || !camera || !sim || !bgTex || !glassMaterial || !bgMesh) return;
      const now = t;
      const dt = lastT === 0 ? 1 / 60 : Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      timeAccum += dt;

      // Scene/theme change - regenerate env map + flush fluid color buffer.
      if (sceneDirty) {
        sceneDirty = false;
        if (envMap) envMap.dispose();
        envMap = createProceduralEnvMap(renderer, preset());
        scene.environment = envMap;
        sim.color.clear(renderer);
      }

      // Drifting gradient center (Lissajous) + tonal/scene rebuild (~5fps).
      const driftCx = 0.5 + 0.18 * Math.sin(timeAccum * 0.04 + phase.x);
      const driftCy = 0.5 + 0.18 * Math.cos(timeAccum * 0.03 + phase.y);
      const tonalKey = `s${sceneIdx}:${p.highlight}:${p.midtone}:${p.shadow}:${p.baseColor1}${p.baseColor2}${p.baseColor3}${p.baseColor4}`;
      const tonalChanged = tonalKey !== lastTonalKey;
      const driftDue = now - lastBgRebuild > 200;
      if (tonalChanged || driftDue) {
        lastTonalKey = tonalKey;
        lastBgRebuild = now;
        bgTex.dispose();
        bgTex = createBackgroundTexture(preset(), 512, 512, {
          highlight: p.highlight, midtone: p.midtone, shadow: p.shadow,
        }, { x: driftCx, y: driftCy });
        sim.paintColorMat.uniforms.uBackgroundTexture.value = bgTex;
      }

      // Material uniforms
      glassMaterial.ior = p.ior;
      glassMaterial.thickness = p.thickness;
      glassMaterial.roughness = p.roughness;
      glassMaterial.envMapIntensity = p.envIntensity;
      const shader = glassMaterial.userData.shader as
        | { uniforms: Record<string, THREE.IUniform> }
        | undefined;
      if (shader) {
        const currentSW = sizeWidth / p.fluteCount;
        if (shader.uniforms.singleFluteWidth) shader.uniforms.singleFluteWidth.value = currentSW;
        if (shader.uniforms.fluteExponent) shader.uniforms.fluteExponent.value = p.fluteExponent;
        if (shader.uniforms.fluteDepth) shader.uniforms.fluteDepth.value = p.fluteDepth;
      }

      // Per-frame pointer shift (latest -> current), with large-jump clamp.
      pointerUVLast.copy(pointerUV);
      pointerUV.copy(pointerLatest);
      const dxp = pointerUVLast.x - pointerUV.x;
      const dyp = pointerUVLast.y - pointerUV.y;
      const dSq = dxp * dxp + dyp * dyp;
      const maxJump = 0.5;
      if (dSq > maxJump * maxJump) {
        const d = Math.sqrt(dSq);
        pointerUVLast.x = pointerUV.x + (dxp / d) * maxJump;
        pointerUVLast.y = pointerUV.y + (dyp / d) * maxJump;
      }
      sim.paintVelocityMat.uniforms.uPointer.value.copy(pointerUV);
      sim.paintVelocityMat.uniforms.uPointerLast.value.copy(pointerUVLast);
      sim.paintVelocityMat.uniforms.uTime_s.value = timeAccum;
      sim.paintColorMat.uniforms.uTime_s.value = timeAccum;

      const turbMult = 0.5 + p.turbulence * 1.5;
      sim.paintVelocityMat.uniforms.uCurlParameters.value.x = FLUID_CURL_STRENGTH * turbMult;

      // Post-overlay: decay the fluid color toward the live scene beneath this
      // layer instead of the generated radial. Re-asserted every frame because
      // the drift/scene blocks above point uBackgroundTexture back at bgTex.
      if (postMode && beneathTex) {
        beneathTex.needsUpdate = true;
        sim.paintColorMat.uniforms.uBackgroundTexture.value = beneathTex;
      }

      stepFluidSim(renderer, sim, dt);

      const bgMat = bgMesh.material as THREE.MeshBasicMaterial;
      bgMat.map = sim.color.getTexture();
      bgMat.needsUpdate = true;

      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !camera) return;
      viewW = Math.max(1, w);
      viewH = Math.max(1, h);
      renderer.setSize(viewW, viewH, false);
      const aspect = viewW / viewH;
      sizeWidth = aspect;
      camera.left = -aspect / 2;
      camera.right = aspect / 2;
      camera.top = 0.5;
      camera.bottom = -0.5;
      camera.updateProjectionMatrix();
      if (glassMesh) {
        glassMesh.geometry.dispose();
        glassMesh.geometry = new THREE.PlaneGeometry(aspect, 1, 1, 1);
      }
      if (bgMesh) {
        bgMesh.geometry.dispose();
        bgMesh.geometry = new THREE.PlaneGeometry(aspect, 1, 1, 1);
      }
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'scene': {
          // Named presets seed all 4 base + 3 env colors (the original
          // selectScene). "Custom" (scene = -1) keeps the current palette for
          // live editing via the GRADIENT BUILDER pickers.
          const sval = String(value);
          if (sval === 'Custom' || sval === '-1') {
            sceneIdx = -1;
            p.scene = -1;
            sceneDirty = true;
            break;
          }
          let idx = SCENE_NAMES.indexOf(sval as (typeof SCENE_NAMES)[number]);
          if (idx < 0) idx = Number(sval); // numeric fallback
          if (SCENE_PRESETS[idx]) {
            const sp = SCENE_PRESETS[idx];
            sceneIdx = idx;
            p.scene = idx;
            p.baseColor1 = sp.baseColor1;
            p.baseColor2 = sp.baseColor2;
            p.baseColor3 = sp.baseColor3;
            p.baseColor4 = sp.baseColor4;
            p.envColor1 = sp.envColor1;
            p.envColor2 = sp.envColor2;
            p.envColor3 = sp.envColor3;
            sceneDirty = true;
          }
          break;
        }
        case 'baseColor1':
        case 'baseColor2':
        case 'baseColor3':
        case 'baseColor4': {
          p[key] = String(value);
          // AUTO ENV COLORS: re-derive env from base 1/2/3 on each base edit,
          // exactly as the original updateBaseColor when autoEnv is on. Only in
          // Custom mode; named presets keep their literal env colors.
          if (sceneIdx === -1 && p.autoEnv) {
            const d = deriveEnvColors(p.baseColor1, p.baseColor2, p.baseColor3);
            p.envColor1 = d.envColor1;
            p.envColor2 = d.envColor2;
            p.envColor3 = d.envColor3;
          }
          sceneDirty = true;
          break;
        }
        case 'envColor1':
        case 'envColor2':
        case 'envColor3':
          // Manual env edits only take when autoEnv is off (original disables
          // the env pickers while autoEnv is on); always store the value.
          p[key] = String(value);
          sceneDirty = true;
          break;
        case 'autoEnv':
          p.autoEnv = Boolean(value);
          if (sceneIdx === -1 && p.autoEnv) {
            const d = deriveEnvColors(p.baseColor1, p.baseColor2, p.baseColor3);
            p.envColor1 = d.envColor1;
            p.envColor2 = d.envColor2;
            p.envColor3 = d.envColor3;
          }
          sceneDirty = true;
          break;
        // fluidInfluence / glassAmount / bloomStrength: present in the original's
        // param set with these defaults but left inert by the original render
        // pipeline; stored here to preserve the full param surface 1:1.
        case 'fluidInfluence':
          p.fluidInfluence = Number(value);
          break;
        case 'glassAmount':
          p.glassAmount = Number(value);
          break;
        case 'bloomStrength':
          p.bloomStrength = Number(value);
          break;
        case 'turbulence':
          p.turbulence = Number(value);
          break;
        case 'highlight':
          p.highlight = Number(value);
          break;
        case 'midtone':
          p.midtone = Number(value);
          break;
        case 'shadow':
          p.shadow = Number(value);
          break;
        case 'fluteCount':
          p.fluteCount = Number(value);
          break;
        case 'fluteExponent':
          p.fluteExponent = Number(value);
          break;
        case 'fluteDepth':
          p.fluteDepth = Number(value);
          break;
        case 'ior':
          p.ior = Number(value);
          break;
        case 'thickness':
          p.thickness = Number(value);
          break;
        case 'roughness':
          p.roughness = Number(value);
          break;
        case 'envIntensity':
          p.envIntensity = Number(value);
          break;
        default:
          break;
      }
    },

    // Pointer drives the fluid sim. Coords arrive as canvas-relative PIXELS;
    // normalize to the sim's [0,1] uPointer (y-up). z = pressed ? 1 : 0: the
    // paintVelocity shader applies the drag force when z < 0.5, so hovering
    // stirs the glass and pressing pauses the force - verbatim regent behavior.
    onPointer(x: number, y: number, pressed?: boolean) {
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      const w = canvasEl?.clientWidth || viewW;
      const h = canvasEl?.clientHeight || viewH;
      const uv = pointerUVFromPixel(x, y, w, h, pressed);
      pointerLatest.set(uv.x, uv.y, uv.z);
    },

    // Post-overlay input: the composited scene beneath this layer, delivered as a
    // 2D canvas each frame. Upload it into a reused CanvasTexture; frame() points
    // the fluid's background uniform at it so the glass refracts the beneath scene.
    onBeneath(source: HTMLCanvasElement) {
      if (dead) return;
      if (!beneathTex) {
        beneathTex = new THREE.CanvasTexture(source);
        beneathTex.colorSpace = THREE.SRGBColorSpace;
        beneathTex.minFilter = THREE.LinearFilter;
        beneathTex.magFilter = THREE.LinearFilter;
        beneathTex.generateMipmaps = false;
      } else {
        beneathTex.image = source;
      }
      beneathTex.needsUpdate = true;
    },

    dispose() {
      glassGeo?.dispose();
      bgGeo?.dispose();
      glassMaterial?.dispose();
      bgMaterial?.dispose();
      bgTex?.dispose();
      beneathTex?.dispose();
      beneathTex = null;
      canvasEl = null;
      envMap?.dispose();
      if (sim) disposeFluidSim(sim);
      renderer?.dispose();
      glassGeo = null;
      bgGeo = null;
      glassMaterial = null;
      bgMaterial = null;
      bgTex = null;
      envMap = null;
      sim = null;
      renderer = null;
      scene = null;
      camera = null;
      glassMesh = null;
      bgMesh = null;
      dead = true;
    },
  };
}

/**
 * Post-overlay variant: the fluted glass refracts the COMPOSITED SCENE BENEATH
 * this layer (fed each frame via onBeneath) instead of a self-generated fluid
 * background. Registered as a separate 'fractal-glass-post' effect (layerRole
 * 'post'). Pointer still stirs the fluid, so the beneath scene ripples under the
 * glass live.
 */
export function createFractalGlassPostEffect(): Effect {
  return createFractalGlassEffect({ post: true });
}
