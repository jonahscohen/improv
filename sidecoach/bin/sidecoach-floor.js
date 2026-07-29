#!/usr/bin/env node

/**
 * sidecoach-floor - print the CRAFT FLOOR.
 *
 * The floor is craft instruction that must reach a producer BEFORE a UI edit, regardless of which
 * sidecoach verb was invoked - including none at all. The per-verb craft brief (see
 * src/craft-corpus.ts) is selected by what actually failed on a project and therefore only arrives if
 * a verb was chosen, and chosen correctly. This surface exists so guidance cannot be routed around.
 *
 * It is called by the PreToolUse hook `claude/hooks/sidecoach-craft-floor.sh` on every Write/Edit of a
 * UI file, so it MUST be fast and MUST NOT touch the project: no walk, no validators, no network. It
 * assembles static text from the note corpus and exits.
 *
 *   sidecoach-floor                      compact floor (the hook form)
 *   sidecoach-floor --full               Good/Why/Do/Source per note
 *   sidecoach-floor --file <path>        name the file in the header
 *   sidecoach-floor --no-refusals        drop the refusal list
 *   sidecoach-floor --limit <n>          first n notes only
 *   sidecoach-floor --check              verify every floor key resolves; exit 1 if not
 *   sidecoach-floor --json               {text, notes, gaps} for a programmatic caller
 *
 * Exit codes:
 *   0 = printed (or --check passed)
 *   1 = --check found a floor key with no craft note (a silent drift; the floor would be short)
 *   2 = the compiled dist/ is missing - run `npm run build` in sidecoach/
 */

'use strict';

let craftFloorText;
let floorCoverageGaps;
let floorNotes;
let isUiPath;
try {
  ({ craftFloorText, floorCoverageGaps, floorNotes, isUiPath } = require('../dist/craft-floor'));
} catch (e) {
  process.stderr.write(
    'sidecoach-floor: compiled dist/craft-floor.js is missing - run `npm run build` in sidecoach/.\n' +
    `  (${e && e.message ? e.message : String(e)})\n`);
  process.exit(2);
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function has(name) {
  return process.argv.includes(name);
}

const gaps = floorCoverageGaps();

if (has('--check')) {
  if (gaps.length) {
    process.stderr.write(`sidecoach-floor: ${gaps.length} floor key(s) resolve no craft note: ${gaps.join(', ')}\n`);
    process.exit(1);
  }
  process.stdout.write(`sidecoach-floor: OK - ${floorNotes().length} floor notes all resolve.\n`);
  process.exit(0);
}

const filePath = arg('--file');

// A named file that is NOT UI work exits quietly with no output. The hook relies on this: it can pass
// whatever path the tool call carried and let this decide, so the UI-detection rule lives in ONE place
// (src/craft-floor.ts) rather than being duplicated in shell.
if (filePath && !isUiPath(filePath)) process.exit(0);

const limitRaw = arg('--limit');
const opts = {
  form: has('--full') ? 'full' : 'compact',
  refusals: !has('--no-refusals'),
  filePath,
};
if (limitRaw !== undefined) {
  const n = parseInt(limitRaw, 10);
  if (Number.isFinite(n) && n >= 0) opts.limit = n;
}

const text = craftFloorText(opts);

if (has('--json')) {
  process.stdout.write(JSON.stringify({
    text,
    notes: floorNotes().map((n) => ({ ruleKey: n.ruleKey, title: n.title, source: n.source })),
    gaps,
  }, null, 2) + '\n');
  process.exit(0);
}

process.stdout.write(text + '\n');
// A gap does not suppress the floor - a short floor still beats no floor - but it is announced on
// stderr so it is diagnosable rather than silently reducing what loads.
if (gaps.length) {
  process.stderr.write(`sidecoach-floor: WARNING ${gaps.length} floor key(s) resolve no note: ${gaps.join(', ')}\n`);
}
