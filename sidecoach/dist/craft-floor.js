"use strict";
// The CRAFT FLOOR - craft instruction that loads before a UI edit regardless of which verb ran.
//
// WHY THIS IS A SEPARATE MECHANISM FROM THE BRIEF.
//
// `craft-corpus.ts` teaches per-verb, selected by what actually FAILED on the project. That is the
// right shape for a verb payload and it has one structural weakness: it only reaches the reader if a
// verb was invoked, and invoked correctly. Measured against the comparison implementation
// (LOCALPROJECTX), the gap was not depth - it was that their craft floor loads unconditionally ahead
// of every UI edit, so no routing decision can miss it, while ours depended on someone choosing the
// right verb first. Breadth across verbs still depends on correct routing; a floor does not.
//
// So this file is the floor, and it is deliberately NOT the brief:
//
//   BRIEF (craft-corpus)          FLOOR (this file)
//   selected by measured failure  unconditional - nothing has been measured yet
//   per-verb, per-domain          one block, every UI edit
//   capped at 6 notes            capped by length, not by findings
//   silent on a clean page        never silent
//   reached via a verb           reached via a PreToolUse hook on Write/Edit
//
// The two must not blend. A reader who cannot tell whether they are looking at a measurement or a
// standing rule cannot act correctly on either, so the floor payload names itself as a floor in its
// first line and says explicitly that nothing was measured.
//
// ONE SOURCE OF TRUTH. The floor does not restate craft in its own words. It SELECTS from the same
// note corpus the briefs use and renders those notes in a compact form, so a fix to a note improves
// both surfaces and neither can drift from the other. `floorCoverageGaps()` fails a test if a key
// listed here stops resolving, which is what a silent drift would look like.
//
// IT MUST BE CHEAP. A PreToolUse hook runs before every UI file write, so the floor performs NO
// project walk, NO validation, and NO I/O beyond reading this module. It is static text assembled
// from constants. That is also why it is a floor rather than a check: there is nothing to check yet -
// the edit has not landed.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UI_EXTENSIONS = exports.FLOOR_REFUSALS = exports.FLOOR_KEYS = void 0;
exports.floorCoverageGaps = floorCoverageGaps;
exports.floorNotes = floorNotes;
exports.craftFloorLines = craftFloorLines;
exports.craftFloorText = craftFloorText;
exports.isUiPath = isUiPath;
const craft_corpus_1 = require("./craft-corpus");
/**
 * The floor, as an ordered list of corpus keys.
 *
 * Chosen on one criterion: would a competent producer, mid-edit, with no verb invoked and no brief in
 * front of them, get this wrong often enough to be worth the tokens? Anything whose absence is
 * merely suboptimal is left to the per-verb brief. Anything whose absence makes the result FAIL for a
 * real reader - unreachable by keyboard, unreadable at contrast, unusable on a phone - is here.
 *
 * Ordered hardest-consequence first rather than by domain, because a truncated floor must still
 * carry its most important line.
 */
exports.FLOOR_KEYS = [
    // Non-negotiable: these make the result unusable for someone, not just worse.
    'law/color/contrast-minimums',
    'law/interaction/focus-visible-ring',
    'law/interaction/eight-states',
    'law/responsive/touch-targets',
    'law/motion/reduced-motion-gentler',
    // Mechanics that decide whether the result reads as finished.
    'law/typography/measure-cap',
    'law/typography/line-height-inverse',
    'law/typography/heading-size-by-role',
    'law/spatial/exponential-scale',
    'law/spatial/proximity-grouping',
    'law/spatial/two-part-shadows',
    'theming/border-radius-consistency',
    'law/motion/duration-budget',
    'law/motion/ease-out-named-curves',
    'law/writing/specific-verb-object',
];
/**
 * Named defaults the floor refuses outright, with the rewrite rather than only the ban.
 *
 * A ban list that says only what not to do sends the producer looking for a variant of the same
 * pattern, which is how a banned shape comes back wearing different class names. Each line here
 * names the replacement.
 */
