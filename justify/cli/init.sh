#!/bin/bash
set -euo pipefail

# Justify init - wires a project to load justify from the local MCP server.
# No static file copy. The server at localhost:9223 serves the latest
# justify-core.js fresh from disk on every request. Projects get updates
# automatically on page reload.

# Default to the http core on :9223 - works on local-dev http sites with NO
# self-signed-cert / sudo step. For an https-ONLY site, set JUSTIFY_URL to the
# https core (https://localhost:9224/justify-core.js) and trust the cert once
# via setup-cert.sh (avoids mixed-content blocking).
JUSTIFY_URL="${JUSTIFY_URL:-http://localhost:9223/justify-core.js}"
PROJECT_ROOT="${1:-.}"

# Escaped copy for use INSIDE a sed replacement (s|...|HERE|): a URL with & (query
# params), a backslash, or the | delimiter would otherwise corrupt the insertion.
JUSTIFY_URL_SED=$(printf '%s' "$JUSTIFY_URL" | sed 's/[\\&|]/\\&/g')

cd "$PROJECT_ROOT"

# Detect stack. The WIRING below branches on this SAME value (a case on $STACK),
# not on its own independent file checks, so detection and wiring can never
# disagree (they did: a theme dir with a vite.config but no wp-config was
# detected "vite", wired nothing, yet still reported success).
STACK="generic"
if [ -f "wp-config.php" ]; then STACK="wordpress";
elif ls ./*.info.yml >/dev/null 2>&1; then STACK="drupal";
elif [ -f "next.config.js" ] || [ -f "next.config.mjs" ] || [ -f "next.config.ts" ]; then STACK="nextjs";
elif [ -f "vite.config.ts" ] || [ -f "vite.config.js" ] || [ -f "vite.config.mjs" ]; then STACK="vite";
fi

echo "Detected: $STACK"

# If we detected a generic/vite project but this is really a WordPress theme
# directory, the user ran init from the theme, not the site root - say so.
if { [ "$STACK" = "vite" ] || [ "$STACK" = "generic" ]; } \
   && { [ -f "functions.php" ] || grep -qs "Theme Name:" style.css; }; then
  echo "NOTE: this looks like a WordPress theme directory. Run justify-init from the"
  echo "      WordPress site root (where wp-config.php lives), not the theme folder."
fi

# WIRED  = the loader is VERIFIABLY present AND loadable (re-checked after every
#          edit against the EXACT $JUSTIFY_URL, not a substring). Only a WIRED
#          project prints success - never "sed ran" nor a WP_DEBUG-gated block
#          that is inert because WP_DEBUG is off.
# EDITED = init changed at least one file even if not fully wired. The marker is
#          written when either is set, so justify-remove can always undo the edit.
WIRED=0
EDITED=0

case "$STACK" in
  vite|generic)
    HTML=""
    for f in index.html src/index.html; do
      if [ -f "$f" ]; then HTML="$f"; break; fi
    done
    if [ -n "$HTML" ]; then
      if ! grep -qF "$JUSTIFY_URL" "$HTML"; then
        sed -i.bak 's|</head>|  <script src="'"$JUSTIFY_URL_SED"'"></script>\n  </head>|' "$HTML"
        rm -f "$HTML.bak"
      fi
      if grep -qF "$JUSTIFY_URL" "$HTML"; then
        WIRED=1; EDITED=1; echo "Wired the Justify loader into $HTML"
      else
        echo "WARNING: $HTML has no </head> to inject into - add the loader by hand."
      fi
    fi
    ;;

  nextjs)
    LAYOUT=""
    for f in app/layout.tsx app/layout.jsx app/layout.js src/app/layout.tsx src/app/layout.jsx; do
      if [ -f "$f" ]; then LAYOUT="$f"; break; fi
    done
    if [ -n "$LAYOUT" ]; then
      if grep -qF "$JUSTIFY_URL" "$LAYOUT"; then
        WIRED=1
      elif grep -q '</body>' "$LAYOUT"; then
        # Only add the import once we KNOW there is a </body> to attach the Script
        # to - otherwise we would orphan an unused import that remove cannot reach.
        grep -q "next/script" "$LAYOUT" || sed -i.bak '1s|^|import Script from "next/script";\n|' "$LAYOUT"
        sed -i.bak 's|</body>|<Script src="'"$JUSTIFY_URL_SED"'" strategy="afterInteractive" />\n      </body>|' "$LAYOUT"
        rm -f "${LAYOUT}.bak"
        if grep -qF "$JUSTIFY_URL" "$LAYOUT"; then WIRED=1; EDITED=1; echo "Wired the Justify Script into $LAYOUT"; fi
      else
        echo "WARNING: $LAYOUT has no </body> to inject into - add the <Script> by hand."
      fi
    fi
    ;;

  drupal)
    THEME_INFO=$(ls ./*.info.yml 2>/dev/null | head -1)
    THEME_NAME="${THEME_INFO%.info.yml}"
    THEME_NAME="${THEME_NAME#./}"
    LIB="${THEME_NAME}.libraries.yml"
    LIB_OK=0
    if [ -f "$LIB" ]; then
      # Anchored top-level key check - a `# TODO justify-dev` comment or a
      # `some-justify-dev-helper:` key must NOT read as "the library is defined".
      if ! grep -qE '^justify-dev:' "$LIB"; then
        cat >> "$LIB" << DEOF

# justify:dev
justify-dev:
  js:
    $JUSTIFY_URL: { type: external }
DEOF
        echo "Added justify-dev library to $LIB"
        EDITED=1
      fi
      grep -qE '^justify-dev:' "$LIB" && LIB_OK=1
    else
      echo "WARNING: $LIB not found - cannot define the justify-dev library."
    fi
    # Attach ONLY once the library is actually DEFINED - never leave a dangling
    # attach_library pointing at a library that does not exist.
    if [ "$LIB_OK" = "1" ]; then
      TEMPLATE=""
      for f in templates/page.html.twig templates/html.html.twig; do
        if [ -f "$f" ]; then TEMPLATE="$f"; break; fi
      done
      if [ -n "$TEMPLATE" ]; then
        ATTACH="{{ attach_library('${THEME_NAME}/justify-dev') }}"
        # Match THIS theme's exact attach line (grep -F), not any 'justify-dev'
        # text - a TODO comment or another theme's attach must not read as wired.
        if ! grep -qF "$ATTACH" "$TEMPLATE"; then
          { printf '%s\n' "$ATTACH"; cat "$TEMPLATE"; } > "$TEMPLATE.justify-new" \
            && mv "$TEMPLATE.justify-new" "$TEMPLATE"
          echo "Added attach_library to $TEMPLATE"
          EDITED=1
        fi
        grep -qF "$ATTACH" "$TEMPLATE" && WIRED=1
      fi
    fi
    if [ "$WIRED" != "1" ]; then
      echo "NOTE: justify-dev is not fully wired. It needs BOTH a justify-dev: entry in"
      echo "      ${THEME_NAME}.libraries.yml AND {{ attach_library('${THEME_NAME}/justify-dev') }} in a template."
    fi
    ;;

  wordpress)
    # Pick the theme HONESTLY and FIRST, so we never touch wp-config (WP_DEBUG)
    # only to then refuse the theme and leave an untracked edit behind.
    #   1. explicit JUSTIFY_THEME (validated as a plain slug) wins;
    #   2. else WP-CLI's ACTIVE theme, if wp-cli answers;
    #   3. else the single non-twenty theme that has a functions.php;
    #   4. else (several candidates) refuse to guess - list them and stop.
    THEME=""
    if [ -n "${JUSTIFY_THEME:-}" ]; then
      case "$JUSTIFY_THEME" in
        '' | *..* | *[!A-Za-z0-9._-]*)
          echo "WARNING: ignoring invalid JUSTIFY_THEME '$JUSTIFY_THEME' (letters, digits, . _ - only)" ;;
        *)
          THEME="$JUSTIFY_THEME" ;;
      esac
    fi
    if [ -z "$THEME" ] && command -v wp >/dev/null 2>&1; then
      _active="$(wp option get stylesheet 2>/dev/null || true)"
      if [ -n "$_active" ] && [ -d "wp-content/themes/$_active" ]; then THEME="$_active"; fi
    fi
    if [ -z "$THEME" ]; then
      _count=0; _found=""; _list=""
      for d in wp-content/themes/*/; do
        [ -d "$d" ] || continue
        b="$(basename "$d")"
        case "$b" in twenty*) continue ;; esac
        [ -f "${d}functions.php" ] || continue
        _count=$((_count + 1)); _found="$b"; _list="${_list}  - ${b}
