#!/bin/bash
# PostToolUse hook for Write, the Artifact tool, and Bash (matcher: Write|Artifact|Bash).
# When Claude creates a NET artifact on its own - an image, a viewable page, or an
# authored document - it must SHOW that artifact to the user, not leave it in a
# directory the user has to dig up. This hook records the path of every in-scope,
# not-excluded artifact into a per-session pending list and injects a reminder to
# surface it. The companion hooks discharge and enforce the obligation:
#   - artifact-open-clear.sh strikes a path off when it is surfaced (a successful Read,
#     an Artifact publish, or `open`/`xdg-open`/`start` in the native app).
#   - artifact-open-stop.sh BLOCKS the turn once while any path is still unshown.
#
# This is the screenshot-open-mandate pattern generalized from screenshots to all
# artifacts, and it copies that hook's four hard-won lessons verbatim:
#   1. Per-session keying, NOT a global file - one session's surfacing must not
#      discharge another session's obligation, and concurrent cmux surfaces share
#      one $HOME.
#   2. APPEND, never overwrite - a second artifact must not erase the first's
#      obligation.
#   3. Require the path to EXIST on disk before recording - a PostToolUse hook runs
#      AFTER creation, so a real artifact is on disk by now; refusing a phantom path
#      makes an unsatisfiable mandate impossible.
#   4. A one-day reaper so a dead session's pending file cannot wedge a fresh session
#      that reuses its key.
#
# SCOPE (Jonah 2026-08-07, "balanced"): visuals (images, pdf, viewable pages) are
# harvested from Write AND Bash and are caught even in scratch/temp, because a
# generated image commonly lands there and the user still wants to see it. Documents
# (.md .txt .csv .rtf .doc .docx) are harvested from the Write tool ONLY and keep the
# temp/scratch exclusion, because an intermediate document in scratch is usually not a
# deliverable. Pure consumer Bash commands (cat/rm/ls/open/...) never create anything,
# so they are skipped.
#
# Key derivation (the `or ""` form) is duplicated byte-for-byte in
# artifact-open-clear.sh and artifact-open-stop.sh. If you change it, change all three
# or they will disagree on the pending-file path.

INPUT=$(cat)

# DEFAULT ON. The feature is active on every machine with no per-machine opt-in.
# Presence of the disable marker turns the whole trio OFF (this is the same polarity
# as concise's disable marker). When disabled, be completely silent.
[ -f "$HOME/.claude/.artifact-surface-disabled" ] && { echo '{}'; exit 0; }

