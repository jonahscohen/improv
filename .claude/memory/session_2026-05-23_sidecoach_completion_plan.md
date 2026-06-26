---
name: sidecoach completion plan
description: Plan written to make Sidecoach 100% complete and accessible - 5 tasks covering SKILL.md, hook fix, settings wiring, install.sh block, and E2E verification
type: project
relates_to: [session_2026_05_23_handoff_for_next_session.md, feedback_sidecoach_vs_old_pipeline.md, mapping_23_commands_to_flows.md]
---

Plan saved at: `/Users/spare3/.claude/plans/iterative-greeting-noodle.md`

5 tasks:
1. Create SKILL.md (23 Oracle-equivalent commands, routes to FlowExecutionEngine via sidecoach-monitor.js)
2. Fix daemon hooks (replace env-var state with ~/.claude/.sidecoach-state flag file)
3. Wire hooks in settings.json (SessionStart, UserPromptSubmit, Stop)
4. Write install.sh sidecoach block (npm build, skill symlink, hook symlinks, settings wiring)
5. End-to-end verification

**Why:** Sidecoach backend was 100% complete but 0% accessible. No SKILL.md, broken daemon hooks (env vars don't persist between hook invocations), hooks not registered, no install block.

**Key finding from this session:** The old pipeline produced better landing pages than Sidecoach. SKILL.md quality is critical - it must force the model to use engine output correctly, not just expose commands mechanically.
