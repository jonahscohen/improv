/** The four layer roles that govern stacking. */
export type LayerRole = 'background' | 'midground' | 'pointer' | 'post';

/** Supported parameter control types in the playground. */
export type ParamType = 'range' | 'color' | 'toggle' | 'select';

export interface ParamSpec {
  name: string;
  type: ParamType;
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[]; // for type: 'select'
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
}

/** A factory that produces a fresh Effect instance. */
export type EffectFactory = () => Effect;

/** A single configured layer within a stack. */
export interface LayerConfig {
  effectId: string;
  layerRole: LayerRole;
  params: Record<string, unknown>;
  blendMode: string; // CSS/canvas globalCompositeOperation value
}
