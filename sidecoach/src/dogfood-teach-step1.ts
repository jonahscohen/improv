// Dogfood step 1: invoke /sidecoach teach against the user's VERBATIM brief.
// No embellishments. Whatever teach can't parse becomes a gap question for the user.

import { FlowExecutionEngine } from './sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';

const projectPath = path.resolve(__dirname, '..', '..', 'marketing-site');

// User's verbatim brief from the prior session, lightly rephrased only to flow as one paragraph.
const brief = `Build a brand new marketing landing page for the Improv repo, advertising justify, sidecoach, and memory tools, as well as mentions of our other tools. The page links to two other pages, one for justify and one for sidecoach. Both pages serve as marketing pages for each. Use the existing Improv DESIGN.md for color tokens and brand materials. The system chooses the new fonts.`;

async function run() {
  // The marketing site moved out of the improv repo on 2026-07-13; it now lives in its own
  // project at ~/Documents/Github/improv-site. This path no longer exists inside improv.
  // Fail loud instead of silently recreating an empty ghost marketing-site/ directory here
  // (the removed mkdirSync did exactly that). Repoint projectPath at ~/Documents/Github/improv-site
  // to run this dogfood against the moved site.
  if (!fs.existsSync(projectPath)) {
    throw new Error(
      `Project path not found: ${projectPath}\n` +
        `The marketing site moved out of the improv repo on 2026-07-13 and now lives at ` +
        `~/Documents/Github/improv-site. Repoint projectPath there (or restore the site) before running this dogfood script.`,
    );
  }

  console.log(`Project path: ${projectPath}`);
  console.log(`Brief: ${brief}`);
  console.log('');

  const engine = new FlowExecutionEngine();
  const result: any = await engine.process(`/sidecoach teach ${brief}`, {
    projectPath,
    projectContext: { register: 'brand' },
  } as any);

  console.log('=== Teach result ===');
  const flow = result.flowResults?.[0] || result;
  console.log(`Status: ${flow.status || result.status || 'unknown'}`);
  console.log(`Success: ${result.success}`);
  console.log(`Message: ${result.message || flow.message || '(none)'}`);
  console.log('');

  if (flow.guidance && flow.guidance.length > 0) {
    console.log('=== Guidance ===');
    for (const g of flow.guidance) console.log(g);
    console.log('');
  }
  if (flow.checklist && flow.checklist.length > 0) {
    console.log('=== Checklist ===');
    for (const c of flow.checklist) {
      const label = typeof c === 'string' ? c : (c.label || JSON.stringify(c));
      console.log(`- ${label}`);
    }
    console.log('');
  }
  if (flow.artifacts && flow.artifacts.length > 0) {
    console.log('=== Artifacts ===');
    for (const a of flow.artifacts) {
      console.log(`-- ${a.name} (${a.type}) --`);
      console.log(a.content);
    }
    console.log('');
  }

  const productMdPath = path.join(projectPath, 'PRODUCT.md');
  if (fs.existsSync(productMdPath)) {
    console.log('=== PRODUCT.md (WRITTEN) ===');
    console.log(fs.readFileSync(productMdPath, 'utf-8'));
  } else {
    console.log('=== PRODUCT.md NOT written - teach surfaced gaps ===');
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
