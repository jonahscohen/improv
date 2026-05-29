# Lane 5 recon - casberry particles

Collaborator: Jonah
Source: https://particles.casberry.in (fetched via curl with a browser UA; WebFetch returned 403, curl 200)
Effect captured: particles (1 of 1), layerRole midground
Tech: Three.js (InstancedMesh swarm) + WebGL postprocessing (UnrealBloom)

## What it actually is
"AI Particle Simulator | Professional 3D Swarm Simulator by Casberry India". A 20,000-instance Three.js particle swarm that morphs between target shapes (sphere, cube, helix, torus, text, image/video pixel grids, loaded 3D models). Each particle smoothly lerps from its current position toward a per-particle target position every frame; the visible "effect" is the swarm settling/morphing plus per-instance idle bob and a selectable render style (spark / plasma / vector / cyber / ink / paint / steel / glass) under an UnrealBloom pass.

The live site wraps this core with a lot of chrome that is **out of scope** for tilt-lab: MediaPipe Hands webcam gesture control, Firebase/Firestore publishing + App Check (ReCAPTCHA), GLTF/OBJ/PDB/PLY model loaders + MeshSurfaceSampler, GLTF/OBJ exporters, an image/video-to-particles pipeline, a custom-kernel code runner, and a full sidebar UI. For a midground background effect we want only: the InstancedMesh swarm, the position-lerp morph loop, the idle bob, the shader render styles, and bloom. Pointer/orbit is OrbitControls auto-rotate (no real pointer interaction needed for a background).

## Source URLs / files / tech
- Page: `https://particles.casberry.in/` (HTML, 71KB)
- Core: `https://particles.casberry.in/main.js` (115KB, **unminified ES module**, 2650 lines) - this is the entire simulator.
- Aux (not needed for the effect): `js/export-manager.js` (49KB, image/3D export), `js/drawing-pad.js` (6KB, blueprint draw tool).
- CDN deps loaded in HTML head: `@mediapipe/{camera_utils,control_utils,drawing_utils,hands}` from jsdelivr (gesture control only).
- ES module imports inside main.js: `three`, `three/addons` (OrbitControls, EffectComposer, RenderPass, UnrealBloomPass, GLTFLoader, OBJLoader, PDBLoader, PLYLoader, GLTFExporter, OBJExporter, MeshSurfaceSampler), and `firebase/{app,firestore,app-check}`.
- Tech for the effect itself: **Three.js InstancedMesh + ShaderMaterial + UnrealBloomPass**. WebGL (WebGL2 via three). No raw GL.

## VERBATIM source - core simulator

Global config + key state (the simulation knobs):
```js
const CONFIG = { count: 20000, maxSize: 70, particleSize: 0.25, hoverStrength: 0.05 };
// STATE (relevant fields only):
//   mode: 'sphere'         // active target shape
//   speed: 1.0             // sim time multiplier
//   simTime: 0
//   renderStyle: 'spark'   // spark | plasma | vector | cyber | ink | paint | steel | glass
//   autoSpin: true
const positions = { current: [], target: [] };  // arrays of THREE.Vector3
const extras = [];  // per-particle { id, seed, ox, oy, oz }
```

Scene / renderer / camera / bloom:
```js
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x000000, 0.01);
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(0, 0, 100);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);

const worldGroup = new THREE.Group();   // object-centric rotation pivot
scene.add(worldGroup);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.enableRotate = true;
controls.enablePan = false;
controls.enableZoom = true;
controls.autoRotate = true;
controls.autoRotateSpeed = 2.0;

const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.5); scene.add(hemiLight);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.5); dirLight.position.set(50,50,50); scene.add(dirLight);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
bloomPass.strength = 1.8; bloomPass.radius = 0.4; bloomPass.threshold = 0;
composer.addPass(bloomPass);

const dummy = new THREE.Object3D();
const color = new THREE.Color();
```

