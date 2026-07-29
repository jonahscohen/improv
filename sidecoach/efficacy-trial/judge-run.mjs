#!/usr/bin/env node
/**
 * M1 - RUN THE INDEPENDENT BLIND JUDGE. FAIL-CLOSED.
 *
 * For every comparison in judge/assignment.json, hands the brief plus the two page sources to
 * Codex (GPT-5.4) through the deterministic wrapper `~/.claude/hooks/codex-review.py` and records
 * a forced preference. Arm labels never reach the judge: pages are presented as PAGE A / PAGE B in
 * the side order fixed by the committed seeded assignment.
 *
 * The wrapper is used rather than `codex exec` (which wedges) and rather than the rescue agent
 * (which silently downgrades to a same-model review). Its exit codes are surfaced, never
 * swallowed: a judge that did not really run must not become a tie.
 *
 * Each verdict is appended to judge/verdicts.jsonl as it arrives, so an interrupted run resumes
 * instead of re-judging (and re-judging the same pair with a different draw is exactly the
 * degree of freedom this design forbids).
 *
 * EXIT CODES
 *   0  every assigned comparison has a recorded verdict
 *   1  usage
 *   2  assignment.json or a page file missing
 *   3  the Codex wrapper failed on some comparison (its exit code is reported) and no verdict
 *      could be obtained even after the recorded retry
 *   4  a Codex reply contained no parseable VERDICT line
 *   5  filesystem failure
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdtempSync, openSync, closeSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { TRIAL_ROOT } from './lib/briefs.mjs';
import { BRIEF_DIR } from './lib/briefs.mjs';

const EXIT = { OK: 0, USAGE: 1, MISSING: 2, WRAPPER: 3, UNPARSEABLE: 4, IO: 5 };
const die = (code, msg) => { console.error(`judge-run: ${msg}`); process.exit(code); };
const WRAPPER = path.join(homedir(), '.claude', 'hooks', 'codex-review.py');
const VERDICTS = path.join(TRIAL_ROOT, 'judge', 'verdicts.jsonl');

const PROMPT = `You are judging a blind head-to-head between two web pages built from the SAME brief by the same model. Your job is to say which page better satisfies the brief.

The brief and both page sources are on stdin, as PAGE A and PAGE B. You do not know how either page was produced and you must not speculate about it. Judge only the two artefacts against the brief.

Weigh, in this order:
1. Does the page deliver the brief's required content and meet its stated success criteria?
2. Is the information architecture and visual hierarchy sound for the stated audience and register?
3. Accessibility and semantics: headings, labels, contrast, focus, keyboard reachability.
4. Craft: typography, spacing, states, responsiveness, restraint.

Do NOT reward length, file size, or the sheer number of CSS rules for their own sake. A shorter page that serves the brief better wins. Do not reward a page for listing features it does not actually implement.

Answer in this exact form and nothing else:
REASON: <one sentence, max 40 words>
VERDICT: A
(or VERDICT: B, or VERDICT: TIE only if the two are genuinely indistinguishable in quality)`;

function runWrapper(stdinText, timeoutS = 420) {
  const dir = mkdtempSync(path.join(tmpdir(), 'efficacy-judge-'));
  const inPath = path.join(dir, 'in.txt');
  const outPath = path.join(dir, 'out.txt');
  writeFileSync(inPath, stdinText);
  const outFd = openSync(outPath, 'w');
  const r = spawnSync(WRAPPER, [PROMPT, '-C', TRIAL_ROOT, '-t', String(timeoutS)], {
    stdio: [openSync(inPath, 'r'), outFd, 'pipe'], encoding: 'utf8',
  });
  closeSync(outFd);
  const stdout = readFileSync(outPath, 'utf8');
  rmSync(dir, { recursive: true, force: true });
  return { code: r.status, stdout, stderr: r.stderr || '' };
}

/** Parse the forced-choice reply. Returns 'A' | 'B' | 'TIE' | null. Never guesses. */
export function parseVerdict(text) {
  const m = /^\s*VERDICT:\s*(A|B|TIE)\s*$/im.exec(text);
  return m ? m[1].toUpperCase() : null;
}

