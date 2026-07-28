#!/usr/bin/env node
/**
 * Taste-precision retune (2026-07-28): ONE render pass over every labeled corpus, caching the SHIPPING in-page
 * scores so every later threshold sweep is offline and cannot silently drift from what ships.
 *
 * INTEGRITY (the same contract buzzword-calibrate.mjs holds): this harness imports the SHIPPING in-page scorers
 * from dist and runs them via page.evaluate under the SHIPPING hermetic render config. It reimplements no
 * detector. Sweeps then apply thresholds to the cached scores, which is exactly what the Node-side
 * *FindingFromScore functions do in production.
 *
 * POPULATIONS (the whole point of this file - see the sweep harness for how they are used):
 *   TUNE    = dev (48) + candidates (90). Both are already spent: dev is what the current thresholds were
 *             frozen on, candidates is what the 2026-07-28 evaluation measured and published.
 *   HELDOUT = buzzword-heldout (37 labeled). NOT consulted while choosing any operating point.
 *
 * Usage: npm run build && node eval/taste-precision-features.mjs [--only dev|candidates|heldout]
 * Writes eval/.taste-cache/<corpus>.json. Exit 0 ok, 2 IO/usage, 3 a page failed to render.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const CACHE = path.join(HERE, '.taste-cache');

const dist = path.join(ROOT, 'dist/validators/subjective-rendered-scanner.js');
if (!existsSync(dist)) {
  console.error(`taste-precision-features: dist not built (${dist} missing). Run npm run build first.`);
  process.exit(2);
}
const {
  inPageSubjective, inPageNestedCards, inPageBuzzword, inPageTypeface, inPageMotionMarker, stripScripts,
} = await import(dist);

/** Label lookup per corpus. Each returns { id -> { class -> present:boolean } }. */
function labelsFromDev() {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/dev-subjective-labels.json'), 'utf8')).labels;
  const out = {};
  for (const [id, e] of Object.entries(raw)) {
    out[id] = {};
    for (const l of e.labels || []) out[id][l.class] = !!l.present;
  }
  return out;
}
function labelsFromCandidates() {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/candidates.json'), 'utf8'));
  const out = {};
  for (const c of raw) {
    out[c.id] = {};
    for (const l of c.subjectiveLabels || []) out[c.id][l.class] = !!l.present;
  }
  return out;
}
function labelsFromHeldout() {
  const raw = JSON.parse(readFileSync(path.join(ROOT, 'eval/corpus/buzzword-heldout-labels.json'), 'utf8')).labels;
  const out = {};
  for (const [id, e] of Object.entries(raw)) {
    out[id] = {};
    for (const l of e.labels || []) out[id][l.class] = !!l.present;
  }
  return out;
}

// PAGES WITH NO LABEL RECORD. Skipping silently would let label drift, a typoed rule name, or a deleted label
// quietly shrink the denominator and move every precision number - so the ONLY tolerated skips are named here,
// and any other unlabeled page is a hard failure (exit 5). buzzword-heldout ships 38 HTML files and 37 labeled
// ids; zendesk is the known gap.
const EXPECTED_UNLABELED = new Set(['heldout/zendesk']);

// BUILD STAMP. The cache holds SCORES produced by one build of the scanner; the sweep then applies THRESHOLDS
// from whatever build is current. Without a stamp those can silently be different builds - scores from an old
// taxonomy scored against new constants - and the resulting numbers would look completely normal. The sweep
// refuses to run when this does not match.
const scannerSrc = readFileSync(path.join(ROOT, 'src/validators/subjective-rendered-scanner.ts'), 'utf8');
const distSrc = readFileSync(dist, 'utf8');
const BUILD_STAMP = createHash('sha256').update(scannerSrc).update(distSrc).digest('hex').slice(0, 16);

const CORPORA = {
  dev: { population: 'tune', dir: path.join(ROOT, 'eval/corpus/dev'), labels: labelsFromDev },
  candidates: { population: 'tune', dir: path.join(ROOT, 'eval/corpus/candidates'), labels: labelsFromCandidates },
  heldout: { population: 'heldout', dir: path.join(ROOT, 'eval/corpus/buzzword-heldout'), labels: labelsFromHeldout },
};

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
if (only && !CORPORA[only]) { console.error(`taste-precision-features: unknown corpus "${only}"`); process.exit(2); }

mkdirSync(CACHE, { recursive: true });
const browser = await chromium.launch({ headless: true });
let renderFailures = 0;

for (const [name, spec] of Object.entries(CORPORA)) {
  if (only && name !== only) continue;
  const labels = spec.labels();
  const files = readdirSync(spec.dir).filter((f) => f.endsWith('.html')).sort();
  const pages = [];
  for (const f of files) {
    const id = f.replace(/\.html$/, '');
    const gt = labels[id];
    if (!gt) {
      const key = `${name}/${id}`;
      if (!EXPECTED_UNLABELED.has(key)) {
        console.error(`taste-precision-features: ${key} has NO label record and is not a declared expected gap.`);
        console.error('A silent skip moves every denominator. Add it to EXPECTED_UNLABELED or fix the labels.');
        await browser.close();
        process.exit(5);
      }
      process.stderr.write(`  ${key}: unlabeled (declared expected gap), skipped\n`);
      continue;
    }
    // Hermetic render matching analyzeHtmlOnBrowserSubjective exactly (HERMETIC defaults).
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.route('**/*', (r) => {
      const u = r.request().url();
      return (u.startsWith('data:') || u.startsWith('about:')) ? r.continue() : r.abort();
    });
    let rec = null;
    try {
      await page.setContent(stripScripts(readFileSync(path.join(spec.dir, f), 'utf8')), { waitUntil: 'domcontentloaded', timeout: 60000 });
      rec = {
        id,
        labels: gt,
        subjectiveFindings: (await page.evaluate(inPageSubjective)).map((x) => ({ rule: x.rule, selector: x.selector, detail: x.detail })),
        nested: await page.evaluate(inPageNestedCards),
        buzz: await page.evaluate(inPageBuzzword),
        typeface: await page.evaluate(inPageTypeface),
        marker: await page.evaluate(inPageMotionMarker),
      };
    } catch (e) {
      renderFailures++;
      process.stderr.write(`  ${name}/${id}: RENDER FAILED - ${e && e.message ? e.message : e}\n`);
    } finally {
      await ctx.close();
    }
    if (rec) { pages.push(rec); process.stderr.write(`  ${name}/${id}: ok\n`); }
  }
  const out = {
    corpus: name, population: spec.population, generatedUtc: new Date().toISOString(),
    buildStamp: BUILD_STAMP, htmlFiles: files.length, skipped: files.length - pages.length, pages,
  };
  writeFileSync(path.join(CACHE, `${name}.json`), JSON.stringify(out));
  console.log(`${name}: cached ${pages.length} page(s) of ${files.length} html file(s) [population=${spec.population}, stamp=${BUILD_STAMP}]`);
}

await browser.close();
if (renderFailures) { console.error(`taste-precision-features: ${renderFailures} page(s) failed to render`); process.exit(3); }
if (only) {
  console.error(`taste-precision-features: --only ${only} refreshed ONE corpus. The other caches still carry the`);
  console.error('previous build stamp and the sweep refuses to mix stamps. Re-run without --only before sweeping.');
  process.exit(6);
}
