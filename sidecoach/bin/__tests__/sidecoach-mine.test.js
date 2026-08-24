#!/usr/bin/env node
'use strict';

/**
 * Unit test for the taste miner engine (bin/sidecoach-mine.js). Self-contained: exercises the pure
 * pieces (dedup classification, candidate normalization, in-isolation pre-flight) plus a dry-run of
 * the whole pipeline against the REAL rule stores. Requires a built dist/ (it loads the compiled
 * registry, exactly as the miner does). Exits non-zero on any failure; prints no failure-shaped line
 * on success.
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

const M = require(path.resolve(__dirname, '..', 'sidecoach-mine.js'));

let passed = 0;
const failures = [];
function ok(cond, label) { if (cond) { passed += 1; } else { failures.push(label); } }
function eq(a, b, label) { ok(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// --- registry + guidance + dedup (real stores) --------------------------------
let reg, guidance, dedup;
try {
  reg = M.loadRegistry();
  guidance = M.loadGuidanceStores();
  dedup = M.buildDedupIndex(reg.RULES, guidance);
} catch (err) {
  process.stderr.write('sidecoach-mine.test: cannot load compiled registry - run `npm run build` first: ' + err.message + '\n');
  process.exit(2);
}

const norm = { supportedKindsFor: reg.supportedKindsFor };

// --- normalizeKey -------------------------------------------------------------
eq(M.normalizeKey('anti-pattern/Gradient_Text!!'), 'anti pattern gradient text', 'normalizeKey collapse');

// --- normalizeCandidate: schema + supportedSourceKinds + ruleId-from-key -------
const netNew = M.normalizeCandidate({
  title: 'Focus ring color drifts',
  sourceKind: 'expert-external', confidence: 'medium',
  proposedRule: { canonicalRuleKey: 'a11y/focus-ring-consistency', findingClass: 'a11y', severity: 'minor', evidenceRequirements: ['css-rule'], scope: 'file' },
}, norm);
eq(netNew.def.ruleId, 'a11y.focus-ring-consistency', 'ruleId derived from canonicalRuleKey');
eq(netNew.def.ownerValidatorId, 'static-a11y', 'owner inferred from findingClass a11y');
eq(netNew.def.sourceSeverity, 'medium', 'sourceSeverity normalized to match severity (no divergence)');
eq(JSON.stringify(netNew.def.supportedSourceKinds), JSON.stringify(reg.supportedKindsFor('css-rule')), 'supportedSourceKinds equals the shared matrix');
eq(netNew.detectable, true, 'css-rule candidate is detectable');

// --- classify: net-new / duplicate / strengthen -------------------------------
const clsNetNew = M.classify(netNew, dedup);
eq(clsNetNew.disposition, 'net-new', 'novel key classifies net-new');

const dupCand = M.normalizeCandidate({
  title: 'gradient text', proposedRule: { canonicalRuleKey: 'anti-pattern/gradient-text', findingClass: 'anti-pattern', severity: 'major', evidenceRequirements: ['css-rule'] },
}, norm);
eq(M.classify(dupCand, dedup).disposition, 'duplicate', 'restatement at same severity is a duplicate (dropped)');

const strengthenCand = M.normalizeCandidate({
  title: 'gradient text', proposedRule: { canonicalRuleKey: 'anti-pattern/gradient-text', findingClass: 'anti-pattern', severity: 'blocker', evidenceRequirements: ['css-rule'] },
}, norm);
eq(M.classify(strengthenCand, dedup).disposition, 'strengthen-existing', 'severity change is strengthen-existing');

// guidance-store-only match (a design-judgment title, no registry rule): a WEAK resemblance, so it is
// kept as net-new (never dropped) and FLAGGED `resembles` - there is no registry rule to strengthen.
const guidanceMatch = M.normalizeCandidate({
  title: 'One accent color per view', proposedRule: { canonicalRuleKey: 'theming/one-accent-per-view', findingClass: 'theming', severity: 'minor', evidenceRequirements: ['css-rule'], scope: 'page' },
}, norm);
const clsGuidance = M.classify(guidanceMatch, dedup);
eq(clsGuidance.disposition, 'net-new', 'guidance-store title match is net-new (kept, not dropped)');
ok(clsGuidance.resembles && clsGuidance.resembles.startsWith('design-judgment:'), 'guidance match is flagged resembles the design-judgment store');

// FINDING 3 regression: a candidate that only shares the canonical-key TAIL with an existing rule of a
// DIFFERENT namespace must NOT be dropped as a duplicate. copy/button-label-specific weakly resembles
// a11y/button-label-specific but is a different identity -> net-new (kept), flagged resembles.
const tailOnly = M.normalizeCandidate({
  title: 'Copy button label is specific', proposedRule: { canonicalRuleKey: 'copy/button-label-specific', findingClass: 'copy', severity: 'minor', evidenceRequirements: ['markup'] },
}, norm);
const clsTail = M.classify(tailOnly, dedup);
eq(clsTail.disposition, 'net-new', 'tail-only resemblance across namespaces is net-new, NOT dropped');
ok(clsTail.resembles && clsTail.resembles.includes('button-label-specific'), 'tail-only match names the resembled rule');

// --- preflight: clean passes; re-anchored strengthen passes; malformed fails ---
const baseline = reg.validateRegistry(reg.RULES, reg.VALIDATOR_REGISTRATIONS, reg.gating, reg.browser, reg.rendered);
ok(baseline.ok === true, 'baseline registry validates clean');
const baseSet = new Set(baseline.errors || []);

eq(M.preflight(netNew, clsNetNew, reg, baseSet).ok, true, 'clean net-new passes pre-flight in isolation');

const clsStrengthen = M.classify(strengthenCand, dedup);
const preStrengthen = M.preflight(strengthenCand, clsStrengthen, reg, baseSet);
eq(preStrengthen.ok, true, 'strengthen re-anchors onto existing identity and passes (no self-collision)');
eq(strengthenCand.def.ruleId, 'anti-pattern.gradient-text', 'strengthen re-anchored onto the existing ruleId');

const malformed = M.normalizeCandidate({
  title: 'malformed', proposedRule: { canonicalRuleKey: 'polish/malformed-demo', findingClass: 'polish', severity: 'minor', sourceSeverity: 'P9-nope', evidenceRequirements: ['css-rule'] },
}, norm);
const preMalformed = M.preflight(malformed, M.classify(malformed, dedup), reg, baseSet);
eq(preMalformed.ok, false, 'malformed candidate fails pre-flight');
ok(preMalformed.errors.some((e) => e.includes('SEVERITY_TABLE')), 'malformed pre-flight error names the un-normalizable severity');

// TOTALITY (Codex finding 2): an UNKNOWN evidence kind must NOT throw/abort - it must be FILED with an
// error. supportedKindsFor throws on 'not-real'; normalizeCandidate catches it -> empty supportedSourceKinds
// -> validateRegistry files a "missing supportedSourceKinds" field error (no throw, run continues).
const badEvidence = M.normalizeCandidate({
  title: 'Unknown evidence kind', proposedRule: { canonicalRuleKey: 'polish/bad-evidence', findingClass: 'polish', severity: 'minor', evidenceRequirements: ['not-real'] },
}, norm);
eq(JSON.stringify(badEvidence.def.supportedSourceKinds), '[]', 'unknown evidence kind yields empty supportedSourceKinds (no throw)');
const preBad = M.preflight(badEvidence, M.classify(badEvidence, dedup), reg, baseSet);
eq(preBad.ok, false, 'unknown-evidence candidate is FILED as a pre-flight failure, not dropped or thrown');
ok(preBad.errors.some((e) => e.toLowerCase().includes('supportedsourcekinds')), 'unknown-evidence error names the missing supportedSourceKinds');

// SAFE-WRITE guard (Codex finding 1): a repo-internal path outside the inert zones is REFUSED; /tmp is fine.
let refused = false;
try { M.assertSafeWrite(require('path').join(M.SIDECOACH_ROOT, 'src', 'product-rule-registry.ts'), [M.SAFE_DATA_DIR], 'queue'); }
catch (e) { refused = (e.exitCode === M.EXIT_WRITE); }
ok(refused, 'assertSafeWrite REFUSES a write into sidecoach/src (would clobber the registry)');
let allowedTmp = true;
try { M.assertSafeWrite('/tmp/whatever/taste-candidates.json', [M.SAFE_DATA_DIR], 'queue'); } catch (_e) { allowedTmp = false; }
ok(allowedTmp, 'assertSafeWrite ALLOWS an out-of-repo scratch path (tests / launchd)');
let allowedData = true;
try { M.assertSafeWrite(require('path').join(M.SAFE_DATA_DIR, 'proposed-rules', 'x.json'), [M.SAFE_DATA_DIR], 'proposal'); } catch (_e) { allowedData = false; }
ok(allowedData, 'assertSafeWrite ALLOWS a path under sidecoach/data');

// INDEPENDENT-REVIEW finding 1 regression: a --date carrying `..` must NOT let the beat escape the beat dir.
const dtmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mine-date-'));
fs.mkdirSync(path.join(dtmp, 'beats'), { recursive: true });
M.runPipeline({ date: '../../../../ESCAPED', beatsDir: path.join(dtmp, 'beats'), beatOutDir: path.join(dtmp, 'beats') });
ok(!fs.existsSync(path.join(dtmp, 'ESCAPED.md')), 'a --date traversal does NOT write a beat outside the beat dir');
const beatWritten = fs.readdirSync(path.join(dtmp, 'beats')).filter((f) => /^taste_mine_\d{4}-\d{2}-\d{2}\.md$/.test(f));
ok(beatWritten.length === 1, 'the --date value is sanitized to a safe YYYY-MM-DD beat filename inside the dir');
try { fs.rmSync(dtmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

// INDEPENDENT-REVIEW finding 2 regression: a symlink whose real target is inside src/ is refused.
const slink = path.join(os.tmpdir(), `mine-symlink-${process.pid}`);
try { fs.unlinkSync(slink); } catch (_e) { /* ignore */ }
fs.symlinkSync(path.join(M.SIDECOACH_ROOT, 'src'), slink);
let symlinkRefused = false;
try { M.assertSafeWrite(path.join(slink, 'product-rule-registry.ts'), [M.SAFE_DATA_DIR], 'queue'); }
catch (e) { symlinkRefused = (e.exitCode === M.EXIT_WRITE); }
ok(symlinkRefused, 'assertSafeWrite resolves symlinks and REFUSES a symlink whose real target is inside src/');
try { fs.unlinkSync(slink); } catch (_e) { /* best-effort */ }

