// sidecoach/src/__tests__/palette-recipe.test.ts
//
// Contract for the Stage 2a palette recipe: bin/sidecoach-palette.js + src/palette-recipe.ts.
//
// The load-bearing property is FAIL-CLOSED: the recipe must NEVER emit a palette that silently fails a
// required WCAG contrast pair, and a contrast check that did not RUN is inconclusive, never clean. That logic
// is proven here two ways:
//   1. PURE (always runs, no browser): resolveVerdict + the CLI's classify decide fail-closed from findings
//      alone, so the invariant is verified even on a machine with no Chromium cache.
//   2. E2E (browser-gated): the real binary renders the swatches through the SHIPPING objective scanner and
//      must emit on a clean brand, refuse + name the pair on a contrast-failing brand, and report
//      inconclusive (never clean) when the scan cannot run.
//
// Also asserted: OKLCH->sRGB determinism, brand-input validation, DESIGN.md frontmatter shape
// (@google/design.md: colors.primary present, rounded uses real dimensions), canonical body section order,
// no hard-coded hex in the body prose (team rule), and byte-identical output for a fixed brand.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import {
  parseBrandInput, buildPalette, buildRamp, requiredPairs, buildSwatchHtml,
  resolveVerdict, emitDesignMd, oklchToHex, darkerStop, accentSurfaces, RAMP_STOPS, ACCENT_FAMILIES,
  type RequiredPair, type ScanFindingLike,
} from '../palette-recipe';

const SC = path.resolve(__dirname, '..', '..');
const BIN = path.join(SC, 'bin', 'sidecoach-palette.js');
const PASS_FIXTURE = path.join(SC, 'eval', 'fixtures', 'palette', 'brand-pass.json');
const FAIL_FIXTURE = path.join(SC, 'eval', 'fixtures', 'palette', 'brand-fail.json');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const cli = require(BIN) as {
  classify: (scanAvailable: boolean, verdict: { failures: unknown[] } | null) => { verdict: string; exit: number };
  EXIT_CLEAN: number; EXIT_FINDINGS: number; EXIT_USAGE: number; EXIT_INCONCLUSIVE: number;
};

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

const HEX = /^#[0-9a-f]{6}$/;
const GOOD_BRAND = { name: 'T', base: { hue: 250, chroma: 0.012 }, primary: { hue: 262, chroma: 0.15 } };

interface RunResult { code: number; stdout: string; stderr: string }
function runCli(args: string[], env?: Record<string, string>): RunResult {
  let code = 0;
  let stdout = '';
  let stderr = '';
  try {
    stdout = execFileSync('node', [BIN, ...args], {
      encoding: 'utf8', cwd: SC, stdio: ['ignore', 'pipe', 'pipe'],
      env: env ? { ...process.env, ...env } : process.env,
    });
  } catch (e) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    code = typeof err.status === 'number' ? err.status : -1;
    stdout = err.stdout ?? '';
    stderr = err.stderr ?? '';
  }
  return { code, stdout, stderr };
}

// ---------------------------------------------------------------------------
// 1. OKLCH -> sRGB conversion (color construction; deterministic + in-gamut).
// ---------------------------------------------------------------------------
function testOklch(): void {
  const a = oklchToHex({ L: 0.6, C: 0.15, H: 262 });
  const b = oklchToHex({ L: 0.6, C: 0.15, H: 262 });
  assert(a === b, 'oklchToHex must be deterministic for identical input');
  assert(HEX.test(a), `oklchToHex must return #rrggbb, got ${a}`);
  // A near-zero-chroma color is a gray: channels within a couple of steps of each other.
  const gray = oklchToHex({ L: 0.5, C: 0.0, H: 0 });
  const r = parseInt(gray.slice(1, 3), 16), g = parseInt(gray.slice(3, 5), 16), bch = parseInt(gray.slice(5, 7), 16);
  assert(Math.abs(r - g) <= 2 && Math.abs(g - bch) <= 2, `zero-chroma must be gray, got ${gray}`);
  // Extremes clamp into gamut, not NaN.
  assert(HEX.test(oklchToHex({ L: 0.98, C: 0.3, H: 100 })), 'very light out-of-gamut must gamut-map, not NaN');
  assert(HEX.test(oklchToHex({ L: 0.05, C: 0.3, H: 300 })), 'very dark out-of-gamut must gamut-map, not NaN');
}

