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
// sidecoach/src/__tests__/validator-fixtures-e2e.test.ts
const path = __importStar(require("path"));
const flow_validation_capabilities_1 = require("../flow-validation-capabilities");
const SC = path.resolve(__dirname, '..', '..');
async function run() {
    for (const m of flow_validation_capabilities_1.FIXTURE_MANIFEST) {
        const reg = (0, flow_validation_capabilities_1.getValidatorRegistration)(m.validatorId);
        if (!reg || !reg.validateProduct)
            throw new Error(`${m.validatorId} has no validateProduct`);
        const cases = [
            ['clean', m.fixtures.clean], ['findings', m.fixtures.findings], ['inconclusive', m.fixtures.inconclusive],
        ];
        for (const [expected, rel] of cases) {
            const res = await reg.validateProduct({ projectPath: path.resolve(SC, rel) });
            if (res.status !== expected) {
                throw new Error(`${m.validatorId} ${rel}: expected status ${expected}, got ${res.status} (rules: ${res.rules.map((r) => r.ruleId + '=' + r.status).join(', ')})`);
            }
        }
    }
    // Polish clean/findings include non-Framer markup so polish.animatepresence-initial
    // resolves not_applicable (rather than inconclusive, which would flip the status).
    for (const cat of ['clean', 'findings']) {
        const res = await (0, flow_validation_capabilities_1.getValidatorRegistration)('polish-standard').validateProduct({ projectPath: path.resolve(SC, `fixtures/polish-standard/${cat}`) });
        const ap = res.rules.find((r) => r.ruleId === 'polish.animatepresence-initial');
        if (!ap || ap.status !== 'not_applicable')
            throw new Error(`polish.animatepresence-initial must be not_applicable in the ${cat} fixture (got ${ap?.status})`);
    }
    // a clean result MAY still carry non-blocking findings; consumers read status, not findings.length
    const apClean = await (0, flow_validation_capabilities_1.getValidatorRegistration)('anti-pattern').validateProduct({ projectPath: path.resolve(SC, 'fixtures/anti-pattern/clean') });
    if (apClean.status !== 'clean')
        throw new Error('anti-pattern clean fixture must be clean');
    console.log('validator-fixtures-e2e: OK');
}
run();
//# sourceMappingURL=validator-fixtures-e2e.test.js.map