import { FlowSTypographyExcellenceHandler } from '../flow-handler-typography-excellence';
import { FlowGComponentImplementationHandler } from '../flow-handler-component-implementation';
import { FlowHMotionIntegrationHandler } from '../flow-handler-motion-integration';
import { parseDesignMd } from '../design-md-parser';
import * as fs from 'fs';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const designPath = path.resolve(__dirname, '../../../reference/DESIGN.md');
  const designContent = fs.readFileSync(designPath, 'utf8');
  const designTokens = parseDesignMd(designContent);

  const baseCtx = {
    utterance: 'check tokens',
    projectContext: { register: 'brand', product: {}, design: {} },
    metadata: { designContent, designTokens },
  } as any;

  const citationRegex = /Source: DESIGN\.md L\d+/;

  const tHandler = new FlowSTypographyExcellenceHandler();
  const tResult = await tHandler.execute(baseCtx);
  const tCitations = (tResult.guidance || []).filter((l) => citationRegex.test(l));
  assertTrue(tCitations.length >= 3, `typography handler: at least 3 citations (got ${tCitations.length})`);

  const gHandler = new FlowGComponentImplementationHandler();
  const gResult = await gHandler.execute(baseCtx);
  const gCitations = (gResult.guidance || []).filter((l) => citationRegex.test(l));
  assertTrue(gCitations.length >= 3, `component-implementation handler: at least 3 citations (got ${gCitations.length})`);

  const hHandler = new FlowHMotionIntegrationHandler();
  const hResult = await hHandler.execute(baseCtx);
  const hCitations = (hResult.guidance || []).filter((l) => citationRegex.test(l));
  assertTrue(hCitations.length >= 3, `motion-integration handler: at least 3 citations (got ${hCitations.length})`);

  console.log(`rolling citations PASS: typography=${tCitations.length}, component=${gCitations.length}, motion=${hCitations.length}`);
})();
