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
// Guards the TEACH half of the `polish` verb, wired 2026-07-29 (Jonah).
//
// The defect being fenced in: the polish payload named rules and taught nothing, and the executive
// report's "After" column fell through to `resolve the <rule name> issue on the affected element`
// for every polish rule while its plain-language clause fell through to
// `it undercuts the finished result`. The efficacy trial measured the consequence - a producer
// handed a list of rule names satisfies the rule names and improves nothing else.
//
// What is asserted here, and why each assertion can fail:
//   1. COVERAGE - every `polish-standard:N` rule in the registry has a craft note. Fails if a rule
//      is added to the registry without teaching content (the payload would silently template).
//   2. SUBSTANCE - each note's good/why/fix are non-empty, distinct from each other, and do not
//      restate the rule name. Fails if a note is padded out with the rule's own words, which is
//      exactly the defect this file exists to prevent recurring in a new place.
//   3. SELECTION - notes come from the FAILING rules only, hardest-first, capped. Fails if the
//      brief goes back to being a constant block.
//   4. PROPORTIONALITY - a one-failure brief is materially shorter than an eight-failure brief.
//      Fails if selection stops varying with the findings.
//   5. THE TEMPLATES ARE GONE from the executive report for polish rules, and STILL PRESENT for a
//      genuinely unknown rule. Fails in either direction.
//   6. FINDINGS SURVIVE - the wiring is additive. Asserted against the live flow handler output,
//      not a fixture.
//
// Run directly: npx ts-node src/__tests__/polish-craft.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const polish_craft_1 = require("../polish-craft");
const flow_handler_tactical_polish_1 = require("../flow-handler-tactical-polish");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const present = require(path.join(__dirname, '..', '..', 'bin', 'sidecoach-present'));
const renderExecutiveReport = present.renderExecutiveReport;
// BUILD PRECONDITION. Cross-model review 2026-07-29 (High): section 5 drives bin/sidecoach-present.js,
// which lazily requires ../dist/polish-craft, so a source-only run fails on assertions that have
// nothing to do with the source. `npm test` builds first (package.json: `npm run build && ...`), but
// invoking this file directly does not, so the missing build is named here instead of surfacing as
// four confusing content failures.
const DIST_CRAFT = path.join(__dirname, '..', '..', 'dist', 'polish-craft.js');
if (!fs.existsSync(DIST_CRAFT)) {
    console.error(`FAIL build precondition: ${DIST_CRAFT} is missing - run \`npm run build\` in sidecoach/ first.`);
    console.error('polish-craft: 1 failure(s)');
    process.exit(1);
}
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
const FIX_TEMPLATE = 'issue on the affected element';
const WHY_TEMPLATE = 'it undercuts the finished result';
// ---- 1. COVERAGE ------------------------------------------------------------------------------
const registry = (0, polish_craft_1.registryPolishRules)();
ok(registry.length === 24, `registry exposes 24 polish-standard rules (got ${registry.length})`);
const gaps = (0, polish_craft_1.craftCoverageGaps)();
ok(gaps.length === 0, `every polish-standard rule has a craft note (uncovered: ${gaps.join(', ') || 'none'})`);
// Number, alias, rule- alias and canonical key all resolve to the same note.
const first = registry[0];
ok(!!first, 'registry has a first rule');
if (first) {
    const viaNumber = (0, polish_craft_1.normalizeCraftKey)(first.n);
    ok(viaNumber === first.key, `number ${first.n} normalizes to ${first.key} (got ${viaNumber})`);
    ok((0, polish_craft_1.normalizeCraftKey)(`polish-standard:${first.n}`) === first.key, 'bare alias normalizes');
    ok((0, polish_craft_1.normalizeCraftKey)(`polish-standard:rule-${first.n}`) === first.key, 'BuildReport alias normalizes');
    ok((0, polish_craft_1.normalizeCraftKey)(first.key) === first.key, 'canonical key normalizes to itself');
}
ok((0, polish_craft_1.normalizeCraftKey)('not-a-rule-at-all') === undefined, 'unknown rule does not normalize');
ok((0, polish_craft_1.normalizeCraftKey)(null) === undefined, 'null does not normalize');
ok((0, polish_craft_1.normalizeCraftKey)(9999) === undefined, 'out-of-range rule number does not normalize');
// Function words carry no remediation information, so they are excluded from the substance count.
const STOPWORDS = new Set(('a an and are as at be been but by can do does for from has have if in into is it its ' +
    'no not of on once only or so than that the their then there these they this to too use used uses using was ' +
    'what when where which while will with would you your').split(' '));
