// Asset URLs for interactive-grid. Default import resolves in Vite + esbuild (dataurl).
// A real royalty-free photo (Lorem Picsum / Unsplash license) so the cursor-driven
// grid distortion is visibly correct, not an abstract procedural placeholder.
import image from './assets/image.jpg';

export const assets: Record<string, string> = { image };
