#!/bin/bash
# sidecoach-keyword.sh
#
# UserPromptSubmit hook that intercepts user prompts BEFORE Claude sees them,
# regex-matches sidecoach verbs against a sanitized prompt body, and on hit
# injects an `additionalContext` block routing to the matched flow. This
# bypasses the skill-auto-trigger layer (which 2026-05-20 found unreliable in
# real builds) and forces verb-intent detection at the hook layer.
#
# Architecture ported (not copied) from yeachan-heo/oh-my-claudecode
# src/hooks/keyword-detector/index.ts. Verb registry lives at
# sidecoach-verbs.json next to this script; T-0010 will reuse it for the
# marketing-site cheatsheet.
#
# Behavior:
#   - Reads the UserPromptSubmit hook payload from stdin.
#   - Pulls the prompt text from `.prompt` (root) or `.tool_input.user_message`
#     or `.tool_input.prompt`.
#   - Sanitizes the prompt: strips fenced code blocks, inline backticks, URLs,
#     XML tag bodies, and transcript markers like [MAGIC KEYWORD:] / [TURN N:].
#   - Suppresses informational framings such as "what is X", "how to use X",
#     "how do I X", "X is a", "tell me about X", "explain X", "define X".
#   - Word-boundary matches each verb with (?<![\w-])PATTERN(?![\w-]) so
#     "polished" / "audit-trail" / "extraction" do NOT fire.
#   - On exactly one match: emits hookSpecificOutput.additionalContext.
#   - On multiple matches: picks the first verb in JSON list order, logs a
#     warning to stderr.
#   - On zero matches: emits {} so Claude sees the prompt as normal.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
VERB_FILE="$HOOK_DIR/sidecoach-verbs.json"
LANE_FILE="$HOOK_DIR/sidecoach-lanes.json"
INTENT_FILE="$HOOK_DIR/sidecoach-intent.json"

if [[ ! -f "$VERB_FILE" && ! -f "$LANE_FILE" && ! -f "$INTENT_FILE" ]]; then
  # No registries, nothing to do. Stay out of the prompt path.
  exit 0
fi

INPUT="$(cat)"

VERB_FILE_PATH="$VERB_FILE" LANE_FILE_PATH="$LANE_FILE" INTENT_FILE_PATH="$INTENT_FILE" HOOK_DIR_PATH="$HOOK_DIR" PROMPT_RAW="$INPUT" python3 <<'PYEOF'
import json
import os
import re
import sys
import time

verb_file = os.environ.get("VERB_FILE_PATH", "")
mode_file = os.environ.get("MODE_FILE_PATH", "")
intent_file = os.environ.get("INTENT_FILE_PATH", "")
raw_input = os.environ.get("PROMPT_RAW", "")

try:
    payload = json.loads(raw_input) if raw_input else {}
except Exception:
    sys.exit(0)

# Extract the prompt text. UserPromptSubmit payloads typically place the user's
# message at .prompt, but some hook bridges nest it under .tool_input. Handle
# both shapes defensively.
prompt = ""
if isinstance(payload, dict):
    if isinstance(payload.get("prompt"), str):
        prompt = payload["prompt"]
    elif isinstance(payload.get("tool_input"), dict):
        ti = payload["tool_input"]
        for key in ("user_message", "prompt", "text", "message"):
            v = ti.get(key)
            if isinstance(v, str):
                prompt = v
                break

if not prompt.strip():
    sys.exit(0)

# Load verb registry. Tolerate a missing file - the hook can still match
# modes alone (and vice versa).
verbs = []
if verb_file:
    try:
        with open(verb_file, "r", encoding="utf-8") as fh:
            verb_registry = json.load(fh)
        v = verb_registry.get("verbs", [])
        if isinstance(v, list):
            verbs = v
    except Exception:
        verbs = []

# Import the shared lane classifier (pure regex/Python, no LLM - model-router-guard).
hook_dir = os.environ.get("HOOK_DIR_PATH", "")
if hook_dir and hook_dir not in sys.path:
    sys.path.insert(0, hook_dir)
lane_file = os.environ.get("LANE_FILE_PATH", "")
lane_registry = None
sidecoach_lanes = None
try:
    import sidecoach_lanes as sidecoach_lanes  # noqa: PLC0414
    if lane_file:
        lane_registry = sidecoach_lanes.load_registry(lane_file)
except Exception:
    # Structure-invalid registry disables the lane tier loudly but does not
    # break the verb/intent tiers (spec sections 12-13).
    lane_registry = None

# Load the intent registry (third tier). Fires a light, advisory self-question
# on NATURAL front-end/design requests that carry no explicit sidecoach verb.
intent = {}
if intent_file:
    try:
        with open(intent_file, "r", encoding="utf-8") as fh:
            loaded = json.load(fh)
        if isinstance(loaded, dict):
            intent = loaded
    except Exception:
        intent = {}

