import { Renderer, Camera, Transform, Program, Mesh, Plane, Texture, Vec2 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

/**
 * Infinite Gallery - a 3D tunnel of textured planes scrolling toward the camera,
 * with cloth-like vertex deformation and per-plane fade/blur based on Z-depth.
 * Verbatim vertex + fragment shaders from motion-core's InfiniteGalleryScene /
 * ImagePlane (lane-8a recon). OGL. MIT.
 *
 * This is the one motion-core effect that uses real 3D plane geometry and a
 * perspective camera (modelViewMatrix / projectionMatrix), not a fullscreen
 * quad. It is a content widget in motion-core: it owns scroll velocity,
 * wheel/keyboard input, an image array, and autoplay-after-idle. We preserve all
 * of that faithfully, adapting it to tilt-lab's contract:
 *   - No internal RAF. The scroll integrator runs inside frame(t) from the host
 *     clock: scrollVelocity decays by 0.95 friction per frame, planes advance by
 *     `scrollVelocity * delta * 10 * speed`, and wrap past the camera while
 *     advancing their image index (verbatim scroll logic).
 *   - Wheel/keyboard are not part of the Effect contract, so onPointer(x, y)
 *     drives the scroll instead: vertical pointer movement nudges scrollVelocity
 *     (drag-scrub), exactly like the original wheel input fed scrollVelocity.
 *   - autoplay engages after 3s of pointer inactivity (the original's behavior),
 *     easing scrollVelocity toward a constant drift.
 *
 * The object-valued fadeSettings / blurSettings props are decomposed into
 * individual range params (fadeInStart/End, fadeOutStart/End, blurInStart/End,
 * blurOutStart/End, maxBlur) so every original tunable is exposed under the
 * 4 supported ParamTypes.
 *
 * Slides come from assets keyed image0, image1, ... (any count); generated
 * gradient textures are used when none are supplied so the effect renders
 * standalone (and headlessly).
 *
 * Headless-safe: if no WebGL context is available (happy-dom), init marks the
 * effect dead and every method no-ops.
 */

// Verbatim scroll-driven cloth-deformation vertex shader.
// modelViewMatrix / projectionMatrix are OGL built-in uniforms, auto-supplied.
const VERTEX = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float scrollForce;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normal;

  vec3 pos = position;

  float curveIntensity = scrollForce * 0.3;
  float distanceFromCenter = length(pos.xy);
  float curve = distanceFromCenter * distanceFromCenter * curveIntensity;

  float ripple1 = sin(pos.x * 2.0 + scrollForce * 3.0) * 0.02;
  float ripple2 = sin(pos.y * 2.5 + scrollForce * 2.0) * 0.015;
  float clothEffect = (ripple1 + ripple2) * abs(curveIntensity) * 2.0;

  pos.z -= (curve + clothEffect);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}`;

// Verbatim box-blur + opacity fragment shader.
const FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D map;
uniform float opacity;
uniform float blurAmount;
uniform float scrollForce;
uniform vec2 uTextureSize;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec4 color = texture2D(map, vUv);

  if (blurAmount > 0.0) {
    vec2 texelSize = 1.0 / max(uTextureSize, vec2(1.0));
    vec4 blurred = vec4(0.0);
    float total = 0.0;

    for (float x = -2.0; x <= 2.0; x += 1.0) {
      for (float y = -2.0; y <= 2.0; y += 1.0) {
        vec2 offset = vec2(x, y) * texelSize * blurAmount;
        float weight = 1.0 / (1.0 + length(vec2(x, y)));
        blurred += texture2D(map, vUv + offset) * weight;
        total += weight;
      }
    }
    color = blurred / total;
  }

  float curveHighlight = abs(scrollForce) * 0.05;
  color.rgb += vec3(curveHighlight * 0.1);

  gl_FragColor = vec4(color.rgb, color.a * opacity);
}`;

