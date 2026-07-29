"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Standalone test (sidecoach convention: no vitest; assert + process.exit).
//
// Guards the CRAFT FLOOR - the mechanism that loads craft instruction before a UI edit regardless of
// which verb ran. Added 2026-07-29 (Jonah).
//
// WHY THIS IS A SEPARATE SUITE FROM craft-corpus.test.ts. The brief and the floor are deliberately
// different mechanisms and the one thing that must never happen is them blending: a reader who cannot
// tell a measurement from a standing rule cannot act correctly on either. Separate suites keep the
// distinguishing properties asserted separately, so a change that turns the floor into a findings
// report fails here rather than being absorbed into a passing corpus suite.
//
// What is asserted, and why each can fail:
//   1. INTEGRITY - every floor key resolves a note, so the floor cannot silently shorten.
//   2. SELF-IDENTIFICATION - the payload says it is a FLOOR, unconditional, and unmeasured. Fails if
//      the wording drifts toward implying findings.
//   3. REAL VALUES - the floor carries actual numbers, not instructions to pick one.
//   4. UNCONDITIONALITY - the floor is identical for a clean project and a broken one, because it is
//      not selected by failure. This is the inverse of the brief's proportionality assertion, and it
//      is the property that makes the floor un-routable-around.
//   5. REFUSALS CARRY REPLACEMENTS - a ban with no rewrite sends the producer looking for a variant.
//   6. UI DETECTION - isUiPath accepts authored UI and rejects logic, generated output and tests.
//   7. NO OVERLAP CONFUSION - the floor never emits the brief's findings header, and vice versa.
//
// Run directly: npx ts-node src/__tests__/craft-floor.test.ts
const craft_floor_1 = require("../craft-floor");
const craft_corpus_1 = require("../craft-corpus");
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
// ---- 1. INTEGRITY -----------------------------------------------------------------------------
const gaps = (0, craft_floor_1.floorCoverageGaps)();
ok(gaps.length === 0, `every floor key resolves a note (unresolved: ${gaps.join(', ') || 'none'})`);
ok(craft_floor_1.FLOOR_KEYS.length >= 10, `the floor is substantive (got ${craft_floor_1.FLOOR_KEYS.length} keys)`);
ok((0, craft_floor_1.floorNotes)().length === craft_floor_1.FLOOR_KEYS.length, 'every floor key produces a note');
ok(new Set(craft_floor_1.FLOOR_KEYS).size === craft_floor_1.FLOOR_KEYS.length, 'no duplicate floor keys');
// Each floor note must carry a source, or the floor asserts without being checkable.
for (const n of (0, craft_floor_1.floorNotes)()) {
    ok(!!n.source && n.source.trim().length > 0, `floor note ${n.ruleKey} names its source`);
    ok(n.fix.trim().length >= 40, `floor note ${n.ruleKey} carries a real fix`);
}
// ---- 2. SELF-IDENTIFICATION -------------------------------------------------------------------
const text = (0, craft_floor_1.craftFloorText)();
contains(text, 'CRAFT FLOOR', 'floor labels itself');
contains(text, 'This is a FLOOR, not findings', 'floor distinguishes itself from findings');
contains(text, 'not because any sidecoach verb ran', 'floor states it needed no verb');
contains(text, 'not because anything was measured', 'floor disclaims measurement');
contains(text, 'Nothing here is a defect report', 'floor says it is not a defect report');
contains(text, 'override any value here', 'floor yields to a pinned brief and project tokens');
// It must NOT claim rules failed - that is the brief's claim, and conflating them misleads.
absent(text, 'FAILED here', 'floor does not claim rules failed');
absent(text, 'rules that FAILED', 'floor does not claim rules failed (2)');
absent(text, 'Rules that passed are omitted', 'floor does not describe selection by failure');
// And it points at the verb for real findings, so the reader knows where measurement lives.
contains(text, 'sidecoach audit', 'floor points at the verb for measured findings');
// ---- 3. REAL VALUES ---------------------------------------------------------------------------
for (const needle of ['4.5:1', '3:1', '44x44', '65ch', ':focus-visible', 'prefers-reduced-motion']) {
    contains(text, needle, `floor carries the real value ${needle}`);
}
// Real numbers, not placeholders.
absent(text, 'add a value', 'floor does not tell the reader to add an unspecified value');
absent(text, '<value>', 'floor carries no placeholder tokens');
absent(text, 'TODO', 'floor carries no TODOs');
// ---- 4. UNCONDITIONALITY ----------------------------------------------------------------------
// The floor does not vary with a project, because it is not selected by measurement. Two calls with
// different file paths differ ONLY in the header's file mention.
const a = (0, craft_floor_1.craftFloorText)({ filePath: '/a/clean.css' });
const b = (0, craft_floor_1.craftFloorText)({ filePath: '/b/broken.css' });
ok(a !== b, 'the floor names the file being edited');
ok(a.replace('/a/clean.css', 'X') === b.replace('/b/broken.css', 'X'), 'the floor content is otherwise identical regardless of the project');
// Never empty. The brief is silent on a clean page; the floor is never silent - that is the point.
ok((0, craft_floor_1.craftFloorLines)().length > 0, 'the floor is never empty');
ok((0, craft_floor_1.craftFloorText)({ refusals: false }).length > 0, 'the floor is non-empty without refusals');
ok((0, craft_floor_1.craftFloorText)({ limit: 0 }).length > 0, 'the floor still frames itself with zero notes');
// Both render forms work and the full form carries the rationale the compact form drops.
const full = (0, craft_floor_1.craftFloorText)({ form: 'full' });
contains(full, 'Why:', 'the full form carries the rationale');
contains(full, 'Good:', 'the full form states the target state');
contains((0, craft_floor_1.craftFloorText)({ form: 'compact' }), 'Do:', 'the compact form carries the action');
absent((0, craft_floor_1.craftFloorText)({ form: 'compact' }), 'Why:', 'the compact form drops the rationale to save budget');
ok(full.length > (0, craft_floor_1.craftFloorText)({ form: 'compact' }).length, 'the full form is longer than the compact form');
// The limit binds.
ok((0, craft_floor_1.craftFloorText)({ limit: 3 }).length < (0, craft_floor_1.craftFloorText)({ limit: 12 }).length, 'the note limit binds');
// ---- 5. REFUSALS CARRY REPLACEMENTS -----------------------------------------------------------
ok(craft_floor_1.FLOOR_REFUSALS.length >= 8, `the refusal list is substantive (got ${craft_floor_1.FLOOR_REFUSALS.length})`);
for (const r of craft_floor_1.FLOOR_REFUSALS) {
    ok(r.refuse.trim().length >= 20, `refusal is specific: ${r.refuse.slice(0, 40)}`);
    ok(r.instead.trim().length >= 40, `refusal names a replacement: ${r.refuse.slice(0, 40)}`);
    ok(r.refuse !== r.instead, `refusal and replacement differ: ${r.refuse.slice(0, 40)}`);
    contains(text, r.refuse, 'each refusal reaches the rendered floor');
    contains(text, r.instead, 'each replacement reaches the rendered floor');
}
contains(text, 'INSTEAD:', 'the rendered refusal list labels its replacements');
// ---- 6. UI DETECTION --------------------------------------------------------------------------
for (const p of ['a.html', '/x/styles.css', 'src/Button.tsx', 'App.vue', 'page.svelte', 'x.scss', 'i.astro', '/X/STYLES.CSS']) {
    ok((0, craft_floor_1.isUiPath)(p), `isUiPath accepts ${p}`);
}
for (const p of ['logic.ts', 'README.md', 'data.json', 'run.py', 'Makefile', 'x.go']) {
    ok(!(0, craft_floor_1.isUiPath)(p), `isUiPath rejects ${p}`);
}
for (const p of ['node_modules/pkg/a.css', 'dist/out.css', 'build/x.css', 'coverage/a.html', 'Button.test.tsx', 'a.spec.tsx']) {
    ok(!(0, craft_floor_1.isUiPath)(p), `isUiPath rejects non-authored ${p}`);
}
ok(craft_floor_1.UI_EXTENSIONS.every((e) => e.startsWith('.')), 'every UI extension is dotted');
// ---- 7. NO OVERLAP CONFUSION ------------------------------------------------------------------
// The floor must not print the brief's findings header, and the brief must not call itself a floor.
absent(text, 'FINDINGS - what was actually measured', 'the floor emits no findings header');
const brief = (0, craft_corpus_1.craftBriefLines)(['a11y/form-control-labelled'], { mode: 'findings' }).join('\n');
absent(brief, 'CRAFT FLOOR', 'a findings brief does not call itself a floor');
absent(brief, 'This is a FLOOR', 'a findings brief does not claim to be the floor');
const standardBrief = (0, craft_corpus_1.craftBriefLines)(['law/motion/duration-budget'], { mode: 'standard' }).join('\n');
absent(standardBrief, 'CRAFT FLOOR', 'a standard brief does not call itself a floor either');
// Both surfaces cite sources, so traceability is uniform across them.
contains(text, 'Source:', 'the floor cites sources');
contains(brief, 'Source:', 'the brief cites sources');
if (failures > 0) {
    console.error('craft-floor: ' + failures + ' failure(s)');
    process.exit(1);
}
console.log('craft-floor: all checks passed');
//# sourceMappingURL=craft-floor.test.js.map