exports.FLOOR_REFUSALS = [
    {
        refuse: 'Same-size cards of icon + heading + text as the page structure, and any card inside another card.',
        instead: 'Shape the section to what the content actually is. If one item matters more, give it more room and break the grid. If they are steps, number them. If they are comparisons, use a table.',
    },
    {
        refuse: 'The hero-metric template: big number, small label, supporting stats row, accent.',
        instead: 'Pick the one number that carries the claim, give it the room, and say what it means beside it. Cut or demote the rest.',
    },
    {
        refuse: 'Gradient text (background-clip: text over a gradient).',
        instead: 'A solid colour with a measured contrast ratio. Move the gradient behind the text or onto a panel where it decorates instead of carrying meaning.',
    },
    {
        refuse: 'Glass and blur as the primary aesthetic rather than a specific effect.',
        instead: 'An opaque tinted surface with a layered shadow. Keep backdrop-filter for the one or two places with real content behind them, and never animate a large blur.',
    },
    {
        refuse: 'A coloured border-left or border-right above 1px on cards, list items, callouts or alerts.',
        instead: 'A background tint of the semantic hue with matching darker text, plus an icon and a word naming the state.',
    },
    {
        refuse: 'A modal for a task that needs neither interruption nor protected focus.',
        instead: 'Inline expansion, a details disclosure, a side panel, or its own route. Keep modals for blocking decisions and destructive confirmations.',
    },
    {
        refuse: 'transition: all, and animating width, height, top, left, margin or padding.',
        instead: 'Name the properties that change (transition-property: scale, background-color) and express motion through transform and opacity.',
    },
    {
        refuse: 'A placeholder standing in for a label, and a submit button disabled until the form is valid.',
        instead: 'A persistent visible label on every control, and a submit that stays enabled and names what is wrong when pressed.',
    },
    {
        refuse: 'Text set on the bare system stack because no typeface was chosen.',
        instead: 'A deliberately picked family. Where the file must stay self-contained, lead with a characterful OS-installed face (Charter, Iowan Old Style, Baskerville; Avenir, Optima, Futura) ahead of any generic fallback.',
    },
    {
        refuse: 'A number, ratio or duration invented on the spot because a value was needed.',
        instead: 'A value from the project\'s tokens, or from the floor above. If neither has one, add it to the token set rather than inlining it once.',
    },
];
/** Floor keys that no longer resolve to a note. Empty is the invariant. */
function floorCoverageGaps() {
    return exports.FLOOR_KEYS.filter((k) => !(0, craft_corpus_1.resolveCraftNote)(k));
}
/** The resolved floor notes, in declaration order. */
function floorNotes() {
    return exports.FLOOR_KEYS.map((k) => (0, craft_corpus_1.resolveCraftNote)(k)).filter((n) => !!n);
}
/**
 * Render the craft floor.
 *
 * The header is the part that must not be softened: it states that this is a FLOOR, that it loaded
 * without a verb, and that nothing was measured. A reader who mistakes it for findings will go
 * looking for defects that were never detected.
 */
function craftFloorLines(opts = {}) {
    const form = opts.form ?? 'compact';
    const notes = floorNotes().slice(0, opts.limit ?? exports.FLOOR_KEYS.length);
    const lines = [];
    lines.push('CRAFT FLOOR - the standing minimum for UI work in this project.');
    lines.push('This is a FLOOR, not findings. It loaded because a UI file is being edited' +
        (opts.filePath ? ` (${opts.filePath})` : '') +
        ', not because any sidecoach verb ran and not because anything was measured. ' +
        'Nothing here is a defect report - it is the standard the edit has to clear.');
    lines.push('A pinned brief or the project\'s own DESIGN.md tokens override any value here. Your habit does not. ' +
        'Do not announce the checklist; build to it.');
    lines.push('');
    lines.push('HOLD THESE:');
    notes.forEach((note, i) => {
        if (form === 'full') {
            lines.push(`${i + 1}. ${note.title.toUpperCase()}`);
            lines.push(`   Good: ${note.good}`);
            lines.push(`   Why:  ${note.why}`);
            lines.push(`   Do:   ${note.fix}`);
            lines.push(`   Source: ${note.source}`);
            lines.push('');
        }
        else {
            // Compact keeps the two fields a producer acts on - the target state and the concrete move with
            // its real values - and drops the rationale, which the per-verb brief supplies when it matters.
            lines.push(`${i + 1}. ${note.title}: ${note.good}`);
            lines.push(`   Do: ${note.fix}`);
            lines.push(`   Source: ${note.source}`);
        }
    });
    if (form === 'compact')
        lines.push('');
    if (opts.refusals !== false) {
        lines.push('REFUSE THESE - each with what to do instead, so the shape does not come back renamed:');
        for (const r of exports.FLOOR_REFUSALS) {
            lines.push(`- NOT: ${r.refuse}`);
            lines.push(`  INSTEAD: ${r.instead}`);
        }
        lines.push('');
    }
    lines.push('The floor holds the mechanics; it never picks the direction. With these clear, spend the page on ' +
        'the committed direction. For findings measured against THIS project, run the verb: ' +
        '`sidecoach audit <target>` or `sidecoach polish <target>`.');
    return lines;
}
/** The floor as one string, for a hook to inject. */
function craftFloorText(opts = {}) {
    return craftFloorLines(opts).join('\n');
}
/**
 * File extensions the floor considers UI work.
 *
 * Deliberately conservative: a false positive costs a few hundred tokens on an edit that did not need
 * them, and a false negative means the floor silently does not load, which is the failure this whole
 * mechanism exists to prevent. So the list is broad on markup/style and includes the component
 * formats, and the hook narrows further by looking for UI content.
 */
exports.UI_EXTENSIONS = [
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.jsx', '.tsx', '.vue', '.svelte', '.astro',
];
/** Whether a path looks like UI work the floor should load for. */
function isUiPath(filePath) {
    const lower = filePath.toLowerCase();
    if (!exports.UI_EXTENSIONS.some((e) => lower.endsWith(e)))
        return false;
    // Test files and generated output are not UI work being authored.
    if (/(^|\/)(node_modules|dist|build|coverage)\//.test(lower))
        return false;
    if (/\.(test|spec)\.[a-z]+$/.test(lower))
        return false;
    return true;
}
//# sourceMappingURL=craft-floor.js.map