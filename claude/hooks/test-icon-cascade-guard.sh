#!/bin/bash
# Falsification suite for icon-cascade-guard.sh.
# Every rule must be shown to BLOCK when violated and PASS when satisfied.
# A guard that cannot go red is not a guard. Style mirrors test-content-guard.sh.
# Run: bash claude/hooks/test-icon-cascade-guard.sh
# (Set ICG_GATE=/path/to/hook to test an alternate build.)

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
G="${ICG_GATE:-$HOOK_DIR/icon-cascade-guard.sh}"
PASS=0; FAIL=0; FAILS=()

run() { # $1 tool  $2 json
  python3 -c 'import json,sys; print(json.dumps({"tool_name":sys.argv[1],"tool_input":json.loads(sys.argv[2])}))' "$1" "$2" | bash "$G" 2>/dev/null
}
blocks() { # label tool json
  local out; out=$(run "$2" "$3")
  if echo "$out" | grep -q '"permissionDecision": *"deny"'; then echo "PASS: $1"; ((PASS++))
  else echo "FAIL: $1 (expected deny, got: $out)"; FAILS+=("$1"); ((FAIL++)); fi
}
allows() { # label tool json
  local out; out=$(run "$2" "$3")
  if echo "$out" | grep -q '"permissionDecision": *"deny"'; then echo "FAIL: $1 (unexpected deny: $out)"; FAILS+=("$1"); ((FAIL++))
  else echo "PASS: $1"; ((PASS++)); fi
}
wj() { python3 -c 'import json,sys; print(json.dumps({"file_path":sys.argv[1],"content":sys.argv[2]}))' "$1" "$2"; }
ej() { python3 -c 'import json,sys; print(json.dumps({"file_path":sys.argv[1],"new_string":sys.argv[2]}))' "$1" "$2"; }
mj() { python3 -c 'import json,sys; print(json.dumps({"file_path":sys.argv[1],"edits":[{"old_string":"x","new_string":sys.argv[2]}]}))' "$1" "$2"; }

SRC="/repo/src/Widget.tsx"
HTML="/repo/reference/page.html"

echo "=== baseline: the happy path must pass (else every red below is meaningless) ==="
allows "clean lucide import"        Write "$(wj "$SRC" 'import { Home } from "lucide-react";')"
allows "empty content"              Write "$(wj "$SRC" '')"
allows "plain prose html"           Write "$(wj "$HTML" '<h1>hello</h1>')"

echo
echo "=== B1: off-cascade icon library imports must BLOCK ==="
blocks "react-icons"                Write "$(wj "$SRC" 'import { FaHome } from "react-icons/fa";')"
blocks "@fortawesome scope"         Write "$(wj "$SRC" 'import { faCoffee } from "@fortawesome/free-solid-svg-icons";')"
blocks "font-awesome"               Write "$(wj "$SRC" 'import "font-awesome/css/font-awesome.css";')"
blocks "feather-icons"              Write "$(wj "$SRC" 'import feather from "feather-icons";')"
blocks "react-feather"             Write "$(wj "$SRC" 'import { Camera } from "react-feather";')"
blocks "@iconify/react"             Write "$(wj "$SRC" 'import { Icon } from "@iconify/react";')"
blocks "ionicons"                   Write "$(wj "$SRC" 'import "ionicons/icons";')"
blocks "@ant-design/icons"          Write "$(wj "$SRC" 'import { HomeOutlined } from "@ant-design/icons";')"
blocks "@mui/icons-material"        Write "$(wj "$SRC" 'import Home from "@mui/icons-material/Home";')"
blocks "@material-ui/icons"         Write "$(wj "$SRC" 'import { Home } from "@material-ui/icons";')"
blocks "primeicons"                 Write "$(wj "$SRC" 'import "primeicons/primeicons.css";')"
blocks "remixicon"                  Write "$(wj "$SRC" 'import "remixicon/fonts/remixicon.css";')"
blocks "boxicons"                   Write "$(wj "$SRC" 'import "boxicons";')"
blocks "@primer/octicons-react"     Write "$(wj "$SRC" 'import { MarkGithubIcon } from "@primer/octicons-react";')"
blocks "require() form"             Write "$(wj "$SRC" 'const ri = require("react-icons");')"
blocks "dynamic import() form"      Write "$(wj "$SRC" 'const m = await import("@iconify/react");')"
blocks "re-export from off-cascade" Write "$(wj "$SRC" 'export { Camera } from "react-feather";')"
blocks "multiline import continuation" Write "$(wj "$SRC" 'import {\n  FaHome\n} from "react-icons/fa";')"
blocks "off-cascade in Edit"        Edit  "$(ej "$SRC" 'import { FaHome } from "react-icons/fa";')"
blocks "off-cascade in MultiEdit"   MultiEdit "$(mj "$SRC" 'import feather from "feather-icons";')"

