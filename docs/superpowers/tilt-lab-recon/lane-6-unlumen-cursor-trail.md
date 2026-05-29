# Lane 6 - unlumen cursor-image-trail

Collaborator: Jonah
Source: https://ui.unlumen.com/components/cursor-image-trail (WebFetch)
Effect characterized: cursor-image-trail (1 of 1)
License: not stated on page. Author credited as "Leo"; site note: "Most components on this site are inspired by or recreated from existing work."
Redistribution: **personal-only** (commercial component lib, no explicit license posted - treat as personal-use until a license is confirmed).

NOTE on verbatim fidelity: the original source contains one em dash inside a JSDoc comment (`Render target [em dash] defaults to the whole window`). This repo's commit hook forbids em dashes, so that single comment character has been transcribed as a hyphen below. No functional code is altered.

---

## 1. cursor-image-trail

### Source URL(s) + tech
- Page: `https://ui.unlumen.com/components/cursor-image-trail`
- Component path (shadcn-style copy-in): `@/components/unlumen-ui/cursor-image-trail`
- Tech: **React 18+ DOM component**, NOT canvas. Rendering is done with absolutely-positioned `<div>`s animated by **Framer Motion** (imported as `motion/react`). Trail items are arbitrary React nodes (image URLs, `<img>`, or inline `<svg>`) passed via the `items` prop. Uses `AnimatePresence` for enter/exit animation and a `cn()` class-merge util (`@/lib/utils`, the standard shadcn `clsx`+`tailwind-merge` helper).

This is important for tilt-lab: the contract assumes a `canvas: HTMLCanvasElement` and a GL/2D draw loop. This effect is **pure DOM + Framer Motion** and owns no animation loop of its own (Framer Motion drives the tweens internally off React state). Normalizing it onto `init(canvas, ...)/frame(t)` means either (a) keeping it as a DOM overlay layer that ignores the canvas and is driven by pointer events rather than `frame(t)`, or (b) reimplementing the trail in Canvas2D/WebGL so it fits the externally-driven contract. See normalization sketch.

### VERBATIM source - full component

```tsx
"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";

import { cn } from "@/lib/utils";

export interface CursorImageTrailProps {
  items: React.ReactNode[];
  /** Size of each trail item in px. @default 120 */
  itemSize?: number;
  /** Max simultaneous items in the trail. @default 8 */
  trailLength?: number;
  /** Minimum cursor travel (px) before spawning a new item. @default 80 */
  spawnDistance?: number;
  /** Max random rotation applied to each item in degrees. @default 20 */
  rotationRange?: number;
  /** Render target - defaults to the whole window. */
  containerRef?: React.RefObject<HTMLElement>;
  className?: string;
  children?: React.ReactNode;
}

interface TrailItem {
  id: number;
  x: number;
  y: number;
  rotation: number;
  itemIndex: number;
}

let _id = 0;
const nextId = () => ++_id;

export function CursorImageTrail({
  items,
  itemSize = 120,
  trailLength = 8,
  spawnDistance = 80,
  rotationRange = 20,
  containerRef,
  className,
  children,
}: CursorImageTrailProps) {
  const [trail, setTrail] = React.useState<TrailItem[]>([]);
  const lastPos = React.useRef<{ x: number; y: number } | null>(null);
  const itemCounter = React.useRef(0);
  const containerElRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const el = containerRef?.current ?? containerElRef.current ?? window;

    const onLeave = () => setTrail([]);

    const onMove = (e: Event) => {
      const mouseEvent = e as MouseEvent;
      const rect =
        containerRef?.current?.getBoundingClientRect() ??
        containerElRef.current?.getBoundingClientRect();

      const x = rect ? mouseEvent.clientX - rect.left : mouseEvent.clientX;
      const y = rect ? mouseEvent.clientY - rect.top : mouseEvent.clientY;

      if (lastPos.current) {
        const dx = x - lastPos.current.x;
        const dy = y - lastPos.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < spawnDistance) return;
      }

      lastPos.current = { x, y };

      const rotation = (Math.random() * 2 - 1) * rotationRange;
      const itemIndex = itemCounter.current % items.length;
      itemCounter.current += 1;

      setTrail((prev) => {
        const next = [...prev, { id: nextId(), x, y, rotation, itemIndex }];
        return next.slice(-trailLength);
      });
    };

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [items, spawnDistance, rotationRange, trailLength, containerRef]);

  const total = trail.length;

  return (
    <div
      ref={containerElRef}
      className={cn("relative overflow-hidden", className)}
    >
      {children}

      <AnimatePresence>
        {trail.map((item, i) => {
          const age = total - 1 - i;
          const scale = 0.6 + 0.4 * (1 - age / trailLength);

          return (
            <motion.div
              key={item.id}
              className="pointer-events-none absolute select-none"
              style={{
                left: item.x,
                top: item.y,
                width: itemSize,
                x: "-50%",
                y: "-50%",
                zIndex: i,
              }}
              initial={{
                opacity: 0,
                scale: 0.5,
                rotate: item.rotation * 1.5,
              }}
              animate={{
                opacity: 1,
                scale,
                rotate: item.rotation,
              }}
              exit={{
                opacity: 0,
                scale: 0.3,
                rotate: item.rotation * 0.5,
                filter: "blur(4px)",
              }}
              transition={{
                duration: 0.4,
                ease: [0.23, 1, 0.32, 1],
              }}
            >
              <div className="w-full [&>svg]:h-auto [&>svg]:w-full [&>img]:h-auto [&>img]:w-full">
                {items[item.itemIndex]}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

### VERBATIM source - usage example (from page; note prop drift)

```jsx
import { CursorImageTrail } from "@/components/unlumen-ui/cursor-image-trail";

