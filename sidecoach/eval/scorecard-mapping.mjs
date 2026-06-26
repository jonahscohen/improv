#!/usr/bin/env node
/**
 * Contract-6 BASELINE SCORECARD - step 2: the rule -> ground-truth-class MAPPING (lead-reviewed BEFORE metrics).
 *
 * The mapping is a BIAS VECTOR (like the briefs + labels): if Sidecoach's rules were mapped generously and
 * oracle's strictly, the head-to-head would tilt unfairly. So the mapping is MECHANICAL + SYMMETRIC +
 * auditable: the IDENTICAL algorithm runs over BOTH tools' vocabularies, with ZERO per-tool hand-tuning.
 *
 * ALGORITHM (same for both tools): normalize a rule name = lowercase, strip any prefix before '/'
 * (e.g. taste/X -> X), strip non [a-z0-9-]. A rule MAPS to a ground-truth class iff its normalized name
 * EQUALS the class name. No synonyms, no fuzzy matching - exact normalized equality only. Unmapped rules
 * are reported per tool (transparent). Rules that DON'T map but share a token with a class are surfaced as
 * BORDERLINE candidates for the LEAD to decide (the architect does NOT auto-map them - that is the bias vector).
 *
 * Reads the collected vocabularies from .scorecard-cache; writes scorecard-mapping.json for lead review.
 * Computes NO metrics.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, isCompleteRecord } from './scorecard-shared.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CACHE = path.join(HERE, '.scorecard-cache');
const CORPUS = path.join(HERE, 'corpus');
const OUT = path.join(CORPUS, 'scorecard-mapping.json');

const OBJECTIVE = ['broken-image', 'justified-text', 'skipped-heading', 'low-contrast', 'gray-on-color'];
const SUBJECTIVE = ['cream-palette', 'ai-color-palette', 'hero-eyebrow-chip', 'repeated-section-kickers', 'numbered-section-markers', 'icon-tile-stack', 'italic-serif-display', 'nested-cards', 'side-stripe-borders', 'glassmorphism-default', 'hero-metric-template', 'gradient-text', 'marketing-buzzword', 'aphoristic-cadence', 'dark-glow', 'tiny-text', 'wide-tracking', 'all-caps-body', 'layout-transition', 'bounce-easing', 'tight-leading', 'extreme-negative-tracking'];

// NEUTRAL canonicalization (Codex item-8 #6): strip the namespace prefix before '/', split camelCase, lowercase,
// then tokenize on EVERY non-alphanumeric separator (hyphen/underscore/space/dot) and rejoin with '-'. Applied
// IDENTICALLY to rule names AND class names, so no punctuation convention (a tool that emits "low-contrast" vs
// "low_contrast" vs "lowContrast") is favored. This is the bias-vector guard the lead flagged.
const canon = (s) => String(s)
  .replace(/^[^/]*\//, '')
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .toLowerCase()
  .split(/[^a-z0-9]+/).filter(Boolean).join('-');

const CLASS_CANON = new Map(); // canon(class) -> { class, kind }
for (const c of OBJECTIVE) CLASS_CANON.set(canon(c), { class: c, kind: 'objective' });
for (const c of SUBJECTIVE) CLASS_CANON.set(canon(c), { class: c, kind: 'subjective' });

// Read vocab from EXACTLY the frozen manifest (Codex item-8 #5), not every *.json in the cache dir, so a
// stale cache file from an older corpus run cannot pollute the mapping. Each record is VALIDATED with the
// SAME completeness predicate collect uses (Codex pass2 #2): right collector version, page-content hash
// matches, full both-tool schema. A stale same-id file (old schema or different page content) fails loud.
const manifest = JSON.parse(readFileSync(path.join(CORPUS, 'candidates.json'), 'utf8')).map((c) => ({ id: c.id, file: c.file }));
const manifestIds = manifest.map((c) => c.id);
const RECORDS = new Map(); // id -> validated record
{
  const cacheIds = new Set(readdirSync(CACHE).filter((x) => x.endsWith('.json')).map((x) => x.replace(/\.json$/, '')));
  const missing = manifestIds.filter((id) => !cacheIds.has(id));
  const extra = [...cacheIds].filter((id) => !manifestIds.includes(id));
  if (missing.length) { console.error(`MISSING cache records for ${missing.length}: ${missing.join(', ')} - run scorecard-collect.mjs first`); process.exit(1); }
  if (extra.length) console.error(`WARNING: ignoring ${extra.length} cache file(s) not in manifest: ${extra.join(', ')}`);
  const stale = [];
  for (const { id, file } of manifest) {
    const p = path.join(CACHE, `${id}.json`);
    const rec = JSON.parse(readFileSync(p, 'utf8'));
    const corpusSha = sha256(readFileSync(path.join(CORPUS, file)));
    if (!isCompleteRecord(rec, corpusSha)) { stale.push(id); continue; }
    RECORDS.set(id, rec);
  }
  if (stale.length) { console.error(`STALE/INCOMPLETE cache records for ${stale.length}: ${stale.join(', ')} - re-run scorecard-collect.mjs --force`); process.exit(1); }
}

function vocabFromCache(toolKey) {
  const v = new Set();
  for (const id of manifestIds) for (const fd of RECORDS.get(id)[toolKey] || []) v.add(fd.rule);
  return [...v].sort();
}

function mapTool(vocab) {
  const mapped = {}; const unmapped = [];
  for (const rule of vocab) { const n = canon(rule); if (CLASS_CANON.has(n)) mapped[rule] = CLASS_CANON.get(n).class; else unmapped.push(rule); }
  return { vocab, mapped, unmapped };
}

// neutral borderline detector: an unmapped rule that shares a >=4-char canon token with a class name (flag only).
function borderline(unmapped, tool) {
  const out = [];
  const classTokens = [...CLASS_CANON.values()].map(({ class: c }) => ({ c, toks: canon(c).split('-').filter((t) => t.length >= 4) }));
  for (const rule of unmapped) {
    const rtoks = canon(rule).split('-').filter((t) => t.length >= 4);
    for (const { c, toks } of classTokens) {
      const shared = rtoks.filter((t) => toks.includes(t));
      if (shared.length) out.push({ tool, rule, nearClass: c, sharedToken: shared.join(',') });
    }
  }
  return out;
}

const sc = mapTool(vocabFromCache('sidecoach'));
const im = mapTool(vocabFromCache('oracle'));
const result = {
  generatedUtc: new Date().toISOString(),
  algorithm: "neutral canonicalization applied IDENTICALLY to rule names and class names (strip prefix before '/'; split camelCase; lowercase; tokenize on every non-alphanumeric separator; rejoin '-'); rule maps iff canon(rule) == canon(class); SAME algorithm for both tools; no synonyms/fuzzy; vocab read from frozen manifest ids only; unmapped reported; borderline surfaced for lead decision (not auto-mapped)",
  groundTruthClasses: { objective: OBJECTIVE, subjective: SUBJECTIVE },
  sidecoach: { ...sc, mappedClasses: [...new Set(Object.values(sc.mapped))].sort() },
  oracle: { ...im, mappedClasses: [...new Set(Object.values(im.mapped))].sort() },
  borderlineForLeadDecision: [...borderline(sc.unmapped, 'sidecoach'), ...borderline(im.unmapped, 'oracle')],
};

// NAME-LINEAGE MITIGATION (lead catch): the SUBJECTIVE class names share lineage with Sidecoach's taste
// vocab, so exact-NAME-match credits Sidecoach when oracle detects the same idiom under a different
// name. Exact-match stays the neutral FLOOR; the Codex symmetric semantic pass (scorecard-semantic-pass.mjs)
// adds idiom-equivalence matches over the UNMAPPED rules of BOTH tools. If that pass has run, fold its
// verdicts (with Codex reason + confidence) IN HERE so the mapping file carries the full, auditable picture.
result.nameLineageMitigation = "Subjective GT class names share lineage with Sidecoach's taste vocabulary; exact-name-match (above) is the neutral floor; the Codex symmetric semantic pass (semanticPass below) corrects BOTH directions over unmapped rules. effectiveMapping = exact + Codex-confirmed semantic.";
const SEMANTIC = path.join(CORPUS, 'scorecard-semantic-pass.json');
if (existsSync(SEMANTIC)) {
  const sp = JSON.parse(readFileSync(SEMANTIC, 'utf8'));
  // Codex pass3 #2 + pass4 (mapping side): FULLY validate the semantic artifact before folding - otherwise an
  // errored/omitted/duplicate/malformed verdict silently reads as "no match" and under-credits a tool. Require:
  // exact worklist coverage (length match + set equality + unique keys), top-level errors empty, and EVERY
  // verdict schema-valid (matchedClass null-or-in-class-set, confidence enum, reasoning non-empty). Fail loud on any gap.
  const results = sp.results || [];
  const keys = results.map((r) => `${r.tool}:${r.rule}`);
  const worklist = [...sc.unmapped.map((r) => `sidecoach:${r}`), ...im.unmapped.map((r) => `oracle:${r}`)];
  const dupKeys = keys.filter((k, i) => keys.indexOf(k) !== i);
  const covered = new Set(keys);
  const missingSem = worklist.filter((w) => !covered.has(w));
  const extraSem = [...covered].filter((w) => !worklist.includes(w));
  const erroredSem = results.filter((r) => r.error);
  const validClasses = new Set([...OBJECTIVE, ...SUBJECTIVE]);
  const okConf = new Set(['high', 'medium', 'low']);
  const badSchema = results.filter((r) => !r.error && !(
    (r.matchedClass === null || (typeof r.matchedClass === 'string' && validClasses.has(r.matchedClass)))
    && okConf.has(r.confidence) && typeof r.reasoning === 'string' && r.reasoning.trim()
  ));
  if (results.length !== worklist.length || dupKeys.length || missingSem.length || extraSem.length || erroredSem.length || badSchema.length) {
    console.error(`SEMANTIC PASS artifact invalid: have ${results.length} vs worklist ${worklist.length}; dup [${[...new Set(dupKeys)].join(', ') || 'none'}]; missing [${missingSem.join(', ') || 'none'}]; extra [${extraSem.join(', ') || 'none'}]; errored [${erroredSem.map((r) => `${r.tool}:${r.rule}`).join(', ') || 'none'}]; bad-schema [${badSchema.map((r) => `${r.tool}:${r.rule}`).join(', ') || 'none'}] - re-run scorecard-semantic-pass.mjs`);
    process.exit(1);
  }
  result.semanticPass = {
    labeledBy: sp.labeledBy, method: sp.method, rubricSha: sp.rubricSha, descriptionsSha: sp.descriptionsSha,
    verdicts: sp.results, // each: { tool, rule, matchedClass|null, confidence, reasoning } - lead reviews these
  };
  // effectiveMapping per tool: exact matches (from above) + Codex-confirmed semantic matches, layer-tagged.
  const effective = (toolKey, exactMapped) => {
    const exact = Object.entries(exactMapped).map(([rule, cls]) => ({ rule, class: cls, layer: 'exact' }));
    const semantic = (sp.results || []).filter((r) => r.tool === toolKey && r.matchedClass)
      .map((r) => ({ rule: r.rule, class: r.matchedClass, layer: 'semantic', confidence: r.confidence, reasoning: r.reasoning }));
    return { exact, semantic, allClasses: [...new Set([...exact, ...semantic].map((e) => e.class))].sort() };
  };
  result.effectiveMapping = { sidecoach: effective('sidecoach', sc.mapped), oracle: effective('oracle', im.mapped) };
  // Resolve each borderline with the Codex verdict for that rule (the lead asked specifically about side-tab).
  const verdictFor = (tool, rule) => (sp.results || []).find((r) => r.tool === tool && r.rule === rule);
  result.borderlineForLeadDecision = result.borderlineForLeadDecision.map((b) => {
    const v = verdictFor(b.tool, b.rule);
    return { ...b, codexVerdict: v ? { matchedClass: v.matchedClass, confidence: v.confidence, reasoning: v.reasoning } : null };
  });
}

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`wrote ${OUT}`);
console.log(`SIDECOACH: ${sc.vocab.length} rules -> ${Object.keys(sc.mapped).length} exact-mapped to [${result.sidecoach.mappedClasses.join(', ')}]; ${sc.unmapped.length} unmapped [${sc.unmapped.join(', ')}]`);
console.log(`ORACLE: ${im.vocab.length} rules -> ${Object.keys(im.mapped).length} exact-mapped to [${result.oracle.mappedClasses.join(', ')}]; ${im.unmapped.length} unmapped [${im.unmapped.join(', ')}]`);
if (result.semanticPass) {
  const sm = (result.semanticPass.verdicts || []).filter((r) => r.matchedClass);
  console.log(`SEMANTIC PASS folded: ${sm.length} Codex-confirmed match(es): ${sm.map((r) => `${r.tool}:${r.rule}->${r.matchedClass}(${r.confidence})`).join(', ') || '(none)'}`);
}
console.log(`BORDERLINE: ${result.borderlineForLeadDecision.map((b) => `${b.tool}:${b.rule}~${b.nearClass} [codex:${b.codexVerdict ? (b.codexVerdict.matchedClass ?? 'null') : 'n/a'}]`).join(' | ') || '(none)'}`);
