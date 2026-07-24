// sidecoach/scripts/generate-lanes-data.ts
//
// Vendors the CANONICAL lane registry (claude/hooks/sidecoach-lanes.json) into a
// package-local copy at sidecoach/data/sidecoach-lanes.json. The runtime
// `/sidecoach <phrase>` read in sidecoach-orchestrator.ts resolves THIS copy
// (package-relative), so an installed plugin ships its own lane data and never
// escapes to a repo sibling. The canonical file under claude/hooks/ stays the
// single source of truth; this copy is GENERATED output, committed like dist/.
//
// Structured like generate-validators.ts: file I/O only, plus a --check mode. The
// copy is byte-exact (raw Buffer, no parse/re-stringify) so `diff` against the
// canonical shows nothing.
//
// Build wiring: `npm run build` runs THIS in --check mode only (a fail-fast drift
// gate), NOT a regenerate-then-check. Unlike validators.generated.ts (a compiled
// build INPUT that must be regenerated so tsc sees fresh types), data/ is a
// committed, shipped RUNTIME artifact - so the build's job is to FAIL when the
// committed copy fell behind canonical, not to silently self-heal it. Regenerate
// on demand with `npm run generate-lanes-data` (what a --check failure points to),
// then commit the refreshed copy like any other tracked generated output.
//
// Exit codes (fail-loud, distinct per failure class):
//   0  success (wrote copy, or --check found no drift)
//   2  canonical source missing (cannot vendor)
//   3  --check drift: vendored copy is stale vs canonical
import * as fs from 'fs';
import * as path from 'path';

const SC = path.resolve(__dirname, '..');
const CANONICAL = path.resolve(SC, '..', 'claude', 'hooks', 'sidecoach-lanes.json');
const VENDORED = path.resolve(SC, 'data', 'sidecoach-lanes.json');

function main() {
  const check = process.argv.includes('--check');
  if (!fs.existsSync(CANONICAL)) {
    console.error(`generate-lanes-data: canonical source missing at ${path.relative(SC, CANONICAL)}`);
    process.exit(2);
  }
  const want = fs.readFileSync(CANONICAL); // Buffer -> byte-exact vendor, no reformat
  if (check) {
    const have = fs.existsSync(VENDORED) ? fs.readFileSync(VENDORED) : Buffer.alloc(0);
    if (!have.equals(want)) {
      console.error(
        `generate-lanes-data --check: DRIFT in ${path.relative(SC, VENDORED)} ` +
        `(out of sync with ${path.relative(SC, CANONICAL)} - run \`npm run generate-lanes-data\` to resync)`,
      );
      process.exit(3);
    }
    console.log('generate-lanes-data --check: OK (vendored data/sidecoach-lanes.json matches canonical)');
    return;
  }
  fs.mkdirSync(path.dirname(VENDORED), { recursive: true });
  fs.writeFileSync(VENDORED, want);
  console.log(`generate-lanes-data: wrote ${path.relative(SC, VENDORED)} from ${path.relative(SC, CANONICAL)}`);
}

if (require.main === module) main();
