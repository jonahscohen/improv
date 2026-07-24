#!/usr/bin/env node
/**
 * Stage 1b - DEFECT-DISTRIBUTION MEASUREMENT (upgrade plan 2026-07-23, Stage 1b).
 *
 * Runs the SHIPPING rendered scanner over a Stage 1a sample set and emits a committed per-provider, per-rule
 * fire-rate distribution: `{provider: {rule: {fired, total, rate}}}`.
 *
 * SINGLE SOURCE (the buzzword-calibrate integrity rule): the scanner is `scanRenderedLive` imported UNMODIFIED
 * from the built dist - the exact function `audit-rendered.ts` ships and the eval measures against the oracle.
 * The rule universe is the two rule arrays the shipping scanner modules EXPORT (OBJECTIVE_RULES +
 * SUBJECTIVE_RULES), so nothing about the rule set is re-declared eval-side. `marketing-buzzword` and
 * `default-typeface` are part of that exported universe and are measured here.
 *
 * FAIL-CLOSED (mirrors audit-rendered.ts verdict logic):
 *   - A page where NEITHER lens rendered DID NOT RUN -> `inconclusive`, EXCLUDED from every denominator, and
 *     reported separately in `inconclusive[]`. It is never counted as "0 defects" (a false clean).
 *   - A page where only ONE lens rendered is conclusive for that lens's rules and inconclusive for the other
 *     lens's rules: each rule's denominator counts only pages where that rule's OWN lens was available. A rule
 *     is never scored against a page whose detecting lens failed.
 *   - rate = fired / total, with total the per-rule conclusive page count; a rule with total 0 reports
 *     rate: null (undefined, not a fabricated 0).
 *
 * INDEPENDENCE: eval-side. Imports only the published dist surface; product code must never import eval/.
 *
 * Exit codes: 0 ok | 1 usage | 2 input dir / manifest unreadable | 3 no renderable pages | 4 schema self-check
 * failed | 5 scanner import failed.
 *
 * Usage:
 *   node eval/defect-distribution.mjs --in eval/samples/claude-<utc>
 *   node eval/defect-distribution.mjs --in <dir> --out <dir>/defect-distribution.json
 *   node eval/defect-distribution.mjs --in <dir> --stdout
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);

export const EXIT = { OK: 0, USAGE: 1, INPUT: 2, EMPTY: 3, SCHEMA: 4, IMPORT: 5 };
const die = (code, msg) => { console.error(`defect-distribution: ${msg}`); process.exit(code); };

// ---------------------------------------------------------------------------------------------------------
// Single-source scanner + rule universe from the built dist. A failed import is exit 5 (build the dist first).
// ---------------------------------------------------------------------------------------------------------
export async function loadScanner() {
  try {
    const live = await import(pathToFileURL(path.join(ROOT, 'dist/validators/rendered-live-scan.js')).href);
    const obj = await import(pathToFileURL(path.join(ROOT, 'dist/validators/objective-rendered-scanner.js')).href);
    const subj = await import(pathToFileURL(path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js')).href);
    if (typeof live.scanRenderedLive !== 'function') throw new Error('scanRenderedLive is not a function in dist');
    if (!Array.isArray(obj.OBJECTIVE_RULES) || !Array.isArray(subj.SUBJECTIVE_RULES)) throw new Error('rule arrays missing from dist');
    // rule -> owning lens, derived from the exported arrays (no eval-side hardcoded rule list).
    const lensOf = {};
    for (const r of obj.OBJECTIVE_RULES) lensOf[r] = 'objective';
    for (const r of subj.SUBJECTIVE_RULES) lensOf[r] = 'subjective';
    return { scanRenderedLive: live.scanRenderedLive, ruleUniverse: [...obj.OBJECTIVE_RULES, ...subj.SUBJECTIVE_RULES], lensOf };
  } catch (e) {
    die(EXIT.IMPORT, `cannot load the shipping scanner from dist (run "npm run build" first): ${e.message}`);
    return null; // unreachable
  }
}

// ---------------------------------------------------------------------------------------------------------
// Turn a RenderedScanCollection into per-lens availability + a set of rules that fired on the page.
// ---------------------------------------------------------------------------------------------------------
function readPageResult(collection) {
  const lens = {
    objective: { available: !!collection.objective?.available, reason: collection.objective?.reason || null },
    subjective: { available: !!collection.subjective?.available, reason: collection.subjective?.reason || null },
  };
  const fired = new Set();
  if (lens.objective.available) for (const f of collection.objective.findings || []) fired.add(f.rule);
  if (lens.subjective.available) for (const f of collection.subjective.findings || []) fired.add(f.rule);
  return { lens, fired, rendered: lens.objective.available || lens.subjective.available };
}

// ---------------------------------------------------------------------------------------------------------
// Load a Stage 1a sample dir. Prefer manifest.json; fall back to a bare directory of *.html so this tool also
// runs on a hand-assembled fixture that has no manifest.
// ---------------------------------------------------------------------------------------------------------
function loadSamples(inDir) {
  if (!existsSync(inDir) || !statSync(inDir).isDirectory()) die(EXIT.INPUT, `--in is not a directory: ${inDir}`);
  const manifestPath = path.join(inDir, 'manifest.json');
  if (existsSync(manifestPath)) {
    let manifest;
    try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')); }
    catch (e) { die(EXIT.INPUT, `manifest.json unreadable: ${e.message}`); }
    if (!Array.isArray(manifest.pages) || manifest.pages.length === 0) die(EXIT.EMPTY, 'manifest.pages is empty');
    return manifest.pages.map((p) => ({
      provider: p.provider || manifest.provider || 'unknown',
      briefId: p.briefId || null,
      file: p.file,
      repeat: p.repeat ?? null,
    }));
  }
  // No manifest: treat every *.html as an unknown-provider page.
  const html = readdirSync(inDir).filter((f) => f.endsWith('.html')).sort();
  if (html.length === 0) die(EXIT.EMPTY, `no manifest.json and no *.html files in ${inDir}`);
  return html.map((f) => ({ provider: 'unknown', briefId: null, file: f, repeat: null }));
}

// ---------------------------------------------------------------------------------------------------------
// Core measurement. Exported so the schema self-check and unit callers can reuse it.
// ---------------------------------------------------------------------------------------------------------
export async function measure(inDir, deps = {}) {
  const { scanRenderedLive, ruleUniverse, lensOf } = deps.scanner || (await loadScanner());
  const pages = loadSamples(inDir);

  // per provider: { pagesTotal, lensAvail{objective,subjective}, rule -> {fired,total} }
  const acc = {};
  const inconclusive = [];
  const ensure = (prov) => {
    if (!acc[prov]) {
      acc[prov] = { pagesTotal: 0, pagesConclusive: 0, lens: { objective: { available: 0, unavailable: 0 }, subjective: { available: 0, unavailable: 0 } }, rules: {} };
      for (const r of ruleUniverse) acc[prov].rules[r] = { fired: 0, total: 0 };
    }
    return acc[prov];
  };

  for (const p of pages) {
    const abs = path.resolve(inDir, p.file);
    const prov = ensure(p.provider);
    prov.pagesTotal += 1;
    if (!existsSync(abs)) {
      inconclusive.push({ provider: p.provider, file: p.file, briefId: p.briefId, reason: 'file missing on disk' });
      continue;
    }
    const collection = await scanRenderedLive(pathToFileURL(abs).href);
    const res = readPageResult(collection);
    if (!res.rendered) {
      inconclusive.push({ provider: p.provider, file: p.file, briefId: p.briefId, reason: `neither lens rendered (objective: ${res.lens.objective.reason}; subjective: ${res.lens.subjective.reason})` });
      continue;
    }
    prov.pagesConclusive += 1;
    for (const which of ['objective', 'subjective']) {
      if (res.lens[which].available) prov.lens[which].available += 1; else prov.lens[which].unavailable += 1;
    }
    for (const rule of ruleUniverse) {
      const lens = lensOf[rule];
      if (!res.lens[lens].available) continue; // the detecting lens did not run -> inconclusive for THIS rule
      prov.rules[rule].total += 1;
      if (res.fired.has(rule)) prov.rules[rule].fired += 1;
    }
  }

  // shape the committed distribution: {provider: {rule: {fired,total,rate}}}
  const distribution = {};
  for (const [prov, v] of Object.entries(acc)) {
    distribution[prov] = {};
    for (const rule of ruleUniverse) {
      const { fired, total } = v.rules[rule];
      distribution[prov][rule] = { fired, total, rate: total > 0 ? Number((fired / total).toFixed(4)) : null };
    }
  }

  return {
    schema: 'sidecoach-defect-distribution/v1',
    generatedUtc: new Date().toISOString(),
    scanner: 'dist/validators/rendered-live-scan.js#scanRenderedLive (shipping, unmodified)',
    inputDir: path.relative(ROOT, inDir) || inDir,
    ruleUniverse,
    lensOf,
    providers: acc,
    inconclusive,
    distribution,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Schema self-check: every rule in the universe has an entry per provider; every rate is null or in [0,1];
// inconclusive pages are excluded from denominators (sum of a rule's totals never exceeds conclusive pages).
// Returns [] when the artifact is well-formed, else a list of human-readable problems.
// ---------------------------------------------------------------------------------------------------------
export function validateArtifact(art) {
  const problems = [];
  if (art.schema !== 'sidecoach-defect-distribution/v1') problems.push(`unexpected schema: ${art.schema}`);
  if (!Array.isArray(art.ruleUniverse) || art.ruleUniverse.length === 0) problems.push('empty ruleUniverse');
  for (const [prov, rules] of Object.entries(art.distribution || {})) {
    for (const rule of art.ruleUniverse) {
      const e = rules[rule];
      if (!e) { problems.push(`${prov}: missing rule entry "${rule}"`); continue; }
      if (typeof e.fired !== 'number' || typeof e.total !== 'number') problems.push(`${prov}.${rule}: fired/total not numbers`);
      if (e.fired > e.total) problems.push(`${prov}.${rule}: fired ${e.fired} > total ${e.total}`);
      if (e.rate !== null && !(e.rate >= 0 && e.rate <= 1)) problems.push(`${prov}.${rule}: rate ${e.rate} out of [0,1]`);
      if (e.total === 0 && e.rate !== null) problems.push(`${prov}.${rule}: total 0 but rate is not null`);
      // inconclusive exclusion, tightened (Codex NOTE): a rule's denominator must EQUAL the count of pages
      // where its OWN lens ran - not merely be <= conclusive pages. A weaker `<= pagesConclusive` bound would
      // miss a denominator that under- or over-counts a partial-lens page.
      const lens = art.lensOf?.[rule];
      const lensAvail = art.providers?.[prov]?.lens?.[lens]?.available;
      if (typeof lensAvail === 'number' && e.total !== lensAvail) {
        problems.push(`${prov}.${rule}: denominator ${e.total} != pages where the ${lens} lens ran (${lensAvail})`);
      }
    }
  }
  return problems;
}

function parseArgs(argv) {
  const a = { in: null, out: null, stdout: false };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const next = () => { const v = argv[i + 1]; i += 1; return v; };
    if (k === '--in') a.in = next();
    else if (k === '--out') a.out = next();
    else if (k === '--stdout') a.stdout = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else die(EXIT.USAGE, `unknown argument: ${k}`);
  }
  return a;
}

const HELP = `defect-distribution.mjs - Stage 1b per-provider defect fire-rate distribution

  --in <dir>     a Stage 1a sample dir (manifest.json + *.html), or a bare dir of *.html   [required]
  --out <path>   where to write the JSON artifact (default <in>/defect-distribution.json)
  --stdout       also print the artifact JSON to stdout

exit: 0 ok | 1 usage | 2 input unreadable | 3 no pages | 4 schema self-check failed | 5 scanner import failed`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); process.exit(EXIT.OK); }
  if (!args.in) die(EXIT.USAGE, 'missing --in <sample-dir>');
  const inDir = path.resolve(args.in);

  const art = await measure(inDir);
  const problems = validateArtifact(art);
  if (problems.length) {
    console.error('defect-distribution: schema self-check FAILED:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(EXIT.SCHEMA);
  }

  // FAIL-CLOSED (Codex BLOCKER): pages existed but NONE rendered -> the scan DID NOT RUN. Every rate is null;
  // printing a success summary here would read as a false "no defects found" clean. Write the artifact as
  // evidence, then exit 3 (no renderable pages) - never a success line.
  const totalPages = Object.values(art.providers).reduce((n, v) => n + v.pagesTotal, 0);
  const totalConclusive = Object.values(art.providers).reduce((n, v) => n + v.pagesConclusive, 0);
  const outPath = path.resolve(args.out || path.join(inDir, 'defect-distribution.json'));
  writeFileSync(outPath, `${JSON.stringify(art, null, 2)}\n`);
  if (totalPages > 0 && totalConclusive === 0) {
    console.error(`defect-distribution: NO page rendered (${totalPages} page(s), 0 conclusive) - the scan DID NOT RUN. Refusing to report a distribution (would be a false clean). Inconclusive pages: ${art.inconclusive.length}. Evidence written to ${outPath}.`);
    process.exit(EXIT.EMPTY);
  }
  if (args.stdout) console.log(JSON.stringify(art, null, 2));

  const provs = Object.keys(art.distribution);
  console.log(`defect-distribution: ${provs.length} provider(s), ${art.ruleUniverse.length} rules -> ${outPath}`);
  for (const prov of provs) {
    const meta = art.providers[prov];
    const top = Object.entries(art.distribution[prov])
      .filter(([, e]) => e.rate)
      .sort((a, b) => b[1].rate - a[1].rate)
      .slice(0, 4)
      .map(([r, e]) => `${r}=${(e.rate * 100).toFixed(0)}%(${e.fired}/${e.total})`);
    console.log(`  ${prov}: pages=${meta.pagesTotal} conclusive=${meta.pagesConclusive} inconclusive=${meta.pagesTotal - meta.pagesConclusive}` +
      `${top.length ? `  top: ${top.join(' ')}` : '  (no rule fired)'}`);
  }
  if (art.inconclusive.length) console.log(`  inconclusive pages (excluded from denominators): ${art.inconclusive.length}`);
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
