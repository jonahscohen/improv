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
const summary = M.runPipeline({ findings: fixture, dryRun: true, beatsDir: tmp });
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

// --- report -------------------------------------------------------------------
if (failures.length) {
  process.stderr.write(`sidecoach-mine.test: ${passed} passed, ${failures.length} FAILED\n`);
  for (const f of failures) process.stderr.write(`  x ${f}\n`);
  process.exit(1);
}
process.stdout.write(`sidecoach-mine.test: all ${passed} assertions passed\n`);
process.exit(0);
