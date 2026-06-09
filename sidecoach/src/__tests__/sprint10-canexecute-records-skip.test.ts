import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function mkSandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint10-skip-'));
  fs.writeFileSync(path.join(dir, 'PRODUCT.md'),
    `# PRODUCT.md\n\n## Register\n\n**Brand**\n\n## Primary Users\n\ntest users\n\n## Anti-References\n\n- generic\n\n## Strategic Principles\n\n- concrete\n`,
    'utf-8');
  const designSource = '/Users/spare3/Documents/Github/improv/reference/DESIGN.md';
  if (fs.existsSync(designSource)) {
    fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
  }
  return dir;
}

async function run() {
  const checks: Array<[string, boolean]> = [];
  const sandbox = mkSandbox();
  const engine = new FlowExecutionEngine();

  // Monkey-patch flowG_component_implementation's canExecute to return false.
  const handlers = (engine as any).handlers as Map<string, any>;
  const original = handlers.get('flowG_component_implementation');
  handlers.set('flowG_component_implementation', {
    canExecute: () => false,
    execute: async () => { throw new Error('should not be called - canExecute returned false'); },
  });

  const result: any = await engine.process('/sidecoach craft', {
    projectPath: sandbox,
    projectContext: { register: 'brand' },
  } as any);

  if (original) handlers.set('flowG_component_implementation', original);

  // T2.1: flowG appears in flowResults with status='skipped'
  const flowResults = result.flowResults || [];
  const skipped = flowResults.find((fr: any) => fr.flowId === 'flowG_component_implementation');
  checks.push(['T2.1: flowG present in flowResults', !!skipped]);
  if (skipped) {
    checks.push(['T2.1: flowG has status=skipped', skipped.status === 'skipped']);
    checks.push(['T2.1: flowG has actionable message', typeof skipped.message === 'string' && skipped.message.length > 0]);
  } else {
    checks.push(['T2.1: flowG has status=skipped', false]);
    checks.push(['T2.1: flowG has actionable message', false]);
  }

  fs.rmSync(sandbox, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint10-canexecute-records-skip PASS' : 'sprint10-canexecute-records-skip FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
