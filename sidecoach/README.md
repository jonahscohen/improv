# Sidecoach: Invisible Workflow Automation

Sidecoach is a system that automatically detects and executes design/development workflows based on natural conversation. Instead of slash commands (`/impeccable`, `/make-interfaces-feel-better`), you simply write naturally about what you need, and Sidecoach detects your intent and guides you through the appropriate workflow.

## Architecture

### Core Components

1. **Intent Detector** (`src/intent-detector.ts`)
   - Rule-based pattern matching for trigger detection
   - Conflict resolution via collision avoidance rules
   - 100% accuracy on test utterances

2. **Flow Handlers** (14 total)
   - `flow-handlers-core.ts`: High-priority flows (2, 5, 7, 10)
   - `flow-handlers-extended.ts`: Extended flows (1, 3, 4, 6, 8, 9, 11, 12, 13, 14)
   - Each handler returns: guidance, checklists, next steps, artifacts

3. **Orchestrator** (`src/sidecoach-orchestrator.ts`)
   - Routes utterances to appropriate handlers
   - Manages handler registry
   - Returns structured FlowExecutionResult

4. **Daemon System** (shell scripts)
   - `claude/hooks/sidecoach-sessionstart.sh`: Launches daemon at session start
   - `sidecoach/bin/sidecoach-daemon.sh`: Background process reading from named pipe
   - `claude/hooks/sidecoach-postuserp.sh`: Feeds user messages to daemon
   - `claude/hooks/sidecoach-postresponse.sh`: Injects results into response

## The 14 Flows

| # | Name | Trigger | Purpose |
|---|------|---------|---------|
| 1 | Clone/Match | "match from [source]", "clone [component]" | Pixel-perfect 1:1 replication |
| 2 | Polish/Enhance | "make this feel better", "polish [element]" | Add feeling and microinteractions |
| 3 | Audit Page | "audit [section]", "find issues on [page]" | Technical issue discovery |
| 4 | Explore/Discovery | "explore [concept]", "experiment with [area]" | Open-ended brainstorming |
| 5 | Review/QA | "review this PR", "comprehensive check" | Multi-lens QA framework |
| 6 | Constraint Design | "design [element] for [constraint]" | Design under explicit limits |
| 7 | Design Component | "design a [component]", "create [element]" | New component creation + QA triad |
| 8 | Refactor/Improve | "refactor [section]", "[area] feels cluttered" | Layout/structure improvement |
| 9 | Make Accessible | "make [area] accessible", "a11y audit" | WCAG 2.1 AA compliance |
| 10 | Implement Design | "implement [component]", "code this design" | Design-to-code workflow |
| 11 | Extract Tokens | "extract [pattern]", "make [pattern] reusable" | Pattern extraction into tokens |
| 12 | Responsive Review | "responsive check", "test breakpoints" | Breakpoint and device testing |
| 13 | Rapid Iteration | "iterate on [element]", "try variations" | Goal-driven refinement cycle |
| 14 | Migration | "migrate [component] to", "replace [old] with [new]" | API change and component migration |

## How It Works

```
User: "make this interface feel better"
  ↓
SessionStart hook → Launches daemon in background
  ↓
PostUserPrompt hook → Sends utterance to daemon via named pipe
  ↓
Daemon → sidecoach-monitor.js
  ↓
Intent Detector → Matches "make this interface feel better" pattern
  ↓
Detected: flow2_polish_enhance (confidence: 0.92)
  ↓
Orchestrator → Gets Flow2PolishHandler
  ↓
Handler.execute() → Returns:
  - message: "Initiating Polish & Enhancement workflow"
  - guidance: 4 guidance items
  - checklist: 14 tactical improvements
  - nextSteps: 7 action items
  ↓
Result cached to /tmp/sidecoach-results-*/
  ↓
PostResponse hook → Reads result, injects into response
  ↓
User sees: Sidecoach results in their response
```

## Each Flow Returns

- **Guidance**: What you should know about this workflow
- **Checklists**: 6-14 items (mix of required/optional) to work through
- **Next Steps**: Concrete actions to take
- **Artifacts**: Templates, comparison frameworks, etc.

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

**Natural Conversation Should Evoke Sequences of Events**

Sidecoach replaces command-based workflows with conversation-driven ones:
- No slash commands
- No "what should I do next?" friction
- Results appear naturally in conversation flow
- Users stay in their natural thought process

## Status

✓ All 14 flows implemented
✓ Daemon infrastructure complete
✓ Intent detection verified
✓ System tests passing
✓ Ready for deployment

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
