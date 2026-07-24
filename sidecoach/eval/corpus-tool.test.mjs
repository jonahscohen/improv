#!/usr/bin/env node
/**
 * Tests for the hardened Contract-6 corpus tooling (Codex Stage-0 review folds).
 * Runs the CLI against a TEMP corpus dir (SIDECOACH_CORPUS_DIR) with real case
 * files so freeze can hash file content. Exit 0 = all pass, 1 = a guarantee failed.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalRecord, recordHash } from './corpus-tool.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TOOL = path.join(HERE, 'corpus-tool.mjs');
let failures = 0;
function check(name, cond) { if (cond) console.log(`  ok  ${name}`); else { console.error(`  FAIL ${name}`); failures++; } }

function freshDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'sc-corpus-'));
  writeFileSync(path.join(dir, 'rule-authors.json'), JSON.stringify({ 'gradient-text': ['alice'], 'cream-palette': ['dave'] }));
  mkdirSync(path.join(dir, 'cases'), { recursive: true });
  return dir;
}
function caseFile(dir, name, content) { const rel = path.join('cases', name); writeFileSync(path.join(dir, rel), content); return rel; }
function run(dir, args) {
  try { return { code: 0, out: execFileSync('node', [TOOL, ...args], { encoding: 'utf8', env: { ...process.env, SIDECOACH_CORPUS_DIR: dir } }) }; }
  catch (e) { return { code: e.status ?? 1, out: (e.stdout || '') + (e.stderr || '') }; }
}

// 1. clean heldout case freezes + verifies OK
{
  const dir = freshDir();
  caseFile(dir, 'h1.html', '<h1>defect</h1>');
  run(dir, ['add', '--id', 'h1', '--file', 'cases/h1.html', '--split', 'heldout', '--class', 'gradient-text', '--labeled-by', 'bob', '--source', 'real-site.com', '--date', '2026-06-01', '--selector', 'carol', '--why', 'shipped page']);
  run(dir, ['freeze']);
  const v = run(dir, ['verify']);
  check('clean heldout verifies OK', v.code === 0 && /VERIFY OK/.test(v.out));
}

// 2. post-freeze LABEL tamper detected (record hash)
{
  const dir = freshDir();
  caseFile(dir, 'h1.html', '<h1>defect</h1>');
  run(dir, ['add', '--id', 'h1', '--file', 'cases/h1.html', '--split', 'heldout', '--class', 'gradient-text', '--labeled-by', 'bob', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'w']);
  run(dir, ['freeze']);
  const mf = path.join(dir, 'manifest.json'); const m = JSON.parse(readFileSync(mf, 'utf8'));
  m[0].labels[0].class = 'cream-palette'; writeFileSync(mf, JSON.stringify(m, null, 2));
  const v = run(dir, ['verify']);
  check('post-freeze label tamper detected', v.code === 1 && /RECORD TAMPERED/.test(v.out));
}

// 3. post-freeze FILE CONTENT tamper detected (BLOCKER 3 - swap easier design)
{
  const dir = freshDir();
  caseFile(dir, 'h1.html', '<h1>hard defect</h1>');
  run(dir, ['add', '--id', 'h1', '--file', 'cases/h1.html', '--split', 'heldout', '--class', 'gradient-text', '--labeled-by', 'bob', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'w']);
  run(dir, ['freeze']);
  writeFileSync(path.join(dir, 'cases', 'h1.html'), '<h1>easier swapped-in design</h1>'); // swap file content, keep labels
  const v = run(dir, ['verify']);
  check('post-freeze FILE CONTENT tamper detected', v.code === 1 && /FILE CONTENT TAMPERED/.test(v.out));
}

// 4. bijection: locked case DELETED from manifest -> stale lock detected (BLOCKER 2)
{
  const dir = freshDir();
  caseFile(dir, 'h1.html', '<h1>defect</h1>');
  run(dir, ['add', '--id', 'h1', '--file', 'cases/h1.html', '--split', 'heldout', '--class', 'gradient-text', '--labeled-by', 'bob', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'w']);
  run(dir, ['freeze']);
  writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify([], null, 2)); // delete the case
  const v = run(dir, ['verify']);
  check('deleted locked case detected (stale lock)', v.code === 1 && /stale lock|removed from manifest/.test(v.out));
}

// 5. bijection: locked case MOVED heldout->dev to dodge the gate (BLOCKER 2)
{
  const dir = freshDir();
  caseFile(dir, 'h1.html', '<h1>defect</h1>');
  run(dir, ['add', '--id', 'h1', '--file', 'cases/h1.html', '--split', 'heldout', '--class', 'gradient-text', '--labeled-by', 'bob', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'w']);
  run(dir, ['freeze']);
  const mf = path.join(dir, 'manifest.json'); const m = JSON.parse(readFileSync(mf, 'utf8'));
  m[0].split = 'dev'; writeFileSync(mf, JSON.stringify(m, null, 2));
  const v = run(dir, ['verify']);
  check('split-move (heldout->dev) detected', v.code === 1 && /split changed since lock/.test(v.out));
}

// 6. author==labeler rejected, NORMALIZED (case-insensitive) (MAJOR 6)
{
  const dir = freshDir();
  caseFile(dir, 'h1.html', '<h1>defect</h1>');
  run(dir, ['add', '--id', 'h1', '--file', 'cases/h1.html', '--split', 'heldout', '--class', 'gradient-text', '--labeled-by', 'Alice', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'w']); // 'Alice' vs registered 'alice'
  run(dir, ['freeze']);
  const v = run(dir, ['verify']);
  check('author==labeler rejected (normalized)', v.code === 1 && /author==labeler/.test(v.out));
}

// 7. class with NO registered author rejected (MAJOR 6 - mandatory)
{
  const dir = freshDir();
  caseFile(dir, 'h1.html', '<h1>defect</h1>');
  run(dir, ['add', '--id', 'h1', '--file', 'cases/h1.html', '--split', 'heldout', '--class', 'icon-tile-stack', '--labeled-by', 'bob', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'w']); // no author registered
  run(dir, ['freeze']);
  const v = run(dir, ['verify']);
  check('unregistered-author class rejected', v.code === 1 && /no registered rule author/.test(v.out));
}

// 8. challenge + known-good are also locked + verified (MAJOR 4)
{
  const dir = freshDir();
  caseFile(dir, 'kg.html', '<h1>clean design</h1>');
  caseFile(dir, 'ch.html', '<h1>challenge</h1>');
  run(dir, ['add', '--id', 'kg', '--file', 'cases/kg.html', '--split', 'known-good', '--class', 'none', '--labeled-by', 'bob', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'clean']);
  run(dir, ['add', '--id', 'ch', '--file', 'cases/ch.html', '--split', 'challenge', '--class', 'gradient-text', '--labeled-by', 'bob', '--source', 's', '--date', 'd', '--selector', 'carol', '--why', 'challenge']);
  run(dir, ['freeze', '--cadence', 'monthly', '--seed', '42']);
  const okV = run(dir, ['verify']);
  // tamper the known-good file -> must be caught (A2 rides known-good)
  writeFileSync(path.join(dir, 'cases', 'kg.html'), '<h1>edited after seeing failures</h1>');
  const tamperV = run(dir, ['verify']);
  check('challenge+known-good locked + verify OK', okV.code === 0);
  check('known-good post-freeze tamper detected', tamperV.code === 1 && /FILE CONTENT TAMPERED/.test(tamperV.out));
}

// 9. collision-safe canonical hash (MAJOR 5): the old '::'/'|' delimiter collision now differs
{
  const recA = canonicalRecord({ id: 'x', split: 'heldout', labels: [{ class: 'a', labeledBy: 'b' }, { class: 'c', labeledBy: 'd' }], file: 'f', provenance: {} }, 'sha');
  const recB = canonicalRecord({ id: 'x', split: 'heldout', labels: [{ class: 'a', labeledBy: 'b|c::d' }], file: 'f', provenance: {} }, 'sha');
  check('canonical hash collision-safe', recordHash(recA) !== recordHash(recB));
  const recC = canonicalRecord({ id: 'x', split: 'heldout', labels: [{ class: 'c', labeledBy: 'd' }, { class: 'a', labeledBy: 'b' }], file: 'f', provenance: {} }, 'sha');
  check('canonical hash order-independent', recordHash(recA) === recordHash(recC));
}

// ===========================================================================
// CANDIDATES PATH (the REAL corpus gate). Added 2026-07-24 after `verify-candidates`
// sat RED at 90/90 for a month: the tool was correct, but it had NO test coverage and
// `npm test` never invoked it, so nothing ever asked it the question. Cases 10-15 cover
// the exact drift that happened (post-freeze subjective re-label) plus the vacuous-green
// hole that would have let a wired gate pass on an absent corpus.
// ===========================================================================
const CLASSES = Array.from({ length: 22 }, (_, i) => `taste-class-${String(i).padStart(2, '0')}`);

/** Temp REAL-corpus fixture: 22 registered subjective classes, 2 pages, 1 brief. */
function freshCandDir() {
  const dir = mkdtempSync(path.join(tmpdir(), 'sc-cand-'));
  writeFileSync(path.join(dir, 'rule-authors.json'), JSON.stringify(Object.fromEntries(CLASSES.map((c) => [c, ['sidecoach-architect']]))));
  mkdirSync(path.join(dir, 'pages'), { recursive: true });
  const page = (id, bucket) => {
    const rel = path.join('pages', `${id}.html`);
    writeFileSync(path.join(dir, rel), `<h1>${id}</h1>`);
    return {
      id, file: rel, bucket, register: 'editorial',
      provenance: { source: 'real-site.com', captureUtc: '2026-06-24T00:00:00.000Z', selector: 'carol', why: 'shipped page' },
      objectiveLabels: [{ class: 'tiny-text', labeledBy: 'rendered-referee' }],
      subjectiveLabels: CLASSES.map((c) => ({ class: c, present: false, labeledBy: 'codex' })),
      primaryDefects: [], frozen: false,
    };
  };
  writeFileSync(path.join(dir, 'candidates.json'), JSON.stringify([page('kg1', 'known-good'), page('db1', 'defect-bearing')], null, 2));
  writeFileSync(path.join(dir, 'brief1.md'), 'brief body');
  writeFileSync(path.join(dir, 'briefs.json'), JSON.stringify([{ id: 'b1', kind: 'clean', file: 'brief1.md', codexAuthored: true, provenance: {} }], null, 2));
  return dir;
}
const readCand = (dir) => JSON.parse(readFileSync(path.join(dir, 'candidates.json'), 'utf8'));
const writeCand = (dir, v) => writeFileSync(path.join(dir, 'candidates.json'), JSON.stringify(v, null, 2));

