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

# PROMPT_RAW is passed through the environment, and env counts against ARG_MAX
# (1 MB on macOS). A paste past that makes exec fail with "Argument list too
# long" on STDERR - rc stays 0, but the hook is contractually silent on both
# streams, so the guard has to live out here in bash, before python3 is reached.
# 100000 is 5x the in-python prompt cap below: nothing this large can route.
[ "${#INPUT}" -gt 100000 ] && exit 0

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

    # The scrub below is superlinear in input length, and this hook sits in the
    # prompt path under a 5s timeout. A prompt this long is never a routing
    # candidate anyway, so bail before doing any regex work on it.
    if len(prompt) > 20000:
        sys.exit(0)

    with open(os.environ["LEXICON_PATH"], "r", encoding="utf-8") as fh:
        lex = json.load(fh)

    tiers = lex.get("tiers", {})
    order = lex.get("escalation_order", [])
    template = lex.get("nudge", "")
    if not tiers or not order or not template:
        sys.exit(0)

    # Strip regions whose contents are quoted material, not instructions. A
    # pattern appearing inside a code fence, inline backticks, a URL, or an
    # XML body is being discussed, not requested.
    scrubbed = re.sub(r"```.*?```", " ", prompt, flags=re.S)
    scrubbed = re.sub(r"~~~.*?~~~", " ", scrubbed, flags=re.S)
    scrubbed = re.sub(r"`[^`]*`", " ", scrubbed)
    scrubbed = re.sub(r"https?://\S+", " ", scrubbed)
    # The backreference defeats the engine's prefix optimization, so an UNBOUNDED
    # .*? here makes every void tag (<br>, <img> - the common case in a pasted
    # HTML snippet) walk the lazy gap to end of string. That is quadratic: 40k
    # <br> measured 14.9s against a 5s timeout. Bounding the gap caps the work
    # per opening tag; a quoted XML body longer than 2000 chars simply is not
    # scrubbed, which costs at most one wrong advisory line.
    scrubbed = re.sub(r"<([a-zA-Z][\w-]*)\b[^>]*>.{0,2000}?</\1>", " ", scrubbed, flags=re.S)

    text = scrubbed.lower().strip()

    # Below this length the answer is cheaper than the dispatch. Routing here
    # would cost the lead a Task call plus a report read to save nothing.
    cfg = lex.get("config", {})
    try:
        min_chars = int(cfg.get("min_prompt_chars", 40))
    except Exception:
        min_chars = 40
    if len(text) < min_chars:
        sys.exit(0)

    import time

    cooldown_file = os.environ.get("ROUTE_INTENT_COOLDOWN_FILE") or os.path.expanduser(
        cfg.get("cooldown_state_file", "~/.claude/.route-intent-cooldown")
    )
    try:
        cooldown_seconds = int(
            os.environ.get("ROUTE_INTENT_COOLDOWN", cfg.get("cooldown_seconds", 900))
        )
    except Exception:
        cooldown_seconds = 900

    def in_cooldown():
        if cooldown_seconds <= 0:
            return False
        try:
            with open(cooldown_file, "r", encoding="utf-8") as fh:
                return (time.time() - float(fh.read().strip())) < cooldown_seconds
        except Exception:
            # No state file, or an unreadable one, means not in cooldown.
            return False

    def touch_cooldown():
        try:
            with open(cooldown_file, "w", encoding="utf-8") as fh:
                fh.write(str(time.time()))
        except Exception:
            pass

    if in_cooldown():
        sys.exit(0)

    # An informational or conversational framing is a question to answer, not
    # work to delegate.
    for pat in lex.get("exempt", []):
        try:
            if re.search(pat, text, re.I):
                sys.exit(0)
        except re.error:
            continue

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
                    touch_cooldown()
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
