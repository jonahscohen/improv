"use strict";
// T-0020: Ralph-mode relentless cross-flow iteration.
//
// Distinct from T-0009 (retry-control.ts): T-0009 caps per-handler iteration
// (the polish handler retries polish up to 5 times). T-0020 is CROSS-flow -
// it chains polish -> audit -> critique -> polish -> audit -> ... until ALL
// flows report clean OR a hard cap fires.
//
// The loop runs to convergence (zero findings across all flows in the chain),
// stall (the same finding-signature repeats maxNoProgressIterations times in
// a row), or cap (maxGlobalIterations reached without convergence).
//
// Auto-fix gap (forward-compat): today's sidecoach handlers REPORT findings
// but do not have a fix-mode that applies changes. Without an applyFixes
// step, each iteration produces the same findings, the progress signature
// matches, and the loop halts at maxNoProgressIterations. When handlers
// acquire fix-mode (or an LLM-driven fix step is wired between iterations),
// pass it via opts.applyFixes - the loop will call it after collecting
// findings and before the next iteration, so signatures naturally evolve as
// fixes land.
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
exports.DEFAULT_RALPH_MAX_NO_PROGRESS_ITERATIONS = exports.DEFAULT_RALPH_MAX_GLOBAL_ITERATIONS = exports.DEFAULT_RALPH_FLOW_CHAIN = void 0;
exports.computeProgressSignature = computeProgressSignature;
exports.extractFindingsFromFlowResult = extractFindingsFromFlowResult;
exports.runRalphLoop = runRalphLoop;
const crypto = __importStar(require("crypto"));
/**
 * Default flow chain for ralph-mode. Mirrors the T-0020 spec from TASKS.md:
 * tactical-polish -> multi-lens-audit -> design-critique. Each iteration walks
 * this chain in order.
 */
exports.DEFAULT_RALPH_FLOW_CHAIN = [
    'flowJ_tactical_polish',
    'flowK_multi_lens_audit',
    'flowL_design_critique',
];
exports.DEFAULT_RALPH_MAX_GLOBAL_ITERATIONS = 10;
exports.DEFAULT_RALPH_MAX_NO_PROGRESS_ITERATIONS = 3;
/**
 * Compute a deterministic 12-char hex signature from the set of findings
 * collected during one iteration. Two iterations producing the same findings
 * in any order yield the same signature - which is the "no progress" signal
 * the stall check watches for. Findings are serialized by their stable
 * identity (flowId + validator + ruleId + filePath) so ephemeral fields like
 * message do not destabilize the signature.
 */
function computeProgressSignature(findings) {
    const identities = findings
        .map((f) => `${f.flowId}|${f.validator}|${f.ruleId}|${f.filePath || ''}`)
        .sort();
    const payload = JSON.stringify(identities);
    return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 12);
}
/**
 * Helper to extract findings from a FlowExecutionResult. Provided for
 * convenience to runners that invoke the real handlers - they can map the
 * handler's validationResults / executionMetadata into RalphFinding[] using
 * this routine. Not used inside runRalphLoop itself (the runner is the only
 * thing that knows how its handlers shaped their results).
 */
function extractFindingsFromFlowResult(flowId, result) {
    const findings = [];
    const validationResults = result.validationResults || [];
    for (const vr of validationResults) {
        if (!vr || vr.status === 'pass')
            continue;
        const failed = Array.isArray(vr.failedRules) ? vr.failedRules : [];
        for (const ruleId of failed) {
            findings.push({
                flowId,
                validator: vr.domain || 'unknown',
                ruleId,
                severity: vr.status === 'fail' ? 'critical' : undefined,
                message: vr.message,
            });
        }
    }
    return findings;
}
function defaultLogger(line) {
    console.log(line);
}
/**
 * Run a relentless cross-flow loop against `target`. See module header for
 * the contract and the auto-fix gap discussion.
 */
