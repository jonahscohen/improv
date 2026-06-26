// Proof harness: shows the reference systems (component / fonts / design-references /
// motion / icon-source) FIRING during a build lane. Designed to run UNCHANGED on both
// the pre-change (baseline) tree and the post-change tree so a git-stash diff is a true
// before/after. It reads only stable, long-lived APIs plus the OPTIONAL referencePreflight
// field (via `as any`), so it compiles on a tree that predates that field.
//
// Run: npx ts-node scripts/prove-references-fire.ts
//
// Three independent probes:
//   (1) ROUTING   - which lanes/verbs now carry flowC_font_research / flowD_reference_inspiration.
//   (2) FIRING    - drive lane_build through the REAL lane-runner with the REAL flow handlers
//                   (clean runValidator stub only, same pattern as the committed
//                   lane-execution-e2e suite) and record what each flow returned at the
//                   `craft` step: status + artifact count + artifact titles + guidance markers.
//   (3) PREFLIGHT - print the lane-start referencePreflight artifact bundle (deliverable B);
//                   undefined/absent on the baseline tree, present after B lands.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { LANES_BY_ID } from '../src/lanes.generated';
import { getVerbEntry } from '../src/verb-command-registry';
import { createExecutionEngine } from '../src/sidecoach-orchestrator';
import { buildProjectContext } from '../src/context-loader';
import { startLane, advanceLane, LaneRunnerDeps } from '../src/lane-runner';
import { LaneCheckpointStore } from '../src/lane-checkpoint-store';
import type { StepReport } from '../src/lane-types';
import { ReferenceDataService } from '../src/reference-data';

const FLOW_C = 'flowC_font_research';
const FLOW_D = 'flowD_reference_inspiration';
const FLOW_B = 'flowB_component_research';

function line(s = '') { process.stdout.write(s + '\n'); }
function has(arr: readonly string[] | undefined, id: string) { return !!arr && arr.includes(id); }

// Minimal but real PRODUCT.md so brand-verify and disk-reading flows have a project to read.
function seedProject(proj: string) {
  fs.writeFileSync(path.join(proj, 'PRODUCT.md'), [
    '# Proof Product',
    '',
    'A clean, editorial, precise product surface used to prove the sidecoach reference systems fire.',
    '',
    '## Voice',
    'clean, editorial, precise, considered, calm',
    '',
    '## Register',
    'product',
    '',
    '## Brand personality',
    'clean, editorial, precise',
    '',
  ].join('\n'));
}

// ---- (1) ROUTING ------------------------------------------------------------
function probeRouting() {
  line('=== (1) ROUTING: verb/lane membership ===');
  const craft = getVerbEntry('craft')?.flowIds ?? [];
  const typeset = getVerbEntry('typeset')?.flowIds ?? [];
  const colorize = getVerbEntry('colorize')?.flowIds ?? [];
  line(`verb craft     flowC=${has(craft, FLOW_C)} flowD=${has(craft, FLOW_D)}`);
  line(`verb typeset   flowC=${has(typeset, FLOW_C)}`);
  line(`verb colorize  flowD=${has(colorize, FLOW_D)}`);
  for (const id of ['lane_build', 'lane_delight', 'lane_live']) {
    const seq = LANES_BY_ID[id]?.flowSequence ?? [];
    line(`lane ${id.padEnd(12)} flowC=${has(seq, FLOW_C)} flowD=${has(seq, FLOW_D)}`);
  }
  line('');
}