// ---------------------------------------------------------------------------
// 2. Brand-input validation (throws precisely; never silently accepts garbage).
// ---------------------------------------------------------------------------
function testBrandValidation(): void {
  const ok = parseBrandInput(GOOD_BRAND);
  assert(ok.name === 'T', 'valid brand parses name');
  assert(ok.success.hue === 155, 'semantic families default when omitted');
  assert(ok.fonts.body.length > 0, 'fonts default when omitted');

  const throws = (raw: unknown, label: string): void => {
    let threw = false;
    try { parseBrandInput(raw); } catch { threw = true; }
    assert(threw, `parseBrandInput must throw on ${label}`);
  };
  throws(null, 'null');
  throws({}, 'missing name');
  throws({ name: '', base: GOOD_BRAND.base, primary: GOOD_BRAND.primary }, 'empty name');
  throws({ name: 'x', base: { hue: 400, chroma: 0.1 }, primary: GOOD_BRAND.primary }, 'hue >= 360');
  throws({ name: 'x', base: { hue: -1, chroma: 0.1 }, primary: GOOD_BRAND.primary }, 'negative hue');
  throws({ name: 'x', base: { hue: 10, chroma: 0.9 }, primary: GOOD_BRAND.primary }, 'chroma out of range');
  throws({ name: 'x', base: GOOD_BRAND.base, primary: { hue: 1, chroma: 0.1, solidStop: 550 } }, 'invalid solidStop');
}

// ---------------------------------------------------------------------------
// 3. Palette construction: full ramps, default vs pinned solid stop.
// ---------------------------------------------------------------------------
function testPalette(): void {
  const ramp = buildRamp({ hue: 262, chroma: 0.15 });
  for (const stop of RAMP_STOPS) assert(HEX.test(ramp[stop]), `ramp stop ${stop} must be a valid hex`);
  // Lighter stops must be visibly lighter than darker stops (monotonic-ish luminance): 50 lighter than 900.
  const y = (hex: string): number => parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
  assert(y(ramp[50]) > y(ramp[900]), 'stop 50 must be lighter than stop 900');

  const pal = buildPalette(parseBrandInput(GOOD_BRAND));
  assert(pal.solidStop.primary === 700, 'default solid stop is 700');
  const pinned = buildPalette(parseBrandInput({ ...GOOD_BRAND, primary: { hue: 262, chroma: 0.15, solidStop: 500 } }));
  assert(pinned.solidStop.primary === 500, 'pinned solidStop is respected');
  assert((['neutral', 'primary', 'success', 'warning', 'danger', 'info'] as const).every((f) => pal.ramps[f] !== undefined), 'all six families built');
}

// ---------------------------------------------------------------------------
// 4. Required pairs + swatch page.
// ---------------------------------------------------------------------------
function testPairsAndSwatches(): void {
  const pal = buildPalette(parseBrandInput(GOOD_BRAND));
  const pairs = requiredPairs(pal);
  const hard = pairs.filter((p) => !p.onColorFor);
  const cands = pairs.filter((p) => p.onColorFor);
  // hard = 9 role/link/display pairs + 4 alert tints; every emitted component pair is verified.
  assert(hard.length === 13, `expected 13 hard pairs, got ${hard.length}`);
  // candidates = paper+ink on EACH surface of each accent (primary has solid/hover/active; others solid only).
  const expectedCands = ACCENT_FAMILIES.reduce((sum, f) => sum + accentSurfaces(pal, f).length * 2, 0);
  assert(cands.length === expectedCands, `expected ${expectedCands} on-color candidates, got ${cands.length}`);
  assert(accentSurfaces(pal, 'primary').length === 3, 'primary emits solid+hover+active surfaces');
  assert(accentSurfaces(pal, 'success').length === 1, 'a semantic family emits only the solid surface');
  for (const p of pairs) { assert(HEX.test(p.fg), `pair ${p.id} fg hex`); assert(HEX.test(p.bg), `pair ${p.id} bg hex`); }

  const html = buildSwatchHtml(pairs);
  for (const p of pairs) assert(html.includes(`id="${p.id}"`), `swatch html must contain a div for pair ${p.id}`);
  // large pairs render at 28px (scanner classifies large -> 3:1); normal at 16px (4.5:1).
  const large = pairs.find((p) => p.size === 'large')!;
  const normal = pairs.find((p) => p.size === 'normal')!;
  assert(new RegExp(`id="${large.id}"[^>]*font-size:28px`).test(html), 'large pair renders at 28px');
  assert(new RegExp(`id="${normal.id}"[^>]*font-size:16px`).test(html), 'normal pair renders at 16px');
}

