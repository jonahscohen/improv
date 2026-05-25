"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectTokenDrift = detectTokenDrift;
function collectCustomProps(css) {
    const out = [];
    const re = /(--[\w-]+)\s*:\s*([^;]+)/g;
    for (const m of css.matchAll(re)) {
        out.push(m[1]);
    }
    return Array.from(new Set(out));
}
function flattenColorValues(colors) {
    const out = [];
    const walk = (n) => {
        if (typeof n === 'string') {
            out.push(n.toLowerCase());
            return;
        }
        if (n && typeof n === 'object')
            for (const v of Object.values(n))
                walk(v);
    };
    walk(colors);
    return out;
}
function isColorToken(name) {
    return /^--c-|^--color/.test(name);
}
function isRadiusToken(name) {
    return /^--r-|^--radius|^--rounded/.test(name);
}
function isSpacingToken(name) {
    return /^--s-|^--space|^--spacing/.test(name);
}
function isEasingToken(name) {
    return /^--ease/.test(name);
}
function isDurationToken(name) {
    return /^--d-|^--duration/.test(name);
}
function detectTokenDrift(css, designTokens) {
    const props = collectCustomProps(css);
    const tokens = designTokens || {};
    const newColorTokens = [];
    const newRadiusTokens = [];
    const newSpacingTokens = [];
    const newEasingTokens = [];
    const newDurationTokens = [];
    const propValues = {};
    for (const m of css.matchAll(/(--[\w-]+)\s*:\s*([^;]+)/g)) {
        propValues[m[1]] = m[2].trim().toLowerCase();
    }
    const dtColors = flattenColorValues(tokens.colors).map(s => s.toLowerCase());
    const dtRadius = Object.values(tokens.rounded || {}).map(s => String(s).toLowerCase());
    const dtSpacing = Object.values(tokens.spacing?.sizes || tokens.spacing || {}).filter(s => typeof s === 'string').map(s => String(s).toLowerCase());
    const dtEasing = Object.values(tokens.motion?.ease || {}).map(s => String(s).toLowerCase());
    const dtDuration = Object.values(tokens.motion?.duration || {}).map(s => String(s).toLowerCase());
    for (const p of props) {
        const v = propValues[p];
        if (v && v.startsWith('var('))
            continue;
        if (isColorToken(p) && !dtColors.includes(v))
            newColorTokens.push(p);
        else if (isRadiusToken(p) && !dtRadius.includes(v))
            newRadiusTokens.push(p);
        else if (isSpacingToken(p) && !dtSpacing.includes(v))
            newSpacingTokens.push(p);
        else if (isEasingToken(p) && !dtEasing.includes(v))
            newEasingTokens.push(p);
        else if (isDurationToken(p) && !dtDuration.includes(v))
            newDurationTokens.push(p);
    }
    const total = newColorTokens.length + newRadiusTokens.length + newSpacingTokens.length + newEasingTokens.length + newDurationTokens.length;
    const summary = total === 0
        ? 'No drift detected: all custom properties have values covered by DESIGN.md'
        : `${total} drift token(s): propose for DESIGN.md or refactor to use existing tokens`;
    return { newColorTokens, newRadiusTokens, newSpacingTokens, newEasingTokens, newDurationTokens, summary };
}
//# sourceMappingURL=project-drift-detector.js.map