// 10. clean real-corpus fixture freezes + verifies OK
{
  const dir = freshCandDir();
  const bare = run(dir, ['freeze-candidates']);
  check('candidates: first freeze of a non-empty corpus needs --reason/--initial', bare.code === 2 && /refusing to create a lock for a non-empty corpus/.test(bare.out));
  const f = run(dir, ['freeze-candidates', '--initial']);
  const v = run(dir, ['verify-candidates']);
  check('candidates: clean corpus freezes + verifies OK', f.code === 0 && v.code === 0 && /VERIFY-CANDIDATES OK/.test(v.out));
}

// 11. THE REGRESSION: post-freeze SUBJECTIVE re-label (labeledBy + present) -> record tamper.
//     This is byte-for-byte the 2026-06-24 motion re-label that went undetected for a month.
{
  const dir = freshCandDir();
  run(dir, ['freeze-candidates', '--initial']);
  const m = readCand(dir);
  m[0].subjectiveLabels[0].labeledBy = 'motion-observe-instrument';
  m[0].subjectiveLabels[0].present = true;
  writeCand(dir, m);
  const v = run(dir, ['verify-candidates']);
  check('candidates: post-freeze subjective re-label detected', v.code === 1 && /LOCKED RECORD TAMPERED/.test(v.out));
}

