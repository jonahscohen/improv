#!/usr/bin/env node
/**
 * MIGRATION HARNESS - BuildReport golden fixture (Stage 0, item 2).
 *
 * Stage 3 replaces the flow-driven BuildReport with the scanner->BuildReport
 * contract. Before that, the new producer must reproduce the CURRENT
 * generateBuildReport output on a fixed input (the COMPATIBILITY CONTRACT).
 * This tool snapshots the DETERMINISTIC BuildReport fields (`capture`) and diffs
 * the new producer against them (`verify`). reportId + generatedAt are inherently
 * non-deterministic (timestamp + random) and are STRIPPED from the golden.
 * TEMP harness - sunset at Stage 5.
 *
 * Input = a fixed set of FlowExecutionResult fixtures (with memory + validationResults)
 * exercising domain grades, findings (warning/blocking), a failed gate, verdict, nextSteps.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, '..', '..', 'dist');
const GOLDEN = path.join(HERE, 'golden', 'buildreport', 'report.json');

// Fixed, deterministic input fixtures (hand-authored compatibility input, NOT the eval corpus).
const FLOW_RESULTS = [
  {
    flowId: 'flowZ_design_component', flowName: 'Design a New Component', status: 'success',
    validationResults: [
      { domain: 'accessibility', status: 'pass', passedRules: ['contrast', 'focus-visible', 'aria-names'], failedRules: [], message: 'a11y clean' },
      { domain: 'taste', status: 'partial', passedRules: ['r1', 'r2'], failedRules: ['r3'], message: 'one taste issue' },
    ],
    memory: {
      flowId: 'flowZ_design_component', flowName: 'Design a New Component', timestamp: 'fixed', status: 'success',
      appliedRules: [], userDecisions: [], metrics: [],
      validationResults: [
        { check: 'WCAG 2.1 AA', result: 'pass', details: 'all text >= 4.5:1' },
        { check: 'AI slop detection', result: 'warning', details: 'mild eyebrow chip' },
      ],
      referencesUsed: [], gates: [{ name: 'brand-verified', required: true, passed: true }],
      artifactProduced: [], summary: 'component built', nextSteps: ['ship'],
    },
  },
  {
    flowId: 'flowK_multi_lens_audit', flowName: 'Multi-Lens Audit', status: 'success',
    validationResults: [
      { domain: 'performance', status: 'fail', passedRules: ['p1'], failedRules: ['p2', 'p3'], message: 'perf issues' },
    ],
    memory: {
      flowId: 'flowK_multi_lens_audit', flowName: 'Multi-Lens Audit', timestamp: 'fixed', status: 'success',
      appliedRules: [], userDecisions: [],
      // metric-derived case (Codex MAJOR fold): "domain.metric" name + status feeds
      // both a metric finding AND a 'color' domain grade.
      metrics: [{ name: 'color.contrast-ratio', value: 3.2, target: 4.5, status: 'fail' }],
      validationResults: [{ check: 'contrast', result: 'fail', details: '2.1:1 below AA on body text' }],
      referencesUsed: [], gates: [{ name: 'design-tokens-exist', required: true, passed: false, error: 'no DESIGN.md' }],
      artifactProduced: [], summary: 'audit complete', nextSteps: ['fix contrast', 'add DESIGN.md'],
    },
  },
];

// ONE fixed input used by BOTH generate() and verify(producer) so the injected NEW
// producer receives the same input incl `composite` (Codex re-verify: seam parity).
const BUILDREPORT_INPUT = { source: 'flow-results', flowResults: FLOW_RESULTS, composite: 'composite_craft_qa' };

async function generate(producer) {
  if (producer) return producer(BUILDREPORT_INPUT);
  const { generateBuildReport } = await import(path.join(DIST, 'build-report-aggregator.js'));
  return generateBuildReport(BUILDREPORT_INPUT);
}

/** Strip the inherently non-deterministic fields so the golden is stable. */
function deterministic(report) {
  const { reportId, generatedAt, ...rest } = report;
  return rest;
}

async function capture() {
  const report = deterministic(await generate());
  mkdirSync(path.dirname(GOLDEN), { recursive: true });
  writeFileSync(GOLDEN, JSON.stringify(report, null, 2) + '\n');
  return report;
}

/** Diff `producer` (default = current aggregator) against the golden (deterministic fields). */
async function verify(producer) {
  if (!existsSync(GOLDEN)) return { ok: false, drift: ['no golden (run capture)'] };
  const golden = JSON.stringify(JSON.parse(readFileSync(GOLDEN, 'utf8')));
  const report = deterministic(await generate(producer)); // producer receives BUILDREPORT_INPUT (incl composite)
  const actual = JSON.stringify(report);
  return actual === golden ? { ok: true, drift: [] } : { ok: false, drift: ['BuildReport deterministic fields differ from golden'] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  try {
    if (cmd === 'capture') { const r = await capture(); console.log(`captured BuildReport golden -> golden/buildreport/report.json (verdict=${r.verdict}, grade=${r.overallGrade}, findings=${r.findings.length}, domains=${r.domainGrades.length})`); }
    else if (cmd === 'verify') {
      const r = await verify();
      if (r.ok) { console.log('BuildReport golden VERIFY OK (current == golden, deterministic fields)'); process.exit(0); }
      console.error('BuildReport golden DRIFT:'); for (const d of r.drift) console.error(`  - ${d}`); process.exit(1);
    } else { console.error('usage: buildreport-snapshot.mjs <capture|verify>'); process.exit(2); }
  } catch (e) { console.error(`ERROR: ${e instanceof Error ? e.message : e}`); process.exit(2); }
}

export { generate, capture, verify, deterministic, FLOW_RESULTS, BUILDREPORT_INPUT };
