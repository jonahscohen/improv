"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const project_drift_detector_1 = require("../project-drift-detector");
function assertEq(actual, expected, label) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        process.exit(1);
    }
}
const designTokens = {
    colors: { brand: { red: '#DC2618', cream: '#F4EFE4' } },
    rounded: { sm: '4px', md: '8px' },
};
const css = `
:root {
  --c-brand-red: #DC2618;
  --c-brand-red-hover: #B01F15;
  --r-sm: 4px;
  --r-tiny: 2px;
}
`;
const drift = (0, project_drift_detector_1.detectTokenDrift)(css, designTokens);
assertEq(drift.newColorTokens.includes('--c-brand-red-hover'), true, 'detects new color token');
assertEq(drift.newRadiusTokens.includes('--r-tiny'), true, 'detects new radius token');
assertEq(drift.newColorTokens.includes('--c-brand-red'), false, 'does not flag matching color');
console.log('project-drift-detector test PASS');
// Regression: var() references not flagged as drift
const cssWithVarRef = `:root { --c-brand-primary: var(--c-brand-red); --c-brand-red: #DC2618; }`;
const tokensWithRed = { colors: { brand: { red: '#DC2618' } } };
const driftVar = (0, project_drift_detector_1.detectTokenDrift)(cssWithVarRef, tokensWithRed);
assertEq(driftVar.newColorTokens.includes('--c-brand-primary'), false, 'var() ref not flagged as drift');
// Regression: named spacing tokens (no digit) categorized correctly
const cssNamedSpacing = `:root { --s-large: 24px; --s-xl: 32px; }`;
const tokensWithSpacing = { spacing: { sizes: { '6': '24px' } } };
const driftSpacing = (0, project_drift_detector_1.detectTokenDrift)(cssNamedSpacing, tokensWithSpacing);
assertEq(driftSpacing.newSpacingTokens.includes('--s-large'), false, 'named spacing matches');
assertEq(driftSpacing.newSpacingTokens.includes('--s-xl'), true, 'unmatched named spacing flagged');
console.log('project-drift-detector regression test PASS');
//# sourceMappingURL=project-drift-detector.test.js.map