# Lane 9 recon - ascii-magic

Collaborator: Jonah
Source: https://ascii-magic.com (landing) and https://ascii-magic.com/app (the editor). Fetched via curl with a browser UA (WebFetch path was not needed; curl 200).
Effect captured: ascii (1 of 1), layerRole **post** (transforms an input image/video into ASCII / block / dot / mosaic art).
Tech: **pure Canvas2D** + JS. No WebGL, no framework, no shaders. The entire app is a single ~252KB **unminified inline `<script>`** in `/app` (6032 lines, readable with comments). External CDN deps are only for export: `gif.js@0.2.0` and `mp4-muxer@5.1.3` (GIF/MP4 recording, irrelevant to the live effect).

## What it is and how it samples (matters for our post pipeline)
ASCII Magic loads an **image or a video** into a hidden source element, draws that frame to an **offscreen canvas**, calls `getImageData`, and walks a character grid sampling one pixel per cell to choose a glyph (or tile/dot) by luminance. The output is drawn to a visible `<canvas id="output-canvas">` with `ctx.fillText` (characters) or `fillRect`/`arc` (block/dot/mosaic modes).

Crucially for tilt-lab's post layer: **the conversion only needs a source whose pixels can be read via `getImageData`.** It is agnostic to whether that source is an `<img>`, a `<video>`, or any canvas. To wire it as our `post` layer, replace its `state.source` (image/video) with the composited canvas beneath - draw that canvas into the offscreen sampler each frame and run the same grid loop. The video path already proves the per-frame case: it downsamples the video to ~1px per character cell and re-runs the loop every frame. Our composited canvas slots into exactly that path.

`state.mode` is `'image' | 'video'`. For our pipeline it becomes effectively "live canvas" (re-sampled each `frame(t)`).

## Source / tech summary
- Page: `https://ascii-magic.com/app` (HTML 346KB). The app logic is inline script index 6 (252,660 bytes). Other inline scripts are JSON-LD + PostHog analytics.
- No bundle/module files; everything is inline. Sampling + render is Canvas2D.
- Render modes (from the landing page's base64 deep-links, decoded `{"v":1,"renderMode":"..."}`): `characters` (default), `lines`, `lego`, `mosaic`, `mixed`, `pixel`, `3d`, `cross`, `block-chars`, `dots`, `diamond`, `diagonal`, `disco`, plus `braille` and `shapes` found in source, and an `animated` flag.

## VERBATIM source - the conversion algorithm

State defaults (the param surface):
```js
const state = {
  mode: null,          // 'image' or 'video'
  source: null,        // Image or Video element
  sourceW: 0, sourceH: 0,
  imageData: null,
  edgeData: null,
  fontSize: 11,
  charSet: '@#S08Xx+=-;:,.',
  coverage: 85,
  edgeEmphasis: 60,
  darkThreshold: 30,
  bgMode: 'blur', bgBlur: 8, bgOpacity: 90,
  charOpacity: 100,
  brightness: 0, contrast: 100,
  invert: false,
  dotGrid: false,
  randomChars: false,
  mosaicShape: 'square',
  // 3D shape knobs
  shape3dCellSize: 12, shape3dHSpacing: 100, shape3dVSpacing: 100,
  shape3dTopShade: 135, shape3dLightShade: 100, shape3dDarkShade: 55,
  shape3dOutline: 0, shape3dFlip: false,
  // disco knobs
  discoUniformity: 80, discoSeed: 1,
  lights: [], lightsEnabled: false, activeLight: -1,
  playing: false, recording: false,
  blendMode: 'source-over',
  overlayColor: '#ff0000', overlayOpacity: 0, overlayBlend: 'multiply',
  renderMode: 'characters',
  // shapes mode, animation state, mask state, transforms, postEffects ... (see below)
};
```

Character ramps:
```js
const charPresets = {
  standard: '@#S08Xx+=-;:,.',
  detailed: '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/\\|()1{}[]?-_+~<>i!lI;:,"^`\'. ',
  minimal:  '@#*+=-:. ',
  blocks:   '█▓▒░ '   // █▓▒░ space
};

