"""sidecoach_lanes.py - shared lane intent classifier (Python side).

Pure regex/Python. No LLM calls (model-router-guard). Imported by
sidecoach-keyword.sh and by tests. The TypeScript mirror lives at
sidecoach/mcp-server/src/keyword-resolver.ts and MUST produce identical
decisions on every fixture in sidecoach/parity/classifier-corpus.json.
"""
import json
import re

SCHEMA_VERSION = 1


def load_registry(path):
    with open(path, "r", encoding="utf-8") as fh:
        reg = json.load(fh)
    if not isinstance(reg, dict):
        raise ValueError("lane registry must be a JSON object")
    if not isinstance(reg.get("lanes"), list) or not reg["lanes"]:
        raise ValueError("lane registry has no lanes")
    scope = reg.get("scope") or {}
    if "ui_evidence" not in scope or "negative_filters" not in scope:
        raise ValueError("scope must declare ui_evidence and negative_filters")
    scoring = reg.get("scoring") or {}
    for k in ("route_floor", "route_margin", "classify_floor"):
        if k not in scoring:
            raise ValueError(f"scoring missing {k}")
    return reg


ABBREVIATIONS = ["e.g.", "i.e.", "vs.", "etc.", "Dr.", "Mr.", "Ms."]
CONJUNCTION_BOUNDARIES = [", but", ", and", ", or", ", yet", ", so"]
_TERMINATORS = ".!?;\n"
# A comma-conjunction boundary requires the conjunction WORD followed by a
# non-word character (whitespace / EOL), NOT a bare prefix - so ", butter"
# (which starts with ", but") must NOT split, while ", and " does. Built from
# CONJUNCTION_BOUNDARIES so the word list stays the single source of truth.
_CONJUNCTION_RE = re.compile(
    "(?:" + "|".join(re.escape(cb) for cb in CONJUNCTION_BOUNDARIES) + r")(?![\w])",
    re.IGNORECASE,
)


def segment_clauses(text):
    """Split into clause spans without changing length. Returns [(start, end)]
    covering the whole string. Splits at sentence terminators and at a comma
    followed by a coordinating conjunction; abbreviation periods do not split.
    """
    masked = text
    for abbr in ABBREVIATIONS:
        masked = masked.replace(abbr, abbr.replace(".", "\x00"))
    cuts = []
    i, n = 0, len(masked)
    while i < n:
        ch = masked[i]
        if ch in _TERMINATORS:
            cuts.append(i + 1)
            i += 1
            continue
        if ch == ",":
            # Match the conjunction WORD anchored at this comma; the lookahead
            # in _CONJUNCTION_RE sees the real following char/EOL, so ", butter"
            # does not split but ", and " does.
            if _CONJUNCTION_RE.match(masked, i):
                cuts.append(i + 1)
                i += 1
                continue
        i += 1
    bounds = sorted({0, n, *[c for c in cuts if 0 < c < n]})
    return [(a, b) for a, b in zip(bounds, bounds[1:]) if b > a]


def _blank(match):
    return " " * (match.end() - match.start())


def sanitize(text):
    """Length-preserving strip of non-intent regions (code fences, inline
    backticks, URLs, XML bodies, transcript markers). Each region becomes
    same-length spaces so downstream offsets are preserved."""
    text = re.sub(r"```[\s\S]*?```", _blank, text)
    text = re.sub(r"`[^`\n]*`", _blank, text)
    text = re.sub(r"\b(?:https?|file|ftp)://\S+", _blank, text, flags=re.IGNORECASE)
    text = re.sub(r"<([a-zA-Z][\w:-]*)[^>]*>[\s\S]*?</\1\s*>", _blank, text)
    text = re.sub(r"<[a-zA-Z!/][^>]*>", _blank, text)
    text = re.sub(r"\[(?:MAGIC KEYWORD|TURN\s+(?:\d+|N))[^\]]*\]", _blank, text,
                  flags=re.IGNORECASE)
    return text


