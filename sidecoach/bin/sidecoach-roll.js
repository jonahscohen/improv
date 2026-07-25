#!/usr/bin/env node

/**
 * Sidecoach Roll (Stage 2c) - the outside-ranking direction roll.
 *
 * Draws ONE design direction from OUTSIDE the model's own top-ranked concept, so a build starts somewhere the
 * model would not have gone unprompted. A re-roll excludes the prior draws and never redraws a used id, and
 * never returns the model-top. The mechanism, the curated deck, and the three structural invariants live in
 * src/direction-deck.ts; this file is the thin CLI over it. If you find yourself adding roll logic here, it
 * belongs in the deck module, not in this file.
 *
 * RANKED LAST: the "model-top" is the direction ranked last and never drawn. Pass this build's actual instinct
 * with --model-top <id>; absent one, the deck's default-instinct entry is ranked last (that IS the sameness
 * the roll exists to break).
 *
 * DETERMINISM: the draw is a pure function of (--seed, --model-top, --exclude). The same inputs yield a
 * byte-identical result JSON, which is what makes the roll testable and a re-roll reproducible. When --seed is
 * omitted a random seed is generated AND reported (in the JSON and on stderr) so any roll can be reproduced.
 *
 * SCOPE: this command computes a draw and prints it. Presenting rolled directions for a decision is a separate
 * stage; there is no rendering, no network listener, and no page injection here - a draw is data on stdout.
 *
 * OUTPUT
 *   stdout - the roll result JSON, always, on any roll (drawn OR exhausted), so the exit code is never the only
 *            machine signal. The QUERY modes (--help, --list) are the exception: they answer a question without
 *            rolling and never emit a result JSON (see READING THE EXIT CODE below).
 *   stderr - a human-readable one-line summary of the draw (suppress with --quiet).
 *
 * Exit codes (one per outcome class; a nonzero code always means "no direction was drawn"):
 *   0 = drawn         a direction was drawn from outside the model-top; result JSON on stdout
 *   2 = usage / load  bad args, an unknown --model-top or --exclude id, or dist not built - no roll happened
 *   3 = exhausted     the eligible pool was empty (every non-model-top id already excluded); draw is null
 *
 * READING THE EXIT CODE: exit 0 means a direction was drawn ONLY when a result JSON was written to stdout. The
 * query modes exit 0 WITHOUT rolling: --help (text to stderr, empty stdout) and --list (a deck listing to
 * stdout that is NOT a result JSON); the load-failure path exits 2 without a roll and emits no result JSON. A
 * machine consumer must therefore parse stdout as a roll result ONLY when it did not pass a query flag.
 */

const crypto = require('crypto');

const EXIT_DRAWN = 0;
const EXIT_USAGE = 2;
const EXIT_EXHAUSTED = 3;

// Lazy dist load: ONLY the paths that actually need the deck (--list, a roll) load it. So `require`-ing this
// module (the unit test does, to exercise parseArgs) and `--help` do NOT depend on a built dist - the pure CLI
// contract is testable without a build. A missing dist is a fail-loud usage error at the point of use, never a
// silent success.
let deckModule = null;
function loadDeck() {
  if (deckModule) return deckModule;
  try {
    deckModule = require('../dist/direction-deck');
  } catch (err) {
    console.error('sidecoach-roll: failed to load ../dist/direction-deck. Run `npm run build` in sidecoach/ first.');
    console.error(err && err.message ? err.message : String(err));
    process.exit(EXIT_USAGE);
  }
  return deckModule;
}

function usage() {
  console.error('Usage: sidecoach-roll [--seed <uint32>] [--model-top <id>] [--exclude <id[,id...]>] [options]');
  console.error('');
  console.error('  --seed <uint32>    unsigned 32-bit seed [0, 4294967295] for a reproducible draw. Omit for a random (reported) seed.');
  console.error('  --model-top <id>   the deck id ranked LAST (never drawn) - this build\'s own instinct.');
  console.error('                     Absent, the deck default-instinct entry is ranked last.');
  console.error('  --exclude <ids>    comma-separated prior-draw ids to never redraw (repeatable).');
  console.error('');
  console.error('Options:');
  console.error('  --list             enumerate the direction deck and exit (no roll, no result JSON).');
  console.error('  --quiet            suppress the stderr human summary (result JSON still goes to stdout).');
  console.error('  -h, --help         show this help.');
  console.error('');
  console.error('stdout is the roll result JSON (drawn or exhausted). stderr is the human summary.');
  console.error('Exit: 0 drawn, 2 usage/load, 3 exhausted (no direction left to draw).');
}

/**
 * Parse argv into a normalized options object. EXPORTED and unit-tested: arg handling is the CLI's contract
 * and must be provable without spawning the process. Never mutates process state except on --help/-h and on a
 * usage error (both of which exit), matching the sibling bins.
 */