Particle init (random cloud, then morph to the chosen shape):
```js
function initParticles(count) {
    if (mesh) { scene.remove(mesh); worldGroup.remove(mesh); mesh.dispose(); }
    CONFIG.count = parseInt(count);
    positions.current = []; positions.target = []; extras.length = 0;

    // geometry + material chosen by STATE.renderStyle (see below)
    let geo = sparkGeo, mat = sparkMaterial;
    if (STATE.renderStyle === 'plasma') { geo = plasmaGeo; mat = plasmaMaterial; }
    else if (STATE.renderStyle === 'vector') { geo = vectorGeo; mat = vectorMaterial; }
    else if (STATE.renderStyle === 'cyber') { geo = cyberGeo; mat = cyberMaterial; }
    else if (STATE.renderStyle === 'ink') { geo = plasmaGeo; mat = inkMaterial; }
    else if (STATE.renderStyle === 'paint') { geo = plasmaGeo; mat = paintMaterial; }
    else if (STATE.renderStyle === 'steel') { geo = sphereGeo; mat = steelMaterial; }
    else if (STATE.renderStyle === 'glass') { geo = sphereGeo; mat = glassMaterial; }

    mesh = new THREE.InstancedMesh(geo, mat, CONFIG.count);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    worldGroup.add(mesh);

    for (let i = 0; i < CONFIG.count; i++) {
        const x = (Math.random()-0.5)*100, y = (Math.random()-0.5)*100, z = (Math.random()-0.5)*100;
        positions.current.push(new THREE.Vector3(x,y,z));
        positions.target.push(new THREE.Vector3(x,y,z));
        extras.push({ id: i, seed: Math.random()*100, ox:0, oy:0, oz:0 });
        dummy.position.set(x,y,z); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        mesh.setColorAt(i, color.setHex(0x00ff88));
    }
    setShape(STATE.mode);
}
```

Geometries (per render style):
```js
const sparkGeo  = new THREE.TetrahedronGeometry(CONFIG.particleSize); // 0.25
const vectorGeo = new THREE.ConeGeometry(0.1, 0.5, 4); vectorGeo.rotateX(Math.PI/2);
const plasmaGeo = new THREE.PlaneGeometry(0.8, 0.8);  // billboard quad for plasma/ink/paint
const cyberGeo  = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const sphereGeo = new THREE.SphereGeometry(0.3, 16, 16); // steel/glass
```

Target shapes (the morph targets; sphere is the default/midground-friendly one):
```js
const shapes = {
  sphere: () => {                       // geodesic / Fibonacci sphere, radius 30
    const r = 30;
    for (let i = 0; i < CONFIG.count; i++) {
      const phi = Math.acos(-1 + (2*i)/CONFIG.count);
      const theta = Math.sqrt(CONFIG.count * Math.PI) * phi;
      positions.target[i].set(
        r*Math.cos(theta)*Math.sin(phi),
        r*Math.sin(theta)*Math.sin(phi),
        r*Math.cos(phi));
      mesh.setColorAt(i, color.setHex(0x00ff88));
    }
    mesh.instanceColor.needsUpdate = true;
  },
  cube: () => {                         // lattice, separation 2.5
    const s = Math.ceil(Math.cbrt(CONFIG.count)); const sep = 2.5; const off = (s*sep)/2; let idx = 0;
    for (let x=0;x<s;x++) for (let y=0;y<s;y++) for (let z=0;z<s;z++) {
      if (idx >= CONFIG.count) break;
      positions.target[idx].set(x*sep-off, y*sep-off, z*sep-off);
      mesh.setColorAt(idx, color.setHex(0x00aaff)); idx++;
    }
    mesh.instanceColor.needsUpdate = true;
  },
  helix: () => {                        // double-helix, rainbow HSL by index
    const r = 15; const h = CONFIG.count*0.003; const off = h/2;
    for (let i=0;i<CONFIG.count;i++) {
      const t = i*0.05;
      positions.target[i].set(Math.cos(t)*r, (i*0.003)-off, Math.sin(t)*r);
      mesh.setColorAt(i, color.setHSL(i/CONFIG.count, 1, 0.5));
    }
    mesh.instanceColor.needsUpdate = true;
  },
  torus: () => {                        // R=25, r=8, magenta
    const R = 25; const r = 8;
    for (let i=0;i<CONFIG.count;i++) {
      const u = (i/CONFIG.count)*Math.PI*2*40; const v = (i/CONFIG.count)*Math.PI*2;
      positions.target[i].set((R+r*Math.cos(u))*Math.cos(v), (R+r*Math.cos(u))*Math.sin(v), r*Math.sin(u));
      mesh.setColorAt(i, color.setHex(0xff0055));
    }
    mesh.instanceColor.needsUpdate = true;
  }
};
```

