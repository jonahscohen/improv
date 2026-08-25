#!/usr/bin/env node
'use strict';

/**
 * sidecoach-consolidate.js - the TASTE CONSOLIDATION + CONTRADICTION MAP engine.
 *
 * WHAT IT IS. An INERT, human-reviewed MAP. It surveys the whole ingested taste corpus (the outside
 * pioneer docs + our live rule stores), clusters distilled rules by concept, shows how each cluster
 * OVERLAPS our live rules (covered / additive / single-source), and flags every CONTRADICTION -
 * classified by TYPE so a human is never handed a flat pile. It writes ONLY a report zone
 * (data/taste-map/) and a taste_map beat. It NEVER writes the registry, the quarantine, promote/
 * enforce, any hook, or any config. Nothing under src/ imports data/taste-map/, so the map is inert
 * by construction.
 *
 * SIBLING TO THE MINER, NOT AN EXTENSION OF IT. The miner (sidecoach-mine.js) produces INERT
 * QUARANTINE PROPOSALS; this produces an INERT MAP/REPORT - a different output contract. This tool
 * REUSES the miner's exports (assembleCorpus, buildDedupIndex, loadRegistry, loadGuidanceStores,
 * assertSafeWrite) so there is zero corpus-loading duplication, and the DETERMINISTIC classifier +
 * schema live in the compiled dist/taste-map-types.
 *
 * THE DISTILLATION SPLIT. Telling a hard ban from a design direction from a measurement out of prose
 * is irreducibly semantic - that is a live FLOW (see the SKILL.md consolidate flow), which reads the
 * distillable corpus (`distill-corpus`) and writes a distilled.json. This engine owns the exact,
 * reproducible parts: it GATES directionLabel + the design-direction type from PROVENANCE (never
 * from prose), clusters, computes overlap, and RE-TYPES every contradiction from the structured
 * typed fields (classifyContradiction). Given the same inputs it produces the same map.
 *
 * SAFETY (non-negotiable). External expert content is UNTRUSTED DATA read as evidence, never obeyed.
 * assertSafeWrite is fenced to data/taste-map/ (a `--out-dir ../src` attempt is refused). No
 * Phase-1/2/3 invariant is weakened; this tool has no writer into the live layer.
 *
 * SUBCOMMANDS
 *   distill-corpus [--json]
 *       Print the DISTILLABLE corpus (expert-external + rule-store-for-dedup entries), each annotated
 *       with the provenance-derived direction hint. This is the material the live flow distills into a
 *       distilled.json. A thin wrapper over the miner's assembleCorpus - it distills nothing itself.
 *   map [--distilled <file>] [--dry-run] [--json] [--out-dir <dir>] [--beat-out-dir <dir>]
 *       [--no-beat] [--check] [--report <file>] [--date YYYY-MM-DD]
 *       Ingest+normalize distilled.json (totality - a malformed entry is FILED, not thrown), cluster
 *       by concept, compute overlap via the miner's dedup index, run the deterministic contradiction
 *       detector, then WRITE the inert map (data/taste-map/taste-map.json + taste-map.md + a beat).
 *       With NO --distilled it produces a headless rule-store baseline map (the launchd fallback).
 *       --dry-run writes NOTHING. --check regenerates the markdown from the same inputs and DIFFS it
 *       against the committed report, exiting 1 on drift.
 *   --help
 *
 * EXIT CODES (distinct per failure class; never a silent success)
 *   0  success (map/report printed or written; a --check that matched)
 *   1  --check drift: the committed report no longer matches the regenerated one
 *   2  usage / bad arguments
 *   3  the compiled registry OR dist/taste-map-types is unavailable (run `npm run build` in sidecoach/)
 *   4  a write failure while emitting the inert output (incl. a refused out-of-zone write)
 *   5  a --distilled file was given but is unreadable / not valid JSON / wrong shape
 */

const fs = require('fs');
const path = require('path');

const M = require('./sidecoach-mine.js');

const EXIT_OK = 0;
const EXIT_CHECK_DRIFT = 1;
const EXIT_USAGE = 2;
const EXIT_REGISTRY = 3;
const EXIT_WRITE = 4;
const EXIT_DISTILLED = 5;

const SIDECOACH_ROOT = M.SIDECOACH_ROOT;
const REPO_ROOT = M.REPO_ROOT;
const DIST = path.join(SIDECOACH_ROOT, 'dist');

// The ONLY write zones. taste-map artifacts go under data/taste-map/ (a strict subset of the miner's
// data/ zone, so consolidate can never touch the miner's proposed-rules/ or taste-candidates.json);
// the taste_map beat goes to the project-root .claude/memory (M.SAFE_MEMORY_DIR).
const SAFE_TASTE_MAP_DIR = path.join(SIDECOACH_ROOT, 'data', 'taste-map');
const SAFE_MEMORY_DIR = M.SAFE_MEMORY_DIR;
const DEFAULT_REPORT = path.join(SAFE_TASTE_MAP_DIR, 'taste-map.md');
const DEFAULT_MAP_JSON = path.join(SAFE_TASTE_MAP_DIR, 'taste-map.json');

// distillable corpus = the outside expert docs + our own rule stores. (Beats and the volatile
// measured-audit-history are context, not material to distill one typed rule from.)
const DISTILLABLE = new Set(['expert-external', 'rule-store-for-dedup']);

