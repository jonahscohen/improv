# design-build - Sidecoach Integration & Overlap Analysis

Source: `/Users/spare3/.claude/skills/design-build/SKILL.md`

## What this skill provides

A **pipeline orchestrator** that explicitly walks the 6 design skills (component-gallery-reference, fontshare-reference, design-references, motion-reference, icon-source, make-interfaces-feel-better) plus the oracle QA triad as ONE coordinated build, instead of relying on each skill's auto-trigger keywords.

The skill exists because of an empirical finding from the 2026-05-20 marketing-site build:
1. **Auto-triggering didn't fire reliably.** `component-gallery-reference`, `design-references`, and `icon-source` never auto-triggered during the build. `make-interfaces-feel-better` only fired because the agent had read it recently.
2. **The QA triad never ran.** It's documented as "runs at QA time" but no mechanism actually invokes it.

`design-build` is the explicit orchestrator with mandatory phases and gate checkpoints.

## When this skill triggers

Trigger ONLY on these explicit invocations:
- `/design-build` or `/design-build <feature description>`
- "run the design pipeline for X"
- "design-build this"
- "kickoff a design build"
- "walk the pipeline on X"
- "run the full design pipeline"
- "use the design stack on X"

DO NOT trigger on:
- Generic UI work ("build a button", "add a hover state", "fix this layout") - too narrow
- Pure copy/typography changes - run fontshare-reference directly
- Pure motion changes - read motion-reference directly
- Tactical polish - read make-interfaces-feel-better directly

## The 10-phase orchestration (with 2 gate checkpoints)

### Phase 0: Pre-flight
1. Check `<project>/PRODUCT.md`. If missing/stub/<200 chars/contains `[TODO]`: run `/oracle teach` first. Block until it returns.
2. Check `<project>/DESIGN.md`. If missing AND project has existing code: nudge ONCE: "Run /oracle document to capture the current visual system."
3. Read both files in full. Capture brand-voice words, register, anti-references, existing tokens.

### Phase 1: Strategy (Oracle)
Compose a brief direction. Present via AskUserQuestion as the **FIRST GATE CHECKPOINT**:
- Approved as proposed (Recommended)
- Edit one specific aspect
- Reframe entirely
- Cancel build

### Phase 2: Research (component-gallery-reference)
For any standard UI component: detect tech stack, identify gallery slug, browse filtered by tech, skip Unmaintained + Accessibility-issues, extract semantic markup + name consensus + interaction patterns + ARIA + related components. Synthesize a brief per component. Skip if novel.

### Phase 3: References (design-references catalog)
Grep `~/.claude/design-references/*/ref.md` for category/pattern/feel/source matches. Surface 0-5 references at score ≥ 3. Stay silent if no good matches.

### Phase 4: Typography (fontshare-reference)
ONLY if type decisions in scope. List voice words, list reflex picks, reject reflex-list hits, browse fontshare with filters, cross-check against anti-reflexes, verify weights+features+languages, document in DESIGN.md.

### Phase 5: Motion (motion-reference)
ONLY if feature has scroll/animation/transitions/drag/interaction motion. Identify motion need, read motion-reference for canonical pattern, lift verbatim, apply gotchas (SSR, ScrollTrigger.refresh, Lenis scrollIntoView, iOS Safari pinning).

### Phase 6: Icons (icon-source)
ONLY if icons needed. Check existing project library (one per project). Pick from 8 approved if new. Match to brand voice. Source paths VERBATIM.

### Phase 7: Build (make-interfaces-feel-better applied DURING construction)
Generate code WITH the 14-rule checklist applied as build-time guidance, NOT as post-pass cleanup. Concentric radii, optical centering, shadows over borders, interruptible animations, split+stagger enters, subtle exits, opacity+scale+blur swaps, font smoothing, tabular nums, text-wrap balance, image outlines, scale(0.96) press, initial={false} on AnimatePresence, no `transition: all`, sparse will-change, 40x40px hit areas.

### Phase 8: QA triad (MANDATORY - the part that never fired before)
1. `/oracle audit <target>` - 5-dimension scan + `npx oracle detect`. Address Critical + High.
2. `/oracle critique <target>` - design review via sub-agents. Address anything above "minor".
3. `/oracle polish <target>` - final design-system alignment.

If can't run oracle: record "QA triad SKIPPED because <reason>" in build memory.

**SECOND GATE CHECKPOINT** after triad findings surfaced:
- Address all findings before reporting done (Recommended)
- Address only Critical/High; accept the rest
- Accept all - mark known issues in memory
- Cancel and re-shape

### Phase 9: Verification (cmux browser)
Dev server up, cmux pane screenshots, real-input interaction (validation-guard blocks JS shortcuts), side-by-side against design source, dark mode + mobile breakpoint check.

### Phase 10: Memory
Write session memory at `<project>/.claude/memory/session_YYYY-MM-DD_<feature>.md` with phases-fired-vs-skipped, QA findings, friction points, files touched.

## The overlap with sidecoach (the strategic question)

