"use strict";
// sidecoach/src/validators/enforced-rules-generation.ts
//
// Phase 3c Step C1 (pure core): the ledger + precision GATE that decides which enforced-tier rules
// are allowed to compile into LIVE, build-blocking ProductRuleDefinitions, plus the renderer for the
// generated module. PURE logic inside rootDir ./src so src/__tests__ can import it without a TS6059
// crossing (the generate-validators / generate-counter-rules precedent). The thin wrapper
// scripts/generate-enforced-rules.ts does the file I/O, runs the enforce-CLI `audit` (the HMAC ledger
// verification - NOT reimplemented here), and calls deriveEnforcedRules + renderEnforcedRulesModule.
//
// THE SECURITY BOUNDARY. This codegen is the ONE place learned taste data crosses into live code, so
// it is FAIL-CLOSED: an enforced-tier rule compiles into the live set ONLY IF (a) the enforce-CLI
// audit passed (the enforcement ledger's HMAC chain + head anchor verify AND the rule's content
// digest matches its signed ledger entry - done in the wrapper before this runs), AND (b) the
// LEDGERED precision cleared the bar (>= threshold, a non-empty precision-digest), AND (c) a matching
// passing precision RECORD exists whose digest equals the ledger's signed precision-digest and whose
// build stamp is the CURRENT interpreter build (so a precision proof measured against a since-changed
// interpreter cannot certify). ANY failing rule makes deriveEnforcedRules return an error, which the
// wrapper turns into a NON-ZERO exit -> `npm run build` breaks. A tampered / unledgered / under-
// precision / stale enforced rule NEVER compiles into RAW_RULES.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENFORCE_GEN_MIN_FIRES = exports.ENFORCE_GEN_MIN_HELDOUT_POSITIVES = exports.ENFORCE_GEN_PRECISION_THRESHOLD = exports.ENFORCED_SEVERITY = void 0;
exports.deriveEnforcedRules = deriveEnforcedRules;
exports.renderEnforcedRulesModule = renderEnforcedRulesModule;
/** The severity a certified enforced mined rule compiles at (blocking). */
exports.ENFORCED_SEVERITY = 'major';
/** The precision threshold a ledgered enforced rule must have cleared to compile live. */
exports.ENFORCE_GEN_PRECISION_THRESHOLD = 0.90;
/** The production floor a certified record must have been measured at (Codex MEDIUM #3). */
exports.ENFORCE_GEN_MIN_HELDOUT_POSITIVES = 8;
exports.ENFORCE_GEN_MIN_FIRES = 8;
function ruleBodyOf(obj) {
    const r = obj && obj.rule;
    return r && typeof r === 'object' ? r : obj;
}
/**
 * Gate every enforced record and build the certified ProductRuleDefinitions. FAIL-CLOSED: any record
 * that lacks an audit-verified ledger entry, whose ledgered precision is under threshold, or whose
 * precision record is missing / mismatched / stale, is pushed to `errors` (and NOT certified). The
 * caller exits non-zero when `errors` is non-empty, so the build breaks rather than compiling it.
 */
