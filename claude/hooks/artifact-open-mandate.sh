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

# Reap pending files from sessions that ended without discharging, so per-session
# files cannot accumulate forever and a stale one cannot block a key that gets reused.
find "$HOME/.claude" -maxdepth 1 -name '.artifact-pending.*' -mtime +1 -delete 2>/dev/null

# Extract the one in-scope, not-excluded, existing path to record (or nothing). All
# the scope + exclusion logic lives here so tuning is a single-file edit.
#
# ARTIFACT_SURFACE_EXTS (optional): a comma/space list of extensions that REPLACES the
# default in-scope set. Leading dots optional. Cheap tuning override; unset by default.
PATH_TO_SHOW=$(printf '%s' "$INPUT" | ARTIFACT_SURFACE_EXTS="${ARTIFACT_SURFACE_EXTS:-}" python3 -c '
import json, sys, os, re

# IN SCOPE, split by HOW the user sees it. Visuals render/open directly; documents are
# authored deliverables. The split drives the exclusion rules below.
VISUAL_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".svg", ".pdf",
    ".html", ".htm",
}
DOC_EXTS = {
    ".md", ".txt", ".csv", ".rtf", ".doc", ".docx",
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
    r"|(^|/)node_modules/"
    r"|(^|/)\.git/"
    r"|(^|/)dist/"
    r"|(^|/)build/"
    r"|(^|/)\.next/"
    r"|(^|/)coverage/"
    r"|(^|/)docs/superpowers/plans/"  # internal plan docs
)
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
    if ext in DOCS and EXCLUDE_DOCS_TEMP.search(path):
        return False
    return True

# A Bash command that only READS/inspects/deletes a file did not create an artifact.
CONSUMER_RE = re.compile(
    r"^\s*(?:sudo\s+)?(?:cat|rm|ls|stat|file|head|tail|grep|egrep|fgrep|rg|less|more"
    r"|open|xdg-open|wc|md5|md5sum|shasum|sha256sum|du|chmod|chown|touch|find|diff)\b"
)
# Only VISUAL extensions are harvested from a Bash command; documents stay Write-only.
VISUAL_PATH_RE = re.compile(
    r"(/[^\s\"\x27;|&><]+\.(?:png|jpe?g|gif|webp|avif|svg|pdf|html?))", re.I
)

try:
    d = json.load(sys.stdin)
except Exception:
    print(""); sys.exit(0)

tool = d.get("tool_name", "")
ti = d.get("tool_input", {}) or {}

# The Artifact tool PUBLISHES the file to the user - that already shows it. Never
# record a pending entry for an Artifact call. (artifact-open-clear.sh, wired to the
# same tool, CLEARS a prior pending entry when the same file is published.)
if tool == "Artifact":
    print(""); sys.exit(0)

candidates = []
if tool == "Write":
    fp = ti.get("file_path", "") or ""
    if fp:
        candidates.append(fp)
elif tool == "Bash":
    # Harvest the VISUAL artifact a command PRODUCED, from the command text and the tool
    # output. Documents are intentionally NOT harvested from Bash. require-exists below
    # is the real gate against phantom paths. Candidates are built in OUTPUT-first
    # priority so an input/source visual never steals the obligation from the generated
    # output (e.g. `svgo src/logo.svg -o out.svg` must record out.svg, not logo.svg).
    cmd = ti.get("command", "") or ""
    if cmd and not CONSUMER_RE.search(cmd):
        def _unquote(s):
            return s[1:-1] if len(s) >= 2 and s[0] in "\"\x27" and s[-1] == s[0] else s
        def _visual(p):
            # Only VISUALs are harvested from Bash; a document named by -o/redirect must
            # not sneak in (documents are Write-tool-only).
            return os.path.splitext(p)[1].lower() in VIS
        # 1. explicit output flags: -o / -O / --out / --output / --outfile FILE
        for m in re.finditer(r"(?:-o|-O|--out(?:put|file)?)[ =]+(\"[^\"]+\"|\x27[^\x27]+\x27|[^\s;|&]+)", cmd):
            cand = _unquote(m.group(1))
            if _visual(cand):
                candidates.append(cand)
        # 2. redirect target: > FILE or >> FILE (not >&2 etc - & is excluded)
        for m in re.finditer(r">>?[ \t]*(\"[^\"]+\"|\x27[^\x27]+\x27|[^\s;|&<>]+)", cmd):
            cand = _unquote(m.group(1))
            if _visual(cand):
                candidates.append(cand)
        # 3. visual paths in the command, LAST first (a CLI output arg is usually last)
        candidates.extend(reversed(VISUAL_PATH_RE.findall(cmd)))
        # 4. visual paths named in the tool output
        resp = d.get("tool_response", d.get("tool_result", {}))
        blob = resp if isinstance(resp, str) else ""
        if isinstance(resp, dict):
            for v in resp.values():
                if isinstance(v, str) and v:
                    blob = v
                    break
        candidates.extend(VISUAL_PATH_RE.findall(blob or ""))
else:
    # A future MCP artifact/image tool: harvest an explicit output-path key. Dormant
    # today (no such tool wired); kept so adding one is a one-line matcher widen.
    for k in ("file_path", "output", "out", "path", "save_path", "output_path", "destination"):
        v = ti.get(k)
        if isinstance(v, str) and v:
            candidates.append(v)
            break

# Record the first candidate that is in scope AND exists on disk.
for cand in candidates:
    cp = canonical(cand)
    if in_scope(cp) and os.path.exists(cp):
        print(cp)
        sys.exit(0)
print("")
' 2>/dev/null)

if [ -n "$PATH_TO_SHOW" ]; then
  # APPEND, never overwrite. Dedup so re-writing the same file does not double-list it.
  mkdir -p "$(dirname "$PENDING_FILE")"
  grep -qxF -- "$PATH_TO_SHOW" "$PENDING_FILE" 2>/dev/null \
    || printf '%s\n' "$PATH_TO_SHOW" >> "$PENDING_FILE"
  OUTSTANDING=$(wc -l < "$PENDING_FILE" 2>/dev/null | tr -d ' ')
  MSG="MANDATORY: you just created $PATH_TO_SHOW. Open it and show it to the user (Read it, publish it via the Artifact tool, or open it in its app) before you end this turn. A file left in a directory the user has to dig up does not count as shown."
  if [ "${OUTSTANDING:-1}" -gt 1 ]; then
    MSG="$MSG ($OUTSTANDING artifacts are now outstanding in this session; each one must be shown.)"
  fi
  python3 -c "import json, sys; print(json.dumps({'hookSpecificOutput':{'hookEventName':'PostToolUse','additionalContext':sys.argv[1]}}))" "$MSG"
else
  echo '{}'
fi
