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
import unicodedata


def _strip_lead_invisible(s):
    """Drop leading whitespace and Unicode FORMAT characters.

    A hardcoded list was the first cut and Codex found the hole: it covered BOM and
    the common zero-widths but not U+200E LRM (or any other Cf character), so one
    invisible byte still defeated every ^\\s* anchor and let an envelope through.
    Category Cf is the whole class; Zs catches exotic spaces.
    """
    i = 0
    while i < len(s) and (s[i].isspace() or unicodedata.category(s[i]) in ("Cf", "Zs")):
        i += 1
    return s[i:]


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

    # AGENT/SYSTEM ENVELOPES, checked FIRST and against the RAW prompt.
    #
    # A teammate brief, a task notification, a system reminder and an injected
    # skill body all arrive on UserPromptSubmit looking exactly like a prompt, and
    # they carry imperative prose that matches these tiers. Nudging them to
    # delegate is noise squared: the recipient already IS the delegate. Measured
    # 2026-07-28 with _tests/measure-hook-corpus.py over 4021 real prompts - 22
    # routed, and 11 of the 22 were envelopes.
    #
    # RAW, not scrubbed, for the same reason grounding-gate.sh does it: the XML
    # scrub below deletes tag bodies, so the <task-notification> marker would be
    # gone before it could be matched. Leading BOM/zero-width characters are
    # stripped because they are not \s and would defeat every ^\s* anchor.
    #
    # The isinstance guard is load-bearing exactly as it is on `exempt` below: a
    # STRING here would iterate characters, and "^" matches every prompt.
    env_exempt = lex.get("envelope_exempt", [])
    if isinstance(env_exempt, list):
        probe = _strip_lead_invisible(prompt)
        for pat in env_exempt:
            if not isinstance(pat, str) or not pat:
                continue
            try:
                if re.search(pat, probe, re.I):
                    sys.exit(0)
            except re.error:
                continue

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
    #
    # The isinstance guard here and on tier["patterns"] below is load-bearing, not
    # defensive noise: a STRING where a list belongs iterates character by
    # character, and every single character is a valid regex. A malformed
    # opus_executor tier would therefore match on nearly every prompt and route the
    # whole session to the most expensive model.
    exempt = lex.get("exempt", [])
    for pat in (exempt if isinstance(exempt, list) else []):
        try:
            if re.search(pat, text, re.I):
                sys.exit(0)
        except re.error:
            continue

    # --- STRUCTURAL SUPPRESSION (2026-07-28) -------------------------------
    # The imperative shape anchors the verb to a clause boundary, but a
    # SEMICOLON is one of those boundaries and the conjunction branch accepts
    # any preceding whitespace, so deliberating prose reached a tier:
    #   "i wonder if we should; refactor the parser or leave it alone"
    #   "do not proceed; refactor the router is exactly what we must avoid"
    # Reproduced 2026-07-28: 12 of 12 deliberation/negation probes routed. This
    # is the same false-positive class that forced a revert earlier that day; it
    # had been relocated into the boundary alternation, not fixed.
    #
    # Two guards, because the signal sits on both sides of the verb:
    #   LOOKBEHIND - a negation/deliberation marker anywhere between the start of
    #     the SENTENCE and the match. A sentence splits on . ! ? and newline
    #     ONLY - never on ";", which is the whole point: the deliberation in
    #     "i wonder if we should" governs the clause after the semicolon.
    #   NOMINAL - the matched verb phrase is the SUBJECT of a copula ("refactor
    #     the router IS exactly what we must avoid"), which makes it a noun
    #     phrase rather than an instruction.
    #
    # WINDOW SCOPING, twice corrected. It runs from the start of the sentence to
    # the start of the match, with one special case:
    #   - If the PATTERN consumed a sentence boundary as its own prefix
    #     (". build me a design system"), the previous sentence is not this
    #     clause's context and the window is empty. Without that, "i wonder how
    #     long this takes. build me a design system" - a genuine request after
    #     unrelated musing - was silenced.
    #   - Measuring from m.END() was the first attempt at that and Codex broke it:
    #     a sentence-looking period INSIDE the matched text ("migrate api. client
    #     to") reset the start past m.start(), collapsing the window and losing
    #     the deliberation in "i wonder if we should; migrate api. client to v2".
    # Asking whether the match BEGINS with a boundary is the narrow question that
    # actually wanted answering.
    sup = lex.get("suppress", {})
    if not isinstance(sup, dict):
        sup = {}
    markers = sup.get("deliberation_markers", [])
    if not isinstance(markers, list):
        markers = []
    nominal = sup.get("nominal_subject", "")
    if not isinstance(nominal, str):
        nominal = ""

    _SENT = re.compile(r"[.!?]\s+|\n")

    def _sentence_start(pos):
        start = 0
        for sm in _SENT.finditer(text, 0, pos):
            start = sm.end()
        return start

    def suppressed(m):
        if _SENT.match(text, m.start()):
            window = ""
        else:
            window = text[_sentence_start(m.start()):m.start()]
        for mp in markers:
            if not isinstance(mp, str) or not mp:
                continue
            try:
                if re.search(mp, window, re.I):
                    return True
            except re.error:
                continue
        if nominal:
            try:
                if re.match(nominal, text[m.end():m.end() + 200], re.I):
                    return True
            except re.error:
                pass
        return False

    # Match in escalation order and take the first hit, so a prompt matching
    # several tiers resolves to the most capable one. Every occurrence is
    # considered, not just the first: a prompt that deliberates and THEN
    # instructs still routes on the instruction.
    for key in order:
        tier = tiers.get(key)
        if not isinstance(tier, dict):
            continue
        patterns = tier.get("patterns", [])
        if not isinstance(patterns, list):
            continue
        for pat in patterns:
            try:
                if any(not suppressed(m) for m in re.finditer(pat, text, re.I)):
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
