#!/usr/bin/env node
'use strict';

/**
 * Unit test for the taste consolidation + contradiction map engine (bin/sidecoach-consolidate.js).
 * Exercises: distill-corpus count parity, the acceptance fixture (one direction-pair + one
 * standard-calibration + one hard-vs-hard, with correct covered/additive/single-source counts), the
 * markdown renderer + --check drift gate, the inertness fence (a refused out-of-zone write + no
 * src/ import of the report zone), the headless rule-store baseline map, and a hand-labeled
 * ~16-pair fixture that MEASURES the engine's typing precision. Requires a built dist/. Exits
 * non-zero on any failure; prints no failure-shaped line on success.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawnSync } = require('child_process');

const BIN = path.resolve(__dirname, '..', 'sidecoach-consolidate.js');
const M = require(path.resolve(__dirname, '..', 'sidecoach-mine.js'));
const C = require(BIN);

let T;
try { T = require(path.resolve(__dirname, '..', '..', 'dist', 'taste-map-types')); }
catch (err) { process.stderr.write('sidecoach-consolidate.test: cannot load dist/taste-map-types - run `npm run build` first: ' + err.message + '\n'); process.exit(2); }

let reg, guidance;
try { reg = M.loadRegistry(); guidance = M.loadGuidanceStores(); }
catch (err) { process.stderr.write('sidecoach-consolidate.test: cannot load compiled registry - run `npm run build` first: ' + err.message + '\n'); process.exit(2); }

let passed = 0;
const failures = [];
function ok(cond, label) { if (cond) { passed += 1; } else { failures.push(label); } }
function eq(a, b, label) { ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

const FIXTURE = path.resolve(__dirname, 'fixtures', 'distilled-conflicts.json');
const PRECISION_FIXTURE = path.resolve(__dirname, 'fixtures', 'distilled-precision.json');

// HERMETIC: pin the audit-history so no concurrent scheduled miner mutates the corpus mid-suite.
const HERMETIC_AH = path.join(os.tmpdir(), `consolidate-test-no-ah-${process.pid}.jsonl`);
const _prevAH = process.env.SIDECOACH_AUDIT_HISTORY;
process.env.SIDECOACH_AUDIT_HISTORY = HERMETIC_AH;
const tmpBeats = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-beats-'));

// ============================================================================
// STEP 2: distill-corpus = expert-external + rule-store totals
// ============================================================================
{
  const corpus = M.assembleCorpus({ beatsDir: tmpBeats, registry: reg, guidance });
  const distill = C.runDistillCorpus({ beatsDir: tmpBeats });
  const expected = corpus.stats['expert-external'] + corpus.stats['rule-store-for-dedup'];
  eq(distill.stats.total, expected, 'distill-corpus total equals expert-external + rule-store totals');
  ok(distill.entries.every((e) => e.sourceKind === 'expert-external' || e.sourceKind === 'rule-store-for-dedup'), 'distill-corpus emits only distillable sourceKinds');
  ok(distill.entries.some((e) => e.directionSource === true), 'distill-corpus flags at least one provenance-gated direction source');
}

// ============================================================================
// direction allowlist is provenance-gated (READ from source+file, never prose)
// ============================================================================
eq(C.directionLabelFor('oracle', 'reference/_extracted/external/oracle/bolder.md'), 'bolder', 'oracle/bolder.md => bolder direction');
eq(C.directionLabelFor('oracle', 'reference/_extracted/external/oracle/quieter.md'), 'quieter', 'oracle/quieter.md => quieter direction');
eq(C.directionLabelFor('leon-lin-taste-skill', '.../minimalist-skill/SKILL.md'), 'minimalist', 'leon minimalist-skill => minimalist direction');
eq(C.directionLabelFor('refactoring-ui', '.../SKILL.md'), null, 'a non-direction source is NOT a direction (null)');
eq(C.directionLabelFor('oracle', '.../reference/some-other.md'), null, 'oracle non-bolder/quieter file is not a direction');

// the provenance GATE inside normalizeDistilled: a design-direction claim from a non-direction source
// is DEMOTED (cannot become a direction), and directionLabel is only ever set from provenance.
{
  const gated = C.normalizeDistilled({ source: 'oracle', sourceFile: 'reference/_extracted/external/oracle/bolder.md', type: 'design-direction', concept: 'accent-intensity', axisSubject: 'accent-intensity', claim: 'bold' }, 0, T);
  eq(gated.type, 'design-direction', 'a design-direction from a direction source stays a direction');
  eq(gated.directionLabel, 'bolder', 'directionLabel is read from provenance');
  const demoted = C.normalizeDistilled({ source: 'bencium-design', sourceFile: 'reference/_extracted/external/bencium-design/SKILL.md', type: 'design-direction', concept: 'accent-intensity', axisSubject: 'accent-intensity', claim: 'bold' }, 1, T);
  eq(demoted.type, 'principle-guidance', 'a design-direction from a NON-direction source is demoted (provenance gate)');
  eq(demoted.directionLabel, undefined, 'a demoted direction carries no directionLabel');
  ok(Array.isArray(demoted.normalizationWarnings) && demoted.normalizationWarnings.length > 0, 'the demotion is recorded as a normalization warning');
}

// TOTALITY: a malformed distilled entry is FILED (warnings) not thrown. A malformed entry with NO hard
// structured field (no polarity, malformed measured) falls to the principle-guidance floor.
{
  let threw = false; let rec;
  try { rec = C.normalizeDistilled({ source: 'x', type: 'not-a-real-type', measured: 'nope' }, 3, T); }
  catch (_e) { threw = true; }
  ok(!threw, 'normalizeDistilled does not throw on a malformed entry');
  eq(rec.type, 'principle-guidance', 'an unknown type with no hard structured field is filed as principle-guidance');
  ok(rec.normalizationWarnings && rec.normalizationWarnings.length >= 2, 'malformed type + malformed measured are both recorded as warnings');
}

// ============================================================================
// STEP 3: map over the acceptance fixture (dry-run, writes nothing)
// ============================================================================
const dry = C.runMap({ distilled: FIXTURE, dryRun: true, beatsDir: tmpBeats });
eq(dry.wrote, false, 'dry-run writes nothing');
eq(dry.counts.realConflicts, 1, 'exactly one hard-vs-hard (real conflict)');
eq(dry.counts.calibration, 1, 'exactly one standard-calibration');
eq(dry.counts.directionMenu, 1, 'exactly one direction-pair');
eq(dry.counts.crossType, 0, 'no cross-type in this fixture');
eq(dry.counts.covered, 1, 'exactly one covered cluster (gradient-text, redundant with a live rule)');
eq(dry.counts.additive, 2, 'two additive clusters (typeface-inter, border-radius - multi-source, we lack them)');
eq(dry.counts.singleSource, 1, 'one single-source cluster (accent-intensity)');
{
  const dp = dry.map.contradictionsByType['direction-pair'][0];
  ok(!!dp, 'the direction-pair record exists');
  eq(dp.isConflict, false, 'direction-pair.isConflict === false (the intended menu, never a conflict)');
  eq(dp.disposition, 'menu', 'direction-pair disposition is menu');
  const hh = dry.map.contradictionsByType['hard-vs-hard'][0];
  eq(hh.isConflict, true, 'hard-vs-hard is a real conflict');
  eq(hh.axisSubject, 'typeface-inter', 'the hard-vs-hard is on typeface-inter');
  const sc = dry.map.contradictionsByType['standard-calibration'][0];
  ok(Array.isArray(sc.values) && sc.values.length === 2, 'standard-calibration carries both measured values');
}

// ============================================================================
// STEP 4: renderer contains the three named section headers + --check drift gate
// ============================================================================
const md = C.renderMarkdown(dry.map);
ok(md.includes('## Real conflicts (resolve)'), 'render contains the "Real conflicts (resolve)" header');
ok(md.includes('## Calibration (pick a value or range)'), 'render contains the "Calibration (pick a value or range)" header');
ok(md.includes('## Direction menu (kept - not a conflict)'), 'render contains the "Direction menu (kept - not a conflict)" header');

{
  const mtmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-check-'));
  const reportPath = path.join(mtmp, 'taste-map.md');
  // generate the committed report from the fixture
  C.runMap({ distilled: FIXTURE, outDir: mtmp, report: reportPath, noBeat: true, beatsDir: tmpBeats });
  ok(fs.existsSync(reportPath), 'map writes the report to the out zone');
  ok(fs.existsSync(path.join(mtmp, 'taste-map.json')), 'map writes taste-map.json to the out zone');
  // --check against the freshly-generated report exits 0
  const fresh = cli(['map', '--distilled', FIXTURE, '--check', '--report', reportPath]);
  eq(fresh.status, 0, '--check exits 0 when the committed report matches the regenerated map');
  // a manual edit drifts the report -> --check exits 1
  fs.appendFileSync(reportPath, '\nhand-edited drift line\n');
  const drift = cli(['map', '--distilled', FIXTURE, '--check', '--report', reportPath]);
  eq(drift.status, C.EXIT_CHECK_DRIFT, '--check exits 1 after a manual edit (drift detected)');
  try { fs.rmSync(mtmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// the beat write path (fenced to .claude/memory), driven into a temp beat dir
{
  const otmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-out-'));
  const btmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-beat-'));
  const run = cli(['map', '--distilled', FIXTURE, '--out-dir', otmp, '--report', path.join(otmp, 'taste-map.md'), '--beat-out-dir', btmp, '--date', '2026-08-25']);
  eq(run.status, 0, 'map with a beat-out-dir exits 0');
  const beats = fs.readdirSync(btmp).filter((f) => /^taste_map_\d{4}-\d{2}-\d{2}\.md$/.test(f));
  eq(beats.length, 1, 'map writes exactly one taste_map beat into the beat dir');
  ok(fs.readFileSync(path.join(btmp, beats[0]), 'utf8').includes('INERT'), 'the taste_map beat marks itself INERT');
  try { fs.rmSync(otmp, { recursive: true, force: true }); fs.rmSync(btmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ============================================================================
// STEP 5a: inertness fence - a write outside data/taste-map/ is REFUSED
// ============================================================================
{
  const refused = cli(['map', '--distilled', FIXTURE, '--out-dir', '../src', '--no-beat']);
  eq(refused.status, C.EXIT_WRITE, 'a --out-dir ../src attempt exits non-zero (refused, EXIT_WRITE)');
  ok(/outside the inert quarantine|taste-map/i.test(refused.stderr), 'the refusal names the fence');
  // and it wrote nothing into src/
  ok(!fs.existsSync(path.resolve(__dirname, '..', '..', '..', 'src', 'taste-map.json')), 'nothing was written outside the zone');
}

// ============================================================================
// STEP 5b: structural inertness - nothing under src/ imports data/taste-map/
// ============================================================================
{
  const SRC = path.resolve(__dirname, '..', '..', 'src');
  const offenders = [];
  const walk = (d) => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_e) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts')) {
        const txt = fs.readFileSync(p, 'utf8');
        if (/data\/taste-map/.test(txt)) offenders.push(path.relative(SRC, p));
      }
    }
  };
  walk(SRC);
  ok(offenders.length === 0, `no src/ file imports the report zone data/taste-map (offenders: ${offenders.join(', ')})`);
}

// ============================================================================
// STEP 5c: headless map (no --distilled) = rule-store baseline, exits 0
// ============================================================================
{
  const headless = C.runMap({ dryRun: true, beatsDir: tmpBeats });
  eq(headless.counts.distilledClusters, 0, 'headless map has zero distilled clusters');
  eq(headless.counts.realConflicts + headless.counts.calibration + headless.counts.crossType + headless.counts.directionMenu, 0, 'headless map has zero contradictions');
  ok(headless.counts.liveRules > 0, 'headless map still surveys the live rule-store baseline');
  // and the real CLI headless write exits 0 into a temp zone
  const htmp = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-headless-'));
  const run = cli(['map', '--out-dir', htmp, '--report', path.join(htmp, 'taste-map.md'), '--no-beat', '--json']);
  eq(run.status, 0, 'headless map CLI exits 0');
  ok(fs.existsSync(path.join(htmp, 'taste-map.json')), 'headless map writes taste-map.json');
  const j = JSON.parse(fs.readFileSync(path.join(htmp, 'taste-map.json'), 'utf8'));
  eq(j.clusters.length, 0, 'headless taste-map.json has no distilled clusters (rule-store baseline only)');
  ok(j.counts.liveRules > 0, 'headless taste-map.json records the surveyed live rules');
  try { fs.rmSync(htmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ============================================================================
// STEP 5d: THE RISK GATE - measured typing precision over the labeled fixture
// ============================================================================
{
  const raw = JSON.parse(fs.readFileSync(PRECISION_FIXTURE, 'utf8'));
  const pairs = raw.pairs || [];
  ok(pairs.length >= 15, `precision fixture has >= 15 labeled pairs (has ${pairs.length})`);
  let correct = 0;
  const misses = [];
  for (const p of pairs) {
    // run each member through the FULL engine typing: provenance gate (normalizeDistilled) then classify.
    const a = C.normalizeDistilled(p.a, 0, T);
    const b = C.normalizeDistilled(p.b, 1, T);
    const rec = T.classifyContradiction(a, b);
    const got = rec ? rec.type : null;
    if (got === p.expected) correct += 1;
    else misses.push(`${p.label}: got ${JSON.stringify(got)}, want ${JSON.stringify(p.expected)}`);
  }
  const precision = correct / pairs.length;
  process.stdout.write(`sidecoach-consolidate.test: typing precision = ${correct}/${pairs.length} (${(precision * 100).toFixed(1)}%)\n`);
  for (const m of misses) process.stdout.write(`    MISS ${m}\n`);
  ok(precision === 1, `engine typing precision is 100% on the labeled fixture (${correct}/${pairs.length})`);
}

// ============================================================================
// CODEX RE-REVIEW REGRESSIONS
// ============================================================================

// FINDING 1 (High): contradiction detection joins on axisSubject, NOT concept. Two records sharing an
// axisSubject but landing in DIFFERENT normalized-concept clusters must still be compared. Before the
// fix these were two single-member concept clusters -> ZERO hard-vs-hard (a real conflict silently missed).
{
  const f1 = path.join(os.tmpdir(), `consolidate-f1-${process.pid}.json`);
  fs.writeFileSync(f1, JSON.stringify({ distilled: [
    { source: 'a', type: 'hard-prohibitive', polarity: 'ban', concept: 'typeface inter', axisSubject: 'inter-font', claim: 'Never use Inter' },
    { source: 'b', type: 'hard-prohibitive', polarity: 'mandate', concept: 'inter font', axisSubject: 'inter-font', claim: 'Always use Inter' },
  ] }));
  const m = C.runMap({ distilled: f1, dryRun: true, beatsDir: tmpBeats });
  eq(m.counts.realConflicts, 1, 'F1: two records sharing an axisSubject across DIFFERENT concept clusters produce exactly one hard-vs-hard');
  eq(m.map.contradictionsByType['hard-vs-hard'][0].axisSubject, 'inter-font', 'F1: the hard-vs-hard joins on the shared axisSubject');
  try { fs.unlinkSync(f1); } catch (_e) { /* best-effort */ }
}