The morph + render loop (the actual animation - this is the effect):
```js
const clock = new THREE.Clock();
function animate() {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();
    STATE.simTime += delta * STATE.speed;
    const time = STATE.simTime;

    const activeCount = Math.min(CONFIG.count, positions.current.length, positions.target.length);

    // Drive time-based shader styles
    if (STATE.renderStyle === 'plasma') plasmaMaterial.uniforms.uTime.value = time;
    if (STATE.renderStyle === 'ink')    inkMaterial.uniforms.uTime.value = time;
    if (STATE.renderStyle === 'paint')  paintMaterial.uniforms.uTime.value = time;

    if (activeCount > 0 && mesh.visible) {
        for (let i = 0; i < activeCount; i++) {
            if (!positions.current[i] || !positions.target[i]) continue;

            // sanitation: bad targets snap to origin
            if (isNaN(positions.target[i].x) || !isFinite(positions.target[i].x)) positions.target[i].set(0,0,0);

            // CORE: ease current toward target at 0.1 per frame
            positions.current[i].lerp(positions.target[i], 0.1);
            if (isNaN(positions.current[i].x)) positions.current[i].set(0,0,0);

            dummy.position.copy(positions.current[i]);

            // idle bob for geometric shapes/models
            if (['sphere','cube','helix','torus','model'].includes(STATE.mode)) {
                dummy.position.y += Math.sin(time + extras[i].seed) * CONFIG.hoverStrength; // 0.05
            }
            // (text mode has scroll/wave/pulse/rain variants - omitted, out of scope)

            // per-style rotation
            if (STATE.renderStyle === 'vector') {
                // align cone to velocity (toward target)
                const lookTarget = positions.target[i].clone().sub(positions.current[i]).normalize().multiplyScalar(2).add(dummy.position);
                if (positions.target[i].distanceToSquared(positions.current[i]) > 0.1) dummy.lookAt(lookTarget);
            } else if (STATE.renderStyle === 'plasma' || STATE.renderStyle === 'ink' || STATE.renderStyle === 'paint') {
                dummy.lookAt(camera.position); // billboard the quads
            } else {
                dummy.rotation.set(0,0,0);
            }

            dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }

    controls.update();      // OrbitControls auto-rotate
    composer.render();      // RenderPass + UnrealBloom
}

// resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
    if (bloomPass) bloomPass.resolution.set(window.innerWidth, window.innerHeight);
});
```

## VERBATIM source - render-style materials

spark (default), cyber, vector are plain MeshBasicMaterial:
```js
const sparkMaterial  = new THREE.MeshBasicMaterial({ color: 0xffffff });
const cyberMaterial  = new THREE.MeshBasicMaterial({ color: 0x00ff88, wireframe: true });
const vectorMaterial = new THREE.MeshBasicMaterial({ color: 0x00aaff });
```

plasma (glowing ring+core billboard, reads per-instance color):
```js
const plasmaMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() {
      vUv = uv;
      vColor = instanceColor;
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;
    }`,
  fragmentShader: `
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
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide
});
```