"
      done
      if [ "$_count" -eq 1 ]; then
        THEME="$_found"
      elif [ "$_count" -gt 1 ]; then
        echo "WARNING: multiple candidate themes found - refusing to guess which is yours:"
        printf '%s' "$_list"
        echo "Re-run naming the theme:  JUSTIFY_THEME=<name> justify-init"
      fi
    fi

    if [ -n "$THEME" ] && [ -f "wp-content/themes/$THEME/functions.php" ]; then
      FUNCS="wp-content/themes/$THEME/functions.php"

      # Enable WP_DEBUG. Quote-agnostic, space-tolerant, and COMMENT-AWARE: the
      # `^[^/#*]*` prefix keeps a commented `// define('WP_DEBUG', ...)` from
      # matching, and grep + sed are anchored the same way so they never disagree.
      # NB: WP_DEBUG is intentionally NOT tracked by EDITED - remove.sh does not
      # revert it, so a WP_DEBUG-only change needs no removal breadcrumb.
      if grep -qE "^[^/#*]*define[[:space:]]*\([[:space:]]*['\"]WP_DEBUG['\"][[:space:]]*,[[:space:]]*false" wp-config.php 2>/dev/null; then
        sed -i.bak -E "s/^([^/#*]*)define[[:space:]]*\([[:space:]]*['\"]WP_DEBUG['\"][[:space:]]*,[[:space:]]*false[[:space:]]*\)/\1define('WP_DEBUG', true)/" wp-config.php
        rm -f wp-config.php.bak
      elif ! grep -qE "^[^/#*]*['\"]WP_DEBUG['\"]" wp-config.php 2>/dev/null; then
        sed -i.bak "/That's all, stop editing/i\\
