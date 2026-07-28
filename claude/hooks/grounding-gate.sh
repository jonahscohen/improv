#!/bin/bash
# grounding-gate.sh
#
# UserPromptSubmit hook. Detects a build-behavior DIAGNOSTIC question about the
# current project ("why isn't the panel showing", "where does X render",
# "what's happening with the watch loop") and, on a hit:
#   1. writes ~/.claude/.grounding-armed (epoch timestamp) - the flag that
#      grounding-guard.sh (PreToolUse) reads to deny browser/screenshot probes
#      until the agent has actually read code or beats this turn.
#   2. injects an additionalContext mandate to read code+beats first.
#
# Why this exists: 2026-06-05, the agent diagnosed a Justify UI question by
# screenshotting the running app instead of grepping justify/core/changes-panel.ts
# (which hardcodes the panel's position) and reading the panel beats. The CLAUDE.md
# "read code+beats first" rule had no teeth; this gives it teeth. Mirrors the
# inject-half of the sidecoach-keyword.sh pattern. Lexicon: grounding-intent.json.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
INTENT_FILE="$HOOK_DIR/grounding-intent.json"
[[ -f "$INTENT_FILE" ]] || exit 0

INPUT="$(cat)"

INTENT_FILE_PATH="$INTENT_FILE" PROMPT_RAW="$INPUT" python3 <<'PYEOF'
import json, os, re, sys, time

intent_file = os.environ.get("INTENT_FILE_PATH", "")
raw = os.environ.get("PROMPT_RAW", "")

try:
    payload = json.loads(raw) if raw else {}
except Exception:
    sys.exit(0)

prompt = ""
if isinstance(payload, dict):
    if isinstance(payload.get("prompt"), str):
        prompt = payload["prompt"]
    elif isinstance(payload.get("tool_input"), dict):
        for k in ("user_message", "prompt", "text", "message"):
            v = payload["tool_input"].get(k)
            if isinstance(v, str):
                prompt = v
                break
if not prompt.strip():
    sys.exit(0)

try:
    with open(intent_file, "r", encoding="utf-8") as fh:
        intent = json.load(fh)
except Exception:
    sys.exit(0)

# Agent/system envelopes are not the user asking for a diagnosis. A teammate
# relay, a task notification and a context-continuation summary all arrive on
# UserPromptSubmit exactly like a real prompt, and they carry diagnostic prose
# ("HALTED: second agent is doing...") that matches the lexicon. Measured
# 2026-07-28: the gate fired on 121 of 1231 envelopes (9.83%) versus 13 of 671
# genuine prompts (1.94%) - 5x more likely to speak where it must stay silent.
# Checked against the RAW prompt on purpose: sanitize() strips <...> tags, which
# would erase the <task-notification> marker before it could ever be matched.
# The isinstance(list) check is load-bearing, not defensive noise: a JSON typo
# turning "exempt" into a STRING would make this loop iterate CHARACTERS, and the
# first one ("^") matches every prompt - silently taking the gate to zero recall.
_exempt = intent.get("exempt", [])
if isinstance(_exempt, list):
    for _pat in _exempt:
        if not isinstance(_pat, str) or not _pat:
            continue
        try:
            if re.search(_pat, prompt, re.IGNORECASE):
                sys.exit(0)
        except re.error:
            continue

cfg = intent.get("config", {}) if isinstance(intent.get("config"), dict) else {}
arm_file = os.environ.get("GROUNDING_ARM_FILE") or os.path.expanduser(cfg.get("arm_state_file", "~/.claude/.grounding-armed"))
cooldown_file = os.environ.get("GROUNDING_COOLDOWN_FILE") or os.path.expanduser(cfg.get("cooldown_state_file", "~/.claude/.grounding-cooldown"))
try:
    cooldown_seconds = int(os.environ.get("GROUNDING_COOLDOWN", cfg.get("cooldown_seconds", 900)))
except Exception:
    cooldown_seconds = 900

# Respect the cooldown: after a disarm we do not re-nag for a while.
def in_cooldown():
    if cooldown_seconds <= 0:
        return False
    try:
        with open(cooldown_file) as fh:
            ts = int((fh.read() or "0").strip() or "0")
        return (time.time() - ts) < cooldown_seconds
    except Exception:
        return False

def sanitize(text):
    text = re.sub(r"```[\s\S]*?```", " ", text)
    text = re.sub(r"`[^`\n]*`", " ", text)
    text = re.sub(r"\b(?:https?|file|ftp)://\S+", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[a-zA-Z!/][^>]*>", " ", text)
    return text

INFO_FRAMES = [
    r"\bwhat\s+(?:is|are)\s+(?:the\s+|a\s+|an\s+)?",
    r"\bhow\s+to\s+(?:use\s+)?",
    r"\bexplain\b", r"\bdefine\b", r"\btell\s+me\s+about\b",
]

def any_match(patterns, text):
    for p in patterns:
        if not isinstance(p, str) or not p:
            continue
        try:
            if re.search(rf"(?<![\w-]){p}(?![\w-])", text, re.IGNORECASE):
                return True
        except re.error:
            continue
    return False

sanitized = sanitize(prompt)

# Pure informational framing ("what is X", "explain X") never arms.
informational = any(re.search(f, sanitized, re.IGNORECASE) for f in INFO_FRAMES)

has_diag = any_match(intent.get("diagnostic_frames", []), sanitized)
has_broken = any_match(intent.get("broken_state", []), sanitized)
has_verb = any_match(intent.get("behavior_verbs", []), sanitized)
has_noun = any_match(intent.get("build_nouns", []), sanitized)

fires = (has_diag or has_broken) and (has_verb or has_noun) and not informational

if not fires or in_cooldown():
    sys.exit(0)

# Arm: record the epoch so grounding-guard can tell "grounded since this prompt".
try:
    with open(arm_file, "w", encoding="utf-8") as fh:
        fh.write(str(int(time.time())))
except Exception:
    pass

nudge = intent.get("nudge") or (
    "Build-behavior question: read the code path + the named beats before probing the running app."
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "UserPromptSubmit",
        "additionalContext": nudge,
    }
}))
PYEOF

exit 0
