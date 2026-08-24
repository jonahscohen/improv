"use strict";
// sidecoach/src/validators/pattern-spec.ts
//
// The DECLARATIVE PATTERN SPEC and its safety layer for the self-updating taste pipeline
// (Phase 3a). A mined taste rule can carry a `patternSpec`: DATA that the interpreter
// (checks/pattern-interpreter.ts) compiles and runs. NOTHING here executes authored code -
// it compiles regex SOURCE via `new RegExp(source, flags)` and selects numeric predicates
// from a FIXED, code-reviewed allowlist keyed by `predicateId`. The candidate supplies DATA
// (regex source, a threshold, WHICH named predicate) and never a predicate body. An unknown
// engine or an unknown predicateId is fail-closed (the caller returns inconclusive), the same
// contract as missingCheck at product-rule-registry.ts.
//
// SAFETY-CRITICAL: the interpreter runs in the taste-gate on EVERY .html/.css write, so a
// catastrophic-backtracking regex would hang the gate. Because a synchronous JavaScript regex
// cannot be pre-empted in-process without a separate execution context (V8 has no step budget
// and re2 is not installed here - see the Revisit note in the Phase 3 design), the load-bearing
// defense is a STATIC ReDoS SCREEN applied BEFORE any regex is executed: `screenRegexSource`
// rejects the classic exponential families (nested unbounded quantifiers / star-height >= 2),
// backreferences, and over-complex or over-long sources. A rejected source is treated as
// inconclusive (interpreter) or FILED with an error (miner preflight) - never run, never hung.
// An input-length cap bounds the remaining (linear) work. This SAME screen is reused by the
// miner preflight so a candidate cannot enter the quarantine carrying an un-screened regex.
//
// This module is a LEAF: it imports nothing from the project, so bin/sidecoach-mine.js can
// require the compiled dist copy for its preflight without dragging in the check graph.
Object.defineProperty(exports, "__esModule", { value: true });
exports.NUMERIC_PREDICATES = exports.DEFAULT_APPLICABILITY_FLAGS = exports.MAX_DEFECT_MATCHES = exports.MAX_GROUP_DEPTH = exports.MAX_QUANTIFIERS = exports.MAX_SCAN_LEN = exports.MAX_REGEX_SOURCE_LEN = exports.PATTERN_SPEC_ENGINE = void 0;
exports.validateFlags = validateFlags;
exports.re2Available = re2Available;
exports.screenRegexSource = screenRegexSource;
exports.compileGuarded = compileGuarded;
exports.execCapped = execCapped;
exports.isKnownPredicate = isKnownPredicate;
exports.normalizeScope = normalizeScope;
exports.screenPatternSpec = screenPatternSpec;
// ---------------------------------------------------------------------------
// types (the shape a mined rule carries; also imported by product-rule-types)
// ---------------------------------------------------------------------------
/** The only engine kind understood today. An unknown engine is fail-closed (inconclusive). */
exports.PATTERN_SPEC_ENGINE = 'static-css-regex';
// ---------------------------------------------------------------------------
// bounds (documented, reviewed constants)
// ---------------------------------------------------------------------------
exports.MAX_REGEX_SOURCE_LEN = 1000; // a taste tell is a short pattern; a huge source is suspicious
exports.MAX_SCAN_LEN = 200000; // input-length cap on scanned text (bounds linear work)
exports.MAX_QUANTIFIERS = 60; // pathological quantifier count => reject
exports.MAX_GROUP_DEPTH = 25; // pathological nesting depth => reject
exports.MAX_DEFECT_MATCHES = 200; // cap collected matches (bounds memory)
exports.DEFAULT_APPLICABILITY_FLAGS = 'i';
const ALLOWED_FLAGS = new Set(['i', 'm', 's', 'u']);
/**
 * Validate candidate-supplied regex flags. REJECTS (never silently drops) a non-string value, a
 * character outside the allowed subset (`i`/`m`/`s`/`u` - `g`/`y` carry lastIndex state the
 * interpreter manages itself, `d`/`v` are unneeded), and a duplicate. Silently dropping a bad
 * flag was a false-pass hazard: an intended `i` lost to sanitization made a defect that should
 * match return pass (Codex fold 2). Returns the validated flag string or an error.
 */
