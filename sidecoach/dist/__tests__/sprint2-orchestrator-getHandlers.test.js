"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const sidecoach_orchestrator_1 = require("../sidecoach-orchestrator");
function assertTrue(cond, label) {
    if (!cond) {
        console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
        process.exit(1);
    }
}
(() => {
    const engine = new sidecoach_orchestrator_1.FlowExecutionEngine();
    // Method exists and is a function
    assertTrue(typeof engine.getHandlers === 'function', 'engine.getHandlers is a function');
    const handlers = engine.getHandlers();
    // Returns a Map-like with .get() and .keys()
    assertTrue(typeof handlers.get === 'function', 'handlers.get is a function');
    assertTrue(typeof handlers.keys === 'function', 'handlers.keys is a function');
    // Includes the new flow IDs from earlier tasks
    assertTrue(handlers.get('flowW_landing_composition') != null, 'flowW handler present');
    assertTrue(handlers.get('flowX_copywriting') != null, 'flowX handler present');
    // Read-only contract: mutation methods are absent or throw. We do not enforce immutability at runtime
    // because Map's interface is broad; the contract is just "do not mutate."
    console.log('sprint2-orchestrator-getHandlers PASS');
})();
//# sourceMappingURL=sprint2-orchestrator-getHandlers.test.js.map