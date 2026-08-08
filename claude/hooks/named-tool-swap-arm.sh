#!/usr/bin/env bash
#
# named-tool-swap-arm.sh - UserPromptSubmit hook. Half one of the named-tool
# substitution guard (its Stop partner is named-tool-swap-guard.sh).
#
# WHY THIS EXISTS. A field failure (session_2026-08-07_tool-declared-broken-
# direct-order-failure.md): Jonah said "spawn an agent"; the spawn errored twice;
# the assistant declared spawning "broken", did the whole task SOLO, and reported
# it done. Routing around a direct order to use a named tool - without fixing it
# and without the user's sign-off - is the sin this pair raises the cost of. This
# arm hook RECORDS that a demand was made; the Stop partner CHECKS whether the
# demanded capability actually ran before "done" is allowed.
#
# THE HONEST LIMIT (read this before widening the lexicon). The source beat that
# proposed this guard warns, in its own words, that it "will over-fire on
# paraphrase (spawn vs kick off a subagent). Keep its lexicon tight and treat it
# as a speed-bump, not a semantic judge." So the lexicon here is deliberately
# NARROW and ANCHORED. A false NEGATIVE (missing "kick off a subagent") is the
# ACCEPTED, PREFERRED failure; a false POSITIVE (arming on a word that was not a
# tool demand) is the one to avoid. When a phrasing is ambiguous, this hook does
# NOT arm. It cannot read intent, and it does not try to.
#
# WHAT IT ARMS ON (each anchored so an incidental word does not trip it):
#   1. AGENT/TEAMMATE SPAWN: the verb "spawn" within a short window of the noun
#      agent/teammate/subagent ("spawn an agent", "spawn a teammate"). ONLY the
#      verb "spawn" - "dispatch/launch/kick off a subagent" are accepted misses.
#   2. SLASH COMMAND: a leading /command, only at line start or right after an
#      imperative verb (run/use/do/execute/invoke/call). "/reflect", "run
#      /code-review". A stray "src/foo" or "/tmp/x" path does NOT match (the token
#      may not be followed by another "/").
#   3. USE A NAMED TOOL: "use the <X> tool" / "use mcp__...", but ONLY when <X>
#      resolves to a tool this pair can actually detect success for - a known
#      built-in (Read, Edit, Bash, ...) or an mcp__ tool. "use the browser tool"
#      does NOT arm (no such tool name to confirm), which is the correct miss.
#
# SIGN-OFF DISARMS (checked FIRST, so it always wins). If the SAME prompt, or any
# later prompt, approves doing it another way ("do it yourself", "solo is fine",
# "don't spawn", "no need for an agent"), the arm is removed. The user is allowed
# to release the demand, and when they do, the Stop gate stays silent.
#
# STATE. Per-session flag ~/.claude/.named-tool-swap-armed.<session> holding one
# capability descriptor per line (agent | tool:<base> | slash:<name>). A new
# demanding prompt OVERWRITES it (the latest demand is what stands); a non-demand,
# non-sign-off prompt leaves it untouched (a demand persists across turns until it
# is satisfied, released, or handled).
#
# POSTURE: FAIL-OPEN and SILENT. Any parse failure just does not arm and exits 0
# with no output. Arming is a best-effort side effect; it must never block or
# annoy the user's prompt. The lexicon lives INLINE (not a sibling .txt) because
# the grounding cluster deploys .sh files only.
#
# QUOTING: the payload travels by ENV VAR and the python is a QUOTED heredoc
# (<<'PY'), for the same reason cmux-team-config-heal.sh uses that shape - the
# python source contains apostrophes ("don't", "here's"), and a `python3 -c '...'`
# string would be silently terminated by them.

INPUT=$(cat 2>/dev/null || true)

HOOK_INPUT="$INPUT" python3 <<'PY' 2>/dev/null
import json, os, re, sys, time

try:
    d = json.loads(os.environ.get("HOOK_INPUT", ""))
except Exception:
    sys.exit(0)
if not isinstance(d, dict):
    sys.exit(0)

