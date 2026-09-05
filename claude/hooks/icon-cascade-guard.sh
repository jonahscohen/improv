#!/bin/bash
# PreToolUse hook for Write|Edit|MultiEdit. Fail-HARD gate for the icon priority
# cascade (see the icon-source skill + RULES.md). It BLOCKS a write, it does not warn.
#
# It is deliberately narrow. A "can't-fail" gate that blocks legitimate work is itself a
# failure - that exact over-block pattern caused a multi-day regression on the Figma
# fidelity gate. So this fires ONLY on buildable app source and never on captured
# corpora, generated eval fixtures, backups, vendored trees, tests, or docs. Two checks
# deny:
#
#   B1 - off-cascade icon library. An import/require of an icon library OUTSIDE the
#        approved cascade (react-icons, Font Awesome, Feather, Iconify, Ionicons,
#        Ant/MUI icons, remix/box/octicons, etc.). Matched only at REAL import/require
#        positions after stripping comments, so a name inside a // comment or a mid-code
#        string never denies the write.
#
#   B2 - fabricated / hand-drawn icon. An inline <svg> carrying the semantic icon signal
#        that shipped at precision 1.000 in the taste-validator (root aria-hidden="true"
#        AND currentColor AND square viewBox side <= 48 AND no text/image/defs/gradient/
#        animate/use) AND built from >= 2 primitive elements OR one compound path with
#        >= 2 subpaths, AND carrying NO provenance marker. A verbatim icon that keeps its
#        library class / data-icon-source marker passes. B2 deliberately does NOT fire on
#        two separate <path> elements (the normal shape of a legit multi-path icon) - it
#        prioritizes zero false-blocks over recall; the taste-validator inject still
#        surfaces that softer case for review.
#
# What is NOT enforced here (behavioral, documented in the skill): the cascade PRIORITY
# itself (Figma > animated > reicon > static) and static-on-interactive. A hook cannot
# know the Figma-ref state, whether an animated icon exists for a concept, or reliably
# whether an element is interactive, so blocking on those would over-block.
#
# Emits permissionDecision JSON on stdout (deny) or {} (allow), exit 0. Modeled on
# content-guard.sh. The python program is fed through a QUOTED heredoc and the hook input
# arrives via an env var, so apostrophes inside the program are safe (unlike the
# single-quoted -c form content-guard uses).

INPUT=$(cat)

ICON_GUARD_INPUT="$INPUT" python3 <<'PY'
import json, os, re, sys

try:
    data = json.loads(os.environ.get("ICON_GUARD_INPUT", "") or "{}")
except Exception:
    print("{}"); sys.exit(0)

tool = data.get("tool_name", "")
inp = data.get("tool_input", {}) or {}
fp = str(inp.get("file_path") or "")

# ---- assemble the written content (Write / Edit / MultiEdit) ----
if tool == "Write":
    content = inp.get("content", "") or ""
elif tool == "Edit":
    content = inp.get("new_string", "") or ""
elif tool == "MultiEdit":
    content = "\n".join((e or {}).get("new_string", "") for e in (inp.get("edits", []) or []))
else:
    print("{}"); sys.exit(0)

if not content or not fp:
    print("{}"); sys.exit(0)

# ---- path gate: only buildable app source, never corpus/fixtures/backups/vendored ----
low = fp.replace("\\", "/").lower()

# B1 (imports) applies to import-bearing files; B2 (inline svg) to markup files.
IMPORT_EXT = (".jsx", ".tsx", ".ts", ".js", ".mjs", ".cjs", ".vue", ".svelte", ".astro",
              ".html", ".htm")
MARKUP_EXT = (".html", ".htm", ".jsx", ".tsx", ".vue", ".svelte", ".astro")

EXCLUDE_SUBSTR = (
    "/.backups/", "/node_modules/", "/worktrees/", "/.git/",
    "/dist/", "/build/", "/coverage/", "/.next/", "/out/",
    "/corpus/", "eval/corpus", "/_extracted/",
    "efficacy-trial", "/fixtures/", "/fixture/", "/__tests__/", "/__mocks__/",
    "/dependency-map/",
)
def excluded(path):
    if any(s in path for s in EXCLUDE_SUBSTR):
        return True
    b = path.rsplit("/", 1)[-1]
    if b.startswith("test-") or b.startswith("test_"):
        return True
    for tag in (".test.", ".spec.", ".stories.", ".min.", ".fixture."):
        if tag in b:
            return True
    return False

