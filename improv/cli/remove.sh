#!/bin/bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

# Remove .improv marker
rm -f .improv
echo "Removed .improv marker"

# Remove Vite plugin file
if [ -f "improv.dev.js" ]; then
  rm -f improv.dev.js
  echo "Removed improv.dev.js (also remove improv() from vite.config plugins)"
fi

# Remove Drupal library entry
for f in *.libraries.yml; do
  if [ -f "$f" ] && grep -q "improv-dev" "$f"; then
    # Remove the improv-dev block (from comment to the external line)
    sed -i.bak '/# improv:dev/,/type: external/d' "$f"
    rm -f "${f}.bak"
    echo "Removed improv-dev from $f"
  fi
done

echo "Improv removed from project."
