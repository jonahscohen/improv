// Proof harness: renders EVERY live flow handler's payload and reports whether it TEACHES.
//
// WHY THIS EXISTS. The standing failure mode on this work is a unit that satisfies its own local
// boundary while nothing downstream can reach it - a craft corpus wired into a module no verb
// invokes. A coverage grep cannot catch that, because a grep proves an import exists, not that the
// import reaches a payload. This harness executes the handler the ORCHESTRATOR actually registers
// and reads the guidance it returns, so a handler that imports the corpus but never emits a brief
// fails here.
//
// It also names the two handler files that are ORPHANED - `flow-handler-multi-lens-audit.ts` and
// `flow-handler-design-critique.ts` are imported by nothing; the live flowK and flowL come from
// `flow-handlers-tier3-tier4.ts`. Wiring the orphans would have produced exactly the unreachable
// result described above, so the harness pins which file each flow really runs.
//
// Run:  npx ts-node scripts/prove-craft-briefs.ts
//       npx ts-node scripts/prove-craft-briefs.ts --show flowI_accessibility   (dump one raw payload)
//       npx ts-node scripts/prove-craft-briefs.ts --project /path/to/real/project
//
// Exit 0 when every handler that SHOULD teach does. Exit 1 otherwise, listing which did not.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { FlowABrandVerifyHandler } from '../src/flow-handler-brand-verify';
import { FlowBComponentResearchHandler } from '../src/flow-handler-component-research';
import { FlowCFontResearchHandler } from '../src/flow-handler-font-research';
import { FlowDReferenceSearchHandler } from '../src/flow-handler-design-references';
import { FlowEMotionPatternsHandler } from '../src/flow-handler-motion-patterns';
import { FlowFDesignTokensHandler } from '../src/flow-handler-design-tokens';
import { FlowGComponentImplementationHandler } from '../src/flow-handler-component-implementation';
import { FlowHMotionIntegrationHandler } from '../src/flow-handler-motion-integration';
import { FlowIAccessibilityHandler } from '../src/flow-handler-accessibility';
import { FlowJTacticalPolishHandler } from '../src/flow-handler-tactical-polish';
import { FlowMResponsiveValidationHandler } from '../src/flow-handler-responsive-validation';
import {
  FlowKMultiLensAuditHandler,
  FlowLDesignCritiqueHandler,
  FlowNRapidIterationHandler,
  FlowOCloneMatchHandler,
  FlowPConstraintDesignHandler,
  FlowQMigrationHandler,
} from '../src/flow-handlers-tier3-tier4';
import {
  FlowRLayoutOptimizationHandler,
  FlowSTypographyExcellenceHandler,
  FlowTAmbitiousMotionHandler,
} from '../src/flow-handlers-tier5-specialized';
import { FlowUCurateHandler, FlowVAllSevenQAHandler } from '../src/flow-handlers-curate-qa';
import { FlowWLandingCompositionHandler } from '../src/flow-handler-landing-composition';
import { FlowXCopywritingHandler } from '../src/flow-handler-copywriting';
import { FlowYExploreHandler } from '../src/flow-handlers-extended';
import { FlowZDesignHandler } from '../src/flow-handlers-core';
import { resetCraftProbeCache } from '../src/craft-probe';

interface Entry {
  flowId: string;
  /** The file the ORCHESTRATOR actually loads this handler from. */
  file: string;
  make: () => { execute: (ctx: any) => Promise<any> };
}

