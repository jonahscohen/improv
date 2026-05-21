---
name: Sidecoach daemon implementation plan
description: Technical approach - SessionStart hook launches background daemon that monitors conversation and executes flows invisibly
type: project
relates_to:
  - session_2026-05-21_sidecoach_architecture_decision.md
---

# Sidecoach Daemon Implementation

## Technical Architecture

**SessionStart Hook** → Launches **Sidecoach Daemon** (stays alive for session)

```
SessionStart Hook (bash)
├─ Initialize Sidecoach:
│  ├─ Load compiled JS: intent-detector, orchestrator, handlers
│  ├─ Set up daemon environment
│  └─ Create pipe/socket for daemon communication
├─ Launch daemon process:
│  └─ sidecoach-daemon.sh (background)
└─ Set session flag: SIDECOACH_ACTIVE

Daemon Loop (while session active)
├─ Watch for user messages (polling/file watch)
├─ On message detected:
│  ├─ Extract utterance
│  ├─ Run IntentDetector.detect()
│  ├─ If flow matched:
│  │  ├─ Execute FlowHandler
│  │  ├─ Collect results
│  │  └─ Inject results into conversation
│  └─ Continue monitoring
└─ Exit when session ends
```

## Implementation Steps

1. **Build sidecoach-daemon.sh** (bash + Node.js):
   - Monitors conversation for new user messages
   - Calls Node.js runner with intent detection
   - Executes flows asynchronously
   - Injects results back into session

2. **Build sidecoach-daemon-sessionstart.sh** (SessionStart hook):
   - Loads daemon script
   - Launches as background process
   - Sets up environment variables
   - Establishes communication channel

3. **Node.js integration**:
   - Load compiled Sidecoach orchestrator
   - Run detect() on user message
   - Execute matched flow
   - Return results formatted for injection

4. **Flow result injection**:
   - Results surface to user in conversation
   - Option to accept/reject flow execution
   - Flows can be silent or prompting

## Status: READY TO BUILD

Files to create:
- `claude/hooks/sidecoach-daemon.sh` - Daemon process
- `sidecoach/bin/sidecoach-monitor.js` - Node.js monitor/executor
- Update SessionStart hook to launch daemon

Intent detector and orchestrator already built and tested ✓