function validateFlags(flags) {
    // undefined / '' = genuinely no flags. A SUPPLIED non-string (null, a number, ...) is malformed
    // and is REJECTED, not treated as empty - `null` was a residual false-pass gap (Codex fold 2b).
    if (flags === undefined || flags === '')
        return { flags: '' };
    if (typeof flags !== 'string')
        return { error: `regex flags must be a string (got ${flags === null ? 'null' : typeof flags})` };
    const seen = new Set();
    for (const ch of flags) {
        if (!ALLOWED_FLAGS.has(ch))
            return { error: `unsupported regex flag '${ch}' (allowed: ${[...ALLOWED_FLAGS].join('')})` };
        if (seen.has(ch))
            return { error: `duplicate regex flag '${ch}'` };
        seen.add(ch);
    }
    return { flags };
}
// ---------------------------------------------------------------------------
// re2 (linear-time engine) for UNTRUSTED candidate regexes - the runtime control
// ---------------------------------------------------------------------------
// A synchronous native RegExp cannot be pre-empted, and the static screen below cannot decide
// ambiguous-alternation ReDoS (e.g. `^(a|aa)*$`, which backtracks exponentially on native V8).
// So every UNTRUSTED patternSpec regex is compiled + run through re2, which matches in guaranteed
// linear time (no catastrophic backtracking). re2 is an OPTIONAL dependency: if it is not
// installed on this platform, compileGuarded fail-closes to an error, which the interpreter turns
// into `inconclusive` (nothing runs, no false pass) and the miner files. OUR-code predicate
// regexes stay native RegExp - they are trusted and known linear.
//
// `SIDECOACH_DISABLE_RE2` is a TEST SEAM to exercise the re2-unavailable fail-closed path; setting
// it only ever makes patternSpec checks inconclusive (safe), never a false pass.
//
// re2 CONSEQUENCE: because linear-time matching precludes them, re2 rejects LOOKAROUND
// ((?=...), (?!...), (?<=...), (?<!...)) and BACKREFERENCES. A mined spec that uses either compiles
// to an error -> inconclusive at runtime and a filed preflight error in the miner. Mined static
// tells are plain presence/absence patterns, so this is an acceptable, fail-closed restriction.
let _re2Cache;
function loadRe2() {
    if (_re2Cache !== undefined)
        return _re2Cache;
    if (process.env.SIDECOACH_DISABLE_RE2) {
        _re2Cache = null;
        return _re2Cache;
    }
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        _re2Cache = require('re2');
    }
    catch (_e) {
        _re2Cache = null;
    }
    return _re2Cache;
}
/** True iff the linear-time engine is available (used by tests / diagnostics). */
function re2Available() { return loadRe2() !== null; }
/**
 * Reject a regex SOURCE that could backtrack catastrophically, BEFORE it is ever compiled or
 * run. This is a single linear pass, deliberately CONSERVATIVE: it favors rejecting a safe
 * pattern (which only ever yields an inconclusive verdict / a filed preflight error) over
 * admitting an unsafe one (which could hang the gate). It catches:
 *   - a source longer than MAX_REGEX_SOURCE_LEN,
 *   - a backreference (\1..\9 or \k<name>) - matching with backrefs is not linear,
 *   - a nested unbounded quantifier / star-height >= 2 (`(a+)+`, `(a*)*`, `((a+))+`, ...),
 *     the classic exponential family,
 *   - more than MAX_QUANTIFIERS quantifiers or deeper than MAX_GROUP_DEPTH group nesting.
 *
 * It does NOT attempt to decide ambiguous-alternation ReDoS (`(a|a)*`); that is undecidable by
 * a linear screen. The input-length cap bounds such cases, and re2/worker execution is the
 * noted upgrade path (Phase 3 design, Revisit). Every regex the interpreter and miner run has
 * passed this screen first.
 */
