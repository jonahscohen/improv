"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// Task 8: convergence preflight evaluates EVERY requiredCoverageByScope record
// independently with AND-across-requirements / OR-within-a-requirement.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_convergence_preflight_1 = require("../lane-convergence-preflight");
async function run() {
    // --- direct regression: do not flatten requirement families or records ---
    const synthetic = (0, lane_convergence_preflight_1.evaluateCoverageRecordForTest)({ ruleId: 'r.synthetic', scope: 'project', evidenceAlternativesByRequirement: [['css', 'scss'], ['html', 'tsx']], requireAllDiscoveredApplicableFiles: false }, [{ path: 'style.css', sourceKind: 'css', outcome: 'inspected' }]);
    if (synthetic.ok)
        throw new Error('CSS satisfies only requirement 0; missing markup requirement must reject');
    if (synthetic.missingRequirements.map((x) => x.requirementIndex).join(',') !== '1')
        throw new Error('must report exact unsatisfied requirement family');
    // --- independent record evaluation: a CSS-only target satisfies the CSS record but
    // not the markup record; only the markup record is reported (no flattening). ---
    const recCssOnly = (0, lane_convergence_preflight_1.evaluateCoverageRecordForTest)({ ruleId: 'r.css', scope: 'project', evidenceAlternativesByRequirement: [['css', 'scss']], requireAllDiscoveredApplicableFiles: false }, [{ path: 'style.css', sourceKind: 'css', outcome: 'inspected' }]);
    if (!recCssOnly.ok)
        throw new Error('a CSS-only record is satisfied by a CSS file');
    const recMarkupOnly = (0, lane_convergence_preflight_1.evaluateCoverageRecordForTest)({ ruleId: 'r.markup', scope: 'project', evidenceAlternativesByRequirement: [['html', 'tsx']], requireAllDiscoveredApplicableFiles: false }, [{ path: 'style.css', sourceKind: 'css', outcome: 'inspected' }]);
    if (recMarkupOnly.ok)
        throw new Error('a markup-only record is NOT satisfied by a CSS-only target');
    if (recMarkupOnly.missingRequirements.map((x) => x.requirementIndex).join(',') !== '0')
        throw new Error('markup record must report its own requirement family');
    // --- empty target: no supported sources -> reject, gap names a required validator ---
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-empty-'));
    const r1 = await (0, lane_convergence_preflight_1.convergencePreflight)(empty, 'lane_converge');
    if (r1.ok)
        throw new Error('an empty target cannot satisfy the release floor');
    if (r1.gaps.length === 0)
        throw new Error('preflight names the unmet validator(s)');
    if (!/cannot be measured/.test(r1.message || ''))
        throw new Error('actionable message: ' + r1.message);
    // --- CSS + HTML target: supported -> ok ---
    const good = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-good-'));
    fs.writeFileSync(path.join(good, 'style.css'), '.btn { color: #111; }\n');
    fs.writeFileSync(path.join(good, 'index.html'), '<!doctype html><html><body><button>Go</button></body></html>\n');
    const r2 = await (0, lane_convergence_preflight_1.convergencePreflight)(good, 'lane_converge');
    if (!r2.ok)
        throw new Error('a CSS+HTML target meets the release floor, got: ' + r2.message);
    // --- CSS-only target satisfies the css-rule floor but NOT the markup-only required
    // rules (polish.animatepresence-initial + the anti-pattern project rules). The merged
    // release floor carries the markup requirement in polish-standard/anti-pattern, not
    // static-a11y (whose required a11y.focus-visible is a css-rule check). ---
    const cssOnly = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-css-only-'));
    fs.writeFileSync(path.join(cssOnly, 'style.css'), '.btn { color: #111; }\n');
    const rCssOnly = await (0, lane_convergence_preflight_1.convergencePreflight)(cssOnly, 'lane_converge');
    if (rCssOnly.ok)
        throw new Error('CSS-only/markup-unsupported target must reject');
    if (!rCssOnly.gaps.some((g) => g.validatorId === 'anti-pattern' && g.ruleId && g.missingRequirements.length)) {
        throw new Error('css-only rejection must name an exact rule/requirement/source gap for a markup-needing validator: ' + JSON.stringify(rCssOnly.gaps));
    }
    // --- mixed source: supported HTML/CSS plus unsupported Vue file must reject ---
    fs.writeFileSync(path.join(good, 'Widget.vue'), '<template><button>Go</button></template>\n');
    const mixed = await (0, lane_convergence_preflight_1.convergencePreflight)(good, 'lane_converge');
    if (mixed.ok)
        throw new Error('mixed target with an uncovered applicable source file must reject');
    if (!mixed.gaps.some((g) => g.sourceFile === 'Widget.vue'))
        throw new Error('mixed-source gap must name Widget.vue: ' + JSON.stringify(mixed.gaps));
    // --- unreadable subtree: a directory the collector cannot read is a coverage gap for
    // EVERY required rule (it could harbor an applicable file of any kind), mirroring the
    // runtime (run-validator treats an unreadable directory as a gap for every static
    // rule). Without this, a target with an unreadable subtree would PASS preflight and
    // then loop forever permanently-inconclusive. ---
    const unreadableRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-pf-unreadable-'));
    fs.writeFileSync(path.join(unreadableRoot, 'style.css'), '.btn { color: #111; }\n');
    fs.writeFileSync(path.join(unreadableRoot, 'index.html'), '<!doctype html><html><body><button>Go</button></body></html>\n');
    const locked = path.join(unreadableRoot, 'locked');
    fs.mkdirSync(locked);
    fs.writeFileSync(path.join(locked, 'inner.css'), '.x { color: #000; }\n');
    fs.chmodSync(locked, 0o000);
    try {
        let dirReadable = true;
        try {
            fs.readdirSync(locked);
        }
        catch {
            dirReadable = false;
        }
        if (!dirReadable) { // skip only on a permissive FS / root where the dir stays readable
            const rUnreadable = await (0, lane_convergence_preflight_1.convergencePreflight)(unreadableRoot, 'lane_converge');
            if (rUnreadable.ok)
                throw new Error('a target with an unreadable subtree must reject (mirror the runtime directory gap)');
            if (!rUnreadable.gaps.some((g) => g.sourceKind === 'directory' && g.sourceFile === 'locked')) {
                throw new Error('unreadable-subtree rejection must name the directory gap: ' + JSON.stringify(rUnreadable.gaps));
            }
        }
    }
    finally {
        fs.chmodSync(locked, 0o755);
    }
    // --- unknown lane / no policy -> reject ---
    const r3 = await (0, lane_convergence_preflight_1.convergencePreflight)(good, 'lane_build');
    if (r3.ok)
        throw new Error('a lane with no policy cannot preflight as a convergence lane');
    console.log('lane-convergence-preflight: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-convergence-preflight.test.js.map