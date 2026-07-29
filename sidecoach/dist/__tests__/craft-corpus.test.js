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
// Standalone test (sidecoach convention: no vitest; assert + process.exit).
//
// Guards the TEACH half across EVERY verb, wired 2026-07-29 (Jonah).
//
// The defect being fenced in: measured on 2026-07-29, exactly ONE of 26 live flow handlers emitted
// craft instruction. `grep -rln "polish-craft" src/flow-handler*.ts` returned one file. Ten handlers
// imported `design-laws.ts` and what they pulled out were defect DESCRIPTIONS - the rule's own name
// restated, or a rubric line like `Dimension 1: Accessibility (WCAG compliance, semantic HTML)`. A
// producer handed a list of rule names satisfies the rule names and improves nothing else.
//
// What is asserted here, and why each assertion can fail:
//   1. COVERAGE - every rule in the registry that a probe can FAIL resolves a craft note. Fails when
//      a rule is added without teaching content, which would put a bare defect name in a payload.
//   2. SUBSTANCE - each note's good/why/fix are real, distinct, and carry information beyond the
//      rule's own vocabulary. Fails when a note is padded out of the rule name, which is the same
//      defect wearing a different hat.
//   3. SELECTION - hardest-first, deduplicated, capped, stable across input order. Fails if the
//      brief goes back to being a constant block.
//   4. PROPORTIONALITY - the brief varies with the failures, and an empty subject list yields NO
//      brief. Fails if selection stops depending on the page.
//   5. PROBE HONESTY - an unreadable or source-free project is `measured: false`, and an
//      inconclusive rule is never counted as failed. Fails if a scan starts passing by default.
//   6. LIVE WIRING - the real handlers, executed, emit a brief before their findings. This is the
//      anti-drift assertion: it fails if the corpus is wired into a module no verb reaches.
//
// Run directly: npx ts-node src/__tests__/craft-corpus.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const craft_corpus_1 = require("../craft-corpus");
const craft_laws_1 = require("../craft-laws");
const craft_probe_1 = require("../craft-probe");
const craft_flow_1 = require("../craft-flow");
const flow_handler_accessibility_1 = require("../flow-handler-accessibility");
const flow_handler_typography_excellence_1 = require("../flow-handler-typography-excellence");
const flow_handlers_tier3_tier4_1 = require("../flow-handlers-tier3-tier4");
let failures = 0;
function ok(cond, label) { if (!cond) {
    console.error('FAIL ' + label);
    failures++;
} }
function contains(hay, needle, label) {
    if (!hay.includes(needle)) {
        console.error('FAIL ' + label + ': missing ' + JSON.stringify(needle));
        failures++;
    }
}
function absent(hay, needle, label) {
    if (hay.includes(needle)) {
        console.error('FAIL ' + label + ': unexpectedly contains ' + JSON.stringify(needle));
        failures++;
    }
}
// ---- 1. COVERAGE ------------------------------------------------------------------------------
const gaps = (0, craft_corpus_1.registryCraftGaps)();
ok(gaps.length === 0, `every registry rule resolves a craft note (uncovered: ${gaps.join(', ') || 'none'})`);
ok(Object.keys(craft_corpus_1.REGISTRY_CRAFT).length >= 30, `registry corpus carries the rules polish-craft does not (got ${Object.keys(craft_corpus_1.REGISTRY_CRAFT).length})`);
ok(Object.keys(craft_laws_1.LAW_CRAFT).length >= 60, `law corpus is substantive (got ${Object.keys(craft_laws_1.LAW_CRAFT).length})`);
ok((0, craft_laws_1.lawDomains)().length >= 10, `law corpus spans the flow domains (got ${(0, craft_laws_1.lawDomains)().length})`);
// A law key resolves, and an unknown key does NOT get guessed at.
ok(!!(0, craft_corpus_1.resolveCraftNote)('law/motion/duration-budget'), 'a law key resolves');
ok(!!(0, craft_corpus_1.resolveCraftNote)('a11y/form-control-labelled'), 'a registry key resolves');
ok(!!(0, craft_corpus_1.resolveCraftNote)('polish/scale-on-press'), 'a polish-craft key still resolves through the generalized entry point');
ok(!!(0, craft_corpus_1.resolveCraftNote)(1), 'a bare polish rule NUMBER still resolves');
ok((0, craft_corpus_1.resolveCraftNote)('nonsense/not-a-rule') === undefined, 'an unknown key resolves nothing');
ok((0, craft_corpus_1.resolveCraftNote)(null) === undefined, 'null resolves nothing');
ok((0, craft_corpus_1.resolveCraftNote)('') === undefined, 'empty string resolves nothing');
// Every law domain actually has notes in it (an empty bundle would silently produce no brief).
for (const d of (0, craft_laws_1.lawDomains)()) {
    ok((0, craft_laws_1.lawKeysForDomain)(d).length > 0, `law domain ${d} has at least one note`);
}
ok((0, craft_laws_1.lawKeysForDomains)(['motion', 'responsive']).length ===
    (0, craft_laws_1.lawKeysForDomain)('motion').length + (0, craft_laws_1.lawKeysForDomain)('responsive').length, 'multi-domain lookup is the union of its parts');
