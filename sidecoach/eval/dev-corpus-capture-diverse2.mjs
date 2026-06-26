#!/usr/bin/env node
/**
 * Stage 5a REBUILD - pass 2: re-capture the pages that FAILED pass 1's networkidle wait (heavy marketing/AI SPAs
 * that never reach networkidle) using a robust wait (domcontentloaded + fixed settle). Same disjointness gate +
 * manifest append + a MIN_BYTES guard (drop redirect/consent stubs). Recovers the buzzword-positive marketing/AI/
 * crypto pages the diverse corpus needs for recall calibration.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const DEV = path.join(CORPUS, 'dev');
mkdirSync(DEV, { recursive: true });
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const MIN_BYTES = 12000; // below this = a redirect/consent/JS-required stub, not real content

const evalManifest = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
const evalShas = new Set(evalManifest.map((c) => sha256(readFileSync(path.join(CORPUS, c.file)))));
const evalHosts = new Set(evalManifest.map((c) => hostOf((c.provenance && (c.provenance.source || c.provenance.url)) || '')).filter(Boolean));
const devManPath = path.join(CORPUS, 'dev-manifest.json');
const devMan = JSON.parse(readFileSync(devManPath, 'utf8'));

// the pass-1 failures + the two junk stubs (sap/bls) to retry robustly
const PAGES = [
  ['monday', 'https://monday.com/', 'marketing'],
  ['asana', 'https://asana.com/', 'marketing'],
  ['segment', 'https://segment.com/', 'marketing'],
  ['twilio', 'https://www.twilio.com/', 'marketing'],
  ['jasper', 'https://www.jasper.ai/', 'marketing-ai'],
  ['copyai', 'https://www.copy.ai/', 'marketing-ai'],
  ['scale', 'https://scale.com/', 'marketing-ai'],
  ['solana', 'https://solana.com/', 'marketing-crypto'],
  ['sap', 'https://www.sap.com/', 'marketing-enterprise'],
  ['bls', 'https://www.bls.gov/', 'gov-data'],
  ['redis-docs', 'https://redis.io/docs/latest/', 'docs'],
  ['tailscale', 'https://tailscale.com/', 'product'],
];

async function captureSelfContained(page) {
  const links = await page.$$eval('link[rel~="stylesheet"][href]', (ls) => ls.map((l) => l.href));
  const cssTexts = [];
  for (const href of links) {
    try { const r = await page.request.get(href, { timeout: 15000 }); if (r.ok()) cssTexts.push(await r.text()); } catch { /* skip */ }
  }
  return await page.evaluate((cssTexts) => {
    for (const l of Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))) l.remove();
    for (const s of Array.from(document.querySelectorAll('script'))) s.remove();
    if (cssTexts.length) { const st = document.createElement('style'); st.textContent = cssTexts.join('\n'); document.head.appendChild(st); }
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  }, cssTexts);
}

const browser = await chromium.launch({ headless: true });
const got = [], overlaps = [];
try {
  for (const [id, url, register] of PAGES) {
    const h = hostOf(url);
    if (evalHosts.has(h)) { overlaps.push(`${id}: host ${h} in eval 90`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: 'Mozilla/5.0 (sidecoach-dev-corpus)' });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(5000); // let the SPA render without requiring networkidle
      const html = await captureSelfContained(page);
      if (html.length < MIN_BYTES) { console.error(`  DROP ${id}: only ${html.length} bytes (stub)`); await ctx.close(); continue; }
      const contentSha = sha256(html);
      if (evalShas.has(contentSha)) { overlaps.push(`${id}: content-sha in eval 90`); await ctx.close(); continue; }
      writeFileSync(path.join(DEV, `${id}.html`), html);
      got.push({ id, url, host: h, register, contentSha, bytes: html.length });
      console.error(`  ${id} (${register}): ${html.length} bytes`);
    } catch (e) { console.error(`  FAIL ${id}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); }
    finally { await ctx.close(); }
  }
} finally { await browser.close(); }

if (overlaps.length) { console.error(`FATAL: not disjoint:\n  ${overlaps.join('\n  ')}`); process.exit(1); }
// merge into manifest (replace any prior failed record for these ids)
const merged = [...(devMan.pages || []).filter((p) => !got.some((n) => n.id === p.id)), ...got];
writeFileSync(devManPath, JSON.stringify({ ...devMan, generatedUtc: new Date().toISOString(), captured: merged.filter((p) => !p.failed).length, pages: merged }, null, 2) + '\n');
console.log(`\nPASS 2: recovered ${got.length} pages -> ${DEV}; manifest merged.`);
console.log('RECOVERED:', got.map((r) => `${r.id}(${r.register})`).join(', '));
