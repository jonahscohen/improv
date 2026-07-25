// Unit spec for the PURE detector `detectTokenDrift(css, designTokens)`.
//
// The detector's job: given a project's CSS and its DESIGN.md tokens, report the typed custom
// properties whose VALUE is not covered by the design system, in each of the five governed
// categories (color / radius / spacing / easing / duration). Detection is VALUE-based (a value that
// appears anywhere in the sanctioned set is fine, regardless of which token name carries it) and
// skips `var()` references (an alias is not a new literal). This suite pins every one of those rules,
// including the two categories the original test did not exercise (easing, duration).
//
// Runs standalone under ts-node exactly as scripts/run-tests.ts invokes it.
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
  spacing: { sizes: { '6': '24px' } },
  motion: {
    ease: { out: 'cubic-bezier(0.2, 0, 0, 1)' },
    duration: { fast: '180ms' },
  },
};

const css = `
:root {
  --c-brand-red: #DC2618;
  --c-brand-red-hover: #B01F15;
  --r-sm: 4px;
  --r-tiny: 2px;
  --s-6: 24px;
  --s-7: 28px;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-bounce: cubic-bezier(0.34, 1.56, 0.64, 1);
  --d-fast: 180ms;
  --d-crawl: 900ms;
}
`;

const drift = detectTokenDrift(css, designTokens);

// --- color ---
assertEq(drift.newColorTokens.includes('--c-brand-red-hover'), true, 'detects new color token');
assertEq(drift.newColorTokens.includes('--c-brand-red'), false, 'does not flag matching color');

// --- radius ---
assertEq(drift.newRadiusTokens.includes('--r-tiny'), true, 'detects new radius token');
assertEq(drift.newRadiusTokens.includes('--r-sm'), false, 'does not flag matching radius');

// --- spacing ---
assertEq(drift.newSpacingTokens.includes('--s-7'), true, 'detects new spacing token');
assertEq(drift.newSpacingTokens.includes('--s-6'), false, 'does not flag matching spacing');

// --- easing (previously uncovered) ---
assertEq(drift.newEasingTokens.includes('--ease-bounce'), true, 'detects new easing token');
assertEq(drift.newEasingTokens.includes('--ease-out'), false, 'does not flag matching easing');

// --- duration (previously uncovered) ---
assertEq(drift.newDurationTokens.includes('--d-crawl'), true, 'detects new duration token');
assertEq(drift.newDurationTokens.includes('--d-fast'), false, 'does not flag matching duration');

// The summary must count all five categories, not just color/radius.
assertEq(/5 drift token/.test(drift.summary), true, 'summary counts all five drifted tokens');

console.log('project-drift-detector test PASS');

// Regression: var() references are aliases, not new literals - never flagged.
const cssWithVarRef = `:root { --c-brand-primary: var(--c-brand-red); --c-brand-red: #DC2618; }`;
const tokensWithRed = { colors: { brand: { red: '#DC2618' } } };
const driftVar = detectTokenDrift(cssWithVarRef, tokensWithRed);
assertEq(driftVar.newColorTokens.includes('--c-brand-primary'), false, 'var() ref not flagged as drift');

// Regression: named spacing tokens (no digit) categorized correctly by VALUE.
const cssNamedSpacing = `:root { --s-large: 24px; --s-xl: 32px; }`;
const tokensWithSpacing = { spacing: { sizes: { '6': '24px' } } };
const driftSpacing = detectTokenDrift(cssNamedSpacing, tokensWithSpacing);
assertEq(driftSpacing.newSpacingTokens.includes('--s-large'), false, 'named spacing matches by value');
assertEq(driftSpacing.newSpacingTokens.includes('--s-xl'), true, 'unmatched named spacing flagged');

// Detection is VALUE-based, not name-based: a value sanctioned under ANY DESIGN.md path is fine even
// under a differently-named custom property. `--c-anything` carrying the cream value is not drift.
const cssAlias = `:root { --c-anything: #F4EFE4; --c-bogus: #123456; }`;
const driftAlias = detectTokenDrift(cssAlias, designTokens);
assertEq(driftAlias.newColorTokens.includes('--c-anything'), false, 'a value present in the baseline is not drift regardless of token name');
assertEq(driftAlias.newColorTokens.includes('--c-bogus'), true, 'an off-system color value is drift');

// Case-insensitive value match: #dc2618 and #DC2618 are the same color.
const driftCase = detectTokenDrift(`:root { --c-x: #dc2618; }`, designTokens);
assertEq(driftCase.newColorTokens.includes('--c-x'), false, 'hex value comparison is case-insensitive');

console.log('project-drift-detector regression test PASS');