function deriveEnforcedRules(inp) {
    const reqThreshold = typeof inp.requiredThreshold === 'number' ? inp.requiredThreshold
        : (typeof inp.threshold === 'number' ? inp.threshold : exports.ENFORCE_GEN_PRECISION_THRESHOLD);
    const reqMinPos = typeof inp.requiredMinHeldoutPositives === 'number' ? inp.requiredMinHeldoutPositives : exports.ENFORCE_GEN_MIN_HELDOUT_POSITIVES;
    const reqMinFires = typeof inp.requiredMinFires === 'number' ? inp.requiredMinFires : exports.ENFORCE_GEN_MIN_FIRES;
    const certified = [];
    const errors = [];
    for (const rec of inp.records) {
        const id = rec.fileStem;
        const body = ruleBodyOf(rec.obj);
        const bodyId = typeof body.ruleId === 'string' ? body.ruleId : '';
        // (0) id integrity - the filename stem is authoritative; the body must agree.
        if (!bodyId) {
            errors.push(`enforced rule "${id}": rule body has no ruleId`);
            continue;
        }
        if (bodyId !== id) {
            errors.push(`enforced rule "${id}": body ruleId "${bodyId}" does not match filename`);
            continue;
        }
        if (body.sourceVocabulary !== 'mined-taste') {
            errors.push(`enforced rule "${id}": sourceVocabulary is "${String(body.sourceVocabulary)}", not "mined-taste"`);
            continue;
        }
        if (!body.patternSpec || typeof body.patternSpec !== 'object') {
            errors.push(`enforced rule "${id}": no patternSpec (nothing to run)`);
            continue;
        }
        // (a) ledger backing - the entry existence + content-digest match were proven by the enforce-CLI
        //     audit in the wrapper (HMAC chain). Here we require the entry to be present, carry the signed
        //     precision this rule was enforced at, AND carry a content_digest (Codex HIGH #2: a missing
        //     content_digest means the content was never bound, so a later swap could go uncaught).
        const entry = inp.ledgerByRuleId.get(id);
        if (!entry) {
            errors.push(`enforced rule "${id}": NO enforcement-ledger entry (not enforced through the gate)`);
            continue;
        }
        if (!entry.content_digest) {
            errors.push(`enforced rule "${id}": ledger entry carries no content_digest (content was never bound - legacy/forged); refusing to certify`);
            continue;
        }
        // (b) ledgered precision cleared the bar.
        const ledgeredP = typeof entry.precision === 'number' ? entry.precision : null;
        if (ledgeredP === null || ledgeredP < reqThreshold) {
            errors.push(`enforced rule "${id}": ledgered precision ${ledgeredP === null ? 'n/a' : ledgeredP} is under threshold ${reqThreshold}`);
            continue;
        }
        if (!entry.precision_digest) {
            errors.push(`enforced rule "${id}": ledger entry carries no precision-digest`);
            continue;
        }
        // (c) a passing precision RECORD exists, its digest matches the SIGNED ledger digest, it was
        //     measured against the CURRENT interpreter build (a stale proof cannot certify), AND it was
        //     measured at a floor AT LEAST as strict as production (Codex MEDIUM #3: a record measured
        //     under a weakened floor - e.g. MIN_FIRES=0, a tiny-denominator P=1.0 - must NOT certify).
        const prec = inp.precisionByRuleId.get(id);
        if (!prec) {
            errors.push(`enforced rule "${id}": no precision record found (cannot confirm the ledgered precision out of sample)`);
            continue;
        }
        if (prec.pass !== true) {
            errors.push(`enforced rule "${id}": precision record is not a PASS`);
            continue;
        }
        if (prec.precisionDigest !== entry.precision_digest) {
            errors.push(`enforced rule "${id}": precision record digest does not match the ledger's signed precision-digest (record/ledger disagree)`);
            continue;
        }
        // Codex Caveat B: the digest RE-COMPUTED from the cache's own fields must ALSO equal the ledger's
        // signed digest. A same-uid cache rewrite that CLAIMS a production floor (to pass the floor check)
        // while its signed ledger digest was for a weakened floor is caught here - the recompute over the
        // rewritten fields will not match the (weakened-floor) ledger digest.
        if (prec.recomputedPrecisionDigest !== entry.precision_digest) {
            errors.push(`enforced rule "${id}": precision record fields do not RE-COMPUTE to the ledger's signed precision-digest (the cache was rewritten - its recorded floor/precision disagree with the signed measurement)`);
            continue;
        }
        if (prec.buildStamp !== inp.currentBuildStamp) {
            errors.push(`enforced rule "${id}": precision record was measured against a DIFFERENT interpreter build (${prec.buildStamp || '(none)'} != current ${inp.currentBuildStamp}) - re-enforce against the current interpreter`);
            continue;
        }
        if (typeof prec.threshold !== 'number' || prec.threshold < reqThreshold) {
            errors.push(`enforced rule "${id}": precision record threshold ${prec.threshold ?? '(none)'} is weaker than the production threshold ${reqThreshold}`);
            continue;
        }
        if (typeof prec.minHeldoutPositives !== 'number' || prec.minHeldoutPositives < reqMinPos) {
            errors.push(`enforced rule "${id}": precision record was measured under a weakened held-out-positive floor (${prec.minHeldoutPositives ?? '(none)'} < ${reqMinPos})`);
            continue;
        }
        if (typeof prec.minFires !== 'number' || prec.minFires < reqMinFires) {
            errors.push(`enforced rule "${id}": precision record was measured under a weakened fires floor (${prec.minFires ?? '(none)'} < ${reqMinFires})`);
            continue;
        }
        certified.push(buildDefinition(id, body));
    }
    // stable order by ruleId so the generated file is deterministic (a --check must be reproducible).
    certified.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    return { certified, errors };
}
/**
 * Build the live ProductRuleDefinition from a certified enforced record's rule body. Severity is
 * forced to the blocking ENFORCED_SEVERITY and sourceVocabulary to 'mined-taste'; the patternSpec is
 * carried (so it resolves to the Phase 3a interpreter); exampleCorpus is DROPPED (runtime does not
 * need it). Registry-required fields the miner already set are carried through verbatim, so
 * validateRegistry (run by npm run build) is the final field-completeness gate - a malformed def
 * still fails the build (fail-closed).
 */
