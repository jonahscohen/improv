#!/usr/bin/env node

/**
 * Sidecoach Palette - deterministic palette CONSTRUCTION with a fail-closed WCAG gate.
 *
 * From a brand's OKLCH anchors (a --brand fixture: base + primary hue/chroma, optional semantic
 * overrides), construct a structured palette - a neutral base ramp, a primary accent ramp, and four
 * semantic-role ramps - and emit DESIGN.md token frontmatter (@google/design.md shape) whose components and
 * body reference tokens via `{token.path}`, never hard-coded hex.
 *
 * THE CONTRAST CHECK IS NOT IN THIS FILE. Every required text/background pair is WCAG-checked by the SHIPPING
 * rendered scanner (`scanObjectiveRendered` in dist/validators/objective-rendered-scanner.js) - the exact
 * same engine `/sidecoach audit` and the detect CLI use. This file builds the swatch page, hands it to the
 * scanner, and reads back the scanner's `low-contrast` findings. There is one contrast implementation in the
 * product and it is the scanner's; the recipe never re-derives a ratio.
 *
 * FAIL-CLOSED (the load-bearing property):
 *   - If any required pair renders below AA (4.5:1 normal, 3:1 large text), the command names the FAILING
 *     pair and refuses to emit a palette. Nonzero exit. It never emits a palette that silently fails contrast.
 *   - If the scanner did not RUN (browser launch/render error), that is `inconclusive`, never `clean`: the
 *     command emits no palette and exits 3. A check that did not happen is not a passing check.
 *
 * OUTPUT
 *   stdout - the emitted DESIGN.md, and ONLY on a clean pass (exit 0). On any non-clean outcome stdout is
 *            empty, so a consumer can `> DESIGN.md` and trust that a written file passed the gate.
 *   stderr - the human-readable pair-by-pair report (suppress with --quiet).
 *
 * Exit codes (one per outcome class; nonzero always means "no certified palette was emitted"):
 *   0 = clean         every required pair passed; DESIGN.md written to stdout
 *   1 = findings      at least one required pair failed contrast; failing pair(s) named on stderr
 *   2 = usage / IO / load error - the recipe never started (bad args, unreadable/invalid brand, no dist)
 *   3 = inconclusive  the contrast scanner did not run; NEVER emitted as clean
 */

const fs = require('fs');
const path = require('path');

const EXIT_CLEAN = 0;
const EXIT_FINDINGS = 1;
const EXIT_USAGE = 2;
const EXIT_INCONCLUSIVE = 3;

let recipe;
let scanObjectiveRendered;
try {
  recipe = require('../dist/palette-recipe');
  ({ scanObjectiveRendered } = require('../dist/validators/objective-rendered-scanner'));
} catch (err) {
  console.error('sidecoach-palette: failed to load ../dist. Run `npm run build` in sidecoach/ first.');
  console.error(err && err.message ? err.message : String(err));
  process.exit(EXIT_USAGE);
}

function usage() {
  console.error('Usage: sidecoach-palette --brand <brand.json> [options]');
  console.error('');
  console.error('  --brand <file>   a brand-input JSON (name + base/primary OKLCH anchors; optional');
  console.error('                   success/warning/danger/info overrides and fonts)');
  console.error('');
  console.error('Options:');
  console.error('  --quiet          suppress the stderr pair-by-pair report (DESIGN.md still goes to stdout)');
  console.error('  -h, --help       show this help');
  console.error('');
  console.error('stdout is the emitted DESIGN.md, and ONLY on a clean pass. stderr is the human report.');
  console.error('');
  console.error('Exit: 0 clean, 1 a required pair failed contrast, 2 usage/IO error, 3 inconclusive (scan did not run).');
  console.error('The palette is emitted ONLY when every required WCAG pair passes - never a silently-failing palette.');
}

function parseArgs(argv) {
  const args = { brand: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(EXIT_CLEAN); }
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--brand') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        console.error('sidecoach-palette: --brand needs a file path value');
        usage();
        process.exit(EXIT_USAGE);
      }
      args.brand = value;
    } else if (a.startsWith('-')) {
      console.error(`sidecoach-palette: unknown option "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    } else if (args.brand === null) {
      args.brand = a; // positional brand path
    } else {
      console.error(`sidecoach-palette: unexpected extra argument "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    }
  }
  return args;
}

