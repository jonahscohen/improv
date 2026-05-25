# Sidecoach Sprint 8: Sidecoach Parity + Teach Rebuild - Design Spec

**Date:** 2026-05-25
**Author:** Jonah Cohen (collaborator)
**Sprint:** Sprint 8 (verb command + teach rebuild)
**Predecessors:** Sprint 7 closed (carryover sweep). Background: prior session memories incorrectly claimed Sidecoach had fully replaced Sidecoach; an audit on 2026-05-24 surfaced that only 3 slash commands were originally documented as wired (teach, list, composite), the broader registry contained 15 phase-vocabulary commands, and sidecoach's 23 verb-based commands had no parallel surface in sidecoach. Teach was confirmed a stub that ignored user briefs and wrote hardcoded boilerplate.

## Goal

Bring sidecoach to genuine feature parity with the sidecoach skill and exceed it on a measurable per-command basis. Two concrete deliverables:

1. **Rebuild `/sidecoach teach`** so it accepts a free-form brief, parses what it can, asks targeted questions only for gaps, and writes a real PRODUCT.md (no boilerplate, no self-attribution, no legacy plugin references).
2. **Add 22 verb-based slash commands** (every sidecoach command except teach which is special-cased) wired to the right sidecoach flow handlers, each producing output that matches OR exceeds sidecoach's equivalent.

## Why

Today's gap is structural, not cosmetic. A user typing `/sidecoach polish` or `/sidecoach audit` gets "Unknown command" - even though the underlying flow handlers (flowJ_tactical_polish, flowK_multi_lens_audit) exist and work. The teach command writes the same boilerplate every time regardless of what the user briefed. Users who learned the verb vocabulary cannot use sidecoach without re-learning a different command set. And `/sidecoach teach` is structurally unable to drive end-to-end dogfood because it doesn't actually do what its name promises.

These gaps blocked the dogfood task from 2026-05-24 (marketing site brief) and have been latent since sidecoach's initial migration from sidecoach.

## Scope decisions resolved during brainstorming

