import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { Effect, EffectOpts } from '../../types';

/**
 * Particle Swarm - a Three.js InstancedMesh swarm that morphs between target
 * shapes (sphere / cube / helix / torus) under an UnrealBloom pass.
 *
 * REIMPLEMENTED from the documented behaviour in the casberry recon report
 * (lane-5). The source site (particles.casberry.in) ships no license and is a
 * proprietary product, so this is a clean reimplementation of the generic
 * swarm mechanism (random cloud -> per-particle position lerp toward a target,
 * idle sine bob, per-instance color, selectable render style, bloom) rather
 * than a verbatim copy. Manifest redistribution is "reimplemented".
 *
 * Loop adaptation: the source owns a RAF via THREE.Clock + requestAnimationFrame
 * and uses OrbitControls auto-rotate. tilt-lab drives frame(t) externally, so
 * we derive delta from the injected clock and rotate the worldGroup ourselves
 * (no OrbitControls, no pointer dependency - this is a passive background).
 *
 * Headless-safe: if no WebGL context is available (happy-dom), init marks the
 * effect dead and every method no-ops.
 */

type ShapeName = 'sphere' | 'cube' | 'helix' | 'torus';
type RenderStyle =
  | 'spark'
  | 'plasma'
  | 'vector'
  | 'cyber'
  | 'ink'
  | 'paint'
  | 'steel'
  | 'glass';

const BILLBOARD_STYLES: RenderStyle[] = ['plasma', 'ink', 'paint'];
const TIME_DRIVEN_STYLES: RenderStyle[] = ['plasma', 'ink', 'paint'];

interface Extra {
  seed: number;
}

function hexToRgb(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0x00ff88;
  return parseInt(m[1], 16);
}

