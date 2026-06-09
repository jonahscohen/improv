import { ContextLoader } from '../project-context';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function mkSandbox(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint9-parser-'));
}

const TEACH_V2_BRAND = `# PRODUCT.md

## Register

**Brand**

## Primary Users

Digital creative practitioners across roles - PMs, designers, engineers.

## Brand Personality

Professional, technical, restrained, plainspoken.

## Anti-References

What this should NOT look like:

- Generic SaaS marketing patterns
- Hero gradients with floating product mockups
- Screenshot carousels

## Strategic Principles

- Each tool gets equal billing
- Navigation reflects the toolkit structure
`;

const TEACH_V2_PRODUCT = `# PRODUCT.md

## Register

**Product**

## Primary Users

PMs running standup

## Anti-References

- Jira clones

## Strategic Principles

- zero clicks to today's queue
`;

async function run() {
  const checks: Array<[string, boolean]> = [];

  // T1.1: teach v2 BRAND format -> register='brand'
  {
    const sandbox = mkSandbox();
    fs.writeFileSync(path.join(sandbox, 'PRODUCT.md'), TEACH_V2_BRAND, 'utf-8');
    const loader = new ContextLoader();
    const ctx = loader.load(sandbox);
    checks.push(['T1.1: teach v2 brand -> register=brand', ctx.register === 'brand']);
    checks.push(['T1.1: productMd loaded', ctx.loaded.productMd === true]);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  // T1.2: teach v2 PRODUCT format -> register='product'
  {
    const sandbox = mkSandbox();
    fs.writeFileSync(path.join(sandbox, 'PRODUCT.md'), TEACH_V2_PRODUCT, 'utf-8');
    const loader = new ContextLoader();
    const ctx = loader.load(sandbox);
    checks.push(['T1.2: teach v2 product -> register=product', ctx.register === 'product']);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  // T1.3: regression - existing sidecoach/PRODUCT.md still parses
  {
    const sandbox = mkSandbox();
    const existing = fs.readFileSync('/Users/spare3/Documents/Github/improv/sidecoach/PRODUCT.md', 'utf-8');
    fs.writeFileSync(path.join(sandbox, 'PRODUCT.md'), existing, 'utf-8');
    const loader = new ContextLoader();
    const ctx = loader.load(sandbox);
    checks.push(['T1.3: existing sidecoach PRODUCT.md still parses', ctx.loaded.productMd === true]);
    // We do NOT assert a specific register value here - just that parsing succeeds.
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  // T1.4: PRODUCT.md missing -> productMd=false, default register
  {
    const sandbox = mkSandbox();
    const loader = new ContextLoader();
    const ctx = loader.load(sandbox);
    checks.push(['T1.4: missing PRODUCT.md -> productMd=false', ctx.loaded.productMd === false]);
    checks.push(['T1.4: missing PRODUCT.md -> register defaults to product', ctx.register === 'product']);
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint9-product-md-parser PASS' : 'sprint9-product-md-parser FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