// ---------------------------------------------------------------------------
// PROVENANCE-GATED direction allowlist (the load-bearing gate)
// ---------------------------------------------------------------------------
// A distilled rule may be typed 'design-direction' (and carry a directionLabel) ONLY when its SOURCE
// is a named-direction source. The label is READ from provenance (source slug + filename), never
// judged from prose. Matching is EXACT, not substring/token: the source must EQUAL an allowlisted
// slug and the file must have an allowlisted PATH SEGMENT (a directory name, or the basename with its
// extension stripped). Exact matching is load-bearing (Codex F2): a token-substring regex let a
// fabricated `not-oracle` / `oracle-fake` pass the oracle gate, which would then mask a real hard rule
// as a harmless direction-pair. A fabricated source now fails the gate and its design-direction claim
// is demoted, so the underlying conflict is never hidden.
//   leon-lin-taste-skill: minimalist-skill | brutalist-skill | soft-skill dirs
//   oracle: bolder | quieter (context-conditional intensity docs)
//   taste-skill: the named-vibe archetypes doc
const DIRECTION_ALLOWLIST = [
  { sources: ['leon-lin-taste-skill', 'taste-skill'], segments: ['minimalist-skill'], label: 'minimalist' },
  { sources: ['leon-lin-taste-skill', 'taste-skill'], segments: ['brutalist-skill'], label: 'brutalist' },
  { sources: ['leon-lin-taste-skill', 'taste-skill'], segments: ['soft-skill'], label: 'soft' },
  { sources: ['oracle'], segments: ['bolder'], label: 'bolder' },
  { sources: ['oracle'], segments: ['quieter'], label: 'quieter' },
  { sources: ['taste-skill'], segments: ['named-vibe-variants'], label: 'named-vibe' },
];

/** The path SEGMENTS of a file, lowercased, including the last segment BOTH with and without its
 *  extension. Used for EXACT segment matching (never substring). */
function pathSegments(sourceFile) {
  const parts = safeStr(sourceFile, '').toLowerCase().split(/[/\\]+/).filter(Boolean);
  const segs = new Set(parts);
  if (parts.length) {
    const last = parts[parts.length - 1];
    const dot = last.lastIndexOf('.');
    if (dot > 0) segs.add(last.slice(0, dot));   // basename without extension (e.g. bolder.md -> bolder)
  }
  return segs;
}

/** The provenance-derived direction label for a (source, file), or null when the source is not a
 *  named-direction source. EXACT source-slug + EXACT path-segment match only. This is the ONLY way a
 *  rule becomes a 'design-direction'. */
function directionLabelFor(source, sourceFile) {
  const s = safeStr(source, '').trim().toLowerCase();
  if (!s) return null;
  const segs = pathSegments(sourceFile);
  for (const d of DIRECTION_ALLOWLIST) {
    if (!d.sources.includes(s)) continue;                    // EXACT source-slug match
    if (d.segments.some((seg) => segs.has(seg))) return d.label;   // EXACT path-segment match
  }
  return null;
}

// ---------------------------------------------------------------------------
// small utilities
// ---------------------------------------------------------------------------
function nowIso() { return new Date().toISOString(); }
function todayStamp() { return new Date().toISOString().slice(0, 10); }

// Coerce to a string WITHOUT ever throwing (a value from an untrusted distilled file may have a
// throwing toString). Totality helper, mirrors the miner.
function safeStr(v, fallback) {
  try { return v == null ? (fallback || '') : String(v); } catch (_e) { return fallback || ''; }
}

function sanitizeDate(d) {
  const s = safeStr(d, '').replace(/[^0-9-]+/g, '').slice(0, 12);
  return /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(s) ? s : todayStamp();
}

// ---------------------------------------------------------------------------
// dist loading (fails LOUD, exit 3)
// ---------------------------------------------------------------------------
function loadTypes() {
  let T;
  try { T = require(path.join(DIST, 'taste-map-types')); }
  catch (err) {
    const e = new Error('compiled taste-map-types unavailable (run `npm run build` in sidecoach/): ' + (err && err.message ? err.message : String(err)));
    e.exitCode = EXIT_REGISTRY;
    throw e;
  }
  if (typeof T.classifyContradiction !== 'function' || typeof T.seedConceptFromKey !== 'function' || typeof T.normalizeConcept !== 'function') {
    const e = new Error('compiled taste-map-types loaded but is missing classifyContradiction / seedConceptFromKey / normalizeConcept');
    e.exitCode = EXIT_REGISTRY;
    throw e;
  }
  return T;
}

// ---------------------------------------------------------------------------
// distilled.json ingest + normalization (TOTALITY: a malformed entry is FILED, never thrown)
// ---------------------------------------------------------------------------
function loadDistilledFile(file) {
  const raw = readTextSafe(file);
  if (raw == null) { const e = new Error(`--distilled file not readable: ${file}`); e.exitCode = EXIT_DISTILLED; throw e; }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (err) {
    const e = new Error(`--distilled file is not valid JSON: ${err && err.message ? err.message : String(err)}`);
    e.exitCode = EXIT_DISTILLED; throw e;
  }
  const list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.distilled) ? parsed.distilled : null);
  if (!Array.isArray(list)) {
    const e = new Error('--distilled file must be an array of distilled rules OR { "distilled": [...] }');
    e.exitCode = EXIT_DISTILLED; throw e;
  }
  return list;
}

function readTextSafe(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; }
}