# Informational frames consume from the frame head to the clause end
# (terminators stop them, so a frame never crosses a sentence boundary).
_INFO_FRAMES = [
    r"\bwhat(?:['’]s| is| are| was| were| does| did)\s+[^.!?;\n]*",
    r"\bhow\s+(?:to|do\s+(?:i|you|we))\s+[^.!?;\n]*",
    r"\btell\s+me\s+about\s+[^.!?;\n]*",
    r"\bexplain\s+[^.!?;\n]*",
    r"\bdefine\s+[^.!?;\n]*",
]
_QUOTE_FRAME = r"[\"“][^\"”\n]{0,400}[\"”]"


def blank_informational(text):
    """Length-preserving blanking of informational framings and quoted spans,
    so lane evidence quoted/described (not invoked) does not score."""
    for pat in _INFO_FRAMES:
        text = re.sub(pat, _blank, text, flags=re.IGNORECASE)
    text = re.sub(_QUOTE_FRAME, _blank, text)
    return text


_NEGATORS = ["don't", "do not", "never", "not", "stop"]


def _wb(pattern):
    return re.compile(rf"(?<![\w-]){pattern}(?![\w-])", re.IGNORECASE)


def _compile_all(patterns):
    out = []
    for p in patterns:
        try:
            out.append(_wb(p))  # one bad regex is isolated (spec section 12)
        except re.error:
            continue
    return out


def _clause_bounds(pos, spans):
    for a, b in spans:
        if a <= pos < b:
            return a, b
    return spans[-1] if spans else (0, 0)


def _has_negator(prefix):
    return any(_wb(re.escape(neg)).search(prefix) for neg in _NEGATORS)


def evaluate_lane(lane, prompt, reg):
    """Score one lane and resolve its scope state by clause binding.
    Returns {lane, label, score, scope, evidenceIds}."""
    text = blank_informational(sanitize(prompt))
    spans = segment_clauses(text)
    ui = _compile_all(reg["scope"]["ui_evidence"])
    negs = _compile_all(reg["scope"]["negative_filters"])

    groups, ev_ids = {}, []
    n_in = n_unknown = n_oos = 0
    for entry in lane["lexicon"]:
        try:
            rx = _wb(entry["pattern"])
        except re.error:
            continue
        for m in rx.finditer(text):
            a, b = _clause_bounds(m.start(), spans)
            clause = text[a:b]
            prefix = text[a:m.start()]
            if _has_negator(prefix):
                continue  # negated -> discarded entirely
            if any(r.search(clause) for r in negs):
                n_oos += 1
                continue  # out-of-scope occurrence, discarded from score
            if any(r.search(clause) for r in ui):
                n_in += 1
            else:
                n_unknown += 1
            g = entry.get("group", entry["pattern"])
            groups[g] = max(groups.get(g, 0), int(entry.get("weight", 1)))
            ev_ids.append(entry["pattern"])

    score = sum(groups.values())
    if n_in > 0:
        scope = "IN_SCOPE"
    elif n_unknown == 0 and n_oos > 0:
        scope, score = "OUT_OF_SCOPE", 0
    else:
        scope = "SCOPE_UNKNOWN"
    return {"lane": lane["lane"], "label": lane["label"],
            "score": score, "scope": scope, "evidenceIds": ev_ids[:3]}


def is_informational(text, pattern):
    """A verb/pattern appearing only inside an informational framing is not an
    invocation. Mirrors the verb-tier suppression in sidecoach-keyword.sh."""
    frames = [
        rf"\bwhat\s+(?:is|are|was|were|does|did)\s+(?:the\s+|a\s+|an\s+)?{pattern}(?![\w-])",
        rf"\bwhat['’]s\s+(?:the\s+|a\s+|an\s+)?{pattern}(?![\w-])",
        rf"\bhow\s+to\s+(?:use\s+)?(?:the\s+)?{pattern}(?![\w-])",
        rf"\bhow\s+do\s+(?:i|you|we)\s+(?:use\s+)?(?:the\s+)?{pattern}(?![\w-])",
        rf"\bexplain\s+(?:the\s+|how\s+|what\s+)?{pattern}(?![\w-])",
        rf"\bdefine\s+{pattern}(?![\w-])",
        rf"(?<![\w-]){pattern}\s+is\s+(?:a|an|the)\b",
    ]
    return any(re.search(f, text, re.IGNORECASE) for f in frames)


