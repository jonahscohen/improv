#!/usr/bin/env node
/**
 * Tests for the hardened Contract-6 corpus tooling (Codex Stage-0 review folds).
 * Runs the CLI against a TEMP corpus dir (SIDECOACH_CORPUS_DIR) with real case
 * files so freeze can hash file content. Exit 0 = all pass, 1 = a guarantee failed.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

if (failures === 0) { console.log('corpus-tool.test: ALL PASS'); process.exit(0); }
console.error(`corpus-tool.test: ${failures} FAILURE(S)`); process.exit(1);