define('WP_DEBUG', true);" wp-config.php 2>/dev/null || true
        rm -f wp-config.php.bak
        # If the "stop editing" anchor was absent the sed above no-op'd, so append.
        grep -qE "^[^/#*]*['\"]WP_DEBUG['\"]" wp-config.php 2>/dev/null || printf "\ndefine('WP_DEBUG', true);\n" >> wp-config.php
      fi

      # Idempotency keys on the actual enqueue CALL (the real loader), not just the
      # `// justify:dev` marker line - a stale marker with no enqueue must not read
      # as wired, and init should re-add a working block in that case.
      if ! grep -qF "wp_enqueue_script('justify-dev'" "$FUNCS"; then
        cat >> "$FUNCS" << WEOF

// justify:dev
if (defined('WP_DEBUG') && WP_DEBUG) {
  add_action('wp_enqueue_scripts', function() {
    wp_enqueue_script('justify-dev', '${JUSTIFY_URL}', [], null, true);
  });
}
// justify:dev:end
WEOF
        echo "Added justify-dev to $FUNCS"
        EDITED=1
      fi

      # WIRED only when the enqueue is actually present AND WP_DEBUG is verifiably
      # true on a NON-comment line (the block is WP_DEBUG-guarded, so it is inert
      # otherwise). The quote-anchor also excludes WP_DEBUG_LOG / _DISPLAY.
      _block=0; grep -qF "wp_enqueue_script('justify-dev'" "$FUNCS" && _block=1
      _debug=0; grep -qiE "^[^/#*]*['\"]WP_DEBUG['\"][[:space:]]*,[[:space:]]*true" wp-config.php 2>/dev/null && _debug=1
      if [ "$_block" = "1" ] && [ "$_debug" = "1" ]; then
        WIRED=1
      elif [ "$_block" = "1" ]; then
        echo "NOTE: the Justify block is in $FUNCS but WP_DEBUG is not enabled in"
        echo "      wp-config.php, so the loader stays inert. Set WP_DEBUG to true."
      fi
    elif [ -n "$THEME" ]; then
      echo "WARNING: wp-content/themes/$THEME/functions.php not found"
    fi
    ;;
esac

# The marker is a removal breadcrumb, written whenever init changed anything, so
# justify-remove can always undo it. "Activated" is printed ONLY when the loader
# is verifiably present AND loadable - the two are decoupled so the marker never
# claims a success that did not happen.
if [ "$WIRED" = "1" ] || [ "$EDITED" = "1" ]; then
  echo "{\"stack\":\"$STACK\",\"source\":\"server\",\"url\":\"$JUSTIFY_URL\",\"initialized\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > .justify
fi

echo ""
if [ "$WIRED" = "1" ]; then
  echo "Justify activated for this project."
  echo "  Source:        $JUSTIFY_URL (served live, always latest)"
  echo "  CMD+SHIFT+.    toggle toolbar"
  echo "  Escape         exit current mode"
  echo "  Remove with:   justify-remove"
  exit 0
fi

echo "WARNING: Justify is NOT fully wired (detected: $STACK)."
if [ "$EDITED" = "1" ]; then
  echo "Some files were changed but the loader is not active yet - see the note above."
  echo "A .justify marker was written so 'justify-remove' can undo those changes."
else
  echo "No files were changed and no marker was written. Add the loader by hand:"
  case "$STACK" in
    nextjs)    echo "  <Script src=\"$JUSTIFY_URL\" strategy=\"afterInteractive\" />  in your root layout" ;;
    wordpress) echo "  wp_enqueue_script('justify-dev', '$JUSTIFY_URL', [], null, true);  in your active theme (WP_DEBUG-guarded)" ;;
    drupal)    echo "  attach a '<theme>/justify-dev' library that loads $JUSTIFY_URL" ;;
    *)         echo "  <script src=\"$JUSTIFY_URL\"></script>  in your HTML <head>" ;;
  esac
fi
exit 1