// INDEPENDENT-REVIEW finding 4 regression: a candidate title with a throwing toString does NOT crash normalize.
let normalizedThrowingTitle = true;
try {
  const throwing = { toString() { throw new Error('boom'); } };
  const c = M.normalizeCandidate({ title: throwing, proposedRule: { canonicalRuleKey: 'polish/throwing-title', findingClass: 'polish', severity: 'minor', evidenceRequirements: ['css-rule'] } }, norm);
  ok(typeof c.title === 'string', 'a throwing-toString title coerces to a safe string (totality)');
} catch (_e) { normalizedThrowingTitle = false; }
ok(normalizedThrowingTitle, 'normalizeCandidate does not throw on a hostile title');

// LEAN-CODEX finding 2 regression: a hostile evidenceRequirements element with a throwing toString must not
// crash normalize via the droppedEvidence warning interpolation.
let normalizedThrowingEvidence = true;
try {
  const throwingKind = { toString() { throw new Error('boom'); } };
  const c = M.normalizeCandidate({ title: 'hostile evidence', proposedRule: { canonicalRuleKey: 'polish/hostile-ev', findingClass: 'polish', severity: 'minor', evidenceRequirements: [throwingKind] } }, norm);
  ok(Array.isArray(c.normalizationWarnings), 'a throwing evidence kind coerces safely in the warning (totality)');
} catch (_e) { normalizedThrowingEvidence = false; }
ok(normalizedThrowingEvidence, 'normalizeCandidate does not throw on a hostile evidenceRequirements value');

