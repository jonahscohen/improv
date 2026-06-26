"use strict";
// Sidecoach Domain Validator (Stage 2 convergence - registry-backed facade).
// Was a 196-rule framework; the theater rules were retired and the real ones
// absorbed into the registry forms + page-quality validators. This file now keeps
// the legacy DomainValidationReport TYPES (19 importers) and a thin registry-backed
// ExtendedDomainValidator facade. See session_2026-06-25_sidecoach-migration-handoff.md.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtendedDomainValidator = void 0;
// ============================================================================
// REGISTRY-BACKED FACADE (Stage 2 convergence, 2026-06-25).
// The former 196 "domain" rules + the 2 Tier-2 modules were RETIRED: the bulk
// were theater (fake/keyword-proxy/always-pass/NLP detection). The genuinely-real
// rules were ABSORBED into the registry's `forms` (16) and `page-quality` (6)
// validators. ExtendedDomainValidator is now a thin SYNC facade that runs THOSE
// absorbed registry rules and shapes the legacy DomainValidationReport, so the
// flow-handlers keep working with HONEST (registry-derived) numbers.
// ============================================================================
const product_rule_registry_1 = require("./product-rule-registry");
const product_rule_types_1 = require("./product-rule-types");
const ABSORBED = product_rule_registry_1.RULES.filter((r) => (r.ownerValidatorId === 'forms' || r.ownerValidatorId === 'page-quality')
    && (0, product_rule_types_1.isStaticallySatisfiable)(r.evidenceRequirements)
    && typeof r.checkProduct === 'function');
const LEGACY_SEVERITY = {
    blocker: 'critical', major: 'high', minor: 'medium', advisory: 'low',
};
function toProductContext(ctx) {
    const markupParts = [];
    if (ctx.html)
        markupParts.push(ctx.html);
    if (ctx.htmlElement) {
        try {
            markupParts.push(ctx.htmlElement.outerHTML || '');
        }
        catch { /* no DOM */ }
    }
    return { cssText: (ctx.cssRules || []).join('\n'), markup: markupParts.join('\n'), files: [] };
}
class ExtendedDomainValidator {
    static validateAll(context) {
        const ctx = context || {};
        const designTokensEmpty = !ctx.designTokens || Object.keys(ctx.designTokens).length === 0;
        const cssRulesEmpty = !ctx.cssRules || ctx.cssRules.length === 0;
        const anyOtherInput = !!ctx.htmlElement || !!ctx.html || !!ctx.computedStyle || !!ctx.colors
            || !!ctx.typography || !!ctx.spacing || !!ctx.motion || !!ctx.accessibility || !!ctx.contrast
            || !!ctx.performance || !!ctx.visualization || !!ctx.internationalization;
        if (designTokensEmpty && cssRulesEmpty && !anyOtherInput) {
            return {
                status: 'skipped', reason: 'no inputs provided', totalRules: 0, passed: 0, violations: 0,
                passRate: 'n/a', violationsByDomain: {}, passRateByDomain: {}, criticalViolations: 0, results: [],
                summary: 'Validation skipped: no inputs provided (designTokens, cssRules, and all domain-specific inputs are empty/missing)',
            };
        }
        const pctx = toProductContext(ctx);
        const results = ABSORBED.map((r) => {
            const v = r.checkProduct(pctx);
            return { ruleId: r.ruleId, domain: r.findingClass, passed: v.status !== 'fail', message: v.message, remediation: v.remediation };
        });
        const total = ABSORBED.length;
        const passed = results.filter((r) => r.passed).length;
        const violationsList = results.filter((r) => !r.passed);
        const passRate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
        const critical = violationsList.filter((v) => {
            const def = ABSORBED.find((r) => r.ruleId === v.ruleId);
            return !!def && (def.severity === 'blocker' || def.severity === 'major');
        }).length;
        const violationsByDomain = {};
        const passRateByDomain = {};
        // Key BOTH by findingClass (a11y/perf/theming/polish...) AND by ownerValidatorId
        // (forms/page-quality). Callers ask for either name: flow-handlers read
        // passRateByDomain['forms'] by OWNER, while the absorbed forms rules carry
        // findingClass 'a11y'. Keying by findingClass alone made passRateByDomain['forms']
        // undefined, so flow-handler-component-implementation reported Forms as 0/N
        // regardless of real results (Codex P1, sibling of the getRulesByDomain fix).
        const domainKeys = new Set();
        for (const r of ABSORBED) {
            domainKeys.add(r.findingClass);
            domainKeys.add(r.ownerValidatorId);
        }
        for (const domain of domainKeys) {
            const domainRuleIds = new Set(ABSORBED.filter((r) => r.findingClass === domain || r.ownerValidatorId === domain).map((r) => r.ruleId));
            const domainPassed = results.filter((r) => domainRuleIds.has(r.ruleId) && r.passed).length;
            violationsByDomain[domain] = domainRuleIds.size - domainPassed;
            passRateByDomain[domain] = `${((domainPassed / domainRuleIds.size) * 100).toFixed(1)}%`;
        }
        return {
            status: 'completed', totalRules: total, passed, violations: violationsList.length,
            passRate: `${passRate}%`, violationsByDomain, passRateByDomain, criticalViolations: critical, results,
            summary: `Domain validation (registry-backed): ${passed}/${total} rules passed (${passRate}%)`,
        };
    }
    static getDomains() {
        return [...new Set(ABSORBED.map((r) => r.findingClass))];
    }
    static getRulesByDomain(domain) {
        // Match on the owning validator id OR the finding-class. The absorbed FORMS
        // rules carry findingClass 'a11y' (not 'forms'), so a findingClass-only match
        // made getRulesByDomain('forms') return empty and silently dropped the forms
        // guidance from flows that ask for it by owner name (e.g. component-implementation).
        return ABSORBED.filter((r) => r.findingClass === domain || r.ownerValidatorId === domain).map((r) => ({
            id: r.ruleId, domain: r.findingClass, name: r.canonicalRuleKey, description: r.canonicalRuleKey,
            severity: LEGACY_SEVERITY[r.severity],
            checkFunction: (ctx) => {
                const v = r.checkProduct(toProductContext(ctx));
                return { ruleId: r.ruleId, domain: r.findingClass, passed: v.status !== 'fail', message: v.message, remediation: v.remediation };
            },
        }));
    }
    static getSummary() {
        return `Sidecoach domain validation runs via the registry: ${ABSORBED.length} rules across ${ExtendedDomainValidator.getDomains().length} finding-classes.`;
    }
}
exports.ExtendedDomainValidator = ExtendedDomainValidator;
//# sourceMappingURL=extended-domain-validator.js.map