function screenRegexSource(source) {
    if (typeof source !== 'string')
        return { safe: false, reason: 'regex source is not a string' };
    if (source.length === 0)
        return { safe: true };
    if (source.length > exports.MAX_REGEX_SOURCE_LEN)
        return { safe: false, reason: `regex source exceeds ${exports.MAX_REGEX_SOURCE_LEN} chars` };
    const root = { hasUnbounded: false };
    const stack = [];
    const top = () => (stack.length ? stack[stack.length - 1] : root);
    let inClass = false;
    let quantCount = 0;
    let lastWasGroupClose = false; // the previous atom was a closing ')'
    let lastClosedHadUnbounded = false; // ...and that group contained an unbounded quantifier
    const len = source.length;
    for (let i = 0; i < len; i++) {
        const c = source[i];
        if (c === '\\') {
            const nxt = source[i + 1];
            if (nxt && nxt >= '1' && nxt <= '9')
                return { safe: false, reason: 'backreference (\\1..\\9) is not linear-time' };
            if (nxt === 'k')
                return { safe: false, reason: 'named backreference (\\k<...>) is not linear-time' };
            i += 1; // an escaped char is a single literal atom
            lastWasGroupClose = false;
            continue;
        }
        if (inClass) {
            if (c === ']')
                inClass = false;
            lastWasGroupClose = false;
            continue;
        }
        if (c === '[') {
            inClass = true;
            lastWasGroupClose = false;
            continue;
        }
        if (c === '(') {
            stack.push({ hasUnbounded: false });
            if (stack.length > exports.MAX_GROUP_DEPTH)
                return { safe: false, reason: `group nesting deeper than ${exports.MAX_GROUP_DEPTH}` };
            lastWasGroupClose = false;
            // consume a group-type prefix so its '?' is not read as a quantifier:
            //   (?:  (?=  (?!  (?<=  (?<!  (?<name>
            if (source[i + 1] === '?') {
                let j = i + 2;
                const p = source[j];
                if (p === ':' || p === '=' || p === '!')
                    j += 1;
                else if (p === '<') {
                    if (source[j + 1] === '=' || source[j + 1] === '!')
                        j += 2;
                    else {
                        j += 1;
                        while (j < len && source[j] !== '>')
                            j += 1;
                        j += 1;
                    } // named group up to '>'
                }
                i = j - 1; // the for-loop ++ lands on j
            }
            continue;
        }
        if (c === ')') {
            const popped = stack.pop();
            const parent = top();
            const had = popped ? popped.hasUnbounded : false;
            if (had)
                parent.hasUnbounded = true; // propagate: a group "contains" an unbounded repeat at any depth
            lastWasGroupClose = true;
            lastClosedHadUnbounded = had;
            continue;
        }
        // quantifiers: * + ? {n,m}
        let isQuant = false;
        let isUnbounded = false; // can repeat without an upper bound (* + {n,})
        let isCompounding = false; // can repeat MORE THAN ONCE (everything but ? / {0,1} / {1} / {0})
        if (c === '*' || c === '+') {
            isQuant = true;
            isUnbounded = true;
            isCompounding = true;
        }
        else if (c === '?') {
            isQuant = true;
        }
        else if (c === '{') {
            const m = /^\{(\d+)(,(\d*)?)?\}/.exec(source.slice(i));
            if (m) {
                isQuant = true;
                const lo = Number(m[1]);
                const hasComma = m[2] !== undefined;
                const hiRaw = m[3];
                const hi = hasComma ? (hiRaw === '' || hiRaw === undefined ? Infinity : Number(hiRaw)) : lo;
                isUnbounded = hi === Infinity;
                isCompounding = hi > 1;
                i += m[0].length - 1; // consume the whole {..}
                void lo;
            }
            // a bare '{' that is not a quantifier is a literal - fall through as a normal char
        }
        if (isQuant) {
            quantCount += 1;
            if (quantCount > exports.MAX_QUANTIFIERS)
                return { safe: false, reason: `more than ${exports.MAX_QUANTIFIERS} quantifiers` };
            if (lastWasGroupClose && lastClosedHadUnbounded && isCompounding) {
                return { safe: false, reason: 'nested unbounded quantifier (star-height >= 2, exponential backtracking risk)' };
            }
            if (isUnbounded)
                top().hasUnbounded = true;
            lastWasGroupClose = false;
            continue;
        }
        // any other literal atom
        lastWasGroupClose = false;
    }
    return { safe: true };
}
/**
 * Compile an UNTRUSTED candidate regex through the linear-time engine (re2). Validates the flags
 * (Codex fold 2), bounds the source length, then compiles via re2. Returns the compiled instance
 * or an error - fail-closed: if re2 is unavailable, or rejects the syntax, or the flags are
 * malformed, the caller (interpreter) turns the error into `inconclusive` and the miner files it.
 * re2 is the linear-time RUNTIME control; screenRegexSource (below) is a separate fast preflight
 * DIAGNOSTIC the miner also runs, no longer the sole control. Never throws.
 */
