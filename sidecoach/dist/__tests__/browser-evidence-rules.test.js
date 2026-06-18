"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const polish_checks_1 = require("../validators/checks/polish-checks");
const a11y_checks_1 = require("../validators/checks/a11y-checks");
const empty = { cssText: '', markup: '', files: [] };
const trusted = (kinds, over) => ({
    ...empty,
    ...over,
    browserEvidence: { available: true, kinds, renderUrl: 'data:text/html,test' },
});
const status = (key, ctx) => {
    const fn = polish_checks_1.POLISH_CHECKS[key] || a11y_checks_1.A11Y_CHECKS[key];
    if (!fn)
        throw new Error(`missing check ${key}`);
    return fn(ctx).status;
};
function run() {
    const keys = [
        'polish/concentric-radius',
        'polish/typography-rhythm',
        'a11y/min-hit-area',
        'a11y/color-contrast',
    ];
    for (const key of keys) {
        if (status(key, empty) !== 'inconclusive')
            throw new Error(`${key}: absent browser evidence must be inconclusive`);
    }
    if (status('polish/concentric-radius', trusted(['computed-style'], {
        computedStyle: { 'concentric.checkedPairs': '2', 'concentric.failingPairs': '0' },
    })) !== 'pass')
        throw new Error('concentric trusted pass missing');
    if (status('polish/concentric-radius', trusted(['computed-style'], {
        computedStyle: { 'concentric.checkedPairs': '2', 'concentric.failingPairs': '1' },
    })) !== 'fail')
        throw new Error('concentric trusted fail missing');
    if (status('polish/typography-rhythm', trusted(['computed-style'], {
        computedStyle: { 'typography.checkedElements': '3', 'typography.invalidLineHeightElements': '0' },
    })) !== 'pass')
        throw new Error('typography trusted pass missing');
    if (status('polish/typography-rhythm', trusted(['computed-style'], {
        computedStyle: { 'typography.checkedElements': '3', 'typography.invalidLineHeightElements': '1' },
    })) !== 'fail')
        throw new Error('typography trusted fail missing');
    if (status('a11y/min-hit-area', trusted(['dom'], {
        dom: { minHitArea: { checked: 2, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
    })) !== 'pass')
        throw new Error('hit-area trusted pass missing');
    if (status('a11y/min-hit-area', trusted(['dom'], {
        dom: { minHitArea: { checked: 2, failing: 1, smallestWidth: 20, smallestHeight: 20 } },
    })) !== 'fail')
        throw new Error('hit-area trusted fail missing');
    if (status('a11y/color-contrast', trusted(['contrast'], {
        contrast: { wcagAA: true, ratio: 7 },
    })) !== 'pass')
        throw new Error('contrast trusted pass missing');
    if (status('a11y/color-contrast', trusted(['contrast'], {
        contrast: { wcagAA: false, ratio: 1.2 },
    })) !== 'fail')
        throw new Error('contrast trusted fail missing');
    if (status('a11y/color-contrast', { ...empty, contrast: { wcagAA: true, ratio: 7 } }) !== 'inconclusive') {
        throw new Error('ad hoc browser-shaped fields must remain untrusted');
    }
    if (status('polish/anti-pattern-genericity', trusted(['dom'], {
        dom: { minHitArea: { checked: 1, failing: 0, smallestWidth: 44, smallestHeight: 44 } },
    })) !== 'inconclusive') {
        throw new Error('genericity must remain inconclusive when trusted collector DOM evidence is present');
    }
    console.log('browser-evidence-rules: OK');
}
run();
//# sourceMappingURL=browser-evidence-rules.test.js.map