async function runRalphLoop(target, opts = {}) {
    const log = [];
    const logger = opts.logger || defaultLogger;
    const emit = (line) => {
        log.push(line);
        logger(line);
    };
    const maxGlobalIterations = typeof opts.maxGlobalIterations === 'number' && opts.maxGlobalIterations > 0
        ? opts.maxGlobalIterations
        : exports.DEFAULT_RALPH_MAX_GLOBAL_ITERATIONS;
    const maxNoProgressIterations = typeof opts.maxNoProgressIterations === 'number' && opts.maxNoProgressIterations > 0
        ? opts.maxNoProgressIterations
        : exports.DEFAULT_RALPH_MAX_NO_PROGRESS_ITERATIONS;
    const flowChain = Array.isArray(opts.flowChain) && opts.flowChain.length > 0
        ? opts.flowChain
        : exports.DEFAULT_RALPH_FLOW_CHAIN;
    // Config sanity: an empty flow chain is meaningless (the loop has nothing
    // to iterate). Return an error result rather than spinning a no-op cap.
    if (!Array.isArray(opts.flowChain) ? false : opts.flowChain.length === 0) {
        const msg = '[ralph] invalid config: flowChain is empty';
        emit(msg);
        return {
            status: 'error',
            iterations: 0,
            totalFindings: 0,
            history: [],
            log,
            error: msg,
        };
    }
    // Without a runFlow injection the loop has no way to invoke handlers.
    // The check is structural (no fallback path that hard-codes handler
    // invocation here) so the failure surfaces immediately rather than as
    // confusing zero-findings convergence.
    if (typeof opts.runFlow !== 'function') {
        const msg = '[ralph] invalid config: runFlow is required';
        emit(msg);
        return {
            status: 'error',
            iterations: 0,
            totalFindings: 0,
            history: [],
            log,
            error: msg,
        };
    }
    const runFlow = opts.runFlow;
    const history = [];
    for (let iteration = 1; iteration <= maxGlobalIterations; iteration++) {
        const flowResults = [];
        const allFindings = [];
        for (const flowId of flowChain) {
            let runOutput;
            try {
                runOutput = await runFlow({ flowId, target, iteration });
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                emit(`[ralph] iter ${iteration}/${maxGlobalIterations}: ${flowId} runner threw: ${errMsg}`);
                flowResults.push({
                    iteration,
                    flowId,
                    findings: [],
                    findingCount: 0,
                    error: errMsg,
                });
                continue;
            }
            const findings = Array.isArray(runOutput.findings) ? runOutput.findings : [];
            flowResults.push({
                iteration,
                flowId,
                findings,
                findingCount: findings.length,
                error: runOutput.error,
            });
            allFindings.push(...findings);
            emit(`[ralph] iter ${iteration}/${maxGlobalIterations}: ${flowId} found ${findings.length} violations`);
        }
        const signature = computeProgressSignature(allFindings);
        history.push({ iteration, flowResults, allFindings, signature });
        // Convergence: zero findings across every flow in this iteration.
        if (allFindings.length === 0) {
            emit(`[ralph] CONVERGED in ${iteration} iter`);
            return {
                status: 'converged',
                iterations: iteration,
                totalFindings: 0,
                history,
                log,
            };
        }
        // Stall: the last maxNoProgressIterations iterations all share the
        // same signature. Note that we count from the current iteration
        // backward, including it - so once we have maxNoProgressIterations
        // consecutive matches the loop stops.
        if (history.length >= maxNoProgressIterations) {
            const recent = history.slice(-maxNoProgressIterations);
            const recentSig = recent[0].signature;
            if (recentSig && recent.every((h) => h.signature === recentSig)) {
                emit(`[ralph] STALLED at iter ${iteration} (same signature ${recentSig} for ${maxNoProgressIterations} iter)`);
                return {
                    status: 'stalled',
                    iterations: iteration,
                    totalFindings: allFindings.length,
                    remainingFindings: allFindings,
                    history,
                    lastSignature: recentSig,
                    log,
                };
            }
        }
        // Forward-compat: if a fix-applier is wired, give it a chance to
        // mutate the target between iterations. Today this is a no-op for
        // every real caller; the loop is still useful as a diagnostic that
        // surfaces what would block convergence.
        if (typeof opts.applyFixes === 'function') {
            try {
                await opts.applyFixes({ iteration, findings: allFindings, target });
            }
            catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err);
                emit(`[ralph] iter ${iteration}: applyFixes threw: ${errMsg} (continuing)`);
            }
        }
    }
    // Cap: hit maxGlobalIterations without convergence or stall.
    const finalFindings = history[history.length - 1]?.allFindings || [];
    emit(`[ralph] CAPPED at maxIter (${maxGlobalIterations})`);
    return {
        status: 'capped',
        iterations: maxGlobalIterations,
        totalFindings: finalFindings.length,
        remainingFindings: finalFindings,
        history,
        log,
    };
}
//# sourceMappingURL=ralph-loop.js.map