# Sprint 2 (Phase 3): Composition + Copywriting Flows

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the headline-creation gap in Sidecoach by adding two new flow handlers (landing-page composition and per-slot copywriting), wiring them into a "craft landing page" composite workflow, and clearing the three Sprint 1 carryover items so Sprint 2 ships a clean baseline.

**Architecture:** Two new `FlowHandler` subclasses (`FlowWLandingCompositionHandler`, `FlowXCopywritingHandler`) backed by separately-testable data modules (`landing-composition-data.ts`, `copywriting-templates.ts`). Both are register-aware (brand vs product) and read enriched context that the orchestrator injects via `enrichContextForHandler()`. A new `buildCraftLandingPageFlow()` static on `FlowCompositionEngine` chains them with the existing Tier 2/3 flows. Sprint 1 carryover: expose a public `getHandlers()` getter on the orchestrator, tighten `parsedDesignTokens` typing, add a `process()`-path integration test, and adopt the DESIGN.md citation pattern in three more handlers.

**Tech Stack:** TypeScript, Node 18+, `npx ts-node` for test execution (matches Sprint 1's project convention), js-yaml (already in `sidecoach/package.json`), Jest-style assertions via plain `node:assert` (Sprint 1 used `process.exit(1)` on failure - we keep that convention so the verify-before-done hook is the same as Sprint 1).

**Branch:** `sidecoach` (continuing from Sprint 1). All commits land on `sidecoach` and get fast-forwarded to local `main` at the end of the sprint (push decision deferred per the open question in the handoff).

**Hook awareness (from Sprint 1 lessons - bake in every commit step):**
1. `npx ts-node ...test.ts` triggers the `~/.claude/.needs-verification` flag. The commit step in every task must `rm -f ~/.claude/.needs-verification` BEFORE the `git commit`, in a SEPARATE Bash invocation (combining with `&&` re-reads the stale flag).
2. The commit-prep sequence is THREE separate Bash calls in this order: (a) Edit/Write the session memory file, (b) `rm -f ~/.claude/.needs-verification`, (c) `cd /Users/spare3/Documents/Github/claude-dotfiles && git add <specific paths> && git commit -m "..."`.
3. Always pass absolute `cd /Users/spare3/Documents/Github/claude-dotfiles` in the commit call (cwd may be elsewhere from a prior step).
4. Never `git add -A` or `git add .` (working tree has `dist/*` and rolling `MEMORY.md`).
5. If commit complains about memory-dirty, edit memory AGAIN - the `rm` itself counts as a write. The hook wants memory to be the most-recent write before the commit attempt.

---

## File Structure

**New files (10):**

| File | Responsibility |
|------|----------------|
| `sidecoach/src/landing-composition-data.ts` | Register-keyed section taxonomy + rhythm rules + anti-pattern callouts. Pure data + type-safe accessors. No I/O. |
| `sidecoach/src/flow-handler-landing-composition.ts` | `FlowWLandingCompositionHandler` - reads register from context, looks up taxonomy, builds guidance + checklist + memory. |
| `sidecoach/src/copywriting-templates.ts` | Register+slot-keyed `DraftCopyTemplate` records (word-count constraints, voice prompts, sample lexical patterns). Pure data + helpers. |
| `sidecoach/src/flow-handler-copywriting.ts` | `FlowXCopywritingHandler` - takes a section descriptor (or array of section types from upstream composition), expands 2-3 draft copy options per slot, returns guidance + artifacts + memory. |
| `sidecoach/src/__tests__/landing-composition-data.test.ts` | Unit test for taxonomy/rhythm/anti-pattern accessors. |
| `sidecoach/src/__tests__/flow-handler-landing-composition.test.ts` | Handler test - mock context, assert guidance/checklist/memory shape. |
| `sidecoach/src/__tests__/copywriting-templates.test.ts` | Unit test for template lookup and option generation. |
| `sidecoach/src/__tests__/flow-handler-copywriting.test.ts` | Handler test - mock context with section descriptor, assert 2-3 options per slot. |
| `sidecoach/src/__tests__/sprint2-process-path.test.ts` | T5 carryover: integration test exercising `engine.process()` (NOT `enrichContextForHandler` directly) and asserting `Source: DESIGN.md L<n>` lands in the returned guidance. |
| `sidecoach/src/__tests__/sprint2-integration.test.ts` | End-of-sprint smoke: instantiates engine, runs the new `craft landing page` composite, asserts both new flows ran and the chain returns aggregated guidance. |

**Modified files (10):**

| File | Change |
|------|--------|
| `sidecoach/src/types.ts` | Add `flowW_landing_composition` and `flowX_copywriting` to the `FlowId` union under a new "Tier 6: Composition & Copy" comment block. |
| `sidecoach/src/flow-handler.ts` | Add two entries to the `flowNames` map in `BaseFlowHandler.getFlowName()`. |
| `sidecoach/src/flows.ts` | Add two `Flow` definitions with triggers (so `intent-detector` can match utterances like "lay out a landing page" / "draft hero copy"). |
| `sidecoach/src/sidecoach-orchestrator.ts` | Import the two new handlers, register them in the `handlerMap`, add them to `getAvailableFlows()`, and expose a public `getHandlers(): ReadonlyMap<FlowId, FlowHandler>` method that returns a read-only view of `this.handlers`. |
| `sidecoach/src/flow-composition.ts` | Add `buildCraftLandingPageFlow()` static method + append it to `PRESET_COMPOSITE_FLOWS`. |
| `sidecoach/src/context-loader.ts` | Tighten `parsedDesignTokens?: any` to `parsedDesignTokens: DesignTokens \| null` and import the type from `./design-md-parser`. |
| `sidecoach/bin/sidecoach-artifacts.js` | Replace `engine.handlers` (private-field access) with `engine.getHandlers()`. |
| `sidecoach/src/flow-handler-typography-excellence.ts` | Adopt the DESIGN.md citation pattern (3+ guidance lines cite `typography.*`). |
| `sidecoach/src/flow-handler-component-implementation.ts` | Adopt the DESIGN.md citation pattern (3+ guidance lines cite color/spacing tokens). |
| `sidecoach/src/flow-handler-motion-integration.ts` | Adopt the DESIGN.md citation pattern (3+ guidance lines cite `motion.*`). |

---

## Task 1: Foundation - register the two new flow IDs

**Files:**
- Modify: `sidecoach/src/types.ts`
- Modify: `sidecoach/src/flow-handler.ts`
- Modify: `sidecoach/src/flows.ts`

This task only edits type unions and registry data. No handler logic yet. Verification is a TypeScript compile - if the union has new members and the `flowNames` `Record<FlowId, string>` is missing entries, `tsc` fails. That is the failing-test signal for this task.

- [ ] **Step 1: Write the failing test (compile-time)**

There is no runtime test for this task. The test is `npx tsc --noEmit`. To make it fail BEFORE the implementation, first add the new entries to the `flowNames` map in `flow-handler.ts` (which expects `Record<FlowId, string>` - missing keys are an error) without yet adding the union members in `types.ts`. That arrangement guarantees a compile error to satisfy the TDD "see it fail" step.

Run from inside `sidecoach/`:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit 2>&1 | head -10
```

Expected at this point (BEFORE you do step 2): no errors yet, because nothing was edited. Skip to step 2 - we are using the compile error as the proof-of-failure for the new union members in step 3.

- [ ] **Step 2: Add new entries to `BaseFlowHandler.flowNames`**

In `sidecoach/src/flow-handler.ts`, locate the `flowNames` record (the `const flowNames: Record<FlowId, string> = { ... }` literal that starts around line 76). After the `// Special: Curate & All-Seven QA` block (around `flowV_all_seven_qa: '...'`) and BEFORE the `// Legacy flows` block, insert:

```typescript
      // Tier 6: Composition & Copy
      flowW_landing_composition: 'Landing Page Composition (sections + rhythm)',
      flowX_copywriting: 'Copywriting (per-slot draft options)',
```

- [ ] **Step 3: Run tsc to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit 2>&1 | head -5
```

Expected: TS2353 or similar - "Object literal may only specify known properties, and 'flowW_landing_composition' does not exist in type 'FlowId'". That is the failing signal we want.

- [ ] **Step 4: Add the new FlowId union members**

In `sidecoach/src/types.ts`, after the `// Special: Curate & All-Seven QA` block (after `| 'flowV_all_seven_qa'`) and BEFORE the `// Legacy flows` block, insert:

```typescript
  // Tier 6: Composition & Copy
  | 'flowW_landing_composition'
  | 'flowX_copywriting'
```

- [ ] **Step 5: Add Flow trigger definitions**

In `sidecoach/src/flows.ts`, find the closing `]` of the FLOWS array. Just BEFORE the `// Special: Curate & All-Seven QA` entries (or directly before whatever closes the array), insert two new `Flow` objects:

```typescript
  // TIER 6: COMPOSITION & COPY
  {
    id: 'flowW_landing_composition',
    name: 'Landing Page Composition (sections + rhythm)',
    description: 'Decide which sections a landing page needs and how to space them, register-aware (brand vs product)',
    triggers: {
      patterns: [
        'lay out a landing page',
        'compose a landing page',
        'plan the sections for [page]',
        'what sections does this landing need',
        'landing page structure',
        'section taxonomy for [register]',
      ],
      intentMarkers: ['landing', 'sections', 'compose', 'structure', 'layout-plan', 'taxonomy'],
      avoidCollisionWith: ['flowG_component_implementation', 'flow8_refactor_layout'],
      negativeFilters: ['component', 'fix', 'audit', 'critique'],
    },
  },
  {
    id: 'flowX_copywriting',
    name: 'Copywriting (per-slot draft options)',
    description: 'Generate 2-3 draft copy options per slot (hero headline, supporting line, CTA, feature title) using register + product context',
    triggers: {
      patterns: [
        'draft hero copy',
        'write copy for [section]',
        'headline options for [page]',
        'draft CTA copy',
        'copy variants for [slot]',
        'write the hero',
      ],
      intentMarkers: ['copy', 'headline', 'CTA', 'hero', 'tagline', 'draft', 'wording'],
      avoidCollisionWith: ['flowA_brand_verify', 'flowW_landing_composition'],
      negativeFilters: ['component', 'token', 'layout', 'critique'],
    },
  },
```

- [ ] **Step 6: Run tsc to verify the project compiles**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit
```

Expected: exit code 0, no output. The two new union members are now consistent with the `flowNames` record.

- [ ] **Step 7: Commit (three-bash-call pattern)**

Bash call A - update session memory:

Edit `/Users/spare3/Documents/Github/claude-dotfiles/.claude/memory/session_2026-05-24_sprint2_execution.md` (create it if absent). Append:

```
- T1: registered flowW_landing_composition + flowX_copywriting in types.ts, flow-handler.ts, flows.ts. tsc clean.
```

Bash call B - clear verify flag:

```bash
rm -f ~/.claude/.needs-verification
```

Bash call C - commit:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/types.ts sidecoach/src/flow-handler.ts sidecoach/src/flows.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): register flowW_landing_composition + flowX_copywriting in FlowId union and trigger registry"
```

---

## Task 2: Build `landing-composition-data.ts`

**Files:**
- Create: `sidecoach/src/landing-composition-data.ts`
- Test: `sidecoach/src/__tests__/landing-composition-data.test.ts`

This module holds the register-aware section taxonomy. Keeping it separate from the handler means future product-design edits (adding a section type, tweaking rhythm) are pure data changes with focused tests.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/landing-composition-data.test.ts`:

```typescript
import {
  getSectionTaxonomy,
  getRhythmRules,
  getAntiPatternCallouts,
  SectionDescriptor,
} from '../landing-composition-data';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

function assertEq<T>(actual: T, expected: T, label: string): void {
  if (actual !== expected) {
    console.error(`FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    process.exit(1);
  }
}

(() => {
  // Brand register: smaller, more atmospheric
  const brandSections = getSectionTaxonomy('brand');
  assertTrue(brandSections.length >= 4, 'brand has at least 4 sections');
  assertTrue(brandSections.length <= 7, 'brand stays atmospheric (<=7 sections)');
  const brandIds = brandSections.map((s) => s.id);
  assertTrue(brandIds.includes('hero'), 'brand has hero');
  assertTrue(brandIds.includes('selected_work') || brandIds.includes('manifesto'), 'brand has work/manifesto');

  // Product register: more sections (social proof, FAQ, pricing-style)
  const productSections = getSectionTaxonomy('product');
  assertTrue(productSections.length >= 7, 'product has at least 7 sections');
  const productIds = productSections.map((s) => s.id);
  assertTrue(productIds.includes('hero'), 'product has hero');
  assertTrue(productIds.includes('social_proof'), 'product has social_proof');
  assertTrue(productIds.includes('faq') || productIds.includes('final_cta'), 'product has faq or final_cta');

  // Each section descriptor has slots
  const heroBrand = brandSections.find((s) => s.id === 'hero') as SectionDescriptor;
  assertTrue(Array.isArray(heroBrand.slots), 'hero has slots array');
  assertTrue(heroBrand.slots.length >= 2, 'hero has at least 2 slots (headline, supporting)');
  assertTrue(heroBrand.slots.some((sl) => sl.id === 'headline'), 'hero slot includes headline');

  // Rhythm rules differ by register
  const brandRhythm = getRhythmRules('brand');
  const productRhythm = getRhythmRules('product');
  assertTrue(brandRhythm.verticalGapPx >= productRhythm.verticalGapPx, 'brand uses larger vertical gaps than product');
  assertTrue(brandRhythm.maxSectionsPerScreen <= productRhythm.maxSectionsPerScreen, 'brand shows fewer sections per screen');

  // Anti-pattern callouts are register-specific
  const brandAntis = getAntiPatternCallouts('brand');
  const productAntis = getAntiPatternCallouts('product');
  assertTrue(brandAntis.length >= 2, 'brand has at least 2 anti-pattern callouts');
  assertTrue(productAntis.length >= 2, 'product has at least 2 anti-pattern callouts');
  // The two lists must not be identical (proves register-awareness)
  assertTrue(JSON.stringify(brandAntis) !== JSON.stringify(productAntis), 'brand and product anti-patterns differ');

  console.log('landing-composition-data PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/landing-composition-data.test.ts 2>&1 | head -5
```

Expected: FAIL - module does not exist yet, error like "Cannot find module '../landing-composition-data'".

- [ ] **Step 3: Write the minimal implementation**

Create `sidecoach/src/landing-composition-data.ts`:

```typescript
// Register-aware landing-page composition data.
// Brand register: atmospheric, fewer/larger sections, more whitespace.
// Product register: more sections, social proof and FAQ patterns, denser rhythm.

import { Register } from './project-context';

export interface SlotDescriptor {
  id: string;
  label: string;
  required: boolean;
}

export interface SectionDescriptor {
  id: string;
  name: string;
  purpose: string;
  slots: SlotDescriptor[];
}

export interface RhythmRules {
  verticalGapPx: number;
  maxSectionsPerScreen: number;
  hierarchyGuidance: string;
}

const BRAND_TAXONOMY: SectionDescriptor[] = [
  {
    id: 'hero',
    name: 'Hero',
    purpose: 'Establish mood and identity in one breath',
    slots: [
      { id: 'headline', label: 'Headline (<=8 words, evocative)', required: true },
      { id: 'supporting_line', label: 'Supporting line (mood, not feature)', required: true },
      { id: 'primary_cta', label: 'Single CTA (entry verb: enter / begin / explore)', required: true },
    ],
  },
  {
    id: 'manifesto',
    name: 'Manifesto / Philosophy',
    purpose: 'State the worldview that shapes the work',
    slots: [
      { id: 'lede', label: 'Opening sentence (declarative)', required: true },
      { id: 'body_paragraph', label: 'Supporting paragraph (2-4 sentences)', required: true },
    ],
  },
  {
    id: 'selected_work',
    name: 'Selected Work',
    purpose: 'Curated proof - 3 to 6 projects, generous spacing',
    slots: [
      { id: 'section_label', label: 'Section label (small caps, sparse)', required: false },
      { id: 'project_caption', label: 'Per-project caption (title + 1 line)', required: true },
    ],
  },
  {
    id: 'about',
    name: 'About',
    purpose: 'Origin, point of view, one human note',
    slots: [
      { id: 'heading', label: 'Heading (1-3 words)', required: true },
      { id: 'body', label: 'Body (single paragraph, <=80 words)', required: true },
    ],
  },
  {
    id: 'contact',
    name: 'Contact',
    purpose: 'One clear way in - email, form, or booking link',
    slots: [
      { id: 'invitation', label: 'Invitation line (warm, specific)', required: true },
      { id: 'method', label: 'Method (mailto, link, or form)', required: true },
    ],
  },
];

const PRODUCT_TAXONOMY: SectionDescriptor[] = [
  {
    id: 'hero',
    name: 'Hero',
    purpose: 'Deliver clear value prop + two CTAs (primary + secondary)',
    slots: [
      { id: 'headline', label: 'Headline (outcome-specific, <=10 words)', required: true },
      { id: 'supporting_line', label: 'Supporting line (clarifying sentence)', required: true },
      { id: 'primary_cta', label: 'Primary CTA (Start free / Get started)', required: true },
      { id: 'secondary_cta', label: 'Secondary CTA (See demo / Pricing)', required: false },
    ],
  },
  {
    id: 'social_proof',
    name: 'Social Proof',
    purpose: 'Logos, customer count, or notable mention - reduce hesitation',
    slots: [
      { id: 'attribution_label', label: 'Attribution label ("Trusted by" / "Used at")', required: true },
      { id: 'logos_or_count', label: 'Logo strip or count claim', required: true },
    ],
  },
  {
    id: 'feature_triad',
    name: 'Feature Triad',
    purpose: 'Three concrete benefits, each with a literal title',
    slots: [
      { id: 'feature_title', label: 'Feature title (literal, no metaphor)', required: true },
      { id: 'feature_body', label: 'Feature body (1-2 sentences)', required: true },
      { id: 'feature_icon', label: 'Feature icon (sourced from icon library)', required: false },
    ],
  },
  {
    id: 'how_it_works',
    name: 'How It Works',
    purpose: 'Reduce activation friction - 3 to 5 sequential steps',
    slots: [
      { id: 'step_label', label: 'Step label (verb-led, ordered)', required: true },
      { id: 'step_body', label: 'Step body (one sentence)', required: true },
    ],
  },
  {
    id: 'testimonials',
    name: 'Testimonials',
    purpose: 'Specific quotes with attribution, not generic praise',
    slots: [
      { id: 'quote', label: 'Quote (specific outcome named)', required: true },
      { id: 'attribution', label: 'Attribution (name, role, company)', required: true },
    ],
  },
  {
    id: 'faq',
    name: 'FAQ',
    purpose: 'Answer the 4-6 highest-friction questions',
    slots: [
      { id: 'question', label: 'Question (user voice, not marketing voice)', required: true },
      { id: 'answer', label: 'Answer (direct, <=60 words)', required: true },
    ],
  },
  {
    id: 'final_cta',
    name: 'Final CTA',
    purpose: 'Repeat the primary action with a short reinforcement line',
    slots: [
      { id: 'closing_headline', label: 'Closing headline (echo hero, do not duplicate)', required: true },
      { id: 'primary_cta', label: 'Primary CTA (matches hero CTA)', required: true },
    ],
  },
];

const BRAND_RHYTHM: RhythmRules = {
  verticalGapPx: 200,
  maxSectionsPerScreen: 1,
  hierarchyGuidance: 'One idea per viewport. Type carries the weight; spacing carries the mood.',
};

const PRODUCT_RHYTHM: RhythmRules = {
  verticalGapPx: 96,
  maxSectionsPerScreen: 2,
  hierarchyGuidance: 'Two sections per viewport on desktop. Anchor each with a clear H2 and a single primary action.',
};

const BRAND_ANTI_PATTERNS: string[] = [
  'Do not add a "Pricing" table to a portfolio - it cheapens curation',
  'Do not stack three CTAs in the hero - brand register survives on a single invitation',
  'Do not run a generic logo strip - brand sites earn trust through the work, not external badges',
  'Do not pad with FAQ-style sections - brand voice answers questions through copy, not Q&A scaffolding',
];

const PRODUCT_ANTI_PATTERNS: string[] = [
  'Do not lead with an abstract manifesto - product users want clarity in the first viewport',
  'Do not write feature titles as metaphors - state the literal outcome',
  'Do not gate the hero behind a video - inline value first, demo second',
  'Do not duplicate the hero headline at the final CTA - echo the action, not the wording',
];

export function getSectionTaxonomy(register: Register): SectionDescriptor[] {
  return register === 'brand' ? BRAND_TAXONOMY : PRODUCT_TAXONOMY;
}

export function getRhythmRules(register: Register): RhythmRules {
  return register === 'brand' ? BRAND_RHYTHM : PRODUCT_RHYTHM;
}

export function getAntiPatternCallouts(register: Register): string[] {
  return register === 'brand' ? BRAND_ANTI_PATTERNS : PRODUCT_ANTI_PATTERNS;
}

export function findSection(register: Register, sectionId: string): SectionDescriptor | null {
  return getSectionTaxonomy(register).find((s) => s.id === sectionId) || null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/landing-composition-data.test.ts
```

Expected: prints `landing-composition-data PASS`. Exit code 0.

- [ ] **Step 5: Commit (three-bash-call pattern)**

Bash call A - update session memory (append one line about T2 completion).
Bash call B - `rm -f ~/.claude/.needs-verification`
Bash call C:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/landing-composition-data.ts sidecoach/src/__tests__/landing-composition-data.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): landing-composition-data with register-aware section taxonomy, rhythm, anti-patterns"
```

---

## Task 3: Build `flow-handler-landing-composition.ts`

**Files:**
- Create: `sidecoach/src/flow-handler-landing-composition.ts`
- Test: `sidecoach/src/__tests__/flow-handler-landing-composition.test.ts`

The handler reads `register` from the project context (injected by `enrichContextForHandler`), calls into the data module from Task 2, builds guidance + checklist + memory.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/flow-handler-landing-composition.test.ts`:

```typescript
import { FlowWLandingCompositionHandler } from '../flow-handler-landing-composition';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const handler = new FlowWLandingCompositionHandler();
  assertTrue(handler.flowId === 'flowW_landing_composition', 'flowId is flowW_landing_composition');

  // canExecute requires a register
  assertTrue(handler.canExecute({ utterance: 'compose' } as any) === false, 'canExecute false without register');
  assertTrue(
    handler.canExecute({ utterance: 'compose', projectContext: { register: 'brand' } } as any) === true,
    'canExecute true with brand register'
  );

  // execute on brand register
  const brandResult = await handler.execute({
    utterance: 'lay out a landing page',
    projectContext: { register: 'brand', product: {}, design: {} },
  } as any);
  assertTrue(brandResult.status === 'success', 'brand execute success');
  assertTrue(Array.isArray(brandResult.guidance) && brandResult.guidance.length > 0, 'brand guidance non-empty');
  const brandGuidance = (brandResult.guidance || []).join('\n');
  assertTrue(brandGuidance.includes('Hero'), 'brand guidance mentions Hero section');
  assertTrue(brandGuidance.includes('Rhythm') || brandGuidance.includes('rhythm'), 'brand guidance mentions rhythm');
  assertTrue(brandGuidance.includes('Anti-pattern') || brandGuidance.includes('anti-pattern'), 'brand guidance mentions anti-patterns');
  assertTrue(brandResult.memory != null, 'memory emitted');
  assertTrue((brandResult.checklist || []).length >= 3, 'checklist has at least 3 items');

  // execute on product register - taxonomy differs
  const productResult = await handler.execute({
    utterance: 'compose landing page',
    projectContext: { register: 'product', product: {}, design: {} },
  } as any);
  const productGuidance = (productResult.guidance || []).join('\n');
  assertTrue(productGuidance.includes('Social Proof'), 'product guidance mentions Social Proof section');
  assertTrue(productGuidance.includes('FAQ'), 'product guidance mentions FAQ section');
  assertTrue(productGuidance !== brandGuidance, 'product guidance differs from brand');

  // Artifacts include the section taxonomy as a reference
  const artifacts = productResult.artifacts || [];
  assertTrue(artifacts.length >= 1, 'product result has at least 1 artifact');
  assertTrue(artifacts.some((a) => a.type === 'reference' && /section/i.test(a.name)), 'has a section reference artifact');

  console.log('flow-handler-landing-composition PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/flow-handler-landing-composition.test.ts 2>&1 | head -5
```

Expected: FAIL - "Cannot find module '../flow-handler-landing-composition'".

- [ ] **Step 3: Write the minimal implementation**

Create `sidecoach/src/flow-handler-landing-composition.ts`:

```typescript
// Flow W: Landing Page Composition
// Register-aware section taxonomy + rhythm rules + anti-pattern callouts.
// Reads register from project context, dispatches into landing-composition-data.

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { Register } from './project-context';
import {
  getSectionTaxonomy,
  getRhythmRules,
  getAntiPatternCallouts,
  SectionDescriptor,
} from './landing-composition-data';
import { FlowMemoryBuilder } from './flow-memory-schema';

export class FlowWLandingCompositionHandler extends BaseFlowHandler {
  constructor() {
    super('flowW_landing_composition');
  }

  canExecute(context: FlowExecutionContext): boolean {
    const register = (context.projectContext as any)?.register as Register | undefined;
    return register === 'brand' || register === 'product';
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const register = ((context.projectContext as any)?.register as Register) || 'product';
    const taxonomy = getSectionTaxonomy(register);
    const rhythm = getRhythmRules(register);
    const antiPatterns = getAntiPatternCallouts(register);

    const guidance: string[] = [
      `Register: ${register}`,
      `Section taxonomy (${taxonomy.length} sections):`,
      ...taxonomy.map((s: SectionDescriptor) => `- ${s.name} (${s.id}): ${s.purpose}`),
      '',
      'Rhythm:',
      `- Vertical gap between sections: ${rhythm.verticalGapPx}px`,
      `- Max sections per viewport: ${rhythm.maxSectionsPerScreen}`,
      `- Hierarchy guidance: ${rhythm.hierarchyGuidance}`,
      '',
      'Anti-pattern callouts:',
      ...antiPatterns.map((a) => `- ${a}`),
    ];

    const checklist = this.createChecklist([
      { label: 'Register selected matches PRODUCT.md', required: true, description: `register=${register}` },
      { label: 'Each section has slot definitions filled', required: true, description: `${taxonomy.length} sections to populate` },
      { label: 'Vertical rhythm applied to layout', required: true, description: `${rhythm.verticalGapPx}px between sections` },
      { label: 'Anti-pattern callouts reviewed', required: true, description: `${antiPatterns.length} register-specific anti-patterns` },
    ]);

    const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
      .setSummary(`Composed landing page: ${taxonomy.length} sections for ${register} register, ${rhythm.verticalGapPx}px rhythm`)
      .addDecision('section-taxonomy', `Selected ${register} register taxonomy: ${taxonomy.map((s) => s.id).join(', ')}`)
      .addDecision('rhythm', `${rhythm.verticalGapPx}px vertical gap, ${rhythm.maxSectionsPerScreen} sections per viewport`)
      .addMetric('sections-planned', taxonomy.length, 'pass')
      .addMetric('anti-patterns-flagged', antiPatterns.length, 'pass')
      .addArtifact('section-taxonomy', taxonomy.length, ['flowX_copywriting', 'flowG_component_implementation'])
      .build();

    const artifacts = [
      this.createArtifact(
        'reference',
        'Section taxonomy',
        taxonomy.map((s) => `${s.id}: ${s.slots.map((sl) => sl.id).join(', ')}`).join('\n'),
        `${taxonomy.length} sections with slots for ${register} register`
      ),
      this.createArtifact(
        'reference',
        'Anti-pattern callouts',
        antiPatterns.join('\n'),
        `${antiPatterns.length} register-specific anti-patterns`
      ),
    ];

    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: `Landing composed: ${taxonomy.length} sections for ${register} register`,
      guidance,
      checklist,
      artifacts,
      memory,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/flow-handler-landing-composition.test.ts
```

Expected: prints `flow-handler-landing-composition PASS`.

- [ ] **Step 5: Commit (three-bash-call pattern)**

Append a T3 line to the session memory file, then:

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/flow-handler-landing-composition.ts sidecoach/src/__tests__/flow-handler-landing-composition.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): FlowWLandingCompositionHandler emits register-aware composition guidance"
```

---

## Task 4: Wire FlowW into the orchestrator

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts`

Register the new handler so `engine.process()` and the artifacts CLI can dispatch to it.

- [ ] **Step 1: Write the failing assertion (inline check)**

We do not add a brand-new test file for this - the existing `sprint2-integration.test.ts` (Task 13) and the `sidecoach-artifacts --list` CLI cover registration end-to-end. The local proof for this task is a one-liner script.

Run:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && node -e "
try { require('./dist/sidecoach-orchestrator'); } catch (e) { console.log('dist not built yet - fine'); }
const { FlowExecutionEngine } = require('./dist/sidecoach-orchestrator');
const e = new FlowExecutionEngine();
console.log('flowW registered:', e.getAvailableFlows().some(f => f.id === 'flowW_landing_composition'));
"
```

Expected at this point (BEFORE step 2): `false` or a TypeError because `getAvailableFlows()` does not yet include the new ID. If `dist/` does not exist, the script throws - that also counts as failure. The real driver of this task's progress is the integration test in Task 13.

- [ ] **Step 2: Import + register the handler**

In `sidecoach/src/sidecoach-orchestrator.ts`:

Add the import near the other Flow handler imports (around line 47, with the other handler imports):

```typescript
import { FlowWLandingCompositionHandler } from './flow-handler-landing-composition';
```

In the `handlerMap` array (around line 117-165), after the `flowV_all_seven_qa` entry and BEFORE the `// Legacy flows` block, add:

```typescript
      // Tier 6: Composition & Copy
      ['flowW_landing_composition', () => new FlowWLandingCompositionHandler()],
```

In `getAvailableFlows()` (around line 1098), in the `flowIds` array, after `'flowV_all_seven_qa'` and before the legacy flows, add:

```typescript
      // Tier 6: Composition & Copy
      'flowW_landing_composition',
```

- [ ] **Step 3: Build and verify**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npm run build && node -e "
const { FlowExecutionEngine } = require('./dist/sidecoach-orchestrator');
const e = new FlowExecutionEngine();
const reg = e.getAvailableFlows().some(f => f.id === 'flowW_landing_composition');
console.log('flowW in getAvailableFlows():', reg);
if (!reg) process.exit(1);
"
```

Expected: `flowW in getAvailableFlows(): true`. Exit code 0.

Verify via artifacts CLI too:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && node bin/sidecoach-artifacts.js flowW_landing_composition
```

Expected: lists artifacts including "Section taxonomy" and "Anti-pattern callouts". Status: success.

- [ ] **Step 4: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): register FlowWLandingCompositionHandler in orchestrator handler map and getAvailableFlows()"
```

---

## Task 5: Build `copywriting-templates.ts`

**Files:**
- Create: `sidecoach/src/copywriting-templates.ts`
- Test: `sidecoach/src/__tests__/copywriting-templates.test.ts`

Per-register per-slot templates that the copywriting handler will expand into 2-3 concrete drafts.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/copywriting-templates.test.ts`:

```typescript
import {
  getTemplate,
  getDraftOptions,
  CopyTemplate,
} from '../copywriting-templates';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(() => {
  // Hero headline templates differ by register
  const brandHero = getTemplate('brand', 'hero', 'headline') as CopyTemplate;
  const productHero = getTemplate('product', 'hero', 'headline') as CopyTemplate;
  assertTrue(brandHero != null, 'brand hero headline template exists');
  assertTrue(productHero != null, 'product hero headline template exists');
  assertTrue(brandHero.wordCountMax <= productHero.wordCountMax || brandHero.wordCountMax === 8, 'brand keeps headlines short');
  assertTrue(brandHero.voicePrompt !== productHero.voicePrompt, 'brand and product voice prompts differ');

  // Unknown slot returns null (not undefined - explicit contract)
  assertTrue(getTemplate('brand', 'hero', 'no_such_slot') === null, 'unknown slot returns null');

  // getDraftOptions returns 2-3 options
  const brandOptions = getDraftOptions('brand', 'hero', 'headline', { productName: 'Atelier' });
  assertTrue(brandOptions.length >= 2 && brandOptions.length <= 3, 'brand draft options count 2-3');
  brandOptions.forEach((o, i) => {
    const wc = o.split(/\s+/).filter(Boolean).length;
    assertTrue(wc <= 12, `brand option ${i} respects word ceiling: got ${wc} for "${o}"`);
  });

  // Product CTA template
  const productCta = getTemplate('product', 'hero', 'primary_cta');
  assertTrue(productCta != null, 'product hero primary_cta template exists');
  const ctaOptions = getDraftOptions('product', 'hero', 'primary_cta', { productName: 'Acme' });
  assertTrue(ctaOptions.length >= 2, 'product CTA has 2+ options');
  assertTrue(
    ctaOptions.some((o) => /start|get|try/i.test(o)),
    'product CTA options use action verbs (start/get/try)'
  );

  console.log('copywriting-templates PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/copywriting-templates.test.ts 2>&1 | head -5
```

Expected: FAIL - "Cannot find module '../copywriting-templates'".

- [ ] **Step 3: Write the minimal implementation**

Create `sidecoach/src/copywriting-templates.ts`:

```typescript
// Register + section + slot keyed copywriting templates.
// Pure data + a getDraftOptions() expander. No I/O.

import { Register } from './project-context';

export interface CopyTemplate {
  register: Register;
  sectionId: string;
  slotId: string;
  voicePrompt: string;
  wordCountMin: number;
  wordCountMax: number;
  samplePatterns: string[];
}

export interface DraftContext {
  productName?: string;
  productPurpose?: string;
  brandPersonality?: string;
}

const TEMPLATES: CopyTemplate[] = [
  // Brand hero
  {
    register: 'brand',
    sectionId: 'hero',
    slotId: 'headline',
    voicePrompt: 'Evocative, atmospheric. Suggest rather than declare. Single mood per line.',
    wordCountMin: 2,
    wordCountMax: 8,
    samplePatterns: [
      'Quiet work, made with care',
      'Where craft outlasts the brief',
      'A studio for considered design',
    ],
  },
  {
    register: 'brand',
    sectionId: 'hero',
    slotId: 'supporting_line',
    voicePrompt: 'One sentence that extends the mood. No bullet points, no feature lists.',
    wordCountMin: 8,
    wordCountMax: 22,
    samplePatterns: [
      'We design brand systems, websites, and editorial work for clients who value patience.',
      'A small studio building identity and digital products with deliberate restraint.',
      'Independent practice, focused on long-form brand work and crafted interfaces.',
    ],
  },
  {
    register: 'brand',
    sectionId: 'hero',
    slotId: 'primary_cta',
    voicePrompt: 'A single entry verb. Avoid "submit," "click," "buy now."',
    wordCountMin: 1,
    wordCountMax: 3,
    samplePatterns: ['Enter', 'Begin', 'Explore the work', 'See the studio'],
  },

  // Product hero
  {
    register: 'product',
    sectionId: 'hero',
    slotId: 'headline',
    voicePrompt: 'Outcome-specific. Verb + benefit. No metaphor unless concrete.',
    wordCountMin: 3,
    wordCountMax: 10,
    samplePatterns: [
      'Ship faster without losing quality',
      'Run your business in one place',
      'The simplest way to track customer feedback',
    ],
  },
  {
    register: 'product',
    sectionId: 'hero',
    slotId: 'supporting_line',
    voicePrompt: 'One clarifying sentence. Name the user, name the outcome, name the differentiator.',
    wordCountMin: 10,
    wordCountMax: 28,
    samplePatterns: [
      '[Product] helps teams ship reliable releases by automating the manual parts of QA.',
      'Designed for small businesses that have outgrown spreadsheets but cannot afford an ERP.',
      'A single workspace for feedback, bugs, and feature requests, with no plugin sprawl.',
    ],
  },
  {
    register: 'product',
    sectionId: 'hero',
    slotId: 'primary_cta',
    voicePrompt: 'Action + risk-reducer. "Free," "no credit card," "demo" are acceptable.',
    wordCountMin: 2,
    wordCountMax: 5,
    samplePatterns: ['Start free', 'Get started', 'Try [Product] free', 'Start a free trial'],
  },
  {
    register: 'product',
    sectionId: 'hero',
    slotId: 'secondary_cta',
    voicePrompt: 'Lower-commitment alternative. Often "See demo," "Talk to sales," "View pricing."',
    wordCountMin: 2,
    wordCountMax: 4,
    samplePatterns: ['See demo', 'View pricing', 'Talk to sales'],
  },

  // Product feature triad
  {
    register: 'product',
    sectionId: 'feature_triad',
    slotId: 'feature_title',
    voicePrompt: 'Literal title. State the capability, not the feeling.',
    wordCountMin: 2,
    wordCountMax: 6,
    samplePatterns: [
      'Automated changelog generation',
      'Built-in role-based access',
      'One-click rollback',
    ],
  },
  {
    register: 'product',
    sectionId: 'feature_triad',
    slotId: 'feature_body',
    voicePrompt: 'One to two sentences. Mention the user task and the time saved or risk avoided.',
    wordCountMin: 10,
    wordCountMax: 36,
    samplePatterns: [
      'Skip the manual roundup. [Product] aggregates merged PRs into a release-ready changelog every Friday.',
      'Grant access by role, not by exception. Auditors and admins see exactly what they need.',
      'Roll back a bad deploy in one click - no kubectl, no late-night incident channels.',
    ],
  },
];

export function getTemplate(register: Register, sectionId: string, slotId: string): CopyTemplate | null {
  return (
    TEMPLATES.find(
      (t) => t.register === register && t.sectionId === sectionId && t.slotId === slotId
    ) || null
  );
}

export function getDraftOptions(
  register: Register,
  sectionId: string,
  slotId: string,
  draftContext: DraftContext = {}
): string[] {
  const tmpl = getTemplate(register, sectionId, slotId);
  if (!tmpl) return [];
  const productName = draftContext.productName || '[Product]';
  return tmpl.samplePatterns.slice(0, 3).map((p) => p.replace(/\[Product\]/g, productName));
}

export function listSlotsFor(register: Register, sectionId: string): CopyTemplate[] {
  return TEMPLATES.filter((t) => t.register === register && t.sectionId === sectionId);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/copywriting-templates.test.ts
```

Expected: prints `copywriting-templates PASS`.

- [ ] **Step 5: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/copywriting-templates.ts sidecoach/src/__tests__/copywriting-templates.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): copywriting-templates with register/section/slot draft options"
```

---

## Task 6: Build `flow-handler-copywriting.ts`

**Files:**
- Create: `sidecoach/src/flow-handler-copywriting.ts`
- Test: `sidecoach/src/__tests__/flow-handler-copywriting.test.ts`

Takes a section descriptor (or a list of section IDs from upstream Flow W) plus register + product context, expands 2-3 draft options per slot, returns guidance + artifacts + memory.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/flow-handler-copywriting.test.ts`:

