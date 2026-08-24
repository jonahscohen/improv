// sidecoach/src/validators/checks/pattern-interpreter.ts
//
// The DATA-DRIVEN INTERPRETER for a mined rule's `patternSpec`, as a CheckFn
// (ctx: ProductCheckContext) => RuleVerdict. It reads DATA off the spec and executes NO
// authored code: it compiles regex sources through the linear-time re2 engine (compileGuarded)
// and selects numeric predicates from the FIXED allowlist by `predicateId`. Fail-closed at every
// gap - an unknown engine, an unknown predicateId, an unsafe/invalid/re2-unavailable regex, or
// missing evidence all resolve to `inconclusive`, never a false pass (the missingCheck contract).
//
// SAFETY: every UNTRUSTED patternSpec regex runs through re2 (guaranteed linear time), so an
// ambiguous-alternation pattern like `^(a|aa)*$` that backtracks exponentially on a native RegExp
// cannot hang the write-gate. NO native RegExp is ever built from candidate source - not for
// .test(), not for scanning, and not for locating (locate() builds a native RegExp, so this
// module scans regions itself via re2/execCapped instead).
//
// Structure mirrors an existing check (validators/checks/typography-motion-tells.ts):
//   applicability regex -> defect regex(es) -> optional numeric predicate -> fail.
import type { ProductRuleDefinition } from '../../product-rule-types';
import type { ProductCheckContext, RuleVerdict } from '../check-context';
import { pass, fail, notApplicable, inconclusive, hasCss, hasMarkup } from '../check-context';
import { sourceRegions, fileLineOf } from '../source-locator';
import type { LocationScope } from '../source-locator';
import {
  PATTERN_SPEC_ENGINE, MAX_SCAN_LEN, MAX_DEFECT_MATCHES, DEFAULT_APPLICABILITY_FLAGS,
  compileGuarded, execCapped, NUMERIC_PREDICATES, normalizeScope,
} from '../pattern-spec';
import type { PatternSpec, PatternSpecScope, GuardedRegex } from '../pattern-spec';

/** Scoped, length-capped source text. The cap bounds memory; re2 keeps the scan linear. */
function scopedText(ctx: ProductCheckContext, scope: PatternSpecScope): string {
  const css = ctx.cssText || '';
  const markup = ctx.markup || '';
  const t = scope === 'css' ? css : scope === 'markup' ? markup : `${css}\n${markup}`;
  return t.length > MAX_SCAN_LEN ? t.slice(0, MAX_SCAN_LEN) : t;
}

/** Honest inconclusive when the scope's evidence channel was not collected; undefined = OK. */
function missingEvidence(ctx: ProductCheckContext, scope: PatternSpecScope): RuleVerdict | undefined {
  const haveCss = hasCss(ctx);
  const haveMarkup = hasMarkup(ctx);
  if (scope === 'css' && !haveCss) return inconclusive('no CSS source collected for patternSpec', 'unreadable_input');
  if (scope === 'markup' && !haveMarkup) return inconclusive('no markup source collected for patternSpec', 'unreadable_input');
  if (scope === 'both' && !haveCss && !haveMarkup) return inconclusive('no CSS or markup source collected for patternSpec', 'unreadable_input');
  return undefined;
}

/**
 * Run one patternSpec against the collected evidence. Returns a RuleVerdict; the registry's
 * checkProduct wrapper stamps the rule's severity/class and catches any throw as inconclusive.
 */
