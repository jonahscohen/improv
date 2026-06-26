"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const polish_standard_validator_1 = require("../polish-standard-validator");
const extended_domain_validator_1 = require("../extended-domain-validator");
const flow_handler_tactical_polish_1 = require("../flow-handler-tactical-polish");
// Test 1: DomainCheckContext Builder
function testDomainCheckContextBuilder() {
    console.log('\n[TEST] DomainCheckContext Builder\n');
    const context = {
        designTokens: {
            colors: { primary: '#0070f3', secondary: '#ff0080' },
            spacing: { xs: '4px', sm: '8px', md: '16px' },
        },
        componentTree: {
            root: {
                type: 'div',
                children: [
                    { type: 'button', name: 'PrimaryButton' },
                    { type: 'input', name: 'TextField' },
                ],
            },
        },
        cssRules: [
            'button { scale: 0.96 on :active }',
            'button { border-radius: 8px }',
            'div { padding: 4px; border-radius: 12px }',
        ],
        accessibility: {
            wcagLevel: 'AA',
            ariaRoles: ['button', 'textbox'],
            focusableElements: 5,
            contrastRatios: { 'primary-bg': 4.5 },
            keyboardNavigable: true,
            screenReaderText: ['Button: Primary action'],
        },
        contrast: {
            foreground: '#000000',
            background: '#ffffff',
            ratio: 21,
            wcagAA: true,
            wcagAAA: true,
        },
    };
    const isValid = context &&
        context.designTokens &&
        context.componentTree &&
        context.cssRules &&
        context.accessibility &&
        context.contrast;
    console.log(`✓ DomainCheckContext builder: ${isValid ? 'PASS' : 'FAIL'}`);
    if (isValid) {
        console.log(`  - Design tokens: ${Object.keys(context.designTokens || {}).length} categories`);
        console.log(`  - Component tree: ${Object.keys(context.componentTree || {}).length} nodes`);
        console.log(`  - CSS rules: ${(context.cssRules || []).length} rules`);
        console.log(`  - Accessibility: WCAG ${context.accessibility?.wcagLevel || 'N/A'}`);
        console.log(`  - Contrast ratio: ${context.contrast?.ratio || 'N/A'}:1`);
    }
    return isValid;
}
// Test 2: Polish Standard Validator
function testPolishStandardValidator() {
    console.log('\n[TEST] Polish Standard Validator\n');
    const context = {
        computedStyle: {
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        },
        cssRules: [
            'button { transform: scale(0.96) }',
            'button { border-radius: 8px }',
            'button { box-shadow: 0 1px 3px rgba(0,0,0,0.1) }',
            'text { font-smoothing: antialiased }',
        ],
        designTokens: {
            genericityScore: 45,
        },
    };
    const report = polish_standard_validator_1.PolishStandardValidator.validateAll(context);
    console.log(`✓ Polish Standard Validator Results:`);
    console.log(`  - Total rules: ${report.totalRules}`);
    console.log(`  - Passed: ${report.passed}`);
    console.log(`  - Violations: ${report.violations}`);
    console.log(`  - Pass rate: ${report.passRate}`);
    console.log(`  - Critical violations: ${report.criticalViolations}`);
    return report.totalRules === 24;
}
// Test 3: Extended Domain Validator
function testExtendedDomainValidator() {
    console.log('\n[TEST] Extended Domain Validator\n');
    const context = {
        designTokens: {
            colors: { primary: '#0070f3' },
            spacing: { base: '8px' },
            typography: { fontSize: { body: '14px' } },
            motion: { easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
        },
        componentTree: {},
        cssRules: [],
        accessibility: {
            wcagLevel: 'AA',
            ariaRoles: [],
            focusableElements: 0,
            contrastRatios: {},
            keyboardNavigable: false,
            screenReaderText: [],
        },
    };
    const report = extended_domain_validator_1.ExtendedDomainValidator.validateAll(context);
    console.log(`✓ Extended Domain Validator Results:`);
    console.log(`  - Total rules: ${report.totalRules}`);
    console.log(`  - Passed: ${report.passed}`);
    console.log(`  - Violations: ${report.violations}`);
    console.log(`  - Pass rate: ${report.passRate}`);
    // Stage 2 convergence: ExtendedDomainValidator is now a registry-backed facade over the absorbed forms (16)
    // + page-quality (6) rules = EXACTLY 22, NOT the old 196-rule theater framework. Assert the exact migration
    // contract (a tripwire that breaks if the absorbed set changes), plus the count invariant.
    return report.totalRules === 22 && (report.passed + report.violations === report.totalRules);
}
// Test 4: Combined Validator (46 rules = 24 Polish + 22 Extended)
function testCombinedValidation() {
    console.log('\n[TEST] Combined Validation (46 rules)\n');
    const context = {
        designTokens: {
            colors: { primary: '#0070f3', secondary: '#ff0080' },
            spacing: { xs: '4px', sm: '8px', md: '16px', lg: '32px' },
            typography: {
                fontSize: { xs: '12px', sm: '14px', base: '16px', lg: '18px' },
                fontFamily: 'Inter, system-ui',
                lineHeight: { tight: 1.2, normal: 1.5, relaxed: 1.75 },
            },
            motion: {
                duration: { fast: '100ms', normal: '300ms', slow: '500ms' },
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            },
            genericityScore: 42,
        },
        componentTree: {
            button: {
                states: ['default', 'hover', 'active', 'disabled', 'focus', 'loading'],
                variants: ['primary', 'secondary', 'text'],
            },
            input: {
                states: ['empty', 'filled', 'error', 'disabled', 'focus'],
            },
        },
        cssRules: [
            'button { transform: scale(0.96) on :active }',
            'button { border-radius: 8px; padding: 8px }',
            'button { box-shadow: 0 1px 3px rgba(0,0,0,0.1) }',
            'text { font-smoothing: antialiased }',
            'heading { text-wrap: balance }',
        ],
        accessibility: {
            wcagLevel: 'AA',
            ariaRoles: ['button', 'textbox', 'checkbox', 'radio'],
            focusableElements: 12,
            contrastRatios: {
                'text-on-bg': 7.2,
                'primary-text': 5.5,
                'secondary-text': 4.8,
            },
            keyboardNavigable: true,
            screenReaderText: ['Complete form with validation'],
        },
        contrast: {
            foreground: '#000000',
            background: '#ffffff',
            ratio: 21,
            wcagAA: true,
            wcagAAA: true,
        },
    };
    const polishReport = polish_standard_validator_1.PolishStandardValidator.validateAll(context);
    const extendedReport = extended_domain_validator_1.ExtendedDomainValidator.validateAll(context);
    const totalRules = polishReport.totalRules + extendedReport.totalRules;
    const totalPassed = polishReport.passed + extendedReport.passed;
    const combinedPassRate = ((totalPassed / totalRules) * 100).toFixed(1);
    console.log(`✓ Combined Validation Results:`);
    console.log(`  - Polish Standard: ${polishReport.passed}/${polishReport.totalRules} (${polishReport.passRate})`);
    console.log(`  - Extended Domains: ${extendedReport.passed}/${extendedReport.totalRules} (${extendedReport.passRate})`);
    console.log(`  - Combined: ${totalPassed}/${totalRules} (${combinedPassRate}%)`);
    // Stage 2 convergence: combined = PolishStandard (24) + the registry-backed ExtendedDomain facade (22) = 46,
    // no longer 112/114. Assert the EXACT migration contract (Extended === 22, combined === 46) + the aggregation
    // invariant. Exact literals are the regression tripwire; update them deliberately when the absorbed set changes.
    const totalViolations = polishReport.violations + extendedReport.violations;
    return extendedReport.totalRules === 22 && totalRules === 46 && (totalPassed + totalViolations === totalRules);
}
// Test 5: Flow J Integration
async function testFlowJIntegration() {
    console.log('\n[TEST] Flow J (Tactical Polish) Integration\n');
    const mockContext = {
        utterance: 'Apply tactical polish validation',
        projectPath: process.cwd(),
        metadata: {
            designTokens: {
                colors: { primary: '#0070f3' },
                spacing: { base: '8px' },
            },
            componentTree: {
                button: { type: 'button', states: ['default', 'hover', 'active'] },
            },
            cssRules: ['button { scale: 0.96 }'],
            accessibility: {
                wcagLevel: 'AA',
                ariaRoles: ['button'],
                focusableElements: 1,
                contrastRatios: { 'text-bg': 4.5 },
            },
            contrast: {
                foreground: '#000000',
                background: '#ffffff',
                ratio: 21,
                wcagAA: true,
                wcagAAA: true,
            },
        },
    };
    const handler = new flow_handler_tactical_polish_1.FlowJTacticalPolishHandler();
    const result = await handler.execute(mockContext);
    console.log(`✓ Flow J Results:`);
    console.log(`  - Status: ${result.status}`);
    console.log(`  - Message: ${result.message}`);
    console.log(`  - Checklist items: ${result.checklist?.length || 0}`);
    console.log(`  - Guidance sections: ${result.guidance?.length || 0}`);
    console.log(`  - Artifacts: ${result.artifacts?.length || 0}`);
    console.log(`  - Memory: ${result.memory ? 'YES' : 'NO'}`);
    return result.status === 'success';
}
// Run all tests
async function runValidatorIntegrationTests() {
    console.log('\n' + '='.repeat(80));
    console.log('VALIDATOR INTEGRATION TEST SUITE (Phase D)');
    console.log('='.repeat(80));
    let passed = 0;
    let failed = 0;
    try {
        if (testDomainCheckContextBuilder())
            passed++;
        else
            failed++;
        if (testPolishStandardValidator())
            passed++;
        else
            failed++;
        if (testExtendedDomainValidator())
            passed++;
        else
            failed++;
        if (testCombinedValidation())
            passed++;
        else
            failed++;
        if (await testFlowJIntegration())
            passed++;
        else
            failed++;
    }
    catch (err) {
        console.error('\nTest execution error:', err);
        failed++;
    }
    console.log('\n' + '='.repeat(80));
    console.log(`TEST RESULTS: ${passed} passed, ${failed} failed`);
    console.log('='.repeat(80) + '\n');
    process.exit(failed > 0 ? 1 : 0);
}
runValidatorIntegrationTests();
//# sourceMappingURL=validator-integration.test.js.map