// FINDING 2 (High): the provenance gate matches EXACT source-slug + EXACT path-segment, not substring.
// A fabricated `not-oracle` / `oracle-fake` must FAIL the gate, so a hard rule masquerading as a
// design-direction is surfaced as hard-vs-hard, never hidden as a harmless direction-pair.
{
  const BOLDER = 'reference/_extracted/external/oracle/reference/bolder.md';
  eq(C.directionLabelFor('not-oracle', BOLDER), null, 'F2: fabricated source not-oracle FAILS the exact gate');
  eq(C.directionLabelFor('oracle-fake', BOLDER), null, 'F2: fabricated source oracle-fake FAILS the exact gate');
  eq(C.directionLabelFor('oracle', BOLDER), 'bolder', 'F2: the real oracle/bolder still matches (gate not vacuous)');
  // the 6 REAL direction files still match (non-vacuous allowlist)
  const realDir = [
    ['leon-lin-taste-skill', 'reference/_extracted/external/leon-lin-taste-skill/skills/minimalist-skill/SKILL.md', 'minimalist'],
    ['leon-lin-taste-skill', 'reference/_extracted/external/leon-lin-taste-skill/skills/brutalist-skill/SKILL.md', 'brutalist'],
    ['leon-lin-taste-skill', 'reference/_extracted/external/leon-lin-taste-skill/skills/soft-skill/SKILL.md', 'soft'],
    ['oracle', 'reference/_extracted/external/oracle/reference/bolder.md', 'bolder'],
    ['oracle', 'reference/_extracted/external/oracle/reference/quieter.md', 'quieter'],
    ['taste-skill', 'reference/_extracted/external/taste-skill/named-vibe-variants.md', 'named-vibe'],
  ];
  let realOk = 0;
  for (const [src, file, label] of realDir) if (C.directionLabelFor(src, file) === label) realOk += 1;
  eq(realOk, 6, 'F2: all 6 real direction files still match after tightening (allowlist stays non-vacuous)');
  // a hard rule masquerading as a design-direction from a fabricated source is SURFACED as hard-vs-hard.
  const a = C.normalizeDistilled({ source: 'not-oracle', sourceFile: BOLDER, type: 'design-direction', polarity: 'ban', concept: 'inter', axisSubject: 'inter-font', claim: 'Never use Inter' }, 0, T);
  const b = C.normalizeDistilled({ source: 'oracle-fake', sourceFile: BOLDER, type: 'design-direction', polarity: 'mandate', concept: 'inter', axisSubject: 'inter-font', claim: 'Always use Inter' }, 1, T);
  eq(a.type, 'hard-prohibitive', 'F2: a fabricated-source direction carrying a polarity is demoted to hard-prohibitive (surfaced, not softened)');
  eq(a.directionLabel, undefined, 'F2: the fabricated source carries no directionLabel');
  const rec = T.classifyContradiction(a, b);
  eq(rec && rec.type, 'hard-vs-hard', 'F2: the masquerading pair classifies as hard-vs-hard, NEVER direction-pair');
}

