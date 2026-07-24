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

/** RE-FREEZE IS AUDITED (2026-07-24). A freeze that can be silently re-run over a DRIFTED corpus
 *  is not a freeze - it is a rubber stamp, and it is exactly how the 2026-06-24 motion re-label
 *  erased its own evidence for a month. So: re-locking a corpus whose records no longer match the
 *  existing lock REQUIRES an explicit `reason`, which is recorded in the lock alongside the
 *  superseded `frozenAt`. First freeze (no prior lock) and a no-op re-freeze (nothing drifted) do
 *  not need one. `reason` is lock-level metadata; it is NOT part of any record hash. */
/** Canonical brief record - the SINGLE builder used by both freeze and verify. Keeping one
 *  definition is the point: while freeze hashed these fields inline and verify re-checked only
 *  contentSha256, a brief's kind/authoredBy/file/provenance could drift with the bytes untouched
 *  and still verify clean. Field ORDER is load-bearing (recordHash is sha256 of JSON.stringify). */
function canonicalBriefRecord(b, contentSha256) {
  const authoredBy = b.codexAuthored ? 'codex' : b.architectAuthored ? 'architect' : 'real';
  return { id: b.id, kind: b.kind, file: b.file, authoredBy, contentSha256, provenance: b.provenance ?? {} };
}

export function freezeCandidates(opts = {}) {
  const cand = readJson(CANDIDATES, []);
  const records = {};
  const seenPages = new Set();
  for (const c of cand) {
    // Duplicate ids would COLLAPSE in the id-keyed record map, silently leaving a page present
    // but unlocked (and invisible to the forward-bijection check, whose id does exist).
    if (seenPages.has(c.id)) throw new Error(`cannot freeze: duplicate page id '${c.id}' - ids must be unique to be lockable`);
    seenPages.add(c.id);
    const contentSha = fileSha(c.file);
    if (!contentSha) throw new Error(`cannot freeze ${c.id}: file missing (${c.file})`);
    c.frozen = true;
    records[c.id] = { split: BUCKET_SPLIT[c.bucket] ?? 'dev', contentSha256: contentSha, recordHash: recordHash(canonicalCandidateRecord(c, contentSha)) };
  }
  const briefs = readJson(BRIEFS, []);
  const briefRecords = {};
  const seenBriefs = new Set();
  for (const b of briefs) {
    if (seenBriefs.has(b.id)) throw new Error(`cannot freeze: duplicate brief id '${b.id}' - ids must be unique to be lockable`);
    seenBriefs.add(b.id);
    const bsha = fileSha(b.file);
    if (!bsha) throw new Error(`cannot freeze brief ${b.id}: file missing (${b.file})`);
    const rec = canonicalBriefRecord(b, bsha);
    briefRecords[b.id] = { kind: rec.kind, authoredBy: rec.authoredBy, contentSha256: bsha, recordHash: recordHash(rec) };
  }

  const prior = existsSync(CANDLOCK) ? readJson(CANDLOCK, null) : null;
  const drift = prior ? lockDrift(prior, records, briefRecords, cand.length, briefs.length) : [];
  const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';
  // BOOTSTRAP GATE: without this, the audited re-freeze below is defeated by `rm lock-candidates.json`
  // - delete the prior lock and every drift becomes an unaudited "first freeze". Creating a lock for a
  // non-empty corpus is therefore always an explicit act: --reason (normal) or --initial (true bootstrap).
  if (!prior && cand.length && !reason && !opts.initial) {
    throw new Error(
      `refusing to create a lock for a non-empty corpus (${cand.length} page(s)) with no prior lock and no justification.\n` +
      `  If lock-candidates.json was DELETED, that deletion is itself the drift - re-run with --reason "<why>".\n` +
      `  If this is a genuine first freeze, say so explicitly: freeze-candidates --initial`);
  }
  if (drift.length && !reason) {
    throw new Error(
      `refusing to re-freeze a DRIFTED corpus without --reason (${drift.length} change(s); e.g. ${drift.slice(0, 3).join('; ')}).\n` +
      `  A silent re-lock destroys the evidence of what moved. Understand the delta first, then re-run with:\n` +
      `  freeze-candidates --reason "<what changed and why the new state is the correct ground truth>"`);
  }

  writeJson(CANDIDATES, cand);
  writeJson(CANDLOCK, {
    frozenAt: new Date().toISOString(),
    // audit trail: why this lock replaced the previous one, and which one it replaced.
    reason: reason || (!prior && opts.initial ? 'initial freeze (--initial, no prior lock)' : prior?.reason || null),
    supersedes: drift.length ? { frozenAt: prior?.frozenAt ?? null, changes: drift.length } : (prior?.supersedes ?? null),
    pageCount: cand.length, briefCount: briefs.length, records, briefRecords,
  });
  return { pages: Object.keys(records).length, briefs: Object.keys(briefRecords).length, drift: drift.length };
}

