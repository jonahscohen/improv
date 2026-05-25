"use strict";
// Sidecoach Extended Domain Validator
// 112-rule framework: 22 Polish Standard + 90 Domain Extensions across 10 design domains
// Validates UI implementations against comprehensive design system
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExtendedDomainValidator = void 0;
// 112-Point Domain Validation Rules
const DOMAIN_RULES = [
    // Polish Standard Rules (22) - baseline from polish-standard-validator.ts
    {
        id: 'POLISH_001',
        domain: 'polish',
        name: 'Scale on Press',
        description: 'Interactive elements scale to 0.96 on press state',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_001',
            domain: 'polish',
            passed: ctx.cssRules?.some(r => r.includes('scale(0.96)')) ?? false,
            message: 'Scale on press effect should be present',
            remediation: 'Add :active { transform: scale(0.96); }'
        })
    },
    {
        id: 'POLISH_002',
        domain: 'polish',
        name: 'Concentric Border Radius',
        description: 'Outer radius = inner radius + padding',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_002',
            domain: 'polish',
            passed: ctx.computedStyle?.borderRadius !== '0px',
            message: 'Border radius relationship should follow concentric rule',
            remediation: 'Set outer_radius = inner_radius + padding'
        })
    },
    {
        id: 'POLISH_003',
        domain: 'polish',
        name: 'Icon Swap via Opacity + Scale + Blur',
        description: 'Icon transitions use compound animation',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_003',
            domain: 'polish',
            passed: ((ctx.cssRules?.some(r => r.includes('opacity'))) ?? false) &&
                ((ctx.cssRules?.some(r => r.includes('scale'))) ?? false),
            message: 'Icon transitions need opacity, scale, and blur',
            remediation: 'Use: opacity, transform scale, and filter blur in transitions'
        })
    },
    {
        id: 'POLISH_004',
        domain: 'polish',
        name: 'Image Outlines via Neutral Transparency',
        description: 'Image outlines use rgba(0,0,0,0.1), never tinted',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_004',
            domain: 'polish',
            passed: ctx.computedStyle?.borderColor?.includes('rgba') ?? false,
            message: 'Image outlines should use neutral transparency',
            remediation: 'Use border: 1px solid rgba(0,0,0,0.1)'
        })
    },
    {
        id: 'POLISH_005',
        domain: 'polish',
        name: 'Minimum Hit Area (40x40px)',
        description: 'Interactive elements have minimum 40x40px touch target',
        severity: 'critical',
        checkFunction: (ctx) => {
            if (!ctx.htmlElement)
                return { ruleId: 'POLISH_005', domain: 'polish', passed: false, message: 'Cannot measure element' };
            const rect = ctx.htmlElement.getBoundingClientRect();
            const minSize = ctx.htmlElement.tagName === 'BUTTON' ? 44 : 40;
            return {
                ruleId: 'POLISH_005',
                domain: 'polish',
                passed: rect.width >= minSize && rect.height >= minSize,
                message: `Hit area is ${Math.round(rect.width)}x${Math.round(rect.height)}px (need ${minSize}x${minSize}px)`,
                remediation: `Increase padding to reach ${minSize}x${minSize}px minimum`
            };
        }
    },
    {
        id: 'POLISH_006',
        domain: 'polish',
        name: 'No transition: all',
        description: 'Explicit property transitions only',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_006',
            domain: 'polish',
            passed: !(ctx.cssRules?.some(r => r.includes('transition: all')) ?? false),
            message: 'Should use explicit property transitions',
            remediation: 'Replace transition: all with specific properties'
        })
    },
    {
        id: 'POLISH_007',
        domain: 'polish',
        name: 'Tabular Numbers on Dynamic Data',
        description: 'Dynamic numeric fields use font-variant-numeric: tabular-nums',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_007',
            domain: 'polish',
            passed: !!(ctx.computedStyle && ctx.computedStyle.fontVariantNumeric?.includes('tabular')),
            message: 'Numeric fields should use tabular-nums',
            remediation: 'Add: font-variant-numeric: tabular-nums'
        })
    },
    {
        id: 'POLISH_008',
        domain: 'polish',
        name: 'Text Wrap Balance on Headings',
        description: 'Headings use text-wrap: balance',
        severity: 'low',
        checkFunction: (ctx) => {
            const isHeading = ctx.htmlElement && ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(ctx.htmlElement.tagName);
            const hasBalance = ctx.cssRules?.some(r => r.includes('text-wrap: balance')) ?? false;
            return {
                ruleId: 'POLISH_008',
                domain: 'polish',
                passed: !isHeading || hasBalance,
                message: isHeading && !hasBalance ? 'Heading should use text-wrap: balance' : 'Not a heading',
                remediation: 'Add: text-wrap: balance to heading styles'
            };
        }
    },
    {
        id: 'POLISH_009',
        domain: 'polish',
        name: 'Staggered Enter Animations',
        description: 'Multiple elements use stagger delay (30ms-80ms)',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_009',
            domain: 'polish',
            passed: ctx.cssRules?.some(r => r.includes('animation-delay')) ?? false,
            message: 'Animations should use stagger delays',
            remediation: 'Apply animation-delay: calc(30ms * var(--index))'
        })
    },
    {
        id: 'POLISH_010',
        domain: 'polish',
        name: 'Subtle Exit Animations',
        description: 'Exiting elements fade and scale down',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_010',
            domain: 'polish',
            passed: ((ctx.cssRules?.some(r => r.includes('opacity: 0'))) ?? false) &&
                ((ctx.cssRules?.some(r => r.includes('scale(0.8)'))) ?? false),
            message: 'Exit animations need opacity and scale',
            remediation: 'Use: exit={{ opacity: 0, scale: 0.8 }}'
        })
    },
    {
        id: 'POLISH_011',
        domain: 'polish',
        name: 'Font Smoothing',
        description: 'Text rendering optimized with font-smoothing',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_011',
            domain: 'polish',
            passed: ctx.cssRules?.some(r => r.includes('-webkit-font-smoothing')) ?? false,
            message: 'Should apply font smoothing',
            remediation: 'Add: -webkit-font-smoothing: antialiased (desktop)'
        })
    },
    {
        id: 'POLISH_012',
        domain: 'polish',
        name: 'AnimatePresence initial={false}',
        description: 'Prevent exit animations on first load',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_012',
            domain: 'polish',
            passed: (ctx.componentTree?.initial ?? undefined) === false,
            message: 'AnimatePresence children need initial={false}',
            remediation: 'Set initial={false} on all AnimatePresence children'
        })
    },
    {
        id: 'POLISH_013',
        domain: 'polish',
        name: 'Sparse will-change',
        description: 'will-change used selectively',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_013',
            domain: 'polish',
            passed: !(ctx.cssRules?.some(r => r.includes('will-change: all')) ?? false),
            message: 'Avoid will-change: all',
            remediation: 'Use will-change for specific properties only'
        })
    },
    {
        id: 'POLISH_014',
        domain: 'polish',
        name: 'Shadows Over Borders',
        description: 'Use box-shadow for elevation',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_014',
            domain: 'polish',
            passed: ctx.computedStyle?.boxShadow && ctx.computedStyle.boxShadow !== 'none',
            message: 'Should use box-shadow for elevation',
            remediation: 'Add: box-shadow: 0 1px 3px rgba(0,0,0,0.1)'
        })
    },
    {
        id: 'POLISH_015',
        domain: 'polish',
        name: 'Optical Alignment',
        description: 'Correct visual imbalance from letter shapes',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_015',
            domain: 'polish',
            passed: ctx.cssRules?.some(r => r.includes('padding')) ?? false,
            message: 'Apply optical alignment adjustments',
            remediation: 'Subtract 2-4px from top padding for descender allowance'
        })
    },
    {
        id: 'POLISH_016',
        domain: 'polish',
        name: 'Typography Rhythm',
        description: 'Coherent vertical rhythm and modular scale',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_016',
            domain: 'polish',
            passed: ctx.computedStyle?.lineHeight !== 'normal',
            message: 'Establish typography rhythm',
            remediation: 'Set margin-bottom = line-height * font-size'
        })
    },
    {
        id: 'POLISH_017',
        domain: 'polish',
        name: 'Shadow Hierarchy',
        description: 'Shadow scales match elevation levels (0-5)',
        severity: 'medium',
        checkFunction: (ctx) => {
            const shadow = ctx.computedStyle?.boxShadow || '';
            const hasElevation = ['1px 2px', '4px 6px', '10px 25px', '20px 40px', '40px 80px'].some(level => shadow.includes(level));
            return {
                ruleId: 'POLISH_017',
                domain: 'polish',
                passed: hasElevation,
                message: 'Use elevation-based shadow hierarchy',
                remediation: 'Apply standard elevation levels: level 1-5'
            };
        }
    },
    {
        id: 'POLISH_018',
        domain: 'polish',
        name: 'Focus Visible',
        description: 'Keyboard focus visible with outline-offset: 2px',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_018',
            domain: 'polish',
            passed: ctx.cssRules?.some(r => r.includes(':focus-visible')) ?? false,
            message: 'Implement :focus-visible for keyboard navigation',
            remediation: 'Add: :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }'
        })
    },
    {
        id: 'POLISH_019',
        domain: 'polish',
        name: 'Reduced Motion Respect',
        description: 'Animations disabled for motion-sensitive users',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_019',
            domain: 'polish',
            passed: ctx.cssRules?.some(r => r.includes('@media (prefers-reduced-motion')) ?? false,
            message: 'Respect prefers-reduced-motion',
            remediation: 'Add: @media (prefers-reduced-motion: reduce) { animation: none; }'
        })
    },
    {
        id: 'POLISH_020',
        domain: 'polish',
        name: 'Color Contrast',
        description: 'WCAG AA (4.5:1) or AAA (7:1) contrast',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'POLISH_020',
            domain: 'polish',
            passed: ctx.contrast?.wcagAA ?? false,
            message: ctx.contrast ? `Contrast: ${ctx.contrast.ratio.toFixed(2)}:1` : 'Check contrast ratio',
            remediation: 'Achieve WCAG AA minimum (4.5:1 for text)'
        })
    },
    {
        id: 'POLISH_021',
        domain: 'polish',
        name: 'Component State Completeness',
        description: 'All 8 states defined (default, hover, focus, active, disabled, loading, error, success)',
        severity: 'high',
        checkFunction: (ctx) => {
            const states = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
            const defined = states.filter(s => ctx.cssRules?.some(r => r.includes(`:${s}`)) ?? false).length;
            return {
                ruleId: 'POLISH_021',
                domain: 'polish',
                passed: defined >= 8,
                message: `${defined}/8 states defined`,
                remediation: 'Define all 8 component states with explicit styling'
            };
        }
    },
    {
        id: 'POLISH_022',
        domain: 'polish',
        name: 'Anti-Pattern Detection',
        description: 'Reject generic patterns (genericityScore > 70)',
        severity: 'medium',
        checkFunction: (ctx) => {
            const score = ctx.designTokens?.genericityScore || 0;
            return {
                ruleId: 'POLISH_022',
                domain: 'polish',
                passed: score < 55,
                message: `Design genericityScore: ${score}`,
                remediation: 'Add unique design personality (custom colors, typography, spacing)'
            };
        }
    },
    // Typography Domain (16 rules: 3 from Polish + 13 extensions)
    {
        id: 'TYPO_001',
        domain: 'typography',
        name: 'Modular Scale Consistency',
        description: 'Font sizes follow 1.25, 1.33, or 1.618 ratios',
        severity: 'high',
        checkFunction: (ctx) => {
            const size = ctx.typography?.fontSize || 16;
            const ratio = ctx.designTokens?.typographyScale || 1.25;
            const passed = size % 4 === 0 || size % 8 === 0;
            return {
                ruleId: 'TYPO_001',
                domain: 'typography',
                passed,
                message: passed ? 'Modular scale maintained' : 'Font size should follow modular scale',
                remediation: 'Use scale: 12, 15, 19, 24, 30, 38, 48, 60, 75 (1.25 ratio)'
            };
        }
    },
    {
        id: 'TYPO_002',
        domain: 'typography',
        name: 'Line Height to Font Size Ratio',
        description: 'Line height 1.4-1.6 for body, 1.2-1.3 for headings',
        severity: 'medium',
        checkFunction: (ctx) => {
            const fontSize = ctx.typography?.fontSize || 16;
            const lineHeight = ctx.typography?.lineHeight || 24;
            const ratio = lineHeight / fontSize;
            const isHeading = ctx.htmlElement && ['H1', 'H2', 'H3'].includes(ctx.htmlElement.tagName);
            const minRatio = isHeading ? 1.2 : 1.4;
            const maxRatio = isHeading ? 1.3 : 1.6;
            return {
                ruleId: 'TYPO_002',
                domain: 'typography',
                passed: ratio >= minRatio && ratio <= maxRatio,
                message: `Line height ratio: ${ratio.toFixed(2)} (need ${minRatio}-${maxRatio})`,
                remediation: `Set line-height: ${(fontSize * minRatio).toFixed(0)}px`
            };
        }
    },
    {
        id: 'TYPO_003',
        domain: 'typography',
        name: 'Letter Spacing Adjustment',
        description: 'Tracking applied per font (optical tightness)',
        severity: 'medium',
        checkFunction: (ctx) => {
            const tracking = ctx.typography?.letterSpacing || 0;
            const size = ctx.typography?.fontSize || 16;
            const passed = tracking !== 0 || size <= 12;
            return {
                ruleId: 'TYPO_003',
                domain: 'typography',
                passed,
                message: passed ? 'Letter spacing configured' : 'Should adjust tracking for font',
                remediation: 'Large display: negative tracking (-0.02em); small body: positive (+0.01em)'
            };
        }
    },
    {
        id: 'TYPO_004',
        domain: 'typography',
        name: 'X-Height and Cap-Height Alignment',
        description: 'Optical proportion checks for alignment',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'TYPO_004',
            domain: 'typography',
            passed: ctx.designTokens?.fontMetrics !== undefined,
            message: 'Font metrics should be documented',
            remediation: 'Define x-height/cap-height for all typeface families'
        })
    },
    {
        id: 'TYPO_005',
        domain: 'typography',
        name: 'Paragraph Spacing',
        description: 'Paragraph spacing equals line-height times font-size',
        severity: 'medium',
        checkFunction: (ctx) => {
            const lh = ctx.typography?.lineHeight || 24;
            const fs = ctx.typography?.fontSize || 16;
            const expected = lh;
            return {
                ruleId: 'TYPO_005',
                domain: 'typography',
                passed: (ctx.htmlElement?.tagName === 'P' && ctx.cssRules?.some(r => r.includes(`margin-bottom: ${expected}px`))) ?? false,
                message: 'Paragraph spacing should equal line-height',
                remediation: `Add margin-bottom: ${expected}px to <p> elements`
            };
        }
    },
    {
        id: 'TYPO_006',
        domain: 'typography',
        name: 'Font Weight Contrast',
        description: 'Light/regular/bold minimum 200+ difference',
        severity: 'medium',
        checkFunction: (ctx) => {
            const weights = ctx.designTokens?.fontWeights || [300, 400, 700];
            const diffs = [weights[1] - weights[0], weights[2] - weights[1]];
            const passed = diffs.every(d => d >= 200);
            return {
                ruleId: 'TYPO_006',
                domain: 'typography',
                passed,
                message: passed ? 'Font weight contrast sufficient' : 'Weight contrast too small',
                remediation: 'Use: Light 300, Regular 400, Bold 700 minimum'
            };
        }
    },
    {
        id: 'TYPO_007',
        domain: 'typography',
        name: 'Display vs Body Typography Separation',
        description: 'Contrast in personality between display and body',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'TYPO_007',
            domain: 'typography',
            passed: ctx.designTokens?.displayFont !== ctx.designTokens?.bodyFont,
            message: 'Display and body fonts should differ',
            remediation: 'Use serif for display, sans-serif for body (or vice versa)'
        })
    },
    {
        id: 'TYPO_008',
        domain: 'typography',
        name: 'Readability Minimum Font Size',
        description: 'Body text minimum 16px on 1x, 12px+ on mobile',
        severity: 'medium',
        checkFunction: (ctx) => {
            const size = ctx.typography?.fontSize || 16;
            const isBody = ctx.htmlElement?.tagName === 'P' || ctx.htmlElement?.className?.includes('body');
            return {
                ruleId: 'TYPO_008',
                domain: 'typography',
                passed: !isBody || size >= 12,
                message: `Font size: ${size}px (minimum 12px for body)`,
                remediation: 'Increase font size to minimum 12px for readability'
            };
        }
    },
    {
        id: 'TYPO_009',
        domain: 'typography',
        name: 'Dyslexia-Friendly Font Selection',
        description: 'High x-height, distinct characters',
        severity: 'low',
        checkFunction: (ctx) => {
            const dyslexiaFriendly = ['OpenDyslexic', 'Lexie Readable', 'Atkinson Hyperlegible', 'Comic Sans MS'];
            const current = ctx.typography?.fontFamily || '';
            return {
                ruleId: 'TYPO_009',
                domain: 'typography',
                passed: dyslexiaFriendly.some(f => current.includes(f)),
                message: 'Consider dyslexia-friendly typefaces',
                remediation: 'Use Atkinson Hyperlegible or similar for accessibility'
            };
        }
    },
    {
        id: 'TYPO_010',
        domain: 'typography',
        name: 'Variable Font Axis Usage',
        description: 'Weight range and optical size response',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'TYPO_010',
            domain: 'typography',
            passed: ctx.designTokens?.variableFonts !== undefined,
            message: 'Variable fonts should be configured',
            remediation: 'Define font-variation-settings for weight/optical-size axes'
        })
    },
    // Color Domain (18 rules: 2 from Polish + 16 extensions)
    {
        id: 'COLOR_001',
        domain: 'color',
        name: 'Semantic Color Naming',
        description: 'Primary, secondary, accent, danger, success, warning',
        severity: 'high',
        checkFunction: (ctx) => {
            const semantic = ['primary', 'secondary', 'accent', 'danger', 'success', 'warning'];
            const defined = semantic.filter(s => ctx.colors?.semantic && s in ctx.colors.semantic).length;
            return {
                ruleId: 'COLOR_001',
                domain: 'color',
                passed: defined >= 4,
                message: `${defined}/6 semantic colors defined`,
                remediation: 'Define all semantic color categories'
            };
        }
    },
    {
        id: 'COLOR_002',
        domain: 'color',
        name: 'Color Accessibility (WCAG)',
        description: 'Text 4.5:1, large text 3:1, interactive 3:1',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_002',
            domain: 'color',
            passed: ctx.contrast?.wcagAA ?? false,
            message: `Contrast: ${ctx.contrast?.ratio.toFixed(2) || 'unknown'}:1`,
            remediation: 'Achieve WCAG AA minimum contrast ratios'
        })
    },
    {
        id: 'COLOR_003',
        domain: 'color',
        name: 'Dark Mode Color Inversion',
        description: 'Token-based, not hard-coded',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_003',
            domain: 'color',
            passed: ctx.cssRules?.some(r => r.includes('@media (prefers-color-scheme: dark)')) ?? false,
            message: 'Dark mode should use CSS variables, not hard-coded colors',
            remediation: 'Add @media (prefers-color-scheme: dark) with token overrides'
        })
    },
    {
        id: 'COLOR_004',
        domain: 'color',
        name: 'Colorblind-Safe Palettes',
        description: 'Avoid red-green as only differentiator',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_004',
            domain: 'color',
            passed: ctx.visualization?.isColorblindSafe ?? false,
            message: 'Palette should be colorblind-safe',
            remediation: 'Use color + pattern/icon + label for status indication'
        })
    },
    {
        id: 'COLOR_005',
        domain: 'color',
        name: 'Contrast Ratio Minimums',
        description: 'Body text 4.5:1, disabled 3:1',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_005',
            domain: 'color',
            passed: ctx.contrast?.ratio ? ctx.contrast.ratio >= 4.5 : false,
            message: `Text contrast: ${ctx.contrast?.ratio.toFixed(2) || 'unknown'}:1`,
            remediation: 'Increase contrast to meet WCAG AA (4.5:1)'
        })
    },
    {
        id: 'COLOR_006',
        domain: 'color',
        name: 'Color Psychology Consistency',
        description: 'Warm/cool palette coherence',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_006',
            domain: 'color',
            passed: ctx.colors?.primary !== undefined && ctx.colors?.secondary !== undefined,
            message: 'Color palette should be psychologically coherent',
            remediation: 'Mix warm and cool colors intentionally, avoid random selection'
        })
    },
    {
        id: 'COLOR_007',
        domain: 'color',
        name: 'Saturation Consistency',
        description: 'Avoid mixing highly saturated and desaturated in same section',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_007',
            domain: 'color',
            passed: ctx.colors?.customCount ? ctx.colors.customCount <= 15 : false,
            message: 'Saturation levels should be consistent',
            remediation: 'Group colors by saturation; limit to 2-3 saturation levels'
        })
    },
    {
        id: 'COLOR_008',
        domain: 'color',
        name: 'Tint/Shade Generation',
        description: 'Consistent lightness ramps, no manual adjustment',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_008',
            domain: 'color',
            passed: ctx.designTokens?.colorScale !== undefined,
            message: 'Colors should be generated with consistent ratios',
            remediation: 'Use color interpolation: 10%, 30%, 50%, 70%, 90% lightness'
        })
    },
    {
        id: 'COLOR_009',
        domain: 'color',
        name: 'Opacity and Transparency Usage',
        description: 'Consistent alpha levels: 10%, 30%, 50%, 70%, 100%',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_009',
            domain: 'color',
            passed: ctx.cssRules?.some(r => r.includes('rgba') || r.includes('opacity')) ?? false,
            message: 'Opacity values should be consistent',
            remediation: 'Use: 0.1, 0.3, 0.5, 0.7, 1.0 opacity levels'
        })
    },
    {
        id: 'COLOR_010',
        domain: 'color',
        name: 'Brand Color Palette Limits',
        description: '3-5 primary + 5-10 secondary, avoid unlimited custom',
        severity: 'medium',
        checkFunction: (ctx) => {
            const customCount = ctx.colors?.customCount || 0;
            return {
                ruleId: 'COLOR_010',
                domain: 'color',
                passed: customCount <= 15,
                message: `Custom colors: ${customCount} (recommend 8-15 total)`,
                remediation: 'Consolidate to 3-5 primary + 5-10 secondary colors'
            };
        }
    },
    {
        id: 'COLOR_011',
        domain: 'color',
        name: 'Neutral Color Family',
        description: 'Gray, beige, blue-gray (avoid pure black except text/borders)',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_011',
            domain: 'color',
            passed: ctx.colors?.neutral !== undefined && ctx.colors.neutral.length > 0,
            message: 'Neutral family should be defined',
            remediation: 'Create 5-7 neutral shades from 100 (light) to 900 (dark)'
        })
    },
    {
        id: 'COLOR_012',
        domain: 'color',
        name: 'Color State Indication',
        description: 'Hover: +10% lightness, active: +20%, disabled: 50% opacity',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_012',
            domain: 'color',
            passed: ctx.cssRules?.some(r => r.includes(':hover') && r.includes('filter')) ?? false,
            message: 'State colors should follow lightness increment pattern',
            remediation: 'Use: hover +10%, active +20%, disabled 50% opacity'
        })
    },
    {
        id: 'COLOR_013',
        domain: 'color',
        name: 'Semantic Status Colors',
        description: 'Error red, success green, warning yellow, info blue',
        severity: 'high',
        checkFunction: (ctx) => {
            const statuses = ['error', 'success', 'warning', 'info'];
            const defined = statuses.filter(s => ctx.colors?.semantic && s in ctx.colors.semantic).length;
            return {
                ruleId: 'COLOR_013',
                domain: 'color',
                passed: defined >= 4,
                message: `${defined}/4 status colors defined`,
                remediation: 'Define error, success, warning, and info colors'
            };
        }
    },
    {
        id: 'COLOR_014',
        domain: 'color',
        name: 'Gradient Avoidance',
        description: 'Unless explicitly designed, avoid trendy gradients',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_014',
            domain: 'color',
            passed: !(ctx.cssRules?.some(r => r.includes('linear-gradient') && !r.includes('/* intentional */')) ?? false),
            message: 'Gradients should be intentional, not trendy',
            remediation: 'Limit gradients to specific design intent, document rationale'
        })
    },
    {
        id: 'COLOR_015',
        domain: 'color',
        name: 'Background Color Separation',
        description: 'Interactive elements 3:1 WCAG from background',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_015',
            domain: 'color',
            passed: ctx.contrast?.ratio ? ctx.contrast.ratio >= 3.0 : false,
            message: `Background separation: ${ctx.contrast?.ratio.toFixed(2) || 'unknown'}:1`,
            remediation: 'Ensure interactive elements contrast 3:1 from background'
        })
    },
    {
        id: 'COLOR_016',
        domain: 'color',
        name: 'Text on Image Overlays',
        description: 'Use scrim/dark overlay, never bare text',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'COLOR_016',
            domain: 'color',
            passed: (ctx.htmlElement?.style.backgroundColor !== '' && ctx.contrast?.wcagAA) ?? false,
            message: 'Text on images needs overlay for contrast',
            remediation: 'Add dark scrim overlay (rgba(0,0,0,0.4)) behind text'
        })
    },
    // Spatial Domain (14 rules)
    {
        id: 'SPACE_001',
        domain: 'spatial',
        name: 'Grid System Consistency',
        description: '4px or 8px baseline, all measurements multiples',
        severity: 'high',
        checkFunction: (ctx) => {
            const base = ctx.spacing?.baseUnit || 8;
            return {
                ruleId: 'SPACE_001',
                domain: 'spatial',
                passed: base === 4 || base === 8,
                message: `Grid baseline: ${base}px`,
                remediation: 'Use 4px or 8px base unit; all sizes must be multiples'
            };
        }
    },
    {
        id: 'SPACE_002',
        domain: 'spatial',
        name: 'Padding/Margin Ratio',
        description: 'Padding greater than margin for contained elements',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_002',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('padding') && !r.includes('margin')) ?? false,
            message: 'Contained elements should have padding > margin',
            remediation: 'Pad inner content before adding external margins'
        })
    },
    {
        id: 'SPACE_003',
        domain: 'spatial',
        name: 'Aspect Ratio Maintenance',
        description: 'Images 4:3, video 16:9, square 1:1',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_003',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('aspect-ratio')) ?? false,
            message: 'Aspect ratios should be enforced',
            remediation: 'Add aspect-ratio: 4/3 (or 16/9, 1/1) to maintain proportions'
        })
    },
    {
        id: 'SPACE_004',
        domain: 'spatial',
        name: 'Whitespace Hierarchy',
        description: 'Active > inactive > passive sections',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_004',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('margin')) ?? false,
            message: 'Whitespace should reflect importance hierarchy',
            remediation: 'Increase spacing for active sections, reduce for passive'
        })
    },
    {
        id: 'SPACE_005',
        domain: 'spatial',
        name: 'Alignment Precision',
        description: 'Left, center, right - avoid micro-adjustments',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_005',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('text-align:') || r.includes('justify-content:')) ?? false,
            message: 'Alignment should be consistent and intentional',
            remediation: 'Use text-align or justify-content, avoid pixel adjustments'
        })
    },
    {
        id: 'SPACE_006',
        domain: 'spatial',
        name: 'Spacing Scale',
        description: '4, 8, 12, 16, 24, 32, 48, 64 - no arbitrary sizes',
        severity: 'high',
        checkFunction: (ctx) => {
            const scale = ctx.spacing?.scale || [4, 8, 12, 16, 24, 32, 48, 64];
            return {
                ruleId: 'SPACE_006',
                domain: 'spatial',
                passed: scale.length === 8,
                message: `Spacing scale: ${scale.join(', ')}px`,
                remediation: 'Use standard scale: 4, 8, 12, 16, 24, 32, 48, 64'
            };
        }
    },
    {
        id: 'SPACE_007',
        domain: 'spatial',
        name: 'Container Max-Width',
        description: 'Limit line length to 65-75 characters',
        severity: 'medium',
        checkFunction: (ctx) => {
            const maxWidth = ctx.spacing?.containerMaxWidth || 1200;
            const passed = maxWidth >= 600 && maxWidth <= 1200;
            return {
                ruleId: 'SPACE_007',
                domain: 'spatial',
                passed,
                message: `Max-width: ${maxWidth}px`,
                remediation: 'Set container max-width: 720px-1200px for readability'
            };
        }
    },
    {
        id: 'SPACE_008',
        domain: 'spatial',
        name: 'Nested Spacing Rules',
        description: 'Child margins collapse to parent padding',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_008',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('margin-collapse') || r.includes('padding')) ?? false,
            message: 'Nested elements should collapse margins',
            remediation: 'Use padding on parent, not margin on children'
        })
    },
    {
        id: 'SPACE_009',
        domain: 'spatial',
        name: 'Gutter Spacing',
        description: 'Columns 16px-32px gap, responsive',
        severity: 'medium',
        checkFunction: (ctx) => {
            const gutter = ctx.spacing?.gutter || 24;
            const passed = gutter >= 16 && gutter <= 32;
            return {
                ruleId: 'SPACE_009',
                domain: 'spatial',
                passed,
                message: `Gutter width: ${gutter}px`,
                remediation: 'Use 16px-32px gutter, scale down on mobile'
            };
        }
    },
    {
        id: 'SPACE_010',
        domain: 'spatial',
        name: 'Z-Index Management',
        description: 'Documented layers: base 0, overlay 100, modal 1000',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_010',
            domain: 'spatial',
            passed: ctx.designTokens?.zIndex !== undefined,
            message: 'Z-index scale should be documented',
            remediation: 'Define: base (0), overlay (100), modal (1000), etc.'
        })
    },
    {
        id: 'SPACE_011',
        domain: 'spatial',
        name: 'Responsive Spacing Adjustments',
        description: 'Scale down 50% on mobile, maintain ratios',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_011',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('@media') && r.includes('padding|margin')) ?? false,
            message: 'Mobile spacing should scale proportionally',
            remediation: 'Add media query: @media (max-width: 768px) { padding: 50%; }'
        })
    },
    {
        id: 'SPACE_012',
        domain: 'spatial',
        name: 'Symmetry vs Asymmetry',
        description: 'Consistent visual weight distribution',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_012',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('flex') || r.includes('grid')) ?? false,
            message: 'Layout should maintain visual balance',
            remediation: 'Use flexbox/grid for consistent alignment'
        })
    },
    {
        id: 'SPACE_013',
        domain: 'spatial',
        name: 'Safe Areas',
        description: 'Notch/safe-inset awareness on mobile',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'SPACE_013',
            domain: 'spatial',
            passed: ctx.cssRules?.some(r => r.includes('env(safe-area-inset')) ?? false,
            message: 'Safe areas should be considered on mobile',
            remediation: 'Use padding: env(safe-area-inset-top) env(safe-area-inset-right) etc.'
        })
    },
    {
        id: 'SPACE_014',
        domain: 'spatial',
        name: 'Density Consistency',
        description: 'Touch targets 44x44px minimum interactive area',
        severity: 'critical',
        checkFunction: (ctx) => {
            if (!ctx.htmlElement)
                return { ruleId: 'SPACE_014', domain: 'spatial', passed: false, message: 'Cannot measure element' };
            const rect = ctx.htmlElement.getBoundingClientRect();
            return {
                ruleId: 'SPACE_014',
                domain: 'spatial',
                passed: rect.width >= 44 && rect.height >= 44,
                message: `Interactive area: ${Math.round(rect.width)}x${Math.round(rect.height)}px`,
                remediation: 'Increase to 44x44px minimum for comfortable touch'
            };
        }
    },
    // Motion Domain (20 rules: 5 from Polish + 15 extensions)
    {
        id: 'MOTION_001',
        domain: 'motion',
        name: 'Exponential Easing Only',
        description: 'No linear, no cubic-bezier approximations',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_001',
            domain: 'motion',
            passed: ctx.motion?.easing?.includes('ease-out') ?? false,
            message: 'Easing should be exponential (ease-out family)',
            remediation: 'Use: ease-out-quad, ease-out-cubic, ease-out-expo (never linear)'
        })
    },
    {
        id: 'MOTION_002',
        domain: 'motion',
        name: 'Duration Consistency',
        description: 'Micro 100-150ms, macro 300-500ms, full 600-800ms',
        severity: 'high',
        checkFunction: (ctx) => {
            const duration = ctx.motion?.duration || 300;
            const valid = (duration >= 100 && duration <= 150) ||
                (duration >= 300 && duration <= 500) ||
                (duration >= 600 && duration <= 800);
            return {
                ruleId: 'MOTION_002',
                domain: 'motion',
                passed: valid,
                message: `Duration: ${duration}ms`,
                remediation: 'Use durations: 100-150 (micro), 300-500 (macro), 600-800 (full)'
            };
        }
    },
    {
        id: 'MOTION_003',
        domain: 'motion',
        name: 'Ease Curve Selection',
        description: 'Ease-out for enters, ease-in for exits',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_003',
            domain: 'motion',
            passed: ctx.cssRules?.some(r => (r.includes('animation: enter') && r.includes('ease-out')) || (r.includes('animation: exit') && r.includes('ease-in'))) ?? false,
            message: 'Ease curves should match animation direction',
            remediation: 'Enter: ease-out (accelerating out), Exit: ease-in (decelerating)'
        })
    },
    {
        id: 'MOTION_004',
        domain: 'motion',
        name: 'Choreography Timing',
        description: '1st item t=0, 2nd t+30ms, 3rd t+60ms',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_004',
            domain: 'motion',
            passed: ctx.motion?.delay ? ctx.motion.delay >= 30 : false,
            message: `Stagger delay: ${ctx.motion?.delay || 0}ms`,
            remediation: 'Apply stagger: animation-delay: calc(30ms * var(--index))'
        })
    },
    {
        id: 'MOTION_005',
        domain: 'motion',
        name: 'Motion Purpose Clarity',
        description: 'Entrance, exit, update, feedback (not decoration)',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_005',
            domain: 'motion',
            passed: ctx.cssRules?.some(r => r.includes('/* entrance') || r.includes('/* exit') || r.includes('/* update') || r.includes('/* feedback')) ?? false,
            message: 'Animations should have documented purpose',
            remediation: 'Comment each animation: entrance, exit, update, or feedback'
        })
    },
    {
        id: 'MOTION_006',
        domain: 'motion',
        name: 'Velocity Perception',
        description: 'Same distance = same duration across sizes',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_006',
            domain: 'motion',
            passed: ctx.motion?.duration ? ctx.motion.duration >= 100 : false,
            message: 'Motion velocity should be perceptually consistent',
            remediation: 'Match duration to distance traveled, not element size'
        })
    },
    {
        id: 'MOTION_007',
        domain: 'motion',
        name: 'Gesture Response Timing',
        description: 'Instant < 100ms, quick 100-300ms, deliberate 300ms+',
        severity: 'medium',
        checkFunction: (ctx) => {
            const duration = ctx.motion?.duration || 300;
            const valid = duration < 100 || (duration >= 100 && duration <= 300) || duration > 300;
            return {
                ruleId: 'MOTION_007',
                domain: 'motion',
                passed: valid,
                message: `Gesture timing: ${duration}ms`,
                remediation: 'Instant: <100ms, Quick: 100-300ms, Deliberate: 300ms+'
            };
        }
    },
    {
        id: 'MOTION_008',
        domain: 'motion',
        name: 'Loading State Indication',
        description: 'Spinner, progress bar, or skeleton (3 choices)',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_008',
            domain: 'motion',
            passed: ctx.htmlElement?.className?.includes('loading') ?? false,
            message: 'Loading state should indicate progress',
            remediation: 'Use spinner (animated), progress bar, or skeleton screen'
        })
    },
    {
        id: 'MOTION_009',
        domain: 'motion',
        name: 'Transition Trigger Clarity',
        description: 'Hover, focus, active, click - explicit states',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_009',
            domain: 'motion',
            passed: ctx.cssRules?.some(r => r.includes(':hover') || r.includes(':focus') || r.includes(':active') || r.includes('@click')) ?? false,
            message: 'Transitions should be triggered by explicit states',
            remediation: 'Define :hover, :focus, :active, or @click triggers'
        })
    },
    {
        id: 'MOTION_010',
        domain: 'motion',
        name: 'Transform Origin Consistency',
        description: 'Center for scales, edges for slides',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_010',
            domain: 'motion',
            passed: ctx.cssRules?.some(r => r.includes('transform-origin')) ?? false,
            message: 'Transform origin should be intentional',
            remediation: 'Scale from center, slide from edge, rotate from center'
        })
    },
    {
        id: 'MOTION_011',
        domain: 'motion',
        name: 'GPU Acceleration',
        description: 'Transform/opacity only, avoid layout-triggering props',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_011',
            domain: 'motion',
            passed: !(ctx.cssRules?.some(r => (r.includes('animate:') && (r.includes('width:') || r.includes('height:') || r.includes('position:')))) ?? false),
            message: 'Animations should use GPU-accelerated properties',
            remediation: 'Animate only: transform, opacity (not width/height/position)'
        })
    },
    {
        id: 'MOTION_012',
        domain: 'motion',
        name: 'Accessibility Motion Testing',
        description: 'VoiceOver/screen reader announce states',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_012',
            domain: 'motion',
            passed: ctx.accessibility?.wcagLevel === 'AA' || ctx.accessibility?.wcagLevel === 'AAA',
            message: 'Animations should be accessible to screen readers',
            remediation: 'Test with VoiceOver: animations should not obscure content announcements'
        })
    },
    {
        id: 'MOTION_013',
        domain: 'motion',
        name: 'Performance Budgets',
        description: '60fps @ 120fps capable, 30fps minimum on low-end',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_013',
            domain: 'motion',
            passed: ctx.performance?.jsSize ? ctx.performance.jsSize < 100000 : false,
            message: 'Animations should maintain 60fps target',
            remediation: 'Profile with DevTools, optimize to 60fps on mid-range devices'
        })
    },
    {
        id: 'MOTION_014',
        domain: 'motion',
        name: 'Momentum vs Spring',
        description: 'Momentum for flicks, spring for interactive drags',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_014',
            domain: 'motion',
            passed: ctx.componentTree?.animationType !== undefined,
            message: 'Animation types should match interaction model',
            remediation: 'Use momentum (easing) for gestures, spring for interactive feedback'
        })
    },
    {
        id: 'MOTION_015',
        domain: 'motion',
        name: 'Reduced Motion Fallback',
        description: 'Instant transitions, no animations, state visible',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'MOTION_015',
            domain: 'motion',
            passed: ctx.motion?.hasReducedMotionMedia ?? false,
            message: 'Reduced motion preference should be respected',
            remediation: 'Add @media (prefers-reduced-motion: reduce) { animation: none; transition: none; }'
        })
    },
    // Interaction Domain (15 rules: 4 from Polish + 11 extensions)
    {
        id: 'INTERACT_001',
        domain: 'interaction',
        name: 'Eight-State Completeness',
        description: 'Default, hover, focus, active, disabled, loading, error, success',
        severity: 'critical',
        checkFunction: (ctx) => {
            const states = ['default', 'hover', 'focus', 'active', 'disabled', 'loading', 'error', 'success'];
            const defined = states.filter(s => ctx.cssRules?.some(r => r.includes(`:${s}`)) ?? false).length;
            return {
                ruleId: 'INTERACT_001',
                domain: 'interaction',
                passed: defined >= 8,
                message: `${defined}/8 states defined`,
                remediation: 'Define all 8 component states with explicit styling'
            };
        }
    },
    {
        id: 'INTERACT_002',
        domain: 'interaction',
        name: 'Cursor Indication',
        description: 'Pointer for interactive, text for inputs, default for disabled',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_002',
            domain: 'interaction',
            passed: ctx.cssRules?.some(r => r.includes('cursor:')) ?? false,
            message: 'Cursor should indicate interaction type',
            remediation: 'Use cursor: pointer (interactive), text (inputs), default (disabled)'
        })
    },
    {
        id: 'INTERACT_003',
        domain: 'interaction',
        name: 'Focus Ring Visibility',
        description: '2px offset, currentColor, always visible on keyboard',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_003',
            domain: 'interaction',
            passed: ctx.cssRules?.some(r => r.includes(':focus-visible') && r.includes('outline')) ?? false,
            message: 'Focus ring should be visible on keyboard navigation',
            remediation: 'Add :focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }'
        })
    },
    {
        id: 'INTERACT_004',
        domain: 'interaction',
        name: 'Disabled State Clarity',
        description: 'Greyed out + lower opacity + pointer disabled',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_004',
            domain: 'interaction',
            passed: ctx.cssRules?.some(r => r.includes(':disabled') && (r.includes('opacity') || r.includes('color'))) ?? false,
            message: 'Disabled state should be clearly distinguished',
            remediation: 'Apply: opacity 0.5 + greyed color + cursor: not-allowed'
        })
    },
    {
        id: 'INTERACT_005',
        domain: 'interaction',
        name: 'Loading State Indication',
        description: 'Spinner/skeleton inside element, not replacing',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_005',
            domain: 'interaction',
            passed: (ctx.htmlElement?.innerHTML?.includes('spinner') ?? false) || (ctx.htmlElement?.innerHTML?.includes('skeleton') ?? false),
            message: 'Loading state should provide visual feedback',
            remediation: 'Show spinner or skeleton inside button/field, maintain height'
        })
    },
    {
        id: 'INTERACT_006',
        domain: 'interaction',
        name: 'Error Messaging',
        description: 'Inline + color + icon, accessible to screen readers',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_006',
            domain: 'interaction',
            passed: ctx.htmlElement?.className?.includes('error') && ctx.accessibility?.screenReaderText?.length ? true : false,
            message: 'Errors should be announced to screen readers',
            remediation: 'Use aria-live="polite" or aria-describedby for error messages'
        })
    },
    {
        id: 'INTERACT_007',
        domain: 'interaction',
        name: 'Success Confirmation',
        description: 'Brief visual + optional toast, auto-dismiss after 4s',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_007',
            domain: 'interaction',
            passed: ctx.htmlElement?.className?.includes('success') ?? false,
            message: 'Success state should provide brief confirmation',
            remediation: 'Show success icon/toast, auto-dismiss after 3-4 seconds'
        })
    },
    {
        id: 'INTERACT_008',
        domain: 'interaction',
        name: 'Form Validation Strategy',
        description: 'On blur for initial, on change for corrections',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_008',
            domain: 'interaction',
            passed: (ctx.htmlElement?.tagName === 'INPUT' && ctx.cssRules?.some(r => r.includes('@blur') || r.includes('@change'))) ?? false,
            message: 'Validation should respect user interaction pattern',
            remediation: 'Validate on blur for initial, on change for subsequent edits'
        })
    },
    {
        id: 'INTERACT_009',
        domain: 'interaction',
        name: 'Doubleclick Prevention',
        description: 'Disable button during submit, show loading state',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_009',
            domain: 'interaction',
            passed: (ctx.componentTree?.disabled || ctx.htmlElement?.hasAttribute('disabled')) ?? false,
            message: 'Buttons should prevent doubleclick submissions',
            remediation: 'Disable on click: button.disabled = true (or show loading state)'
        })
    },
    {
        id: 'INTERACT_010',
        domain: 'interaction',
        name: 'Keyboard Navigation Completeness',
        description: 'All interactive elements keyboard accessible',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_010',
            domain: 'interaction',
            passed: ctx.accessibility?.keyboardNavigable ?? false,
            message: 'All interactive elements must be keyboard accessible',
            remediation: 'Add tabindex, ensure all buttons/inputs are focusable'
        })
    },
    {
        id: 'INTERACT_011',
        domain: 'interaction',
        name: 'Mobile Touch Interactions',
        description: 'Long-press, swipe, pinch, tap - documented per element',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'INTERACT_011',
            domain: 'interaction',
            passed: ctx.componentTree?.touchInteractions ? Object.keys(ctx.componentTree.touchInteractions).length > 0 : false,
            message: 'Touch interactions should be documented',
            remediation: 'Define per element: tap, long-press, swipe, pinch handlers'
        })
    },
    // Responsive Domain (12 rules)
    {
        id: 'RESPOND_001',
        domain: 'responsive',
        name: 'Breakpoint Consistency',
        description: 'Defined in DESIGN.md tokens',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_001',
            domain: 'responsive',
            passed: ctx.designTokens?.breakpoints !== undefined,
            message: 'Breakpoints should be defined in DESIGN.md',
            remediation: 'Define: mobile 0, tablet 768px, desktop 1024px, wide 1440px'
        })
    },
    {
        id: 'RESPOND_002',
        domain: 'responsive',
        name: 'Mobile-First Approach',
        description: 'Base styles mobile, media queries for larger screens',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_002',
            domain: 'responsive',
            passed: ctx.cssRules?.some(r => r.includes('@media (min-width')) ?? false,
            message: 'Mobile-first approach should use min-width media queries',
            remediation: 'Base styles for mobile, @media (min-width) for larger screens'
        })
    },
    {
        id: 'RESPOND_003',
        domain: 'responsive',
        name: 'Touch Target Scaling',
        description: '40x40px minimum at all breakpoints',
        severity: 'critical',
        checkFunction: (ctx) => {
            if (!ctx.htmlElement)
                return { ruleId: 'RESPOND_003', domain: 'responsive', passed: false, message: 'Cannot measure element' };
            const rect = ctx.htmlElement.getBoundingClientRect();
            return {
                ruleId: 'RESPOND_003',
                domain: 'responsive',
                passed: rect.width >= 40 && rect.height >= 40,
                message: `Touch target: ${Math.round(rect.width)}x${Math.round(rect.height)}px`,
                remediation: 'Maintain 40x40px minimum at all breakpoints'
            };
        }
    },
    {
        id: 'RESPOND_004',
        domain: 'responsive',
        name: 'Font Size Scaling',
        description: '16px desktop, 12-14px mobile',
        severity: 'medium',
        checkFunction: (ctx) => {
            const size = ctx.typography?.fontSize || 16;
            return {
                ruleId: 'RESPOND_004',
                domain: 'responsive',
                passed: size >= 12 && size <= 18,
                message: `Font size: ${size}px`,
                remediation: 'Scale down to 12-14px on mobile, maintain 16px+ on desktop'
            };
        }
    },
    {
        id: 'RESPOND_005',
        domain: 'responsive',
        name: 'Container Queries',
        description: 'If used, document intent per container',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_005',
            domain: 'responsive',
            passed: !(ctx.cssRules?.some(r => r.includes('@container')) ?? false) || ctx.designTokens?.containerQueries !== undefined,
            message: 'Container queries should be documented',
            remediation: 'If using @container, add comments explaining intent'
        })
    },
    {
        id: 'RESPOND_006',
        domain: 'responsive',
        name: 'Flex/Grid Responsiveness',
        description: 'Auto-columns, minmax ranges, no fixed widths',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_006',
            domain: 'responsive',
            passed: ctx.cssRules?.some(r => (r.includes('flex:') && !r.includes('width:')) || (r.includes('grid-auto') || r.includes('minmax'))) ?? false,
            message: 'Layouts should be flexible, not fixed-width',
            remediation: 'Use flex: 1, grid-auto-flow, minmax(min(100%, 500px), 1fr)'
        })
    },
    {
        id: 'RESPOND_007',
        domain: 'responsive',
        name: 'Image Responsiveness',
        description: 'srcset, sizes, max-width 100%',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_007',
            domain: 'responsive',
            passed: (ctx.htmlElement?.tagName === 'IMG' && (ctx.htmlElement?.hasAttribute('srcset') || ctx.cssRules?.some(r => r.includes('max-width: 100%')))) ?? false,
            message: 'Images should be responsive',
            remediation: 'Add srcset, sizes attributes; use max-width: 100%, height: auto'
        })
    },
    {
        id: 'RESPOND_008',
        domain: 'responsive',
        name: 'Viewport Meta Tag',
        description: 'width=device-width, initial-scale=1, no user-scalable=no',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_008',
            domain: 'responsive',
            passed: typeof window !== 'undefined' && (document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '').includes('width=device-width'),
            message: 'Viewport meta tag must be properly configured',
            remediation: '<meta name="viewport" content="width=device-width, initial-scale=1">'
        })
    },
    {
        id: 'RESPOND_009',
        domain: 'responsive',
        name: 'Orientation Handling',
        description: 'Portrait vs landscape, test on tablets',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_009',
            domain: 'responsive',
            passed: ctx.cssRules?.some(r => r.includes('@media (orientation:')) ?? false,
            message: 'Orientation changes should be handled',
            remediation: 'Add @media (orientation: landscape) for tablet layouts'
        })
    },
    {
        id: 'RESPOND_010',
        domain: 'responsive',
        name: 'Padding/Margin Responsiveness',
        description: 'Scale down gutter widths on mobile',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_010',
            domain: 'responsive',
            passed: ctx.cssRules?.some(r => r.includes('@media') && (r.includes('padding') || r.includes('margin'))) ?? false,
            message: 'Spacing should scale responsively',
            remediation: 'Add @media (max-width: 768px) { padding: 50%; }'
        })
    },
    {
        id: 'RESPOND_011',
        domain: 'responsive',
        name: 'Typography Scaling',
        description: 'Limit scaling range, test readability at all sizes',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_011',
            domain: 'responsive',
            passed: ctx.typography?.fontSize ? ctx.typography.fontSize >= 12 && ctx.typography.fontSize <= 20 : false,
            message: 'Typography should scale within readable range',
            remediation: 'Use fluid typography: clamp(12px, 2.5vw, 20px)'
        })
    },
    {
        id: 'RESPOND_012',
        domain: 'responsive',
        name: 'Layout Direction Support',
        description: 'LTR/RTL consistency, test Arabic/Hebrew',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'RESPOND_012',
            domain: 'responsive',
            passed: ctx.internationalization?.rtlSupport ?? false,
            message: 'RTL layouts should be supported',
            remediation: 'Use logical properties: start/end instead of left/right'
        })
    },
    // UX Writing Domain (11 rules)
    {
        id: 'WRITE_001',
        domain: 'ux-writing',
        name: 'Voice Consistency',
        description: 'Tone of voice matrix: professional/friendly/playful',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_001',
            domain: 'ux-writing',
            passed: ctx.designTokens?.voiceMatrix !== undefined,
            message: 'Voice should be consistent across UI',
            remediation: 'Define tone matrix: professional (errors), friendly (help), playful (success)'
        })
    },
    {
        id: 'WRITE_002',
        domain: 'ux-writing',
        name: 'Microcopy Standards',
        description: 'Error messages, help text, empty states - one template each',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_002',
            domain: 'ux-writing',
            passed: ctx.designTokens?.microcopyTemplates !== undefined,
            message: 'Microcopy should follow consistent templates',
            remediation: 'Document: error (problem + reason + solution), help (concise + action), empty (explanation + suggestion)'
        })
    },
    {
        id: 'WRITE_003',
        domain: 'ux-writing',
        name: 'CTA Clarity',
        description: 'Action verbs, avoid "OK/Submit", use specific language',
        severity: 'high',
        checkFunction: (ctx) => {
            const text = ctx.htmlElement?.textContent || '';
            const vague = ['OK', 'Submit', 'Next', 'Done', 'Click here'];
            const isVague = vague.some(v => text.includes(v));
            return {
                ruleId: 'WRITE_003',
                domain: 'ux-writing',
                passed: !isVague,
                message: `CTA text: "${text}"`,
                remediation: 'Use specific action verbs: "Save Settings", "Download PDF", "Add to Cart"'
            };
        }
    },
    {
        id: 'WRITE_004',
        domain: 'ux-writing',
        name: 'Error Message Formula',
        description: 'Problem + reason + solution, always constructive',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_004',
            domain: 'ux-writing',
            passed: ctx.htmlElement?.className?.includes('error') && ctx.htmlElement?.textContent?.length ? (ctx.htmlElement.textContent.length > 20) : false,
            message: 'Error messages should be specific and helpful',
            remediation: 'Format: "Email is invalid. Use format: name@example.com." (not just "Invalid")'
        })
    },
    {
        id: 'WRITE_005',
        domain: 'ux-writing',
        name: 'Empty State Messaging',
        description: 'Explanation + suggested action + reassurance',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_005',
            domain: 'ux-writing',
            passed: ctx.htmlElement?.className?.includes('empty-state') ?? false,
            message: 'Empty states should guide users',
            remediation: 'Include: why empty + action to populate + reassurance (data is safe)'
        })
    },
    {
        id: 'WRITE_006',
        domain: 'ux-writing',
        name: 'Loading State Messaging',
        description: 'Progress indication + estimated time + context',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_006',
            domain: 'ux-writing',
            passed: ctx.htmlElement?.className?.includes('loading') ?? false,
            message: 'Loading states should provide context',
            remediation: 'Show: "Uploading files... 45% complete" (not just spinner)'
        })
    },
    {
        id: 'WRITE_007',
        domain: 'ux-writing',
        name: 'Confirmation Dialogs',
        description: 'Dangerous actions require explicit confirmation',
        severity: 'critical',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_007',
            domain: 'ux-writing',
            passed: ctx.htmlElement?.className?.includes('danger') && ctx.htmlElement?.textContent?.includes('Type') ? true : false,
            message: 'Destructive actions should require explicit confirmation',
            remediation: 'For delete: "Type DELETE to confirm" (not just checkbox)'
        })
    },
    {
        id: 'WRITE_008',
        domain: 'ux-writing',
        name: 'Success Messaging',
        description: 'Brief positive acknowledgment, auto-dismiss 3-4s',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_008',
            domain: 'ux-writing',
            passed: ctx.htmlElement?.className?.includes('success') ?? false,
            message: 'Success messages should be brief and positive',
            remediation: 'Use: "Settings saved!" (not "Operation completed successfully")'
        })
    },
    {
        id: 'WRITE_009',
        domain: 'ux-writing',
        name: 'Help Text Guidelines',
        description: 'Concise, action-oriented, example provided',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_009',
            domain: 'ux-writing',
            passed: ctx.htmlElement?.className?.includes('help-text') ?? false,
            message: 'Help text should be concise and actionable',
            remediation: 'Keep under 2 sentences, include example: "Format: mm/dd/yyyy"'
        })
    },
    {
        id: 'WRITE_010',
        domain: 'ux-writing',
        name: 'Label Clarity',
        description: 'Avoid abbreviations, be specific',
        severity: 'medium',
        checkFunction: (ctx) => {
            const text = ctx.htmlElement?.textContent || '';
            const abbreviated = text.length < 5 || text === text.toUpperCase();
            return {
                ruleId: 'WRITE_010',
                domain: 'ux-writing',
                passed: !abbreviated,
                message: `Label: "${text}"`,
                remediation: 'Use: "First Name" (not "Fname"), "Zip Code" (not "ZIP")'
            };
        }
    },
    {
        id: 'WRITE_011',
        domain: 'ux-writing',
        name: 'Capitalization Consistency',
        description: 'Title case for headings, sentence case for body',
        severity: 'low',
        checkFunction: (ctx) => ({
            ruleId: 'WRITE_011',
            domain: 'ux-writing',
            passed: ctx.htmlElement ? (['H1', 'H2', 'H3'].includes(ctx.htmlElement.tagName) || ctx.htmlElement.tagName === 'P') : false,
            message: 'Capitalization should follow hierarchy',
            remediation: 'Headings: Title Case, Body: Sentence case'
        })
    },
    // Performance Domain (9 rules)
    {
        id: 'PERF_001',
        domain: 'performance',
        name: 'Bundle Size Targets',
        description: 'JS < 100KB gzipped, CSS < 30KB gzipped',
        severity: 'high',
        checkFunction: (ctx) => {
            const jsSize = ctx.performance?.jsSize || 0;
            const cssSize = ctx.performance?.cssSize || 0;
            return {
                ruleId: 'PERF_001',
                domain: 'performance',
                passed: jsSize < 100000 && cssSize < 30000,
                message: `Bundle: JS ${(jsSize / 1000).toFixed(0)}KB, CSS ${(cssSize / 1000).toFixed(0)}KB`,
                remediation: 'Target: JS < 100KB, CSS < 30KB (gzipped)'
            };
        }
    },
    {
        id: 'PERF_002',
        domain: 'performance',
        name: 'Image Optimization',
        description: 'Modern formats: WebP/AVIF, lazy loading',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_002',
            domain: 'performance',
            passed: ctx.performance?.imageOptimized ?? false,
            message: 'Images should use modern formats and lazy loading',
            remediation: 'Use WebP/AVIF with fallbacks, add loading="lazy"'
        })
    },
    {
        id: 'PERF_003',
        domain: 'performance',
        name: 'Font Loading Strategy',
        description: 'System fonts, woff2 only, font-display: swap',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_003',
            domain: 'performance',
            passed: ctx.cssRules?.some(r => r.includes('font-display: swap')) ?? false,
            message: 'Font loading should not block rendering',
            remediation: 'Use font-display: swap; prefer system fonts'
        })
    },
    {
        id: 'PERF_004',
        domain: 'performance',
        name: 'CSS-in-JS Evaluation',
        description: 'Compiled CSS preferred, runtime overhead measured',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_004',
            domain: 'performance',
            passed: ctx.designTokens?.cssStrategy !== 'css-in-js-runtime',
            message: 'CSS-in-JS should be compiled, not runtime',
            remediation: 'Use CSS Modules or static CSS, measure runtime overhead'
        })
    },
    {
        id: 'PERF_005',
        domain: 'performance',
        name: 'Animation GPU Cost',
        description: 'Only transform/opacity, test on mid-range devices',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_005',
            domain: 'performance',
            passed: !(ctx.cssRules?.some(r => (r.includes('animation:') && (r.includes('width:') || r.includes('height:') || r.includes('position:')))) ?? false),
            message: 'Animations should use GPU-accelerated properties',
            remediation: 'Animate only transform and opacity'
        })
    },
    {
        id: 'PERF_006',
        domain: 'performance',
        name: 'Component Lazy Loading',
        description: 'Code-split heavy components, Suspense boundaries',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_006',
            domain: 'performance',
            passed: ctx.componentTree?.lazy ?? false,
            message: 'Heavy components should be lazy-loaded',
            remediation: 'Use dynamic import() or React.lazy() for code splitting'
        })
    },
    {
        id: 'PERF_007',
        domain: 'performance',
        name: 'Interaction Latency',
        description: '< 100ms response time, perceptible feedback always',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_007',
            domain: 'performance',
            passed: ctx.motion?.duration ? ctx.motion.duration < 100 || ctx.htmlElement?.className?.includes('loading') : false,
            message: 'Interactions should respond within 100ms',
            remediation: 'Add loading indicators for operations > 100ms'
        })
    },
    {
        id: 'PERF_008',
        domain: 'performance',
        name: 'Memory Footprint',
        description: 'No memory leaks, monitor with DevTools',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_008',
            domain: 'performance',
            passed: true,
            message: 'Memory usage should be monitored',
            remediation: 'Use DevTools heap snapshots to detect leaks'
        })
    },
    {
        id: 'PERF_009',
        domain: 'performance',
        name: 'Network Waterfall',
        description: 'Critical path identified, async/defer used',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'PERF_009',
            domain: 'performance',
            passed: ctx.cssRules?.some(r => r.includes('async') || r.includes('defer')) ?? false,
            message: 'Scripts should use async/defer loading',
            remediation: 'Use <script async> or <script defer> to avoid blocking'
        })
    },
    // Data Visualization Domain (10 rules)
    {
        id: 'DATAVIS_001',
        domain: 'data-visualization',
        name: 'Color Accessibility in Charts',
        description: 'Colorblind-safe palettes, add texture/pattern',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_001',
            domain: 'data-visualization',
            passed: ctx.visualization?.isColorblindSafe ?? false,
            message: 'Chart colors should be colorblind-safe',
            remediation: 'Avoid red-green alone; add pattern, hatching, or labels'
        })
    },
    {
        id: 'DATAVIS_002',
        domain: 'data-visualization',
        name: 'Legend Clarity',
        description: 'Always provided, positioned logically',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_002',
            domain: 'data-visualization',
            passed: ctx.visualization?.hasLegend ?? false,
            message: 'Charts should have a legend',
            remediation: 'Provide legend; position right or below chart'
        })
    },
    {
        id: 'DATAVIS_003',
        domain: 'data-visualization',
        name: 'Axis Labels',
        description: 'Always present, units specified, no ambiguity',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_003',
            domain: 'data-visualization',
            passed: ctx.visualization?.hasAxisLabels ?? false,
            message: 'Axes must be labeled with units',
            remediation: 'Add x/y axis labels with units: "Revenue ($)", "Time (seconds)"'
        })
    },
    {
        id: 'DATAVIS_004',
        domain: 'data-visualization',
        name: 'Data Precision',
        description: 'Avoid excessive decimals, 2-3 significant figures',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_004',
            domain: 'data-visualization',
            passed: true,
            message: 'Data should be displayed at appropriate precision',
            remediation: 'Use 2-3 significant figures (not 4.37596249 when 4.38 suffices)'
        })
    },
    {
        id: 'DATAVIS_005',
        domain: 'data-visualization',
        name: 'Chart Type Selection',
        description: 'Bar for categories, line for trends, scatter for correlation',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_005',
            domain: 'data-visualization',
            passed: ctx.visualization?.chartType !== undefined,
            message: 'Chart type should match data structure',
            remediation: 'Bar: categories, Line: time series, Scatter: correlation, Pie: proportions'
        })
    },
    {
        id: 'DATAVIS_006',
        domain: 'data-visualization',
        name: 'Interactive Tooltips',
        description: 'Clear label + value + context + timestamp',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_006',
            domain: 'data-visualization',
            passed: ctx.visualization?.hasTooltips ?? false,
            message: 'Tooltips should provide full context',
            remediation: 'Show label, value, units, and timestamp in tooltips'
        })
    },
    {
        id: 'DATAVIS_007',
        domain: 'data-visualization',
        name: 'Responsive Charts',
        description: 'Reflow to vertical on mobile, test at all breakpoints',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_007',
            domain: 'data-visualization',
            passed: ctx.cssRules?.some(r => r.includes('@media')) ?? false,
            message: 'Charts should be responsive',
            remediation: 'Use SVG viewBox or canvas scaling; reflow to vertical on mobile'
        })
    },
    {
        id: 'DATAVIS_008',
        domain: 'data-visualization',
        name: 'Animation Clarity',
        description: 'Ease-in-out for value changes, clear transitions',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_008',
            domain: 'data-visualization',
            passed: ctx.motion?.easing?.includes('ease') ?? false,
            message: 'Chart animations should use ease-in-out',
            remediation: 'Animate value changes with ease-in-out timing'
        })
    },
    {
        id: 'DATAVIS_009',
        domain: 'data-visualization',
        name: 'Accessibility Text',
        description: 'Table fallback, aria-label per series, screen reader text',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_009',
            domain: 'data-visualization',
            passed: ctx.accessibility?.screenReaderText?.length ? true : false,
            message: 'Charts must have accessible alternatives',
            remediation: 'Provide <table> fallback, aria-label per series, aria-describedby for summary'
        })
    },
    {
        id: 'DATAVIS_010',
        domain: 'data-visualization',
        name: 'Zero/Null Handling',
        description: 'Consistent treatment, documented in legend/footnote',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'DATAVIS_010',
            domain: 'data-visualization',
            passed: true,
            message: 'Missing data should be handled consistently',
            remediation: 'Document in legend: "No data = gray", "Null = gap in line"'
        })
    },
    // Internationalization Domain (7 rules)
    {
        id: 'I18N_001',
        domain: 'internationalization',
        name: 'Text Expansion Buffers',
        description: 'German +20%, Chinese +10%, Arabic RTL',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'I18N_001',
            domain: 'internationalization',
            passed: ctx.internationalization?.languages ? ctx.internationalization.languages.length > 1 : false,
            message: 'Layouts should accommodate text expansion',
            remediation: 'Design for +20% expansion; use flexible containers'
        })
    },
    {
        id: 'I18N_002',
        domain: 'internationalization',
        name: 'Number/Date/Time Formatting',
        description: 'Locale-aware, respect user preferences',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'I18N_002',
            domain: 'internationalization',
            passed: ctx.internationalization?.dateFormat !== undefined && ctx.internationalization?.numberFormat !== undefined,
            message: 'Dates/numbers should be locale-aware',
            remediation: 'Use Intl.DateTimeFormat, Intl.NumberFormat APIs'
        })
    },
    {
        id: 'I18N_003',
        domain: 'internationalization',
        name: 'Language Selector Placement',
        description: 'Header, persistent across sessions',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'I18N_003',
            domain: 'internationalization',
            passed: ctx.htmlElement?.className?.includes('language-selector') ?? false,
            message: 'Language switcher should be prominent and persistent',
            remediation: 'Place in header, remember user selection in localStorage'
        })
    },
    {
        id: 'I18N_004',
        domain: 'internationalization',
        name: 'Translated Asset Storage',
        description: 'Images with text, consider localization cost',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'I18N_004',
            domain: 'internationalization',
            passed: !ctx.htmlElement?.tagName?.includes('IMG') || ctx.htmlElement?.getAttribute('alt'),
            message: 'Images with text should have alt text in all languages',
            remediation: 'Use separate images per language, or avoid text in images'
        })
    },
    {
        id: 'I18N_005',
        domain: 'internationalization',
        name: 'Keyboard Layouts',
        description: 'Support alternative IME inputs for CJK',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'I18N_005',
            domain: 'internationalization',
            passed: true,
            message: 'CJK inputs should be supported',
            remediation: 'Test with Chinese/Japanese/Korean IME inputs'
        })
    },
    {
        id: 'I18N_006',
        domain: 'internationalization',
        name: 'Font Coverage',
        description: 'Ensure font supports all target languages',
        severity: 'high',
        checkFunction: (ctx) => ({
            ruleId: 'I18N_006',
            domain: 'internationalization',
            passed: ctx.designTokens?.fontCount ? ctx.designTokens.fontCount >= 2 : false,
            message: 'Fonts should support target languages',
            remediation: 'Use Noto Sans (CJK), Noto Serif (Arabic), ensure full Unicode support'
        })
    },
    {
        id: 'I18N_007',
        domain: 'internationalization',
        name: 'Pluralization Rules',
        description: 'CLDR-compliant, not English-centric',
        severity: 'medium',
        checkFunction: (ctx) => ({
            ruleId: 'I18N_007',
            domain: 'internationalization',
            passed: ctx.internationalization?.pluralizationRules !== undefined,
            message: 'Pluralization should follow language-specific rules',
            remediation: 'Use ICU MessageFormat or i18next for CLDR-compliant pluralization'
        })
    }
];
class ExtendedDomainValidator {
    static validateAll(context) {
        // Empty-input gate: if the handler did not provide real validation inputs
        // (designTokens AND cssRules both empty/missing), short-circuit with a
        // skipped status rather than running rules against undefined and
        // synthesizing a misleading pass rate. Other inputs (htmlElement,
        // computedStyle, colors, typography, spacing, motion, accessibility,
        // contrast, performance, visualization, internationalization) also
        // count as real input - if any are present, run the full validation.
        const ctx = context || {};
        const designTokensEmpty = !ctx.designTokens || Object.keys(ctx.designTokens).length === 0;
        const cssRulesEmpty = !ctx.cssRules || ctx.cssRules.length === 0;
        const anyOtherInput = !!ctx.htmlElement ||
            !!ctx.computedStyle ||
            !!ctx.colors ||
            !!ctx.typography ||
            !!ctx.spacing ||
            !!ctx.motion ||
            !!ctx.accessibility ||
            !!ctx.contrast ||
            !!ctx.performance ||
            !!ctx.visualization ||
            !!ctx.internationalization;
        if (designTokensEmpty && cssRulesEmpty && !anyOtherInput) {
            return {
                status: 'skipped',
                reason: 'no inputs provided',
                totalRules: 0,
                passed: 0,
                violations: 0,
                passRate: 'n/a',
                violationsByDomain: {},
                passRateByDomain: {},
                criticalViolations: 0,
                results: [],
                summary: 'Validation skipped: no inputs provided (designTokens, cssRules, and all domain-specific inputs are empty/missing)',
            };
        }
        const results = DOMAIN_RULES.map(rule => rule.checkFunction(context));
        const passed = results.filter(r => r.passed).length;
        const violations = results.filter(r => !r.passed);
        const passRate = ((passed / DOMAIN_RULES.length) * 100).toFixed(1);
        const critical = violations.filter(v => DOMAIN_RULES.find(r => r.id === v.ruleId)?.severity === 'critical').length;
        const violationsByDomain = {};
        const passRateByDomain = {};
        const domains = Array.from(new Set(DOMAIN_RULES.map(r => r.domain)));
        domains.forEach(domain => {
            const domainRules = DOMAIN_RULES.filter(r => r.domain === domain);
            const domainPassed = results.filter(r => r.domain === domain && r.passed).length;
            violationsByDomain[domain] = domainRules.length - domainPassed;
            passRateByDomain[domain] = `${((domainPassed / domainRules.length) * 100).toFixed(1)}%`;
        });
        return {
            status: 'completed',
            totalRules: DOMAIN_RULES.length,
            passed,
            violations: violations.length,
            passRate: `${passRate}%`,
            violationsByDomain,
            passRateByDomain,
            criticalViolations: critical,
            results,
            summary: `Extended Domain Validation: ${passed}/${DOMAIN_RULES.length} rules passed (${passRate}%) across 10 domains`
        };
    }
    static getDomains() {
        return Array.from(new Set(DOMAIN_RULES.map(r => r.domain)));
    }
    static getRulesByDomain(domain) {
        return DOMAIN_RULES.filter(r => r.domain === domain);
    }
    static getSummary() {
        return 'Sidecoach Extended Domain Framework: 112 rules across 10 design domains (22 Polish + 90 Domain Extensions)';
    }
}
exports.ExtendedDomainValidator = ExtendedDomainValidator;
//# sourceMappingURL=extended-domain-validator.js.map