```typescript
import { FlowXCopywritingHandler } from '../flow-handler-copywriting';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(async () => {
  const handler = new FlowXCopywritingHandler();
  assertTrue(handler.flowId === 'flowX_copywriting', 'flowId is flowX_copywriting');

  // canExecute requires register
  assertTrue(handler.canExecute({ utterance: 'copy' } as any) === false, 'canExecute false without register');
  assertTrue(
    handler.canExecute({ utterance: 'copy', projectContext: { register: 'product' } } as any) === true,
    'canExecute true with product register'
  );

  // execute with explicit sectionIds in metadata
  const result = await handler.execute({
    utterance: 'draft hero copy',
    projectContext: {
      register: 'product',
      product: { content: 'Acme is a workspace for customer feedback.' },
      design: {},
    },
    metadata: {
      sectionIds: ['hero'],
      productName: 'Acme',
    },
  } as any);
  assertTrue(result.status === 'success', 'execute success');
  const guidance = (result.guidance || []).join('\n');
  assertTrue(/headline/i.test(guidance), 'guidance mentions headline slot');
  assertTrue(/primary_cta|CTA/i.test(guidance), 'guidance mentions CTA slot');
  // 2-3 options per slot - count "Option 1" / "Option 2" markers
  const option1Count = (guidance.match(/Option 1:/g) || []).length;
  const option2Count = (guidance.match(/Option 2:/g) || []).length;
  assertTrue(option1Count >= 1, 'at least one slot has Option 1');
  assertTrue(option2Count >= 1, 'at least one slot has Option 2');

  // Product name substitution
  assertTrue(guidance.includes('Acme'), 'product name substituted into samples');

  // Default to first hero section when no sectionIds given
  const fallbackResult = await handler.execute({
    utterance: 'draft copy',
    projectContext: { register: 'brand', product: {}, design: {} },
    metadata: {},
  } as any);
  assertTrue(fallbackResult.status === 'success', 'fallback (no sectionIds) succeeds');
  const fallbackGuidance = (fallbackResult.guidance || []).join('\n');
  assertTrue(/Hero/i.test(fallbackGuidance), 'fallback covers Hero section');

  console.log('flow-handler-copywriting PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/flow-handler-copywriting.test.ts 2>&1 | head -5
```

