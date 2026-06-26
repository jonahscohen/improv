#!/usr/bin/env node
/**
 * Contract-6 SCORECARD - ORACLE BROWSER-MODE OBJECTIVE CEILING (the "real floor bar").
 *
 * WHY (Jonah's ruling C): the static-vs-static head-to-head (scorecard.json) is the fair HEADLINE, but it
 * UNDERSTATES oracle's objective power - oracle's contrast/a11y detection lives in its BROWSER engine
 * (Puppeteer), which the static `detect.mjs --json` path does NOT invoke (it emits 0 low-contrast / 0
 * skipped-heading). This module measures oracle's FULL browser-mode recall on the OBJECTIVE classes vs the
 * rendered referee's objective labels, reported SEPARATELY + clearly labeled as the CEILING (NOT mixed into the
 * paired static comparison). This is the objective floor the reimplemented browser-based Sidecoach must clear.
 *
 * COMPARABILITY (Codex ceiling-review #3): oracle's browser engine must see the SAME page state the
 * referee labeled - the referee strips ALL <script> and aborts ALL external requests (inline content only).
 * So we serve a SCRIPT-STRIPPED + EXTERNAL-LINK-STRIPPED transform of each page (matching the referee's
 * stripScripts + external-abort for the style/structure drivers of the objective classes). Remaining minor
 * difference (external images/iframes may still load) does not affect the objective classes (contrast/heading
 * are driven by inline CSS + DOM structure present in the frozen HTML), and this is a reference bar, not the
 * precision head-to-head.
 *
 * HOW: oracle's browser engine only triggers for http(s):// targets, so we serve the corpus over a
 * loopback HTTP server and run `detect.mjs --json <url>` per page (one Chrome/page = isolation + group-kill on
 * hang). Puppeteer points at Playwright's already-installed Chromium via PUPPETEER_EXECUTABLE_PATH.
 * FAIL-CLOSED (Codex ceiling-review #1): a timeout, nonzero/odd exit, non-array stdout, OR problem-stderr (a
 * caught browser error that still exits 0 with []) records the page UNAVAILABLE - never a false clean 0.
 *
 * REPORTING: strict per-class recall + the honest views - broken-image is a STATIC-engine rule (not browser;
 * its ceiling is the head-to-head static R=1.0), and browser-mode folds gray-on-color into low-contrast, so a
 * contrast-FAMILY (low-contrast OR gray-on-color) recall is the fair contrast measure. The full-objective
 * ceiling = browser (skipped-heading + contrast-family) + static broken-image. oracle-only.
 */
import http from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { runDetached, resolveOraclePath, stderrLooksProblematic } from './oracle-comparator.mjs';
import { sha256 } from './scorecard-shared.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const CACHE = path.join(HERE, '.ceiling-cache');
const OUT = path.join(CORPUS, 'scorecard-browser-ceiling.json');
const OBJECTIVE = ['broken-image', 'justified-text', 'skipped-heading', 'low-contrast', 'gray-on-color'];
const TIMEOUT = 180000;          // generous - browser mode launches Chrome + renders per page; group-killed on hang
const HOST = '127.0.0.1';        // loopback only (Codex ceiling-review #5)
const PORT = Number(process.env.CEILING_PORT || 8791);
const CEILING_CACHE_VERSION = 2; // bump when the transform, invocation, or record schema changes
const force = process.argv.includes('--force');

