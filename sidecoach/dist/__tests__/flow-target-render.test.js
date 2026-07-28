"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// THE FLOW SURFACE MUST ACTUALLY LOOK AT THE TARGET.
//
// Regression cover for a measured live defect (2026-07-28). Driving the documented invocation
// `sidecoach-monitor "/sidecoach <verb> <target>" --json` against two maximally different local
// targets - a 0-byte file, and a page carrying a skipped heading, 6px text, near-white text on
// white, a broken image and 160 buzzwords - produced BYTE-IDENTICAL output. The only differences
// in the whole JSON were startTime, endTime, generatedAt, reportId and one millisecond of
// executionDuration. All 20 verbs behaved this way for path, file and directory targets.
//
// Three separate defects produced that result, and this suite covers all three:
//
//   1. ONLY A URL RENDERED. The audit read path was gated on looksLikeUrl(target), so a file,
//      path or directory target silently skipped the render and fell through to the guidance
//      chain, which emitted a confident grade for a page nobody had scanned. There was no
//      warning that nothing had been looked at.
//   2. A FLOW GRADING ITS OWN GUIDANCE TEXT. `performance:has_optimization_guidance` was a
//      permanent BLOCKING finding. It asks "does my own result.guidance contain the word
//      optimize?" - a handler self-check, not a defect in the user's design. The rendered
//      report then told the user to "resolve the performance:has optimization guidance issue
//      on the affected element" when there was no affected element.
//   3. A METRIC THAT FIRES WHEN IT REACHES ITS TARGET. `domains-needs-testing = 7 (target 7)`
//      was a permanent warning. All 7 domains are constructed with a hard-coded
//      complianceStatus of 'needs_testing', so the count is the constant 7 on every run and
//      for every target - it never measured anything.
//
// THE ACCEPTANCE BAR (the lead's, reproduced here): two maximally different targets must
// produce MATERIALLY DIFFERENT output, and a catastrophic page must grade WORSE than a clean
// one. Differing output is necessary but not sufficient, so the catastrophic assertions are
// pinned to the objective detectors' known-good ground truth: skipped-heading and broken-image
// score P 1.000 / R 1.000 on 89 held-out real pages, so a flow that renders a page containing
// both and reports neither is still broken no matter how different its output looks.
//
// These fixtures are the acceptance bar, NOT the evidence that detection generalizes. The
// held-out evidence is a separate 38-page cross-check against the corpus in
// eval/corpus/buzzword-heldout, recorded in the session beat - a previous unit found taste
// detectors whose precision collapses from 0.839 on their tuning set to 0.304 held out, so
// fixture agreement is deliberately not claimed as generalization here.
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
const audit_rendered_1 = require("../audit-rendered");
const build_report_aggregator_1 = require("../build-report-aggregator");
const flow_memory_schema_1 = require("../flow-memory-schema");
const flow_prerequisites_1 = require("../flow-prerequisites");
const flow_domain_validators_1 = require("../flow-domain-validators");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const present = require(path.join(__dirname, '..', '..', 'bin', 'sidecoach-present'));
let passed = 0;
const check = (label, cond) => {
    if (!cond)
        throw new Error(`FAIL: ${label}`);
    passed++;
    console.log(`PASS ${label}`);
};
// --- BROWSER-DEPENDENT ASSERTION ACCOUNTING (Codex review 2026-07-28, Medium) ------------
// The acceptance layer used to `return` early on a Chromium launch failure and the suite then
// printed `${passed}/${passed} passed` - a ratio that is 100% BY CONSTRUCTION and can never
// report a shortfall. On any machine without Chromium the entire point of this suite silently
// stopped being tested while the suite still exited 0 as green proof.
//
// Every assertion that needs a real render now goes through `bcheck` instead of `check`, and
// the count is DECLARED below. When the browser is missing each one is reported individually
// as SKIP and reconciled against that declared total, so the summary states an honest
// expected-versus-actual instead of a vacuous ratio. If a bcheck is added or removed without
// updating the constant, the reconciliation fails loudly rather than drifting.
const BROWSER_ASSERTION_COUNT = 34;
// Populated as groups are ACTUALLY skipped. Codex review 2026-07-28 (e): the earlier version
// printed a static list of every group whenever ANY skip occurred, so a run that skipped only
// the 2-assertion contrast case still reported all 34 as skipped - a report that overstated the
// damage is no more honest than one that understates it.
const skippedGroups = [];
let browserAssertionsRun = 0;
let browserAssertionsSkipped = 0;
// Set by the acceptance layer when Chromium cannot launch, so every LATER browser-dependent
// layer stands down too. Before this, brokenImageShapes had no guard at all and would have
// hard-failed on a browserless machine - a missing browser reported as a broken fix.
let browserUnavailable = false;
const bcheck = (label, cond) => {
    browserAssertionsRun++;
    check(label, cond);
};
const bskip = (group, count, reason) => {
    browserAssertionsSkipped += count;
    skippedGroups.push(group);
    console.log(`SKIP [browser] ${group} - ${reason}`);
};
const FIX = path.resolve(__dirname, '../../fixtures/flow-target-render');
const REPO = path.resolve(__dirname, '../..');
const stripAnsi = (s) => String(s ?? '').replace(/\x1b\[[0-9;]*m/g, '');
// ---------------------------------------------------------------------------
// Layer 1 - target resolution (pure, no browser).
// MUTATION: making any unrenderable branch return `renderable: true` fails the fail-loud
// assertions below; deleting the directory entry-document probe fails the directory case.
// ---------------------------------------------------------------------------
async function targetResolution() {
    const file = (0, audit_rendered_1.resolveAuditTarget)(path.join(FIX, 'clean.html'));
    check('resolve: an .html file is renderable', file.renderable === true);
    check('resolve: .html file resolves to a file:// URL', file.renderable && file.renderUrl.startsWith('file://'));
    check('resolve: .html file reports kind=file', file.renderable && file.kind === 'file');
    const dir = (0, audit_rendered_1.resolveAuditTarget)(path.join(FIX, 'site-with-index'));
    check('resolve: a directory with index.html is renderable', dir.renderable === true);
    check('resolve: directory resolves to its entry document', dir.renderable && /site-with-index\/index\.html$/.test(dir.resolvedPath || ''));
    check('resolve: directory reports kind=directory', dir.renderable && dir.kind === 'directory');
    // FAIL-LOUD: each of these was silently graded B before. An error is the correct answer.
    const noIndex = (0, audit_rendered_1.resolveAuditTarget)(path.join(FIX, 'dir-without-index'));
    check('resolve: directory without an entry document is UNRENDERABLE', noIndex.renderable === false);
    check('resolve: no-entry-document reports its kind', !noIndex.renderable && noIndex.kind === 'no-entry-document');
    check('resolve: no-entry-document names what it looked for', !noIndex.renderable && noIndex.reason.includes('index.html'));
    const missing = (0, audit_rendered_1.resolveAuditTarget)(path.join(FIX, 'nope-does-not-exist.html'));
    check('resolve: a missing path is UNRENDERABLE', missing.renderable === false);
    check('resolve: missing path reports its kind', !missing.renderable && missing.kind === 'missing');
    const source = (0, audit_rendered_1.resolveAuditTarget)(path.join(REPO, 'src/audit-rendered.ts'));
    check('resolve: a source file is UNRENDERABLE', source.renderable === false);
    check('resolve: source file reports its kind', !source.renderable && source.kind === 'unsupported-file');
    const bare = (0, audit_rendered_1.resolveAuditTarget)('SomeComponentName');
    check('resolve: a bare component name is UNRENDERABLE', bare.renderable === false);
    // URL behaviour is unchanged - the pre-existing read path must not regress.
    const url = (0, audit_rendered_1.resolveAuditTarget)('http://localhost:4830/page');
    check('resolve: a URL is still renderable', url.renderable === true && url.kind === 'url');
    check('resolve: URL keeps its own scheme', url.renderable && url.renderUrl === 'http://localhost:4830/page');
    const bareHost = (0, audit_rendered_1.resolveAuditTarget)('localhost:3000');
    check('resolve: a bare host still normalizes to http://', bareHost.renderable && bareHost.renderUrl === 'http://localhost:3000');
    // file:// targets are covered by their own layer below - they must clear the SAME stat +
    // extension gate as a plain path, so "renderable as-is" is exactly the behaviour that was wrong.
    // Every unrenderable answer must carry a remedy - "this failed" with no next step is
    // exactly the dead end that made silently-grading feel preferable in the first place.
    for (const r of [noIndex, missing, source, bare]) {
        check(`resolve: unrenderable "${r.kind}" carries a remedy`, !r.renderable && r.remedy.length > 10);
    }
}
// ---------------------------------------------------------------------------
// Layer 2 - a flow's self-check must not become a finding or a grade about the user's page.
// MUTATION: deleting either `measures === 'flow-output'` skip in build-report-aggregator.ts
// resurrects the constant finding / the constant F domain grade and fails these.
// ---------------------------------------------------------------------------
async function selfCheckSuppression() {
    const withSelfCheck = (measures) => ({
        flowId: 'flowJ_tactical_polish',
        flowName: 'tactical polish',
        status: 'success',
        message: 'ok',
        guidance: [],
        checklist: [],
        validationResults: [
            { domain: 'performance', status: 'fail', passedRules: ['has_performance_metrics'], failedRules: ['has_optimization_guidance'], message: 'Domain validation: 1/2 rules passed', measures },
        ],
    });
    const suppressed = (0, build_report_aggregator_1.generateBuildReport)({ source: 'flow-results', flowResults: [withSelfCheck('flow-output')] });
    const leaked = suppressed.findings.filter((f) => f.rule.includes('has_optimization_guidance'));
    check('self-check: a flow-output validator emits NO finding', leaked.length === 0);
    check('self-check: a flow-output validator contributes NO domain grade', !suppressed.domainGrades.some((g) => g.domain === 'performance'));
    // The suppression must be NARROW. A validator that measured real content still reports -
    // otherwise this fix trades a false positive for a false negative, which is worse.
    const artifact = (0, build_report_aggregator_1.generateBuildReport)({ source: 'flow-results', flowResults: [withSelfCheck('artifact')] });
    check('self-check: an artifact validator STILL emits its finding', artifact.findings.some((f) => f.rule.includes('has_optimization_guidance')));
    check('self-check: an artifact validator STILL contributes a domain grade', artifact.domainGrades.some((g) => g.domain === 'performance'));
    // UNSET IS NOW SUPPRESSED, and this assertion is DELIBERATELY INVERTED from what it asserted
    // when this suite landed. It used to read "an undeclared validator keeps reporting (no silent
    // drop)" on the reasoning that the five real artifact validators never set the field, so
    // dropping undeclared results would trade a false positive for a false negative.
    //
    // Codex review 2026-07-28 (item 7) showed that reasoning left the discriminator unsafe in
    // BOTH directions at once - the factory defaulted to 'flow-output' (silently suppressing a
    // factory-built validator that forgot the flag) while hand-built results defaulted to
    // reporting. The fix is to make ONE direction safe and close the other by construction: an
    // undeclared validator is suppressed, and those five validators now declare
    // `measures: 'artifact'` at their source, which `measuresIsSafeByDefault` asserts directly.
    const unset = (0, build_report_aggregator_1.generateBuildReport)({ source: 'flow-results', flowResults: [withSelfCheck(undefined)] });
    check('self-check: an UNDECLARED validator is suppressed (safe by default)', !unset.findings.some((f) => f.rule.includes('has_optimization_guidance')));
}
// ---------------------------------------------------------------------------
// Layer 2b - a metric that COUNTS PROBLEMS must not report one when there are none.
// This is the third instance of the same defect class, found while fixing the two named ones:
// `violation-count` was declared 'warning' unconditionally, so a zero-violation run still
// emitted "violation-count = 0" as a warning finding.
// MUTATION: reverting countMetricStatus to `return severityWhenNonZero` (or hard-coding
// 'warning' back at the call site) fails the zero cases here.
// ---------------------------------------------------------------------------
async function countMetrics() {
    check('count-metric: zero problems -> pass (no finding)', (0, flow_memory_schema_1.countMetricStatus)(0) === 'pass');
    check('count-metric: zero problems -> pass even when severity is fail', (0, flow_memory_schema_1.countMetricStatus)(0, 'fail') === 'pass');
    check('count-metric: one problem -> warning', (0, flow_memory_schema_1.countMetricStatus)(1) === 'warning');
    check('count-metric: many problems -> warning', (0, flow_memory_schema_1.countMetricStatus)(9) === 'warning');
    check('count-metric: one problem at fail severity -> fail', (0, flow_memory_schema_1.countMetricStatus)(1, 'fail') === 'fail');
    // ...and the aggregator must honour that: a 'pass' metric produces no finding, a 'warning'
    // one does. This is the wiring the derivation depends on.
    const withMetric = (value, status) => ({
        flowId: 'flowJ_tactical_polish',
        flowName: 'tactical polish',
        status: 'success',
        message: 'ok',
        guidance: [],
        checklist: [],
        memory: { flowId: 'flowJ_tactical_polish', metrics: [{ name: 'violation-count', value, status }], validationResults: [], gates: [] },
    });
    const zero = (0, build_report_aggregator_1.generateBuildReport)({ source: 'flow-results', flowResults: [withMetric(0, (0, flow_memory_schema_1.countMetricStatus)(0))] });
    check('count-metric: a zero-violation run emits NO violation-count finding', !zero.findings.some((f) => f.rule === 'violation-count'));
    const nine = (0, build_report_aggregator_1.generateBuildReport)({ source: 'flow-results', flowResults: [withMetric(9, (0, flow_memory_schema_1.countMetricStatus)(9))] });
    check('count-metric: a nine-violation run STILL emits the violation-count finding', nine.findings.some((f) => f.rule === 'violation-count'));
}
// ---------------------------------------------------------------------------
// Layer 3 - THE ACCEPTANCE BAR. Real engine, real render, the fixture pair.
// MUTATION: reverting the orchestrator gate to `looksLikeUrl(commandMatch.target)` makes both
// targets fall through to the guidance chain again and every assertion here fails.
// ---------------------------------------------------------------------------
async function acceptanceBar() {
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    const audit = async (target) => engine.process(`/sidecoach audit ${target}`, { projectPath: REPO });
    const clean = await audit(path.join(FIX, 'clean.html'));
    // BROWSER AVAILABILITY. This suite is `required` in run-tests.ts, and the repo's stated
    // convention is that a real-browser suite SKIPs gracefully on a cacheless machine rather
    // than hard-failing (run-tests.ts, PLAYWRIGHT_BROWSERS_PATH block). Codex review 2026-07-28
    // (Medium): this suite hard-failed at "clean file target RENDERED" where Chromium could not
    // launch, which reports a missing browser as a broken fix.
    //
    // The skip is DELIBERATELY NARROW. Only the render-dependent layer is skipped; layers 1, 2,
    // 2b and 3b are pure and always run, so the resolver, the self-check suppression, the count
    // metrics and the constant-finding regression stay covered on every machine. And the skip is
    // gated on a LAUNCH failure specifically - a page that renders and simply finds nothing is
    // not a skip, it is a failure, which is the whole point of the suite.
    const ca0 = clean.audit || {};
    const launchFailed = ca0.rendered !== true
        && (ca0.unavailableReasons || []).some((r) => /launch|executable|Permission denied|browserType|spawn|ENOENT/i.test(r));
    if (launchFailed) {
        // Codex review 2026-07-28 (Medium): this used to be a bare `return` and the suite then
        // printed a vacuous `${passed}/${passed} passed`. Each skipped GROUP is now reported by
        // name and counted, and run() reconciles the total against BROWSER_ASSERTION_COUNT, so a
        // browserless run states an honest expected-versus-actual instead of reading as green.
        const reason = (ca0.unavailableReasons || []).join('; ') || 'Chromium could not launch';
        browserUnavailable = true;
        console.log(`SKIP flow-target-render browser layer: ${reason}`);
        bskip('file render (3)', 3, reason);
        bskip('directory render (4)', 4, reason);
        bskip('clean-vs-catastrophic differential (5)', 5, reason);
        bskip('grade ordering (4)', 4, reason);
        bskip('objective ground truth (4)', 4, reason);
        bskip('constant-finding regression (4)', 4, reason);
        bskip('0-byte inconclusive behaviour (3)', 3, reason);
        bskip('payload non-identity (1)', 1, reason);
        bskip('broken-image shapes (4)', 4, reason);
        console.log('NOT skipped (ran, and still run below): target resolution, file:// gate, self-check');
        console.log('suppression, measures-default, count metrics, panel suppression, non-audit fail-closed,');
        console.log('prerequisite rendering, human-surface filtering, non-page chain, fail-loud.');
        return;
    }
    const broken = await audit(path.join(FIX, 'catastrophic.html'));
    const empty = await audit(path.join(FIX, 'empty.html'));
    // Codex review 2026-07-28 (Medium): directory rendering was only covered at resolver level,
    // so the end-to-end claim "file AND directory targets render" was not actually tested.
    const dir = await audit(path.join(FIX, 'site-with-index'));
    const ca = clean.audit || {};
    const ba = broken.audit || {};
    const ea = empty.audit || {};
    const da = dir.audit || {};
    // 1. The render actually happened for a FILE target - the whole defect.
    bcheck('acceptance: clean file target RENDERED', ca.rendered === true);
    bcheck('acceptance: catastrophic file target RENDERED', ba.rendered === true);
    bcheck('acceptance: the rendered document is named in the result', typeof ba.renderedDocument === 'string' && ba.renderedDocument.endsWith('catastrophic.html'));
    // 1b. And for a DIRECTORY target, end to end through the real engine.
    bcheck('acceptance: directory target RENDERED', da.rendered === true);
    bcheck('acceptance: directory reports which entry document it read', typeof da.renderedDocument === 'string' && da.renderedDocument.endsWith('site-with-index/index.html'));
    bcheck('acceptance: directory target reports kind=directory', da.targetKind === 'directory');
    bcheck('acceptance: directory of the catastrophic page grades F like the file does', da.grade === 'F');
    // 2. MATERIALLY DIFFERENT output for maximally different targets.
    bcheck('acceptance: catastrophic produces findings', ba.totalFindings > 0);
    bcheck('acceptance: clean produces zero findings', ca.totalFindings === 0);
    bcheck('acceptance: the two verdicts differ', ca.verdict !== ba.verdict);
    bcheck('acceptance: clean verdict is clean', ca.verdict === 'clean');
    bcheck('acceptance: catastrophic verdict is blocked', ba.verdict === 'blocked');
    // 3. The catastrophic page GRADES WORSE than the clean one. A per-verb constant is not a grade.
    const rank = (g) => 'ABCDF'.indexOf(g);
    bcheck('acceptance: both targets carry a grade', typeof ca.grade === 'string' && typeof ba.grade === 'string');
    bcheck(`acceptance: catastrophic (${ba.grade}) grades WORSE than clean (${ca.grade})`, rank(ba.grade) > rank(ca.grade));
    bcheck('acceptance: clean grades A', ca.grade === 'A');
    bcheck('acceptance: catastrophic grades F', ba.grade === 'F');
    // 4. GROUND TRUTH. Pinned to the two objective detectors measured at P 1.000 / R 1.000 on
    // 89 held-out real pages. Rendering the page and reporting neither is still broken.
    const rules = new Set((ba.byRule || []).map((r) => r.rule));
    bcheck('ground truth: skipped-heading (h1 -> h4) is reported', rules.has('skipped-heading'));
    bcheck('ground truth: broken-image (empty src) is reported', rules.has('broken-image'));
    bcheck('ground truth: low-contrast (near-white on white) is reported', rules.has('low-contrast'));
    bcheck('ground truth: the clean page reports NONE of them', !['skipped-heading', 'broken-image', 'low-contrast'].some((r) => (ca.byRule || []).some((x) => x.rule === r)));
    // 5. THE TWO CONSTANT FINDINGS ARE GONE from the real shipped output.
    // MUTATION: reverting domains-needs-testing to 'warning' resurrects the second one.
    for (const [name, res] of [['clean', clean], ['catastrophic', broken]]) {
        const blob = JSON.stringify(res);
        bcheck(`constants: "${name}" output contains no has_optimization_guidance finding`, !blob.includes('has_optimization_guidance'));
        bcheck(`constants: "${name}" output contains no domains-needs-testing finding`, !blob.includes('domains-needs-testing'));
    }
    // 6. A 0-byte file is INCONCLUSIVE, never clean and never graded (yesterday's guard, which
    // this render path now actually reaches for a local file).
    bcheck('acceptance: a 0-byte file is inconclusive', ea.verdict === 'inconclusive');
    bcheck('acceptance: a 0-byte file is NOT success', empty.success === false);
    bcheck('acceptance: a 0-byte file gets NO build report', !empty.buildReport);
    // 7. The proof the original measurement used: the two payloads are not the same bytes.
    const strip = (r) => JSON.stringify(r)
        .replace(/"(startTime|endTime|generatedAt|reportId|timestamp|executionDuration)":("[^"]*"|\d+)/g, '')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '');
    bcheck('acceptance: clean and catastrophic payloads are NOT byte-identical once timers are stripped', strip(clean) !== strip(broken));
}
// ---------------------------------------------------------------------------
// Layer 3b - the constant findings are gone from the GUIDANCE-CHAIN path too.
//
// This layer exists because the first version of the "constants are gone" assertion was
// VACUOUS. It only inspected the rendered-audit payload, and the rendered audit bypasses the
// flow chain entirely - so flowI_accessibility (the only emitter of domains-needs-testing)
// never ran there, and reverting that metric to a permanent 'warning' still passed. That is
// the same mutation-coverage mistake the empty-render guard hit on 2026-07-28 (Codex F14):
// a mutation proof is only as good as the region it mutates.
//
// `/sidecoach audit` with NO target is the shape that DOES route through the chain, so it is
// the shape that can observe the metric. The flow-ran assertion below is the non-vacuity
// guard: if flowI ever stops running here, this layer fails loudly rather than passing for
// the wrong reason.
// MUTATION: reverting domains-needs-testing to 'warning' fails this layer.
// ---------------------------------------------------------------------------
async function constantsGoneFromChain() {
    // SEED THE PREREQUISITE so flowI_accessibility genuinely RUNS in every environment.
    //
    // This is the other half of the Codex item-6 finding, and the more important half. Tightening
    // the guard from "flowI is present" to "flowI succeeded" made the layer FAIL under an isolated
    // HOME - which is exactly the environment `npm test` uses (run-tests.ts mkdtemps a throwaway
    // HOME). flowI requires flowG_component_implementation, so with no prior history it was
    // recorded as `status: error - prerequisites not met`, its emitter never ran, and every
    // "the constant finding is gone" assertion below was passing for the wrong reason on CI while
    // passing for the RIGHT reason only on a developer machine with warm history. Detecting that
    // vacuity is not enough; seeding the prerequisite removes it, so the layer measures the same
    // thing everywhere.
    // BOTH prerequisites are seeded, not just flowI's. Codex review 2026-07-28 (Low): seeding only
    // flowG left the layer HALF vacuous - the `/sidecoach audit` chain is flowK then flowI, and
    // flowK requires flowJ_tactical_polish, so flowK never succeeded, its domain validators never
    // attached, and the assertions that the `has_optimization_guidance` leak is gone FROM THE LIVE
    // CHAIN proved nothing about flowK. The synthetic suppression tests in layer 2 were carrying
    // the whole claim. Seeding flowJ as well makes both chain flows execute for real.
    const { getFlowHistory: seedHistory } = require('../flow-history');
    for (const [flowId, flowName, why] of [
        ['flowG_component_implementation', 'component implementation', 'so flowI_accessibility can execute'],
        ['flowJ_tactical_polish', 'tactical polish', 'so flowK_multi_lens_audit can execute'],
    ]) {
        seedHistory().recordFlow({ flowId, flowName, status: 'success', message: `seeded by flow-target-render ${why}` });
    }
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    const res = await engine.process('/sidecoach audit', { projectPath: REPO });
    const flowI = (res.flowResults || []).find((f) => f.flowId === 'flowI_accessibility');
    const flowK = (res.flowResults || []).find((f) => f.flowId === 'flowK_multi_lens_audit');
    check(`chain: flowK_multi_lens_audit actually SUCCEEDED (status=${flowK?.status}) - it is the flow the performance validator attaches to`, flowK?.status === 'success');
    // NON-VACUITY GUARD. Codex review 2026-07-28 (Medium): this used to assert only that
    // flowI_accessibility was PRESENT in flowResults. Presence is not execution - in a fresh HOME
    // with missing prerequisites the chain records flowI as `error` or `skipped`, its emitter
    // never runs, and every "the constant finding is gone" assertion below then passed for the
    // wrong reason. The guard has to assert the flow SUCCEEDED, because only a successful flowI
    // can emit the metric these assertions claim is absent.
    check('chain: flowI_accessibility is in the chain at all', !!flowI);
    check(`chain: flowI_accessibility actually SUCCEEDED (status=${flowI?.status}) - else the assertions below prove nothing`, flowI?.status === 'success');
    check('chain: a build report was produced (else there are no findings to inspect)', !!res.buildReport);
    const findings = (res.buildReport?.findings || []);
    check('chain: NO domains-needs-testing finding (a metric that fires at its target)', !findings.some((f) => f.rule.includes('domains-needs-testing')));
    check('chain: NO has_optimization_guidance finding (a flow grading its own guidance)', !findings.some((f) => f.rule.includes('has_optimization_guidance')));
    check('chain: no domain grade comes from a guidance-only performance validator', !(res.buildReport?.domainGrades || []).some((g) => g.domain === 'performance'));
    // The self-check must also be gone from every surface a HUMAN reads, not just the findings
    // list. Codex review 2026-07-28 (Medium): it still leaked into flowResults[].message as
    // "Validation warnings: [performance] has_optimization_guidance" on every run, for every target.
    const messages = (res.flowResults || []).map((f) => f.message || '').join('\n');
    check('chain: no self-check in flowResults[].message', !messages.includes('has_optimization_guidance'));
    check('chain: no "Validation warnings" line at all when the only failure is a self-check', !/Validation warnings/.test(messages));
    check('chain: no self-check in the guidance shown to the user', !JSON.stringify(res.guidance || []).includes('has_optimization_guidance'));
    // SCOPE, stated honestly: the raw `result.validationResults` array still RECORDS the
    // self-check. That is deliberate. `domain-validation-coverage.test.ts` asserts those entries
    // reach both the result and the persisted memory entry (an ordering invariant), so dropping
    // them would trade this fix for that regression. What matters is that the record is LABELLED,
    // so no consumer has to guess whether an entry measured the user's page.
    //
    // The labelling invariant is asserted AT ITS SOURCE rather than off a live run. An earlier
    // version asserted "the introspection validators ran, and all are labelled" against the
    // chain result, and its own non-vacuity guard then failed inside the full `npm test` - under
    // that suite's temp-HOME isolation flowI does not reach status:'success', so no domain
    // validators attach and there was nothing to check. That is the guard working: the labelling
    // assertion would have been vacuous in exactly the environment that matters most. Asserting
    // against the five production factories is deterministic and environment-independent.
    const factories = [
        ['accessibility', flow_domain_validators_1.createAccessibilityValidator],
        ['performance', flow_domain_validators_1.createPerformanceValidator],
        ['design_system', flow_domain_validators_1.createDesignSystemValidator],
        ['semantic', flow_domain_validators_1.createSemanticValidator],
        ['content_quality', flow_domain_validators_1.createContentQualityValidator],
    ];
    for (const [name, make] of factories) {
        check(`chain: the ${name} validator is labelled measures=flow-output at its source`, make().measures === 'flow-output');
    }
    // And IF a live run did attach them, they carry the label through. Environment-tolerant:
    // this asserts the propagation when it is observable and says so plainly when it is not.
    const vrs = (res.flowResults || []).flatMap((f) => f.validationResults || []);
    const selfChecks = vrs.filter((v) => factories.some(([d]) => d === v.domain));
    if (selfChecks.length > 0) {
        check('chain: a live run propagates measures=flow-output onto every self-check', selfChecks.every((v) => v.measures === 'flow-output'));
    }
    else {
        console.log('NOTE chain: no domain validators attached in this environment (isolated HOME) - source-level labelling asserted above instead.');
    }
    check('chain: domains-needs-testing is absent from the JSON surface entirely', !JSON.stringify(res).includes('domains-needs-testing'));
}
// ---------------------------------------------------------------------------
// Layer 3c - a NON-PAGE target keeps its documented chain, and says it rendered nothing.
//
// `/sidecoach audit <project>` is a documented shape (SKILL.md line 171: it reaches flowK's
// drift lens). Codex review 2026-07-28 (High) caught that routing EVERY target through
// render-or-error regressed `/sidecoach audit .`, `/sidecoach audit PRODUCT.md` and
// `/sidecoach audit SomeComponentName` into hard errors.
//
// The property that actually matters is not "error on a non-page" - it is that a result which
// scanned no page can never be READ as one. So the chain runs, and the answer says so.
// MUTATION: dropping the notice, or reporting audit.rendered !== false, fails this layer.
// ---------------------------------------------------------------------------
async function nonPageTargetsKeepTheirChain() {
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    for (const [label, target] of [
        ['a project directory', '.'],
        ['a markdown file', 'PRODUCT.md'],
        ['a bare component name', 'SomeComponentName'],
        ['a source file', 'src/audit-rendered.ts'],
        ['a directory without an entry document', path.join(FIX, 'dir-without-index')],
    ]) {
        const res = await engine.process(`/sidecoach audit ${target}`, { projectPath: REPO });
        check(`non-page (${label}): the documented chain still runs`, (res.flowResults || []).length > 0);
        check(`non-page (${label}): says NO PAGE WAS RENDERED`, /NO PAGE WAS RENDERED/.test(res.message || ''));
        check(`non-page (${label}): the notice leads the guidance`, /NO PAGE WAS RENDERED/.test((res.guidance || [])[0] || ''));
        check(`non-page (${label}): audit.rendered is false`, res.audit?.rendered === false);
        check(`non-page (${label}): reports no rendered grade`, res.audit?.grade === undefined);
        check(`non-page (${label}): names why it could not render`, !!res.audit?.unrenderableTarget?.reason);
        // The decisive one: no overall verdict/letter grade for a page nothing opened.
        // Before this, `/sidecoach audit .` reported `verdict: clean, overallGrade: A`.
        check(`non-page (${label}): NO build report (no clean verdict, no letter grade)`, !res.buildReport);
    }
}
// ---------------------------------------------------------------------------
// Layer 3d - broken-image: BOTH shapes, and the measured boundary between them.
//
// An empty `src` fires. A src naming a file that does not exist does NOT, and that silence is
// a deliberate precision-first design, not an oversight. The scanner comment states the
// rationale: under the hermetic render external loads are ABORTED, so naturalWidth/load-failure
// would flag every external <img>.
//
// That rationale does not obviously cover a `file://` document, whose SAME-PROTOCOL subresources
// the hermeticity policy explicitly allows to load - and local file targets only started reaching
// the render path with this unit's change, so the case is newly reachable. So it was measured
// rather than argued (2026-07-28), by running exactly the load-state check that would be shipped
// over the real held-out corpus in eval/corpus/buzzword-heldout:
//
//     over 6 corpus pages: current detector = 0 fires, load-state check = 108 NEW fires
//     across all 38 pages, 972 relative <img> references resolve to files that do not exist
//     successfully-loading relative images on those pages: ZERO
//
// Every one of those is a CAPTURE ARTIFACT - the pages were saved without their asset trees - not
// a defect in the page as published. Adopting load-state would trade broken-image's measured
// P 1.000 for a detector that fires on 25 of 38 real pages incorrectly. A second, independent
// reason to reject it: 114 images on one page were still `pending` at snapshot time, so the
// signal is not even settled when we read it.
//
// The gap is therefore REAL and NOT safely fixable by load state under the current render policy.
// These assertions pin the boundary so it is explicit rather than silent. If a future change makes
// missing-file detection safe, the missing-file assertion SHOULD be flipped - but only together
// with evidence that addresses the 972-reference corpus cost above.
// ---------------------------------------------------------------------------
async function brokenImageShapes() {
    // Its 4 assertions were already reported SKIPPED by the acceptance layer's accounting.
    if (browserUnavailable)
        return;
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    const audit = async (t) => engine.process(`/sidecoach audit ${t}`, { projectPath: REPO });
    const emptySrc = await audit(path.join(FIX, 'broken-image-empty-src.html'));
    const missingFile = await audit(path.join(FIX, 'broken-image-missing-file.html'));
    // NON-VACUITY: both pages must actually have rendered, or neither assertion means anything.
    bcheck('broken-image: the empty-src page rendered', emptySrc.audit?.rendered === true);
    bcheck('broken-image: the missing-file page rendered', missingFile.audit?.rendered === true);
    const fired = (res) => (res.audit?.byRule || []).some((r) => r.rule === 'broken-image');
    bcheck('broken-image: an EMPTY src fires (the structural signal)', fired(emptySrc));
    bcheck('broken-image: a MISSING FILE does not fire (measured boundary, see header)', !fired(missingFile));
}
// ---------------------------------------------------------------------------
// Layer 4 - a target that NAMES a document which does not exist fails LOUDLY.
//
// The narrow carve-out from layer 3c: `/sidecoach audit some/page.html` where that file is
// missing is a broken path, not a project audit. Answering a typo with generic project
// guidance would hide the mistake, so this one case is an error.
// ---------------------------------------------------------------------------
async function failLoud() {
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    for (const [label, target] of [
        ['a missing .html document', path.join(FIX, 'nope-does-not-exist.html')],
        ['a missing .htm document', path.join(FIX, 'also-missing.htm')],
    ]) {
        const res = await engine.process(`/sidecoach audit ${target}`, { projectPath: REPO });
        check(`fail-loud: ${label} -> success=false`, res.success === false);
        check(`fail-loud: ${label} -> NO build report (never a confident grade)`, !res.buildReport);
        check(`fail-loud: ${label} -> says nothing was scanned`, /NOTHING WAS SCANNED/.test(res.message));
        check(`fail-loud: ${label} -> carries the unrenderable reason`, !!res.audit?.unrenderableTarget?.reason);
        check(`fail-loud: ${label} -> reports no grade`, res.audit?.grade === undefined);
    }
}
// ---------------------------------------------------------------------------
// Layer 5 - a file:// target clears exactly the same gate as a plain path.
// Codex review 2026-07-28 (High): explicit file:// URLs were returned verbatim, so
// `file:///tmp/Button.tsx` and friends resolved renderable - the fail-loud guarantee held for
// path syntax but not for URL syntax.
// MUTATION: restoring the verbatim `return { renderable: true, kind: 'file', renderUrl: raw }`
// fails these.
// ---------------------------------------------------------------------------
async function fileUrlTargets() {
    const cleanFileUrl = `file://${path.join(FIX, 'clean.html')}`;
    const ok = (0, audit_rendered_1.resolveAuditTarget)(cleanFileUrl);
    check('file-url: a real .html file URL is renderable', ok.renderable === true);
    check('file-url: it is re-emitted canonically', ok.renderable && ok.renderUrl.startsWith('file:///'));
    check('file-url: it resolves to the real path', ok.renderable && (ok.resolvedPath || '').endsWith('clean.html'));
    const src = (0, audit_rendered_1.resolveAuditTarget)(`file://${path.join(REPO, 'src/audit-rendered.ts')}`);
    check('file-url: a source file URL is UNRENDERABLE (was renderable)', src.renderable === false);
    const missing = (0, audit_rendered_1.resolveAuditTarget)(`file://${path.join(FIX, 'no-such-page.html')}`);
    check('file-url: a missing file URL is UNRENDERABLE', missing.renderable === false);
    const dirUrl = (0, audit_rendered_1.resolveAuditTarget)(`file://${path.join(FIX, 'dir-without-index')}`);
    check('file-url: a directory URL with no entry document is UNRENDERABLE', dirUrl.renderable === false);
    const malformed = (0, audit_rendered_1.resolveAuditTarget)('file://not a valid url at all');
    check('file-url: a malformed file URL is UNRENDERABLE, not passed through', malformed.renderable === false);
}
// ---------------------------------------------------------------------------
// Layer 6 - THE PANEL must never present a grade for a page nothing opened.
//
// Codex review 2026-07-28 (CRITICAL, reproduced live): the previous unit suppressed
// `buildReport` for an unrendered audit target but passed the UNSUPPRESSED chainBuildReport
// straight into assemblePanelModel, which copies report.verdict + report.overallGrade, and
// panel-renderer prints them. `/sidecoach audit .` printed, verbatim:
//
//     ◆ verdict  clean · grade A · 0 findings
//
// with three green gates, while audit.rendered was false and buildReport was absent. The
// markdown surface said "inconclusive" and the PANEL said grade A. The headline safety
// property of the whole unit was therefore FALSE as shipped.
//
// Layer 3c passed anyway because it only asserted `!res.buildReport` and never once looked at
// `res.panel`. That is the lesson: suppressing a value at ONE consumer is not suppressing it.
// These assertions read the panel STRING, which is what a human actually sees.
// MUTATION: passing `report: chainBuildReport` back into assemblePanelModel fails every
// verdict/grade/gate assertion below.
// ---------------------------------------------------------------------------
async function panelNeverGradesAnUnrenderedTarget() {
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    for (const [label, target] of [
        ['a project directory', '.'],
        ['a markdown file', 'PRODUCT.md'],
        ['a directory without an entry document', path.join(FIX, 'dir-without-index')],
    ]) {
        const res = await engine.process(`/sidecoach audit ${target}`, { projectPath: REPO });
        const panel = stripAnsi(res.panel);
        // NON-VACUITY: a blank panel would pass every "does not contain" assertion below for the
        // wrong reason. The panel must still EXIST and still carry its routing context - the fix
        // is "no verdict", not "no panel".
        check(`panel (${label}): a panel was still produced`, panel.length > 0);
        check(`panel (${label}): the panel still shows its route`, /route/.test(panel));
        check(`panel (${label}): the run really did not render`, res.audit?.rendered === false);
        // The decisive assertions - each one of these was FALSE as shipped.
        check(`panel (${label}): panel prints NO verdict line`, !/verdict/i.test(panel));
        check(`panel (${label}): panel prints NO letter grade`, !/\bgrade\s+[A-F]\b/.test(panel));
        check(`panel (${label}): panel claims NO finding count`, !/\d+\s+findings?\b/.test(panel));
        check(`panel (${label}): panel shows NO passed gate mark`, !panel.includes('✓'));
        check(`panel (${label}): gates read as pending, not passed`, /gates/.test(panel) ? panel.includes('·') : true);
        // Codex review 2026-07-28 (d): omitting the verdict stops the panel ASSERTING a false clean,
        // but every phase still renders [done], so a clean result stayed INFERABLE. Say it outright.
        check(`panel (${label}): the panel SAYS no page was rendered`, /NO PAGE WAS RENDERED/.test(panel));
    }
    // The CONTRAST case: a target that really did render must still get its verdict and grade,
    // or this fix has traded a false positive for a blanket false negative.
    const rendered = await engine.process(`/sidecoach audit ${path.join(FIX, 'catastrophic.html')}`, { projectPath: REPO });
    if (rendered.audit?.rendered === true) {
        const panel = stripAnsi(rendered.panel);
        bcheck('panel: a REAL rendered audit still prints its verdict', /verdict/i.test(panel));
        bcheck('panel: a REAL rendered audit still prints its grade', /\bgrade\s+F\b/.test(panel));
    }
    else {
        // Codex review 2026-07-28 (e): this used to skip with a hard-coded "Chromium could not
        // launch", which reports a page that rendered-but-found-nothing, or any other failure, as a
        // missing browser. Only a genuine LAUNCH failure is a skip; anything else is a real failure
        // and must be raised, not explained away.
        const reasons = rendered.audit?.unavailableReasons || [];
        const launchFailure = reasons.some((r) => /launch|executable|Permission denied|browserType|spawn|ENOENT/i.test(r));
        if (!launchFailure) {
            throw new Error(`FAIL: the rendered-panel contrast case did not render, and NOT because the browser was missing. ` +
                `rendered=${JSON.stringify(rendered.audit?.rendered)} reasons=${JSON.stringify(reasons)}`);
        }
        bskip('rendered-panel contrast (2)', 2, reasons.join('; ') || 'Chromium could not launch');
    }
}
// ---------------------------------------------------------------------------
// Layer 7 - the OTHER 19 VERBS must not answer a page-shaped target with a confident constant.
//
// Codex review 2026-07-28 (CRITICAL): runRenderedAudit had exactly ONE call site, gated on
// `commandMatch.command === 'audit'`. Every other verb parsed its target into
// metadata.commandTarget, no handler consumed it, and the verb returned the old canned chain
// output - so `/sidecoach critique catastrophic.html` reported a confident verdict and letter
// grade for a page nothing had opened. The original measured defect was that ALL 20 verbs did
// this; the previous unit fixed exactly one of them.
//
// THE CHOICE MADE (Codex-designed, option C of three): rendering stays owned by `audit`, and
// the existing unrendered-target suppression is GENERALIZED to all 20 verbs. Rejected: (A)
// routing critique/polish/harden/optimize into the rendered-audit path - that path is an early
// return that bypasses the verb's flow chain, so `/sidecoach polish page.html` would stop
// producing tactical-polish guidance entirely and return raw a11y findings instead. That trades
// a safety defect for a capability regression, and it is the SAME over-capture mistake a
// previous review already caught on this unit. (B) render-AND-chain, attaching rendered evidence
// alongside the verb's own guidance, is the right eventual shape but is a larger result-model
// change than a repair unit should carry. C fixes the safety hole on every verb TODAY without
// altering any verb's documented guidance shape.
//
// MUTATION: restoring the `commandMatch.command === 'audit'` gate on the capture makes every
// non-audit assertion below fail.
// ---------------------------------------------------------------------------
async function nonAuditVerbsFailClosedOnPageTargets() {
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    // Two representative non-audit verbs, each against the maximally-different fixture pair.
    for (const verb of ['critique', 'polish']) {
        for (const [label, target] of [
            ['a clean page', path.join(FIX, 'clean.html')],
            ['a catastrophic page', path.join(FIX, 'catastrophic.html')],
            ['a directory with an index', path.join(FIX, 'site-with-index')],
        ]) {
            const res = await engine.process(`/sidecoach ${verb} ${target}`, { projectPath: REPO });
            // NON-VACUITY: the verb must still have DONE its documented work.
            check(`${verb} (${label}): the documented chain still runs`, (res.flowResults || []).length > 0);
            // The decisive ones - all FALSE as shipped.
            check(`${verb} (${label}): NO build report for a page it never scanned`, !res.buildReport);
            check(`${verb} (${label}): says NO PAGE WAS RENDERED`, /NO PAGE WAS RENDERED/.test(res.message || ''));
            check(`${verb} (${label}): audit.rendered is false`, res.audit?.rendered === false);
            check(`${verb} (${label}): reports no letter grade`, res.audit?.grade === undefined);
            check(`${verb} (${label}): the panel prints no verdict`, !/verdict/i.test(stripAnsi(res.panel)));
            check(`${verb} (${label}): the panel prints no letter grade`, !/\bgrade\s+[A-F]\b/.test(stripAnsi(res.panel)));
            // Fail CLOSED, not an error wall: the answer has to name the command that WOULD scan it.
            const said = JSON.stringify(res.guidance || []) + (res.message || '');
            check(`${verb} (${label}): points at the verb that actually renders`, /\/sidecoach audit/.test(said));
        }
    }
    // THE DIFFERENTIAL, stated honestly. Pre-fix these two payloads were byte-identical confident
    // grades. Post-fix they are still alike - because BOTH now correctly decline to grade - so the
    // property under test is not "they differ", it is "NEITHER claims a measurement". Asserting
    // difference here would be asserting a lie.
    const cleanC = await engine.process(`/sidecoach critique ${path.join(FIX, 'clean.html')}`, { projectPath: REPO });
    const cataC = await engine.process(`/sidecoach critique ${path.join(FIX, 'catastrophic.html')}`, { projectPath: REPO });
    check('differential: neither critique payload carries a verdict', !cleanC.buildReport?.verdict && !cataC.buildReport?.verdict);
    check('differential: neither critique payload carries an overall grade', !cleanC.buildReport?.overallGrade && !cataC.buildReport?.overallGrade);
    check('differential: BOTH admit nothing was rendered', cleanC.audit?.rendered === false && cataC.audit?.rendered === false);
    // ANTI-OVER-CAPTURE. The previous unit's regression was capturing too much: routing every
    // target into the fail path turned documented shapes into errors. A verb given a PROSE target
    // ("a login page") is describing work to do, not naming a page to scan, and must be untouched.
    //
    // The last two cases are Codex review 2026-07-28 (Medium): my first predicate captured every
    // existing non-document file and every entry-less directory, which turned `/sidecoach extract
    // Button.tsx` - a verb whose REAL subject is a filename - into "NO PAGE WAS RENDERED, run
    // audit instead". Nonsense, and a regression of that verb's documented shape.
    for (const [label, utterance] of [
        ['a prose build target', '/sidecoach craft a login page'],
        ['a bare component name', '/sidecoach polish SomeComponentName'],
        ['no target at all', '/sidecoach critique'],
        ['a source file named by a verb that takes filenames', `/sidecoach extract ${path.join(REPO, 'src/audit-rendered.ts')}`],
        ['a real directory with no entry document', `/sidecoach polish ${path.join(FIX, 'dir-without-index')}`],
    ]) {
        const res = await engine.process(utterance, { projectPath: REPO });
        check(`no-regression (${label}): NOT captured as an unrendered page`, !/NO PAGE WAS RENDERED/.test(res.message || ''));
        check(`no-regression (${label}): keeps its build report`, !!res.buildReport);
    }
    // A PAGE NAMED WITH A QUERY STRING OR FRAGMENT is the same claim about the same page.
    // Codex review 2026-07-28 (High): the extension test ran against the raw target, so
    // `index.html?v=2` did not match, resolved as a missing bare path, and fell straight through
    // to a confident chain grade for a page-shaped target.
    for (const [label, target] of [
        ['a query string', 'index.html?v=2'],
        ['a fragment', 'index.html#main'],
        ['both', 'pages/app.html?a=1#top'],
    ]) {
        const res = await engine.process(`/sidecoach critique ${target}`, { projectPath: REPO });
        check(`query-string (${label}): still recognised as a page target`, /NO PAGE WAS RENDERED/.test(res.message || ''));
        check(`query-string (${label}): NO build report`, !res.buildReport);
    }
    // A URL handed to a non-audit verb: renderable, and deliberately not rendered by this verb.
    const urlRes = await engine.process('/sidecoach critique http://localhost:4830/page', { projectPath: REPO });
    check('url: a non-audit verb does not claim to have scanned a URL', /NO PAGE WAS RENDERED/.test(urlRes.message || ''));
    check('url: NO build report for an unscanned URL', !urlRes.buildReport);
    check('url: the reason names the verb that would not render it', /does not render/i.test(JSON.stringify(urlRes.audit?.unrenderableTarget?.reason || '')));
    // EXTENSIONS BEYOND THE RENDERER'S OWN LIST. Codex review 2026-07-28 (Medium): the page-shaped
    // predicate reused the renderer's html/htm/xhtml set, so `.shtml` - unmistakably a page - fell
    // through to a confident chain grade. Verified live before the fix: `/sidecoach critique
    // page.shtml` returned buildReport=true and the executive report said "Checks passed".
    for (const ext of ['shtml', 'xht', 'HTML', 'Htm']) {
        const res = await engine.process(`/sidecoach critique some/page.${ext}`, { projectPath: REPO });
        check(`extension (.${ext}): recognised as a page target`, /NO PAGE WAS RENDERED/.test(res.message || ''));
        check(`extension (.${ext}): NO build report`, !res.buildReport);
    }
}
// ---------------------------------------------------------------------------
// Layer 7c - THE INVARIANT, asserted across every unmeasured shape at once.
//
// Codex review 2026-07-28 (Medium) observed the panel notice only reaches the CHAIN path. That
// is true, and it is safe only because the other unmeasured paths emit NO PANEL AT ALL - a
// result with no panel cannot make a false claim through one. But "safe by accident of which
// paths happen to build a panel" is exactly the reasoning that let the original defect ship.
//
// So the property is stated once, as an invariant over every shape that reports rendered:false:
// EITHER there is no panel, OR the panel says plainly that nothing was rendered. It can never be
// a panel that quietly omits the verdict and leaves a reader to infer a pass.
// MUTATION: dropping the notice from the chain call site fails this for the chain shapes.
// ---------------------------------------------------------------------------
async function everyUnmeasuredPathIsHonest() {
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    const shapes = [
        ['audit of a project directory', '/sidecoach audit .'],
        ['audit of a markdown file', '/sidecoach audit PRODUCT.md'],
        ['audit of a missing document (fail-loud path)', `/sidecoach audit ${path.join(FIX, 'nope-does-not-exist.html')}`],
        ['audit of an entry-less directory', `/sidecoach audit ${path.join(FIX, 'dir-without-index')}`],
        ['critique of a real page', `/sidecoach critique ${path.join(FIX, 'clean.html')}`],
        ['polish of a directory with an index', `/sidecoach polish ${path.join(FIX, 'site-with-index')}`],
        ['critique of a URL', '/sidecoach critique http://localhost:4830/page'],
    ];
    for (const [label, utterance] of shapes) {
        const res = await engine.process(utterance, { projectPath: REPO });
        check(`invariant (${label}): reports rendered:false`, res.audit?.rendered === false);
        check(`invariant (${label}): carries NO build report`, !res.buildReport);
        check(`invariant (${label}): reports no letter grade`, res.audit?.grade === undefined);
        const panel = stripAnsi(res.panel);
        check(`invariant (${label}): either NO panel, or a panel that SAYS nothing was rendered`, panel.length === 0 || /NO PAGE WAS RENDERED/.test(panel));
        check(`invariant (${label}): no panel anywhere claims a verdict or grade`, !/verdict/i.test(panel) && !/\bgrade\s+[A-F]\b/.test(panel));
    }
}
// ---------------------------------------------------------------------------
// Layer 7b - the EXECUTIVE REPORT must not turn a missing report into a pass.
//
// Codex review 2026-07-28 (High): bin/sidecoach-present.js did `report.verdict || 'clean'` and
// its no-findings branch printed "Checks passed. 0 findings." So EVERY path that deliberately
// withholds a BuildReport - an unrendered audit, a non-audit verb handed a page, and any verb
// handled before the target guard runs at all - still reached the human as a clean pass. The
// panel and the BuildReport were fixed while this surface kept saying the opposite.
// MUTATION: restoring `if (!findings.length)` as the first branch fails these.
// ---------------------------------------------------------------------------
async function executiveReportNeverInventsAPass() {
    // ASSERTED END TO END, THROUGH THE REAL ENGINE, not against a synthetic fixture.
    //
    // The defect Codex named was `/sidecoach document index.html`: `document` is a SETUP command
    // handled before the target guard, so it returned neither a buildReport nor an audit block, and
    // buildExecutive's `report.verdict || 'clean'` printed "Checks passed. 0 findings." for a page
    // nothing had opened. A hand-built fixture cannot prove that is fixed, because the fix is that
    // the ORCHESTRATOR now attaches the rendered:false signal on those paths - so the assertion has
    // to drive the real command.
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    const authoringRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-authoring-'));
    for (const [label, utterance] of [
        ['document, given a page', '/sidecoach document index.html'],
        ['teach, given a page', '/sidecoach teach index.html'],
    ]) {
        const res = await engine.process(utterance, { projectPath: authoringRoot });
        const out = stripAnsi(present.renderExecutiveReport(res, utterance));
        check(`exec-report (${label}): the run reports rendered:false`, res.audit?.rendered === false);
        check(`exec-report (${label}): does NOT say checks passed`, !/Checks passed/i.test(out));
        check(`exec-report (${label}): does NOT claim 0 findings`, !/0 findings/i.test(out));
        check(`exec-report (${label}): says it could not certify the page`, /inconclusive|not a clean result/i.test(out));
    }
    fs.rmSync(authoringRoot, { recursive: true, force: true });
    // NON-MEASURING COMMANDS ARE LEFT ALONE. Codex flagged this twice, because my first two fixes
    // inferred "measured nothing" from a MISSING build report and swept these up: first list/help
    // (which execute nothing), then document/teach with NO target (which execute a handler and
    // legitimately produce no report). None of them claims to have looked at a page.
    //
    // `document` and `teach` are run against a THROWAWAY project root, never REPO. They are real
    // authoring commands that WRITE DESIGN.md, and pointing them at this repo made the suite
    // create untracked files in the working tree - a test with a side effect on the project it is
    // testing. Caught by inspecting `git status` after a run, not by any assertion.
    for (const [label, utterance] of [
        ['list', '/sidecoach list'],
        ['help', '/sidecoach help'],
    ]) {
        const res = await engine.process(utterance, { projectPath: REPO });
        const out = stripAnsi(present.renderExecutiveReport(res, utterance));
        check(`exec-report (${label}): carries NO audit block (claims nothing about a page)`, res.audit === undefined);
        check(`exec-report (${label}): is NOT called inconclusive`, !/inconclusive/i.test(out));
        check(`exec-report (${label}): is NOT told a page was not rendered`, !/no page was rendered/i.test(out));
    }
    {
        const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-doc-notarget-'));
        try {
            const res = await engine.process('/sidecoach document', { projectPath: scratch });
            const out = stripAnsi(present.renderExecutiveReport(res, '/sidecoach document'));
            check('exec-report (document with no target): carries NO audit block', res.audit === undefined);
            check('exec-report (document with no target): is NOT called inconclusive', !/inconclusive/i.test(out));
            check('exec-report (document with no target): is NOT told a page was not rendered', !/no page was rendered/i.test(out));
        }
        finally {
            fs.rmSync(scratch, { recursive: true, force: true });
        }
    }
    // THE EDGE CASE THAT MAKES THE EMPTY-TARGET GUARD LOAD-BEARING.
    //
    // A mutation removing `if (!raw) return null` was reported NOT CAUGHT, and the reason is
    // instructive rather than dismissible: with no target, resolveAuditTarget resolves the PROJECT
    // ROOT, and in this repo that root has no index.html - so the narrowed predicate returns false
    // anyway and the guard looks redundant. In a project whose root DOES have an index.html the
    // same path resolves RENDERABLE, and a bare `/sidecoach document` would be captured as "you
    // named a page and we did not scan it". Asserted against a fixture root that has one, so the
    // guard is covered by the layout that actually exercises it.
    // Built in a TEMP dir rather than pointed at the committed fixture, because these commands
    // WRITE DESIGN.md into whatever root they are given.
    const siteRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-root-with-index-'));
    try {
        fs.writeFileSync(path.join(siteRoot, 'index.html'), '<!doctype html><title>root</title><h1>root</h1>');
        for (const utterance of ['/sidecoach document', '/sidecoach teach']) {
            const res = await engine.process(utterance, { projectPath: siteRoot });
            check(`exec-report (${utterance} from a root containing index.html): still claims nothing about a page`, res.audit === undefined);
        }
    }
    finally {
        fs.rmSync(siteRoot, { recursive: true, force: true });
    }
    // A genuinely clean MEASURED run must still read as a pass.
    const measuredClean = {
        success: true,
        message: 'ok',
        detectedFlow: { flowId: 'flowJ_tactical_polish', flowName: 'polish', confidence: 1 },
        flowResults: [{ flowId: 'flowJ_tactical_polish', flowName: 'polish', status: 'success', message: 'ok', guidance: [], checklist: [] }],
        buildReport: { composite: 'polish', verdict: 'clean', overallGrade: 'A', findings: [], domainGrades: [], severityCounts: { blocking: 0, warning: 0, info: 0 }, nextSteps: [] },
    };
    check('exec-report: a REAL clean measured run still reports checks passed', /Checks passed/i.test(stripAnsi(present.renderExecutiveReport(measuredClean, '/sidecoach polish x'))));
}
// ---------------------------------------------------------------------------
// Layer 8 - an audit that scanned NOTHING must not satisfy a later prerequisite.
//
// Codex review 2026-07-28 (High): FlowHistoryEntry had no `rendered` field and
// FlowPrerequisiteValidator.canExecute trusted only `entry.status === 'success'`. So
// `/sidecoach audit PRODUCT.md` recorded flowK_multi_lens_audit as a success, and flowL /
// flowN - which take flowK as an optional prerequisite under minSuccessfulPrerequisites - then
// treated an audit that opened no page as a completed prerequisite.
//
// SCOPE, deliberately narrow: only an EXPLICIT `rendered: false` disqualifies an entry.
// `undefined` keeps its existing meaning, so history written by earlier sessions, and every
// flow that never makes a rendering claim, behave exactly as before. Fail-closed on unknown
// would have silently invalidated legacy history for every flow in the map.
// MUTATION: dropping the `rendered !== false` clause in canExecute fails the first assertion.
// ---------------------------------------------------------------------------
async function unrenderedAuditIsNotAPrerequisite() {
    const entry = (over) => ({
        flowId: 'flowK_multi_lens_audit',
        flowName: 'multi lens audit',
        status: 'success',
        message: 'ok',
        ...over,
    });
    const unrendered = flow_prerequisites_1.FlowPrerequisiteValidator.canExecute('flowL_design_critique', [entry({ rendered: false })]);
    check('prereq: a flowK that rendered NOTHING does not satisfy flowL', unrendered.canExecute === false);
    check('prereq: the refusal names the reason', /render/i.test(unrendered.reason || ''));
    const rendered = flow_prerequisites_1.FlowPrerequisiteValidator.canExecute('flowL_design_critique', [entry({ rendered: true })]);
    check('prereq: a flowK that DID render still satisfies flowL', rendered.canExecute === true);
    // Back-compat: an entry with no rendering claim keeps its pre-existing meaning.
    const legacy = flow_prerequisites_1.FlowPrerequisiteValidator.canExecute('flowL_design_critique', [entry({})]);
    check('prereq: a legacy entry with no rendered field is unchanged', legacy.canExecute === true);
    // flowN: THE HONEST RESULT, and a correction to the brief I was given.
    //
    // The task described flowL AND flowN as both treating an unrendered audit as a completed
    // prerequisite. flowL does. flowN does NOT - not because it checks the rendering claim, but
    // because it is not gated at all: it lists flowK and flowL as OPTIONAL prerequisites with no
    // `minSuccessfulPrerequisites`, and canExecute only evaluates optional prerequisites when a
    // minimum exists. So flowN runs regardless of what flowK did, rendered or not.
    //
    // My first version of this assertion was `nUnrendered === false || nRendered === true`, which
    // Codex correctly called VACUOUS - the right-hand side is true, so the whole thing passes no
    // matter what the left-hand side does. Replaced with the fact, asserted in both directions, so
    // that if flowN ever gains a minimum this test reports the change instead of hiding it.
    const nUnrendered = flow_prerequisites_1.FlowPrerequisiteValidator.canExecute('flowN_rapid_iteration_refined', [entry({ rendered: false })]);
    const nRendered = flow_prerequisites_1.FlowPrerequisiteValidator.canExecute('flowN_rapid_iteration_refined', [entry({ rendered: true })]);
    check('prereq: flowN is UNGATED today - it runs with an unrendered flowK', nUnrendered.canExecute === true);
    check('prereq: flowN is UNGATED today - it runs with a rendered flowK too', nRendered.canExecute === true);
    check('prereq: flowN has no minSuccessfulPrerequisites (the reason it is ungated) - if this fails, flowN gained a gate and the two assertions above must be revisited', flow_prerequisites_1.FlowPrerequisiteValidator.getDependencies('flowN_rapid_iteration_refined')?.minSuccessfulPrerequisites === undefined);
    // END TO END: the field must actually be PERSISTED, or the check above guards nothing.
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    await engine.process('/sidecoach audit PRODUCT.md', { projectPath: REPO });
    const { getFlowHistory } = require('../flow-history');
    const seq = getFlowHistory().getFlowSequence();
    const audits = seq.filter((e) => e.flowId === 'flowK_multi_lens_audit');
    check('persist: an audit of a non-page recorded a flowK entry at all', audits.length > 0);
    check('persist: that entry records rendered:false', audits.some((e) => e.rendered === false));
}
// ---------------------------------------------------------------------------
// Layer 9 - the self-check must be gone from EVERY HUMAN SURFACE, not just BuildReport.
//
// Codex review 2026-07-28 (High), and the open item the previous agent flagged against itself:
// suppression closed the BuildReport path only. bin/sidecoach-present.js pushed EVERY
// validationResult into its gates row with no `measures` filter and printed a per-domain
// pass/fail mark; bin/sidecoach-monitor.js emitted the raw result over --json including
// `failedRules: ['has_optimization_guidance']`. So the flow-grading-its-own-guidance defect
// was still fully visible to a human on both surfaces.
// MUTATION: removing the measures filter in present.js resurrects the gate row.
// ---------------------------------------------------------------------------
async function humanSurfacesFilterSelfChecks() {
    const resultWith = (measures) => ({
        success: true,
        message: 'ok',
        detectedFlow: { flowId: 'flowJ_tactical_polish', flowName: 'tactical polish', confidence: 1 },
        flowResults: [{
                flowId: 'flowJ_tactical_polish',
                flowName: 'tactical polish',
                status: 'success',
                message: 'ok',
                guidance: [],
                checklist: [],
                validationResults: [{
                        domain: 'performance',
                        status: 'fail',
                        passedRules: ['has_performance_metrics'],
                        failedRules: ['has_optimization_guidance'],
                        message: 'Domain validation: 1/2 rules passed',
                        measures,
                    }],
            }],
        buildReport: {
            composite: 'polish', verdict: 'warnings', overallGrade: 'B', findings: [],
            domainGrades: [{ domain: 'performance', letter: 'F', rulesPassed: 1, rulesTotal: 2 }],
            severityCounts: { blocking: 0, warning: 0, info: 0 }, nextSteps: [],
        },
    });
    const leaked = stripAnsi(present.render(resultWith('flow-output'), '/sidecoach polish x'));
    check('present: a flow-output self-check produces NO gate row', !leaked.includes('has_optimization_guidance'));
    check('present: its per-domain pass/fail mark is gone too', !/performance/.test(leaked.split('gates')[1] || ''));
    // NARROW: a validator that measured the real artifact must still show up.
    const kept = stripAnsi(present.render(resultWith('artifact'), '/sidecoach polish x'));
    check('present: an artifact validator STILL renders its gate', /performance/.test(kept));
    // The monitor's --json surface must be sanitized by the same predicate.
    const sanitize = present.stripFlowOutputSelfChecks;
    check('monitor: a sanitizer is exported for the --json surface', typeof sanitize === 'function');
    const cleaned = JSON.stringify(sanitize(resultWith('flow-output')));
    check('monitor: --json carries no has_optimization_guidance', !cleaned.includes('has_optimization_guidance'));
    const keptJson = JSON.stringify(sanitize(resultWith('artifact')));
    check('monitor: --json KEEPS a real artifact finding', keptJson.includes('has_optimization_guidance'));
}
// ---------------------------------------------------------------------------
// Layer 10 - the `measures` discriminator must be safe by default in ONE direction.
//
// Codex review 2026-07-28: it was unsafe in BOTH. The createDomainValidator FACTORY defaults
// `measures` to 'flow-output', so a factory-built validator that FORGOT the flag had its real
// findings SILENTLY SUPPRESSED (a false negative). Hand-built ValidationResults leave the field
// undefined, and the aggregator suppressed only on an explicit 'flow-output', so those still
// reported. What a validator "that sets nothing" got therefore depended entirely on how it
// happened to be constructed - the worst possible property for a safety discriminator.
//
// DIRECTION CHOSEN (Codex): unspecified means flow-output - i.e. a validator only reaches the
// user's report when it EXPLICITLY declares `measures: 'artifact'`. Emitting a fabricated
// finding about the user's page is the loud, corrosive failure; staying quiet until a validator
// says what it measured is the recoverable one. The five validators that really do scan the
// user's artifact (claudemd-mandate, polish-standard, taste, anti-patterns, copy) are labelled
// 'artifact' AT THEIR SOURCE by this unit, so the narrow path stays open.
// MUTATION: reverting the aggregator to `if (vr.measures === 'flow-output') continue` fails the
// undeclared cases below.
// ---------------------------------------------------------------------------
async function measuresIsSafeByDefault() {
    const withSelfCheck = (measures) => ({
        flowId: 'flowJ_tactical_polish',
        flowName: 'tactical polish',
        status: 'success',
        message: 'ok',
        guidance: [],
        checklist: [],
        validationResults: [
            { domain: 'performance', status: 'fail', passedRules: ['has_performance_metrics'], failedRules: ['has_optimization_guidance'], message: 'Domain validation: 1/2 rules passed', measures },
        ],
    });
    const undeclared = (0, build_report_aggregator_1.generateBuildReport)({ source: 'flow-results', flowResults: [withSelfCheck(undefined)] });
    check('measures: an UNDECLARED validator emits no finding (safe by default)', !undeclared.findings.some((f) => f.rule.includes('has_optimization_guidance')));
    check('measures: an UNDECLARED validator contributes no domain grade', !undeclared.domainGrades.some((g) => g.domain === 'performance'));
    const artifact = (0, build_report_aggregator_1.generateBuildReport)({ source: 'flow-results', flowResults: [withSelfCheck('artifact')] });
    check('measures: ONLY an explicit artifact validator reports', artifact.findings.some((f) => f.rule.includes('has_optimization_guidance')));
    check('measures: ONLY an explicit artifact validator grades', artifact.domainGrades.some((g) => g.domain === 'performance'));
    // The five real artifact validators must carry the label at their SOURCE, or the direction
    // above silences them - which would trade the false positive for a much worse false negative.
    const { ClaudemdMandateValidator } = require('../clausemd-mandate-validator');
    const { PolishStandardValidator } = require('../polish-standard-validator');
    const { toValidationResult: tasteToValidationResult } = require('../taste-validator');
    const { absoluteBanToValidationResult } = require('../absolute-ban-detector');
    const { linguisticBanToValidationResult } = require('../linguistic-ban-validator');
    const claudemd = ClaudemdMandateValidator.toValidationResult({ violations: [], blockers: [], passed: true });
    check('measures: claudemd-mandate declares artifact', claudemd.measures === 'artifact');
    const polish = PolishStandardValidator.toValidationResult({ results: [], summary: 'ok', criticalViolations: 0, violations: 0 });
    check('measures: polish-standard declares artifact', polish.measures === 'artifact');
    check('measures: taste declares artifact', tasteToValidationResult([]).measures === 'artifact');
    check('measures: anti-patterns declares artifact', absoluteBanToValidationResult({ findings: [], summary: 'ok' }).measures === 'artifact');
    check('measures: copy/linguistic declares artifact', linguisticBanToValidationResult({ findings: [], summary: 'ok' }).measures === 'artifact');
}
async function run() {
    await targetResolution();
    await fileUrlTargets();
    await selfCheckSuppression();
    await countMetrics();
    await measuresIsSafeByDefault();
    await acceptanceBar();
    await constantsGoneFromChain();
    await nonPageTargetsKeepTheirChain();
    await panelNeverGradesAnUnrenderedTarget();
    await nonAuditVerbsFailClosedOnPageTargets();
    await executiveReportNeverInventsAPass();
    await everyUnmeasuredPathIsHonest();
    await unrenderedAuditIsNotAPrerequisite();
    await humanSurfacesFilterSelfChecks();
    await brokenImageShapes();
    await failLoud();
    // HONEST ACCOUNTING (Codex review 2026-07-28, Medium). The old summary printed
    // `${passed}/${passed} passed` - a ratio that is 100% by construction. It could not express a
    // shortfall, so a machine where Chromium never launched still read as full green proof.
    const accountedFor = browserAssertionsRun + browserAssertionsSkipped;
    if (accountedFor !== BROWSER_ASSERTION_COUNT) {
        console.error(`FAIL: browser-assertion accounting drifted - ran ${browserAssertionsRun} + skipped ` +
            `${browserAssertionsSkipped} = ${accountedFor}, but ${BROWSER_ASSERTION_COUNT} are declared. ` +
            'Update BROWSER_ASSERTION_COUNT when adding or removing a bcheck.');
        console.log('flow-target-render FAIL');
        process.exit(1);
    }
    console.log('---');
    console.log(`flow-target-render: ${passed} assertions passed`);
    console.log(`flow-target-render browser layer: ${browserAssertionsRun}/${BROWSER_ASSERTION_COUNT} ran, ` +
        `${browserAssertionsSkipped} SKIPPED`);
    if (browserAssertionsSkipped > 0) {
        console.log(`flow-target-render SKIPPED GROUPS: ${skippedGroups.join(', ')}`);
        // Never green proof: the run is reported as DEGRADED, and CI can make it fatal.
        if (process.env.SIDECOACH_REQUIRE_BROWSER === '1') {
            console.error('FAIL: SIDECOACH_REQUIRE_BROWSER=1 and the browser layer did not run.');
            console.log('flow-target-render FAIL');
            process.exit(1);
        }
        console.log(`flow-target-render DEGRADED: ${browserAssertionsSkipped} of ${BROWSER_ASSERTION_COUNT} ` +
            'browser assertions did NOT run. This is NOT proof the render path works.');
    }
    console.log('flow-target-render PASS');
}
run().catch((e) => {
    console.error(e);
    console.log('flow-target-render FAIL');
    process.exit(1);
});
//# sourceMappingURL=flow-target-render.test.js.map