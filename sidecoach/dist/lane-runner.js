"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startLane = startLane;
exports.serveStep = serveStep;
exports.resolveLane = resolveLane;
exports.closedResult = closedResult;
exports.pushAudit = pushAudit;
exports.laneStatus = laneStatus;
exports.listLanes = listLanes;
exports.advanceLane = advanceLane;
// sidecoach/src/lane-runner.ts
// Sequence-lane execution state machine (P2). Loop lanes are rejected here and
// handled in P4 with the convergence floor.
const crypto_1 = require("crypto");
const lanes_generated_1 = require("./lanes.generated");
const lane_checkpoint_store_1 = require("./lane-checkpoint-store");
const lane_types_1 = require("./lane-types");
const lane_validators_1 = require("./lane-validators");
const flow_prerequisites_1 = require("./flow-prerequisites");
const lane_lock_1 = require("./lane-lock");
// Default operation id when deps omits newOperationId (production wiring is Task 10).
function defaultOperationId() {
    return `op-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
// In-process registry of live operations, keyed by the FULL lease identity (NOT the
// checkpoint id) so an old operation's finally never deletes a same-process replacement
// and interrupt/stop (Task 9) can abort the exact controller for a fenced identity.
const LIVE_OPERATIONS = new Map();
const leaseKey = (checkpointId, id) => `${checkpointId}:${id.operationId}:${id.stepId}:${id.iteration}:${id.claimedCheckpointRevision}:${id.fencingToken}`;
// A compromised checkpoint lock (proper-lockfile detected its lockfile was stolen/removed)
// aborts every in-flight operation on that checkpoint so a lost lock cannot let EXECUTE
// keep running against a checkpoint another process now owns.
(0, lane_lock_1.setLockCompromiseHandler)((checkpointId, _err) => {
    for (const [k, controller] of LIVE_OPERATIONS) {
        if (k.startsWith(`${checkpointId}:`)) {
            try {
                controller.abort();
            }
            catch { /* ignore */ }
        }
    }
});
// Continuous ownership-checking heartbeat: refresh heartbeatAt on an interval; a
// refresh that fails (ownership lost / lease fenced) aborts the operation-local signal.
// Returns a stopper to clear the interval in finally.
function startHeartbeatLoop(d, checkpointId, id, controller) {
    const every = d.heartbeatIntervalMs ?? Math.max(10, Math.floor((d.staleMs ?? 30000) / 3));
    let stopped = false;
    let running = false;
    const timer = setInterval(async () => {
        if (stopped || running)
            return;
        running = true;
        try {
            await (0, lane_checkpoint_store_1.refreshHeartbeat)(d.store, checkpointId, id, d.now);
            d.onHeartbeat?.(true);
        } // ok=refreshed (ownership held)
        catch {
            controller.abort();
            d.onHeartbeat?.(false);
        } // failed=ownership lost -> aborted
        finally {
            running = false;
        }
    }, every);
    if (typeof timer.unref === 'function')
        timer.unref();
    return () => { stopped = true; clearInterval(timer); };
}
function resolveLane(laneId) {
    const l = lanes_generated_1.LANES.find((x) => x.lane === laneId);
    if (!l)
        throw new Error(`lane runner: unknown laneId "${laneId}"`);
    return l;
}
function closedResult(cp, l) {
    return {
        checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
        lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: l.executionKind,
        iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length,
        currentVerb: undefined, guidance: [], checklist: [], flowIds: [], revision: cp.revision,
        message: cp.lifecycle === 'closed'
            ? `Lane ${cp.outcome}.`
            : cp.lifecycle === 'interrupted'
                ? 'Lane interrupted - resume to continue.'
                : 'Lane has no current step.',
    };
}
// Serve the verb step at cursor. Uses the PERSISTED cache if present (so retry/
// resume/duplicate never re-run handlers); otherwise runs each member flow once into
// an operation-local accumulator, then persists ONCE under the checkpoint lock via a
// re-read + merge of ONLY servedSteps[key] (never a whole stale cp snapshot, so a
// concurrent committed transition is preserved). Serving never bumps the revision.
async function serveStep(cp, l, context, d) {
    if ((0, lane_types_1.isClosed)(cp.lifecycle) || cp.lifecycle === 'interrupted' || cp.cursor >= l.verbSteps.length) {
        return closedResult(cp, l);
    }
    const step = l.verbSteps[cp.cursor];
    const key = `${cp.cursor}:${cp.iteration}`;
    const existing = cp.servedSteps[key];
    const acc = existing
        ? { guidance: [...existing.guidance], checklist: [...existing.checklist], flowIds: [...existing.flowIds], successfulFlowIds: [...existing.successfulFlowIds] }
        : { guidance: [...step.guidance], checklist: [], flowIds: [], successfulFlowIds: [] };
    const needsRun = existing === undefined || acc.flowIds.length < step.flowIds.length;
    if (acc.flowIds.length < step.flowIds.length) {
        for (let i = acc.flowIds.length; i < step.flowIds.length; i++) {
            const flowId = step.flowIds[i];
            // intra-step prerequisite accumulation: a later flow in THIS step sees the
            // earlier flows of the same step that ran successfully, plus all
            // prior-step completions. Only status:'success' counts (degraded/skipped/
            // errored flows are NOT attested - they must not satisfy a prerequisite).
            const flowCtx = { ...context, completedFlowIds: [...cp.completedFlowIds, ...acc.successfulFlowIds], waivers: l.prereqWaivers };
            const r = await d.runFlow(flowId, flowCtx);
            for (const g of r.guidance ?? [])
                acc.guidance.push(g);
            for (const c of r.checklist ?? [])
                acc.checklist.push({ id: `${flowId}:${c.id}`, label: c.label, required: c.required, completed: false });
            acc.flowIds.push(flowId);
            if (r.status === 'success')
                acc.successfulFlowIds.push(flowId);
        }
    }
    if (needsRun) {
        // Persist the served-step entry under the checkpoint lock: re-read fresh, set
        // ONLY this servedSteps[key], write. Never clobber a concurrent committed
        // transition with a whole stale cp. Does NOT bump the semantic revision.
        await d.__beforeServePersist?.();
        await (0, lane_lock_1.withCheckpointLock)(d.store.dir(), cp.checkpointId, () => {
            const fresh = d.store.read(cp.checkpointId);
            fresh.servedSteps[key] = acc;
            fresh.updatedAt = d.now();
            d.store.write(fresh);
        });
    }
    const served = acc;
    return {
        checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
        lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: l.executionKind,
        iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length,
        currentVerb: step.verb, guidance: served.guidance, checklist: served.checklist,
        flowIds: served.flowIds, revision: cp.revision,
        message: `Step ${cp.cursor + 1}/${l.verbSteps.length}: ${step.verb}`,
    };
}
async function startLane(laneId, target, context, startRequestId, d) {
    if (!startRequestId || typeof startRequestId !== 'string' || startRequestId.length > 256) {
        throw new Error('startLane: startRequestId must be a non-empty string <= 256 chars');
    }
    const l = resolveLane(laneId);
    if (l.executionKind === 'loop') {
        throw new Error(`startLane: lane "${laneId}" is a loop lane - loop execution + the convergence floor land in P4. Not startable in P2.`);
    }
    // Startup recovery: replay any pending committed outbox records (a process that
    // crashed after FINALIZE but before publish) before this operation mutates state.
    if (context.projectPath)
        await (0, lane_checkpoint_store_1.publishPendingOutbox)(d.store, context.projectPath, d.now);
    // Start-request lock: maps startRequestId -> ONE checkpoint and creates its
    // first-step lease atomically. Idempotency applies only to an ACTIVE lane: a
    // duplicate request must not double-start one still in_progress/interrupted. A
    // CLOSED checkpoint means that run finished, so the same phrase legitimately
    // starts a fresh lane. The lock holds ONLY the idempotent mapping + first-step
    // lease creation - it is released BEFORE any flow handler runs (spec line 286).
    const startLockId = 'start-' + (0, crypto_1.createHash)('sha256').update(startRequestId).digest('hex').slice(0, 40);
    const start = await (0, lane_lock_1.withCheckpointLock)(d.store.dir(), startLockId, () => {
        const existing = d.store.findByStartRequestId(startRequestId);
        if (existing && !(0, lane_types_1.isClosed)(existing.lifecycle)) {
            if (existing.laneId !== laneId)
                throw new Error(`startLane: startRequestId "${startRequestId}" already maps to active lane "${existing.laneId}", not "${laneId}"`);
            return { checkpoint: existing, created: false, identity: existing.lease };
        }
        const ts = d.now();
        const operationId = (d.newOperationId ?? defaultOperationId)();
        const cp = {
            schemaVersion: 2, checkpointId: d.newCheckpointId(), laneId, target,
            executionKind: l.executionKind, lifecycle: 'in_progress', outcome: undefined,
            cursor: 0, iteration: 0, completedStepIds: [], skippedStepIds: [], completedFlowIds: [],
            stepReports: [], audit: [], servedSteps: {}, revision: 0, startRequestId,
            seenReportIds: [], fencingCounter: 1, sideEffectOutbox: [], stepGateStatuses: {},
            lease: { operationId, stepId: l.verbSteps[0].verb, iteration: 0, claimedCheckpointRevision: 0,
                fencingToken: 1, startedAt: ts, heartbeatAt: ts },
            createdAt: ts, updatedAt: ts,
        };
        cp.revision = 1; // first-step CLAIM is persisted atomically with the mapping
        d.store.write(cp);
        return { checkpoint: cp, created: true, identity: cp.lease };
    });
    // Lock released. Existing active lane: a DUPLICATE start must never re-run the
    // first-step handler. If its first-step lease is LIVE, the original EXECUTE is still
    // in flight - return the current in-flight step WITHOUT invoking handlers. If the
    // lease is STALE (the original crashed mid-EXECUTE), reclaim it via CLAIM/EXECUTE/
    // FINALIZE. Only when there is NO lease (already finalized) is serveStep safe (it
    // short-circuits on the persisted served cache).
    if (!start.created) {
        const cur = start.checkpoint;
        const ll = resolveLane(cur.laneId);
        if (cur.lease) {
            if ((0, lane_checkpoint_store_1.leaseIsLive)(cur.lease, Date.parse(d.now()), d.staleMs ?? 30000)) {
                return inFlightResult(cur, ll); // original first-step EXECUTE in flight
            }
            // STALE first-step lease: reclaim and serve under a fresh lease identity.
            const operationId = (d.newOperationId ?? defaultOperationId)();
            const claimed = await (0, lane_checkpoint_store_1.claimLease)(d.store, cur.checkpointId, { expectedRevision: cur.revision, stepId: ll.verbSteps[cur.cursor].verb, iteration: cur.iteration, operationId, now: d.now, staleMs: d.staleMs });
            return serveStepUnderLease(claimed, ll, context, d, claimed.lease);
        }
        return serveStep(cur, ll, context, d); // already served; cache short-circuits handlers
    }
    // New lane: serve the first step under the first-step lease identity, then
    // FINALIZE its served effects + clear the lease (same protocol as advancement).
    return serveStepUnderLease(start.checkpoint, l, context, d, start.identity);
}
// Current-step result for a lane whose first-step EXECUTE is in flight under a live
// lease: report the step's static guidance WITHOUT running flow handlers (a duplicate
// start must not re-trigger them). The served cache + final guidance land when the
// original EXECUTE finalizes.
function inFlightResult(cp, l) {
    const step = l.verbSteps[cp.cursor];
    return {
        checkpointId: cp.checkpointId, laneId: l.lane, laneLabel: l.label,
        lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: l.executionKind,
        iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length,
        currentVerb: step.verb, guidance: [...step.guidance], checklist: [], flowIds: [...step.flowIds],
        revision: cp.revision,
        message: `Step ${cp.cursor + 1}/${l.verbSteps.length}: ${step.verb} (in flight - operation already running)`,
    };
}
// Serve the first step's flow handlers during EXECUTE (buffered operation-locally,
// NO store writes), then FINALIZE the served-step entry + clear the lease under the
// full lease identity. The start-request lock is already released, so handlers run
// without holding it; persistent effects land only via FINALIZE. Task 7 adds the
// first-step committed outbox record inside this FINALIZE.
async function serveStepUnderLease(cp, l, context, d, id) {
    if ((0, lane_types_1.isClosed)(cp.lifecycle) || cp.lifecycle === 'interrupted' || cp.cursor >= l.verbSteps.length) {
        const final = await (0, lane_checkpoint_store_1.finalizeLease)(d.store, cp.checkpointId, id, () => { }, d.now);
        return closedResult(final, l);
    }
    const step = l.verbSteps[cp.cursor];
    const key = `${cp.cursor}:${cp.iteration}`;
    // Start the ownership heartbeat for the first-step lease before any handler runs, so a
    // long first-step serve keeps the lease live; stop it in finally (Task 8).
    const controller = new AbortController();
    const opKey = leaseKey(cp.checkpointId, id);
    LIVE_OPERATIONS.set(opKey, controller);
    const stopHeartbeat = startHeartbeatLoop(d, cp.checkpointId, id, controller);
    let final;
    try {
        const acc = { guidance: [...step.guidance], checklist: [], flowIds: [], successfulFlowIds: [] };
        for (let i = 0; i < step.flowIds.length; i++) {
            const flowId = step.flowIds[i];
            const flowCtx = { ...context, completedFlowIds: [...cp.completedFlowIds, ...acc.successfulFlowIds], waivers: l.prereqWaivers };
            const r = await d.runFlow(flowId, flowCtx);
            for (const g of r.guidance ?? [])
                acc.guidance.push(g);
            for (const c of r.checklist ?? [])
                acc.checklist.push({ id: `${flowId}:${c.id}`, label: c.label, required: c.required, completed: false });
            acc.flowIds.push(flowId);
            if (r.status === 'success')
                acc.successfulFlowIds.push(flowId);
        }
        await d.__beforeServePersist?.(); // the first-step serve persist (FINALIZE) mirrors serveStep's seam
        final = await (0, lane_checkpoint_store_1.finalizeLease)(d.store, cp.checkpointId, id, (c, committedRevision) => {
            c.servedSteps[key] = acc;
            // First-step committed outbox record (spec line 286): the served first-step effect
            // publishes only from the committed outbox, like advancement.
            c.sideEffectOutbox.push({
                checkpointId: c.checkpointId, committedRevision, fencingToken: id.fencingToken, stepId: step.verb, iteration: id.iteration,
                pendingPublishers: ['lane-side-effect-sink'], createdAt: d.now(),
                entries: [{ publisher: 'lane-side-effect-sink', entryIndex: 0, logicalKey: `${c.checkpointId}:${step.verb}:${id.iteration}`,
                        payload: { laneId: c.laneId, verb: step.verb, served: true, committedRevision } }],
            });
        }, d.now);
    }
    finally {
        stopHeartbeat();
        if (LIVE_OPERATIONS.get(opKey) === controller)
            LIVE_OPERATIONS.delete(opKey);
    }
    if (context.projectPath)
        await (d.publishOutbox ?? lane_checkpoint_store_1.publishOutbox)(d.store, cp.checkpointId, context.projectPath, d.now);
    return serveStep(final, l, context, d); // served cache complete -> pure read, no handler re-run
}
function pushAudit(cp, e, d) {
    cp.audit.push({ ...e, revision: cp.revision, at: d.now() });
}
function laneStatus(projectPath, checkpointId, d) {
    const cp = d.store.read(checkpointId);
    const l = resolveLane(cp.laneId);
    const step = cp.lifecycle === 'in_progress' && cp.cursor < l.verbSteps.length ? l.verbSteps[cp.cursor] : undefined;
    // Per-step status: past steps report completed/skipped; the current in-progress
    // step reports its persisted gate status (validation_*) when present, else 'current';
    // the rest are pending. This is persisted checkpoint state, so a later independent
    // laneStatus call still surfaces validation_failed/inconclusive/error.
    const steps = l.verbSteps.map((vs, idx) => {
        let status;
        if (cp.completedStepIds.includes(vs.verb))
            status = 'completed';
        else if (cp.skippedStepIds.includes(vs.verb))
            status = 'skipped';
        else if (cp.lifecycle === 'in_progress' && idx === cp.cursor) {
            const gate = cp.stepGateStatuses[`${vs.verb}:${cp.iteration}`];
            status = (gate && gate !== 'clean') ? gate : 'current';
        }
        else
            status = 'pending';
        return { verb: vs.verb, flowIds: vs.flowIds, status };
    });
    return {
        checkpointId: cp.checkpointId, laneId: cp.laneId, target: cp.target,
        lifecycle: cp.lifecycle, outcome: cp.outcome, executionKind: cp.executionKind,
        iteration: cp.iteration, stepIndex: cp.cursor, totalSteps: l.verbSteps.length, currentVerb: step?.verb,
        completedStepIds: [...cp.completedStepIds], skippedStepIds: [...cp.skippedStepIds], completedFlowIds: [...cp.completedFlowIds],
        stepReports: [...cp.stepReports], audit: [...cp.audit], steps,
        revision: cp.revision, createdAt: cp.createdAt, updatedAt: cp.updatedAt,
    };
}
function listLanes(projectPath, d, options) {
    const all = !!options?.all;
    return d.store.list()
        .filter((s) => all || s.lifecycle === 'in_progress' || s.lifecycle === 'interrupted')
        .map((s) => { const l = resolveLane(s.laneId); return { checkpointId: s.checkpointId, laneId: s.laneId, lifecycle: s.lifecycle, outcome: s.outcome, stepIndex: s.cursor, totalSteps: l.verbSteps.length, updatedAt: s.updatedAt }; });
}
// PURE in-place cursor/lifecycle/outcome advance after a committed complete/skip
// (NO store writes - the caller's FINALIZE persists). Sequence final step closes the
// lane: 'completed' if nothing was skipped, else 'partial'. (Loop lanes never reach
// here - they are rejected at startLane in P2.)
function advanceCursorInPlace(cp, l) {
    const last = l.verbSteps.length - 1;
    if (cp.cursor < last) {
        cp.cursor += 1;
        return;
    }
    cp.lifecycle = 'closed';
    cp.outcome = cp.skippedStepIds.length > 0 ? 'partial' : 'completed';
}
// Build the result after a committed mutation: serve the new current step (or the
// closed result), attaching the validator gate surface if provided.
async function buildStepResult(cp, l, context, d, gate) {
    if ((0, lane_types_1.isClosed)(cp.lifecycle) || cp.lifecycle === 'interrupted' || cp.cursor >= l.verbSteps.length) {
        return gate ? { ...closedResult(cp, l), gate } : closedResult(cp, l);
    }
    const res = await serveStep(cp, l, context, d);
    return gate ? { ...res, gate } : res;
}
// EXECUTE: run a step's bound validators (async, abort/heartbeat wired in Task 8).
// A step with bound validators but no deps.runValidator throws (production wiring is
// Task 10). Returns per-validator results in discovery order.
async function runStepValidators(d, validatorIds, ctx, signal) {
    const out = [];
    for (const vId of validatorIds) {
        if (!d.runValidator)
            throw new Error(`advanceLane: validator "${vId}" is bound to this step but deps.runValidator is not wired`);
        out.push({ validatorId: vId, result: await d.runValidator(vId, ctx, signal) });
    }
    return out;
}
async function advanceLane(projectPath, checkpointId, transition, d) {
    // Advance-time recovery: replay any pending committed outbox records before mutating.
    await (0, lane_checkpoint_store_1.publishPendingOutbox)(d.store, projectPath, d.now);
    const cp = d.store.read(checkpointId);
    const l = resolveLane(cp.laneId);
    // duplicate report -> no-op (before CAS, so a retried transport call is idempotent).
    // Guard on an IN_PROGRESS lane ONLY: a closed lane must REJECT any further
    // advance, and an interrupted lane must REJECT every non-resume action - both
    // must fall through to their checks below rather than be masked by the dedup
    // short-circuit (P1-2: same bug class as dup-on-closed, for interrupted).
    if (transition.report && cp.lifecycle === 'in_progress' && cp.seenReportIds.includes(transition.report.reportId))
        return serveStep(cp, l, { projectPath }, d);
    // interrupted: ONLY resume is valid (spec 640-646). Checked before CAS so the
    // directive is returned regardless of revision drift.
    if (cp.lifecycle === 'interrupted' && transition.action !== 'resume') {
        throw new Error(`advanceLane: lane is interrupted - the only valid action is "resume" (got "${transition.action}")`);
    }
    if (cp.lifecycle === 'closed')
        throw new Error(`advanceLane: lane already closed (outcome ${cp.outcome})`);
    if (transition.expectedRevision !== cp.revision)
        throw new Error(`advanceLane: stale expectedRevision ${transition.expectedRevision} (current ${cp.revision})`);
    // Test seam awaited after the early read, BEFORE any claim (production passes none).
    await d.__claimBarrier?.();
    // ORDINARY transitions (complete/skip/retry/resume) must NOT proceed against a live
    // lease - only interrupt/stop may supersede one (Task 9). A stale lease is reclaimable
    // by claimLease/the under-lock fencing in Task 9.
    const nowMs = Date.parse(d.now());
    const ordinary = transition.action === 'complete' || transition.action === 'skip' || transition.action === 'retry' || transition.action === 'resume';
    if (ordinary && (0, lane_checkpoint_store_1.leaseIsLive)(cp.lease, nowMs, d.staleMs ?? 30000)) {
        throw new Error(`advanceLane: an operation holds this checkpoint (lease op ${cp.lease.operationId}); only interrupt/stop may supersede it`);
    }
    switch (transition.action) {
        case 'complete': {
            const r = transition.report;
            if (!r)
                throw new Error('advanceLane: complete requires a StepReport');
            if (!r.evidence || r.evidence.length < 1)
                throw new Error('advanceLane: StepReport needs >=1 evidence');
            const step = l.verbSteps[cp.cursor];
            if (r.stepId !== step.verb || r.iteration !== cp.iteration)
                throw new Error(`advanceLane: report (${r.stepId}/${r.iteration}) != current step (${step.verb}/${cp.iteration})`);
            // The step must be FULLY served before it can be completed. A mid-serve
            // interruption can persist a partial servedSteps cache (fewer flows than
            // step.flowIds); completing then would attest the step while silently
            // skipping the unserved flows. Reject - resume re-serves and finishes first.
            const served = cp.servedSteps[`${cp.cursor}:${cp.iteration}`];
            const servedFlows = served?.flowIds ?? [];
            if (servedFlows.length < step.flowIds.length) {
                throw new Error(`advanceLane: step "${step.verb}" is only partially served (${servedFlows.length}/${step.flowIds.length} flows) - resume to finish serving before completing`);
            }
            // CLAIM the operation lease (cross-process CAS on expectedRevision + ownership).
            const operationId = (d.newOperationId ?? defaultOperationId)();
            const claimed = await (0, lane_checkpoint_store_1.claimLease)(d.store, checkpointId, { expectedRevision: transition.expectedRevision, stepId: step.verb, iteration: cp.iteration, operationId, now: d.now, staleMs: d.staleMs });
            const id = claimed.lease; // FULL identity captured under the lock
            // Register the live operation + start the continuous ownership heartbeat. The
            // composed signal covers lease-ownership-loss (a failed heartbeat aborts it) +
            // in-process priority cancellation (interrupt/stop abort this controller in Task 9).
            const controller = new AbortController();
            const opKey = leaseKey(checkpointId, id);
            LIVE_OPERATIONS.set(opKey, controller);
            const stopHeartbeat = startHeartbeatLoop(d, checkpointId, id, controller);
            try {
                // EXECUTE: run the step's bound validators (async, abortable), aggregate worst-status.
                const validatorIds = (0, lane_validators_1.validatorsForStep)(step);
                const perValidator = await runStepValidators(d, validatorIds, { projectPath, target: cp.target }, controller.signal);
                const worst = (0, lane_validators_1.aggregateWorstStatus)(perValidator.map((p) => p.result.status));
                const gate = { status: worst, validators: perValidator.map((p) => ({ validatorId: p.validatorId, status: p.result.status })),
                    findings: perValidator.flatMap((p) => p.result.findings) };
                const outcome = (0, lane_validators_1.mapGateStatusToOutcome)(worst);
                const persistedStatus = outcome.proceed ? 'clean' : outcome.stepStatus;
                if (outcome.proceed) {
                    const final = await (0, lane_checkpoint_store_1.finalizeLease)(d.store, checkpointId, id, (c, committedRevision) => {
                        c.stepGateStatuses[`${step.verb}:${c.iteration}`] = persistedStatus;
                        c.seenReportIds.push(r.reportId);
                        c.stepReports.push(r);
                        c.completedStepIds.push(step.verb);
                        // Attest ONLY the flows that ran successfully this step (degraded/skipped/
                        // errored flows must not falsely satisfy a later step's prerequisite).
                        for (const f of served.successfulFlowIds)
                            if (!c.completedFlowIds.includes(f))
                                c.completedFlowIds.push(f);
                        c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: committedRevision, at: d.now() });
                        advanceCursorInPlace(c, l);
                        // Committed side-effect outbox record keyed by (checkpointId, committedRevision),
                        // carrying the fencingToken. Published only AFTER FINALIZE, from the committed outbox.
                        c.sideEffectOutbox.push({
                            checkpointId, committedRevision, fencingToken: id.fencingToken, stepId: step.verb, iteration: id.iteration,
                            pendingPublishers: ['lane-side-effect-sink'], createdAt: d.now(),
                            entries: [{ publisher: 'lane-side-effect-sink', entryIndex: 0, logicalKey: `${checkpointId}:${step.verb}:${id.iteration}`,
                                    payload: { laneId: cp.laneId, verb: step.verb, gateStatus: worst, validators: gate.validators, committedRevision } }],
                        });
                    }, d.now);
                    await (d.publishOutbox ?? lane_checkpoint_store_1.publishOutbox)(d.store, checkpointId, projectPath, d.now);
                    return buildStepResult(final, l, { projectPath }, d, gate);
                }
                // UNCLEAN: release the lease WITHOUT advancing; the step stays current. Still a
                // FINALIZE (owner-checked, bumps revision, clears lease) so writes stay under the
                // lock and the next attempt can claim cleanly. Pushing r.reportId makes a re-send
                // of the SAME report a no-op; a DIFFERENT report re-runs the gate.
                const released = await (0, lane_checkpoint_store_1.finalizeLease)(d.store, checkpointId, id, (c, committedRevision) => {
                    c.stepGateStatuses[`${step.verb}:${c.iteration}`] = persistedStatus;
                    c.seenReportIds.push(r.reportId);
                    c.audit.push({ action: 'complete', stepId: step.verb, iteration: c.iteration, reportId: r.reportId, revision: committedRevision, reason: `gate:${worst}`, at: d.now() });
                }, d.now);
                return buildStepResult(released, l, { projectPath }, d, gate); // re-serves the SAME (still-current) step + gate
            }
            finally {
                stopHeartbeat();
                // Conditional delete: only remove OUR identity-keyed controller (a same-process
                // replacement under the same key must not be deleted by this finally).
                if (LIVE_OPERATIONS.get(opKey) === controller)
                    LIVE_OPERATIONS.delete(opKey);
            }
        }
        // retry / interrupt / resume / stop keep P2 behavior (Task 9 moves them under the lock)
        default:
            return transitionNonComplete(cp, l, projectPath, transition, d);
    }
}
function leaseIdentityOf(L) {
    return { operationId: L.operationId, stepId: L.stepId, iteration: L.iteration, claimedCheckpointRevision: L.claimedCheckpointRevision, fencingToken: L.fencingToken };
}
async function transitionNonComplete(cp, l, projectPath, t, d) {
    const checkpointId = cp.checkpointId;
    switch (t.action) {
        case 'interrupt':
        case 'stop': {
            // PRIORITY transitions run under the lock and do NOT require lease ownership:
            // they fence ANY live/stale lease (bump fencing, clear it), set lifecycle, then
            // signal the in-process controller of the fenced identity to abort.
            let fenced = null;
            const final = await (0, lane_lock_1.withCheckpointLock)(d.store.dir(), checkpointId, () => {
                const c = d.store.read(checkpointId);
                if (t.expectedRevision !== c.revision)
                    throw new Error(`advanceLane: stale expectedRevision ${t.expectedRevision} (current ${c.revision})`);
                if (c.lease) {
                    fenced = leaseIdentityOf(c.lease);
                    c.fencingCounter += 1;
                    c.lease = null;
                }
                c.revision += 1;
                c.updatedAt = d.now();
                if (t.action === 'interrupt') {
                    c.lifecycle = 'interrupted';
                    c.audit.push({ action: 'interrupt', stepId: l.verbSteps[c.cursor]?.verb, iteration: c.iteration, reason: t.reason, revision: c.revision, at: d.now() });
                }
                else {
                    c.lifecycle = 'closed';
                    c.outcome = 'stopped';
                    c.audit.push({ action: 'stop', stepId: l.verbSteps[c.cursor]?.verb, iteration: c.iteration, reason: t.reason, revision: c.revision, at: d.now() });
                }
                d.store.write(c);
                return c;
            });
            // Abort the in-process controller that owns the fenced identity (if present).
            if (fenced)
                LIVE_OPERATIONS.get(leaseKey(checkpointId, fenced))?.abort();
            return closedResult(final, l); // paused/closed state; NO serveStep
        }
        case 'retry':
        case 'resume': {
            // Ordinary transitions run wholly under the lock: reject a LIVE lease; FENCE a
            // STALE lease (bump fencing, clear) BEFORE mutating so its later FINALIZE fails;
            // else apply the normal P2 transition. serveStep runs AFTER the lock.
            const final = await (0, lane_lock_1.withCheckpointLock)(d.store.dir(), checkpointId, () => {
                const c = d.store.read(checkpointId);
                if (t.action === 'resume' && c.lifecycle !== 'interrupted')
                    throw new Error('advanceLane: resume is only valid on an interrupted lane');
                if (t.expectedRevision !== c.revision)
                    throw new Error(`advanceLane: stale expectedRevision ${t.expectedRevision} (current ${c.revision})`);
                if (c.lease) {
                    if ((0, lane_checkpoint_store_1.leaseIsLive)(c.lease, Date.parse(d.now()), d.staleMs ?? 30000))
                        throw new Error(`advanceLane: a live lease (op ${c.lease.operationId}) holds this checkpoint; ${t.action} cannot proceed`);
                    process.stderr.write(`[lane] ${t.action} fencing stale lease op=${c.lease.operationId} on ${checkpointId}\n`);
                    c.fencingCounter += 1;
                    c.lease = null; // fence the stale owner before mutating
                }
                c.revision += 1;
                c.updatedAt = d.now();
                if (t.action === 'retry') {
                    if (t.report) {
                        c.stepReports.push(t.report);
                        if (t.report.reportId)
                            c.seenReportIds.push(t.report.reportId);
                    }
                    c.audit.push({ action: 'retry', stepId: l.verbSteps[c.cursor]?.verb, iteration: c.iteration, reason: t.reason, reportId: t.report?.reportId, revision: c.revision, at: d.now() });
                }
                else {
                    c.lifecycle = 'in_progress';
                    c.audit.push({ action: 'resume', stepId: l.verbSteps[c.cursor]?.verb, iteration: c.iteration, revision: c.revision, at: d.now() });
                }
                d.store.write(c);
                return c;
            });
            return serveStep(final, l, { projectPath }, d); // re-serve from cache (no handler re-run)
        }
        case 'skip':
            return skipStep(cp, l, projectPath, t, d);
        default:
            throw new Error(`advanceLane: unknown action "${t.action}"`);
    }
}
// remaining (cursor+1..end) verb steps whose member flows have a REQUIRED
// prerequisite that is among the skipped flows, not already completed, and whose
// exact edge is not waived in the lane's prereqWaivers.
function strandedBySkipping(cp, l) {
    const skipFlows = new Set(l.verbSteps[cp.cursor].flowIds);
    if (skipFlows.size === 0)
        return [];
    const completed = new Set(cp.completedFlowIds);
    const waived = new Set(l.prereqWaivers.map((w) => `${w.dependentFlowId}<-${w.prerequisiteFlowId}`));
    const blocked = new Set();
    for (let i = cp.cursor + 1; i < l.verbSteps.length; i++) {
        const later = l.verbSteps[i];
        for (const depFlow of later.flowIds) {
            const deps = flow_prerequisites_1.FlowPrerequisiteValidator.getDependencies(depFlow);
            if (!deps)
                continue;
            for (const p of deps.prerequisites) {
                if (!p.required)
                    continue;
                if (skipFlows.has(p.flowId) && !completed.has(p.flowId) && !waived.has(`${depFlow}<-${p.flowId}`)) {
                    blocked.add(later.verb);
                }
            }
        }
    }
    return [...blocked];
}
async function skipStep(cp, l, projectPath, t, d) {
    if (!t.reason || !t.reason.trim())
        throw new Error('advanceLane: skip requires a reason');
    const blocked = strandedBySkipping(cp, l);
    if (blocked.length > 0) {
        throw new Error(`advanceLane: cannot skip "${l.verbSteps[cp.cursor].verb}" - later steps require its prerequisites: ${blocked.join(', ')}. Complete it or stop the lane.`);
    }
    const step = l.verbSteps[cp.cursor];
    // skip BYPASSES the gate (no validators), recorded with its reason in the audit.
    // Claim + finalize so the skip commits atomically under the lock, like complete.
    const operationId = (d.newOperationId ?? defaultOperationId)();
    const claimed = await (0, lane_checkpoint_store_1.claimLease)(d.store, cp.checkpointId, { expectedRevision: t.expectedRevision, stepId: step.verb, iteration: cp.iteration, operationId, now: d.now, staleMs: d.staleMs });
    const id = claimed.lease;
    const final = await (0, lane_checkpoint_store_1.finalizeLease)(d.store, cp.checkpointId, id, (c, committedRevision) => {
        c.skippedStepIds.push(step.verb);
        c.audit.push({ action: 'skip', stepId: step.verb, iteration: c.iteration, reason: t.reason, revision: committedRevision, at: d.now() });
        advanceCursorInPlace(c, l);
    }, d.now);
    return buildStepResult(final, l, { projectPath }, d);
}
//# sourceMappingURL=lane-runner.js.map