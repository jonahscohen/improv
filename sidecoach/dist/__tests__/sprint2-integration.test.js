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
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
const flow_composition_1 = require("../flow-composition");
const path = __importStar(require("path"));
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(async () => {
    const refRoot = path.resolve(__dirname, '../../../reference');
    process.env.SIDECOACH_PROJECT_PATH = refRoot;
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // 1. Both new flows are registered
    const availableIds = engine.getAvailableFlows().map((f) => f.flowId);
    assertTrue(availableIds.includes('flowW_landing_composition'), 'flowW registered');
    assertTrue(availableIds.includes('flowX_copywriting'), 'flowX registered');
    // 2. New composite preset exists
    const craftLanding = flow_composition_1.PRESET_COMPOSITE_FLOWS.find((p) => p.id === 'composite_craft_landing_page');
    assertTrue(craftLanding != null, 'composite_craft_landing_page registered as preset');
    // 3. Each new handler runs in isolation through getHandlers()
    const handlers = engine.getHandlers();
    const wHandler = handlers.get('flowW_landing_composition');
    const xHandler = handlers.get('flowX_copywriting');
    assertTrue(wHandler != null, 'handlers.get(flowW) returns handler');
    assertTrue(xHandler != null, 'handlers.get(flowX) returns handler');
    const baseCtx = {
        utterance: 'craft a landing page',
        projectContext: { register: 'brand', product: {}, design: {} },
        metadata: { sectionIds: ['hero'], productName: 'Studio Atelier' },
        projectPath: refRoot,
    };
    const wResult = await wHandler.execute(baseCtx);
    assertTrue(wResult.status === 'success', 'flowW execute success');
    assertTrue((wResult.guidance || []).some((g) => g.includes('Hero')), 'flowW guidance covers Hero');
    const xResult = await xHandler.execute(baseCtx);
    assertTrue(xResult.status === 'success', 'flowX execute success');
    assertTrue((xResult.guidance || []).some((g) => /Option 1:/.test(g)), 'flowX guidance has draft Option 1');
    assertTrue((xResult.guidance || []).some((g) => /Studio Atelier/.test(g)), 'flowX substituted product name');
    // 4. Aggregate sanity - both handlers produce memory artifacts that downstream flows can consume
    assertTrue(wResult.memory != null, 'flowW memory emitted');
    assertTrue(xResult.memory != null, 'flowX memory emitted');
    console.log('sprint2-integration PASS');
})();
//# sourceMappingURL=sprint2-integration.test.js.map