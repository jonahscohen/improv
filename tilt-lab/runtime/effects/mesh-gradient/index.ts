import type { Effect, EffectOpts } from '../../types';
import * as THREE from 'three';
import { MESH_SCENE_NAMES, MESH_SCENE_PALETTES, DEFAULT_MESH_COLORS } from './presets';

/**
 * Mesh Gradient - a 200x200 subdivided plane displaced and colored in the
 * vertex shader (layered simplex-noise thresholding), with grain + Bayer dither
 * in the fragment shader. Verbatim shaders from regent's mesh-gradient tool
 * (technique credit gradients.juangarcia.ch). Three.js.
 *
 * Headless-safe: if no WebGL context is available (happy-dom), init marks the
 * effect dead and every method no-ops.
 */

const VERTEX_SHADER = /* glsl */ `
uniform vec2 uFrequency;
uniform float uTime;
uniform float uAmount;
uniform float uSpeed;
uniform vec3 uColor[5];
uniform int uColorCount;
uniform mat3 uOrbitMatrix;

varying vec2 vUv;
varying vec3 vColor;

vec4 permute(vec4 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
}
vec4 taylorInvSqrt(vec4 r) {
    return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
        i.z + vec4(0.0, i1.z, i2.z, 1.0))
        + i.y + vec4(0.0, i1.y, i2.y, 1.0))
        + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0 / 7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

void main() {
    vec4 modelPosition = modelMatrix * vec4(position, 1.0);
    vec2 noiseCoord = uv * uFrequency;
    float displacementNoise = snoise(vec3(
        noiseCoord.x + uTime * 0.02,
        noiseCoord.y,
        uTime * uSpeed
    ));
    modelPosition.y += displacementNoise * uAmount;

    int lastIdx = uColorCount - 1;
    vColor = uColor[4];
    if (lastIdx == 0) vColor = uColor[0];
    else if (lastIdx == 1) vColor = uColor[1];
    else if (lastIdx == 2) vColor = uColor[2];
    else if (lastIdx == 3) vColor = uColor[3];
    else vColor = uColor[4];

    int layerCount = uColorCount - 1;
    if (layerCount > 4) layerCount = 4;
    for (int i = 0; i < 4; i++) {
        if (i >= layerCount) break;
        float fi = float(i);
        float noiseFlow = 0.0002 + fi * 0.05;
        float noiseSpeed = 0.0001 + fi * 0.03;
        float noiseSeed = 1.0 + fi * 10.0;
        vec2 noiseFreq = vec2(0.3, 0.6);
        float noiseFloor = 0.1;
        float noiseCeiling = 0.6 + fi * 0.08;
        vec3 nCoord = vec3(
            noiseCoord.x * noiseFreq.x + uTime * noiseFlow,
            noiseCoord.y * noiseFreq.y,
            uTime * noiseSpeed + noiseSeed
        );
        nCoord = uOrbitMatrix * nCoord;
        float noise = smoothstep(noiseFloor, noiseCeiling, snoise(nCoord));
        vColor = mix(vColor, uColor[i], noise);
    }

    vec4 viewPosition = viewMatrix * modelPosition;
    vec4 projectedPosition = projectionMatrix * viewPosition;
    gl_Position = projectedPosition;
    vUv = uv;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vColor;
uniform float uTime;
uniform float uGrainIntensity;
uniform bool uDitherEnabled;
uniform float uDitherStrength;

float bayerDither4x4(vec2 pos) {
    int x = int(mod(pos.x, 4.0));
    int y = int(mod(pos.y, 4.0));
    int index = x + y * 4;
    if (index == 0) return 0.0 / 16.0;
    if (index == 1) return 8.0 / 16.0;
    if (index == 2) return 2.0 / 16.0;
    if (index == 3) return 10.0 / 16.0;
    if (index == 4) return 12.0 / 16.0;
    if (index == 5) return 4.0 / 16.0;
    if (index == 6) return 14.0 / 16.0;
    if (index == 7) return 6.0 / 16.0;
    if (index == 8) return 3.0 / 16.0;
    if (index == 9) return 11.0 / 16.0;
    if (index == 10) return 1.0 / 16.0;
    if (index == 11) return 9.0 / 16.0;
    if (index == 12) return 15.0 / 16.0;
    if (index == 13) return 7.0 / 16.0;
    if (index == 14) return 13.0 / 16.0;
    return 5.0 / 16.0;
}
float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
}
void main() {
    vec3 color = vColor;
    if (uGrainIntensity > 0.0) {
        float grain = rand(gl_FragCoord.xy + vec2(uTime * 100.0)) - 0.5;
        color += grain * uGrainIntensity;
    }
    if (uDitherEnabled) {
        float dither = bayerDither4x4(gl_FragCoord.xy) - 0.5;
        color += dither * uDitherStrength;
    }
    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
}
`;

// Scene presets live in ./presets (single source, shared with the playground
// store's preset-expansion). SCENE_PRESETS is the array-of-palettes form the
// effect indexes by scene name/index.
const SCENE_PRESETS = MESH_SCENE_PALETTES;
const DEFAULT_COLORS = DEFAULT_MESH_COLORS;

