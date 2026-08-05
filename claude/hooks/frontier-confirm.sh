#!/bin/bash
# Shared one-shot confirm-token contract for the frontier-model guards
# (frontier-orchestrator-guard.sh + model-router-guard.sh). Sourced, not wired.
#
# SECURITY: the token is armed ONLY by the USER typing "confirm" (captured by the
# frontier-confirm-arm.sh UserPromptSubmit hook), NEVER by the model. That keeps
# frontier-model choice in the user's hands - a frontier session cannot self-lift
# its own gate, because the model's own Bash/Write is what the gate blocks. The
# guards only CONSUME the token here; they never write it.
#
# File: ~/.claude/.frontier-confirm  ->  one line "<model-or-*> <epoch-seconds>".
# TTL: FRONTIER_CONFIRM_TTL seconds (default 120). One-shot: a matching check
# DELETES the token, so one "confirm" lifts exactly one gated action.

FRONTIER_CONFIRM_FILE="${FRONTIER_CONFIRM_FILE:-$HOME/.claude/.frontier-confirm}"
FRONTIER_CONFIRM_TTL="${FRONTIER_CONFIRM_TTL:-120}"

# frontier_check_confirm <want-model-string>
#   0 (and CONSUMES the token) if a live confirm covers <want>; 1 otherwise.
#   Expired/malformed tokens are deleted. A non-matching but still-live token is
#   left in place so it can lift the action it was actually meant for.
frontier_check_confirm() {
  local want="$1" claim line model ts now age valid
  [ -f "$FRONTIER_CONFIRM_FILE" ] || return 1
  # ATOMIC claim: rename the token to a private name. rename(2) is atomic, so of N
  # parallel guard processes exactly ONE wins the mv - the rest see it already gone
  # and fail. This closes the read/check/delete race where two concurrent frontier
  # actions could both consume one "confirm".
  claim="$FRONTIER_CONFIRM_FILE.claim.$$.${RANDOM:-0}"
  mv "$FRONTIER_CONFIRM_FILE" "$claim" 2>/dev/null || return 1
  line=$(head -n1 "$claim" 2>/dev/null)
  model=${line%% *}
  ts=${line##* }
  valid=1
  # Non-numeric timestamp -> invalid, and pin ts to 0 so the arithmetic below is
  # always safe (a raw non-numeric value would blow up inside $(( )) under set -u).
  case "$ts" in ''|*[!0-9]*) valid=0; ts=0 ;; esac
  [ -n "$model" ] || valid=0
  now=$(date +%s 2>/dev/null || echo 0)
  age=$(( now - ts ))
  # now<=0 (no clock), expired, or a token from the future (clock skew) -> invalid.
  if [ "$now" -le 0 ] || [ "$age" -gt "$FRONTIER_CONFIRM_TTL" ] || [ "$age" -lt 0 ]; then valid=0; fi
  if [ "$valid" = 1 ] && { [ "$model" = "*" ] || printf '%s' "$want" | grep -qiF -- "$model"; }; then
    rm -f "$claim"; return 0        # matched -> consumed (one-shot)
  fi
  if [ "$valid" = 1 ]; then
    # A still-live token that does not cover THIS action (scoped to another model):
    # put it back so the action it was meant for can use it. Best-effort restore.
    mv "$claim" "$FRONTIER_CONFIRM_FILE" 2>/dev/null || rm -f "$claim"
    return 1
  fi
  rm -f "$claim"; return 1          # expired/malformed -> discarded
}