// FINDING 3 (Medium): a value-taking flag with no value is a usage error, not a silent headless run
// that could OVERWRITE the report.
{
  const bare = cli(['map', '--distilled']);
  ok(bare.status !== 0, 'F3: `map --distilled` with no value exits non-zero');
  eq(bare.status, C.EXIT_USAGE, 'F3: the bare --distilled exit code is the usage class (2)');
  ok(/requires a value/i.test(bare.stderr), 'F3: the error names the missing value');
  const bareFlag = cli(['map', '--distilled', '--dry-run']);
  ok(bareFlag.status !== 0, 'F3: `map --distilled --dry-run` (next token is a flag) also errors, never consuming --dry-run as the value');
}

// ============================================================================
// CODEX RE-REVIEW ROUND 2
// ============================================================================

// FINDING 1r2 (High): a structured HARD field overrides an asserted direction type EVEN from an
// allowlisted source, so a hard rule can never hide inside the menu.
{
  const BOLDER = 'reference/_extracted/external/oracle/reference/bolder.md';
  const QUIETER = 'reference/_extracted/external/oracle/reference/quieter.md';
  const MIN = 'reference/_extracted/external/leon-lin-taste-skill/skills/minimalist-skill/SKILL.md';
  const BRU = 'reference/_extracted/external/leon-lin-taste-skill/skills/brutalist-skill/SKILL.md';

  // (a) two allowlisted-direction records with OPPOSING polarity -> hard-vs-hard, never direction-pair.
  const pa = C.normalizeDistilled({ source: 'oracle', sourceFile: BOLDER, type: 'design-direction', polarity: 'ban', concept: 'inter', axisSubject: 'inter-font', claim: 'Never use Inter' }, 0, T);
  const pb = C.normalizeDistilled({ source: 'oracle', sourceFile: QUIETER, type: 'design-direction', polarity: 'mandate', concept: 'inter', axisSubject: 'inter-font', claim: 'Always use Inter' }, 1, T);
  eq(pa.type, 'hard-prohibitive', 'F1r2a: an allowlisted-direction record carrying a polarity is re-typed hard-prohibitive');
  eq(pa.directionLabel, undefined, 'F1r2a: the re-typed hard rule carries no directionLabel');
  eq(T.classifyContradiction(pa, pb).type, 'hard-vs-hard', 'F1r2a: opposing polarity from direction sources classifies hard-vs-hard, NEVER direction-pair');

  // (b) two allowlisted-direction records with DIFFERING measured -> standard-calibration, never direction-pair.
  const ma = C.normalizeDistilled({ source: 'oracle', sourceFile: BOLDER, type: 'design-direction', measured: { property: 'border-radius', value: 8, unit: 'px' }, concept: 'radius', axisSubject: 'card-radius', claim: '8px' }, 0, T);
  const mb = C.normalizeDistilled({ source: 'oracle', sourceFile: QUIETER, type: 'design-direction', measured: { property: 'border-radius', value: 0, unit: 'px' }, concept: 'radius', axisSubject: 'card-radius', claim: '0px' }, 1, T);
  eq(ma.type, 'standard-measurement', 'F1r2b: an allowlisted-direction record carrying a measured value is re-typed standard-measurement');
  eq(T.classifyContradiction(ma, mb).type, 'standard-calibration', 'F1r2b: differing measured from direction sources classifies standard-calibration, NEVER direction-pair');

  // (c) REGRESSION-GUARD: two GENUINE directions (allowlisted, NO polarity, NO measured) STILL a menu.
  const ga = C.normalizeDistilled({ source: 'leon-lin-taste-skill', sourceFile: MIN, type: 'design-direction', concept: 'density', axisSubject: 'visual-density', claim: 'strip to essentials' }, 0, T);
  const gb = C.normalizeDistilled({ source: 'leon-lin-taste-skill', sourceFile: BRU, type: 'design-direction', concept: 'density', axisSubject: 'visual-density', claim: 'raw exposed structure' }, 1, T);
  eq(ga.type, 'design-direction', 'F1r2c: a genuine direction (no polarity, no measured) STAYS design-direction');
  eq(ga.directionLabel, 'minimalist', 'F1r2c: the genuine direction keeps its provenance label');
  const menu = T.classifyContradiction(ga, gb);
  eq(menu.type, 'direction-pair', 'F1r2c: two genuine directions STILL classify direction-pair (the menu is preserved)');
  eq(menu.isConflict, false, 'F1r2c: the preserved menu is not a conflict');
}

