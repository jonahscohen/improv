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
// sidecoach/src/__tests__/lane-cli.test.ts
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const MONITOR = path.join(__dirname, '..', '..', 'bin', 'sidecoach-monitor.js');
function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-cli-'));
    const start = (0, child_process_1.execFileSync)('node', [MONITOR, 'lane', 'start', '--lane', 'lane_build', '--project', proj, '--target', 'hero', '--start-request-id', 'cli-1'], { encoding: 'utf8' });
    const startObj = JSON.parse(start);
    if (startObj.laneId !== 'lane_build' || startObj.currentVerb !== 'shape')
        throw new Error('CLI start failed');
    const list = JSON.parse((0, child_process_1.execFileSync)('node', [MONITOR, 'lane', 'list', '--project', proj], { encoding: 'utf8' }));
    if (!Array.isArray(list) || list.length !== 1)
        throw new Error('CLI list failed');
    const status = JSON.parse((0, child_process_1.execFileSync)('node', [MONITOR, 'lane', 'status', '--project', proj, '--checkpoint', startObj.checkpointId], { encoding: 'utf8' }));
    if (status.lifecycle !== 'in_progress')
        throw new Error('CLI status failed');
    // P2-3: --report validation hardening. Each malformed report must be REJECTED
    // (non-zero exit) BEFORE it mutates the lane. The current step is 'shape'.
    const advanceWith = (report) => (0, child_process_1.execFileSync)('node', [MONITOR, 'lane', 'advance', '--project', proj, '--checkpoint', startObj.checkpointId, '--action', 'complete', '--revision', '0', '--report', JSON.stringify(report)], { encoding: 'utf8', stdio: 'pipe' });
    const rejects = (report, label) => {
        let threw = false;
        try {
            advanceWith(report);
        }
        catch {
            threw = true;
        }
        if (!threw)
            throw new Error(`CLI must reject ${label}`);
    };
    const base = { stepId: 'shape', reportId: 'r-ok', verb: 'shape', summary: 's', iteration: 0, evidence: [{ kind: 'note', detail: 'x' }] };
    rejects({ ...base, evidence: [{ kind: 'bogus', detail: 'x' }] }, 'an invalid evidence.kind');
    rejects({ ...base, evidence: [{ kind: 'note', detail: '' }] }, 'an empty evidence.detail');
    rejects({ ...base, stepId: '' }, 'an empty stepId');
    rejects({ ...base, reportId: '   ' }, 'a blank reportId');
    rejects({ ...base, checklistResults: [{ itemId: 'a', done: 'yes' }] }, 'a malformed checklistResults entry');
    console.log('lane-cli: OK');
}
run();
//# sourceMappingURL=lane-cli.test.js.map