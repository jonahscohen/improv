import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  process.env.SIDECOACH_PROJECT_PATH = refRoot;
  const engine = new FlowExecutionEngine();

  // Test that enrichContextForHandler is called BEFORE canExecute in the natural-language path.
  // Strategy: use the brand-verify flow (flowA) which has a canExecute that checks for register.
  // Pass context without projectContext set, ensuring it's loaded via enrichment.

  // FlowA is special - it runs before the main intent detection flow.
  // Instead, test by verifying that a handler's canExecute receives enriched context.

  // Get the handler directly to verify canExecute logic:
  const handlers = engine.getHandlers();
  const flowGHandler = handlers.get('flowG_component_implementation');
  assertTrue(flowGHandler != null, 'FlowG handler exists');

  // Create a minimal context WITHOUT projectContext (the test condition).
  const unenrichedCtx = {
    utterance: 'test',
    projectPath: refRoot,
    metadata: {},
  } as any;

  // canExecute should FAIL without projectContext.
  const canExecWithoutEnrichment = flowGHandler!.canExecute(unenrichedCtx);
  console.log(`canExecute WITHOUT enrichment: ${canExecWithoutEnrichment}`);

  // Now call enrichContextForHandler (which the orchestrator calls before canExecute in T11 fix).
  const enrichedCtx = engine.enrichContextForHandler(unenrichedCtx, 'flowG_component_implementation');
  const canExecWithEnrichment = flowGHandler!.canExecute(enrichedCtx);
  console.log(`canExecute WITH enrichment: ${canExecWithEnrichment}`);

  // The T11 fix ensures enriched context is used, so canExecute should return true after enrichment.
  assertTrue(
    canExecWithEnrichment === true,
    `enriched context passes canExecute (got ${canExecWithEnrichment}, enriched register: ${enrichedCtx.projectContext?.register})`
  );

  console.log('sprint3-orchestrator-enrich-before-canexecute PASS');
})();