/** Human-readable list of what a re-freeze would change vs the existing lock. Takes the RAW
 *  array lengths as well as the id-keyed maps: id-keyed comparison alone cannot see a
 *  duplicate-id insertion (the map collapses it), so count drift is compared explicitly. */
function lockDrift(prior, records, briefRecords, pageCount, briefCount) {
  const changes = [];
  const pr = prior.records ?? {}, pb = prior.briefRecords ?? {};
  for (const id of Object.keys(records)) {
    if (!(id in pr)) { changes.push(`${id}: newly locked`); continue; }
    if (pr[id].recordHash !== records[id].recordHash) changes.push(`${id}: record changed`);
    else if (pr[id].contentSha256 !== records[id].contentSha256) changes.push(`${id}: file content changed`);
  }
  for (const id of Object.keys(pr)) if (!(id in records)) changes.push(`${id}: dropped from corpus`);
  for (const id of Object.keys(briefRecords)) {
    if (!(id in pb)) changes.push(`brief ${id}: newly locked`);
    else if (pb[id].recordHash !== briefRecords[id].recordHash) changes.push(`brief ${id}: record changed`);
  }
  for (const id of Object.keys(pb)) if (!(id in briefRecords)) changes.push(`brief ${id}: dropped from corpus`);
  if (typeof prior.pageCount === 'number' && typeof pageCount === 'number' && prior.pageCount !== pageCount) changes.push(`page count ${prior.pageCount} -> ${pageCount}`);
  if (typeof prior.briefCount === 'number' && typeof briefCount === 'number' && prior.briefCount !== briefCount) changes.push(`brief count ${prior.briefCount} -> ${briefCount}`);
  return changes;
}

/** Verify the REAL frozen corpus. { ok, errors, counts }. Never throws.
 *
 *  FAIL-CLOSED ON AN ABSENT CORPUS (2026-07-24). Every read below falls back to an empty
 *  value, so before this guard a MISSING or EMPTY candidates.json / lock-candidates.json
 *  walked every loop zero times, collected zero errors and returned ok:true - a gate that
 *  passes loudest exactly when there is nothing left to check. (The sibling `verify()` still
 *  demonstrates the hazard live: it reports VERIFY OK on the intentionally-empty, tooling-only
 *  manifest corpus.) An enforcement point has to re-ask its own question at enforcement time,
 *  so the presence of the corpus is now itself a checked claim. */
