#!/usr/bin/env node

/**
 * Sidecoach Deck (Stage 2d) - the exclusion-safe direction presentation.
 *
 * Presents a set of rolled directions (from the Stage 2c roll) for a DECISION, surface-aware:
 *   --surface text  -> a clean Markdown deck (a table + a short detail block per direction) on stdout
 *   --surface rich  -> a self-contained static HTML visualizer artifact, to --out or stdout
 * The user picks by RESPONDING (a number or an id). A re-roll is a re-invocation of `sidecoach-roll`; this
 * command never rolls, never edits, and never previews a variant. The rendering lives in
 * src/direction-deck-present.ts, which imports the Stage 2c deck; this file is the thin CLI over it.
 *
 * HARD EXCLUSION: there is NO in-browser variant surface in this track. The rich rendering is static HTML
 * only - no network server, no client runtime, no embedded preview frame, no variant-preview code path. This
 * bin emits text; it never serves or opens anything.
 *
 * INPUT
 *   --ids <id[,id...]>   the directions to present (the rolled decision set). Repeatable.
 *   (stdin)              when --ids is absent, one-or-more Stage 2c roll-result JSON objects (a stream or a
 *                        JSON array) are read and their `.draw.id` collected - so `sidecoach-roll ... | sidecoach-deck`
 *                        composes. Unknown/duplicate ids fail loud.
 *
 * OUTPUT
 *   stdout - the Markdown deck (text) or the artifact HTML (rich, when --out is absent).
 *   --out  - writes the artifact HTML to a file (rich only); stdout then carries nothing.
 *   stderr - a one-line human summary (suppress with --quiet).
 *
 * Exit codes (one per outcome class):
 *   0 = presented   a deck of one-or-more directions was emitted
 *   2 = usage / load error - nothing was presented (bad args, unknown/duplicate id, no ids, no dist)
 */

const fs = require('fs');
const path = require('path');

const EXIT_OK = 0;
const EXIT_USAGE = 2;

const SURFACES = ['text', 'rich'];

// Lazy dist load: only a real presentation needs the deck modules, so require-ing this file (the unit test
// does, for parseArgs) and --help do NOT depend on a built dist. A missing dist is a fail-loud usage error at
// the point of use, never a silent success.
let present = null;
function loadPresent() {
  if (present) return present;
  try {
    present = require('../dist/direction-deck-present');
  } catch (err) {
    console.error('sidecoach-deck: failed to load ../dist/direction-deck-present. Run `npm run build` in sidecoach/ first.');
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }
  return present;
}

function usage() {
  console.error('Usage: sidecoach-deck --ids <id[,id...]> [--surface text|rich] [options]');
  console.error('       sidecoach-roll ... | sidecoach-deck [--surface text|rich]');
  console.error('');
  console.error('  --ids <ids>       comma-separated direction ids to present (repeatable). Absent, roll-result');
  console.error('                    JSON is read from stdin and its draws collected.');
  console.error('  --surface <s>     text (Markdown, default) or rich (static HTML artifact).');
  console.error('');
  console.error('Options:');
  console.error('  --title <str>     deck heading (default "Direction options").');
  console.error('  --out <file>      write the rich artifact HTML to a file instead of stdout (rich only).');
  console.error('  --quiet           suppress the stderr summary.');
  console.error('  -h, --help        show this help.');
  console.error('');
  console.error('Exit: 0 presented, 2 usage/load error. The user picks by responding; re-roll re-invokes sidecoach-roll.');
}

/**
 * Parse argv into a normalized options object. EXPORTED and unit-tested: arg handling is the CLI's contract
 * and must be provable without a built dist. Never mutates process state except on --help/-h and on a usage
 * error (both of which exit), matching the sibling bins.
 */
function parseArgs(argv) {
  const args = { ids: [], surface: 'text', title: null, out: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(EXIT_OK); }
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--ids') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('-')) {
        console.error('sidecoach-deck: --ids needs a comma-separated id value');
        usage();
        process.exit(EXIT_USAGE);
      }
      for (const id of value.split(',').map((s) => s.trim()).filter(Boolean)) args.ids.push(id);
    } else if (a === '--surface') {
      const value = argv[++i];
      if (value === undefined || !SURFACES.includes(value)) {
        console.error(`sidecoach-deck: --surface must be one of ${SURFACES.join(', ')}, got ${value === undefined ? '(missing)' : JSON.stringify(value)}`);
        usage();
        process.exit(EXIT_USAGE);
      }
      args.surface = value;
    } else if (a === '--title') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('-')) {
        console.error('sidecoach-deck: --title needs a value');
        usage();
        process.exit(EXIT_USAGE);
      }
      args.title = value;
    } else if (a === '--out') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('-')) {
        console.error('sidecoach-deck: --out needs a file path value');
        usage();
        process.exit(EXIT_USAGE);
      }
      args.out = value;
    } else if (a.startsWith('-')) {
      console.error(`sidecoach-deck: unknown option "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    } else {
      console.error(`sidecoach-deck: unexpected argument "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    }
  }
  return args;
}

// Read stdin fully (used only when --ids is absent). Returns '' when nothing is piped. On an INTERACTIVE
// terminal there is no piped input, so reading fd 0 would BLOCK forever waiting for EOF - guard on isTTY so a
// bare `sidecoach-deck` in a terminal falls straight through to the usage error instead of hanging.
function readStdin() {
  if (process.stdin.isTTY) return '';
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_err) {
    return '';
  }
}

