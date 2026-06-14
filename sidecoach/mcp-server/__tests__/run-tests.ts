// Test runner: imports each suite, calls run(), then prints stats.
//
// Pass a category as the first arg (unit / integration / fault-injection)
// to run just that category. No arg = run all.

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { finalize } from './harness';

// HOME ISOLATION (mirrors sidecoach/scripts/run-tests.ts). Lane-driving integration
// suites (lane-tool-e2e, lane-render-url) call engine startLane/advanceLane, which since
// P4f publish the committed step to the HOME-scoped ~/.claude/sidecoach-flow-history.json
// (FlowHistory.HISTORY_FILE reads process.env.HOME at call time). Without this, those
// suites write the DEVELOPER's real flow-history. Pin Playwright at the shared real-home
// cache BEFORE overriding HOME so any real-browser path still resolves Chromium. This runs
// at module top - before main() require()s any suite (and thus the engine dist) - so every
// in-process suite sees the temp HOME.
const REAL_HOME = process.env.HOME || os.homedir();
if (!process.env.PLAYWRIGHT_BROWSERS_PATH) {
  const cacheByPlatform: Record<string, string> = {
    darwin: path.join(REAL_HOME, 'Library', 'Caches', 'ms-playwright'),
    win32: path.join(REAL_HOME, 'AppData', 'Local', 'ms-playwright'),
  };
  process.env.PLAYWRIGHT_BROWSERS_PATH = cacheByPlatform[process.platform] ?? path.join(REAL_HOME, '.cache', 'ms-playwright');
}
// Regression guard: stamp the REAL flow-history before isolation; assert it is untouched
// after the run so a future suite that breaches HOME isolation is caught loudly.
const REAL_FLOW_HISTORY = path.join(REAL_HOME, '.claude', 'sidecoach-flow-history.json');
const stampFlowHistory = (): string =>
  fs.existsSync(REAL_FLOW_HISTORY) ? `${fs.statSync(REAL_FLOW_HISTORY).mtimeMs}:${fs.statSync(REAL_FLOW_HISTORY).size}` : 'absent';
const REAL_FLOW_HISTORY_BEFORE = stampFlowHistory();
process.env.HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-mcp-test-home-'));
// eslint-disable-next-line no-console
console.log(`mcp run-tests: isolated HOME -> ${process.env.HOME}`);

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
  // HOME-isolation guard: the real flow-history must be byte-identical to before the run.
  if (stampFlowHistory() !== REAL_FLOW_HISTORY_BEFORE) {
    // eslint-disable-next-line no-console
    console.error(`mcp run-tests: HOME-ISOLATION BREACH - real ${REAL_FLOW_HISTORY} changed during the run`);
    process.exit(3);
  }
  finalize();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('test runner crashed:', err);
  process.exit(2);
});