const HANDLERS: Entry[] = [
  { flowId: 'flowA_brand_verify', file: 'flow-handler-brand-verify.ts', make: () => new FlowABrandVerifyHandler() },
  { flowId: 'flowB_component_research', file: 'flow-handler-component-research.ts', make: () => new FlowBComponentResearchHandler() },
  { flowId: 'flowC_font_research', file: 'flow-handler-font-research.ts', make: () => new FlowCFontResearchHandler() },
  { flowId: 'flowD_reference_inspiration', file: 'flow-handler-design-references.ts', make: () => new FlowDReferenceSearchHandler() },
  { flowId: 'flowE_motion_patterns', file: 'flow-handler-motion-patterns.ts', make: () => new FlowEMotionPatternsHandler() },
  { flowId: 'flowF_design_tokens', file: 'flow-handler-design-tokens.ts', make: () => new FlowFDesignTokensHandler() },
  { flowId: 'flowG_component_implementation', file: 'flow-handler-component-implementation.ts', make: () => new FlowGComponentImplementationHandler() },
  { flowId: 'flowH_motion_integration', file: 'flow-handler-motion-integration.ts', make: () => new FlowHMotionIntegrationHandler() },
  { flowId: 'flowI_accessibility', file: 'flow-handler-accessibility.ts', make: () => new FlowIAccessibilityHandler() },
  { flowId: 'flowJ_tactical_polish', file: 'flow-handler-tactical-polish.ts', make: () => new FlowJTacticalPolishHandler() },
  { flowId: 'flowK_multi_lens_audit', file: 'flow-handlers-tier3-tier4.ts', make: () => new FlowKMultiLensAuditHandler() },
  { flowId: 'flowL_design_critique', file: 'flow-handlers-tier3-tier4.ts', make: () => new FlowLDesignCritiqueHandler() },
  { flowId: 'flowM_responsive_validation', file: 'flow-handler-responsive-validation.ts', make: () => new FlowMResponsiveValidationHandler() },
  { flowId: 'flowN_rapid_iteration_refined', file: 'flow-handlers-tier3-tier4.ts', make: () => new FlowNRapidIterationHandler() },
  { flowId: 'flowO_clone_match_special', file: 'flow-handlers-tier3-tier4.ts', make: () => new FlowOCloneMatchHandler() },
  { flowId: 'flowP_constraint_design_special', file: 'flow-handlers-tier3-tier4.ts', make: () => new FlowPConstraintDesignHandler() },
  { flowId: 'flowQ_migration_special', file: 'flow-handlers-tier3-tier4.ts', make: () => new FlowQMigrationHandler() },
  { flowId: 'flowR_layout_optimization', file: 'flow-handler-layout-optimization.ts', make: () => new FlowRLayoutOptimizationHandler() },
  { flowId: 'flowS_typography_excellence', file: 'flow-handler-typography-excellence.ts', make: () => new FlowSTypographyExcellenceHandler() },
  { flowId: 'flowT_ambitious_motion', file: 'flow-handler-ambitious-motion.ts', make: () => new FlowTAmbitiousMotionHandler() },
  { flowId: 'flowU_curate', file: 'flow-handler-curate.ts', make: () => new FlowUCurateHandler() },
  { flowId: 'flowV_all_seven_qa', file: 'flow-handler-all-seven-qa.ts', make: () => new FlowVAllSevenQAHandler() },
  { flowId: 'flowW_landing_composition', file: 'flow-handler-landing-composition.ts', make: () => new FlowWLandingCompositionHandler() },
  { flowId: 'flowX_copywriting', file: 'flow-handler-copywriting.ts', make: () => new FlowXCopywritingHandler() },
  { flowId: 'flowY_explore_discovery', file: 'flow-handlers-extended.ts', make: () => new FlowYExploreHandler() },
  { flowId: 'flowZ_design_component', file: 'flow-handlers-core.ts', make: () => new FlowZDesignHandler() },
];

/** A page that trips rules across every finding class, so a brief has real failures to select from. */
const FIXTURE_HTML = [
  '<!doctype html><html><head><style>',
  ':root { --brand: #2563eb; --radius-a: 3px; }',
  '.btn { transition: all 200ms; border-radius: 12px; padding: 8px; background: #fff; color: #8a8a8a; }',
  '.btn:hover { animation: pulse 200ms; background: #1d4ed8; }',
  '.card { border-left: 3px solid #c00; box-shadow: 0 1px 2px rgba(0,0,0,0.1); border-radius: 7px; }',
  '.panel { border-radius: 19px; backdrop-filter: blur(24px); }',
  '.count { font-size: 9px; }',
  '.hero h1 { background-clip: text; background-image: linear-gradient(90deg,#f00,#00f); }',
  'p { text-align: justify; }',
  '@keyframes pulse { from { opacity: 0; } to { opacity: 1; } }',
  '</style></head><body>',
  '<h1>Seamless synergy for powerful teams</h1>',
  '<h4>Skipped heading level</h4>',
  '<button class="btn">Go</button>',
  '<div class="card"><span class="count">42</span></div>',
  '<img src="missing.png">',
  '<img src="second.png">',
  '<form><input type="text" placeholder="Your email"><textarea></textarea>',
  '<input type="checkbox"> I accept</form>',
  '<canvas class="chart"></canvas>',
  '<p>Revolutionary justified body copy that leverages cutting-edge synergy.</p>',
  '</body></html>',
].join('\n');

const FIXTURE_PRODUCT = [
  '# Proof Product', '',
  'A precise, editorial tool for shipping interface work, used here to give the brand and research',
  'flows a real project to read rather than an empty directory.', '',
  '## Voice', 'precise, editorial, calm, considered', '',
  '## Register', 'product', '',
  '## Brand personality', 'restrained, technical, exact', '',
].join('\n');

function seedFixture(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'craft-brief-proof-'));
  fs.writeFileSync(path.join(dir, 'index.html'), FIXTURE_HTML);
  fs.writeFileSync(path.join(dir, 'PRODUCT.md'), FIXTURE_PRODUCT);
  return dir;
}

