#!/usr/bin/env node
/**
 * REPAIR PASS for the late-overwrite incident (see INCIDENT-late-overwrite.md). FAIL-CLOSED.
 *
 * Duplicate producer subagents completed late and rewrote some pages AFTER they had been measured
 * and judged. Any verdict recorded against a page whose bytes have since changed is stale: it
 * describes an artefact that no longer exists.
 *
 * This tool takes the list of ids whose pages changed, MOVES their verdicts out of
 * judge/verdicts.jsonl into judge/verdicts.stale.jsonl (never deletes - the stale verdicts stay
 * on disk so the repair is auditable), and leaves judge-run.mjs to re-judge exactly those
 * comparisons on its next run.
 *
 * It never touches the assignment: the A/B sides for a re-judged pair are the SAME seeded sides,
 * so re-judging cannot become a second draw.
 *
 * EXIT: 0 repaired (or nothing to repair), 1 usage, 2 missing input, 3 filesystem failure.
 */
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { TRIAL_ROOT } from './lib/briefs.mjs';

const EXIT = { OK: 0, USAGE: 1, MISSING: 2, IO: 3 };
const die = (code, msg) => { console.error(`repair-stale-verdicts: ${msg}`); process.exit(code); };

function main() {
  const ids = process.argv.slice(2);
  if (ids.length === 0) die(EXIT.USAGE, 'usage: node repair-stale-verdicts.mjs <brief-id> [<brief-id> ...]');

  const vPath = path.join(TRIAL_ROOT, 'judge', 'verdicts.jsonl');
  const sPath = path.join(TRIAL_ROOT, 'judge', 'verdicts.stale.jsonl');
  const aPath = path.join(TRIAL_ROOT, 'judge', 'assignment.json');
  if (!existsSync(vPath)) die(EXIT.MISSING, `${vPath} not found`);
  if (!existsSync(aPath)) die(EXIT.MISSING, `${aPath} not found`);

  const known = new Set(JSON.parse(readFileSync(aPath, 'utf8')).rows.map((r) => r.id));
  for (const id of ids) if (!known.has(id)) die(EXIT.USAGE, `id not in the assignment: ${id}`);

  const lines = readFileSync(vPath, 'utf8').split('\n').filter(Boolean);
  const keep = [], stale = [];
  for (const line of lines) {
    const v = JSON.parse(line);
    // Only S-vs-P touches an arm-S page; P-vs-C cannot be stale from an arm-S rewrite.
    (ids.includes(v.id) && v.contrast === 'S-vs-P' ? stale : keep).push(line);
  }

  if (stale.length === 0) { console.log('repair-stale-verdicts: nothing to repair'); process.exit(EXIT.OK); }
  try {
    appendFileSync(sPath, `${stale.join('\n')}\n`);
    writeFileSync(vPath, keep.length ? `${keep.join('\n')}\n` : '');
  } catch (e) { die(EXIT.IO, e.message); }

  console.log(`repair-stale-verdicts: moved ${stale.length} stale verdict(s) to judge/verdicts.stale.jsonl`);
  for (const line of stale) { const v = JSON.parse(line); console.log(`  ${v.contrast}/${v.id}: was ${v.verdict} (${v.winnerArm || 'tie'})`); }
  console.log(`  ${keep.length} verdict(s) remain; re-run judge-run.mjs to re-judge the removed comparisons on their SAME seeded sides`);
  process.exit(EXIT.OK);
}

main();
