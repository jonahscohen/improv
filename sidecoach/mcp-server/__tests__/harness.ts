// Minimal test harness. Pattern matches the parent sidecoach package's
// ts-node-driven test files - no jest/vitest, just assertions + counters.

import * as assert from 'assert';

export interface TestStats {
  passed: number;
  failed: number;
  failures: Array<{ name: string; error: string }>;
}

const STATS: TestStats = { passed: 0, failed: 0, failures: [] };

export async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    STATS.passed += 1;
    // eslint-disable-next-line no-console
    console.log(`  ✓ ${name}`);
  } catch (err) {
    STATS.failed += 1;
    const msg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    STATS.failures.push({ name, error: msg });
    // eslint-disable-next-line no-console
    console.log(`  ✗ ${name}`);
    // eslint-disable-next-line no-console
    console.log(`    ${msg.split('\n').slice(0, 5).join('\n    ')}`);
  }
}

export function describe(label: string): void {
  // eslint-disable-next-line no-console
  console.log(`\n${label}`);
}

export function finalize(): void {
  // eslint-disable-next-line no-console
  console.log(`\n${STATS.passed + STATS.failed} tests: ${STATS.passed} passed, ${STATS.failed} failed`);
  if (STATS.failed > 0) {
    process.exit(1);
  }
}

export function resetStats(): void {
  STATS.passed = 0;
  STATS.failed = 0;
  STATS.failures.length = 0;
}

export function statsSnapshot(): TestStats {
  return { ...STATS, failures: [...STATS.failures] };
}

export { assert };
