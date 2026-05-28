"use strict";
// Tool 7: sidecoach_validate_taste - run the taste-validator against an
// HTML body (with optional CSS).
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const taste_validator_1 = require("../../../dist/taste-validator");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_validate_taste',
    description: 'Run sidecoach\'s taste validator over the provided HTML (and optional CSS). Checks for ' +
        'AI-slop patterns like fabricated SVG icons, translate-Y in :hover, hex literals in hover ' +
        'states when CSS vars are available, hero radial gradients, large inline style attrs, ' +
        'observer races, and border-radius inconsistency. Returns the structured violation list ' +
        'and a formatted human-readable string.',
    inputSchema: schemas_1.validateTasteShape,
    timeoutMs: 30000,
};
const handler = async (input, _deps) => {
    let violations;
    try {
        violations = (0, taste_validator_1.validateTaste)(input.html, input.css, {
            iconLibrary: input.iconLibrary,
        });
    }
    catch (err) {
        throw new errors_1.SidecoachToolError('VALIDATOR_FAILURE', 'taste validator threw an exception', {
            validator: 'validateTaste',
            errorMessage: (0, errors_1.redactErrorMessage)(err),
        });
    }
    let formatted;
    try {
        formatted = (0, taste_validator_1.formatViolations)(violations, '<input>');
    }
    catch (err) {
        formatted = `failed to format violations: ${(0, errors_1.redactErrorMessage)(err)}`;
    }
    return {
        data: {
            violationCount: violations.length,
            violations,
            formatted,
        },
        summary: violations.length === 0
            ? 'sidecoach_validate_taste: 0 violations'
            : `sidecoach_validate_taste: ${violations.length} violation(s)`,
    };
};
exports.handler = handler;
//# sourceMappingURL=validate-taste.js.map