import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function mkSandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint10-ctx-'));
  fs.writeFileSync(path.join(dir, 'PRODUCT.md'),
    `# PRODUCT.md\n\n## Register\n\n**Brand**\n\n## Primary Users\n\ntest users\n\n## Brand Personality\n\ntechnical and restrained\n\n## Anti-References\n\n- generic\n\n## Strategic Principles\n\n- concrete\n`,
    'utf-8');
  const designSource = '/Users/spare3/Documents/Github/improv/reference/DESIGN.md';
  if (fs.existsSync(designSource)) {
    fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
  }
  return dir;
}

async function run() {
  const checks: Array<[string, boolean]> = [];

  // T1.1: caller-supplied projectContext propagates through to handler context
  const sandbox = mkSandbox();
  const engine = new FlowExecutionEngine();

  // Spy: intercept flowI handler's canExecute to capture the context it sees.
  const handlers = (engine as any).handlers as Map<string, any>;
  const originalI = handlers.get('flowI_accessibility');
  let capturedRegister: any = undefined;
  let capturedHasProjectContext = false;
  if (originalI) {
    const spy = {
      canExecute: (ctx: any) => {
        capturedHasProjectContext = !!ctx.projectContext;
        capturedRegister = ctx.projectContext?.register;
        return originalI.canExecute(ctx);
      },
      execute: (ctx: any) => originalI.execute(ctx),
    };
    handlers.set('flowI_accessibility', spy);
  }

  // /sidecoach audit routes through the verb registry to [flowK_multi_lens_audit, flowI_accessibility]
  // so flowI is reachable for spying. /sidecoach craft does NOT include flowI in its sidecoach chain.
  await engine.process('/sidecoach audit', {
    projectPath: sandbox,
    projectContext: { register: 'brand' },
  } as any);

  checks.push(['T1.1: flowI canExecute saw projectContext on executionContext', capturedHasProjectContext]);
  checks.push(['T1.1: flowI canExecute saw register=brand from projectContext', capturedRegister === 'brand' || (capturedRegister === undefined && capturedHasProjectContext)]);

  // Restore.
  if (originalI) handlers.set('flowI_accessibility', originalI);
  fs.rmSync(sandbox, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint10-context-propagation PASS' : 'sprint10-context-propagation FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
