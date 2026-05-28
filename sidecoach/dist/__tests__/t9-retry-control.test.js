"use strict";
// T-0009: Phase-gated retry control tests.
//
// Covers four mandated scenarios from the task spec:
//   1. Hits maxCycles cap at 5 (different error each iteration)
//   2. Halts at 3 identical errors in a row
//   3. Continues past partial repeats (A,B,A,B,A,B alternating does not halt
//      on identical-error)
//   4. Resets identical-counter when a different error appears between
//      repeats (A,A,B,A,A -> last 3 are B,A,A which is not identical)
//
// Also exercises the three handler integrations (polish, audit, critique) to
// confirm halt results surface correctly and retry state round-trips through
// executionMetadata.
Object.defineProperty(exports, "__esModule", { value: true });
const retry_control_1 = require("../retry-control");
const flow_handler_tactical_polish_1 = require("../flow-handler-tactical-polish");
const flow_handler_multi_lens_audit_1 = require("../flow-handler-multi-lens-audit");
const flow_handler_design_critique_1 = require("../flow-handler-design-critique");
const checks = [];
function expect(label, ok, detail) {
    checks.push({ label, ok, detail });
}
// Capture console.log emissions for halt-log verification.
const originalLog = console.log;
let capturedLogs = [];
function startCapture() {
    capturedLogs = [];
    console.log = (...args) => {
        capturedLogs.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
}
function stopCapture() {
    console.log = originalLog;
    return capturedLogs;
}
async function run() {
    // === Section 1: computeErrorSignature ===
    const sig1 = (0, retry_control_1.computeErrorSignature)({ validator: 'polish-standard', failedRules: ['r1', 'r2', 'r3'], filePath: '/p' });
    const sig2 = (0, retry_control_1.computeErrorSignature)({ validator: 'polish-standard', failedRules: ['r3', 'r1', 'r2'], filePath: '/p' });
    expect('signature: deterministic', sig1 === sig2, `${sig1} vs ${sig2}`);
    expect('signature: 12 chars', sig1.length === 12, sig1);
    const sig3 = (0, retry_control_1.computeErrorSignature)({ validator: 'polish-standard', failedRules: ['r1', 'r2'], filePath: '/p' });
    expect('signature: different rules differ', sig1 !== sig3, `${sig1} vs ${sig3}`);
    const sig4 = (0, retry_control_1.computeErrorSignature)({ validator: 'multi-lens-audit', failedRules: ['r1', 'r2', 'r3'], filePath: '/p' });
    expect('signature: different validator differs', sig1 !== sig4, `${sig1} vs ${sig4}`);
    const sig5 = (0, retry_control_1.computeErrorSignature)({ validator: 'polish-standard', failedRules: ['r1', 'r2', 'r3'], filePath: '/other' });
    expect('signature: different file differs', sig1 !== sig5, `${sig1} vs ${sig5}`);
    // === Section 2: readRetryConfig defaults + overrides ===
    const defaultCfg = (0, retry_control_1.readRetryConfig)({ utterance: '' });
    expect('config: default maxCycles=5', defaultCfg.maxCycles === 5);
    expect('config: default identicalErrorThreshold=3', defaultCfg.identicalErrorThreshold === 3);
    const overrideCfg = (0, retry_control_1.readRetryConfig)({ utterance: '', metadata: { retryConfig: { maxCycles: 7, identicalErrorThreshold: 4 } } });
    expect('config: override maxCycles', overrideCfg.maxCycles === 7);
    expect('config: override identicalErrorThreshold', overrideCfg.identicalErrorThreshold === 4);
    const partialCfg = (0, retry_control_1.readRetryConfig)({ utterance: '', metadata: { retryConfig: { maxCycles: 10 } } });
    expect('config: partial override keeps default for missing', partialCfg.maxCycles === 10 && partialCfg.identicalErrorThreshold === 3);
    const badCfg = (0, retry_control_1.readRetryConfig)({ utterance: '', metadata: { retryConfig: { maxCycles: -1, identicalErrorThreshold: 0 } } });
    expect('config: invalid values fall back to defaults', badCfg.maxCycles === 5 && badCfg.identicalErrorThreshold === 3);
    // === Section 3: readRetryState defaults ===
    const freshState = (0, retry_control_1.readRetryState)({ utterance: '' });
    expect('state: fresh cycleCount=0', freshState.cycleCount === 0);
    expect('state: fresh errorSignatures=[]', freshState.errorSignatures.length === 0);
    // === Section 4: Scenario 1 - hits maxCycles cap ===
    // Five iterations, each with a DIFFERENT error signature - identical-error
    // trigger never fires. After 5 recorded iterations, the next check halts
    // with max_cycles.
    let state = { cycleCount: 0, errorSignatures: [] };
    const config = retry_control_1.DEFAULT_RETRY_CONFIG;
    for (let i = 1; i <= 5; i++) {
        const decision = (0, retry_control_1.evaluateHaltConditions)(state, config);
        expect(`scenario-1: iteration ${i} should not halt`, !decision.halt, JSON.stringify(decision));
        state = (0, retry_control_1.recordIteration)(state, `unique-sig-${i}`);
    }
    const capDecision = (0, retry_control_1.evaluateHaltConditions)(state, config);
    expect('scenario-1: halts on 6th attempt with max_cycles', capDecision.halt && capDecision.reason === 'max_cycles', JSON.stringify(capDecision));
    expect('scenario-1: halt reports cycleCount=5', capDecision.cycleCount === 5, String(capDecision.cycleCount));
    expect('scenario-1: halt message includes counts', typeof capDecision.message === 'string' && capDecision.message.includes('cycleCount=5') && capDecision.message.includes('maxCycles=5'), capDecision.message);
    // === Section 5: Scenario 2 - halts at 3 identical errors ===
    state = { cycleCount: 0, errorSignatures: [] };
    const sameSig = 'aaaaaaaaaaaa';
    // iter 1: record same sig, then check halt: not yet (only 1 entry)
    state = (0, retry_control_1.recordIteration)(state, sameSig);
    expect('scenario-2: after 1 identical does not halt', !(0, retry_control_1.evaluateHaltConditions)(state, config).halt);
    // iter 2: 2 entries
    state = (0, retry_control_1.recordIteration)(state, sameSig);
    expect('scenario-2: after 2 identical does not halt', !(0, retry_control_1.evaluateHaltConditions)(state, config).halt);
    // iter 3: 3 entries - now should trigger identical_error_loop
    state = (0, retry_control_1.recordIteration)(state, sameSig);
    const idDecision = (0, retry_control_1.evaluateHaltConditions)(state, config);
    expect('scenario-2: halts after 3 identical with identical_error_loop', idDecision.halt && idDecision.reason === 'identical_error_loop', JSON.stringify(idDecision));
    expect('scenario-2: signature reported', idDecision.signature === sameSig, idDecision.signature);
    expect('scenario-2: attemptCount=3', idDecision.attemptCount === 3, String(idDecision.attemptCount));
    expect('scenario-2: message includes signature', typeof idDecision.message === 'string' && idDecision.message.includes(sameSig) && idDecision.message.includes('3 identical'), idDecision.message);
    // === Section 6: Scenario 3 - A,B,A,B,A,B alternating does NOT halt on
    // identical-error. Note: 6 entries also triggers max_cycles, so we test
    // the identical-error condition specifically by running with maxCycles
    // bumped high enough that only identical-error could fire.
    state = { cycleCount: 0, errorSignatures: [] };
    const highMaxConfig = { maxCycles: 100, identicalErrorThreshold: 3 };
    const seq1 = ['A', 'B', 'A', 'B', 'A', 'B'];
    for (let i = 0; i < seq1.length; i++) {
        state = (0, retry_control_1.recordIteration)(state, seq1[i]);
        const decision = (0, retry_control_1.evaluateHaltConditions)(state, highMaxConfig);
        expect(`scenario-3: A,B,A,B,A,B does not halt after entry ${i + 1} (${seq1[i]})`, !decision.halt, JSON.stringify(decision));
    }
    // === Section 7: Scenario 4 - A,A,B,A,A: last 3 are B,A,A which is NOT
    // identical, so don't halt. The identical-counter "resets" because the
    // window-of-last-N check returns false when the window contains a mix.
    state = { cycleCount: 0, errorSignatures: [] };
    const seq2 = ['A', 'A', 'B', 'A', 'A'];
    for (let i = 0; i < seq2.length; i++) {
        state = (0, retry_control_1.recordIteration)(state, seq2[i]);
        const decision = (0, retry_control_1.evaluateHaltConditions)(state, highMaxConfig);
        expect(`scenario-4: A,A,B,A,A does not halt after entry ${i + 1} (${seq2[i]})`, !decision.halt, JSON.stringify(decision));
    }
    // Sanity: but if we add one more A, last 3 become A,A,A => halt
    state = (0, retry_control_1.recordIteration)(state, 'A');
    const finalDecision = (0, retry_control_1.evaluateHaltConditions)(state, highMaxConfig);
    expect('scenario-4: sanity - one more A triggers halt', finalDecision.halt && finalDecision.reason === 'identical_error_loop', JSON.stringify(finalDecision));
    // === Section 8: Polish handler integration - halt on max_cycles ===
    startCapture();
    const polishHandler = new flow_handler_tactical_polish_1.FlowJTacticalPolishHandler();
    const polishHaltCtx = {
        utterance: 'polish',
        projectPath: '/tmp/nonexistent-t9-test',
        metadata: {
            retryState: {
                cycleCount: 5,
                errorSignatures: ['a1', 'a2', 'a3', 'a4', 'a5'],
            },
        },
    };
    const polishResult = await polishHandler.execute(polishHaltCtx);
    const polishLogs = stopCapture();
    expect('polish: halt status=error', polishResult.status === 'error', `status=${polishResult.status} message=${polishResult.message}`);
    expect('polish: halt message mentions max cycles', typeof polishResult.message === 'string' && polishResult.message.includes('max cycles'), polishResult.message);
    expect('polish: halt log emitted', polishLogs.some((l) => l.includes('halted: max cycles reached') && l.includes('cycleCount=5')), polishLogs.join('\n'));
    expect('polish: halt result carries retryHalt metadata', !!polishResult.executionMetadata?.enhancedContext?.retryHalt &&
        polishResult.executionMetadata.enhancedContext.retryHalt.reason === 'max_cycles', JSON.stringify(polishResult.executionMetadata?.enhancedContext));
    // === Section 9: Audit handler integration - halt on identical_error_loop ===
    startCapture();
    const auditHandler = new flow_handler_multi_lens_audit_1.FlowKMultiLensAuditHandler();
    const auditHaltCtx = {
        utterance: 'audit',
        projectPath: '/tmp/nonexistent-t9-test',
        metadata: {
            retryState: {
                cycleCount: 3,
                errorSignatures: ['samesig123!', 'samesig123!', 'samesig123!'],
            },
        },
    };
    const auditResult = await auditHandler.execute(auditHaltCtx);
    const auditLogs = stopCapture();
    expect('audit: halt status=error', auditResult.status === 'error', `status=${auditResult.status} message=${auditResult.message}`);
    expect('audit: halt message mentions identical', typeof auditResult.message === 'string' && auditResult.message.includes('identical attempts'), auditResult.message);
    expect('audit: halt log emitted', auditLogs.some((l) => l.includes('halted after 3 identical attempts') && l.includes('validator=multi-lens-audit')), auditLogs.join('\n'));
    // === Section 10: Critique handler integration - halt on max_cycles ===
    startCapture();
    const critiqueHandler = new flow_handler_design_critique_1.FlowLDesignCritiqueHandler();
    const critiqueHaltCtx = {
        utterance: 'critique',
        projectPath: '/tmp/nonexistent-t9-test',
        metadata: {
            retryConfig: { maxCycles: 5, identicalErrorThreshold: 3 },
            retryState: {
                cycleCount: 5,
                errorSignatures: ['x1', 'x2', 'x3', 'x4', 'x5'],
            },
        },
    };
    const critiqueResult = await critiqueHandler.execute(critiqueHaltCtx);
    const critiqueLogs = stopCapture();
    expect('critique: halt status=error', critiqueResult.status === 'error', `status=${critiqueResult.status} message=${critiqueResult.message}`);
    expect('critique: halt log emitted', critiqueLogs.some((l) => l.includes('halted: max cycles reached')), critiqueLogs.join('\n'));
    // === Section 11: Critique handler integration - fresh state, success
    // path attaches retry state to result. ===
    const critiqueOkCtx = {
        utterance: 'critique',
        projectPath: '/tmp/nonexistent-t9-test',
    };
    const critiqueOk = await critiqueHandler.execute(critiqueOkCtx);
    expect('critique: success path returns status=success', critiqueOk.status === 'success', critiqueOk.message);
    const nextStateOnResult = critiqueOk.executionMetadata?.enhancedContext?.retryState;
    expect('critique: success attaches retryState (cycleCount=1)', !!nextStateOnResult && nextStateOnResult.cycleCount === 1 && nextStateOnResult.errorSignatures.length === 1, JSON.stringify(nextStateOnResult));
    // === Section 12: Polish handler success path attaches retry state. The
    // handler reads CSS from disk - point it at a temp dir that has no CSS so
    // it falls through quickly without throwing. ===
    const polishOkCtx = {
        utterance: 'polish',
        projectPath: '/tmp',
        metadata: {},
    };
    const polishOk = await polishHandler.execute(polishOkCtx);
    expect('polish: success path returns status=success', polishOk.status === 'success', `${polishOk.status} ${polishOk.message}`);
    const polishNextState = polishOk.executionMetadata?.enhancedContext?.retryState;
    expect('polish: success attaches retryState (cycleCount=1)', !!polishNextState && polishNextState.cycleCount === 1 && polishNextState.errorSignatures.length === 1, JSON.stringify(polishNextState));
    // === Report ===
    let allPass = true;
    for (const c of checks) {
        if (c.ok) {
            console.log(`PASS ${c.label}`);
        }
        else {
            console.log(`FAIL ${c.label}${c.detail ? ' :: ' + c.detail : ''}`);
            allPass = false;
        }
    }
    const total = checks.length;
    const passed = checks.filter((c) => c.ok).length;
    console.log(`---`);
    console.log(`t9-retry-control: ${passed}/${total} passed`);
    console.log(allPass ? 't9-retry-control PASS' : 't9-retry-control FAIL');
    process.exit(allPass ? 0 : 1);
}
run().catch((e) => {
    console.error(e);
    process.exit(1);
});
//# sourceMappingURL=t9-retry-control.test.js.map