#!/bin/bash
set -euo pipefail

IMPROV_SOURCE="${HOME}/.claude/improv/dist/improv-core.js"
PROJECT_ROOT="${1:-.}"

cd "$PROJECT_ROOT"

if [ ! -f "$IMPROV_SOURCE" ]; then
  echo "ERROR: improv-core.js not found at $IMPROV_SOURCE"
  echo "Run: ampersand --only improv"
  exit 1
fi

echo "Detecting project stack..."

# Find the right public directory to copy into
PUBLIC_DIR=""
if [ -d "public" ]; then PUBLIC_DIR="public";
elif [ -d "static" ]; then PUBLIC_DIR="static";
elif [ -d "web" ]; then PUBLIC_DIR="web";
elif [ -d "docroot" ]; then PUBLIC_DIR="docroot";
elif [ -d "dist" ]; then PUBLIC_DIR="dist";
elif [ -d "www" ]; then PUBLIC_DIR="www";
fi

if [ -z "$PUBLIC_DIR" ]; then
  mkdir -p public
  PUBLIC_DIR="public"
  echo "Created public/ directory"
fi

# Copy the script into the project
cp "$IMPROV_SOURCE" "$PUBLIC_DIR/improv-core.js"
echo "Copied improv-core.js to $PUBLIC_DIR/"

# Add to .gitignore if not already there
if [ -f ".gitignore" ]; then
  if ! grep -q "improv-core.js" ".gitignore"; then
    echo "" >> .gitignore
    echo "# improv dev tool" >> .gitignore
    echo "$PUBLIC_DIR/improv-core.js" >> .gitignore
    echo "Added to .gitignore"
  fi
else
  echo "$PUBLIC_DIR/improv-core.js" > .gitignore
  echo "Created .gitignore"
fi

# Create .improv marker
echo "{\"dir\":\"$PUBLIC_DIR\",\"initialized\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > .improv
echo "Created .improv marker"

# Stack-specific wiring
if [ -f "vite.config.ts" ] || [ -f "vite.config.js" ] || [ -f "vite.config.mjs" ]; then
  echo ""
  echo "Detected: Vite"
  echo "Add to your index.html <head>:"
  echo "  <script src=\"/$PUBLIC_DIR/improv-core.js\"></script>"

elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ] || [ -f "next.config.ts" ]; then
  echo ""
  echo "Detected: Next.js"
  echo "Add to your root layout <head>:"
  echo "  <Script src=\"/improv-core.js\" strategy=\"afterInteractive\" />"

elif ls *.info.yml 2>/dev/null | head -1 > /dev/null 2>&1; then
  THEME_INFO=$(ls *.info.yml 2>/dev/null | head -1)
  THEME_NAME="${THEME_INFO%.info.yml}"
  echo ""
  echo "Detected: Drupal theme ($THEME_NAME)"

  if [ -f "${THEME_NAME}.libraries.yml" ]; then
    if ! grep -q "improv-dev" "${THEME_NAME}.libraries.yml"; then
      cat >> "${THEME_NAME}.libraries.yml" << DEOF

# improv:dev - remove for production
improv-dev:
  js:
    /improv-core.js: {}
DEOF
      echo "Added improv-dev library to ${THEME_NAME}.libraries.yml"
      echo "Add {{ attach_library('${THEME_NAME}/improv-dev') }} to your page template"
    else
      echo "improv-dev already in ${THEME_NAME}.libraries.yml"
    fi
  else
    echo "Add to your page template:"
    echo "  <script src=\"/improv-core.js\"></script>"
  fi

elif [ -f "wp-config.php" ]; then
  echo ""
  echo "Detected: WordPress"
  echo "Add to functions.php:"
  echo "  if (WP_DEBUG) { wp_enqueue_script('improv-dev', '/improv-core.js'); }"

else
  echo ""
  echo "Add to your HTML <head>:"
  echo "  <script src=\"/$PUBLIC_DIR/improv-core.js\"></script>"
fi

echo ""
echo "Done. Improv toolbar will appear on page load."
echo "  CMD+SHIFT+.  toggle toolbar"
echo "  Escape        exit current mode"
echo "  Remove with:  improv-remove"