echo
echo "=== B1: approved-cascade imports must PASS ==="
allows "lucide-react"               Write "$(wj "$SRC" 'import { Home } from "lucide-react";')"
allows "reicon-react"               Write "$(wj "$SRC" 'import { Home } from "reicon-react";')"
allows "@lobehub/icons"             Write "$(wj "$SRC" 'import { OpenAI, Claude } from "@lobehub/icons";')"
allows "@hugeicons/react"           Write "$(wj "$SRC" 'import { HugeiconsIcon } from "@hugeicons/react";')"
allows "@phosphor-icons/react"      Write "$(wj "$SRC" 'import { House } from "@phosphor-icons/react";')"
allows "@tabler/icons-react"        Write "$(wj "$SRC" 'import { IconHome } from "@tabler/icons-react";')"
allows "heroicons"                  Write "$(wj "$SRC" 'import { BeakerIcon } from "@heroicons/react/24/solid";')"
allows "@heroicons-animated/react"  Write "$(wj "$SRC" 'import { BeakerIcon } from "@heroicons-animated/react";')"
allows "@mui/material (not icons)"  Write "$(wj "$SRC" 'import Button from "@mui/material/Button";')"
allows "unrelated @ant-design/x"    Write "$(wj "$SRC" 'import { X } from "@ant-design/pro-components";')"

echo
echo "=== B1 REGRESSION (reviewer HIGH): a name in a COMMENT or STRING must PASS ==="
allows "// comment names react-icons, real lucide import" Write "$(wj "$SRC" 'import { Home } from "lucide-react"; // migrated away from "react-icons"')"
allows "block comment names off-cascade"  Write "$(wj "$SRC" '/* do not use require("boxicons") here */\nimport { Home } from "lucide-react";')"
allows "code-sample string (single line)" Write "$(wj "$SRC" 'const sample = "import feather from feather-icons";')"
allows "object key literally named from"  Write "$(wj "$SRC" 'const cfg = { from: "react-icons" };')"
allows "scoped near-collision @iconifyx"  Write "$(wj "$SRC" 'import x from "@iconifyx/core";')"
allows "sibling scope @primer/react"      Write "$(wj "$SRC" 'import { Box } from "@primer/react";')"
# gpt-5.5 review (over-block): a require()/import() CALL inside a string literal must PASS
allows "require() call inside a string literal" Write "$(wj "$SRC" "const sample = 'const x = require(\"react-icons/fa\");';")"
allows "import() call inside a string literal"  Write "$(wj "$SRC" "const doc = 'await import(\"@iconify/react\")';")"
allows "require() inside a backtick template"   Write "$(wj "$SRC" 'const t = `require("react-icons/fa")`;')"

echo
echo "=== B1: off-cascade import must PASS when path is excluded ==="
allows "corpus captured page"       Write "$(wj "/repo/sidecoach/eval/corpus/candidates/x.html" 'import x from "react-icons";')"
allows ".backups tree"             Write "$(wj "/repo/.backups/20260101/x.tsx" 'import x from "react-icons";')"
allows "node_modules"               Write "$(wj "/repo/node_modules/pkg/x.js" 'import x from "react-icons";')"
allows "efficacy-trial fixture"     Write "$(wj "/repo/sidecoach/efficacy-trial/pages/S/x.html" 'import x from "react-icons";')"
allows "a .test.tsx file"           Write "$(wj "/repo/src/Widget.test.tsx" 'import x from "react-icons";')"
allows "a test- prefixed file"      Write "$(wj "/repo/claude/hooks/test-thing.sh" 'import x from "react-icons";')"
allows "off-cascade in .md doc"     Write "$(wj "/repo/claude/RULES.md" 'import x from "react-icons";')"
allows "off-cascade in .css"        Write "$(wj "/repo/src/app.css" 'import "react-icons";')"