/**
 * Normalize one raw distilled entry into a DistilledRule. TOTALITY: a malformed entry never throws -
 * it is filed with a normalizationWarning and a safe default type. This is where the PROVENANCE GATE
 * is enforced: directionLabel + type='design-direction' are set ONLY when directionLabelFor(source,
 * file) returns a label; a design-direction claim from a non-direction source is DEMOTED to
 * principle-guidance and its directionLabel stripped.
 */
function normalizeDistilled(raw, idx, T) {
  const warnings = [];
  const r = (raw && typeof raw === 'object') ? raw : {};
  const source = safeStr(r.source, 'unknown-source') || 'unknown-source';
  const sourceFile = r.sourceFile !== undefined ? safeStr(r.sourceFile, '') : '';
  const concept = safeStr(r.concept, '') || safeStr(r.axisSubject, '') || `distilled-${idx}`;
  const axisSubject = safeStr(r.axisSubject, '') || concept;
  const claim = safeStr(r.claim, '');

  // TYPE IS DRIVEN BY THE RAW STRUCTURED FIELDS FIRST, independent of the asserted `type` (Codex final
  // pass): the earlier gate ran INSIDE `if (type === 'design-direction')`, so a record with a missing /
  // unknown / wrong type that carried hard fields was left as principle-guidance and its conflict was
  // DROPPED. A structured hard field is more specific than an asserted type and must decide the kind.
  //
  // A hard field is decided by PRESENCE on the raw record, not by validity:
  //   polarityPresent = r.polarity is present and non-empty after trim (so `ban `/an invalid value still
  //                     types the record hard-prohibitive - a record that mentions a polarity is never a menu).
  //   measuredPresent = r.measured is present (any non-null value; a malformed one still blocks a direction).
  const polarityRaw = (r.polarity === undefined || r.polarity === null) ? '' : safeStr(r.polarity, '').trim();
  const polarityPresent = polarityRaw !== '';
  // sanitized polarity VALUE (trim, then lowercase): ban|mandate, else undefined (kept as a hard rule
  // without an assertable polarity so opposingPolarity cannot fabricate a conflict).
  let polarity;
  if (polarityPresent) {
    const p = polarityRaw.toLowerCase();
    if (p === 'ban' || p === 'mandate') polarity = p;
    else warnings.push(`polarity "${safeStr(r.polarity, '?')}" is present but not ban|mandate; typed hard-prohibitive without an assertable polarity`);
  }

  const measuredPresent = r.measured !== undefined && r.measured !== null;
  let measured;
  if (r.measured && typeof r.measured === 'object' && r.measured.property !== undefined) {
    measured = {
      property: safeStr(r.measured.property, ''),
      value: r.measured.value,
      unit: r.measured.unit !== undefined ? safeStr(r.measured.unit, '') : undefined,
      range: r.measured.range,
    };
  } else if (measuredPresent) {
    warnings.push('dropped malformed measured (not an object with a property)');
  }

  const assertedType = T.DISTILLED_RULE_TYPES.includes(r.type) ? r.type : null;

  // RESOLUTION ORDER (raw structured fields win over the asserted type; a genuine direction requires NO
  // polarity field AND NO measured field present, not merely no VALID ones):
  //   1. polarity present  -> hard-prohibitive (surface any ban/mandate conflict)
  //   2. else valid measured -> standard-measurement (a measured knob calibrates)
  //   3. else allowlisted (source,file) AND no polarity/measured field present -> design-direction + label
  //   4. else -> the asserted NON-direction type if valid, else principle-guidance
  const provDir = directionLabelFor(source, sourceFile);
  let type;
  let directionLabel;
  if (polarityPresent) {
    type = 'hard-prohibitive';
    if (assertedType && assertedType !== 'hard-prohibitive') warnings.push(`re-typed to hard-prohibitive from a present polarity field (asserted ${assertedType})`);
  } else if (measured) {
    type = 'standard-measurement';
    if (assertedType && assertedType !== 'standard-measurement') warnings.push(`re-typed to standard-measurement from a measured field (asserted ${assertedType})`);
  } else if (provDir && !measuredPresent) {
    type = 'design-direction';
    directionLabel = provDir;   // genuine direction: allowlisted, no polarity field, no measured field
  } else if (assertedType && assertedType !== 'design-direction') {
    type = assertedType;        // a valid non-direction asserted type stands
  } else {
    type = 'principle-guidance';
    if (r.type === 'design-direction') warnings.push('type=design-direction from a non-direction source is not provenance-gated; demoted to principle-guidance');
    else if (!assertedType) warnings.push(`unknown or missing type "${safeStr(r.type, '?')}" -> principle-guidance`);
  }

  const evidence = Array.isArray(r.evidence) ? r.evidence.map((e) => safeStr(e, '')) : [];
  const confidence = ['high', 'medium', 'low'].includes(r.confidence) ? r.confidence : undefined;

  const id = safeStr(r.id, '') || `${source}:${T.normalizeConcept(concept).replace(/\s+/g, '-') || idx}:${idx}`;

  return {
    id,
    sourceKind: safeStr(r.sourceKind, 'expert-external') || 'expert-external',
    source,
    sourceFile: sourceFile || undefined,
    type,
    concept,
    claim,
    polarity,
    axisSubject,
    directionLabel,
    measured,
    evidence,
    provenance: (r.provenance && typeof r.provenance === 'object') ? r.provenance : undefined,
    confidence,
    normalizationWarnings: warnings.length ? warnings : undefined,
  };
}

