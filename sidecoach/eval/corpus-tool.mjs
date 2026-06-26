#!/usr/bin/env node
/**
 * Contract-6 CORPUS TOOLING (Stage 0). UNGAMEABLE-BY-CONSTRUCTION.
 *
 * Enforces the eval-integrity guarantees the independent gate demanded so the
 * "beats oracle" proof cannot be gamed. Hardened per the Codex Stage-0 review:
 *   1. LABELS + CASE FROZEN before rule work - `freeze` locks a CANONICAL CASE
 *      RECORD per claim-bearing case (id, split, labels, file path, file-content
 *      SHA-256, provenance). `verify` recomputes and fails on ANY change (label,
 *      file path, file CONTENT, split, or provenance) - not just labels. [BLOCKER 3]
 *   2. BIJECTION - every lock id exists exactly once in the manifest, still in its
 *      locked split, frozen; stale locks, removed locked cases, duplicate ids, and
 *      unknown splits all fail. A locked case cannot be deleted or moved to dodge
 *      the gate. [BLOCKER 2]
 *   3. ALL CLAIM-BEARING SPLITS LOCKED - heldout (recall), known-good (A2 FP), AND
 *      challenge (live claim) are externally sourced + locked; challenge also pins
 *      cadence + RNG seed (no regenerate-until-pass). dev is the only hand-authored,
 *      unlocked split. [MAJOR 4]
 *   4. AUTHOR != LABELER, MANDATORY + NORMALIZED + MULTI-AUTHOR - every non-'none'
 *      class needs a registered author list; labelers/authors are normalized
 *      (trim+lowercase); any overlap, or a class with no registered author, fails.
 *      [MAJOR 6]
 *   5. COLLISION-SAFE HASH - canonical records hash via JSON of a sorted structured
 *      array, not delimiter-joined strings. [MAJOR 5]
 *
 * Tooling only - does NOT freeze a real corpus (real external designs are held for
 * the sourcing decision). `SIDECOACH_CORPUS_DIR` overridable for tests.
 *
 * Manifest: corpus/manifest.json | Lock: corpus/lock.json | Authors: corpus/rule-authors.json
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS_DIR = process.env.SIDECOACH_CORPUS_DIR || path.join(HERE, 'corpus');
const MANIFEST = path.join(CORPUS_DIR, 'manifest.json');
const LOCK = path.join(CORPUS_DIR, 'lock.json');
const RULE_AUTHORS = path.join(CORPUS_DIR, 'rule-authors.json');

const SPLITS = new Set(['dev', 'heldout', 'challenge', 'known-good']);
const LOCKED_SPLITS = new Set(['heldout', 'challenge', 'known-good']); // claim-bearing, externally sourced

function readJson(p, fallback) { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback; }
function writeJson(p, v) { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); }
function sha256(buf) { return createHash('sha256').update(buf).digest('hex'); }
function norm(s) { return String(s ?? '').trim().toLowerCase(); }

// Collision-safe canonical record hash (MAJOR 5): structured JSON, sorted labels.
export function canonicalRecord(c, contentSha256) {
  const labels = [...(c.labels ?? [])]
    .map((l) => ({ class: norm(l.class), labeledBy: norm(l.labeledBy) }))
    .sort((a, b) => (a.class + a.labeledBy).localeCompare(b.class + b.labeledBy));
  return { id: c.id, split: c.split, labels, file: c.file, contentSha256, provenance: c.provenance ?? {} };
}
export function recordHash(rec) { return sha256(JSON.stringify(rec)); }

function fileSha(file) {
  const abs = path.isAbsolute(file) ? file : path.join(CORPUS_DIR, file);
  if (!existsSync(abs)) return null;
  return sha256(readFileSync(abs));
}

function provComplete(p) { return p && p.source && p.date && p.selector && p.why; }

function parseArgs(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) { o[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; }
  }
  return o;
}

export function addCase(a) {
  const manifest = readJson(MANIFEST, []);
  if (!SPLITS.has(a.split)) throw new Error(`split must be one of ${[...SPLITS].join('/')}`);
  if (manifest.some((c) => c.id === a.id)) throw new Error(`duplicate case id: ${a.id}`);
  const c = {
    id: a.id,
    file: a.file,
    split: a.split,
    labels: [{ class: a.class, labeledBy: a['labeled-by'] }],
    provenance: { source: a.source ?? null, date: a.date ?? null, selector: a.selector ?? null, why: a.why ?? null },
    frozen: false,
  };
  manifest.push(c);
  writeJson(MANIFEST, manifest);
  return c;
}

/** Freeze locks the canonical record (incl file-content hash) of every claim-bearing
 *  case. `opts` may carry challenge cadence/seed metadata. */
