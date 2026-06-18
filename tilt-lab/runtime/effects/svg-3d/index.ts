import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Effect, EffectOpts } from '../../types';

/**
 * SVG 3D - a 1:1 port of 3dsvg (the SVG -> 3D extrusion engine).
 *
 *   Ported from https://github.com/renatoworks/3dsvg (3dsvg.design)
 *   Copyright (c) 2026 Renato Costa - MIT License.
 *
 * The original is React Three Fiber (declarative JSX). This translates the same
 * pipeline - SVGLoader shape parsing, ExtrudeGeometry, triplanar UVs, the PBR
 * material presets, the multi-light rig + procedural environment cubemap, ACES
 * tone mapping, cursor-orbit + drag controls, and the intro/loop animations -
 * into tilt-lab's imperative Effect lifecycle (init/frame/resize/dispose). The
 * rendering math and constants are kept verbatim so the look matches 1:1.
 */

// A clean default mark (5-point star) so the layer renders out of the box; the
// user supplies their own SVG via the `source` file param (URL or markup).
const DEFAULT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#ffffff" d="M50 5 L60.58 35.44 L92.8 36.1 L67.12 55.56 L76.45 86.41 L50 68 L23.55 86.41 L32.88 55.56 L7.2 36.1 L39.42 35.44 Z"/></svg>';

// --- materials.ts (verbatim presets + resolver) -----------------------------
type MaterialPreset =
  | 'default' | 'plastic' | 'metal' | 'glass' | 'rubber'
  | 'chrome' | 'gold' | 'clay' | 'emissive' | 'holographic';

interface MaterialPresetData {
  metalness: number; roughness: number; opacity: number; transparent: boolean;
  emissiveIntensity?: number; clearcoat?: number;
}

const materialPresets: Record<MaterialPreset, MaterialPresetData> = {
  default: { metalness: 0.15, roughness: 0.35, opacity: 1, transparent: false },
  plastic: { metalness: 0.0, roughness: 0.3, opacity: 1, transparent: false },
  metal: { metalness: 0.9, roughness: 0.2, opacity: 1, transparent: false },
  glass: { metalness: 0.1, roughness: 0.05, opacity: 0.35, transparent: true },
  rubber: { metalness: 0.0, roughness: 0.9, opacity: 1, transparent: false },
  chrome: { metalness: 1.0, roughness: 0.05, opacity: 1, transparent: false },
  gold: { metalness: 1.0, roughness: 0.25, opacity: 1, transparent: false },
  clay: { metalness: 0.0, roughness: 1.0, opacity: 1, transparent: false },
  emissive: { metalness: 0.0, roughness: 0.5, opacity: 1, transparent: false, emissiveIntensity: 0.8 },
  holographic: { metalness: 0.8, roughness: 0.1, opacity: 0.7, transparent: true, clearcoat: 1 },
};

interface MaterialSettings {
  preset: MaterialPreset; metalness: number; roughness: number;
  opacity: number; transparent: boolean; wireframe: boolean;
}

function resolveMaterial(
  preset: MaterialPreset,
  overrides: { metalness?: number; roughness?: number; opacity?: number; wireframe?: boolean },
): MaterialSettings {
  const base = materialPresets[preset];
  const opacity = overrides.opacity ?? base.opacity;
  return {
    preset,
    metalness: overrides.metalness ?? base.metalness,
    roughness: overrides.roughness ?? base.roughness,
    opacity,
    transparent: base.transparent || opacity < 1,
    wireframe: overrides.wireframe ?? false,
  };
}

// --- scene.tsx geometry pipeline (verbatim logic) ---------------------------
function isViewBoxRect(shape: THREE.Shape, vbW: number, vbH: number): boolean {
  const pts = shape.getPoints(4);
  if (pts.length !== 4 && pts.length !== 5) return false;
  const bb = new THREE.Box2();
  for (const p of pts) bb.expandByPoint(p);
  const size = new THREE.Vector2();
  bb.getSize(size);
  const tolerance = 0.01;
  return Math.abs(size.x - vbW) / vbW < tolerance && Math.abs(size.y - vbH) / vbH < tolerance;
}

