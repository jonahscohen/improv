#!/usr/bin/env node
/**
 * Stage 1 ST0: capture a SELF-CONTAINED defect-bearing DEV CORPUS for the subjective/taste frontier.
 *
 * Held-out discipline (lead conditions): pages are sampled RULE-AGNOSTICALLY (a fixed list of taste-idiom-likely
 * real pages - modern SaaS/startup/landing/design sites - chosen BEFORE any detector exists; NO detectability
 * pre-filter), and the corpus is DISJOINT from the frozen eval 90 (URL + content-hash, fail-closed). Unlike the
 * M1 raw-curl attempt, each page is captured SELF-CONTAINED: Playwright loads it with resources, then the linked
 * stylesheets are fetched + INLINED and <script> stripped, so the saved HTML renders STYLED under the referee's
 * external-abort render (visual taste idioms need styling). Labeling (Codex, all 22 classes) is a SEPARATE step
 * run BEFORE any rule is written (author!=labeler).
 *
 * Output: corpus/dev/<id>.html (self-contained captures). The dev corpus is the DEV SIGNAL, never the held-out bar.
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

// DISJOINTNESS basis (frozen 90): content hashes + provenance hosts.
const evalManifest = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8'));
const evalShas = new Set(evalManifest.map((c) => sha256(readFileSync(path.join(CORPUS, c.file)))));
const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch { return ''; } };
const evalHosts = new Set(evalManifest.map((c) => hostOf((c.provenance && (c.provenance.source || c.provenance.url)) || '')).filter(Boolean));

// Rule-agnostic taste-idiom-likely sample (modern SaaS/startup/landing/design sites), DISJOINT hosts from the 90.
// Chosen for "likely to exhibit taste idioms" as a class, NOT for any specific detector - no detectability filter.
const PAGES = [
  ['linear', 'https://linear.app/'],
  ['framer', 'https://www.framer.com/'],
  ['webflow', 'https://webflow.com/'],
  ['loom', 'https://www.loom.com/'],
  ['retool', 'https://retool.com/'],
  ['clerk', 'https://clerk.com/'],
  ['resend', 'https://resend.com/'],
  ['railway', 'https://railway.app/'],
  ['render', 'https://render.com/'],
  ['supabase', 'https://supabase.com/'],
  ['posthog', 'https://posthog.com/'],
  ['calcom', 'https://cal.com/'],
  ['dub', 'https://dub.co/'],
  ['raycast', 'https://www.raycast.com/'],
  ['planetscale', 'https://planetscale.com/'],
  ['neon', 'https://neon.tech/'],
  ['upstash', 'https://upstash.com/'],
  ['liveblocks', 'https://liveblocks.io/'],
  ['trigger', 'https://trigger.dev/'],
  ['inngest', 'https://www.inngest.com/'],
  ['knock', 'https://knock.app/'],
  ['hightouch', 'https://hightouch.com/'],
  ['mintlify', 'https://mintlify.com/'],
  ['warp', 'https://www.warp.dev/'],
  ['fly', 'https://fly.io/'],
];

// In-page: inline cross-origin <link rel=stylesheet> (fetched text) into <style>, strip scripts, return HTML.
async function captureSelfContained(page) {
  // fetch + inline each linked stylesheet (cross-origin cssRules are CORS-blocked, so fetch the text)
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
const records = [], overlaps = [];
try {
  for (const [id, url] of PAGES) {
    const h = hostOf(url);
    if (evalHosts.has(h)) { overlaps.push(`${id}: host ${h} in eval 90`); continue; }
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: 'Mozilla/5.0 (sidecoach-dev-corpus)' });
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      const html = await captureSelfContained(page);
      const contentSha = sha256(html);
      if (evalShas.has(contentSha)) { overlaps.push(`${id}: content-sha in eval 90`); }
      const fp = path.join(DEV, `${id}.html`);
      writeFileSync(fp, html);
      records.push({ id, url, host: h, contentSha, bytes: html.length });
      console.error(`  ${id}: ${html.length} bytes`);
    } catch (e) { console.error(`  FAIL ${id}: ${e instanceof Error ? e.message.split('\n')[0] : e}`); records.push({ id, url, host: h, failed: true }); }
    finally { await ctx.close(); }
  }
} finally { await browser.close(); }

if (overlaps.length) { console.error(`FATAL: dev corpus not disjoint from eval 90:\n  ${overlaps.join('\n  ')}`); process.exit(1); }
const ok = records.filter((r) => !r.failed);
writeFileSync(path.join(CORPUS, 'dev-manifest.json'), JSON.stringify({ generatedUtc: new Date().toISOString(), note: 'self-contained taste dev corpus; rule-agnostic sample; disjoint from the frozen 90 (host + content-sha, fail-closed). DEV SIGNAL, not the held-out bar. Codex-labels all 22 classes BEFORE any detector (author!=labeler).', captured: ok.length, pages: records }, null, 2) + '\n');
console.log(`\nDEV CORPUS CAPTURED: ${ok.length}/${PAGES.length} self-contained pages -> ${DEV} ; manifest written. Disjointness OK (0 overlap).`);