// ---- 2. SUBSTANCE -----------------------------------------------------------------------------
// A note whose fix restates the rule name is the template defect wearing a different hat, so the
// three fields must be non-trivial, distinct, and not built out of the rule key's own words.
const allNotes = [...Object.values(polish_craft_1.POLISH_CRAFT), ...Object.values(polish_craft_1.POLISH_FINDING_CRAFT)];
for (const note of allNotes) {
    const tag = `note ${note.ruleKey}`;
    ok(note.good.trim().length >= 40, `${tag}: good is a real sentence (len ${note.good.trim().length})`);
    ok(note.why.trim().length >= 40, `${tag}: why is a real sentence (len ${note.why.trim().length})`);
    ok(note.fix.trim().length >= 40, `${tag}: fix is a real sentence (len ${note.fix.trim().length})`);
    ok(note.good !== note.why && note.why !== note.fix && note.good !== note.fix, `${tag}: three distinct fields`);
    ok(note.source.trim().length > 0, `${tag}: names its in-repo source`);
    absent(note.fix, FIX_TEMPLATE, `${tag}: fix is not the template`);
    absent(note.why, WHY_TEMPLATE, `${tag}: why is not the template`);
    // SUBSTANCE, tested rather than asserted. Cross-model review 2026-07-29 (Low) called the previous
    // pair weak: a bare word count is satisfied by verbose filler, and `keyWords.length > 0` only
    // described the fixture. The real property a rule-name restatement fails is INFORMATION CONTENT
    // beyond the rule's own vocabulary: strip the words that appear in the rule key or the title, and
    // in stopwords, and a genuine remediation still has substantial content left. A fix built out of
    // the rule name (`resolve the scale on press issue on the affected element`) leaves almost none.
    const ownWords = new Set(`${note.ruleKey} ${note.title}`.toLowerCase().split(/[^a-z]+/).filter(Boolean));
    const novel = note.fix.toLowerCase().split(/[^a-z]+/).filter(Boolean)
        .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !ownWords.has(w));
    ok(novel.length >= 10, `${tag}: fix carries content beyond the rule's own vocabulary (${novel.length} novel words)`);
    ok(new Set(novel).size >= 8, `${tag}: that content is varied, not one word repeated (${new Set(novel).size} distinct)`);
}
// At least MAX_EXAMPLES notes carry an example, or the example budget can never be spent.
const withExamples = Object.values(polish_craft_1.POLISH_CRAFT).filter((n) => !!n.example);
ok(withExamples.length >= polish_craft_1.MAX_EXAMPLES, `at least ${polish_craft_1.MAX_EXAMPLES} notes carry an example (got ${withExamples.length})`);
// ---- 3. SELECTION -----------------------------------------------------------------------------
// Only failing rules are taught. A rule that passed contributes nothing.
const failing = [1, 8]; // scale-on-press (major) and text-wrap-balance (advisory)
const selected = (0, polish_craft_1.selectCraftNotes)(failing);
ok(selected.length === 2, `two failing rules select two notes (got ${selected.length})`);
ok(selected[0]?.ruleKey === 'polish/scale-on-press', `hardest-first: major before advisory (got ${selected[0]?.ruleKey})`);
ok(selected[1]?.ruleKey === 'polish/text-wrap-balance', `advisory sorts last (got ${selected[1]?.ruleKey})`);
// A blocker outranks a major.
const withBlocker = (0, polish_craft_1.selectCraftNotes)([1, 18]); // scale-on-press (major), focus-visible (blocker)
ok(withBlocker[0]?.ruleKey === 'a11y/focus-visible', `blocker sorts before major (got ${withBlocker[0]?.ruleKey})`);
// Duplicates collapse.
ok((0, polish_craft_1.selectCraftNotes)([1, 1, 'polish-standard:rule-1', 'polish/scale-on-press']).length === 1, 'duplicate rules collapse to one note');
// Unknown rules are dropped, not guessed at.
ok((0, polish_craft_1.selectCraftNotes)(['who-knows', 4242]).length === 0, 'unknown rules select nothing');
// The cap holds.
const allRuleNumbers = registry.map((r) => r.n);
// The label is deliberately FREE of MAX_TAUGHT_NOTES. Cross-model review 2026-07-29 (Low): with the
// constant interpolated, a mutation that changes the constant also changed the expected-failure
// string the mutation control greps for, so the control and the mutation moved together.
ok((0, polish_craft_1.selectCraftNotes)(allRuleNumbers).length === polish_craft_1.MAX_TAUGHT_NOTES, `all 24 failing rules select exactly MAX_TAUGHT_NOTES notes (cap ${polish_craft_1.MAX_TAUGHT_NOTES}, got ${(0, polish_craft_1.selectCraftNotes)(allRuleNumbers).length})`);
// Ordering is stable across a shuffled input.
const shuffled = [...allRuleNumbers].reverse();
ok(JSON.stringify((0, polish_craft_1.selectCraftNotes)(shuffled).map((n) => n.ruleKey)) ===
    JSON.stringify((0, polish_craft_1.selectCraftNotes)(allRuleNumbers).map((n) => n.ruleKey)), 'selection order does not depend on input order');
