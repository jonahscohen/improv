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
const path = __importStar(require("path"));
const assert = __importStar(require("assert"));
const keyword_resolver_1 = require("../keyword-resolver");
const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const LANES = path.join(REPO, 'claude', 'hooks', 'sidecoach-lanes.json');
const CORPUS = path.join(REPO, 'sidecoach', 'parity', 'classifier-corpus.json');
const VERBS = ['shape', 'craft', 'polish', 'audit', 'critique', 'harden', 'adapt', 'colorize',
    'delight', 'animate', 'live', 'quieter', 'distill', 'clarify', 'layout', 'bolder',
    'overdrive', 'typeset', 'optimize', 'extract', 'onboard', 'document'].map(v => ({ verb: v }));
const reg = (0, keyword_resolver_1.loadRegistry)(LANES);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const corpus = require(CORPUS);
let failures = 0;
for (const c of corpus.cases) {
    const r = (0, keyword_resolver_1.classifyIntent)(c.prompt, reg, VERBS, { intentEligible: !!c.eligible });
    try {
        assert.strictEqual(r.outcome, c.expect, `outcome for: ${c.prompt}`);
        if (c.winningLane)
            assert.strictEqual(r.winningLane, c.winningLane, `winningLane for: ${c.prompt}`);
        if (c.verbMatch)
            assert.strictEqual(r.verbMatch, c.verbMatch, `verbMatch for: ${c.prompt}`);
    }
    catch (e) {
        failures++;
        console.error(String(e));
    }
}
const INTENT = path.join(REPO, 'claude', 'hooks', 'sidecoach-intent.json');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const intentReg = require(INTENT);
for (const c of corpus.cases) {
    const computed = (0, keyword_resolver_1.intentEligible)(c.prompt, intentReg);
    const r = (0, keyword_resolver_1.classifyIntent)(c.prompt, reg, VERBS, { intentEligible: computed });
    try {
        assert.strictEqual(r.outcome, c.expect, `computed-eligibility outcome for: ${c.prompt}`);
        if (c.winningLane)
            assert.strictEqual(r.winningLane, c.winningLane, `computed winningLane for: ${c.prompt}`);
        if (c.verbMatch)
            assert.strictEqual(r.verbMatch, c.verbMatch, `computed verbMatch for: ${c.prompt}`);
    }
    catch (e) {
        failures++;
        console.error(String(e));
    }
}
if (failures) {
    console.error(`PARITY FAILURES: ${failures}`);
    process.exit(1);
}
console.log(`classifier-parity: ${corpus.cases.length} cases OK (declared + computed eligibility)`);
//# sourceMappingURL=classifier-parity.test.js.map