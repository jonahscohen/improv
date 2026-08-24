"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interpretPatternSpec = interpretPatternSpec;
exports.interpreterFor = interpreterFor;
const check_context_1 = require("../check-context");
const source_locator_1 = require("../source-locator");
const pattern_spec_1 = require("../pattern-spec");
/** Scoped, length-capped source text. The cap bounds memory; re2 keeps the scan linear. */
function scopedText(ctx, scope) {
    const css = ctx.cssText || '';
    const markup = ctx.markup || '';
    const t = scope === 'css' ? css : scope === 'markup' ? markup : `${css}\n${markup}`;
    return t.length > pattern_spec_1.MAX_SCAN_LEN ? t.slice(0, pattern_spec_1.MAX_SCAN_LEN) : t;
}
/** Honest inconclusive when the scope's evidence channel was not collected; undefined = OK. */
function missingEvidence(ctx, scope) {
    const haveCss = (0, check_context_1.hasCss)(ctx);
    const haveMarkup = (0, check_context_1.hasMarkup)(ctx);
    if (scope === 'css' && !haveCss)
        return (0, check_context_1.inconclusive)('no CSS source collected for patternSpec', 'unreadable_input');
    if (scope === 'markup' && !haveMarkup)
        return (0, check_context_1.inconclusive)('no markup source collected for patternSpec', 'unreadable_input');
    if (scope === 'both' && !haveCss && !haveMarkup)
        return (0, check_context_1.inconclusive)('no CSS or markup source collected for patternSpec', 'unreadable_input');
    return undefined;
}
/**
 * Run one patternSpec against the collected evidence. Returns a RuleVerdict; the registry's
 * checkProduct wrapper stamps the rule's severity/class and catches any throw as inconclusive.
 */
function interpretPatternSpec(spec, ctx) {
    // 0. engine gate (fail-closed). An absent spec lands here too.
    if (!spec || spec.engine !== pattern_spec_1.PATTERN_SPEC_ENGINE) {
        return (0, check_context_1.inconclusive)(`unknown patternSpec engine: ${spec ? String(spec.engine) : '(no spec)'}`, 'unsupported_runtime');
    }
    if (!spec.applicability || !Array.isArray(spec.applicability.anyOf) || spec.applicability.anyOf.length === 0) {
        return (0, check_context_1.inconclusive)('patternSpec.applicability.anyOf is empty or malformed', 'unsupported_runtime');
    }
    if (!spec.defect || !Array.isArray(spec.defect.anyOf) || spec.defect.anyOf.length === 0) {
        return (0, check_context_1.inconclusive)('patternSpec.defect.anyOf is empty or malformed', 'unsupported_runtime');
    }
    // 1. applicability - empty match => not_applicable (a target must exist to judge).
    const appScope = (0, pattern_spec_1.normalizeScope)(spec.applicability.scope);
    const appMissing = missingEvidence(ctx, appScope);
    if (appMissing)
        return appMissing;
    const appText = scopedText(ctx, appScope);
    let applicable = false;
    for (const src of spec.applicability.anyOf) {
        const c = (0, pattern_spec_1.compileGuarded)(src, pattern_spec_1.DEFAULT_APPLICABILITY_FLAGS);
        if ('error' in c)
            return (0, check_context_1.inconclusive)(`patternSpec applicability ${c.error}`, 'unsupported_runtime');
        if (c.re.re.test(appText)) {
            applicable = true;
            break;
        }
    }
    if (!applicable)
        return (0, check_context_1.notApplicable)('no patternSpec applicability pattern matched the collected source');
    // 2. defect - compile every defect regex through re2 (fail-closed on unsafe/invalid/unavailable),
    //    collect matches for the numeric guard.
    const defScope = (0, pattern_spec_1.normalizeScope)(spec.evidenceScope ?? spec.applicability.scope);
    const defMissing = missingEvidence(ctx, defScope);
    if (defMissing)
        return defMissing;
    const defText = scopedText(ctx, defScope);
    const compiledDefects = [];
    const matches = [];
    for (const d of spec.defect.anyOf) {
        if (!d || typeof d.pattern !== 'string')
            return (0, check_context_1.inconclusive)('patternSpec defect entry missing a string pattern', 'unsupported_runtime');
        const c = (0, pattern_spec_1.compileGuarded)(d.pattern, d.flags);
        if ('error' in c)
            return (0, check_context_1.inconclusive)(`patternSpec defect ${c.error}`, 'unsupported_runtime');
        compiledDefects.push(c.re);
        const scan = (0, pattern_spec_1.execCapped)(c.re.source, c.re.flags, defText, pattern_spec_1.MAX_DEFECT_MATCHES - matches.length);
        if (scan.error)
            return (0, check_context_1.inconclusive)(`patternSpec defect scan: ${scan.error}`, 'unsupported_runtime');
        for (const hit of scan.matches)
            matches.push(hit.match);
        if (matches.length >= pattern_spec_1.MAX_DEFECT_MATCHES)
            break;
    }
    if (matches.length === 0)
        return (0, check_context_1.pass)('applicable, but no defect pattern present');
    // 3. optional numeric guard - selected from the FIXED allowlist by predicateId (fail-closed).
    const guard = spec.defect.numericGuard;
    if (guard) {
        const predicate = pattern_spec_1.NUMERIC_PREDICATES[guard.predicateId];
        if (!predicate)
            return (0, check_context_1.inconclusive)(`unknown numericGuard predicateId: ${String(guard.predicateId)}`, 'unsupported_runtime');
        const threshold = Number(guard.threshold);
        if (!Number.isFinite(threshold))
            return (0, check_context_1.inconclusive)('numericGuard threshold is not a finite number', 'unsupported_runtime');
        let confirmed;
        try {
            confirmed = predicate({ text: defText, cssText: scopedText(ctx, 'css'), markup: scopedText(ctx, 'markup'), matches }, threshold);
        }
        catch (e) {
            return (0, check_context_1.inconclusive)(`numericGuard predicate threw: ${e instanceof Error ? e.message : String(e)}`, 'rule_exception');
        }
        if (!confirmed)
            return (0, check_context_1.pass)('defect pattern present but the numeric guard was not met');
    }
    // 4. FAIL - point at the defect declarations by scanning each region with re2 (never a native
    //    RegExp on candidate source), mapping the match offset back to its file line.
    const locations = locateDefects(ctx, compiledDefects, defScope);
    return (0, check_context_1.fail)(spec.message, locations, spec.remediation);
}
/** Locate up to 5 defect sites by scanning each source region with re2 and mapping offsets to
 *  file lines. Uses the SAME regions locate() uses, so lines stay consistent. */
function locateDefects(ctx, defects, scope) {
    const locations = [];
    for (const d of defects) {
        for (const region of (0, source_locator_1.sourceRegions)(ctx, scope)) {
            const text = region.text.length > pattern_spec_1.MAX_SCAN_LEN ? region.text.slice(0, pattern_spec_1.MAX_SCAN_LEN) : region.text;
            const scan = (0, pattern_spec_1.execCapped)(d.source, d.flags, text, 5);
            for (const hit of scan.matches) {
                const loc = `${region.path}:${(0, source_locator_1.fileLineOf)(region, hit.index)}`;
                if (!locations.includes(loc))
                    locations.push(loc);
                if (locations.length >= 5)
                    return locations;
            }
        }
    }
    return locations;
}
/** Bind a rule definition to its interpreter as a CheckFn (used by the CHECKS resolution). */
function interpreterFor(def) {
    return (ctx) => interpretPatternSpec(def.patternSpec, ctx);
}
//# sourceMappingURL=pattern-interpreter.js.map