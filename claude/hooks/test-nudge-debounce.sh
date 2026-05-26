#!/bin/bash
# Test script for memory-nudge.sh and verify-before-done.sh debouncing.
# Verifies:
#   - Nudge text appears when no recent satisfying action
#   - Nudge text is suppressed when satisfying action happened within DEBOUNCE_SECONDS
#   - Flag-setting/clearing still works regardless of debounce
#   - Memory file edits clear dirty flag (no nudge)
#   - Screenshot Reads clear verify flag (no nudge)
#
# Exits 0 on all-pass, non-zero on any failure.
# Restores flag/timestamp files to pre-test state.

set -u

HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MEMORY_NUDGE="$HOOK_DIR/memory-nudge.sh"
VERIFY_HOOK="$HOOK_DIR/verify-before-done.sh"

DIRTY_FLAG="$HOME/.claude/.memory-dirty"
VERIFY_FLAG="$HOME/.claude/.needs-verification"
LAST_MEM="$HOME/.claude/.last-memory-write"
LAST_SCR="$HOME/.claude/.last-screenshot-read"

# --- Backup current state -----------------------------------------------------
BACKUP_DIR="$(mktemp -d)"
for f in "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"; do
    if [ -e "$f" ]; then
        cp -p "$f" "$BACKUP_DIR/$(basename "$f")"
    fi
done

restore_state() {
    rm -f "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"
    for f in "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"; do
        base="$BACKUP_DIR/$(basename "$f")"
        if [ -e "$base" ]; then
            cp -p "$base" "$f"
        fi
    done
    rm -rf "$BACKUP_DIR"
}

trap restore_state EXIT

PASS_COUNT=0
FAIL_COUNT=0

pass() {
    PASS_COUNT=$((PASS_COUNT + 1))
    printf "PASS  %s\n" "$1"
}

fail() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
    printf "FAIL  %s\n" "$1"
}

# Reset all state before each case
reset_all() {
    rm -f "$DIRTY_FLAG" "$VERIFY_FLAG" "$LAST_MEM" "$LAST_SCR"
}

# Run a hook with a JSON payload and capture stdout
run_hook() {
    local hook="$1"
    local payload="$2"
    printf '%s' "$payload" | bash "$hook"
}

# Check whether a JSON output contains the nudge text
has_nudge() {
    local out="$1"
    local needle="$2"
    case "$out" in
        *"$needle"*) return 0 ;;
        *) return 1 ;;
    esac
}

# =============================================================================
# memory-nudge.sh tests
# =============================================================================

PROJECT_EDIT_PAYLOAD='{"tool_name":"Edit","tool_input":{"file_path":"/tmp/fake-project/src/file.ts"}}'
MEMORY_EDIT_PAYLOAD='{"tool_name":"Edit","tool_input":{"file_path":"/tmp/fake-project/.claude/memory/session_test.md"}}'

# --- Case A: project edit, no recent memory write -> nudge present ----------
reset_all
OUT="$(run_hook "$MEMORY_NUDGE" "$PROJECT_EDIT_PAYLOAD")"
if has_nudge "$OUT" "PROJECT FILE CHANGED"; then
    pass "memory-nudge Case A: cold project edit emits nudge"
else
    fail "memory-nudge Case A: expected nudge, got: $OUT"
fi
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge Case A: dirty flag set"
else
    fail "memory-nudge Case A: dirty flag missing"
fi

# --- Case B: recent memory write -> nudge SUPPRESSED, flag still set --------
reset_all
touch "$LAST_MEM"
OUT="$(run_hook "$MEMORY_NUDGE" "$PROJECT_EDIT_PAYLOAD")"
if has_nudge "$OUT" "PROJECT FILE CHANGED"; then
    fail "memory-nudge Case B: nudge should be suppressed, got: $OUT"
else
    pass "memory-nudge Case B: nudge suppressed within debounce window"
fi
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge Case B: dirty flag still set despite debounce"
else
    fail "memory-nudge Case B: dirty flag should still be set"
fi

# --- Case C: memory edit -> flag cleared, no nudge --------------------------
reset_all
touch "$DIRTY_FLAG"   # pretend project was dirty
OUT="$(run_hook "$MEMORY_NUDGE" "$MEMORY_EDIT_PAYLOAD")"
if has_nudge "$OUT" "PROJECT FILE CHANGED"; then
    fail "memory-nudge Case C: memory edit should not nudge, got: $OUT"
else
    pass "memory-nudge Case C: memory edit emits no nudge"
