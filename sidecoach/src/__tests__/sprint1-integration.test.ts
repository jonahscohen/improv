import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import { detectTokenDrift } from '../project-drift-detector';
import { parseDesignMd } from '../design-md-parser';
import * as path from 'path';
import * as fs from 'fs';

function assertTrue(cond: any, label: string) {
  if (!cond) {
    console.error(`FAIL ${label}: condition was falsy: ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();
  const ctx: any = {
    utterance: 'craft a button',
    metadata: { componentName: 'button' },
    projectContext: { register: 'brand' },
    projectPath: refRoot,
  };
  const enriched = (engine as any).enrichContextForHandler(ctx, 'flowG_component_implementation');
  assertTrue(enriched.metadata.designTokens, 'designTokens injected from DESIGN.md');
  assertTrue(enriched.metadata.designTokens.colors?.brand?.red === '#DC2618', 'specific token value');
  assertTrue(enriched.metadata.techStack, 'techStack injected');
  assertTrue(enriched.projectContext.product, 'PRODUCT.md content surfaced');
  console.log('sprint1 orchestrator injection test PASS');

  // Drift detector e2e coverage against the real landing page CSS
  const designMd = fs.readFileSync(path.resolve(__dirname, '../../../reference/DESIGN.md'), 'utf8');
  const tokens = parseDesignMd(designMd);
  const landingCss = fs.readFileSync(path.resolve(__dirname, '../../fixtures/sprint1/landing.css'), 'utf8');
  const drift = detectTokenDrift(landingCss, tokens);

  console.log('drift summary:', drift.summary);
  console.log('  new color tokens:', drift.newColorTokens.length);
  console.log('  new radius tokens:', drift.newRadiusTokens.length);
  console.log('  new spacing tokens:', drift.newSpacingTokens.length);
  console.log('  new easing tokens:', drift.newEasingTokens.length);
  console.log('  new duration tokens:', drift.newDurationTokens.length);

  assertTrue(drift.newColorTokens.includes('--c-brand-red-hover'), 'detects --c-brand-red-hover drift');
  // --ease-out has the same value as DESIGN.md ease.out, so the value-based detector correctly does not flag it.
  // Instead verify a spacing drift that landing.css introduces (--s-10, --s-14, --s-24, --s-32 are not in DESIGN.md).
  assertTrue(drift.newSpacingTokens.length > 0, 'detects spacing drift tokens');
  assertTrue(drift.newSpacingTokens.includes('--s-10'), 'detects --s-10 spacing drift');

  console.log('sprint1 e2e drift test PASS');
})();
