"use strict";
// Validator for CLAUDE.md Mandate Enforcement
// Prevents violations of team rules in all flow output
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudemdMandateValidator = void 0;
class ClaudemdMandateValidator {
    static validateOutput(result, context) {
        const violations = [];
        const blockers = [];
        if (result.guidance) {
            for (let i = 0; i < result.guidance.length; i++) {
                const text = result.guidance[i];
                violations.push(...this.checkForEmojis(text, `guidance[${i}]`));
                violations.push(...this.checkForLongDashes(text, `guidance[${i}]`));
                violations.push(...this.checkForSelfCredit(text, `guidance[${i}]`));
            }
        }
        if (result.message) {
            violations.push(...this.checkForEmojis(result.message, 'message'));
            violations.push(...this.checkForLongDashes(result.message, 'message'));
            violations.push(...this.checkForSelfCredit(result.message, 'message'));
        }
        if (result.artifacts) {
            for (let i = 0; i < result.artifacts.length; i++) {
                const artifact = result.artifacts[i];
                const content = artifact.content || '';
                violations.push(...this.checkForEmojis(content, `artifact[${artifact.name}]`));
                violations.push(...this.checkForLongDashes(content, `artifact[${artifact.name}]`));
                violations.push(...this.checkForSelfCredit(content, `artifact[${artifact.name}]`));
                if (artifact.name?.endsWith('.css')) {
                    violations.push(...this.checkForHardcodedColors(content, `artifact[${artifact.name}]`));
                }
                if (artifact.name?.endsWith('.svg') || content.includes('<svg')) {
                    blockers.push(...this.checkForFabricatedIcons(content, `artifact[${artifact.name}]`));
                }
            }
        }
        if (result.checklist) {
            for (let i = 0; i < result.checklist.length; i++) {
                const item = result.checklist[i];
                violations.push(...this.checkForEmojis(item.label, `checklist[${i}]`));
                violations.push(...this.checkForLongDashes(item.label, `checklist[${i}]`));
            }
        }
        return {
            passed: blockers.length === 0 && violations.length === 0,
            violations,
            blockers,
        };
    }
    static checkForEmojis(text, location) {
        const matches = text.match(this.EMOJI_PATTERN);
        if (!matches)
            return [];
        return [{
                rule: 'no-emojis',
                severity: 'warning',
                location,
                content: matches.join(', '),
                suggestion: 'Remove all emoji characters. Use text descriptions instead.',
            }];
    }
    static checkForLongDashes(text, location) {
        const matches = text.match(this.LONG_DASH_PATTERN);
        if (!matches)
            return [];
        return [{
                rule: 'no-long-dashes',
                severity: 'warning',
                location,
                content: 'Found long dash character (en-dash or em-dash)',
                suggestion: 'Replace with hyphen (-) or rewrite the sentence to avoid needing a dash.',
            }];
    }
    static checkForSelfCredit(text, location) {
        for (const pattern of this.SELF_CREDIT_PATTERNS) {
            if (pattern.test(text)) {
                return [{
                        rule: 'no-self-credit',
                        severity: 'critical',
                        location,
                        content: text.substring(0, 100),
                        suggestion: 'Remove attribution. Builder must be invisible. Do not credit Claude, Anthropic, AI tools, or creators.',
                    }];
            }
        }
        return [];
    }
    static checkForHardcodedColors(css, location) {
        const lines = css.split('\n');
        const violations = [];
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('/*') || line.includes('--') || line.includes('var('))
                continue;
            const hexMatches = line.match(/#[0-9a-f]{3,8}/gi);
            if (hexMatches) {
                if (!line.includes('//') && !line.includes('var(')) {
                    violations.push({
                        rule: 'use-design-tokens',
                        severity: 'warning',
                        location: `${location}:${i + 1}`,
                        content: line.trim(),
                        suggestion: 'Use CSS variables (var(--token-name)) instead of hardcoded hex values.',
                    });
                }
            }
        }
        return violations;
    }
    static checkForFabricatedIcons(svgContent, location) {
        const hasLibraryReference = this.ICON_LIBRARY_PATHS.some(lib => svgContent.includes(lib));
        if (hasLibraryReference) {
            return [];
        }
        const hasPath = svgContent.includes('<path');
        const hasBasicShapes = svgContent.includes('<rect') || svgContent.includes('<circle') || svgContent.includes('<ellipse');
        if (!hasPath && hasBasicShapes) {
            return [{
                    rule: 'no-fabricated-icons',
                    severity: 'critical',
                    location,
                    content: 'SVG appears to be hand-crafted with geometric shapes',
                    suggestion: 'Source icons from established icon libraries: Heroicons, Lucide, Tabler, Bootstrap Icons, Phosphor, Feather, Material Symbols. Copy path data verbatim from library source.',
                }];
        }
        const rectMatches = svgContent.match(/<rect[^>]*>/g) || [];
        if (rectMatches.length >= 3 && !hasPath) {
            return [{
                    rule: 'no-fabricated-icons',
                    severity: 'critical',
                    location,
                    content: `Found ${rectMatches.length} rect elements - likely hand-fabricated icon`,
                    suggestion: 'Use icons from established libraries instead of creating custom shapes.',
                }];
        }
        return [];
    }
    static toValidationResult(report) {
        const allViolations = report.violations.concat(report.blockers);
        const critical = allViolations.filter(v => v.severity === 'critical');
        const warning = allViolations.filter(v => v.severity === 'warning');
        const status = critical.length > 0 ? 'fail' :
            warning.length > 0 ? 'partial' :
                'pass';
        return {
            domain: 'claudemd-mandate',
            status,
            passedRules: [],
            failedRules: allViolations.map(v => `${v.severity}:${v.location}`),
            message: allViolations.map(v => v.suggestion || v.rule).join('; ') || 'No violations',
        };
    }
    static reportViolations(validation) {
        if (validation.passed) {
            return 'All CLAUDE.md mandates passed';
        }
        let report = 'CLAUDE.md Mandate Violations:\n\n';
        if (validation.blockers.length > 0) {
            report += `CRITICAL (${validation.blockers.length}):\n`;
            for (const blocker of validation.blockers) {
                report += `  * ${blocker.rule} @ ${blocker.location}\n`;
                if (blocker.suggestion) {
                    report += `    -> ${blocker.suggestion}\n`;
                }
            }
            report += '\n';
        }
        if (validation.violations.length > 0) {
            report += `Warnings (${validation.violations.length}):\n`;
            for (const violation of validation.violations) {
                report += `  * ${violation.rule} @ ${violation.location}\n`;
                if (violation.suggestion) {
                    report += `    -> ${violation.suggestion}\n`;
                }
            }
        }
        return report;
    }
}
exports.ClaudemdMandateValidator = ClaudemdMandateValidator;
// CLAUDE.md Rule 1: No emoji characters
ClaudemdMandateValidator.EMOJI_PATTERN = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{27BF}]|[\u{1F900}-\u{1F9FF}]/gu;
// CLAUDE.md Rule 2: No long dashes (Unicode U+2013 and U+2014)
ClaudemdMandateValidator.LONG_DASH_PATTERN = /[\u{2013}\u{2014}]/gu;
// CLAUDE.md Rule 3: No self-crediting language
ClaudemdMandateValidator.SELF_CREDIT_PATTERNS = [
    /built by/i,
    /created by/i,
    /generated by/i,
    /designed by/i,
    /made by/i,
    /powered by (claude|ai|anthropic)/i,
    /built with (claude|anthropic)/i,
    /created with (claude|anthropic)/i,
    /^(claude|anthropic|openai|gemini)[:\s]/i,
];
// CLAUDE.md Rule 4: No hardcoded color values in CSS (should use var())
ClaudemdMandateValidator.HARDCODED_COLOR_PATTERN = /(#[0-9a-f]{3,8}|rgb\(|hsl\()\s*(?!.*var\()/gi;
// CLAUDE.md Rule 5: No icon fabrication (should use library sources)
ClaudemdMandateValidator.ICON_LIBRARY_PATHS = [
    'heroicons.com',
    'lucide.dev',
    'tabler.io',
    'bootstrapicons.com',
    'phosphoricons.com',
    'feathericons.com',
    'fonts.google.com/icons',
];
//# sourceMappingURL=clausemd-mandate-validator.js.map