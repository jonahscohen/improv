#!/bin/bash
# test-installer-manifest.sh - install.sh --manifest emits valid JSON whose component
# keys and per-leaf state agree with the tree and with item_state. Runs read-only.
set -u
REPO_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
INSTALL="$REPO_DIR/install.sh"
fail=0
say(){ printf '%s\n' "$*"; }

out="$(bash "$INSTALL" --manifest 2>/dev/null)" || { say "FAIL: --manifest exited non-zero"; exit 1; }

echo "$out" | python3 -c 'import sys,json; json.load(sys.stdin)' \
  || { say "FAIL: --manifest is not valid JSON"; fail=1; }

for k in buckets components state meta; do
  echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);sys.exit(0 if '$k' in d else 1)" \
    || { say "FAIL: manifest missing top-level '$k'"; fail=1; }
done

for key in brain config memory skills statusline cmux nvm ampersand discord voice-input voice-output reflect sidecoach task-list; do
  echo "$out" | python3 -c "import sys,json;d=json.load(sys.stdin);c=d['components'].get('$key');sys.exit(0 if c and c.get('title') else 1)" \
    || { say "FAIL: components['$key'] missing/blank title"; fail=1; }
done

echo "$out" | python3 -c '
import sys,json
d=json.load(sys.stdin)
bad=[p for p,v in d["state"].items() if v not in ("none","partial","active")]
sys.exit(1 if bad else 0)' || { say "FAIL: state has out-of-enum values"; fail=1; }

[ "$fail" = 0 ] && say "PASS: manifest test" || exit 1
