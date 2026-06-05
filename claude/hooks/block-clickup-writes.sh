#!/usr/bin/env bash
# block-clickup-writes.sh
# Permanently DENY every write/mutating ClickUp MCP tool call.
# Read-only ClickUp tools (get_*, list_*, search*, filter*, find_*, resolve_*)
# pass through untouched.
#
# Installed 2026-06-02 per explicit user policy: "You cannot and are forbidden
# from writing anything to ClickUp." Wired as a PreToolUse hook (matcher
# mcp__claude_ai_ClickUp__clickup_) in ~/.claude/settings.json.
#
# Reads the PreToolUse JSON on stdin, denies via permissionDecision.

input="$(cat)"
tool="$(printf '%s' "$input" | jq -r '.tool_name // empty' 2>/dev/null)"

case "$tool" in
  mcp__claude_ai_ClickUp__clickup_create_*|\
  mcp__claude_ai_ClickUp__clickup_update_*|\
  mcp__claude_ai_ClickUp__clickup_delete_*|\
  mcp__claude_ai_ClickUp__clickup_add_*|\
  mcp__claude_ai_ClickUp__clickup_remove_*|\
  mcp__claude_ai_ClickUp__clickup_move_*|\
  mcp__claude_ai_ClickUp__clickup_send_*|\
  mcp__claude_ai_ClickUp__clickup_attach_*|\
  mcp__claude_ai_ClickUp__clickup_start_time_tracking|\
  mcp__claude_ai_ClickUp__clickup_stop_time_tracking)
    printf '%s' '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"ClickUp writes are permanently forbidden by user policy (block-clickup-writes hook). Read-only ClickUp tools are allowed. Do NOT retry as a write - use the /task-list plugin or report back to the user instead."}}'
    exit 0
    ;;
esac

# Read-only or non-matching ClickUp tool: allow.
exit 0
