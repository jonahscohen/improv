import { describe, it, expect } from 'vitest';
import { effectPresets, expandPresetParams } from './effect-presets';
import { ANIMATED_GRADIENT_PRESET_PARAMS } from './effects/animated-gradient/presets';
import { AURORA_PRESETS } from './effects/aurora/presets';
import { MESH_SCENE_PALETTES } from './effects/mesh-gradient/presets';

describe('expandPresetParams', () => {
  it('passes through unchanged for effects with no preset registry', () => {
    const out = expandPresetParams('gradient', { speed: 1, hue: 200 }, 'speed', 3);
    expect(out).toEqual({ speed: 3, hue: 200 });
  });

  it('animated-gradient: selecting a preset writes its full value-set', () => {
    // Start from the manifest defaults (preset "custom").
    const start = { preset: 'custom', color1: '#050505', color2: '#66B3FF', scale: 1, swirl: 80 };
    const out = expandPresetParams('animated-gradient', start, 'preset', 'Lava');
    const lava = ANIMATED_GRADIENT_PRESET_PARAMS.Lava;
    expect(out.preset).toBe('Lava');
    expect(out.color1).toBe(lava.color1); // '#FF9F21'
    expect(out.color2).toBe(lava.color2);
    expect(out.scale).toBe(lava.scale);
    expect(out.swirl).toBe(lava.swirl);
    // The value actually changed from the default (this is the bug that regressed).
    expect(out.color1).not.toBe(start.color1);
  });

  it('aurora: selecting a preset retints all four bands + both sky stops', () => {
    const start = { preset: 'Custom', layer1Color: '#22d3ee', skyColor1: '#020617' };
    const out = expandPresetParams('aurora', start, 'preset', 'Sunset');
    const sunset = AURORA_PRESETS.Sunset;
    expect(out.preset).toBe('Sunset');
    expect(out.layer1Color).toBe(sunset.layer1Color);
    expect(out.layer4Color).toBe(sunset.layer4Color);
    expect(out.skyColor1).toBe(sunset.skyColor1);
    expect(out.skyColor2).toBe(sunset.skyColor2);
  });

  it('mesh-gradient: selecting a scene writes color1..color5 from its palette', () => {
    const start = { scene: 'Custom', color1: '#8ecae6', color5: '#fb8500' };
    const out = expandPresetParams('mesh-gradient', start, 'scene', 'Molten');
    const molten = MESH_SCENE_PALETTES[4];
    expect(out.scene).toBe('Molten');
    expect(out.color1).toBe(molten[0]);
    expect(out.color2).toBe(molten[1]);
    expect(out.color3).toBe(molten[2]);
    expect(out.color4).toBe(molten[3]);
    expect(out.color5).toBe(molten[4]);
  });

  it('selecting "custom" / unknown leaves other params alone', () => {
    const start = { preset: 'Lava', color1: '#FF9F21', swirl: 18 };
    const out = expandPresetParams('animated-gradient', start, 'preset', 'custom');
    expect(out.preset).toBe('custom');
    expect(out.color1).toBe('#FF9F21'); // untouched
    expect(out.swirl).toBe(18);
  });

  it('editing a preset-controlled param flips the selector back to custom', () => {
    const onLava = expandPresetParams('animated-gradient', { preset: 'Lava', color1: '#FF9F21' }, 'preset', 'Lava');
    expect(onLava.preset).toBe('Lava');
    const edited = expandPresetParams('animated-gradient', onLava, 'color1', '#123456');
    expect(edited.color1).toBe('#123456');
    expect(edited.preset).toBe('custom'); // no longer claims to be "Lava"
  });

  it('editing a non-controlled param does NOT flip the selector', () => {
    // animated-gradient presets do not set noiseOpacity, so editing it keeps the preset label.
    const onLava = expandPresetParams('animated-gradient', { preset: 'Lava' }, 'preset', 'Lava');
    const edited = expandPresetParams('animated-gradient', onLava, 'noiseOpacity', 0.5);
    expect(edited.preset).toBe('Lava');
    expect(edited.noiseOpacity).toBe(0.5);
  });

  it('aurora uses "Custom" and mesh-gradient uses "scene"/"Custom" as their sentinels', () => {
    expect(effectPresets.aurora.custom).toBe('Custom');
    expect(effectPresets['mesh-gradient'].param).toBe('scene');
    expect(effectPresets['mesh-gradient'].custom).toBe('Custom');
    const edited = expandPresetParams('aurora', { preset: 'Sunset' }, 'layer1Color', '#000000');
    expect(edited.preset).toBe('Custom');
  });

  // ---------------------------------------------------------------------------
  // The 9 effects registered by the preset-registry pass. For each: selecting a
  // named preset must expand to that preset's real value-set (asserted against
  // specific source values), and editing a preset-controlled param must flip the
  // selector to that effect's custom sentinel.
  // ---------------------------------------------------------------------------

  it('fluid: scene selects the 4-color set; editing a color flips to Custom', () => {
    expect(effectPresets.fluid.param).toBe('scene');
    expect(effectPresets.fluid.custom).toBe('Custom');
    const out = expandPresetParams('fluid', { scene: 'Custom' }, 'scene', 'Inferno');
    expect(out.scene).toBe('Inferno');
    expect(out.colorLow).toBe('#401000');
    expect(out.colorHigh).toBe('#FF7722');
    expect(out.colorGlow).toBe('#FFEE99');
    expect(out.bgColor).toBe('#050000');
    const edited = expandPresetParams('fluid', out, 'colorLow', '#123456');
    expect(edited.colorLow).toBe('#123456');
    expect(edited.scene).toBe('Custom');
  });

  it('fractal-glass: scene selects all 4 base + 3 env colors; editing flips to Custom', () => {
    const out = expandPresetParams('fractal-glass', { scene: 'Custom' }, 'scene', 'Emerald Depth');
    expect(out.scene).toBe('Emerald Depth');
    expect(out.baseColor1).toBe('#011a0a');
    expect(out.baseColor4).toBe('#A8C8B8');
    expect(out.envColor1).toBe('#021f0e');
    expect(out.envColor3).toBe('#2ecc71');
    const edited = expandPresetParams('fractal-glass', out, 'baseColor1', '#000000');
    expect(edited.scene).toBe('Custom');
  });

  it('fractal-glass-post: shares the fractal-glass scene set (base + env)', () => {
    const out = expandPresetParams('fractal-glass-post', { scene: 'Custom' }, 'scene', 'Regent');
    expect(out.scene).toBe('Regent');
    expect(out.baseColor1).toBe('#010102');
    expect(out.baseColor3).toBe('#0c90d0');
    expect(out.envColor1).toBe('#010204');
    expect(out.envColor3).toBe('#00a0e8');
    const edited = expandPresetParams('fractal-glass-post', out, 'envColor1', '#111111');
    expect(edited.scene).toBe('Custom');
  });

  it('halftone: scene seeds the 4 base colors ONLY (no env), editing flips to Custom', () => {
    const out = expandPresetParams('halftone', { scene: 'Custom' }, 'scene', 'Violet Abyss');
    expect(out.scene).toBe('Violet Abyss');
    expect(out.baseColor1).toBe('#0a0318');
    expect(out.baseColor2).toBe('#2d1054');
    expect(out.baseColor4).toBe('#B8A8C8');
    // Halftone exposes no env-color controls and its handler seeds only base, so
    // the expansion must not introduce env keys.
    expect('envColor1' in out).toBe(false);
    const edited = expandPresetParams('halftone', out, 'baseColor2', '#abcdef');
    expect(edited.scene).toBe('Custom');
  });

  it('halftone-post: shares the halftone base-only scene set', () => {
    const out = expandPresetParams('halftone-post', { scene: 'Custom' }, 'scene', 'Crimson Forge');
    expect(out.scene).toBe('Crimson Forge');
    expect(out.baseColor1).toBe('#1a0505');
    expect(out.baseColor3).toBe('#b82020');
    expect('envColor1' in out).toBe(false);
    const edited = expandPresetParams('halftone-post', out, 'baseColor3', '#222222');
    expect(edited.scene).toBe('Custom');
  });

  it('globe: preset selects the full color + lighting set; editing flips to Custom', () => {
    expect(effectPresets.globe.param).toBe('preset');
    const out = expandPresetParams('globe', { preset: 'Custom' }, 'preset', 'Ocean');
    expect(out.preset).toBe('Ocean');
    expect(out.baseColor).toBe('#0a2540');
    expect(out.markerColor).toBe('#38bdf8');
    expect(out.glowColor).toBe('#7dd3fc');
    expect(out.diffuse).toBe(1.6);
    expect(out.mapBrightness).toBe(5);
    expect(out.dark).toBe(1);
    expect(out.theta).toBe(0.3);
    expect(out.opacity).toBe(1);
    const edited = expandPresetParams('globe', out, 'baseColor', '#ffffff');
    expect(edited.preset).toBe('Custom');
  });

  it('grain-gradient: preset expands variable-length colors + count + shaping', () => {
    // Dots is a 4-color preset.
    const dots = expandPresetParams('grain-gradient', { preset: 'Custom' }, 'preset', 'Dots');
    expect(dots.preset).toBe('Dots');
    expect(dots.color1).toBe('#6f0000');
    expect(dots.color4).toBe('#33cc33');
    expect(dots.colorsCount).toBe(4);
    expect(dots.shape).toBe('dots');
    expect(dots.softness).toBe(1);
    expect(dots.noise).toBe(0.7);
    expect(dots.scale).toBe(0.6);
    // Wave is a 3-color preset -> colorsCount 3, only color1..color3 set.
    const wave = expandPresetParams('grain-gradient', { preset: 'Custom' }, 'preset', 'Wave');
    expect(wave.colorsCount).toBe(3);
    expect(wave.color3).toBe('#d8ccc7');
    expect('color4' in wave).toBe(false);
    const edited = expandPresetParams('grain-gradient', dots, 'color1', '#000000');
    expect(edited.preset).toBe('Custom');
  });

  it('neuro-noise: preset selects color + brightness/contrast/scale; editing flips to Custom', () => {
    const out = expandPresetParams('neuro-noise', { preset: 'Custom' }, 'preset', 'Sensation');
    expect(out.preset).toBe('Sensation');
    expect(out.colorFront).toBe('#00c8ff');
    expect(out.colorMid).toBe('#fbff00');
    expect(out.colorBack).toBe('#8b42ff');
    expect(out.brightness).toBe(0.19);
    expect(out.contrast).toBe(0.12);
    expect(out.scale).toBe(3);
    const edited = expandPresetParams('neuro-noise', out, 'colorMid', '#000000');
    expect(edited.preset).toBe('Custom');
  });

  it('swarm: scene selects 3 colors + 3 alphas; editing flips to Custom', () => {
    const out = expandPresetParams('swarm', { scene: 'Custom' }, 'scene', 'Ember');
    expect(out.scene).toBe('Ember');
    expect(out.idleColor).toBe('#cc6644');
    expect(out.swarmColor).toBe('#ff4422');
    expect(out.bgColor).toBe('#0a0404');
    expect(out.idleAlpha).toBe(0.08);
    expect(out.swarmAlpha).toBe(0.55);
    expect(out.glowAlpha).toBe(0.18);
    const edited = expandPresetParams('swarm', out, 'swarmColor', '#ffffff');
    expect(edited.scene).toBe('Custom');
  });
});