const IMAGES = [
  "https://example.com/photo-1.jpg",
  "https://example.com/photo-2.jpg",
  "https://example.com/photo-3.jpg",
];

<CursorImageTrail images={IMAGES} className="h-[480px] w-full bg-neutral-950">
  <p className="text-white/30 select-none">Move your cursor</p>
</CursorImageTrail>
```

NOTE: the doc usage example shows an `images={IMAGES}` prop, but the actual implementation takes `items: React.ReactNode[]`. The real API expects React nodes (so you would map URLs to `<img src=... />` and pass that array). Treat `items` as canonical; `images` in the demo is stale doc.

### How it works (mechanics)
- **Pointer tracking**: a single `mousemove` listener on either `containerRef.current`, the component's own wrapper div, or `window` (fallback). Coordinates are made container-relative via `getBoundingClientRect()` when a container exists, else raw `clientX/clientY`.
- **Spawn gating by distance**: a new trail item is only created once the cursor has traveled at least `spawnDistance` px (default 80) from the last spawn point (`Math.sqrt(dx*dx+dy*dy)`). This decouples spawn rate from event frequency.
- **Item cycling**: `itemCounter % items.length` cycles through the provided node array in order, so the trail walks the image set round-robin.
- **Random rotation**: each item gets `(rand*2-1) * rotationRange` degrees.
- **Trail length cap**: `setTrail(prev => [...prev, new].slice(-trailLength))` keeps only the most recent `trailLength` items; older ones drop off the front and `AnimatePresence` animates their exit.
- **Per-item age scaling**: `age = total - 1 - i`; `scale = 0.6 + 0.4 * (1 - age/trailLength)` so newer items are larger, older ones shrink toward 0.6.
- **Enter/exit tweens (Framer Motion)**:
  - initial: `opacity 0, scale 0.5, rotate rotation*1.5`
  - animate: `opacity 1, scale (age-based), rotate rotation`
  - exit: `opacity 0, scale 0.3, rotate rotation*0.5, filter blur(4px)`
  - transition: `duration 0.4`, ease cubic-bezier `[0.23, 1, 0.32, 1]` (an expo-out style ease)
- **Leave reset**: `mouseleave` clears the whole trail (`setTrail([])`).
- `z-index` increments with array order so newer items stack on top.

### Proposed manifest
- **id**: `cursor-image-trail`
- **name**: Cursor Image Trail
- **category**: pointer / interactive overlay
- **layerRole**: `pointer` (cursor-driven overlay over content; `pointer-events: none` on each item so it never blocks the page beneath)
- **requiredAssets**: **yes** - an array of one or more images (or SVGs) supplied as `items`. The effect renders nothing until the cursor moves and at least one item exists. tilt-lab must wire `assets` (per the contract's `assets: Record<string,string>`) into the `items` array, e.g. map asset URLs to `<img src>` nodes.
- **origin**: unlumen UI (ui.unlumen.com), author "Leo"
- **license**: unstated on page; recreated-from-existing-work disclaimer
- **attribution**: unlumen / Leo
- **redistribution**: `personal-only`
- **tags**: `[cursor, pointer, trail, images, dom, framer-motion, motion, overlay]`
- **params**:

| name | type | default | min | max | notes |
|---|---|---|---|---|---|
| itemSize | range | 120 | (px) | | width of each trail item in px (height auto) |
| trailLength | range | 8 | 1 | ~20 | max simultaneous items |
| spawnDistance | range | 80 | ~10 | ~300 | min cursor travel (px) before a new item spawns |
| rotationRange | range | 20 | 0 | ~90 | max random rotation per item (degrees) |
| items | (asset set) | - | - | - | required image/svg node array (maps to `requiredAssets`) |

Fixed (not currently props, candidates to expose): exit `blur(4px)`, transition `duration 0.4`, ease `[0.23,1,0.32,1]`, age-scale curve `0.6 + 0.4*(...)`, initial scale `0.5`/exit scale `0.3`.

### Integration notes / gotchas
- **DOM + Framer Motion, not canvas.** This is the headline gotcha. The effect does not draw to a canvas and does not own a RAF loop - Framer Motion runs the per-item tweens. It cannot share a WebGL compositor with GL effects; it would live as a transparent DOM overlay above the canvas stack.
- **Dependency: `motion` (Framer Motion v11+, the `motion/react` entrypoint).** Plus the shadcn `cn` util (clsx + tailwind-merge) and Tailwind classes (`relative overflow-hidden`, `pointer-events-none absolute select-none`, the `[&>img]` arbitrary selectors). Tailwind is assumed in the host app.
- **`mousemove` only (no touch / no pointer events).** Touch devices get no trail. If tilt-lab wants touch, add `touchmove`/`pointermove`.
- **Spawn rate is distance-gated, not time-gated** - fast cursor flicks spawn many items, slow drags spawn few. There is no frame clock, so it is inherently not `frame(t)`-driven.
- **Images load lazily as `<img>`** - first appearance of each asset may flash until cached. Preload the asset set for a smooth first pass.
- **`containerRef` vs window**: passing a `containerRef` scopes the trail to that element and makes coordinates element-relative; otherwise it listens on `window` with viewport coords but still positions items inside its own wrapper (a mismatch if the wrapper is not full-viewport - prefer passing a containerRef or making the wrapper fill the stack).
- **`mouseleave` wipes the trail instantly** rather than letting items age out - a design choice; may want to soften for tilt-lab.

### Normalization sketch (`init / frame / resize / setParam / dispose`)
Two viable strategies:

**A. Keep as DOM overlay (lowest-fidelity-loss, recommended for first pass).**
- `init(canvas, {params, assets})`: ignore `canvas`; create a transparent positioned `<div>` overlay sibling to the canvas (or mount the React component into one). Build `items` from `assets` (`Object.values(assets).map(url => imgNode(url))`). Attach the `mousemove`/`mouseleave` listeners exactly as the component does.
- `frame(t)`: **no-op** (or used only to prune exited items). The trail is event-driven; there is nothing to advance per frame. Document this clearly - it is the one effect whose motion is not clock-driven. If a clock is mandatory, replace Framer Motion tweens with manual time-based opacity/scale interpolation advanced in `frame(t)` (this is essentially strategy B without the canvas).
- `resize(w,h)`: resize the overlay div; recompute `getBoundingClientRect` basis.
- `setParam(key,value)`: update `itemSize / trailLength / spawnDistance / rotationRange`; `items`/asset changes rebuild the node array.
- `dispose()`: remove listeners, unmount/remove the overlay div.

**B. Reimplement in Canvas2D to fit the contract honestly.**
- Maintain a JS array of trail particles `{x, y, rotation, itemIndex, bornAt}`. Spawn on `mousemove` with the same distance gate. In `frame(t)`, for each particle compute `ageMs = t - bornAt`, derive opacity/scale/rotation/blur from the same curves (`scale = 0.6 + 0.4*(1-age/trailLength)`, exit blur via shadow/alpha), and `drawImage` the corresponding preloaded `HTMLImageElement` with `ctx.translate/rotate/globalAlpha`. Drop particles older than the tween duration or beyond `trailLength`.
- This makes the effect truly `frame(t)`-driven, GL/2D-compositable, and removes the Framer Motion dependency, at the cost of re-deriving the easing in code. `requiredAssets` become preloaded `Image` objects.

For faithful verbatim reproduction, strategy A preserves the exact look (Framer Motion easing, blur-on-exit) but breaks the `frame(t)` contract; strategy B honors the contract but is a reimplementation. Recommend A for capture fidelity and flag the contract mismatch to acquisition.