echo
echo "=== B2: fabricated / hand-drawn icons must BLOCK ==="
blocks "3-line hamburger, no marker" Write "$(wj "$HTML" '<button><svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>')"
blocks "compound path M M M, no marker" Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><path d="M3 6h18M3 12h18M3 18h18"/></svg>')"
blocks "rect+circle primitives, no marker" Write "$(wj "/repo/src/Icon.tsx" '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="2" y="2" width="6" height="6"/><circle cx="16" cy="16" r="4"/></svg>')"
blocks "width/height square, primitives" Write "$(wj "$HTML" '<svg width="24" height="24" aria-hidden="true" stroke="currentColor"><line x1="1" y1="1" x2="9" y2="9"/><line x1="1" y1="9" x2="9" y2="1"/></svg>')"
blocks "comma-separated viewBox (exporter)" Write "$(wj "$HTML" '<svg viewBox="0,0,24,24" aria-hidden="true" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></svg>')"
blocks "class=morph-x (loose short marker no longer vouches)" Write "$(wj "$HTML" '<svg class="morph-x" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></svg>')"
blocks "fabricated icon via Edit"   Edit "$(ej "$HTML" '<svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></svg>')"

echo
echo "=== B2: legitimate SVGs must PASS ==="
allows "hamburger WITH data-icon-source" Write "$(wj "$HTML" '<svg data-icon-source="lucide" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></svg>')"
allows "hamburger WITH lucide class" Write "$(wj "$HTML" '<svg class="lucide lucide-menu" viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></svg>')"
allows "phosphor class ph ph-house (boundary marker)" Write "$(wj "$HTML" '<svg class="ph ph-house" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="2" y="2" width="6" height="6"/><circle cx="16" cy="16" r="4"/></svg>')"
allows "single simple path, no marker" Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M12 2l3 7h7"/></svg>')"
allows "two SEPARATE paths (deliberate pass)" Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><path d="M5 12h14"/><path d="M13 5l7 7"/></svg>')"
allows "labelled chart role=img + primitives" Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" role="img" aria-label="chart" fill="currentColor"><rect x="1" y="1" width="4" height="10"/><rect x="8" y="3" width="4" height="8"/></svg>')"
allows "non-square (banner)"        Write "$(wj "$HTML" '<svg viewBox="0 0 200 100" aria-hidden="true" fill="currentColor"><rect x="0" y="0" width="50" height="50"/><circle cx="120" cy="50" r="20"/></svg>')"
allows "large square (canvas)"      Write "$(wj "$HTML" '<svg viewBox="0 0 200 200" aria-hidden="true" stroke="currentColor"><line x1="0" y1="0" x2="10" y2="10"/><line x1="0" y1="10" x2="10" y2="0"/></svg>')"
allows "has <text> (not an icon)"   Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor"><rect x="1" y="1" width="4" height="4"/><rect x="8" y="8" width="4" height="4"/><text x="0" y="20">A</text></svg>')"
allows "has gradient (not an icon)" Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="g"/></defs><rect x="1" y="1" width="4" height="4"/><rect x="8" y="8" width="4" height="4"/></svg>')"
allows "no currentColor (recall limit)" Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" aria-hidden="true" stroke="#000000"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></svg>')"
allows "root NOT aria-hidden, inner g is" Write "$(wj "$HTML" '<svg viewBox="0 0 24 24" stroke="currentColor"><g aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></g></svg>')"
allows "raw lucide without aria-hidden (recall limit)" Write "$(wj "$HTML" '<svg class="x" viewBox="0 0 24 24" stroke="currentColor"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/></svg>')"
allows "fabricated svg in .md doc"  Write "$(wj "/repo/claude/RULES.md" '<svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line/><line/></svg>')"
allows "fabricated svg in corpus"   Write "$(wj "/repo/sidecoach/eval/corpus/x.html" '<svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line/><line/></svg>')"
allows "fabricated svg in dependency-map" Write "$(wj "/repo/docs/dependency-map/index.html" '<svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor"><line/><line/></svg>')"

echo
echo "========================================"
echo "PASS=$PASS FAIL=$FAIL"
if [ "$FAIL" -ne 0 ]; then printf 'FAILED: %s\n' "${FAILS[@]}"; exit 1; fi
echo "ALL GREEN"