// ---------------------------------------------------------------------------
// rule-store baseline (seeded concepts from the live registry + guidance stores)
// ---------------------------------------------------------------------------
function seedRuleStoreConcepts(corpus, T) {
  const entries = (corpus.sources && corpus.sources['rule-store-for-dedup']) || [];
  const out = [];
  for (const e of entries) {
    const { concept, axisSubject } = T.seedConceptFromKey(e);
    if (!axisSubject) continue;
    out.push({ concept, axisSubject, store: e.store || null, ref: e.ruleId || e.id || e.canonicalRuleKey || e.name || concept });
  }
  return out;
}

// ---------------------------------------------------------------------------
// overlap: does a distilled cluster match a live rule?  (via the miner's dedup index)
// ---------------------------------------------------------------------------
function findLiveMatch(cluster, dedup, T) {
  const keys = new Set();
  keys.add(T.normalizeConcept(cluster.concept));
  keys.add(T.normalizeConcept(cluster.axisSubject));
  for (const k of keys) {
    if (!k) continue;
    if (dedup.strong.has(k)) return refStr(dedup.strong.get(k));
    if (dedup.weak.has(k)) return refStr(dedup.weak.get(k));
  }
  return null;
}
function refStr(m) { return `${m.store}:${m.ref}`; }