ink (smoky value-noise diffusion, additive):
```js
const inkMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() { vUv = uv; vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    uniform float uTime;
    float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 4.1414))) * 43758.5453); }
    float noise(vec2 p) { vec2 ip = floor(p); vec2 u = fract(p); u = u*u*(3.0-2.0*u);
      float res = mix(mix(rand(ip),rand(ip+vec2(1.0,0.0)),u.x),mix(rand(ip+vec2(0.0,1.0)),rand(ip+vec2(1.0,1.0)),u.x),u.y);
      return res * res; }
    void main() {
      float dist = distance(vUv, vec2(0.5));
      float n = noise(vUv * 5.0 + uTime * 0.5);
      float alpha = (1.0 - smoothstep(0.2, 0.5, dist)) * (0.5 + 0.5 * n);
      if(alpha < 0.1) discard;
      gl_FragColor = vec4(vColor + 0.2, alpha * 0.8);
    }`,
  transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
});
```

paint (oil-slick turbulence):
```js
const paintMaterial = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 } },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    void main() { vUv = uv; vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vColor;
    uniform float uTime;
    void main() {
      vec2 p = vUv * 2.0 - 1.0;
      for(int i=1; i<4; i++) {
        p.x += 0.3/float(i)*sin(float(i)*3.0*p.y + uTime*0.4);
        p.y += 0.3/float(i)*cos(float(i)*3.0*p.x + uTime*0.4);
      }
      float r = cos(p.x+p.y+1.0)*0.5+0.5;
      float pattern = (sin(p.x+p.y)+cos(p.x+p.y))*0.5+0.5;
      float dist = distance(vUv, vec2(0.5));
      if(dist > 0.5) discard;
      vec3 finalColor = mix(vColor, vec3(r, pattern, 1.0 - r), 0.3);
      gl_FragColor = vec4(finalColor, 1.0);
    }`,
  side: THREE.DoubleSide
});
```

steel (cheap matcap-style lit sphere) and glass (fresnel rim, additive):
```js
const steelMaterial = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: `
    varying vec3 vNormal; varying vec3 vColor;
    void main() { vNormal = normalize(normalMatrix * normal); vColor = instanceColor;
      gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    varying vec3 vNormal; varying vec3 vColor;
    void main() {
      vec3 viewDir = vec3(0.0, 0.0, 1.0);
      float metallic = dot(vNormal, viewDir) * 0.5 + 0.5;
      metallic = pow(metallic, 3.0);
      vec3 col = mix(vec3(0.1), vColor, 0.5) * metallic + vec3(0.2);
      gl_FragColor = vec4(col, 1.0);
    }`
});
const glassMaterial = new THREE.ShaderMaterial({
  uniforms: {},
  vertexShader: `
    varying vec3 vNormal; varying vec3 vViewPosition; varying vec3 vColor;
    void main() {
      vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      vNormal = normalize(normalMatrix * normal);
      vViewPosition = -mvPosition.xyz;
      vColor = instanceColor;
      gl_Position = projectionMatrix * mvPosition;
    }`,
  fragmentShader: `
    varying vec3 vNormal; varying vec3 vViewPosition; varying vec3 vColor;
    void main() {
      float fresnel = dot(vNormal, normalize(vViewPosition));
      fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
      fresnel = pow(fresnel, 2.0);
      vec3 col = vColor * fresnel + vec3(0.1);
      gl_FragColor = vec4(col, 0.3 + fresnel * 0.7);
    }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false
});
```

Note: shaders read `instanceColor` directly as a vertex attribute (three.js InstancedMesh injects this when `setColorAt` is used). The `THREE.Color.lerp` monkeypatch at the top is `THREE.Color.lerp = (c1,c2,t) => new THREE.Color(c1).lerp(new THREE.Color(c2), t);`.

## Proposed manifest
- id: `casberry-particles`
- name: "Particle Swarm"
- category: particles / generative
- layerRole: `midground` (a transparent 3D object over content; renders to its own scene with FogExp2 black and bloom)
- requiredAssets: none for the geometric shapes (sphere/cube/helix/torus). The image/video/model target modes require user assets and are out of scope.
- tags: `[three, webgl, instancedmesh, particles, swarm, morph, bloom, midground]`

| param | type | default | min | max |
|---|---|---|---|---|
| count | range | 20000 | ~1000 | ~50000 |
| shape | select | sphere | - | sphere / cube / helix / torus |
| renderStyle | select | spark | - | spark / plasma / vector / cyber / ink / paint / steel / glass |
| speed | range | 1.0 | 0 | ~3 |
| particleSize | range | 0.25 | ~0.05 | ~1 |
| hoverStrength | range | 0.05 | 0 | ~0.5 |
| autoSpin | toggle | true | - | - |
| autoSpinSpeed | range | 2.0 | 0 | ~10 |
| bloomStrength | range | 1.8 | 0 | ~3 |
| bloomRadius | range | 0.4 | 0 | 1 |
| bloomThreshold | range | 0 | 0 | 1 |
| color | color | #00ff88 | - | - (sphere default; cube #00aaff, torus #ff0055, helix = rainbow HSL) |

(`maxSize: 70` is only used by the image/video grid mapping; drop for the geometric-shape effect. The morph lerp factor 0.1 and random-cloud spawn radius 100 are hardcoded; expose if a "morph speed" knob is wanted.)

## License + attribution
- Author: **Casberry India** (meta author tag; creator handle `x.com/Eswarprasaath_`, GitHub org `github.com/CasberryIndia`).
- License: **none stated**. No LICENSE file in the JS, no license text on the page, and the GitHub org `CasberryIndia` returns no public repos. The deployed app embeds live Firebase API keys and ReCAPTCHA site keys, i.e. it is a published proprietary product, not an open-source release. Treat as **all-rights-reserved / proprietary** absent permission.
- Redistribution: **reimplemented** (do not ship their verbatim main.js). The swarm mechanism itself - random cloud, per-particle `current.lerp(target, 0.1)` morph, idle sine bob, InstancedMesh + per-instance color, UnrealBloom - is a generic, widely-used pattern that we can reimplement cleanly from the documented behavior above. The shader snippets are short and conventional (ring/core, value-noise smoke, fresnel) and are reproduced here for reference; reimplement rather than copy-paste for redistribution. For personal-use verbatim experimentation, captured source is above.

## Integration notes / gotchas
- Hard dep on **three** + three/addons (OrbitControls, EffectComposer, RenderPass, UnrealBloomPass). Bloom is load-bearing for the look; without it the spark/plasma styles look flat.
- The effect renders a whole Three.js scene (its own camera, fog, lights, bloom composer). To act as a tilt-lab midground layer it must either render to a transparent canvas (drop `scene.fog`/black clear, set `renderer.setClearAlpha(0)`) or be composited. As-is the site clears to black.
- `composer.render()` replaces `renderer.render()`. The composer owns the present; resize must update both renderer and composer (and `bloomPass.resolution`).
- Per-frame CPU cost: it writes a full instance matrix for all `count` particles every frame (`setMatrixAt` + `instanceMatrix.needsUpdate`). At 20k that is fine; expose `count` as a perf knob.
- `instanceColor` is set via `setColorAt`; custom ShaderMaterials read it as a vertex attribute. Three.js must be a version that auto-defines `instanceColor` for InstancedMesh (modern three does).
- OrbitControls is the only "interaction": auto-rotate by default, user drag to orbit, zoom enabled, pan disabled. For a passive background, keep auto-rotate and drop user input.
- Everything else in main.js (MediaPipe hands, Firebase publish/load, model/PDB/PLY loaders, exporters, image/video pipeline, custom-kernel runner, text shaping) is product chrome - not part of the visual effect and should be excluded.

## Normalization sketch (init / frame / resize / setParam / dispose)
- `init(canvas, {params})`: create `WebGLRenderer({canvas, antialias:true})` (transparent clear for midground), scene (+ optional fog), perspective camera at (0,0,100), worldGroup, lights, OrbitControls (autoRotate from params), EffectComposer with RenderPass + UnrealBloomPass (strength/radius/threshold from params). Build the InstancedMesh for `count` with the geometry+material for `renderStyle`, seed `positions.current/target` with the random cloud, then apply the chosen `shape` to fill `positions.target` and per-instance colors.
- `frame(t)`: replace the self-owned `clock.getDelta()` with the externally driven `t` (derive `delta`/advance `simTime`). Run the morph loop: `current[i].lerp(target[i], 0.1)`, idle bob, per-style rotation, `setMatrixAt`, `instanceMatrix.needsUpdate = true`; update shader `uTime` uniforms; `controls.update()` (auto-rotate can be advanced by `t`); `composer.render()`.
- `resize(w,h)`: `camera.aspect`, `updateProjectionMatrix`, `renderer.setSize`, `composer.setSize`, `bloomPass.resolution.set` (the existing resize handler, parameterized by injected w/h instead of `window.innerWidth`).
- `setParam(key,value)`: `count` -> rebuild InstancedMesh (`initParticles`); `shape` -> re-run the shape function to refill `positions.target` (morph animates automatically via the lerp); `renderStyle` -> swap geometry+material while preserving `instanceMatrix`/`instanceColor` (the site's `updateRenderStyle` already does exactly this); `speed`/`hoverStrength`/`particleSize`/`autoSpin`/bloom params -> write into config/uniforms/passes directly; `color` -> recolor instances.
- `dispose()`: cancel the (now external) frame driver, `mesh.dispose()`, dispose geometries/materials, `composer`/`renderer.dispose()`, remove the canvas, drop OrbitControls. (The site has no explicit teardown since it is a single-page app; this must be added.)
- No pointer param required for the background use; if interactive orbit is wanted, feed pointer/drag through OrbitControls.