function parseShapesFromSVG(svgString: string): THREE.Shape[] {
  const loader = new SVGLoader();
  const svgData = loader.parse(svgString);
  const allShapes: THREE.Shape[] = [];

  const vbMatch = svgString.match(/viewBox\s*=\s*["']\s*([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)/);
  const vbW = vbMatch ? parseFloat(vbMatch[3]) : null;
  const vbH = vbMatch ? parseFloat(vbMatch[4]) : null;

  svgData.paths.forEach((path) => {
    const style = path.userData?.style;
    const hasFill = style?.fill && style.fill !== 'none' && style.fill !== 'transparent';
    const hasStroke = style?.stroke && style.stroke !== 'none' && style.stroke !== 'transparent';

    if (hasFill) {
      const shapes = SVGLoader.createShapes(path);
      for (const shape of shapes) {
        if (vbW && vbH && isViewBoxRect(shape, vbW, vbH)) continue;
        allShapes.push(shape);
      }
    }

    if (hasStroke) {
      const strokeWidth = parseFloat(style?.strokeWidth ?? '2');
      const divisions = 12;
      path.subPaths.forEach((subPath) => {
        const points = subPath.getPoints(divisions);
        if (points.length < 2) return;
        const shape = new THREE.Shape();
        const halfWidth = strokeWidth / 2;
        const leftSide: THREE.Vector2[] = [];
        const rightSide: THREE.Vector2[] = [];
        for (let i = 0; i < points.length; i++) {
          const curr = points[i];
          const prev = points[Math.max(0, i - 1)];
          const next = points[Math.min(points.length - 1, i + 1)];
          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          leftSide.push(new THREE.Vector2(curr.x + nx * halfWidth, curr.y + ny * halfWidth));
          rightSide.push(new THREE.Vector2(curr.x - nx * halfWidth, curr.y - ny * halfWidth));
        }
        shape.moveTo(leftSide[0].x, leftSide[0].y);
        for (let i = 1; i < leftSide.length; i++) shape.lineTo(leftSide[i].x, leftSide[i].y);
        for (let i = rightSide.length - 1; i >= 0; i--) shape.lineTo(rightSide[i].x, rightSide[i].y);
        shape.closePath();
        allShapes.push(shape);
      });
    }

    if (!hasFill && !hasStroke) {
      allShapes.push(...SVGLoader.createShapes(path));
    }
  });

  return allShapes;
}

function recomputeTriplanarUVs(geo: THREE.BufferGeometry, bb: THREE.Box3) {
  const bbSize = new THREE.Vector3();
  bb.getSize(bbSize);
  const uvAttr = geo.attributes.uv;
  const posAttr = geo.attributes.position;
  const normalAttr = geo.attributes.normal;
  const maxDimUv = Math.max(bbSize.x, bbSize.y, bbSize.z) || 1;

  for (let j = 0; j < uvAttr.count; j++) {
    const px = posAttr.getX(j);
    const py = posAttr.getY(j);
    const pz = posAttr.getZ(j);
    const nx = Math.abs(normalAttr.getX(j));
    const ny = Math.abs(normalAttr.getY(j));
    const nz = Math.abs(normalAttr.getZ(j));
    let u: number, v: number;
    if (nz >= nx && nz >= ny) {
      u = (px - bb.min.x) / maxDimUv;
      v = 1 - (py - bb.min.y) / maxDimUv;
    } else if (nx >= ny) {
      u = (pz - bb.min.z) / maxDimUv;
      v = 1 - (py - bb.min.y) / maxDimUv;
    } else {
      u = (px - bb.min.x) / maxDimUv;
      v = (pz - bb.min.z) / maxDimUv;
    }
    uvAttr.setXY(j, u, v);
  }
  uvAttr.needsUpdate = true;
}

interface BuiltGeometry { geometry: THREE.BufferGeometry; center: THREE.Vector3; baseScale: number; }

// Synchronous version of useExtrudedGeometry (no React batching/yields).
function buildGeometry(svgString: string, depth: number, smoothness: number): BuiltGeometry | null {
  const allShapes = parseShapesFromSVG(svgString);
  if (allShapes.length === 0) return null;

  const tempGeo = new THREE.ShapeGeometry(allShapes);
  tempGeo.computeBoundingBox();
  const flatSize = new THREE.Vector3();
  tempGeo.boundingBox!.getSize(flatSize);
  const maxFlatDim = Math.max(flatSize.x, flatSize.y, 1);
  tempGeo.dispose();

  const complexity = allShapes.length;
  const qualityScale = complexity > 200 ? 0.3 : complexity > 50 ? 0.6 : 1;
  const scaledDepth = (depth / 10) * maxFlatDim;
  const bevelScale = Math.min(maxFlatDim * 0.02, 1);
  const bevelSegments = Math.round((3 + smoothness * 20) * qualityScale);
  const curveSegments = Math.round((24 + smoothness * 176) * qualityScale);
  const bevelThickness = bevelScale * (0.15 + smoothness * 0.2);
  const bevelSize = bevelScale * (0.15 + smoothness * 0.2);

  const extrudeSettings = {
    depth: scaledDepth, bevelEnabled: true,
    bevelThickness, bevelSize, bevelSegments, curveSegments,
  };

  const individualGeos: THREE.ExtrudeGeometry[] = [];
  for (let i = 0; i < allShapes.length; i++) {
    individualGeos.push(new THREE.ExtrudeGeometry(allShapes[i], extrudeSettings));
  }
  const merged = BufferGeometryUtils.mergeGeometries(individualGeos, false);
  individualGeos.forEach((g) => g.dispose());
  if (!merged) return null;

  merged.computeBoundingBox();
  merged.computeVertexNormals();
  recomputeTriplanarUVs(merged, merged.boundingBox!);

  const bb = merged.boundingBox!;
  const ctr = new THREE.Vector3();
  bb.getCenter(ctr);
  const size = new THREE.Vector3();
  bb.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  const s = maxDim > 0 ? 4 / maxDim : 1;

  return { geometry: merged, center: ctr, baseScale: s };
}

// Procedural environment cubemap - the drei <Environment> child scene, verbatim
// (dark room + a bright top key, a grey front fill, a dim left fill), baked to a
// PMREM map and used as scene.environment.
function buildEnvMap(renderer: THREE.WebGLRenderer): { tex: THREE.Texture; pmrem: THREE.PMREMGenerator } {
  const envScene = new THREE.Scene();
  const add = (radius: number, color: string, pos: [number, number, number], back = false) => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 32),
      new THREE.MeshBasicMaterial({ color, side: back ? THREE.BackSide : THREE.FrontSide }),
    );
    m.position.set(pos[0], pos[1], pos[2]);
    envScene.add(m);
  };
  add(50, '#0a0a12', [0, 0, 0], true);
  add(20, '#ffffff', [0, 25, 0]);
  add(15, '#444444', [0, 0, 30]);
  add(10, '#333333', [-20, 5, 10]);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(envScene, 0.04);
  envScene.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      (o.material as THREE.Material).dispose();
    }
  });
  return { tex: rt.texture, pmrem };
}

