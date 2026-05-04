#!/bin/bash
set -euo pipefail

IMPROV_SCRIPT_URL="http://localhost:9223/improv-core.js"
IMPROV_TAG="<script src=\"$IMPROV_SCRIPT_URL\"></script>"
MARKER_COMMENT="<!-- improv:dev -->"
PROJECT_ROOT="${1:-.}"

cd "$PROJECT_ROOT"

echo "Detecting project stack..."

# Create .improv marker
echo '{"initialized":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","scriptUrl":"'$IMPROV_SCRIPT_URL'"}' > .improv
echo "Created .improv marker"

# Detect stack and inject
if [ -f "vite.config.ts" ] || [ -f "vite.config.js" ] || [ -f "vite.config.mjs" ]; then
  echo "Detected: Vite"
  # Create improv vite plugin file
  cat > improv.dev.js << 'VEOF'
export default function improv() {
  return {
    name: 'improv-dev',
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === 'production') return html;
      return html.replace('</head>', '  <script src="http://localhost:9223/improv-core.js"></script>\n  </head>');
    }
  };
}
VEOF
  echo "Created improv.dev.js - add improv() to your vite.config plugins array"

elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ] || [ -f "next.config.ts" ]; then
  echo "Detected: Next.js"
  echo "Add to your root layout's <head>:"
  echo "  {process.env.NODE_ENV === 'development' && <script src=\"$IMPROV_SCRIPT_URL\" />}"

elif ls *.info.yml 2>/dev/null | head -1 > /dev/null 2>&1; then
  echo "Detected: Drupal"
  # Find the theme's .info.yml
  THEME_INFO=$(ls *.info.yml 2>/dev/null | head -1)
  THEME_NAME="${THEME_INFO%.info.yml}"

  # Create a libraries entry
  if [ -f "${THEME_NAME}.libraries.yml" ]; then
    if ! grep -q "improv-dev" "${THEME_NAME}.libraries.yml"; then
      cat >> "${THEME_NAME}.libraries.yml" << DEOF

# improv:dev - remove for production
improv-dev:
  js:
    $IMPROV_SCRIPT_URL: { type: external, attributes: { defer: true } }
DEOF
      echo "Added improv-dev library to ${THEME_NAME}.libraries.yml"
      echo "Add {{ attach_library('${THEME_NAME}/improv-dev') }} to your page template"
    else
      echo "improv-dev already in ${THEME_NAME}.libraries.yml"
    fi
  else
    echo "No .libraries.yml found. Add manually:"
    echo "  $IMPROV_TAG"
  fi

elif [ -f "wp-config.php" ]; then
  echo "Detected: WordPress"
  echo "Add to functions.php:"
  echo "  if (WP_DEBUG) { wp_enqueue_script('improv-dev', '$IMPROV_SCRIPT_URL'); }"

else
  echo "Detected: Generic project"
  echo "Add this to your HTML <head> (dev only):"
  echo "  $MARKER_COMMENT"
  echo "  $IMPROV_TAG"
fi

echo ""
echo "Improv initialized. The toolbar will appear when the Improv server is running."
echo "Remove with: improv-remove"