ok((0, craft_laws_1.lawKeysForDomain)('not-a-domain').length === 0, 'an unknown domain yields no keys');
// ---- 2. SUBSTANCE -----------------------------------------------------------------------------
const STOPWORDS = new Set(('a an and are as at be been but by can do does for from has have if in into is it its ' +
    'no not of on once only or so than that the their then there these they this to too use used uses using was ' +
    'what when where which while will with would you your one two more most also only every each any').split(' '));
const FIX_TEMPLATE = 'issue on the affected element';
const WHY_TEMPLATE = 'it undercuts the finished result';
const allNotes = [...Object.values(craft_corpus_1.REGISTRY_CRAFT), ...Object.values(craft_laws_1.LAW_CRAFT)];
for (const note of allNotes) {
    const tag = `note ${note.ruleKey}`;
    ok(note.good.trim().length >= 40, `${tag}: good is a real sentence (len ${note.good.trim().length})`);
    ok(note.why.trim().length >= 40, `${tag}: why is a real sentence (len ${note.why.trim().length})`);
    ok(note.fix.trim().length >= 40, `${tag}: fix is a real sentence (len ${note.fix.trim().length})`);
    ok(note.good !== note.why && note.why !== note.fix && note.good !== note.fix, `${tag}: three distinct fields`);
    ok(note.source.trim().length > 0, `${tag}: names its in-repo source`);
    absent(note.fix, FIX_TEMPLATE, `${tag}: fix is not the template`);
    absent(note.why, WHY_TEMPLATE, `${tag}: why is not the template`);
    // The real property a rule-name restatement fails is INFORMATION CONTENT beyond the rule's own
    // vocabulary. Strip the words in the rule key, the title and the stopword list, and a genuine
    // remediation still has substantial varied content left; one built from the rule name has almost none.
    const ownWords = new Set(`${note.ruleKey} ${note.title}`.toLowerCase().split(/[^a-z]+/).filter(Boolean));
    const novel = note.fix.toLowerCase().split(/[^a-z]+/).filter(Boolean)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !ownWords.has(w));
    ok(novel.length >= 10, `${tag}: fix carries content beyond the rule's own vocabulary (${novel.length} novel words)`);
    ok(new Set(novel).size >= 8, `${tag}: that content is varied, not one word repeated (${new Set(novel).size} distinct)`);
    // A law note has no registry severity, so it MUST carry its own or it silently sorts last and is
    // never taught when a brief is capped.
    if (note.ruleKey.startsWith('law/')) {
        ok(!!note.severity, `${tag}: a law note declares its own severity`);
        ok((0, craft_corpus_1.craftSeverityRank)(note) < 4, `${tag}: that severity ranks (got rank ${(0, craft_corpus_1.craftSeverityRank)(note)})`);
    }
}
// Some notes must carry an example or the example budget can never be spent.
ok(allNotes.filter((n) => !!n.example).length >= 8, `enough notes carry a snippet (got ${allNotes.filter((n) => !!n.example).length})`);
// ---- 3. SELECTION -----------------------------------------------------------------------------
// A blocker outranks a major outranks an advisory, across BOTH corpora.
const mixed = (0, craft_corpus_1.selectCraftNotes)([
    'polish/image-outline-neutral', // advisory (registry)
    'a11y/form-control-labelled', // blocker  (registry)
    'perf/image-dimensions', // major    (registry)
]);
ok(mixed[0]?.ruleKey === 'a11y/form-control-labelled', `blocker first (got ${mixed[0]?.ruleKey})`);
ok(mixed[2]?.ruleKey === 'polish/image-outline-neutral', `advisory last (got ${mixed[2]?.ruleKey})`);
// A law note ranks against a registry note rather than always sorting behind it.
const lawVsRule = (0, craft_corpus_1.selectCraftNotes)(['polish/image-outline-neutral', 'law/color/contrast-minimums']);
ok(lawVsRule[0]?.ruleKey === 'law/color/contrast-minimums', `a law blocker outranks a registry advisory (got ${lawVsRule[0]?.ruleKey})`);
// Duplicates collapse; unknowns drop.
ok((0, craft_corpus_1.selectCraftNotes)(['polish/scale-on-press', 1, 'polish-standard:1']).length === 1, 'duplicates collapse');
ok((0, craft_corpus_1.selectCraftNotes)(['who-knows', 4242]).length === 0, 'unknown subjects select nothing');
// The cap binds, and ordering does not depend on input order.
const manyKeys = Object.keys(craft_corpus_1.REGISTRY_CRAFT);
ok((0, craft_corpus_1.selectCraftNotes)(manyKeys).length === craft_corpus_1.MAX_BRIEF_NOTES, `the default cap binds (got ${(0, craft_corpus_1.selectCraftNotes)(manyKeys).length})`);
ok((0, craft_corpus_1.selectCraftNotes)(manyKeys, 3).length === 3, 'an explicit limit binds');
ok((0, craft_corpus_1.selectCraftNotes)(manyKeys, 0).length === 0, 'a zero limit yields nothing');
ok(JSON.stringify((0, craft_corpus_1.selectCraftNotes)([...manyKeys].reverse()).map((n) => n.ruleKey)) ===
    JSON.stringify((0, craft_corpus_1.selectCraftNotes)(manyKeys).map((n) => n.ruleKey)), 'selection order does not depend on input order');
