// T-0013: benchmark harness tests.
//
// Covers:
//   1. discoverFixtures walks the fixtures/ dir and returns directories
//      containing a PRODUCT.md.
//   2. loadFixture parses PRODUCT.md, DESIGN.md, and the YAML token frontmatter.
//   3. The runner produces a BenchmarkRun conforming to the schema.
//   4. compareRuns detects passRate regression beyond threshold.
//   5. compareRuns detects criticalViolations increase.
//   6. compareRuns ignores within-noise variation (passRate change < threshold).
//   7. compareRuns ignores cost increase when tier upgraded.
//   8. saveBaseline writes both baseline-latest.json AND a timestamped archive.
//
// The tests do NOT require a live LLM - the flow handlers in sidecoach today
// are rule-based and don't call Anthropic. When the handlers wire LLM calls,
// the runner should mock at the Anthropic-client layer; for now there's
// nothing to mock.

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

import {
  loadFixture,
  discoverFixtures,
  scorePolishStandard,
  scoreExtendedDomain,
  scoreTaste,
  estimateSyntheticTokens,
} from '../../benchmarks/runner/score';
import {
  saveBaseline,
  loadBaseline,
  compareRuns,
  defaultBaselinePaths,
} from '../../benchmarks/runner/report';
import { runAll } from '../../benchmarks/runner/run-all';
import type {
  BenchmarkRun,
  FixtureRunResult,
  FlowRunResult,
} from '../../benchmarks/runner/types';
import { DEFAULT_THRESHOLDS } from '../../benchmarks/runner/types';

interface Check {
  label: string;
  ok: boolean;
  detail?: string;
}

const checks: Check[] = [];

function expect(label: string, ok: boolean, detail?: string): void {
  checks.push({ label, ok, detail });
}

// Synthesize a minimal benchmark-run for compare-mode tests, so we don't
// re-run the full harness for every test case.
function synthRun(
  runId: string,
  flows: Array<{
    fixture: string;
    flowId: any;
    passRate: number;
    critical: number;
    cost: number;
    tierUsed: 'haiku' | 'sonnet' | 'opus';
  }>,
): BenchmarkRun {
  const fixtureMap = new Map<string, FixtureRunResult>();
  for (const f of flows) {
    if (!fixtureMap.has(f.fixture)) {
      fixtureMap.set(f.fixture, { name: f.fixture, category: 'test', flows: [] });
    }
    fixtureMap.get(f.fixture)!.flows.push({
      flowId: f.flowId,
      status: 'success',
      retryStateCount: 0,
      tierUsed: f.tierUsed,
      modelId: f.tierUsed === 'haiku' ? 'claude-haiku-4-5-20251001'
        : f.tierUsed === 'sonnet' ? 'claude-sonnet-4-6'
        : 'claude-opus-4-7',
      polishStandard: {
        passed: Math.round(f.passRate * 22),
        failed: 22 - Math.round(f.passRate * 22),
        passRate: f.passRate,
        criticalViolations: f.critical,
      },
      extendedDomain: { passed: 100, failed: 37, passRate: 0.73 },
      taste: { violations: [] },
      latencyMs: 10,
      tokensInput: 1000,
      tokensOutput: 300,
      estimatedCost: f.cost,
      tokenSource: 'synthetic',
    });
  }
  return {
    runId,
    modelTiers: {
      haiku: 'claude-haiku-4-5-20251001',
      sonnet: 'claude-sonnet-4-6',
      opus: 'claude-opus-4-7',
    },
    fixtures: [...fixtureMap.values()],
    totals: {
      passRateAvg: 0,
      criticalViolations: 0,
      estimatedCost: 0,
      flowCount: flows.length,
    },
    harnessVersion: 'test',
  };
}