export function freeze(opts = {}) {
  const manifest = readJson(MANIFEST, []);
  const records = {};
  for (const c of manifest) {
    if (!LOCKED_SPLITS.has(c.split)) continue;
    const contentSha = fileSha(c.file);
    if (!contentSha) throw new Error(`cannot freeze ${c.id}: file missing (${c.file})`);
    c.frozen = true;
    const rec = canonicalRecord(c, contentSha);
    records[c.id] = { split: c.split, contentSha256: contentSha, recordHash: recordHash(rec) };
  }
  writeJson(MANIFEST, manifest);
  writeJson(LOCK, {
    frozenAt: new Date().toISOString(),
    challenge: { cadence: opts.cadence ?? null, seed: opts.seed ?? null }, // pin: no regenerate-until-pass (MAJOR 4)
    records,
  });
  return records;
}

/** Returns { ok, errors[], counts }. Never throws. Enforces bijection + canonical
 *  record integrity + mandatory normalized author!=labeler + provenance. */
export function verify() {
  const errors = [];
  const manifest = readJson(MANIFEST, []);
  const lock = readJson(LOCK, { records: {} });
  const ruleAuthors = readJson(RULE_AUTHORS, {});
  const lockRecords = lock.records ?? {};

  // Manifest-side checks.
  const seen = new Set();
  const manifestById = new Map();
  for (const c of manifest) {
    if (seen.has(c.id)) errors.push(`${c.id}: duplicate case id in manifest`);
    seen.add(c.id); manifestById.set(c.id, c);
    if (!SPLITS.has(c.split)) errors.push(`${c.id}: unknown split '${c.split}'`);

    if (LOCKED_SPLITS.has(c.split)) {
      if (!provComplete(c.provenance)) errors.push(`${c.id}: incomplete provenance (need source/date/selector/why) for '${c.split}'`);
      if (!c.frozen) errors.push(`${c.id}: claim-bearing case not frozen`);
      if (!(c.id in lockRecords)) errors.push(`${c.id}: claim-bearing case missing from lock`);
    }
    // author != labeler (mandatory, normalized, multi-author).
    for (const l of c.labels ?? []) {
      const cls = norm(l.class);
      if (cls === 'none') continue;
      const authors = ruleAuthors[l.class] ?? ruleAuthors[cls];
      if (!authors || !Array.isArray(authors) || authors.length === 0) {
        errors.push(`${c.id}: class '${l.class}' has no registered rule author(s) (rule-authors.json)`);
        continue;
      }
      const authorSet = new Set(authors.map(norm));
      if (authorSet.has(norm(l.labeledBy))) errors.push(`${c.id}: author==labeler for class '${l.class}' (${norm(l.labeledBy)}) - circularity`);
    }
  }

  // Lock-side bijection + canonical-record integrity.
  for (const [id, lk] of Object.entries(lockRecords)) {
    const c = manifestById.get(id);
    if (!c) { errors.push(`${id}: locked case removed from manifest (stale lock / case deleted)`); continue; }
    if (c.split !== lk.split) errors.push(`${id}: split changed since lock (${lk.split} -> ${c.split})`);
    const contentSha = fileSha(c.file);
    if (!contentSha) { errors.push(`${id}: locked case file missing (${c.file})`); continue; }
    if (contentSha !== lk.contentSha256) errors.push(`${id}: FILE CONTENT TAMPERED since freeze (hash mismatch)`);
    const actual = recordHash(canonicalRecord(c, contentSha));
    if (actual !== lk.recordHash) errors.push(`${id}: LOCKED RECORD TAMPERED since freeze (label/file/split/provenance changed)`);
  }

  return { ok: errors.length === 0, errors, counts: countsBySplit(manifest) };
}

function countsBySplit(manifest) {
  const c = { dev: 0, heldout: 0, challenge: 0, 'known-good': 0 };
  for (const x of manifest) if (x.split in c) c[x.split]++;
  return c;
}