// ---- 4. PROPORTIONALITY -----------------------------------------------------------------------
ok((0, craft_corpus_1.craftBriefLines)([]).length === 0, 'no subjects yields NO brief');
ok((0, craft_corpus_1.craftBriefLines)(['not-a-rule']).length === 0, 'only-unknown subjects yield NO brief');
const briefOne = (0, craft_corpus_1.craftBriefLines)(['a11y/form-control-labelled']);
const briefMany = (0, craft_corpus_1.craftBriefLines)(manyKeys);
ok(briefOne.length > 0, 'one failure yields a brief');
ok(briefMany.length > briefOne.length * 2, `a capped brief is materially longer than a one-note brief (${briefOne.length} vs ${briefMany.length})`);
const manyText = briefMany.join('\n');
contains(manyText, 'CRAFT BRIEF', 'brief is labelled');
contains(manyText, 'Good:', 'brief states what good looks like');
contains(manyText, 'Why:', 'brief states why it matters');
contains(manyText, 'Do:', 'brief states the concrete fix');
contains(manyText, 'Source:', 'brief cites its in-repo source');
contains(manyText, 'FAILED here', 'a findings brief says the rules failed');
// The cap disclosure names the limit that was APPLIED, checked through an explicit limit so the
// expectation cannot co-move with the module constant.
contains((0, craft_corpus_1.craftBriefLines)(manyKeys, { limit: 4 }).join('\n'), 'capped at 4', 'brief discloses the cap it applied');
absent(briefOne.join('\n'), 'capped at', 'an uncapped brief does not claim to have capped');
// Two different failure sets produce different briefs - the property a constant block fails.
ok((0, craft_corpus_1.craftBriefLines)(['a11y/form-control-labelled']).join('\n') !==
    (0, craft_corpus_1.craftBriefLines)(['anti-pattern/gradient-text']).join('\n'), 'different failures produce different briefs');
