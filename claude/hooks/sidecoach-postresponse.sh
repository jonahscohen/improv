#!/bin/bash

# Sidecoach PostResponse Hook
#
# Checks for cached flow results from daemon and injects them into response
# Results include guidance, checklists, and artifacts from Sidecoach flows
# Runs after Claude generates response, before sending to user

# Only run if Sidecoach is active
if [[ -z "$SIDECOACH_ACTIVE" ]]; then
  exit 0
fi

# Check if result directory exists
# Use SESSION_ID to match daemon's directory naming (not PID)
RESULTS_DIR="/tmp/sidecoach-results-${SIDECOACH_SESSION_ID}"
if [[ ! -d "$RESULTS_DIR" ]]; then
  exit 0
fi

# Find latest result file (most recent by timestamp)
LATEST_RESULT=$(ls -t "$RESULTS_DIR"/result-*.json 2>/dev/null | head -1)

if [[ -z "$LATEST_RESULT" ]]; then
  exit 0
fi

# Read result JSON
RESULT_JSON=$(cat "$LATEST_RESULT")

# Extract flow execution status and message
STATUS=$(echo "$RESULT_JSON" | node -e "try { console.log(JSON.parse(require('fs').readFileSync(0, 'utf8')).status || ''); } catch(e) { }" 2>/dev/null || echo "")
MESSAGE=$(echo "$RESULT_JSON" | node -e "try { console.log(JSON.parse(require('fs').readFileSync(0, 'utf8')).message || ''); } catch(e) { }" 2>/dev/null || echo "")
GUIDANCE=$(echo "$RESULT_JSON" | node -e "try { console.log(JSON.parse(require('fs').readFileSync(0, 'utf8')).guidance || ''); } catch(e) { }" 2>/dev/null || echo "")

# If flow executed successfully, inject results into response
if [[ "$STATUS" == "success" && -n "$MESSAGE" ]]; then
  # Read current response from stdin
  RESPONSE=$(cat)

  # Inject Sidecoach flow results at the beginning
  # Format as a system notification block
  INJECTION=$(cat <<'EOF'
---

**Sidecoach Flow Triggered**

EOF
)

  # Add flow message
  if [[ -n "$MESSAGE" ]]; then
    INJECTION+="$MESSAGE

"
  fi

  # Add guidance/checklist if present
  if [[ -n "$GUIDANCE" ]]; then
    INJECTION+="$GUIDANCE

"
  fi

  # Output injected response
  echo "$INJECTION"
  echo "$RESPONSE"
else
  # No successful flow execution, pass through unchanged
  cat
fi

# Clean up result file
rm -f "$LATEST_RESULT"

exit 0
