---
name: Improv loop Phase 1 deployed
description: Watch agent + improv_respond tool + browser response toast built and deployed
type: project
relates_to: [session_2026-05-13_improv-claude-connection.md, session_2026-05-12_improv-source-reconstruction.md]
---

Phase 1 of the improv-claude loop implemented by Claude Agents (worktree), merged to main manually.

**What was built:**

Server (mcp-tools.ts):
- Prompt IDs: `prompt-1`, `prompt-2`, etc. assigned on `push_prompt`
- `improv_watch` now detects new prompts (was only changes/annotations)
- `improv_get_prompts` clears buffer after read and prefixes with `[prompt-N]`
- New `improv_respond` tool: accepts promptId, summary, filesChanged, changes[], status, question; broadcasts `improv_response` to browser

Browser (core/index.ts):
- `_changeHistory` array on ImprovCore
- Loads history from `localStorage('improv-change-history')` on init
- Listens for `improv_response` WebSocket events, stores in history + localStorage
- `_showResponseToast(message, status)`: green check for completed, info for needsInfo, red X for failed

Skill (~/.claude/skills/improv/SKILL.md):
- Watch loop instructions for Claude agent/goal
- Updated MCP tools table

**Verified:** Browser loads with `_changeHistory` and `_showResponseToast` present, transport connected.

**Still needs:**
- MCP server restart to pick up new mcp-tools.ts (server reads from installed location)
- End-to-end test: submit prompt from browser, Claude watches and responds
- Commit + push to remote

**Files touched:**
- improv/server/mcp-tools.ts
- improv/core/index.ts
- ~/.claude/skills/improv/SKILL.md
