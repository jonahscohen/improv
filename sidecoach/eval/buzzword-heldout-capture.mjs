#!/usr/bin/env node
/**
 * Stage 5a v3: capture a FRESH HELD-OUT for marketing-buzzword PRECISION. The frozen-90 is SPENT (measured twice);
 * v3's precision fix is developed on DEV and must be measured on a FRESH held-out. ~36 NEW diverse real pages,
 * DISJOINT from BOTH the dev corpus (48) AND the frozen-90 (host + content-sha, fail-closed). DELIBERATELY loaded
 * with the FP MODE (marketing vocabulary used CONCRETELY): science/research orgs ("groundbreaking discoveries"),
 * developer-infra ("powerful/scalable/performant" real features), gov/data - the cases that test precision - PLUS
 * clear marketing/AI/crypto fluff (recall) and editorial/docs (clean negatives).
 *
 * HTML ONLY. The author does NOT label or develop against this (author!=labeler / held-out discipline). Writes to
 * eval/corpus/buzzword-heldout/ + buzzword-heldout-manifest.json. The LEAD runs the Codex labeling + the measurement.
 */
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const OUT = path.join(CORPUS, 'buzzword-heldout');
mkdirSync(OUT, { recursive: true });
const sha256 = (s) => createHash('sha256').update(s).digest('hex');
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const MIN_BYTES = 12000;

const evalManifest = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
const evalShas = new Set(evalManifest.map((c) => sha256(readFileSync(path.join(CORPUS, c.file)))));
const evalHosts = new Set(evalManifest.map((c) => hostOf((c.provenance && (c.provenance.source || c.provenance.url)) || '')).filter(Boolean));
const devMan = JSON.parse(readFileSync(path.join(CORPUS, 'dev-manifest.json'), 'utf8'));
const devHosts = new Set((devMan.pages || []).map((p) => p.host).filter(Boolean));

const PAGES = [
  // FP-MODE HARD CASES: science/research (superlatives used concretely about real discoveries)
  ['mit', 'https://www.mit.edu/', 'science'], ['caltech', 'https://www.caltech.edu/', 'science'],
  ['cern', 'https://home.cern/', 'science'], ['nih', 'https://www.nih.gov/', 'science'],
  ['noaa', 'https://www.noaa.gov/', 'science'], ['esa', 'https://www.esa.int/', 'science'],
  // FP-MODE: developer-infra (powerful/scalable/performant/advanced = real technical features)
  ['cloudflare', 'https://www.cloudflare.com/', 'infra'], ['hashicorp', 'https://www.hashicorp.com/', 'infra'],
  ['mongodb', 'https://www.mongodb.com/', 'infra'], ['cockroachlabs', 'https://www.cockroachlabs.com/', 'infra'],
  ['grafana', 'https://grafana.com/', 'infra'], ['sentry', 'https://sentry.io/', 'infra'],
  ['temporal', 'https://temporal.io/', 'infra'], ['fastly', 'https://www.fastly.com/', 'infra'],
  // enterprise (innovative/enterprise-grade - mixed concrete/fluff)
  ['gitlab', 'https://about.gitlab.com/', 'enterprise'], ['atlassian', 'https://www.atlassian.com/', 'enterprise'],
  ['redhat', 'https://www.redhat.com/en', 'enterprise'],
  // gov/data (concrete negatives)
  ['usgs', 'https://www.usgs.gov/', 'gov-data'], ['weather', 'https://www.weather.gov/', 'gov-data'],
  ['sec', 'https://www.sec.gov/', 'gov-data'], ['federalreserve', 'https://www.federalreserve.gov/', 'gov-data'],
  // clear marketing fluff (positives)
  ['clickup', 'https://clickup.com/', 'marketing'], ['miro', 'https://miro.com/', 'marketing'],
  ['mailchimp', 'https://mailchimp.com/', 'marketing'], ['intercom', 'https://www.intercom.com/', 'marketing'],
  ['zendesk', 'https://www.zendesk.com/', 'marketing'], ['wix', 'https://www.wix.com/', 'marketing'],
  // AI fluff (positives)
  ['openai', 'https://openai.com/', 'marketing-ai'], ['cohere', 'https://cohere.com/', 'marketing-ai'],
  ['huggingface', 'https://huggingface.co/', 'marketing-ai'], ['perplexity', 'https://www.perplexity.ai/', 'marketing-ai'],
  ['mistral', 'https://mistral.ai/', 'marketing-ai'],
  // crypto (mixed)
  ['coinbase', 'https://www.coinbase.com/', 'marketing-crypto'], ['arbitrum', 'https://arbitrum.io/', 'marketing-crypto'],
  // editorial/docs (clean negatives)
  ['danluu', 'https://danluu.com/', 'editorial'], ['jvns', 'https://jvns.ca/', 'editorial'],
  ['simonwillison', 'https://simonwillison.net/', 'editorial'], ['deno-docs', 'https://docs.deno.com/runtime/', 'docs'],
  ['bun-docs', 'https://bun.sh/docs', 'docs'], ['vite-docs', 'https://vitejs.dev/guide/', 'docs'],
];

