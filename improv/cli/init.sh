#!/bin/bash
set -euo pipefail

# Improv init - wires a project to load improv from the local MCP server.
# No static file copy. The server at localhost:9223 serves the latest
# improv-core.js fresh from disk on every request. Projects get updates
# automatically on page reload.

IMPROV_URL="http://localhost:9223/improv-core.js"
PROJECT_ROOT="${1:-.}"

cd "$PROJECT_ROOT"

# Detect stack
STACK="generic"
if [ -f "wp-config.php" ]; then STACK="wordpress";
elif ls *.info.yml 2>/dev/null | head -1 > /dev/null 2>&1; then STACK="drupal";
elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ] || [ -f "next.config.ts" ]; then STACK="nextjs";
elif [ -f "vite.config.ts" ] || [ -f "vite.config.js" ] || [ -f "vite.config.mjs" ]; then STACK="vite";
fi

# Create marker
echo "{\"stack\":\"$STACK\",\"source\":\"server\",\"url\":\"$IMPROV_URL\",\"initialized\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > .improv

echo "Detected: $STACK"

# Wire it in

if [ -f "vite.config.ts" ] || [ -f "vite.config.js" ] || [ -f "vite.config.mjs" ]; then
  if [ -f "index.html" ]; then
    if ! grep -q "improv-core" "index.html"; then
      sed -i.bak 's|</head>|  <script src="'"$IMPROV_URL"'"></script>\n  </head>|' index.html
      rm -f index.html.bak
      echo "Added script tag to index.html"
    fi
  fi

elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ] || [ -f "next.config.ts" ]; then
  LAYOUT=""
  for f in app/layout.tsx app/layout.jsx app/layout.js src/app/layout.tsx src/app/layout.jsx; do
    if [ -f "$f" ]; then LAYOUT="$f"; break; fi
  done
  if [ -n "$LAYOUT" ]; then
    if ! grep -q "improv-core" "$LAYOUT"; then
      if ! grep -q "next/script" "$LAYOUT"; then
        sed -i.bak '1s|^|import Script from "next/script";\n|' "$LAYOUT"
        rm -f "${LAYOUT}.bak"
      fi
      sed -i.bak 's|</body>|<Script src="'"$IMPROV_URL"'" strategy="afterInteractive" />\n      </body>|' "$LAYOUT"
      rm -f "${LAYOUT}.bak"
      echo "Added Improv Script to $LAYOUT"
    fi
  else
    echo "WARNING: Could not find Next.js layout file. Add manually:"
    echo "  <Script src=\"$IMPROV_URL\" strategy=\"afterInteractive\" />"
  fi

elif ls *.info.yml 2>/dev/null | head -1 > /dev/null 2>&1; then
  THEME_INFO=$(ls *.info.yml 2>/dev/null | head -1)
  THEME_NAME="${THEME_INFO%.info.yml}"

  if [ -f "${THEME_NAME}.libraries.yml" ]; then
    if ! grep -q "improv-dev" "${THEME_NAME}.libraries.yml"; then
      cat >> "${THEME_NAME}.libraries.yml" << DEOF

# improv:dev
improv-dev:
  js:
    $IMPROV_URL: { type: external }
DEOF
      echo "Added improv-dev library to ${THEME_NAME}.libraries.yml"
    fi
  fi

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

elif [ "$STACK" = "wordpress" ]; then
  if grep -q "define.*WP_DEBUG.*false" wp-config.php 2>/dev/null; then
    sed -i.bak "s/define.*('WP_DEBUG'.*false)/define('WP_DEBUG', true)/" wp-config.php
    rm -f wp-config.bak
    echo "Set WP_DEBUG to true in wp-config.php"
  elif ! grep -q "WP_DEBUG" wp-config.php 2>/dev/null; then
    sed -i.bak "/That's all, stop editing/i\\
define('WP_DEBUG', true);" wp-config.php 2>/dev/null || echo "define('WP_DEBUG', true);" >> wp-config.php
    rm -f wp-config.bak
    echo "Added WP_DEBUG = true to wp-config.php"
  fi

  FUNCS=""
  for f in wp-content/themes/*/functions.php; do
    [ -f "$f" ] || continue
    THEME_DIR=$(dirname "$f")
    THEME_BASE=$(basename "$THEME_DIR")
    case "$THEME_BASE" in twenty*) continue ;; esac
    FUNCS="$f"
    break
  done
  if [ -z "$FUNCS" ]; then
    for f in wp-content/themes/*/functions.php; do
      if [ -f "$f" ]; then FUNCS="$f"; break; fi
    done
  fi
  if [ -n "$FUNCS" ]; then
    if ! grep -q "improv-dev" "$FUNCS"; then
      cat >> "$FUNCS" << WEOF

// improv:dev
if (defined('WP_DEBUG') && WP_DEBUG) {
  add_action('wp_enqueue_scripts', function() {
    wp_enqueue_script('improv-dev', '${IMPROV_URL}', [], null, true);
  });
}
WEOF
      echo "Added improv-dev to $FUNCS"
    fi
  else
    echo "WARNING: Could not find functions.php"
  fi

else
  HTML=""
  for f in index.html src/index.html; do
    if [ -f "$f" ]; then HTML="$f"; break; fi
  done
  if [ -n "$HTML" ]; then
    if ! grep -q "improv-core" "$HTML"; then
      sed -i.bak 's|</head>|  <script src="'"$IMPROV_URL"'"></script>\n  </head>|' "$HTML"
      rm -f "${HTML}.bak"
      echo "Added script tag to $HTML"
    fi
  else
    echo "No HTML file found to modify. Add to your HTML <head>:"
    echo "  <script src=\"$IMPROV_URL\"></script>"
  fi
fi

echo ""
echo "Improv activated for this project."
echo "  Source:        $IMPROV_URL (served live, always latest)"
echo "  CMD+SHIFT+.    toggle toolbar"
echo "  Escape         exit current mode"
echo "  Remove with:   improv-remove"