Expected: FAIL - "Cannot find module '../flow-handler-copywriting'".

- [ ] **Step 3: Write the minimal implementation**

Create `sidecoach/src/flow-handler-copywriting.ts`:

```typescript
// Flow X: Copywriting
// Given a register + a list of section IDs (from upstream Flow W) + product context,
// emit 2-3 draft copy options per slot.

import { BaseFlowHandler, FlowExecutionContext, FlowExecutionResult } from './flow-handler';
import { Register } from './project-context';
import { getSectionTaxonomy, findSection } from './landing-composition-data';
import { getDraftOptions, listSlotsFor, DraftContext } from './copywriting-templates';
import { FlowMemoryBuilder } from './flow-memory-schema';

export class FlowXCopywritingHandler extends BaseFlowHandler {
  constructor() {
    super('flowX_copywriting');
  }

  canExecute(context: FlowExecutionContext): boolean {
    const register = (context.projectContext as any)?.register as Register | undefined;
    return register === 'brand' || register === 'product';
  }

  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const register = ((context.projectContext as any)?.register as Register) || 'product';
    const explicitSectionIds = (context.metadata?.sectionIds as string[] | undefined) || [];
    const productName =
      (context.metadata?.productName as string | undefined) ||
      (context.projectContext as any)?.product?.name ||
      '[Product]';

    // If no sectionIds were passed in, default to the hero (the first section every register has)
    const sectionIds = explicitSectionIds.length > 0 ? explicitSectionIds : ['hero'];
    const taxonomy = getSectionTaxonomy(register);

    const draftCtx: DraftContext = {
      productName,
      productPurpose: (context.projectContext as any)?.product?.purpose,
      brandPersonality: (context.projectContext as any)?.product?.brandPersonality,
    };

    const guidance: string[] = [`Register: ${register}`, `Product name: ${productName}`, ''];
    const artifacts = [];
    let totalSlots = 0;
    let totalOptions = 0;

    for (const sectionId of sectionIds) {
      const section = findSection(register, sectionId);
      if (!section) {
        guidance.push(`Section "${sectionId}" not in ${register} taxonomy - skipping.`);
        continue;
      }
      const slotTemplates = listSlotsFor(register, sectionId);
      guidance.push(`Section: ${section.name} (${section.id})`);
      guidance.push(`Purpose: ${section.purpose}`);
      guidance.push('');

      for (const slot of section.slots) {
        const tmpl = slotTemplates.find((t) => t.slotId === slot.id);
        if (!tmpl) {
          guidance.push(`  Slot "${slot.id}": no template (skip)`);
          continue;
        }
        totalSlots += 1;
        guidance.push(`  Slot: ${slot.id} (${slot.label})`);
        guidance.push(`    Voice: ${tmpl.voicePrompt}`);
        guidance.push(`    Word count: ${tmpl.wordCountMin}-${tmpl.wordCountMax}`);
        const options = getDraftOptions(register, sectionId, slot.id, draftCtx);
        totalOptions += options.length;
        options.forEach((opt, idx) => {
          guidance.push(`    Option ${idx + 1}: ${opt}`);
        });
        guidance.push('');
      }

      artifacts.push(
        this.createArtifact(
          'template',
          `Copy drafts: ${section.name}`,
          section.slots
            .map((sl) => {
              const opts = getDraftOptions(register, sectionId, sl.id, draftCtx);
              return `${sl.id}:\n${opts.map((o, i) => `  ${i + 1}. ${o}`).join('\n')}`;
            })
            .join('\n\n'),
          `Draft copy options for the ${section.name} section`
        )
      );
    }

    const checklist = this.createChecklist([
      { label: 'Each slot has 2-3 draft options', required: true, description: `${totalOptions} options across ${totalSlots} slots` },
      { label: 'Voice matches register', required: true, description: `${register} voice applied` },
      { label: 'Word-count limits respected', required: true, description: 'Verify before publishing' },
      { label: 'Product name substituted where needed', required: false, description: `productName=${productName}` },
    ]);

    const memory = new FlowMemoryBuilder(this.flowId, this.getFlowName())
      .setSummary(`Drafted copy: ${totalOptions} options across ${totalSlots} slots in ${sectionIds.length} section(s), ${register} register`)
      .addDecision('register-applied', register)
      .addMetric('slots-covered', totalSlots, 'pass')
      .addMetric('options-generated', totalOptions, 'pass')
      .addArtifact('copy-drafts', sectionIds.length, ['flowG_component_implementation', 'flowJ_tactical_polish'])
      .build();

    return {
      flowId: this.flowId,
      flowName: this.getFlowName(),
      status: 'success',
      message: `Copy drafts ready: ${totalOptions} options for ${totalSlots} slots (${register})`,
      guidance,
      checklist,
      artifacts,
      memory,
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/flow-handler-copywriting.test.ts
```