// 12. NO VACUOUS GREEN: an absent corpus must FAIL, not pass with zero errors.
{
  const dir = mkdtempSync(path.join(tmpdir(), 'sc-empty-'));
  const v = run(dir, ['verify-candidates']);
  check('candidates: absent corpus FAILS (no vacuous green)', v.code === 1 && /corpus absent/.test(v.out) && /lock absent/.test(v.out));
}

// 13. NO VACUOUS GREEN: an empty corpus + empty lock must FAIL.
{
  const dir = freshCandDir();
  writeCand(dir, []);
  writeFileSync(path.join(dir, 'lock-candidates.json'), JSON.stringify({ records: {}, briefRecords: {} }));
  const v = run(dir, ['verify-candidates']);
  check('candidates: empty corpus + empty lock FAILS', v.code === 1 && /corpus EMPTY/.test(v.out) && /lock EMPTY/.test(v.out));
}

// 14. AUDITED RE-FREEZE: a drifted corpus cannot be silently re-locked; --reason is recorded.
{
  const dir = freshCandDir();
  run(dir, ['freeze-candidates', '--initial']);
  const before = JSON.parse(readFileSync(path.join(dir, 'lock-candidates.json'), 'utf8'));
  const m = readCand(dir); m[0].subjectiveLabels[0].present = true; writeCand(dir, m);
  const bare = run(dir, ['freeze-candidates']);
  check('candidates: silent re-freeze of a DRIFTED corpus refused', bare.code === 2 && /refusing to re-freeze a DRIFTED corpus/.test(bare.out));
  const valueless = run(dir, ['freeze-candidates', '--reason']);
  check('candidates: --reason with no value still refused', valueless.code === 2);
  const withReason = run(dir, ['freeze-candidates', '--reason', 'motion GT upgraded to observation-based']);
  const lock = JSON.parse(readFileSync(path.join(dir, 'lock-candidates.json'), 'utf8'));
  const v = run(dir, ['verify-candidates']);
  check('candidates: re-freeze WITH --reason succeeds + re-verifies', withReason.code === 0 && v.code === 0);
  check('candidates: re-lock records reason + superseded frozenAt', lock.reason === 'motion GT upgraded to observation-based' && lock.supersedes?.frozenAt === before.frozenAt && lock.supersedes?.changes === 1);
}