async function run() {
  const benchmarkRoot = path.resolve(__dirname, '..', '..', 'benchmarks');
  const fixturesDir = path.join(benchmarkRoot, 'fixtures');

  // === Section 1: fixture discovery ===
  const dirs = discoverFixtures(fixturesDir);
  expect('discoverFixtures: finds at least 5 fixture dirs', dirs.length >= 5, `found ${dirs.length}`);
  const fixtureNames = dirs.map((d) => path.basename(d)).sort();
  for (const expected of ['brand-studio', 'saas-dashboard', 'scroll-landing', 'form-stress', 'mixed-portfolio']) {
    expect(`discoverFixtures: includes ${expected}`, fixtureNames.includes(expected));
  }
  expect(
    'discoverFixtures: ignores non-fixture dirs',
    !fixtureNames.includes('runner') && !fixtureNames.includes('baselines'),
  );

  // === Section 2: loadFixture parses correctly ===
  const studio = loadFixture(path.join(fixturesDir, 'brand-studio'));
  expect('loadFixture: name set', studio.name === 'brand-studio');
  expect('loadFixture: category set from meta.json', studio.category === 'brand', studio.category);
  expect('loadFixture: productMd non-empty', studio.productMd.length > 100);
  expect('loadFixture: designMd non-empty', studio.designMd.length > 100);
  expect(
    'loadFixture: parses DESIGN.md YAML frontmatter',
    !!studio.designTokens.colors,
    JSON.stringify(Object.keys(studio.designTokens).slice(0, 5)),
  );
  expect('loadFixture: cssRules populated from fixture.css', studio.cssRules.length > 0);
  expect('loadFixture: htmlContent populated from fixture.html', studio.htmlContent.length > 0);

  // loadFixture errors on missing files.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 't13-bench-empty-'));
  try {
    let threw = false;
    try {
      loadFixture(tmpDir);
    } catch {
      threw = true;
    }
    expect('loadFixture: throws when PRODUCT.md missing', threw);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  // === Section 3: validators run and produce sane numbers ===
  const polish = scorePolishStandard(studio);
  expect(
    'scorePolishStandard: returns counts that sum to 24',
    polish.passed + polish.failed === 24,
    `passed=${polish.passed} failed=${polish.failed}`,
  );
  expect(
    'scorePolishStandard: passRate is 0..1',
    polish.passRate >= 0 && polish.passRate <= 1,
    `${polish.passRate}`,
  );

  const ext = scoreExtendedDomain(studio);
  expect('scoreExtendedDomain: passed >= 0', ext.passed >= 0);
  expect('scoreExtendedDomain: failed >= 0', ext.failed >= 0);
  expect(
    'scoreExtendedDomain: byDomain populated when validators ran',
    ext.passed + ext.failed === 0 || !!ext.byDomain,
  );

  const taste = scoreTaste(studio);
  expect('scoreTaste: returns violations array', Array.isArray(taste.violations));

  const tokens = estimateSyntheticTokens(studio);
  expect('estimateSyntheticTokens: positive inputTokens', tokens.inputTokens > 0);
  expect('estimateSyntheticTokens: positive outputTokens', tokens.outputTokens > 0);
  expect(
    'estimateSyntheticTokens: deterministic (3:1 ratio)',
    tokens.outputTokens === Math.ceil(tokens.inputTokens / 3),
  );

  // === Section 4: runAll produces schema-conformant output ===
  const benchRun = await runAll(fixturesDir);
  expect('runAll: runId is ISO timestamp', /^\d{4}-\d{2}-\d{2}T/.test(benchRun.runId));
  expect('runAll: modelTiers populated', !!benchRun.modelTiers.haiku && !!benchRun.modelTiers.opus);
  expect('runAll: fixtures count matches discovery', benchRun.fixtures.length === dirs.length);
  expect('runAll: every fixture has at least 1 flow', benchRun.fixtures.every((f) => f.flows.length > 0));
  expect(
    'runAll: every flow has required schema keys',
    benchRun.fixtures.every((f) =>
      f.flows.every((flow) => {
        return (
          typeof flow.flowId === 'string' &&
          typeof flow.status === 'string' &&
          typeof flow.tierUsed === 'string' &&
          typeof flow.modelId === 'string' &&
          typeof flow.polishStandard.passRate === 'number' &&
          typeof flow.extendedDomain.passRate === 'number' &&
          Array.isArray(flow.taste.violations) &&
          typeof flow.latencyMs === 'number' &&
          typeof flow.tokensInput === 'number' &&
          typeof flow.tokensOutput === 'number' &&
          typeof flow.estimatedCost === 'number' &&
          (flow.tokenSource === 'live' || flow.tokenSource === 'synthetic')
        );
      }),
    ),
  );
  expect(
    'runAll: totals.flowCount matches actual flow count',
    benchRun.totals.flowCount === benchRun.fixtures.reduce((s, f) => s + f.flows.length, 0),
  );
  expect(
    'runAll: harnessVersion is 12-char hex',
    /^[a-f0-9]{12}$/.test(benchRun.harnessVersion),
    benchRun.harnessVersion,
  );

  // === Section 5: compare detects passRate regression beyond threshold ===
  const before = synthRun('2026-01-01T00:00:00Z', [
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.90, critical: 0, cost: 0.01, tierUsed: 'opus' },
  ]);
  const afterDrop = synthRun('2026-01-02T00:00:00Z', [
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.85, critical: 0, cost: 0.01, tierUsed: 'opus' },
  ]);
  const dropReport = compareRuns(before, afterDrop);
  expect('compare: detects 5% passRate drop (threshold 2%)', dropReport.regressionCount === 1);
  expect('compare: exitCode 1 on regression', dropReport.exitCode === 1);
  expect(
    'compare: regression reason mentions passRate',
    dropReport.deltas[0].reasons.some((r) => r.includes('passRate')),
    JSON.stringify(dropReport.deltas[0].reasons),
  );

  // === Section 6: compare ignores within-noise variation ===
  const afterNoise = synthRun('2026-01-02T00:00:00Z', [
    // 1% drop, below 2% threshold.
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.89, critical: 0, cost: 0.01, tierUsed: 'opus' },
  ]);
  const noiseReport = compareRuns(before, afterNoise);
  expect('compare: 1% drop below 2% threshold = no regression', noiseReport.regressionCount === 0);
  expect('compare: exitCode 0 on noise', noiseReport.exitCode === 0);

  // === Section 7: compare detects criticalViolations increase ===
  const afterCritical = synthRun('2026-01-02T00:00:00Z', [
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.90, critical: 1, cost: 0.01, tierUsed: 'opus' },
  ]);
  const criticalReport = compareRuns(before, afterCritical);
  expect('compare: detects criticalViolations +1', criticalReport.regressionCount === 1);
  expect(
    'compare: reason mentions criticalViolations',
    criticalReport.deltas[0].reasons.some((r) => r.includes('criticalViolations')),
  );

  // === Section 8: compare detects cost increase WITHOUT tier change ===
  const afterCost = synthRun('2026-01-02T00:00:00Z', [
    // 50% cost increase, same tier.
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.90, critical: 0, cost: 0.015, tierUsed: 'opus' },
  ]);
  const costReport = compareRuns(before, afterCost);
  expect('compare: detects cost +50% with same tier', costReport.regressionCount === 1);

  // === Section 9: compare IGNORES cost increase WITH tier change ===
  const afterTierChange = synthRun('2026-01-02T00:00:00Z', [
    // Cost goes up but tier upgraded - legitimate.
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.90, critical: 0, cost: 0.05, tierUsed: 'sonnet' },
  ]);
  // before was opus. We need to flip - tier going from sonnet -> opus is the upgrade.
  const beforeSonnet = synthRun('2026-01-01T00:00:00Z', [
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.90, critical: 0, cost: 0.01, tierUsed: 'sonnet' },
  ]);
  const afterUpgrade = synthRun('2026-01-02T00:00:00Z', [
    { fixture: 'a', flowId: 'flowJ_tactical_polish', passRate: 0.90, critical: 0, cost: 0.05, tierUsed: 'opus' },
  ]);
  const upgradeReport = compareRuns(beforeSonnet, afterUpgrade);
  expect(
    'compare: ignores cost increase when tier changed (legitimate upgrade)',
    upgradeReport.regressionCount === 0,
    JSON.stringify(upgradeReport.deltas[0].reasons),
  );

  // === Section 10: saveBaseline writes both files ===
  const tmpBenchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 't13-baseline-'));
  try {
    const paths = defaultBaselinePaths(tmpBenchRoot);
    const { latestPath, archivePath } = saveBaseline(before, paths);
    expect('saveBaseline: writes baseline-latest.json', fs.existsSync(latestPath));
    expect('saveBaseline: writes timestamped archive', fs.existsSync(archivePath));
    expect(
      'saveBaseline: archive filename derived from runId',
      path.basename(archivePath).includes('2026-01-01'),
      archivePath,
    );
    // Round-trip read.
    const reloaded = loadBaseline(paths);
    expect('loadBaseline: reads back same runId', reloaded?.runId === before.runId);
  } finally {
    fs.rmSync(tmpBenchRoot, { recursive: true, force: true });
  }

  // === Section 11: compare-mode with no baseline (first run) ===
  const firstRunReport = compareRuns(null, before);
  expect('compare: first-run mode (no baseline) is not a regression', firstRunReport.regressionCount === 0);
  expect('compare: first-run all deltas have before=null', firstRunReport.deltas.every((d) => d.before === null));

  // === Report ===
  let allPass = true;
  for (const c of checks) {
    if (c.ok) {
      console.log(`PASS ${c.label}`);
    } else {
      console.log(`FAIL ${c.label}${c.detail ? ' :: ' + c.detail : ''}`);
      allPass = false;
    }
  }
  const total = checks.length;
  const passed = checks.filter((c) => c.ok).length;
  console.log('---');
  console.log(`t13-bench-harness: ${passed}/${total} passed`);
  console.log(allPass ? 't13-bench-harness PASS' : 't13-bench-harness FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
