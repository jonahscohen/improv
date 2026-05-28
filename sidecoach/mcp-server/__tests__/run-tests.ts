// Test runner: imports each suite, calls run(), then prints stats.
//
// Pass a category as the first arg (unit / integration / fault-injection)
// to run just that category. No arg = run all.

import * as path from 'path';
import * as fs from 'fs';

import { finalize } from './harness';

type Category = 'unit' | 'integration' | 'fault-injection';

const ALL_CATEGORIES: Category[] = ['unit', 'integration', 'fault-injection'];

async function loadAndRun(category: Category): Promise<void> {
  const dir = path.join(__dirname, category);
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.test.ts'))
    .map((f) => path.join(dir, f));
  for (const f of files) {
    // eslint-disable-next-line no-console
    console.log(`\n=== ${category}/${path.basename(f)} ===`);
    const mod = require(f);
    if (typeof mod.run === 'function') {
      await mod.run();
    }
  }
}

async function main(): Promise<void> {
  const arg = process.argv[2] as Category | undefined;
  const cats = arg ? [arg] : ALL_CATEGORIES;
  for (const cat of cats) {
    await loadAndRun(cat);
  }
  finalize();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('test runner crashed:', err);
  process.exit(2);
});