async function captureSelfContained(page) {
  const links = await page.$$eval('link[rel~="stylesheet"][href]', (ls) => ls.map((l) => l.href));
  const cssTexts = [];
  for (const href of links) { try { const r = await page.request.get(href, { timeout: 15000 }); if (r.ok()) cssTexts.push(await r.text()); } catch { /* */ } }
  return await page.evaluate((cssTexts) => {
    for (const l of Array.from(document.querySelectorAll('link[rel~="stylesheet"][href]'))) l.remove();
    for (const s of Array.from(document.querySelectorAll('script'))) s.remove();
    if (cssTexts.length) { const st = document.createElement('style'); st.textContent = cssTexts.join('\n'); document.head.appendChild(st); }
    return '<!doctype html>\n' + document.documentElement.outerHTML;
  }, cssTexts);
}

const browser = await chromium.launch({ headless: true });
const recs = [], overlaps = [];
try {
  for (const [id, url, register] of PAGES) {
    const h = hostOf(url);
    if (evalHosts.has(h)) { overlaps.push(`${id}: host ${h} in frozen-90`); continue; }
    if (devHosts.has(h)) { overlaps.push(`${id}: host ${h} in dev`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: 'Mozilla/5.0 (sidecoach-heldout)' });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(5000);
      const html = await captureSelfContained(page);
      if (html.length < MIN_BYTES) { console.error(`  DROP ${id}: ${html.length}b stub`); await ctx.close(); continue; }
      const contentSha = sha256(html);
      if (evalShas.has(contentSha)) { overlaps.push(`${id}: content-sha in frozen-90`); await ctx.close(); continue; }
      writeFileSync(path.join(OUT, `${id}.html`), html);
      recs.push({ id, url, host: h, register, contentSha, bytes: html.length });
      console.error(`  ${id} (${register}): ${html.length}b`);
    } catch (e) { console.error(`  FAIL ${id}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); }
    finally { await ctx.close(); }
  }
} finally { await browser.close(); }

if (overlaps.length) { console.error(`FATAL: held-out not disjoint:\n  ${overlaps.join('\n  ')}`); process.exit(1); }
writeFileSync(path.join(CORPUS, 'buzzword-heldout-manifest.json'), JSON.stringify({ generatedUtc: new Date().toISOString(), note: 'FRESH held-out for marketing-buzzword v3 precision. Disjoint from dev(48)+frozen-90 (host+sha, fail-closed). FP-mode-loaded (marketing vocab used concretely). Author does NOT label/develop against it.', captured: recs.length, pages: recs }, null, 2) + '\n');
console.log(`\nHELD-OUT CAPTURED: ${recs.length}/${PAGES.length} pages -> ${OUT}; disjointness OK (frozen-90 + dev).`);
console.log('PAGES:', recs.map((r) => `${r.id}(${r.register})`).join(', '));
