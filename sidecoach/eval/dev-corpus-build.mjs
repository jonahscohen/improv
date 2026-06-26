#!/usr/bin/env node
/**
 * Stage 1 DEV CORPUS builder (held-out discipline, lead-approved Signal B).
 *
 * Sources a SMALL set of real pages DISJOINT from the frozen eval 90 (different hosts) and labels them with
 * the SAME rendered referee (eval/objective-label-rendered.mjs) to get rule-agnostic ground truth. The product
 * objective scanner is developed/diagnosed against THIS dev signal - NEVER the held-out 90 - so reaching parity
 * is not training-on-test. (Contrast development needs self-contained styling; heading/structure survives a raw
 * fetch since the referee renders inline-only. This corpus is primarily for the heading/structural gaps.)
 *
 * Fetch is best-effort (curl); pages that fail to fetch or render empty under script-strip are reported + skipped.
 * Output: eval/corpus/dev/<id>.html (saved sources) + eval/corpus/dev-labels.json (referee GT per page).
 * Run AFTER any held-out collect (Playwright contention). Re-runnable; --skip-fetch reuses saved HTML.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { objectiveLabelsRenderedFile, closeBrowser, meta } from './objective-label-rendered.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const DEV = path.join(CORPUS, 'dev');
const OUT = path.join(CORPUS, 'dev-labels.json');
mkdirSync(DEV, { recursive: true });
const skipFetch = process.argv.includes('--skip-fetch');
const sha256 = (s) => createHash('sha256').update(s).digest('hex');

// DISJOINTNESS basis: the frozen eval 90's content hashes + provenance hosts. Every dev page MUST be disjoint
// (zero content-sha overlap, zero host overlap) - a committed integrity assertion (lead requirement).
const evalManifest = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
const evalShas = new Set(evalManifest.map((c) => sha256(readFileSync(path.join(CORPUS, c.file)))));
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const evalHosts = new Set(evalManifest.map((c) => hostOf((c.provenance && (c.provenance.source || c.provenance.url)) || '')).filter(Boolean));

// Pages DISJOINT from the eval 90's hosts (verified against candidates provenance). SSR/static docs + content
// sites with real heading structure (survives the referee's script-strip + external-abort inline-only render).
const PAGES = [
  ['nodejs_about', 'https://nodejs.org/en/about'],
  ['typescript_home', 'https://www.typescriptlang.org/'],
  ['eslint_home', 'https://eslint.org/'],
  ['prettier_home', 'https://prettier.io/'],
  ['postgres_about', 'https://www.postgresql.org/about/'],
  ['sqlite_about', 'https://www.sqlite.org/about.html'],
  ['lua_about', 'https://www.lua.org/about.html'],
  ['ruby_home', 'https://www.ruby-lang.org/en/'],
  ['php_home', 'https://www.php.net/'],
  ['apache_home', 'https://httpd.apache.org/'],
  ['nginx_home', 'https://nginx.org/en/'],
  ['gnu_home', 'https://www.gnu.org/'],
  ['kernel_home', 'https://www.kernel.org/'],
  ['unicode_home', 'https://home.unicode.org/'],
  ['iana_home', 'https://www.iana.org/'],
  ['rfc_editor', 'https://www.rfc-editor.org/'],
  ['curl_home', 'https://curl.se/'],
  ['git_scm', 'https://git-scm.com/'],
  ['vim_home', 'https://www.vim.org/'],
  ['gnome_home', 'https://www.gnome.org/'],
];

function fetchPage(id, url) {
  const fp = path.join(DEV, `${id}.html`);
  if (skipFetch && existsSync(fp)) return { id, url, fp, fetched: true, cached: true };
  try {
    const html = execFileSync('curl', ['-sL', '--max-time', '25', '-A', 'Mozilla/5.0 (sidecoach-dev-corpus)', url], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (!html || html.length < 500) return { id, url, fetched: false, reason: `too small (${html ? html.length : 0} bytes)` };
    writeFileSync(fp, html);
    return { id, url, fp, fetched: true };
  } catch (e) { return { id, url, fetched: false, reason: e instanceof Error ? e.message.split('\n')[0] : String(e) }; }
}

const records = [];
const overlaps = [];
for (const [id, url] of PAGES) {
  // host disjointness (assert BEFORE fetch)
  const h = hostOf(url);
  if (evalHosts.has(h)) overlaps.push(`${id}: host ${h} overlaps the eval 90`);
  const f = fetchPage(id, url);
  if (!f.fetched) { console.error(`  FETCH FAIL ${id}: ${f.reason}`); records.push({ id, url, host: h, available: false, reason: f.reason }); continue; }
  // content disjointness (assert AFTER fetch): no dev page may share content with any eval page
  const contentSha = sha256(readFileSync(f.fp));
  if (evalShas.has(contentSha)) overlaps.push(`${id}: content-sha overlaps an eval-90 page`);
  try {
    const labels = await objectiveLabelsRenderedFile(f.fp);
    // labels shape mirrors the referee: { labels:[{class,...}], primaryDefects, ... } - keep the full-page objective classes.
    const objClasses = [...new Set((labels.labels || labels.objectiveLabels || []).map((l) => l.class))];
    records.push({ id, url, host: h, contentSha, available: true, objectiveClasses: objClasses, raw: labels });
    console.error(`  ${id}: [${objClasses.join(', ') || 'clean'}]`);
  } catch (e) { console.error(`  LABEL FAIL ${id}: ${e instanceof Error ? e.message : e}`); records.push({ id, url, available: false, reason: 'label error: ' + (e instanceof Error ? e.message : String(e)) }); }
}
await closeBrowser();

// DISJOINTNESS ASSERTION (lead requirement): zero host/content overlap with the frozen eval 90. Fail loud.
if (overlaps.length) { console.error(`FATAL: dev corpus NOT disjoint from the eval 90:\n  ${overlaps.join('\n  ')}`); process.exit(1); }

const usable = records.filter((r) => r.available);
const withHeading = usable.filter((r) => (r.objectiveClasses || []).includes('skipped-heading'));
const out = {
  generatedUtc: new Date().toISOString(),
  refereeMeta: await meta().catch(() => null),
  note: 'DEV CORPUS - disjoint from the frozen eval 90; referee-labeled GT for held-out-safe development. NOT the held-out bar.',
  sourcing: 'RULE-AGNOSTIC: a fixed list of real pages (no detectability pre-filter); ALL fetched pages are kept (clean ones included) so the dev signal is not selection-biased toward detectable defects.',
  disjointness: { assertedDisjointFromEval90: true, basis: 'zero content-sha overlap AND zero provenance-host overlap with candidates.json; build fails closed otherwise', overlapsFound: overlaps.length },
  pages: records.length, usable: usable.length, withSkippedHeading: withHeading.length,
  records,
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.log(`\nDEV CORPUS: ${usable.length}/${records.length} usable; ${withHeading.length} with skipped-heading; wrote ${OUT}`);
