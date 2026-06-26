#!/usr/bin/env node
/**
 * Contract-6 SCORECARD - SYMMETRIC SEMANTIC PASS over UNMAPPED rules (lead-mandated, Codex-run).
 *
 * WHY (lead catch): the SUBJECTIVE ground-truth class NAMES share lineage with Sidecoach's own taste
 * vocabulary, so exact-NAME-match (scorecard-mapping.mjs) silently credits Sidecoach whenever oracle
 * detects the SAME idiom under a DIFFERENT name (live case: side-stripe-borders maps for Sidecoach, while
 * oracle's border-accent-on-rounded - arguably the same idiom - stays unmapped). Exact-match stays as
 * the neutral floor; this pass adds a SEMANTIC layer for the UNMAPPED rules ONLY, judged by an INDEPENDENT
 * model (Codex), NOT by the architect or lead (both bias-prone on idiom-equivalence here).
 *
 * SYMMETRY: the IDENTICAL prompt template runs for EVERY unmapped rule of BOTH tools. The prompt is
 * TOOL-AGNOSTIC (the rule's namespace prefix is stripped; the tool identity is NEVER shown to Codex), so
 * the model judges idiom-equivalence blind to which tool authored the rule. Each rule's self-description is
 * its OWN tool's words (corpus/rule-descriptions.json, source-cited), not the architect's characterization.
 *
 * Codex decides matchedClass (or null) + confidence + one-sentence reasoning. Confirmed matches become
 * SEMANTIC map entries; the rest stay unmapped. Output is committed for the lead's review BEFORE scoring.
 * This module maps NO metrics and auto-maps NOTHING itself - it only records Codex's verdicts.
 *
 * Usage: node scorecard-semantic-pass.mjs [--dry-run] [--rule <name>]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash as hash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CORPUS = path.join(HERE, 'corpus');
const MAPPING = path.join(CORPUS, 'scorecard-mapping.json');
const DESCRIPTIONS = path.join(CORPUS, 'rule-descriptions.json');
const RUBRIC = path.join(CORPUS, 'subjective-rubric.md');
const OUT = path.join(CORPUS, 'scorecard-semantic-pass.json');

const sha = (s) => hash('sha256').update(s).digest('hex').slice(0, 16);
const stripNs = (rule) => String(rule).replace(/^[^/]*\//, ''); // hide namespace (tool lineage) from Codex

// Neutral, spec/idiom-grounded one-liners for the OBJECTIVE classes (the rubric only documents subjective).
const OBJECTIVE_DESC = {
  'broken-image': 'an image element that renders as a broken or placeholder box (empty, missing, or placeholder source).',
  'justified-text': 'body text set with justified alignment, producing uneven inter-word spacing.',
  'skipped-heading': 'the heading outline skips a level (for example an h1 followed directly by an h3).',
  'low-contrast': 'text whose contrast against its background falls below the WCAG AA ratio.',
  'gray-on-color': 'gray text placed on a colored background, reading as washed out / low contrast.',
};

// Parse the subjective class one-liners straight from the committed, lead-finalized rubric (single source).
function parseRubric() {
  const txt = readFileSync(RUBRIC, 'utf8');
  const out = {};
  for (const line of txt.split('\n')) {
    const m = line.match(/^- ([a-z0-9-]+):\s*(.+)$/);
    if (m) out[m[1]] = m[2].trim();
  }
  return out;
}

function buildPrompt(ruleName, ruleDesc, classes) {
  const classList = classes.map(({ name, desc }) => `- ${name}: ${desc}`).join('\n');
  return `You are judging whether a design-lint RULE detects the SAME design idiom as any class in a fixed ground-truth taxonomy. Judge ONLY by the underlying idiom the rule targets versus what each class describes. IGNORE name similarity and wording overlap - a shared word is not a match, and a different name is not a non-match. Two entries match only if a designer would say they flag the same visual/textual idiom.

RULE: ${ruleName}
What it flags: ${ruleDesc}

GROUND-TRUTH CLASSES:
${classList}

Does this rule detect the same idiom as exactly one of these classes? If it could fit more than one, pick the single closest. If it fits none, answer null. Do NOT force a match.

Output ONLY this JSON object on the final line, nothing after it:
{"matchedClass": <exact class name in quotes, or null>, "confidence": "high"|"medium"|"low", "reasoning": "<one sentence>"}`;
}

const CONFIDENCE = new Set(['high', 'medium', 'low']);
function runCodex(prompt, isValidClass) {
  const r = spawnSync('codex', ['exec', '--sandbox', 'read-only', '--skip-git-repo-check', '-'], {
    input: prompt, encoding: 'utf8', timeout: 180000, maxBuffer: 64 * 1024 * 1024,
  });
  if (r.error) return { ok: false, reason: String(r.error.message || r.error) };
  // Codex pass3 #3: a crashed/killed Codex run must NOT be mined for a stray JSON object. Require a clean
  // exit (status 0, no signal), parse STDOUT ONLY (never stderr), take the LAST stdout line that is a complete
  // matchedClass JSON object, and FULLY validate its schema (class in set or null; confidence enum; reasoning).
  if (r.status !== 0 || r.signal) return { ok: false, reason: `codex exit status=${r.status} signal=${r.signal || 'none'}` };
  // STRICT (Codex pass4 #3): the FINAL non-empty stdout line MUST itself be the JSON verdict. We do not scan
  // backward past trailing output - trailing content after the answer means the run is malformed -> fail closed.
  const lines = (r.stdout || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const last = lines[lines.length - 1] || '';
  if (!/^\{.*"matchedClass".*\}$/.test(last)) return { ok: false, reason: 'final stdout line is not the matchedClass JSON verdict' };
  let verdict = null;
  try { verdict = JSON.parse(last); } catch { return { ok: false, reason: `final stdout line not valid JSON: ${last.slice(0, 80)}` }; }
  let mc = verdict.matchedClass;
  if (mc === 'null' || mc === '') mc = null;
  if (!(mc === null || (typeof mc === 'string' && isValidClass(mc)))) return { ok: false, reason: `matchedClass not a valid class or null: ${JSON.stringify(verdict.matchedClass)}` };
  if (!CONFIDENCE.has(verdict.confidence)) return { ok: false, reason: `confidence not high/medium/low: ${JSON.stringify(verdict.confidence)}` };
  if (typeof verdict.reasoning !== 'string' || !verdict.reasoning.trim()) return { ok: false, reason: 'reasoning missing/empty' };
  return { ok: true, verdict: { matchedClass: mc, confidence: verdict.confidence, reasoning: verdict.reasoning.trim() } };
}

const dryRun = process.argv.includes('--dry-run');
const force = process.argv.includes('--force');
const onlyRule = (() => { const i = process.argv.indexOf('--rule'); return i >= 0 ? process.argv[i + 1] : null; })();

// REPRODUCIBILITY PIN (lead-mandated 2026-06-24): this pass is TOOL-BLIND (the safeguard against bias) but
// Codex is non-deterministic run-to-run on BORDERLINE rules - e.g. oracle's border-accent-on-rounded
// mapped to side-stripe-borders at MEDIUM on one roll and unmapped at HIGH on the next (the idiom-faithful
// answer: border-accent = horizontal top/bottom card accents, side-stripe = a vertical left/right stripe).
// To make the eval REPRODUCIBLE, a lead-reviewed roll is PINNED: the committed artifact carries "pinned": true
// and this script then REFUSES to regenerate (map+score still fold the frozen artifact deterministically, so
// effectiveMapping is reproducible). A genuine vocab change is still caught downstream by scorecard-mapping.mjs's
// worklist validation (it aborts on a stale artifact). To intentionally re-roll: pass --force, then re-add
// "pinned": true after lead review.
if (!dryRun && !force && existsSync(OUT)) {
  let existing = null;
  try { existing = JSON.parse(readFileSync(OUT, 'utf8')); } catch { existing = null; }
  if (existing && existing.pinned === true) {
    console.error(`PINNED: ${OUT} is frozen for reproducibility (tool-blind Codex non-determinism). Skipping regeneration - map+score fold the committed artifact deterministically. Pass --force to intentionally re-roll, then re-add "pinned": true after lead review.`);
    process.exit(0);
  }
}

const mapping = JSON.parse(readFileSync(MAPPING, 'utf8'));
const descriptions = JSON.parse(readFileSync(DESCRIPTIONS, 'utf8'));
const rubricDesc = parseRubric();
const rubricText = readFileSync(RUBRIC, 'utf8');
const descText = readFileSync(DESCRIPTIONS, 'utf8');

// The full class set presented to Codex (objective + subjective), each with a neutral description.
const objective = mapping.groundTruthClasses.objective.map((name) => ({ name, desc: OBJECTIVE_DESC[name] || '(no description)', kind: 'objective' }));
const subjective = mapping.groundTruthClasses.subjective.map((name) => ({ name, desc: rubricDesc[name] || '(no description)', kind: 'subjective' }));
const classes = [...objective, ...subjective];
const classNames = new Set(classes.map((c) => c.name));
const missingDesc = classes.filter((c) => c.desc === '(no description)').map((c) => c.name);
if (missingDesc.length) { console.error(`FATAL: no description for classes: ${missingDesc.join(', ')}`); process.exit(1); }

// The unmapped rules of BOTH tools, each paired with its own-tool self-description (must exist for all).
const work = [];
for (const tool of ['sidecoach', 'oracle']) {
  for (const rule of mapping[tool].unmapped) {
    const d = descriptions[tool]?.[rule];
    if (!d) { console.error(`FATAL: no self-description for ${tool}:${rule} in rule-descriptions.json`); process.exit(1); }
    work.push({ tool, rule, ruleName: stripNs(rule), ruleDesc: d.description, source: d.source });
  }
}

const promptTemplateSample = buildPrompt('<RULE>', '<DESC>', classes);
console.error(`semantic pass: ${work.length} unmapped rules (${mapping.sidecoach.unmapped.length} sidecoach + ${mapping.oracle.unmapped.length} oracle); rubricSha=${sha(rubricText)} descSha=${sha(descText)}`);

const results = [];
for (const w of work) {
  if (onlyRule && w.rule !== onlyRule) continue;
  const prompt = buildPrompt(w.ruleName, w.ruleDesc, classes);
  if (dryRun) { console.log(`\n===== ${w.tool}:${w.rule} =====\n${prompt}`); continue; }
  process.stderr.write(`  querying ${w.tool}:${w.rule} ... `);
  const r = runCodex(prompt, (c) => classNames.has(c)); // runCodex now fully validates the verdict schema + class
  if (!r.ok) {
    process.stderr.write(`ERROR (${r.reason})\n`);
    results.push({ tool: w.tool, rule: w.rule, source: w.source, error: r.reason, matchedClass: null, confidence: null, reasoning: null });
    continue;
  }
  process.stderr.write(`${r.verdict.matchedClass ?? 'null'} (${r.verdict.confidence})\n`);
  results.push({
    tool: w.tool, rule: w.rule, source: w.source,
    matchedClass: r.verdict.matchedClass,
    confidence: r.verdict.confidence,
    reasoning: r.verdict.reasoning,
  });
}

if (dryRun) { console.error('dry-run: printed prompts, no Codex calls, no write'); process.exit(0); }

// Codex pass3 #2: a partial (--rule) or errored run must NOT become the auditable artifact. A Codex error
// previously wrote matchedClass:null (indistinguishable from a genuine no-match) and exited 0, so mapping
// would silently fold it as "no match" - under-crediting a tool. Fail closed: never write OUT on partial/error.
if (onlyRule) { console.error(`--rule ${onlyRule} is a PARTIAL run (single rule); NOT writing canonical ${OUT}. Exiting nonzero so a partial run is never mistaken for a complete pass.`); process.exit(2); }
const erroredRules = results.filter((r) => r.error);
if (erroredRules.length) {
  console.error(`FAIL-CLOSED: ${erroredRules.length} rule(s) errored: ${erroredRules.map((r) => `${r.tool}:${r.rule} (${r.error})`).join('; ')}`);
  console.error(`NOT writing ${OUT} - a partial/errored semantic pass must not become the auditable artifact. Re-run.`);
  process.exit(1);
}

const semanticMatches = results.filter((r) => r.matchedClass);
const out = {
  generatedUtc: new Date().toISOString(),
  labeledBy: 'codex',
  method: 'symmetric per-rule Codex semantic pass over UNMAPPED rules of BOTH tools; identical tool-agnostic prompt template; namespace prefix stripped so the model is blind to tool lineage; each rule described in its OWN tool source words (rule-descriptions.json, cited); Codex decides matchedClass/null + confidence + reasoning; NOTHING auto-mapped by the architect',
  rubricSha: sha(rubricText),
  descriptionsSha: sha(descText),
  promptTemplateSample,
  classesPresented: { objective: objective.map((c) => c.name), subjective: subjective.map((c) => c.name) },
  results,
  semanticMatches: semanticMatches.map((r) => ({ tool: r.tool, rule: r.rule, matchedClass: r.matchedClass, confidence: r.confidence })),
  errors: results.filter((r) => r.error).map((r) => ({ tool: r.tool, rule: r.rule, error: r.error })),
};
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
console.error(`\nwrote ${OUT}`);
console.log(`SEMANTIC MATCHES (${semanticMatches.length}):`);
for (const r of semanticMatches) console.log(`  ${r.tool}:${r.rule} -> ${r.matchedClass} (${r.confidence}) - ${r.reasoning}`);
console.log(`STILL UNMAPPED (${results.filter((r) => !r.matchedClass && !r.error).length}): ${results.filter((r) => !r.matchedClass && !r.error).map((r) => `${r.tool}:${r.rule}`).join(', ')}`);
if (out.errors.length) console.log(`ERRORS (${out.errors.length}): ${out.errors.map((e) => `${e.tool}:${e.rule}`).join(', ')}`);