// ---------------------------------------------------------------------------
// contradiction detection over a cluster's distilled members (pairwise, deterministic)
// ---------------------------------------------------------------------------
function detectContradictions(members, T) {
  const out = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const rec = T.classifyContradiction(members[i], members[j]);
      if (rec) out.push(rec);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildMap: cluster by concept, compute overlap, detect contradictions
// ---------------------------------------------------------------------------
function buildMap(distilled, ruleStoreConcepts, dedup, T) {
  // Concept clusters drive the OVERLAP + per-cluster display view.
  const byConcept = new Map();
  for (const r of distilled) {
    const key = T.normalizeConcept(r.concept) || T.normalizeConcept(r.axisSubject) || r.id;
    if (!byConcept.has(key)) byConcept.set(key, { concept: r.concept || r.axisSubject || key, axisSubject: r.axisSubject || r.concept || key, members: [] });
    byConcept.get(key).members.push(r);
  }

  // CONTRADICTION detection joins on axisSubject - THE join key per the blueprint (Codex F1). Two rules
  // that share an axisSubject but land in DIFFERENT concept clusters ("typeface inter" vs "inter font",
  // both axisSubject "inter-font") MUST still be compared, or a real hard-vs-hard is silently missed.
  // So the contradiction pass groups every distilled rule by NORMALIZED axisSubject and compares every
  // pair within each axisSubject group - independent of the concept clustering above.
  const byAxis = new Map();
  for (const r of distilled) {
    const ax = T.normalizeConcept(r.axisSubject);
    if (!ax) continue;   // no join key -> cannot participate in a contradiction
    if (!byAxis.has(ax)) byAxis.set(ax, []);
    byAxis.get(ax).push(r);
  }
  const contradictionsByType = T.emptyContradictionsByType();
  const allContradictions = [];
  for (const members of byAxis.values()) {
    for (const rec of detectContradictions(members, T)) {
      contradictionsByType[rec.type].push(rec);
      allContradictions.push(rec);
    }
  }
  // stable ordering of each type bucket so the rendered report is deterministic regardless of input order
  const contradictionSort = (a, b) =>
    String(a.axisSubject).localeCompare(String(b.axisSubject))
    || String(a.members[0].id).localeCompare(String(b.members[0].id))
    || String(a.members[1].id).localeCompare(String(b.members[1].id));
  for (const k of Object.keys(contradictionsByType)) contradictionsByType[k].sort(contradictionSort);

  const clusters = [];
  const overlap = { covered: [], additive: [], singleSource: [] };
  for (const c of byConcept.values()) {
    const sources = [...new Set(c.members.map((m) => m.source))];
    const liveMatch = findLiveMatch(c, dedup, T);
    const status = liveMatch ? 'covered' : (sources.length >= 2 ? 'additive' : 'single-source');
    const clusterOverlap = { concept: c.concept, status, liveMatch, sources, memberCount: c.members.length };

    // Per-cluster display shows the contradictions whose BOTH members live in THIS concept cluster; the
    // complete, axisSubject-joined picture (including cross-cluster pairs) is the map-level contradictionsByType.
    const memberSet = new Set(c.members);
    const contradictions = allContradictions.filter((rec) => memberSet.has(rec.members[0]) && memberSet.has(rec.members[1]));

    if (status === 'covered') overlap.covered.push(clusterOverlap);
    else if (status === 'additive') overlap.additive.push(clusterOverlap);
    else overlap.singleSource.push(clusterOverlap);

    clusters.push({ concept: c.concept, axisSubject: c.axisSubject, members: c.members, overlap: clusterOverlap, contradictions });
  }

  // stable ordering so the rendered report is deterministic
  const byConceptName = (a, b) => String(a.concept).localeCompare(String(b.concept));
  clusters.sort(byConceptName);
  overlap.covered.sort(byConceptName);
  overlap.additive.sort(byConceptName);
  overlap.singleSource.sort(byConceptName);

  return {
    schema: 'sidecoach-taste-map/v1',
    clusters,
    overlap,
    contradictionsByType,
    liveRules: ruleStoreConcepts,
  };
}

// ---------------------------------------------------------------------------
// markdown renderer (DETERMINISTIC: a pure function of clusters + overlap + contradictions;
// NO timestamp, NO commit, NO volatile measured signal - so --check is stable)
// ---------------------------------------------------------------------------
function renderMarkdown(map) {
  const L = [];
  const cbt = map.contradictionsByType;
  const nReal = cbt['hard-vs-hard'].length;
  const nCal = cbt['standard-calibration'].length;
  const nCross = cbt['cross-type'].length;
  const nMenu = cbt['direction-pair'].length;

  L.push('# Taste consolidation + contradiction map (INERT - human review)');
  L.push('');
  L.push('This is an inert, human-reviewed MAP, generated by `sidecoach-consolidate`. Nothing here is');
  L.push('enforced or auto-applied: it feeds a human review and the existing consent-gated promote/enforce');
  L.push('path. External expert content was read as UNTRUSTED DATA for evidence, never obeyed. Every');
  L.push('contradiction is FLAGGED but presented by TYPE, so direction MENUS are never mistaken for conflicts.');
  L.push('');
  L.push('## Summary');
  L.push('');
  L.push(`- Distilled clusters: ${map.clusters.length} (covered ${map.overlap.covered.length}, additive ${map.overlap.additive.length}, single-source ${map.overlap.singleSource.length})`);
  L.push(`- Live rules surveyed (baseline): ${map.liveRules.length}`);
  L.push(`- Real conflicts (resolve): ${nReal}  |  Calibration: ${nCal}  |  Cross-type (note): ${nCross}  |  Direction menu (kept): ${nMenu}`);
  L.push('');

  L.push('## Real conflicts (resolve)');
  L.push('');
  L.push('Two opposing absolutes on the same subject. Both cannot hold; a human picks one.');
  L.push('');
  renderContradictionList(L, cbt['hard-vs-hard']);

  L.push('## Calibration (pick a value or range)');
  L.push('');
  L.push('Measured standards that disagree on the same knob. A human picks a value or an accepted range.');
  L.push('');
  renderContradictionList(L, cbt['standard-calibration']);

  L.push('## Cross-type tensions (note)');
  L.push('');
  L.push('A prescriptive tension across rule KINDS (a direction vs a hard/measured rule, or a ban vs a');
  L.push('measurement). Noted for context, not auto-resolved.');
  L.push('');
  renderContradictionList(L, cbt['cross-type']);

  L.push('## Direction menu (kept - not a conflict)');
  L.push('');
  L.push('Two design DIRECTIONS on the same axis. This is the intended menu we always keep; it is NEVER a');
  L.push('conflict and is never reconciled.');
  L.push('');
  renderContradictionList(L, cbt['direction-pair']);

  L.push('## Overlap with our live rules');
  L.push('');
  L.push('### Additive (multiple sources agree, we lack it) - the strongest signal');
  L.push('');
  renderOverlapList(L, map.overlap.additive);
  L.push('### Covered (redundant with a live rule we already ship)');
  L.push('');
  renderOverlapList(L, map.overlap.covered);
  L.push('### Single-source (one source, we lack it)');
  L.push('');
  renderOverlapList(L, map.overlap.singleSource);

  L.push('## Clusters (per concept)');
  L.push('');
  if (map.clusters.length === 0) {
    L.push('- (no distilled clusters - headless rule-store baseline map)');
    L.push('');
  } else {
    for (const c of map.clusters) {
      const tag = c.overlap.status === 'covered'
        ? `covered (redundant with ${c.overlap.liveMatch})`
        : c.overlap.status === 'additive'
          ? `additive (we lack it; sources: ${c.overlap.sources.join(', ')})`
          : `single-source (${c.overlap.sources.join(', ')})`;
      L.push(`### ${c.concept}`);
      L.push('');
      L.push(`_${tag}_`);
      L.push('');
      for (const m of c.members) {
        const dl = m.directionLabel ? ` [direction: ${m.directionLabel}]` : '';
        L.push(`- **${m.type}**${dl} - ${m.source}: ${m.claim || '(no claim text)'}`);
      }
      if (c.contradictions.length) {
        for (const rec of c.contradictions) L.push(`  - ${rec.type}: ${rec.recommendation}`);
      }
      L.push('');
    }
  }

  return L.join('\n') + '\n';
}

function renderContradictionList(L, list) {
  if (!list.length) { L.push('- (none)'); L.push(''); return; }
  for (const rec of list) {
    L.push(`- **${rec.axisSubject}** (${rec.disposition}): ${rec.recommendation}`);
    if (rec.values && rec.values.length) {
      L.push(`  - values: ${rec.values.map((v) => renderMeasured(v)).join('  vs  ')}`);
    }
  }
  L.push('');
}

function renderMeasured(v) {
  const parts = [];
  if (v.value !== undefined) parts.push(String(v.value));
  if (v.unit) parts.push(String(v.unit));
  if (v.range !== undefined) parts.push(`range ${JSON.stringify(v.range)}`);
  return `${v.property}=${parts.join(' ') || '?'}`;
}

function renderOverlapList(L, list) {
  if (!list.length) { L.push('- (none)'); L.push(''); return; }
  for (const o of list) L.push(`- **${o.concept}** - ${o.memberCount} rule(s) from ${o.sources.join(', ')}${o.liveMatch ? ` (live: ${o.liveMatch})` : ''}`);
  L.push('');
}

// ---------------------------------------------------------------------------
// map pipeline
// ---------------------------------------------------------------------------
function runMap(opts) {
  const T = loadTypes();
  const reg = M.loadRegistry();
  const guidance = M.loadGuidanceStores();
  const corpus = M.assembleCorpus({ beatsDir: opts.beatsDir, registry: reg, guidance });
  const dedup = M.buildDedupIndex(reg.RULES, guidance);

  const rawDistilled = opts.distilled ? loadDistilledFile(opts.distilled) : [];
  const distilled = rawDistilled.map((raw, i) => normalizeDistilled(raw, i, T));
  const ruleStoreConcepts = seedRuleStoreConcepts(corpus, T);

  const map = buildMap(distilled, ruleStoreConcepts, dedup, T);
  const markdown = renderMarkdown(map);

  const counts = {
    distilledClusters: map.clusters.length,
    covered: map.overlap.covered.length,
    additive: map.overlap.additive.length,
    singleSource: map.overlap.singleSource.length,
    realConflicts: map.contradictionsByType['hard-vs-hard'].length,
    calibration: map.contradictionsByType['standard-calibration'].length,
    crossType: map.contradictionsByType['cross-type'].length,
    directionMenu: map.contradictionsByType['direction-pair'].length,
    liveRules: map.liveRules.length,
    normalizationWarnings: distilled.reduce((n, d) => n + (d.normalizationWarnings ? d.normalizationWarnings.length : 0), 0),
  };

  // --check: regenerate the markdown and diff against the committed report. Exit 1 on drift.
  if (opts.check) {
    const reportPath = opts.report || DEFAULT_REPORT;
    if (!fs.existsSync(reportPath)) {
      const e = new Error(`--check: committed report is missing (${path.relative(REPO_ROOT, reportPath)}). Run \`map\` to generate it first.`);
      e.exitCode = EXIT_CHECK_DRIFT;
      throw e;
    }
    const have = readTextSafe(reportPath);
    if (have !== markdown) {
      const e = new Error(`--check: ${path.relative(REPO_ROOT, reportPath)} has DRIFTED from the regenerated map. Re-run \`map\` and review the diff.`);
      e.exitCode = EXIT_CHECK_DRIFT;
      throw e;
    }
    return { schema: map.schema, checked: true, ok: true, counts, reportPath };
  }

  // --dry-run: compute everything, write nothing.
  if (opts.dryRun) {
    return { schema: map.schema, dryRun: true, wrote: false, counts, map };
  }

  // WRITE the inert map (fenced to data/taste-map/) + the taste_map beat (fenced to .claude/memory).
  const outDir = opts.outDir || SAFE_TASTE_MAP_DIR;
  const mapJsonPath = path.join(outDir, 'taste-map.json');
  const reportPath = opts.report || path.join(outDir, 'taste-map.md');
  M.assertSafeWrite(outDir, [SAFE_TASTE_MAP_DIR], 'taste-map out dir');
  M.assertSafeWrite(mapJsonPath, [SAFE_TASTE_MAP_DIR], 'taste-map json');
  M.assertSafeWrite(reportPath, [SAFE_TASTE_MAP_DIR], 'taste-map report');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (_e) { /* checked on write */ }

  const generated = nowIso();
  const commit = corpus.commit;
  const jsonRecord = {
    schema: map.schema,
    generated_utc: generated,
    commit,
    note: 'INERT taste consolidation + contradiction map. Nothing here is enforced or auto-applied. It feeds a human review and the existing consent-gated promote/enforce path. No source file imports data/taste-map/.',
    inputs: { distilled: distilled.length, ruleStore: map.liveRules.length, distilledFile: opts.distilled ? path.relative(REPO_ROOT, path.resolve(opts.distilled)) : null },
    counts,
    corpusStats: corpus.stats,
    overlap: map.overlap,
    contradictionsByType: map.contradictionsByType,
    clusters: map.clusters,
    // measured-audit-history is minor CONTEXT: it lives in the JSON only (never the diffed markdown),
    // because it is volatile and would otherwise make --check drift on an unrelated scan.
    measuredContext: (corpus.sources && corpus.sources['measured-audit-history']) || null,
    normalizationWarnings: distilled.filter((d) => d.normalizationWarnings).map((d) => ({ id: d.id, warnings: d.normalizationWarnings })),
  };
  fs.writeFileSync(mapJsonPath, JSON.stringify(jsonRecord, null, 2) + '\n');
  fs.writeFileSync(reportPath, markdown);

  let beatFile = null;
  if (!opts.noBeat) {
    const beatsDir = opts.beatOutDir || SAFE_MEMORY_DIR;
    const dateStamp = sanitizeDate(opts.date);
    beatFile = path.join(beatsDir, `taste_map_${dateStamp}.md`);
    M.assertSafeWrite(beatFile, [SAFE_MEMORY_DIR], 'taste_map beat');
    try { fs.mkdirSync(beatsDir, { recursive: true }); } catch (_e) { /* checked on write */ }
    fs.writeFileSync(beatFile, renderBeat(map, counts, commit, sanitizeDate(opts.date), opts.distilled));
  }

  return {
    schema: map.schema,
    wrote: true,
    counts,
    mapJson: path.relative(REPO_ROOT, mapJsonPath),
    report: path.relative(REPO_ROOT, reportPath),
    beat: beatFile ? path.relative(REPO_ROOT, beatFile) : null,
  };
}

function renderBeat(map, counts, commit, dateStamp, distilledFile) {
  const L = [];
  L.push('---');
  L.push(`name: Taste consolidation + contradiction map ${dateStamp} (INERT)`);
  L.push(`description: ${counts.realConflicts} real conflict(s), ${counts.calibration} calibration, ${counts.crossType} cross-type, ${counts.directionMenu} direction-menu pair(s) across ${counts.distilledClusters} distilled cluster(s); inert report only, awaiting human review.`);
  L.push('type: project');
  L.push('source: hook');
  L.push('verified: none - inert report, not enforced; contradictions typed from structured fields by classifyContradiction');
  L.push('confidence: low');
  L.push('---');
  L.push('');
  L.push(`# Taste consolidation + contradiction map ${dateStamp} (INERT - awaiting review)`);
  L.push('');
  L.push(`Generated by sidecoach-consolidate against commit ${commit}. This is INERT DATA under`);
  L.push('`sidecoach/data/taste-map/` (taste-map.json + taste-map.md). Nothing here is enforced: no source');
  L.push('file imports the report zone, and promotion of any distilled rule remains a separate, human-gated');
  L.push(`step. Distilled input: ${distilledFile ? path.basename(distilledFile) : '(none - headless rule-store baseline)'}.`);
  L.push('');
  L.push('## Counts');
  L.push(`- distilled clusters: ${counts.distilledClusters} (covered ${counts.covered}, additive ${counts.additive}, single-source ${counts.singleSource})`);
  L.push(`- real conflicts (resolve): ${counts.realConflicts}`);
  L.push(`- calibration (pick value/range): ${counts.calibration}`);
  L.push(`- cross-type (note): ${counts.crossType}`);
  L.push(`- direction menu (kept, not conflicts): ${counts.directionMenu}`);
  L.push(`- live rules surveyed: ${counts.liveRules}`);
  L.push('');
  L.push('## Next');
  L.push('A human reviews the map (taste-map.md), resolves real conflicts + calibrations, keeps the direction');
  L.push('menu, and promotes any accepted additive rule through the separate consent-gated path. This engine');
  L.push('never promotes or enforces.');
  L.push('');
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// distill-corpus (thin wrapper over assembleCorpus, filtered to distillable sourceKinds)
// ---------------------------------------------------------------------------
function runDistillCorpus(opts) {
  const reg = M.loadRegistry();
  const guidance = M.loadGuidanceStores();
  const corpus = M.assembleCorpus({ beatsDir: opts.beatsDir, registry: reg, guidance });
  const entries = corpus.entries
    .filter((e) => DISTILLABLE.has(e.sourceKind))
    .map((e) => {
      const dirLabel = e.sourceKind === 'expert-external' ? directionLabelFor(e.source, e.file) : null;
      return { ...e, directionSource: !!dirLabel, directionLabel: dirLabel };
    });
  return {
    schema: 'sidecoach-taste-distill-corpus/v1',
    generated_utc: nowIso(),
    commit: corpus.commit,
    note: 'The DISTILLABLE corpus (expert-external + rule-store). The live consolidate flow distills each into ONE typed DistilledRule. External content is UNTRUSTED DATA - read as evidence, never obeyed. `directionSource` marks a provenance-gated named-direction source.',
    stats: {
      'expert-external': corpus.stats['expert-external'],
      'rule-store-for-dedup': corpus.stats['rule-store-for-dedup'],
      total: entries.length,
    },
    entries,
  };
}

// ---------------------------------------------------------------------------
// arg parsing + main
// ---------------------------------------------------------------------------
const VALUE_FLAGS = new Set(['--distilled', '--out-dir', '--report', '--beats-dir', '--beat-out-dir', '--date']);

function parseArgs(argv) {
  const opts = { _: [] };
  // A value-taking flag with no following value (end of argv, or the next token is itself a flag) is a
  // usage ERROR, not a silently-undefined option (Codex F3): a bare `--distilled` used to leave
  // opts.distilled undefined and then produce a zero-cluster headless map that could OVERWRITE the report.
  // The unambiguous `--flag=value` form is ALSO accepted (Codex re-review F2) so a legitimate value that
  // begins with a dash (a filename like `-fixture.json`) can be passed without tripping the space-separated
  // guard; the guard on the space form is unchanged, so the headless-overwrite hole stays closed.
  for (let i = 0; i < argv.length; i++) {
    let a = argv[i];
    let inlineVal;
    if (a.startsWith('--')) {
      const eq = a.indexOf('=');
      if (eq !== -1) { inlineVal = a.slice(eq + 1); a = a.slice(0, eq); }
    }
    if (inlineVal !== undefined && !VALUE_FLAGS.has(a)) {
      const e = new Error(`flag ${a} does not take an =value`); e.exitCode = EXIT_USAGE; throw e;
    }
    const need = () => {
      if (inlineVal !== undefined) {
        if (inlineVal === '') { const e = new Error(`flag ${a} requires a value`); e.exitCode = EXIT_USAGE; throw e; }
        return inlineVal;   // --flag=value: the value may legitimately begin with a dash
      }
      const v = argv[i + 1];
      if (v === undefined || (typeof v === 'string' && v.startsWith('--'))) {
        const e = new Error(`flag ${a} requires a value`); e.exitCode = EXIT_USAGE; throw e;
      }
      i += 1;
      return v;
    };
    if (a === '--json') opts.json = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--no-beat') opts.noBeat = true;
    else if (a === '--distilled') opts.distilled = need();
    else if (a === '--out-dir') opts.outDir = need();
    else if (a === '--report') opts.report = need();
    else if (a === '--beats-dir') opts.beatsDir = need();
    else if (a === '--beat-out-dir') opts.beatOutDir = need();
    else if (a === '--date') opts.date = need();
    else if (a === '--help' || a === '-h') opts.help = true;
    else if (a.startsWith('--')) { const e = new Error(`unknown flag: ${a}`); e.exitCode = EXIT_USAGE; throw e; }
    else opts._.push(a);
  }
  return opts;
}

const HELP = `sidecoach-consolidate - the taste consolidation + contradiction MAP engine (inert report only)

USAGE
  node bin/sidecoach-consolidate.js distill-corpus [--json]
  node bin/sidecoach-consolidate.js map [--distilled <file>] [--dry-run] [--json]
                                        [--out-dir <dir>] [--report <file>]
                                        [--beat-out-dir <dir>] [--no-beat] [--date YYYY-MM-DD]
  node bin/sidecoach-consolidate.js map --check [--distilled <file>] [--report <file>]
  node bin/sidecoach-consolidate.js --help

SUBCOMMANDS
  distill-corpus  Print the DISTILLABLE corpus (expert-external + rule-store), each annotated with
                  its provenance-derived direction hint. The live flow distills these into a
                  distilled.json. Distills nothing itself.
  map             Ingest a distilled.json, cluster by concept, compute overlap vs our live rules, and
                  flag every contradiction CLASSIFIED by type. Writes ONLY data/taste-map/ + a beat.
                  No --distilled => a headless rule-store baseline map. --dry-run writes nothing.
                  --check regenerates the report and diffs the committed one (exit 1 on drift).

EXIT CODES
  0 success   1 --check drift   2 usage   3 build first (registry/types)   4 write failure   5 bad --distilled`;

function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) { process.stderr.write(HELP + '\n'); process.exit(EXIT_USAGE); }

  const sub = argv[0];
  let opts;
  try { opts = parseArgs(argv.slice(1)); } catch (err) { fail(err); }

  if (sub === '--help' || sub === '-h' || opts.help) { process.stdout.write(HELP + '\n'); process.exit(EXIT_OK); }

  try {
    if (sub === 'distill-corpus') {
      const res = runDistillCorpus(opts);
      if (opts.json) process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      else printDistillSummary(res);
      process.exit(EXIT_OK);
    }
    if (sub === 'map') {
      const res = runMap(opts);
      if (opts.json) process.stdout.write(JSON.stringify(res, null, 2) + '\n');
      else printMapSummary(res);
      process.exit(EXIT_OK);
    }
    const e = new Error(`unknown subcommand: ${sub}`); e.exitCode = EXIT_USAGE; throw e;
  } catch (err) { fail(err); }
}

