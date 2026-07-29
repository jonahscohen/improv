#!/usr/bin/env node
/**
 * M1 - BLIND JUDGE ASSIGNMENT + PACKET BUILDER. FAIL-CLOSED.
 *
 * Writes the A/B side assignment for every judged comparison BEFORE any judging call is made, from
 * the seed committed in PREREGISTRATION.md section 3 (20260728). Once `judge/assignment.json`
 * exists this tool REFUSES to overwrite it, so the assignment cannot be redrawn after seeing a
 * verdict. Deleting it to redraw would be visible in git.
 *
 * Comparisons judged (PREREGISTRATION.md section 3):
 *   S-vs-P  the PRIMARY efficacy comparison
 *   P-vs-C  the SECONDARY prompt-length comparison
 * S-vs-C is deliberately NOT judged: it is the confounded comparison the design review rejected,
 * and spending judge budget on it would invite it into the narrative.
 *
 * EXIT CODES
 *   0  assignment written (or already present and re-verified) and packets built
 *   1  usage
 *   2  results/collection.json missing
 *   3  assignment.json exists but does not match the seeded draw - the file has been tampered with
 *   4  filesystem failure
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { TRIAL_ROOT } from './lib/briefs.mjs';

const EXIT = { OK: 0, USAGE: 1, NO_COLLECTION: 2, TAMPERED: 3, IO: 4 };
const die = (code, msg) => { console.error(`judge-prompt: ${msg}`); process.exit(code); };

export const SEED = 20260728;
export const CONTRASTS = [
  { name: 'S-vs-P', left: 'S', right: 'P' },
  { name: 'P-vs-C', left: 'P', right: 'C' },
];

/** mulberry32 - a small deterministic PRNG. Same seed, same draw, on any machine. */
export function mulberry32(a) {
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw the assignment. Deterministic in (seed, contrast order, id order): for each comparison,
 * a coin decides whether `left` is shown as PAGE A or PAGE B.
 */
export function drawAssignment(ids) {
  const rnd = mulberry32(SEED);
  const rows = [];
  for (const c of CONTRASTS) {
    for (const id of ids) {
      const leftIsA = rnd() < 0.5;
      rows.push({
        contrast: c.name,
        id,
        A: leftIsA ? c.left : c.right,
        B: leftIsA ? c.right : c.left,
      });
    }
  }
  return rows;
}

function main() {
  if (process.argv.length > 2) die(EXIT.USAGE, `takes no arguments, got: ${process.argv.slice(2).join(' ')}`);
  const collPath = path.join(TRIAL_ROOT, 'results', 'collection.json');
  if (!existsSync(collPath)) die(EXIT.NO_COLLECTION, `${collPath} not found - run collect.mjs first`);
  const ids = JSON.parse(readFileSync(collPath, 'utf8')).completeTriples;
  if (ids.length === 0) die(EXIT.NO_COLLECTION, 'collection.json reports 0 complete triples');

  const rows = drawAssignment(ids);
  const payload = { seed: SEED, drawnAt: new Date().toISOString(), n: ids.length, contrasts: CONTRASTS.map((c) => c.name), rows };
  const outPath = path.join(TRIAL_ROOT, 'judge', 'assignment.json');

  try { mkdirSync(path.join(TRIAL_ROOT, 'judge'), { recursive: true }); }
  catch (e) { die(EXIT.IO, `creating judge dir: ${e.message}`); }

  if (existsSync(outPath)) {
    // Never redraw. Verify the existing file is the seeded draw for this id set and stop.
    const prior = JSON.parse(readFileSync(outPath, 'utf8'));
    const same = JSON.stringify(prior.rows) === JSON.stringify(rows) && prior.seed === SEED;
    if (!same) die(EXIT.TAMPERED, `${outPath} exists but is not the seeded draw for the current ${ids.length} triples - refusing to overwrite an assignment that judging may already have used`);
    console.log(`judge-prompt: assignment already present and matches the seeded draw (${rows.length} comparisons)`);
    process.exit(EXIT.OK);
  }

  try { writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`); }
  catch (e) { die(EXIT.IO, `writing ${outPath}: ${e.message}`); }

  const bySide = {};
  for (const r of rows) bySide[`${r.contrast}:A=${r.A}`] = (bySide[`${r.contrast}:A=${r.A}`] || 0) + 1;
  console.log(`judge-prompt: OK - ${rows.length} comparisons assigned from seed ${SEED}, written BEFORE any judging`);
  for (const [k, v] of Object.entries(bySide).sort()) console.log(`  ${k}: ${v}`);
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
