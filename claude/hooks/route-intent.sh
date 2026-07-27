#!/bin/bash
# UserPromptSubmit hook. Classifies the WORK SHAPE of a prompt and names one
# candidate agent from the roster at ~/.claude/agents/.
#
# Advisory only. It never dispatches, never blocks a prompt, and the session
# model is free to ignore it. A wrong nudge costs one line of context.
#
# Cost: pure bash + stdlib Python. No model call, no tokens.
#
# The session model reads every prompt at full context before it can dispatch,
# so routing cannot lower that floor - only the continuation (reasoning trace,
# tool loop, answer generation). Short prompts are therefore never routed:
# dispatching them costs more than answering them.
#
# Every failure path exits 0 with no output.

HOOK_DIR="$(cd "$(dirname "$0")" && pwd)"
LEXICON="${ROUTE_INTENT_LEXICON:-$HOOK_DIR/route-intent.json}"

[ -f "$LEXICON" ] || exit 0

INPUT="$(cat)"

LEXICON_PATH="$LEXICON" PROMPT_RAW="$INPUT" python3 <<'PYEOF'
import json
import os
import re
import sys

try:
    raw = os.environ.get("PROMPT_RAW", "")
    payload = json.loads(raw) if raw else {}
    if not isinstance(payload, dict):
        sys.exit(0)

    # UserPromptSubmit puts the message at .prompt; some bridges nest it under
    # .tool_input. Handle both, mirroring sidecoach-keyword.sh.
    prompt = ""
    if isinstance(payload.get("prompt"), str):
        prompt = payload["prompt"]
    elif isinstance(payload.get("tool_input"), dict):
        for key in ("user_message", "prompt", "text", "message"):
            v = payload["tool_input"].get(key)
            if isinstance(v, str):
                prompt = v
                break
    if not prompt.strip():
        sys.exit(0)

    with open(os.environ["LEXICON_PATH"], "r", encoding="utf-8") as fh:
        lex = json.load(fh)

    tiers = lex.get("tiers", {})
    order = lex.get("escalation_order", [])
    template = lex.get("nudge", "")
    if not tiers or not order or not template:
        sys.exit(0)

    text = prompt.lower()

    # Match in escalation order and take the first hit, so a prompt matching
    # several tiers resolves to the most capable one.
    for key in order:
        tier = tiers.get(key)
        if not isinstance(tier, dict):
            continue
        for pat in tier.get("patterns", []):
            try:
                if re.search(pat, text, re.I):
                    nudge = (template
                             .replace("{label}", tier.get("label", key))
                             .replace("{agent}", tier.get("agent", key))
                             .replace("{model}", tier.get("model", "")))
                    print(json.dumps({"hookSpecificOutput": {
                        "hookEventName": "UserPromptSubmit",
                        "additionalContext": nudge,
                    }}))
                    sys.exit(0)
            except re.error:
                # A bad pattern in the lexicon must not break the prompt path.
                continue
except Exception:
    sys.exit(0)
PYEOF

exit 0
