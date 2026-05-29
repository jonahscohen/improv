import * as esbuild from 'esbuild';
import { argv } from 'process';

const dev = argv.includes('--dev');

await esbuild.build({
  entryPoints: ['runtime/index.ts'],
  bundle: true,
  outfile: 'dist/tilt-runtime.js',
  format: 'esm',
  loader: { '.json': 'json' },
  minify: !dev,
  sourcemap: true,
  target: 'es2022',
});

console.log(`Built: dist/tilt-runtime.js (${dev ? 'dev' : 'prod'})`);
