#!/usr/bin/env node

/**
 * Sidecoach Pre-Authorship (Stage 2b) - author, render, THEN build (contract-then-verify).
 *
 * Given a --brief, this AUTHORS two artifacts and RENDERS both headless through the SHIPPING engine before a
 * full build proceeds:
 *   1. a design-system BOARD (tokens + type scale + component inventory), and
 *   2. a first-surface MOCK (the brief's opening screen).
 * Each is written to --out-dir, rendered over its own file:// URL, and audited by the exact same
 * runRenderedAudit the `/sidecoach audit` command uses. There is no detection logic here: the construction is
 * in src/pre-authorship.ts and the scanning is the audit's. If you find yourself adding a rule here, it belongs
 * in a scanner, not in this file.
 *
 * THE GATE (fail-closed, decidePreauthorGate):
 *   - Either artifact did not render (inconclusive) -> HALT. A scan that did not run is NOT a pass. Exit 3.
 *   - The mock has blocking findings (blocked)      -> HALT. Exit 1. (the "deliberately-broken mock" path)
 *   - The mock rendered clean or warnings-only       -> PROCEED. Exit 0. Board findings are reported, not gated.
 *   A well-formed mock is NEVER inconclusive - both lenses render an authored, self-contained page - so an
 *   inconclusive here is a real render failure and correctly halts instead of fabricating a clean.
 *
 * OUTPUT
 *   stdout - the result JSON, always, on any completed render (proceed OR halt), so the exit code is never the
 *            only machine signal. The QUERY mode (--help) is the exception: it answers without rendering and
 *            emits no result JSON.
 *   stderr - a human-readable summary (suppress with --quiet).
 *
 * Exit codes (one per outcome class; a nonzero code always means "the build must NOT proceed"):
 *   0 = proceed       both artifacts rendered; the mock cleared blockers with a real verdict
 *   1 = blocked       the mock has blocking findings; build halts
 *   2 = usage / IO / load error - the step never started (bad args, unreadable/invalid brief, no dist)
 *   3 = inconclusive  an artifact did not render; NEVER a proceed
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const EXIT_PROCEED = 0;
const EXIT_BLOCKED = 1;
const EXIT_USAGE = 2;
const EXIT_INCONCLUSIVE = 3;

// Lazy dist load: only the render path needs dist, so require-ing this module (the unit test does, for
// parseArgs) and --help do NOT depend on a built dist. A missing dist is a fail-loud usage error at the point
// of use, never a silent success.
let mod = null;
function loadModules() {
  if (mod) return mod;
  try {
    const preauthor = require('../dist/pre-authorship');
    const { runRenderedAudit } = require('../dist/audit-rendered');
    mod = { preauthor, runRenderedAudit };
  } catch (err) {
    console.error('sidecoach-preauthor: failed to load ../dist. Run `npm run build` in sidecoach/ first.');
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }
  return mod;
}

function usage() {
  console.error('Usage: sidecoach-preauthor --brief <brief.json> [--out-dir <dir>] [options]');
  console.error('');
  console.error('  --brief <file>    a brief JSON (name + surface + palette + type; optional components list)');
  console.error('  --out-dir <dir>   where board.html + mock.html are written (default: a fresh temp dir)');
  console.error('');
  console.error('Options:');
  console.error('  --quiet           suppress the stderr summary (result JSON still goes to stdout)');
  console.error('  -h, --help        show this help');
  console.error('');
  console.error('stdout is the result JSON on any completed render. stderr is the human summary.');
  console.error('');
  console.error('Exit: 0 proceed, 1 the mock is blocked, 2 usage/IO error, 3 inconclusive (an artifact did not render).');
  console.error('The build proceeds ONLY when both artifacts render and the mock clears blockers - never on an inconclusive.');
}

/**
 * Parse argv into a normalized options object. EXPORTED and unit-tested: arg handling is the CLI's contract
 * and must be provable without rendering. Never mutates process state except on --help/-h and on a usage
 * error (both of which exit), matching the sibling bins.
 */
function parseArgs(argv) {
  const args = { brief: null, outDir: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(EXIT_PROCEED); }
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--brief') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        console.error('sidecoach-preauthor: --brief needs a file path value');
        usage();
        process.exit(EXIT_USAGE);
      }
      args.brief = value;
    } else if (a === '--out-dir') {
      const value = argv[++i];
      if (!value || value.startsWith('-')) {
        console.error('sidecoach-preauthor: --out-dir needs a directory path value');
        usage();
        process.exit(EXIT_USAGE);
      }
      args.outDir = value;
    } else if (a.startsWith('-')) {
      console.error(`sidecoach-preauthor: unknown option "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    } else if (args.brief === null) {
      args.brief = a; // positional brief path
    } else {
      console.error(`sidecoach-preauthor: unexpected extra argument "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    }
  }
  return args;
}