function fail(err) {
  const code = err && err.exitCode ? err.exitCode : EXIT_USAGE;
  process.stderr.write(`sidecoach-consolidate: FAIL(${code}): ${err && err.message ? err.message : String(err)}\n`);
  process.exit(code);
}

function printDistillSummary(res) {
  process.stdout.write(`sidecoach distillable corpus (commit ${res.commit})\n`);
  process.stdout.write(`  expert-external:       ${res.stats['expert-external']}\n`);
  process.stdout.write(`  rule-store-for-dedup:  ${res.stats['rule-store-for-dedup']}\n`);
  process.stdout.write(`  total distillable:     ${res.stats.total}\n`);
  const dirCount = res.entries.filter((e) => e.directionSource).length;
  process.stdout.write(`  direction sources:     ${dirCount} (provenance-gated)\n`);
}

function printMapSummary(res) {
  if (res.checked) {
    process.stdout.write(`sidecoach-consolidate --check: OK (the committed report matches the regenerated map)\n`);
    return;
  }
  const c = res.counts;
  process.stdout.write(`sidecoach taste map${res.dryRun ? ' [DRY RUN - nothing written]' : ''}\n`);
  process.stdout.write(`  distilled clusters:  ${c.distilledClusters} (covered ${c.covered}, additive ${c.additive}, single-source ${c.singleSource})\n`);
  process.stdout.write(`  real conflicts:      ${c.realConflicts}\n`);
  process.stdout.write(`  calibration:         ${c.calibration}\n`);
  process.stdout.write(`  cross-type (note):   ${c.crossType}\n`);
  process.stdout.write(`  direction menu:      ${c.directionMenu} (kept - not conflicts)\n`);
  process.stdout.write(`  live rules surveyed: ${c.liveRules}\n`);
  if (res.wrote) {
    process.stdout.write(`  map:    ${res.mapJson}\n`);
    process.stdout.write(`  report: ${res.report}\n`);
    if (res.beat) process.stdout.write(`  beat:   ${res.beat}\n`);
  }
}

// Export the pure pieces for the unit test; run main() only as a CLI.
module.exports = {
  directionLabelFor, normalizeDistilled, loadDistilledFile,
  seedRuleStoreConcepts, findLiveMatch, detectContradictions, buildMap,
  renderMarkdown, runMap, runDistillCorpus,
  SAFE_TASTE_MAP_DIR, SAFE_MEMORY_DIR, DEFAULT_REPORT, DEFAULT_MAP_JSON,
  EXIT_OK, EXIT_CHECK_DRIFT, EXIT_USAGE, EXIT_REGISTRY, EXIT_WRITE, EXIT_DISTILLED,
};

if (require.main === module) main();