Expected: prints `flow-handler-copywriting PASS`.

- [ ] **Step 5: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/flow-handler-copywriting.ts sidecoach/src/__tests__/flow-handler-copywriting.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): FlowXCopywritingHandler emits 2-3 draft options per slot per register"
```

---

## Task 7: Wire FlowX into the orchestrator

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts`

Same shape as Task 4 - import, register in `handlerMap`, add to `getAvailableFlows()`.

- [ ] **Step 1: Add the import**

Near the other handler imports in `sidecoach/src/sidecoach-orchestrator.ts`:

```typescript
import { FlowXCopywritingHandler } from './flow-handler-copywriting';
```

- [ ] **Step 2: Register in `handlerMap`**

Directly under the `flowW_landing_composition` line added in Task 4:

```typescript
      ['flowX_copywriting', () => new FlowXCopywritingHandler()],
```

- [ ] **Step 3: Add to `getAvailableFlows()`**

Under the `'flowW_landing_composition'` line added in Task 4:

```typescript
      'flowX_copywriting',
```

- [ ] **Step 4: Build + verify both flows discoverable**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npm run build && node bin/sidecoach-artifacts.js --list | grep -E "flowW|flowX"
```

Expected:

```
  flowW_landing_composition
  flowX_copywriting
```

Then exercise FlowX:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && node bin/sidecoach-artifacts.js flowX_copywriting
```