// --- deriveMeasuredCandidates: deterministic strengthen from a fixture log -----
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mine-test-'));
const logPath = path.join(tmp, 'audit.jsonl');
const line = (rule, n) => Array.from({ length: n }, () => JSON.stringify({ v: 1, utc: '2026-08-22T10:00:00Z', findings: [{ rule, severity: 'minor', lens: 'polish' }] })).join('\n');
fs.writeFileSync(logPath, line('polish.tabular-nums', 6) + '\n');
const prevEnv = process.env.SIDECOACH_AUDIT_HISTORY;
process.env.SIDECOACH_AUDIT_HISTORY = logPath;
const corpusM = M.assembleCorpus({ beatsDir: tmp, registry: reg, guidance });
const measured = M.deriveMeasuredCandidates(corpusM, reg);
ok(measured.length === 1 && measured[0].proposedRule.ruleId === 'polish.tabular-nums', 'measured signal proposes a strengthen for a frequently-firing non-blocking rule');
ok(measured[0].sourceKind === 'measured-audit-history' && measured[0].forceStrengthen === true, 'measured candidate is tagged measured + forceStrengthen');

// --- assembleCorpus tagging ---------------------------------------------------
ok(corpusM.entries.every((e) => typeof e.sourceKind === 'string'), 'every corpus entry carries a sourceKind tag');
ok(['beat', 'measured-audit-history', 'expert-external', 'rule-store-for-dedup'].every((k) => k in corpusM.sources), 'corpus.sources holds all four sourceKinds');
if (prevEnv === undefined) delete process.env.SIDECOACH_AUDIT_HISTORY; else process.env.SIDECOACH_AUDIT_HISTORY = prevEnv;

