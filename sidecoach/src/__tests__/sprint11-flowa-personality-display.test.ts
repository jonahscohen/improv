import { FlowExecutionEngine } from '../sidecoach-orchestrator';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const TEACH_V2 = `# PRODUCT.md

## Register

**Brand**

## Primary Users

test users

## Brand Personality

Professional, technical, restrained, plainspoken.

## Anti-References

- generic SaaS

## Strategic Principles

- concrete deliverables
`;

const TEACH_V2_NO_PERSONALITY = `# PRODUCT.md

## Register

**Brand**

## Primary Users

test users

## Anti-References

- generic

## Strategic Principles

- concrete
`;

function mkSandbox(content: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint11-personality-'));
  fs.writeFileSync(path.join(dir, 'PRODUCT.md'), content, 'utf-8');
  const designSource = '/Users/spare3/Documents/Github/improv/reference/DESIGN.md';
  if (fs.existsSync(designSource)) fs.copyFileSync(designSource, path.join(dir, 'DESIGN.md'));
  return dir;
}

async function run() {
  const checks: Array<[string, boolean]> = [];

  // T1.1: Personality renders real text when section is populated
  {
    const sandbox = mkSandbox(TEACH_V2);
    const engine = new FlowExecutionEngine();
    const result: any = await engine.process('/sidecoach craft', { projectPath: sandbox, projectContext: { register: 'brand' } } as any);
    const flowA = (result.flowResults || []).find((fr: any) => fr.flowId === 'flowA_brand_verify');
    const allGuidance = (flowA?.guidance || []).join('\n');
    checks.push(['T1.1: Personality renders real text', allGuidance.includes('Professional, technical, restrained')]);
    checks.push(['T1.1: Personality is NOT empty string', !/Personality:\s*\n/.test(allGuidance) && !/Personality:\s*$/m.test(allGuidance)]);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  // T1.2: Personality renders "Not specified" when section is absent
  {
    const sandbox = mkSandbox(TEACH_V2_NO_PERSONALITY);
    const engine = new FlowExecutionEngine();
    const result: any = await engine.process('/sidecoach craft', { projectPath: sandbox, projectContext: { register: 'brand' } } as any);
    const flowA = (result.flowResults || []).find((fr: any) => fr.flowId === 'flowA_brand_verify');
    const allGuidance = (flowA?.guidance || []).join('\n');
    checks.push(['T1.2: Personality renders "Not specified" when absent', allGuidance.includes('Personality: Not specified')]);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint11-flowa-personality-display PASS' : 'sprint11-flowa-personality-display FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
