"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MINED_TASTE_VOCABULARY = exports.BLOCKING_SEVERITIES = void 0;
exports.isBlockingSeverity = isBlockingSeverity;
exports.isMinedTaste = isMinedTaste;
exports.minedTasteBlockingViolations = minedTasteBlockingViolations;
/** The blocking severity set (mirrors validator-generation BLOCKING). */
exports.BLOCKING_SEVERITIES = ['blocker', 'major'];
/** The vocabulary tag every mined rule carries (bin/sidecoach-mine.js normalizeCandidate default). */
exports.MINED_TASTE_VOCABULARY = 'mined-taste';
function isBlockingSeverity(sev) {
    return exports.BLOCKING_SEVERITIES.includes(sev);
}
function isMinedTaste(vocab) {
    return vocab === exports.MINED_TASTE_VOCABULARY;
}
/**
 * Return one human-readable error per invariant violation (empty => the invariant holds). A
 * violation is a mined-taste rule at a blocking severity that is missing its ledger entry and/or its
 * passing precision record. The caller fails loud (nonzero exit / a test failure) when this is
 * non-empty. Never throws.
 */
function minedTasteBlockingViolations(rules, backing) {
    const errors = [];
    for (const r of rules) {
        if (!isMinedTaste(r.sourceVocabulary))
            continue;
        if (!isBlockingSeverity(r.severity))
            continue;
        if (!backing.hasLedgerEntry(r.ruleId)) {
            errors.push(`mined-taste rule "${r.ruleId}" has BLOCKING severity ${r.severity} but NO enforcement-ledger entry - it reached the blocking tier without crossing the enforce gate`);
        }
        if (!backing.hasPassingPrecision(r.ruleId)) {
            errors.push(`mined-taste rule "${r.ruleId}" has BLOCKING severity ${r.severity} but NO passing precision record - blocking is not justified out of sample`);
        }
    }
    return errors;
}
//# sourceMappingURL=mined-taste-invariant.js.map