export function createParticlesEffect(): Effect {
  let dead = false;

  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let worldGroup: THREE.Group | null = null;
  let composer: EffectComposer | null = null;
  let bloomPass: UnrealBloomPass | null = null;
  let mesh: THREE.InstancedMesh | null = null;

  // Geometry + material caches (built once we have a GL context).
  const geometries: Partial<Record<string, THREE.BufferGeometry>> = {};
  const materials: Partial<Record<RenderStyle, THREE.Material>> = {};

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();
  const lookTarget = new THREE.Vector3();

  // Simulation state.
  let count = 20000;
  let particleSize = 0.25;
  let hoverStrength = 0.05;
  let speed = 1.0;
  let autoSpin = true;
  let autoSpinSpeed = 2.0;
  let shape: ShapeName = 'sphere';
  let renderStyle: RenderStyle = 'spark';
  let baseColorHex = 0x00ff88;

  let current: THREE.Vector3[] = [];
  let target: THREE.Vector3[] = [];
  let extras: Extra[] = [];

  let lastT = 0;
  let primed = false;
  let simTime = 0;
  let viewW = 1;
  let viewH = 1;

  // ---- shaders (reimplemented, functionally equivalent to the recon source) ----

  const PLASMA_VERT = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vUv = uv;
      vColor = instanceColor;
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }`;
  const PLASMA_FRAG = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;
    uniform float uTime;
    void main() {
      float dist = distance(vUv, vec2(0.5));
      float ring = smoothstep(0.4, 0.45, dist) - smoothstep(0.45, 0.5, dist);
      float core = 1.0 - smoothstep(0.0, 0.1, dist);
      float alpha = core + ring * (0.5 + 0.5 * sin(uTime * 3.0));
      if (alpha < 0.05) discard;
      gl_FragColor = vec4(vColor, alpha);
    }`;

  const FLAT_VERT = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vUv = uv;
      vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }`;
  const INK_FRAG = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;
    uniform float uTime;
    float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 ip = floor(p);
      vec2 u = fract(p);
      u = u * u * (3.0 - 2.0 * u);
      float res = mix(
        mix(rand(ip), rand(ip + vec2(1.0, 0.0)), u.x),
        mix(rand(ip + vec2(0.0, 1.0)), rand(ip + vec2(1.0, 1.0)), u.x),
        u.y);
      return res * res;
    }
    void main() {
      float dist = distance(vUv, vec2(0.5));
      float n = noise(vUv * 5.0 + uTime * 0.5);
      float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * (0.5 + 0.5 * n);
      if (alpha < 0.1) discard;
      gl_FragColor = vec4(vColor + 0.2, alpha * 0.8);
    }`;
  const PAINT_FRAG = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vColor;
    uniform float uTime;
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      for (int i = 1; i < 4; i++) {
        p.x += 0.3 / float(i) * sin(float(i) * 3.0 * p.y + uTime * 0.4);
        p.y += 0.3 / float(i) * cos(float(i) * 3.0 * p.x + uTime * 0.4);
      }
      float r = cos(p.x + p.y + 1.0) * 0.5 + 0.5;
      float pattern = (sin(p.x + p.y) + cos(p.x + p.y)) * 0.5 + 0.5;
      float dist = distance(vUv, vec2(0.5));
      if (dist > 0.5) discard;
      vec3 finalColor = mix(vColor, vec3(r, pattern, 1.0 - r), 0.3);
      gl_FragColor = vec4(finalColor, 1.0);
    }`;

  const STEEL_VERT = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vColor;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    }`;
  const STEEL_FRAG = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vColor;
    void main() {
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      float metallic = dot(vNormal, viewDir) * 0.5 + 0.5;
      metallic = pow(metallic, 3.0);
      vec3 col = mix(vec3(0.1), vColor, 0.5) * metallic + vec3(0.2);
      gl_FragColor = vec4(col, 1.0);
    }`;

  const GLASS_VERT = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vColor;
    void main() {
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewPosition = -mvPosition.xyz;
      vColor = instanceColor;
      gl_Position = projectionMatrix * mvPosition;
    }`;
  const GLASS_FRAG = /* glsl */ `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    varying vec3 vColor;
    void main() {
      float fresnel = dot(vNormal, normalize(vViewPosition));
      fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
      fresnel = pow(fresnel, 2.0);
      vec3 col = vColor * fresnel + vec3(0.1);
      gl_FragColor = vec4(col, 0.3 + fresnel * 0.7);
    }`;

  function disposeGeometries() {
    for (const k in geometries) {
      geometries[k]?.dispose();
      delete geometries[k];
    }
  }
  function disposeMaterials() {
    for (const k in materials) {
      materials[k as RenderStyle]?.dispose();
      delete materials[k as RenderStyle];
    }
  }

  function buildMaterials() {
    materials.spark = new THREE.MeshBasicMaterial({ color: 0xffffff });
    materials.cyber = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
    materials.vector = new THREE.MeshBasicMaterial({ color: 0x00aaff });
    materials.plasma = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: PLASMA_VERT,
      fragmentShader: PLASMA_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    materials.ink = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: FLAT_VERT,
      fragmentShader: INK_FRAG,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    materials.paint = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: FLAT_VERT,
      fragmentShader: PAINT_FRAG,
      side: THREE.DoubleSide,
    });
    materials.steel = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: STEEL_VERT,
      fragmentShader: STEEL_FRAG,
    });
    materials.glass = new THREE.ShaderMaterial({
      uniforms: {},
      vertexShader: GLASS_VERT,
      fragmentShader: GLASS_FRAG,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }

  function buildGeometries() {
    geometries.spark = new THREE.TetrahedronGeometry(particleSize);
    const cone = new THREE.ConeGeometry(0.1, 0.5, 4);
    cone.rotateX(Math.PI / 2);
    geometries.vector = cone;
    geometries.plane = new THREE.PlaneGeometry(0.8, 0.8);
    geometries.cyber = new THREE.BoxGeometry(0.3, 0.3, 0.3);
    geometries.sphere = new THREE.SphereGeometry(0.3, 16, 16);
  }

  function styleAssets(style: RenderStyle): {
    geo: THREE.BufferGeometry;
    mat: THREE.Material;
  } {
    switch (style) {
      case 'plasma':
        return { geo: geometries.plane!, mat: materials.plasma! };
      case 'vector':
        return { geo: geometries.vector!, mat: materials.vector! };
      case 'cyber':
        return { geo: geometries.cyber!, mat: materials.cyber! };
      case 'ink':
        return { geo: geometries.plane!, mat: materials.ink! };
      case 'paint':
        return { geo: geometries.plane!, mat: materials.paint! };
      case 'steel':
        return { geo: geometries.sphere!, mat: materials.steel! };
      case 'glass':
        return { geo: geometries.sphere!, mat: materials.glass! };
      case 'spark':
      default:
        return { geo: geometries.spark!, mat: materials.spark! };
    }
  }

  // Fill positions.target + per-instance colors for the active shape.
  function applyShape() {
    if (!mesh) return;
    switch (shape) {
      case 'sphere': {
        const r = 30;
        for (let i = 0; i < count; i++) {
          const phi = Math.acos(-1 + (2 * i) / count);
          const theta = Math.sqrt(count * Math.PI) * phi;
          target[i].set(
            r * Math.cos(theta) * Math.sin(phi),
            r * Math.sin(theta) * Math.sin(phi),
            r * Math.cos(phi),
          );
          mesh.setColorAt(i, tmpColor.setHex(baseColorHex));
        }
        break;
      }
      case 'cube': {
        const s = Math.ceil(Math.cbrt(count));
        const sep = 2.5;
        const off = (s * sep) / 2;
        let idx = 0;
        for (let x = 0; x < s && idx < count; x++) {
          for (let y = 0; y < s && idx < count; y++) {
            for (let z = 0; z < s && idx < count; z++) {
              target[idx].set(x * sep - off, y * sep - off, z * sep - off);
              mesh.setColorAt(idx, tmpColor.setHex(0x00aaff));
              idx++;
            }
          }
        }
        break;
      }
      case 'helix': {
        const r = 15;
        const h = count * 0.003;
        const off = h / 2;
        for (let i = 0; i < count; i++) {
          const t = i * 0.05;
          target[i].set(Math.cos(t) * r, i * 0.003 - off, Math.sin(t) * r);
          mesh.setColorAt(i, tmpColor.setHSL(i / count, 1, 0.5));
        }
        break;
      }
      case 'torus': {
        const R = 25;
        const r = 8;
        for (let i = 0; i < count; i++) {
          const u = (i / count) * Math.PI * 2 * 40;
          const v = (i / count) * Math.PI * 2;
          target[i].set(
            (R + r * Math.cos(u)) * Math.cos(v),
            (R + r * Math.cos(u)) * Math.sin(v),
            r * Math.sin(u),
          );
          mesh.setColorAt(i, tmpColor.setHex(0xff0055));
        }
        break;
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  // (Re)build the InstancedMesh. reseed=true generates a fresh random cloud.
  function buildMesh(reseed: boolean) {
    if (!scene || !worldGroup) return;
    if (mesh) {
      worldGroup.remove(mesh);
      mesh.dispose();
      mesh = null;
    }

    if (reseed || current.length !== count) {
      current = new Array(count);
      target = new Array(count);
      extras = new Array(count);
      for (let i = 0; i < count; i++) {
        const x = (Math.random() - 0.5) * 100;
        const y = (Math.random() - 0.5) * 100;
        const z = (Math.random() - 0.5) * 100;
        current[i] = new THREE.Vector3(x, y, z);
        target[i] = new THREE.Vector3(x, y, z);
        extras[i] = { seed: Math.random() * 100 };
      }
    }

    const { geo, mat } = styleAssets(renderStyle);
    mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    worldGroup.add(mesh);

    for (let i = 0; i < count; i++) {
      dummy.position.copy(current[i]);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tmpColor.setHex(baseColorHex));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    applyShape();
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      if (!gl) {
        dead = true;
        return;
      }

      const p = opts.params;
      count = Math.max(1, Math.floor(Number(p.count ?? 20000)));
      particleSize = Number(p.particleSize ?? 0.25);
      hoverStrength = Number(p.hoverStrength ?? 0.05);
      speed = Number(p.speed ?? 1.0);
      autoSpin = p.autoSpin === undefined ? true : Boolean(p.autoSpin);
      autoSpinSpeed = Number(p.autoSpinSpeed ?? 2.0);
      shape = (String(p.shape ?? 'sphere') as ShapeName) || 'sphere';
      renderStyle = (String(p.renderStyle ?? 'spark') as RenderStyle) || 'spark';
      baseColorHex = hexToRgb(String(p.color ?? '#00ff88'));

      viewW = canvas.width || 1;
      viewH = canvas.height || 1;

      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setClearColor(0x000000, 0);
      renderer.setSize(viewW, viewH, false);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(60, viewW / viewH, 0.1, 2000);
      camera.position.set(0, 0, 100);

      worldGroup = new THREE.Group();
      scene.add(worldGroup);

      const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5);
      scene.add(hemiLight);
      const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
      dirLight.position.set(50, 50, 50);
      scene.add(dirLight);

      composer = new EffectComposer(renderer);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(
        new THREE.Vector2(viewW, viewH),
        Number(p.bloomStrength ?? 1.8),
        Number(p.bloomRadius ?? 0.4),
        Number(p.bloomThreshold ?? 0),
      );
      composer.addPass(bloomPass);

      buildGeometries();
      buildMaterials();
      buildMesh(true);
    },

    frame(t: number) {
      if (dead || !composer || !mesh || !worldGroup) return;

      if (!primed) {
        lastT = t;
        primed = true;
      }
      const delta = Math.max(0, (t - lastT) / 1000);
      lastT = t;
      simTime += delta * speed;
      const time = simTime;

      // Drive time-based shader styles.
      const styleMat = materials[renderStyle];
      if (
        TIME_DRIVEN_STYLES.includes(renderStyle) &&
        styleMat instanceof THREE.ShaderMaterial
      ) {
        styleMat.uniforms.uTime.value = time;
      }

      const billboard = BILLBOARD_STYLES.includes(renderStyle);
      const isVector = renderStyle === 'vector';

      for (let i = 0; i < count; i++) {
        const cur = current[i];
        const tgt = target[i];
        if (!cur || !tgt) continue;

        if (isNaN(tgt.x) || !isFinite(tgt.x)) tgt.set(0, 0, 0);
        cur.lerp(tgt, 0.1);
        if (isNaN(cur.x)) cur.set(0, 0, 0);

        dummy.position.copy(cur);
        dummy.position.y += Math.sin(time + extras[i].seed) * hoverStrength;

        if (isVector) {
          if (tgt.distanceToSquared(cur) > 0.1) {
            lookTarget.copy(tgt).sub(cur).normalize().multiplyScalar(2).add(dummy.position);
            dummy.lookAt(lookTarget);
          }
        } else if (billboard && camera) {
          dummy.lookAt(camera.position);
        } else {
          dummy.rotation.set(0, 0, 0);
        }

        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;

      if (autoSpin) {
        // Map autoSpinSpeed (OrbitControls units) to radians/second.
        worldGroup.rotation.y += delta * autoSpinSpeed * (Math.PI / 30);
      }

      composer.render();
    },

    resize(w: number, h: number) {
      if (dead || !renderer || !camera || !composer) return;
      viewW = Math.max(1, w);
      viewH = Math.max(1, h);
      camera.aspect = viewW / viewH;
      camera.updateProjectionMatrix();
      renderer.setSize(viewW, viewH, false);
      composer.setSize(viewW, viewH);
      if (bloomPass) bloomPass.resolution.set(viewW, viewH);
    },

    setParam(key: string, value: unknown) {
      if (dead) return;
      switch (key) {
        case 'count':
          count = Math.max(1, Math.floor(Number(value)));
          buildMesh(true);
          break;
        case 'particleSize':
          particleSize = Number(value);
          geometries.spark?.dispose();
          geometries.spark = new THREE.TetrahedronGeometry(particleSize);
          buildMesh(false);
          break;
        case 'shape':
          shape = (String(value) as ShapeName) || shape;
          applyShape();
          break;
        case 'renderStyle':
          renderStyle = (String(value) as RenderStyle) || renderStyle;
          buildMesh(false);
          break;
        case 'speed':
          speed = Number(value);
          break;
        case 'hoverStrength':
          hoverStrength = Number(value);
          break;
        case 'autoSpin':
          autoSpin = Boolean(value);
          break;
        case 'autoSpinSpeed':
          autoSpinSpeed = Number(value);
          break;
        case 'color':
          baseColorHex = hexToRgb(String(value));
          applyShape();
          break;
        case 'bloomStrength':
          if (bloomPass) bloomPass.strength = Number(value);
          break;
        case 'bloomRadius':
          if (bloomPass) bloomPass.radius = Number(value);
          break;
        case 'bloomThreshold':
          if (bloomPass) bloomPass.threshold = Number(value);
          break;
        default:
          break;
      }
    },

    dispose() {
      if (mesh) {
        worldGroup?.remove(mesh);
        mesh.dispose();
        mesh = null;
      }
      disposeGeometries();
      disposeMaterials();
      if (composer) {
        composer.dispose?.();
        composer = null;
      }
      if (bloomPass) {
        bloomPass.dispose?.();
        bloomPass = null;
      }
      if (renderer) {
        renderer.dispose();
        renderer = null;
      }
      scene = null;
      camera = null;
      worldGroup = null;
      current = [];
      target = [];
      extras = [];
      primed = false;
      dead = true;
    },
  };
}