function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function hsv(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const pp = v * (1 - s);
  const q = v * (1 - f * s);
  const tt = v * (1 - (1 - f) * s);
  let r = 0;
  let g = 0;
  let b = 0;
  switch (i % 6) {
    case 0: r = v; g = tt; b = pp; break;
    case 1: r = q; g = v; b = pp; break;
    case 2: r = pp; g = v; b = tt; break;
    case 3: r = pp; g = q; b = v; break;
    case 4: r = tt; g = pp; b = v; break;
    case 5: r = v; g = pp; b = q; break;
    default: break;
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function fallbackTileData(size: number, index: number, count: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const baseHue = count > 0 ? index / count : 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const vv = y / (size - 1);
      const h = (baseHue + u * 0.12) % 1;
      const [r, g, b] = hsv(h, 0.6, 0.35 + vv * 0.5);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

function collectImageKeys(assets: Record<string, string>): string[] {
  return Object.keys(assets)
    .filter((k) => /^image\d+$/.test(k) && assets[k])
    .sort((a, b) => {
      const na = parseInt(a.replace('image', ''), 10);
      const nb = parseInt(b.replace('image', ''), 10);
      return na - nb;
    });
}

interface PlaneData {
  mesh: Mesh;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uniforms: Record<string, { value: any }>;
  z: number;
  imageIndex: number;
}

// Number of tile upload slots (matches the image0..image5 file params in the
// manifest). At least this many tile textures always exist.
const UPLOAD_SLOTS = 6;
const SPACING = 3.0; // world units between planes
const CAMERA_Z = 6.0; // camera sits at +z looking down -z
const PLANE_W = 3.2;
const PLANE_H = 2.0;
const AUTO_VELOCITY = 1.0; // drift speed once autoplay engages
const IDLE_MS = 3000; // inactivity before autoplay kicks in

export function createInfiniteGalleryEffect(): Effect {
  let dead = false;
  let renderer: Renderer | null = null;
  let camera: Camera | null = null;
  let scene: Transform | null = null;
  let textures: Texture[] = [];
  let texSizes: Array<[number, number]> = [];
  let planes: PlaneData[] = [];

  let viewW = 1;
  let viewH = 1;

  // Tunable params.
  let visibleCount = 8;
  let speed = 1;
  let fadeInStart = 0.05;
  let fadeInEnd = 0.15;
  let fadeOutStart = 0.85;
  let fadeOutEnd = 0.95;
  let blurInStart = 0.0;
  let blurInEnd = 0.1;
  let blurOutStart = 0.9;
  let blurOutEnd = 1.0;
  let maxBlur = 3.0;
  let autoplay = true;

  // Scroll integrator state.
  let scrollVelocity = 0;
  let prevT = 0;
  let lastInputT = 0;
  let lastPointerY = NaN;
  let started = false;

  function totalRange(): number {
    return visibleCount * SPACING;
  }
  function farBound(): number {
    return CAMERA_Z - totalRange();
  }

  function assignTexture(pd: PlaneData) {
    if (textures.length === 0) return;
    const idx = ((pd.imageIndex % textures.length) + textures.length) % textures.length;
    pd.uniforms.map.value = textures[idx];
    const s = texSizes[idx] ?? [256, 256];
    pd.uniforms.uTextureSize.value.set(s[0], s[1]);
  }

  function buildPlanes() {
    if (!renderer || !scene) return;
    const rgl = renderer.gl;
    // Tear down any existing planes.
    for (const pd of planes) pd.mesh.setParent(null);
    planes = [];

    const geometryBase = { width: PLANE_W, height: PLANE_H, widthSegments: 20, heightSegments: 20 };
    for (let i = 0; i < visibleCount; i++) {
      const geometry = new Plane(rgl, geometryBase);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniforms: Record<string, { value: any }> = {
        map: { value: textures[0] ?? null },
        opacity: { value: 0 },
        blurAmount: { value: 0 },
        scrollForce: { value: 0 },
        uTextureSize: { value: new Vec2(256, 256) },
      };
      const program = new Program(rgl, {
        vertex: VERTEX,
        fragment: FRAGMENT,
        uniforms,
        transparent: true,
      });
      const mesh = new Mesh(rgl, { geometry, program });
      mesh.setParent(scene);
      // Nearest plane just in front of camera, the rest receding into the tunnel.
      const z = CAMERA_Z - SPACING * (i + 1);
      mesh.position.z = z;
      const pd: PlaneData = { mesh, uniforms, z, imageIndex: i };
      assignTexture(pd);
      planes.push(pd);
    }
  }

  function loadTile(url: string, slot: number) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (dead || !textures[slot]) return;
      textures[slot].image = img;
      textures[slot].needsUpdate = true;
      texSizes[slot] = [img.width || 1, img.height || 1];
      for (const pd of planes) assignTexture(pd);
    };
    img.src = url;
  }

  function updatePlane(pd: PlaneData) {
    const lo = farBound();
    const hi = CAMERA_Z;
    const t = Math.min(1, Math.max(0, (pd.z - lo) / (hi - lo)));

    const opacity = smoothstep(fadeInStart, fadeInEnd, t) * (1 - smoothstep(fadeOutStart, fadeOutEnd, t));
    const blurFactor = Math.min(
      1,
      Math.max(0, (1 - smoothstep(blurInStart, blurInEnd, t)) + smoothstep(blurOutStart, blurOutEnd, t)),
    );

    pd.uniforms.opacity.value = opacity;
    pd.uniforms.blurAmount.value = maxBlur * blurFactor;
    pd.uniforms.scrollForce.value = scrollVelocity;
    pd.mesh.position.z = pd.z;
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      const p = opts.params;
      visibleCount = Math.max(2, Math.floor(Number(p.visibleCount ?? 8)));
      speed = Number(p.speed ?? 1);
      fadeInStart = Number(p.fadeInStart ?? 0.05);
      fadeInEnd = Number(p.fadeInEnd ?? 0.15);
      fadeOutStart = Number(p.fadeOutStart ?? 0.85);
      fadeOutEnd = Number(p.fadeOutEnd ?? 0.95);
      blurInStart = Number(p.blurInStart ?? 0.0);
      blurInEnd = Number(p.blurInEnd ?? 0.1);
      blurOutStart = Number(p.blurOutStart ?? 0.9);
      blurOutEnd = Number(p.blurOutEnd ?? 1.0);
      maxBlur = Number(p.maxBlur ?? 3.0);
      autoplay = p.autoplay !== undefined ? Boolean(p.autoplay) : true;

      renderer = new Renderer({ canvas, dpr: 1, alpha: true });
      const rgl = renderer.gl;
      rgl.clearColor(0, 0, 0, 0);
      viewW = Math.max(1, canvas.width || 1);
      viewH = Math.max(1, canvas.height || 1);

      camera = new Camera(rgl, { fov: 45, near: 0.1, far: 100, aspect: viewW / viewH });
      camera.position.set(0, 0, CAMERA_Z);
      scene = new Transform();

      // Texture pool from assets (image0, image1, ...) or generated fallbacks.
      // At least UPLOAD_SLOTS tiles exist so each image* file param has a tile
      // to fill on upload (the manifest exposes image0..image5 upload controls).
      const keys = collectImageKeys(opts.assets);
      const count = Math.max(keys.length, UPLOAD_SLOTS);
      textures = [];
      texSizes = [];
      for (let i = 0; i < count; i++) {
        const data = fallbackTileData(256, i, count);
        const tex = new Texture(rgl, {
          image: data,
          width: 256,
          height: 256,
          generateMipmaps: false,
          flipY: false,
        });
        textures.push(tex);
        texSizes.push([256, 256]);
      }

      buildPlanes();
      // Wire each tile's source (override the fallback gradient as it loads). A
      // user-uploaded image* file param (object URL) wins over the bundled asset.
      for (let i = 0; i < textures.length; i++) {
        const up = opts.params[`image${i}`];
        const url = (typeof up === 'string' && up) || opts.assets[`image${i}`];
        if (url) loadTile(url, i);
      }
    },

    frame(t: number) {
      if (dead || !renderer || !camera || !scene) return;
      if (!started) {
        started = true;
        prevT = t;
        lastInputT = t;
        // A gentle initial drift so the tunnel moves on its own.
        scrollVelocity = AUTO_VELOCITY;
      }
      let delta = (t - prevT) / 1000;
      prevT = t;
      if (delta < 0) delta = 0;
      if (delta > 0.1) delta = 0.1; // clamp huge gaps (tab resume, first frame)

      // Friction, then autoplay drift after inactivity (verbatim 0.95 friction).
      scrollVelocity *= 0.95;
      if (autoplay && t - lastInputT > IDLE_MS) {
        scrollVelocity += (AUTO_VELOCITY - scrollVelocity) * 0.05;
      }

      const range = totalRange();
      const scrollDelta = scrollVelocity * delta * 10 * speed;
      for (const pd of planes) {
        let newZ = pd.z + scrollDelta;
        // Wrap once a plane passes the camera; advance its image index.
        if (newZ > CAMERA_Z) {
          const wraps = Math.floor((newZ - CAMERA_Z) / range) + 1;
          newZ -= range * wraps;
          pd.imageIndex = (pd.imageIndex + wraps * visibleCount) % Math.max(1, textures.length);
          assignTexture(pd);
        } else if (newZ < farBound()) {
          // Reverse scroll: wrap back to the near end.
          const wraps = Math.floor((farBound() - newZ) / range) + 1;
          newZ += range * wraps;
          pd.imageIndex =
            (((pd.imageIndex - wraps * visibleCount) % textures.length) + textures.length) %
            Math.max(1, textures.length);
          assignTexture(pd);
        }
        pd.z = newZ;
        updatePlane(pd);
      }

      renderer.render({ scene, camera });
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !camera) return;
      viewW = Math.max(1, w);
      viewH = Math.max(1, h);
      renderer.setSize(viewW, viewH);
      camera.perspective({ aspect: viewW / viewH });
    },

    setParam(key: string, value: unknown) {
      if (dead) return;
      // Tile uploads: an image* file param loads its texture into the matching
      // pool slot (every plane showing that slot updates on the next wrap).
      const slot = /^image(\d+)$/.exec(key);
      if (slot) {
        const i = parseInt(slot[1], 10);
        if (value && i < textures.length) loadTile(String(value), i);
        return;
      }
      switch (key) {
        case 'visibleCount': {
          const next = Math.max(2, Math.floor(Number(value)));
          if (next !== visibleCount) {
            visibleCount = next;
            buildPlanes();
          }
          break;
        }
        case 'speed':
          speed = Number(value);
          break;
        case 'fadeInStart':
          fadeInStart = Number(value);
          break;
        case 'fadeInEnd':
          fadeInEnd = Number(value);
          break;
        case 'fadeOutStart':
          fadeOutStart = Number(value);
          break;
        case 'fadeOutEnd':
          fadeOutEnd = Number(value);
          break;
        case 'blurInStart':
          blurInStart = Number(value);
          break;
        case 'blurInEnd':
          blurInEnd = Number(value);
          break;
        case 'blurOutStart':
          blurOutStart = Number(value);
          break;
        case 'blurOutEnd':
          blurOutEnd = Number(value);
          break;
        case 'maxBlur':
          maxBlur = Number(value);
          break;
        case 'autoplay':
          autoplay = Boolean(value);
          break;
        default:
          break;
      }
    },

    // Scroll is the primary input (verbatim original): wheel deltaY feeds the
    // scroll velocity integrator that frame() advances. Scroll down -> tunnel
    // moves forward. Decays by the same 0.95 friction inside frame().
    onWheel(deltaY: number) {
      if (dead) return;
      lastInputT = prevT;
      scrollVelocity += deltaY * 0.01;
    },

    // A click-drag also scrubs the tunnel; a bare hover does not. Drag down
    // scrolls forward, mirroring wheel-fed scrollVelocity.
    onPointer(x: number, y: number, pressed?: boolean) {
      if (dead) return;
      if (!pressed || isNaN(x) || isNaN(y)) {
        lastPointerY = NaN;
        return;
      }
      lastInputT = prevT;
      if (!isNaN(lastPointerY)) {
        const dy = y - lastPointerY;
        scrollVelocity += dy * 0.02;
      }
      lastPointerY = y;
    },

    onPointerLeave() {
      lastPointerY = NaN;
    },

    dispose() {
      if (renderer) {
        const lose = renderer.gl?.getExtension('WEBGL_lose_context');
        lose?.loseContext();
        renderer = null;
      }
      for (const pd of planes) pd.mesh.setParent(null);
      planes = [];
      textures = [];
      texSizes = [];
      camera = null;
      scene = null;
      started = false;
      dead = true;
    },
  };
}