// ===========================================================================
// CANDIDATES-AWARE freeze/verify (the REAL corpus). candidates.json (pages) +
// briefs.json. Locks the canonical record per page: id, split (bucket-mapped),
// file content-sha256, the REFEREE objective labels + the CODEX subjective labels,
// provenance. author!=labeler applies to SUBJECTIVE labels (taste, opinion) -
// labeledBy=codex must != the registered rule-author (architect). OBJECTIVE labels
// are spec-math (rendered referee) - LOCKED for tamper-detection but EXEMPT from the
// circularity gate (computed, not authored-opinion); they must NOT be architect-labeled.
// ===========================================================================
const CANDIDATES = path.join(CORPUS_DIR, 'candidates.json');
const BRIEFS = path.join(CORPUS_DIR, 'briefs.json');
const CANDLOCK = path.join(CORPUS_DIR, 'lock-candidates.json');
const BUCKET_SPLIT = { 'known-good': 'known-good', 'defect-bearing': 'heldout', 'excluded-no-primary': 'dev' };
const CLAIM_BUCKETS = new Set(['known-good', 'defect-bearing']);
function candProvComplete(p) { return p && p.source && (p.captureUtc || p.date) && p.selector && p.why; }
function sortLabels(arr, extra) { return [...(arr ?? [])].map((l) => ({ class: norm(l.class), labeledBy: norm(l.labeledBy), ...(extra ? extra(l) : {}) })).sort((a, b) => (a.class + a.labeledBy).localeCompare(b.class + b.labeledBy)); }

export function canonicalCandidateRecord(c, contentSha256) {
  return {
    id: c.id, split: BUCKET_SPLIT[c.bucket] ?? 'dev', file: c.file, register: c.register, contentSha256,
    objective: sortLabels(c.objectiveLabels),
    subjective: sortLabels(c.subjectiveLabels, (l) => ({ present: !!l.present })),
    primaryDefects: [...(c.primaryDefects ?? [])].map(norm).sort(),
    provenance: c.provenance ?? {},
  };
}

export function freezeCandidates() {
  const cand = readJson(CANDIDATES, []);
  const records = {};
  for (const c of cand) {
    const contentSha = fileSha(c.file);
    if (!contentSha) throw new Error(`cannot freeze ${c.id}: file missing (${c.file})`);
    c.frozen = true;
    records[c.id] = { split: BUCKET_SPLIT[c.bucket] ?? 'dev', contentSha256: contentSha, recordHash: recordHash(canonicalCandidateRecord(c, contentSha)) };
  }
  const briefs = readJson(BRIEFS, []);
  const briefRecords = {};
  for (const b of briefs) {
    const bsha = fileSha(b.file);
    if (!bsha) throw new Error(`cannot freeze brief ${b.id}: file missing (${b.file})`);
    const authoredBy = b.codexAuthored ? 'codex' : b.architectAuthored ? 'architect' : 'real';
    briefRecords[b.id] = { kind: b.kind, authoredBy, contentSha256: bsha, recordHash: recordHash({ id: b.id, kind: b.kind, file: b.file, authoredBy, contentSha256: bsha, provenance: b.provenance ?? {} }) };
  }
  writeJson(CANDIDATES, cand);
  writeJson(CANDLOCK, { frozenAt: new Date().toISOString(), pageCount: cand.length, briefCount: briefs.length, records, briefRecords });
  return { pages: Object.keys(records).length, briefs: Object.keys(briefRecords).length };
}

