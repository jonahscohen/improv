import * as esbuild from 'esbuild';
import { argv } from 'process';

const coreOnly = argv.includes('--core-only');
const dev = argv.includes('--dev');

await esbuild.build({
  entryPoints: ['core/index.ts'],
  bundle: true,
  outfile: 'dist/improv-core.js',
  format: 'iife',
  globalName: 'Improv',
  minify: !dev,
  sourcemap: true,
  target: 'es2022',
});

console.log(`Built: dist/improv-core.js (${dev ? 'dev' : 'prod'})`);

if (coreOnly) {
  process.exit(0);
}

const adapters = ['react', 'vue', 'svelte'];

for (const name of adapters) {
  try {
    await esbuild.build({
      entryPoints: [`adapters/${name}/index.ts`],
      bundle: true,
      outfile: `dist/improv-${name}.js`,
      format: 'iife',
      globalName: `Improv_${name}`,
      minify: !dev,
      sourcemap: true,
      target: 'es2022',
    });
    console.log(`Built: dist/improv-${name}.js`);
  } catch {
    console.log(`Skipped adapter: ${name} (not found)`);
  }
}