// Per-style character pools (bright -> dark, last char is space):
const STYLE_POOLS = {
  'block-chars': '█▓▒░ ',
  'lines':       '┃|│╏┆ ',
  'diagonal':    '╲╱/⁄ ',
  'cross':       '╋┼+× ',
  'diamond':     '⬥◆◇⋄ '
};
```

Frame processing - draw source to offscreen, read pixels, downsample video to grid resolution:
```js
function processFrame() {
  if (!state.source) return;
  const w = state.sourceW, h = state.sourceH;
  const fontSize = state.fontSize;
  const charW = fontSize * 0.6;   // monospace cell aspect
  const charH = fontSize;
  const needW = Math.ceil(w / charW);
  const needH = Math.ceil(h / charH);
  const useDownsample = state.mode === 'video' && (w > needW * 1.2 || h > needH * 1.2);
  const drawW = useDownsample ? needW : w;
  const drawH = useDownsample ? needH : h;

  offscreen.width = drawW; offscreen.height = drawH;
  const effectiveSource = /* image, or transformed (crop/rotate) frame */ (state.transformedSource || state.source);
  offCtx.drawImage(effectiveSource, 0, 0, drawW, drawH);
  state.imageData = offCtx.getImageData(0, 0, drawW, drawH);  // <-- the sample buffer
  state._imgW = drawW; state._imgH = drawH;
  state._bgFrameSource = effectiveSource;  // full-res for background draw

  if (state.edgeEmphasis > 0) computeEdgeMap(drawW, drawH);
  else state.edgeData = null;
}
```

Sobel edge map (drives edge emphasis + the `lines` glyph direction):
```js
function computeEdgeMap(w, h) {
  const src = state.imageData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = i * 4;
    gray[i] = 0.299 * src[idx] + 0.587 * src[idx+1] + 0.114 * src[idx+2];  // luminance
  }
  const edges = new Float32Array(w * h);
  const dirs  = new Uint8Array(w * h);   // 0=─ 1=/ 2=│ 3=\
  let maxEdge = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const gx = -gray[(y-1)*w+(x-1)] + gray[(y-1)*w+(x+1)]
                 -2*gray[y*w+(x-1)]   + 2*gray[y*w+(x+1)]
                 -gray[(y+1)*w+(x-1)] + gray[(y+1)*w+(x+1)];
      const gy = -gray[(y-1)*w+(x-1)] - 2*gray[(y-1)*w+x] - gray[(y-1)*w+(x+1)]
                 +gray[(y+1)*w+(x-1)] + 2*gray[(y+1)*w+x] + gray[(y+1)*w+(x+1)];
      const mag = Math.sqrt(gx*gx + gy*gy);
      edges[idx] = mag;
      if (mag > maxEdge) maxEdge = mag;
      const ang = Math.atan2(gy, gx) + Math.PI / 2;
      let a = ang % Math.PI; if (a < 0) a += Math.PI;
      dirs[idx] = Math.floor(((a + Math.PI/8) % Math.PI) / (Math.PI/4)) % 4;
    }
  }
  // edges normalized by maxEdge afterward (stored in state.edgeData)
}
```

The render grid + sizing:
```js
function render(animTimestamp, exportScale) {
  if (!state.source || !state.imageData) return;
  const scale = exportScale || 1;
  const fontSize = state.fontSize * scale;
  const charW = fontSize * 0.6;
  const charH = fontSize;
  const w = state.sourceW * scale, h = state.sourceH * scale;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  const cols = Math.floor(w / charW);
  const rows = Math.floor(h / charH);

  // 1. Background: 'solid' (#000), 'none' (clear), or 'blur' (draw blurred source at bgOpacity)
  // 2. ASCII pass (below)
  ctx.font = `${fontSize}px "Courier New", Courier, monospace`;
  ctx.textBaseline = 'top';
  ...
}
```

Luminance auto-normalization prepass (samples a coarse grid for min/max, then stretches contrast):
```js
let minLum = 255, maxLum = 0;
const lumStep = Math.max(1, Math.floor(Math.min(rows, cols) / 40));
for (let sRow = 0; sRow < rows; sRow += lumStep) {
  for (let sCol = 0; sCol < cols; sCol += lumStep) {
    const sx = Math.floor((sCol + 0.5) * charW * pxScaleX);
    const sy = Math.floor((sRow + 0.5) * charH * pxScaleY);
    if (sx >= imgW || sy >= imgH) continue;
    const pi = (sy * imgW + sx) * 4;
    const l = 0.299*pixels[pi] + 0.587*pixels[pi+1] + 0.114*pixels[pi+2];
    if (l < minLum) minLum = l;
    if (l > maxLum) maxLum = l;
  }
}
const lumRange = maxLum - minLum || 1;
```

Per-cell sample -> luminance -> char selection (the core of the effect):
```js
// pxScaleX/Y map canvas grid coords -> imageData pixel coords
const pxScaleX = imgW / (state.sourceW * scale);
const pxScaleY = imgH / (state.sourceH * scale);
const edgeWeight = state.edgeEmphasis / 100;
const brightnessAdj = state.brightness / 100;
const contrastFactor = (259 * (state.contrast + 255)) / (255 * (259 - state.contrast));
const alpha = state.charOpacity / 100;

