#!/usr/bin/env node
/**
 * PROBE 2 - OUR OWN CONCEPT SAMENESS (does Stage 2c earn its effort?).
 *
 * Stage 2c (the outside-ranking roll) exists to break model SAMENESS, but every prior measurement was of the
 * RIVAL's sameness - never our own. This probe measures OUR sameness nearly free from Stage 1a's sampler:
 * generate repeatedly from ONE held-out brief (`provider-sample --brief <id> --repeats N`), then run this tool
 * over the result to measure how often the SAME CONCEPT recurs across the repeats.
 *
 * CONCEPT SIGNATURE. Each page is rendered (hermetic, 1280x800, cross-origin blocked - the same posture the
 * shipping scanners use) and reduced to a coarse aesthetic signature: dominant body typeface + quantized
 * background/foreground color + heading-count band + section-count band. Two pages with the same signature are
 * "the same concept": same type feeling, same palette bucket, same structural shape. The buckets are coarse on
 * purpose - the question is whether the model keeps reaching for the SAME look, not whether two pages are
 * byte-identical.
 *
 * NUMBERS reported (all in [0,1] / counts):
 *   - pairwiseSameness : P(two random repeats share a concept) = sum_g C(g,2) / C(n,2). The headline number.
 *   - modalConceptShare: fraction of repeats that land on the single most common concept.
 *   - distinctConcepts : how many different concepts N repeats produced.
 * High sameness (say pairwise >= 0.5) means the model repeats itself and Stage 2c's anti-sameness roll earns
 * its effort; low sameness means the model already diverges and 2c buys little.
 *
 * FAIL-CLOSED: a page that does not render is EXCLUDED and reported; with fewer than 2 renderable pages the
 * probe reports "cannot be answered because <reason>" rather than inventing a number.
 *
 * This probe renders LOCAL files only - no key, no network, no cost. It measures whatever set it is given: on a
 * `--dry-run` sample it measures the MOCK generator (a pipeline proof, not a model signal); on a live repeats
 * sample it measures the real model. The output states which.
 *
 * Exit: 0 ok | 1 usage | 2 input unreadable | 3 too few renderable pages to compute a number.
 *
 * Usage:
 *   node eval/concept-sameness.mjs --in eval/samples/<dir>
 *   node eval/concept-sameness.mjs --in <dir> --out <dir>/concept-sameness.json
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
export const EXIT = { OK: 0, USAGE: 1, INPUT: 2, TOO_FEW: 3 };
const die = (code, msg) => { console.error(`concept-sameness: ${msg}`); process.exit(code); };

const VIEWPORT = { width: 1280, height: 800 };

// In-page signature extractor. Coarse by design so near-identical concepts collide.
function inPageSignature() {
  const q = (v) => Math.round(v / 64) * 64; // quantize a 0-255 channel to {0,64,128,192,256->255}
  const rgb = (s) => { const m = /rgba?\(([^)]+)\)/.exec(s || ''); if (!m) return '?'; const p = m[1].split(',').map((x) => parseInt(x, 10)); return `${q(p[0] || 0)}-${q(p[1] || 0)}-${q(p[2] || 0)}`; };
  const body = document.body;
  const cs = getComputedStyle(body);
  const fam = (cs.fontFamily || '').split(',')[0].trim().replace(/^["']|["']$/g, '').toLowerCase() || 'unset';
  const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6').length;
  const sections = document.querySelectorAll('section,article,main,[role="region"]').length;
  const hBand = Math.min(headings, 6);
  const sBand = sections <= 2 ? 'lo' : sections <= 5 ? 'mid' : 'hi';
  return { family: fam, bg: rgb(cs.backgroundColor), fg: rgb(cs.color), hBand, sBand };
}

function signatureKey(s) { return `${s.family}|bg${s.bg}|fg${s.fg}|h${s.hBand}|s${s.sBand}`; }

function loadPages(inDir) {
  if (!existsSync(inDir) || !statSync(inDir).isDirectory()) die(EXIT.INPUT, `--in is not a directory: ${inDir}`);
  const manifestPath = path.join(inDir, 'manifest.json');
  let mode = 'unknown';
  let provider = 'unknown';
  let files;
  let briefIds = new Set();
  if (existsSync(manifestPath)) {
    let m;
    try { m = JSON.parse(readFileSync(manifestPath, 'utf8')); }
    catch (e) { die(EXIT.INPUT, `manifest.json unreadable: ${e.message}`); }
    mode = m.mode || 'unknown';
    provider = m.provider || (m.pages && m.pages[0] && m.pages[0].provider) || 'unknown';
    files = (m.pages || []).map((p) => p.file);
    for (const p of (m.pages || [])) if (p.briefId) briefIds.add(p.briefId);
  } else {
    files = readdirSync(inDir).filter((f) => f.endsWith('.html')).sort();
  }
  if (!files || files.length === 0) die(EXIT.INPUT, `no pages in ${inDir}`);
  return { mode, provider, files, briefIds: [...briefIds] };
}

export async function measure(inDir, deps = {}) {
  const { mode, provider, files, briefIds } = loadPages(inDir);
  // Single-brief by design (Codex MAJOR): sameness is a WITHIN-brief question. A multi-brief sample would mix
  // pages that SHOULD differ (different briefs) into the pairwise count, biasing the score toward "diverges"
  // and falsely arguing Stage 2c buys little. Refuse a multi-brief sample unless explicitly allowed. An
  // unknown brief set (no manifest, briefIds empty) is permitted - the operator pointed at a bare dir.
  if (briefIds.length > 1 && !deps.allowCrossBrief) {
    die(EXIT.USAGE, `sample spans ${briefIds.length} briefs (${briefIds.join(', ')}); concept sameness is a per-brief measure. Point at a single-brief repeats sample (provider-sample --brief <id> --repeats N), or pass --allow-cross-brief to override deliberately.`);
  }
  const launch = deps.launcher || (() => chromium.launch({ headless: true }));
  const browser = await launch();
  const signatures = [];
  const unrenderable = [];
  try {
    for (const f of files) {
      const abs = path.resolve(inDir, f);
      if (!existsSync(abs)) { unrenderable.push({ file: f, reason: 'missing on disk' }); continue; }
      const ctx = await browser.newContext({ viewport: VIEWPORT, reducedMotion: 'reduce', deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      // hermetic: allow only the local file document; block anything cross-origin.
      const docUrl = pathToFileURL(abs).href;
      await page.route('**/*', (route) => { const u = route.request().url(); return u === docUrl || u.startsWith('data:') || u.startsWith('about:') ? route.continue() : route.abort(); });
      try {
        await page.goto(docUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const sig = await page.evaluate(inPageSignature);
        signatures.push({ file: f, key: signatureKey(sig), sig });
      } catch (e) {
        unrenderable.push({ file: f, reason: e instanceof Error ? e.message.split('\n')[0] : String(e) });
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }

  const n = signatures.length;
  const groups = {};
  for (const s of signatures) groups[s.key] = (groups[s.key] || 0) + 1;
  const groupSizes = Object.values(groups);
  const distinctConcepts = groupSizes.length;
  const modal = groupSizes.length ? Math.max(...groupSizes) : 0;

  let pairwiseSameness = null;
  if (n >= 2) {
    const totalPairs = (n * (n - 1)) / 2;
    const samePairs = groupSizes.reduce((acc, g) => acc + (g * (g - 1)) / 2, 0);
    pairwiseSameness = Number((samePairs / totalPairs).toFixed(4));
  }

  return {
    schema: 'sidecoach-concept-sameness/v1',
    generatedUtc: new Date().toISOString(),
    mode,
    provider,
    briefIds,
    inputDir: path.relative(ROOT, inDir) || inDir,
    renderablePages: n,
    unrenderablePages: unrenderable.length,
    distinctConcepts,
    modalConceptShare: n ? Number((modal / n).toFixed(4)) : null,
    pairwiseSameness,
    concepts: Object.entries(groups).map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    unrenderable,
  };
}