// ---------------------------------------------------------------------------
// 5. resolveVerdict - THE fail-closed logic, pure (no browser).
// ---------------------------------------------------------------------------
function lowContrast(id: string, detail = '3.00:1 (need 4.5:1)'): ScanFindingLike {
  return { rule: 'low-contrast', selector: `div#${id}`, detail };
}
function testResolveVerdict(): void {
  const pal = buildPalette(parseBrandInput(GOOD_BRAND));
  const pairs = requiredPairs(pal);

  // (a) No findings => nothing fails; every accent resolves to the preferred (paper) label.
  const clean = resolveVerdict(pairs, []);
  assert(clean.failures.length === 0, 'no findings => no failures');
  assert(clean.passCount === clean.totalRequired && clean.totalRequired === 18, 'clean => 18/18 pass (13 hard + 5 accents)');
  assert(ACCENT_FAMILIES.every((f) => clean.onColor[f] === 'paper'), 'clean => all accents prefer paper');

  // (b) A low-contrast finding on a HARD pair => that pair fails, named with the scanner detail.
  const hardFail = resolveVerdict(pairs, [lowContrast('link-on-canvas', '2.90:1 (need 4.5:1)')]);
  assert(hardFail.failures.some((f) => f.id === 'link-on-canvas' && /2\.90:1/.test(f.detail)), 'hard-pair low-contrast surfaces as a named failure with detail');

  // (c) on-accent: the PAPER candidate fails on a surface => the recipe falls back to ink; no failure.
  const inkFallback = resolveVerdict(pairs, [lowContrast('on-primary-solid-paper')]);
  assert(inkFallback.onColor.primary === 'ink', 'paper-fails-a-surface => ink chosen');
  assert(!inkFallback.failures.some((f) => f.id === 'on-primary'), 'a resolvable accent is not a failure');

  // (d) on-accent: BOTH candidates fail => fail-closed on that accent, named, onColor null.
  const both = resolveVerdict(pairs, [lowContrast('on-primary-solid-paper', '3.47:1 (need 4.5:1)'), lowContrast('on-primary-solid-ink', '4.00:1 (need 4.5:1)')]);
  assert(both.failures.some((f) => f.id === 'on-primary'), 'both-candidates fail => named on-primary failure');
  assert(both.onColor.primary === null, 'both-candidates fail => no on-color chosen');
  assert(/light solid 3\.47:1.*dark solid 4\.00:1/.test(both.failures.find((f) => f.id === 'on-primary')!.detail), 'both-fail detail names the failing surface + ratio for each candidate');

  // (d2) THE Codex-fold proof: a candidate that passes the base SOLID but fails a darker STATE (hover/active)
  // must NOT be chosen - the emitted button state would ship an unverified label. Here paper fails on solid
  // and ink passes solid+hover but fails ACTIVE => neither candidate clears all surfaces => fail-closed.
  const stateHole = resolveVerdict(pairs, [
    lowContrast('on-primary-solid-paper'),           // paper out
    lowContrast('on-primary-active-ink', '2.94:1 (need 4.5:1)'), // ink passes solid+hover, dies on active
  ]);
  assert(stateHole.onColor.primary === null, 'a candidate passing the solid but failing a darker state is NOT accepted');
  assert(stateHole.failures.some((f) => f.id === 'on-primary' && /active 2\.94:1/.test(f.detail)), 'the failing button STATE surface is named (active), closing the emit-unverified-state hole');

  // (e) A non-low-contrast finding (gray-on-color subtype) must be IGNORED as a fail signal.
  const grayOnly = resolveVerdict(pairs, [{ rule: 'gray-on-color', selector: 'div#link-on-canvas', detail: 'x' }]);
  assert(grayOnly.failures.length === 0, 'gray-on-color alone is not a fail signal (low-contrast is)');

  // (f) A finding whose selector has no id must not crash or spuriously fail.
  const noId = resolveVerdict(pairs, [{ rule: 'low-contrast', selector: 'div.some-class', detail: 'x' }]);
  assert(noId.failures.length === 0, 'a selector with no id maps to no pair');
}

