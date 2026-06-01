// Asset URLs for glass-slideshow (slide textures image0..imageN).
// Real royalty-free sample photos (Lorem Picsum / Unsplash license) ship as the
// defaults for all four upload slots; a user-uploaded image* file param overrides
// the matching slot at runtime. Default imports resolve in Vite + esbuild (dataurl).
import image0 from './assets/image0.jpg';
import image1 from './assets/image1.jpg';
import image2 from './assets/image2.jpg';
import image3 from './assets/image3.jpg';

export const assets: Record<string, string> = { image0, image1, image2, image3 };
