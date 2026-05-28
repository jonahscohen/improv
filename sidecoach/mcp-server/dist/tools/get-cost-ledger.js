"use strict";
// Tool 8: sidecoach_get_cost_ledger - read the in-process session cost
// ledger from model-routing.ts. Read-only; never mutates the ledger.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const model_routing_1 = require("../../../dist/model-routing");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_get_cost_ledger',
    description: 'Return the current session cost ledger from sidecoach\'s model-routing module. ' +
        'Default format "summary" returns aggregate totals and per-flow/per-model breakdowns. ' +
        'Format "raw" returns every CostEntry row. Read-only; never modifies the ledger.',
    inputSchema: schemas_1.getCostLedgerShape,
    timeoutMs: 5000,
};
const handler = async (input, _deps) => {
    let entries;
    try {
        entries = (0, model_routing_1.getSessionLedger)();
    }
    catch (err) {
        throw new errors_1.SidecoachToolError('VALIDATOR_FAILURE', 'failed to read session ledger from model-routing module', { validator: 'getSessionLedger', errorMessage: err instanceof Error ? err.message : String(err) });
    }
    const format = input.format ?? 'summary';
    const totals = entries.reduce((acc, e) => {
        acc.calls += 1;
        acc.inputTokens += e.inputTokens;
        acc.outputTokens += e.outputTokens;
        acc.estimatedCostUsd += e.estimatedCost;
        return acc;
    }, { calls: 0, inputTokens: 0, outputTokens: 0, estimatedCostUsd: 0 });
    let summary;
    try {
        summary = (0, model_routing_1.summarizeLedger)(entries);
    }
    catch (err) {
        // summarizeLedger should never throw, but defense in depth.
        summary = `ledger summary unavailable: ${err instanceof Error ? err.message : String(err)}`;
    }
    return {
        data: {
            format,
            totals,
            entries: format === 'raw' ? entries : [],
            summary,
        },
        summary: `sidecoach_get_cost_ledger: ${totals.calls} call(s), $${totals.estimatedCostUsd.toFixed(4)} estimated`,
    };
};
exports.handler = handler;
//# sourceMappingURL=get-cost-ledger.js.map