// ---------------------------------------------------------------------------
// 6. CLI classify - fail-closed exit-code mapping (pure, no browser).
// ---------------------------------------------------------------------------
function testClassify(): void {
  assert(cli.classify(false, null).verdict === 'inconclusive', 'scan unavailable => inconclusive, never clean');
  assert(cli.classify(false, null).exit === cli.EXIT_INCONCLUSIVE, 'inconclusive => exit 3');
  assert(cli.classify(true, { failures: [{}] }).exit === cli.EXIT_FINDINGS, 'a failing pair => exit 1');
  assert(cli.classify(true, { failures: [] }).exit === cli.EXIT_CLEAN, 'no failures => exit 0');
  // The central invariant: a scan that did not run must NEVER be clean, and its code is distinct from findings.
  assert(cli.classify(false, null).exit !== cli.EXIT_CLEAN, 'inconclusive must never be exit 0');
  assert(cli.EXIT_INCONCLUSIVE !== cli.EXIT_FINDINGS, 'inconclusive distinguishable from findings by code');
}

// ---------------------------------------------------------------------------
// 7. DESIGN.md emission shape + canonical order + no-hex body + determinism.
// ---------------------------------------------------------------------------
function testEmit(): void {
  const pal = buildPalette(parseBrandInput(GOOD_BRAND));
  const pairs = requiredPairs(pal);
  const verdict = resolveVerdict(pairs, []); // clean verdict for a shape check
  const md1 = emitDesignMd(pal, verdict);
  const md2 = emitDesignMd(pal, verdict);
  assert(md1 === md2, 'emitDesignMd must be deterministic for a fixed palette+verdict');

  assert(md1.startsWith('---\n'), 'DESIGN.md starts with YAML frontmatter');
  const secondFence = md1.indexOf('\n---', 4);
  assert(secondFence > 0, 'frontmatter has a closing fence');
  const frontmatter = md1.slice(0, secondFence);
  const body = md1.slice(secondFence);

  assert(/\nversion: alpha/.test(frontmatter), 'frontmatter declares version');
  assert(/\n {2}primary: "#/.test(frontmatter), 'colors.primary defined as a concrete hex (design.md requires it)');
  assert(/\n {2}none: 0px/.test(frontmatter), 'rounded.none must be a real dimension 0px, never bare 0');
  assert(/\{colors\.on-primary\}/.test(frontmatter), 'components reference tokens via {colors.on-primary}');
  assert(/\{rounded\.md\}/.test(frontmatter), 'components reference {rounded.md}');

  // Canonical @google/design.md body section order.
  const order = ['## Overview', '## Colors', '## Typography', '## Layout', '## Elevation & Depth', '## Shapes', '## Components', "## Do's and Don'ts"];
  let cursor = -1;
  for (const h of order) {
    const at = body.indexOf(`\n${h}`);
    assert(at > cursor, `section ${h} must appear after the previous section (canonical order)`);
    cursor = at;
  }
  // Team rule: no hard-coded hex in the body prose - only {token.path} references.
  const bodyHex = body.match(/#[0-9a-fA-F]{6}\b/g) || [];
  assert(bodyHex.length === 0, `body must contain no hard-coded hex, found ${bodyHex.join(', ')}`);
  // The verified-pairs table references tokens, not literals.
  assert(/\{colors\.text-primary\}/.test(body) && /\{colors\.surface-canvas\}/.test(body), 'body cites verified pairs by token path');
}

// ---------------------------------------------------------------------------
// 8. E2E through the real binary (browser-gated: skips gracefully with no Chromium).
// ---------------------------------------------------------------------------
function testE2E(): void {
  const pass = runCli([PASS_FIXTURE, '--quiet']);
  if (pass.code === cli.EXIT_INCONCLUSIVE) {
    console.warn('palette-recipe: SKIP e2e (no Chromium cache; pure fail-closed logic already verified above)');
    return;
  }
  // Clean brand: emits a palette, exit 0.
  assert(pass.code === cli.EXIT_CLEAN, `clean brand must exit 0, got ${pass.code}\n${pass.stderr.slice(0, 400)}`);
  assert(/\nversion: alpha/.test(pass.stdout) && pass.stdout.includes('## Overview'), 'clean brand emits a DESIGN.md to stdout');

  // Contrast-failing brand: refuses to emit, exit 1, NAMES the failing pair on stderr, empty stdout.
  const fail = runCli([FAIL_FIXTURE]);
  assert(fail.code === cli.EXIT_FINDINGS, `contrast-failing brand must exit 1, got ${fail.code}`);
  assert(fail.stdout.trim() === '', 'a failing brand must emit NO palette (empty stdout) - fail-closed');
  assert(/on-primary/.test(fail.stderr) && /need 4\.5:1/.test(fail.stderr), 'the failing pair must be named with its threshold on stderr');

  // Inconclusive: force the scanner to fail to launch -> exit 3, never clean, no palette.
  const inc = runCli([PASS_FIXTURE], { PLAYWRIGHT_BROWSERS_PATH: path.join(os.tmpdir(), 'sidecoach-no-browser-xyz') });
  assert(inc.code === cli.EXIT_INCONCLUSIVE, `a scan that cannot run must be inconclusive (3), got ${inc.code}`);
  assert(inc.stdout.trim() === '', 'inconclusive must emit no palette');
  assert(inc.code !== cli.EXIT_CLEAN, 'inconclusive must NEVER be clean');

  // Usage: unreadable brand file -> exit 2 (never a scan, never a palette).
  const bad = runCli([path.join(SC, 'eval', 'fixtures', 'palette', 'does-not-exist.json'), '--quiet']);
  assert(bad.code === cli.EXIT_USAGE, `missing brand file must exit 2, got ${bad.code}`);
}

// ---------------------------------------------------------------------------
// 7b. Emitted-vs-scanned consistency under a solidStop override (Codex High fold).
// The pair the scanner verifies (requiredPairs uses p.solidStop) and the pair the DESIGN.md documents/emits
// (badges + verified-pairs table) MUST be the same background - never a hard-coded -700 that diverges.
// ---------------------------------------------------------------------------
function testOverrideConsistency(): void {
  assert(darkerStop(700, 1) === 800 && darkerStop(700, 2) === 900, 'darkerStop steps down the ramp');
  assert(darkerStop(900, 1) === 900, 'darkerStop clamps at 900');
  assert(darkerStop(500, 1) === 600, 'darkerStop relative to a pinned solid');

  const pal = buildPalette(parseBrandInput({
    name: 'Override', base: { hue: 250, chroma: 0.012 }, primary: { hue: 262, chroma: 0.15 },
    success: { hue: 155, chroma: 0.1, solidStop: 500 }, // pin success solid to 500, not the default 700
  }));
  assert(pal.solidStop.success === 500, 'override respected');
  const verifiedSolid = pal.ramps.success[500]; // exactly what requiredPairs scans on-success against
  const scannedBg = requiredPairs(pal).find((p) => p.id === 'on-success-solid-paper')!.bg;
  assert(scannedBg === verifiedSolid, 'the scanned on-success background is the 500 solid');

  const md = emitDesignMd(pal, resolveVerdict(requiredPairs(pal), []));
  // the top-level success alias in the frontmatter equals the VERIFIED solid, not the 700 stop.
  assert(md.includes(`\n  success: "${verifiedSolid}"`), 'colors.success alias = the verified (500) solid, not 700');
  assert(verifiedSolid !== pal.ramps.success[700], 'sanity: 500 and 700 differ, so a -700 emit WOULD have diverged');
  // badge + table reference the alias, never a raw -700.
  assert(/badge-success:\n {4}backgroundColor: "\{colors\.success\}"/.test(md), 'badge-success bg = {colors.success} alias');
  assert(!/\{colors\.success-700\}/.test(md), 'no hard-coded {colors.success-700} anywhere in the emit');
  assert(md.includes('| `{colors.on-success} (text-inverse)` | `{colors.success}` |'), 'verified-pairs table cites the success alias');
}

function main(): void {
  testOklch();
  testBrandValidation();
  testPalette();
  testPairsAndSwatches();
  testResolveVerdict();
  testClassify();
  testEmit();
  testOverrideConsistency();
  testE2E();
  console.log('palette-recipe: OK (oklch determinism, brand validation, ramps, fail-closed verdict matrix, DESIGN.md shape + canonical order + no-hex body, e2e emit/refuse/inconclusive)');
}

main();

// Reference the imported types so `--noUnusedLocals` (if enabled) stays quiet; they document the shapes above.
export type { RequiredPair };