- **Vocabulary strategy:** ADD sidecoach's 22 verb-based commands alongside sidecoach's existing 15 phase commands. Both vocabularies remain valid. No breaking changes to existing routes.
- **Teach mode:** hybrid - parse brief first, ask follow-up questions only for fields the brief did not answer with confidence.
- **Acceptance bar:** parity-plus per command. Each command's output must include all the checklist items sidecoach's equivalent produces PLUS at least one sidecoach-specific addition (validator, BuildReport hook, memory tracking, or expanded scope).
- **Architecture:** command registry + thin verb-handlers (parallel to sidecoach's existing `PRESET_COMPOSITE_FLOWS` and `FLOW_DETECTORS` patterns).
- **Implementation model:** subagent-driven-development with Opus model on every dispatch. No haiku or sonnet.

## Architecture overview

New module `sidecoach/src/verb-command-registry.ts` declares all 22 verbs (every sidecoach verb except `teach`) in a typed table. Each entry contains:

- `command`: the verb name (e.g. `'animate'`)
- `description`: one-line summary
- `skillRefPath`: absolute path to the sidecoach skill's skill file for that command (under `~/.claude/plugins/cache/sidecoach/sidecoach/3.1.1/skills/sidecoach/`)
- `phase`: which conceptual phase (shape / craft / review / tone / docs / tactical)
- `flowIds`: array of `FlowId` to execute in order
- `guidanceAppend`: additional guidance lines this verb appends after the flow chain completes
- `parityChecklist`: strings that MUST appear in output for the parity test to pass (derived from sidecoach's skill checklist)
- `parityPlus`: strings that MUST also appear, proving sidecoach added something beyond sidecoach (typically: validator results, BuildReport reference, or memory entry mention)

The slash-command-router gets one new branch after the existing `composite` check and before the `SLASH_COMMANDS` (phase-vocabulary) lookup:

```typescript
const sidecoachEntry = getVerbEntry(command);
if (sidecoachEntry) {
  return {
    isCommand: true,
    command,
    flowIds: sidecoachEntry.flowIds,
    target,
    reason: `Routed to ${command} (sidecoach-parity) - ${sidecoachEntry.description}`,
  };
}
```

Teach is special-cased OUTSIDE the registry. New file `teach-command-handler-v2.ts` implements hybrid parsing. The existing `teach-command-handler.ts` (the stub) is deleted after migration; its task9 test is replaced by the new sprint8-teach-rebuild test.

The `document` command requires NEW functionality (no existing sidecoach flow reads code and writes DESIGN.md). New file `document-command-handler.ts` implements: scan project HTML/CSS, extract color tokens / type scale / spacing scale, emit Google-spec DESIGN.md YAML frontmatter + markdown body. Verified by running `npx @google/design.md lint` on the output.

Acceptance enforcement: one parameterized test (`sprint8-verb-parity.test.ts`) iterates the registry, executes each command against a sandboxed project, asserts every `parityChecklist` and `parityPlus` string appears in the output. Plus dedicated tests for teach and document because of their special handling.

## Command registry structure

```typescript
// sidecoach/src/verb-command-registry.ts

import type { FlowId } from './types';

export interface SidecoachCommandEntry {
  command: string;
  description: string;
  skillRefPath: string;
  phase: 'shape' | 'craft' | 'review' | 'tone' | 'docs' | 'tactical';
  flowIds: FlowId[];
  guidanceAppend: string[];
  parityChecklist: string[];
  parityPlus: string[];
}

export const VERB_REGISTRY: Record<string, SidecoachCommandEntry> = {
  // Each of 22 entries fully populated. T1 ships the first 5 as the pattern;
  // T5 ships the remaining 17. See plan for the verb list.
};

export function getSidecoachVerbs(): string[];
export function getVerbEntry(command: string): SidecoachCommandEntry | undefined;
```

The 22 verbs:
- **Shape / Strategy:** shape, teach (special), onboard
- **Craft / Build:** craft, animate, colorize, delight, bolder, overdrive, layout, typeset, clarify
- **Review / Validate:** audit, critique, polish, harden, adapt
- **Tone:** quieter, distill
- **Docs / Capture:** document, extract
- **Tactical:** optimize, live

Three nontrivial verbs need separate attention:
- **`document`** - new handler (no existing flow). Reads project code, writes DESIGN.md per Google spec.
- **`live`** - depends on Improv MCP integration via flowN.
- **`onboard`** - composite-style orchestration of flowG (component) + flowI (accessibility) + flowX (copywriting) for empty/loading/error states.

## Teach rebuild

New file `sidecoach/src/teach-command-handler-v2.ts` implements hybrid brief-driven teach.

```typescript
export interface TeachExtraction {
  register?: 'brand' | 'product';
  users?: string;
  brandPersonality?: string;
  antiReferences?: string[];
  strategicPrinciples?: string[];
  confidence: { [field: string]: 'high' | 'low' | 'absent' };
}

export class TeachCommandHandlerV2 {
  async execute(context: FlowExecutionContext): Promise<FlowExecutionResult> {
    const projectPath = context.projectPath || process.cwd();
    const productMdPath = path.join(projectPath, 'PRODUCT.md');

    // Refuse to overwrite an existing real PRODUCT.md without --force
    if (this.hasRealProductMd(productMdPath) && !context.metadata?.forceOverwrite) {
      return errorResult('PRODUCT.md exists - pass --force or metadata.forceOverwrite to replace');
    }

    const brief = this.extractBrief(context.utterance);
    const extracted = this.parseBrief(brief);
    const gaps = this.identifyGaps(extracted);

    if (gaps.length > 0 && !context.metadata?.skipInteractive) {
      return pendingResult(extracted, gaps);
    }

    const final = this.mergeFromBriefAndAnswers(extracted, context.metadata?.teachAnswers);
    const content = this.generateProductMd(final);
    fs.writeFileSync(productMdPath, content, 'utf-8');
    return successResult(productMdPath, final);
  }
}
```

Brief parsing rules (concrete, not vague):
- **register**: keyword detection - "brand" near top of brief or in "register" section → brand; "product" / "SaaS" / "app" / "tool" → product; ambiguous (both signals) → ask
- **users**: regex patterns: `for [X]`, `[X] who [verb]`, `audience:`, `target users:`. Extract noun phrase.
- **brandPersonality**: applicable only when register=brand; adjective clusters near "voice", "tone", "feel", "personality". Confidence is "low" if fewer than 3 adjectives extracted.
- **antiReferences**: explicit `anti-references:` section OR `NOT`/`not like`/`avoid` patterns. Bullet-list extraction.
- **strategicPrinciples**: numbered or bulleted statements; if none in brief, ask one open-ended question.

Output PRODUCT.md:
- NO self-attribution (no "Generated by Sidecoach" line)
- NO legacy `/sidecoach document` references
- Standard section headers matching existing PRODUCT.md files: Register, Primary Users, Brand Personality, Anti-References, Strategic Principles
- Optional Brand Personality section is omitted entirely when register=product

Pending-result shape: caller-driven follow-up. When gaps exist, return `status: 'pending'` with a list of questions in `guidance`, a `teach-state` artifact containing the partial extraction (JSON), and a checklist of unanswered questions. Caller re-invokes with `metadata.teachAnswers` populated to complete the flow.

## Slash-command-router integration

`parseSlashCommand` in `sidecoach/src/slash-command-router.ts` gets one new branch positioned AFTER the existing `composite` check and BEFORE the `SLASH_COMMANDS` (phase-vocabulary) lookup:

```typescript
// Sprint 8: sidecoach verb-based commands (parallel to phase-based SLASH_COMMANDS)
const sidecoachEntry = getVerbEntry(command);
if (sidecoachEntry) {
  return {
    isCommand: true,
    command,
    flowIds: sidecoachEntry.flowIds,
    target,
    reason: `Routed to ${command} (sidecoach-parity) - ${sidecoachEntry.description}`,
  };
}
```

For `teach`, the existing orchestrator code at line 711 (`if (commandMatch.command === 'teach')`) is rewritten to dispatch to `TeachCommandHandlerV2`.

For verb commands that need to APPEND guidance beyond the raw flow chain output (which is most verbs - the `guidanceAppend` and `parityPlus` lines come from the registry, not the flow handlers), the orchestrator's command-chain execution code path gets a callback after the chain completes. The callback looks up the executed command in the registry, appends `guidanceAppend` lines to the final result's `guidance`, and ensures `parityPlus` strings are present.

`/sidecoach list` output expanded: BOTH phase commands and sidecoach-parity verb commands listed, grouped under headings "Phase commands" and "Verb command commands".

`/sidecoach help <verb>` (new) - shows detailed help for a single verb: description, the flow chain, the parity checklist (what sidecoach does too), and the parity-plus additions (what sidecoach adds beyond).

## Acceptance testing

**Parameterized parity test** (`sidecoach/src/__tests__/sprint8-verb-parity.test.ts`):

```typescript
import { VERB_REGISTRY } from '../verb-command-registry';
import { FlowExecutionEngine } from '../sidecoach-orchestrator';
// ... setup helpers

async function run() {
  const checks: Array<[string, boolean]> = [];
  for (const [verb, entry] of Object.entries(VERB_REGISTRY)) {
    const sandbox = setupSandbox();  // PRODUCT.md + DESIGN.md present
    const engine = new FlowExecutionEngine();
    const result = await engine.process(`/sidecoach ${verb}`, { projectPath: sandbox });
    const allOutput = [
      ...(result.guidance || []),
      ...(result.checklist || []).map(c => c.label),
      ...(result.artifacts || []).map(a => a.content),
    ].join('\n');
    for (const required of entry.parityChecklist) {
      checks.push([`${verb}: parity '${required.slice(0,40)}'`, allOutput.includes(required)]);
    }
    for (const plus of entry.parityPlus) {
      checks.push([`${verb}: plus '${plus.slice(0,40)}'`, allOutput.includes(plus)]);
    }
    cleanupSandbox(sandbox);
  }
  // ... pass/fail reporting
}
```

**Teach dedicated test** (`sprint8-teach-rebuild.test.ts`) - 6 scenarios:
1. Full brief (all 5 fields explicit) → no gaps → PRODUCT.md written with extracted content
2. Partial brief (3 of 5 fields) → 2 gaps → status='pending' with 2 questions
3. No brief (empty utterance) → all 5 gaps surfaced
4. Brief + teachAnswers in metadata → fields merged → PRODUCT.md written
5. PRODUCT.md exists, no --force → refuse with actionable error
6. PRODUCT.md exists, --force → overwrite
7. Output PRODUCT.md contains NO self-attribution line, NO legacy `/sidecoach` reference

**Document dedicated test** (`sprint8-document-handler.test.ts`):
- Sets up sandboxed projectPath with HTML+CSS containing colors, type scale, spacing tokens
- Invokes `/sidecoach document`
- Asserts: DESIGN.md created at projectPath root, contains YAML frontmatter, has Overview / Colors / Typography / Layout sections per Google spec
- Runs `npx @google/design.md lint DESIGN.md` programmatically (via execFileSync) and asserts exit code 0

**Regression gate:** all 64 existing sidecoach tests still pass. tsc --noEmit exit 0. No regressions.

Final test count post-Sprint 8: 64 baseline + 1 parameterized parity test (effectively 44+ verb-level assertions) + 1 teach + 1 document = ~67 distinct test files.

## File structure

**New files (6):**
- `sidecoach/src/verb-command-registry.ts` - registry module + 22 entries (~400 lines)
- `sidecoach/src/teach-command-handler-v2.ts` - hybrid teach handler (~250 lines)
- `sidecoach/src/document-command-handler.ts` - new document handler (~200 lines)
- `sidecoach/src/__tests__/sprint8-verb-parity.test.ts` - parameterized parity test (~150 lines)
- `sidecoach/src/__tests__/sprint8-teach-rebuild.test.ts` - 7-scenario teach test (~180 lines)
- `sidecoach/src/__tests__/sprint8-document-handler.test.ts` - document + lint test (~100 lines)

**Modified files (3):**
- `sidecoach/src/slash-command-router.ts` - add sidecoach verb branch + expand `getAvailableCommands` output
- `sidecoach/src/sidecoach-orchestrator.ts` - rewrite teach dispatch to V2 handler, add guidance-append callback to command-chain execution path
- `claude/skills/sidecoach/SKILL.md` (or equivalent) - update documentation to reflect new commands

**Deleted files (1):**
- `sidecoach/src/teach-command-handler.ts` - stub replaced by V2
- `sidecoach/src/__tests__/task9-teach-command.test.ts` - replaced by sprint8-teach-rebuild.test.ts

## Execution model

Subagent-driven-development. Every Agent dispatch specifies `model: "opus"`. No haiku or sonnet on this work.

Task partition (10 tasks):
- T1: Registry skeleton + types + 5 prototype entries (craft, polish, audit, critique, document)
- T2: Slash-router branch + integration tests for the 5 prototype routes
- T3: Teach V2 handler + 7-scenario test
- T4: Document command handler + linter-pass test
- T5: Remaining 17 registry entries with full metadata
- T6: Parameterized parity test runs across all 22 verbs
- T7: Orchestrator guidance-append callback + integration
- T8: `/sidecoach list` and `/sidecoach help <verb>` output expansion
- T9: SKILL.md / README / install.sh documentation sync
- T10: Full regression + tsc + 67-test sweep + sprint close

Each task gets the standard implementer → spec-review → code-quality-review cycle. All review subagents also use Opus.

## Failure modes

- **Sidecoach skill source not available at the expected path.** Fall back to deriving `parityChecklist` from CLAUDE.md's documented behavior tables. Mark affected verbs in the registry with `skillRefPath: '(documented only)'`. T5 surfaces this if encountered.
- **`@google/design.md` package not installable or executable.** Document command's lint assertion downgrades to a structural-validity check (YAML parses, required sections present). T4 surfaces this.
- **Existing `task9-teach-command.test.ts` regresses on the rebuild.** The old test is deleted per plan, but if other tests indirectly assume the old teach's hardcoded output, those need updates. T3 surfaces this.
- **Guidance-append callback creates a regression in existing slash-command flows.** The callback only fires when the executed command is in the sidecoach registry. Existing phase commands route through the unchanged code path. T2 + T7 acceptance gates verify no regression.
- **Brief parsing produces low-confidence false positives.** Tests T3 cover edge cases (brief that mentions "brand" but is about a product). Confidence threshold tuned to "ask if any ambiguity."

## Open questions / risk flags

- **Registry-level decision: include `live` verb if Improv integration is incomplete?** Improv MCP integration through flowN exists but its production-readiness has not been verified end-to-end. T5 should run the live verb against an Improv-connected sandbox to confirm; if it fails, ship `live` as a stub-with-error-message and file a separate Improv-readiness task.
- **`document` verb requires reading code outside sidecoach.** The handler must walk projectPath looking for HTML/CSS. Path-traversal safety: constrain reads to the projectPath subtree, refuse to read above. T4 covers this.
- **22 entries × parity-plus × parity-checklist = many literal strings to maintain.** When sidecoach updates a skill, sidecoach's registry entries drift. Documented mitigation: each entry references `skillRefPath` so a future "drift audit" command can diff entries against current sidecoach source.

## Acceptance criteria

- All 22 sidecoach verbs route via `/sidecoach <verb>` and produce flow-chain output
- Each verb's output contains every string in its registry `parityChecklist`
- Each verb's output contains every string in its `parityPlus`
- `/sidecoach teach` accepts a brief, parses what it can, returns `status: 'pending'` with questions for unparsed fields, writes a real (not boilerplate) PRODUCT.md when all 5 fields are resolved
- Generated PRODUCT.md contains NO self-attribution line
- Generated PRODUCT.md contains NO legacy `/sidecoach` references
- `/sidecoach document` writes a Google-spec DESIGN.md that passes `npx @google/design.md lint`
- `/sidecoach list` shows BOTH phase commands and verb commands grouped under clear headings
- `/sidecoach help <verb>` shows detailed help for a single verb
- All 64 existing sidecoach tests still pass
- `npx tsc --noEmit` exits 0
- Sprint memory + MEMORY.md index entry + queue update committed

## Out of scope (future sprints)

- Live MCP integration polish (if `live` ships as stub-with-error)
- A drift-audit command that compares registry entries to current sidecoach source
- Migration of phase-vocabulary commands to verb-vocabulary (the user explicitly chose to keep both)
- Removing the old `task9-teach-command.test.ts` (replaced by sprint8-teach-rebuild)
- Adding more validators beyond what flow handlers already invoke