# Cooldown plumbing. Any sidecoach engagement (verb/mode route OR intent nudge)
# touches a state file; intent nudges are suppressed while that file is younger
# than the window, so an active build and its follow-up tweaks are not
# re-nagged. Explicit verb/mode routes are NEVER suppressed by the cooldown.
_cfg = intent.get("config", {}) if isinstance(intent.get("config"), dict) else {}
cooldown_file = os.environ.get("SIDECOACH_INTENT_COOLDOWN_FILE") or os.path.expanduser(
    _cfg.get("cooldown_state_file", "~/.claude/.sidecoach-intent-cooldown")
)
try:
    cooldown_seconds = int(
        os.environ.get("SIDECOACH_INTENT_COOLDOWN", _cfg.get("cooldown_seconds", 1800))
    )
except Exception:
    cooldown_seconds = 1800


def touch_cooldown():
    try:
        with open(cooldown_file, "w", encoding="utf-8") as fh:
            fh.write(str(int(time.time())))
    except Exception:
        pass


def in_cooldown():
    if cooldown_seconds <= 0:
        return False
    try:
        with open(cooldown_file, "r", encoding="utf-8") as fh:
            ts = int((fh.read() or "0").strip() or "0")
        return (time.time() - ts) < cooldown_seconds
    except Exception:
        return False


if not verbs and not lane_registry and not intent:
    sys.exit(0)


def sanitize(text: str) -> str:
    """Strip non-intent regions from the prompt body before matching.

    This is the critical step. Without it, a code example containing
    `function polish() {}` would fire the polish verb. The order matters:
    fenced code blocks come before inline backticks (they overlap), URLs
    before XML (URLs can contain `<` in query strings), then transcript
    markers last.
    """
    # 1. Fenced code blocks: ```...```
    text = re.sub(r"```[\s\S]*?```", " ", text)
    # 2. Inline backticks: `code`
    text = re.sub(r"`[^`\n]*`", " ", text)
    # 3. URLs: http://, https://, file://, ftp://
    text = re.sub(r"\b(?:https?|file|ftp)://\S+", " ", text, flags=re.IGNORECASE)
    # 4. XML tag bodies: <tag>...</tag>
    text = re.sub(
        r"<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?</\1\s*>",
        " ",
        text,
    )
    # 5. Stray XML tags (open/self-closing)
    text = re.sub(r"<[a-zA-Z!/][^>]*>", " ", text)
    # 6. Transcript markers: [MAGIC KEYWORD: foo], [TURN 5: bar], [TURN N: ...]
    text = re.sub(
        r"\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]",
        " ",
        text,
        flags=re.IGNORECASE,
    )
    return text


def is_informational(text: str, pattern: str) -> bool:
    """Return True if the verb appears only inside an informational framing.

    These framings describe a verb rather than invoke it - the user is asking
    what something is, not asking us to run it. Block firing in those cases.
    """
    frames = [
        # "what is X", "what is the X", "what is a X"
        rf"\bwhat\s+(?:is|are|was|were|does|did)\s+(?:the\s+|a\s+|an\s+)?{pattern}(?![\w-])",
        # "what's X"
        rf"\bwhat['’]s\s+(?:the\s+|a\s+|an\s+)?{pattern}(?![\w-])",
        # "how to X", "how to use X"
        rf"\bhow\s+to\s+(?:use\s+)?(?:the\s+)?{pattern}(?![\w-])",
        # "how do I X", "how do you X"
        rf"\bhow\s+do\s+(?:i|you|we)\s+(?:use\s+)?(?:the\s+)?{pattern}(?![\w-])",
        # "tell me about X"
        rf"\btell\s+me\s+about\s+(?:the\s+|a\s+|an\s+)?{pattern}(?![\w-])",
        # "explain X", "explain the X", "explain how X"
        rf"\bexplain\s+(?:the\s+|how\s+|what\s+)?{pattern}(?![\w-])",
        # "define X"
        rf"\bdefine\s+{pattern}(?![\w-])",
        # "X is a", "X is an", "X is the"
        rf"(?<![\w-]){pattern}\s+is\s+(?:a|an|the)\b",
        # "the X flow", "the X command" - looking up what a thing is rather than running it
        rf"\bwhat\s+(?:the\s+)?{pattern}\s+(?:does|means|is)\b",
    ]
    for frame in frames:
        if re.search(frame, text, re.IGNORECASE):
            return True
    return False


sanitized = sanitize(prompt)


def match_entries(entries, key_name):
    """Word-boundary + informational-suppression match against a registry.

    `entries` is the list from verbs.json or modes.json; `key_name` is
    either "verb" or "mode" - the attribute that names the entry.
    Returns a list of matched entry dicts in registry order.
    """
    out = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        name = entry.get(key_name)
        pattern = entry.get("pattern", name)
        if not name or not pattern:
            continue
        word_boundary = re.compile(
            rf"(?<![\w-]){pattern}(?![\w-])",
            re.IGNORECASE,
        )
        if not word_boundary.search(sanitized):
            continue
        if is_informational(sanitized, pattern):
            continue
        out.append(entry)
    return out


