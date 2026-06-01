// Central asset registry: effect-id -> { assetKey: resolvedUrl }.
//
// Each effect that declares `requiredAssets` ships an `assets.ts` exporting an
// `assets` map built from `new URL('./assets/<file>', import.meta.url).href`,
// which resolves natively in Vite (the playground) and is inlined by esbuild's
// dataurl loader in the bundle. This module aggregates them so the compositor
// and the <tilt-*> element wrapper can deliver real assets at init time instead
// of the hardcoded `{}` that forced effects into their procedural fallbacks.
//
// Effects WITHOUT assets simply have no entry here (effects read
// `opts.assets[key]` and fall back when a key is absent).
//
// Kept as its own module (not in index.ts) so the dependency graph stays
// acyclic: index.ts re-exports `effectAssets` for the public API, while
// compositor.ts / element.ts import it from here without a back-edge to the
// effect registry. The construction still happens by importing each effect's
// assets module, exactly as the convention prescribes.
import { assets as ditheredImage } from './effects/dithered-image/assets';
import { assets as fake3dImage } from './effects/fake-3d-image/assets';
import { assets as glassSlideshow } from './effects/glass-slideshow/assets';
import { assets as grainGradient } from './effects/grain-gradient/assets';
import { assets as infiniteGallery } from './effects/infinite-gallery/assets';
import { assets as interactiveGrid } from './effects/interactive-grid/assets';
import { assets as mcGlobe } from './effects/mc-globe/assets';
import { assets as media } from './effects/media/assets';
import { assets as waterRipple } from './effects/water-ripple/assets';

export const effectAssets: Record<string, Record<string, string>> = {
  'dithered-image': ditheredImage,
  'fake-3d-image': fake3dImage,
  'glass-slideshow': glassSlideshow,
  'grain-gradient': grainGradient,
  'infinite-gallery': infiniteGallery,
  'interactive-grid': interactiveGrid,
  'mc-globe': mcGlobe,
  media,
  'water-ripple': waterRipple,
};