// The two modes make DIFFERENT provenance claims, and neither contradicts itself.
const standard = (0, craft_corpus_1.craftBriefLines)((0, craft_laws_1.lawKeysForDomain)('motion'), { mode: 'standard', domainLabel: 'motion' }).join('\n');
contains(standard, 'up-front standard', 'a standard brief says it is the standard');
contains(standard, 'not selected by measuring', 'a standard brief disclaims measurement');
absent(standard, 'FAILED here', 'a standard brief does not claim rules failed');
const findings = (0, craft_corpus_1.craftBriefLines)(['a11y/form-control-labelled'], { mode: 'findings' }).join('\n');
absent(findings, 'up-front standard', 'a findings brief does not call itself the standard');
// A measuredNote must not contradict the disclaimer that precedes it.
const both = (0, craft_corpus_1.craftBriefLines)((0, craft_laws_1.lawKeysForDomain)('motion'), { mode: 'standard', measuredNote: '3 rule(s) in this domain already fail.' }).join('\n');
absent(both, 'Nothing here was measured', 'the disclaimer does not contradict a measuredNote');
contains(both, 'already fail', 'the measuredNote survives');
// ---- 5. PROBE HONESTY -------------------------------------------------------------------------
(async () => {
    // A source-free directory is NOT a clean result.
    const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-empty-'));
    (0, craft_probe_1.resetCraftProbeCache)();
    const emptyProbe = await (0, craft_probe_1.probeProject)(emptyDir);
    ok(emptyProbe.measured === false, 'a source-free project is measured:false');
    ok(emptyProbe.failed.length === 0, 'a source-free project reports no failures');
    // A missing root degrades rather than throwing.
    (0, craft_probe_1.resetCraftProbeCache)();
    const missing = await (0, craft_probe_1.probeProject)(path.join(emptyDir, 'does-not-exist'));
    ok(missing.measured === false, 'a missing root is measured:false');
    ok(!!missing.error, 'a missing root records why');
    // A real broken page fails real rules, and inconclusive is kept SEPARATE from failed.
    const brokenDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-broken-'));
    fs.writeFileSync(path.join(brokenDir, 'index.html'), [
        '<!doctype html><html><head><style>',
        '.btn { transition: all 200ms; }',
        '.card { border-left: 3px solid #c00; }',
        'p { text-align: justify; }',
        '</style></head><body><h1>A</h1><h4>B</h4>',
        '<button class="btn">Go</button>',
        '<form><input type="text" placeholder="Email"></form>',
        '</body></html>',
    ].join('\n'));
    (0, craft_probe_1.resetCraftProbeCache)();
    const probe = await (0, craft_probe_1.probeProject)(brokenDir);
    ok(probe.measured === true, 'a project with source is measured:true');
    ok(probe.failed.length >= 5, `a broken page fails several rules (got ${probe.failed.length})`);
    ok(probe.inconclusive.length > 0, 'render-only rules land in inconclusive');
    const failedKeys = new Set(probe.failed.map((r) => r.canonicalRuleKey));
    for (const r of probe.inconclusive) {
        ok(!failedKeys.has(r.canonicalRuleKey), `${r.canonicalRuleKey}: inconclusive is not also counted as failed`);
    }
    ok(probe.results.length === probe.failed.length + probe.passed.length +
        probe.inconclusive.length + probe.notApplicable.length, 'every result lands in exactly one bucket');
    // Ordering is hardest-first and stable.
    const sorted = (0, craft_probe_1.sortProbedRules)(probe.failed);
    ok(JSON.stringify(sorted.map((r) => r.canonicalRuleKey)) ===
        JSON.stringify(probe.failed.map((r) => r.canonicalRuleKey)), 'probe.failed is already sorted');
    // Every failing rule gets a finding line WITH a fix.
    const lines = (0, craft_flow_1.findingLinesFor)(probe.failed);
    ok(lines.length === probe.failed.length, 'one finding line per failure (uncapped)');
    for (const l of lines)
        ok(l.includes(' -> '), `finding line carries a fix: ${l.slice(0, 60)}`);
    // ---- flowCraft shapes -----------------------------------------------------------------------
    (0, craft_probe_1.resetCraftProbeCache)();
    const checkBroken = await (0, craft_flow_1.flowCraft)(brokenDir, { shape: 'check', findingClasses: ['a11y'] });
    ok(checkBroken.mode === 'findings', `a check flow on a broken page is findings mode (got ${checkBroken.mode})`);
    ok(checkBroken.brief.length > 0, 'a check flow on a broken page teaches');
    (0, craft_probe_1.resetCraftProbeCache)();
    const checkEmpty = await (0, craft_flow_1.flowCraft)(emptyDir, { shape: 'check', findingClasses: ['a11y'] });
    ok(checkEmpty.brief.length === 0, 'a check flow with nothing to check teaches nothing');
    ok(checkEmpty.mode === 'unmeasured', `an unmeasured check flow says so (got ${checkEmpty.mode})`);
    contains(checkEmpty.scopeLine, 'not a clean result', 'an unmeasured scan does not present as clean');
    // INCONCLUSIVE IS NOT CLEAN. Cross-model review 2026-07-29 (High): a check flow returned
    // mode 'clean' whenever nothing FAILED, so an accessibility scan over static source - where
    // contrast, hit-area and every rendered rule are inconclusive without a live render - emitted
    // "every checked rule in this domain passed" about rules it had never evaluated.
    (0, craft_probe_1.resetCraftProbeCache)();
    const undecidedScope = await (0, craft_flow_1.flowCraft)(brokenDir, {
        shape: 'check',
        // Both of these need a live rendered scan, so neither can pass or fail from static source.
        ruleKeys: ['a11y/color-contrast', 'a11y/min-hit-area'],
    });
    ok(undecidedScope.failed.length === 0, 'the render-only scope has no static failures');
    ok(undecidedScope.undecided.length > 0, `the render-only scope reports undecided rules (got ${undecidedScope.undecided.length})`);
    ok(undecidedScope.mode === 'inconclusive', `an all-undecided check scope is 'inconclusive', not 'clean' (got ${undecidedScope.mode})`);
    const undecidedBlock = (0, craft_flow_1.craftGuidanceBlock)(undecidedScope, 'x').join('\n');
    absent(undecidedBlock, 'every rule in this domain was evaluated and passed', 'an undecided domain is NOT reported as passing');
    contains(undecidedBlock, 'not a clean bill', 'an undecided domain says so plainly');
    contains(undecidedBlock, 'could not be decided', 'an undecided domain says what happened');
    contains(undecidedBlock, 'a11y/', 'an undecided domain names which rules were not decided');
    contains(undecidedBlock, 'live render', 'an undecided domain says what would decide them');
    // And a genuinely all-decided-and-passing scope still reports clean.
    (0, craft_probe_1.resetCraftProbeCache)();
    const trulyClean = await (0, craft_flow_1.flowCraft)(brokenDir, { shape: 'check', ruleKeys: ['a11y/form-never-block-paste'] });
    if (trulyClean.failed.length === 0 && trulyClean.undecided.length === 0) {
        ok(trulyClean.mode === 'clean', `an all-decided passing scope is 'clean' (got ${trulyClean.mode})`);
        contains((0, craft_flow_1.craftGuidanceBlock)(trulyClean, 'x').join('\n'), 'evaluated and passed', 'a genuinely clean scope still says so');
    }
    // A malformed verdict must not poison the cache forever. Cross-model review 2026-07-29 (Medium):
    // a check returning undefined threw OUTSIDE the per-check try, the rejected promise was cached, and
    // every later probe of that path replayed the same rejection.
    {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const checks = require('../validators/checks').CHECKS;
        const victim = 'a11y/justified-text';
        const original = checks[victim];
        checks[victim] = () => undefined;
        (0, craft_probe_1.resetCraftProbeCache)();
        let threw = false;
        let probed;
        try {
            probed = await (0, craft_probe_1.probeProject)(brokenDir);
        }
        catch {
            threw = true;
        }
        checks[victim] = original;
        (0, craft_probe_1.resetCraftProbeCache)();
        ok(!threw, 'a malformed verdict does not reject the probe');
        ok(!!probed && Array.isArray(probed.results), 'a malformed verdict still yields a usable probe');
        const row = probed?.results?.find((r) => r.canonicalRuleKey === victim);
        ok(!!row && row.status === 'inconclusive', `a malformed verdict is recorded as inconclusive (got ${row && row.status})`);
        ok(!probed.failed.some((r) => r.canonicalRuleKey === victim), 'a malformed verdict is NOT reported as a failure');
        // The next probe recovers rather than replaying a cached rejection.
        const after = await (0, craft_probe_1.probeProject)(brokenDir);
        ok(after.measured === true, 'a later probe recovers after a malformed verdict');
    }
    // The cache key includes designTokens, so two token sets do not share one result.
    {
        (0, craft_probe_1.resetCraftProbeCache)();
        const p1 = await (0, craft_probe_1.probeProject)(brokenDir, { designTokens: { a: 1 } });
        const p2 = await (0, craft_probe_1.probeProject)(brokenDir, { designTokens: { a: 2 } });
        ok(p1 !== p2, 'different designTokens do not share one cached probe');
        const p3 = await (0, craft_probe_1.probeProject)(brokenDir, { designTokens: { a: 1 } });
        ok(p1.results.length === p3.results.length, 'the same designTokens reuse the cached probe');
        (0, craft_probe_1.resetCraftProbeCache)();
    }
    (0, craft_probe_1.resetCraftProbeCache)();
    const produceEmpty = await (0, craft_flow_1.flowCraft)(emptyDir, { shape: 'produce', lawDomains: ['motion'] });
    ok(produceEmpty.brief.length > 0, 'a produce flow teaches its standard even with nothing to measure');
    const noPath = await (0, craft_flow_1.flowCraft)(undefined, { shape: 'produce', lawDomains: ['motion'] });
    ok(noPath.brief.length > 0, 'a produce flow with no project path still teaches');
    contains(noPath.scopeLine, 'no project path', 'a missing project path is stated');
    // Scope isolation: a flow cannot teach another flow's domain.
    (0, craft_probe_1.resetCraftProbeCache)();
    const narrow = await (0, craft_flow_1.flowCraft)(brokenDir, { shape: 'check', ruleKeys: ['a11y/justified-text'] });
    ok(narrow.failed.every((r) => r.canonicalRuleKey === 'a11y/justified-text'), 'an explicit rule allowlist excludes everything else');
    // The guidance block always puts TEACH before CHECK.
    const block = (0, craft_flow_1.craftGuidanceBlock)(checkBroken, 'nothing could be checked.').join('\n');
    const bIdx = block.indexOf('CRAFT BRIEF');
    const fIdx = block.indexOf('FINDINGS - what was actually measured');
    ok(bIdx >= 0 && fIdx > bIdx, 'craftGuidanceBlock puts the brief before the findings');
    const cleanBlock = (0, craft_flow_1.craftGuidanceBlock)({ ...checkBroken, brief: [], mode: 'clean', findingLines: [], failed: [] }, 'x').join('\n');
    contains(cleanBlock, 'nothing to teach', 'a clean check flow says so rather than printing a brief');
    // ---- 6. LIVE WIRING, against the real handlers ------------------------------------------------
    // This is the anti-drift assertion. A corpus wired into a module no verb reaches would pass every
    // assertion above and fail here.
    const cases = [
        ['flowI_accessibility', new flow_handler_accessibility_1.FlowIAccessibilityHandler()],
        ['flowS_typography_excellence', new flow_handler_typography_excellence_1.FlowSTypographyExcellenceHandler()],
        ['flowK_multi_lens_audit', new flow_handlers_tier3_tier4_1.FlowKMultiLensAuditHandler()],
    ];
    for (const [flowId, handler] of cases) {
        (0, craft_probe_1.resetCraftProbeCache)();
        const res = await handler.execute({ flowId, projectPath: brokenDir, utterance: 'test' });
        const payload = (res.guidance || []).join('\n');
        ok(res.status === 'success', `${flowId}: handler succeeded (status ${res.status})`);
        const cIdx = payload.indexOf('CRAFT BRIEF');
        const fIdx2 = payload.indexOf('FINDINGS - what was actually measured');
        ok(cIdx >= 0, `${flowId}: live payload contains a craft brief`);
        ok(fIdx2 > cIdx, `${flowId}: the brief precedes the findings in the live payload`);
        contains(payload, 'Good:', `${flowId}: live payload teaches what good looks like`);
        contains(payload, 'Why:', `${flowId}: live payload teaches why`);
        contains(payload, 'Do:', `${flowId}: live payload teaches the fix`);
        contains(payload, 'Source:', `${flowId}: live payload cites a source`);
        absent(payload, FIX_TEMPLATE, `${flowId}: live payload carries no fix template`);
    }
    // The detector half survives: flowS still emits its own type-scale block below the brief.
    (0, craft_probe_1.resetCraftProbeCache)();
    const sRes = await new flow_handler_typography_excellence_1.FlowSTypographyExcellenceHandler()
        .execute({ flowId: 'flowS_typography_excellence', projectPath: brokenDir });
    const sPayload = (sRes.guidance || []).join('\n');
    contains(sPayload, 'TYPE SCALE:', 'flowS keeps its own guidance below the brief');
    ok(Array.isArray(sRes.checklist) && sRes.checklist.length > 0, 'flowS keeps its checklist');
    // PROPORTIONALITY, live: a clean project yields a shorter check-flow payload than a broken one.
    const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-clean-'));
    fs.writeFileSync(path.join(cleanDir, 'index.html'), '<!doctype html><html><head><style>h1 { font-family: Charter, serif; }</style></head>' +
        '<body><h1>Steel bolts ship Tuesday</h1></body></html>');
    (0, craft_probe_1.resetCraftProbeCache)();
    const kBroken = await new flow_handlers_tier3_tier4_1.FlowKMultiLensAuditHandler()
        .execute({ flowId: 'flowK_multi_lens_audit', projectPath: brokenDir });
    (0, craft_probe_1.resetCraftProbeCache)();
    const kClean = await new flow_handlers_tier3_tier4_1.FlowKMultiLensAuditHandler()
        .execute({ flowId: 'flowK_multi_lens_audit', projectPath: cleanDir });
    const brokenLen = (kBroken.guidance || []).join('\n').length;
    const cleanLen = (kClean.guidance || []).join('\n').length;
    ok(cleanLen < brokenLen, `a clean project gets a shorter audit payload (${cleanLen} vs ${brokenLen} chars)`);
    for (const d of [emptyDir, brokenDir, cleanDir])
        fs.rmSync(d, { recursive: true, force: true });
    if (failures > 0) {
        console.error('craft-corpus: ' + failures + ' failure(s)');
        process.exit(1);
    }
    console.log('craft-corpus: all checks passed');
})().catch((e) => { console.error('craft-corpus: threw ' + String(e)); process.exit(1); });
//# sourceMappingURL=craft-corpus.test.js.map