type AnimType = 'none' | 'spin' | 'float' | 'pulse' | 'wobble' | 'spinFloat' | 'swing';

function num(v: unknown, d: number): number { const n = Number(v); return Number.isFinite(n) ? n : d; }
function str(v: unknown, d: string): string { return typeof v === 'string' && v ? v : d; }
function bool(v: unknown, d: boolean): boolean { return typeof v === 'boolean' ? v : d; }

export function createSvg3dEffect(): Effect {
  let dead = false;
  let renderer: THREE.WebGLRenderer | null = null;
  let scene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let animGroup: THREE.Group | null = null;     // loop animation
  let meshGroup: THREE.Group | null = null;     // orbit + base rotation
  let innerGroup: THREE.Group | null = null;    // baseScale + flip
  let mesh: THREE.Mesh | null = null;
  let material: THREE.MeshPhysicalMaterial | null = null;
  let envMap: THREE.Texture | null = null;
  let pmrem: THREE.PMREMGenerator | null = null;
  let shadowMesh: THREE.Mesh | null = null;
  let canvasEl: HTMLCanvasElement | null = null;

  let w = 1, h = 1;
  let lastT = 0;

  // params (defaults = 3dsvg defaultProps -> the 1:1 look)
  let p = {
    source: '',
    depth: 1, smoothness: 0.2, color: '#ffffff',
    material: 'default' as MaterialPreset,
    metalness: 0.15, roughness: 0.35, opacity: 1, wireframe: false,
    rotationX: 0, rotationY: 0, zoom: 8, fov: 50,
    offsetX: 0, offsetY: 0,
    cursorOrbit: true, orbitStrength: 0.15,
    lightIntensity: 1.2, ambientIntensity: 0.3,
    shadowOpacity: 0.4,
    animate: 'none' as AnimType, animateSpeed: 1, intro: 'zoom' as 'zoom' | 'fade' | 'none',
  };

  // controls.tsx state
  const baseRotation = { x: 0, y: 0 };
  const targetRotation = { x: 0, y: 0 };
  let targetZoom = 8;
  const velocity = { x: 0, y: 0 };
  const cursorOffset = { x: 0, y: 0 };
  let isDragging = false;
  const lastPos = { x: 0, y: 0 };
  const damping = 0.08, friction = 0.92, orbitDamping = 0.04;

  // intro
  let introComplete = false;
  let introProgress = 0;
  const introFromZ = 18;

  // loop
  let elapsed = 0;
  let initialY: number | null = null;

  function applyMaterial() {
    if (!material) return;
    const ms = resolveMaterial(p.material, {
      metalness: p.metalness, roughness: p.roughness, opacity: p.opacity, wireframe: p.wireframe,
    });
    const preset = materialPresets[p.material];
    const isGold = p.material === 'gold';
    const isEmissive = p.material === 'emissive';
    const wantsTransparency = ms.transparent || ms.opacity < 1;
    const baseColor = isGold ? '#d4a017' : p.color;
    material.color.set(baseColor);
    material.metalness = ms.metalness;
    material.roughness = wantsTransparency ? Math.max(0.02, ms.roughness * 0.3) : ms.roughness;
    material.transmission = wantsTransparency ? (1 - ms.opacity) : 0;
    material.thickness = wantsTransparency ? 2.5 : 0;
    material.ior = wantsTransparency ? 1.5 : 1.45;
    material.wireframe = ms.wireframe;
    material.emissive.set(isEmissive ? p.color : '#000000');
    material.emissiveIntensity = preset.emissiveIntensity ?? 0;
    material.clearcoat = wantsTransparency ? 1 : (preset.clearcoat ?? 0);
    material.clearcoatRoughness = 0.05;
    material.envMapIntensity = 1;
    material.side = THREE.FrontSide;
    material.needsUpdate = true;
  }

  function rebuildMesh(svgString: string) {
    if (!scene || !innerGroup) return;
    if (mesh) {
      innerGroup.remove(mesh);
      mesh.geometry.dispose();
      mesh = null;
    }
    const built = buildGeometry(svgString, p.depth, p.smoothness);
    if (!built) return;
    if (!material) {
      material = new THREE.MeshPhysicalMaterial();
      applyMaterial();
    }
    mesh = new THREE.Mesh(built.geometry, material);
    mesh.position.set(-built.center.x, -built.center.y, -built.center.z);
    innerGroup.scale.set(built.baseScale, -built.baseScale, built.baseScale);
    innerGroup.add(mesh);
  }

  async function resolveSvg(src: string): Promise<string> {
    if (!src) return DEFAULT_SVG;
    const s = src.trim();
    if (s.startsWith('<svg') || s.startsWith('<?xml')) return s;
    try {
      const r = await fetch(src);
      const t = await r.text();
      return t.includes('<svg') ? t : DEFAULT_SVG;
    } catch {
      return DEFAULT_SVG;
    }
  }

  return {
    init(canvas: HTMLCanvasElement, opts: EffectOpts) {
      canvasEl = canvas;
      const pr = opts.params;
      p = {
        source: str(pr.source, '') || str(opts.assets.source, ''),
        depth: num(pr.depth, 1), smoothness: num(pr.smoothness, 0.2), color: str(pr.color, '#ffffff'),
        material: str(pr.material, 'default') as MaterialPreset,
        metalness: num(pr.metalness, 0.15), roughness: num(pr.roughness, 0.35),
        opacity: num(pr.opacity, 1), wireframe: bool(pr.wireframe, false),
        rotationX: num(pr.rotationX, 0), rotationY: num(pr.rotationY, 0),
        zoom: num(pr.zoom, 8), fov: num(pr.fov, 50),
        offsetX: num(pr.offsetX, 0), offsetY: num(pr.offsetY, 0),
        cursorOrbit: bool(pr.cursorOrbit, true), orbitStrength: num(pr.orbitStrength, 0.15),
        lightIntensity: num(pr.lightIntensity, 1.2), ambientIntensity: num(pr.ambientIntensity, 0.3),
        shadowOpacity: num(pr.shadowOpacity, 0.4),
        animate: str(pr.animate, 'none') as AnimType, animateSpeed: num(pr.animateSpeed, 1),
        intro: str(pr.intro, 'zoom') as 'zoom' | 'fade' | 'none',
      };

      let r: THREE.WebGLRenderer;
      try {
        r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'default' });
      } catch {
        dead = true;
        return;
      }
      renderer = r;
      r.setSize(w, h, false);
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.2;
      r.outputColorSpace = THREE.SRGBColorSpace;

      scene = new THREE.Scene();
      scene.environmentIntensity = 1.5;
      const env = buildEnvMap(r);
      envMap = env.tex; pmrem = env.pmrem;
      scene.environment = envMap;

      camera = new THREE.PerspectiveCamera(p.fov, w / h, 0.1, 1000);
      camera.position.set(0, 0, p.intro === 'none' ? p.zoom : introFromZ);
      targetZoom = p.zoom;
      introComplete = p.intro === 'none';
      if (p.intro !== 'none') canvas.style.opacity = '0';

      // light rig (verbatim)
      scene.add(new THREE.AmbientLight(0xffffff, p.ambientIntensity));
      const key = new THREE.DirectionalLight(0xffffff, p.lightIntensity);
      key.position.set(5, 8, 5);
      scene.add(key);
      const fillA = new THREE.DirectionalLight(0xffffff, 0.4); fillA.position.set(-5, 3, -3); scene.add(fillA);
      const fillB = new THREE.DirectionalLight(0xffffff, 0.2); fillB.position.set(0, -4, 6); scene.add(fillB);
      const pt = new THREE.PointLight(0xffffff, 0.3); pt.position.set(0, 5, 0); scene.add(pt);
      scene.add(new THREE.HemisphereLight(0xb1e1ff, 0xb97a20, 0.5));

      // groups: anim (loop) > mesh (orbit + base rotation) > inner (baseScale/flip)
      animGroup = new THREE.Group();
      meshGroup = new THREE.Group();
      innerGroup = new THREE.Group();
      meshGroup.rotation.set(p.rotationX, p.rotationY, 0);
      meshGroup.add(innerGroup);
      animGroup.add(meshGroup);
      scene.add(animGroup);
      baseRotation.x = p.rotationX; baseRotation.y = p.rotationY;
      targetRotation.x = p.rotationX; targetRotation.y = p.rotationY;

      // soft contact shadow (simplified stand-in for drei ContactShadows): a
      // radial-gradient plane under the object. Gradient is drawn at full
      // alpha; material.opacity carries the strength so shadowOpacity can
      // tune it live without redrawing the texture (default 0.4 = the
      // original hardcoded look).
      const sc = document.createElement('canvas');
      sc.width = sc.height = 128;
      const sctx = sc.getContext('2d');
      if (sctx) {
        const g = sctx.createRadialGradient(64, 64, 4, 64, 64, 60);
        g.addColorStop(0, 'rgba(0,0,0,1)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, 128, 128);
      }
      const shadowTex = new THREE.CanvasTexture(sc);
      shadowMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(10, 10),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: p.shadowOpacity }),
      );
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.y = -3;
      scene.add(shadowMesh);

      // build the mesh (async source resolve, then synchronous extrude)
      resolveSvg(p.source).then((svg) => {
        if (dead || !scene) return;
        rebuildMesh(svg);
      });
    },

    frame(t: number) {
      if (dead || !renderer || !scene || !camera || !meshGroup || !animGroup) return;
      const delta = lastT === 0 ? 0.016 : Math.min(0.05, (t - lastT) / 1000);
      lastT = t;

      // intro
      if (p.intro !== 'none' && introProgress < 1) {
        introProgress = Math.min(1, introProgress + delta / 2.5);
        const e = 1 - Math.pow(1 - introProgress, 4); // easeOutQuart
        if (p.intro === 'zoom') {
          camera.position.z = introFromZ + (p.zoom - introFromZ) * e;
          if (canvasEl) canvasEl.style.opacity = String(Math.min(1, e * 1.5));
        } else {
          camera.position.z = p.zoom;
          if (canvasEl) canvasEl.style.opacity = String(e);
        }
        if (introProgress >= 1) {
          introComplete = true;
          if (canvasEl) canvasEl.style.opacity = '1';
        }
      }

      // drag momentum
      if (!isDragging) {
        velocity.x *= friction; velocity.y *= friction;
        if (Math.abs(velocity.x) > 0.0001 || Math.abs(velocity.y) > 0.0001) {
          baseRotation.x += velocity.x; baseRotation.y += velocity.y;
        }
      }

      targetRotation.x = baseRotation.x + (p.cursorOrbit ? cursorOffset.x : 0);
      targetRotation.y = baseRotation.y + (p.cursorOrbit ? cursorOffset.y : 0);
      const cur = meshGroup.rotation;
      const d = p.cursorOrbit && !isDragging ? orbitDamping : damping;
      cur.x += (targetRotation.x - cur.x) * d;
      cur.y += (targetRotation.y - cur.y) * d;

      // responsive zoom (after intro)
      if (introComplete) {
        const aspect = w / (h || 1);
        const responsiveFactor = aspect < 1 ? 1 / aspect : 1;
        const effectiveZoom = targetZoom * responsiveFactor;
        camera.position.z += (effectiveZoom - camera.position.z) * damping;
      }

      // offset: pan the camera so the object sits off-centre (e.g. held in the
      // hero's right quadrant) while its canvas fills the full host. The camera
      // keeps looking down -z, so translating it laterally shifts the object on
      // screen. offsetX/Y are fractions of the visible viewport (right/up = +).
      {
        const dist = camera.position.z || p.zoom;
        const vH = 2 * Math.tan((camera.fov * Math.PI) / 360) * dist;
        const vW = vH * (w / (h || 1));
        camera.position.x = -p.offsetX * vW;
        camera.position.y = -p.offsetY * vH;
      }

      // loop animation on the anim group
      if (p.animate !== 'none') {
        elapsed += delta * p.animateSpeed;
        const tt = elapsed;
        if (initialY === null) initialY = animGroup.position.y;
        switch (p.animate) {
          case 'spin': animGroup.rotation.y += delta * 0.5 * p.animateSpeed; break;
          case 'float': animGroup.position.y = initialY + Math.sin(tt * 1.5) * 0.3; break;
          case 'pulse': {
            const pulse = 1 + Math.sin(tt * 2) * 0.05;
            animGroup.scale.set(pulse, pulse, pulse);
            break;
          }
          case 'wobble': animGroup.rotation.z = Math.sin(tt * 2) * 0.1; break;
          case 'swing': animGroup.rotation.y = Math.sin(tt * 1.5) * 0.26; break;
          case 'spinFloat':
            animGroup.rotation.y += delta * 0.4 * p.animateSpeed;
            animGroup.position.y = initialY + Math.sin(tt * 1.2) * 0.25;
            break;
        }
      }

      renderer.render(scene, camera);
    },

    resize(nw: number, nh: number) {
      w = nw; h = nh;
      if (dead || !renderer || !camera) return;
      renderer.setSize(nw, nh, false);
      camera.aspect = nw / (nh || 1);
      camera.updateProjectionMatrix();
    },

    setParam(key: string, value: unknown) {
      switch (key) {
        case 'source': resolveSvg(str(value, '')).then((svg) => { p.source = str(value, ''); rebuildMesh(svg); }); break;
        case 'depth': p.depth = num(value, 1); resolveSvg(p.source).then((svg) => rebuildMesh(svg)); break;
        case 'smoothness': p.smoothness = num(value, 0.2); resolveSvg(p.source).then((svg) => rebuildMesh(svg)); break;
        case 'color': p.color = str(value, '#ffffff'); applyMaterial(); break;
        case 'material': p.material = str(value, 'default') as MaterialPreset; applyMaterial(); break;
        case 'metalness': p.metalness = num(value, 0.15); applyMaterial(); break;
        case 'roughness': p.roughness = num(value, 0.35); applyMaterial(); break;
        case 'opacity': p.opacity = num(value, 1); applyMaterial(); break;
        case 'wireframe': p.wireframe = bool(value, false); applyMaterial(); break;
        case 'rotationX': p.rotationX = num(value, 0); baseRotation.x = p.rotationX; break;
        case 'rotationY': p.rotationY = num(value, 0); baseRotation.y = p.rotationY; break;
        case 'zoom': p.zoom = num(value, 8); targetZoom = p.zoom; break;
        case 'fov': p.fov = num(value, 50); if (camera) { camera.fov = p.fov; camera.updateProjectionMatrix(); } break;
        case 'offsetX': p.offsetX = num(value, 0); break;
        case 'offsetY': p.offsetY = num(value, 0); break;
        case 'cursorOrbit': p.cursorOrbit = bool(value, true); if (!p.cursorOrbit) { cursorOffset.x = 0; cursorOffset.y = 0; } break;
        case 'orbitStrength': p.orbitStrength = num(value, 0.15); break;
        case 'lightIntensity': p.lightIntensity = num(value, 1.2); break;
        case 'ambientIntensity': p.ambientIntensity = num(value, 0.3); break;
        case 'shadowOpacity': p.shadowOpacity = num(value, 0.4); if (shadowMesh) (shadowMesh.material as THREE.MeshBasicMaterial).opacity = p.shadowOpacity; break;
        case 'animate': p.animate = str(value, 'none') as AnimType; if (animGroup) { animGroup.rotation.set(0, 0, 0); animGroup.scale.set(1, 1, 1); animGroup.position.y = 0; initialY = null; } break;
        case 'animateSpeed': p.animateSpeed = num(value, 1); break;
        case 'intro': p.intro = str(value, 'zoom') as 'zoom' | 'fade' | 'none'; break;
      }
    },

    // cursor-orbit (hover) - canvas-relative coords normalized like the original
    onPointer(x: number, y: number, pressed?: boolean) {
      if (dead) return;
      if (isDragging && pressed) {
        const dx = x - lastPos.x;
        const dy = y - lastPos.y;
        lastPos.x = x; lastPos.y = y;
        const sensitivity = 0.01;
        baseRotation.x += dy * sensitivity;
        baseRotation.y += dx * sensitivity;
        velocity.x = dy * sensitivity; velocity.y = dx * sensitivity;
        return;
      }
      if (!p.cursorOrbit) return;
      const nx = (w > 0 ? x / w : 0.5) - 0.5;
      const ny = (h > 0 ? y / h : 0.5) - 0.5;
      cursorOffset.x = ny * 2 * p.orbitStrength;
      cursorOffset.y = nx * 2 * p.orbitStrength;
    },
    onPointerDown(x: number, y: number) {
      if (dead) return;
      isDragging = true;
      lastPos.x = x; lastPos.y = y;
      velocity.x = 0; velocity.y = 0;
    },
    onPointerUp() {
      isDragging = false;
    },
    onPointerLeave() {
      isDragging = false;
    },

    dispose() {
      dead = true;
      if (mesh) { mesh.geometry.dispose(); mesh = null; }
      material?.dispose(); material = null;
      (shadowMesh?.material as THREE.Material | undefined)?.dispose();
      shadowMesh?.geometry.dispose();
      shadowMesh = null;
      envMap?.dispose(); envMap = null;
      pmrem?.dispose(); pmrem = null;
      renderer?.dispose(); renderer = null;
      scene = null; camera = null; animGroup = null; meshGroup = null; innerGroup = null;
    },
  };
}
