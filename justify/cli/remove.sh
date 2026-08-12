#!/bin/bash
set -euo pipefail

PROJECT_ROOT="${1:-.}"
cd "$PROJECT_ROOT"

if [ ! -f ".justify" ]; then
  echo "No .justify marker found in this directory."
  exit 0
fi

# Read the public dir from marker
PUBLIC_DIR=$(python3 -c "import json; print(json.load(open('.justify')).get('dir','public'))" 2>/dev/null || echo "public")

# Remove the script
if [ -f "$PUBLIC_DIR/justify-core.js" ]; then
  rm "$PUBLIC_DIR/justify-core.js"
  echo "Removed $PUBLIC_DIR/justify-core.js"
fi

# Remove Drupal library entry
for f in *.libraries.yml; do
  if [ -f "$f" ] && grep -q "justify-dev" "$f"; then
    sed -i.bak '/# justify:dev/,/justify-core\.js/d' "$f"
    rm -f "${f}.bak"
    echo "Removed justify-dev from $f"
  fi
done

# Remove the WordPress functions.php block that init.sh appends. This branch was
# missing entirely (the reported bug); the Drupal sed above uses a `#` YAML
# comment that can never match a PHP `//` line. Removal is done in python so it
# authorizes a delete only two ways, both bounded: (1) the 5 lines after a start
# marker match the EXACT block init generates (optionally with the trailing end
# marker), or (2) a start marker whose body OPENS with our WP_DEBUG guard line
# and is closed by an end marker before the next start marker (an edited-but-ours
# block). It never uses a sed range or a bare brace, so it cannot run a delete
# across a user's own code.
if command -v python3 >/dev/null 2>&1; then
  for f in wp-content/themes/*/functions.php; do
    [ -f "$f" ] || continue
    # Cheap skip only: the colon marker text never appears in a `justify-dev`
    # (hyphen) handle a theme might define, and it matches regardless of trailing
    # whitespace / CRLF. Python below makes the real, anchored decision.
    grep -q 'justify:dev' "$f" || continue
    res=$(python3 - "$f" <<'PY'
import sys, re, os, tempfile
path = sys.argv[1]
with open(path, encoding="utf-8", errors="surrogateescape") as fh:
    lines = fh.read().split("\n")
# [ \t\r]* trailing class tolerates CRLF files (lines keep a trailing \r).
START = re.compile(r"^//[ \t]*justify:dev[ \t\r]*$")
END   = re.compile(r"^//[ \t]*justify:dev:end[ \t\r]*$")
# The EXACT block init.sh generates (URL wildcarded, single quotes as emitted).
BODY = [
    re.compile(r"^if \(defined\('WP_DEBUG'\) && WP_DEBUG\) \{[ \t\r]*$"),
    re.compile(r"^  add_action\('wp_enqueue_scripts', function\(\) \{[ \t\r]*$"),
    re.compile(r"^    wp_enqueue_script\('justify-dev', '[^']*', \[\], null, true\);[ \t\r]*$"),
    re.compile(r"^  \}\);[ \t\r]*$"),
    re.compile(r"^\}[ \t\r]*$"),
]
out, i, n, removed, warned = [], 0, len(lines), 0, 0
while i < n:
    if START.match(lines[i]):
        # (1) exact generated block on the 5 lines after the marker.
        if i + 5 < n and all(BODY[t].match(lines[i + 1 + t]) for t in range(5)):
            end = i + 5
            if end + 1 < n and END.match(lines[end + 1]):
                end += 1              # consume the adjacent end marker (new installs)
            i = end + 1; removed += 1; continue
        # (2) an edited-but-ours block: it must OPEN with our WP_DEBUG guard line
        # AND be closed by an end marker before the next start marker. Requiring
        # BODY[0] keeps arbitrary user code that merely sits between the markers
        # from being deleted - only a recognizably-Justify block is.
        if i + 1 < n and BODY[0].match(lines[i + 1]):
            j = None
            for k in range(i + 1, n):
                if END.match(lines[k]):
                    j = k; break
                if START.match(lines[k]):
                    break
            if j is not None:
                i = j + 1; removed += 1; continue
        warned += 1; out.append(lines[i]); i += 1; continue
    out.append(lines[i]); i += 1
if removed:
    # Write THROUGH a symlink to its real target (os.replace on the link path
    # would swap the link for a regular file and leave the real file untouched).
    target = os.path.realpath(path)
    d = os.path.dirname(target) or "."
    fd, tmp = tempfile.mkstemp(dir=d)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", errors="surrogateescape") as fh:
            fh.write("\n".join(out))
        os.chmod(tmp, os.stat(target).st_mode & 0o7777)
        os.replace(tmp, target)        # atomic; never a half-written functions.php
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise
print("REMOVED_PARTIAL" if (removed and warned) else
      "REMOVED" if removed else "WARN" if warned else "NOCHANGE")
PY
) || { echo "WARNING: could not process $f (left untouched)"; continue; }
    case "$res" in
      REMOVED)         echo "Removed justify-dev from $f" ;;
      REMOVED_PARTIAL) echo "Removed justify-dev from $f (another marked block did not match a Justify block and was left untouched)" ;;
      WARN)            echo "WARNING: a justify:dev marker in $f did not match a Justify block; left it untouched - remove it by hand" ;;
      *)               : ;;
    esac
  done
else
  for f in wp-content/themes/*/functions.php; do
    [ -f "$f" ] || continue
    grep -q 'justify:dev' "$f" \
      && echo "WARNING: python3 not found; remove the // justify:dev block from $f by hand"
  done
fi

# Remove marker
rm -f .justify
echo "Removed .justify marker"
echo "Justify removed from project."