export function interpretPatternSpec(spec: PatternSpec | undefined, ctx: ProductCheckContext): RuleVerdict {
  // 0. engine gate (fail-closed). An absent spec lands here too.
  if (!spec || spec.engine !== PATTERN_SPEC_ENGINE) {
    return inconclusive(`unknown patternSpec engine: ${spec ? String(spec.engine) : '(no spec)'}`, 'unsupported_runtime');
  }
  if (!spec.applicability || !Array.isArray(spec.applicability.anyOf) || spec.applicability.anyOf.length === 0) {
    return inconclusive('patternSpec.applicability.anyOf is empty or malformed', 'unsupported_runtime');
  }
  if (!spec.defect || !Array.isArray(spec.defect.anyOf) || spec.defect.anyOf.length === 0) {
    return inconclusive('patternSpec.defect.anyOf is empty or malformed', 'unsupported_runtime');
  }

  // 1. applicability - empty match => not_applicable (a target must exist to judge).
  const appScope = normalizeScope(spec.applicability.scope);
  const appMissing = missingEvidence(ctx, appScope);
  if (appMissing) return appMissing;
  const appText = scopedText(ctx, appScope);
  let applicable = false;
  for (const src of spec.applicability.anyOf) {
    const c = compileGuarded(src, DEFAULT_APPLICABILITY_FLAGS);
    if ('error' in c) return inconclusive(`patternSpec applicability ${c.error}`, 'unsupported_runtime');
    if (c.re.re.test(appText)) { applicable = true; break; }
  }
  if (!applicable) return notApplicable('no patternSpec applicability pattern matched the collected source');

  // 2. defect - compile every defect regex through re2 (fail-closed on unsafe/invalid/unavailable),
  //    collect matches for the numeric guard.
  const defScope = normalizeScope(spec.evidenceScope ?? spec.applicability.scope);
  const defMissing = missingEvidence(ctx, defScope);
  if (defMissing) return defMissing;
  const defText = scopedText(ctx, defScope);
  const compiledDefects: GuardedRegex[] = [];
  const matches: string[] = [];
  for (const d of spec.defect.anyOf) {
    if (!d || typeof d.pattern !== 'string') return inconclusive('patternSpec defect entry missing a string pattern', 'unsupported_runtime');
    const c = compileGuarded(d.pattern, d.flags);
    if ('error' in c) return inconclusive(`patternSpec defect ${c.error}`, 'unsupported_runtime');
    compiledDefects.push(c.re);
    const scan = execCapped(c.re.source, c.re.flags, defText, MAX_DEFECT_MATCHES - matches.length);
    if (scan.error) return inconclusive(`patternSpec defect scan: ${scan.error}`, 'unsupported_runtime');
    for (const hit of scan.matches) matches.push(hit.match);
    if (matches.length >= MAX_DEFECT_MATCHES) break;
  }
  if (matches.length === 0) return pass('applicable, but no defect pattern present');

  // 3. optional numeric guard - selected from the FIXED allowlist by predicateId (fail-closed).
  const guard = spec.defect.numericGuard;
  if (guard) {
    const predicate = NUMERIC_PREDICATES[guard.predicateId];
    if (!predicate) return inconclusive(`unknown numericGuard predicateId: ${String(guard.predicateId)}`, 'unsupported_runtime');
    const threshold = Number(guard.threshold);
    if (!Number.isFinite(threshold)) return inconclusive('numericGuard threshold is not a finite number', 'unsupported_runtime');
    let confirmed: boolean;
    try {
      confirmed = predicate(
        { text: defText, cssText: scopedText(ctx, 'css'), markup: scopedText(ctx, 'markup'), matches },
        threshold,
      );
    } catch (e) {
      return inconclusive(`numericGuard predicate threw: ${e instanceof Error ? e.message : String(e)}`, 'rule_exception');
    }
    if (!confirmed) return pass('defect pattern present but the numeric guard was not met');
  }

  // 4. FAIL - point at the defect declarations by scanning each region with re2 (never a native
  //    RegExp on candidate source), mapping the match offset back to its file line.
  const locations = locateDefects(ctx, compiledDefects, defScope as LocationScope);
  return fail(spec.message, locations, spec.remediation);
}

/** Locate up to 5 defect sites by scanning each source region with re2 and mapping offsets to
 *  file lines. Uses the SAME regions locate() uses, so lines stay consistent. */
function locateDefects(ctx: ProductCheckContext, defects: GuardedRegex[], scope: LocationScope): string[] {
  const locations: string[] = [];
  for (const d of defects) {
    for (const region of sourceRegions(ctx, scope)) {
      const text = region.text.length > MAX_SCAN_LEN ? region.text.slice(0, MAX_SCAN_LEN) : region.text;
      const scan = execCapped(d.source, d.flags, text, 5);
      for (const hit of scan.matches) {
        const loc = `${region.path}:${fileLineOf(region, hit.index)}`;
        if (!locations.includes(loc)) locations.push(loc);
        if (locations.length >= 5) return locations;
      }
    }
  }
  return locations;
}

/** Bind a rule definition to its interpreter as a CheckFn (used by the CHECKS resolution). */
export function interpreterFor(def: ProductRuleDefinition): (ctx: ProductCheckContext) => RuleVerdict {
  return (ctx: ProductCheckContext): RuleVerdict => interpretPatternSpec(def.patternSpec, ctx);
}
