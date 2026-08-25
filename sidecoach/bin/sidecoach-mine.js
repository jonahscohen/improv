#!/usr/bin/env node
'use strict';

/**
 * sidecoach-mine.js - the TASTE MINER engine (Phase 1 D of the self-updating taste loop).
 *
 * WHAT IT IS. The deterministic, testable engine under the `/sidecoach mine` flow. It assembles
 * a MULTI-SOURCE corpus (beats + measured audit-history + external expert content + the existing
 * rule stores), tags every entry by sourceKind, and turns candidate taste-rule findings into
 * INERT, quarantined proposals that a human reviews. The reflect-style 5-lens fan-out that reads
 * the corpus and PRODUCES the candidate findings lives in the SKILL flow (a live Claude session
 * spawns the lenses); this engine owns the parts that must be exact and reproducible:
 *   1. corpus assembly (multi-source, tagged),
 *   2. dedup against every existing rule store (net-new / strengthen-existing / duplicate),
 *   3. a per-candidate validateRegistry pre-flight IN ISOLATION (so the queue holds only
 *      could-pass proposals; a failure is FILED with its errors, never dropped),
 *   4. writing the inert output.
 *
 * SAFETY (non-negotiable - see session_2026-08-23_self-updating-taste-pipeline-design.md):
 *   - External expert content is UNTRUSTED DATA. The miner READS it as data for provenance and
 *     evidence; it NEVER follows, executes, or obeys anything inside it.
 *   - The miner NEVER writes the registry, any live rule store, any hook, or any config. Its ONLY
 *     writes are the INERT quarantine: data/proposed-rules/<ruleId>.json, data/taste-candidates.json,
 *     and a .claude/memory/taste_mine_YYYY-MM-DD.md proposal beat.
 *   - STRUCTURAL INERTNESS: nothing under sidecoach/src imports data/proposed-rules/, so an
 *     unpromoted proposal is physically unreachable by the enforcer - not "allowed but discouraged",
 *     unreachable. This tool is the ONLY writer of that directory.
 *
 * SUBCOMMANDS
 *   corpus [--json] [--out <file>]
 *       Assemble and print the multi-source tagged corpus (what the lenses read).
 *   run   [--findings <file>] [--out-dir <dir>] [--beats-dir <dir>] [--date YYYY-MM-DD]
 *         [--dry-run] [--json]
 *       Full pipeline: assemble corpus -> gather candidates (from --findings if given, PLUS the
 *       deterministic measured-signal candidates from audit-history) -> dedup -> validate in
 *       isolation -> write the inert output. --dry-run computes everything and prints the summary
 *       but writes NOTHING.
 *   --help
 *
 * EXIT CODES (distinct per failure class; never a silent success)
 *   0  success (corpus printed, or run completed - a run may legitimately propose 0 net-new
 *      candidates and still exit 0; "nothing new to propose" is a clean outcome, not a failure)
 *   2  usage / bad arguments
 *   3  the compiled registry is unavailable (dist/ missing - run `npm run build` in sidecoach/);
 *      without it the miner cannot dedup or pre-flight, so it REFUSES rather than emit unvalidated
 *      proposals
 *   4  a write failure while emitting the inert output
 *   5  a --findings file was given but is unreadable / not valid JSON / wrong shape
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const EXIT_OK = 0;
const EXIT_USAGE = 2;
const EXIT_REGISTRY = 3;
const EXIT_WRITE = 4;
const EXIT_FINDINGS = 5;

const SIDECOACH_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(SIDECOACH_ROOT, '..');
const DIST = path.join(SIDECOACH_ROOT, 'dist');

const DEFAULT_PROPOSED_DIR = path.join(SIDECOACH_ROOT, 'data', 'proposed-rules');
const DEFAULT_CANDIDATES_FILE = path.join(SIDECOACH_ROOT, 'data', 'taste-candidates.json');
const DEFAULT_BEATS_DIR = path.join(REPO_ROOT, '.claude', 'memory');
const EXTERNAL_DIR = path.join(SIDECOACH_ROOT, 'reference', '_extracted', 'external');
const TASTE_SOURCES = path.join(SIDECOACH_ROOT, 'data', 'taste-sources.json');

const BEAT_BODY_LIMIT = 1600;      // chars kept per beat body in the corpus (token budget)
const EXTERNAL_BODY_LIMIT = 2400;  // chars kept per external file body in the corpus
const FIRE_THRESHOLD = posIntEnv('SIDECOACH_MINE_FIRE_THRESHOLD', 5); // measured strengthen threshold

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------
function posIntEnv(name, dflt) {
  const v = process.env[name];
  if (v == null || v === '') return dflt;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : dflt;
}

function nowIso() { return new Date().toISOString(); }

// Coerce to a string WITHOUT ever throwing (a value with a throwing toString - possible from a hostile
// findings file - must never abort the run before the candidate can be filed). Totality helper.
function safeStr(v, fallback) {
  try { return v == null ? (fallback || '') : String(v); } catch (_e) { return fallback || ''; }
}

// --- safe-write guard: the miner may only ever write inert data ---------------
// The contract is "writes ONLY inert output; NEVER the registry, a live rule store, a hook, or config".
// Structurally: a write target that resolves INSIDE the repo tree must fall under an allowlisted inert
// zone (sidecoach/data/ for proposals+queue+corpus dumps, .claude/memory/ for the proposal beat). A
// target OUTSIDE the repo (a /tmp scratch dir a test or the launchd job hands in) is always fine - it
// physically cannot touch the registry/hooks/config. Anything inside the repo but outside those zones -
// src/, scripts/, claude/hooks/, claude/skills/, a root config file - is REFUSED (exit 4). This is what
// makes "--candidates-file .../src/product-rule-registry.ts" impossible, flag-driven or not.
const SAFE_DATA_DIR = path.join(SIDECOACH_ROOT, 'data');
const SAFE_MEMORY_DIR = DEFAULT_BEATS_DIR;

// Resolve a target to a real path that DEFEATS a symlink: realpath the nearest existing ancestor, then
// re-append the not-yet-existing tail. Without this, `path.resolve` normalizes `..` but follows no symlink,
// so a pre-planted `data/x -> ../src` or an out-of-repo `/tmp/evil -> .../src` would slip a write into src/.
function realResolve(target) {
  let abs = path.resolve(target);
  const tail = [];
  let cur = abs;
  while (!fs.existsSync(cur)) {
    const base = path.basename(cur);
    const parent = path.dirname(cur);
    if (parent === cur) break; // reached the filesystem root
    tail.unshift(base);
    cur = parent;
  }
  let real;
  try { real = fs.realpathSync(cur); } catch (_e) { real = cur; }
  return tail.length ? path.join(real, ...tail) : real;
}

function isUnder(dir, target) {
  const rel = path.relative(realResolve(dir), realResolve(target));
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

function assertSafeWrite(target, allowedDirs, kind) {
  const real = realResolve(target);
  const insideRepo = isUnder(REPO_ROOT, real);
  if (!insideRepo) return; // outside the working tree (after symlink resolution) - cannot touch registry/hooks/config
  if (allowedDirs.some((d) => isUnder(d, real))) return;
  const e = new Error(`refusing to write ${kind} to a path outside the inert quarantine (only ${allowedDirs.map((d) => path.relative(REPO_ROOT, d)).join(', ')} or a path outside the repo are allowed): ${path.relative(REPO_ROOT, real)}`);
  e.exitCode = EXIT_WRITE;
  throw e;
}

function shortHead() {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown';
  } catch (_e) { return 'unknown'; }
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

/** Lowercase, collapse every non-alphanumeric run to a single space, trim. The dedup match key. */
function normalizeKey(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** A filesystem/id-safe slug from a title. */
function slugify(s) {
  return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'candidate';
}

/** Split YAML-ish frontmatter from a markdown body. Total: never throws. */
function parseFrontmatter(md) {
  const text = String(md == null ? '' : md);
  const m = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!m) return { fm: {}, body: text };
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim();
  }
  return { fm, body: m[2] };
}

function readTextSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; }
}

