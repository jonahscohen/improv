import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config lives in app/, so root defaults to this dir. Run via `npm run dev`
// (vite app --port 5180) from the tilt-lab/ package root.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  build: {
    outDir: '../dist/app',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Split heavy vendors into their own chunks so the initial parse
        // is no longer a single ~1MB blob. Each effect family pulls in one
        // of these; isolating them lets the browser parse/cache them apart
        // from app code (and from each other).
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/]three[\\/]/.test(id)) return 'vendor-three';
          if (/[\\/]node_modules[\\/]ogl[\\/]/.test(id)) return 'vendor-ogl';
          if (/[\\/]node_modules[\\/]cobe[\\/]/.test(id)) return 'vendor-cobe';
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
        },
      },
    },
  },
});