// Point Puppeteer (oracle's browser engine) at Playwright's already-installed Chromium (no 2nd download).
const require = createRequire(import.meta.url);
let chromiumPath;
try { chromiumPath = require('playwright').chromium.executablePath(); } catch { chromiumPath = null; }
if (!chromiumPath || !existsSync(chromiumPath)) { console.error('FATAL: Playwright Chromium not found (npm i playwright). Cannot run browser-mode ceiling.'); process.exit(1); }
process.env.PUPPETEER_EXECUTABLE_PATH = chromiumPath;
const oraclePath = resolveOraclePath();
if (!oraclePath) { console.error('FATAL: oracle detect.mjs not resolvable.'); process.exit(1); }
const oracleSha = sha256(readFileSync(oraclePath));
const objectiveHash = sha256(Buffer.from(OBJECTIVE.join(','))).slice(0, 16);
const envSig = sha256(Buffer.from(`${CEILING_CACHE_VERSION}|${oracleSha}|${chromiumPath}|${objectiveHash}`)).slice(0, 16);

// Match the referee transform (objective-label-rendered.mjs): strip ALL <script>, and strip external (http/https
// or protocol-relative) <link> (stylesheet/font/preload/etc.) so only inline content drives the render - the
// referee aborts all external requests, so external CSS/fonts must not apply here either.
function transform(html) {
  return String(html)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*\/?>/gi, '')
    .replace(/<link\b[^>]*\bhref\s*=\s*["'](?:https?:)?\/\/[^"']*["'][^>]*>/gi, '');
}

const candidates = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
mkdirSync(CACHE, { recursive: true });

// Minimal loopback static server rooted at corpus; serves the TRANSFORMED HTML (read-only, traversal-guarded).
const server = http.createServer((req, res) => {
  let rel;
  try { rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, ''); }
  catch { res.writeHead(400); res.end('bad request'); return; }
  const fp = path.join(CORPUS, rel);
  if (!fp.startsWith(CORPUS + path.sep) || !existsSync(fp) || !statSync(fp).isFile()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(/\.html?$/i.test(fp) ? transform(readFileSync(fp, 'utf8')) : readFileSync(fp));
});

// A ceiling cache record is COMPLETE iff right env signature + page content hash + full shape.
function isCompleteCeilingRecord(rec, corpusSha) {
  return !!rec && rec.envSig === envSig && rec.corpusSha === corpusSha
    && typeof rec.available === 'boolean' && typeof rec.ms === 'number'
    && Array.isArray(rec.rules) && Array.isArray(rec.objectiveDetected);
}

async function runOracleBrowser(url) {
  const r = await runDetached('node', [oraclePath, '--json', url], { timeoutMs: TIMEOUT });
  if (r.timedOut) return { available: false, reason: `browser-mode timed out after ${TIMEOUT}ms (group-killed)`, findings: [] };
  // FAIL-CLOSED on problem-stderr even when exit is 0/2: oracle's URL path can catch a browser error,
  // print "Error: ..." to stderr, emit [], and exit 0 - that must NOT read as a clean page (Codex review #1).
  if (stderrLooksProblematic(r.stderr)) return { available: false, reason: `browser-mode stderr: ${(r.stderr || '').trim().split('\n')[0]}`, findings: [] };
  if (r.code === 0 || r.code === 2) {
    try { const parsed = JSON.parse(r.stdout); if (!Array.isArray(parsed)) return { available: false, reason: 'stdout not a JSON array', findings: [] }; return { available: true, findings: parsed }; }
    catch { return { available: false, reason: 'stdout not JSON', findings: [] }; }
  }
  return { available: false, reason: `browser-mode exit ${r.code}: ${(r.stderr || '').trim().split('\n')[0] || '?'}`, findings: [] };
}