// FINDING 2r2 (Low): the `--flag=value` form accepts a legitimate value that begins with a dash, while
// the space-separated guard against a bare flag / flag-followed-by-flag stays closed.
{
  const eqForm = cli(['map', `--distilled=${FIXTURE}`, '--dry-run', '--json']);
  eq(eqForm.status, 0, 'F2r2: --distilled=<file> reads the file (exit 0)');
  // a value that BEGINS with a dash, via the = form, resolved from a temp cwd
  const dcwd = fs.mkdtempSync(path.join(os.tmpdir(), 'consolidate-dash-'));
  fs.writeFileSync(path.join(dcwd, '-lead.json'), JSON.stringify({ distilled: [] }));
  const dashR = spawnSync('node', [BIN, 'map', '--distilled=-lead.json', '--dry-run', '--json'], { encoding: 'utf8', cwd: dcwd, env: { ...process.env, SIDECOACH_AUDIT_HISTORY: HERMETIC_AH } });
  eq(dashR.status, 0, 'F2r2: a dash-leading filename via --distilled=-lead.json is accepted (exit 0)');
  const emptyEq = cli(['map', '--distilled=']);
  ok(emptyEq.status !== 0, 'F2r2: --distilled= (empty) still exits non-zero (guard not reopened)');
  const boolEq = cli(['map', '--json=x']);
  ok(boolEq.status !== 0, 'F2r2: a boolean flag with an =value is rejected');
  // the space-separated guards from round 1 are unchanged
  ok(cli(['map', '--distilled']).status === C.EXIT_USAGE, 'F2r2: bare `--distilled` still exits 2');
  ok(cli(['map', '--distilled', '--dry-run']).status === C.EXIT_USAGE, 'F2r2: `--distilled --dry-run` still exits 2');
  try { fs.rmSync(dcwd, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
}

// ============================================================================
// CODEX RE-REVIEW ROUND 2 - END-TO-END MAP PIPELINE (normalizeDistilled -> buildMap)
// ============================================================================
// These route committed distilled JSON fixtures through the SAME pipeline the `map` command uses
// (C.runMap -> normalizeDistilled -> buildMap -> classifier), NOT the direct classifier - so a bug in
// the demotion or the axisSubject grouping that drops records before the classifier is CAUGHT here.
{
  const pipeCount = (fixtureName, type) => {
    const m = C.runMap({ distilled: path.resolve(__dirname, 'fixtures', fixtureName), dryRun: true, beatsDir: tmpBeats });
    return m.map.contradictionsByType[type].length;
  };
  const allTypes = (fixtureName) => {
    const m = C.runMap({ distilled: path.resolve(__dirname, 'fixtures', fixtureName), dryRun: true, beatsDir: tmpBeats });
    const t = m.map.contradictionsByType;
    return { hh: t['hard-vs-hard'].length, dp: t['direction-pair'].length, sc: t['standard-calibration'].length, ct: t['cross-type'].length };
  };

  // (1) masquerade: two ALLOWLISTED oracle directions with opposing polarity -> hard-vs-hard EXACTLY 1.
  const masq = allTypes('r2-masquerade.json');
  eq(masq.hh, 1, 'PIPELINE masquerade: two allowlisted oracle directions with opposing polarity -> hard-vs-hard=1 (NEVER 0, never direction-pair)');
  eq(masq.dp, 0, 'PIPELINE masquerade: direction-pair=0 (the conflict is surfaced, not shown as a menu)');

  // (2) two allowlisted directions differing on measured (no polarity) -> standard-calibration=1.
  const meas = allTypes('r2-measured-differ.json');
  eq(meas.sc, 1, 'PIPELINE measured-differ: two allowlisted directions differing on measured -> standard-calibration=1');
  eq(meas.dp, 0, 'PIPELINE measured-differ: direction-pair=0 (a measured knob calibrates, it does not pick a stance)');

  // (3) REGRESSION-GUARD: two GENUINE allowlisted directions (no polarity, no measured) -> direction-pair=1.
  const gen = allTypes('r2-genuine-directions.json');
  eq(gen.dp, 1, 'PIPELINE genuine-directions: two genuine allowlisted directions -> direction-pair=1 (menu preserved through the pipeline)');
  eq(gen.hh + gen.sc + gen.ct, 0, 'PIPELINE genuine-directions: no hard/calibration/cross-type (the menu is not a conflict)');
  const genMap = C.runMap({ distilled: path.resolve(__dirname, 'fixtures', 'r2-genuine-directions.json'), dryRun: true, beatsDir: tmpBeats });
  eq(genMap.map.contradictionsByType['direction-pair'][0].isConflict, false, 'PIPELINE genuine-directions: the preserved direction-pair has isConflict=false');

  // (4) fabricated not-oracle/oracle-fake carrying opposing polarity -> hard-vs-hard=1, never direction-pair.
  eq(pipeCount('r2-fabricated-polarity.json', 'hard-vs-hard'), 1, 'PIPELINE fabricated: not-oracle/oracle-fake with opposing polarity -> hard-vs-hard=1');
  eq(pipeCount('r2-fabricated-polarity.json', 'direction-pair'), 0, 'PIPELINE fabricated: direction-pair=0 (fabricated sources never form a menu)');

  // and the same through the REAL CLI end-to-end (proves it for `map --distilled ... --json`). The large
  // map JSON is captured to a FILE, not a pipe: spawnSync pipe-capture truncates big stdout at one buffer
  // (the reason run-tests.ts captures to a file), which is a harness limit, not a tool defect.
  const cliOut = path.join(os.tmpdir(), `consolidate-cli-masq-${process.pid}.json`);
  const fd = fs.openSync(cliOut, 'w');
  const rc = spawnSync('node', [BIN, 'map', '--distilled', path.resolve(__dirname, 'fixtures', 'r2-masquerade.json'), '--dry-run', '--json'], { stdio: ['ignore', fd, 'ignore'], env: { ...process.env, SIDECOACH_AUDIT_HISTORY: HERMETIC_AH } });
  fs.closeSync(fd);
  eq(rc.status, 0, 'PIPELINE CLI: map --distilled masquerade exits 0');
  const parsed = JSON.parse(fs.readFileSync(cliOut, 'utf8'));
  eq(parsed.map.contradictionsByType['hard-vs-hard'].length, 1, 'PIPELINE CLI: masquerade via `map --distilled --json` -> hard-vs-hard=1');
  try { fs.unlinkSync(cliOut); } catch (_e) { /* best-effort */ }

  process.stdout.write(`sidecoach-consolidate.test: round-2 pipeline counts -> masquerade hh=${masq.hh} | measured sc=${meas.sc} | genuine dp=${gen.dp} | fabricated hh=${pipeCount('r2-fabricated-polarity.json', 'hard-vs-hard')}\n`);
}

// ============================================================================
// CODEX FINAL PASS - type driven by RAW structured fields (not type-gated), via the .counts pipeline
// ============================================================================
// These assert on `.counts` from the REAL map pipeline (map --distilled <fixture> --dry-run --json), the
// exact defect surface: the structured-field override used to run inside `if (type === 'design-direction')`,
// so a record with a missing/unknown/wrong type + hard fields was left principle-guidance and DROPPED.
{
  const counts = (fixtureName) => C.runMap({ distilled: path.resolve(__dirname, 'fixtures', fixtureName), dryRun: true, beatsDir: tmpBeats }).counts;

  // FINDING 1 (High): missing/unknown/wrong type + hard fields must still be re-typed from the raw fields.
  const f1p = counts('r3-untyped-polarity.json');
  eq(f1p.realConflicts, 1, 'FINAL F1: unknown type + opposing polarity -> realConflicts=1 (surfaced, not dropped)');
  eq(f1p.directionMenu, 0, 'FINAL F1: unknown type + opposing polarity -> directionMenu=0');
  const f1m = counts('r3-untyped-measured.json');
  eq(f1m.calibration, 1, 'FINAL F1: unknown type + differing measured -> calibration=1 (surfaced, not dropped)');

  // FINDING 2 (Med): a genuine allowlisted direction with NO asserted type must still be a menu.
  const f2 = counts('r3-notype-genuine-direction.json');
  eq(f2.directionMenu, 1, 'FINAL F2: two allowlisted directions with NO type field -> directionMenu=1 (menu preserved via provenance)');
  eq(f2.realConflicts + f2.calibration + f2.crossType, 0, 'FINAL F2: the no-type genuine directions are a menu, not a conflict');

  // FINDING 3 (High): invalid-but-present polarity ("ban " trailing space) must be trimmed and surfaced.
  const f3 = counts('r3-trailing-space-polarity.json');
  eq(f3.realConflicts, 1, 'FINAL F3: allowlisted directions with trailing-space polarity -> realConflicts=1 (trimmed + surfaced)');
  eq(f3.directionMenu, 0, 'FINAL F3: a record carrying any polarity is never a menu');

  process.stdout.write(`sidecoach-consolidate.test: final-pass .counts -> f1-polarity realConflicts=${f1p.realConflicts} | f1-measured calibration=${f1m.calibration} | f2-notype directionMenu=${f2.directionMenu} | f3-trimmed realConflicts=${f3.realConflicts}\n`);
}

// ---------------------------------------------------------------------------
// teardown + verdict
// ---------------------------------------------------------------------------
if (_prevAH === undefined) delete process.env.SIDECOACH_AUDIT_HISTORY; else process.env.SIDECOACH_AUDIT_HISTORY = _prevAH;
try { fs.rmSync(tmpBeats, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

function cli(args) {
  const r = spawnSync('node', [BIN, ...args], { encoding: 'utf8', env: { ...process.env, SIDECOACH_AUDIT_HISTORY: HERMETIC_AH } });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

if (failures.length) {
  process.stderr.write(`sidecoach-consolidate.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
process.stdout.write(`sidecoach-consolidate.test: all ${passed} assertions passed\n`);
process.exit(0);