// --- runPipeline dry-run over the representative fixture (writes nothing) ------
const fixture = path.resolve(__dirname, 'fixtures', 'findings-representative.json');
const beforeProposed = safeList(path.resolve(__dirname, '..', '..', 'data', 'proposed-rules'));
// HERMETIC: pin the audit-history to a nonexistent file so this dry-run counts ONLY the fixture's
// candidates. Without this it reads the real, mutable data/audit-history.jsonl, which a CONCURRENT
// scheduled miner can grow mid-suite - crossing rules' fire thresholds and inflating the measured
// strengthen count (a test-isolation bug, not a code bug). The counts below describe fixture-only.
const _prevAH = process.env.SIDECOACH_AUDIT_HISTORY;
process.env.SIDECOACH_AUDIT_HISTORY = path.join(tmp, 'no-such-audit-history.jsonl');
const summary = M.runPipeline({ findings: fixture, dryRun: true, beatsDir: tmp });
if (_prevAH === undefined) delete process.env.SIDECOACH_AUDIT_HISTORY; else process.env.SIDECOACH_AUDIT_HISTORY = _prevAH;
// focus-ring (net-new), one-accent (net-new, resembles guidance), malformed (net-new, preflight-fail);
// gradient-text@blocker (strengthen); gradient-text@major (duplicate, dropped).
eq(summary.counts.netNew, 3, 'dry-run: 3 net-new (incl. the guidance-resemblance and the malformed)');
eq(summary.counts.strengthenExisting, 1, 'dry-run: 1 strengthen-existing (the severity change)');
eq(summary.counts.duplicateDropped, 1, 'dry-run: 1 duplicate dropped (same-severity restatement)');
eq(summary.counts.preflightFailed, 1, 'dry-run: 1 pre-flight failure (filed, not dropped)');
const afterProposed = safeList(path.resolve(__dirname, '..', '..', 'data', 'proposed-rules'));
eq(JSON.stringify(afterProposed), JSON.stringify(beforeProposed), 'dry-run wrote nothing to the real quarantine');

