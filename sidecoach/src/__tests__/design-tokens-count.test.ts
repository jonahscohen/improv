// Flow F (design tokens): the per-section tokenCount must be the ACTUAL number
// of leaf tokens parsed from the DESIGN.md YAML frontmatter, never a placeholder.
// Regression guard for the `Math.floor(Math.random()*20)+5` placeholder that
// previously shipped a fabricated count and fake example token names.

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FlowFDesignTokensHandler } from '../flow-handler-design-tokens';
import { FlowExecutionContext } from '../flow-handler';

function assertEqual<T>(actual: T, expected: T, label: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

// Known fixture: exact, hand-countable leaf-token structure.
const FIXTURE = `---
colors:
  brand:
    red: "#DC2618"
    ink: "#1A1F1B"
  text:
    primary: "#111111"
    secondary: "#555555"
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
motion:
  ease:
    out: "cubic-bezier(0.2, 0, 0, 1)"
---

# Design
Body content.
`;

// Expected leaf-token counts per detected section (bare \`key:\` headers).
// colors subtree: brand.red, brand.ink, text.primary, text.secondary = 4
// brand subtree:  red, ink = 2
// text subtree:   primary, secondary = 2
// rounded subtree: sm, md, lg = 3
// motion subtree: ease.out = 1
// ease subtree:   out = 1
const EXPECTED_COUNTS: Record<string, number> = {
  colors: 4,
  brand: 2,
  text: 2,
  rounded: 3,
  motion: 1,
  ease: 1,
};
const EXPECTED_SECTIONS = ['colors', 'brand', 'text', 'rounded', 'motion', 'ease'];

// Regression fixture (Codex 2026-08-25): token sections written as a YAML list
// of maps must count their list-item leaves (`- key: value`), not report 0.
const LIST_FIXTURE = `---
spacing:
  - sm: 4px
  - md: 8px
  - lg: 12px
colors:
  palette:
    - name: primary
      value: "#fff"
    - name: secondary
      value: "#000"
---

# Design
Body content.
`;

// spacing: three single-key list entries = 3 (spacing.sm, spacing.md, spacing.lg)
// colors:  palette list of 2 maps, each with name+value = 4 leaves
// palette: same 2 maps = 4 leaves
const LIST_EXPECTED_COUNTS: Record<string, number> = {
  spacing: 3,
  colors: 4,
  palette: 4,
};
const LIST_EXPECTED_SECTIONS = ['spacing', 'colors', 'palette'];

// Regression fixture (Codex 2026-08-25, second fold): a section that is a list
// of BARE SCALARS (`- 320px`) must count each entry as one leaf, not report 0.
const SCALAR_FIXTURE = `---
breakpoints:
  - 320px
  - 768px
  - 1024px
rounded:
  sm: "4px"
  md: "8px"
---

# Design
Body content.
`;
const SCALAR_EXPECTED_COUNTS: Record<string, number> = {
  breakpoints: 3,
  rounded: 2,
};
const SCALAR_EXPECTED_SECTIONS = ['breakpoints', 'rounded'];

async function run() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-tokens-'));
  fs.writeFileSync(path.join(tmpDir, 'DESIGN.md'), FIXTURE, 'utf-8');

  const handler = new FlowFDesignTokensHandler();
  const ctx: FlowExecutionContext = {
    utterance: 'validate design tokens',
    projectPath: tmpDir,
    metadata: {},
  };

  const result = await handler.execute(ctx);
  assertEqual(result.status, 'success', 'flow status');

  const cached = handler.getCachedContext();
  if (!cached) {
    console.error('FAIL: no cached token context produced');
    process.exit(1);
  }

  // Section set is unchanged from the prior header-detection behavior.
  assertEqual(cached.tokenSections, EXPECTED_SECTIONS, 'token sections');

  // Every section reports its REAL parsed leaf-token count.
  const actualCounts: Record<string, number> = {};
  cached.tokenDefinitions.forEach((td) => {
    actualCounts[td.section] = td.tokenCount;
  });
  assertEqual(actualCounts, EXPECTED_COUNTS, 'per-section token counts');

  // Examples are real dotted paths sourced from the fixture, not placeholders.
  const colorsDef = cached.tokenDefinitions.find((td) => td.section === 'colors');
  assertEqual(colorsDef?.examples, ['colors.brand.red', 'colors.brand.ink', 'colors.text.primary'], 'colors example paths');
  const roundedDef = cached.tokenDefinitions.find((td) => td.section === 'rounded');
  assertEqual(roundedDef?.examples, ['rounded.sm', 'rounded.md', 'rounded.lg'], 'rounded example paths');

  console.log('design-tokens count test PASS');

  // Determinism: a second run over the same fixture yields identical counts
  // (proves the count is parsed, not randomized).
  const handler2 = new FlowFDesignTokensHandler();
  await handler2.execute({ utterance: 'again', projectPath: tmpDir, metadata: {} });
  const cached2 = handler2.getCachedContext();
  const counts2: Record<string, number> = {};
  cached2?.tokenDefinitions.forEach((td) => {
    counts2[td.section] = td.tokenCount;
  });
  assertEqual(counts2, EXPECTED_COUNTS, 'per-section token counts (deterministic re-run)');

  console.log('design-tokens count determinism test PASS');

  // Regression: list-of-maps token sections count their `- key: value` leaves.
  const listDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-tokens-list-'));
  fs.writeFileSync(path.join(listDir, 'DESIGN.md'), LIST_FIXTURE, 'utf-8');

  const listHandler = new FlowFDesignTokensHandler();
  const listResult = await listHandler.execute({
    utterance: 'validate list tokens',
    projectPath: listDir,
    metadata: {},
  });
  assertEqual(listResult.status, 'success', 'list flow status');

  const listCached = listHandler.getCachedContext();
  if (!listCached) {
    console.error('FAIL: no cached token context produced for list fixture');
    process.exit(1);
  }

  assertEqual(listCached.tokenSections, LIST_EXPECTED_SECTIONS, 'list token sections');

  const listCounts: Record<string, number> = {};
  listCached.tokenDefinitions.forEach((td) => {
    listCounts[td.section] = td.tokenCount;
  });
  assertEqual(listCounts, LIST_EXPECTED_COUNTS, 'list-of-maps per-section token counts');

  const spacingDef = listCached.tokenDefinitions.find((td) => td.section === 'spacing');
  assertEqual(spacingDef?.examples, ['spacing.sm', 'spacing.md', 'spacing.lg'], 'spacing list example paths');
  const paletteDef = listCached.tokenDefinitions.find((td) => td.section === 'colors');
  assertEqual(
    paletteDef?.examples,
    ['colors.palette.name', 'colors.palette.value', 'colors.palette.name'],
    'colors list-of-maps example paths',
  );

  console.log('design-tokens list-of-maps count test PASS');

  // Regression: scalar-list token sections count each bare `- <scalar>` entry.
  const scalarDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sidecoach-tokens-scalar-'));
  fs.writeFileSync(path.join(scalarDir, 'DESIGN.md'), SCALAR_FIXTURE, 'utf-8');

  const scalarHandler = new FlowFDesignTokensHandler();
  const scalarResult = await scalarHandler.execute({
    utterance: 'validate scalar tokens',
    projectPath: scalarDir,
    metadata: {},
  });
  assertEqual(scalarResult.status, 'success', 'scalar flow status');

  const scalarCached = scalarHandler.getCachedContext();
  if (!scalarCached) {
    console.error('FAIL: no cached token context produced for scalar fixture');
    process.exit(1);
  }

  assertEqual(scalarCached.tokenSections, SCALAR_EXPECTED_SECTIONS, 'scalar token sections');

  const scalarCounts: Record<string, number> = {};
  scalarCached.tokenDefinitions.forEach((td) => {
    scalarCounts[td.section] = td.tokenCount;
  });
  assertEqual(scalarCounts, SCALAR_EXPECTED_COUNTS, 'scalar-list per-section token counts');

  const breakpointsDef = scalarCached.tokenDefinitions.find((td) => td.section === 'breakpoints');
  assertEqual(
    breakpointsDef?.examples,
    ['breakpoints[0]', 'breakpoints[1]', 'breakpoints[2]'],
    'breakpoints scalar example paths',
  );

  console.log('design-tokens scalar-list count test PASS');

  // Cleanup
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    fs.rmSync(listDir, { recursive: true, force: true });
    fs.rmSync(scalarDir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
}

run().catch((err) => {
  console.error('FAIL design-tokens count test threw:', err);
  process.exit(1);
});