if excluded(low):
    print("{}"); sys.exit(0)

def deny(reason):
    print(json.dumps({"hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": "BLOCKED: " + reason,
    }}))
    sys.exit(0)

# =====================================================================================
# B1 - off-cascade icon library import
# =====================================================================================
# Curated blocklist of common icon libraries OUTSIDE the approved cascade. Matched as a
# module specifier only, at a REAL import/require position (see the comment-strip and
# import-line anchoring below), so CSS/font-face banners, // comments, and mid-code
# strings never trip it. Approved-cascade specifiers (lucide, heroicons, @tabler/icons,
# bootstrap-icons, phosphor, @hugeicons, reicon, @lobehub, *-animated) are NOT listed and
# pass. Scoped names are matched with a boundary (@mui/icons-material, not @mui/material).
OFF_CASCADE = (
    "react-icons",
    "@fortawesome", "fortawesome", "font-awesome",
    "feather-icons", "react-feather",
    "@iconify",
    "ionicons",
    "@ant-design/icons",
    "@mui/icons-material", "@material-ui/icons",
    "primeicons",
    "remixicon",
    "boxicons",
    "@primer/octicons", "@primer/octicons-react",
    "grommet-icons",
    "css.gg", "@css.gg",
    "typicons",
)
if low.endswith(IMPORT_EXT):
    # Extract module specifiers only from REAL import/require positions, never from a
    # name that merely appears in a comment or string. Two vectors are neutralized:
    #   1. Comments: strip // line and /* */ block comments before matching, so
    #      "// migrated away from react-icons" above a real lucide import does not deny
    #      the whole write.
    #   2. Mid-code strings: match a static specifier only on lines that ARE an import /
    #      re-export statement (line begins with import, or export ... from "x", or a
    #      } from "x" multiline continuation - from must be followed by whitespace then a
    #      quote, so an object key from: is not caught). require()/import() CALLS are
    #      matched anywhere (after comment strip) EXCEPT when the call keyword itself
    #      sits inside a string literal (same-line quote-balance check), so a code
    #      sample like  const s = 'require("react-icons")'  does not deny the write.
    # Residual accepted limit (documented in the skill): a full off-cascade import line
    # embedded inside a MULTILINE template-literal code sample is indistinguishable from a
    # real import without a JS parser and will still deny - keep such samples in .md/data.
    def _strip_comments(s):
        s = re.sub(r"/\*.*?\*/", " ", s, flags=re.S)   # block comments
        s = re.sub(r"(?m)//.*$", " ", s)               # line comments
        return s
    code = _strip_comments(content)

    def _in_string_literal(text, pos):
        # Same-line string-context check: an ODD number of unescaped quotes of a
        # given kind before `pos` on its physical line means `pos` sits inside a
        # string literal. Used to stop a require()/import() CALL that appears
        # INSIDE a string (e.g. a code sample assigned to a const) from denying
        # the write - the docs promise mid-code strings never deny. Multiline
        # strings / template literals fall through as "not in a string", which is
        # the fail-OPEN direction a never-over-block gate must prefer.
        ls = text.rfind("\n", 0, pos) + 1
        prefix = text[ls:pos]
        for q in ('"', "'", "`"):
            if len(re.findall(r"(?<!\\)" + re.escape(q), prefix)) % 2 == 1:
                return True
        return False

    specs = []
    for mm in re.finditer(r"""\b(?:require|import)\s*\(\s*['"]([^'"]+)['"]""", code):
        if _in_string_literal(code, mm.start()):
            continue   # require()/import() call sitting inside a string literal
        specs.append(mm.group(1))
    _imp_line = re.compile(r"""^\s*(?:import\s|export\b.*\bfrom\s+['"]|\}?\s*from\s+['"])""")
    for line in code.splitlines():
        if _imp_line.match(line):
            q = re.findall(r"""['"]([^'"]+)['"]""", line)
            if q:
                specs.append(q[-1])   # module specifier is the last quoted string on the line
    for spec in specs:
        s = spec.strip().lower()
        for lib in OFF_CASCADE:
            # Boundary-checked (scoped and unscoped alike): exact or a real sub-path
            # lib/... - stops @iconify swallowing @iconifyx; no off-cascade package is
            # imported as a bare scope with no sub-path.
            if s == lib or s.startswith(lib + "/"):
                deny(
                    "icon library %r is outside the approved cascade. Route the icon by "
                    "context via the icon-source cascade instead: interactive icons -> Figma "
                    "extract / Lucide Animated / Heroicons Animated / Hugeicons Animated / "
                    "reicon / static tier (Lucide, Heroicons, Hugeicons, Phosphor, Material "
                    "Symbols); non-interactive -> reicon then static; company/brand/AI logos "
                    "-> Lobehub. See the icon-source skill." % spec
                )

