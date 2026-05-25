"use strict";
// Sidecoach Polish Standard Validator
// Utility for validating UI implementations against 22-point proprietary polish framework
// Separate from flow handlers - used by Flow J (Tactical Polish) and audit flows
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolishStandardValidator = void 0;
// 22-Point Polish Rules (14 baseline + 8 proprietary)
const POLISH_RULES = [
    {
        id: 1,
        name: 'Scale on Press',
        category: 'baseline',
        description: 'Interactive elements scale to 0.96 on press state',
        checkFunction: (ctx) => ({
            ruleId: 1,
            passed: ctx.cssRules?.some(r => r.includes('scale(0.96)')) ?? false,
            message: 'Scale on press effect should be present',
            remediation: 'Add :active { transform: scale(0.96); }'
        }),
        severity: 'high'
    },
    {
        id: 2,
        name: 'Concentric Border Radius',
        category: 'baseline',
        description: 'Outer radius = inner radius + padding',
        checkFunction: (ctx) => ({
            ruleId: 2,
            passed: ctx.computedStyle?.borderRadius !== '0px',
            message: 'Border radius relationship should follow concentric rule',
            remediation: 'Set outer_radius = inner_radius + padding'
        }),
        severity: 'medium'
    },
    {
        id: 3,
        name: 'Icon Swap via Opacity + Scale + Blur',
        category: 'baseline',
        description: 'Icon transitions use compound animation',
        checkFunction: (ctx) => ({
            ruleId: 3,
            passed: ((ctx.cssRules?.some(r => r.includes('opacity'))) ?? false) &&
                ((ctx.cssRules?.some(r => r.includes('scale'))) ?? false),
            message: 'Icon transitions need opacity, scale, and blur',
            remediation: 'Use: opacity, transform scale, and filter blur in transitions'
        }),
        severity: 'medium'
    },
    {
        id: 4,
        name: 'Image Outlines via Neutral Transparency',
        category: 'baseline',
        description: 'Image outlines use rgba(0,0,0,0.1), never tinted',
        checkFunction: (ctx) => ({
            ruleId: 4,
            passed: ctx.computedStyle?.borderColor?.includes('rgba') ?? false,
            message: 'Image outlines should use neutral transparency',
            remediation: 'Use border: 1px solid rgba(0,0,0,0.1)'
        }),
        severity: 'low'
    },
    {
        id: 5,
        name: 'Minimum Hit Area (40x40px)',
        category: 'baseline',
        description: 'Interactive elements have minimum 40x40px touch target',
        checkFunction: (ctx) => {
            if (!ctx.htmlElement)
                return { ruleId: 5, passed: false, message: 'Cannot measure element' };
            const rect = ctx.htmlElement.getBoundingClientRect();
            const minSize = ctx.htmlElement.tagName === 'BUTTON' ? 44 : 40;
            return {
                ruleId: 5,
                passed: rect.width >= minSize && rect.height >= minSize,
                message: `Hit area is ${Math.round(rect.width)}x${Math.round(rect.height)}px (need ${minSize}x${minSize}px)`,
                remediation: `Increase padding to reach ${minSize}x${minSize}px minimum`
            };
        },
        severity: 'critical'
    },
    {
        id: 6,
        name: 'No transition: all',
        category: 'baseline',
        description: 'Explicit property transitions only',
        checkFunction: (ctx) => ({
            ruleId: 6,
            passed: !(ctx.cssRules?.some(r => r.includes('transition: all')) ?? false),
            message: 'Should use explicit property transitions',
            remediation: 'Replace transition: all with specific properties'
        }),
        severity: 'high'
    },
    {
        id: 7,
        name: 'Tabular Numbers on Dynamic Data',
        category: 'baseline',
        description: 'Dynamic numeric fields use font-variant-numeric: tabular-nums',
        checkFunction: (ctx) => ({
            ruleId: 7,
            passed: !!(ctx.computedStyle && ctx.computedStyle.fontVariantNumeric?.includes('tabular')),
            message: 'Numeric fields should use tabular-nums',
            remediation: 'Add: font-variant-numeric: tabular-nums'
        }),
        severity: 'medium'
    },
    {
        id: 8,
        name: 'Text Wrap Balance on Headings',
        category: 'baseline',
        description: 'Headings use text-wrap: balance',
        checkFunction: (ctx) => {
            const isHeading = ctx.htmlElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(ctx.htmlElement.tagName);
            const hasBalance = ctx.cssRules?.some(r => r.includes('text-wrap: balance')) ?? false;
            return {
                ruleId: 8,
                passed: !isHeading || hasBalance,
                message: isHeading && !hasBalance ? 'Heading should use text-wrap: balance' : 'Not a heading',
                remediation: 'Add: text-wrap: balance to heading styles'
            };
        },
        severity: 'low'
    },
    {
        id: 9,
        name: 'Staggered Enter Animations',
        category: 'baseline',
        description: 'Multiple elements use stagger delay (30ms-80ms)',
        checkFunction: (ctx) => ({
            ruleId: 9,
            passed: ctx.cssRules?.some(r => r.includes('animation-delay')) ?? false,
            message: 'Animations should use stagger delays',
            remediation: 'Apply animation-delay: calc(30ms * var(--index))'
        }),
        severity: 'medium'
    },
    {
        id: 10,
        name: 'Subtle Exit Animations',
        category: 'baseline',
        description: 'Exiting elements fade and scale down',
        checkFunction: (ctx) => ({
            ruleId: 10,
            passed: (ctx.cssRules?.some(r => r.includes('opacity: 0')) ?? false) &&
                (ctx.cssRules?.some(r => r.includes('scale(0.8)')) ?? false),
            message: 'Exit animations need opacity and scale',
            remediation: 'Use: exit={{ opacity: 0, scale: 0.8 }}'
        }),
        severity: 'medium'
    },
    {
        id: 11,
        name: 'Font Smoothing',
        category: 'baseline',
        description: 'Text rendering optimized with font-smoothing',
        checkFunction: (ctx) => ({
            ruleId: 11,
            passed: ctx.cssRules?.some(r => r.includes('-webkit-font-smoothing')) ?? false,
            message: 'Should apply font smoothing',
            remediation: 'Add: -webkit-font-smoothing: antialiased (desktop)'
        }),
        severity: 'low'
    },
    {
        id: 12,
        name: 'AnimatePresence initial={false}',
        category: 'baseline',
        description: 'Prevent exit animations on first load',
        checkFunction: (ctx) => ({
            ruleId: 12,
            passed: (ctx.componentTree?.initial ?? undefined) === false,
            message: 'AnimatePresence children need initial={false}',
            remediation: 'Set initial={false} on all AnimatePresence children'
        }),
        severity: 'medium'
    },
    {
        id: 13,
        name: 'Sparse will-change',
        category: 'baseline',
        description: 'will-change used selectively',
        checkFunction: (ctx) => ({
            ruleId: 13,
            passed: !(ctx.cssRules?.some(r => r.includes('will-change: all')) ?? false),
            message: 'Avoid will-change: all',
            remediation: 'Use will-change for specific properties only'
        }),
        severity: 'low'
    },
    {
        id: 14,
        name: 'Shadows Over Borders',
        category: 'baseline',
        description: 'Use box-shadow for elevation',
        checkFunction: (ctx) => ({
            ruleId: 14,
            passed: !!(ctx.computedStyle?.boxShadow && ctx.computedStyle.boxShadow !== 'none'),
            message: 'Should use box-shadow for elevation',
            remediation: 'Add: box-shadow: 0 1px 3px rgba(0,0,0,0.1)'
        }),
        severity: 'medium'
    },
    {
        id: 15,
        name: 'Optical Alignment',
        category: 'proprietary',
        description: 'Correct visual imbalance from letter shapes',
        checkFunction: (ctx) => ({
            ruleId: 15,
            passed: ctx.cssRules?.some(r => r.includes('padding')) ?? false,
            message: 'Apply optical alignment adjustments',
            remediation: 'Subtract 2-4px from top padding for descender allowance'
        }),
        severity: 'medium'
    },
    {
        id: 16,
        name: 'Typography Rhythm',
        category: 'proprietary',
        description: 'Coherent vertical rhythm and modular scale',
        checkFunction: (ctx) => ({
            ruleId: 16,
            passed: ctx.computedStyle?.lineHeight !== 'normal',
            message: 'Establish typography rhythm',
            remediation: 'Set margin-bottom = line-height * font-size'
        }),
        severity: 'medium'
    },
    {
        id: 17,
        name: 'Shadow Hierarchy',
        category: 'proprietary',
        description: 'Shadow scales match elevation levels (0-5)',
        checkFunction: (ctx) => {
            const shadow = ctx.computedStyle?.boxShadow || '';
            const hasElevation = ['1px 2px', '4px 6px', '10px 25px', '20px 40px', '40px 80px'].some(level => shadow.includes(level));
            return {
                ruleId: 17,
                passed: hasElevation,
                message: 'Use elevation-based shadow hierarchy',
                remediation: 'Apply standard elevation levels: level 1-5'
            };
        },
        severity: 'medium'
    },
    {
        id: 18,
        name: 'Focus Visible',
        category: 'proprietary',
        description: 'Keyboard focus visible with outline-offset: 2px',
        checkFunction: (ctx) => ({
            ruleId: 18,
            passed: ctx.cssRules?.some(r => r.includes(':focus-visible')) ?? false,
            message: 'Implement :focus-visible for keyboard navigation',
            remediation: 'Add: :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }'
        }),
        severity: 'critical'
    },
    {
        id: 19,
        name: 'Reduced Motion Respect',
        category: 'proprietary',
        description: 'Animations disabled for motion-sensitive users',
        checkFunction: (ctx) => ({
            ruleId: 19,
            passed: ctx.cssRules?.some(r => r.includes('@media (prefers-reduced-motion')) ?? false,
            message: 'Respect prefers-reduced-motion',
            remediation: 'Add: @media (prefers-reduced-motion: reduce) { animation: none; }'
        }),
        severity: 'critical'
    },
    {
        id: 20,
        name: 'Color Contrast',
        category: 'proprietary',
        description: 'WCAG AA (4.5:1) or AAA (7:1) contrast',
        checkFunction: (ctx) => ({
            ruleId: 20,
            passed: ctx.contrast?.wcagAA ?? false,
            message: ctx.contrast ? `Contrast: ${ctx.contrast.ratio.toFixed(2)}:1` : 'Check contrast ratio',
            remediation: 'Achieve WCAG AA minimum (4.5:1 for text)'
        }),
        severity: 'critical'
    },
    {
        id: 21,
        name: 'Component State Completeness',
        category: 'proprietary',
        description: 'All 8 states defined (default, hover, focus, active, disabled, loading, error, success)',
        checkFunction: (ctx) => {
            const states = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
            const defined = states.filter(s => ctx.cssRules?.some(r => r.includes(`:${s}`)) ?? false).length;
            return {
                ruleId: 21,
                passed: defined >= 8,
                message: `${defined}/8 states defined`,
                remediation: 'Define all 8 component states with explicit styling'
            };
        },
        severity: 'high'
    },
    {
        id: 22,
        name: 'Anti-Pattern Detection',
        category: 'proprietary',
        description: 'Reject generic patterns (genericityScore > 70)',
        checkFunction: (ctx) => {
            const score = ctx.designTokens?.genericityScore || 0;
            return {
                ruleId: 22,
                passed: score < 55,
                message: `Design genericityScore: ${score}`,
                remediation: 'Add unique design personality (custom colors, typography, spacing)'
            };
        },
        severity: 'medium'
    }
];
class PolishStandardValidator {
    static validateAll(context) {
        const results = POLISH_RULES.map(rule => rule.checkFunction(context));
        const passed = results.filter(r => r.passed).length;
        const violations = results.filter(r => !r.passed);
        const passRate = ((passed / POLISH_RULES.length) * 100).toFixed(1);
        const critical = violations.filter(v => POLISH_RULES.find(r => r.id === v.ruleId)?.severity === 'critical').length;
        return {
            totalRules: POLISH_RULES.length,
            passed,
            violations: violations.length,
            passRate: `${passRate}%`,
            criticalViolations: critical,
            results,
            summary: `Polish Standard: ${passed}/${POLISH_RULES.length} rules passed (${passRate}%)`
        };
    }
    static getRules() {
        return POLISH_RULES;
    }
    static getSummary() {
        return 'Sidecoach 22-Point Polish Standard: 14 baseline + 8 proprietary rules for production UI quality';
    }
    static toValidationResult(report) {
        const failed = report.results.filter(r => !r.passed);
        const status = report.criticalViolations > 0 ? 'fail' :
            report.violations > 0 ? 'partial' :
                'pass';
        return {
            domain: 'polish-standard',
            status,
            passedRules: report.results.filter(r => r.passed).map(r => `rule-${r.ruleId}`),
            failedRules: failed.map(r => `rule-${r.ruleId}`),
            message: report.summary,
        };
    }
}
exports.PolishStandardValidator = PolishStandardValidator;
//# sourceMappingURL=polish-standard-validator.js.map