function buildDefinition(id, body) {
    const s = (k, d) => (typeof body[k] === 'string' && body[k] ? body[k] : d);
    const def = {
        ruleId: id,
        sourceRuleAliases: Array.isArray(body.sourceRuleAliases) && body.sourceRuleAliases.length
            ? body.sourceRuleAliases
            : [`mined:${id}`],
        canonicalRuleKey: s('canonicalRuleKey', `mined/${id}`),
        ownerValidatorId: s('ownerValidatorId', 'polish-standard'),
        sourceVocabulary: 'mined-taste',
        sourceSeverity: s('sourceSeverity', 'medium'),
        severity: exports.ENFORCED_SEVERITY,
        severityOverrideReason: s('severityOverrideReason', 'enforced mined-taste rule: flipped to blocking via the precision-gated, human-signed enforce gate (ledger-backed)'),
        findingClass: s('findingClass', 'polish'),
        registryScope: s('registryScope', `enforced-${id}`),
        evidenceRequirements: (Array.isArray(body.evidenceRequirements) && body.evidenceRequirements.length
            ? body.evidenceRequirements
            : ['css-rule']),
        supportedSourceKinds: (Array.isArray(body.supportedSourceKinds)
            ? body.supportedSourceKinds
            : []),
        scope: (typeof body.scope === 'string' ? body.scope : 'file'),
        narrowTargetBehavior: (typeof body.narrowTargetBehavior === 'string' ? body.narrowTargetBehavior : 'evaluate_expanded_context'),
        applicability: (body.applicability === 'inconclusive' ? 'inconclusive' : 'not_applicable'),
        patternSpec: body.patternSpec,
    };
    return def;
}
/**
 * Render the generated TS module. The certified rules are inlined as LITERALS (like
 * counter-rules.generated.ts) - the module imports NO data, so src/ still imports nothing from the
 * data tier; the data was read only by the codegen wrapper at build time. A stable header + sorted
 * rules keep `--check` reproducible.
 */
function renderEnforcedRulesModule(certified) {
    const body = JSON.stringify(certified, null, 2);
    return (`// GENERATED by sidecoach/scripts/generate-enforced-rules.ts - DO NOT EDIT BY HAND.\n` +
        `//\n` +
        `// The LIVE, build-blocking mined-taste rules. Each one compiled here ONLY after the enforce-CLI\n` +
        `// audit verified its enforcement-ledger entry (HMAC chain + content digest) AND a passing precision\n` +
        `// record (>= threshold, floor, matching the ledger's signed precision-digest, current interpreter\n` +
        `// build). This file inlines the certified definitions as literals - it imports NO data, so the\n` +
        `// structural inertness invariant (src/ imports nothing from the data tier) is preserved: the ONLY\n` +
        `// crossing of learned data into live code is the codegen, and it is fail-closed. Regenerate via\n` +
        `// npm run build; a hand edit is caught by generate-enforced-rules --check (build breaks).\n` +
        `import type { ProductRuleDefinition } from '../product-rule-types';\n\n` +
        `export const ENFORCED_RULES: ProductRuleDefinition[] = ${body};\n\n` +
        `/** The ruleIds of every certified live-blocking mined-taste rule (for the runtime invariant). */\n` +
        `export const ENFORCED_RULE_IDS: string[] = ${JSON.stringify(certified.map((r) => r.ruleId))};\n`);
}
//# sourceMappingURL=enforced-rules-generation.js.map