function safeList(dir) { try { return fs.readdirSync(dir).sort(); } catch (_e) { return []; } }
try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

// ============================================================================
// PHASE 3a: patternSpec + exampleCorpus carry-through, preflight screen, freeze
// ============================================================================
const POS_1 = path.resolve(__dirname, 'fixtures', 'patternspec-examples', 'pos-1.html');
const NEG_1 = path.resolve(__dirname, 'fixtures', 'patternspec-examples', 'neg-1.html');

const goodSpec = {
  specVersion: 1,
  engine: 'static-css-regex',
  applicability: { anyOf: ['transition\\s*:', 'animation\\s*:'], scope: 'css' },
  defect: { anyOf: [{ pattern: 'cubic-bezier\\([^)]*\\)', flags: 'i' }], numericGuard: { predicateId: 'cubic-bezier-overshoot', threshold: 0.1 } },
  message: 'bounce/elastic overshoot easing',
  evidenceScope: 'css',
};
const goodCorpus = {
  positives: [{ id: 'p1', file: POS_1, label: 'fires', labeledBy: 'codex', split: 'tune', provenance: { source: 'fixture' } }],
  negatives: [{ id: 'n1', file: NEG_1, label: 'clean', labeledBy: 'codex', split: 'heldout', provenance: { source: 'fixture' } }],
};

// carry-through: normalizeCandidate copies patternSpec + exampleCorpus onto the def.
const specCand = M.normalizeCandidate({
  title: 'Bounce overshoot', sourceKind: 'expert-external', confidence: 'medium',
  proposedRule: { canonicalRuleKey: 'mined/bounce-overshoot', findingClass: 'anti-pattern', severity: 'minor', evidenceRequirements: ['css-rule'], scope: 'file', patternSpec: goodSpec, exampleCorpus: goodCorpus },
}, norm);
ok(specCand.def.patternSpec && specCand.def.patternSpec.engine === 'static-css-regex', 'normalizeCandidate carries patternSpec onto the def');
ok(specCand.def.exampleCorpus && Array.isArray(specCand.def.exampleCorpus.positives), 'normalizeCandidate carries exampleCorpus onto the def');

// freezeExampleCorpus: valid corpus -> frozen records with content sha + recordHash.
const fr = M.freezeExampleCorpus(goodCorpus);
eq(fr.errors.length, 0, 'freezeExampleCorpus over readable files reports no errors');
ok(fr.frozen.positives.length === 1 && /^[0-9a-f]{64}$/.test(fr.frozen.positives[0].contentSha256), 'frozen positive carries a real content sha256');
ok(/^[0-9a-f]{64}$/.test(fr.frozen.positives[0].recordHash), 'frozen positive carries a canonical recordHash');
// a missing file is FILED as an error, never thrown/dropped.
const frBad = M.freezeExampleCorpus({ positives: [{ id: 'x', file: '/no/such/file-xyz.html', label: 'fires', labeledBy: 'codex', split: 'tune' }], negatives: [] });
ok(frBad.errors.some((e) => e.includes('unreadable')), 'freezeExampleCorpus files a missing example file as an error (not a throw)');

// preflight: a good spec passes AND carries a frozen corpus; a bad regex / bad predicate is FILED.
const preGood = M.preflight(specCand, M.classify(specCand, dedup), reg, baseSet);
eq(preGood.ok, true, 'a valid patternSpec + readable corpus passes preflight');
ok(preGood.frozenCorpus && preGood.frozenCorpus.positives.length === 1, 'preflight attaches the frozen corpus');
ok(preGood.spec && preGood.spec.ok === true, 'preflight records the spec screen result');