function packet(id, aArm, bArm) {
  const brief = readFileSync(path.join(BRIEF_DIR, `${id}.md`), 'utf8');
  const read = (arm) => readFileSync(path.join(TRIAL_ROOT, 'pages', arm, `${id}.html`), 'utf8');
  return [
    'BRIEF', '=====', brief.trim(), '',
    'PAGE A', '======', read(aArm), '',
    'PAGE B', '======', read(bArm), '',
  ].join('\n');
}

function main() {
  if (process.argv.length > 2) die(EXIT.USAGE, `takes no arguments, got: ${process.argv.slice(2).join(' ')}`);
  if (!existsSync(WRAPPER)) die(EXIT.MISSING, `${WRAPPER} not found`);
  const aPath = path.join(TRIAL_ROOT, 'judge', 'assignment.json');
  if (!existsSync(aPath)) die(EXIT.MISSING, `${aPath} not found - run judge-prompt.mjs first`);
  const assignment = JSON.parse(readFileSync(aPath, 'utf8'));

  const done = new Set();
  if (existsSync(VERDICTS)) {
    for (const line of readFileSync(VERDICTS, 'utf8').split('\n').filter(Boolean)) {
      const v = JSON.parse(line);
      done.add(`${v.contrast}|${v.id}`);
    }
  }

  let ran = 0;
  for (const row of assignment.rows) {
    const key = `${row.contrast}|${row.id}`;
    if (done.has(key)) continue;
    for (const arm of [row.A, row.B]) {
      const f = path.join(TRIAL_ROOT, 'pages', arm, `${row.id}.html`);
      if (!existsSync(f)) die(EXIT.MISSING, `page ${f} not found`);
    }
    const started = Date.now();
    let { code, stdout, stderr } = runWrapper(packet(row.id, row.A, row.B));
    if (code !== 0) {
      // One recorded retry, then fail loudly. A failed judge is never a tie.
      ({ code, stdout, stderr } = runWrapper(packet(row.id, row.A, row.B)));
      if (code !== 0) die(EXIT.WRAPPER, `codex-review.py exited ${code} on ${key} after one retry: ${stderr.trim().slice(0, 300)}`);
    }
    const verdict = parseVerdict(stdout);
    if (!verdict) die(EXIT.UNPARSEABLE, `no VERDICT line in the Codex reply for ${key}. Reply began: ${JSON.stringify(stdout.slice(0, 300))}`);
    const reason = (/^\s*REASON:\s*(.+)$/im.exec(stdout) || [, ''])[1].trim();
    const record = {
      contrast: row.contrast, id: row.id, A: row.A, B: row.B,
      verdict, winnerArm: verdict === 'TIE' ? null : (verdict === 'A' ? row.A : row.B),
      reason, wrapperExit: code, seconds: Math.round((Date.now() - started) / 1000),
      judgedAt: new Date().toISOString(),
    };
    try { appendFileSync(VERDICTS, `${JSON.stringify(record)}\n`); }
    catch (e) { die(EXIT.IO, `appending to ${VERDICTS}: ${e.message}`); }
    ran++;
    console.log(`  ${key}: A=${row.A} B=${row.B} -> ${verdict}${record.winnerArm ? ` (${record.winnerArm})` : ''} [${record.seconds}s]`);
  }

  const total = readFileSync(VERDICTS, 'utf8').split('\n').filter(Boolean).length;
  if (total !== assignment.rows.length) die(EXIT.WRAPPER, `have ${total} verdicts, assignment has ${assignment.rows.length}`);
  console.log(`judge-run: OK - ${total} verdicts recorded (${ran} new this run)`);
  process.exit(EXIT.OK);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