// ---- (2) FIRING -------------------------------------------------------------
async function probeFiring() {
  line('=== (2) FIRING: lane_build driven through real flow handlers ===');
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'prove-refs-'));
  seedProject(proj);
  // Derive projectContext from the SEEDED PRODUCT.md via buildProjectContext - the SAME
  // loader the production orchestrator (enrichContextForHandler) uses - instead of
  // hardcoding it. This proves flowC/flowD fire from real PRODUCT.md parsing, not from an
  // injected object (Codex review 2026-06-23, finding 4). The lane-runner serves later
  // steps with { projectPath } only, so runFlow re-injects this derived context, mirroring
  // exactly what enrichContextForHandler does in production.
  const loaded = buildProjectContext(proj);
  const projectContext: any = {
    register: loaded.register,
    product: loaded.product ? { ...loaded.product, content: loaded.productContent } : { content: loaded.productContent },
    design: loaded.design,
  };
  line(`derived from PRODUCT.md: register=${loaded.register}, brandPersonality=${JSON.stringify(loaded.product?.brandPersonality)}`);

  const engine = createExecutionEngine();
  const handlers = engine.getHandlers();
  // Per-flow firing log keyed by `${verb}:${flowId}`.
  const firingLog: { verb: string; flowId: string; status: string; artifactCount: number; artifactTitles: string[] }[] = [];
  let currentVerb = '';

  const deps: LaneRunnerDeps = {
    store: new LaneCheckpointStore(proj),
    runFlow: async (flowId, context) => {
      const h = handlers.get(flowId);
      if (!h) return { flowId, flowName: String(flowId), status: 'skipped', message: 'no handler', guidance: [], checklist: [] };
      // The lane-runner serves later steps with context { projectPath } only (it strips
      // projectContext); in production the orchestrator re-derives projectContext from
      // PRODUCT.md/DESIGN.md via enrichContextForHandler. We mirror that by re-injecting
      // the seeded projectContext so the REAL handlers run with real project context.
      const enriched: any = { utterance: '', metadata: {}, ...context, projectPath: proj, projectContext };
      if (!h.canExecute(enriched)) {
        firingLog.push({ verb: currentVerb, flowId: String(flowId), status: 'needs_input(canExecute=false)', artifactCount: 0, artifactTitles: [] });
        return { flowId, flowName: String(flowId), status: 'needs_input', message: 'canExecute=false', guidance: [], checklist: [] };
      }
      try {
        const r = await h.execute(enriched);
        firingLog.push({
          verb: currentVerb, flowId: String(flowId), status: r.status,
          artifactCount: r.artifacts?.length ?? 0,
          artifactTitles: (r.artifacts ?? []).map((a: any) => a.name),
        });
        return r;
      } catch (e) {
        firingLog.push({ verb: currentVerb, flowId: String(flowId), status: `error: ${(e as Error).message}`, artifactCount: 0, artifactTitles: [] });
        return { flowId, flowName: String(flowId), status: 'error', message: String(e), guidance: [], checklist: [] };
      }
    },
    now: () => new Date().toISOString(),
    newCheckpointId: () => 'prove-cp',
    newOperationId: () => `op-${Math.random().toString(36).slice(2)}`,
    // Clean validator gate so the sequence can advance shape -> craft -> polish. The flows
    // (not the validators) are what produce the reference artifacts under test.
    runValidator: async () => ({ status: 'clean', rules: [], findings: [],
      coverage: { inspectedFiles: [], skippedFiles: [], supportedSourceKinds: [], unsupportedSourceKinds: [],
        ruleCounts: { pass: 0, fail: 0, notApplicable: 0, inconclusive: 0 },
        findingCounts: { blockingExcess: 0, withinTolerance: 0, nonBlocking: 0 }, measuredScope: [], unverifiedScope: [] } } as any),
  };

  let step: any = await startLane('lane_build', 'proof target', { projectPath: proj, projectContext }, 'prove-req', deps);
  let craftGuidance: string[] = [];
  let craftFlowIds: string[] = [];
  let guard = 0;
  while (step.lifecycle === 'in_progress' && guard++ < 50) {
    currentVerb = step.currentVerb;
    if (step.currentVerb === 'craft') { craftGuidance = step.guidance ?? []; craftFlowIds = (step.flowIds ?? []).map(String); }
    const rep: StepReport = { stepId: step.currentVerb, iteration: step.iteration, reportId: `prove:${step.currentVerb}:${step.iteration}`, verb: step.currentVerb, summary: 'done', evidence: [{ kind: 'note', detail: 'proof' }] } as any;
    step = await advanceLane(proj, step.checkpointId, { action: 'complete', report: rep, expectedRevision: step.revision }, deps);
  }

  line(`craft step flowIds: ${JSON.stringify(craftFlowIds)}`);
  // NOTE: a step's member flows are served DURING the advance of the PRIOR step, so the
  // verb tag can lag; we report the full execution-ordered log, not a verb-filtered view.
  line('per-flow firing across the lane (execution order: status / artifacts):');
  for (const f of firingLog) {
    line(`  ${f.flowId.padEnd(30)} ${String(f.status).padEnd(26)} artifacts=${f.artifactCount} ${f.artifactTitles.length ? '[' + f.artifactTitles.join(' | ') + ']' : ''}`);
  }
  // Conclusions are read STRICTLY off the firing log (status === 'success' from the real
  // handler) + the routed craft flowIds - NOT off guidance strings. The static craft
  // guidance contains the phrase "design references vetted for AI-slop", which would
  // false-positive any "design references" text match; the firing log cannot lie that way.
  void craftGuidance; // captured for context only; intentionally not used for pass/fail
  const fired = (id: string) => firingLog.some((f) => f.flowId === id && f.status === 'success');
  const firedArtifacts = (id: string) => firingLog.some((f) => f.flowId === id && f.status === 'success' && f.artifactCount > 0);
  const routed = (id: string) => craftFlowIds.includes(id);
  line('CONCLUSIONS (from firing log + routed craft flowIds - the honest signal):');
  line(`  flowB component  routed=${routed(FLOW_B)} fired=${fired(FLOW_B)} producedArtifacts=${firedArtifacts(FLOW_B)}`);
  line(`  flowC fonts      routed=${routed(FLOW_C)} fired=${fired(FLOW_C)} producedArtifacts=${firedArtifacts(FLOW_C)}`);
  line(`  flowD design-ref routed=${routed(FLOW_D)} fired=${fired(FLOW_D)} producedArtifacts=${firedArtifacts(FLOW_D)}`);
  line('');
  try { fs.rmSync(proj, { recursive: true, force: true }); } catch { /* ignore */ }
  return step;
}