SESSION_KEY=$(printf '%s' "$INPUT" | python3 -c '
import json, re, sys
try:
    d = json.load(sys.stdin)
except Exception:
    d = {}
s = str(d.get("session_id", "") or "")
s = re.sub(r"[^A-Za-z0-9._-]", "_", s)
print(s or "global")
' 2>/dev/null)
[ -z "$SESSION_KEY" ] && SESSION_KEY=global
PENDING_FILE="$HOME/.claude/.artifact-pending.$SESSION_KEY"
# The shown ledger records every artifact SURFACED this session (written by
# artifact-open-clear.sh). This hook consults it so a path shown once is never
# re-recorded, even if a later Bash command mentions it again - that re-harvest with no
# shown-memory was the re-flag loop reproduced 2026-08-19. Key byte-identical to PENDING_FILE.
SHOWN_FILE="$HOME/.claude/.artifact-shown.$SESSION_KEY"

# Reap pending AND shown files from sessions that ended, so per-session files cannot
# accumulate forever and a stale one cannot block/skip a key that gets reused.
find "$HOME/.claude" -maxdepth 1 \( -name '.artifact-pending.*' -o -name '.artifact-shown.*' \) -mtime +1 -delete 2>/dev/null

# Extract the one in-scope, not-excluded, existing path to record (or nothing). All
# the scope + exclusion logic lives here so tuning is a single-file edit.
#
# ARTIFACT_SURFACE_EXTS (optional): a comma/space list of extensions that REPLACES the
# default in-scope set. Leading dots optional. Cheap tuning override; unset by default.
PATH_TO_SHOW=$(printf '%s' "$INPUT" | ARTIFACT_SURFACE_EXTS="${ARTIFACT_SURFACE_EXTS:-}" ARTIFACT_SURFACE_IGNORE="${ARTIFACT_SURFACE_IGNORE:-}" ARTIFACT_SHOWN_FILE="$SHOWN_FILE" python3 -c '
import json, sys, os, re

# IN SCOPE, split by HOW the user sees it. Visuals render/open directly; documents are
# authored deliverables. The split drives the exclusion rules below.
VISUAL_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".pdf",
    ".html", ".htm",
}
DOC_EXTS = {
    ".md", ".txt", ".csv", ".rtf", ".doc", ".docx",
    # Binary office formats. Unlike the text docs above, these can ONLY be produced
    # by a script (they are binary - the Write tool cannot author them), so they are
    # ALSO harvested from Bash below (OFFICE_BASH). A Word doc a script saved to the
    # Desktop fell straight through this hook until 2026-08-13 because of that.
    ".xlsx", ".xls", ".pptx", ".ppt", ".odt", ".ods", ".odp",
}
DEFAULT_EXTS = VISUAL_EXTS | DOC_EXTS
# Source-code / config extensions are deliberately NOT in scope - a stylesheet, a
# script, or a config file is not a "document to show" (.sh .js .ts .json .css .yaml
# .toml .ini .env .sql .xml .lock ...). Because IN-SCOPE is a positive allowlist, every
# one of those is excluded automatically by not being in the set.
_env = os.environ.get("ARTIFACT_SURFACE_EXTS", "").strip()
if _env:
    EXTS = set()
    for tok in re.split(r"[,\s]+", _env):
        if tok:
            EXTS.add((tok if tok.startswith(".") else "." + tok).lower())
    # Keep the visual/doc split so exclusions still make sense: a known visual ext in
    # the override is treated as visual, everything else as a document.
    VIS = {e for e in EXTS if e in VISUAL_EXTS}
    DOCS = EXTS - VIS
else:
    EXTS = DEFAULT_EXTS
    VIS = VISUAL_EXTS
    DOCS = DOC_EXTS

# HARD EXCLUSIONS - the list that keeps this hook quiet.
# Internal repo docs by BASENAME (in-scope extension, but never a deliverable to show).
EXCLUDED_BASENAMES = {
    "tasks.md", "memory.md", "memory-archive.md", "claude.md", "readme.md",
    "changelog.md", "product.md", "design.md", "package-lock.json",
}
# Internal / vendor / build locations excluded for EVERY artifact type.
EXCLUDE_ALWAYS = re.compile(
    r"(^|/)\.claude(/|$)"            # beats, settings, memory - NEVER flag these
    r"|(^|/)\.design(/|$)"          # internal design/Figma reference captures, pulled to
                                    # build AGAINST, not deliverables (peer report 2026-08-19)
    r"|(^|/)node_modules/"
    r"|(^|/)\.git/"
    r"|(^|/)dist/"
    r"|(^|/)build/"
    r"|(^|/)\.next/"
    r"|(^|/)coverage/"
    r"|(^|/)docs/superpowers/plans/"  # internal plan docs
)
# USER IGNORE (ARTIFACT_SURFACE_IGNORE): a comma/space list of directory names or path
# fragments a project marks as its own internal scaffolding (e.g. ".design, assets/refs,
# .snapshots"). Any artifact whose path contains a listed token as a /-bounded segment is
# never flagged. This is the durable "mark a dir internal" knob so scaffolding a script
# CREATES but never itself opens does not nag; set it per project (settings env) or
# globally. Unset by default, so default behavior is unchanged.
_ign = os.environ.get("ARTIFACT_SURFACE_IGNORE", "").strip()
IGNORE_RE = None
if _ign:
    _toks = [re.escape(t) for t in re.split(r"[,\s]+", _ign) if t]
    if _toks:
        IGNORE_RE = re.compile(r"(^|/)(?:" + "|".join(_toks) + r")(/|$)")
# Scratch/temp locations excluded for DOCUMENTS ONLY. A generated image commonly lands
# in a temp dir and the user still wants to see it (Jonah 2026-08-07 balanced choice),
# so visuals are NOT excluded here; an intermediate .md/.txt in scratch usually is not
# a deliverable, so documents keep this exclusion.
EXCLUDE_DOCS_TEMP = re.compile(
    r"(^|/)scratchpad/"
    r"|/tmp/"
    r"|/var/folders/"
)

def canonical(p):
    # Same canonicalization used by artifact-open-clear.sh so a recorded path and a
    # surfaced path compare equal.
    return os.path.normpath(os.path.expanduser(p))

def in_scope(path):
    if not path:
        return False
    base = os.path.basename(path)
    ext = os.path.splitext(base)[1].lower()
    if ext not in EXTS:
        return False
    b = base.lower()
    if b in EXCLUDED_BASENAMES:
        return False
    if b.endswith(".lock"):
        return False
    if EXCLUDE_ALWAYS.search(path):
        return False
    if IGNORE_RE and IGNORE_RE.search(path):
        return False
    if ext in DOCS and EXCLUDE_DOCS_TEMP.search(path):
        return False
    return True

# A Bash command that only READS/inspects/deletes a file did not create an artifact.
CONSUMER_RE = re.compile(
    r"^\s*(?:sudo\s+)?(?:cat|rm|ls|stat|file|head|tail|grep|egrep|fgrep|rg|less|more"
    r"|open|xdg-open|wc|md5|md5sum|shasum|sha256sum|du|chmod|chown|touch|find|diff"
    # Archive tools: their -o / first positional names an INPUT archive (e.g.
    # `unzip -o x.docx` = OVERWRITE while extracting, not an output file), and an
    # extracted file is not a deliverable Claude authored (Codex LOW 2026-08-13).
    r"|unzip|zipinfo|tar|bsdtar|7z|7za|unar)\b"
)
# VISUAL paths are harvested from ANYWHERE in a Bash command or its output (the
# balanced choice, Jonah 2026-08-07 - over-nag rather than miss a generated image).
VISUAL_PATH_RE = re.compile(
    r"(/[^\s\"\x27;|&><]+\.(?:png|jpe?g|gif|webp|avif|svg|pdf|html?))", re.I
)
# Binary office docs (a Word/Excel/PowerPoint file can ONLY be produced by a script,
# never by the Write tool) are harvested ONLY from an EXPLICIT OUTPUT position - an
# -o/--output flag, a redirect, or a save/write/to_excel(...) call that names the
# path. NOT from a bare positional or a stdout mention, because office formats also
# appear as INPUTS (convert FROM a .docx, a template .docx) and as log references,
# and nagging to open one of THOSE is a false positive (Codex 2026-08-13). The
# quoted-capture in OFFICE_SAVE_RE also catches an output PATH WITH SPACES.
OFFICE_BASH = {".docx", ".doc", ".xlsx", ".xls", ".pptx", ".ppt", ".odt", ".ods", ".odp"}
OFFICE_SAVE_RE = re.compile(
    r"(?:save(?:_as)?|write|to_excel|dump)\s*\(\s*"
    r"([\x27\"])((?:/|~)(?:(?!\1).)*\.(?:docx?|xlsx?|pptx?|od[tsp]))\1",
    re.I,
)

try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit(0)

tool = d.get("tool_name", "")
ti = d.get("tool_input", {}) or {}
resp = d.get("tool_response", d.get("tool_result", None))

# GAP A (inline-returned images, Jonah 2026-08-07): a tool that RENDERED the image inline
# in this same tool result has already shown it to the user in the conversation. Recording
# such a path would nag for a redundant Read and trip the Stop gate on an image the user
# already saw. has_inline_image() finds an image content block (an Anthropic
# {"type":"image"} block, or an MCP image/* media type) anywhere in the tool result. It is
# STRUCTURE-based - it only descends into dict/list nodes, never strings - so a Bash stdout
# STRING that merely mentions "image/png" can never match. Used by the else-branch below,
# which is where an inline-image tool (e.g. a Chrome-MCP screenshot with save_to_disk)
# lands; Write and Bash never return an inline image, so their paths are untouched.
#
# A match requires BOTH an image LABEL (a {"type":"image"} block or an image/* media type)
# AND an actual inline PAYLOAD (base64 data, or a source with data/url). That second
# condition is load-bearing: a save-only result whose metadata merely says
# {"type":"image","path":"/x/out.png","status":"saved"} carries NO rendered pixels, so it
# must fall through and be tracked, not be mistaken for something the user already saw.
def _has_image_payload(node):
    if isinstance(node.get("data"), str) and node.get("data"):
        return True
    src = node.get("source")
    if isinstance(src, dict):
        if isinstance(src.get("data"), str) and src.get("data"):
            return True
        if isinstance(src.get("url"), str) and src.get("url"):
            return True
    return False

def has_inline_image(node, depth=0):
    if depth > 6:
        return False
    if isinstance(node, dict):
        t = node.get("type")
        is_img = isinstance(t, str) and t.lower() == "image"
        for key in ("media_type", "mimeType", "mime_type"):
            v = node.get(key)
            if isinstance(v, str) and v.lower().startswith("image/"):
                is_img = True
                break
        src = node.get("source")
        if isinstance(src, dict):
            for key in ("media_type", "mimeType", "mime_type"):
                v = src.get(key)
                if isinstance(v, str) and v.lower().startswith("image/"):
                    is_img = True
                    break
        if is_img and _has_image_payload(node):
            return True
        for v in node.values():
            if isinstance(v, (dict, list)) and has_inline_image(v, depth + 1):
                return True
    elif isinstance(node, list):
        for v in node:
            if isinstance(v, (dict, list)) and has_inline_image(v, depth + 1):
                return True
    return False

# The Artifact tool PUBLISHES the file to the user - that already shows it. Never
# record a pending entry for an Artifact call. (artifact-open-clear.sh, wired to the
# same tool, CLEARS a prior pending entry when the same file is published.)
if tool == "Artifact":
    print(""); sys.exit(0)

# Paths already surfaced this session (written by artifact-open-clear.sh on discharge). The
# already-shown skip is applied ONLY to MENTION candidates below - never to a creation or a
# Write - so re-generating or overwriting a shown path is still flagged as unshown (Codex P1
# 2026-08-19). Loading here is safe: canonical() is defined above.
SHOWN = {}
_sf = os.environ.get("ARTIFACT_SHOWN_FILE", "")
if _sf:
    try:
        with open(_sf) as _f:
            for _ln in _f:
                _ln = _ln.rstrip("\n")
                if not _ln.strip():
                    continue
                _p, _, _mt = _ln.partition("\t")
                try:
                    SHOWN[canonical(_p)] = int(_mt) if _mt else 0
                except Exception:
                    SHOWN[canonical(_p)] = 0
    except Exception:
        SHOWN = {}

# CREATIONS (Write, -o/--output flags, redirects, save()-calls, MCP output keys) name an
# artifact this call PRODUCED - always a live obligation. MENTIONS (a visual path scraped
# generically from a Bash command or its stdout) may be an input/reference; a mention of a
# path already shown this session must NOT re-arm the gate. Creations are considered first
# (output-first priority, unchanged), then unshown mentions.
creations = []
mentions = []
if tool == "Write":
    fp = ti.get("file_path", "") or ""
    if fp:
        creations.append(fp)
elif tool == "Bash":
    # Harvest the VISUAL or BINARY-OFFICE artifact a command PRODUCED, from the command
    # text and the tool output. TEXT documents (.md/.txt/.csv/.rtf) are still NOT
    # harvested from Bash (they can be scratch/intermediate); binary office docs ARE,
    # because a script is the only way to create them and they are always deliverables.
    # require-exists below is the real gate against phantom paths. Candidates are built
    # OUTPUT-first so an input/source never steals the obligation from the generated
    # output (e.g. `svgo src/logo.svg -o out.svg` must record out.svg, not logo.svg).
    cmd = ti.get("command", "") or ""
    if cmd and not CONSUMER_RE.search(cmd):
        def _unquote(s):
            return s[1:-1] if len(s) >= 2 and s[0] in "\"\x27" and s[-1] == s[0] else s
        def _harvestable(p):
            # VISUALs and binary office docs are harvested from Bash; a TEXT document
            # named by -o/redirect must not sneak in (those are Write-tool-only).
            ext = os.path.splitext(p)[1].lower()
            return ext in VIS or ext in OFFICE_BASH
        # 1. explicit output flags: -o / -O / --out / --output / --outfile FILE
        for m in re.finditer(r"(?:-o|-O|--out(?:put|file)?)[ =]+(\"[^\"]+\"|\x27[^\x27]+\x27|[^\s;|&]+)", cmd):
            cand = _unquote(m.group(1))
            if _harvestable(cand):
                creations.append(cand)
        # 2. redirect target: > FILE or >> FILE (not >&2 etc - & is excluded)
        for m in re.finditer(r">>?[ \t]*(\"[^\"]+\"|\x27[^\x27]+\x27|[^\s;|&<>]+)", cmd):
            cand = _unquote(m.group(1))
            if _harvestable(cand):
                creations.append(cand)
        # 3. an office OUTPUT named by a save/write/to_excel(...) call (the python-docx
        #    incident shape). Quoted-capture catches a path WITH SPACES, and only an
        #    explicit save call qualifies, so an INPUT/mention office path never sneaks in.
        for m in OFFICE_SAVE_RE.finditer(cmd):
            creations.append(m.group(2))
        # 4. generic VISUAL paths in the command, LAST first. Visuals only: office docs
        #    are output-position-only (flags/redirect/save-call above), because a bare
        #    positional office path is often an INPUT (e.g. `soffice --convert-to`).
        #    These are MENTIONS (could be an input/reference), so a shown one is skipped.
        mentions.extend(reversed(VISUAL_PATH_RE.findall(cmd)))
        # 5. VISUAL paths named in the tool output (resp hoisted above). Office docs are
        #    NEVER harvested from stdout - a mentioned template/input is not a creation.
        blob = resp if isinstance(resp, str) else ""
        if isinstance(resp, dict):
            for v in resp.values():
                if isinstance(v, str) and v:
                    blob = v
                    break
        mentions.extend(VISUAL_PATH_RE.findall(blob or ""))
else:
    # GAP A: a tool (e.g. a Chrome-MCP screenshot with save_to_disk) that returned the
    # image INLINE in this same result already surfaced it to the user - record nothing so
    # it neither nags for a redundant Read nor trips the Stop gate on an image already
    # seen. A saved image that was NOT rendered inline falls through and is tracked below.
    if has_inline_image(resp):
        print(""); sys.exit(0)
    # A future MCP artifact/image tool that saves WITHOUT an inline render: harvest an
    # explicit output-path key so it is still tracked. Dormant until such a tool is wired
    # into this hook matcher (a one-line widen).
    for k in ("file_path", "output", "out", "path", "save_path", "output_path", "destination"):
        v = ti.get(k)
        if isinstance(v, str) and v:
            creations.append(v)
            break

# Record the first CREATION in scope + on disk (always a live obligation). Failing that,
# the first MENTION in scope + on disk that was NOT already surfaced this session - so a
# bare re-mention of a shown artifact cannot re-arm the gate (the re-flag-loop fix), while
# an unshown referenced path still nags (the balanced over-nag choice, unchanged).
for cand in creations:
    cp = canonical(cand)
    if in_scope(cp) and os.path.exists(cp):
        print(cp)
        sys.exit(0)
for cand in mentions:
    cp = canonical(cand)
    if not (in_scope(cp) and os.path.exists(cp)):
        continue
    if cp in SHOWN:
        # Skip ONLY if the file is unchanged since it was shown. A newer mtime means the
        # command re-created it (bare-positional output, or a stdout "saved X"), so it is a
        # new artifact and must re-flag. A stat failure cannot prove it unchanged -> record.
        try:
            unchanged = os.stat(cp).st_mtime_ns <= SHOWN[cp]
        except Exception:
            unchanged = False
        if unchanged:
            continue
    print(cp)
    sys.exit(0)
print("")
' 2>/dev/null)

if [ -n "$PATH_TO_SHOW" ]; then
  # APPEND, never overwrite. Dedup so re-writing the same file does not double-list it.
  # (The already-shown guard lives in the extractor above, applied to MENTION candidates
  # only, so a genuine re-creation/overwrite of a shown path is still flagged.)
  mkdir -p "$(dirname "$PENDING_FILE")"
  grep -qxF -- "$PATH_TO_SHOW" "$PENDING_FILE" 2>/dev/null \
    || printf '%s\n' "$PATH_TO_SHOW" >> "$PENDING_FILE"
  OUTSTANDING=$(wc -l < "$PENDING_FILE" 2>/dev/null | tr -d ' ')
  MSG="MANDATORY: you just created $PATH_TO_SHOW. Open it and show it to the user (Read it, publish it via the Artifact tool, or open it in its app) before you end this turn. A file left in a directory the user has to dig up does not count as shown."
  if [ "${OUTSTANDING:-1}" -gt 1 ]; then
    MSG="$MSG ($OUTSTANDING artifacts are now outstanding in this session; each one must be shown.)"
  fi
  # GAP B (superseded intermediates, Jonah 2026-08-07): if the just-recorded artifact looks
  # like a lighter/sibling VARIANT of another artifact still outstanding this session (same
  # directory, same extension, identical CORE name, differing only by a known size/quality/
  # version marker such as full/light/thumb/min/v2), the author may be about to show only
  # the new one and orphan the original. Nudge PROACTIVELY - at creation time - to surface
  # the original too or delete the orphan now, rather than let the Stop gate catch the
  # leftover. This is a HINT appended to the reminder; it never blocks. Bare numbers are
  # CORE tokens (so a numbered sequence slide_1/slide_2 is NOT a supersede), and a differing
  # directory or extension is never a sibling, keeping the nudge from over-firing.
  SIBLINGS=$(python3 - "$PENDING_FILE" "$PATH_TO_SHOW" <<'PY' 2>/dev/null
import sys, os, re
pend, target = sys.argv[1], sys.argv[2]
VARIANT = {
    "full", "light", "lite", "thumb", "thumbnail", "small", "large", "min",
    "minified", "mini", "compressed", "compact", "hires", "lowres", "retina",
    "1x", "2x", "3x", "draft", "temp", "tmp", "wip", "copy", "final", "orig",
    "original", "old", "backup", "bak",
}
def parts(p):
    base = os.path.basename(p)
    stem, ext = os.path.splitext(base)
    toks = [t for t in re.split(r"[ _.\-]+", stem.lower()) if t]
    core = [t for t in toks if t not in VARIANT and not re.fullmatch(r"(?:v|version)\d+", t)]
    return os.path.dirname(p), ext.lower(), stem.lower(), tuple(core)
td, te, ts, tc = parts(target)
if not tc:
    sys.exit(0)
try:
    lines = [ln.strip() for ln in open(pend) if ln.strip()]
except Exception:
    sys.exit(0)
seen, sibs = set(), []
for ln in lines:
    if ln == target or ln in seen:
        continue
    seen.add(ln)
    # Only name a sibling that still exists on disk. The Stop hook self-heals a deleted
    # pending path; mirroring that here keeps the nudge from pointing at an artifact that
    # was already cleaned up (aligning proactive advice with the backstop).
    if not os.path.exists(os.path.expanduser(ln)):
        continue
    dd, ee, ss, cc = parts(ln)
    if dd == td and ee == te and cc == tc and ss != ts:
        sibs.append(ln)
print(", ".join(sibs))
PY
)
  if [ -n "$SIBLINGS" ]; then
    MSG="$MSG SUPERSEDE CHECK: this looks like a sibling/variant of an artifact still outstanding this session ($SIBLINGS). If it supersedes that one, either surface the original too or delete the orphaned intermediate now, so an unshown leftover does not trip the end-of-turn gate."
  fi
  python3 -c "import json, sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','additionalContext':sys.argv[1]}}))" "$MSG"
else
  echo '{}'
fi