function listFilesRec(dir, ext) {
  const out = [];
  let ents;
  try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (_e) { return out; }
  for (const e of ents) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRec(full, ext));
    else if (!ext || e.name.endsWith(ext)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------------------
// registry / rule-store loading (dist). Fails LOUD (exit 3) if unavailable.
// ---------------------------------------------------------------------------
function loadRegistry() {
  let reg, vg, fvc, ssm, prt, psp;
  try {
    reg = require(path.join(DIST, 'product-rule-registry'));
    vg = require(path.join(DIST, 'validator-generation'));
    fvc = require(path.join(DIST, 'flow-validation-capabilities'));
    ssm = require(path.join(DIST, 'validators', 'source-support-matrix'));
    prt = require(path.join(DIST, 'product-rule-types'));
    // Phase 3a: the SAME ReDoS screen + predicate allowlist the interpreter uses, so a candidate
    // cannot enter the quarantine carrying an un-screened regex or an unknown predicateId.
    psp = require(path.join(DIST, 'validators', 'pattern-spec'));
  } catch (err) {
    const e = new Error('compiled registry unavailable (run `npm run build` in sidecoach/): ' + (err && err.message ? err.message : String(err)));
    e.exitCode = EXIT_REGISTRY;
    throw e;
  }
  if (!Array.isArray(reg.RULES) || typeof vg.validateRegistry !== 'function' || typeof ssm.supportedKindsFor !== 'function') {
    const e = new Error('compiled registry loaded but is missing RULES / validateRegistry / supportedKindsFor');
    e.exitCode = EXIT_REGISTRY;
    throw e;
  }
  if (!psp || typeof psp.screenPatternSpec !== 'function') {
    const e = new Error('compiled pattern-spec unavailable (run `npm run build` in sidecoach/): missing screenPatternSpec');
    e.exitCode = EXIT_REGISTRY;
    throw e;
  }
  const gating = vg.gatingValidatorIds(fvc.LANE_POLICIES);
  const knownEvidenceKinds = prt && prt.EVIDENCE_SOURCE_COMPATIBILITY
    ? Object.keys(prt.EVIDENCE_SOURCE_COMPATIBILITY)
    : DEFAULT_KNOWN_EVIDENCE.slice();
  return {
    RULES: reg.RULES,
    validateRegistry: vg.validateRegistry,
    VALIDATOR_REGISTRATIONS: fvc.VALIDATOR_REGISTRATIONS,
    gating,
    browser: [...(vg.BROWSER_BACKED_RULE_IDS || [])],
    rendered: [...(vg.RENDERED_BACKED_RULE_IDS || [])],
    supportedKindsFor: ssm.supportedKindsFor,
    knownEvidenceKinds,
    screenPatternSpec: psp.screenPatternSpec,
  };
}

/** Best-effort load of the GUIDANCE stores used only for dedup (a missing store just contributes nothing). */
function loadGuidanceStores() {
  const out = { designLaws: [], craft: [], judgment: [] };
  try {
    const dl = require(path.join(DIST, 'design-laws'));
    for (const v of Object.values(dl.ANTI_PATTERNS || {})) {
      if (v && (v.id || v.name)) out.designLaws.push({ id: v.id || null, name: v.name || null, store: 'design-laws' });
    }
  } catch (_e) { /* absent - contributes nothing */ }
  try {
    const cl = require(path.join(DIST, 'craft-laws'));
    for (const [k, v] of Object.entries(cl.LAW_CRAFT || {})) {
      if (v && (v.title || k)) out.craft.push({ id: k, name: v.title || null, store: 'craft-laws' });
    }
  } catch (_e) { /* absent */ }
  try {
    const cc = require(path.join(DIST, 'craft-corpus'));
    for (const [k, v] of Object.entries(cc.REGISTRY_CRAFT || {})) {
      if (v && (v.title || k)) out.craft.push({ id: k, name: v.title || null, store: 'craft-corpus' });
    }
  } catch (_e) { /* absent */ }
  // design-judgment-rules.md: parse the "## N. Title" section headers.
  const judgmentMd = readTextSafe(path.join(REPO_ROOT, 'claude', 'skills', 'sidecoach', 'reference', 'design-judgment-rules.md'));
  if (judgmentMd) {
    const re = /^##\s+\d+\.\s+(.+?)\s*$/gm;
    let m;
    while ((m = re.exec(judgmentMd)) !== null) out.judgment.push({ id: null, name: m[1].trim(), store: 'design-judgment' });
  }
  return out;
}

// ---------------------------------------------------------------------------
// corpus assembly (each entry carries sourceKind)
// ---------------------------------------------------------------------------
// De-weight our own beats (Jonah 2026-08-24: the outside pioneers are the BASELINE; "not our work
// as a baseline"). The .claude/memory corpus is overwhelmingly build/infra/session notes that are
// irrelevant to design taste; keep ONLY the design/taste-relevant beats as minor context beneath
// the expert baseline and the measured-defect signal. A beat qualifies if its filename, name,
// description, or type mentions a design-taste concept.
const DESIGN_BEAT_RE = /\b(design|taste|typograph|typeface|font|color|colour|contrast|layout|spacing|whitespace|grid|motion|animat|easing|visual|aesthetic|polish|brand|\bui\b|\bux\b|a11y|accessib|hierarchy|readab|shadow|gradient|css|component|page-?quality|marketing-?buzz|anti-?pattern)\b/i;
function beatIsDesignRelevant(fm, f) {
  const hay = `${f} ${fm.name || ''} ${fm.description || ''} ${fm.type || ''}`;
  return DESIGN_BEAT_RE.test(hay);
}

function assembleBeats(beatsDir) {
  const entries = [];
  let files;
  try { files = fs.readdirSync(beatsDir).filter((f) => f.endsWith('.md')); } catch (_e) { files = []; }
  for (const f of files.sort()) {
    const raw = readTextSafe(path.join(beatsDir, f));
    if (raw == null) continue;
    const { fm, body } = parseFrontmatter(raw);
    if (!beatIsDesignRelevant(fm, f)) continue; // de-weight: our non-design beats are not the baseline
    entries.push({
      sourceKind: 'beat',
      file: f,
      name: fm.name || f,
      description: fm.description || '',
      type: fm.type || '',
      trust: 'internal',
      bodyExcerpt: body.trim().slice(0, BEAT_BODY_LIMIT),
    });
  }
  return entries;
}

function assembleAuditHistory(historyPath) {
  const files = [historyPath, historyPath + '.1'];
  const byRule = new Map();
  let totalScans = 0;
  let lastUtc = null;
  for (const fp of files) {
    const raw = readTextSafe(fp);
    if (raw == null) continue;
    for (const line of raw.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      let obj;
      try { obj = JSON.parse(t); } catch (_e) { continue; }
      totalScans += 1;
      if (obj && typeof obj.utc === 'string' && (!lastUtc || obj.utc > lastUtc)) lastUtc = obj.utc;
      const findings = Array.isArray(obj && obj.findings) ? obj.findings : [];
      for (const fnd of findings) {
        const rule = fnd && fnd.rule ? String(fnd.rule) : 'unknown';
        const sev = fnd && fnd.severity ? String(fnd.severity) : 'unknown';
        const lens = fnd && fnd.lens ? String(fnd.lens) : 'unknown';
        if (!byRule.has(rule)) byRule.set(rule, { rule, fires: 0, bySeverity: {}, byLens: {}, lastUtc: null });
        const rec = byRule.get(rule);
        rec.fires += 1;
        rec.bySeverity[sev] = (rec.bySeverity[sev] || 0) + 1;
        rec.byLens[lens] = (rec.byLens[lens] || 0) + 1;
        if (obj && typeof obj.utc === 'string' && (!rec.lastUtc || obj.utc > rec.lastUtc)) rec.lastUtc = obj.utc;
      }
    }
  }
  const entries = [...byRule.values()]
    .sort((a, b) => b.fires - a.fires)
    .map((r) => ({ sourceKind: 'measured-audit-history', ...r }));
  return { totalScans, lastUtc, entries };
}

/** Resolve provenance for an external file: sibling provenance.json, else the pinned manifest, else the dir name. */
function externalProvenance(file, manifest) {
  const rel = path.relative(EXTERNAL_DIR, file);
  const sourceSlug = rel.split(path.sep)[0] || 'unknown';
  // A provenance.json is written per-source by sidecoach-taste-ingest; find the nearest one up the tree.
  let dir = path.dirname(file);
  while (dir.startsWith(EXTERNAL_DIR)) {
    const prov = readTextSafe(path.join(dir, 'provenance.json'));
    if (prov != null) {
      try {
        const parsed = JSON.parse(prov);
        const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed && parsed.files) ? parsed.files : []);
        const hit = list.find((e) => e && typeof e.path === 'string' && file.endsWith(e.path));
        const meta = hit || (Array.isArray(parsed) ? parsed[0] : parsed) || {};
        return {
          source: meta.source || sourceSlug,
          repo_url: meta.repo_url || null,
          commit: meta.commit_sha || meta.commit || null,
          retrieved_utc: meta.retrieved_utc || null,
          license: meta.license || null,
        };
      } catch (_e) { /* fall through to manifest */ }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  const mSrc = manifest && Array.isArray(manifest.sources)
    ? manifest.sources.find((s) => s && (s.source === sourceSlug))
    : null;
  return {
    source: (mSrc && mSrc.source) || sourceSlug,
    repo_url: (mSrc && mSrc.repo_url) || null,
    commit: null,
    retrieved_utc: null,
    license: (mSrc && mSrc.license) || null,
  };
}

function assembleExternal() {
  let manifest = null;
  const rawManifest = readTextSafe(TASTE_SOURCES);
  if (rawManifest != null) { try { manifest = JSON.parse(rawManifest); } catch (_e) { manifest = null; } }
  const entries = [];
  for (const file of listFilesRec(EXTERNAL_DIR, '.md')) {
    const raw = readTextSafe(file);
    if (raw == null) continue;
    const prov = externalProvenance(file, manifest);
    entries.push({
      sourceKind: 'expert-external',
      file: path.relative(SIDECOACH_ROOT, file),
      source: prov.source,
      provenance: prov,
      trust: 'untrusted',              // READ as data, never followed/executed
      untrusted: true,
      // NOTE: the body is DATA. It is truncated and surfaced for the lens to cite, never obeyed.
      bodyExcerpt: raw.trim().slice(0, EXTERNAL_BODY_LIMIT),
    });
  }
  return entries;
}

function assembleRuleStores(RULES, guidance) {
  const registry = RULES.map((r) => ({
    ruleId: r.ruleId,
    canonicalRuleKey: r.canonicalRuleKey,
    sourceRuleAliases: r.sourceRuleAliases,
    findingClass: r.findingClass,
    severity: r.severity,
    registryScope: r.registryScope,
    ownerValidatorId: r.ownerValidatorId,
    store: 'product-rule-registry',
  }));
  const entries = [];
  for (const r of registry) entries.push({ sourceKind: 'rule-store-for-dedup', ...r });
  for (const g of [...guidance.designLaws, ...guidance.craft, ...guidance.judgment]) {
    entries.push({ sourceKind: 'rule-store-for-dedup', ...g });
  }
  return entries;
}

function assembleCorpus(opts) {
  const beatsDir = (opts && opts.beatsDir) || DEFAULT_BEATS_DIR;
  const historyPath = process.env.SIDECOACH_AUDIT_HISTORY || path.join(SIDECOACH_ROOT, 'data', 'audit-history.jsonl');
  const reg = opts.registry;
  const guidance = opts.guidance;

  const beats = assembleBeats(beatsDir);
  const audit = assembleAuditHistory(historyPath);
  const external = assembleExternal();
  const ruleStores = assembleRuleStores(reg.RULES, guidance);

  const entries = [...beats, ...audit.entries, ...external, ...ruleStores];
  return {
    schema: 'sidecoach-taste-corpus/v1',
    generated_utc: nowIso(),
    commit: shortHead(),
    stats: {
      beat: beats.length,
      'measured-audit-history': audit.entries.length,
      totalScans: audit.totalScans,
      lastScanUtc: audit.lastUtc,
      'expert-external': external.length,
      'rule-store-for-dedup': ruleStores.length,
    },
    sources: {
      beat: beats,
      'measured-audit-history': { totalScans: audit.totalScans, lastUtc: audit.lastUtc, entries: audit.entries },
      'expert-external': external,
      'rule-store-for-dedup': ruleStores,
    },
    entries, // flat, every entry carries sourceKind - what the lenses fan out over
  };
}

// Resolve a path to its real (symlink-followed) form even when it or its tail does not exist yet:
// realpath the nearest existing ancestor, then re-append the not-yet-created segments. Lets us
// decide containment against the REAL target (so a cursor symlink into the repo is caught) without
// creating anything. Mirrors sidecoach-taste-ingest.js's realResolve.
function realResolve(p) {
  let probe = path.resolve(p);
  const tail = [];
  for (let i = 0; i < 4096; i++) {
    try {
      const real = fs.realpathSync(probe);
      return tail.length ? path.join(real, ...tail) : real;
    } catch (err) {
      if (!err || err.code !== 'ENOENT') throw err;
      const parent = path.dirname(probe);
      if (parent === probe) return tail.length ? path.join(probe, ...tail) : probe;
      tail.unshift(path.basename(probe));
      probe = parent;
    }
  }
  throw new Error(`could not resolve real path for ${p}`);
}

// A stable content signature of everything the miner consumes (beats + measured audit-history +
// external expert content + rule stores). Excludes the volatile top-level generated_utc/commit;
// hashes only corpus.entries, canonicalized by stringify-then-SORT so entry ORDER can never
// spuriously flip the signature. Two runs over identical inputs produce the same sig; any real
// input change flips it. Used by the precheck (run/skip) and advance (record) gate.
function computeInputSignature() {
  const registry = loadRegistry();
  const guidance = loadGuidanceStores();
  const corpus = assembleCorpus({ beatsDir: DEFAULT_BEATS_DIR, registry, guidance });
  const parts = corpus.entries.map((e) => JSON.stringify(e)).sort();
  const sig = crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
  return { sig, stats: corpus.stats };
}

// ---------------------------------------------------------------------------
// dedup index
// ---------------------------------------------------------------------------
/**
 * Build the dedup index from every rule store, split into two TIERS so a mere name/tail resemblance
 * can never DROP a novel rule:
 *   strong: an IDENTITY key (ruleId, full canonicalRuleKey, alias, or guidance id). A strong match to
 *           a registry rule is a true restatement -> duplicate (same severity) / strengthen (diff severity).
 *   weak:   a RESEMBLANCE key (the canonical-key tail, registryScope, a guidance name/title). A weak-only
 *           match is namespace-blind, so it never drops the candidate; it is kept and flagged `resembles`.
 * Also returns registryById / registryByKey (full existing defs for the strengthen re-anchor).
 */
function buildDedupIndex(RULES, guidance) {
  const strong = new Map();
  const weak = new Map();
  const addStrong = (key, ref) => { const k = normalizeKey(key); if (k && !strong.has(k)) strong.set(k, ref); };
  const addWeak = (key, ref) => { const k = normalizeKey(key); if (k && !weak.has(k)) weak.set(k, ref); };

  const registryById = new Map();
  const registryByKey = new Map();
  for (const r of RULES) {
    registryById.set(r.ruleId, r);
    registryByKey.set(r.canonicalRuleKey, r);
    const ref = { store: 'product-rule-registry', ref: r.ruleId };
    addStrong(r.ruleId, ref);
    addStrong(r.canonicalRuleKey, ref);
    for (const a of (r.sourceRuleAliases || [])) addStrong(a, ref);
    // WEAK: the human-readable tail (anti-pattern/gradient-text -> "gradient text") and the scope. These
    // are namespace-blind, so they only ever flag a resemblance - never drop a differently-keyed candidate.
    addWeak(String(r.canonicalRuleKey).split('/').pop(), ref);
    addWeak(r.registryScope, ref);
  }
  for (const g of [...guidance.designLaws, ...guidance.craft, ...guidance.judgment]) {
    const ref = { store: g.store, ref: g.id || g.name };
    if (g.id) addStrong(g.id, ref);
    if (g.name) addWeak(g.name, ref);   // a prose title is a resemblance signal, not an identity
  }
  return { strong, weak, registryById, registryByKey };
}

// ---------------------------------------------------------------------------
// candidate normalization -> a full ProductRuleDefinition (GUIDANCE-tier defaults)
// ---------------------------------------------------------------------------
const OWNER_FOR_CLASS = {
  polish: 'polish-standard',
  a11y: 'static-a11y',
  'anti-pattern': 'anti-pattern',
  theming: 'theming',
  perf: 'page-quality',
  copy: 'polish-standard',
};
// sourceSeverity chosen so SEVERITY_TABLE[sourceSeverity] === severity (no undocumented divergence).
const SEVERITY_TO_SOURCE = { blocker: 'critical', major: 'high', minor: 'medium', advisory: 'low' };
const STATIC_EVIDENCE = new Set(['css-rule', 'markup']);
// The frozen EvidenceKind enum (product-rule-types EVIDENCE_SOURCE_COMPATIBILITY). Used to sanitize a
// candidate's declared evidence kinds so an unknown/typoed kind cannot crash validateRegistry; the
// authoritative set is loaded from dist (reg.knownEvidenceKinds), this is only the fallback.
const DEFAULT_KNOWN_EVIDENCE = ['css-rule', 'computed-style', 'dom', 'markup', 'contrast', 'rendered-scan'];

function ownerForClass(cls) { return OWNER_FOR_CLASS[cls] || 'polish-standard'; }

// ---------------------------------------------------------------------------
// example-corpus FREEZE (mirrors eval/corpus-tool.mjs canonicalRecord/recordHash EXACTLY)
// ---------------------------------------------------------------------------
// The miner is synchronous CommonJS and corpus-tool.mjs is ESM, so rather than take a runtime
// ESM dependency in this hot path we MIRROR corpus-tool's two pure functions here byte-for-byte
// (same field order, same trim+lowercase norm, same sha256-of-JSON hash) and PIN the parity with
// a test that dynamically imports corpus-tool and asserts identical recordHashes. The result is a
// tamper-evident frozen record per example: its id/label/split/provenance/file and the file's
// content are all bound into recordHash, so any later edit is detectable.
function normLower(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
function sha256File(abs) { return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex'); }
function recordHashOf(rec) { return crypto.createHash('sha256').update(JSON.stringify(rec)).digest('hex'); }

// The canonical record for one ExampleRef, structurally identical to corpus-tool.canonicalRecord.
function canonicalExampleRecord(ref, contentSha256) {
  const labels = [{ class: normLower(ref.label), labeledBy: normLower(ref.labeledBy) }]
    .sort((a, b) => (a.class + a.labeledBy).localeCompare(b.class + b.labeledBy));
  return { id: ref.id, split: ref.split, labels, file: ref.file, contentSha256, provenance: ref.provenance || {} };
}

/**
 * Freeze an exampleCorpus: for each positive/negative ExampleRef, read the referenced file,
 * compute its content sha256, and bind a canonical recordHash. A missing/unreadable file or a
 * declared-vs-actual sha mismatch is recorded as an ERROR (the candidate is FILED with it, never
 * dropped). Relative file paths resolve against baseDir. Never throws.
 */
function freezeExampleCorpus(exampleCorpus, baseDir) {
  const errors = [];
  const frozen = { positives: [], negatives: [] };
  if (!exampleCorpus || typeof exampleCorpus !== 'object') {
    return { frozen, errors: ['exampleCorpus is not an object'] };
  }
  for (const bucket of ['positives', 'negatives']) {
    const raw = exampleCorpus[bucket];
    if (raw === undefined) continue;
    if (!Array.isArray(raw)) { errors.push(`exampleCorpus.${bucket} must be an array`); continue; }
    const expectedLabel = bucket === 'positives' ? 'fires' : 'clean';
    for (let i = 0; i < raw.length; i++) {
      const ref = raw[i] || {};
      const label = ref.label || expectedLabel;
      if (ref.label && ref.label !== expectedLabel) errors.push(`exampleCorpus.${bucket}[${i}] label '${ref.label}' does not match bucket (expected '${expectedLabel}')`);
      if (!ref.file || typeof ref.file !== 'string') { errors.push(`exampleCorpus.${bucket}[${i}] is missing a string 'file'`); continue; }
      const abs = path.isAbsolute(ref.file) ? ref.file : path.join(baseDir || SIDECOACH_ROOT, ref.file);
      let contentSha256;
      try { contentSha256 = sha256File(abs); }
      catch (e) { errors.push(`exampleCorpus.${bucket}[${i}] file unreadable (${ref.file}): ${e && e.message ? e.message : String(e)}`); continue; }
      if (ref.contentSha256 && ref.contentSha256 !== contentSha256) errors.push(`exampleCorpus.${bucket}[${i}] declared contentSha256 does not match the file (${ref.file})`);
      const split = ref.split === 'heldout' ? 'heldout' : 'tune';
      const canonical = canonicalExampleRecord({ id: safeStr(ref.id, `${bucket}-${i}`) || `${bucket}-${i}`, file: ref.file, label, labeledBy: safeStr(ref.labeledBy, 'unknown') || 'unknown', split, provenance: ref.provenance || {} }, contentSha256);
      frozen[bucket].push({
        id: canonical.id, file: ref.file, label, labeledBy: canonical.labels[0].labeledBy,
        split, provenance: ref.provenance || {}, contentSha256, recordHash: recordHashOf(canonical),
      });
    }
  }
  return { frozen, errors };
}

function normalizeCandidate(c, opts) {
  const pr = (c && c.proposedRule) || {};
  const title = safeStr(c && c.title ? c.title : (pr.canonicalRuleKey || pr.ruleId), 'untitled taste rule') || 'untitled taste rule';
  const findingClass = pr.findingClass || 'polish';
  const severity = pr.severity || 'minor';
  const sourceSeverity = pr.sourceSeverity || SEVERITY_TO_SOURCE[severity] || 'medium';
  // Sanitize declared evidence kinds against the frozen enum. An unknown kind (a typo like "css", or
  // "not-real" from an untrusted lens) is DROPPED and recorded, so validateRegistry gets a clean list and
  // reports a specific field error (missing evidenceRequirements/supportedSourceKinds) instead of throwing.
  const known = (opts && opts.knownEvidenceKinds) || DEFAULT_KNOWN_EVIDENCE;
  const rawEvidence = Array.isArray(pr.evidenceRequirements) && pr.evidenceRequirements.length
    ? pr.evidenceRequirements
    : ['css-rule'];
  const evidenceRequirements = rawEvidence.filter((e) => known.includes(e));
  const droppedEvidence = rawEvidence.filter((e) => !known.includes(e));
  const canonicalRuleKey = pr.canonicalRuleKey || `mined/${slugify(title)}`;
  // ruleId mirrors the canonical key (dot for slash) exactly as every registry rule does, so a
  // key-carrying candidate gets a coherent id; only a keyless candidate falls back to the title.
  const ruleId = pr.ruleId
    || (pr.canonicalRuleKey
      ? canonicalRuleKey.replace(/\//g, '.').replace(/[^A-Za-z0-9._-]+/g, '-')
      : `mined.${slugify(title).replace(/-/g, '_')}`);
  const allStatic = evidenceRequirements.every((e) => STATIC_EVIDENCE.has(e));

  // TOTALITY: an untrusted candidate may name an unknown evidence kind (a typo like "css", or "not-real").
  // supportedKindsFor THROWS on an unknown kind, which would abort the whole run before the candidate could
  // be pre-flighted. Catch it and leave supportedSourceKinds EMPTY: validateRegistry then FILES a
  // "missing supportedSourceKinds" field error for this one candidate (its divergence check is skipped
  // because it requires a non-empty list), so a malformed candidate is filed with its errors, never dropped
  // and never crashing the run.
  let supportedSourceKinds;
  try { supportedSourceKinds = evidenceRequirements.length ? opts.supportedKindsFor(...evidenceRequirements) : []; }
  catch (_e) { supportedSourceKinds = []; }

  const def = {
    ruleId,
    sourceRuleAliases: Array.isArray(pr.sourceRuleAliases) && pr.sourceRuleAliases.length
      ? pr.sourceRuleAliases
      : [`mined:${ruleId}`],
    canonicalRuleKey,
    ownerValidatorId: pr.ownerValidatorId || ownerForClass(findingClass),
    sourceVocabulary: pr.sourceVocabulary || 'mined-taste',
    sourceSeverity,
    severity,
    findingClass,
    registryScope: pr.registryScope || `mined-${slugify(title)}`,
    evidenceRequirements,
    supportedSourceKinds,
    scope: pr.scope || 'file',
    narrowTargetBehavior: pr.narrowTargetBehavior || 'evaluate_expanded_context',
    applicability: pr.applicability || (allStatic ? 'not_applicable' : 'inconclusive'),
  };
  if (pr.severityOverrideReason) def.severityOverrideReason = pr.severityOverrideReason;
  // Phase 3a: carry the OPTIONAL runnable-detector DATA onto the def so it flows into the
  // quarantine record's `rule` field. These are DATA only - preflight screens them (regex ReDoS
  // screen + predicate allowlist) and freezes the corpus; nothing here executes them.
  if (pr.patternSpec !== undefined) def.patternSpec = pr.patternSpec;
  if (pr.exampleCorpus !== undefined) def.exampleCorpus = pr.exampleCorpus;

  const detectable = evidenceRequirements.some((e) => STATIC_EVIDENCE.has(e) || e === 'rendered-scan');
  return {
    title,
    def,
    minedBy: c && c.minedBy ? safeStr(c.minedBy, 'unknown-lens') : 'unknown-lens',
    sourceKind: c && c.sourceKind ? safeStr(c.sourceKind, 'speculative') : 'speculative',
    confidence: c && c.confidence ? safeStr(c.confidence, 'low') : 'low',
    rationale: c && c.rationale ? safeStr(c.rationale, '') : '',
    evidence: Array.isArray(c && c.evidence) ? c.evidence.map((e) => safeStr(e, '')) : [],
    suggestedSeverity: severity,
    detectable,
    normalizationWarnings: droppedEvidence.length
      ? [`dropped unknown evidence kind(s): ${droppedEvidence.map((e) => safeStr(e, '?')).join(', ')}`]
      : [],
  };
}

// ---------------------------------------------------------------------------
// dedup classification: net-new / strengthen-existing / duplicate(dropped)
// ---------------------------------------------------------------------------
function classify(cand, dedup) {
  const def = cand.def;
  // STRONG (identity) keys: the candidate's own ruleId, full canonical key, and aliases.
  const strongKeys = [
    normalizeKey(def.ruleId),
    normalizeKey(def.canonicalRuleKey),
    ...(def.sourceRuleAliases || []).map(normalizeKey),
  ].filter(Boolean);
  // WEAK (resemblance) keys: the title and the canonical-key tail (namespace-blind).
  const weakKeys = [
    normalizeKey(cand.title),
    normalizeKey(String(def.canonicalRuleKey).split('/').pop()),
  ].filter(Boolean);

  let strongMatch = null;
  for (const k of strongKeys) { if (dedup.strong.has(k)) { strongMatch = dedup.strong.get(k); break; } }

  if (strongMatch) {
    if (strongMatch.store === 'product-rule-registry') {
      const existing = dedup.registryById.get(strongMatch.ref) || dedup.registryByKey.get(def.canonicalRuleKey) || null;
      // Same severity + no measured force = a true restatement -> DUPLICATE (dropped). Different
      // severity (or a measured strengthen) -> re-anchor onto the existing identity and strengthen.
      if (existing && existing.severity === def.severity && !cand.forceStrengthen) {
        return { disposition: 'duplicate', matchedExisting: refStr(strongMatch), matchedRegistryRule: existing };
      }
      return { disposition: 'strengthen-existing', matchedExisting: refStr(strongMatch), matchedRegistryRule: existing };
    }
    // A strong match to a guidance id (rare): guidance is not a registry rule, so this is a NEW registry
    // rule that formalizes existing prose. Keep it, flag the resemblance; never re-anchor or drop.
    return { disposition: 'net-new', matchedExisting: null, matchedRegistryRule: null, resembles: refStr(strongMatch) };
  }

  // No identity match. A WEAK (tail/title/name) match only RESEMBLES an existing rule - a candidate for
  // copy/button-label-specific must NOT be dropped as a duplicate of a11y/button-label-specific. Keep it
  // as net-new, flagged `resembles` so a human sees the similar existing rule.
  let weakMatch = null;
  for (const k of weakKeys) { if (dedup.weak.has(k)) { weakMatch = dedup.weak.get(k); break; } }
  if (weakMatch) return { disposition: 'net-new', matchedExisting: null, matchedRegistryRule: null, resembles: refStr(weakMatch) };
  return { disposition: 'net-new', matchedExisting: null, matchedRegistryRule: null };
}

function refStr(matched) { return `${matched.store}:${matched.ref}`; }

// ---------------------------------------------------------------------------
// per-candidate validateRegistry pre-flight IN ISOLATION
// ---------------------------------------------------------------------------
/**
 * Union RULES with THIS ONE candidate and run validateRegistry, then subtract the baseline errors so
 * the result reflects only THIS candidate. net-new is ADDED; strengthen-existing REPLACES its matched
 * registry rule (so a coherent modified registry is validated, not a self-colliding union).
 */
function preflight(cand, cls, reg, baselineErrorSet) {
  let unioned;
  let def = cand.def;
  if (cls.disposition === 'strengthen-existing' && cls.matchedRegistryRule) {
    // Re-anchor the proposal onto the existing rule identity (only the severity strengthens).
    const existing = cls.matchedRegistryRule;
    def = {
      ...existing,
      severity: cand.def.severity,
      sourceSeverity: SEVERITY_TO_SOURCE[cand.def.severity] || existing.sourceSeverity,
      sourceRuleAliases: [...new Set([...(existing.sourceRuleAliases || []), `mined:strengthen:${existing.ruleId}`])],
    };
    delete def.checkProduct;
    cand.def = def;
    unioned = reg.RULES.map((r) => (r.ruleId === existing.ruleId ? def : r));
  } else {
    unioned = [...reg.RULES, def];
  }
  // TOTALITY: validateRegistry itself can throw on a sufficiently malformed candidate (e.g. an unknown
  // evidence kind that reaches its own supportedKindsFor call). A throw here must FILE the candidate with
  // the error, never abort the run - the whole point is that a bad candidate is filed, not dropped.
  let res;
  try {
    res = reg.validateRegistry(unioned, reg.VALIDATOR_REGISTRATIONS, reg.gating, reg.browser, reg.rendered);
  } catch (err) {
    return { ok: false, errors: [`validateRegistry threw on this candidate: ${err && err.message ? err.message : String(err)}`] };
  }
  const errors = (res.errors || []).filter((e) => !baselineErrorSet.has(e));

  // Phase 3a preflight extensions (all fail-with-filing, never throw):
  //   (a) screen every patternSpec regex under the ReDoS budget + (b) reject any predicateId not
  //   in the allowlist (both via the SAME screenPatternSpec the interpreter's module exports), and
  //   (c) freeze the exampleCorpus (content sha + canonical recordHash). A malformed spec or corpus
  //   adds errors here, so the candidate is FILED with them rather than dropped.
  let spec = null;
  let frozenCorpus = null;
  if (def.patternSpec !== undefined) {
    if (typeof reg.screenPatternSpec === 'function') {
      const s = reg.screenPatternSpec(def.patternSpec);
      spec = { ok: !!s.ok, errors: s.errors || [] };
      for (const e of (s.errors || [])) errors.push(`patternSpec: ${e}`);
    } else {
      errors.push('patternSpec present but the compiled screen is unavailable');
    }
  }
  if (def.exampleCorpus !== undefined) {
    const f = freezeExampleCorpus(def.exampleCorpus, reg.corpusBaseDir);
    frozenCorpus = f.frozen;
    for (const e of f.errors) errors.push(`exampleCorpus: ${e}`);
  }

  return { ok: errors.length === 0, errors, spec, frozenCorpus };
}

// ---------------------------------------------------------------------------
// deterministic measured-signal candidates (no live model needed - the launchd fallback)
// ---------------------------------------------------------------------------
/**
 * From the audit-history fire-rates, propose a severity review for any EXISTING registry rule that
 * fires >= FIRE_THRESHOLD but is currently non-blocking. Purely deterministic; empty when the log is.
 */
function deriveMeasuredCandidates(corpus, reg) {
  const out = [];
  const byId = new Map(reg.RULES.map((r) => [r.ruleId, r]));
  const audit = corpus.sources['measured-audit-history'];
  for (const rec of audit.entries) {
    if (rec.fires < FIRE_THRESHOLD) continue;
    const existing = byId.get(rec.rule);
    if (!existing) continue;                          // fired rule with no registry mapping - skip (nothing to strengthen)
    if (existing.severity === 'blocker' || existing.severity === 'major') continue; // already gating
    out.push({
      title: existing.canonicalRuleKey,
      minedBy: 'recurring-defect',
      sourceKind: 'measured-audit-history',
      confidence: rec.fires >= FIRE_THRESHOLD * 4 ? 'high' : 'medium',
      forceStrengthen: true,
      rationale: `Rule ${existing.ruleId} fired ${rec.fires}x across our own audits (severities ${JSON.stringify(rec.bySeverity)}); measured recurrence suggests reviewing whether ${existing.severity} is strong enough.`,
      evidence: [`data/audit-history.jsonl: ${existing.ruleId} fired ${rec.fires}x, last ${rec.lastUtc}`],
      proposedRule: {
        ruleId: existing.ruleId,
        canonicalRuleKey: existing.canonicalRuleKey,
        findingClass: existing.findingClass,
        severity: existing.severity === 'advisory' ? 'minor' : 'major',
        evidenceRequirements: existing.evidenceRequirements,
        scope: existing.scope,
        registryScope: existing.registryScope,
        ownerValidatorId: existing.ownerValidatorId,
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// ranking (expert-external is the BASELINE > our measured data > our beats > speculative;
// detectable outranks vibe). The outside design pioneers set the taste baseline the miner
// evolves FROM; our own beats are de-weighted to minor context, never the baseline (Jonah
// 2026-08-24 - "their pioneering ... should be our baseline; not our work as a baseline").
// ---------------------------------------------------------------------------
const SOURCE_RANK = { 'expert-external': 3, 'measured-audit-history': 2, beat: 1, speculative: 0 };
const CONF_RANK = { high: 2, medium: 1, low: 0 };
function rankScore(cand) {
  return (SOURCE_RANK[cand.sourceKind] != null ? SOURCE_RANK[cand.sourceKind] : 0) * 10
    + (cand.detectable ? 5 : 0)
    + (CONF_RANK[cand.confidence] || 0);
}

// ---------------------------------------------------------------------------
// findings-file loading (a lens/synthesis artifact, or a hand-authored fixture)
// ---------------------------------------------------------------------------
function loadFindings(file) {
  const raw = readTextSafe(file);
  if (raw == null) { const e = new Error(`--findings file not readable: ${file}`); e.exitCode = EXIT_FINDINGS; throw e; }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) {
    const e = new Error(`--findings file is not valid JSON: ${err && err.message ? err.message : String(err)}`);
    e.exitCode = EXIT_FINDINGS; throw e;
  }
  const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.candidates) ? parsed.candidates : null);
  if (!Array.isArray(list)) {
    const e = new Error('--findings file must be an array of candidates OR { "candidates": [...] }');
    e.exitCode = EXIT_FINDINGS; throw e;
  }
  return list;
}

// ---------------------------------------------------------------------------
// inert output writing
// ---------------------------------------------------------------------------
function writeInertOutput(processed, corpus, reg, opts) {
  const proposedDir = opts.proposedDir || DEFAULT_PROPOSED_DIR;
  const candidatesFile = opts.candidatesFile || DEFAULT_CANDIDATES_FILE;
  // The proposal beat is written to beatOutDir (defaults to the corpus beats dir, which is
  // .claude/memory in production - the beat then joins the corpus for the next mine). Decoupled
  // so a test or an initial seed can read real beats yet write the beat to a scratch dir.
  const beatsDir = opts.beatOutDir || opts.beatsDir || DEFAULT_BEATS_DIR;
  const commit = corpus.commit;
  const generated = nowIso();
  const dateStamp = sanitizeDate(opts.date);   // strips any path-traversal from --date before it hits a filename

  // Refuse any write outside the inert quarantine BEFORE touching disk (a bad --out-dir / --candidates-file /
  // --beat-out-dir cannot overwrite the registry, a hook, or config, flag-driven or not).
  assertSafeWrite(proposedDir, [SAFE_DATA_DIR], 'proposed-rules dir');
  assertSafeWrite(candidatesFile, [SAFE_DATA_DIR], 'candidates queue');
  assertSafeWrite(beatsDir, [SAFE_MEMORY_DIR], 'proposal beat dir');

  try { fs.mkdirSync(proposedDir, { recursive: true }); } catch (_e) { /* checked on write */ }

  const written = [];
  const dropped = [];
  for (const p of processed) {
    if (p.cls.disposition === 'duplicate') {
      dropped.push({ proposedRuleId: p.cand.def.ruleId, title: p.cand.title, reason: 'duplicate', matchedExisting: p.cls.matchedExisting });
      continue;
    }
    const provenance = {
      source: p.cand.sourceKind === 'expert-external' && p.provenanceSource ? p.provenanceSource : p.cand.minedBy,
      sourceKind: p.cand.sourceKind,
      commit,
      retrieved_utc: generated,
      minedBy: p.cand.minedBy,
      rationale: p.cand.rationale,
      evidence: p.cand.evidence,
      suggestedSeverity: p.cand.suggestedSeverity,
      confidence: p.cand.confidence,
      normalizationWarnings: p.cand.normalizationWarnings || [],
    };
    const record = {
      candidateVersion: 1,
      ruleId: p.cand.def.ruleId,
      title: p.cand.title,
      disposition: p.cls.disposition,
      matchedExisting: p.cls.matchedExisting,
      resembles: p.cls.resembles || null,
      rank: p.rank,
      rule: p.cand.def,
      provenance,
      preflight: { ok: p.pre.ok, errors: p.pre.errors, validatedAgainst: commit, spec: p.pre.spec || null },
      // Phase 3a: the tamper-evident freeze of the labeled example corpus (content sha + canonical
      // recordHash per example). null when the candidate carries no exampleCorpus.
      frozenCorpus: p.pre.frozenCorpus || null,
      quarantine: 'INERT DATA - reviewed by a human before any promotion; imported by no source file.',
    };
    const outFile = path.join(proposedDir, `${sanitizeId(p.cand.def.ruleId)}.json`);
    fs.writeFileSync(outFile, JSON.stringify(record, null, 2) + '\n');
    written.push({ ...record, file: path.relative(SIDECOACH_ROOT, outFile) });
  }

  const counts = {
    netNew: written.filter((w) => w.disposition === 'net-new').length,
    strengthenExisting: written.filter((w) => w.disposition === 'strengthen-existing').length,
    duplicateDropped: dropped.length,
    preflightFailed: written.filter((w) => !w.preflight.ok).length,
  };

  const queue = {
    schema: 'sidecoach-taste-candidates/v1',
    generated_utc: generated,
    commit,
    minedBy: 'sidecoach-mine',
    note: 'INERT proposal queue. Nothing here is enforced. Promotion is a separate, human-gated step (Phase 1 gate). No source file imports data/proposed-rules/.',
    corpusStats: corpus.stats,
    counts,
    candidates: written
      .sort((a, b) => b.rank - a.rank)
      .map((w) => ({
        ruleId: w.ruleId,
        title: w.title,
        disposition: w.disposition,
        canonicalRuleKey: w.rule.canonicalRuleKey,
        findingClass: w.rule.findingClass,
        severity: w.rule.severity,
        minedBy: w.provenance.minedBy,
        sourceKind: w.provenance.sourceKind,
        confidence: w.provenance.confidence,
        detectable: w.rule.evidenceRequirements.some((e) => STATIC_EVIDENCE.has(e) || e === 'rendered-scan'),
        preflightOk: w.preflight.ok,
        rank: w.rank,
        matchedExisting: w.matchedExisting,
        resembles: w.resembles || null,
        file: w.file,
      })),
    dropped,
  };
  try { fs.mkdirSync(path.dirname(candidatesFile), { recursive: true }); } catch (_e) { /* checked on write */ }
  fs.writeFileSync(candidatesFile, JSON.stringify(queue, null, 2) + '\n');

  const beatFile = path.join(beatsDir, `taste_mine_${dateStamp}.md`);
  // Re-check the COMPOSED path (not just the dir) so no filename component can escape the beat zone.
  assertSafeWrite(beatFile, [SAFE_MEMORY_DIR], 'proposal beat file');
  try { fs.mkdirSync(beatsDir, { recursive: true }); } catch (_e) { /* checked on write */ }
  fs.writeFileSync(beatFile, renderProposalBeat(queue, written, dropped, dateStamp));

  return { written, dropped, counts, queueFile: candidatesFile, beatFile };
}

function sanitizeId(id) { return String(id).replace(/[^A-Za-z0-9._-]+/g, '_'); }

// The --date value flows into the beat FILENAME. Strip everything but digits and hyphens so it can carry
// no path separator or `..` traversal (path.join collapses `../`, which would otherwise escape the beat dir
// and let --date write an arbitrary .md - e.g. the repo-root CLAUDE.md - defeating assertSafeWrite's
// directory-only check). An empty/garbage value falls back to today.
function sanitizeDate(d) {
  const s = String(d == null ? '' : d).replace(/[^0-9-]+/g, '').slice(0, 12);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : todayStamp();
}

function renderProposalBeat(queue, written, dropped, dateStamp) {
  const lines = [];
  lines.push('---');
  lines.push(`name: Taste mine ${dateStamp} - proposed candidates (INERT)`);
  lines.push(`description: ${queue.counts.netNew} net-new + ${queue.counts.strengthenExisting} strengthen-existing taste-rule candidates mined into the inert quarantine; ${queue.counts.duplicateDropped} restatement(s) dropped by dedup. Not enforced; awaiting human review.`);
  lines.push('type: project');
  lines.push('source: hook');
  lines.push('verified: none - proposals are inert data, not enforced; each pre-flighted through validateRegistry in isolation');
  lines.push('confidence: low');
  lines.push('---');
  lines.push('');
  lines.push(`# Taste mine ${dateStamp} (proposed candidates - INERT, awaiting review)`);
  lines.push('');
  lines.push(`Mined by sidecoach-mine against commit ${queue.commit}. These candidates are INERT DATA in`);
  lines.push('`sidecoach/data/proposed-rules/` and the queue `sidecoach/data/taste-candidates.json`. Nothing here is');
  lines.push('enforced: no source file imports the quarantine, and promotion to a live rule is a separate,');
  lines.push('human-gated step. External expert content was read as DATA for provenance and evidence only.');
  lines.push('');
  lines.push('## Corpus');
  lines.push(`- beats: ${queue.corpusStats.beat}`);
  lines.push(`- measured audit-history rules: ${queue.corpusStats['measured-audit-history']} (from ${queue.corpusStats.totalScans} scan(s))`);
  lines.push(`- expert-external files: ${queue.corpusStats['expert-external']}`);
  lines.push(`- rule-store entries (dedup): ${queue.corpusStats['rule-store-for-dedup']}`);
  lines.push('');
  lines.push('## Candidates (ranked: measured > expert > speculative; detectable outranks vibe)');
  if (written.length === 0) {
    lines.push('- (none survived to the queue this run)');
  } else {
    for (const w of [...written].sort((a, b) => b.rank - a.rank)) {
      const flag = w.preflight.ok ? '' : ' [PRE-FLIGHT FAILED - filed with errors]';
      lines.push(`- **${w.title}** (${w.disposition}, ${w.rule.severity}, ${w.provenance.sourceKind}/${w.provenance.confidence})${flag}`);
      lines.push(`  - ruleId: \`${w.ruleId}\`  minedBy: ${w.provenance.minedBy}`);
      if (w.matchedExisting) lines.push(`  - matched existing: ${w.matchedExisting}`);
      if (w.resembles) lines.push(`  - resembles (different identity, kept for review): ${w.resembles}`);
      if (w.provenance.rationale) lines.push(`  - why: ${w.provenance.rationale}`);
      for (const ev of w.provenance.evidence.slice(0, 4)) lines.push(`  - evidence: ${ev}`);
      if (!w.preflight.ok) for (const err of w.preflight.errors) lines.push(`  - preflight error: ${err}`);
    }
  }
  if (dropped.length) {
    lines.push('');
    lines.push('## Dropped by dedup (restatements of existing rules)');
    for (const d of dropped) lines.push(`- ${d.title} -> ${d.reason} of ${d.matchedExisting}`);
  }
  lines.push('');
  lines.push('## Next');
  lines.push('A human reviews each candidate (rule body + provenance + evidence + pre-flight) and promotes the');
  lines.push('accepted ones through the separate, consent-gated promotion path. This miner never promotes.');
  lines.push('');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// run pipeline
// ---------------------------------------------------------------------------
function runPipeline(opts) {
  const reg = loadRegistry();
  const guidance = loadGuidanceStores();
  const corpus = assembleCorpus({ beatsDir: opts.beatsDir, registry: reg, guidance });
  const dedup = buildDedupIndex(reg.RULES, guidance);

  // baseline validateRegistry errors (subtracted from every candidate's isolation run). The baseline MUST be
  // clean - a dirty compiled registry means a candidate error byte-identical to a pre-existing one would be
  // masked (wrongly filed as passing). Fail loud rather than mask: rebuild the registry first.
  let baseline;
  try {
    baseline = reg.validateRegistry(reg.RULES, reg.VALIDATOR_REGISTRATIONS, reg.gating, reg.browser, reg.rendered);
  } catch (err) {
    // A THROW here (not a returned {ok:false}) is still a broken compiled registry - surface it as the
    // registry-unavailable class (3), not the generic usage class (2), so the exit contract stays honest.
    const e = new Error(`the compiled registry threw during baseline validation (run \`npm run build\` in sidecoach/): ${err && err.message ? err.message : String(err)}`);
    e.exitCode = EXIT_REGISTRY;
    throw e;
  }
  if (!baseline.ok) {
    const e = new Error(`the compiled registry itself is invalid (validateRegistry baseline failed - run \`npm run build\` in sidecoach/): ${(baseline.errors || []).slice(0, 3).join('; ')}`);
    e.exitCode = EXIT_REGISTRY;
    throw e;
  }
  const baselineErrorSet = new Set(baseline.errors || []);

  // gather raw candidate findings: --findings file (lens/synthesis output) + deterministic measured signal
  const rawFindings = [];
  if (opts.findings) rawFindings.push(...loadFindings(opts.findings));
  rawFindings.push(...deriveMeasuredCandidates(corpus, reg));

  const processed = [];
  const seenIds = new Set();
  for (const raw of rawFindings) {
    const cand = normalizeCandidate(raw, { supportedKindsFor: reg.supportedKindsFor, knownEvidenceKinds: reg.knownEvidenceKinds });
    if (raw && raw.forceStrengthen) cand.forceStrengthen = true;
    const cls = classify(cand, dedup);
    const pre = cls.disposition === 'duplicate' ? { ok: true, errors: [] } : preflight(cand, cls, reg, baselineErrorSet);
    // guard against two candidates colliding on the same emitted ruleId within one run
    let idKey = cand.def.ruleId;
    if (cls.disposition !== 'duplicate' && seenIds.has(idKey)) {
      cand.def.ruleId = `${idKey}__${processed.length}`;
      idKey = cand.def.ruleId;
    }
    if (cls.disposition !== 'duplicate') seenIds.add(idKey);
    const provenanceSource = raw && raw.provenanceSource ? raw.provenanceSource : undefined;
    processed.push({ cand, cls, pre, rank: rankScore(cand), provenanceSource });
  }

  const summary = {
    schema: 'sidecoach-taste-mine-run/v1',
    commit: corpus.commit,
    corpusStats: corpus.stats,
    candidateInputs: rawFindings.length,
    dryRun: !!opts.dryRun,
  };

  if (opts.dryRun) {
    summary.counts = {
      netNew: processed.filter((p) => p.cls.disposition === 'net-new').length,
      strengthenExisting: processed.filter((p) => p.cls.disposition === 'strengthen-existing').length,
      duplicateDropped: processed.filter((p) => p.cls.disposition === 'duplicate').length,
      preflightFailed: processed.filter((p) => p.cls.disposition !== 'duplicate' && !p.pre.ok).length,
    };
    summary.wrote = false;
    return summary;
  }

  let out;
  try {
    out = writeInertOutput(processed, corpus, reg, {
      proposedDir: opts.proposedDir,
      candidatesFile: opts.candidatesFile,
      beatsDir: opts.beatsDir,
      beatOutDir: opts.beatOutDir,
      date: opts.date,
    });
  } catch (err) {
    const e = new Error('failed to write inert output: ' + (err && err.message ? err.message : String(err)));
    e.exitCode = EXIT_WRITE;
    throw e;
  }
  summary.counts = out.counts;
  summary.wrote = true;
  summary.queueFile = path.relative(REPO_ROOT, out.queueFile);
  summary.beatFile = path.relative(REPO_ROOT, out.beatFile);
  summary.proposedFiles = out.written.map((w) => w.file);
  return summary;
}

// ---------------------------------------------------------------------------
// arg parsing + main
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json') opts.json = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--findings') opts.findings = argv[++i];
    else if (a === '--out') opts.out = argv[++i];
    else if (a === '--out-dir') opts.proposedDir = argv[++i];
    else if (a === '--candidates-file') opts.candidatesFile = argv[++i];
    else if (a === '--beats-dir') opts.beatsDir = argv[++i];
    else if (a === '--beat-out-dir') opts.beatOutDir = argv[++i];
    else if (a === '--cursor') opts.cursor = argv[++i];
    else if (a === '--date') opts.date = argv[++i];
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--')) { const e = new Error(`unknown flag: ${a}`); e.exitCode = EXIT_USAGE; throw e; }
    else opts._.push(a);
  }
  return opts;
}

const HELP = `sidecoach-mine - the taste miner engine (inert proposals only; never enforces)

USAGE
  node bin/sidecoach-mine.js corpus [--json] [--out <file>]
  node bin/sidecoach-mine.js run [--findings <file>] [--dry-run] [--json]
                                 [--out-dir <dir>] [--candidates-file <file>]
                                 [--beats-dir <dir>] [--beat-out-dir <dir>] [--date YYYY-MM-DD]
  node bin/sidecoach-mine.js precheck --cursor <file>
  node bin/sidecoach-mine.js advance  --cursor <file>
  node bin/sidecoach-mine.js --help

SUBCOMMANDS
  corpus   Assemble + print the multi-source corpus (beat / measured-audit-history /
           expert-external / rule-store-for-dedup), every entry tagged by sourceKind.
  run      Dedup + validate-in-isolation + emit INERT proposals. Candidate findings come from
           --findings (the lens/synthesis artifact) PLUS the deterministic measured-audit-history
           signal. --dry-run computes and prints the summary but writes nothing.
  precheck The scheduled-miner run/skip gate (for sidecoach-mine-daily on the shared research
           spine): prints "run" when the assembled corpus content differs from the cursor, else
           "skip". Exits 0 with the decision; any internal error exits non-zero (fail loud).
  advance  Record the current corpus signature into the cursor after a successful mine, so the
           next precheck skips until the inputs change again.

EXIT CODES
  0 success   2 usage   3 registry unavailable (run npm build)   4 write failure   5 bad --findings`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) { process.stderr.write(HELP + '\n'); process.exit(EXIT_USAGE); }

  const sub = argv[0];
  let opts;
  try { opts = parseArgs(argv.slice(1)); } catch (err) { fail(err); }

  if (sub === '--help' || sub === '-h' || opts.help) { process.stdout.write(HELP + '\n'); process.exit(EXIT_OK); }

  try {
    if (sub === 'corpus') {
      const reg = loadRegistry();
      const guidance = loadGuidanceStores();
      const corpus = assembleCorpus({ beatsDir: opts.beatsDir, registry: reg, guidance });
      const json = JSON.stringify(corpus, null, 2);
      if (opts.out) { assertSafeWrite(opts.out, [SAFE_DATA_DIR], 'corpus dump'); fs.writeFileSync(opts.out, json + '\n'); process.stdout.write(`corpus written: ${opts.out}\n`); }
      else if (opts.json) process.stdout.write(json + '\n');
      else printCorpusSummary(corpus);
      process.exit(EXIT_OK);
    }
    if (sub === 'run') {
      const summary = runPipeline(opts);
      if (opts.json) process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      else printRunSummary(summary);
      process.exit(EXIT_OK);
    }
    if (sub === 'precheck') {
      // The scheduled-miner run/skip gate (SRR contract): print exactly "run" or "skip" and
      // exit 0. "run" when the assembled corpus content differs from the cursor (new beats,
      // new measured audit scans, freshly-ingested expert content, or a changed rule store);
      // "skip" when identical. ANY internal failure exits non-zero (never a silent forever-skip).
      if (!opts.cursor) { const e = new Error('precheck requires --cursor <file>'); e.exitCode = EXIT_USAGE; throw e; }
      const current = computeInputSignature();
      // ONLY a missing cursor (ENOENT) is a first run -> "run". A cursor that is truncated, a
      // directory, unreadable, non-JSON, or missing its "sig" is CORRUPTION, not a first run:
      // fail loud with NO decision rather than emitting a clean "run" that masks the corruption.
      let prev = null;
      let raw;
      try { raw = fs.readFileSync(opts.cursor, 'utf8'); }
      catch (err) {
        if (err && err.code === 'ENOENT') { raw = null; }
        else { const e = new Error(`cursor unreadable (${opts.cursor}): ${err && err.message}`); e.exitCode = EXIT_USAGE; throw e; }
      }
      if (raw !== null) {
        let parsed;
        try { parsed = JSON.parse(raw); }
        catch (err) { const e = new Error(`cursor is not valid JSON (${opts.cursor}): ${err && err.message}`); e.exitCode = EXIT_USAGE; throw e; }
        if (!parsed || typeof parsed.sig !== 'string') { const e = new Error(`cursor is missing a string "sig" (${opts.cursor})`); e.exitCode = EXIT_USAGE; throw e; }
        prev = parsed.sig;
      }
      process.stdout.write((prev === current.sig ? 'skip' : 'run') + '\n');
      process.exit(EXIT_OK);
    }
    if (sub === 'advance') {
      // Record the current corpus signature so the next precheck skips until inputs change again.
      // The cursor lives OUTSIDE the repo (the SRR runner mandates it) - written after a run succeeds.
      if (!opts.cursor) { const e = new Error('advance requires --cursor <file>'); e.exitCode = EXIT_USAGE; throw e; }
      // The cursor MUST live outside the repo checkout (the SRR runner's rule): refuse to write it
      // anywhere inside REPO_ROOT so a stray/hostile --cursor override cannot turn `advance` into a
      // write over a live repo file (the registry, a skill, ...). Use realResolve (NOT lexical
      // path.resolve) so a cursor that is a SYMLINK - or sits under a symlinked dir - pointing back
      // into the repo is caught (Codex review 2026-08-24); path.resolve alone missed that.
      const resolvedCursor = realResolve(opts.cursor);
      if (resolvedCursor === REPO_ROOT || resolvedCursor.startsWith(REPO_ROOT + path.sep)) {
        const e = new Error(`refusing to write the cursor inside the repo (${resolvedCursor}); it must live outside the checkout, e.g. under ~/.claude`); e.exitCode = EXIT_USAGE; throw e;
      }
      const current = computeInputSignature();
      const payload = {
        schema: 'sidecoach-mine-cursor/v1',
        sig: current.sig,
        stats: current.stats,
        advanced_utc: nowIso(),
        commit: shortHead(),
      };
      fs.mkdirSync(path.dirname(resolvedCursor), { recursive: true });
      // Write to the REAL resolved path, NOT the raw opts.cursor: the resolved path has already
      // followed any ancestor symlinks, so swapping the original path's symlink after the check no
      // longer changes where we write. O_NOFOLLOW then refuses a symlink at the FINAL component
      // (a symlink whose target is outside the repo -> ELOOP -> advance fails loud). Irreducible
      // residual (accepted, out of threat model): an ACTIVE same-uid attacker replacing the resolved
      // parent dir itself with a symlink inside the check->open window - such a process can already
      // write anywhere directly, and Node has no openat2(RESOLVE_NO_SYMLINKS) to close it fully.
      const flags = fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_TRUNC | fs.constants.O_NOFOLLOW;
      const fd = fs.openSync(resolvedCursor, flags, 0o600);
      try { fs.writeSync(fd, JSON.stringify(payload, null, 2) + '\n'); } finally { fs.closeSync(fd); }
      process.exit(EXIT_OK);
    }
    const e = new Error(`unknown subcommand: ${sub}`); e.exitCode = EXIT_USAGE; throw e;
  } catch (err) { fail(err); }
}

function fail(err) {
  const code = err && err.exitCode ? err.exitCode : EXIT_USAGE;
  process.stderr.write(`sidecoach-mine: FAIL(${code}): ${err && err.message ? err.message : String(err)}\n`);
  process.exit(code);
}

function printCorpusSummary(corpus) {
  process.stdout.write(`sidecoach taste corpus (commit ${corpus.commit})\n`);
  process.stdout.write(`  beat:                    ${corpus.stats.beat}\n`);
  process.stdout.write(`  measured-audit-history:  ${corpus.stats['measured-audit-history']} rule(s) from ${corpus.stats.totalScans} scan(s)\n`);
  process.stdout.write(`  expert-external:         ${corpus.stats['expert-external']} file(s)\n`);
  process.stdout.write(`  rule-store-for-dedup:    ${corpus.stats['rule-store-for-dedup']} entr(y/ies)\n`);
  process.stdout.write(`  total tagged entries:    ${corpus.entries.length}\n`);
}

function printRunSummary(s) {
  process.stdout.write(`sidecoach taste mine (commit ${s.commit})${s.dryRun ? ' [DRY RUN - nothing written]' : ''}\n`);
  process.stdout.write(`  candidate inputs:   ${s.candidateInputs}\n`);
  process.stdout.write(`  net-new:            ${s.counts.netNew}\n`);
  process.stdout.write(`  strengthen-existing:${s.counts.strengthenExisting}\n`);
  process.stdout.write(`  duplicate (dropped):${s.counts.duplicateDropped}\n`);
  process.stdout.write(`  preflight failed:   ${s.counts.preflightFailed} (filed with errors, not dropped)\n`);
  if (s.wrote) {
    process.stdout.write(`  queue:  ${s.queueFile}\n`);
    process.stdout.write(`  beat:   ${s.beatFile}\n`);
    process.stdout.write(`  proposed files: ${s.proposedFiles.length}\n`);
  }
}

// Export the pure pieces for the unit test; run main() only as a CLI.
module.exports = {
  normalizeKey, slugify, parseFrontmatter,
  assembleBeats, assembleAuditHistory, assembleExternal, assembleRuleStores, assembleCorpus,
  buildDedupIndex, normalizeCandidate, classify, preflight, deriveMeasuredCandidates,
  rankScore, loadRegistry, loadGuidanceStores, runPipeline, assertSafeWrite, computeInputSignature,
  freezeExampleCorpus, canonicalExampleRecord, recordHashOf,
  SAFE_DATA_DIR, SAFE_MEMORY_DIR, REPO_ROOT, SIDECOACH_ROOT,
  EXIT_OK, EXIT_USAGE, EXIT_REGISTRY, EXIT_WRITE, EXIT_FINDINGS,
};

if (require.main === module) main();
