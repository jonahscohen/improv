import { detectTokenDrift } from '../project-drift-detector';

function assertEq(actual: any, expected: any, label: string) {
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

const drift = detectTokenDrift(css, designTokens);
assertEq(drift.newColorTokens.includes('--c-brand-red-hover'), true, 'detects new color token');
assertEq(drift.newRadiusTokens.includes('--r-tiny'), true, 'detects new radius token');
assertEq(drift.newColorTokens.includes('--c-brand-red'), false, 'does not flag matching color');

console.log('project-drift-detector test PASS');
