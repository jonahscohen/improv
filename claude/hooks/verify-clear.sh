#!/bin/bash
# PostToolUse hook for Chrome MCP browser tools.
#
# Clears the verification flag ONLY on a REAL screenshot:
#   - mcp__claude-in-chrome__computer with action == "screenshot"
#   - mcp__claude-in-chrome__get_screenshot
#
# A bare navigate / read_page / get_page_text / javascript_tool is NOT visual
# verification and must NOT clear the flag. (2026-06-22: this hook used to clear
# unconditionally on any matched tool, so a mere `navigate` counted as
# verification - one of the holes that let an unverified visual change ship.)
#
# cmux screenshots and Read-of-.png are handled by verify-before-done.sh.

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, os

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

tool = d.get("tool_name", "")
action = (d.get("tool_input", {}) or {}).get("action", "")
flag = os.path.expanduser("~/.claude/.needs-verification")

is_screenshot = tool.endswith("get_screenshot") or (
    tool.endswith("computer") and action == "screenshot"
)

if is_screenshot:
    try:
        os.remove(flag)
    except FileNotFoundError:
        pass

print("{}")
'
