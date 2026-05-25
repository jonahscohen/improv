// Sprint 10 T3: PRODUCT.md parser writes camelCase keys matching consumer contract.
//
// Consumers (flowH and friends) read ctx.product.brandPersonality, antiReferences,
// strategicPrinciples (camelCase). The teach v2 post-pass introduced in Sprint 9 T1
// was writing brandpersonality, antireferences, strategicprinciples (lowercased).
// Mismatch caused canExecute to return false and flows to silently drop.
//
// This test pins the camelCase contract.

import { ContextLoader } from '../project-context';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function mkSandbox(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-sprint10-parser-camel-'));
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

async function run() {
  const checks: Array<[string, boolean]> = [];

  const sandbox = mkSandbox();
  fs.writeFileSync(path.join(sandbox, 'PRODUCT.md'), TEACH_V2_BRAND, 'utf-8');
  const loader = new ContextLoader();
  const ctx = loader.load(sandbox);

  // camelCase keys MUST be set
  checks.push([
    'T3.1: ctx.product.brandPersonality is set (camelCase)',
    typeof ctx.product.brandPersonality === 'string' && ctx.product.brandPersonality.length > 0,
  ]);
  checks.push([
    'T3.2: ctx.product.antiReferences is set (camelCase)',
    Array.isArray(ctx.product.antiReferences) && ctx.product.antiReferences.length > 0,
  ]);
  checks.push([
    'T3.3: ctx.product.strategicPrinciples is set (camelCase)',
    Array.isArray(ctx.product.strategicPrinciples) && ctx.product.strategicPrinciples.length > 0,
  ]);

  // lowercased keys MUST NOT be set
  checks.push([
    'T3.4: ctx.product.brandpersonality is NOT set (lowercased)',
    ctx.product.brandpersonality === undefined,
  ]);
  checks.push([
    'T3.5: ctx.product.antireferences is NOT set (lowercased)',
    ctx.product.antireferences === undefined,
  ]);
  checks.push([
    'T3.6: ctx.product.strategicprinciples is NOT set (lowercased)',
    ctx.product.strategicprinciples === undefined,
  ]);

  fs.rmSync(sandbox, { recursive: true, force: true });

  let allPass = true;
  for (const [label, ok] of checks) {
    console.log(ok ? `PASS ${label}` : `FAIL ${label}`);
    if (!ok) allPass = false;
  }
  console.log(allPass ? 'sprint10-parser-camelcase-keys PASS' : 'sprint10-parser-camelcase-keys FAIL');
  process.exit(allPass ? 0 : 1);
}

run().catch((e) => { console.error(e); process.exit(1); });
