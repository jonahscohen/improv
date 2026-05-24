import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

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
})();
