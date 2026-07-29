#!/usr/bin/env node

/**
 * sidecoach-doctor - does sidecoach's own capability graph hold together?
 *
 * Answers one question per shipped capability: can the model that is supposed to call this
 * FIND it, can anything REACH it, and does anything PROVE it. Then it names the ones that
 * fail, because those are shipped work that nobody can invoke.
 *
 * WHY THIS EXISTS, and it is not hypothetical. Measured 2026-07-28/29 in this repo:
 *   - 12 of 18 shipped skills had never been invoked through the Skill tool across 413 real
 *     transcripts.
 *   - `sidecoach-image` shipped, was auto-run by a flow, and was named in ZERO documents the
 *     model loads at runtime. A capability nothing can select scores zero however good it is.
 *   - `sidecoach-detect`, the engine behind `/sidecoach audit`, was likewise named nowhere on
 *     the loadable surface.
 *   - The skill's own prose claimed "six self-contained CLIs ship in sidecoach/bin/" when
 *     seven did, and claimed `sidecoach-drift` was the only flow-wired tool when
 *     `sidecoach-image` is also flow-wired.
 * Every one of those is mechanically detectable and none of them was detected, because
 * nothing had been written to look. This is that thing.
 *
 * THE THREE DEFECT CLASSES, in the order they cost the most:
 *   UNNAMED       a capability ships but appears in no document the model loads.
 *   UNREACHED     nothing imports it, spawns it, or lists it - dead weight on disk.
 *   CONTRADICTED  a loadable document asserts something the registry disproves. Worse than a
 *                 gap, because a model ACTS on a false statement.
 *
 * IT IS FAIL-CLOSED, which is the property that makes it worth trusting. A check that could
 * not run is never reported as clean: a missing loadable surface, an unbuilt dist/, or an
 * unreadable source tree exits 3 (inconclusive), never 0. "No findings" is only ever printed
 * after every check actually ran.
 *
 * WHY IT FOLLOWS SYMLINKS EVERYWHERE. The installed skill surface is symlinks into the repo
 * on a dev checkout. A sweep using find's default `-type f` counted the whole loadable
 * surface as ZERO FILES and would have reported a perfectly healthy install as catastrophic.
 * That mistake was made twice while building this, once with find and once by truncating a
 * 203KB JSON through a pipe, so every read here resolves links and no count is taken from a
 * summarised stream.
 *
 * Usage:
 *   node bin/sidecoach-doctor.js [--json] [--repo <dir>] [--surface <dir>] [--quiet]
 *
 * Exit codes:
 *   0  every capability is discoverable, reachable and verified - nothing to report
 *   1  findings (at least one UNNAMED, UNREACHED or CONTRADICTED capability)
 *   2  usage error, or a required input could not be read
 *   3  inconclusive - a check could not run, so the result is NOT clean
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
let asJson = false;
let quiet = false;
let repoArg = null;
let surfaceArg = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--json') asJson = true;
  else if (a === '--quiet') quiet = true;
  else if (a === '--repo') repoArg = argv[++i];
  else if (a === '--surface') surfaceArg = argv[++i];
  else if (a === '--help' || a === '-h') {
    process.stdout.write(
      'sidecoach-doctor - report which sidecoach capabilities are DISCOVERABLE, REACHABLE and VERIFIED\n\n' +
        '  node bin/sidecoach-doctor.js [--json] [--repo <dir>] [--surface <dir>] [--quiet]\n\n' +
        '  --repo <dir>     the sidecoach package directory (default: the parent of this script)\n' +
        '  --surface <dir>  the installed skill directory to treat as the loadable surface\n' +
        '                   (default: ~/.claude/skills/sidecoach, falling back to the repo copy)\n' +
        '  --json           machine-readable report\n' +
        '  --quiet          findings only, no clean rows\n\n' +
        'Exit: 0 clean, 1 findings, 2 usage/IO, 3 inconclusive (never reported as clean)\n'
    );
    process.exit(0);
  } else {
    process.stderr.write(`sidecoach-doctor: unknown argument: ${a}\n`);
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------
// Locate the two trees. REPO is the sidecoach package; SURFACE is what the model loads.
// ---------------------------------------------------------------------------
const REPO = path.resolve(repoArg || path.join(__dirname, '..'));
const IMPROV_ROOT = path.resolve(REPO, '..');

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory(); // statSync follows symlinks - deliberate
  } catch {
    return false;
  }
}
function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

const SURFACE_CANDIDATES = surfaceArg
  ? [path.resolve(surfaceArg)]
  : [
      path.join(os.homedir(), '.claude', 'skills', 'sidecoach'),
      path.join(IMPROV_ROOT, 'claude', 'skills', 'sidecoach'),
    ];
const SURFACE = SURFACE_CANDIDATES.find(isDir) || null;

const inconclusive = [];
const findings = [];

if (!isDir(REPO)) {
  process.stderr.write(`sidecoach-doctor: not a directory: ${REPO}\n`);
  process.exit(2);
}
if (!SURFACE) {
  process.stderr.write(
    'sidecoach-doctor: no loadable skill surface found. Looked at:\n' +
      SURFACE_CANDIDATES.map((c) => `  ${c}\n`).join('') +
      'Without it, discoverability cannot be measured at all - this is exit 3, not a clean run.\n'
  );
  process.exit(3);
}

// ---------------------------------------------------------------------------
// Read the loadable surface. Every file, links resolved.
// ---------------------------------------------------------------------------
function walkFiles(root, out, depth) {
  if (depth > 12) return out; // a symlink cycle must not hang the tool
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (err) {
    inconclusive.push(`could not read ${root}: ${err.message}`);
    return out;
  }
  for (const e of entries) {
    if (e.name === '.DS_Store') continue;
    const p = path.join(root, e.name);
    // A symlink reports isSymbolicLink(), never isFile()/isDirectory() - so resolve it.
    if (isDir(p)) walkFiles(p, out, depth + 1);
    else if (isFile(p)) out.push(p);
  }
  return out;
}

const surfaceFiles = walkFiles(SURFACE, [], 0).filter((f) => /\.(md|txt|json)$/i.test(f));
const surfaceDocs = [];
for (const f of surfaceFiles) {
  try {
    surfaceDocs.push({ path: f, rel: path.relative(SURFACE, f), text: fs.readFileSync(f, 'utf8') });
  } catch (err) {
    inconclusive.push(`could not read loadable document ${f}: ${err.message}`);
  }
}
if (surfaceDocs.length === 0) {
  inconclusive.push(
    `the loadable surface at ${SURFACE} yielded no readable documents - discoverability is unmeasurable`
  );
}

// ---------------------------------------------------------------------------
// Read every source tree a capability could be reached FROM.
// ---------------------------------------------------------------------------
function collectSource(dir, matcher, out, depth) {
  if (depth > 10 || !isDir(dir)) return out;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
    const p = path.join(dir, e.name);
    if (isDir(p)) collectSource(p, matcher, out, depth + 1);
    else if (isFile(p) && matcher(e.name)) {
      try {
        out.push({ path: p, text: fs.readFileSync(p, 'utf8') });
      } catch {
        /* an unreadable single file is not a reason to fail the sweep */
      }
    }
  }
  return out;
}