function parseArgs(argv) {
  const a = { in: null, out: null, allowCrossBrief: false };
  for (let i = 0; i < argv.length; i += 1) {
    const k = argv[i];
    const next = () => { const v = argv[i + 1]; i += 1; return v; };
    if (k === '--in') a.in = next();
    else if (k === '--out') a.out = next();
    else if (k === '--allow-cross-brief') a.allowCrossBrief = true;
    else if (k === '--help' || k === '-h') a.help = true;
    else die(EXIT.USAGE, `unknown argument: ${k}`);
  }
  return a;
}

const HELP = `concept-sameness.mjs - Probe 2: how often the same concept recurs across repeated generations

  --in <dir>             a provider-sample dir of repeated generations (one brief, many repeats)   [required]
  --out <path>           write the JSON artifact (default <in>/concept-sameness.json)
  --allow-cross-brief    permit a sample spanning >1 brief (off by default; sameness is a per-brief measure)

  Renders local files only; no key, no network, no cost.
  exit: 0 ok | 1 usage | 2 input unreadable | 3 too few renderable pages`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); process.exit(EXIT.OK); }
  if (!args.in) die(EXIT.USAGE, 'missing --in <sample-dir>');
  const inDir = path.resolve(args.in);

  const art = await measure(inDir, { allowCrossBrief: args.allowCrossBrief });
  const outPath = path.resolve(args.out || path.join(inDir, 'concept-sameness.json'));
  writeFileSync(outPath, `${JSON.stringify(art, null, 2)}\n`);

  console.log('=== PROBE 2: CONCEPT SAMENESS ===');
  console.log(`  source: ${art.inputDir}  mode=${art.mode}  provider=${art.provider}  brief(s)=${art.briefIds.join(',') || 'n/a'}`);
  console.log(`  renderable pages: ${art.renderablePages}  (unrenderable, excluded: ${art.unrenderablePages})`);
  if (art.pairwiseSameness === null) {
    console.log(`  NUMBER: cannot be answered because only ${art.renderablePages} page(s) rendered (need >= 2 repeats).`);
    console.log(`  artifact: ${outPath}`);
    process.exit(EXIT.TOO_FEW);
  }
  console.log(`  distinct concepts: ${art.distinctConcepts} across ${art.renderablePages} repeats`);
  console.log(`  modalConceptShare: ${(art.modalConceptShare * 100).toFixed(0)}%  (share landing on the single most common concept)`);
  console.log(`  pairwiseSameness : ${(art.pairwiseSameness * 100).toFixed(0)}%  (P two random repeats share a concept) <- HEADLINE NUMBER`);
  const verdict = art.pairwiseSameness >= 0.5
    ? `HIGH sameness -> Stage 2c (anti-sameness roll) EARNS its effort${art.mode === 'dry-run' ? ' [MOCK generator - pipeline proof only, not a model signal]' : ''}.`
    : `LOW sameness -> the model already diverges; Stage 2c buys little${art.mode === 'dry-run' ? ' [MOCK generator - pipeline proof only, not a model signal]' : ''}.`;
  console.log(`  verdict: ${verdict}`);
  console.log(`  artifact: ${outPath}`);
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