prompt = d.get("prompt", "") or ""
if not isinstance(prompt, str) or not prompt.strip():
    sys.exit(0)

session_id = str(d.get("session_id", "") or "")
key = re.sub(r"[^A-Za-z0-9._-]", "_", session_id) or "global"
home = os.path.expanduser("~")
claude_dir = os.path.join(home, ".claude")
armed = os.path.join(claude_dir, ".named-tool-swap-armed." + key)

# Reap stale flags (>24h) so an abandoned session cannot ambush a future one.
try:
    now = time.time()
    for nm in os.listdir(claude_dir):
        if nm.startswith(".named-tool-swap-armed.") or nm.startswith(".named-tool-swap-blocked."):
            p = os.path.join(claude_dir, nm)
            try:
                if now - os.path.getmtime(p) > 86400:
                    os.remove(p)
            except OSError:
                pass
except OSError:
    pass

# --- SIGN-OFF: checked first; it always wins and disarms -----------------------
# The user releasing the demand ("do it yourself", "don't spawn"). Kept broad on
# purpose: releasing is the SAFE direction (it can only ever make the Stop gate
# quieter, never louder), so an over-broad sign-off match is harmless.
SIGNOFF_RE = re.compile(r"""(
      \bdo\s+it\s+yourself\b
    | \byou\s+do\s+it\b
    | \b(?:just\s+)?do\s+it\s+(?:yourself|solo|directly|manually)\b
    | \bhandle\s+it\s+yourself\b
    | \bsolo\s+is\s+(?:fine|ok|okay|good)\b
    | \b(?:do\s+not|don['’]?t|dont|no\s+need\s+to)\s+spawn\b
    | \bwithout\s+(?:spawning|an?\s+agent|a\s+teammate|a\s+subagent)\b
    | \bno\s+need\s+(?:for|to\s+use)\s+an?\s+(?:agent|teammate|subagent)\b
    | \bno\s+(?:agent|teammate|subagent)s?\b
    | \b(?:do\s+not|don['’]?t|dont)\s+use\s+an?\s+(?:agent|teammate|subagent)\b
    | \bskip\s+the\s+(?:agent|teammate|subagent|spawn)\b
    | \byourself\s+is\s+fine\b
    | \bgo\s+ahead\s+without\b
    | \bdo\s+it\s+another\s+way\b
    | \banother\s+way\s+is\s+fine\b
    | \byour\s+call\b
    | \bup\s+to\s+you\b
    | \bwhatever\s+(?:works|is\s+easiest|you\s+think)\b
    | \bhowever\s+(?:is\s+)?easiest\b
)""", re.IGNORECASE | re.VERBOSE)

if SIGNOFF_RE.search(prompt):
    try:
        os.remove(armed)
    except OSError:
        pass
    sys.exit(0)

# --- DEMANDS -------------------------------------------------------------------
demands = []

def add(desc):
    if desc not in demands:
        demands.append(desc)

# A demand match is IGNORED when the text just before it is a negation ("do not
# run /reflect", "don't use the Read tool"). Without this, a NEGATED instruction -
# which the assistant obeys by NOT using the tool - would arm and then falsely
# block the honest completion. Only the ~24 chars before the match are inspected,
# so a negation later in the prompt does not suppress an earlier real demand.
NEG_BEFORE_RE = re.compile(
    r"(?:\b(?:do\s+not|dont|never|no\s+need\s+to|without|skip|avoid|instead\s+of)\b|n['’]t\b)\s*\S{0,12}\s*$",
    re.IGNORECASE)

def negated_before(text, start):
    return bool(NEG_BEFORE_RE.search(text[max(0, start - 24):start]))

# Filesystem roots a "/word" token usually names a PATH, not a slash command
# ("use /tmp for scratch"). Never armed as commands.
FS_ROOTS = {
    "tmp", "usr", "bin", "sbin", "etc", "var", "home", "opt", "dev", "mnt",
    "proc", "sys", "lib", "lib64", "root", "srv", "boot", "media", "run",
    "cores", "private", "volumes", "users", "applications", "library", "system",
}

