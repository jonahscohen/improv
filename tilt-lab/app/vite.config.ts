import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Config lives in app/, so root defaults to this dir. Run via `npm run dev`
// (vite app --port 5180) from the tilt-lab/ package root.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180 },
  build: { outDir: '../dist/app', emptyOutDir: true },
});
