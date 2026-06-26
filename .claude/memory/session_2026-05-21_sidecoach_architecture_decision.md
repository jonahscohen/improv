---
name: Sidecoach architecture decision - SessionStart hook
description: Integration architecture chosen - SessionStart hook with conversation watcher monitors utterances, detects intents, auto-executes flows
type: decision
---

# Sidecoach Integration Architecture

## Decision Made: SessionStart Hook with Conversation Watcher

**Chosen option:** Sidecoach activates at session start, monitors conversation for trigger utterances in real-time, detects intent patterns, and auto-executes matching flows.

## Why This Approach

- **Invisible to user** - No slash commands, natural conversation triggers flows
- **Real-time detection** - Watches conversation continuously
- **Consolidates workflows** - Replaces /oracle and /make-interfaces-feel-better
- **Matches architectural vision** - "Natural conversation should evoke sequence of events"

## Architecture

```
SessionStart Hook
├─ Load SidecoachOrchestrator
├─ Initialize IntentDetector
├─ Load all FlowHandlers
├─ Set flag: Sidecoach active
└─ Monitor conversation (via PostUserPrompt or similar)
    ├─ On each user message
    ├─ Run IntentDetector.detect()
    ├─ If match found
    ├─ Execute matching FlowHandler
    └─ Return flow results to user
```

## Implementation Plan

1. Build SessionStart hook that:
   - Loads Sidecoach orchestrator (TypeScript compiled to JS)
   - Initializes intent detector + handlers
   - Sets up message interception

2. Implement conversation monitor:
   - Intercepts user messages before Claude processes
   - Runs intent detection
   - Executes flows if detected
   - Returns results to user

3. Flow execution modes:
   - Silent: Run in background, user sees only results
   - Prompt: Ask "should I run this flow?" before executing
   - Auto: Automatically execute without prompting

4. Integration with flow results:
   - Flows return guidance, checklists, artifacts
   - Hook packages results and surfaces to user
   - User can accept, modify, or reject flow execution

## Next Steps

1. Build SessionStart hook implementation (bash + Node.js)
2. Create conversation monitor component
3. Wire Sidecoach orchestrator to monitor
4. Test with sample utterances
5. Verify flows execute correctly