fi
if [ -e "$DIRTY_FLAG" ]; then
    fail "memory-nudge Case C: dirty flag should have been cleared"
else
    pass "memory-nudge Case C: dirty flag cleared by memory edit"
fi
if [ -e "$LAST_MEM" ]; then
    pass "memory-nudge Case C: last-memory-write timestamp recorded"
else
    fail "memory-nudge Case C: last-memory-write timestamp missing"
fi

# --- Case A2 (Bash variant): bash write, no recent memory -> nudge present ---
reset_all
BASH_WRITE_PAYLOAD='{"tool_name":"Bash","tool_input":{"command":"cp foo.txt bar.txt"}}'
OUT="$(run_hook "$MEMORY_NUDGE" "$BASH_WRITE_PAYLOAD")"
if has_nudge "$OUT" "BASH WROTE FILES"; then
    pass "memory-nudge Bash Case A: cold bash write emits nudge"
else
    fail "memory-nudge Bash Case A: expected nudge, got: $OUT"
fi

# --- Case B2 (Bash variant): recent memory -> nudge suppressed --------------
reset_all
touch "$LAST_MEM"
OUT="$(run_hook "$MEMORY_NUDGE" "$BASH_WRITE_PAYLOAD")"
if has_nudge "$OUT" "BASH WROTE FILES"; then
    fail "memory-nudge Bash Case B: nudge should be suppressed, got: $OUT"
else
    pass "memory-nudge Bash Case B: nudge suppressed within debounce window"
fi
if [ -e "$DIRTY_FLAG" ]; then
    pass "memory-nudge Bash Case B: dirty flag still set"
else
    fail "memory-nudge Bash Case B: dirty flag should still be set"
fi

# =============================================================================
# verify-before-done.sh tests
# =============================================================================

CODE_EDIT_PAYLOAD='{"tool_name":"Edit","tool_input":{"file_path":"/tmp/fake-project/src/file.ts"}}'
SCREENSHOT_READ_PAYLOAD='{"tool_name":"Read","tool_input":{"file_path":"/tmp/screenshot.png"}}'

# --- Case D-A: code edit, no recent screenshot -> verify nudge present ------
reset_all
OUT="$(run_hook "$VERIFY_HOOK" "$CODE_EDIT_PAYLOAD")"
if has_nudge "$OUT" "CODE FILE CHANGED"; then
    pass "verify-hook Case A: cold code edit emits verify nudge"
else
    fail "verify-hook Case A: expected verify nudge, got: $OUT"
fi
if [ -e "$VERIFY_FLAG" ]; then
    pass "verify-hook Case A: verify flag set"
else
    fail "verify-hook Case A: verify flag missing"
fi

# --- Case D-B: recent screenshot read -> nudge suppressed, flag still set ---
reset_all
touch "$LAST_SCR"
OUT="$(run_hook "$VERIFY_HOOK" "$CODE_EDIT_PAYLOAD")"
if has_nudge "$OUT" "CODE FILE CHANGED"; then
    fail "verify-hook Case B: nudge should be suppressed, got: $OUT"
else
    pass "verify-hook Case B: nudge suppressed within debounce window"
fi
if [ -e "$VERIFY_FLAG" ]; then
    pass "verify-hook Case B: verify flag still set despite debounce"
else
    fail "verify-hook Case B: verify flag should still be set"
fi

# --- Case D-C: screenshot Read -> verify flag cleared, no nudge -------------
reset_all
touch "$VERIFY_FLAG"   # pretend something needed verification
OUT="$(run_hook "$VERIFY_HOOK" "$SCREENSHOT_READ_PAYLOAD")"
if has_nudge "$OUT" "CODE FILE CHANGED"; then
    fail "verify-hook Case C: screenshot read should not nudge, got: $OUT"
else
    pass "verify-hook Case C: screenshot read emits no nudge"
fi
if [ -e "$VERIFY_FLAG" ]; then
    fail "verify-hook Case C: verify flag should have been cleared"
else
    pass "verify-hook Case C: verify flag cleared by screenshot read"
fi
if [ -e "$LAST_SCR" ]; then
    pass "verify-hook Case C: last-screenshot-read timestamp recorded"
else
    fail "verify-hook Case C: last-screenshot-read timestamp missing"
fi

# =============================================================================
# Summary
# =============================================================================
printf "\n----- Summary -----\n"
printf "Passed: %d\n" "$PASS_COUNT"
printf "Failed: %d\n" "$FAIL_COUNT"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