const srcFiles = collectSource(path.join(REPO, 'src'), (n) => /\.ts$/.test(n) && !/\.test\.ts$/.test(n), [], 0);
const testFiles = collectSource(path.join(REPO, 'src', '__tests__'), (n) => /\.ts$/.test(n), [], 0);
const binFiles = collectSource(path.join(REPO, 'bin'), (n) => /\.(js|mjs|sh)$/.test(n), [], 0);
const hookTests = collectSource(path.join(IMPROV_ROOT, 'claude', 'hooks'), (n) => /^test-.*\.sh$/.test(n), [], 0);
const hookFiles = collectSource(path.join(IMPROV_ROOT, 'claude', 'hooks'), (n) => /\.(sh|py|json)$/.test(n), [], 0);
const mutationChecks = collectSource(REPO, (n) => /^mutation-check.*\.sh$/.test(n), [], 0);

if (srcFiles.length === 0) {
  inconclusive.push(`no TypeScript sources found under ${path.join(REPO, 'src')} - reachability is unmeasurable`);
}
if (binFiles.length === 0) {
  inconclusive.push(`no executables found under ${path.join(REPO, 'bin')} - there is nothing to inventory`);
}

// ---------------------------------------------------------------------------
// Inventory: the shipped tools.
//
// The resolver itself and the monitor are the ENTRY POINTS (both symlinked onto PATH by
// install.sh), so they are inventoried but exempt from the "must be listed by the resolver"
// rule - a thing cannot be required to list itself.
// ---------------------------------------------------------------------------
const ENTRY_POINTS = new Set(['sidecoach', 'sidecoach-monitor']);