/** Verify the REAL frozen corpus. { ok, errors, counts }. Never throws. */
export function verifyCandidates() {
  const errors = [];
  const cand = readJson(CANDIDATES, []);
  const briefs = readJson(BRIEFS, []);
  const lock = readJson(CANDLOCK, { records: {}, briefRecords: {} });
  const ra = readJson(RULE_AUTHORS, {});
  const byId = new Map(); const seen = new Set();
  for (const c of cand) {
    if (seen.has(c.id)) errors.push(`${c.id}: duplicate page id`);
    seen.add(c.id); byId.set(c.id, c);
    if (!(c.bucket in BUCKET_SPLIT)) errors.push(`${c.id}: unknown bucket '${c.bucket}'`);
    if (!candProvComplete(c.provenance)) errors.push(`${c.id}: incomplete provenance (need source/captureUtc/selector/why)`);
    if (CLAIM_BUCKETS.has(c.bucket)) {
      if (!c.frozen) errors.push(`${c.id}: claim-bearing page not frozen`);
      if (!(c.id in (lock.records ?? {}))) errors.push(`${c.id}: claim-bearing page missing from lock`);
    }
    // SUBJECTIVE author!=labeler (the circularity gate) - every subjective class needs a registered author; labeledBy(codex) must differ.
    if (!Array.isArray(c.subjectiveLabels) || c.subjectiveLabels.length !== 22) errors.push(`${c.id}: expected 22 subjective labels, got ${c.subjectiveLabels?.length ?? 0}`);
    for (const l of c.subjectiveLabels ?? []) {
      const cls = norm(l.class); const authors = ra[l.class] ?? ra[cls];
      if (!authors || !Array.isArray(authors) || !authors.length) { errors.push(`${c.id}: subjective class '${l.class}' has no registered rule author`); continue; }
      if (new Set(authors.map(norm)).has(norm(l.labeledBy))) errors.push(`${c.id}: author==labeler for subjective '${l.class}' (${norm(l.labeledBy)}) - circularity`);
    }
    // OBJECTIVE: spec-math, exempt from author!=labeler, but must NOT be architect-labeled.
    for (const l of c.objectiveLabels ?? []) {
      if (norm(l.labeledBy) === 'sidecoach-architect') errors.push(`${c.id}: objective '${l.class}' labeledBy architect (must be referee/spec-math)`);
    }
  }
  // Lock-side bijection + canonical-record integrity (pages).
  for (const [id, lk] of Object.entries(lock.records ?? {})) {
    const c = byId.get(id);
    if (!c) { errors.push(`${id}: locked page removed (stale lock)`); continue; }
    if ((BUCKET_SPLIT[c.bucket] ?? 'dev') !== lk.split) errors.push(`${id}: split changed since lock`);
    const contentSha = fileSha(c.file);
    if (!contentSha) { errors.push(`${id}: locked file missing (${c.file})`); continue; }
    if (contentSha !== lk.contentSha256) errors.push(`${id}: FILE CONTENT TAMPERED since freeze`);
    if (recordHash(canonicalCandidateRecord(c, contentSha)) !== lk.recordHash) errors.push(`${id}: LOCKED RECORD TAMPERED since freeze (labels/file/split/provenance changed)`);
  }
  // Briefs bijection + content integrity.
  const briefById = new Map(briefs.map((b) => [b.id, b]));
  for (const [id, lk] of Object.entries(lock.briefRecords ?? {})) {
    const b = briefById.get(id);
    if (!b) { errors.push(`brief ${id}: removed since lock`); continue; }
    const bsha = fileSha(b.file);
    if (bsha !== lk.contentSha256) errors.push(`brief ${id}: CONTENT TAMPERED since freeze`);
  }
  const counts = { pages: cand.length, knownGood: cand.filter((c) => c.bucket === 'known-good').length, defectBearing: cand.filter((c) => c.bucket === 'defect-bearing').length, briefs: briefs.length };
  return { ok: errors.length === 0, errors, counts };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  const a = parseArgs(rest);
  try {
    if (cmd === 'add') { const c = addCase(a); console.log(`added ${c.id} (${c.split})`); }
    else if (cmd === 'freeze') { const r = freeze({ cadence: a.cadence, seed: a.seed }); console.log(`froze ${Object.keys(r).length} claim-bearing case(s)`); }
    else if (cmd === 'verify') {
      const r = verify();
      console.log(`corpus counts: ${JSON.stringify(r.counts)}`);
      if (r.ok) { console.log('VERIFY OK: provenance complete, author!=labeler, bijection + canonical-record freeze intact.'); process.exit(0); }
      console.error('VERIFY FAIL:'); for (const e of r.errors) console.error(`  - ${e}`); process.exit(1);
    }
    else if (cmd === 'freeze-candidates') { const r = freezeCandidates(); console.log(`froze REAL corpus: ${r.pages} pages + ${r.briefs} briefs -> lock-candidates.json`); }
    else if (cmd === 'verify-candidates') {
      const r = verifyCandidates();
      console.log(`real corpus counts: ${JSON.stringify(r.counts)}`);
      if (r.ok) { console.log('VERIFY-CANDIDATES OK: provenance complete, subjective author!=labeler (codex), objective spec-math (no architect-label), bijection + canonical-record freeze intact.'); process.exit(0); }
      console.error('VERIFY-CANDIDATES FAIL:'); for (const e of r.errors) console.error(`  - ${e}`); process.exit(1);
    } else { console.error('usage: corpus-tool.mjs <add|freeze|verify|freeze-candidates|verify-candidates> [...]'); process.exit(2); }
  } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : e}`); process.exit(2); }
}
