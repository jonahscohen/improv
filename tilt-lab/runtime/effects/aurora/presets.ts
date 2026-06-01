// Aurora preset "presentation styles". Each retints the four aurora bands + the
// two sky stops; numerics (speed / noise / movement / blend / bloom) keep their
// live values. Verbatim palette values from the unlumen AuroraBlur recon.
//
// Single source of truth: imported by the effect (init/applyPreset for the
// standalone JSON path) AND by runtime/effect-presets.ts (so the playground store
// expands a `preset` selection into its full color value-set, keyed by param name).

export const AURORA_PRESETS: Record<string, Record<string, string>> = {
  'Blue Night': {
    layer1Color: '#22d3ee', layer2Color: '#3b82f6', layer3Color: '#60a5fa', layer4Color: '#1d4ed8',
    skyColor1: '#020617', skyColor2: '#0f172a',
  },
  'Borealis Green': {
    layer1Color: '#34d399', layer2Color: '#10b981', layer3Color: '#6ee7b7', layer4Color: '#059669',
    skyColor1: '#00120c', skyColor2: '#001b12',
  },
  Sunset: {
    layer1Color: '#fb7185', layer2Color: '#f59e0b', layer3Color: '#fbbf24', layer4Color: '#ef4444',
    skyColor1: '#1a0a1f', skyColor2: '#2a0e2e',
  },
  'Magenta Dream': {
    layer1Color: '#e879f9', layer2Color: '#a855f7', layer3Color: '#f0abfc', layer4Color: '#7e22ce',
    skyColor1: '#0d021a', skyColor2: '#1a0633',
  },
  Toxic: {
    layer1Color: '#a3e635', layer2Color: '#84cc16', layer3Color: '#bef264', layer4Color: '#4d7c0f',
    skyColor1: '#0a1500', skyColor2: '#0f1f00',
  },
  Mono: {
    layer1Color: '#e5e7eb', layer2Color: '#9ca3af', layer3Color: '#d1d5db', layer4Color: '#6b7280',
    skyColor1: '#000000', skyColor2: '#111111',
  },
  Crimson: {
    layer1Color: '#f87171', layer2Color: '#dc2626', layer3Color: '#fca5a5', layer4Color: '#991b1b',
    skyColor1: '#150202', skyColor2: '#220505',
  },
};