const badRegexCand = M.normalizeCandidate({
  title: 'Bad regex', sourceKind: 'speculative', confidence: 'low',
  proposedRule: { canonicalRuleKey: 'mined/bad-regex', findingClass: 'polish', severity: 'minor', evidenceRequirements: ['css-rule'], patternSpec: { specVersion: 1, engine: 'static-css-regex', applicability: { anyOf: ['transition\\s*:'], scope: 'css' }, defect: { anyOf: [{ pattern: '(a+)+$' }] }, message: 'unsafe' } },
}, norm);
const preBadRegex = M.preflight(badRegexCand, M.classify(badRegexCand, dedup), reg, baseSet);
eq(preBadRegex.ok, false, 'a candidate with a catastrophic-backtrack defect regex FAILS preflight (filed, not dropped)');
ok(preBadRegex.errors.some((e) => /unsafe regex|star-height|backtracking/i.test(e)), 'bad-regex preflight error names the ReDoS screen rejection');

const badPredCand = M.normalizeCandidate({
  title: 'Bad predicate', sourceKind: 'speculative', confidence: 'low',
  proposedRule: { canonicalRuleKey: 'mined/bad-predicate', findingClass: 'polish', severity: 'minor', evidenceRequirements: ['css-rule'], patternSpec: { specVersion: 1, engine: 'static-css-regex', applicability: { anyOf: ['transition\\s*:'], scope: 'css' }, defect: { anyOf: [{ pattern: 'cubic-bezier\\([^)]*\\)' }], numericGuard: { predicateId: 'nope-not-real', threshold: 1 } }, message: 'bad pred' } },
}, norm);
const preBadPred = M.preflight(badPredCand, M.classify(badPredCand, dedup), reg, baseSet);
eq(preBadPred.ok, false, 'a candidate whose numericGuard names an unknown predicate FAILS preflight (filed, not dropped)');
ok(preBadPred.errors.some((e) => /allowlist|predicateId/i.test(e)), 'bad-predicate preflight error names the predicate allowlist');

// Fold 2: a spec with a malformed flags value is FILED (never silently dropped -> would be a
// false pass at runtime). An unsupported char 'g' and a non-string 123 are both rejected.
const badFlagsCand = M.normalizeCandidate({
  title: 'Bad flags', sourceKind: 'speculative', confidence: 'low',
  proposedRule: { canonicalRuleKey: 'mined/bad-flags', findingClass: 'polish', severity: 'minor', evidenceRequirements: ['css-rule'], patternSpec: { specVersion: 1, engine: 'static-css-regex', applicability: { anyOf: ['transition\\s*:'], scope: 'css' }, defect: { anyOf: [{ pattern: 'cubic-bezier\\([^)]*\\)', flags: 'g' }] }, message: 'bad flags' } },
}, norm);
const preBadFlags = M.preflight(badFlagsCand, M.classify(badFlagsCand, dedup), reg, baseSet);
eq(preBadFlags.ok, false, 'a candidate with an unsupported flag char (g) FAILS preflight (filed, not silently dropped)');
ok(preBadFlags.errors.some((e) => /unsupported regex flag|flags must be a string/i.test(e)), 'bad-flags preflight error names the flag rejection');
const badFlagsNumCand = M.normalizeCandidate({
  title: 'Non-string flags', sourceKind: 'speculative', confidence: 'low',
  proposedRule: { canonicalRuleKey: 'mined/bad-flags-num', findingClass: 'polish', severity: 'minor', evidenceRequirements: ['css-rule'], patternSpec: { specVersion: 1, engine: 'static-css-regex', applicability: { anyOf: ['transition\\s*:'], scope: 'css' }, defect: { anyOf: [{ pattern: 'cubic-bezier\\([^)]*\\)', flags: 123 }] }, message: 'non-string flags' } },
}, norm);
const preBadFlagsNum = M.preflight(badFlagsNumCand, M.classify(badFlagsNumCand, dedup), reg, baseSet);
eq(preBadFlagsNum.ok, false, 'a candidate with a non-string flags value FAILS preflight');
ok(preBadFlagsNum.errors.some((e) => /flags must be a string/i.test(e)), 'non-string-flags preflight error names the rejection');

