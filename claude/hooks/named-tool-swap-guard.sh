#!/usr/bin/env bash
#
# named-tool-swap-guard.sh - Stop hook. Half two of the named-tool substitution
# guard (its UserPromptSubmit partner is named-tool-swap-arm.sh).
#
# The arm hook records that the user made a TIGHT, named demand ("spawn an agent",
# "run /reflect", "use the Read tool"). This gate is the teeth: when a demand is
# armed AND the turn claims the task is DONE BUT the demanded capability never
# successfully ran this session AND the user never released the demand, it BLOCKS
# once with the source-beat's wording:
#
#   "You were told to use <X>. It did not run and the user did not approve an
#    alternative. Fix <X> or ask before substituting - completing the task another
#    way is not compliance."
#
# THE HONEST LIMIT (this is the guard the source beat WARNED about). It cannot
# read intent; it is a speed-bump, not a semantic judge. Every design choice below
# leans toward PASS (a false negative) over a false positive, because a spurious
# block on legitimate work is the expensive failure here. Five conditions must ALL
# hold before it blocks; any doubt allows.
#
# WHY IT PASSES (each is a real carve-out, not an accident):
#   - not armed                        -> nothing was demanded, nothing to check.
#   - the capability SUCCEEDED         -> a matching tool_use with a non-error
#                                         result exists in the transcript. The
#                                         field failure had an Agent call that
#                                         ERRORED then a solo redo; a non-error
#                                         Agent call anywhere clears the demand.
#   - the user released the demand     -> a sign-off in the last prompt (the arm
#                                         hook usually clears it first; this is
#                                         belt-and-suspenders).
#   - the turn is NOT claiming done    -> asking the user how to proceed, or still
#                                         working, is the CORRECT response to a
#                                         tool that failed. We only fire on a
#                                         claim of completion.
#   - already blocked this session     -> fires at most ONCE per session.
#   - a subagent/teammate turn         -> this is a lead-facing gate.
#
# ACCEPTED FALSE NEGATIVES (documented, deliberate):
#   - Timing is NOT correlated to the specific demand: ANY successful spawn in the
#     session satisfies a later "spawn an agent" demand. A session that spawned
#     once will not be gated on a later solo-substitution. Combined with the
#     once-per-session block, the guard's whole footprint is at most one nudge per
#     session, only when NO successful spawn happened at all. That is exactly the
#     tight speed-bump the beat asked for.
#   - Paraphrase the arm lexicon does not catch ("kick off a subagent") never
#     arms, so it never reaches this gate.
#
# ANTI-LOOP / FAIL-OPEN:
#   - stop_hook_active            -> never block a stop that is a hook continuation.
#   - once-per-session flag       -> at most one block; atomic O_EXCL claim.
#   - any error / no transcript   -> print {} and exit 0 (fail open).
# The block signal is the stdout JSON, not the exit code, so every path exits 0.
#
# The lexicons live INLINE (not a sibling .txt): the grounding cluster deploys .sh
# files only. The payload travels by ENV VAR and the python is a QUOTED heredoc so
# the apostrophes in the lexicons ("don't", "here's") are safe (a `python3 -c` string
# would be terminated by them).

INPUT=$(cat 2>/dev/null || true)

HOOK_INPUT="$INPUT" python3 <<'PY' 2>/dev/null
import json, os, re, sys, time

def allow():
    print("{}")
    sys.exit(0)

try:
    d = json.loads(os.environ.get("HOOK_INPUT", ""))
except Exception:
    allow()
if not isinstance(d, dict):
    allow()

# Anti-loop layer 1: never block a stop that is itself a hook continuation.
if d.get("stop_hook_active"):
    allow()

session_id = str(d.get("session_id", "") or "")
# No session id -> we cannot scope the flag to THIS session, and blocking on a
# "global" flag another session armed would be a cross-session false positive.
# Fail open. (The arm hook may still write a global flag; it is simply never
# consumed, and is reaped in 24h.)
if not session_id.strip():
    allow()
key = re.sub(r"[^A-Za-z0-9._-]", "_", session_id) or "global"
home = os.path.expanduser("~")
claude_dir = os.path.join(home, ".claude")
armed_flag = os.path.join(claude_dir, ".named-tool-swap-armed." + key)
blocked_flag = os.path.join(claude_dir, ".named-tool-swap-blocked." + key)

# Reap stale flags (>24h).
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

# Not armed -> nothing was demanded this session.
try:
    with open(armed_flag, "r", encoding="utf-8") as fh:
        demands = [ln.strip() for ln in fh if ln.strip()]
except OSError:
    demands = []
if not demands:
    allow()

# Already blocked once this session -> never fire twice.
if os.path.exists(blocked_flag):
    allow()

transcript = d.get("transcript_path", "") or ""
if not transcript or not os.path.isfile(transcript):
    allow()