interface Row {
  flowId: string;
  file: string;
  status: string;
  teaches: boolean;
  hasGood: boolean;
  hasWhy: boolean;
  hasDo: boolean;
  hasSource: boolean;
  teachBeforeCheck: boolean;
  namesFailingRules: number;
  briefChars: number;
  note: string;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const showIdx = argv.indexOf('--show');
  const showFlow = showIdx >= 0 ? argv[showIdx + 1] : undefined;
  const projIdx = argv.indexOf('--project');
  const project = projIdx >= 0 ? argv[projIdx + 1] : seedFixture();
  const ephemeral = projIdx < 0;

  const rows: Row[] = [];
  for (const entry of HANDLERS) {
    resetCraftProbeCache();
    let payload = '';
    let status = 'unknown';
    let note = '';
    try {
      const res: any = await entry.make().execute({
        flowId: entry.flowId,
        projectPath: project,
        utterance: 'prove the craft brief renders',
      } as any);
      status = String(res?.status ?? 'no-status');
      payload = (res?.guidance || []).join('\n');
    } catch (e) {
      status = 'threw';
      note = e instanceof Error ? e.message : String(e);
    }

    if (showFlow && entry.flowId === showFlow) {
      process.stdout.write(`\n===== RAW PAYLOAD: ${entry.flowId} (${entry.file}) =====\n`);
      process.stdout.write(payload + '\n');
      process.stdout.write(`===== END RAW PAYLOAD (${payload.length} chars) =====\n\n`);
    }

    const briefIdx = payload.indexOf('CRAFT BRIEF');
    const findIdx = payload.indexOf('FINDINGS - what was actually measured');
    const briefBlock = briefIdx >= 0
      ? payload.slice(briefIdx, findIdx > briefIdx ? findIdx : undefined)
      : '';
    rows.push({
      flowId: entry.flowId,
      file: entry.file,
      status,
      teaches: briefBlock.includes('Good:') && briefBlock.includes('Why:') && briefBlock.includes('Do:'),
      hasGood: briefBlock.includes('Good:'),
      hasWhy: briefBlock.includes('Why:'),
      hasDo: briefBlock.includes('Do:'),
      hasSource: briefBlock.includes('Source:'),
      teachBeforeCheck: briefIdx >= 0 && findIdx > briefIdx,
      namesFailingRules: (payload.match(/^- \[(blocker|major|minor|advisory)\] \[/gm) || []).length,
      briefChars: briefBlock.length,
      note,
    });
  }

  const pad = (s: string, n: number) => (s.length >= n ? s.slice(0, n) : s + ' '.repeat(n - s.length));
  process.stdout.write('\nCRAFT BRIEF COVERAGE ACROSS LIVE FLOW HANDLERS\n');
  process.stdout.write(`fixture project: ${project}\n\n`);
  process.stdout.write(`${pad('flow', 32)}${pad('status', 9)}${pad('teaches', 8)}${pad('G/W/D/S', 9)}${pad('T<C', 5)}${pad('named', 6)}chars\n`);
  process.stdout.write('-'.repeat(78) + '\n');
  for (const r of rows) {
    const gwds = `${r.hasGood ? 'G' : '-'}${r.hasWhy ? 'W' : '-'}${r.hasDo ? 'D' : '-'}${r.hasSource ? 'S' : '-'}`;
    process.stdout.write(
      `${pad(r.flowId, 32)}${pad(r.status, 9)}${pad(r.teaches ? 'YES' : 'no', 8)}${pad(gwds, 9)}` +
      `${pad(r.teachBeforeCheck ? 'ok' : '-', 5)}${pad(String(r.namesFailingRules), 6)}${r.briefChars}\n`);
    if (r.note) process.stdout.write(`${' '.repeat(32)}note: ${r.note}\n`);
  }

  const teaching = rows.filter((r) => r.teaches);
  const notTeaching = rows.filter((r) => !r.teaches);
  process.stdout.write('\n');
  process.stdout.write(`TALLY: ${teaching.length}/${rows.length} live flow handlers emit a craft brief with Good/Why/Do.\n`);
  process.stdout.write(`  with a Source citation:      ${rows.filter((r) => r.hasSource).length}/${rows.length}\n`);
  process.stdout.write(`  teach before check ordering: ${rows.filter((r) => r.teachBeforeCheck).length}/${rows.length}\n`);
  process.stdout.write(`  naming failing rules inline: ${rows.filter((r) => r.namesFailingRules > 0).length}/${rows.length}\n`);
  if (notTeaching.length) {
    process.stdout.write('\nNOT TEACHING:\n');
    for (const r of notTeaching) process.stdout.write(`  ${r.flowId} (${r.file}) status=${r.status} ${r.note}\n`);
  }

  if (ephemeral) fs.rmSync(project, { recursive: true, force: true });
  process.exit(notTeaching.length === 0 ? 0 : 1);
}

main().catch((e) => { console.error('prove-craft-briefs threw: ' + String(e)); process.exit(1); });