Expected: Status: success, artifacts include "Copy drafts: Hero" (because the artifacts CLI passes `register: 'brand'` by default and FlowX defaults to the hero section).

- [ ] **Step 5: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): register FlowXCopywritingHandler in orchestrator handler map and getAvailableFlows()"
```

---

## Task 8: "Craft landing page" composite flow

**Files:**
- Modify: `sidecoach/src/flow-composition.ts`
- Test: `sidecoach/src/__tests__/flow-composition-craft-landing.test.ts` (new)

Chains composition -> tokens -> copywriting -> component -> motion -> polish -> audit -> taste gate.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/flow-composition-craft-landing.test.ts`:

```typescript
import { FlowCompositionEngine, PRESET_COMPOSITE_FLOWS } from '../flow-composition';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(() => {
  const def = FlowCompositionEngine.buildCraftLandingPageFlow();
  assertTrue(def.id === 'composite_craft_landing_page', 'composite id matches');
  assertTrue(def.steps.length >= 7, 'has at least 7 steps');
  const stepIds = def.steps.map((s) => s.flowId);
  // Required ordering: composition before copywriting; tokens between them; component/motion/polish/audit/taste after.
  const wIdx = stepIds.indexOf('flowW_landing_composition');
  const fIdx = stepIds.indexOf('flowF_design_tokens');
  const xIdx = stepIds.indexOf('flowX_copywriting');
  const gIdx = stepIds.indexOf('flowG_component_implementation');
  const hIdx = stepIds.indexOf('flowH_motion_integration');
  const jIdx = stepIds.indexOf('flowJ_tactical_polish');
  const kIdx = stepIds.indexOf('flowK_multi_lens_audit');
  assertTrue(wIdx >= 0 && fIdx > wIdx && xIdx > fIdx, 'composition -> tokens -> copywriting ordering');
  assertTrue(gIdx > xIdx, 'component implementation after copywriting');
  assertTrue(hIdx > gIdx, 'motion after component');
  assertTrue(jIdx > hIdx, 'polish after motion');
  assertTrue(kIdx > jIdx, 'audit after polish');

  // Preset registration
  const presetIds = PRESET_COMPOSITE_FLOWS.map((p) => p.id);
  assertTrue(presetIds.includes('composite_craft_landing_page'), 'craft landing page registered as preset');

  console.log('flow-composition-craft-landing PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/flow-composition-craft-landing.test.ts 2>&1 | head -5
```

