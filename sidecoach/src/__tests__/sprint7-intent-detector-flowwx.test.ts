import { IntentDetector } from '../intent-detector';

async function run() {
  const detector = new IntentDetector();
  const checks: Array<[string, boolean]> = [];

  const r1 = detector.detect('compose a landing page');
  checks.push(['T1: compose-landing-page routes to flowW', (r1 as any).flowId === 'flowW_landing_composition']);
  checks.push(['T1: compose-landing-page confidence >= 0.8', ((r1 as any).confidence || 0) >= 0.8]);

  const r2 = detector.detect('draft hero copy');
  checks.push(['T2: draft-hero-copy routes to flowX', (r2 as any).flowId === 'flowX_copywriting']);
  checks.push(['T2: draft-hero-copy confidence >= 0.85', ((r2 as any).confidence || 0) >= 0.85]);

  const r3 = detector.detect('research components');
  const r3FlowId = (r3 as any).flowId || (r3 as any).recommendation?.flowId;
  checks.push(['T3: research-components routes to flowB (no over-match by flowW/flowX)', r3FlowId === 'flowB_component_research']);

  const r4 = detector.detect('copy this function to that file');
  checks.push(['T4: copy-function does NOT route to flowX (excluder)', (r4 as any).flowId !== 'flowX_copywriting']);

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint7-intent-detector-flowwx PASS' : 'sprint7-intent-detector-flowwx FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
