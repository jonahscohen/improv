"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.missingCheck = exports.CHECKS = void 0;
const check_context_1 = require("../check-context");
const polish_checks_1 = require("./polish-checks");
const a11y_checks_1 = require("./a11y-checks");
const theming_checks_1 = require("./theming-checks");
const anti_pattern_checks_1 = require("./anti-pattern-checks");
const rendered_checks_1 = require("./rendered-checks");
const forms_checks_1 = require("./forms-checks");
const page_quality_checks_1 = require("./page-quality-checks");
// Keyed by canonicalRuleKey. The slices are disjoint by construction. RENDERED_CHECKS holds the rendered-scan
// checks; FORMS_CHECKS holds the absorbed forms-a11y markup checks (Stage 2); a11y/color-contrast stays in
// A11Y_CHECKS (collector-backed) until its rendered migration in a later stage.
exports.CHECKS = {
    ...polish_checks_1.POLISH_CHECKS, ...a11y_checks_1.A11Y_CHECKS, ...theming_checks_1.THEMING_CHECKS, ...anti_pattern_checks_1.ANTI_PATTERN_CHECKS, ...rendered_checks_1.RENDERED_CHECKS, ...forms_checks_1.FORMS_CHECKS, ...page_quality_checks_1.PAGE_QUALITY_CHECKS,
};
// A rule whose check is not yet attached surfaces inconclusive, NEVER a false pass.
const missingCheck = () => (0, check_context_1.inconclusive)('no checkProduct attached for this rule', 'unsupported_runtime');
exports.missingCheck = missingCheck;
//# sourceMappingURL=index.js.map