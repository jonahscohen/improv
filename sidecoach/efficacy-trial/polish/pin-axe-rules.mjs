#!/usr/bin/env node
/**
 * PIN THE AXE RULE UNIVERSE. FAIL-CLOSED. Run ONCE, before any page of this sub-trial exists.
 *
 * PREREGISTRATION.md 3.3 (v1 review, change 7): the named/unnamed split must be defined by explicit
 * rule ID against a frozen universe, never by a residual "everything else axe happens to report",
 * which would let the unnamed set shift silently as pages vary.
 *
 * Writes `axe-rule-universe.json`: the full live rule set for the pinned axe-core, the
 * payload-nameable subset, and the unnamed remainder. Refuses to overwrite an existing pin - once it
 * is frozen, a re-pin would be a post-hoc redefinition of an outcome measure.
 *
 * The nameable subset is deliberately OVER-inclusive. Any rule whose subject matter the polish craft
 * notes arguably touch is classified nameable, which SHRINKS the unnamed set and makes any
 * unnamed-set claim harder for the treatment. Erring the other way would flatter it.
 *
 * EXIT CODES
 *   0  universe pinned (or already pinned and re-verified identical)
 *   1  usage
 *   2  axe-core not installed in the parent trial's node_modules
 *   3  a nameable ID is not in the live rule set - the subset names a rule that does not exist
 *   4  a pin already exists and the live rule set no longer matches it
 *   5  filesystem failure
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PARENT = path.dirname(HERE);
const AXE = path.join(PARENT, 'node_modules', 'axe-core');
const OUT = path.join(HERE, 'axe-rule-universe.json');

const EXIT = { OK: 0, USAGE: 1, NO_AXE: 2, BAD_SUBSET: 3, DRIFT: 4, IO: 5 };
const die = (code, msg) => { console.error(`pin-axe-rules: ${msg}`); process.exit(code); };

/**
 * Rules whose SUBJECT MATTER the wired polish payload can name, grouped by the craft note that
 * touches them. Over-inclusive by design (see the header).
 */
export const NAMEABLE = {
  'a11y/color-contrast': ['color-contrast', 'color-contrast-enhanced', 'link-in-text-block'],
  'a11y/min-hit-area': ['target-size', 'nested-interactive'],
  'a11y/focus-visible': ['scrollable-region-focusable', 'focus-order-semantics', 'tabindex', 'skip-link', 'bypass'],
  'polish/typography-rhythm + polish/text-wrap-balance': ['heading-order', 'page-has-heading-one', 'empty-heading', 'p-as-heading', 'avoid-inline-spacing'],
  'Responsive validation': ['meta-viewport', 'meta-viewport-large', 'css-orientation-lock'],
  'polish/reduced-motion-respect': ['blink', 'marquee', 'no-autoplay-audio', 'meta-refresh', 'meta-refresh-no-exceptions'],
  // Landmarks are the most generous inclusion: the payload never instructs landmarks directly, but
  // the parent trial's payload moved `region` and `heading-order`, so classifying the whole landmark
  // family as nameable keeps a structural win out of the unnamed set.
  'structure (generous inclusion)': ['region', 'landmark-one-main', 'landmark-unique',
    'landmark-banner-is-top-level', 'landmark-complementary-is-top-level', 'landmark-contentinfo-is-top-level',
    'landmark-main-is-top-level', 'landmark-no-duplicate-banner', 'landmark-no-duplicate-contentinfo',
    'landmark-no-duplicate-main'],
};

export const nameableIds = () => [...new Set(Object.values(NAMEABLE).flat())].sort();

async function liveRules() {
  const src = readFileSync(path.join(AXE, 'axe.min.js'), 'utf8');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><html lang="en"><head><title>t</title></head><body><p>x</p></body></html>');
    await page.addScriptTag({ content: src });
    /* global axe */
    return await page.evaluate(() => axe.getRules().map((r) => r.ruleId).sort());
  } finally { await browser.close(); }
}

async function main() {
  if (process.argv.length > 2) die(EXIT.USAGE, `takes no arguments, got: ${process.argv.slice(2).join(' ')}`);
  if (!existsSync(AXE)) die(EXIT.NO_AXE, `${AXE} not found - run npm install in ${PARENT}`);
  const version = JSON.parse(readFileSync(path.join(AXE, 'package.json'), 'utf8')).version;

  const all = await liveRules();
  const named = nameableIds();
  const missing = named.filter((id) => !all.includes(id));
  if (missing.length) die(EXIT.BAD_SUBSET, `nameable subset names ${missing.length} rule(s) axe does not expose: ${missing.join(', ')}`);
  const unnamed = all.filter((id) => !named.includes(id));

  const payload = {
    pinnedAt: new Date().toISOString(),
    tool: `axe-core@${version}`,
    totalRules: all.length,
    all,
    nameableByCraftNote: NAMEABLE,
    nameable: named,
    unnamed,
  };

  if (existsSync(OUT)) {
    const prior = JSON.parse(readFileSync(OUT, 'utf8'));
    const same = JSON.stringify(prior.all) === JSON.stringify(all)
      && JSON.stringify(prior.nameable) === JSON.stringify(named)
      && prior.tool === payload.tool;
    if (!same) die(EXIT.DRIFT, `${OUT} exists but the live rule set or the nameable subset no longer matches it - refusing to re-pin an outcome definition`);
    console.log(`pin-axe-rules: already pinned and identical (${all.length} rules, ${named.length} nameable, ${unnamed.length} unnamed)`);
    process.exit(EXIT.OK);
  }

  try { writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`); }
  catch (e) { die(EXIT.IO, `writing ${OUT}: ${e.message}`); }

  console.log(`pin-axe-rules: OK - ${payload.tool}, ${all.length} rules pinned`);
  console.log(`  payload-nameable: ${named.length}`);
  console.log(`  unnamed:          ${unnamed.length}`);
  process.exit(EXIT.OK);
}

main();