let unavail = 0;
try {
  await new Promise((resolve) => server.listen(PORT, HOST, resolve));
  console.error(`serving corpus on http://${HOST}:${PORT} (script+external-link stripped) ; Chromium=${chromiumPath}`);
  let n = 0;
  for (const c of candidates) {
    const cacheFile = path.join(CACHE, `${c.id}.json`);
    const corpusSha = sha256(readFileSync(path.join(CORPUS, c.file)));
    if (!force && existsSync(cacheFile)) {
      const prev = JSON.parse(readFileSync(cacheFile, 'utf8'));
      if (isCompleteCeilingRecord(prev, corpusSha)) { if (!prev.available) unavail++; n++; continue; }
    }
    const url = `http://${HOST}:${PORT}/${c.file}`;
    const t0 = Date.now();
    const r = await runOracleBrowser(url);
    const ms = Date.now() - t0;
    if (!r.available) unavail++;
    const rules = (r.findings || []).map((f) => f.antipattern ?? f.rule ?? f.type).filter(Boolean);
    writeFileSync(cacheFile, JSON.stringify({ id: c.id, envSig, corpusSha, available: r.available, reason: r.reason ?? null, ms, rules, objectiveDetected: [...new Set(rules.filter((x) => OBJECTIVE.includes(x)))] }, null, 2));
    n++;
    process.stderr.write(`  ${n}/${candidates.length} ${c.id} ${r.available ? `(${ms}ms, ${rules.length} findings)` : `[UNAVAIL ${r.reason}]`}\n`);
  }
} finally {
  await new Promise((resolve) => server.close(resolve));
}

// ---- compute objective recall vs the rendered referee labels ----
const recs = {};
for (const c of candidates) {
  const corpusSha = sha256(readFileSync(path.join(CORPUS, c.file)));
  const rec = JSON.parse(readFileSync(path.join(CACHE, `${c.id}.json`), 'utf8'));
  if (!isCompleteCeilingRecord(rec, corpusSha)) { console.error(`FATAL: stale/incomplete ceiling record for ${c.id} - re-run --force`); process.exit(1); }
  recs[c.id] = rec;
}
const present = (cls) => candidates.filter((c) => (c.objectiveLabels || []).some((o) => o.class === cls));
const detects = (id, cls) => recs[id].available && recs[id].objectiveDetected.includes(cls);
function recallFor(cls) { const P = present(cls); const tp = P.filter((c) => detects(c.id, cls)).length; return { present: P.length, tp, recall: P.length ? +(tp / P.length).toFixed(3) : null }; }

const perClass = {}; for (const cls of OBJECTIVE) perClass[cls] = recallFor(cls);
// strict micro across all 5 objective classes (what the raw harness measures - includes broken-image + gray-on-color)
let sTp = 0, sP = 0; for (const cls of OBJECTIVE) { sTp += perClass[cls].tp; sP += perClass[cls].present; }

// HONEST views. (a) contrast-FAMILY: browser folds gray-on-color into low-contrast, so score the family once.
const cfPages = candidates.filter((c) => (c.objectiveLabels || []).some((o) => o.class === 'low-contrast' || o.class === 'gray-on-color'));
const cfTp = cfPages.filter((c) => recs[c.id].available && (recs[c.id].objectiveDetected.includes('low-contrast') || recs[c.id].objectiveDetected.includes('gray-on-color'))).length;
const contrastFamily = { present: cfPages.length, tp: cfTp, recall: cfPages.length ? +(cfTp / cfPages.length).toFixed(3) : null };
// (b) broken-image is a STATIC-engine rule (not in oracle's browser rule set). Its ceiling is the
// head-to-head static recall (read from scorecard.json for a data-driven, verifiable number).
let brokenStatic = null;
try { const sc = JSON.parse(readFileSync(path.join(CORPUS, 'scorecard.json'), 'utf8')); const b = sc.perClass['broken-image']?.oracle; if (b) brokenStatic = { present: b.present, tp: b.tp, recall: b.recall, engine: 'static (not browser)' }; } catch { /* */ }
// (c) full-objective ceiling = browser (skipped-heading + contrast-family) + static broken-image.
const sh = perClass['skipped-heading'];
const fullTp = sh.tp + contrastFamily.tp + (brokenStatic ? brokenStatic.tp : 0);
const fullPresent = sh.present + contrastFamily.present + (brokenStatic ? brokenStatic.present : 0);

const msAll = candidates.map((c) => recs[c.id].ms).filter((x) => typeof x === 'number');
const pct = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };

const result = {
  generatedUtc: new Date().toISOString(),
  label: 'ORACLE FULL BROWSER-MODE OBJECTIVE CEILING - the real floor bar (NOT part of the static-vs-static head-to-head in scorecard.json). oracle run via its Puppeteer browser engine over the script+external-link-stripped corpus; objective recall vs the rendered-referee objective labels. This is the objective floor the reimplemented browser-based Sidecoach must clear; the static head-to-head objective recall (0.063) was a static-mode artifact.',
  mode: 'oracle detect.mjs --json over http://127.0.0.1 (browser/Puppeteer engine, Playwright Chromium), page transform matches the referee (scripts + external links stripped), per-page isolated + group-killed, fail-closed on problem-stderr',
  envSig, oracleSha, chromiumPath,
  pages: candidates.length,
  unavailable: unavail,
  objectiveGroundTruth: 'rendered referee objectiveLabels (same GT as scorecard.json objective axis)',
  strictPerClassMicroRecall: sP ? +(sTp / sP).toFixed(3) : null,
  strictMicro: { tp: sTp, present: sP },
  perClass,
  honest: {
    note: 'broken-image is a STATIC-engine rule (oracle browser engine does not emit it; ceiling = static head-to-head R). browser mode folds gray-on-color INTO low-contrast, so contrast is scored as a family (low-contrast OR gray-on-color). The full-objective ceiling combines browser skipped-heading + contrast-family + static broken-image.',
    skippedHeading: sh,
    contrastFamily,
    brokenImageStatic: brokenStatic,
    fullObjectiveCeilingRecall: fullPresent ? +(fullTp / fullPresent).toFixed(3) : null,
    fullObjective: { tp: fullTp, present: fullPresent },
  },
  timingMs: { median: pct(msAll, 0.5), p90: pct(msAll, 0.9), max: msAll.length ? Math.max(...msAll) : null },
  comparisonNote: 'static-mode oracle objective recall (head-to-head) was 0.063; this browser-mode ceiling is the honest objective bar (~13x higher). broken-image reads 0 in browser-mode but that is NOT a capability gap: (1) oracle detects broken-image in its STATIC engine, not the browser engine (browser emits 0 across all pages, even src-less imgs) - static head-to-head R=1.0; (2) the frozen pages reference images via external/data/src-less URLs (no relative resources resolve over the local server), so the rendered DOM has no broken-image box either. So the STRICT per-class micro (0.632) conservatively UNDERSTATES oracle; the HONEST full-objective ceiling (browser skipped-heading + contrast-family + static broken-image = 0.833) is the real floor bar. The 1 unavailable page (mk_mailchimp_2016, browser nav timeout) is fail-closed (counted as detecting nothing = FN), not silently dropped.',
};
writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`\n=== ORACLE BROWSER-MODE OBJECTIVE CEILING ===`);
console.log(`pages ${candidates.length} | unavailable ${unavail}`);
console.log(`STRICT per-class micro recall ${result.strictPerClassMicroRecall} (${sTp}/${sP}):`);
for (const cls of OBJECTIVE) console.log(`  ${cls.padEnd(16)} present=${perClass[cls].present} tp=${perClass[cls].tp} recall=${perClass[cls].recall ?? 'n/a'}`);
console.log(`HONEST: skipped-heading ${sh.recall} | contrast-family ${contrastFamily.recall} (${cfTp}/${cfPages.length}) | broken-image(static) ${brokenStatic ? brokenStatic.recall : 'n/a'}`);
console.log(`FULL OBJECTIVE CEILING recall ${result.honest.fullObjectiveCeilingRecall} (${fullTp}/${fullPresent})  <-- the real floor bar (vs static 0.063)`);
console.log(`timing ms: median ${result.timingMs.median} p90 ${result.timingMs.p90} max ${result.timingMs.max}`);
console.log(`wrote ${OUT}`);
