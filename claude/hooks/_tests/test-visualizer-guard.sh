#!/bin/bash
# Regression coverage for visualizer-guard.sh
# Run after editing the hook to confirm it blocks the real failure modes
# and passes a canonical widget.
set -u

HOOK="$(cd "$(dirname "$0")/.." && pwd)/visualizer-guard.sh"
PASS=0
FAIL=0

# wrap widget_code into the PreToolUse stdin envelope and run the hook
run() {
  printf '%s' "$1" | python3 -c '
import json,sys
print(json.dumps({"tool_input":{"widget_code":sys.stdin.read()}}))
' | bash "$HOOK"
}

expect_deny() {
  local name="$1"; local code="$2"
  local out; out="$(run "$code")"
  if printf '%s' "$out" | grep -q '"permissionDecision": "deny"'; then
    echo "PASS  deny: $name"; PASS=$((PASS+1))
  else
    echo "FAIL  deny expected but allowed: $name"; echo "      out=$out"; FAIL=$((FAIL+1))
  fi
}

expect_allow() {
  local name="$1"; local code="$2"
  local out; out="$(run "$code")"
  if [ "$out" = '{}' ]; then
    echo "PASS  allow: $name"; PASS=$((PASS+1))
  else
    echo "FAIL  allow expected but blocked: $name"; echo "      out=$out"; FAIL=$((FAIL+1))
  fi
}

# --- the four failure modes (must deny) ---
expect_deny "CDATA wrapper"            '<![CDATA[<svg></svg>]]>'
expect_deny "hardcoded hex fallback"   '<div style="color: var(--text-200, #333);">x</div>'
expect_deny "rgba fallback"            '<div style="background: var(--bg-200, rgba(0,0,0,0.05));">x</div>'
expect_deny "numbered text token"      '<div style="color: var(--text-100);">x</div>'
expect_deny "numbered bg token"        '<div style="background: var(--bg-000);">x</div>'
expect_deny "numbered danger token"    '<div style="color: var(--danger-300);">x</div>'
expect_deny "accent-main token"        '<div style="color: var(--accent-main-100);">x</div>'
expect_deny "invalid surface-3"        '<div style="background: var(--surface-3);">x</div>'
expect_deny "invalid surface-100"      '<div style="background: var(--surface-100);">x</div>'
expect_deny "font-weight 600 css"      '<div style="font-weight: 600;">x</div>'
expect_deny "font-weight 700 css"      '<div style="font-weight: 700;">x</div>'
expect_deny "font-weight bold"         '<div style="font-weight: bold;">x</div>'
expect_deny "font-weight svg attr"     '<text font-weight="700">x</text>'
# multi-line CSS: var() fallback split across lines inside a <style> block
expect_deny "multiline var fallback"   '<style>.x{ color:
  var(--text-200, #333); }</style>'
expect_deny "multiline numbered token" '<div style="
  color: var(--bg-100);">x</div>'

# --- canonical widgets (must allow) ---
expect_allow "real tokens, no fallback" '<div style="background: var(--surface-2); color: var(--text-primary); font-weight: 500;">x</div>'
expect_allow "valid surface-1"          '<div style="background: var(--surface-1);">x</div>'
expect_allow "valid surface-0"          '<div style="background: var(--surface-0);">x</div>'
expect_allow "tinted role pair"         '<div style="background: var(--bg-danger); color: var(--text-danger);">x</div>'
expect_allow "var fallback to var"      '<div style="color: var(--text-primary, var(--text-secondary));">x</div>'
expect_allow "weight 400"               '<p style="font-weight: 400;">x</p>'
expect_allow "SVG aliases"              '<svg><rect class="c-blue" fill="var(--p)"/></svg>'
expect_allow "border-strong word token" '<div style="border: 0.5px solid var(--border-strong);">x</div>'

echo ""
echo "visualizer-guard: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