# =====================================================================================
# B2 - fabricated / hand-drawn icon (semantic P=1.000 signal, no provenance marker)
# =====================================================================================
if low.endswith(MARKUP_EXT):
    FORBIDDEN = ("<text", "<image", "<defs", "<animate", "<use", "gradient")
    # Long, unambiguous markers matched as plain substrings.
    LONG_MARKERS = ("data-icon-source", "lucide", "reicon", "hugeicon", "heroicon",
                    "phosphor", "tabler", "bootstrap-icons", "material-symbols",
                    "material-icons")
    # Short class-prefix markers (hgi / ph- / ti- / bi-) require a class-token boundary
    # (preceding quote or whitespace) so an unrelated word like "morph-x" does not vouch.
    SHORT_MARKERS_RE = re.compile(r"""["'\s](hgi|ph-|ti-|bi-)""")
    prim_re = re.compile(r"<(line|rect|circle|polyline|polygon|ellipse)\b", re.I)
    path_re = re.compile(r'<path\b[^>]*\bd\s*=\s*"([^"]*)"', re.I | re.S)
    open_re = re.compile(r"<svg\b[^>]*>", re.I)

    for m in re.finditer(r"<svg\b.*?</svg>", content, re.I | re.S):
        block = m.group(0)
        blow = block.lower()
        open_tag = (open_re.search(block).group(0) if open_re.search(block) else "")
        otl = open_tag.lower()

        # semantic icon gate (all must hold)
        aria_hidden_root = bool(re.search(r'aria-hidden\s*=\s*["\']true["\']', otl))
        if not aria_hidden_root:
            continue
        if "currentcolor" not in blow:
            continue
        if any(f in blow for f in FORBIDDEN):
            continue
        # a labelled graphic is a chart/logo, not a decorative icon - never fabrication
        if 'role="img"' in blow or "role='img'" in blow or "aria-label" in blow:
            continue

        # square viewBox side <= 48, or square width/height <= 48. Accept whitespace OR
        # comma separators (SVG allows both; exporters commonly emit commas).
        square_small = False
        vb = re.search(r'viewbox\s*=\s*["\']?\s*0[\s,]+0[\s,]+([\d.]+)[\s,]+([\d.]+)', otl)
        if vb:
            w, h = float(vb.group(1)), float(vb.group(2))
            square_small = abs(w - h) < 0.01 and w <= 48
        else:
            wm = re.search(r'\bwidth\s*=\s*["\']?([\d.]+)', otl)
            hm = re.search(r'\bheight\s*=\s*["\']?([\d.]+)', otl)
            if wm and hm:
                w, h = float(wm.group(1)), float(hm.group(1))
                square_small = abs(w - h) < 0.01 and w <= 48
        if not square_small:
            continue

        # provenance marker present anywhere in the block -> verbatim, allow
        if any(mk in blow for mk in LONG_MARKERS) or SHORT_MARKERS_RE.search(blow):
            continue

        # drawing signal: >= 2 primitive elements, OR one compound path with >= 2 subpaths.
        # (Two SEPARATE <path> elements deliberately do NOT trip this - see header.)
        prim_count = len(prim_re.findall(block))
        compound = any(len(re.findall(r"[Mm]", d)) >= 2 for d in path_re.findall(block))
        if prim_count >= 2 or compound:
            deny(
                "this inline <svg> is a hand-drawn / fabricated icon (aria-hidden, "
                "currentColor, square viewBox, built from primitives or a compound path, "
                "with no provenance marker). Source the icon VERBATIM from the cascade and "
                "keep its library class / data-icon-source marker: interactive -> Figma "
                "extract or an animated library (Lucide/Heroicons/Hugeicons Animated) then "
                "reicon then the static tier; non-interactive -> reicon then static. Never "
                "draw icon path data by hand. See the icon-source skill."
            )

print("{}")
PY