// 15. FORWARD bijection: a page added after the freeze is present-but-unlocked -> FAIL.
{
  const dir = freshCandDir();
  run(dir, ['freeze-candidates', '--initial']);
  const m = readCand(dir);
  const extra = JSON.parse(JSON.stringify(m[0])); extra.id = 'sneaked-in';
  m.push(extra); writeCand(dir, m);
  const v = run(dir, ['verify-candidates']);
  check('candidates: page added after freeze detected (count + unlocked)', v.code === 1 && /page count drifted since freeze/.test(v.out) && /NOT in lock/.test(v.out));
}

// ---------------------------------------------------------------------------
// 16-20: folds of the independent Codex review of this fix (2026-07-24).
// ---------------------------------------------------------------------------
const readBriefs = (dir) => JSON.parse(readFileSync(path.join(dir, 'briefs.json'), 'utf8'));
const writeBriefs = (dir, v) => writeFileSync(path.join(dir, 'briefs.json'), JSON.stringify(v, null, 2));

// 16. Brief METADATA tamper with the brief's BYTES untouched. freeze locks a recordHash over
//     kind/authoredBy/file/provenance; verify used to check only contentSha256, so this slipped.
{
  const dir = freshCandDir();
  run(dir, ['freeze-candidates', '--initial']);
  const b = readBriefs(dir); b[0].codexAuthored = false; b[0].architectAuthored = true; writeBriefs(dir, b);
  const v = run(dir, ['verify-candidates']);
  check('briefs: authorship flip (bytes untouched) detected', v.code === 1 && /brief b1: LOCKED RECORD TAMPERED/.test(v.out));
}