// ---- (3) PREFLIGHT ----------------------------------------------------------
function probePreflight(laneStep: any) {
  line('=== (3) PREFLIGHT: lane-start referencePreflight bundle (deliverable B) ===');
  const pf = (laneStep as any)?.referencePreflight;
  if (!pf) { line('referencePreflight: ABSENT (undefined)'); line(''); return; }
  line(`referencePreflight.artifacts: ${pf.artifacts?.length ?? 0}`);
  for (const a of pf.artifacts ?? []) line(`  - [${a.kind}] ${a.title}`);
  if (pf.warnings?.length) line(`referencePreflight.warnings: ${JSON.stringify(pf.warnings)}`);
  line('');
}

// ---- (4) DEPTH (C1) ---------------------------------------------------------
function probeDepth() {
  line('=== (4) DEPTH (C1): componentIndex runtime enrichment ===');
  const s = new ReferenceDataService();
  line(`componentIndex types: ${s.getComponentTypes().length}`);
  const NEW = ['combobox', 'spinner', 'separator', 'hero', 'carousel', 'segmented'];
  for (const q of NEW) {
    const hits = s.searchComponents(q);
    line(`  searchComponents("${q}") -> ${hits.length > 0 ? 'FIRES' : 'absent'}${hits[0] ? ' [' + hits[0].name + ']' : ''}`);
  }
  line('');
}

async function main() {
  probeRouting();
  probeDepth();
  // Re-run a fresh lane start to capture the START step result (carries referencePreflight
  // once B lands) without the drive loop having advanced past it.
  const startStep = await captureStartStep();
  await probeFiring();
  probePreflight(startStep);
}

// A minimal second start purely to capture the START LaneStepResult object (for probe 3).
async function captureStartStep(): Promise<any> {
  const proj = fs.mkdtempSync(path.join(os.tmpdir(), 'prove-start-'));
  seedProject(proj);
  // Production-faithful: pass ONLY projectPath. The orchestrator's reference preflight
  // reads PRODUCT.md itself (buildProjectContext) - no injected projectContext.
  const engine = createExecutionEngine();
  try {
    const step = await engine.startLane('lane_build', 'proof target', { projectPath: proj }, `prove-start-${Math.random().toString(36).slice(2)}`);
    return step;
  } catch (e) {
    line(`(captureStartStep: engine.startLane threw - ${(e as Error).message}); preflight probe will report ABSENT`);
    return undefined;
  } finally {
    try { fs.rmSync(proj, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

main().then(() => line('prove-references-fire: done')).catch((e) => { console.error('prove-references-fire FAILED:', e); process.exit(1); });
