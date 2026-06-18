"use strict";
// Tool 6: sidecoach_validate_extended_domain - run the 112-rule
// ExtendedDomainValidator across all 10 domains.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const extended_domain_validator_1 = require("../../../dist/extended-domain-validator");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_validate_extended_domain',
    description: 'Run sidecoach\'s 163-rule Extended Domain validator across 11 design domains: typography, ' +
        'color, spatial, motion (incl. gesture/drag physics), interaction, responsive, ux-writing, ' +
        'performance, data-visualization, internationalization, forms, and the Polish Standard subset. ' +
        'Provide any subset of inputs (HTML, CSS, designTokens, typography, colors, spacing, motion, ' +
        'accessibility, contrast, performance, visualization, internationalization). The forms domain ' +
        'and gesture rules scan the raw HTML markup. Returns per-domain pass rates and the full result ' +
        'set. If no inputs are provided, returns a skipped-status report instead of synthesizing pass rates.',
    inputSchema: schemas_1.validateExtendedDomainShape,
    timeoutMs: 30000,
};
function extractCssRules(rawCss) {
    return rawCss
        .split('}')
        .map((chunk) => chunk.trim())
        .filter((chunk) => chunk.length > 0)
        .map((chunk) => chunk + '}');
}
const handler = async (input, _deps) => {
    const cssCombined = [
        input.css ?? '',
        ...((input.html ?? '').match(/<style\b[^>]*>([\s\S]*?)<\/style>/gi) ?? []).map((s) => s.replace(/<style\b[^>]*>/i, '').replace(/<\/style>/i, '')),
    ]
        .filter((s) => s.length > 0)
        .join('\n');
    const cssRules = cssCombined ? extractCssRules(cssCombined) : [];
    // Map each optional record-of-unknown input into the validator's typed
    // shape. We cast through `unknown` because we don't run full Zod schemas
    // for every nested shape - the validator itself tolerates partial inputs.
    const context = {
        cssRules,
        designTokens: input.designTokens,
        typography: input.typography,
        colors: input.colors,
        spacing: input.spacing,
        motion: input.motion,
        accessibility: input.accessibility,
        contrast: input.contrast,
        performance: input.performance,
        visualization: input.visualization,
        internationalization: input.internationalization,
    };
    // T-0030: pass raw markup so the forms domain + gesture rules can scan
    // attribute-level HTML that does not surface through extracted cssRules.
    // Assigned via cast so it type-checks against the prebuilt dist d.ts; the
    // field is read by the validator once dist is rebuilt by the full build.
    context.html = input.html;
    let report;
    try {
        report = extended_domain_validator_1.ExtendedDomainValidator.validateAll(context);
    }
    catch (err) {
        throw new errors_1.SidecoachToolError('VALIDATOR_FAILURE', 'ExtendedDomainValidator threw an exception', {
            validator: 'ExtendedDomainValidator.validateAll',
            errorMessage: (0, errors_1.redactErrorMessage)(err),
        });
    }
    // Status comes from the report itself ('skipped' or 'completed').
    const summary = report.status === 'skipped'
        ? 'sidecoach_validate_extended_domain: skipped (no inputs provided)'
        : `sidecoach_validate_extended_domain: ${report.passed}/${report.totalRules} passed (${report.passRate}), ${report.criticalViolations} critical across ${Object.keys(report.passRateByDomain).length} domains`;
    return { data: { report }, summary };
};
exports.handler = handler;
//# sourceMappingURL=validate-extended-domain.js.map