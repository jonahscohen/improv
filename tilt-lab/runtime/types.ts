/** The four layer roles that govern stacking. */
export type LayerRole = 'background' | 'midground' | 'pointer' | 'post';

/** Supported parameter control types in the playground. */
export type ParamType = 'range' | 'color' | 'toggle' | 'select' | 'file' | 'text' | 'marker-list';

/**
 * A geo marker on the cobe globe: a [lat, long] location and a dot size.
 * Mirrors cobe's `Marker` shape (the `color` field is optional there and left
 * to the effect's global markerColor here). Used by the 'marker-list' control.
 */
export interface Marker {
  location: [number, number]; // [latitude, longitude] in degrees
  size: number; // dot radius in cobe's normalized units (~0.01..0.2)
}

export interface ParamSpec {
  name: string;
  /** Optional human-facing control label; falls back to `name` when absent. */
  label?: string;
  type: ParamType;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // for type: 'select'
  placeholder?: string; // for type: 'text'
  maxLength?: number; // for type: 'text'
}

export type Redistribution = 'ok' | 'personal-only' | 'reimplemented';

export interface Manifest {
  id: string;
  name: string;
  category: string;
  layerRole: LayerRole;
  params: ParamSpec[];
  requiredAssets: string[];
  origin: string;
  license: string;
  attribution: string;
  redistribution: Redistribution;
  tags: string[];
}

/** Options passed to an effect at init: resolved param values + asset URLs. */
export interface EffectOpts {
  params: Record<string, unknown>;
  assets: Record<string, string>;
}

/**
 * The lifecycle contract every effect implements, regardless of origin tech.
 * The web-component wrapper drives these calls; effects never own their own
 * RAF loop or resize listener.
 */
export interface Effect {
  init(canvas: HTMLCanvasElement, opts: EffectOpts): void;
  frame(t: number): void;
  resize(w: number, h: number): void;
  setParam(key: string, value: unknown): void;
  dispose(): void;
  /**
   * Optional: pointer-driven effects receive the pointer position every frame
   * (canvas-relative coords) plus whether it is currently pressed (`pressed`
   * distinguishes a hover from a drag). Pointer Events unify mouse + touch + pen.
   */
  onPointer?(x: number, y: number, pressed?: boolean): void;
  /** Optional: a discrete press (mousedown / touchstart) at canvas-relative coords. */
  onPointerDown?(x: number, y: number): void;
  /** Optional: a discrete release (mouseup / touchend) at canvas-relative coords. */
  onPointerUp?(x: number, y: number): void;
  /** Optional: scroll/wheel over the stage; deltaY + the pointer position. */
  onWheel?(deltaY: number, x: number, y: number): void;
  /** Optional: pointer-driven effects are told when the pointer leaves the host. */
  onPointerLeave?(): void;
  /**
   * Optional: a `post` effect that renders via WebGL (where the compositor's
   * Canvas2D beneath-blit cannot reach) receives the composited scene beneath it
   * as a 2D canvas once per frame, just before frame(). The effect uploads it as
   * a texture (the WebGL analogue of the Canvas2D post path, where the compositor
   * draws the beneath-layers straight into the effect's own 2D canvas). The
   * canvas is owned by the compositor and reused across layers/frames - sample it
   * immediately (e.g. `texture.image = source; texture.needsUpdate = true`), do
   * not retain it.
   */
  onBeneath?(source: HTMLCanvasElement): void;
  /** Optional: DOM/R3F effects render into a host subtree instead of the canvas. */
  mount?(host: HTMLElement, opts: EffectOpts): void;
}

/** A factory that produces a fresh Effect instance. */
export type EffectFactory = () => Effect;

/** A single configured layer within a stack. */
export interface LayerConfig {
  effectId: string;
  layerRole: LayerRole;
  params: Record<string, unknown>;
  blendMode: string; // CSS/canvas globalCompositeOperation value
  /** Whether the layer contributes to the composite. Default: true. */
  enabled?: boolean;
  /** Per-layer opacity, 0..1. Default: 1. */
  opacity?: number;
}
