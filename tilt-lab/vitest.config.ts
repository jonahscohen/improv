import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['runtime/**/*.test.ts', 'app/**/*.test.{ts,tsx}'],
    environmentMatchGlobs: [['app/**', 'jsdom']],
  },
});
