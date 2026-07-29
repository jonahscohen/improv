#!/usr/bin/env node
/**
 * M1b - SECONDARY VISUAL-JUDGE TALLY. FAIL-CLOSED.
 *
 * Reads judge/visual-verdicts.txt (one `<id> VERDICT: A|B|TIE` line per comparison, as returned by
 * the blind screenshot judges) and maps each side back to its arm through the COMMITTED seeded
 * assignment - so the mapping is not something this script can choose.
 *
 * Declared SECONDARY before it ran (PREREGISTRATION.md section 3): the judge is the same model
 * family as the producer, and comparisons were batched, so it is a cross-check on M1, not a
 * replacement for it.
 *
 * EXIT: 0 tallied, 1 usage, 2 missing input, 3 a verdict line is unparseable or names an id that
 * is not in the assignment, 4 the verdict count does not match the assignment.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { TRIAL_ROOT } from './lib/briefs.mjs';
import { signTest, clopperPearson } from './lib/stats.mjs';

const EXIT = { OK: 0, USAGE: 1, MISSING: 2, PARSE: 3, COUNT: 4 };
const die = (code, msg) => { console.error(`analyze-visual: ${msg}`); process.exit(code); };

function main() {
  const args = process.argv.slice(2);
  const fullpage = args.includes('--fullpage');
  const vPath = path.join(TRIAL_ROOT, 'judge', fullpage ? 'visual-verdicts-fullpage.txt' : 'visual-verdicts.txt');
  const aPath = path.join(TRIAL_ROOT, 'judge', 'assignment.json');
  if (!existsSync(vPath)) die(EXIT.MISSING, `${vPath} not found`);
  if (!existsSync(aPath)) die(EXIT.MISSING, `${aPath} not found`);

  const rows = JSON.parse(readFileSync(aPath, 'utf8')).rows.filter((r) => r.contrast === 'S-vs-P');
  const byId = new Map(rows.map((r) => [r.id, r]));

  const lines = readFileSync(vPath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  const seen = new Map();
  for (const line of lines) {
    const m = /^(\S+)\s+VERDICT:\s*(A|B|TIE)$/i.exec(line);
    if (!m) die(EXIT.PARSE, `unparseable verdict line: ${JSON.stringify(line)}`);
    const [, id, v] = m;
    const row = byId.get(id);
    if (!row) die(EXIT.PARSE, `verdict names an id absent from the S-vs-P assignment: ${id}`);
    if (seen.has(id)) die(EXIT.PARSE, `duplicate verdict for ${id}`);
    const verdict = v.toUpperCase();
    seen.set(id, { id, A: row.A, B: row.B, verdict, winnerArm: verdict === 'TIE' ? null : row[verdict] });
  }
  if (!fullpage && seen.size !== rows.length) {
    const missing = rows.map((r) => r.id).filter((id) => !seen.has(id));
    die(EXIT.COUNT, `${seen.size} verdicts for ${rows.length} assigned comparisons; missing: ${missing.join(', ')}`);
  }
  if (fullpage && seen.size !== rows.length) {
    console.error(`analyze-visual: PARTIAL - ${seen.size} of ${rows.length} full-page verdicts present; refusing to report a partial exploratory tally`);
    process.exit(EXIT.COUNT);
  }

  const all = [...seen.values()];
  const wins = all.filter((r) => r.winnerArm === 'S').length;
  const ties = all.filter((r) => r.verdict === 'TIE').length;
  const losses = all.length - wins - ties;
  const st = signTest(wins, losses);
  const ci = clopperPearson(wins, wins + losses);

  const out = {
    measure: fullpage
      ? 'M1b-fullpage visual (EXPLORATORY - variant chosen after seeing the viewport-framed result)'
      : 'M1b visual (SECONDARY - same model family as producer, batched judging)',
    analysedAt: new Date().toISOString(),
    contrast: 'S-vs-P', favouredArm: 'S',
    comparisons: all.length, wins, losses, ties, decided: wins + losses,
    winRate: st.winRate, ci95: ci, p: st.p,
    perPair: all,
  };
  writeFileSync(path.join(TRIAL_ROOT, 'results', fullpage ? 'visual-fullpage.json' : 'visual.json'), `${JSON.stringify(out, null, 2)}\n`);

  console.log(fullpage
    ? 'M1b-fullpage (EXPLORATORY) - sidecoach vs placebo, blind FULL-PAGE screenshots'
    : 'M1b visual (SECONDARY) - sidecoach vs length-matched placebo, blind screenshots');
  console.log(`  ${wins} win / ${losses} loss / ${ties} tie over ${all.length} comparisons`);
  console.log(`  win rate ${Number.isFinite(st.winRate) ? st.winRate.toFixed(3) : 'n/a'} on ${wins + losses} decided`);
  console.log(`  exact 95% CI [${ci[0].toFixed(3)}, ${ci[1].toFixed(3)}]   two-sided exact binomial p = ${st.p.toFixed(4)}`);
  process.exit(EXIT.OK);
}

main();
