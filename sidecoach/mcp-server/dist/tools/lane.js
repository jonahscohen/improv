"use strict";
// Tool: sidecoach_lane (P4d). Drive the four monitor lane operations by wrapping
// the SAME engine methods the CLI (bin/sidecoach-monitor.js) calls:
// createExecutionEngine().{startLane, advanceLane, laneStatus, listLanes}.
//
// Response deadline: deps.signal is passed into the handler as required, but the
// engine methods accept no external signal. If the deadline fires after start or
// advance begins, the MCP call stops awaiting and returns TIMEOUT while the engine
// operation continues under its own P4b-1 operation lease and heartbeat.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = exports.definition = void 0;
const sidecoach_orchestrator_1 = require("../../../dist/sidecoach-orchestrator");
const project_root_1 = require("../project-root");
const errors_1 = require("../errors");
const schemas_1 = require("../schemas");
exports.definition = {
    name: 'sidecoach_lane',
    description: 'Drive a sidecoach lane through the engine state machine: operation=start (begin a lane on a target), ' +
        'advance (apply a transition: complete | retry | skip | resume | interrupt | stop), status (read a ' +
        'checkpoint), or list (enumerate lanes). Wraps the same engine methods the monitor CLI uses. The MCP ' +
        'response deadline can stop awaiting an in-flight start/advance, but the engine operation continues under its lease.',
    inputSchema: schemas_1.laneShape,
    // Lane operations can run flow handlers; give them headroom under the 30s server cap.
    timeoutMs: 25000,
};
function deadlineError() {
    return new errors_1.SidecoachToolError('TIMEOUT', 'lane response deadline exceeded (engine operation may still complete under lease)', {});
}
// Stop awaiting when the response deadline fires. This does not cancel p.
function raceResponseDeadline(p, signal) {
    if (signal.aborted)
        return Promise.reject(deadlineError());
    return new Promise((resolve, reject) => {
        const onDeadline = () => reject(deadlineError());
        signal.addEventListener('abort', onDeadline, { once: true });
        p.then((v) => { signal.removeEventListener('abort', onDeadline); resolve(v); }, (e) => { signal.removeEventListener('abort', onDeadline); reject(e); });
    });
}
const handler = async (input, deps) => {
    if (deps.signal.aborted)
        throw deadlineError();
    // The SDK registers a raw Zod shape, so enforce cross-field operation
    // contracts again at the handler boundary with the refined LaneInput schema.
    const parsed = schemas_1.LaneInput.safeParse(input);
    if (!parsed.success) {
        throw new errors_1.SidecoachToolError('INVALID_INPUT', 'invalid sidecoach_lane operation input', {
            validationIssues: parsed.error.issues.map((issue) => ({
                path: issue.path,
                message: issue.message,
                code: issue.code,
            })),
        });
    }
    const request = parsed.data;
    const projectPath = request.projectPath ? request.projectPath : (0, project_root_1.resolveProjectRoot)();
    const engine = (0, sidecoach_orchestrator_1.createExecutionEngine)();
    switch (request.operation) {
        case 'start': {
            const result = await raceResponseDeadline(engine.startLane(request.laneId, request.target ?? '', { projectPath }, request.startRequestId, request.renderUrl), deps.signal);
            return { data: { result }, summary: `sidecoach_lane start: ${result.laneId} @ ${result.checkpointId}` };
        }
        case 'advance': {
            const transition = {
                action: request.action,
                expectedRevision: request.expectedRevision,
            };
            if (request.report !== undefined)
                transition.report = request.report;
            if (request.reason !== undefined)
                transition.reason = request.reason;
            const result = await raceResponseDeadline(engine.advanceLane(projectPath, request.checkpointId, transition), deps.signal);
            return { data: { result }, summary: `sidecoach_lane advance(${request.action}): rev ${result.revision}` };
        }
        case 'status': {
            const result = engine.laneStatus(projectPath, request.checkpointId);
            return { data: { result }, summary: `sidecoach_lane status: ${result.lifecycle} @ rev ${result.revision}` };
        }
        case 'list': {
            const result = engine.listLanes(projectPath, { all: !!request.all });
            return { data: { count: result.length, lanes: result }, summary: `sidecoach_lane list: ${result.length} lane(s)` };
        }
        default:
            throw new errors_1.SidecoachToolError('INTERNAL_ERROR', `unknown lane operation: ${String(request.operation)}`, {});
    }
};
exports.handler = handler;
//# sourceMappingURL=lane.js.map