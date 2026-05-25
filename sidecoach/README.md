# Sidecoach v3: Design System Guardian

Sidecoach is a design system orchestration engine that chains design and development workflows into phases. It supports both explicit slash commands and natural-language intent detection, enforces prerequisites at phase boundaries, and runs the right flows in sequence.

There are two parallel slash command surfaces:

- **Phase commands** - sidecoach native vocabulary (`research`, `craft`, `review`, plus special verbs like `clone`, `migrate`, `refactor`, `type`, `motion`, `reference`, `comprehensive`, `rapid`).
- **Impeccable parity verbs** - 22 commands that mirror impeccable's vocabulary 1:1 and route through the same flow chains. The orchestrator appends per-verb parity guidance (impeccable's section names verbatim, plus sidecoach's parity-plus extensions: BuildReport, taste validation, polish-standard domain grades, category-reflex detector, memory entry).

You can still describe what you're building in natural language and the intent detector will route, but the slash commands are the supported primary interface.

## What Sidecoach Does

1. **Intent Detection** - Understands natural language intent from your utterance
2. **Prerequisite Enforcement** - Hard-blocks flows when PRODUCT.md/DESIGN.md are missing or incomplete
3. **Phase Gating** - Enforces tier progression (can't run polish before build completes)
4. **Flow Chaining** - Automatically chains related flows (Run Flow A → recommends B → recommends C)
5. **Regression Detection** - Detects when a flow produces worse output than prior runs
6. **Design Debt Tracking** - Auto-logs deferred issues and surfaces them at session start
7. **Persona-Based Critique** - Extracts project-specific personas from PRODUCT.md for design review

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

5. **ImpeccableDetectBridge** - CLI integration with `npx impeccable detect`
   - Runs 28-rule static analyzer during FlowK (Multi-Lens Audit)
   - Includes real findings in guidance + checklist

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
parseSlashCommand() → 'polish' matches impeccable registry → flowJ_tactical_polish + flowM_responsive_validation
  (NL utterances flow through Intent Detector instead, returning the same flow IDs by confidence match.)
  ↓
Orchestrator runs the flow chain, then appends the registry's guidanceAppend, parityChecklist, and parityPlus content so the response speaks in impeccable's voice (sections like "Design System Discovery", "Pre-Polish Assessment", "Polish Systematically") while carrying sidecoach's extensions (polish-standard domain grade, taste validation, BuildReport, memory entry).
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

- **Slash commands** are the supported primary interface for direct, intentional invocation. Use `/sidecoach polish login-form` when you know what you want. Two parallel vocabularies (phase commands and the 22 impeccable parity verbs) share the same underlying flows.
- **Natural language intent detection** still works for unscripted descriptions. The intent detector routes free-form utterances to the same flow chains, with confidence scoring and phase-gate prerequisites.
- **No "what should I do next?" friction.** The orchestrator chains related flows, enforces prerequisites at phase boundaries, and writes a session memory entry so the next call starts with full context.
- **`/sidecoach list` and `/sidecoach help <verb>`** make the surface discoverable: list shows phase commands and the 22 verbs grouped by phase; help dumps the registry detail for any specific verb.

## Slash command surface

### Phase commands (sidecoach native vocabulary)
- `/sidecoach research` - explore design foundations (flows A-E + 4 + 7)
- `/sidecoach craft` / `/sidecoach implement` - build tokens, components, motion, accessibility (flows F-I + 9 + 10 + 11)
- `/sidecoach review` - polish, audit, critique, validate (flows J-N + 2 + 3 + 5 + 12 + 13)
- `/sidecoach clone`, `constrain`, `migrate`, `refactor`, `type`, `motion`, `reference`, `comprehensive`, `rapid` - special-case routings
- `/sidecoach list` - shows every command grouped by phase
- `/sidecoach help <verb>` - per-verb registry detail (description, phase, impeccable reference path, flow chain, parity checklist, sidecoach parity-plus additions)

### Setup
- `/sidecoach teach [brief]` - brief-driven hybrid; parses what's in the brief, asks targeted questions for gaps, writes PRODUCT.md
- `/sidecoach document` - scans project HTML/CSS, writes Google-spec DESIGN.md (YAML token frontmatter + six-section body)

### Impeccable parity verbs (22 commands)
- Shape and strategy: `shape`, `onboard`
- Build: `craft`, `animate`, `bolder`, `colorize`, `delight`, `layout`, `overdrive`, `typeset`, `clarify`
- Review: `audit`, `critique`, `polish`, `harden`, `adapt`, `optimize`
- Tone: `quieter`, `distill`
- Docs: `document`, `extract`
- Tactical: `live`

Each verb routes to a sidecoach flow chain through `IMPECCABLE_VERB_REGISTRY` in `src/impeccable-command-registry.ts`. The orchestrator appends the registry entry's `guidanceAppend`, `parityChecklist` (impeccable section names verbatim), and `parityPlus` (sidecoach additions) so the response matches impeccable's voice without losing sidecoach's validators, BuildReport, taste validation, and memory.

## Status

- 36 flows implemented (22 flows A-V + 14 legacy 1-14).
- 22 impeccable parity verbs wired (Sprint 8).
- Daemon infrastructure complete; sessionstart / postuserprompt / postresponse hooks registered.
- Slash command router + intent detector both route through the same FlowExecutionEngine.
- `sprint8-impeccable-parity` 197/197 PASS; `sprint8-list-and-help` 13/13 PASS; tsc clean.
- Production ready.

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
- `claude/hooks/sidecoach-*.sh` - Hook scripts
- `dist/` - Compiled JavaScript (ready to run)
