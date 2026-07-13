import { defineConfig } from 'vitest/config';

// The ONLY job of this config is to teach vitest the same react -> preact aliases
// that build.js already gives esbuild. The core barrel (core/index.ts) transitively
// imports the ported Retune panel .tsx files, which `import { useState } from
// 'react'` - and react is not a dependency; preact/compat stands in for it at build
// time. Without the alias here, any test that imports core/index.ts dies on
// "Failed to resolve import 'react'", which is why no test could reach JustifyCore
// until now.
//
// Everything else is left at vitest's defaults on purpose. This file must not
// quietly change the environment, the include globs, or anything else the existing
// suite already relies on.
export default defineConfig({
  resolve: {
    alias: {
      react: 'preact/compat',
      'react-dom': 'preact/compat',
      'react/jsx-runtime': 'preact/jsx-runtime',
      'react/jsx-dev-runtime': 'preact/jsx-dev-runtime',
    },
  },
});
