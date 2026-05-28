import * as esbuild from 'esbuild';
import { argv } from 'process';

const coreOnly = argv.includes('--core-only');
const dev = argv.includes('--dev');

await esbuild.build({
  entryPoints: ['core/index.ts'],
  bundle: true,
  outfile: 'dist/endow-core.js',
  format: 'iife',
  globalName: 'Endow',
  minify: !dev,
  sourcemap: true,
  target: 'es2022',
});

console.log(`Built: dist/endow-core.js (${dev ? 'dev' : 'prod'})`);

if (coreOnly) {
  process.exit(0);
}

const adapters = ['react', 'vue', 'svelte'];

for (const name of adapters) {
  try {
    await esbuild.build({
      entryPoints: [`adapters/${name}/index.ts`],
      bundle: true,
      outfile: `dist/endow-${name}.js`,
      format: 'iife',
      globalName: `Endow_${name}`,
      minify: !dev,
      sourcemap: true,
      target: 'es2022',
    });
    console.log(`Built: dist/endow-${name}.js`);
  } catch {
    console.log(`Skipped adapter: ${name} (not found)`);
  }
}