def clear_arm():
    try:
        os.remove(armed_flag)
    except OSError:
        pass

# --- parse the transcript ONCE -------------------------------------------------
# Collect: tool_use entries (id, base-name), tool_result error-state by id, the
# last assistant text block, the last genuine user prompt, and whether this is a
# subagent/teammate transcript. Sidechain (teammate) turns are ignored for the
# lead-facing text/decision, mirroring concise/elias.

def block_text(blocks):
    if not isinstance(blocks, list):
        return ""
    return "\n".join(
        b.get("text", "") for b in blocks
        if isinstance(b, dict) and b.get("type") == "text"
    )

def result_is_error(block):
    # Conservative: only a CLEAR error signal counts as failure. A false "errored"
    # here could wedge legit work; a missed error just biases toward PASS, the safe
    # direction. Mirrors artifact-open-clear.sh resp_errored.
    if not isinstance(block, dict):
        return False
    if block.get("is_error") or block.get("isError"):
        return True
    content = block.get("content")
    if isinstance(content, str):
        low = content.lstrip().lower()
        if low.startswith("error") or low.startswith("<tool_use_error>"):
            return True
    elif isinstance(content, list):
        for c in content:
            if isinstance(c, dict) and c.get("type") == "text":
                low = (c.get("text") or "").lstrip().lower()
                if low.startswith("error") or low.startswith("<tool_use_error>"):
                    return True
    return False

tool_uses = []            # list of (id, base_name_lower, full_name, input_json_lower)
result_error = {}         # tool_use_id -> bool
last_assistant = ""
user_texts = []
is_subagent = False
lines_seen = 0

try:
    with open(transcript, errors="replace") as f:
        for line in f:
            lines_seen += 1
            try:
                e = json.loads(line)
            except Exception:
                continue
            if not isinstance(e, dict):
                continue
            if lines_seen <= 25 and (e.get("isSidechain") is True or e.get("teamName")):
                is_subagent = True
            if e.get("isSidechain"):
                continue
            msg = e.get("message", {})
            if not isinstance(msg, dict):
                continue
            content = msg.get("content", [])
            etype = e.get("type")
            if etype == "assistant":
                text = block_text(content)
                if text.strip():
                    last_assistant = text
                if isinstance(content, list):
                    for b in content:
                        if not isinstance(b, dict) or b.get("type") != "tool_use":
                            continue
                        name = b.get("name") or ""
                        base = name.rsplit("__", 1)[-1].lower()
                        try:
                            inp = json.dumps(b.get("input", {})).lower()
                        except Exception:
                            inp = ""
                        tool_uses.append((b.get("id"), base, name, inp))
            elif etype == "user":
                # tool_result blocks live in user messages; record their error state.
                if isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get("type") == "tool_result":
                            tid = b.get("tool_use_id")
                            if tid is not None:
                                result_error[tid] = result_is_error(b)
                # A genuine prompt is a string or has text blocks (never a pure
                # tool_result echo).
                text = content if isinstance(content, str) else block_text(content)
                if text.strip():
                    user_texts.append(text)
except Exception:
    allow()

# Lead-facing gate only.
if is_subagent:
    allow()

if not last_assistant.strip():
    allow()

