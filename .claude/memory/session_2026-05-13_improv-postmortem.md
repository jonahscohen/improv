---
name: Improv-Claude loop postmortem
description: Thorough postmortem analyzing spec vs reality gaps, architecture mistakes, process failures, and action items from the 2-day improv loop implementation
type: project
relates_to: [session_2026-05-13_improv-changes-panel.md, session_2026-05-13_improv-punchlist.md, session_2026-05-13_improv-loop-phase1.md, decision_improv_shared_prompt_buffer.md, reflection_2026-05-12.md]
---

Postmortem written at docs/superpowers/specs/2026-05-13-improv-postmortem.md

**Three root causes identified:**

1. **Testing verified construction, not behavior.** The ralph loop (13 iterations) checked "does it compile and render?" but never tested full user workflows end-to-end. Send All, Done, and Revert - three of four primary user actions - were broken at ship and only caught during manual user testing after the loop was cancelled.

2. **Architecture designed for single-process, deployed in multi-process.** MCP stdio transport gives each Claude Code session its own server process. Spec treated server as singleton. Required mid-implementation pivot to file-based prompt buffer (prompts.json). The pivot works but introduced race conditions (non-atomic read-clear) and crash recovery gaps (prompts deleted on read, lost if Claude crashes mid-processing).

3. **Phases 3-4 claimed complete at surface level only.** Element highlights work but are fragile (dynamic selectors break). Live preview exists but previews values the user already sees (changes already written to files). Revert exists but doesn't revert (sends a new prompt to Claude instead). The implementations passed compilation checks but not spec compliance checks.

**Key spec vs reality gaps:**
- Claude button is a separate floating element, not in the toolbar pill as specified
- No watch agent automation (user must manually tell Claude to enter loop)
- No preview-before-commit workflow (changes go straight to files)
- No true revert (workaround sends prompt to Claude)
- No focus trapping or focus return in panels
- No diff visualization
- Prompt loss on crash (no retry mechanism)

**What worked well:**
- improv_respond MCP tool schema and WebSocket broadcast
- File-based prompt buffer decision (pragmatic, documented)
- Source reconstruction from dist (painful but necessary)
- Server resilience (stale process detection, port retry)
- Changes panel visual design and UX after punchlist fixes
- Keyboard shortcuts and a11y (ARIA, reduced motion, focus-visible)

**Top action items:**
1. Write a real watch agent goal/config file for Claude Agents
2. Replace fake revert with git-based undo via improv_revert MCP tool
3. Add file locking to prompts.json
4. Implement true preview-before-commit (improv_preview + improv_commit)
5. Add mandatory end-to-end workflow test gate to ralph loop

**Process lesson:** Add a "full workflow test" checkpoint after every 3 ralph loop iterations. The test must chain user actions in sequence (select -> prompt -> send -> review -> done/revert), not verify individual steps in isolation. No polish iterations until all core actions pass the chain test.

**Files produced:**
- docs/superpowers/specs/2026-05-13-improv-postmortem.md (full postmortem)