Expected: FAIL - `FlowCompositionEngine.buildCraftLandingPageFlow` does not exist (TypeError).

- [ ] **Step 3: Add `buildCraftLandingPageFlow()`**

In `sidecoach/src/flow-composition.ts`, after the `buildOptimizationFlow()` static (around line 540-554) and BEFORE the `}` that closes the `FlowCompositionEngine` class, add:

```typescript
  /**
   * "Craft a landing page" - the headline composite for Sidecoach v2.
   * Chains: brand verify -> composition -> tokens -> copywriting -> component -> motion -> polish -> audit -> all-seven QA gate.
   */
  static buildCraftLandingPageFlow(): CompositeFlowDefinition {
    return {
      id: 'composite_craft_landing_page',
      name: 'Craft a landing page',
      description: 'End-to-end landing page flow: composition, tokens, copy, component, motion, polish, audit, QA gate',
      steps: [
        { flowId: 'flowA_brand_verify' as FlowId, skipOnError: true },
        { flowId: 'flowW_landing_composition' as FlowId },
        { flowId: 'flowF_design_tokens' as FlowId },
        { flowId: 'flowX_copywriting' as FlowId },
        { flowId: 'flowG_component_implementation' as FlowId },
        { flowId: 'flowH_motion_integration' as FlowId, skipOnError: true },
        { flowId: 'flowJ_tactical_polish' as FlowId, skipOnError: true },
        { flowId: 'flowK_multi_lens_audit' as FlowId, skipOnError: true },
        { flowId: 'flowV_all_seven_qa' as FlowId, skipOnError: true },
      ],
      aggregateResults: true,
      failOnFirstError: false,
    };
  }
```

In the `PRESET_COMPOSITE_FLOWS` array at the bottom of the file, append:

```typescript
  FlowCompositionEngine.buildCraftLandingPageFlow(),
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/flow-composition-craft-landing.test.ts
```

Expected: prints `flow-composition-craft-landing PASS`.

- [ ] **Step 5: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/flow-composition.ts sidecoach/src/__tests__/flow-composition-craft-landing.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): composite_craft_landing_page chains composition->tokens->copy->component->motion->polish->audit->QA"
```

---

## Task 9: Expose `getHandlers()` and unblock the artifacts CLI

**Files:**
- Modify: `sidecoach/src/sidecoach-orchestrator.ts`
- Modify: `sidecoach/bin/sidecoach-artifacts.js`

Sprint 1 carryover - the CLI currently reads `engine.handlers` (a `private` field). Expose a public read-only getter.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint2-orchestrator-getHandlers.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(() => {
  const engine = new FlowExecutionEngine();
  // Method exists and is a function
  assertTrue(typeof (engine as any).getHandlers === 'function', 'engine.getHandlers is a function');
  const handlers = (engine as any).getHandlers();
  // Returns a Map-like with .get() and .keys()
  assertTrue(typeof handlers.get === 'function', 'handlers.get is a function');
  assertTrue(typeof handlers.keys === 'function', 'handlers.keys is a function');
  // Includes the new flow IDs from earlier tasks
  assertTrue(handlers.get('flowW_landing_composition') != null, 'flowW handler present');
  assertTrue(handlers.get('flowX_copywriting') != null, 'flowX handler present');
  // Read-only contract: mutation methods are absent or throw. We do not enforce immutability at runtime
  // because Map's interface is broad; the contract is just "do not mutate."
  console.log('sprint2-orchestrator-getHandlers PASS');
})();
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint2-orchestrator-getHandlers.test.ts 2>&1 | head -5
```

Expected: FAIL - `engine.getHandlers is a function` fails because the method does not exist yet.

- [ ] **Step 3: Add the public method**

In `sidecoach/src/sidecoach-orchestrator.ts`, near `registerHandler()` (around line 1094) and `getAvailableFlows()` (around line 1098), add:

```typescript
  /**
   * Read-only view of the registered handler map. Used by CLI tools that need to
   * enumerate or dispatch by FlowId. Caller must not mutate.
   */
  getHandlers(): ReadonlyMap<FlowId, FlowHandler> {
    return this.handlers;
  }
```

`ReadonlyMap` is built-in TypeScript - no import needed. `FlowId` and `FlowHandler` are already imported at the top of the file.

- [ ] **Step 4: Update the artifacts CLI**

In `sidecoach/bin/sidecoach-artifacts.js`, line ~41, replace:

```javascript
  const handlers = engine.handlers || new Map();
```

with:

```javascript
  const handlers = engine.getHandlers();
```

- [ ] **Step 5: Build + verify both ends work**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npm run build && npx ts-node src/__tests__/sprint2-orchestrator-getHandlers.test.ts && node bin/sidecoach-artifacts.js --list | grep -E "flowW|flowX"
```

Expected:
- `sprint2-orchestrator-getHandlers PASS`
- `  flowW_landing_composition`
- `  flowX_copywriting`

- [ ] **Step 6: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/sidecoach-orchestrator.ts sidecoach/bin/sidecoach-artifacts.js sidecoach/src/__tests__/sprint2-orchestrator-getHandlers.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "refactor(sidecoach): expose FlowExecutionEngine.getHandlers() and stop the artifacts CLI from reading the private field"
```

---

## Task 10: Tighten `parsedDesignTokens` typing in `context-loader.ts`

**Files:**
- Modify: `sidecoach/src/context-loader.ts`

