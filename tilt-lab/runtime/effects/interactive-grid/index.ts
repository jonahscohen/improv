import { Renderer, Transform, Triangle, Program, Mesh, Texture, Vec2 } from 'ogl';
import type { Effect, EffectOpts } from '../../types';

// Ported verbatim from Motion Core (github.com/motion-core/motion-core), interactive-grid.
// Original Svelte/OGL Scene owns a requestAnimationFrame tick; tilt-lab drives
// frame(t) externally and forwards the cursor through onPointer(x, y).
// A CPU-side grid data texture stores per-cell velocity; the cursor injects
// velocity and cells relax back. The fragment shader displaces the image UV.
// Needs a CORS-enabled image (assets.image). MIT-licensed; ok here.

const VERTEX = `attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`;

const FRAGMENT = `precision highp float;
uniform float time;
uniform vec2 uResolution;
uniform vec2 uTextureSize;
uniform sampler2D uDataTexture;
uniform sampler2D uTexture;
varying vec2 vUv;

vec2 getCoverUV(vec2 uv, vec2 textureSize) {
  vec2 s = uResolution / textureSize;
  float scale = max(s.x, s.y);
  vec2 scaledSize = textureSize * scale;
  vec2 offset = (uResolution - scaledSize) * 0.5;
  return (uv * uResolution - offset) / scaledSize;
}

void main() {
  vec2 coverUv = getCoverUV(vUv, uTextureSize);
  vec4 data = texture2D(uDataTexture, vUv);
  vec2 displacedUV = coverUv - 0.02 * data.rg;
  vec4 color = texture2D(uTexture, displacedUV);
  gl_FragColor = color;
}`;

export function createInteractiveGridEffect(): Effect {
  let renderer: Renderer | null = null;
  let scene: Transform | null = null;
  let mesh: Mesh | null = null;
  let program: Program | null = null;
  let dataTexture: Texture | null = null;
  let imageTexture: Texture | null = null;
  let dead = false;
  let w = 1;
  let h = 1;

  let gridSize = 15;
  let mouseSize = 0.15;
  let strength = 0.35;
  let relaxation = 0.9;

  let data = new Float32Array(gridSize * gridSize * 4);
  let mouseX = 0;
  let mouseY = 0;
  let lastMouseX = 0;
  let lastMouseY = 0;
  let currentVX = 0;
  let currentVY = 0;
  let pointerSeen = false;

  const uniforms: Record<string, { value: unknown }> = {
    time: { value: 0 },
    uResolution: { value: new Vec2(1, 1) },
    uTextureSize: { value: new Vec2(1, 1) },
    uDataTexture: { value: null },
    uTexture: { value: null },
  };

  function rebuildData() {
    data = new Float32Array(gridSize * gridSize * 4);
    if (renderer && dataTexture) {
      dataTexture.image = data as unknown as Texture['image'];
      dataTexture.width = gridSize;
      dataTexture.height = gridSize;
      dataTexture.needsUpdate = true;
    }
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const probe = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!probe) {
        dead = true;
        return;
      }
      const pr = opts.params;
      if (pr.grid != null) gridSize = Math.max(1, Math.round(Number(pr.grid)));
      if (pr.mouseSize != null) mouseSize = Number(pr.mouseSize);
      if (pr.strength != null) strength = Number(pr.strength);
      if (pr.relaxation != null) relaxation = Number(pr.relaxation);
      data = new Float32Array(gridSize * gridSize * 4);

      const dpr = Math.min(2, (typeof globalThis !== 'undefined' && (globalThis as { devicePixelRatio?: number }).devicePixelRatio) || 1);
      renderer = new Renderer({ canvas, alpha: true, dpr });
      const gl = renderer.gl;
      gl.clearColor(0, 0, 0, 0);
      if (!renderer.isWebgl2) gl.getExtension('OES_texture_float');

      dataTexture = new Texture(gl, {
        image: data as unknown as Texture['image'],
        width: gridSize,
        height: gridSize,
        type: gl.FLOAT,
        format: gl.RGBA,
        internalFormat: renderer.isWebgl2 ? (gl as WebGL2RenderingContext).RGBA32F : gl.RGBA,
        magFilter: gl.NEAREST,
        minFilter: gl.NEAREST,
        generateMipmaps: false,
        flipY: false,
      });

      // 1x1 transparent placeholder until the image loads.
      imageTexture = new Texture(gl, {
        image: new Uint8Array([0, 0, 0, 0]),
        width: 1,
        height: 1,
        generateMipmaps: false,
      });

      uniforms.uDataTexture.value = dataTexture;
      uniforms.uTexture.value = imageTexture;

      const url = opts.assets.image;
      if (url && typeof Image !== 'undefined') {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          if (!imageTexture) return;
          imageTexture.image = img;
          imageTexture.needsUpdate = true;
          (uniforms.uTextureSize.value as Vec2).set(img.naturalWidth || 1, img.naturalHeight || 1);
        };
        img.src = url;
      }

      scene = new Transform();
      const geometry = new Triangle(gl);
      program = new Program(gl, { vertex: VERTEX, fragment: FRAGMENT, uniforms });
      mesh = new Mesh(gl, { geometry, program });
      mesh.setParent(scene);
    },
    onPointer(x: number, y: number) {
      if (dead) return;
      const nx = w > 0 ? x / w : 0;
      const ny = h > 0 ? y / h : 0;
      if (pointerSeen) {
        currentVX += nx - lastMouseX;
        currentVY += ny - lastMouseY;
      }
      lastMouseX = nx;
      lastMouseY = ny;
      mouseX = nx;
      mouseY = ny;
      pointerSeen = true;
    },
    frame(t: number) {
      if (dead || !renderer || !scene || !dataTexture) return;

      const gridMouseX = gridSize * mouseX;
      const gridMouseY = gridSize * (1 - mouseY);
      const maxDist = gridSize * mouseSize;
      const aspect = w > 0 ? h / w : 1;
      const maxDistSq = maxDist * maxDist;
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const distance = ((gridMouseX - i) ** 2) / aspect + (gridMouseY - j) ** 2;
          if (distance < maxDistSq) {
            const index = 4 * (i + gridSize * j);
            let power = maxDist / Math.sqrt(distance);
            if (!Number.isFinite(power) || power > 10) power = 10;
            data[index] += strength * 100 * currentVX * power;
            data[index + 1] -= strength * 100 * currentVY * power;
          }
          const idx = 4 * (i + gridSize * j);
          data[idx] *= relaxation;
          data[idx + 1] *= relaxation;
        }
      }
      currentVX *= 0.9;
      currentVY *= 0.9;
      dataTexture.needsUpdate = true;

      uniforms.time.value = t / 1000;
      renderer.render({ scene });
    },
    resize(nw: number, nh: number) {
      w = nw;
      h = nh;
      if (dead || !renderer) return;
      renderer.setSize(nw, nh);
      const gl = renderer.gl;
      (uniforms.uResolution.value as Vec2).set(gl.drawingBufferWidth, gl.drawingBufferHeight);
    },
    setParam(key: string, value: unknown) {
      if (key === 'grid') {
        gridSize = Math.max(1, Math.round(Number(value)));
        rebuildData();
      } else if (key === 'mouseSize') mouseSize = Number(value);
      else if (key === 'strength') strength = Number(value);
      else if (key === 'relaxation') relaxation = Number(value);
    },
    dispose() {
      if (mesh) mesh.setParent(null);
      mesh = null;
      program = null;
      scene = null;
      dataTexture = null;
      imageTexture = null;
      renderer = null;
    },
  };
}
