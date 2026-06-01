import { validateStack } from '../../../runtime/stack';
import { expandPresetParams } from '../../../runtime/effect-presets';
import type { LayerConfig, Manifest } from '../../../runtime/types';

export interface AddResult {
  ok: boolean;
  reason?: string;
}

export interface StackStore {
  layers(): LayerConfig[];
  add(manifest: Manifest): AddResult;
  remove(index: number): void;
  reorder(from: number, to: number): void;
  setParam(index: number, key: string, value: unknown): void;
  setEnabled(index: number, enabled: boolean): void;
  setOpacity(index: number, opacity: number): void;
  subscribe(fn: () => void): () => void;
}

function defaultParams(manifest: Manifest): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const p of manifest.params) out[p.name] = p.default;
  return out;
}

export function createStackStore(): StackStore {
  let layers: LayerConfig[] = [];
  const subs = new Set<() => void>();
  const notify = () => subs.forEach((fn) => fn());

  return {
    layers: () => layers,
    add(manifest) {
      const candidate: LayerConfig = {
        effectId: manifest.id,
        layerRole: manifest.layerRole,
        params: defaultParams(manifest),
        blendMode: 'source-over',
        enabled: true,
        opacity: 1,
      };
      const validity = validateStack([...layers, candidate]);
      if (!validity.valid) return { ok: false, reason: validity.reason };
      layers = [...layers, candidate];
      notify();
      return { ok: true };
    },
    remove(index) {
      layers = layers.filter((_, i) => i !== index);
      notify();
    },
    reorder(from, to) {
      const next = [...layers];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      layers = next;
      notify();
    },
    setParam(index, key, value) {
      // Expand preset selectors into their full value-set so changing a preset
      // actually changes the look (and every control reflects it). For effects
      // without presets this is just `{ ...params, [key]: value }`.
      layers = layers.map((l, i) =>
        i === index
          ? { ...l, params: expandPresetParams(l.effectId, l.params, key, value) }
          : l,
      );
      notify();
    },
    setEnabled(index, enabled) {
      layers = layers.map((l, i) => (i === index ? { ...l, enabled } : l));
      notify();
    },
    setOpacity(index, opacity) {
      const clamped = opacity < 0 ? 0 : opacity > 1 ? 1 : opacity;
      layers = layers.map((l, i) => (i === index ? { ...l, opacity: clamped } : l));
      notify();
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
