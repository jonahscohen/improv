import { Renderer, Program, Mesh, Triangle, Texture, Vec2 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

/**
 * Glass Slideshow - image carousel with an organic "glass bubble" transition
 * (expanding sphere with refraction + chromatic aberration + liquid surface
 * noise). Verbatim fragment shader from motion-core's GlassSlideshowScene
 * (lane-8a recon). OGL. MIT.
 *
 * This is a content widget in motion-core: it owns slide index, an image array,
 * an autoplay timer, and a GSAP-driven `uProgress` 0->1 tween (power3.inOut)
 * between two slide textures. We preserve ALL of that faithfully, but adapt the
 * loop to tilt-lab's contract:
 *   - No internal RAF / GSAP ticker. The slide state machine and the uProgress
 *     tween are advanced from the host clock inside frame(t).
 *   - The GSAP `power3.inOut` ease is replicated exactly (cubic in/out).
 *   - The `index` prop becomes setParam('index', n): setting it begins a
 *     transition toward that slide immediately (manual control), while autoplay
 *     advances automatically on its interval.
 *
 * Every shader uniform is exposed as a tunable param (uGlobalIntensity,
 * uDistortionStrength, uSpeedMultiplier, uColorEnhancement,
 * uGlassRefractionStrength, uGlassChromaticAberration, uGlassBubbleClarity,
 * uGlassEdgeGlow, uGlassLiquidFlow), defaulting to the motion-core neutral 1.0.
 *
 * Slides come from assets keyed image0, image1, ... (any count). When none are
 * supplied, distinct generated gradient textures are used so the effect renders
 * standalone (and headlessly).
 *
 * Headless-safe: if no WebGL context is available (happy-dom), init marks the
 * effect dead and every method no-ops.
 */

const VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = /* glsl */ `
precision highp float;

uniform sampler2D uTexture1;
uniform sampler2D uTexture2;
uniform float uProgress;
uniform vec2 uResolution;
uniform vec2 uTexture1Size;
uniform vec2 uTexture2Size;

uniform float uGlobalIntensity;
uniform float uDistortionStrength;
uniform float uSpeedMultiplier;
uniform float uColorEnhancement;

uniform float uGlassRefractionStrength;
uniform float uGlassChromaticAberration;
uniform float uGlassBubbleClarity;
uniform float uGlassEdgeGlow;
uniform float uGlassLiquidFlow;

varying vec2 vUv;

vec3 srgbToLinear(vec3 color) {
  vec3 low = color / 12.92;
  vec3 high = pow((color + 0.055) / 1.055, vec3(2.4));
  vec3 cutoff = step(vec3(0.04045), color);
  return mix(low, high, cutoff);
}

vec3 linearToSrgb(vec3 color) {
  vec3 safe = max(color, vec3(0.0));
  vec3 low = safe * 12.92;
  vec3 high = 1.055 * pow(safe, vec3(1.0 / 2.4)) - 0.055;
  vec3 cutoff = step(vec3(0.0031308), safe);
  return mix(low, high, cutoff);
}

vec2 getCoverUV(vec2 uv, vec2 textureSize) {
  vec2 s = uResolution / textureSize;
  float scale = max(s.x, s.y);
  vec2 scaledSize = textureSize * scale;
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

float noise(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float smoothNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  return mix(
    mix(noise(i), noise(i + vec2(1.0, 0.0)), f.x),
    mix(noise(i + vec2(0.0, 1.0)), noise(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

vec4 sampleLinear(sampler2D tex, vec2 uv) {
  vec4 c = texture2D(tex, uv);
  return vec4(srgbToLinear(c.rgb), c.a);
}

vec4 glassEffect(vec2 uv, float progress) {
  float glassStrength = 0.08 * uGlassRefractionStrength * uDistortionStrength * uGlobalIntensity;
  float chromaticAberration = 0.02 * uGlassChromaticAberration * uGlobalIntensity;
  float waveDistortion = 0.025 * uDistortionStrength;
  float clearCenterSize = 0.3 * uGlassBubbleClarity;
  float surfaceRipples = 0.004 * uDistortionStrength;
  float liquidFlow = 0.015 * uGlassLiquidFlow * uSpeedMultiplier;
  float rimLightWidth = 0.05;
  float glassEdgeWidth = 0.025;

  float brightnessPhase = smoothstep(0.8, 1.0, progress);
  float rimLightIntensity = 0.08 * (1.0 - brightnessPhase) * uGlassEdgeGlow * uGlobalIntensity;
  float glassEdgeOpacity = 0.06 * (1.0 - brightnessPhase) * uGlassEdgeGlow;

  vec2 center = vec2(0.5, 0.5);
  vec2 p = uv * uResolution;

  vec2 uv1 = getCoverUV(uv, uTexture1Size);
  vec2 uv2_base = getCoverUV(uv, uTexture2Size);

  float maxRadius = length(uResolution) * 0.85;
  float bubbleRadius = progress * maxRadius;
  vec2 sphereCenter = center * uResolution;

  float dist = length(p - sphereCenter);
  float normalizedDist = dist / max(bubbleRadius, 0.001);
  vec2 direction = (dist > 0.0) ? (p - sphereCenter) / dist : vec2(0.0);
  float inside = smoothstep(bubbleRadius + 3.0, bubbleRadius - 3.0, dist);

  float distanceFactor = smoothstep(clearCenterSize, 1.0, normalizedDist);
  float time = progress * 5.0 * uSpeedMultiplier;

  vec2 liquidSurface = vec2(
    smoothNoise(uv * 100.0 + time * 0.3),
    smoothNoise(uv * 100.0 + time * 0.2 + 50.0)
  ) - 0.5;
  liquidSurface *= surfaceRipples * distanceFactor;

  vec2 distortedUV = uv2_base;
  if (inside > 0.0) {
    float refractionOffset = glassStrength * pow(distanceFactor, 1.5);
    vec2 flowDirection = normalize(direction + vec2(sin(time), cos(time * 0.7)) * 0.3);
    distortedUV -= flowDirection * refractionOffset;

    float wave1 = sin(normalizedDist * 22.0 - time * 3.5);
    float wave2 = sin(normalizedDist * 35.0 + time * 2.8) * 0.7;
    float wave3 = sin(normalizedDist * 50.0 - time * 4.2) * 0.5;
    float combinedWave = (wave1 + wave2 + wave3) / 3.0;

    float waveOffset = combinedWave * waveDistortion * distanceFactor;
    distortedUV -= direction * waveOffset + liquidSurface;

    vec2 flowOffset = vec2(
      sin(time + normalizedDist * 10.0),
      cos(time * 0.8 + normalizedDist * 8.0)
    ) * liquidFlow * distanceFactor * inside;
    distortedUV += flowOffset;
  }

  vec4 newImg;
  if (inside > 0.0) {
    float aberrationOffset = chromaticAberration * pow(distanceFactor, 1.2);

    vec2 uv_r = distortedUV + direction * aberrationOffset * 1.2;
    vec2 uv_g = distortedUV + direction * aberrationOffset * 0.2;
    vec2 uv_b = distortedUV - direction * aberrationOffset * 0.8;

    vec3 sampleR = srgbToLinear(texture2D(uTexture2, uv_r).rgb);
    vec3 sampleG = srgbToLinear(texture2D(uTexture2, uv_g).rgb);
    vec3 sampleB = srgbToLinear(texture2D(uTexture2, uv_b).rgb);
    newImg = vec4(sampleR.r, sampleG.g, sampleB.b, 1.0);
  } else {
    newImg = sampleLinear(uTexture2, uv2_base);
  }

  if (inside > 0.0 && rimLightIntensity > 0.0) {
    float rim = smoothstep(1.0 - rimLightWidth, 1.0, normalizedDist) *
          (1.0 - smoothstep(1.0, 1.01, normalizedDist));
    newImg.rgb += rim * rimLightIntensity;

    float edge = smoothstep(1.0 - glassEdgeWidth, 1.0, normalizedDist) *
           (1.0 - smoothstep(1.0, 1.01, normalizedDist));
    newImg.rgb = mix(newImg.rgb, vec3(1.0), edge * glassEdgeOpacity);
  }

  newImg.rgb = mix(newImg.rgb, newImg.rgb * 1.2, (uColorEnhancement - 1.0) * 0.5);

  vec4 currentImg = sampleLinear(uTexture1, uv1);

  if (progress > 0.95) {
    vec4 pureNewImg = sampleLinear(uTexture2, uv2_base);
    float endTransition = (progress - 0.95) / 0.05;
    newImg = mix(newImg, pureNewImg, endTransition);
  }

  return mix(currentImg, newImg, inside);
}

void main() {
  vec4 outColor = glassEffect(vUv, uProgress);
  gl_FragColor = vec4(linearToSrgb(outColor.rgb), outColor.a);
}`;

// GSAP power3.inOut: cubic ease-in-out. Matches motion-core's transition tween.
function power3InOut(x: number): number {
  const t = Math.min(1, Math.max(0, x));
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// HSV -> RGB (0..255) for distinct fallback slide gradients.
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

function fallbackSlideData(size: number, index: number, count: number): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const baseHue = count > 0 ? index / count : 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const vv = y / (size - 1);
      const h = (baseHue + u * 0.15) % 1;
      const [r, g, b] = hsv(h, 0.55, 0.35 + vv * 0.5);
      const i = (y * size + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

// Numeric-aware sort of asset keys (image0, image1, ... image10).
function collectImageKeys(assets: Record<string, string>): string[] {
  return Object.keys(assets)
    .filter((k) => /^image\d+$/.test(k) && assets[k])
    .sort((a, b) => {
      const na = parseInt(a.replace('image', ''), 10);
      const nb = parseInt(b.replace('image', ''), 10);
      return na - nb;
    });
}

// Number of slide upload slots (matches the image0..image3 file params in the
// manifest). At least this many slide textures always exist.
const UPLOAD_SLOTS = 4;

export function createGlassSlideshowEffect(): Effect {
  let dead = false;
  let renderer: Renderer | null = null;
  let mesh: Mesh | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let uniforms: Record<string, { value: any }> | null = null;

  let viewW = 1;
  let viewH = 1;

  // Slide state.
  let textures: Texture[] = [];
  let texSizes: Array<[number, number]> = [];
  let current = 0;
  let target = 0;
  let transitioning = false;
  let transitionStart = 0;
  let idleAnchor = 0; // host-clock anchor for the autoplay timer
  let started = false;
  let pendingTarget = -1; // a setParam('index') request awaiting the next frame clock

  // Scroll / drag navigation (advance-through). The wheel and a horizontal drag
  // both accumulate toward a one-slide threshold; crossing it queues a slide
  // advance that frame() begins against the host clock. No internal listeners or
  // RAF - the compositor forwards onWheel/onPointer and we drive from frame(t).
  let wheelAccum = 0; // accumulated wheel deltaY toward the next advance
  let dragAccum = 0; // accumulated horizontal drag (px) toward the next advance
  let dragLastX = NaN; // last pointer x while pressed (NaN = not dragging)
  let pendingDir = 0; // queued net slide advances (+ = forward, - = back)
  const WHEEL_STEP = 120; // wheel deltaY for one slide (~one notch)
  const DRAG_STEP = 130; // horizontal drag px for one slide

  // Widget params.
  let transitionDuration = 2000;
  let autoplay = true;
  let autoplayInterval = 5000;

  function setSlideTextures() {
    if (!uniforms || textures.length === 0) return;
    uniforms.uTexture1.value = textures[current];
    uniforms.uTexture2.value = textures[target];
    const s1 = texSizes[current] ?? [256, 256];
    const s2 = texSizes[target] ?? [256, 256];
    uniforms.uTexture1Size.value.set(s1[0], s1[1]);
    uniforms.uTexture2Size.value.set(s2[0], s2[1]);
  }

  function beginTransition(to: number, t: number) {
    if (textures.length < 2) return;
    const dest = ((to % textures.length) + textures.length) % textures.length;
    if (dest === current && !transitioning) return;
    target = dest;
    transitioning = true;
    transitionStart = t;
    setSlideTextures();
  }

  function loadSlide(url: string, slot: number) {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (dead || !uniforms || !textures[slot]) return;
      textures[slot].image = img;
      textures[slot].needsUpdate = true;
      texSizes[slot] = [img.width || 1, img.height || 1];
      setSlideTextures();
    };
    img.src = url;
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }
      const p = opts.params;
      transitionDuration = Math.max(1, Number(p.transitionDuration ?? 2000));
      autoplay = p.autoplay !== undefined ? Boolean(p.autoplay) : true;
      autoplayInterval = Math.max(1, Number(p.autoplayInterval ?? 5000));
      current = Math.max(0, Math.floor(Number(p.index ?? 0)));
      target = current;

      renderer = new Renderer({ canvas, dpr: 1, alpha: false });
      const rgl = renderer.gl;
      viewW = Math.max(1, canvas.width || 1);
      viewH = Math.max(1, canvas.height || 1);

      // Build slide textures from assets (image0, image1, ...) or fallbacks.
      // At least UPLOAD_SLOTS slots exist so each image* file param has a slide
      // to fill on upload (the manifest exposes image0..image3 upload controls).
      const keys = collectImageKeys(opts.assets);
      const count = Math.max(UPLOAD_SLOTS, keys.length, 2);
      textures = [];
      texSizes = [];
      for (let i = 0; i < count; i++) {
        const data = fallbackSlideData(256, i, count);
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
      if (current >= textures.length) current = 0;
      target = current;

      uniforms = {
        uTexture1: { value: textures[current] },
        uTexture2: { value: textures[target] },
        uProgress: { value: 0 },
        uResolution: { value: new Vec2(viewW, viewH) },
        uTexture1Size: { value: new Vec2(256, 256) },
        uTexture2Size: { value: new Vec2(256, 256) },
        uGlobalIntensity: { value: Number(p.intensity ?? 1.0) },
        uDistortionStrength: { value: Number(p.distortion ?? 1.0) },
        uSpeedMultiplier: { value: Number(p.speedMultiplier ?? 1.0) },
        uColorEnhancement: { value: Number(p.colorEnhancement ?? 1.0) },
        uGlassRefractionStrength: { value: Number(p.refraction ?? 1.0) },
        uGlassChromaticAberration: { value: Number(p.chromaticAberration ?? 1.0) },
        uGlassBubbleClarity: { value: Number(p.bubbleClarity ?? 1.0) },
        uGlassEdgeGlow: { value: Number(p.edgeGlow ?? 1.0) },
        uGlassLiquidFlow: { value: Number(p.liquidFlow ?? 1.0) },
      };

      const geometry = new Triangle(rgl);
      const program = new Program(rgl, { vertex: VERTEX, fragment: FRAGMENT, uniforms });
      mesh = new Mesh(rgl, { geometry, program });
      setSlideTextures();

      // Wire each slot's source (override the fallback gradient as it loads). A
      // user-uploaded image* file param (object URL) wins over the bundled asset.
      for (let i = 0; i < textures.length; i++) {
        const up = opts.params[`image${i}`];
        const url = (typeof up === 'string' && up) || opts.assets[`image${i}`];
        if (url) loadSlide(url, i);
      }
    },

    frame(t: number) {
      if (dead || !renderer || !mesh || !uniforms) return;
      if (!started) {
        started = true;
        idleAnchor = t;
      }

      // A setParam('index', n) request takes effect on the next frame so it is
      // anchored to the real host clock.
      if (pendingTarget >= 0 && !transitioning) {
        beginTransition(pendingTarget, t);
        pendingTarget = -1;
      }

      // A queued scroll/drag advance begins one slide transition per idle frame,
      // anchored to the host clock. While transitioning we hold the queue so each
      // gesture resolves as a clean one-slide glass transition.
      if (pendingDir !== 0 && !transitioning && textures.length >= 2) {
        const dir = pendingDir > 0 ? 1 : -1;
        pendingDir -= dir;
        beginTransition(current + dir, t);
      }

      if (transitioning) {
        const raw = (t - transitionStart) / transitionDuration;
        if (raw >= 1) {
          // Finalize: target becomes the current slide.
          uniforms.uProgress.value = 0;
          current = target;
          transitioning = false;
          idleAnchor = t;
          setSlideTextures();
        } else {
          uniforms.uProgress.value = power3InOut(raw);
        }
      } else if (autoplay && textures.length >= 2 && t - idleAnchor >= autoplayInterval) {
        beginTransition(current + 1, t);
      }

      renderer.render({ scene: mesh });
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !uniforms) return;
      viewW = Math.max(1, w);
      viewH = Math.max(1, h);
      renderer.setSize(viewW, viewH);
      uniforms.uResolution.value.set(viewW, viewH);
    },

    setParam(key: string, value: unknown) {
      if (dead || !uniforms) return;
      // Slide uploads: an image* file param loads its texture into the matching
      // slot (the slide shows next time that slot is the transition target).
      const slot = /^image(\d+)$/.exec(key);
      if (slot) {
        const i = parseInt(slot[1], 10);
        if (value && i < textures.length) loadSlide(String(value), i);
        return;
      }
      switch (key) {
        case 'transitionDuration':
          transitionDuration = Math.max(1, Number(value));
          break;
        case 'autoplay':
          autoplay = Boolean(value);
          break;
        case 'autoplayInterval':
          autoplayInterval = Math.max(1, Number(value));
          break;
        case 'index': {
          // Defer to the next frame so the transition is anchored to the host clock.
          pendingTarget = Math.max(0, Math.floor(Number(value)));
          break;
        }
        case 'intensity':
          uniforms.uGlobalIntensity.value = Number(value);
          break;
        case 'distortion':
          uniforms.uDistortionStrength.value = Number(value);
          break;
        case 'speedMultiplier':
          uniforms.uSpeedMultiplier.value = Number(value);
          break;
        case 'colorEnhancement':
          uniforms.uColorEnhancement.value = Number(value);
          break;
        case 'refraction':
          uniforms.uGlassRefractionStrength.value = Number(value);
          break;
        case 'chromaticAberration':
          uniforms.uGlassChromaticAberration.value = Number(value);
          break;
        case 'bubbleClarity':
          uniforms.uGlassBubbleClarity.value = Number(value);
          break;
        case 'edgeGlow':
          uniforms.uGlassEdgeGlow.value = Number(value);
          break;
        case 'liquidFlow':
          uniforms.uGlassLiquidFlow.value = Number(value);
          break;
        default:
          break;
      }
    },

    // Scroll advances the slideshow: scroll down/forward -> next slide, up -> prev.
    // Wheel deltas accumulate to a one-slide threshold so a single notch (or a
    // trackpad flick) advances exactly one slide.
    onWheel(deltaY: number) {
      if (dead) return;
      wheelAccum += deltaY;
      while (wheelAccum >= WHEEL_STEP) {
        pendingDir += 1;
        wheelAccum -= WHEEL_STEP;
      }
      while (wheelAccum <= -WHEEL_STEP) {
        pendingDir -= 1;
        wheelAccum += WHEEL_STEP;
      }
    },

    onPointerDown(x: number) {
      if (dead) return;
      dragLastX = x;
      dragAccum = 0;
    },

    // Horizontal drag scrubs through slides: drag left -> next, right -> prev.
    // Only an active press (pressed) advances; a bare hover does nothing.
    onPointer(x: number, _y: number, pressed?: boolean) {
      if (dead) return;
      if (!pressed) {
        dragLastX = NaN;
        return;
      }
      if (Number.isNaN(dragLastX)) {
        dragLastX = x;
        return;
      }
      const dx = x - dragLastX;
      dragLastX = x;
      dragAccum -= dx; // drag left (dx<0) advances forward
      while (dragAccum >= DRAG_STEP) {
        pendingDir += 1;
        dragAccum -= DRAG_STEP;
      }
      while (dragAccum <= -DRAG_STEP) {
        pendingDir -= 1;
        dragAccum += DRAG_STEP;
      }
    },

    onPointerUp() {
      dragLastX = NaN;
    },

    onPointerLeave() {
      dragLastX = NaN;
    },

    dispose() {
      if (renderer) {
        const lose = renderer.gl?.getExtension('WEBGL_lose_context');
        lose?.loseContext();
        renderer = null;
      }
      mesh = null;
      uniforms = null;
      textures = [];
      texSizes = [];
      transitioning = false;
      started = false;
      pendingTarget = -1;
      wheelAccum = 0;
      dragAccum = 0;
      dragLastX = NaN;
      pendingDir = 0;
      dead = true;
    },
  };
}