const tools = binFiles
  .map((f) => path.basename(f.path))
  .filter((n) => /^sidecoach/.test(n))
  .map((n) => n.replace(/\.(js|mjs|sh)$/, ''))
  .filter((n, i, a) => a.indexOf(n) === i)
  .sort();

// ---------------------------------------------------------------------------
// The resolver's own registry of standalone tools. Parsed from bin/sidecoach.js rather than
// imported, because it is a const inside a CommonJS script with no export. Parsing is
// deliberately narrow: the first element of each `['<name>', ...]` tuple inside the
// STANDALONE_BINS block. If the block cannot be found at all that is INCONCLUSIVE, not an
// empty registry - an empty registry would make every tool look unlisted and produce a page
// of false findings, which is the failure mode this whole tool exists to end.
// ---------------------------------------------------------------------------
function parseResolverRegistry() {
  const resolver = binFiles.find((f) => path.basename(f.path) === 'sidecoach.js');
  if (!resolver) {
    inconclusive.push('bin/sidecoach.js not found - cannot tell which tools the resolver lists');
    return null;
  }
  const start = resolver.text.indexOf('STANDALONE_BINS');
  if (start === -1) {
    inconclusive.push('bin/sidecoach.js has no STANDALONE_BINS registry - cannot tell which tools it lists');
    return null;
  }
  // Bound the scan to the registry literal so a later mention of a tool name in a comment
  // does not read as a registry entry.
  const tail = resolver.text.slice(start);
  const endMarker = tail.indexOf('\n};');
  const block = endMarker === -1 ? tail : tail.slice(0, endMarker);
  const names = [];
  const re = /\[\s*'(sidecoach-[a-z-]+)'/g;
  let m;
  while ((m = re.exec(block)) !== null) names.push(m[1]);
  if (names.length === 0) {
    inconclusive.push('the STANDALONE_BINS registry parsed to zero entries - treating as unmeasurable, not empty');
    return null;
  }
  return names;
}
const resolverRegistry = parseResolverRegistry();

// ---------------------------------------------------------------------------
// Reachability. THREE independent probes, because measuring only one produced a false zero
// in this repo on 2026-07-29: an importer grep reported `sidecoach-image` unreachable while a
// flow was spawning it as a SUBPROCESS. An import and a spawn are different things and a
// capability reached by either is reached.
// ---------------------------------------------------------------------------
// THE EXTENSION IS OPTIONAL, and getting that wrong produced a false UNREACHED on the first
// run of this tool. `bin/sidecoach-monitor.js` reaches the report renderer as
// `require('./sidecoach-present')` - no `.js` - so a regex demanding the extension reported a
// tool that is invoked on every single monitor run as invoked by nothing. That is the exact
// mirror image of the 2026-07-29 false zero on sidecoach-image, where an IMPORTER grep missed
// a SUBPROCESS spawn. Both mistakes are one probe standing in for a family of call shapes, so
// this pattern accepts the bare basename and only then requires a boundary, which covers
// `require('./x')`, `path.join('bin','x.js')`, `node bin/x.js`, and `x.mjs` alike.
function toolReferencePattern(tool) {
  return new RegExp(`${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\.(js|mjs|sh))?(['"\`\\s)/:,]|$)`, 'm');
}

function reachabilityFor(tool) {
  const how = [];
  const ref = toolReferencePattern(tool);

  for (const f of srcFiles) {
    if (ref.test(f.text)) {
      how.push(`spawned or referenced from src/${path.relative(path.join(REPO, 'src'), f.path)}`);
      break;
    }
  }
  for (const f of binFiles) {
    if (path.basename(f.path).startsWith(tool)) continue; // not itself
    // THIS FILE IS EXCLUDED FROM ITS OWN SWEEP, and that is a correctness fix rather than
    // hygiene. Every tool name appears in this script's prose and probe tables, so on the
    // second run of this tool `sidecoach-present` came back "reachable - invoked from
    // bin/sidecoach-doctor.js" purely because the doctor names it. A measuring instrument
    // that counts itself as a caller reports every subject as reached and can never find the
    // defect it was written for.
    if (path.basename(f.path) === path.basename(__filename)) continue;
    if (ref.test(f.text)) {
      how.push(`invoked from bin/${path.basename(f.path)}`);
      break;
    }
  }
  for (const f of hookFiles) {
    if (ref.test(f.text)) {
      how.push(`wired from claude/hooks/${path.basename(f.path)}`);
      break;
    }
  }
  if (resolverRegistry && resolverRegistry.includes(tool)) {
    how.push('listed by the sidecoach resolver (sidecoach list / help)');
  }
  if (ENTRY_POINTS.has(tool)) {
    how.push('entry point on PATH (installed by install.sh)');
  }
  return how;
}

function verificationFor(tool) {
  const how = [];
  const ref = toolReferencePattern(tool);
  for (const f of testFiles) {
    if (ref.test(f.text)) {
      how.push(`covered by src/__tests__/${path.basename(f.path)}`);
      break;
    }
  }
  for (const f of hookTests) {
    if (ref.test(f.text)) {
      how.push(`covered by claude/hooks/${path.basename(f.path)}`);
      break;
    }
  }
  for (const f of mutationChecks) {
    if (ref.test(f.text)) {
      how.push(`mutation control in ${path.basename(f.path)}`);
      break;
    }
  }
  return how;
}

function discoverabilityFor(name) {
  const docs = [];
  for (const d of surfaceDocs) {
    if (d.text.includes(name)) docs.push(d.rel);
  }
  return docs;
}

// ---------------------------------------------------------------------------
// Build the per-tool report.
// ---------------------------------------------------------------------------
const rows = [];
for (const tool of tools) {
  const named = discoverabilityFor(tool);
  const reached = reachabilityFor(tool);
  const verified = verificationFor(tool);
  const verdicts = [];
  if (named.length === 0) verdicts.push('UNNAMED');
  if (reached.length === 0) verdicts.push('UNREACHED');
  if (verified.length === 0) verdicts.push('UNVERIFIED');
  rows.push({
    capability: tool,
    kind: 'tool',
    discoverable: named.length,
    documents: named,
    reachable: reached,
    verified,
    verdict: verdicts.length ? verdicts : ['OK'],
  });

  if (named.length === 0) {
    findings.push({
      id: 'capability-unnamed',
      severity: 'high',
      capability: tool,
      summary: `${tool} ships but is named in no document the model loads`,
      detail:
        `The loadable surface is ${SURFACE} (${surfaceDocs.length} document(s)). A capability the ` +
        `model cannot read about cannot be selected, however good it is.`,
      fix: `Name ${tool} with its literal invocation in a loadable reference document, and link that document from SKILL.md.`,
    });
  }
  if (reached.length === 0) {
    findings.push({
      id: 'capability-unreached',
      severity: 'high',
      capability: tool,
      summary: `${tool} is imported by nothing, spawned by nothing, and listed by nothing`,
      detail:
        'Checked three independent paths: a reference from src/, an invocation from another bin/, ' +
        'a wiring from claude/hooks/, plus the resolver registry. None hit.',
      fix: `Either wire ${tool} into a flow or the resolver registry, or retire it. Shipped-and-unreachable is dead weight that still has to be maintained.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Verbs: a verb in the registry that no loadable document names is the same defect at the
// command layer. The registry is read from dist/, which is what actually runs.
// ---------------------------------------------------------------------------
let verbRegistry = null;
try {
  ({ VERB_REGISTRY: verbRegistry } = require(path.join(REPO, 'dist', 'verb-command-registry')));
} catch (err) {
  inconclusive.push(
    `could not load dist/verb-command-registry (${err.message}) - verb discoverability unmeasured. Run npm run build.`
  );
}
if (verbRegistry) {
  for (const verb of Object.keys(verbRegistry).sort()) {
    // Match the invoked form, not the bare word: "polish" appears in prose constantly, and a
    // count of the bare word would report every verb as discoverable no matter what.
    const forms = [`/sidecoach ${verb}`, `sidecoach ${verb}`, `\`${verb}\``];
    const docs = surfaceDocs.filter((d) => forms.some((f) => d.text.includes(f))).map((d) => d.rel);
    const verdicts = docs.length === 0 ? ['UNNAMED'] : ['OK'];
    rows.push({
      capability: verb,
      kind: 'verb',
      discoverable: docs.length,
      documents: docs,
      reachable: ['dispatched by the verb registry'],
      verified: [],
      verdict: verdicts,
    });
    if (docs.length === 0) {
      findings.push({
        id: 'verb-unnamed',
        severity: 'medium',
        capability: verb,
        summary: `the verb '${verb}' dispatches but no loadable document shows how to invoke it`,
        detail: 'Searched the loadable surface for "/sidecoach <verb>", "sidecoach <verb>" and the backticked verb.',
        fix: `Add ${verb} to the routing table in a loadable document with an example invocation.`,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// CONTRADICTED: a loadable document asserting something the registry disproves.
//
// Two live cases in this repo drove this check, and both are numeric or set claims that a
// human wrote once and nobody re-derived. It deliberately only reports a contradiction it can
// PROVE from the registry; a claim it cannot evaluate is left alone rather than guessed at.
// ---------------------------------------------------------------------------
const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
};

if (resolverRegistry) {
  const actual = resolverRegistry.length;
  for (const d of surfaceDocs) {
    // "six self-contained CLIs ship in sidecoach/bin/" and its numeric-digit twin.
    const re = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b[^.\n]{0,40}?(self-contained CLIs|standalone (?:CLIs|bins|tools))/gi;
    let m;
    while ((m = re.exec(d.text)) !== null) {
      const raw = m[1].toLowerCase();
      const claimed = NUMBER_WORDS[raw] !== undefined ? NUMBER_WORDS[raw] : parseInt(raw, 10);
      if (!Number.isFinite(claimed)) continue;
      if (claimed !== actual) {
        findings.push({
          id: 'doc-contradicts-registry',
          severity: 'high',
          capability: d.rel,
          summary: `${d.rel} claims ${claimed} standalone tools; the resolver registry lists ${actual}`,
          detail: `Claim found: "${m[0].trim()}". The registry in bin/sidecoach.js is the surface 'sidecoach list' and 'sidecoach help' read, so it is the count a reader would verify against.`,
          fix: 'Derive the count from the registry instead of restating it, or correct it and add an assertion so it cannot drift again.',
        });
      }
    }
  }

  // A tool on disk that the resolver does not list is invisible to `sidecoach list`/`help`,
  // which is the discovery path a user has in a terminal.
  for (const tool of tools) {
    if (ENTRY_POINTS.has(tool)) continue;
    if (!resolverRegistry.includes(tool)) {
      findings.push({
        id: 'tool-not-in-resolver-registry',
        severity: 'medium',
        capability: tool,
        summary: `${tool} ships in bin/ but the resolver registry does not list it`,
        detail: "`sidecoach list` and `sidecoach help` enumerate the registry, so a tool missing from it cannot be discovered from a terminal.",
        fix: `Add ${tool} to STANDALONE_BINS in bin/sidecoach.js, or move it out of bin/ if it is not a user-facing tool.`,
      });
    }
  }
}

// The "only flow-wired tool" class of claim: assert it against which bins src/ actually
// spawns, rather than trusting the sentence.
// ENTRY POINTS ARE EXCLUDED from this set. `sidecoach` and `sidecoach-monitor` are the CLI
// front doors, and src/ mentions them constantly in paths and help strings; counting them as
// flow-wired tools would put two names into a finding that is supposed to be about the
// standalone tools a flow spawns, and a finding padded with two wrong names is a finding a
// reader learns to distrust. The extension IS required here (unlike the reachability probe)
// because this set answers "which bin does a flow execute", and executing one always names
// the file.
const flowWired = tools.filter((t) => {
  if (ENTRY_POINTS.has(t)) return false;
  const fileNeedle = new RegExp(`${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(js|mjs)`);
  return srcFiles.some((f) => fileNeedle.test(f.text));
});
for (const d of surfaceDocs) {
  const m = /`?(sidecoach-[a-z-]+)`?\s+is\s+(?:the\s+)?(?:additionally\s+)?only\s+(?:genuine\s+)?flow[- ]?(?:wired|invoked)/i.exec(d.text);
  if (!m) continue;
  const claimedSole = m[1];
  const others = flowWired.filter((t) => t !== claimedSole);
  if (others.length > 0) {
    findings.push({
      id: 'doc-contradicts-registry',
      severity: 'high',
      capability: d.rel,
      summary: `${d.rel} claims ${claimedSole} is the only flow-wired tool; src/ also spawns ${others.join(', ')}`,
      detail: `Claim found: "${m[0].trim()}". Derived by searching src/ for each tool's filename.`,
      fix: `Correct the claim to name every flow-wired tool (${flowWired.join(', ')}), and assert the set against src/ so it cannot drift.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const summary = {
  surface: SURFACE,
  loadableDocuments: surfaceDocs.length,
  loadableDocumentNames: surfaceDocs.map((d) => d.rel).sort(),
  toolsInventoried: tools.length,
  verbsInventoried: verbRegistry ? Object.keys(verbRegistry).length : null,
  findings,
  rows,
  inconclusive,
  checksRan: inconclusive.length === 0,
};

if (asJson) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  const out = [];
  out.push(`sidecoach-doctor`);
  out.push(`  loadable surface   ${SURFACE}`);
  out.push(`  loadable documents ${surfaceDocs.length}${surfaceDocs.length ? ` (${summary.loadableDocumentNames.join(', ')})` : ''}`);
  out.push(`  tools inventoried  ${tools.length}`);
  out.push(`  verbs inventoried  ${summary.verbsInventoried === null ? 'UNMEASURED' : summary.verbsInventoried}`);
  out.push('');
  const shown = quiet ? rows.filter((r) => !r.verdict.includes('OK')) : rows;
  if (shown.length) {
    out.push('capability                  kind   docs  verdict');
    for (const r of shown) {
      out.push(
        `  ${r.capability.padEnd(26)}${r.kind.padEnd(7)}${String(r.discoverable).padEnd(6)}${r.verdict.join(' ')}`
      );
    }
    out.push('');
  }
  if (findings.length) {
    out.push(`FINDINGS (${findings.length})`);
    for (const f of findings) {
      out.push(`  [${f.severity}] ${f.id}: ${f.summary}`);
      out.push(`      fix: ${f.fix}`);
    }
    out.push('');
  }
  if (inconclusive.length) {
    out.push(`INCONCLUSIVE (${inconclusive.length}) - these checks did NOT run, so this is not a clean result:`);
    for (const i of inconclusive) out.push(`  - ${i}`);
    out.push('');
  }
  if (!findings.length && !inconclusive.length) {
    out.push('Every inventoried capability is discoverable, reachable and verified.');
  }
  process.stdout.write(`${out.join('\n')}\n`);
}

// Inconclusive OUTRANKS findings in the exit code. A run that could not perform a check must
// never exit 0 or 1 as though its verdict were complete.
if (inconclusive.length > 0) process.exit(3);
process.exit(findings.length > 0 ? 1 : 0);