# --- Lane classifier tier (replaces the mode tier) -------------------------
# Compute advisory nudge eligibility exactly as the legacy intent tier did, so
# we can hand it to classify_intent. (The classifier never reads cooldown.)
def _intent_eligible():
    if not intent:
        return False
    actions = intent.get("actions", []) or []
    targets = intent.get("substantive_targets", []) or []
    standalone = intent.get("standalone", []) or []
    exempt = intent.get("exempt", []) or []
    new_build = intent.get("new_build", []) or []

    def mlist(pats):
        out = []
        for p in pats:
            if not isinstance(p, str) or not p:
                continue
            try:
                rx = re.compile(rf"(?<![\w-]){p}(?![\w-])", re.IGNORECASE)
            except re.error:
                continue
            if rx.search(sanitized):
                out.append(p)
        return out

    def subst(pats):
        return [p for p in mlist(pats) if not is_informational(sanitized, p)]

    has_action = len(mlist(actions)) > 0
    has_target = len(subst(targets)) > 0
    has_standalone = len(subst(standalone)) > 0
    has_exempt = len(mlist(exempt)) > 0
    has_new_build = len(mlist(new_build)) > 0
    fires = has_standalone or (has_action and has_target)
    if has_exempt and not has_new_build and not has_standalone:
        fires = False
    return fires

if lane_registry is not None and sidecoach_lanes is not None:
    eligible = _intent_eligible()
    decision = sidecoach_lanes.classify_intent(prompt, lane_registry, verbs, intent_eligible=eligible)
    outcome = decision["outcome"]
    label = ""
    win = decision.get("winningLane")
    if win:
        label = next((l["label"] for l in lane_registry["lanes"] if l["lane"] == win), win)
    ev = ", ".join(decision.get("laneScores") and
                   next((s["evidenceIds"] for s in decision["laneScores"] if s["lane"] == win), []) or [])

    context = None
    if outcome == "ROUTE":
        context = (
            f"User intent classified as the sidecoach lane <lane>{label}</lane>. "
            f"Announce in one sentence that you are taking the '{label}' approach, then begin its first step. "
            f"The classification is confident; do not ask which mode. Evidence: {ev}."
        )
        touch_cooldown()
    elif outcome == "CLASSIFY":
        verb = decision.get("verbMatch")
        verb_opt = f"(2) the single verb /sidecoach {verb}; " if verb else ""
        context = (
            "User intent is design work with competing signals. Offer in one short prompt: "
            f"(1) the sidecoach lane '{label}'; {verb_opt}"
            f"({'3' if verb else '2'}) just handle it directly. "
            "Do not silently expand a verb into a full lane."
        )
        touch_cooldown()
    elif outcome == "CONTEXT_CHECK":
        context = (
            f"Lane evidence ({label}) appeared without domain evidence. If the conversation is clearly "
            "about UI/design work, classify per the sidecoach lane table and proceed; otherwise ignore "
            "this and answer normally."
        )
        touch_cooldown()
    elif outcome == "VERB":
        verb = decision.get("verbMatch")
        # The VERB outcome leaves winningLane None on purpose; the strongest lane
        # signal arrives as decision["diagnosticLane"] and must be resolved to a
        # label HERE (the shared `label`/`win` above is None for VERB).
        diag_lane = decision.get("diagnosticLane")
        diag_label = next((l["label"] for l in lane_registry["lanes"]
                           if l["lane"] == diag_lane), "") if diag_lane else ""
        diag = (f" (Lane signal '{diag_label}' noted as a non-routing diagnostic; "
                f"do not auto-expand it into a lane.)") if diag_label else ""
        context = (
            f"User intends to invoke the sidecoach <verb>{verb}</verb> flow. Route accordingly.{diag}"
        )
        touch_cooldown()
    elif outcome == "NUDGE_ELIGIBLE":
        if not in_cooldown():
            nudge = intent.get("nudge") or "This prompt reads as front-end / design work; consider a sidecoach lane."
            touch_cooldown()
            print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": nudge}}))
        sys.exit(0)
    elif outcome == "OUT_OF_SCOPE":
        print(f"sidecoach-keyword: lane evidence bound out-of-scope; no lane action", file=sys.stderr)
        sys.exit(0)
    # SILENT -> fall through to the legacy verb-only path below (no lane match)

    if context is not None:
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": context}}))
        sys.exit(0)

# If the lane tier is disabled (structure-invalid registry), fall back to the
# legacy verb tier so explicit verbs still route.
matched_verbs = match_entries(verbs, "verb")
if matched_verbs:
    if len(matched_verbs) > 1:
        names = [v.get("verb") for v in matched_verbs]
        print(f"sidecoach-keyword: multiple verbs matched {names}; using {names[0]}", file=sys.stderr)
    chosen_name = matched_verbs[0].get("verb", "")
    touch_cooldown()
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit",
        "additionalContext": f"User intends to invoke the sidecoach <verb>{chosen_name}</verb> flow. Route accordingly."}}))
    sys.exit(0)

# NOTE: the legacy intent tier was folded into the lane-classifier dispatch
# above (the NUDGE_ELIGIBLE branch + _intent_eligible()). Nothing follows here.
PYEOF

exit 0
