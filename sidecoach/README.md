# Sidecoach v3: Design System Guardian

Sidecoach is a design system orchestration engine that chains design and development workflows into phases. It supports both explicit slash commands and natural-language intent detection, enforces prerequisites at phase boundaries, and runs the right flows in sequence.

There are two parallel slash command surfaces:

- **Phase commands** - sidecoach native vocabulary (`research`, `craft`, `review`, plus special verbs like `clone`, `migrate`, `refactor`, `type`, `motion`, `reference`, `comprehensive`, `rapid`).
- **Verb command verbs** - 21 commands that mirror sidecoach's vocabulary 1:1 and route through the same flow chains. The orchestrator appends per-verb parity guidance (sidecoach's section names verbatim, plus sidecoach's parity-plus extensions: BuildReport, taste validation, polish-standard domain grades, category-reflex detector, memory entry).

You can still describe what you're building in natural language and the intent detector will route, but the slash commands are the supported primary interface.

## What Sidecoach Does

1. **Intent Detection** - Understands natural language intent from your utterance
2. **Prerequisite Enforcement** - Hard-blocks flows when PRODUCT.md/DESIGN.md are missing or incomplete
3. **Phase Gating** - Enforces tier progression (can't run polish before build completes)
4. **Flow Chaining** - Automatically chains related flows (Run Flow A → recommends B → recommends C)
5. **Regression Detection** - Detects when a flow produces worse output than prior runs
6. **Design Debt Tracking** - Auto-logs deferred issues and surfaces them at session start
7. **Persona-Based Critique** - Extracts project-specific personas from PRODUCT.md for design review
8. **Measured Detection** - Runs rendered and static detectors for objective and taste defects, failing closed as `unverified` rather than a false clean
9. **Human-Gated Enforcement** - A self-learning taste tier that promotes and enforces mined rules only through signed consent tokens, off by default
10. **Rule Reconciliation** - A consolidation map that reconciles rules across all sources and classifies contradictions by type

## Architecture

### 5 Core Systems (New in v3)

1. **DeterministicValidator** - Hard-blocking prerequisite gates
   - PRODUCT.md must exist (>200 chars)
   - DESIGN.md required for Tier 2+ (colors, typography, spacing)
   - Tier 3 requires Tier 2 success
   - Tier 4/5 require Tier 3 success
   - Motion flows require GSAP/Lenis

2. **RegressionDetector** - Compares flow output across runs
   - Status degradation (success → error) blocks chain
   - Guidance/checklist drops warn but continue
   - Message quality drops tracked

3. **ProjectPersonaEngine** - Async LLM extraction of project-specific personas
   - Parses PRODUCT.md for user types, brand personality
   - Generates 3 project personas (fallback to 5 generic archetypes)
   - Used by Design Critique (FlowL) for context-aware review

4. **DesignDebtTracker** - Persistent design debt logging
   - Auto-logs warning-level violations
   - Keyed by projectPath (cross-session tracking)
   - Surfaced at session start

### 36 Total Flows (22 new tiers + 14 legacy)

**TIER 1 - STRATEGY & RESEARCH (Flows A-E)**
| Flow | Name | Trigger | Purpose |
|------|------|---------|---------|
| A | Brand Verify | "verify brand alignment", "brand check" | PRODUCT.md alignment, brand guidelines |
| B | Component Research | "research components", "component audit" | Accessibility, coverage, inventory |
| C | Font Research | "typography research", "font system" | Font choices, loading, fallbacks |
| D | Reference Search | "find inspiration", "design references" | Inspiration, prior art, design catalog |
| E | Motion Patterns | "motion research", "animation patterns" | GSAP/Lenis integration, motion library |

**TIER 2 - BUILD (Flows F-I)**
| Flow | Name | Trigger | Purpose |
|------|------|---------|---------|
| F | Design Tokens | "extract tokens", "design tokens" | Colors, spacing, typography as tokens |
| G | Component Implementation | "implement components", "build from design" | Component implementation with tokens |
| H | Motion Integration | "integrate motion", "add animations" | Animation and interaction integration |
| I | Accessibility | "make accessible", "a11y audit" | WCAG 2.1 AA compliance, SR testing |

**TIER 3 - POLISH (Flows J-P)**
| Flow | Name | Trigger | Purpose |
|------|------|---------|---------|
| J | Tactical Polish | "make feel better", "polish interface" | 16-point refinement (radius, optical, shadows) |
| K | Multi-Lens Audit | "technical audit", "quality scan" | 5-dimension scan (a11y, perf, theming, responsive, anti-patterns) |
| L | Design Critique | "design review", "critique" | Nielsen heuristics, AI-slop, cognitive load |
| M | Responsive Validation | "responsive check", "breakpoint test" | Breakpoint testing, 40x40px hit targets |
| N | Rapid Iteration | "iterate", "try variations" | Token-based variation generation |
| O | Clone Match | "pixel perfect", "match exactly" | Pixel-perfect comparison vs design |
| P | Constraint Design | "design for constraint", "finalize" | Design within system constraints |

**TIER 4/5 - SPECIALIZED (Flows Q-T)**
| Flow | Name | Trigger | Purpose |
|------|------|---------|---------|
| Q | Migration | "migrate to", "replace component" | API migration, dependency mapping |
| R | Layout Optimization | "layout review", "spacing refine" | Whitespace, alignment, visual hierarchy |
| S | Typography Excellence | "kerning", "typography detail" | Kerning, ligatures, line-height, variable fonts |
| T | Ambitious Motion | "advanced animation", "motion sequences" | Advanced animation sequences, micro-interactions |

**SPECIAL (Flows U-V)**
| Flow | Name | Trigger | Purpose |
|------|------|---------|---------|
| U | Curate | "add reference", "design reference" | 5-step design reference capture wizard |
| V | All-Seven QA | "comprehensive qa", "all-seven" | End-to-end QA chaining A-T with gates |

**LEGACY (Flows 1-14)**
| Flow | Name | Purpose |
|------|------|---------|
| 1 | Clone/Match | Pixel-perfect 1:1 replication |
| 2 | Polish/Enhance | Microinteractions, tactile feel |
| 3 | Audit Page | Technical issue discovery |
| 4 | Explore/Discovery | Open-ended brainstorming |
| 5 | Review/QA | Multi-lens QA framework |
| 6 | Constraint Design | Design under explicit limits |
| 7 | Design Component | New component creation + QA triad |
| 8 | Refactor/Improve | Layout/structure improvement |
| 9 | Make Accessible | WCAG 2.1 AA compliance |
| 10 | Implement Design | Design-to-code workflow |
| 11 | Extract Tokens | Pattern extraction into tokens |
| 12 | Responsive Review | Breakpoint and device testing |
| 13 | Rapid Iteration | Goal-driven refinement cycle |
| 14 | Migration | API change and component migration |

## The taste layer: detect, learn, enforce

Beyond the flow orchestrator, Sidecoach carries a measurable, self-improving taste system.

**Detection engine.** A live product-rule registry (63 built-in rules) runs against the actually-rendered page and the raw source: objective defects (contrast, heading order, broken images, justified text, hit-target size) and taste defects (marketing-buzzword, tiny-text, nested-cards, shadow hierarchy, anti-pattern bans). It fails closed - when it cannot render, or the engine is not built, it reports `unverified` rather than a false clean. `bin/sidecoach-detect.js` is the engine; `sidecoach-taste-gate.sh` (PostToolUse) auto-runs the static subset on every `.html`/`.css` write under a DESIGN.md project.

**QA gate.** The full review is a three-stage chain - `/sidecoach audit` -> `/sidecoach critique` -> `/sidecoach polish`. `sidecoach-orchestrate-edit.sh` injects the gate directive on a substantive design edit, and `sidecoach-qa-gate-stop.sh` (a finish-boundary Stop hook) blocks reporting the work "done" until all three real Skill invocations are present since the arm. A repo carrying a `.sidecoach-off` marker at its root opts that project out of the sidecoach hooks; other projects are unaffected.

**Self-learning loop (human-gated).** A miner distills candidate rules from a multi-source corpus - the team's own beats, measured audit history, and an ingested library of design pioneers (Emil Kowalski, Jakub Krehel, Leon Lin, Meng To, and more) - deduplicated against the live registry. Candidates are inert proposals. A rule becomes advisory only through a human-signed `promote-confirm` token, and build-blocking only through a second `enforce-confirm` token plus a held-out precision gate (>= 8 positives, P >= 0.90). Every step is HMAC-ledgered and content-bound; the CLIs sign the ledgers themselves and an agent can never mint a token. Enforced rules ship **off by default** behind the per-project `~/.claude/.taste-blocking-enabled` switch - they warn until you turn blocking on.

- `bin/sidecoach-mine.js` - assemble the multi-source corpus and emit candidates (`run --findings <lens-artifact>` for reflect-style net-new discovery).
- `bin/sidecoach-taste-promote.js` / `bin/sidecoach-taste-enforce.js` - the two human-gated consent gates (promote -> guidance, enforce -> blocking).
- `sidecoach-schedule on|off|status` - control the daily headless discovery daemon (proposes candidates only; never enforces).

**Consolidation + contradiction map.** `bin/sidecoach-consolidate.js` surveys the whole corpus against the live registry, clusters distilled rules by concept, shows what is covered / additive / single-source, and classifies every contradiction by type - `direction-pair` (an intended menu, never a conflict), `hard-vs-hard` (a real conflict to resolve), `standard-calibration` (measurements to pick), `cross-type`. The direction exemption is provenance-gated, so a bold-vs-restrained pair is never mistyped as a real conflict. Inert report only. `bin/sidecoach-doctor.js` is the self-check that reports unreached or unverified capabilities.

## How It Works

```
User: "/sidecoach polish login-form"  (or NL: "make this interface feel better")
  ↓
SessionStart hook → Launches daemon in background
  ↓
PostUserPrompt hook → Sends utterance to daemon via named pipe
  ↓
Daemon → sidecoach-monitor.js → FlowExecutionEngine.process()
  ↓
parseSlashCommand() → 'polish' matches sidecoach registry → flowJ_tactical_polish + flowM_responsive_validation
  (NL utterances flow through Intent Detector instead, returning the same flow IDs by confidence match.)
  ↓
Orchestrator runs the flow chain, then appends the registry's guidanceAppend, parityChecklist, and parityPlus content so the response speaks in sidecoach's voice (sections like "Design System Discovery", "Pre-Polish Assessment", "Polish Systematically") while carrying sidecoach's extensions (polish-standard domain grade, taste validation, BuildReport, memory entry).
  ↓
Result cached to /tmp/sidecoach-results-*/
  ↓
PostResponse hook → Reads result, injects into response
  ↓
User sees: Sidecoach guidance + checklist + parity-plus tokens in their response
```

## Flow Memory System (Phase 5)

Every flow execution now persists comprehensive design decision audit trails:

- **Applied Rules**: Domain-specific design rules enforced during execution
- **User Decisions**: Key design choices made with rationale
- **Metrics**: Measured outcomes (compliance %, coverage, performance)
- **Validation Results**: Pre/post validation, domain audits, accessibility scans

Session memory files are automatically written at execution end:
- Location: `~/.claude/projects/<project>/memory/session_YYYY-MM-DD_sidecoach.md`
- Contains: Flow execution order, detailed memory per flow, summary metrics, design decisions
- Persistence: Automatic, no user action needed

This enables:
- Design decision audit trails across projects
- Cross-session consistency tracking
- Regression detection at the decision level
- Evidence-based design reviews

## Each Flow Returns

- **Guidance**: What you should know about this workflow
- **Checklists**: 6-14 items (mix of required/optional) to work through
- **Next Steps**: Concrete actions to take
- **Artifacts**: Templates, comparison frameworks, etc.
- **Memory**: Persistent audit trail (applied rules, decisions, metrics, validation)

Example Flow2 result:
```
Initiating Polish & Enhancement workflow

Guidance:
- Review the 14-point tactile improvement checklist below
- Apply each principle to your UI elements
- Verify changes with real browser interactions

Checklist:
☐ Scale on press: scale(0.96) [required]
☐ Concentric border radius [required]
☐ Icon swaps via opacity+scale+blur [optional]
... [14 items total]

Next Steps:
1. Open your component in a browser
2. For each principle, identify which elements need adjustment
3. Apply the improvements
4. Test interactions: hover, press, focus
5. Screenshot before/after
```

## Deployment

### Quick Start

1. Copy hooks to ~/.claude/hooks:
```bash
ln -s /path/to/repo/claude/hooks/sidecoach-*.sh ~/.claude/hooks/
```

2. Next session, Sidecoach activates automatically:
   - SessionStart hook launches daemon
   - Daemon monitors all your messages
   - Flows execute invisibly in background
   - Results injected into responses

### Customization

Extend Sidecoach by:
1. Adding new triggers to `src/flows.ts`
2. Creating new handler class extending `BaseFlowHandler`
3. Registering handler in orchestrator's `initializeHandlers()`
4. Run `npm run build` to compile

## Testing

```bash
# Test monitor directly
node bin/sidecoach-monitor.js "make this interface feel better"

# Test orchestrator initialization
node -e "const {createOrchestrator} = require('./dist/sidecoach-orchestrator'); createOrchestrator();"

# Run full system test
bash /tmp/test-sidecoach-daemon.sh
```

## Intent Detection Accuracy

Trigger matching uses rule-based patterns with:
- Intent markers: Keywords that trigger flow detection
- Collision avoidance: Prevents overlapping flows from interfering
- Negative filters: Excludes patterns that would cause false positives
- Confidence scoring: Each match gets a confidence level (0-1)

Current accuracy: 100% on test suite (8 diverse utterances)

## Design Philosophy

**Conversation and slash commands route to the same engine**

Sidecoach supports both interfaces because each fits a different moment:

- **Slash commands** are the supported primary interface for direct, intentional invocation. Use `/sidecoach polish login-form` when you know what you want. Two parallel vocabularies (phase commands and the 21 verb command verbs) share the same underlying flows.
- **Natural language intent detection** still works for unscripted descriptions. The intent detector routes free-form utterances to the same flow chains, with confidence scoring and phase-gate prerequisites.
- **No "what should I do next?" friction.** The orchestrator chains related flows, enforces prerequisites at phase boundaries, and writes a session memory entry so the next call starts with full context.
- **`/sidecoach list` and `/sidecoach help <verb>`** make the surface discoverable: list shows phase commands and the 21 verbs grouped by phase; help dumps the registry detail for any specific verb.

## Slash command surface

### Phase commands (sidecoach native vocabulary)
- `/sidecoach research` - explore design foundations (flows A-E + 4 + 7)
- `/sidecoach craft` / `/sidecoach implement` - build tokens, components, motion, accessibility (flows F-I + 9 + 10 + 11)
- `/sidecoach review` - polish, audit, critique, validate (flows J-N + 2 + 3 + 5 + 12 + 13)
- `/sidecoach clone`, `constrain`, `migrate`, `refactor`, `type`, `motion`, `reference`, `comprehensive`, `rapid` - special-case routings
- `/sidecoach list` - shows every command grouped by phase
- `/sidecoach help <verb>` - per-verb registry detail (description, phase, sidecoach reference path, flow chain, parity checklist, sidecoach parity-plus additions)

### Setup
- `/sidecoach teach [brief]` - brief-driven hybrid; parses what's in the brief, asks targeted questions for gaps, writes PRODUCT.md
- `/sidecoach document` - scans project HTML/CSS, writes Google-spec DESIGN.md (YAML token frontmatter + six-section body)

### Verb command verbs (21 commands)
- Shape and strategy: `shape`, `onboard`
- Build: `craft`, `animate`, `bolder`, `colorize`, `delight`, `layout`, `overdrive`, `typeset`, `clarify`
- Review: `audit`, `critique`, `polish`, `harden`, `adapt`, `optimize`
- Tone: `quieter`, `distill`
- Docs: `document`, `extract`

Each verb routes to a sidecoach flow chain through `VERB_REGISTRY` in `src/verb-command-registry.ts`. The orchestrator appends the registry entry's `guidanceAppend`, `parityChecklist` (sidecoach section names verbatim), and `parityPlus` (sidecoach additions) so the response matches sidecoach's voice without losing sidecoach's validators, BuildReport, taste validation, and memory.

## Status

- 36 flows implemented (22 flows A-V + 14 legacy 1-14); 21 verb command verbs wired.
- Daemon + slash router + intent detector all route through the same FlowExecutionEngine.
- Taste layer live: a 63-rule product-rule registry with a rendered + static detection engine, the three-stage QA gate, and its auto-fire hooks.
- Self-learning loop proven end to end: a reflect-style pass surfaced 13 net-new candidates from the ingested pioneer corpus, and the first learned rule (`motion.no-scale-zero-enter`) was promoted and enforced - off by default - through the two signed consent gates, HMAC-ledgered and precision-verified (P = 1.0 on a held-out corpus).
- Consolidation + contradiction map and the `sidecoach-schedule` daily-discovery daemon shipped.
- `npm run build` clean; hook suites green. Production ready.

## Files

- `src/types.ts` - Type definitions
- `src/flows.ts` - Flow registry with 14 triggers
- `src/intent-detector.ts` - Rule-based pattern matching
- `src/intent-detector.test.ts` - Test suite (100% passing)
- `src/flow-handler.ts` - BaseFlowHandler abstract class
- `src/flow-handlers-core.ts` - 4 high-priority handlers
- `src/flow-handlers-extended.ts` - 10 extended handlers
- `src/sidecoach-orchestrator.ts` - Orchestration engine
- `bin/sidecoach-monitor.js` - Entry point for daemon
- `src/product-rule-registry.ts` - The 63-rule taste/quality registry
- `bin/sidecoach-detect.js` - Rendered + static detection engine
- `bin/sidecoach-mine.js` - Taste miner (corpus -> inert candidates)
- `bin/sidecoach-taste-promote.js` / `bin/sidecoach-taste-enforce.js` - Human-gated consent gates
- `bin/sidecoach-consolidate.js` - Consolidation + contradiction map
- `bin/sidecoach-doctor.js` - Capability self-check
- `claude/cmux/sidecoach-schedule` - Daily-discovery daemon control (`on`/`off`/`status`)
- `claude/hooks/sidecoach-*.sh` - Hook scripts (detection, QA gate, consent arm hooks)
- `dist/` - Compiled JavaScript (ready to run)