export function verifyCandidates() {
  const errors = [];
  const cand = readJson(CANDIDATES, []);
  const briefs = readJson(BRIEFS, []);
  const lock = readJson(CANDLOCK, { records: {}, briefRecords: {} });
  const ra = readJson(RULE_AUTHORS, {});

  if (!existsSync(CANDIDATES)) errors.push(`corpus absent: ${path.relative(CORPUS_DIR, CANDIDATES) || 'candidates.json'} not found - nothing to verify`);
  else if (!Array.isArray(cand) || cand.length === 0) errors.push('corpus EMPTY: candidates.json holds zero pages - refusing to pass vacuously');
  if (!existsSync(CANDLOCK)) errors.push(`lock absent: ${path.relative(CORPUS_DIR, CANDLOCK) || 'lock-candidates.json'} not found - the corpus is unfrozen`);
  else if (!lock.records || Object.keys(lock.records).length === 0) errors.push('lock EMPTY: lock-candidates.json holds zero records - refusing to pass vacuously');
  // Count bijection: pages/briefs added or removed since the freeze without a re-freeze.
  if (existsSync(CANDLOCK)) {
    if (typeof lock.pageCount === 'number' && lock.pageCount !== cand.length) errors.push(`page count drifted since freeze (${lock.pageCount} locked -> ${cand.length} present) - re-freeze required`);
    if (typeof lock.briefCount === 'number' && lock.briefCount !== briefs.length) errors.push(`brief count drifted since freeze (${lock.briefCount} locked -> ${briefs.length} present) - re-freeze required`);
  }

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
  // Briefs bijection + FULL canonical-record integrity. Checking contentSha256 alone left the
  // rest of the locked brief record (kind, authoredBy, file, provenance) unverified: re-pointing a
  // brief at a different same-content file, or flipping codexAuthored -> architectAuthored, moved
  // the record without moving a byte the gate looked at.
  const briefById = new Map(); const seenBriefs = new Set();
  for (const b of briefs) {
    if (seenBriefs.has(b.id)) errors.push(`brief ${b.id}: duplicate brief id (a duplicate collapses in the id-keyed lock and escapes bijection)`);
    seenBriefs.add(b.id); if (!briefById.has(b.id)) briefById.set(b.id, b);
  }
  for (const [id, lk] of Object.entries(lock.briefRecords ?? {})) {
    const b = briefById.get(id);
    if (!b) { errors.push(`brief ${id}: removed since lock`); continue; }
    const bsha = fileSha(b.file);
    if (!bsha) { errors.push(`brief ${id}: locked file missing (${b.file})`); continue; }
    if (bsha !== lk.contentSha256) errors.push(`brief ${id}: CONTENT TAMPERED since freeze`);
    if (lk.recordHash && recordHash(canonicalBriefRecord(b, bsha)) !== lk.recordHash) errors.push(`brief ${id}: LOCKED RECORD TAMPERED since freeze (kind/authoredBy/file/provenance changed)`);
  }
  // FORWARD bijection: freezeCandidates locks EVERY page and EVERY brief, so anything present but
  // unlocked slipped in after the freeze. The reverse direction (locked-but-removed) is covered above.
  if (existsSync(CANDLOCK)) {
    const unlockedPages = cand.filter((c) => !(c.id in (lock.records ?? {}))).map((c) => c.id);
    const unlockedBriefs = briefs.filter((b) => !(b.id in (lock.briefRecords ?? {}))).map((b) => b.id);
    if (unlockedPages.length) errors.push(`${unlockedPages.length} page(s) present but NOT in lock (added since freeze): ${unlockedPages.slice(0, 5).join(', ')}${unlockedPages.length > 5 ? ', ...' : ''}`);
    if (unlockedBriefs.length) errors.push(`${unlockedBriefs.length} brief(s) present but NOT in lock (added since freeze): ${unlockedBriefs.slice(0, 5).join(', ')}${unlockedBriefs.length > 5 ? ', ...' : ''}`);
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
    else if (cmd === 'freeze-candidates') {
      const r = freezeCandidates({ reason: typeof a.reason === 'string' ? a.reason : '', initial: a.initial === true });
      console.log(`froze REAL corpus: ${r.pages} pages + ${r.briefs} briefs${r.drift ? ` (AUDITED RE-LOCK over ${r.drift} drifted record(s))` : ''} -> lock-candidates.json`);
    }
    else if (cmd === 'verify-candidates') {
      const r = verifyCandidates();
      console.log(`real corpus counts: ${JSON.stringify(r.counts)}`);
      if (r.ok) { console.log('VERIFY-CANDIDATES OK: provenance complete, subjective author!=labeler (codex), objective spec-math (no architect-label), bijection + canonical-record freeze intact.'); process.exit(0); }
      console.error('VERIFY-CANDIDATES FAIL:'); for (const e of r.errors) console.error(`  - ${e}`); process.exit(1);
    } else { console.error('usage: corpus-tool.mjs <add|freeze|verify|freeze-candidates [--reason "<why>" | --initial]|verify-candidates> [...]'); process.exit(2); }
  } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : e}`); process.exit(2); }
}