function compileGuarded(source, flags) {
    if (typeof source !== 'string')
        return { error: 'regex source is not a string' };
    if (source.length > exports.MAX_REGEX_SOURCE_LEN)
        return { error: `regex source exceeds ${exports.MAX_REGEX_SOURCE_LEN} chars` };
    const fr = validateFlags(flags);
    if ('error' in fr)
        return { error: fr.error };
    const RE2 = loadRe2();
    if (!RE2)
        return { error: 're2 (linear-time regex engine) is unavailable, so this patternSpec regex cannot be executed safely' };
    try {
        return { re: { re: new RE2(source, fr.flags), source, flags: fr.flags } };
    }
    catch (e) {
        return { error: `invalid regex (re2): ${e instanceof Error ? e.message : String(e)}` };
    }
}
/**
 * Run an UNTRUSTED regex over `text` with re2 (linear-time), collecting up to `cap` matches
 * ({ match, index }). Compiles a fresh GLOBAL re2 each call so there is no shared lastIndex state,
 * and steps past a zero-width match so it cannot loop forever. Fail-closed: re2 unavailable or a
 * compile failure returns an error. Never throws.
 */
function execCapped(source, flags, text, cap) {
    const RE2 = loadRe2();
    if (!RE2)
        return { matches: [], error: 're2 unavailable' };
    const g = flags.includes('g') ? flags : flags + 'g';
    let re;
    try {
        re = new RE2(source, g);
    }
    catch (e) {
        return { matches: [], error: `invalid regex (re2): ${e instanceof Error ? e.message : String(e)}` };
    }
    const out = [];
    let m;
    while (out.length < cap && (m = re.exec(text)) !== null) {
        out.push({ match: m[0], index: m.index });
        if (m[0].length === 0)
            re.lastIndex += 1; // guard against a zero-width infinite loop
    }
    return { matches: out };
}
// Fixed, reviewed regexes used INSIDE the predicates - OUR code, not candidate data, so they
// are known linear-time and never screened.
const CUBIC_BEZIER = /cubic-bezier\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*\)/gi;
const FONT_FAMILY = /font-family\s*:\s*([^;{}]+)/gi;
const GENERIC_FAMILIES = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif',
    'ui-monospace', 'ui-rounded', 'inherit', 'initial', 'unset', 'revert', '-apple-system',
    'blinkmacsystemfont', 'segoe ui', 'emoji', 'math', 'fangsong',
]);
function distinctFamilies(cssText, markup) {
    const out = new Set();
    for (const m of `${cssText}\n${markup}`.matchAll(new RegExp(FONT_FAMILY.source, 'gi'))) {
        for (const raw of m[1].split(',')) {
            const fam = raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
            if (fam && !GENERIC_FAMILIES.has(fam))
                out.add(fam);
        }
    }
    return out.size;
}
/**
 * The allowlist. Each predicate is a small pure fn keyed by id; the candidate supplies only the
 * id + threshold. Direction (>=, <=) is INTRINSIC to the predicate and documented per entry.
 */
