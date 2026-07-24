// sidecoach/src/__tests__/detect-cli.test.ts
//
// Contract for bin/sidecoach-detect.js - the ONE detect entry point.
//
// The thing this suite exists to protect is the FAIL-CLOSED verdict. A previous `detect`
// CLI was removed from this repo because it reported a clean verdict for a scan that never
// happened; that is the single worst regression this tool can have, so the verdict rule is
// unit-tested exhaustively here (fast, no browser) and the three dispatch paths are then
// exercised end-to-end through the real binary (browser, slower, but real).
//
// The e2e cases require dist/ - `npm test` runs `npm run build` first, so the binary loads
// the same compiled engines the rest of the gate verifies.
import * as path from 'path';
import { execFileSync } from 'child_process';
import { getRuleById } from '../product-rule-registry';

const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-detect.js');
const DEFECT_FIXTURE = path.join(SC, 'eval', 'fixtures', 'known-defect', 'gradient-text.html');
const CLEAN_FIXTURE = path.join(SC, 'eval', 'fixtures', 'known-good', 'clean-page.html');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const detect = require(BIN) as {
  decideVerdict: (
    lenses: Record<string, { attempted: boolean; available: boolean }>,
    blocking: number,
    warning: number,
  ) => string;
  exitCodeFor: (verdict: string) => number;
  EXIT_CLEAN: number;
  EXIT_FINDINGS: number;
  EXIT_USAGE: number;
  EXIT_INCONCLUSIVE: number;
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const ran = { attempted: true, available: true };
const failed = { attempted: true, available: false };

interface RunResult { code: number; stdout: string; json: Record<string, unknown> }

function runDetect(args: string[]): RunResult {
  let code = 0;
  let stdout = '';
  try {
    stdout = execFileSync('node', [BIN, ...args, '--quiet'], { encoding: 'utf8', cwd: SC, stdio: ['ignore', 'pipe', 'pipe'] });
  } catch (e) {
    const err = e as { status?: number; stdout?: string };
    code = typeof err.status === 'number' ? err.status : -1;
    stdout = err.stdout ?? '';
  }
  let json: Record<string, unknown> = {};
  if (stdout.trim()) {
    try { json = JSON.parse(stdout) as Record<string, unknown>; }
    catch { throw new Error(`stdout was not JSON for [${args.join(' ')}]:\n${stdout.slice(0, 400)}`); }
  }
  return { code, stdout, json };
}

function lensesOf(r: RunResult): Record<string, { attempted: boolean; available: boolean; findings: number }> {
  return r.json.lenses as Record<string, { attempted: boolean; available: boolean; findings: number }>;
}

function rulesOf(r: RunResult): string[] {
  return (r.json.findings as Array<{ rule: string }>).map((f) => f.rule);
}

function main(): void {
  // ---------------------------------------------------------------------
  // 1. FAIL-CLOSED verdict rule (pure, no browser).
  // ---------------------------------------------------------------------
  assert(detect.decideVerdict({}, 0, 0) === 'inconclusive', 'no lens attempted must be inconclusive, never clean');
  assert(detect.decideVerdict({ a: failed }, 0, 0) === 'inconclusive', 'no lens available must be inconclusive, never clean');
  assert(detect.decideVerdict({ a: failed, b: failed }, 0, 0) === 'inconclusive', 'all lenses failed must be inconclusive');

  // THE central invariant: a PARTIAL scan that found nothing is NOT clean. The lens that
  // did not run is exactly where the missing findings would have been.
  assert(
    detect.decideVerdict({ a: ran, b: failed }, 0, 0) === 'inconclusive',
    'partial scan with ZERO findings must be inconclusive - a lens that did not run cannot certify clean',
  );
  assert(
    detect.decideVerdict({ a: ran, b: ran, c: ran, d: failed }, 0, 0) === 'inconclusive',
    'three-of-four lenses with zero findings still cannot certify clean',
  );

  // Findings outrank an incomplete scan: reporting a real defect beats reporting a gap.
  assert(detect.decideVerdict({ a: ran, b: failed }, 1, 0) === 'blocked', 'a blocking finding on a partial scan is blocked');
  assert(detect.decideVerdict({ a: ran, b: failed }, 0, 1) === 'warnings-only', 'a warning on a partial scan is warnings-only');
  assert(detect.decideVerdict({ a: ran }, 2, 3) === 'blocked', 'blocking outranks warning');
  assert(detect.decideVerdict({ a: ran, b: ran }, 0, 1) === 'warnings-only', 'warnings with no blockers is warnings-only');

  // clean is the STRONGEST claim and needs the MOST evidence: every attempted lens ran.
  assert(detect.decideVerdict({ a: ran }, 0, 0) === 'clean', 'single lens that ran with zero findings is clean');
  assert(detect.decideVerdict({ a: ran, b: ran, c: ran, d: ran }, 0, 0) === 'clean', 'all lenses ran with zero findings is clean');

  // A lens that was never attempted must not be able to make a verdict inconclusive.
  assert(
    detect.decideVerdict({ a: ran, skipped: { attempted: false, available: false } }, 0, 0) === 'clean',
    'a lens that was never attempted is not a coverage gap',
  );

  // ---------------------------------------------------------------------
  // 2. Exit codes: one per outcome class, and NEVER 0 for a non-clean verdict.
  // ---------------------------------------------------------------------
  assert(detect.exitCodeFor('clean') === detect.EXIT_CLEAN, 'clean -> 0');
  assert(detect.exitCodeFor('blocked') === detect.EXIT_FINDINGS, 'blocked -> findings code');
  assert(detect.exitCodeFor('warnings-only') === detect.EXIT_FINDINGS, 'warnings-only -> findings code');
  assert(detect.exitCodeFor('inconclusive') === detect.EXIT_INCONCLUSIVE, 'inconclusive -> its own code');
  for (const v of ['blocked', 'warnings-only', 'inconclusive']) {
    assert(detect.exitCodeFor(v) !== 0, `${v} must never exit 0`);
  }
  assert(
    detect.exitCodeFor('inconclusive') !== detect.exitCodeFor('blocked'),
    'inconclusive must be distinguishable from findings by exit code alone',
  );

  // ---------------------------------------------------------------------
  // 3. e2e: known-defect local .html -> the planted finding, nonzero exit.
  // ---------------------------------------------------------------------
  const defect = runDetect([DEFECT_FIXTURE]);
  assert(defect.code !== 0, `known-defect fixture must exit nonzero (got ${defect.code})`);
  assert(defect.json.verdict === 'blocked', `known-defect verdict should be blocked, got ${String(defect.json.verdict)}`);
  const defectRules = rulesOf(defect);
  assert(
    defectRules.some((r) => r.includes('gradient-text')),
    `the planted gradient-text finding must be emitted, got [${defectRules.join(', ')}]`,
  );
  // Both static engines must have been dispatched for a local .html, and the rendered pass
  // too - the defect is static-only, so a rendered-only run would have reported nothing.
  const defectLenses = lensesOf(defect);
  for (const name of ['static-ban', 'static-check', 'objective', 'subjective']) {
    assert(defectLenses[name]?.attempted === true, `local .html must attempt the ${name} lens`);
  }
  assert(defectLenses['static-ban'].findings > 0, 'the static ban lens is what catches gradient-text');

  // ---------------------------------------------------------------------
  // 4. e2e: known-good fixture -> clean, exit 0, and every lens actually ran.
  // ---------------------------------------------------------------------
  const clean = runDetect([CLEAN_FIXTURE]);
  assert(clean.code === 0, `clean fixture must exit 0 (got ${clean.code}); stdout: ${clean.stdout.slice(0, 400)}`);
  assert(clean.json.verdict === 'clean', `clean fixture verdict should be clean, got ${String(clean.json.verdict)}`);
  assert((clean.json.findings as unknown[]).length === 0, 'clean fixture must emit zero findings');
  const cleanLenses = lensesOf(clean);
  for (const name of ['static-ban', 'static-check', 'objective', 'subjective']) {
    assert(cleanLenses[name]?.available === true, `a clean verdict requires the ${name} lens to have actually run`);
  }

  // ---------------------------------------------------------------------
  // 5. e2e: a URL that cannot be reached -> inconclusive in the stdout JSON, NOT clean.
  //    Port 49999 is refused rather than blocked by browser port policy, so this exercises
  //    a real navigation failure.
  // ---------------------------------------------------------------------
  const dead = runDetect(['http://127.0.0.1:49999/']);
  assert(dead.json.verdict === 'inconclusive', `unreachable URL must be inconclusive, got ${String(dead.json.verdict)}`);
  assert(dead.json.verdict !== 'clean', 'unreachable URL must NEVER be reported clean');
  assert(dead.json.scanned === false, 'unreachable URL scanned nothing');
  assert(dead.code === detect.EXIT_INCONCLUSIVE, `unreachable URL must exit ${detect.EXIT_INCONCLUSIVE} (got ${dead.code})`);
  assert((dead.json.unavailableReasons as string[]).length > 0, 'an inconclusive verdict must say WHY the lens did not run');

  // ---------------------------------------------------------------------
  // 6. A lens that was deliberately skipped is REPORTED as skipped, not omitted.
  //    A two-lens clean must not be readable as a four-lens clean.
  // ---------------------------------------------------------------------
  const noRender = runDetect([CLEAN_FIXTURE, '--no-render']);
  const noRenderLenses = lensesOf(noRender);
  for (const name of ['static-ban', 'static-check', 'objective', 'subjective']) {
    assert(noRenderLenses[name] !== undefined, `every known lens must appear in the report, ${name} was missing`);
  }
  for (const name of ['objective', 'subjective']) {
    assert(noRenderLenses[name].attempted === false, `--no-render must mark the ${name} lens as not attempted`);
    assert(
      typeof (noRenderLenses[name] as { reason?: string }).reason === 'string',
      `a skipped ${name} lens must say WHY it was skipped`,
    );
  }
  // A skipped lens is not a coverage gap, so the lenses that ran can still certify.
  assert(noRender.json.verdict === 'clean', `--no-render on the clean fixture should be clean, got ${String(noRender.json.verdict)}`);
  assert((noRender.json.unavailableReasons as string[]).length === 0, 'a skipped lens is not an unavailable lens');

  // A URL target skips the static lenses for the same reason, and says so.
  const deadLenses = lensesOf(dead);
  for (const name of ['static-ban', 'static-check']) {
    assert(deadLenses[name].attempted === false, `a URL target must mark the ${name} lens as not attempted`);
  }

  // ---------------------------------------------------------------------
  // 7. A missing target is an IO error, not a clean scan of nothing.
  // ---------------------------------------------------------------------
  const missing = runDetect([path.join(SC, 'eval', 'fixtures', 'does-not-exist.html')]);
  assert(missing.code === detect.EXIT_USAGE, `missing target must exit ${detect.EXIT_USAGE} (got ${missing.code})`);
  assert(missing.stdout.trim() === '', 'a target that could not be read must not emit a result JSON at all');

  // ---------------------------------------------------------------------
  // 8. Ban severity comes from the REGISTRY, not from the scanner's raw P0/P1/P2 tag.
  //    The two deliberately disagree: the scanner tags hero-metric-template P1 (which maps
  //    to the blocking 'major'), while the registry overrides that rule to 'minor'. If this
  //    CLI read the raw tag it would call a defect blocking that the anti-pattern validator
  //    - the shipped owner of the same rule - calls non-blocking. (Codex review P1.)
  // ---------------------------------------------------------------------
  const heroRule = getRuleById('anti-pattern.hero-metric-template');
  assert(heroRule !== undefined, 'anti-pattern.hero-metric-template must exist in the registry');
  assert(
    heroRule!.severity === 'minor',
    `this test encodes the registry override; hero-metric-template is now '${heroRule!.severity}' - re-check banSeverity in the CLI`,
  );
  const gradientRule = getRuleById('anti-pattern.gradient-text');
  assert(gradientRule!.severity === 'major', 'gradient-text is expected to stay a blocking-severity rule');
  // The defect fixture proves the blocking half end to end: its ban finding is 'blocking'
  // because the REGISTRY says major, and both engines agree on the verdict.
  const banFinding = (defect.json.findings as Array<{ rule: string; severity: string; lens: string }>)
    .find((f) => f.lens === 'static-ban' && f.rule === 'ban.gradient-text');
  assert(banFinding !== undefined, 'the static-ban lens must report ban.gradient-text on the defect fixture');
  assert(banFinding!.severity === 'blocking', `ban.gradient-text should map to blocking, got ${banFinding!.severity}`);

  // ---------------------------------------------------------------------
  // 9. --render-url must not swallow the following option as its value. (Codex review P2.)
  // ---------------------------------------------------------------------
  const badFlag = runDetect([CLEAN_FIXTURE, '--render-url']);
  assert(badFlag.code === detect.EXIT_USAGE, `--render-url with no value must exit ${detect.EXIT_USAGE} (got ${badFlag.code})`);
  assert(badFlag.stdout.trim() === '', 'a usage error must not emit a result JSON');

  console.log('detect-cli: OK (fail-closed verdict matrix, exit-code classes, registry severity, arg guards, e2e dispatch)');
}

main();
