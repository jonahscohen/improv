// sidecoach/scripts/generate-counter-rules.ts
//
// Stage 1c - BUILD-TIME COUNTER-RULE COMPILATION (upgrade plan 2026-07-23, Stage 1c).
//
// THIN wrapper: all pure logic lives in ../src/counter-rule-generation (inside rootDir ./src so the test imports it
// without TS6059 - mirrors how generate-validators.ts delegates to validator-generation.ts). This file only does
// file I/O + --check. Reads the committed Stage 1b defect-distribution artifact and emits
// src/counter-rules.generated.ts; the generate-validators --check idiom means `npm run build` catches any drift
// between the committed distribution and the generated module.
import * as fs from 'fs';
import * as path from 'path';
import {
  deriveCounterRules, renderCounterRulesModule, type DistArtifact,
} from '../src/counter-rule-generation';

export { deriveCounterRules, renderCounterRulesModule } from '../src/counter-rule-generation';

const SC = path.resolve(__dirname, '..');
const OUT = path.resolve(SC, 'src', 'counter-rules.generated.ts');
const DEFAULT_DIST = path.resolve(SC, 'eval', 'corpus', 'defect-distribution.json');

function loadDist(distPath: string): DistArtifact {
  if (!fs.existsSync(distPath)) {
    console.error(`generate-counter-rules: distribution not found at ${path.relative(SC, distPath)}. Run Stage 1a (provider-sample) then Stage 1b (defect-distribution) and commit the merged artifact first.`);
    process.exit(2);
  }
  let art: DistArtifact;
  try { art = JSON.parse(fs.readFileSync(distPath, 'utf-8')); }
  catch (e) { console.error(`generate-counter-rules: bad distribution JSON: ${(e as Error).message}`); process.exit(2); }
  if (art.schema !== 'sidecoach-defect-distribution/v1') { console.error(`generate-counter-rules: unexpected distribution schema: ${art.schema}`); process.exit(2); }
  if (!Array.isArray(art.ruleUniverse) || art.ruleUniverse.length === 0) { console.error('generate-counter-rules: distribution has an empty ruleUniverse'); process.exit(2); }
  if (!art.distribution || Object.keys(art.distribution).length === 0) { console.error('generate-counter-rules: distribution is empty (no providers)'); process.exit(2); }
  return art;
}

function main(): void {
  const argv = process.argv.slice(2);
  const check = argv.includes('--check');
  const distIdx = argv.indexOf('--dist');
  const distPath = distIdx >= 0 && argv[distIdx + 1] ? path.resolve(argv[distIdx + 1]) : DEFAULT_DIST;
  // --out overrides the write/compare target (used by the smoke test so synthetic data never lands in src/).
  const outIdx = argv.indexOf('--out');
  const outPath = outIdx >= 0 && argv[outIdx + 1] ? path.resolve(argv[outIdx + 1]) : OUT;

  const art = loadDist(distPath);
  const rules = deriveCounterRules(art);
  const want = renderCounterRulesModule(art, rules);

  if (check) {
    const have = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf-8') : '';
    if (have !== want) { console.error(`generate-counter-rules --check: DRIFT in ${path.relative(SC, outPath)} (regenerate from the committed distribution)`); process.exit(1); }
    console.log(`generate-counter-rules --check: OK (${rules.length} counter-rule(s), no drift)`);
    return;
  }
  fs.writeFileSync(outPath, want);
  console.log(`generate-counter-rules: wrote ${path.relative(SC, outPath)} (${rules.length} counter-rule(s) from ${Object.keys(art.distribution).length} provider(s))`);
}

if (require.main === module) main();
