#!/bin/bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

if [ ! -f ".improv" ]; then
  echo "No .improv marker found in this directory."
  exit 0
fi

# Read the public dir from marker
PUBLIC_DIR=$(python3 -c "import json; print(json.load(open('.improv')).get('dir','public'))" 2>/dev/null || echo "public")

# Remove the script
if [ -f "$PUBLIC_DIR/improv-core.js" ]; then
  rm "$PUBLIC_DIR/improv-core.js"
  echo "Removed $PUBLIC_DIR/improv-core.js"
fi

# Remove Drupal library entry
for f in *.libraries.yml; do
  if [ -f "$f" ] && grep -q "improv-dev" "$f"; then
    sed -i.bak '/# improv:dev/,/improv-core\.js/d' "$f"
    rm -f "${f}.bak"
    echo "Removed improv-dev from $f"
  fi
done

# Remove marker
rm -f .improv
echo "Removed .improv marker"
echo "Improv removed from project."