function parseArgs(argv) {
  const args = { seed: null, modelTop: null, exclude: [], list: false, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') { usage(); process.exit(EXIT_DRAWN); }
    else if (a === '--list') args.list = true;
    else if (a === '--quiet') args.quiet = true;
    else if (a === '--seed') {
      const value = argv[++i];
      if (value === undefined) {
        console.error('sidecoach-roll: --seed needs an unsigned 32-bit integer value');
        usage();
        process.exit(EXIT_USAGE);
      }
      // Contract: an unsigned 32-bit seed in [0, 4294967295]. Out-of-range (incl. negative) fails LOUD rather
      // than being silently coerced, so the echoed seed always round-trips as a re-runnable value. A negative
      // token (e.g. "-1") is parsed and rejected HERE, not swallowed as a missing value.
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
        console.error(`sidecoach-roll: --seed must be an unsigned 32-bit integer in [0, 4294967295], got "${value}"`);
        usage();
        process.exit(EXIT_USAGE);
      }
      args.seed = n;
    } else if (a === '--model-top') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('-')) {
        console.error('sidecoach-roll: --model-top needs a deck id value');
        usage();
        process.exit(EXIT_USAGE);
      }
      args.modelTop = value;
    } else if (a === '--exclude') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('-')) {
        console.error('sidecoach-roll: --exclude needs a comma-separated id value');
        usage();
        process.exit(EXIT_USAGE);
      }
      for (const id of value.split(',').map((s) => s.trim()).filter(Boolean)) args.exclude.push(id);
    } else if (a.startsWith('-')) {
      console.error(`sidecoach-roll: unknown option "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    } else {
      console.error(`sidecoach-roll: unexpected argument "${a}"`);
      usage();
      process.exit(EXIT_USAGE);
    }
  }
  return args;
}

function printDeckListing(deck) {
  const lines = [];
  lines.push(`sidecoach direction deck: ${deck.DIRECTION_DECK.length} directions (default-instinct ranked last: ${deck.MODEL_DEFAULT_ID})`);
  for (const d of deck.DIRECTION_DECK) {
    const mark = d.id === deck.MODEL_DEFAULT_ID ? '  [default-instinct]' : '';
    lines.push(`  ${d.id.padEnd(22)} ${d.axis.padEnd(10)} ${d.name}${mark}`);
  }
  process.stdout.write(lines.join('\n') + '\n');
}

function printSummary(outcome, seedSource) {
  if (outcome.status === 'exhausted') {
    console.error(
      `sidecoach-roll: EXHAUSTED - no direction left to draw (${outcome.excluded.length} excluded, model-top ${outcome.modelTopId}). No draw.`,
    );
    return;
  }
  const d = outcome.draw;
  console.error(
    `sidecoach-roll: drew "${d.name}" (${d.id}, axis ${d.axis}) from ${outcome.eligibleCount} eligible ` +
      `[outside model-top ${outcome.modelTopId}] - seed ${outcome.seed} (${seedSource}), ${outcome.remaining} re-roll(s) left.`,
  );
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const deck = loadDeck();

  if (args.list) {
    printDeckListing(deck);
    process.exit(EXIT_DRAWN);
  }

  // Seed: an explicit --seed is reproducible; absent one, generate over the full unsigned 32-bit space AND
  // report it (in the JSON and on stderr) so an unseeded roll is still reproducible from its reported seed.
  let seed;
  let seedSource;
  if (args.seed === null) {
    seed = crypto.randomInt(0, 0x100000000);
    seedSource = 'generated';
  } else {
    seed = args.seed;
    seedSource = 'provided';
  }

  // Resolve the model-top (ranked last). An unknown explicit id is a usage error - fail loud, never rank nothing.
  let modelTopId;
  try {
    modelTopId = deck.resolveModelTopId(args.modelTop);
  } catch (err) {
    console.error(`sidecoach-roll: ${err && err.message ? err.message : String(err)}`);
    usage();
    process.exit(EXIT_USAGE);
  }

  // Validate every --exclude id against the deck. A typo would silently no-op the exclusion, so fail loud.
  const unknown = deck.unknownIds(args.exclude);
  if (unknown.length > 0) {
    console.error(`sidecoach-roll: unknown --exclude id(s): ${unknown.join(', ')} (not in the direction deck)`);
    usage();
    process.exit(EXIT_USAGE);
  }

  const outcome = deck.roll({ seed, modelTopId, exclude: args.exclude });

  // The result JSON: a pure function of the inputs (no timestamps), so a fixed seed is byte-reproducible.
  const result = {
    status: outcome.status,
    seed: outcome.seed,
    seedSource,
    modelTop: outcome.modelTopId,
    excluded: outcome.excluded,
    eligibleIds: outcome.eligibleIds,
    eligibleCount: outcome.eligibleCount,
    remaining: outcome.remaining,
    draw: outcome.draw,
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (!args.quiet) printSummary(outcome, seedSource);
  process.exit(outcome.status === 'drawn' ? EXIT_DRAWN : EXIT_EXHAUSTED);
}

// Exported for the unit test: parseArgs + the exit constants are the load-bearing CLI contract and are tested
// without spawning the process. Requiring this module must NOT run the CLI.
module.exports = { parseArgs, EXIT_DRAWN, EXIT_USAGE, EXIT_EXHAUSTED };

if (require.main === module) {
  try {
    main();
  } catch (err) {
    // main() exits on every known outcome; a throw reaching here is an unexpected failure. It is NOT a draw -
    // exit usage (2), never a clean 0, and emit no result JSON so nothing is mistaken for a certified draw.
    console.error('sidecoach-roll: roll failed before a draw could be produced');
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(EXIT_USAGE);
  }
}
