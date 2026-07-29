#!/usr/bin/env node
/**
 * M1b - RENDERED SCREENSHOTS FOR THE SECONDARY VISUAL JUDGE. FAIL-CLOSED.
 *
 * Codex's design review said source-only judging is weak for design quality, so a second judging
 * pass looks at the rendered page. This renders each judged pair to PNG.
 *
 * `--fullpage` captures the WHOLE page instead of the first 1600px. That variant was added AFTER
 * the viewport-framed result was seen, so anything it produces is EXPLORATORY by the
 * pre-registration's own rule. It exists because the framed result may be an artefact of the
 * framing: a spacious page shows less of the brief's content in a fixed viewport, and the judge's
 * first rubric item is content delivery. Checking that is interrogating a result that currently
 * runs AGAINST sidecoach, not rescuing one that favours it.
 *
 * BLINDING IS IN THE FILENAME. Shots are written as `<id>.A.png` / `<id>.B.png` using the side
 * assignment already committed in judge/assignment.json, so the arm never appears in any path the
 * visual judge sees. Writing them under pages/S and pages/P and "just remembering" which is which
 * would put the answer in front of the judge.
 *
 * EXIT CODES
 *   0  every requested pair rendered
 *   1  usage
 *   2  assignment.json missing
 *   3  a page failed to render - no partial set is left behind for a judge to score
 *   4  filesystem failure
 */
import { readFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { TRIAL_ROOT } from './lib/briefs.mjs';

const EXIT = { OK: 0, USAGE: 1, MISSING: 2, RENDER: 3, IO: 4 };
const die = (code, msg) => { console.error(`shoot: ${msg}`); process.exit(code); };
const VIEWPORT = { width: 1280, height: 1600 };

async function main() {
  const args = process.argv.slice(2);
  let contrast = 'S-vs-P';
  let fullPage = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--contrast') contrast = args[++i];
    else if (args[i] === '--fullpage') fullPage = true;
    else if (args[i] === '-h' || args[i] === '--help') { console.log('Usage: node shoot.mjs [--contrast S-vs-P] [--fullpage]'); process.exit(EXIT.OK); }
    else die(EXIT.USAGE, `unknown arg ${args[i]}`);
  }

  const aPath = path.join(TRIAL_ROOT, 'judge', 'assignment.json');
  if (!existsSync(aPath)) die(EXIT.MISSING, `${aPath} not found - run judge-prompt.mjs first`);
  const rows = JSON.parse(readFileSync(aPath, 'utf8')).rows.filter((r) => r.contrast === contrast);
  if (rows.length === 0) die(EXIT.MISSING, `no rows for contrast ${contrast}`);

  const outDir = path.join(TRIAL_ROOT, 'judge', fullPage ? 'shots-fullpage' : 'shots', contrast);
  rmSync(outDir, { recursive: true, force: true });
  try { mkdirSync(outDir, { recursive: true }); } catch (e) { die(EXIT.IO, `creating ${outDir}: ${e.message}`); }

  const browser = await chromium.launch();
  let shot = 0;
  try {
    for (const row of rows) {
      for (const side of ['A', 'B']) {
        const arm = row[side];
        const file = path.join(TRIAL_ROOT, 'pages', arm, `${row.id}.html`);
        if (!existsSync(file)) { await browser.close(); die(EXIT.MISSING, `page ${file} not found`); }
        const ctx = await browser.newContext({ viewport: VIEWPORT });
        const page = await ctx.newPage();
        try {
          await page.goto(`file://${file}`, { waitUntil: 'load', timeout: 30000 });
          await page.screenshot({ path: path.join(outDir, `${row.id}.${side}.png`), fullPage });
        } catch (e) {
          await ctx.close(); await browser.close();
          die(EXIT.RENDER, `render failed for ${row.id} side ${side}: ${e.message}`);
        }
        await ctx.close();
        shot++;
      }
    }
  } finally { await browser.close(); }

  if (shot !== rows.length * 2) die(EXIT.RENDER, `wrote ${shot} shots, expected ${rows.length * 2}`);
  console.log(`shoot: OK - ${shot} screenshots for ${contrast} at ${VIEWPORT.width}x${fullPage ? 'full-page' : VIEWPORT.height} in judge/${fullPage ? 'shots-fullpage' : 'shots'}/${contrast}/`);
  console.log('  filenames carry the blinded side (A/B) only; no arm label appears in any path the judge sees');
  process.exit(EXIT.OK);
}

main();