for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const sx = Math.min(imgW-1, Math.floor((col + 0.5) * charW * pxScaleX));
    const sy = Math.min(imgH-1, Math.floor((row + 0.5) * charH * pxScaleY));
    const pixIdx = (sy * imgW + sx) * 4;
    const rawR = pixels[pixIdx], rawG = pixels[pixIdx+1], rawB = pixels[pixIdx+2];
    const rawLum = 0.299*rawR + 0.587*rawG + 0.114*rawB;

    // normalized luminance (0..1), with optional point-light boost; invert flips it
    let normLum = Math.max(0, Math.min(1, (rawLum - minLum) / lumRange /* + lightBoost */));
    if (state.invert) normLum = 1 - normLum;

    // rendered fill color = raw RGB with brightness + contrast applied (NOT used for char pick)
    let r = Math.max(0, Math.min(255, contrastFactor*(rawR-128) + 128 + brightnessAdj*255));
    let g = Math.max(0, Math.min(255, contrastFactor*(rawG-128) + 128 + brightnessAdj*255));
    let b = Math.max(0, Math.min(255, contrastFactor*(rawB-128) + 128 + brightnessAdj*255));

    const edgeVal = edgeMap ? edgeMap.data[sy*edgeMap.width + sx] : 0;
    const amplifiedEdge = Math.pow(edgeVal, 0.3);
    const edgeBoost = amplifiedEdge * edgeWeight * 4.0;

    // CHAR SCORE: brightness plus a small edge contribution
    let charScore = normLum + edgeBoost * 0.15;
    charScore = Math.max(0, Math.min(1, charScore));

    // pick glyph from the active pool (pools are bright->dark, so use 1-charScore)
    let charIdx, char;
    if (state.randomChars) {
      charIdx = Math.floor(Math.random() * activeRandPool.length);
      char = activeRandPool[charIdx];
    } else {
      charIdx = Math.min(activePool.length - 1, Math.floor((1 - charScore) * activePool.length));
      char = activePool[charIdx];
    }
    if (char === ' ') continue;   // empty cells = no draw (this is the coverage/threshold)

    // colored fill, then draw
    ctx.fillStyle = `rgba(${r|0},${g|0},${b|0},${finalAlpha})`;
    ctx.fillText(char, col*charW, row*charH);   // (drawCharFx wraps this with optional glow/chroma)
  }
}
```

Mixed mode picks a glyph family per cell by a stable spatial hash, then maps brightness within that family:
```js
const mixedPools = [STYLE_POOLS['block-chars'], STYLE_POOLS['lines'],
                    STYLE_POOLS['diagonal'], STYLE_POOLS['cross'], STYLE_POOLS['diamond']];
const hsh = ((col * 73856093) ^ (row * 19349663)) >>> 0;
const activePool = mixedPools[hsh % mixedPools.length];
```

Non-character modes share the same grid + luminance sampling but draw shapes instead of glyphs (each is a branch in the same loop, except 3D and shapes which own dedicated passes):
- `dots`: filled circles sized by luminance.
- `pixel`: quantized color blocks with faint grid lines.
- `lego`: colored tile + raised circular stud (highlight/shadow).
- `mosaic`: average color over the cell, rounded tiles (`mosaicShape`).
- `braille`: Unicode braille (U+2800..U+28FF) from a 2x4 dot threshold per cell.
- `3d`: hex-tessellated isometric cubes (own pass; `shape3d*` knobs for cell size, face shading, outline).
- `disco`: mirror-tile / lens-flare variant (feature-flagged; `disco*` knobs + lights repurposed as glares).
- `shapes`: own grid pass `drawShapesPass()` with primitives + posterize + jitter.

Color is **derived from the source pixel** (the `r,g,b` fill above), so the effect is naturally full-color; "monochrome" is achieved by source or via overlay/blend (`overlayColor`/`overlayOpacity`/`overlayBlend`, `blendMode`). There is also a stack of optional `postEffects` (vignette, scanLines, crtCurve, chromatic, bloom, charBloom, filmGrain, glitch, rgbSplit, blur, pixelate, halftone, filmDust) applied after the grid pass.

## Proposed manifest
- id: `ascii`
- name: "ASCII"
- category: post-process
- layerRole: `post` (max 1 per stack; transforms everything beneath it)
- requiredAssets: none for our use (the input is the composited canvas beneath; the standalone app requires a user image/video)
- tags: `[canvas2d, ascii, post-process, halftone, luminance, sobel, text, dither]`

| param | type | default | min | max |
|---|---|---|---|---|
| renderMode | select | characters | - | characters / block-chars / lines / diagonal / cross / diamond / mixed / dots / pixel / lego / mosaic / braille / 3d |
| charSet | select or text | `@#S08Xx+=-;:,.` | - | presets: standard / detailed / minimal / blocks, or custom string |
| fontSize | range | 11 | ~4 | ~40 (drives cell size; charW = fontSize*0.6, charH = fontSize) |
| coverage | range | 85 | 0 | 100 (how much fills vs stays empty) |
| edgeEmphasis | range | 60 | 0 | 100 (Sobel edge contribution) |
| darkThreshold | range | 30 | 0 | 100 |
| brightness | range | 0 | -100 | 100 |
| contrast | range | 100 | ~0 | ~255 |
| invert | toggle | false | - | - |
| randomChars | toggle | false | - | - |
| charOpacity | range | 100 | 0 | 100 |
| bgMode | select | blur | - | solid / none / blur |
| bgBlur | range | 8 | 0 | ~30 |
| bgOpacity | range | 90 | 0 | 100 |
| overlayColor | color | #ff0000 | - | - |
| overlayOpacity | range | 0 | 0 | 100 |
| overlayBlend | select | multiply | - | (canvas globalCompositeOperation values) |

