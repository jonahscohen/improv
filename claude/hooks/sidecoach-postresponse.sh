#!/usr/bin/env bash
# Sidecoach Stop/PostResponse hook - injects daemon results into response

STATE_FILE="$HOME/.claude/.sidecoach-state"

if [[ ! -f "$STATE_FILE" ]]; then exit 0; fi
source "$STATE_FILE"
if [[ "$ACTIVE" != "1" ]]; then exit 0; fi

RESULTS_DIR="/tmp/sidecoach-results-$SESSION_ID"
if [[ ! -d "$RESULTS_DIR" ]]; then exit 0; fi

LATEST=$(ls -t "$RESULTS_DIR"/result-*.json 2>/dev/null | head -1)
if [[ -z "$LATEST" ]]; then exit 0; fi

LATEST_FILE="$LATEST" node -e "
  const fs = require('fs');
  let result = null;
  try { result = JSON.parse(fs.readFileSync(process.env.LATEST_FILE, 'utf8')); } catch (e) { result = null; }
  if (result) {
    // Surface the clean panel (the user surface) REGARDLESS of success - an inconclusive
    // or failed audit must be SHOWN, not hidden. renderedPanel is the staged panel from
    // the monitor's --json output; .panel is the legacy card; message is the last resort.
    const panel = result.renderedPanel || result.panel;
    if (panel) {
      console.log('\n' + panel);
    } else if (result.message) {
      console.log('\n[Sidecoach: ' + (result.detectedFlow && result.detectedFlow.flowName || 'flow') + ']\n' + result.message);
    }
  }
  try { fs.unlinkSync(process.env.LATEST_FILE); } catch (e) {}
" 2>/dev/null

exit 0