**design-build and sidecoach are competing orchestrators for the same problem.**

| Dimension | design-build (this skill) | sidecoach |
|---|---|---|
| Surface | Slash-command + natural-language triggers | 22-verb command surface + phase commands |
| Phases | 10 explicit phases with 2 gate checkpoints | 36 flows organized by phase (craft/shape/polish/audit/animate/critique) |
| Skills consulted | 6 design skills + oracle triad | Aims to replace oracle; consults same 8 skills audited here |
| QA enforcement | Mandatory triad in Phase 8 | Built-in via Flow N (audit/critique/polish) + 159-rule validators |
| Memory | Session memory in Phase 10 | SessionMemoryWriter in orchestrator |
| Gate checkpoints | 2 (after strategy, after QA) | AskUserQuestion gates between flow phases |
| User-facing | "/design-build <feature>" | "/sidecoach <verb> <target>" |

## How sidecoach should integrate this skill

Sidecoach should treat design-build as a **specification document for orchestration patterns**, not as a runtime competitor.

### What sidecoach should absorb FROM design-build

1. **The 10-phase ordering.** Sidecoach's craft flow should follow this exact phase sequence: pre-flight → strategy → research → references → typography → motion → icons → build → QA triad → verification → memory.

2. **The 2 gate checkpoints.** Sidecoach should enforce AskUserQuestion gates at the same two points:
   - After strategy (Phase 1 / sidecoach Flow A complete)
   - After QA triad findings (Phase 8 / sidecoach Flow N complete)

3. **The "skip if not in scope" logic** for Phases 4, 5, 6. Sidecoach already has this pattern - but should explicitly document SKIP criteria in each handler so the user knows what fired and what didn't.

4. **The "phases-fired-vs-skipped" memory entry.** Sidecoach's SessionMemoryWriter should explicitly record which flows fired and which were skipped (with reasons).

5. **The failure modes catalog from the 2026-05-20 retrospective.** Sidecoach should treat each as an audit rule:
   - Skipping the QA triad → Flow N enforcement
   - Letting auto-trigger replace orchestration → explicit flow chain instead of keyword-trigger reliance
   - `data-reveal opacity:0` patterns that break silently → progressive-enhancement audit
   - CDN ESM imports failing (esm.sh, NOT cdn.skypack.dev) → build-system audit
   - Lenis + verification conflict → temporarily disable Lenis or use lenis.scrollTo

### What sidecoach should NOT duplicate

- Don't ship `/design-build` as a sidecoach verb. The user has it as a separate orchestrator; sidecoach is the deeper system.
- Don't re-invent the oracle triad - sidecoach already replaces it via Flow N + 159-rule validators.

### Sidecoach's relationship to design-build going forward

There are two valid futures:
1. **Coexistence.** design-build calls into sidecoach's flow handlers (e.g., Phase 2 invokes sidecoach Flow B; Phase 4 invokes Flow C). The skill becomes a lightweight phase-ordering shell over sidecoach's flow library.
2. **Subsumption.** Sidecoach absorbs design-build's phase ordering into its `craft` verb. `/sidecoach craft <feature>` becomes the canonical entry, and `/design-build` is deprecated to a thin alias.

The choice depends on whether the user wants design-build to remain a discoverable slash-command for non-sidecoach users.

## What's well-stocked

- The 10-phase workflow is detailed and battle-tested (informed by 2026-05-20 retrospective)
- Failure-mode catalog is specific and actionable
- Gate checkpoints are well-placed
- Phase 8 QA enforcement is the most valuable part

## What's missing

- No callable interface - it's a workflow document for the agent to follow, not a programmatic API
- No flow chaining beyond linear phase sequence (sidecoach has conditional execution, composite flows, result injection)
- No validator framework (sidecoach has 159-rule validation framework + flow-specific validators)
- No memory schema beyond "write a session entry" (sidecoach has SessionMemoryWriter with structured fields)

## Recommended sidecoach integration pattern

Add to sidecoach orchestrator:

```typescript
const designBuildPhases = [
  { name: 'pre-flight', flow: 'flow-pre-flight' },
  { name: 'strategy', flow: 'flow-A-brand-verify', gate: true },
  { name: 'research', flow: 'flow-B-component-research', skipIf: 'no-standard-components' },
  { name: 'references', flow: 'flow-D-design-references', skipIf: 'no-catalog-matches' },
  { name: 'typography', flow: 'flow-C-font-research', skipIf: 'design-md-locks-type' },
  { name: 'motion', flow: 'flow-E-motion-patterns', skipIf: 'no-motion-in-scope' },
  { name: 'icons', flow: 'flow-G-icons', skipIf: 'no-icons-needed' },
  { name: 'build', flow: 'flow-G-component-implementation' },
  { name: 'qa-triad', flow: 'flow-N-audit-critique-polish', gate: true },
  { name: 'verification', flow: 'flow-verification' },
  { name: 'memory', flow: 'flow-memory-write' },
];
```

This is the spec the next code-level wiring step can follow.
