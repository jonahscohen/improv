import type { LayerConfig } from '../../../runtime/types';

/**
 * Server-free stack export. Pure, framework-agnostic helpers that turn the
 * current layer stack into a portable config JSON and hand it to the browser
 * (download or clipboard). No React, no network - the preview IS the export.
 */

export const STACK_CONFIG_FORMAT = 'tilt-lab/stack';
export const STACK_CONFIG_VERSION = 1;
export const STACK_CONFIG_FILENAME = 'tilt-lab-stack.json';

/** The serialized shape of a single layer in an exported stack config. */
export interface ExportedLayer {
  effectId: string;
  layerRole: string;
  params: Record<string, unknown>;
  blendMode: string;
  enabled: boolean;
  opacity: number;
}

/** A complete exported stack: versioned envelope around the ordered layers. */
export interface StackConfig {
  format: typeof STACK_CONFIG_FORMAT;
  version: typeof STACK_CONFIG_VERSION;
  layers: ExportedLayer[];
}

/**
 * Normalize one runtime layer into its exported form. `enabled` and `opacity`
 * are part of the runtime LayerConfig (added alongside per-layer composition);
 * read them defensively so export stays correct whether or not a given layer
 * object carries them yet, defaulting to fully-on / fully-opaque.
 */
function toExportedLayer(layer: LayerConfig): ExportedLayer {
  const l = layer as LayerConfig & { enabled?: boolean; opacity?: number };
  return {
    effectId: l.effectId,
    layerRole: l.layerRole,
    params: { ...l.params },
    blendMode: l.blendMode,
    enabled: l.enabled ?? true,
    opacity: l.opacity ?? 1,
  };
}

/** Build the in-memory config object for a stack (the source of truth for both surfaces). */
export function buildStackConfig(layers: LayerConfig[]): StackConfig {
  return {
    format: STACK_CONFIG_FORMAT,
    version: STACK_CONFIG_VERSION,
    layers: layers.map(toExportedLayer),
  };
}

/** Serialize a stack to pretty-printed config JSON. */
export function serializeStackConfig(layers: LayerConfig[]): string {
  return JSON.stringify(buildStackConfig(layers), null, 2);
}

/**
 * Trigger a browser download of the stack config JSON via a Blob object URL
 * and a transient anchor. The object URL is revoked after the click so we do
 * not leak it.
 */
export function downloadStackConfig(
  layers: LayerConfig[],
  filename: string = STACK_CONFIG_FILENAME,
): void {
  const json = serializeStackConfig(layers);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick so the download has a chance to start in browsers
  // that read the URL asynchronously.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Copy the stack config JSON to the clipboard. Resolves when the write completes. */
export function copyStackConfig(layers: LayerConfig[]): Promise<void> {
  return navigator.clipboard.writeText(serializeStackConfig(layers));
}
