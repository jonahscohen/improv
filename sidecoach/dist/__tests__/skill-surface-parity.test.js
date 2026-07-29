"use strict";
// sidecoach/src/__tests__/skill-surface-parity.test.ts
//
// THE SKILL DOCUMENT MUST AGREE WITH THE TOOL SURFACE IT DESCRIBES.
//
// WHY THIS TEST EXISTS, and it is not hypothetical. On 2026-07-29 the installed skill text carried two statements
// about `sidecoach/bin/` that were not stale but FALSE:
//
//   1. "six self-contained CLIs ship in sidecoach/bin/" while `sidecoach list` reported seven.
//   2. "sidecoach-drift is additionally wired into the audit flow ... The other five tools are invoked directly,
//      not auto-run by a flow." At that moment sidecoach-image was already auto-run by flow D.
//
// The second is the worse defect and the reason this file is a test rather than a lint. An OMISSION leaves a
// reader with a gap they might go and fill. That sentence filled the gap with a wrong answer, so a model reading
// the only loadable document about this system concluded it had to do all image work by hand and that no flow
// would ever produce a plate for it. A capability can be fully built, fully wired, and still unreachable because
// the document that describes it says it is not there.
//
// Nothing checked that these two surfaces agreed, which is exactly how they drifted apart. `sidecoach list --json`
// is the machine-readable form of the one table both now derive from, and this test is the mechanism that keeps
// the prose honest: add a bin, or wire one into a flow, and this fails until the document says so.
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
const SC = path.resolve(__dirname, '..', '..');
const SKILL_MD = path.resolve(SC, '..', 'claude', 'skills', 'sidecoach', 'SKILL.md');
const NUMBER_WORDS = {
    0: 'zero',
    1: 'one',
    2: 'two',
    3: 'three',
    4: 'four',
    5: 'five',
    6: 'six',
    7: 'seven',
    8: 'eight',
    9: 'nine',
    10: 'ten',
    11: 'eleven',
    12: 'twelve',
};
function readSurface() {
    const stdout = (0, child_process_1.execFileSync)(process.execPath, [path.join(SC, 'bin', 'sidecoach.js'), 'list', '--json'], {
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout);
    assert(Array.isArray(parsed.standaloneBins), 'sidecoach list --json must carry a standaloneBins array');
    return parsed.standaloneBins;
}
function main() {
    // A missing skill document is a hard failure, not a skip. A guard that quietly opts out when it cannot find its
    // subject is the same as no guard, and this one exists because the subject was already wrong once.
    assert(fs.existsSync(SKILL_MD), `the skill document must exist at ${SKILL_MD}; a parity check that skips is not a check`);
    const doc = fs.readFileSync(SKILL_MD, 'utf8');
    const bins = readSurface();
    // -------------------------------------------------------------------------
    // 1. The COUNT. The false statement was a number, so the number is checked.
    // -------------------------------------------------------------------------
    const total = bins.length;
    const totalWord = NUMBER_WORDS[total];
    assert(!!totalWord, `extend NUMBER_WORDS past ${total} before adding another bin`);
    const countRe = new RegExp(`\\b(?:${totalWord}|${total})\\b[^.\\n]{0,60}self-contained CLIs`, 'i');
    assert(countRe.test(doc), `the skill document must state that ${totalWord} (${total}) self-contained CLIs ship in sidecoach/bin/. It does not, so its count has drifted from \`sidecoach list\`.`);
    // Any OTHER number in front of "self-contained CLIs" is the exact defect that shipped. Catch it explicitly so
    // the failure message names the drift rather than just missing a match.
    const wrongCount = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b[^.\n]{0,60}self-contained CLIs/i.exec(doc);
    if (wrongCount) {
        const stated = wrongCount[1].toLowerCase();
        assert(stated === totalWord || stated === String(total), `the skill document says "${stated}" self-contained CLIs but the surface has ${total} (${totalWord})`);
    }
    // -------------------------------------------------------------------------
    // 2. Every bin is NAMED. A tool absent from the only loadable document is undiscoverable whatever it can do.
    // -------------------------------------------------------------------------
    for (const b of bins) {
        assert(doc.includes(b.bin), `the skill document never names ${b.bin}, so a model reading it cannot find that tool`);
    }
    // -------------------------------------------------------------------------
    // 3. Every FLOW-WIRED bin is described as flow-wired.
    //
    // This is the assertion that would have caught the false sentence. It is not enough for the tool to be named:
    // whether a flow runs it changes what the reader has to do, and getting that backwards is worse than silence.
    // -------------------------------------------------------------------------
    // SENTENCE-SCOPED AND NEGATION-AWARE. Codex review 2026-07-29, finding 5: the first version accepted any line
    // containing the bin name plus the words "auto-run", so the sentence "sidecoach-image is not auto-run; invoke it
    // manually" SATISFIED the positive check. A guard that passes on the exact class of falsehood it was written to
    // catch is worse than no guard, because it also certifies. The affirmative claim must now appear in a sentence
    // that carries no negation of it.
    const sentences = doc.split(/(?<=[.!?])\s+|\n(?=[-*#|])/);
    const NEGATION = /\b(?:not|never|no|nothing|none|neither|cannot|isn't|aren't|doesn't|don't)\b/i;
    const AFFIRMATIVE = /(?:auto-run|wired into|feeds the|runs it as|flow-wired)/gi;
    /**
     * Is this wiring phrase NEGATED?
     *
     * Scoped to the words immediately governing the phrase, not to the whole sentence. A sentence-wide negation scan
     * was the first attempt and it rejected a correct sentence: the drift paragraph affirms its wiring AND contains
     * "never a false pass" thirty words later, which has nothing to do with the wiring claim. The window is what
     * makes "is not auto-run" and "never auto-run" fail while leaving an unrelated "never" alone.
     */
    function negatedAt(sentence, index) {
        return NEGATION.test(sentence.slice(Math.max(0, index - 24), index));
    }
    function affirmsWiring(sentence) {
        AFFIRMATIVE.lastIndex = 0;
        let m;
        while ((m = AFFIRMATIVE.exec(sentence)) !== null) {
            if (!negatedAt(sentence, m.index))
                return true;
        }
        return false;
    }
    const wired = bins.filter((b) => b.flowWired);
    for (const b of wired) {
        const mentioning = sentences.filter((s) => s.includes(b.bin));
        assert(mentioning.length > 0, `the skill document never mentions ${b.bin} in any sentence`);
        assert(mentioning.some((s) => affirmsWiring(s)), `${b.bin} is auto-run by a flow (${b.flowWiring}) and no sentence in the skill document affirmatively says so. Sentences mentioning it: ${mentioning
            .map((s) => `"${s.trim().slice(0, 90)}"`)
            .join(' | ')}`);
    }
    // -------------------------------------------------------------------------
    // 4. No bin is described as NOT flow-wired when it is.
    //
    // The shipped defect said "the other five tools are invoked directly ... not auto-run by a flow" while two were.
    // The count in that sentence is derivable, so it is derived and compared.
    // -------------------------------------------------------------------------
    const manualCount = total - wired.length;
    const manualWord = NUMBER_WORDS[manualCount];
    const manualClaim = /\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b\s+(?:tools|of them|remaining tools)[^.\n]{0,120}?(?:invoked directly|not auto-run)/i.exec(doc)
        || /(?:remaining|other)\s+(zero|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+tools[^.\n]{0,120}?(?:invoked directly|not auto-run|no flow runs)/i.exec(doc);
    if (manualClaim) {
        const stated = manualClaim[1].toLowerCase();
        assert(stated === manualWord || stated === String(manualCount), `the skill document says ${stated} tools are not auto-run by a flow, but ${manualWord} (${manualCount}) of ${total} are manual: ${bins
            .filter((b) => !b.flowWired)
            .map((b) => b.bin)
            .join(', ')}`);
    }
    // A flow-wired bin must never appear inside a sentence DENYING that it is flow-wired. Broadened past the one
    // exact phrase that shipped, per the same review finding: any negation of the affirmative vocabulary counts.
    for (const b of wired) {
        for (const s of sentences) {
            if (!s.includes(b.bin))
                continue;
            AFFIRMATIVE.lastIndex = 0;
            let m;
            while ((m = AFFIRMATIVE.exec(s)) !== null) {
                assert(!negatedAt(s, m.index), `a sentence names ${b.bin} and DENIES its flow wiring, which is false (${b.flowWiring}): ${s.trim().slice(0, 160)}`);
            }
            assert(!/\binvoked (?:directly|manually|by hand)\b/i.test(s), `a sentence names ${b.bin} and says it is invoked directly, but a flow auto-runs it (${b.flowWiring}): ${s.trim().slice(0, 160)}`);
        }
    }
    // -------------------------------------------------------------------------
    // 5. The frontmatter DESCRIPTION carries the image capability.
    //
    // Description-based selection is how a skill gets loaded at all. A capability named only in the body is
    // invisible to the decision about whether to open the body. Checked separately for that reason.
    // -------------------------------------------------------------------------
    const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(doc);
    assert(!!fm, 'the skill document must open with YAML frontmatter');
    const description = /description:\s*([\s\S]*?)(?:\n[a-z_]+:|$)/i.exec(fm[1]);
    assert(!!description, 'the frontmatter must carry a description');
    assert(/\bimage\b/i.test(description[1]), 'the frontmatter description must name the image capability, or a request about generating an image will never select this skill');
    console.log(`skill-surface-parity: OK (${total} bins named, count word "${totalWord}" stated, ${wired.length} flow-wired bin(s) declared as such, no false manual claim, description names the image capability)`);
}
main();
//# sourceMappingURL=skill-surface-parity.test.js.map