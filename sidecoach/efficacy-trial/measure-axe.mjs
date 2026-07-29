#!/usr/bin/env node
/**
 * M2 - INDEPENDENT OBJECTIVE MEASURE. FAIL-CLOSED.
 *
 * Runs axe-core 4.12.1 (Deque's WCAG engine) over every collected page in Playwright Chromium via
 * file://, and records the violation count per page.
 *
 * WHY AXE AND NOT OUR OWN SCANNER: PREREGISTRATION.md section 3. The trial's whole point is that
 * sidecoach's detectors cannot fairly grade work produced under sidecoach's own guidance. axe
 * shares no code with this repo, its rule set predates it, and nothing here can tune it. It is
 * pinned in this directory's package.json so the number can be re-derived.
 *
 * WHAT IT DOES NOT MEASURE: design quality. An axe delta means "more or less accessible", and the
 * results must say exactly that.
 *
 * EXIT CODES
 *   0  every collected page measured; measurements/axe.json written
 *   1  usage
 *   2  results/collection.json missing (collect.mjs has not run)
 *   3  a page failed to load or axe failed to run on it - NO partial result is written
 *   4  filesystem failure
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { TRIAL_ROOT } from './lib/briefs.mjs';

const EXIT = { OK: 0, USAGE: 1, NO_COLLECTION: 2, SCAN: 3, IO: 4 };
const die = (code, msg) => { console.error(`measure-axe: ${msg}`); process.exit(code); };
const ARMS = ['C', 'P', 'S'];
const AXE_SOURCE = path.join(TRIAL_ROOT, 'node_modules', 'axe-core', 'axe.min.js');

async function main() {
  if (process.argv.length > 2) die(EXIT.USAGE, `takes no arguments, got: ${process.argv.slice(2).join(' ')}`);
  const collPath = path.join(TRIAL_ROOT, 'results', 'collection.json');
  if (!existsSync(collPath)) die(EXIT.NO_COLLECTION, `${collPath} not found - run collect.mjs first`);
  if (!existsSync(AXE_SOURCE)) die(EXIT.IO, `${AXE_SOURCE} not found - run npm install in ${TRIAL_ROOT}`);
  const collection = JSON.parse(readFileSync(collPath, 'utf8'));
  const ids = collection.completeTriples;
  if (ids.length === 0) die(EXIT.NO_COLLECTION, 'collection.json reports 0 complete triples - nothing to measure');

  const axeSource = readFileSync(AXE_SOURCE, 'utf8');
  const axeVersion = JSON.parse(readFileSync(path.join(TRIAL_ROOT, 'node_modules', 'axe-core', 'package.json'), 'utf8')).version;

  const browser = await chromium.launch();
  const out = { measuredAt: new Date().toISOString(), tool: `axe-core@${axeVersion}`, viewport: { width: 1280, height: 900 }, pages: [] };

  try {
    for (const id of ids) {
      for (const arm of ARMS) {
        const file = path.join(TRIAL_ROOT, 'pages', arm, `${id}.html`);
        const ctx = await browser.newContext({ viewport: out.viewport });
        const page = await ctx.newPage();
        let res;
        try {
          await page.goto(`file://${file}`, { waitUntil: 'load', timeout: 30000 });
          await page.addScriptTag({ content: axeSource });
          res = await page.evaluate(async () => {
            /* global axe */
            const r = await axe.run(document, { resultTypes: ['violations'] });
            return {
              violations: r.violations.length,
              nodes: r.violations.reduce((a, v) => a + v.nodes.length, 0),
              byImpact: r.violations.reduce((acc, v) => { acc[v.impact || 'unknown'] = (acc[v.impact || 'unknown'] || 0) + 1; return acc; }, {}),
              rules: r.violations.map((v) => v.id).sort(),
            };
          });
        } catch (e) {
          await ctx.close();
          await browser.close();
          die(EXIT.SCAN, `axe failed on ${arm}/${id}: ${e.message} - refusing to write a partial measurement`);
        }
        await ctx.close();
        out.pages.push({ id, arm, ...res });
      }
    }
  } finally { await browser.close(); }

  const expected = ids.length * ARMS.length;
  if (out.pages.length !== expected) die(EXIT.SCAN, `measured ${out.pages.length} pages, expected ${expected}`);

  try {
    mkdirSync(path.join(TRIAL_ROOT, 'measurements'), { recursive: true });
    writeFileSync(path.join(TRIAL_ROOT, 'measurements', 'axe.json'), `${JSON.stringify(out, null, 2)}\n`);
  } catch (e) { die(EXIT.IO, `writing axe.json: ${e.message}`); }

  const mean = (arm) => out.pages.filter((p) => p.arm === arm).reduce((a, p) => a + p.violations, 0) / ids.length;
  console.log(`measure-axe: OK - ${out.pages.length} pages via ${out.tool}`);
  for (const arm of ARMS) console.log(`  arm ${arm}: mean violations ${mean(arm).toFixed(2)}`);
  process.exit(EXIT.OK);
}

main();