(Mode-specific extras: `mosaicShape`, the `shape3d*` set for 3D, `disco*` for disco, plus the `postEffects` stack and `lights` - all optional, surface as advanced.)

## License + attribution
- Site: ascii-magic.com, "ASCII Magic - Free ASCII Art Generator" (browser-based, client-side, no signup, no upload).
- License: **proprietary / all-rights-reserved.** The page footer carries "All rights" (reserved) and Privacy/Terms links; there is no open-source license, no public repo linked, and the code ships only as an inline page script (with PostHog + Vercel analytics). A sibling project `dotforge.vercel.app` is linked but is not this code.
- Redistribution: **reimplemented.** Do not ship their verbatim inline script. The algorithm is a standard luminance-ramp ASCII converter (Rec.601 luma, min/max auto-normalize, Sobel edge boost, `charIdx = floor((1-score) * pool.length)`), reproduced above for reference; reimplement cleanly. The character ramps themselves are conventional and not copyrightable as expression, but treat the bundled code as proprietary.

## Integration notes / gotchas
- **No dependencies** for the core effect (pure Canvas2D). The only external libs are export-only (`gif.js`, `mp4-muxer`) and analytics (PostHog) - all droppable.
- Input must be `getImageData`-readable. For our post layer, feed the composited canvas beneath into the offscreen sampler each frame (this maps onto the existing video path, which already re-samples per frame and downsamples to ~1px/cell).
- Cross-origin: `getImageData` taints on cross-origin sources. For a same-origin composited canvas this is a non-issue; just never sample a tainted canvas.
- Two-buffer design: `offscreen` (downsampled, for per-cell sampling) vs `_bgFrameSource` (native res, for the blurred background). Keep both if you want the blurred-source background; for a pure post overlay you can use `bgMode:'none'`.
- Cell aspect is hardcoded to a monospace `0.6` width ratio and `"Courier New"` font; the glyph metrics assume that. Changing fonts shifts coverage.
- Char pools are ordered bright->dark with a trailing space; the trailing space is the "skip this cell" signal (drives coverage). Preserve ordering or selection inverts.
- Color comes from the sampled pixel; for a monochrome ASCII post effect, drive `overlayColor`/`overlayBlend` or force a single fill.
- Performance: it samples one pixel per cell and writes per-cell `fillText`/`fillRect`. At small `fontSize` (many cells) this is the cost driver; the app downsamples video sources to grid resolution to keep it cheap. Our post layer should sample at grid resolution, not full canvas res.

## Normalization sketch (init / frame / resize / setParam / dispose)
- `init(canvas, {params, assets})`: take the passed canvas as the output; create the internal `offscreen` sampler canvas. Seed `state` from params (renderMode, charSet, fontSize, coverage, edgeEmphasis, brightness, contrast, invert, bg/overlay). The "source" is set to the composited-canvas-beneath handle (provided by the runtime) rather than an `<img>`/`<video>`.
- `frame(t)`: run `processFrame()` against the current composited canvas (draw it into `offscreen`, `getImageData`, compute edge map if `edgeEmphasis>0`), then `render(t)` to walk the grid and draw glyphs/tiles. Animated shimmer uses `t` directly (it already accepts `animTimestamp`). No internal RAF - the app's own loop is driven externally; just call processFrame+render per `frame`.
- `resize(w,h)`: set `state.sourceW/H` to w/h, let `render()` resize the output canvas (`canvas.width=w*scale`) and recompute `cols/rows`. The offscreen sampler is re-sized inside `processFrame`.
- `setParam(key,value)`: write into `state` (every knob above is a plain `state` field). `renderMode`/`charSet`/`fontSize` changes take effect on the next `frame` automatically (grid + pools are read each render). No re-init needed except none.
- `dispose()`: drop references to the offscreen canvas and source; remove the (app-level) file/drag listeners if any were attached. The standalone app has no teardown (single-page); add one. No GL context to lose.
- The app owns its own input/UI/export/mask/transform machinery - all out of scope. The reusable core is: `processFrame` (sample) + `computeEdgeMap` (Sobel) + the `render` grid loop (luminance -> char/tile). That trio is the entire effect.
