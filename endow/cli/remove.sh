#!/bin/bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

if [ ! -f ".endow" ]; then
  echo "No .endow marker found in this directory."
  exit 0
fi

# Read the public dir from marker
PUBLIC_DIR=$(python3 -c "import json; print(json.load(open('.endow')).get('dir','public'))" 2>/dev/null || echo "public")

# Remove the script
if [ -f "$PUBLIC_DIR/endow-core.js" ]; then
  rm "$PUBLIC_DIR/endow-core.js"
  echo "Removed $PUBLIC_DIR/endow-core.js"
fi

# Remove Drupal library entry
for f in *.libraries.yml; do
  if [ -f "$f" ] && grep -q "endow-dev" "$f"; then
    sed -i.bak '/# endow:dev/,/endow-core\.js/d' "$f"
    rm -f "${f}.bak"
    echo "Removed endow-dev from $f"
  fi
done

# Remove marker
rm -f .endow
echo "Removed .endow marker"
echo "Endow removed from project."