function toColorArray(stops: string[]): { colors: THREE.Vector3[]; count: number } {
  const count = Math.min(Math.max(stops.length, 1), 5);
  const colors: THREE.Vector3[] = [];
  for (let i = 0; i < 5; i++) {
    const hex = stops[Math.min(i, stops.length - 1)] ?? DEFAULT_COLORS[i];
    const c = new THREE.Color(hex);
    colors.push(new THREE.Vector3(c.r, c.g, c.b));
  }
  return { colors, count };
}

export function createMeshGradientEffect(): Effect {
  let dead = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let material: THREE.ShaderMaterial | null = null;
  let geometry: THREE.PlaneGeometry | null = null;
  let freeze = false;
  let colorStops = DEFAULT_COLORS.slice();

  function syncColors(): void {
    if (!material) return;
    const { colors, count } = toColorArray(colorStops);
    material.uniforms.uColor.value = colors;
    material.uniforms.uColorCount.value = count;
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
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
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x000000);
      camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
      camera.position.set(0, 0.5, 0.4);
      camera.lookAt(0, 0, 0);

      // scene preset selects a palette by name (or numeric index); explicit
      // colorStops / colorN override it. "Custom" leaves DEFAULT_COLORS.
      const sceneNames: readonly string[] = MESH_SCENE_NAMES;
      const sceneVal = opts.params.scene;
      if (sceneVal != null && String(sceneVal) !== 'Custom') {
        let si = sceneNames.indexOf(String(sceneVal));
        if (si < 0) si = Number(sceneVal);
        if (SCENE_PRESETS[si]) colorStops = SCENE_PRESETS[si].slice();
      }
      const stops = opts.params.colorStops;
      if (Array.isArray(stops) && stops.length) colorStops = stops.map(String);
      for (let i = 0; i < 5; i++) {
        const c = opts.params[`color${i + 1}`];
        if (typeof c === 'string' && c) colorStops[i] = c;
      }

      material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        side: THREE.DoubleSide,
        uniforms: {
          uFrequency: { value: new THREE.Vector2(3, 6) },
          uTime: { value: 0 },
          uAmount: { value: Number(opts.params.noiseAmount ?? 0.2) },
          uSpeed: { value: Number(opts.params.noiseSpeed ?? 0.02) },
          uColor: { value: [] as THREE.Vector3[] },
          uColorCount: { value: 5 },
          uOrbitMatrix: { value: new THREE.Matrix3() },
          uGrainIntensity: { value: Number(opts.params.grainIntensity ?? 0.02) },
          uDitherEnabled: { value: Boolean(opts.params.ditherEnabled ?? false) },
          uDitherStrength: { value: Number(opts.params.ditherStrength ?? 0.3) },
        },
      });
      const freq = Number(opts.params.noiseFrequency ?? 3);
      material.uniforms.uFrequency.value.set(freq, freq * 2);
      material.wireframe = Boolean(opts.params.wireframe ?? false);
      freeze = Boolean(opts.params.animFreeze ?? false);
      syncColors();

      geometry = new THREE.PlaneGeometry(1.5, 1.5, 200, 200);
      geometry.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
    },

    frame(t: number) {
      if (dead || !renderer || !scene || !camera || !material) return;
      if (!freeze) material.uniforms.uTime.value = t / 1000;
      renderer.render(scene, camera);
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !camera) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    },

    setParam(key: string, value: unknown) {
      if (!material) return;
      switch (key) {
        case 'noiseFrequency': {
          const f = Number(value);
          material.uniforms.uFrequency.value.set(f, f * 2);
          break;
        }
        case 'noiseAmount':
          material.uniforms.uAmount.value = Number(value);
          break;
        case 'noiseSpeed':
          material.uniforms.uSpeed.value = Number(value);
          break;
        case 'grainIntensity':
          material.uniforms.uGrainIntensity.value = Number(value);
          break;
        case 'ditherEnabled':
          material.uniforms.uDitherEnabled.value = Boolean(value);
          break;
        case 'ditherStrength':
          material.uniforms.uDitherStrength.value = Number(value);
          break;
        case 'wireframe':
          material.wireframe = Boolean(value);
          break;
        case 'animFreeze':
          freeze = Boolean(value);
          break;
        case 'colorStops':
          if (Array.isArray(value)) {
            colorStops = value.map(String);
            syncColors();
          }
          break;
        case 'scene': {
          // Named presets apply the full 5-stop palette, exactly as the
          // original MeshGradientControls.selectScene. "Custom" leaves the
          // per-color pickers in control.
          const names: readonly string[] = MESH_SCENE_NAMES;
          const sval = String(value);
          if (sval === 'Custom' || sval === '-1') break;
          let idx = names.indexOf(sval);
          if (idx < 0) idx = Number(sval); // numeric fallback
          if (SCENE_PRESETS[idx]) {
            colorStops = SCENE_PRESETS[idx].slice();
            syncColors();
          }
          break;
        }
        case 'color1':
        case 'color2':
        case 'color3':
        case 'color4':
        case 'color5': {
          const i = Number(key.slice(5)) - 1;
          colorStops[i] = String(value);
          syncColors();
          break;
        }
        default:
          break;
      }
    },

    dispose() {
      geometry?.dispose();
      material?.dispose();
      renderer?.dispose();
      geometry = null;
      material = null;
      scene = null;
      camera = null;
      renderer = null;
      dead = true;
    },
  };
}