// A compact audit summary for the result JSON - the verdict, the counts, and the per-rule findings.
function auditSummary(audit) {
  return {
    renderUrl: audit.renderUrl,
    verdict: audit.verdict,
    rendered: audit.rendered,
    severityCounts: audit.severityCounts,
    findings: audit.findings.map((f) => ({ rule: f.rule, lens: f.lens, severity: f.severity, selector: f.selector, detail: f.detail })),
    unavailableReasons: audit.unavailableReasons,
  };
}

function printReport(result) {
  const lines = [];
  lines.push(`sidecoach-preauthor: ${result.brief}`);
  lines.push(`  board: ${result.board.path} -> ${result.board.verdict}`);
  lines.push(`  mock:  ${result.mock.path} -> ${result.mock.verdict}`);
  for (const artifact of ['board', 'mock']) {
    for (const f of result[artifact].findings) {
      lines.push(`  [${f.severity}] ${artifact}/${f.lens}/${f.rule}${f.selector ? ` @ ${f.selector}` : ''}${f.detail ? ` - ${f.detail}` : ''}`);
    }
  }
  lines.push(`  gate: ${result.decision.toUpperCase()} - ${result.reason}`);
  if (result.decision !== 'proceed') {
    lines.push('  The build must NOT proceed from this pre-authorship step.');
  }
  console.error(lines.join('\n'));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.brief) { console.error('sidecoach-preauthor: --brief <file> is required'); usage(); process.exit(EXIT_USAGE); }

  const { preauthor, runRenderedAudit } = loadModules();

  // ---- load + validate the brief (IO/usage failures happen BEFORE any render) ----
  const abs = path.resolve(args.brief);
  let raw;
  try {
    raw = fs.readFileSync(abs, 'utf8');
  } catch (err) {
    console.error(`sidecoach-preauthor: cannot read brief file: ${abs}`);
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }
  let brief;
  try {
    brief = preauthor.parseBrief(JSON.parse(raw));
  } catch (err) {
    console.error(`sidecoach-preauthor: invalid brief in ${abs}`);
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }

  // ---- resolve the output directory ----
  let outDir;
  try {
    outDir = args.outDir ? path.resolve(args.outDir) : fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-preauthor-'));
    fs.mkdirSync(outDir, { recursive: true });
  } catch (err) {
    console.error(`sidecoach-preauthor: cannot create output directory`);
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }

  // ---- author both artifacts (pure) and write them ----
  const boardPath = path.join(outDir, 'board.html');
  const mockPath = path.join(outDir, 'mock.html');
  try {
    fs.writeFileSync(boardPath, preauthor.buildBoardHtml(brief), 'utf8');
    fs.writeFileSync(mockPath, preauthor.buildMockHtml(brief), 'utf8');
  } catch (err) {
    console.error(`sidecoach-preauthor: cannot write artifacts to ${outDir}`);
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }

  // ---- render BOTH headless through the shipping audit ----
  const boardAudit = await runRenderedAudit(pathToFileURL(boardPath).href);
  const mockAudit = await runRenderedAudit(pathToFileURL(mockPath).href);

  // ---- the fail-closed gate ----
  const gate = preauthor.decidePreauthorGate(mockAudit, boardAudit);

  const result = {
    brief: abs,
    outDir,
    board: { path: boardPath, ...auditSummary(boardAudit) },
    mock: { path: mockPath, ...auditSummary(mockAudit) },
    decision: gate.decision,
    exit: gate.exit,
    reason: gate.reason,
  };
  if (!args.quiet) printReport(result);
  // Flush the (possibly large) result JSON before exiting. process.stdout is ASYNC over a pipe, so a bare
  // process.exit() truncates an unflushed write - a small clean result survives, a findings-heavy one is cut.
  // The write callback fires once the payload has flushed, so the exit code always lands on a COMPLETE JSON.
  process.stdout.write(JSON.stringify(result, null, 2) + '\n', () => process.exit(gate.exit));
}

// Exported for the unit test: parseArgs + the exit constants are the load-bearing CLI contract and are tested
// without rendering. Requiring this module must NOT run the CLI.
module.exports = { parseArgs, EXIT_PROCEED, EXIT_BLOCKED, EXIT_USAGE, EXIT_INCONCLUSIVE };

if (require.main === module) {
  main().catch((err) => {
    // Parse/build/IO failures exit EXIT_USAGE from inside main. A throw that reaches here escaped a render, so
    // the honest class is inconclusive - the artifacts were not both certified - never a clean proceed.
    console.error('sidecoach-preauthor: pre-authorship failed before a gate decision could be reached');
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(EXIT_INCONCLUSIVE);
  });
}