exports.NUMERIC_PREDICATES = {
    // Fires when any cubic-bezier control point's PROGRESS axis (y1 or y2) travels past its
    // destination by more than `threshold` (bounce / elastic overshoot). Mirrors the
    // typography-motion-tells bounce-easing check.
    'cubic-bezier-overshoot': (input, threshold) => {
        const src = input.matches.length ? input.matches.join('\n') : input.text;
        for (const m of src.matchAll(new RegExp(CUBIC_BEZIER.source, 'gi'))) {
            const y1 = parseFloat(m[2]);
            const y2 = parseFloat(m[4]);
            if ([y1, y2].some((y) => Number.isFinite(y) && (y < -threshold || y > 1 + threshold)))
                return true;
        }
        return false;
    },
    // Fires when the page commits to AT MOST `threshold` distinct non-generic typefaces (the
    // single-font tell uses threshold 1). Direction: value <= threshold.
    'font-family-count': (input, threshold) => distinctFamilies(input.cssText, input.markup) <= threshold,
    // A FLOOR gate: fires only when the collected source is at least `threshold` lines - so a
    // page-level judgment does not fire on a tiny stylesheet. Direction: value >= threshold.
    'min-source-lines': (input, threshold) => `${input.cssText}\n${input.markup}`.split('\n').length >= threshold,
};
function isKnownPredicate(id) {
    return typeof id === 'string' && Object.prototype.hasOwnProperty.call(exports.NUMERIC_PREDICATES, id);
}
function normalizeScope(scope) {
    return scope === 'css' || scope === 'markup' || scope === 'both' ? scope : 'both';
}
// ---------------------------------------------------------------------------
// whole-spec preflight (miner reuse): screen every regex + validate the guard/engine
// ---------------------------------------------------------------------------
/**
 * Validate a patternSpec's DATA without executing it: engine is known, every applicability and
 * defect regex passes the ReDoS screen and compiles, an optional numericGuard names an
 * allowlisted predicate with a finite threshold, and message is present. Returns the full error
 * list (a malformed spec is FILED with these, never dropped). Never throws.
 */
function screenPatternSpec(spec) {
    const errors = [];
    if (!spec || typeof spec !== 'object')
        return { ok: false, errors: ['patternSpec is not an object'] };
    const s = spec;
    if (s.engine !== exports.PATTERN_SPEC_ENGINE)
        errors.push(`unknown patternSpec engine '${String(s.engine)}' (only '${exports.PATTERN_SPEC_ENGINE}')`);
    // Each candidate regex is checked TWICE: the fast static screen (a clear "unsafe regex"
    // diagnostic - files nested-quantifier / backref / over-long rejections) AND the authoritative
    // re2 compile (flags validated, linear-time engine accepts the syntax). Both surface here so a
    // malformed spec is filed with the most informative error.
    const screenRegex = (label, src, flags) => {
        const scr = screenRegexSource(src);
        if (!scr.safe)
            errors.push(`${label}: unsafe regex rejected (${scr.reason})`);
        const c = compileGuarded(src, flags);
        if ('error' in c)
            errors.push(`${label}: ${c.error}`);
    };
    const app = s.applicability;
    if (!app || !Array.isArray(app.anyOf) || app.anyOf.length === 0) {
        errors.push('patternSpec.applicability.anyOf must be a non-empty array of regex sources');
    }
    else {
        app.anyOf.forEach((src, i) => {
            if (typeof src !== 'string') {
                errors.push(`applicability.anyOf[${i}] is not a string`);
                return;
            }
            screenRegex(`applicability.anyOf[${i}]`, src, exports.DEFAULT_APPLICABILITY_FLAGS);
        });
    }
    const defect = s.defect;
    const anyOf = defect && defect.anyOf;
    if (!defect || !Array.isArray(anyOf) || anyOf.length === 0) {
        errors.push('patternSpec.defect.anyOf must be a non-empty array of {pattern, flags}');
    }
    else {
        anyOf.forEach((d, i) => {
            const pat = d && typeof d === 'object' ? d.pattern : undefined;
            if (typeof pat !== 'string') {
                errors.push(`defect.anyOf[${i}] is missing a string 'pattern'`);
                return;
            }
            screenRegex(`defect.anyOf[${i}]`, pat, d.flags);
        });
    }
    const guard = defect && defect.numericGuard;
    if (guard) {
        if (!isKnownPredicate(guard.predicateId))
            errors.push(`numericGuard.predicateId '${String(guard.predicateId)}' is not in the allowlist [${Object.keys(exports.NUMERIC_PREDICATES).join(', ')}]`);
        if (typeof guard.threshold !== 'number' || !Number.isFinite(guard.threshold))
            errors.push('numericGuard.threshold must be a finite number');
    }
    if (typeof s.message !== 'string' || !s.message.trim())
        errors.push('patternSpec.message must be a non-empty string');
    return { ok: errors.length === 0, errors };
}
//# sourceMappingURL=pattern-spec.js.map