// ---- 4. PROPORTIONALITY -----------------------------------------------------------------------
const briefOne = (0, polish_craft_1.craftBriefLines)([1]);
const briefAll = (0, polish_craft_1.craftBriefLines)(allRuleNumbers);
const briefNone = (0, polish_craft_1.craftBriefLines)([]);
ok(briefNone.length === 0, 'a page with no failures gets no brief');
ok(briefOne.length > 0, 'a page with one failure gets a brief');
ok(briefAll.length > briefOne.length * 2, `an 8-note brief is materially longer than a 1-note brief (${briefOne.length} vs ${briefAll.length} lines)`);
const briefAllText = briefAll.join('\n');
contains(briefAllText, 'CRAFT BRIEF', 'brief is labelled');
contains(briefAllText, 'Good:', 'brief states what good looks like');
contains(briefAllText, 'Why:', 'brief states why it matters');
contains(briefAllText, 'Do:', 'brief states the concrete fix');
// The cap disclosure is checked through an EXPLICIT limit, not the module constant. Cross-model
// review 2026-07-29 (Low) flagged the co-moving-expectation problem: with `capped at ${MAX_TAUGHT_NOTES}`
// as the needle, a mutation that changes the constant also changes what the test looks for, so the
// control and the mutation move together and the assertion proves less than it appears to.
contains((0, polish_craft_1.craftBriefLines)(allRuleNumbers, { limit: 5 }).join('\n'), 'capped at 5', 'brief discloses the cap it actually applied');
ok((0, polish_craft_1.selectCraftNotes)(allRuleNumbers, 5).length === 5, 'an explicit limit binds');
contains(briefAllText, 'capped at', 'the default-limit brief discloses that it capped');
absent(briefOne.join('\n'), 'capped at', 'an uncapped brief does not claim to have capped');
// Example budget is honoured: no more than MAX_EXAMPLES notes emit a snippet.
const exampleKeys = (0, polish_craft_1.selectCraftNotes)(allRuleNumbers).filter((n) => !!n.example);
const snippetsInBrief = exampleKeys.filter((n) => briefAllText.includes((n.example || '').split('\n')[0])).length;
ok(snippetsInBrief <= polish_craft_1.MAX_EXAMPLES, `at most ${polish_craft_1.MAX_EXAMPLES} examples emitted (got ${snippetsInBrief})`);
// A brief teaching only passed rules would be a constant; assert the brief for two DIFFERENT
// failure sets differs.
ok((0, polish_craft_1.craftBriefLines)([1]).join('\n') !== (0, polish_craft_1.craftBriefLines)([8]).join('\n'), 'different failures produce different briefs');
// ---- 5. THE EXECUTIVE REPORT NO LONGER TEMPLATES POLISH RULES ---------------------------------
const polishReportResult = {
    buildReport: {
        composite: 'polish',
        verdict: 'warnings-only',
        overallGrade: 'B',
        severityCounts: { blocking: 0, warning: 3, info: 0 },
        findings: [
            { rule: 'polish-standard:rule-1', source: 'flowJ_tactical_polish', severity: 'warning', message: 'Polish Standard: 17/24 rules passed (70.8%)' },
            { rule: 'polish-standard:rule-8', source: 'flowJ_tactical_polish', severity: 'warning', message: 'Polish Standard: 17/24 rules passed (70.8%)' },
            { rule: 'absolute-ban-p1', source: 'flowJ_tactical_polish', severity: 'warning', message: 'absolute-ban-p1 = 1' },
        ],
    },
    flowResults: [{ flowId: 'flowJ_tactical_polish' }],
};
const polishRendered = renderExecutiveReport(polishReportResult, '/sidecoach polish index.html');
absent(polishRendered, FIX_TEMPLATE, 'polish report: no templated After cell');
absent(polishRendered, WHY_TEMPLATE, 'polish report: no templated why clause');
contains(polishRendered, 'scale: 0.96', 'polish report: After cell carries the real value');
contains(polishRendered, 'text-wrap: balance', 'polish report: After cell carries the real property');
// The measured message is still there - the wiring is additive, not a replacement.
contains(polishRendered, '17/24 rules passed', 'polish report: keeps the measured Before message');
contains(polishRendered, 'absolute-ban-p1 = 1', 'polish report: keeps the ban finding');
// The why clause is CLAUSE-shaped, because the renderer wraps it in "flagged; <clause>.".
// A sentence handed over raw produced "flagged; It is reported ... .." - capital plus doubled stop.
for (const rule of ['polish-standard:rule-1', 'violation-count', 'anti-patterns:ban-side-stripe-borders']) {
    const clause = (0, polish_craft_1.craftReason)(rule);
    ok(!!clause, `clause ${rule}: resolves`);
    if (clause) {
        ok(!/\.\s*$/.test(clause), `clause ${rule}: no trailing period (ends ${JSON.stringify(clause.slice(-24))})`);
        ok(!/\. /.test(clause), `clause ${rule}: single sentence only`);
        ok(!/^[A-Z][a-z]/.test(clause), `clause ${rule}: not a capitalised sentence (starts ${JSON.stringify(clause.slice(0, 24))})`);
    }
}
// The rendered line must read as one sentence: no ".." and no "; X" with a capitalised X.
ok(!/\.\./.test(polishRendered), 'polish report: no doubled full stop in the why clause');
ok(!/flagged; [A-Z][a-z]/.test(polishRendered), 'polish report: why clause is not capitalised mid-sentence');
// A validator's OWN remediation still wins over the corpus.
const withOwnFix = renderExecutiveReport({
    buildReport: {
        verdict: 'warnings-only', severityCounts: { warning: 1 },
        findings: [{ rule: 'polish-standard:rule-1', severity: 'warning', message: 'no :active scale(0.96) press feedback', fix: 'MEASURED-REMEDIATION-WINS' }],
    },
    flowResults: [{ flowId: 'flowJ_tactical_polish' }],
}, 'polish');
contains(withOwnFix, 'MEASURED-REMEDIATION-WINS', 'a measured fix outranks the corpus');
// A genuinely unknown rule STILL gets the template - the fallback was not deleted.
const unknownRendered = renderExecutiveReport({
    buildReport: {
        verdict: 'warnings-only', severityCounts: { warning: 1 },
        findings: [{ rule: 'some-future-rule', severity: 'warning', message: 'some-future-rule = 1' }],
    },
    flowResults: [{ flowId: 'flowJ_tactical_polish' }],
}, 'polish');
contains(unknownRendered, FIX_TEMPLATE, 'unknown rule keeps the fix template fallback');
contains(unknownRendered, WHY_TEMPLATE, 'unknown rule keeps the why template fallback');
// Named bans resolve dynamically from the ban reference, so a new ban needs no edit here.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { loadAbsoluteBans } = require('../reference-loader');
const bans = loadAbsoluteBans();
ok(bans.length >= 5, `ban reference exposes its bans (got ${bans.length})`);
for (const ban of bans) {
    const rule = `anti-patterns:ban-${ban.name}`;
    const note = (0, polish_craft_1.craftNote)(rule);
    ok(!!note, `ban ${ban.name}: resolves a craft note`);
    if (note) {
        contains(note.fix, ban.rewriteOptions[0], `ban ${ban.name}: fix carries the prescribed rewrite`);
        absent(note.fix, FIX_TEMPLATE, `ban ${ban.name}: fix is not the template`);
    }
}
ok((0, polish_craft_1.craftNote)('anti-patterns:ban-not-a-real-ban') === undefined, 'an unknown ban does not resolve');
const banRendered = renderExecutiveReport({
    buildReport: {
        verdict: 'warnings-only', severityCounts: { warning: 1 },
        findings: [{ rule: 'anti-patterns:ban-side-stripe-borders', severity: 'warning', message: 'Absolute ban scan: 1 findings' }],
    },
    flowResults: [{ flowId: 'flowJ_tactical_polish' }],
}, 'polish');
absent(banRendered, FIX_TEMPLATE, 'ban report: no templated After cell');
absent(banRendered, WHY_TEMPLATE, 'ban report: no templated why clause');
contains(banRendered, 'Background tints', 'ban report: After cell carries a prescribed rewrite');
// The audit rules keep their own map, unchanged by the wiring.
ok((0, polish_craft_1.craftRemediation)('low-contrast') === undefined, 'audit rules are not in the craft corpus');
const auditRendered = renderExecutiveReport({
    audit: {
        renderUrl: 'http://localhost:4830', verdict: 'blocked', totalFindings: 1, rendered: true,
        unavailableReasons: [], lenses: { objective: { available: true, findings: 1 }, subjective: { available: true, findings: 0 } },
        byRule: [{ rule: 'low-contrast', lens: 'objective', count: 1 }], topFixes: [{ rule: 'low-contrast', selector: '.a' }],
    },
}, 'audit');
contains(auditRendered, 'raise the text or background contrast', 'audit map still drives audit fixes');
// ---- 6. FINDINGS SURVIVE, LIVE ----------------------------------------------------------------
// Run the real handler over a real page in a temp project. Asserts against the shipped payload,
// not a fixture, so a change that drops the detector half fails here.
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'polish-craft-test-'));
fs.writeFileSync(path.join(tmp, 'index.html'), [
    '<!doctype html><html><head><style>',
    '.btn { transition: all 200ms; border-radius: 12px; padding: 8px; }',
    '.btn:hover { animation: pulse 200ms; }',
    '.card { border-left: 3px solid #c00; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }',
    '.count { font-size: 24px; }',
    '@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }',
    '</style></head><body><h1>Seamless synergy</h1><button class="btn">Go</button>',
    '<div class="card"><span class="count">42</span></div></body></html>',
].join('\n'));
(async () => {
    const handler = new flow_handler_tactical_polish_1.FlowJTacticalPolishHandler();
    const res = await handler.execute({ projectPath: tmp, flowId: 'flowJ_tactical_polish' });
    const payload = (res.guidance || []).join('\n');
    ok(res.status === 'success', `handler succeeded (status ${res.status})`);
    // TEACH is present and comes BEFORE CHECK.
    const craftIdx = payload.indexOf('CRAFT BRIEF');
    const findIdx = payload.indexOf('FINDINGS - what was actually measured');
    ok(craftIdx >= 0, 'live payload contains the craft brief');
    ok(findIdx >= 0, 'live payload contains the findings header');
    ok(craftIdx >= 0 && findIdx >= 0 && craftIdx < findIdx, 'craft brief precedes the findings');
    contains(payload, 'Good:', 'live payload teaches what good looks like');
    contains(payload, 'Why:', 'live payload teaches why');
    // CHECK survives: the detector half still reports.
    contains(payload, 'Validation Matrix', 'live payload keeps the validation matrix');
    contains(payload, 'POLISH STANDARD', 'live payload keeps the polish standard block');
    contains(payload, 'BAN: side-stripe-borders', 'live payload keeps the absolute-ban finding');
    contains(payload, 'LINGUISTIC BAN SCAN', 'live payload keeps the linguistic scan');
    ok(Array.isArray(res.validationResults) && res.validationResults.length >= 3, `live result keeps its validationResults (got ${(res.validationResults || []).length})`);
    ok(Array.isArray(res.checklist) && res.checklist.length >= 20, `live result keeps its checklist (got ${(res.checklist || []).length})`);
    // NEW: each failing polish rule is named with its measured message, which the old payload never did.
    contains(payload, '[polish/no-transition-all]', 'live payload names the failing rule by key');
    ok(/- \[polish\/[a-z-]+\] .+ -> .+/.test(payload), 'live payload pairs each failing rule with a fix');
    // The retired constant block is gone.
    absent(payload, 'SCALE & PRESS (Required)', 'the always-on constant block is retired');
    // PROPORTIONALITY, live: a clean page gets a shorter payload than a broken one.
    const cleanDir = fs.mkdtempSync(path.join(os.tmpdir(), 'polish-craft-clean-'));
    fs.writeFileSync(path.join(cleanDir, 'index.html'), '<!doctype html><html><head><style>.a { color: #333; }</style></head><body><p>Steel bolts ship Tuesday.</p></body></html>');
    const cleanRes = await handler.execute({ projectPath: cleanDir, flowId: 'flowJ_tactical_polish' });
    const cleanPayload = (cleanRes.guidance || []).join('\n');
    ok(cleanPayload.length < payload.length, `a cleaner page gets a shorter payload (${cleanPayload.length} vs ${payload.length} chars)`);
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.rmSync(cleanDir, { recursive: true, force: true });
    if (failures > 0) {
        console.error('polish-craft: ' + failures + ' failure(s)');
        process.exit(1);
    }
    console.log('polish-craft: all checks passed');
})().catch((e) => { console.error('polish-craft: threw ' + String(e)); process.exit(1); });
//# sourceMappingURL=polish-craft.test.js.map