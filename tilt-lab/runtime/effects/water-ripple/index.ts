import { Renderer, Transform, Triangle, Program, Mesh, Plane, Camera, RenderTarget, Texture, Vec2 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

// Ported verbatim from Motion Core (github.com/motion-core/motion-core), water-ripple.
// Original Svelte/OGL Scene owns a requestAnimationFrame tick; tilt-lab drives
// frame(t) externally and forwards the cursor through onPointer(x, y).
// A pool of additive brush Planes is stamped at the cursor into an offscreen
// displacement RenderTarget; the main pass reads it and offsets the image UV.
// Needs a CORS-enabled image (assets.image) and a brush PNG (assets["water-ripple-brush"]).
// MIT-licensed; ok here.

const MAX_WAVES = 100;

const VERTEX = `attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `precision highp float;
uniform sampler2D uTexture;
uniform sampler2D uDisplacement;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
varying vec2 vUv;
const float PI = 3.141592653589793238;
vec2 getCoverUV(vec2 uv, vec2 textureSize) {
  vec2 safeTexture = max(textureSize, vec2(1.0));
  vec2 s = uResolution / safeTexture;
  float scale = max(s.x, s.y);
  vec2 scaledSize = safeTexture * scale;
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}
void main() {
  vec2 coverUv = getCoverUV(vUv, uTextureSize);
  vec4 displacement = texture2D(uDisplacement, vUv);
  float theta = displacement.r * 2.0 * PI;
  vec2 dir = vec2(sin(theta), cos(theta));
  vec2 finalUv = coverUv + dir * displacement.r * 0.05;
  gl_FragColor = texture2D(uTexture, finalUv);
}`;

const BRUSH_VERTEX = `attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BRUSH_FRAGMENT = `precision highp float;
uniform sampler2D uBrush;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  vec4 tex = texture2D(uBrush, vUv);
  gl_FragColor = vec4(tex.rgb * uOpacity, tex.a * uOpacity);
}`;

interface Wave {
  mesh: Mesh;
  prog: Program;
  opacity: number;
  scaleX: number;
  active: boolean;
}

export function createWaterRippleEffect(): Effect {
  let renderer: Renderer | null = null;
  let mainScene: Transform | null = null;
  let brushScene: Transform | null = null;
  let brushCamera: Camera | null = null;
  let target: RenderTarget | null = null;
  let mainProgram: Program | null = null;
  let imageTexture: Texture | null = null;
  let brushTexture: Texture | null = null;
  const waves: Wave[] = [];
  let waveCursor = 0;
  let dead = false;
  let w = 1;
  let h = 1;
  let lastT = 0;
  let brushSize = 100;
  let lastPx: { x: number; y: number } | null = null;

  const mainUniforms: Record<string, { value: unknown }> = {
    uTexture: { value: null },
    uDisplacement: { value: null },
    uResolution: { value: new Vec2(1, 1) },
    uTextureSize: { value: new Vec2(1, 1) },
  };

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const probe = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!probe) {
        dead = true;
        return;
      }
      if (opts.params.brushSize != null) brushSize = Number(opts.params.brushSize);

      const dpr = Math.min(2, (typeof globalThis !== 'undefined' && (globalThis as { devicePixelRatio?: number }).devicePixelRatio) || 1);
      renderer = new Renderer({ canvas, alpha: true, dpr });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);

      target = new RenderTarget(gl, { width: 1, height: 1 });

      // Placeholder image until the asset loads.
      imageTexture = new Texture(gl, { image: new Uint8Array([0, 0, 0, 0]), width: 1, height: 1, generateMipmaps: false });
      brushTexture = new Texture(gl, { image: new Uint8Array([255, 255, 255, 255]), width: 1, height: 1, generateMipmaps: false });

      mainUniforms.uTexture.value = imageTexture;
      mainUniforms.uDisplacement.value = target.texture;

      const imgUrl = opts.assets.image;
      if (imgUrl && typeof Image !== 'undefined') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!imageTexture) return;
          imageTexture.image = img;
          imageTexture.needsUpdate = true;
          (mainUniforms.uTextureSize.value as Vec2).set(img.naturalWidth || 1, img.naturalHeight || 1);
        };
        img.src = imgUrl;
      }
      const brushUrl = opts.assets['water-ripple-brush'];
      if (brushUrl && typeof Image !== 'undefined') {
        const bimg = new Image();
        bimg.crossOrigin = 'anonymous';
        bimg.onload = () => {
          if (!brushTexture) return;
          brushTexture.image = bimg;
          brushTexture.needsUpdate = true;
        };
        bimg.src = brushUrl;
      }

      // Main full-screen pass.
      mainScene = new Transform();
      const tri = new Triangle(gl);
      mainProgram = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms: mainUniforms });
      new Mesh(gl, { geometry: tri, program: mainProgram }).setParent(mainScene);

      // Brush pool (additive blend) into the displacement target.
      brushScene = new Transform();
      brushCamera = new Camera(gl, { left: -1, right: 1, top: 1, bottom: -1, near: -1000, far: 1000 });
      const plane = new Plane(gl);
      for (let i = 0; i < MAX_WAVES; i++) {
        const prog = new Program(gl, {
          vertex: BRUSH_VERTEX,
          fragment: BRUSH_FRAGMENT,
          uniforms: { uBrush: { value: brushTexture }, uOpacity: { value: 0 } },
          transparent: true,
        });
        prog.setBlendFunc(gl.SRC_ALPHA, gl.ONE);
        const mesh = new Mesh(gl, { geometry: plane, program: prog });
        mesh.visible = false;
        mesh.setParent(brushScene);
        waves.push({ mesh, prog, opacity: 0, scaleX: 0.1, active: false });
      }
    },
    onPointer(x: number, y: number) {
      if (dead || !brushCamera) return;
      if (lastPx) {
        const dx = x - lastPx.x;
        const dy = y - lastPx.y;
        if (Math.sqrt(dx * dx + dy * dy) < 4) return;
      }
      lastPx = { x, y };

      // Centered, y-up coordinates in the brush camera space.
      const cx = x - w / 2;
      const cy = h / 2 - y;
      const wave = waves[waveCursor];
      waveCursor = (waveCursor + 1) % MAX_WAVES;
      if (!wave) return;
      wave.active = true;
      wave.opacity = 1;
      wave.scaleX = 0.1;
      wave.mesh.visible = true;
      wave.mesh.position.set(cx, cy, 0);
      wave.mesh.rotation.z = (Math.random() * 2 - 1) * Math.PI;
      wave.mesh.scale.set(brushSize * wave.scaleX, brushSize, 1);
    },
    frame(t: number) {
      if (dead || !renderer || !mainScene || !brushScene || !brushCamera || !target) return;
      const dt = lastT === 0 ? 16.667 : t - lastT;
      lastT = t;
      const timeScale = Math.max(0, dt) / 16.667;

      for (const wave of waves) {
        if (!wave.active) continue;
        wave.mesh.rotation.z += 0.02 * timeScale;
        wave.opacity *= Math.pow(0.96, timeScale);
        wave.opacity *= Math.pow(0.99, timeScale);
        wave.scaleX = 0.982 * wave.scaleX + 0.108;
        (wave.prog.uniforms.uOpacity as { value: number }).value = wave.opacity;
        wave.mesh.scale.set(brushSize * wave.scaleX, brushSize, 1);
        if (wave.opacity < 0.01) {
          wave.active = false;
          wave.mesh.visible = false;
        }
      }

      // Pass 1: stamp brushes into the displacement target.
      renderer.render({ scene: brushScene, camera: brushCamera, target });
      // Pass 2: main image distortion to the screen.
      renderer.render({ scene: mainScene });
    },
    resize(nw: number, nh: number) {
      w = nw;
      h = nh;
      if (dead || !renderer || !target || !brushCamera) return;
      renderer.setSize(nw, nh);
      const gl = renderer.gl;
      const bw = gl.drawingBufferWidth;
      const bh = gl.drawingBufferHeight;
      (mainUniforms.uResolution.value as Vec2).set(bw, bh);
      target.setSize(bw, bh);
      // Ortho bounds in CSS pixels, centered, y-up.
      brushCamera.orthographic({ left: -w / 2, right: w / 2, top: h / 2, bottom: -h / 2, near: -1000, far: 1000 });
    },
    setParam(key: string, value: unknown) {
      if (key === 'brushSize') brushSize = Number(value);
    },
    dispose() {
      for (const wave of waves) wave.mesh.setParent(null);
      waves.length = 0;
      mainProgram = null;
      mainScene = null;
      brushScene = null;
      brushCamera = null;
      target = null;
      imageTexture = null;
      brushTexture = null;
      renderer = null;
    },
  };
}
