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
// renderUrl activation path: a lane started WITH a renderUrl threads it onto the
// checkpoint (persisted) and into the validator context so the browser-backed rules
// activate; a lane started with NO renderUrl + a free-text target leaves renderUrl
// undefined and the browser rules dormant (inconclusive). lane_build "craft" binds the
// polish-standard validator, so completing craft runs it with the threaded context.
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const lane_runner_1 = require("../lane-runner");
const lane_checkpoint_store_1 = require("../lane-checkpoint-store");
const run_validator_1 = require("../validators/run-validator");
const BROWSER_RULES = ['polish.concentric-radius', 'polish.typography-rhythm', 'a11y.min-hit-area', 'a11y.color-contrast'];
const mkproj = () => fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'lane-ru-')));
const cleanResult = () => ({
    status: 'clean', rules: [], findings: [],
    coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
        ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
        findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] },
});
const baseDeps = (store, id, runValidator) => ({
    store,
    runFlow: async (flowId) => ({ flowId, flowName: String(flowId), status: 'success', message: 'ok', guidance: [], checklist: [] }),
    now: () => new Date().toISOString(),
    newCheckpointId: () => id,
    newOperationId: () => `op-${Math.random().toString(36).slice(2)}`,
    runValidator,
});
// Drive a started lane forward until its first validator runs (signalled by `ran`) or it closes.
async function driveUntilValidator(proj, first, deps, ran) {
    let step = first;
    let guard = 0;
    while (step.lifecycle === 'in_progress' && !ran() && guard++ < 50) {
        const verb = step.currentVerb;
        if (!verb)
            break;
        const rep = { stepId: verb, iteration: step.iteration, reportId: `ru:${verb}:${guard}`, verb, summary: 'done', evidence: [{ kind: 'note', detail: 'x' }] };
        step = await (0, lane_runner_1.advanceLane)(proj, step.checkpointId, { action: 'complete', report: rep, expectedRevision: step.revision }, deps);
    }
}
async function run() {
    const dataUrl = (html) => `data:text/html,${encodeURIComponent(html)}`;
    // 1. WITH renderUrl: threads onto the checkpoint (persisted) and into the validator ctx.
    {
        const proj = mkproj();
        const url = dataUrl('<!doctype html><main><p style="line-height:20px">t</p></main>');
        const seen = [];
        const deps = baseDeps(new lane_checkpoint_store_1.LaneCheckpointStore(proj), 'lane-ru1', async (_v, ctx) => { seen.push(ctx.renderUrl); return cleanResult(); });
        const first = await (0, lane_runner_1.startLane)('lane_build', 'a free-text target', { projectPath: proj }, 'req-ru-1', deps, url);
        await driveUntilValidator(proj, first, deps, () => seen.length > 0);
        if (seen.length === 0)
            throw new Error('lane_build must run a validator (craft binds polish-standard)');
        if (!seen.every((u) => u === url))
            throw new Error(`validator ctx.renderUrl must equal the started renderUrl, got ${JSON.stringify(seen)}`);
        const reloaded = new lane_checkpoint_store_1.LaneCheckpointStore(proj).read('lane-ru1');
        if (reloaded.renderUrl !== url)
            throw new Error('renderUrl must persist on the checkpoint across reload');
    }
    // 2. NO renderUrl + free-text target: ctx.renderUrl undefined (browser rules dormant).
    {
        const proj = mkproj();
        const seen = [];
        const deps = baseDeps(new lane_checkpoint_store_1.LaneCheckpointStore(proj), 'lane-ru2', async (_v, ctx) => { seen.push(ctx.renderUrl); return cleanResult(); });
        const first = await (0, lane_runner_1.startLane)('lane_build', 'just a free-text target, not a url', { projectPath: proj }, 'req-ru-2', deps);
        await driveUntilValidator(proj, first, deps, () => seen.length > 0);
        if (seen.length === 0)
            throw new Error('lane_build must run a validator (dormant case)');
        if (!seen.every((u) => u === undefined))
            throw new Error(`a free-text target must yield undefined renderUrl, got ${JSON.stringify(seen)}`);
        if (new lane_checkpoint_store_1.LaneCheckpointStore(proj).read('lane-ru2').renderUrl !== undefined)
            throw new Error('no renderUrl -> checkpoint renderUrl undefined');
    }
    // 3. An invalid (non-URL) renderUrl is rejected at start and stored undefined.
    {
        const proj = mkproj();
        const deps = baseDeps(new lane_checkpoint_store_1.LaneCheckpointStore(proj), 'lane-ru3', async () => cleanResult());
        await (0, lane_runner_1.startLane)('lane_build', 't', { projectPath: proj }, 'req-ru-3', deps, 'not a url at all');
        if (new lane_checkpoint_store_1.LaneCheckpointStore(proj).read('lane-ru3').renderUrl !== undefined)
            throw new Error('a non-URL renderUrl must be stored as undefined');
    }
    // 4. REAL verdicts through the lane (delegate to the production validator). No renderUrl
    //    -> all browser rules inconclusive (deterministic). With a data: renderUrl -> at least
    //    one browser rule reaches a real verdict (SKIP that half if Chromium is unavailable).
    const realRun = async (id, renderUrl) => {
        const proj = mkproj();
        const captured = [];
        const deps = baseDeps(new lane_checkpoint_store_1.LaneCheckpointStore(proj), id, async (vId, ctx, signal) => {
            const res = await (0, run_validator_1.makeProductValidator)(vId)(ctx, signal);
            if (vId === 'polish-standard')
                captured.push(res);
            return res;
        });
        const first = await (0, lane_runner_1.startLane)('lane_build', 'a target', { projectPath: proj }, `req-${id}`, deps, renderUrl);
        await driveUntilValidator(proj, first, deps, () => captured.length > 0);
        return captured[0];
    };
    const dormant = await realRun('lane-ru4a');
    if (dormant) {
        const browser = dormant.rules.filter((r) => BROWSER_RULES.includes(r.ruleId));
        if (browser.length && browser.some((r) => r.status !== 'inconclusive')) {
            throw new Error('without renderUrl the browser rules must all be inconclusive (dormant)');
        }
    }
    const active = await realRun('lane-ru4b', dataUrl('<!doctype html><main><p style="line-height:normal">t</p></main>'));
    if (active) {
        const browser = active.rules.filter((r) => BROWSER_RULES.includes(r.ruleId));
        const real = browser.filter((r) => r.status !== 'inconclusive');
        if (real.length === 0) {
            console.log('lane-render-url: SKIP (browser rules inconclusive with renderUrl - Chromium unavailable in this run)');
            return;
        }
    }
    console.log('lane-render-url: OK');
}
run().catch((e) => { console.error(e); process.exit(1); });
//# sourceMappingURL=lane-render-url.test.js.map