/**
 * Collect draw ids from piped Stage 2c roll-result JSON. Accepts a JSON array of results OR a stream of
 * newline-delimited JSON objects. A drawn result carries `.draw.id`; an exhausted result (`draw: null`) is
 * legitimately empty and contributes nothing. EXPORTED for the test.
 *
 * FAIL-LOUD (no silent drop): a decision surface must present EXACTLY the rolled set. A non-blank line that is
 * not valid JSON, or a value that is not a roll-result shape (an object with a `draw` key), is recorded in
 * `malformed` so the CLI can refuse rather than silently present a partial deck. Only truly blank lines are
 * skipped. Returns `{ ids, malformed }`.
 */
function idsFromRollJson(text) {
  const ids = [];
  const malformed = [];
  const consume = (obj, label) => {
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && 'draw' in obj) {
      // A roll-result shape. A drawn result yields its id; an exhausted result (draw null) yields nothing.
      if (obj.draw && typeof obj.draw.id === 'string') ids.push(obj.draw.id);
      return;
    }
    malformed.push(label);
  };
  const trimmed = (text || '').trim();
  if (!trimmed) return { ids, malformed };
  // Whole-payload parse first (a single object or an array of results); fall back to line-by-line NDJSON.
  let whole;
  let wholeParsed = true;
  try { whole = JSON.parse(trimmed); } catch (_err) { wholeParsed = false; }
  if (wholeParsed) {
    if (Array.isArray(whole)) whole.forEach((o, i) => consume(o, `entry[${i}]`));
    else consume(whole, 'stdin payload');
    return { ids, malformed };
  }
  for (const line of trimmed.split('\n')) {
    const l = line.trim();
    if (!l) continue; // blank lines only
    let obj;
    try { obj = JSON.parse(l); } catch (_e2) { malformed.push(l.length > 40 ? l.slice(0, 40) + '...' : l); continue; }
    consume(obj, l.length > 40 ? l.slice(0, 40) + '...' : l);
  }
  return { ids, malformed };
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  // --out writes the rich HTML artifact to a file; on the text surface it has no meaning. Reject it loudly
  // rather than silently ignoring it (the deck goes to stdout on the text surface).
  if (args.out && args.surface !== 'rich') {
    console.error('sidecoach-deck: --out is only valid with --surface rich (the text deck is written to stdout).');
    usage();
    process.exit(EXIT_USAGE);
  }

  const mod = loadPresent();

  // Resolve the id list: --ids wins; otherwise read roll-result JSON from stdin.
  let ids = args.ids;
  let source = '--ids';
  if (ids.length === 0) {
    const fromStdin = idsFromRollJson(readStdin());
    // Fail loud on malformed piped input rather than presenting a partial decision set.
    if (fromStdin.malformed.length > 0) {
      console.error(`sidecoach-deck: malformed roll-result input on stdin: ${fromStdin.malformed.join(', ')} (expected Stage 2c roll JSON with a .draw.id)`);
      usage();
      process.exit(EXIT_USAGE);
    }
    ids = fromStdin.ids;
    source = 'stdin roll-result JSON';
  }
  if (ids.length === 0) {
    console.error('sidecoach-deck: no directions to present. Pass --ids <id,...> or pipe sidecoach-roll output.');
    usage();
    process.exit(EXIT_USAGE);
  }

  // Fail loud on an unknown or duplicated id - a decision surface must present exactly the rolled set.
  const resolved = mod.resolveDirections(ids);
  if (resolved.unknown.length > 0) {
    console.error(`sidecoach-deck: unknown direction id(s): ${resolved.unknown.join(', ')} (not in the Stage 2c deck)`);
    usage();
    process.exit(EXIT_USAGE);
  }
  if (resolved.duplicates.length > 0) {
    console.error(`sidecoach-deck: duplicate direction id(s): ${resolved.duplicates.join(', ')} (each option must be distinct)`);
    usage();
    process.exit(EXIT_USAGE);
  }

  const opts = args.title ? { title: args.title } : {};

  // Resolve the payload. A --out rich artifact goes to a file (synchronous, no flush race); everything else is
  // a stdout payload that must be flushed before exit.
  let stdoutPayload = null;
  if (args.surface === 'rich') {
    const html = mod.renderDeckArtifactHtml(resolved.directions, opts);
    if (args.out) {
      try {
        fs.writeFileSync(path.resolve(args.out), html, 'utf8');
      } catch (err) {
        console.error(`sidecoach-deck: cannot write artifact to ${args.out}`);
        console.error(err && err.message ? err.message : String(err));
        process.exit(EXIT_USAGE);
      }
    } else {
      stdoutPayload = html + '\n';
    }
  } else {
    stdoutPayload = mod.renderDeckMarkdown(resolved.directions, opts) + '\n';
  }

  if (!args.quiet) {
    const where = args.surface === 'rich' && args.out ? ` -> ${args.out}` : '';
    console.error(`sidecoach-deck: presented ${resolved.directions.length} direction(s) on the ${args.surface} surface${where} (ids from ${source}).`);
  }
  // Flush the (possibly large) artifact/deck before exiting. process.stdout is ASYNC over a pipe, so a bare
  // process.exit() would truncate a big deck's HTML; the write callback fires once it has flushed.
  if (stdoutPayload !== null) process.stdout.write(stdoutPayload, () => process.exit(EXIT_OK));
  else process.exit(EXIT_OK);
}

// Exported for the unit test: parseArgs, idsFromRollJson, and the exit constants are the load-bearing CLI
// contract and are tested without a built dist. Requiring this module must NOT run the CLI.
module.exports = { parseArgs, idsFromRollJson, EXIT_OK, EXIT_USAGE };

if (require.main === module) {
  try {
    main();
  } catch (err) {
    // main() exits on every known outcome; a throw reaching here is an unexpected failure. Nothing was
    // presented - exit usage (2), never a clean 0, and emit nothing that could be mistaken for a deck.
    console.error('sidecoach-deck: presentation failed before a deck could be emitted');
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(EXIT_USAGE);
  }
}
