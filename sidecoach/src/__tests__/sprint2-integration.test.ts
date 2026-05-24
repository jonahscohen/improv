import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import { FlowCompositionEngine, PRESET_COMPOSITE_FLOWS } from '../flow-composition';
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

  // 1. Both new flows are registered
  const availableIds = engine.getAvailableFlows().map((f) => f.flowId);
  assertTrue(availableIds.includes('flowW_landing_composition'), 'flowW registered');
  assertTrue(availableIds.includes('flowX_copywriting'), 'flowX registered');

  // 2. New composite preset exists
  const craftLanding = PRESET_COMPOSITE_FLOWS.find((p) => p.id === 'composite_craft_landing_page');
  assertTrue(craftLanding != null, 'composite_craft_landing_page registered as preset');

  // 3. Each new handler runs in isolation through getHandlers()
  const handlers = engine.getHandlers();
  const wHandler = handlers.get('flowW_landing_composition');
  const xHandler = handlers.get('flowX_copywriting');
  assertTrue(wHandler != null, 'handlers.get(flowW) returns handler');
  assertTrue(xHandler != null, 'handlers.get(flowX) returns handler');

  const baseCtx = {
    utterance: 'craft a landing page',
    projectContext: { register: 'brand', product: {}, design: {} },
    metadata: { sectionIds: ['hero'], productName: 'Studio Atelier' },
    projectPath: refRoot,
  } as any;

  const wResult = await wHandler!.execute(baseCtx);
  assertTrue(wResult.status === 'success', 'flowW execute success');
  assertTrue((wResult.guidance || []).some((g) => g.includes('Hero')), 'flowW guidance covers Hero');

  const xResult = await xHandler!.execute(baseCtx);
  assertTrue(xResult.status === 'success', 'flowX execute success');
  assertTrue((xResult.guidance || []).some((g) => /Option 1:/.test(g)), 'flowX guidance has draft Option 1');
  assertTrue((xResult.guidance || []).some((g) => /Studio Atelier/.test(g)), 'flowX substituted product name');

  // 4. Aggregate sanity - both handlers produce memory artifacts that downstream flows can consume
  assertTrue(wResult.memory != null, 'flowW memory emitted');
  assertTrue(xResult.memory != null, 'flowX memory emitted');

  console.log('sprint2-integration PASS');
})();
