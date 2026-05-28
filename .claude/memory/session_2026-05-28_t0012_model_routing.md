---
name: T-0012 per-flow model-tier routing
description: model-routing.ts + applyModelSelection() injected into 22 flow handlers; 54/54 tests pass, 57.3% token savings
type: project
relates_to: [sidecoach_consolidation_gameplan.md]
---

# T-0012: Per-flow model-tier routing

OMC's 2026-05-28 gap analysis claimed 30-50% token savings from routing
classification work to Haiku, default reasoning to Sonnet, and reserving Opus
for heavy synthesis. Sidecoach now matches that pattern. Measured savings on
a 10-flow synthetic session: **57.3%** ($1.05 -> $0.448 vs naive-Opus-for-
everything baseline) - beats the OMC claim.

Collaborator: Jonah.

## What shipped

### New module: `sidecoach/src/model-routing.ts`

Exports:

| Export | Purpose |
|---|---|
| `TIERS` | const `Record<TierName, ModelTier>` - haiku/sonnet/opus with exact model IDs + per-million pricing |
| `FLOW_MODELS` | `Record<FlowId, FlowModelConfig>` - 38 entries (one per declared FlowId) with minTier, preferredTier, rationale |
| `selectModel(flowId, budget?)` | Selection logic: preferredTier unless budget caps below it, with minTier floor |
| `trackCost(flowId, model, inputTokens, outputTokens)` | Append a CostEntry to session ledger; computes USD estimate |
| `getSessionLedger()` | Snapshot of current session's cost log |
| `resetLedger()` | Clear ledger (tests + fresh-session boundaries) |
| `summarizeLedger(ledger)` | Multi-line human-readable per-flow + per-model breakdown |
| `applyModelSelection(flowId, context)` | One-shot helper: pick model, stash into context.metadata.selectedModel, return tier |

Model IDs (latest per CLAUDE.md mandate):
- Haiku: `claude-haiku-4-5-20251001` ($1/MTok in, $5/MTok out)
- Sonnet: `claude-sonnet-4-6` ($3/MTok in, $15/MTok out)
- Opus: `claude-opus-4-7` ($15/MTok in, $75/MTok out)

### Per-flow tier rationale

Distribution: **6 Haiku, 16 Sonnet, 16 Opus**.

Why this one:

**Haiku (preferred)** - pure classification, validation, formatting:
- `flowA_brand_verify` - PRODUCT.md/DESIGN.md load + register detection
- `flowM_responsive_validation` - breakpoint + touch-target validation
- `flowU_curate` - catalog capture metadata
- `flow4_explore_discovery` - exploration helper
- `flow11_extract_tokens` - token occurrence counting
- `flow12_responsive_review` - breakpoint validation

**Sonnet (preferred)** - research, audit, moderate synthesis:
- `flowE_motion_patterns` (min=preferred=sonnet)
- `flowS_typography_excellence`, `flowV_all_seven_qa`, `flowQ_migration_special`
- `flowX_copywriting`, `flow2_polish_enhance`, `flow14_migration`
- Lookups with judgment: flowB, flowC, flowD, flowF, flowI, flowK
- Legacy: flow3_audit_page, flow5_review_qa, flow9_accessible

**Opus (preferred)** - heavy synthesis, craft, complex critique:
- `flowG_component_implementation` - CRAFT from scratch
- `flowH_motion_integration` (min=opus too) - reduced-motion + timeline orchestration
- `flowJ_tactical_polish` - 112-rule synthesis
- `flowL_design_critique` - Nielsen + AI-slop + cognitive load
- `flowN_rapid_iteration_refined`, `flowO_clone_match_special`, `flowP_constraint_design_special`
- `flowR_layout_optimization`, `flowT_ambitious_motion` (min=opus too)
- `flowW_landing_composition` - landing composition
- Legacy craft: flow1, flow6, flow7, flow8, flow10, flow13

**Floor protection**: `flowH_motion_integration` and `flowT_ambitious_motion`
declare `minTier=opus` because dropping below Opus loses essential capability
(complex motion orchestration). `selectModel(flow, {maxTier:'haiku'})` returns
Opus anyway for those flows - the floor stops the downgrade.

### Handler integration

Modified **22 handler files** to invoke `applyModelSelection(this.flowId, context)`
at the top of `execute()`:

Canonical single-handler files (used by orchestrator):
- flow-handler-brand-verify, -component-research, -font-research, -design-references, -motion-patterns
- flow-handler-design-tokens, -component-implementation, -motion-integration, -accessibility
- flow-handler-tactical-polish, -responsive-validation, -landing-composition, -copywriting
- flow-handler-curate, -all-seven-qa, -layout-optimization, -typography-excellence, -ambitious-motion

Multi-handler files (used by orchestrator):
- flow-handlers-tier3-tier4 (FlowK, FlowL, FlowN, FlowO, FlowP, FlowQ)
- flow-handlers-extended (Flow1, Flow3, Flow4, Flow6, Flow8, Flow9, Flow11, Flow12, Flow13, Flow14)
- flow-handlers-core (Flow2, Flow5, Flow7, Flow10)

Standalone polish/audit/critique files (T-0009 retry-control, t9 test only):
- flow-handler-multi-lens-audit, -design-critique (in addition to -tactical-polish above)

How: `applyModelSelection` sits ABOVE T-0009's halt check in polish/audit/critique
handlers, per task spec. Halt-early paths still leave a model-selection record
in context.metadata - useful for forensics.

### Tests

`sidecoach/src/__tests__/t12-model-routing.test.ts` covers:
- TIERS use latest model IDs + pricing ordered correctly (5 checks)
- FLOW_MODELS has 38 entries + rationale on every one (3 checks)
- selectModel returns preferred without budget (3 checks)
- selectModel respects budget cap + minTier floor (4 checks)
- trackCost appends + computes cost (haiku/opus/unknown-model) (11 checks)
- summarizeLedger format (11 checks)
- applyModelSelection stashes into context.metadata (3 checks)
- Handlers (FlowA, FlowU, FlowH, FlowJ, FlowK, FlowL) invoke selectModel (11 checks)
- T-0009 retry halt still fires when modelSelection sits above it (2 checks)
- Savings calculation: 57.3% saved (1 check)

Result: **54/54 PASS**. T-0009 regression test still **52/52 PASS**.

### tsc

`npx tsc --noEmit` clean exit 0 across the whole sidecoach project.

## Why this approach (decision rationale)

**Alternatives considered:**
- *Per-flow exact-model strings* (no tier abstraction): rejected because
  Anthropic's pricing + ID layout changes annually. Tiers decouple intent
  ("light/medium/heavy reasoning") from the concrete model ID.
- *Single global model with override knob*: rejected because the whole point
  is per-flow routing - one knob can't capture "Haiku for brand-verify,
  Opus for motion-integration."
- *Inject LLM call site in each handler now*: rejected as out of scope. The
  handlers today are checklist generators with no LLM call; this PR sets up
  the infrastructure (selectedModel in context.metadata) so when LLM calls
  ARE added, they route correctly. Cost tracking is wired and ready.

**Why this one:** decouples tier semantics from model IDs, gives every flow
a declared min/preferred (capability matrix), and survives Anthropic's model
rotation by updating one const. Budget cap with minTier floor is the standard
pattern for cost-controlled inference - keeps craft flows on Opus when budget
allows, drops them to Sonnet under pressure, never below the floor.

**Revisit when:**
- Anthropic ships a new model tier (sub-Haiku or super-Opus).
- LLM calls actually wire into handlers - selectedModel currently is recorded
  but no API call consumes it yet.
- Per-flow benchmarks (T-0013 prereq) reveal a flow is under- or over-tiered.

## Files touched

New:
- `sidecoach/src/model-routing.ts` (capability matrix + selection + ledger)
- `sidecoach/src/__tests__/t12-model-routing.test.ts` (54 tests)

Modified (22):
- 19 standalone handler files in `sidecoach/src/flow-handler-*.ts`
- 3 multi-handler files: `flow-handlers-tier3-tier4.ts`, `flow-handlers-extended.ts`, `flow-handlers-core.ts`

Updated:
- `TASKS.md` - T-0012 moved to Done with summary

## What I'd watch for next session

T-0012 is the infrastructure layer; the actual wins compound when:
1. T-0013 benchmark harness runs the cost ledger across real fixtures.
2. LLM calls land in handlers (each handler currently produces checklists,
   not generation). When they do, `context.metadata.selectedModel.exactModel`
   is the model ID to pass to `anthropic.messages.create()`.
3. Budget toggles get a config knob (DESIGN.md `models.maxTier: 'sonnet'`
   for CI, undefined for craft sessions).