def detect_verb(text, verbs):
    for v in verbs:
        name = v.get("verb") if isinstance(v, dict) else v
        patt = (v.get("pattern") or name) if isinstance(v, dict) else v
        if not name or not patt:
            continue
        try:
            rx = _wb(patt)
        except re.error:
            continue
        if rx.search(text) and not is_informational(text, patt):
            return name
    return None


def classify_intent(prompt, reg, verbs, intent_eligible=False):
    """Top-level decision flow (spec section 5). Returns a dict with keys
    outcome, winningLane, verbMatch, laneScores, schemaVersion."""
    result = {"outcome": "SILENT", "winningLane": None, "verbMatch": None,
              "diagnosticLane": None, "laneScores": [], "schemaVersion": SCHEMA_VERSION}
    if not prompt or not prompt.strip():
        return result
    # 2. explicit /sidecoach command is owned by the slash router, not the hook
    if re.match(r"\s*/sidecoach\b", prompt, re.IGNORECASE):
        return result

    text = blank_informational(sanitize(prompt))
    scores = [evaluate_lane(l, prompt, reg) for l in reg["lanes"]]
    result["laneScores"] = scores
    ranked = sorted(scores, key=lambda r: r["score"], reverse=True)
    top = ranked[0]
    second = ranked[1]["score"] if len(ranked) > 1 else 0
    verb = detect_verb(text, verbs)
    result["verbMatch"] = verb

    rf, rm, cf = (reg["scoring"]["route_floor"], reg["scoring"]["route_margin"],
                  reg["scoring"]["classify_floor"])
    route_grade = (top["scope"] == "IN_SCOPE" and top["score"] >= rf
                   and (top["score"] - second) >= rm)

    # 5/8. explicit verb evaluated before inferred-lane scope outcomes.
    # A route-grade IN_SCOPE lane competing with the verb -> CLASSIFY (lane wins
    # the routing slot). Otherwise the verb is primary (VERB) and the strongest
    # lane signal (any scope, score>0) rides along as a NON-ROUTING diagnostic
    # so the hook can surface "lane X noted, do not auto-expand" without routing.
    if verb:
        if route_grade:
            result["outcome"] = "CLASSIFY"
            result["winningLane"] = top["lane"]
        else:
            result["outcome"] = "VERB"
            diag = next((r for r in ranked if r["score"] > 0), None)
            result["diagnosticLane"] = diag["lane"] if diag else None
        return result

    # 6/9. IN_SCOPE branch
    if top["scope"] == "IN_SCOPE" and top["score"] > 0:
        result["winningLane"] = top["lane"]
        result["outcome"] = "ROUTE" if route_grade else (
            "CLASSIFY" if top["score"] >= cf else "SILENT")
        if result["outcome"] != "SILENT":
            return result
    # 10. SCOPE_UNKNOWN + lane evidence -> CONTEXT-CHECK (no auto-route)
    unknown = next((r for r in ranked if r["scope"] == "SCOPE_UNKNOWN" and r["score"] > 0), None)
    if unknown:
        result["outcome"] = "CONTEXT_CHECK"
        result["winningLane"] = unknown["lane"]
        return result
    # 11. OUT_OF_SCOPE + lane evidence -> logged, no lane action
    oos = any(r["scope"] == "OUT_OF_SCOPE" for r in scores)
    # 12. advisory nudge eligibility (intent tier, evaluated by caller)
    if intent_eligible:
        result["outcome"] = "NUDGE_ELIGIBLE"
        return result
    result["outcome"] = "OUT_OF_SCOPE" if oos else "SILENT"
    return result
