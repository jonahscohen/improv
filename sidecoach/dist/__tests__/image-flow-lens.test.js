"use strict";
// sidecoach/src/__tests__/image-flow-lens.test.ts
//
// Contract for the CONCEPT SKETCH LENS in flow D (design references), the wiring that makes image generation
// reachable from a real verb (`sidecoach craft` and `sidecoach colorize` both run flowD_reference_inspiration)
// rather than being a loose script nobody calls.
//
// What is proven:
//   1. The lens really invokes the real bin and really produces a verified plate, through the flow, at zero cost.
//   2. The prompt is deterministic, so the same brief yields the same plate and the same cache key.
//   3. The flow REPORTS the outcome in all of its states. A verified plate becomes an artifact; a failed or
//      unverifiable one is named and withheld; a lens that did not run says so. None of those is a silent pass.
//   4. The memory record's validation follows the same fail-closed rule, so a downstream reader cannot mistake a
//      missing sketch for a passing one.
//   5. The lens never spends: the command it builds carries no spend signal and names the offline provider.
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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const flow_handler_design_references_1 = require("../flow-handler-design-references");
const image_png_codec_1 = require("../image-png-codec");
const image_asset_verify_1 = require("../image-asset-verify");
function assert(cond, msg) {
    if (!cond)
        throw new Error(msg);
}
const SC = path.resolve(__dirname, '..', '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-image-lens-'));
function contextWith(projectPath) {
    return {
        utterance: 'a pricing page for a solo accounting tool',
        projectPath,
        projectContext: { register: 'product', design: { visual: { approach: 'restrained editorial' } } },
    };
}
// ---------------------------------------------------------------------------
// 1. The prompt is deterministic and says what a reference plate needs to say
// ---------------------------------------------------------------------------
function testPrompt() {
    const a = (0, flow_handler_design_references_1.buildSketchPrompt)('product', 'restrained editorial', 'a pricing page');
    const b = (0, flow_handler_design_references_1.buildSketchPrompt)('product', 'restrained editorial', '  a   pricing    page  ');
    assert(a === b, 'the prompt normalizes whitespace, so the same brief is the same request');
    assert(a !== (0, flow_handler_design_references_1.buildSketchPrompt)('brand', 'restrained editorial', 'a pricing page'), 'the register changes the prompt');
    assert(a !== (0, flow_handler_design_references_1.buildSketchPrompt)('product', 'brutalist', 'a pricing page'), 'the visual approach changes the prompt');
    assert(/no text, no lettering, no logos/.test(a), 'the prompt forbids text, which is what makes a plate usable under a headline');
    assert(/negative space/.test(a), 'the prompt asks for space to place content in');
    const long = (0, flow_handler_design_references_1.buildSketchPrompt)('product', 'modern', 'x'.repeat(500));
    assert(!long.includes('x'.repeat(221)), 'an absurdly long brief is truncated rather than sent whole');
    assert(long.includes('x'.repeat(220)), 'the truncation keeps the leading 220 characters of the brief');
    const empty = (0, flow_handler_design_references_1.buildSketchPrompt)('product', 'modern', '   ');
    assert(/described in the brief/.test(empty), 'an empty utterance still yields a usable prompt');
}
// ---------------------------------------------------------------------------
// 2. The lens, running for real through the bin
// ---------------------------------------------------------------------------
function testLens() {
    assert((0, flow_handler_design_references_1.runConceptSketchLens)(contextWith(undefined)) === null, 'with no project path the lens does not run');
    assert((0, flow_handler_design_references_1.runConceptSketchLens)(contextWith(path.join(TMP, 'no-such-dir'))) === null, 'with a nonexistent project path the lens does not run');
    assert((0, flow_handler_design_references_1.runConceptSketchLens)(contextWith(path.join(SC, 'package.json'))) === null, 'a file where a directory is expected does not run the lens');
    const project = path.join(TMP, 'project-a');
    fs.mkdirSync(project, { recursive: true });
    const outcome = (0, flow_handler_design_references_1.runConceptSketchLens)(contextWith(project));
    assert(outcome !== null, 'with a real project path the lens runs');
    const o = outcome;
    assert(o.status === 'verified', `the lens produces a VERIFIED plate (got ${o.status}: ${o.detail})`);
    assert(o.provider === 'offline', 'the lens uses the offline provider, which cannot spend');
    assert(typeof o.path === 'string' && fs.existsSync(o.path), 'the plate is on disk at the reported path');
    const bytes = fs.readFileSync(o.path);
    assert(bytes.length > 1000, `the plate has real bytes (got ${bytes.length})`);
    const decoded = (0, image_png_codec_1.decodePng)(bytes);
    assert(decoded.ok, 'the plate is a decodable PNG');
    if (decoded.ok) {
        assert(decoded.width === 1024 && decoded.height === 1024, 'the plate is the requested geometry');
        assert(decoded.text[image_asset_verify_1.SYNTHETIC_MARKER_KEY] === 'offline-deterministic', 'the plate is marked synthetic in its own bytes');
    }
    // Same brief, second project: byte-identical, which is the determinism promise reaching through the flow.
    const project2 = path.join(TMP, 'project-b');
    fs.mkdirSync(project2, { recursive: true });
    const again = (0, flow_handler_design_references_1.runConceptSketchLens)(contextWith(project2));
    assert(again.status === 'verified', 'the second run also verifies');
    assert(fs.readFileSync(again.path).equals(bytes), 'the same brief yields byte-identical plates across projects');
    // Nothing was spent: the ledger the lens would have written to does not exist.
    assert(!fs.existsSync(path.join(project, '.sidecoach-cache', 'images', 'spend-ledger.json')), 'the offline lens records no spend because it never spends');
}
// ---------------------------------------------------------------------------
// 3. Guidance is honest in every state
// ---------------------------------------------------------------------------
function testGuidance() {
    const notRun = (0, flow_handler_design_references_1.sketchGuidance)(null);
    assert(notRun.some((l) => /not run/.test(l)), 'a lens that did not run says so');
    assert(notRun.some((l) => /sidecoach-image\.js/.test(l)), 'it tells the reader how to run one');
    assert(!notRun.some((l) => /VERIFIED/.test(l)), 'a lens that did not run never says verified');
    const verified = (0, flow_handler_design_references_1.sketchGuidance)({ status: 'verified', path: '/tmp/plate.png', provider: 'offline', model: 'sidecoach-offline-v1', detail: 'checked' });
    assert(verified.some((l) => /VERIFIED and available at \/tmp\/plate\.png/.test(l)), 'a verified plate is reported with its path');
    assert(verified.some((l) => /placeholder/.test(l)), 'a verified OFFLINE plate is still labelled a placeholder, not passed off as a real asset');
    const failed = (0, flow_handler_design_references_1.sketchGuidance)({ status: 'failed', provider: 'offline', detail: 'dimensions-match (image is 512x512)' });
    assert(failed.some((l) => /FAILED verification and is NOT offered/.test(l)), 'a failed plate is withheld and says why');
    assert(!failed.some((l) => /available at/.test(l)), 'a failed plate is never reported as available');
    const unverified = (0, flow_handler_design_references_1.sketchGuidance)({ status: 'unverified', provider: 'openai', detail: 'pixels-decodable' });
    assert(unverified.some((l) => /UNVERIFIED/.test(l) && /not offered/.test(l)), 'an unverifiable plate is withheld and named unverified');
    assert(!unverified.some((l) => /VERIFIED and available/.test(l)), 'an unverifiable plate is never called verified');
    const unavailable = (0, flow_handler_design_references_1.sketchGuidance)({ status: 'unavailable', provider: 'openai', detail: 'exited 6' });
    assert(unavailable.some((l) => /no plate was produced/.test(l)), 'a failed step says no plate was produced');
}
// ---------------------------------------------------------------------------
// 3b. The offer predicate: VERIFIED and nothing else, on all four states
//
// The flow can be driven into `verified` and `null` easily. It cannot easily be driven into `failed` or
// `unverified` without breaking the tool underneath it, so the rule lives in a pure predicate that IS testable
// on all four - otherwise two of the four branches would ship uncovered.
// ---------------------------------------------------------------------------
function testOfferPredicate() {
    assert((0, flow_handler_design_references_1.isOfferableSketch)({ status: 'verified', path: '/tmp/p.png', provider: 'offline', detail: 'ok' }), 'a verified plate with a path is offerable');
    assert(!(0, flow_handler_design_references_1.isOfferableSketch)({ status: 'failed', path: '/tmp/p.png', provider: 'offline', detail: 'bad' }), 'a FAILED plate is never offerable, even with a path on disk');
    assert(!(0, flow_handler_design_references_1.isOfferableSketch)({ status: 'unverified', path: '/tmp/p.png', provider: 'openai', detail: 'undecodable' }), 'an UNVERIFIED plate is never offerable, even with a path on disk');
    assert(!(0, flow_handler_design_references_1.isOfferableSketch)({ status: 'unavailable', provider: 'openai', detail: 'exited 6' }), 'an unavailable plate is not offerable');
    assert(!(0, flow_handler_design_references_1.isOfferableSketch)(null), 'a lens that did not run offers nothing');
    assert(!(0, flow_handler_design_references_1.isOfferableSketch)({ status: 'verified', provider: 'offline', detail: 'ok' }), 'a verified outcome with NO path is not offerable');
    assert(!(0, flow_handler_design_references_1.isOfferableSketch)({ status: 'verified', path: '', provider: 'offline', detail: 'ok' }), 'a verified outcome with an empty path is not offerable');
}
// ---------------------------------------------------------------------------
// 4. Flow D actually carries the outcome: guidance, checklist, artifact, memory
// ---------------------------------------------------------------------------
async function testFlowIntegration() {
    const project = path.join(TMP, 'project-flow');
    fs.mkdirSync(project, { recursive: true });
    const handler = new flow_handler_design_references_1.FlowDReferenceSearchHandler();
    const withSketch = await handler.execute(contextWith(project));
    assert(withSketch.status === 'success', `flow D succeeds (got ${withSketch.status}: ${withSketch.error || ''})`);
    const guidance = (withSketch.guidance || []).join('\n');
    assert(/Concept Sketch \(generated reference plate, verified before it is offered\)/.test(guidance), 'flow D announces the sketch step');
    assert(/Concept sketch: VERIFIED and available at/.test(guidance), 'flow D reports the verified plate in its guidance');
    const item = (withSketch.checklist || []).find((c) => /Concept sketch generated AND verified/.test(c.label));
    assert(item !== undefined, 'the checklist carries the sketch item');
    assert(/verified/.test(item.description || ''), 'the checklist item records the outcome');
    const artifact = (withSketch.artifacts || []).find((a) => a.name === 'Concept Sketch (verified)');
    assert(artifact !== undefined, 'a verified plate becomes a flow artifact');
    assert(fs.existsSync(artifact.content), 'the artifact points at a file that exists');
    const validation = (withSketch.memory?.validationResults || []).find((v) => v.check === 'Concept sketch verification');
    assert(validation !== undefined, 'the memory record carries the sketch validation');
    assert(validation.result === 'pass', `a verified plate is a passing validation (got ${validation.result})`);
    // No project path: the lens cannot run, and every surface says so rather than implying a pass.
    const withoutSketch = await handler.execute(contextWith(undefined));
    assert(withoutSketch.status === 'success', 'flow D still succeeds without a project path');
    const noGuidance = (withoutSketch.guidance || []).join('\n');
    assert(/Concept sketch: not run/.test(noGuidance), 'the no-run case is reported in the guidance');
    assert(!/VERIFIED/.test(noGuidance), 'the no-run case never claims a verified plate');
    assert((withoutSketch.artifacts || []).every((a) => a.name !== 'Concept Sketch (verified)'), 'no plate means no artifact');
    const noValidation = (withoutSketch.memory?.validationResults || []).find((v) => v.check === 'Concept sketch verification');
    assert(noValidation !== undefined && noValidation.result === 'warning', `a lens that did not run is a warning, never a pass (got ${noValidation?.result})`);
}
async function main() {
    testPrompt();
    testLens();
    testGuidance();
    testOfferPredicate();
    await testFlowIntegration();
    fs.rmSync(TMP, { recursive: true, force: true });
    console.log('image-flow-lens: OK (deterministic prompt, real plate through the real bin at zero cost, honest guidance in all four states, flowD guidance + checklist + artifact + fail-closed memory validation)');
}
main().catch((err) => {
    console.error(err && err.stack ? err.stack : String(err));
    process.exit(1);
});
//# sourceMappingURL=image-flow-lens.test.js.map