import { Camera, Mesh, Program, Renderer, Texture, Transform, Triangle, Vec2, Vec3 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';
import { rgb01 } from '../../color';

/**
 * Globe (motion-core) - a Fresnel-lit dotted globe (Fibonacci lattice points
 * masked by a land texture) plus an additive atmosphere shell. Distinct from the
 * cobe "globe": this is motion-core's OGL implementation with rim glow, a
 * configurable atmosphere, and an equirectangular land mask. Shaders are ported
 * VERBATIM from motion-core's GlobeScene.svelte (lane-8a recon + upstream
 * GlobeScene.svelte on github.com/motion-core/motion-core, MIT).
 *
 * Loop adaptation: motion-core's Scene owns a requestAnimationFrame `tick` that
 * accumulates auto-rotation and eases phi/theta toward their targets. tilt-lab
 * drives frame(t) externally, so we compute delta from the host clock and run
 * the same auto-rotate + exponential-smoothing step once per host frame, then
 * render the globe scene followed by the additive atmosphere scene. No internal
 * RAF.
 *
 * Scope: this restores the full VISUAL tunable surface of the original (display
 * scale/offset/rotation, point count/size, land color, auto-rotate, polar lock,
 * the complete Fresnel rim config, and the complete atmosphere config). The
 * original's marker /
 * tooltip / focus-on data-viz layer is a content WIDGET outside tilt-lab's
 * Effect contract (lane-8a recon), so the marker uniform arrays are kept present
 * for shader compilation but left empty (uMarkerCount = 0) and the DOM marker
 * overlay is not built.
 *
 * Headless-safe: if no WebGL context is available (happy-dom), init marks the
 * effect dead and every method no-ops.
 */

const MAX_SHADER_MARKERS = 128;

const DEFAULT_GLOBE_SCALE = 1;

const PI = Math.PI;
const AUTO_ROTATE_SPEED = (2 * PI) / 30;
const SMOOTHING_STRENGTH = 14;
const LOCKED_POLAR_ANGLE = 1.5;
const LOCKED_THETA = Math.asin(Math.cos(LOCKED_POLAR_ANGLE));
const MIN_THETA = -PI * 0.5 + 0.001;
const MAX_THETA = PI * 0.5 - 0.001;

const VERTEX_SHADER = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// Verbatim from GlobeScene.svelte globeFragmentShader (marker array size injected).
const GLOBE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uRotation;
uniform float uScale;
uniform float uDisplayScale;
uniform vec2 uDisplayOffset;
uniform float uDisplayRotation;
uniform float uDots;
uniform float uPointRadius;
uniform vec3 uBaseColor;
uniform vec3 uRimColor;
uniform float uRimPower;
uniform float uRimIntensity;
uniform vec3 uLandPointColor;
uniform sampler2D uLandTexture;
uniform float uMarkerCount;
uniform vec4 uMarkerData[${MAX_SHADER_MARKERS}];
uniform vec3 uMarkerColor[${MAX_SHADER_MARKERS}];

const float kPi = 3.141592653589793;
const float kTau = 6.283185307179586;
const float kPhi = 1.618033988749895;
const float kSqrt5 = 2.23606797749979;
const float kSphereRadius = 0.8;
const int kMaxMarkers = ${MAX_SHADER_MARKERS};

float byDots;

vec2 rotate2(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

vec2 transformUv(vec2 uv) {
  float aspect = uResolution.x / max(1.0, uResolution.y);
  vec2 centered = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  vec2 transformed = rotate2(
    centered - vec2(uDisplayOffset.x * aspect, uDisplayOffset.y),
    -radians(uDisplayRotation)
  ) / max(uDisplayScale, 0.001);
  return vec2(transformed.x / aspect + 0.5, transformed.y + 0.5);
}

mat3 rotate(float theta, float phi) {
  float cx = cos(theta);
  float cy = cos(phi);
  float sx = sin(theta);
  float sy = sin(phi);
  return mat3(
    cy, sy * sx, -sy * cx,
    0.0, cx, sx,
    sy, cy * -sx, cy * cx
  );
}

vec3 nearestFibonacciLattice(vec3 p, out float m) {
  p = p.xzy;

  float k = max(2.0, floor(log2(kSqrt5 * uDots * kPi * (1.0 - p.z * p.z)) * 0.72021));
  vec2 f = floor(pow(kPhi, k) / kSqrt5 * vec2(1.0, kPhi) + 0.5);
  vec2 br1 = fract((f + 1.0) * (kPhi - 1.0)) * kTau - 3.883222;
  vec2 br2 = -2.0 * f;
  vec2 sp = vec2(atan(p.y, p.x), p.z - 1.0);
  vec2 c = floor(vec2(
    br2.y * sp.x - br1.y * (sp.y * uDots + 1.0),
    -br2.x * sp.x + br1.x * (sp.y * uDots + 1.0)
  ) / (br1.x * br2.y - br2.x * br1.y));

  float mindist = kPi;
  vec3 minip = vec3(0.0, 0.0, 1.0);

  for (float s = 0.0; s < 4.0; s += 1.0) {
    vec2 o = vec2(mod(s, 2.0), floor(s * 0.5));
    float idx = dot(f, c + o);
    if (idx > uDots) continue;

    float a = idx;
    float b = 0.0;
    if (a >= 16384.0) a -= 16384.0, b += 0.868872;
    if (a >= 8192.0) a -= 8192.0, b += 0.934436;
    if (a >= 4096.0) a -= 4096.0, b += 0.467218;
    if (a >= 2048.0) a -= 2048.0, b += 0.733609;
    if (a >= 1024.0) a -= 1024.0, b += 0.866804;
    if (a >= 512.0) a -= 512.0, b += 0.433402;
    if (a >= 256.0) a -= 256.0, b += 0.216701;
    if (a >= 128.0) a -= 128.0, b += 0.108351;
    if (a >= 64.0) a -= 64.0, b += 0.554175;
    if (a >= 32.0) a -= 32.0, b += 0.777088;
    if (a >= 16.0) a -= 16.0, b += 0.888544;
    if (a >= 8.0) a -= 8.0, b += 0.944272;
    if (a >= 4.0) a -= 4.0, b += 0.472136;
    if (a >= 2.0) a -= 2.0, b += 0.236068;
    if (a >= 1.0) a -= 1.0, b += 0.618034;

    float theta = fract(b) * kTau;
    float cosphi = 1.0 - 2.0 * idx * byDots;
    float sinphi = sqrt(max(0.0, 1.0 - cosphi * cosphi));
    vec3 samplePoint = vec3(cos(theta) * sinphi, sin(theta) * sinphi, cosphi);

    float dist = length(p - samplePoint);
    if (dist < mindist) {
      mindist = dist;
      minip = samplePoint;
    }
  }

  m = mindist;
  return minip.xzy;
}

vec2 pointToMaskUV(vec3 p) {
  float lengthP = length(p);
  if (lengthP <= 0.0) {
    return vec2(0.0, 0.0);
  }

  vec3 n = p / lengthP;

  float nx = n.z;
  float ny = n.y;
  float nz = -n.x;

  float gPhi = asin(clamp(ny, -1.0, 1.0));
  float cosPhi = cos(gPhi);

  float gTheta = 0.0;
  if (abs(cosPhi) > 1e-6) {
    float thetaInput = clamp(-nx / cosPhi, -1.0, 1.0);
    gTheta = acos(thetaInput);
    if (nz < 0.0) {
      gTheta = -gTheta;
    }
  }

  return vec2(
    fract((gTheta * 0.5) / kPi),
    fract(gPhi / kPi + 0.5)
  );
}

vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}

void main() {
  byDots = 1.0 / max(1.0, uDots);

  vec2 uv = transformUv(vUv) * 2.0 - 1.0;
  uv.x *= uResolution.x / max(1.0, uResolution.y);
  uv /= max(0.0001, uScale);

  float l = dot(uv, uv);
  float globeR2 = kSphereRadius * kSphereRadius;

  vec3 color = vec3(0.0);
  float alpha = 0.0;

  if (l <= globeR2) {
    float dis;
    vec3 p = normalize(vec3(uv, sqrt(max(0.0, globeR2 - l))));
    mat3 rot = rotate(uRotation.y, uRotation.x);
    vec3 globePoint = p * rot;
    vec3 samplePoint = nearestFibonacciLattice(globePoint, dis);
    vec2 mapUv = pointToMaskUV(samplePoint);
    float land = texture2D(uLandTexture, mapUv).r;

    float landDots = step(0.5, land) * smoothstep(uPointRadius, 0.0, dis);

    float dotNV = clamp(p.z / kSphereRadius, 0.0, 1.0);
    float rim = pow(1.0 - dotNV, max(0.0001, uRimPower)) * uRimIntensity;
    float dotFade = smoothstep(0.04, 0.28, dotNV);
    landDots *= dotFade;

    vec3 markerColor = vec3(0.0);
    float markerMask = 0.0;
    float markerWeightSum = 0.0;
    for (int i = 0; i < kMaxMarkers; i++) {
      if (float(i) >= uMarkerCount) {
        break;
      }

      vec4 marker = uMarkerData[i];
      float markerDist = length(globePoint - marker.xyz);
      float markerCore = smoothstep(marker.w, marker.w * 0.62, markerDist);
      float pulse = fract(uTime * 0.85 + float(i) * 0.173);
      float pulseRadius = marker.w * mix(1.15, 2.8, pulse);
      float pulseWidth = marker.w * 0.42;
      float pulseInner = smoothstep(
        pulseRadius - pulseWidth,
        pulseRadius,
        markerDist
      );
      float pulseOuter =
        1.0 - smoothstep(pulseRadius, pulseRadius + pulseWidth, markerDist);
      float markerPulse = pulseInner * pulseOuter * (1.0 - pulse);
      float markerDot = max(markerCore, markerPulse * 0.72);
      markerMask = max(markerMask, markerDot);
      markerWeightSum += markerDot;
      markerColor += uMarkerColor[i] * markerDot;
    }

    if (markerWeightSum > 0.0) {
      markerColor /= markerWeightSum;
    }

    vec3 surface = uBaseColor;
    surface += uRimColor * rim;
    surface += uLandPointColor * (landDots * (1.0 - markerMask));

    vec3 boostedMarker = markerColor * (1.0 + 0.25 * markerMask);
    surface = mix(surface, boostedMarker, markerMask);

    color += surface;
    alpha = 1.0;
  }

  gl_FragColor = vec4(linearToSrgb(color), clamp(alpha, 0.0, 1.0));
}`;

// Verbatim from GlobeScene.svelte atmosphereFragmentShader.
const ATMOSPHERE_FRAGMENT_SHADER = /* glsl */ `
precision highp float;

varying vec2 vUv;

uniform vec2 uResolution;
uniform float uScale;
uniform float uDisplayScale;
uniform vec2 uDisplayOffset;
uniform float uDisplayRotation;
uniform vec3 uAtmosphereColor;
uniform float uAtmosphereScale;
uniform float uAtmospherePower;
uniform float uAtmosphereCoefficient;
uniform float uAtmosphereIntensity;

const float kSphereRadius = 0.8;

vec2 rotate2(vec2 p, float angle) {
  float c = cos(angle);
  float s = sin(angle);
  return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
}

vec2 transformUv(vec2 uv) {
  float aspect = uResolution.x / max(1.0, uResolution.y);
  vec2 centered = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);
  vec2 transformed = rotate2(
    centered - vec2(uDisplayOffset.x * aspect, uDisplayOffset.y),
    -radians(uDisplayRotation)
  ) / max(uDisplayScale, 0.001);
  return vec2(transformed.x / aspect + 0.5, transformed.y + 0.5);
}

vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}

void main() {
  vec2 uv = transformUv(vUv) * 2.0 - 1.0;
  uv.x *= uResolution.x / max(1.0, uResolution.y);
  uv /= max(0.0001, uScale);

  float globeR = kSphereRadius;
  float atmosphereR = kSphereRadius * max(1.0, uAtmosphereScale);
  float l = dot(uv, uv);
  float radial = sqrt(l);

  if (radial <= globeR) {
    discard;
  }

  float shellWidth = max(1e-5, atmosphereR - globeR);
  float x = (radial - globeR) / shellWidth;
  if (x > 3.0) {
    discard;
  }

  // Smooth outward blur profile (no hard ring cutoff at shell boundary).
  float falloff = exp(-pow(max(0.0, x), 1.2) * max(0.15, uAtmospherePower * 0.09));
  float finalFactor =
    falloff * uAtmosphereIntensity * max(0.0, uAtmosphereCoefficient);

  vec3 finalColor = uAtmosphereColor * finalFactor;
  float alpha = finalFactor;

  gl_FragColor = vec4(linearToSrgb(finalColor), clamp(alpha, 0.0, 1.0));
}`;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampTheta(value: number, lockPolar: boolean): number {
  return lockPolar ? LOCKED_THETA : clamp(value, MIN_THETA, MAX_THETA);
}

// Matches motion-core: toPointRadius(pointSize) = max(0.001, pointSize * 0.16).
function toPointRadius(nextPointSize: number): number {
  return Math.max(0.001, nextPointSize * 0.16);
}

function srgbToLinearChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function hexToLinearRgb(hex: string, fallback: [number, number, number]): [number, number, number] {
  // Accept #rgb/#rrggbb/#rrggbbaa (the picker emits 8-digit for transparent
  // values); fall back only on genuinely invalid input. Alpha is dropped (the
  // shader takes linear RGB).
  const s = String(hex).trim();
  if (!/^#?[0-9a-f]{3,8}$/i.test(s)) return fallback;
  const [r, g, b] = rgb01(s);
  return [srgbToLinearChannel(r), srgbToLinearChannel(g), srgbToLinearChannel(b)];
}

function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  if (typeof v === 'number') return v !== 0;
  return fallback;
}

export function createMcGlobeEffect(): Effect {
  let dead = false;
  let renderer: Renderer | null = null;
  let camera: Camera | null = null;
  let globeScene: Transform | null = null;
  let atmosphereScene: Transform | null = null;
  let globeMesh: Mesh | null = null;
  let atmosphereMesh: Mesh | null = null;
  let globeProgram: Program | null = null;
  let atmosphereProgram: Program | null = null;
  let geometry: Triangle | null = null;
  let landTexture: Texture | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uniforms: Record<string, { value: any }> | null = null;

  // Rotation state (driven from the external clock, not motion-core's RAF).
  let autoRotate = true;
  let lockedPolarAngle = true;
  let phi = 0;
  let theta = 0;
  let targetPhi = 0;
  let targetTheta = 0;
  let previous = 0;
  let started = false;

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      const p = opts.params;

      autoRotate = toBool(p.autoRotate, true);
      lockedPolarAngle = toBool(p.lockedPolarAngle, true);

      const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
      renderer = new Renderer({ canvas, alpha: true, antialias: true, dpr });
      const rgl = renderer.gl;
      rgl.clearColor(0, 0, 0, 0);

      camera = new Camera(rgl);
      camera.position.z = 1;

      globeScene = new Transform();
      atmosphereScene = new Transform();
      geometry = new Triangle(rgl);

      // Marker arrays kept present so the program links; left empty (widget
      // layer is out of contract).
      const markerData = new Array<number>(MAX_SHADER_MARKERS * 4).fill(0);
      const markerColorData = new Array<number>(MAX_SHADER_MARKERS * 3).fill(0);

      // 1x1 black fallback land mask (verbatim from motion-core); replaced when
      // the land-texture asset loads.
      landTexture = new Texture(rgl, {
        image: new Uint8Array([0, 0, 0, 255]),
        width: 1,
        height: 1,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        format: (rgl as any).RGBA,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: (rgl as any).UNSIGNED_BYTE,
        minFilter: rgl.NEAREST,
        magFilter: rgl.NEAREST,
        generateMipmaps: false,
        wrapS: rgl.REPEAT,
        wrapT: rgl.REPEAT,
      });

      const scale = Number(p.scale ?? 1);
      const offsetX = Number(p.offsetX ?? 0);
      const offsetY = Number(p.offsetY ?? 0);
      const rotation = Number(p.rotation ?? 0);
      const pointCount = Number(p.pointCount ?? 15000);
      const pointSize = Number(p.pointSize ?? 0.05);

      const baseColor = hexToLinearRgb(String(p.fresnelColor ?? '#17181A'), [17 / 255, 17 / 255, 19 / 255]);
      const rimColor = hexToLinearRgb(String(p.rimColor ?? '#FF6900'), [1, 105 / 255, 0]);
      const atmosphereColor = hexToLinearRgb(String(p.atmosphereColor ?? '#FF6900'), [1, 105 / 255, 0]);
      const landPointColor = hexToLinearRgb(String(p.landPointColor ?? '#f77114'), [247 / 255, 113 / 255, 20 / 255]);

      uniforms = {
        uTime: { value: 0 },
        uResolution: { value: new Vec2(1, 1) },
        uRotation: { value: new Vec2(0, clampTheta(0, lockedPolarAngle)) },
        uScale: { value: DEFAULT_GLOBE_SCALE },
        uDisplayScale: { value: scale },
        uDisplayOffset: { value: new Vec2(offsetX, offsetY) },
        uDisplayRotation: { value: rotation },
        uDots: { value: Math.max(1, Math.floor(pointCount)) },
        uPointRadius: { value: toPointRadius(pointSize) },
        uBaseColor: { value: new Vec3(baseColor[0], baseColor[1], baseColor[2]) },
        uRimColor: { value: new Vec3(rimColor[0], rimColor[1], rimColor[2]) },
        uRimPower: { value: Math.max(0.0001, Number(p.rimPower ?? 6)) },
        uRimIntensity: { value: Math.max(0, Number(p.rimIntensity ?? 1.5)) },
        uAtmosphereColor: { value: new Vec3(atmosphereColor[0], atmosphereColor[1], atmosphereColor[2]) },
        uAtmosphereScale: { value: Math.max(1, Number(p.atmosphereScale ?? 1.1)) },
        uAtmospherePower: { value: Math.max(0.0001, Number(p.atmospherePower ?? 12.0)) },
        uAtmosphereCoefficient: { value: Math.max(0, Number(p.atmosphereCoefficient ?? 0.9)) },
        uAtmosphereIntensity: { value: Math.max(0, Number(p.atmosphereIntensity ?? 1.1)) },
        uLandPointColor: { value: new Vec3(landPointColor[0], landPointColor[1], landPointColor[2]) },
        uLandTexture: { value: landTexture },
        uMarkerCount: { value: 0 },
        uMarkerData: { value: markerData },
        uMarkerColor: { value: markerColorData },
      };

      globeProgram = new Program(rgl, {
        vertex: VERTEX_SHADER,
        fragment: GLOBE_FRAGMENT_SHADER,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });

      atmosphereProgram = new Program(rgl, {
        vertex: VERTEX_SHADER,
        fragment: ATMOSPHERE_FRAGMENT_SHADER,
        uniforms,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      });
      atmosphereProgram.setBlendFunc(rgl.SRC_ALPHA, rgl.ONE);

      globeMesh = new Mesh(rgl, { geometry, program: globeProgram, frustumCulled: false });
      globeMesh.setParent(globeScene);

      atmosphereMesh = new Mesh(rgl, { geometry, program: atmosphereProgram, frustumCulled: false });
      atmosphereMesh.setParent(atmosphereScene);

      // Initial rotation targets.
      const startTheta = clampTheta(0, lockedPolarAngle);
      phi = 0;
      theta = startTheta;
      targetPhi = 0;
      targetTheta = startTheta;
      previous = 0;
      started = false;

      // Load the equirectangular land mask (host-supplied URL). Guarded for
      // headless (no Image / no asset -> keep 1x1 fallback).
      const url = opts.assets?.landTexture;
      if (url && typeof Image !== 'undefined') {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.onload = () => {
          if (dead || !landTexture || !renderer) return;
          landTexture.image = image;
          landTexture.generateMipmaps = true;
          landTexture.minFilter = renderer.gl.NEAREST_MIPMAP_NEAREST;
          landTexture.magFilter = renderer.gl.NEAREST;
          landTexture.needsUpdate = true;
        };
        image.onerror = () => {
          /* keep fallback texture */
        };
        image.src = url;
      }
    },

    frame(t: number) {
      if (dead || !renderer || !globeScene || !atmosphereScene || !camera || !uniforms) return;

      const tSec = t / 1000;
      const delta = started ? Math.max(0, tSec - previous) : 0;
      previous = tSec;
      started = true;
      uniforms.uTime.value += delta;

      if (autoRotate) {
        targetPhi -= AUTO_ROTATE_SPEED * delta;
      }
      targetTheta = clampTheta(targetTheta, lockedPolarAngle);

      const easing = 1 - Math.exp(-delta * SMOOTHING_STRENGTH);
      phi += (targetPhi - phi) * easing;
      theta += (targetTheta - theta) * easing;

      uniforms.uRotation.value.set(phi, theta);

      renderer.render({ scene: globeScene, camera, clear: true });
      renderer.render({ scene: atmosphereScene, camera, clear: false });
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !uniforms) return;
      const ww = Math.max(1, w);
      const hh = Math.max(1, h);
      renderer.setSize(ww, hh);
      renderer.state.viewport = { x: 0, y: 0, width: null, height: null };
      uniforms.uResolution.value.set(ww, hh);
    },

    setParam(key: string, value: unknown) {
      if (dead || !uniforms) return;
      switch (key) {
        case 'scale':
          uniforms.uDisplayScale.value = Number(value);
          break;
        case 'offsetX':
          uniforms.uDisplayOffset.value.set(Number(value), uniforms.uDisplayOffset.value.y);
          break;
        case 'offsetY':
          uniforms.uDisplayOffset.value.set(uniforms.uDisplayOffset.value.x, Number(value));
          break;
        case 'rotation':
          uniforms.uDisplayRotation.value = Number(value);
          break;
        case 'pointCount':
          uniforms.uDots.value = Math.max(1, Math.floor(Number(value)));
          break;
        case 'pointSize':
          uniforms.uPointRadius.value = toPointRadius(Number(value));
          break;
        case 'landPointColor': {
          const c = hexToLinearRgb(String(value), [247 / 255, 113 / 255, 20 / 255]);
          uniforms.uLandPointColor.value.set(c[0], c[1], c[2]);
          break;
        }
        case 'autoRotate':
          autoRotate = toBool(value, true);
          break;
        case 'lockedPolarAngle':
          lockedPolarAngle = toBool(value, true);
          targetTheta = clampTheta(targetTheta, lockedPolarAngle);
          break;
        case 'fresnelColor': {
          const c = hexToLinearRgb(String(value), [17 / 255, 17 / 255, 19 / 255]);
          uniforms.uBaseColor.value.set(c[0], c[1], c[2]);
          break;
        }
        case 'rimColor': {
          const c = hexToLinearRgb(String(value), [1, 105 / 255, 0]);
          uniforms.uRimColor.value.set(c[0], c[1], c[2]);
          break;
        }
        case 'rimPower':
          uniforms.uRimPower.value = Math.max(0.0001, Number(value));
          break;
        case 'rimIntensity':
          uniforms.uRimIntensity.value = Math.max(0, Number(value));
          break;
        case 'atmosphereColor': {
          const c = hexToLinearRgb(String(value), [1, 105 / 255, 0]);
          uniforms.uAtmosphereColor.value.set(c[0], c[1], c[2]);
          break;
        }
        case 'atmosphereScale':
          uniforms.uAtmosphereScale.value = Math.max(1, Number(value));
          break;
        case 'atmospherePower':
          uniforms.uAtmospherePower.value = Math.max(0.0001, Number(value));
          break;
        case 'atmosphereCoefficient':
          uniforms.uAtmosphereCoefficient.value = Math.max(0, Number(value));
          break;
        case 'atmosphereIntensity':
          uniforms.uAtmosphereIntensity.value = Math.max(0, Number(value));
          break;
        default:
          break;
      }
    },

    dispose() {
      if (globeMesh) globeMesh.setParent(null);
      if (atmosphereMesh) atmosphereMesh.setParent(null);
      try {
        geometry?.remove();
        globeProgram?.remove();
        atmosphereProgram?.remove();
      } catch {
        /* removing GL resources on a dead context can throw; ignore */
      }
      if (renderer) {
        const lose = renderer.gl?.getExtension('WEBGL_lose_context');
        lose?.loseContext();
      }
      renderer = null;
      camera = null;
      globeScene = null;
      atmosphereScene = null;
      globeMesh = null;
      atmosphereMesh = null;
      globeProgram = null;
      atmosphereProgram = null;
      geometry = null;
      landTexture = null;
      uniforms = null;
      dead = true;
    },
  };
}