// 17. Brief re-pointed at a DIFFERENT file with IDENTICAL content - contentSha256 matches, record must not.
{
  const dir = freshCandDir();
  run(dir, ['freeze-candidates', '--initial']);
  writeFileSync(path.join(dir, 'brief1-copy.md'), 'brief body'); // byte-identical decoy
  const b = readBriefs(dir); b[0].file = 'brief1-copy.md'; writeBriefs(dir, b);
  const v = run(dir, ['verify-candidates']);
  check('briefs: re-point to same-content file detected', v.code === 1 && /brief b1: LOCKED RECORD TAMPERED/.test(v.out));
}

// 18. Duplicate ids collapse in the id-keyed lock map: rejected at BOTH freeze and verify.
{
  const dir = freshCandDir();
  run(dir, ['freeze-candidates', '--initial']);
  const b = readBriefs(dir); b.unshift({ ...b[0], file: 'brief1.md' }); writeBriefs(dir, b); // second brief, same id
  const v = run(dir, ['verify-candidates']);
  check('briefs: duplicate brief id rejected by verify', v.code === 1 && /duplicate brief id/.test(v.out));
  const f = run(dir, ['freeze-candidates', '--reason', 'attempting to launder a duplicate']);
  check('briefs: duplicate brief id refused by freeze', f.code === 2 && /duplicate brief id/.test(f.out));
  const dir2 = freshCandDir();
  const m = readCand(dir2); m.push({ ...m[0] }); writeCand(dir2, m);
  const f2 = run(dir2, ['freeze-candidates', '--initial']);
  check('pages: duplicate page id refused by freeze', f2.code === 2 && /duplicate page id/.test(f2.out));
}

// 19. BOOTSTRAP BYPASS: deleting the lock must not launder drift into an unaudited "first freeze".
{
  const dir = freshCandDir();
  run(dir, ['freeze-candidates', '--initial']);
  const m = readCand(dir); m[0].subjectiveLabels[0].present = true; writeCand(dir, m); // drift
  rmSync(path.join(dir, 'lock-candidates.json'));                                       // hide the evidence
  const bare = run(dir, ['freeze-candidates']);
  check('candidates: deleting the lock does NOT bypass the audit gate', bare.code === 2 && /refusing to create a lock for a non-empty corpus/.test(bare.out));
}

// 20. The assumption behind the run-tests.ts env pin: SIDECOACH_CORPUS_DIR really does redirect
//     which corpus the gate verifies. A CLEAN decoy corpus must NOT launder a BROKEN real one -
//     if this ever stops being true the pin is dead weight and someone will delete it.
{
  const broken = freshCandDir();
  run(broken, ['freeze-candidates', '--initial']);
  const m = readCand(broken); m[0].subjectiveLabels[0].present = true; writeCand(broken, m);
  const clean = freshCandDir();
  run(clean, ['freeze-candidates', '--initial']);
  check('env: a clean decoy corpus verifies OK while the broken one FAILS (hence the runner pin)',
    run(broken, ['verify-candidates']).code === 1 && run(clean, ['verify-candidates']).code === 0);
}

if (failures === 0) { console.log('corpus-tool.test: ALL PASS'); process.exit(0); }
console.error(`corpus-tool.test: ${failures} FAILURE(S)`); process.exit(1);