# A "/word" followed by a LOCATIONAL preposition reads as a directory being used
# ("use /workspace FOR scratch", "/data AS input"), not a command with arguments -
# so it is not armed. This backstops FS_ROOTS for one-segment paths not on that
# list. Commands take scope words like "on"/"across", which are deliberately NOT
# here.
SLASH_TAIL_PATHY = re.compile(r"^\s*\b(?:for|as|into|under|onto)\b", re.IGNORECASE)

# 1. AGENT / TEAMMATE SPAWN. Only the verb "spawn"; a short (<=16 char) window to
#    the noun so "spawn a new worker process, the agent later" does not falsely
#    arm. The window charset excludes "." so a sentence boundary breaks the match.
SPAWN_RE = re.compile(
    r"\bspawn\b[\w\s,'’-]{0,16}\b(?:agents?|teammates?|subagents?)\b",
    re.IGNORECASE)
_spawn = SPAWN_RE.search(prompt)
if _spawn and not negated_before(prompt, _spawn.start()):
    add("agent")

# 2. SLASH COMMAND. Only at line start or right after an imperative verb, and the
#    token may NOT be followed by another "/" (so a path segment like /tmp/x or
#    src/foo is never read as a command).
SLASH_RE = re.compile(
    r"(?:^|\b(?:run|use|do|execute|invoke|call)\s+)/([a-z][a-z0-9_-]*)\b(?![\w/])",
    re.IGNORECASE | re.MULTILINE)
for m in SLASH_RE.finditer(prompt):
    name = m.group(1).lower()
    if name in FS_ROOTS or negated_before(prompt, m.start()):
        continue
    if SLASH_TAIL_PATHY.match(prompt[m.end():m.end() + 14]):
        continue
    add("slash:" + name)

# 3. USE A NAMED TOOL. Two anchored shapes:
#      "use (the) <X> tool"   - the literal word "tool" is the anchor
#      "use (the) mcp__..."   - an explicit MCP tool token
#    ONLY arms when the token resolves to something the Stop partner can actually
#    confirm ran: a known built-in tool, or an mcp__ tool. Anything else (e.g.
#    "use the browser tool") is NOT armed - we cannot detect its success, so
#    arming it would risk a false block. That is the deliberate tight boundary.
KNOWN_TOOLS = {
    "agent", "task", "bash", "read", "edit", "write", "multiedit", "grep",
    "glob", "ls", "webfetch", "websearch", "skill", "artifact", "notebookedit",
    "todowrite", "askuserquestion",
}

def note_tool(tok):
    tok = (tok or "").strip()
    if not tok:
        return
    base = tok.rsplit("__", 1)[-1].lower()
    is_mcp = "__" in tok
    if base == "agent":
        add("agent")
    elif base in KNOWN_TOOLS or is_mcp:
        add("tool:" + base)

USE_TOOL_RE = re.compile(
    r"\buse\s+(?:the\s+)?([A-Za-z_][A-Za-z0-9_]*(?:__[A-Za-z0-9_]+)*)\s+tool\b",
    re.IGNORECASE)
for m in USE_TOOL_RE.finditer(prompt):
    if negated_before(prompt, m.start()):
        continue
    note_tool(m.group(1))

USE_MCP_RE = re.compile(
    r"\buse\s+(?:the\s+)?(mcp__[A-Za-z0-9_]+(?:__[A-Za-z0-9_]+)*)",
    re.IGNORECASE)
for m in USE_MCP_RE.finditer(prompt):
    if negated_before(prompt, m.start()):
        continue
    note_tool(m.group(1))

if not demands:
    sys.exit(0)

# Overwrite: the latest demanding prompt is the demand that stands.
try:
    os.makedirs(claude_dir, exist_ok=True)
    with open(armed, "w", encoding="utf-8") as fh:
        fh.write("\n".join(demands) + "\n")
except OSError:
    pass
sys.exit(0)
PY

exit 0