# --- sign-off release (belt-and-suspenders; arm hook usually clears first) -----
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
    | \bgo\s+ahead\s+without\b
    | \bdo\s+it\s+another\s+way\b
    | \banother\s+way\s+is\s+fine\b
    | \byour\s+call\b
    | \bup\s+to\s+you\b
    | \bwhatever\s+(?:works|is\s+easiest|you\s+think)\b
    | \bhowever\s+(?:is\s+)?easiest\b
)""", re.IGNORECASE | re.VERBOSE)
if user_texts and SIGNOFF_RE.search("\n".join(user_texts[-2:])):
    clear_arm()
    allow()

# --- did the demanded capability succeed anywhere this session? ----------------
def succeeded(descriptor):
    if descriptor == "agent":
        matches = [t for t in tool_uses if t[1] == "agent"]
    elif descriptor.startswith("tool:"):
        base = descriptor[len("tool:"):]
        matches = [t for t in tool_uses if t[1] == base]
    elif descriptor.startswith("slash:"):
        nm = descriptor[len("slash:"):]
        # A slash command runs via the Skill tool. Loose match within Skill (the
        # command name appears anywhere in the serialized input) - loose = more
        # PASS = the safe direction.
        matches = [t for t in tool_uses if t[1] == "skill" and (nm in t[3])]
    else:
        matches = []
    for tid, _base, _full, _inp in matches:
        # A matching call with no error result (or no result recorded yet) counts
        # as success. Only an explicit error result fails to satisfy the demand.
        if result_error.get(tid) is not True:
            return True
    return False

if any(succeeded(desc) for desc in demands):
    clear_arm()
    allow()

# --- is the turn CLAIMING the task is done? ------------------------------------
# We only fire on a completion claim. Still-working or asking-the-user turns pass:
# stopping to ask how to proceed is the CORRECT response to a tool that failed.
#
# Completion detection is NEGATION-AWARE (Codex 2026-08-07, High): a raw search
# would read "I'm not done", "haven't finished", or "here's the error" as a
# completion claim and false-block. A claim token counts ONLY when the ~24 chars
# before it carry no negator. The lexicon is also kept to unambiguous claim words
# (no "here's" / "ready" / bare "I've X") because those fire on status prose.
low = last_assistant.lower()

NEG_WORD_RE = re.compile(
    r"(?:\b(?:not|no|never|without|cannot|unable)\b|n['’]t\b|\byet\s+to\b)",
    re.IGNORECASE)

def has_unnegated(text, token_re):
    for m in token_re.finditer(text):
        if NEG_WORD_RE.search(text[max(0, m.start() - 24):m.start()]):
            continue
        return True
    return False

# Explicit "still in progress / blocked" markers: force PASS regardless of any
# claim word. These are unambiguous NOT-done signals. Kept DISJOINT from the
# field-failure shape ("<tool> is broken ... I did it solo. Done.") - none of
# these phrases appear there, so that shape still blocks (Codex 2026-08-07, Low).
ONGOING_RE = re.compile(r"""(
      \bstill\s+(?:working|investigating|debugging|looking|trying|need|figuring|failing)\b
    | \bin\s+progress\b | \bwork\s+in\s+progress\b
    | \bnot\s+(?:yet\s+)?(?:done|finished|complete[d]?)\b
    | \bhaven['’]?t\s+finished\b
    | \bbefore\s+i\s+can\s+(?:continue|proceed|finish)\b
    | \bcan(?:not|['’]?t)\s+(?:continue|proceed|finish)\b
    | \bblocked\s+on\b | \bblocker\b
    | \bneeds\s+to\s+be\s+fixed\b
)""", re.IGNORECASE | re.VERBOSE)

COMPLETION_RE = re.compile(r"""\b(
      done | completed | complete | finished | implemented | shipped
    | all\s+set | taken\s+care\s+of | good\s+to\s+go | wired\s+up
    | created | added | built | wrote | fixed | updated | removed
    | refactored | resolved | landed | merged
)\b""", re.IGNORECASE | re.VERBOSE)

STRONG_DONE_RE = re.compile(
    r"\b(done|completed|complete|finished|shipped|all\s+set|good\s+to\s+go)\b",
    re.IGNORECASE)

ASK_RE = re.compile(r"""(
      \bshould\s+i\b | \bshall\s+i\b | \bwant\s+me\s+to\b | \bwould\s+you\s+like\b
    | \bhow\s+(?:do|would|should)\s+you\b | \blet\s+me\s+know\b
    | \bdo\s+you\s+want\s+me\s+to\b | \bwhich\s+(?:would|option|approach|one)\b
    | \bhow\s+should\s+i\s+proceed\b
)""", re.IGNORECASE | re.VERBOSE)

if ONGOING_RE.search(low):
    allow()
asking = ("?" in last_assistant) and bool(ASK_RE.search(low))
if asking and not has_unnegated(low, STRONG_DONE_RE):
    # Genuinely handing the decision back to the user, not claiming done.
    allow()
if not has_unnegated(low, COMPLETION_RE):
    allow()

# --- BLOCK (all five conditions held) ------------------------------------------
def label(desc):
    if desc == "agent":
        return "the Agent tool (spawn an agent/teammate)"
    if desc.startswith("tool:"):
        return "the " + desc[len("tool:"):].capitalize() + " tool"
    if desc.startswith("slash:"):
        return "the /" + desc[len("slash:"):] + " command"
    return desc

# Name the unsatisfied demand(s).
unsatisfied = [desc for desc in demands if not succeeded(desc)]
if not unsatisfied:
    clear_arm()
    allow()
labels = ", ".join(label(x) for x in unsatisfied)

# Anti-loop layer: atomic once-per-session claim. If we lose the race, allow.
try:
    fd = os.open(blocked_flag, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o644)
    os.close(fd)
except FileExistsError:
    allow()
except OSError:
    allow()

# Handled: clear the arm so the next turn is not re-gated on the same demand.
clear_arm()

reason = (
    "You were told to use " + labels + ". It did not run and the user did not "
    "approve an alternative. Fix " + labels + " or ask before substituting - "
    "completing the task another way is not compliance. If the named tool errored, "
    "a tool that errors is a diagnosis target, not a verdict: trace what changed "
    "and retry it, or ask the user before doing the task a different way. If the "
    "user already released the demand, they can say so (\"do it yourself\", \"solo "
    "is fine\"). This gate fires once per session."
)
print(json.dumps({"decision": "block", "reason": reason}))
sys.exit(0)
PY

exit 0
