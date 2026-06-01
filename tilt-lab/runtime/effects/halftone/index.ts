import type { Effect, EffectOpts } from '../../types';
import * as THREE from 'three';
import {
  createFluidSim,
  stepFluidSim,
  disposeFluidSim,
  createBackgroundTexture,
  pointerUVFromPixel,
  type FluidSimState,
  type FluidConstants,
} from '../../lib/fluid-solver';
import {
  HALFTONE_PRESETS as SCENE_PRESETS,
  HALFTONE_SCENE_NAMES as SCENE_NAMES,
} from './presets';

/**
 * Halftone - the verbatim regent halftone tool. A Three.js GPU stable-fluid
 * field (shared runtime/lib/fluid-solver sim) decays toward a drifting 4-stop
 * radial background and is sampled per-cell by the verbatim rotated-dot halftone
 * post shader. Fluid lineage: IndiciumAI bundle (FluidSimulation / MainScene).
 *
 * The wrapper drives frame(t); no RAF is owned. Pointer arrives via onPointer.
 * Headless-safe: with no WebGL context (happy-dom) init marks the effect dead
 * and every method no-ops.
 */

// Fluid sim constants (verbatim from the original MainScene constructor).
const FLUID: FluidConstants = {
  iterations: 2, // FLUID_ITERATIONS
  timeScale: 0.1, // FLUID_TIME_SCALE
  velocityDecay: 2.5, // FLUID_VELOCITY_DECAY
  colorDecay: 4.0, // FLUID_COLOR_DECAY
  pointerSpread: 150, // FLUID_POINTER_SPREAD
  curlStrength: 0.035, // FLUID_CURL_STRENGTH
  curlScale: 1.5, // FLUID_CURL_SCALE
  curlChangeRate: 0.025, // FLUID_CURL_CHANGE_RATE
  pointerStrength: 0.35, // FLUID_POINTER_STRENGTH
  pointerDrag: 0.32, // FLUID_POINTER_DRAG
  simTextureScale: 0.25, // FLUID_SIM_TEXTURE_SCALE
  physicsScale: 1, // FLUID_PHYSICS_SCALE (dx)
};
const FLUID_CURL_STRENGTH = FLUID.curlStrength;

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

  // Rotate into grid space
  float angleRad = uGridAngle * 3.14159265 / 180.0;
  vec2 rotated = rotatePoint(pixelCoord, angleRad);

  // Cell center in rotated space
  vec2 cellSize = vec2(uDotSize);
  vec2 cell = floor(rotated / cellSize);
  vec2 cellCenter = (cell + 0.5) * cellSize;

  // Unrotate cell center back to UV space for sampling
  vec2 cellCenterPx = rotatePoint(cellCenter, -angleRad);
  vec2 cellUV = cellCenterPx / uResolution;

  // Clamp UV to valid range
  cellUV = clamp(cellUV, vec2(0.0), vec2(1.0));

  // Sample source color at cell center
  vec4 srcColor = texture2D(uSource, cellUV);

  // Luminance-only lift: brighten darks WITHOUT desaturating
  float srcLuma = max(dot(srcColor.rgb, vec3(0.299, 0.587, 0.114)), 0.001);
  float liftedLuma = pow(srcLuma, 0.5);
  float liftScale = liftedLuma / srcLuma;
  vec3 lifted = srcColor.rgb * liftScale;

  // Soft clamp: if any channel would blow past 1.0, normalize down
  float maxChan = max(max(lifted.r, lifted.g), lifted.b);
  if (maxChan > 1.0) lifted /= maxChan;

  // Push saturation further - counteract any residual grey
  float avg = (lifted.r + lifted.g + lifted.b) / 3.0;
  lifted = max(mix(vec3(avg), lifted, 1.5), vec3(0.0));

  // Luminance from saturated lifted color for dot sizing
  float luma = dot(lifted, vec3(0.299, 0.587, 0.114));

  // Apply contrast curve
  luma = pow(clamp(luma, 0.0, 1.0), 1.0 / max(uContrast, 0.05));

  // Invert if requested
  float sizeFactor = mix(luma, 1.0 - luma, uInvert);

  // Dot radius proportional to brightness
  float maxRadius = uDotSize * 0.5;
  float radius = maxRadius * sqrt(sizeFactor);

  // Distance from this pixel to cell center (in rotated space)
  float dist = distance(rotated, cellCenter);

  // Smooth edge
  float edgePx = max(uSoftness * 2.0, 0.5);
  float dotMask = 1.0 - smoothstep(radius - edgePx, radius + edgePx, dist);

  // Subtle dark floor between dots
  vec3 baseColor = lifted * 0.08;
  vec3 finalColor = mix(baseColor, lifted, dotMask);

  gl_FragColor = vec4(finalColor, 1.0);
}
`;

interface HalftoneParams {
  scene: number;
  fluidInfluence: number;
  turbulence: number;
  highlight: number;
  midtone: number;
  shadow: number;
  dotSize: number;
  gridAngle: number;
  contrast: number;
  softness: number;
  invert: boolean;
  // The 4 base colors that drive the radial source field. Named presets seed
  // these; editing any one (= the original's Custom mode, scene === -1) lets the
  // pickers override the palette live.
  baseColor1: string;
  baseColor2: string;
  baseColor3: string;
  baseColor4: string;
}

// SCENE_NAMES / SCENE_PRESETS imported from ./presets (single source of truth,
// shared with the central preset registry and the halftone-post variant).

export function createHalftoneEffect(options?: { post?: boolean }): Effect {
  // Post-overlay variant (layerRole 'post'): the fluid decays toward the
  // COMPOSITED SCENE BENEATH this layer (fed each frame via onBeneath) instead of
  // a self-generated radial, so the halftone shader dots the live scene below,
  // with the pointer still stirring the fluid. Falls back to the generated
  // background until a beneath frame arrives (e.g. as a standalone single effect).
  const postMode = options?.post === true;
  let dead = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.OrthographicCamera | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let geometry: THREE.PlaneGeometry | null = null;
  let bgTex: THREE.DataTexture | null = null;
  let sim: FluidSimState | null = null;

  let viewW = 256;
  let viewH = 256;
  let lastT = 0;
  let timeAccum = 0;
  let lastBgRebuild = 0;
  let lastTonalKey = '';
  let sceneDirty = false;
  const phase = { x: Math.random() * Math.PI * 2, y: Math.random() * Math.PI * 2 };

  // Pointer (buffered into pointerLatest by onPointer; shifted per-frame).
  const pointerLatest = new THREE.Vector3(0.5, 0.5, 1);
  const pointerUV = new THREE.Vector3(0.5, 0.5, 1);
  const pointerUVLast = new THREE.Vector3(0.5, 0.5, 1);

  // Live canvas (to normalize pixel pointer coords) + the beneath-scene texture
  // sourced by the post-overlay variant.
  let canvasEl: HTMLCanvasElement | null = null;
  let beneathTex: THREE.CanvasTexture | null = null;

  let sceneIdx = 0;

  const p: HalftoneParams = {
    scene: 0,
    fluidInfluence: 0.3,
    turbulence: 0.1,
    highlight: 1.2,
    midtone: 1.5,
    shadow: 1.0,
    dotSize: 12,
    gridAngle: 15,
    contrast: 1.0,
    softness: 0.4,
    invert: false,
    baseColor1: SCENE_PRESETS[0].baseColor1,
    baseColor2: SCENE_PRESETS[0].baseColor2,
    baseColor3: SCENE_PRESETS[0].baseColor3,
    baseColor4: SCENE_PRESETS[0].baseColor4,
  };

  // The active palette: live base colors (preset-seeded or picker-overridden)
  // for the radial source field; env colors carried from the preset (unused by
  // the halftone renderer but kept 1:1 with the original ScenePreset).
  function preset() {
    const env = SCENE_PRESETS[sceneIdx >= 0 ? sceneIdx : 0] || SCENE_PRESETS[0];
    return {
      baseColor1: p.baseColor1,
      baseColor2: p.baseColor2,
      baseColor3: p.baseColor3,
      baseColor4: p.baseColor4,
      envColor1: env.envColor1,
      envColor2: env.envColor2,
      envColor3: env.envColor3,
    };
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      for (const k of Object.keys(p) as (keyof HalftoneParams)[]) {
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
          alpha: false,
          powerPreference: 'high-performance',
        });
      } catch {
        dead = true;
        return;
      }
      viewW = canvas.width || 256;
      viewH = canvas.height || 256;
      renderer.setSize(viewW, viewH, false);
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.autoClear = false;

      const aspect = viewW / Math.max(1, viewH);
      const sizeWidth = aspect;
      const sizeHeight = 1;
      camera = new THREE.OrthographicCamera(
        -sizeWidth / 2, sizeWidth / 2,
        sizeHeight / 2, -sizeHeight / 2,
        0.0001, 5,
      );
      camera.position.set(0, 0, 1);
      camera.lookAt(0, 0, 0);

      scene = new THREE.Scene();

      // Background texture (drifting 4-stop radial the fluid color decays toward).
      const initCx = 0.5 + 0.18 * Math.sin(phase.x);
      const initCy = 0.5 + 0.18 * Math.cos(phase.y);
      bgTex = createBackgroundTexture(preset(), 512, 512, {
        highlight: p.highlight, midtone: p.midtone, shadow: p.shadow,
      }, { x: initCx, y: initCy });

      // Fluid sim (color buffer 512, sim 0.25 -> 128). periodicBoundary=false
      // gives ClampToEdge textures; original then disables the velocity boundary.
      sim = createFluidSim(renderer, 512, 512, false, FLUID);
      sim.sharedUniforms.velocityBoundaryEnabled.value = false;
      sim.paintColorMat.uniforms.uBackgroundTexture.value = bgTex;

      material = new THREE.ShaderMaterial({
        vertexShader: HALFTONE_VERTEX,
        fragmentShader: HALFTONE_FRAGMENT,
        uniforms: {
          uSource: { value: sim.color.getTexture() },
          uResolution: { value: new THREE.Vector2(viewW, viewH) },
          uDotSize: { value: p.dotSize },
          uGridAngle: { value: p.gridAngle },
          uContrast: { value: p.contrast },
          uSoftness: { value: p.softness },
          uInvert: { value: p.invert ? 1 : 0 },
        },
        depthTest: false,
        depthWrite: false,
      });
      geometry = new THREE.PlaneGeometry(sizeWidth, sizeHeight, 1, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false;
      scene.add(mesh);

      lastTonalKey = `s${sceneIdx}:${p.highlight}:${p.midtone}:${p.shadow}:${p.baseColor1}${p.baseColor2}${p.baseColor3}${p.baseColor4}`;
    },

    frame(t: number) {
      if (dead || !renderer || !scene || !camera || !material || !sim || !bgTex) return;
      const now = t;
      const dt = lastT === 0 ? 1 / 60 : Math.min((t - lastT) / 1000, 0.05);
      lastT = t;
      timeAccum += dt;

      // Scene/theme change - flush fluid color buffer so old palette doesn't linger.
      if (sceneDirty) {
        sceneDirty = false;
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

      // Halftone uniforms
      material.uniforms.uDotSize.value = p.dotSize;
      material.uniforms.uGridAngle.value = p.gridAngle;
      material.uniforms.uContrast.value = p.contrast;
      material.uniforms.uSoftness.value = p.softness;
      material.uniforms.uInvert.value = p.invert ? 1 : 0;

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

      // Turbulence scales curl strength (verbatim formula).
      const turbMult = 0.5 + p.turbulence * 1.5;
      sim.paintVelocityMat.uniforms.uCurlParameters.value.x = FLUID_CURL_STRENGTH * turbMult;

      // Post-overlay: decay the fluid color toward the live scene beneath this
      // layer instead of the generated radial. Re-asserted each frame because the
      // drift/scene blocks above point uBackgroundTexture back at bgTex.
      if (postMode && beneathTex) {
        beneathTex.needsUpdate = true;
        sim.paintColorMat.uniforms.uBackgroundTexture.value = beneathTex;
      }

      stepFluidSim(renderer, sim, dt);

      material.uniforms.uSource.value = sim.color.getTexture();

      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.render(scene, camera);
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !material || !camera) return;
      viewW = Math.max(1, w);
      viewH = Math.max(1, h);
      renderer.setSize(viewW, viewH, false);
      const aspect = viewW / viewH;
      camera.left = -aspect / 2;
      camera.right = aspect / 2;
      camera.top = 0.5;
      camera.bottom = -0.5;
      camera.updateProjectionMatrix();
      if (geometry) geometry.dispose();
      geometry = new THREE.PlaneGeometry(aspect, 1, 1, 1);
      const mesh = scene?.children[0] as THREE.Mesh | undefined;
      if (mesh) mesh.geometry = geometry;
      (material.uniforms.uResolution.value as THREE.Vector2).set(viewW, viewH);
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'scene': {
          // Named presets seed all 4 base colors (like the original selectScene);
          // "Custom" (scene = -1) keeps the current base colors for live editing.
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
            sceneIdx = idx;
            p.scene = idx;
            p.baseColor1 = SCENE_PRESETS[idx].baseColor1;
            p.baseColor2 = SCENE_PRESETS[idx].baseColor2;
            p.baseColor3 = SCENE_PRESETS[idx].baseColor3;
            p.baseColor4 = SCENE_PRESETS[idx].baseColor4;
            sceneDirty = true;
          }
          break;
        }
        case 'baseColor1':
        case 'baseColor2':
        case 'baseColor3':
        case 'baseColor4':
          p[key] = String(value);
          sceneDirty = true;
          break;
        // fluidInfluence: in the original's param set with this default but left
        // inert by the original render pipeline; stored to preserve the param surface 1:1.
        case 'fluidInfluence':
          p.fluidInfluence = Number(value);
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
        case 'dotSize':
          p.dotSize = Number(value);
          break;
        case 'gridAngle':
          p.gridAngle = Number(value);
          break;
        case 'contrast':
          p.contrast = Number(value);
          break;
        case 'softness':
          p.softness = Number(value);
          break;
        case 'invert':
          p.invert = Boolean(value);
          break;
        default:
          break;
      }
    },

    // Pointer drives the fluid sim. Coords arrive as canvas-relative PIXELS;
    // normalize to [0,1] uPointer (y-up). z = pressed ? 1 : 0: the paintVelocity
    // shader applies the drag force when z < 0.5, so hovering stirs the field and
    // pressing pauses it - verbatim regent behavior.
    onPointer(x: number, y: number, pressed?: boolean) {
      if (Number.isNaN(x) || Number.isNaN(y)) return;
      const w = canvasEl?.clientWidth || viewW;
      const h = canvasEl?.clientHeight || viewH;
      const uv = pointerUVFromPixel(x, y, w, h, pressed);
      pointerLatest.set(uv.x, uv.y, uv.z);
    },

    // Post-overlay input: the composited scene beneath this layer as a 2D canvas
    // each frame. Upload into a reused CanvasTexture; frame() points the fluid's
    // background uniform at it so the halftone dots the live beneath scene.
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
      geometry?.dispose();
      material?.dispose();
      bgTex?.dispose();
      beneathTex?.dispose();
      beneathTex = null;
      canvasEl = null;
      if (sim) disposeFluidSim(sim);
      renderer?.dispose();
      geometry = null;
      material = null;
      bgTex = null;
      sim = null;
      renderer = null;
      scene = null;
      camera = null;
      dead = true;
    },
  };
}

/**
 * Post-overlay variant: the halftone shader dots the COMPOSITED SCENE BENEATH
 * this layer (fed each frame via onBeneath) instead of a self-generated fluid
 * background. Registered as a separate 'halftone-post' effect (layerRole 'post').
 * Pointer still stirs the fluid, so the beneath scene ripples under the dots live.
 */
export function createHalftonePostEffect(): Effect {
  return createHalftoneEffect({ post: true });
}
