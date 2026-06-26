#!/usr/bin/env node
/**
 * Stage 5a REBUILD: capture a DIVERSE, REGISTER-BALANCED extension to the dev corpus for marketing-buzzword
 * generalization. The v1 dev corpus was 21 homogeneous SaaS-marketing landing pages; the frozen 90 spans
 * editorial/docs/dashboard/data/gov registers too, so the v1 prominent-cluster operating point overfit.
 *
 * This adds ~20 NEW pages spanning ALL registers the v1 corpus lacked - marketing/AI/crypto/consulting
 * (buzzword-likely) AND editorial/docs/gov-data/dashboard/concrete-product (concrete-likely) - so the detector
 * can be calibrated against a representative distribution.
 *
 * HELD-OUT DISCIPLINE (unchanged): pages are sampled RULE-AGNOSTICALLY by REGISTER (chosen for register coverage,
 * NOT for detectability), DISJOINT from the frozen 90 (host + content-sha, fail-closed) AND from the existing dev
 * hosts. Captured self-contained (CSS inlined, scripts stripped). NOT labeled here (author != labeler; the lead
 * runs the Codex labeling pass over the captured HTML). Appends to dev-manifest.json.
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

// DISJOINTNESS basis (frozen 90): content hashes + provenance hosts.
const evalManifest = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
const evalShas = new Set(evalManifest.map((c) => sha256(readFileSync(path.join(CORPUS, c.file)))));
const evalHosts = new Set(evalManifest.map((c) => hostOf((c.provenance && (c.provenance.source || c.provenance.url)) || '')).filter(Boolean));
// also avoid existing dev hosts (don't recapture the v1 set)
const devManPath = path.join(CORPUS, 'dev-manifest.json');
const devMan = existsSync(devManPath) ? JSON.parse(readFileSync(devManPath, 'utf8')) : { pages: [] };
const existingDevHosts = new Set((devMan.pages || []).map((p) => p.host).filter(Boolean));
const existingIds = new Set((devMan.pages || []).map((p) => p.id));

// REGISTER-BALANCED, rule-agnostic sample. Tagged with register only for capture diversity bookkeeping (NOT a label).
const PAGES = [
  // marketing SaaS (register: marketing)
  ['monday', 'https://monday.com/', 'marketing'],
  ['asana', 'https://asana.com/', 'marketing'],
  ['airtable', 'https://www.airtable.com/', 'marketing'],
  ['segment', 'https://segment.com/', 'marketing'],
  ['amplitude', 'https://amplitude.com/', 'marketing'],
  ['gong', 'https://www.gong.io/', 'marketing'],
  ['twilio', 'https://www.twilio.com/', 'marketing'],
  ['databricks', 'https://www.databricks.com/', 'marketing'],
  // AI startups (register: marketing-ai)
  ['jasper', 'https://www.jasper.ai/', 'marketing-ai'],
  ['copyai', 'https://www.copy.ai/', 'marketing-ai'],
  ['scale', 'https://scale.com/', 'marketing-ai'],
  // crypto/web3 (register: marketing-crypto)
  ['solana', 'https://solana.com/', 'marketing-crypto'],
  ['polygon', 'https://polygon.technology/', 'marketing-crypto'],
  // consulting/enterprise (register: marketing-enterprise)
  ['accenture', 'https://www.accenture.com/us-en', 'marketing-enterprise'],
  ['sap', 'https://www.sap.com/index.html', 'marketing-enterprise'],
  // editorial/blog (register: editorial)
  ['overreacted', 'https://overreacted.io/', 'editorial'],
  ['arstechnica', 'https://arstechnica.com/', 'editorial'],
  ['martinfowler', 'https://martinfowler.com/', 'editorial'],
  // docs (register: docs)
  ['nextjs-docs', 'https://nextjs.org/docs', 'docs'],
  ['postgres-docs', 'https://www.postgresql.org/docs/current/tutorial-start.html', 'docs'],
  ['redis-docs', 'https://redis.io/docs/latest/', 'docs'],
  // gov/data (register: gov-data)
  ['census', 'https://www.census.gov/', 'gov-data'],
  ['bls', 'https://www.bls.gov/', 'gov-data'],
  ['nasa', 'https://www.nasa.gov/', 'gov-data'],
  // dashboard/app templates (register: dashboard)
  ['flowbite', 'https://flowbite.com/', 'dashboard'],
  ['coreui', 'https://coreui.io/', 'dashboard'],
  // concrete product (register: product)
  ['tailscale', 'https://tailscale.com/', 'product'],
  ['ghost', 'https://ghost.org/', 'product'],
  ['onepassword', 'https://1password.com/', 'product'],
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
const newRecords = [], overlaps = [];
try {
  for (const [id, url, register] of PAGES) {
    const h = hostOf(url);
    if (existingIds.has(id)) { console.error(`  SKIP ${id}: id already in dev`); continue; }
    if (evalHosts.has(h)) { overlaps.push(`${id}: host ${h} in eval 90`); continue; }
    if (existingDevHosts.has(h)) { console.error(`  SKIP ${id}: host ${h} already in dev`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: 'Mozilla/5.0 (sidecoach-dev-corpus)' });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      const html = await captureSelfContained(page);
      const contentSha = sha256(html);
      if (evalShas.has(contentSha)) { overlaps.push(`${id}: content-sha in eval 90`); await ctx.close(); continue; }
      writeFileSync(path.join(DEV, `${id}.html`), html);
      newRecords.push({ id, url, host: h, register, contentSha, bytes: html.length });
      console.error(`  ${id} (${register}): ${html.length} bytes`);
    } catch (e) { console.error(`  FAIL ${id}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); newRecords.push({ id, url, host: h, register, failed: true }); }
    finally { await ctx.close(); }
  }
} finally { await browser.close(); }

if (overlaps.length) { console.error(`FATAL: new dev pages not disjoint from eval 90:\n  ${overlaps.join('\n  ')}`); process.exit(1); }
const ok = newRecords.filter((r) => !r.failed);
// append to the manifest (dedupe by id)
const merged = [...(devMan.pages || []).filter((p) => !newRecords.some((n) => n.id === p.id)), ...newRecords];
writeFileSync(devManPath, JSON.stringify({ ...devMan, generatedUtc: new Date().toISOString(), note: (devMan.note || '') + ' | EXTENDED 2026-06-25 with a register-diverse set for marketing-buzzword generalization (disjoint host+sha, fail-closed).', captured: merged.filter((p) => !p.failed).length, pages: merged }, null, 2) + '\n');
console.log(`\nDIVERSE DEV CAPTURE: ${ok.length}/${PAGES.length} new self-contained pages -> ${DEV}; manifest appended. Disjointness OK (0 overlap with frozen 90).`);
console.log('NEW PAGES:', ok.map((r) => `${r.id}(${r.register})`).join(', '));
