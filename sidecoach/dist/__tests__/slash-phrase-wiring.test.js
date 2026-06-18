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
// sidecoach/src/__tests__/slash-phrase-wiring.test.ts
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
async function run() {
    const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'lane-wire-'));
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    const ctx = { projectPath: proj, userId: 'test' };
    // ROUTE phrase -> a lane is actually STARTED through process()
    const routed = await engine.process('/sidecoach build me a dashboard from scratch and make it production-ready', ctx);
    if (!routed.lane || !routed.lane.checkpointId)
        throw new Error('ROUTE phrase must start a lane via process()');
    if (routed.lane.currentVerb !== 'shape')
        throw new Error('started lane should be on its first verb');
    // OUT_OF_SCOPE phrase -> refusal, NOT a lane. NB: the first word must NOT be a
    // known verb/phase command. A lane-lexicon term co-occurring with a backend
    // negative_filter in one clause trips OUT_OF_SCOPE (empirically verified).
    const oos = await engine.process('/sidecoach a greenfield backend service with a sql database', ctx);
    if (oos.lane)
        throw new Error('backend phrase must not start a lane');
    if (!/UI|design|scope/i.test(oos.message || ''))
        throw new Error('OUT_OF_SCOPE should explain the scope');
    // typo -> near-miss suggestion, no lane
    const typo = await engine.process('/sidecoach polsih', ctx);
    if (typo.lane)
        throw new Error('typo must not start a lane');
    if (!/did you mean/i.test(typo.message || ''))
        throw new Error('typo should suggest');
    // bare /sidecoach still shows the menu (unchanged)
    const menu = await engine.process('/sidecoach', ctx);
    if (menu.lane)
        throw new Error('bare /sidecoach must not start a lane');
    // a known verb still routes via parseSlashCommand (not the phrase path)
    const known = await engine.process('/sidecoach polish', ctx);
    if (known.lane)
        throw new Error('known verb must use the command path, not phrase routing');
    // CLASSIFY confirm-to-start round trip: a murky phrase surfaces a candidate,
    // and confirming it (calling startLane with classify.laneId - the SAME
    // terminal path as ROUTE) actually starts the lane. 'make it pop' is an
    // empirically-verified CLASSIFY phrase (-> lane_delight, a sequence lane).
    const murky = await engine.process('/sidecoach make it pop', ctx);
    if (murky.classify) {
        if (!murky.classify.laneId)
            throw new Error('CLASSIFY must surface a candidate laneId');
        const confirmed = await engine.startLane(murky.classify.laneId, 'confirmed via interview', { projectPath: proj }, 'confirm-1');
        if (confirmed.lifecycle !== 'in_progress' || !confirmed.currentVerb)
            throw new Error('confirming a CLASSIFY candidate must start the lane (same path as ROUTE)');
    }
    else {
        // if 'make it pop' did not classify, the implementer MUST substitute a
        // verified-CLASSIFY phrase here - this branch must not silently pass.
        throw new Error('CLASSIFY round-trip not exercised: substitute a phrase the classifier returns CLASSIFY for');
    }
    console.log('slash-phrase-wiring: OK');
}
run();
//# sourceMappingURL=slash-phrase-wiring.test.js.map