// full runPipeline over the committed fixture, written to a TEMP quarantine (never the real one).
const mtmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mine-p3-'));
const fixtureP3 = path.resolve(__dirname, 'fixtures', 'findings-patternspec.json');
M.runPipeline({ findings: fixtureP3, proposedDir: path.join(mtmp, 'proposed'), candidatesFile: path.join(mtmp, 'candidates.json'), beatsDir: tmp, beatOutDir: path.join(mtmp, 'beats'), date: '2026-08-24' });
const goodRec = JSON.parse(fs.readFileSync(path.join(mtmp, 'proposed', 'mined.bounce-easing-overshoot.json'), 'utf8'));
ok(goodRec.rule.patternSpec && goodRec.rule.patternSpec.engine === 'static-css-regex', 'quarantine JSON carries a valid patternSpec on rule');
ok(goodRec.frozenCorpus && goodRec.frozenCorpus.positives[0].recordHash && goodRec.frozenCorpus.negatives[0].recordHash, 'quarantine JSON carries a frozen corpus (recordHash per example)');
eq(goodRec.preflight.ok, true, 'the well-formed spec candidate preflights clean in the quarantine');
const badRegexRec = JSON.parse(fs.readFileSync(path.join(mtmp, 'proposed', 'mined.bad-regex-demo.json'), 'utf8'));
eq(badRegexRec.preflight.ok, false, 'the bad-regex candidate is FILED in the quarantine with preflight.ok false');
ok(badRegexRec.preflight.errors.some((e) => /unsafe regex|star-height|backtracking/i.test(e)), 'quarantined bad-regex record names the screen rejection');
try { fs.rmSync(mtmp, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }

// --- report (async tail: corpus-tool parity uses a dynamic import) ------------
(async () => {
  // REUSE PARITY: the miner's example-corpus freeze must produce the SAME recordHash as
  // eval/corpus-tool.mjs canonicalRecord/recordHash for an equivalent case. corpus-tool is ESM and
  // the miner is sync CJS, so the freeze MIRRORS those two pure functions and this test pins the
  // mirror to the source (a drift in either breaks this assertion).
  try {
    const { pathToFileURL } = require('url');
    const CT = await import(pathToFileURL(path.resolve(__dirname, '..', '..', 'eval', 'corpus-tool.mjs')).href);
    const sha = 'a'.repeat(64);
    const ref = { id: 'x1', file: 'foo.html', label: 'fires', labeledBy: 'codex', split: 'tune', provenance: { source: 's' } };
    const mineHash = M.recordHashOf(M.canonicalExampleRecord(ref, sha));
    const ctCase = { id: 'x1', split: 'tune', file: 'foo.html', provenance: { source: 's' }, labels: [{ class: 'fires', labeledBy: 'codex' }] };
    const ctHash = CT.recordHash(CT.canonicalRecord(ctCase, sha));
    ok(mineHash === ctHash, 'miner freeze recordHash mirrors corpus-tool canonicalRecord/recordHash EXACTLY');
  } catch (e) {
    failures.push('corpus-tool parity check could not run: ' + (e && e.message ? e.message : String(e)));
  }

  if (failures.length) {
    process.stderr.write(`sidecoach-mine.test: ${passed} passed, ${failures.length} FAILED\n`);
    for (const f of failures) process.stderr.write(`  x ${f}\n`);
    process.exit(1);
  }
  process.stdout.write(`sidecoach-mine.test: all ${passed} assertions passed\n`);
  process.exit(0);
})();