/**
 * Map a scan outcome + resolved verdict to an exit class. EXPORTED and unit-tested directly: this is the
 * fail-closed decision, and it must be provable without launching a browser.
 *   - scan did not run (available === false) -> inconclusive (3), never clean.
 *   - one or more required pairs failed        -> findings (1).
 *   - otherwise                                -> clean (0).
 */
function classify(scanAvailable, verdict) {
  if (!scanAvailable) return { verdict: 'inconclusive', exit: EXIT_INCONCLUSIVE };
  if (verdict.failures.length > 0) return { verdict: 'blocked', exit: EXIT_FINDINGS };
  return { verdict: 'clean', exit: EXIT_CLEAN };
}

function printReport(brandName, outcome, verdict, reason) {
  const lines = [];
  lines.push(`sidecoach-palette: ${brandName}`);
  if (outcome.verdict === 'inconclusive') {
    lines.push(`  scanner did not run: ${reason || 'unknown'}`);
    lines.push('  INCONCLUSIVE: the contrast check did not happen, so no palette was emitted. This is NOT clean.');
    console.error(lines.join('\n'));
    return;
  }
  lines.push(`  required pairs: ${verdict.passCount}/${verdict.totalRequired} passed (checked via objective-rendered-scanner low-contrast rule)`);
  for (const f of verdict.failures) {
    lines.push(`  [FAIL] ${f.name} (${f.id}): ${f.detail}`);
  }
  for (const fam of recipe.ACCENT_FAMILIES) {
    const choice = verdict.onColor[fam];
    if (choice) lines.push(`  on-${fam} label: ${choice === 'ink' ? 'dark (text-primary)' : 'light (text-inverse)'} text verified on solid`);
  }
  if (outcome.verdict === 'blocked') {
    lines.push(`  verdict: BLOCKED - ${verdict.failures.length} required pair(s) failed WCAG. No palette emitted.`);
  } else {
    lines.push('  verdict: CLEAN - all required pairs pass. DESIGN.md written to stdout.');
  }
  console.error(lines.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.brand) { console.error('sidecoach-palette: --brand <file> is required'); usage(); process.exit(EXIT_USAGE); }

  // ---- load + validate the brand input (IO/usage failures happen BEFORE any scan) ----
  const abs = path.resolve(args.brand);
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    console.error(`sidecoach-palette: cannot read brand file: ${abs}`);
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }
  let brand;
  try {
    brand = recipe.parseBrandInput(JSON.parse(raw));
  } catch (err) {
    console.error(`sidecoach-palette: invalid brand input in ${abs}`);
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }

  // ---- construct the palette + the swatch page (pure) ----
  const palette = recipe.buildPalette(brand);
  const pairs = recipe.requiredPairs(palette);
  const html = recipe.buildSwatchHtml(pairs);

  // ---- the WCAG gate: the SHIPPING scanner renders the swatches and reports low-contrast pairs ----
  const scan = await scanObjectiveRendered(html);
  if (!scan.available) {
    // Fail-closed: the check did not run. Inconclusive, never clean. No palette on stdout.
    const outcome = classify(false, null);
    if (!args.quiet) printReport(brand.name, outcome, null, scan.reason);
    process.exit(outcome.exit);
  }

  const verdict = recipe.resolveVerdict(pairs, scan.findings);
  const outcome = classify(true, verdict);

  if (outcome.exit === EXIT_CLEAN) {
    // Only now, with every required pair verified, do we emit the palette.
    process.stdout.write(recipe.emitDesignMd(palette, verdict) + '\n');
  }
  if (!args.quiet) printReport(brand.name, outcome, verdict, undefined);
  process.exit(outcome.exit);
}

// Exported for the unit test: the fail-closed classifier + exit constants are the load-bearing logic and are
// tested without a browser. Requiring this module must NOT run the CLI.
module.exports = { classify, parseArgs, EXIT_CLEAN, EXIT_FINDINGS, EXIT_USAGE, EXIT_INCONCLUSIVE };

if (require.main === module) {
  main().catch((err) => {
    // A throw that reaches here escaped the scan (parse/build/IO failures exit earlier from main). The honest
    // class for an interrupted scan is inconclusive - never a clean exit 0, never a silent palette.
    console.error('sidecoach-palette: recipe failed before a verdict could be reached');
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(EXIT_INCONCLUSIVE);
  });
}
