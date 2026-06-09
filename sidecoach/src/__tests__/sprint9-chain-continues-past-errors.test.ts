import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Sprint 9 T3: chain executor must continue past errored flows so downstream
// flows still attempt. Dogfood showed flowH (motion) and flowI (a11y) silently
// dropped from the chain when an earlier flow errored.

function mkSandbox(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint9-chain-'));
  fs.writeFileSync(
    path.join(dir, 'PRODUCT.md'),
    `# PRODUCT.md\n\n## Register\n\n**Brand**\n\n## Primary Users\n\ntest users\n\n## Anti-References\n\n- generic\n\n## Strategic Principles\n\n- concrete\n`,
    'utf-8'
  );
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

  // Monkey-patch a mid-chain handler to throw. The craft chain is
  // [flowA_brand_verify, flowF_design_tokens, flowG_component_implementation, flowJ_tactical_polish].
  // We pick flowG (mid-chain) so we can assert at least one downstream flow (flowJ) still ran.
  const targetFlowId = 'flowG_component_implementation';
  const handlers = (engine as any).handlers as Map<string, any>;
  const targetHandler = handlers.get(targetFlowId);
  if (!targetHandler) {
    console.log(`FAIL T3.0: target handler ${targetFlowId} not registered`);
    process.exit(1);
  }
  const originalExecute = targetHandler.execute.bind(targetHandler);
  targetHandler.execute = async (_ctx: any) => {
    throw new Error('SIMULATED_FAILURE: flowG threw mid-chain');
  };

  const expectedChainLength = 4; // craft chain length

  let result: any;
  let processThrew: Error | null = null;
  try {
    result = await engine.process('/sidecoach craft', {
      projectPath: sandbox,
      projectContext: { register: 'brand' },
    } as any);
  } catch (err) {
    processThrew = err as Error;
  }

  // restore so we don't leak the patched handler
  targetHandler.execute = originalExecute;

  // T3.0: process() must not bubble the handler exception up to the caller.
  checks.push(['T3.0: engine.process did not throw when a handler threw', processThrew === null]);

  if (result) {
    const flowResults: any[] = result.flowResults || [];

    // T3.1: chain not halted - we should have at least the expected number of entries.
    checks.push([
      `T3.1: flowResults.length (${flowResults.length}) >= expectedChainLength (${expectedChainLength})`,
      flowResults.length >= expectedChainLength,
    ]);

    // T3.2: target flow has status='error' in results.
    const targetEntry = flowResults.find((fr) => fr.flowId === targetFlowId);
    checks.push([
      `T3.2: target flow ${targetFlowId} present with status='error'`,
      !!targetEntry && targetEntry.status === 'error',
    ]);

    // T3.3: at least one flow AFTER target also appears in results.
    const idx = flowResults.findIndex((fr) => fr.flowId === targetFlowId);
    const downstream = idx >= 0 ? flowResults.slice(idx + 1) : [];
    checks.push([
      `T3.3: at least one flow appears after ${targetFlowId} in results (downstream count=${downstream.length})`,
      downstream.length >= 1,
    ]);

    // T3.4: top-level success === (some flow succeeded).
    const anySuccess = flowResults.some((fr) => fr.status === 'success');
    checks.push([
      `T3.4: top-level success matches any-flow-succeeded (success=${result.success}, anySuccess=${anySuccess})`,
      result.success === anySuccess,
    ]);
  } else {
    checks.push(['T3.1: result returned (skipped because process threw)', false]);
    checks.push(['T3.2: target flow has status=error (skipped because process threw)', false]);
    checks.push(['T3.3: downstream flow ran (skipped because process threw)', false]);
    checks.push(['T3.4: success matches anySuccess (skipped because process threw)', false]);
  }

  fs.rmSync(sandbox, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint9-chain-continues-past-errors PASS' : 'sprint9-chain-continues-past-errors FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
