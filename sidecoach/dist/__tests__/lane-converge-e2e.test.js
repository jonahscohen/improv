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
// Task 9: real orchestrator end-to-end on a TEMP COPY. This must pass through
// orchestrator preflight and must not write checkpoint artifacts under the tracked fixture.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const flow_validation_capabilities_1 = require("../flow-validation-capabilities");
const run_validator_1 = require("../validators/run-validator");
const FIXTURE = path.join(__dirname, 'fixtures', 'convergence', 'clean');
const rep = (verb) => ({ stepId: verb, iteration: 0, reportId: `r:${verb}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] });
async function run() {
    // Gate 1: each required validator must be clean on the fixture (actionable if not).
    for (const vId of (0, flow_validation_capabilities_1.getLanePolicy)('lane_converge').requiredProductValidatorIds) {
        const detail = await (0, run_validator_1.runValidatorForTest)(vId, { projectPath: FIXTURE });
        if (detail.result.status !== 'clean') {
            const failing = detail.result.rules.filter((r) => r.status !== 'pass' && r.status !== 'not_applicable')
                .map((r) => `${r.canonicalRuleKey}:${r.status}`);
            throw new Error(`fixture is not clean for ${vId} (status ${detail.result.status}); adjust the fixture for: ${failing.join(', ')}`);
        }
    }
    // Gate 2: copy the fixture, then drive through the REAL orchestrator so
    // convergencePreflight cannot be bypassed and tracked fixtures stay untouched.
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'p4c-e2e-'));
    const project = path.join(tempRoot, 'project');
    fs.cpSync(FIXTURE, project, { recursive: true });
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    const s = await engine.startLane('lane_converge', 'project', { projectPath: project }, 'e2e-' + Date.now());
    const a = await engine.advanceLane(project, s.checkpointId, { action: 'complete', report: rep('polish'), expectedRevision: s.revision });
    const b = await engine.advanceLane(project, s.checkpointId, { action: 'complete', report: rep('audit'), expectedRevision: a.revision });
    const c = await engine.advanceLane(project, s.checkpointId, { action: 'complete', report: rep('critique'), expectedRevision: b.revision });
    if (c.outcome !== 'converged')
        throw new Error('expected converged end-to-end, got ' + c.outcome + ' / ' + JSON.stringify(c.convergence));
    if (!c.convergence?.summary)
        throw new Error('converged result must carry a truthful summary');
    if (fs.existsSync(path.join(FIXTURE, '.claude')))
        throw new Error('tracked fixture must not receive checkpoint artifacts');
    // Prerequisite propagation through the REAL orchestrator (not just machine convergence):
    // completing a loop step must attest its successful flows so later steps' prerequisites
    // are satisfied. flowK requires flowJ; flowL requires J/K. Without propagation these
    // degrade to needs_input. (flowM/flowI require flowG, which the converge loop never
    // runs and the lane does not waive, so they legitimately stay needs_input - not asserted.)
    const cp = new lane_checkpoint_store_1.LaneCheckpointStore(project).read(s.checkpointId);
    const completed = cp.completedFlowIds;
    for (const need of ['flowJ_tactical_polish', 'flowK_multi_lens_audit', 'flowL_design_critique']) {
        if (!completed.includes(need))
            throw new Error(`loop-complete must attest ${need} into completedFlowIds; got ` + JSON.stringify(cp.completedFlowIds));
    }
    const advisoryOutcome = (flowId) => {
        for (const ar of cp.convergence.advisoryRuns) {
            const f = ar.flows.find((x) => String(x.flowId) === flowId);
            if (f)
                return f.outcome;
        }
        return undefined;
    };
    if (advisoryOutcome('flowK_multi_lens_audit') !== 'success')
        throw new Error('flowK (audit) must run successfully once flowJ is attested, got ' + advisoryOutcome('flowK_multi_lens_audit'));
    if (advisoryOutcome('flowL_design_critique') !== 'success')
        throw new Error('flowL (critique) must run successfully once J/K are attested, got ' + advisoryOutcome('flowL_design_critique'));
    console.log('lane-converge-e2e: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-converge-e2e.test.js.map