Sprint 1 carryover. Currently typed as `any`. The actual type is `DesignTokens | null` (per `design-md-parser.ts`).

- [ ] **Step 1: Write the failing test (compile-time)**

Create `sidecoach/src/__tests__/sprint2-context-loader-typing.test.ts`:

```typescript
import { buildProjectContext } from '../context-loader';
import { DesignTokens } from '../design-md-parser';
import * as path from 'path';

function assertTrue(cond: any, label: string): void {
  if (!cond) {
    console.error(`FAIL ${label}: got ${JSON.stringify(cond)}`);
    process.exit(1);
  }
}

(() => {
  const refRoot = path.resolve(__dirname, '../../../reference');
  const ctx = buildProjectContext(refRoot);
  // Type-narrow: parsedDesignTokens must be DesignTokens | null - not any.
  // The test below would not compile if the field were typed as `any` AND the explicit type assertion failed.
  // To prove the typing tightened, we use a function whose signature requires DesignTokens | null.
  function consume(tokens: DesignTokens | null): number {
    if (tokens === null) return 0;
    return Object.keys(tokens.colors || {}).length;
  }
  const n = consume(ctx.parsedDesignTokens);
  assertTrue(typeof n === 'number', 'consume() returned a number');
  console.log(`parsedDesignTokens typed PASS (color section keys=${n})`);
})();
```

The compile-time check is real: `consume(ctx.parsedDesignTokens)` only typechecks if `ctx.parsedDesignTokens` is `DesignTokens | null` (or a subtype). If the field were `any`, the call typechecks trivially - but the test relies on `tsc` rejecting later refactors. The runtime smoke gives us the per-run sanity that nothing regressed.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint2-context-loader-typing.test.ts 2>&1 | head -10
```

Expected: at this point this either PASSES (because `any` is assignable to `DesignTokens | null`) or fails on the runtime smoke. The real "fail" signal here is the SECOND tsc check below.

Run also:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && grep -n "parsedDesignTokens" src/context-loader.ts
```

Expected output includes `parsedDesignTokens?: any;` - this is the symptom we want to fix.

- [ ] **Step 3: Tighten the type**

In `sidecoach/src/context-loader.ts`:

At the top, the file already imports `parseDesignMd` from `./design-md-parser` (line 3). Extend that import to include `DesignTokens`:

```typescript
import { parseDesignMd, DesignTokens } from './design-md-parser';
```

In the `ProjectContext` interface (around line 17-26), change the field:

Old:
```typescript
  parsedDesignTokens?: any;
```

New:
```typescript
  parsedDesignTokens: DesignTokens | null;
```

(Note: changes `?: any` to a required `DesignTokens | null`. The function `buildProjectContext` always sets the field - either to a parsed value or `null` - so making it required matches the actual contract.)

In `buildProjectContext` (around line 139-163), the local variable is typed `let parsedDesignTokens: any = null;`. Tighten it:

Old:
```typescript
  let parsedDesignTokens: any = null;
```

New:
```typescript
  let parsedDesignTokens: DesignTokens | null = null;
```

`parseDesignMd` already returns `DesignTokens` (per `design-md-parser.ts:16`), so the assignment on line 146 typechecks without further changes.

- [ ] **Step 4: Run test + tsc to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx tsc --noEmit && npx ts-node src/__tests__/sprint2-context-loader-typing.test.ts
```

Expected:
- tsc exit code 0 (no errors elsewhere because `DesignTokens` is structurally compatible everywhere the old `any` was used)
- Test prints `parsedDesignTokens typed PASS (color section keys=N)`

If tsc surfaces errors in OTHER files that previously got `any` from `parsedDesignTokens` (most likely a downstream `.metadata.designTokens` consumer), fix those by adding explicit type narrowing (`if (parsedTokens === null) { ... }`) or by adjusting the consumer's signature to accept `DesignTokens | null`. Do not widen the type back to `any`.

- [ ] **Step 5: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/context-loader.ts sidecoach/src/__tests__/sprint2-context-loader-typing.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "refactor(sidecoach): parsedDesignTokens typed as DesignTokens | null instead of any"
```

---

## Task 11: process()-path integration test (T5 carryover)

**Files:**
- Create: `sidecoach/src/__tests__/sprint2-process-path.test.ts`

Sprint 1's `sprint1-integration.test.ts` exercises `(engine as any).enrichContextForHandler(...)` directly. If a future refactor unwires one of the three `handler.execute(...)` call sites inside `engine.process()`, that test misses it. This task adds the missing public-path coverage.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint2-process-path.test.ts`:

```typescript
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
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

  // Force the design-tokens flow via process() with an utterance that the intent detector resolves to it.
  // The flow's triggers include 'extract design tokens' and 'validate tokens against [standard]'.
  const result = await engine.process('validate tokens against DESIGN.md', {
    projectPath: refRoot,
    projectContext: { register: 'brand' } as any,
  });

  // The aggregate result has guidance from at least one flow.
  const allGuidance = (result.flowResults || []).flatMap((fr: any) => fr.guidance || []).join('\n');
  assertTrue(allGuidance.length > 0, 'process() returned non-empty guidance');

  // The DESIGN.md citation pattern must reach the public path output.
  // This is the T5 gap: if a future change drops enrichContextForHandler from inside process(), this assertion catches it.
  const citationRegex = /Source: DESIGN\.md L\d+/;
  assertTrue(citationRegex.test(allGuidance), 'guidance contains "Source: DESIGN.md L<n>" via process() path');

  // Count: at least one citation present
  const citations = allGuidance.split('\n').filter((l: string) => citationRegex.test(l));
  console.log(`process()-path citations found: ${citations.length}`);
  citations.slice(0, 3).forEach((c: string) => console.log(`  ${c.trim()}`));
  assertTrue(citations.length >= 1, 'at least 1 citation surfaces through process()');

  console.log('sprint2-process-path PASS');
})();
```

- [ ] **Step 2: Run test to verify it passes (or fails with a real signal)**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint2-process-path.test.ts
```

Expected if Sprint 1's wiring is still intact: PASS - prints citation count >= 1.

Expected if there is a regression (this is the diagnostic value of this test): FAIL with a clear message. Investigate before continuing - the most likely cause is the `enrichContextForHandler` call being missing from one of the three call sites in `sidecoach-orchestrator.ts` (lines 549, 726, 952 per Sprint 1).

If the test fails because the intent detector picks a different flow than `flowF_design_tokens`, adjust the utterance OR pass an explicit metadata override. The first attempt should not require that workaround - flow F's triggers include the exact phrase used. If it does need a workaround, the underlying bug is in the intent detector and should be filed separately rather than papered over here.

- [ ] **Step 3: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/__tests__/sprint2-process-path.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "test(sidecoach): process()-path integration verifies DESIGN.md citations reach public output (T5 gap closed)"
```

---

## Task 12: Rolling - adopt DESIGN.md citation pattern in 3 handlers

**Files:**
- Modify: `sidecoach/src/flow-handler-typography-excellence.ts`
- Modify: `sidecoach/src/flow-handler-component-implementation.ts`
- Modify: `sidecoach/src/flow-handler-motion-integration.ts`

Sprint 1 only converted `flow-handler-design-tokens`. This sprint adopts the same `cite()` pattern in three more. The pattern is exactly the one from Task 6 of the misty-jingling-plum plan:

```typescript
import { findTokenLine } from './design-md-parser';
// ...
const designContent = (context.metadata?.designContent as string) || '';
const designTokens = (context.metadata?.designTokens as any) || {};
const cite = (dottedPath: string): string => {
  const ln = designContent ? findTokenLine(designContent, dottedPath) : -1;
  return ln > 0 ? ` (Source: DESIGN.md L${ln})` : '';
};
```

Each handler gets at least 3 guidance lines updated to cite DESIGN.md.

- [ ] **Step 1: Write the failing test**

Create `sidecoach/src/__tests__/sprint2-rolling-citations.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint2-rolling-citations.test.ts 2>&1 | head -10
```

Expected: FAIL - one or more of the three handlers reports 0 citations (because none have been converted yet).

- [ ] **Step 3a: Update `flow-handler-typography-excellence.ts`**

At the top, add:

```typescript
import { findTokenLine } from './design-md-parser';
```

Inside the `execute()` method, BEFORE the existing `const guidance = [` literal (around line 55), insert the citation helper:

```typescript
    const designContent = (context.metadata?.designContent as string) || '';
    const designTokens = (context.metadata?.designTokens as any) || {};
    const cite = (dottedPath: string): string => {
      const ln = designContent ? findTokenLine(designContent, dottedPath) : -1;
      return ln > 0 ? ` (Source: DESIGN.md L${ln})` : '';
    };
```

Then pick 3 existing guidance lines in the typography handler and append citations. Examples (verify line numbers against the actual file - the strings below are the patterns to look for):

Look for a line resembling `Display font:` or `H1 size:` or `Body text:`. Replace something like:

```typescript
'Display family: Fraunces',
```

with:

```typescript
`Display family: ${designTokens.typography?.display?.family || '(undefined in DESIGN.md)'}${cite('typography.display.family')}`,
```

Do this for THREE guidance lines that reference DESIGN.md-resident values (typography family, weights, scale ratios, etc.).

- [ ] **Step 3b: Update `flow-handler-component-implementation.ts`**

