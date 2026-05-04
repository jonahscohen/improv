#!/bin/bash
set -euo pipefail

IMPROV_SOURCE="${HOME}/.claude/improv/dist/improv-core.js"
PROJECT_ROOT="${1:-.}"

cd "$PROJECT_ROOT"

if [ ! -f "$IMPROV_SOURCE" ]; then
  echo "ERROR: improv-core.js not found. Run: ampersand --only improv"
  exit 1
fi

# Find the public directory
PUBLIC_DIR=""
for d in public static web docroot www; do
  if [ -d "$d" ]; then PUBLIC_DIR="$d"; break; fi
done
if [ -z "$PUBLIC_DIR" ]; then
  mkdir -p public
  PUBLIC_DIR="public"
fi

# Copy script into project
cp "$IMPROV_SOURCE" "$PUBLIC_DIR/improv-core.js"

# Gitignore it
if [ -f ".gitignore" ]; then
  grep -q "improv-core.js" ".gitignore" || echo "$PUBLIC_DIR/improv-core.js" >> .gitignore
else
  echo "$PUBLIC_DIR/improv-core.js" > .gitignore
fi

# Create marker
echo "{\"dir\":\"$PUBLIC_DIR\",\"initialized\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > .improv

# Now actually wire it in - no manual steps

if [ -f "vite.config.ts" ] || [ -f "vite.config.js" ] || [ -f "vite.config.mjs" ]; then
  # Vite: add script tag to index.html
  if [ -f "index.html" ]; then
    if ! grep -q "improv-core" "index.html"; then
      sed -i.bak 's|</head>|  <script src="/'"$PUBLIC_DIR"'/improv-core.js"></script>\n  </head>|' index.html
      rm -f index.html.bak
      echo "Added script tag to index.html"
    fi
  fi

elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ] || [ -f "next.config.ts" ]; then
  # Next.js: find root layout and add Script import
  LAYOUT=""
  for f in app/layout.tsx app/layout.jsx app/layout.js src/app/layout.tsx src/app/layout.jsx; do
    if [ -f "$f" ]; then LAYOUT="$f"; break; fi
  done
  if [ -n "$LAYOUT" ]; then
    if ! grep -q "improv-core" "$LAYOUT"; then
      # Add Script import if not present
      if ! grep -q "next/script" "$LAYOUT"; then
        sed -i.bak '1s|^|import Script from "next/script";\n|' "$LAYOUT"
        rm -f "${LAYOUT}.bak"
      fi
      # Add Script tag before closing body or html tag
      sed -i.bak 's|</body>|<Script src="/improv-core.js" strategy="afterInteractive" />\n      </body>|' "$LAYOUT"
      rm -f "${LAYOUT}.bak"
      echo "Added Improv Script to $LAYOUT"
    fi
  else
    echo "WARNING: Could not find Next.js layout file. Add manually:"
    echo "  <Script src=\"/improv-core.js\" strategy=\"afterInteractive\" />"
  fi

elif ls *.info.yml 2>/dev/null | head -1 > /dev/null 2>&1; then
  # Drupal: add to libraries.yml and find a template to attach it
  THEME_INFO=$(ls *.info.yml 2>/dev/null | head -1)
  THEME_NAME="${THEME_INFO%.info.yml}"

  if [ -f "${THEME_NAME}.libraries.yml" ]; then
    if ! grep -q "improv-dev" "${THEME_NAME}.libraries.yml"; then
      cat >> "${THEME_NAME}.libraries.yml" << DEOF

# improv:dev
improv-dev:
  js:
    /improv-core.js: {}
DEOF
      echo "Added improv-dev library to ${THEME_NAME}.libraries.yml"
    fi
  fi

  # Try to add attach_library to a page template
  TEMPLATE=""
  for f in templates/page.html.twig templates/html.html.twig; do
    if [ -f "$f" ]; then TEMPLATE="$f"; break; fi
  done
  if [ -n "$TEMPLATE" ]; then
    if ! grep -q "improv-dev" "$TEMPLATE"; then
      sed -i.bak '1s|^|{{ attach_library('"'"${THEME_NAME}'/improv-dev'"'"') }}\n|' "$TEMPLATE"
      rm -f "${TEMPLATE}.bak"
      echo "Added attach_library to $TEMPLATE"
    fi
  else
    echo "Add to your page template: {{ attach_library('${THEME_NAME}/improv-dev') }}"
  fi

elif [ -f "wp-config.php" ]; then
  # WordPress: add to functions.php
  FUNCS=""
  for f in wp-content/themes/*/functions.php; do
    if [ -f "$f" ]; then FUNCS="$f"; break; fi
  done
  if [ -n "$FUNCS" ]; then
    if ! grep -q "improv-dev" "$FUNCS"; then
      cat >> "$FUNCS" << 'WEOF'

// improv:dev
if (defined('WP_DEBUG') && WP_DEBUG) {
  add_action('wp_enqueue_scripts', function() {
    wp_enqueue_script('improv-dev', '/improv-core.js', [], null, true);
  });
}
WEOF
      echo "Added improv-dev to $FUNCS"
    fi
  else
    echo "WARNING: Could not find functions.php"
  fi

else
  # Generic: find an index.html and add the script tag
  HTML=""
  for f in index.html src/index.html; do
    if [ -f "$f" ]; then HTML="$f"; break; fi
  done
  if [ -n "$HTML" ]; then
    if ! grep -q "improv-core" "$HTML"; then
      sed -i.bak 's|</head>|  <script src="/'"$PUBLIC_DIR"'/improv-core.js"></script>\n  </head>|' "$HTML"
      rm -f "${HTML}.bak"
      echo "Added script tag to $HTML"
    fi
  else
    echo "No HTML file found to modify. Add to your HTML <head>:"
    echo "  <script src=\"/$PUBLIC_DIR/improv-core.js\"></script>"
  fi
fi

echo ""
echo "Improv installed in this project."
echo "  CMD+SHIFT+.  toggle toolbar"
echo "  Escape        exit current mode"
echo "  Remove with:  improv-remove"