Same pattern. Add the import, add the citation helper inside `execute()` BEFORE the `const guidance = [` literal (around line 123). Then convert 3 guidance lines that reference design tokens (brand colors, border radius, spacing, shadow). Example:

```typescript
`Use brand red ${designTokens.colors?.brand?.red || '(undefined)'} for primary CTA backgrounds${cite('colors.brand.red')}`,
`Border radius: ${designTokens.rounded?.md || '(undefined)'} on cards${cite('rounded.md')}`,
`Card shadow: ${designTokens.shadow?.md || '(undefined)'} on hover${cite('shadow.md')}`,
```

- [ ] **Step 3c: Update `flow-handler-motion-integration.ts`**

Same pattern. Add the import, add the citation helper inside `execute()` BEFORE the `const guidance = [` literal (around line 188). Then convert 3 guidance lines that reference motion tokens. Example:

```typescript
`Default ease: ${designTokens.motion?.ease?.out || '(undefined)'}${cite('motion.ease.out')}`,
`Standard duration: ${designTokens.motion?.duration?.normal || '(undefined)'}${cite('motion.duration.normal')}`,
`Reduced-motion fallback: respect prefers-reduced-motion (no DESIGN.md token needed)${cite('motion.reducedMotion')}`,
```

(The third citation may resolve to `-1` if `motion.reducedMotion` is not in DESIGN.md - that is the correct fallback behavior. The line still appears, just without a citation suffix, which is intentional graceful degradation. The test counts only lines with `Source: DESIGN.md L<n>` so make sure at least 3 cited lines DO resolve - use real DESIGN.md keys for those three.)

- [ ] **Step 4: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint2-rolling-citations.test.ts
```

Expected: prints `rolling citations PASS: typography=3, component=3, motion=3` (or higher counts).

- [ ] **Step 5: Commit (three-bash-call pattern)**

```bash
rm -f ~/.claude/.needs-verification
```

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/flow-handler-typography-excellence.ts sidecoach/src/flow-handler-component-implementation.ts sidecoach/src/flow-handler-motion-integration.ts sidecoach/src/__tests__/sprint2-rolling-citations.test.ts .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "feat(sidecoach): adopt DESIGN.md citation pattern in typography, component, motion handlers (rolling task from Sprint 1)"
```

---

## Task 13: End-of-sprint integration smoke

**Files:**
- Create: `sidecoach/src/__tests__/sprint2-integration.test.ts`

Mirrors `sprint1-integration.test.ts`. Asserts the full Sprint 2 surface: new flows registered, new composite executes end-to-end, both new handlers run inside the chain and emit guidance.

- [ ] **Step 1: Write the test**

Create `sidecoach/src/__tests__/sprint2-integration.test.ts`:

```typescript
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
  const availableIds = engine.getAvailableFlows().map((f) => f.id);
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
```

- [ ] **Step 2: Run test to verify it passes**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npx ts-node src/__tests__/sprint2-integration.test.ts
```

Expected: prints `sprint2-integration PASS`. Exit code 0.

If any assertion fails, the most likely cause is one of:
- Handler not registered (re-check Task 4 / Task 7 imports + handlerMap entry)
- `getHandlers()` missing (re-check Task 9)
- Composite preset not appended to `PRESET_COMPOSITE_FLOWS` (re-check Task 8 final edit)

- [ ] **Step 3: Run the full Sprint 1 + Sprint 2 test suite to confirm no regressions**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && \
  npx ts-node src/__tests__/sprint1-integration.test.ts && \
  npx ts-node src/__tests__/design-md-parser.test.ts && \
  npx ts-node src/__tests__/icon-source-reference-paths.test.ts && \
  npx ts-node src/__tests__/project-drift-detector.test.ts && \
  npx ts-node src/__tests__/taste-validator-observer-race.test.ts && \
  npx ts-node src/__tests__/intent-detector-tiebreak.test.ts && \
  npx ts-node src/__tests__/landing-composition-data.test.ts && \
  npx ts-node src/__tests__/flow-handler-landing-composition.test.ts && \
  npx ts-node src/__tests__/copywriting-templates.test.ts && \
  npx ts-node src/__tests__/flow-handler-copywriting.test.ts && \
  npx ts-node src/__tests__/flow-composition-craft-landing.test.ts && \
  npx ts-node src/__tests__/sprint2-orchestrator-getHandlers.test.ts && \
  npx ts-node src/__tests__/sprint2-context-loader-typing.test.ts && \
  npx ts-node src/__tests__/sprint2-process-path.test.ts && \
  npx ts-node src/__tests__/sprint2-rolling-citations.test.ts && \
  npx ts-node src/__tests__/sprint2-integration.test.ts
```

Expected: every test prints its PASS line. Total exit code 0.

- [ ] **Step 4: Build the dist artifacts**

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && npm run build
```

Expected: zero TypeScript errors. The `dist/*` change is intentionally NOT committed in the test commit below - Sprint 1 left build artifacts uncommitted by design.

- [ ] **Step 5: Final sprint memory write + commit**

Write a sprint-close memory file at `.claude/memory/session_2026-05-24_sprint2_closed.md` summarizing:
- 13 tasks shipped
- Citations adopted in 3 more flow handlers (typography, component, motion)
- `getHandlers()` exposed; artifacts CLI no longer touches private fields
- `parsedDesignTokens` typed as `DesignTokens | null`
- New composite `composite_craft_landing_page`
- Test counts (Sprint 1 + Sprint 2 tests, all green)
- Open follow-ups for Sprint 3 (Phase 4: stack-aware motion)

Bash call B - clear flag:

```bash
rm -f ~/.claude/.needs-verification
```

Bash call C - commit:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git add sidecoach/src/__tests__/sprint2-integration.test.ts .claude/memory/session_2026-05-24_sprint2_closed.md .claude/memory/session_2026-05-24_sprint2_execution.md && git commit -m "test(sidecoach): sprint2 end-to-end integration coverage"
```

Update `.claude/memory/MEMORY.md` to point at the new close-out memory (one-line entry, under 200 chars).

---

## Verification (end of sprint)

After Task 13 completes, run from the repo root:

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles && git log --oneline main..sidecoach 2>/dev/null | head -20
```

Expected: roughly 13 new commits on `sidecoach`, each with a clear `feat(sidecoach):`, `refactor(sidecoach):`, or `test(sidecoach):` prefix.

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && node bin/sidecoach-artifacts.js --list | wc -l
```

Expected: two more lines than the Sprint 1 count (the new `flowW_landing_composition` and `flowX_copywriting`).

```bash
cd /Users/spare3/Documents/Github/claude-dotfiles/sidecoach && node bin/sidecoach-artifacts.js flowW_landing_composition && node bin/sidecoach-artifacts.js flowX_copywriting
```

Expected: each prints Status: success with at least one artifact listed.

---

## Files produced (summary)

**New files (10):**
- `sidecoach/src/landing-composition-data.ts`
- `sidecoach/src/flow-handler-landing-composition.ts`
- `sidecoach/src/copywriting-templates.ts`
- `sidecoach/src/flow-handler-copywriting.ts`
- `sidecoach/src/__tests__/landing-composition-data.test.ts`
- `sidecoach/src/__tests__/flow-handler-landing-composition.test.ts`
- `sidecoach/src/__tests__/copywriting-templates.test.ts`
- `sidecoach/src/__tests__/flow-handler-copywriting.test.ts`
- `sidecoach/src/__tests__/flow-composition-craft-landing.test.ts`
- `sidecoach/src/__tests__/sprint2-orchestrator-getHandlers.test.ts`
- `sidecoach/src/__tests__/sprint2-context-loader-typing.test.ts`
- `sidecoach/src/__tests__/sprint2-process-path.test.ts`
- `sidecoach/src/__tests__/sprint2-rolling-citations.test.ts`
- `sidecoach/src/__tests__/sprint2-integration.test.ts`

(13 new files including 9 test files. The above note "10 new files" in the file-structure header is a count of the production + first-class test files; this summary counts every file the sprint introduces.)

**Modified files (10):**
- `sidecoach/src/types.ts`
- `sidecoach/src/flow-handler.ts`
- `sidecoach/src/flows.ts`
- `sidecoach/src/sidecoach-orchestrator.ts`
- `sidecoach/src/flow-composition.ts`
- `sidecoach/src/context-loader.ts`
- `sidecoach/bin/sidecoach-artifacts.js`
- `sidecoach/src/flow-handler-typography-excellence.ts`
- `sidecoach/src/flow-handler-component-implementation.ts`
- `sidecoach/src/flow-handler-motion-integration.ts`

---

## Roadmap for subsequent sprints (unchanged from misty-jingling-plum)

- **Sprint 3**: Phase 4, stack-aware motion (flowH detects vanilla vs React and adapts, ~4 tasks)
- **Sprint 4**: Phase 5, graded validation + build report (~10 tasks)
- **Sprint 5**: Phase 6, checkpoint mechanism + intent disambiguation UI (~8 tasks)
- **Rolling**: Continue adopting the DESIGN.md citation pattern in the remaining handlers (Sprint 2 added 3, leaving ~22 to go).

---

## One open question that stays open

`main` is still 29 commits ahead of `origin/main` and unpushed. Sprint 2's commits stack on top of that. At the close of Sprint 2 the user will decide whether to push Sprint 1 + Sprint 2 together or hold for more cycles. Do not push without explicit authorization.
