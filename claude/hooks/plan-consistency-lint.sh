#!/usr/bin/env bash
# plan-consistency-lint.sh - Stop-event linter for dispatch-plan markdown docs.
#
# WHAT IT DOES
#   A dispatch-plan doc splits work into `## Unit` sections; each unit declares
#   an `**Owns:**` file set and a `**Dispatch prompt:**` that agents are fed
#   verbatim. Two recurring INTRA-unit inconsistencies slip past a human read
#   (recorded 2026-07-14 in feedback_self_review_before_codex.md):
#     - U7/U12 class: a file the unit **Owns** is missing from (or extra to) its
#       dispatch-prompt ownership clause - the agent is told to own a different
#       set than the plan's collision map assigns it.
#     - U10 class: a unit is globally sequenced ("blocked by X") yet its prompt
#       also says "proceed immediately" - a self-contradiction.
#   This hook mechanizes those dumb-consistency catches so a cross-model review
#   is spent only on hard problems.
#
# WHEN IT RUNS (Stop event)
#   Reads the Stop JSON on stdin. Collects the file_path of every Write/Edit/
#   MultiEdit tool call this session (from transcript_path), keeps the ones that
#   are plan docs still on disk, and lints each. HIGH-confidence findings block
#   the stop (Claude must reconcile the doc); LOW-confidence findings warn only.
#
#   Detection of a "plan doc": a path under docs/plans/*.md, OR any .md whose
#   first ~50 lines contain the literal `For agentic workers`.
#
# OUTPUT CONTRACT (Stop mode)
#   stop_hook_active true      -> {}                              (loop guard)
#   any HIGH finding           -> {"decision":"block","reason":..}
#   only LOW findings          -> {"systemMessage":..}            (does NOT block)
#   nothing / no plan doc      -> {}
#   ANY internal error         -> {}   (FAIL-OPEN: never block on a bug)
#   The process always exits 0; the decision is carried in the JSON, not the code.
#
# DEBUG / TEST ENTRYPOINT
#   plan-consistency-lint.sh --lint-file <doc>
#     Lints a single file directly and prints `LEVEL: HIGH|LOW|CLEAN` followed by
#     one line per finding. Used by test-plan-consistency-lint.sh to assert the
#     detectors on individual fixtures. Honors plan-doc detection (a non-plan
#     .md prints LEVEL: CLEAN). Always exits 0.
#
# FAIL-OPEN is for INTERNAL errors only (a parse crash, a bad transcript line),
# never for a real lint finding. A genuine HIGH still blocks.
set -u

MODE="stop"
LINT_FILE=""
if [ "${1:-}" = "--lint-file" ]; then
  MODE="lint-file"
  LINT_FILE="${2:-}"
fi

# No python -> nothing to lint; fail open on the mode's neutral output.
if ! command -v python3 >/dev/null 2>&1; then
  if [ "$MODE" = "lint-file" ]; then printf 'LEVEL: CLEAN\n'; else printf '{}\n'; fi
  exit 0
fi

STDIN_JSON=""
if [ "$MODE" = "stop" ]; then
  STDIN_JSON="$(cat)"
fi

NEUTRAL='{}'
[ "$MODE" = "lint-file" ] && NEUTRAL='LEVEL: CLEAN'

# Capture python output so a SHELL-level failure (a here-doc temp-file error, a
# python launch failure - anything before python's own fail-open runs) still
# yields neutral output. A Stop hook must never end the turn on a wrapper crash.
# The whole group's stderr is sent to /dev/null so an internal error (e.g. a
# here-doc temp-file failure) fails open QUIETLY, never surfacing as hook noise.
OUT="$( { PLAN_LINT_MODE="$MODE" PLAN_LINT_FILE="$LINT_FILE" PLAN_LINT_STDIN="$STDIN_JSON" \
python3 <<'PYEOF'
import json, os, re, sys

# ------------------------------- helpers ------------------------------------

KNOWN_EXTS = ('.sh', '.py', '.ts', '.js', '.json', '.md', '.html', '.css', '.map', '.yml')
VERB_PREFIXES = ('cd ', 'npx ', 'git ', 'bash ', 'grep ')
MAX_BYTES = 400_000  # cap a pathological doc read

def read_text(path):
    with open(path, 'r', errors='replace') as fh:
        return fh.read(MAX_BYTES)

def is_plan_doc(path, text):
    p = (path or '').replace('\\', '/')
    # A docs/plans/*.md path, whether absolute or repo-relative (no leading slash).
    if re.search(r'(?:^|/)docs/plans/[^/]+\.md$', p):
        return True
    head = '\n'.join(text.splitlines()[:50])
    return 'For agentic workers' in head

def looks_like_file(tok):
    """A backtick token that looks like a file path, not a command fragment."""
    t = tok.strip()
    if not t:
        return False
    if ' ' in t or '&&' in t or '|' in t:      # command / fragment, not a file
        return False
    if any(t.lower().startswith(v) for v in VERB_PREFIXES):
        return False
    t = re.sub(r':\d+$', '', t)                # drop a :NN line locator BEFORE the shape test
    if '/' in t:
        return True
    low = t.lower().rstrip(').,;:/')
    return low.endswith(KNOWN_EXTS)

def normalize_base(raw):
    """Strip repo root, ./, leading /, a :NN locator (kept), trailing punctuation."""
    t = raw.strip().strip('"').strip("'").strip()
    t = re.sub(r'^/.*/improv/', '', t)         # drop an absolute repo-root prefix
    if t.startswith('./'):
        t = t[2:]
    t = t.lstrip('/')
    locator = None
    m = re.search(r':(\d+)$', t)               # trailing :NN line locator
    if m:
        locator = m.group(1)
        t = t[:m.start()]
    t = t.rstrip(',;:')
    t = t.rstrip('.')                          # a trailing sentence period
    return t, locator

def clean_variant(x):
    return x.strip().rstrip('/').rstrip('.,;:').strip()

def variants(tok):
    """Variant set for a normalized token, expanding `foo.js(.map)` shorthand
    into {foo.js, foo.js.map} so a prompt shorthand matches spelled-out Owns."""
    out = set()
    tok = tok.strip()
    if not tok:
        return out
    out.add(clean_variant(tok))
    m = re.search(r'\(([^)]*)\)', tok)
    if m:
        inner = m.group(1)
        with_c = tok[:m.start()] + inner + tok[m.end():]
        without = tok[:m.start()] + tok[m.end():]
        out.add(clean_variant(with_c))
        out.add(clean_variant(without))
    out.add(clean_variant(tok.replace('(', '').replace(')', '')))
    return {x for x in out if x}

def basename(p):
    return p.rsplit('/', 1)[-1]

def is_shorthand(a, b):
    """True if basenames a,b are the same stem with one an extra dotted suffix
    (e.g. foo.js vs foo.js.map). Narrow on purpose - avoids accidental matches."""
    if a == b or not a or not b:
        return False
    lo, hi = sorted((a, b), key=len)
    return hi.startswith(lo) and hi[len(lo):].startswith('.')

class Token:
    __slots__ = ('raw', 'norm', 'variants', 'basenames', 'locator', 'symbolic')
    def __init__(self, raw, symbolic=False):
        self.raw = raw
        self.norm, self.locator = normalize_base(raw)
        self.variants = variants(self.norm)
        self.basenames = {basename(v) for v in self.variants}
        self.symbolic = symbolic

    def label(self):
        return '`%s`%s' % (self.norm, (':%s' % self.locator) if self.locator else '')

CONTENT_REF = re.compile(r'references? to|mentions? of|occurrences? of|instances? of')

def tokenize(text):
    """File Tokens from backtick-quoted spans in text. A token is 'symbolic'
    (soft: never hard-flagged) when a `new` word precedes it (a to-be-created
    artifact) OR when it is the object of a content-reference phrase like
    'references to `X`' / 'mentions of `X`' - there X is CONTENT being edited,
    not an owned file, so it must not read as an ownership mismatch."""
    toks = []
    for m in re.finditer(r'`([^`]+)`', text):
        raw = m.group(1)
        if not looks_like_file(raw):
            continue
        wide = text[max(0, m.start() - 40):m.start()].lower()
        near = text[max(0, m.start() - 24):m.start()].lower()
        symbolic = bool(re.search(r'\bnew\b', wide)) or bool(CONTENT_REF.search(near))
        toks.append(Token(raw, symbolic=symbolic))
    return toks

def represented(owns_tok, clause_toks):
    """How well owns_tok is represented in the clause token list.
    Returns 'exact' | 'basename' | 'shorthand' | None (absent)."""
    ov = owns_tok.variants
    ob = owns_tok.basenames
    best = None
    for ct in clause_toks:
        if ov & ct.variants:
            return 'exact'
        if ob & ct.basenames:
            best = best or 'basename'
        else:
            for a in ob:
                for b in ct.basenames:
                    if is_shorthand(a, b):
                        best = best or 'shorthand'
    return best

# --------------------------- unit extraction --------------------------------

HEADING_RE   = re.compile(r'^#{1,6}\s')
UNIT_RE      = re.compile(r'^##\s+Unit\b', re.I)
FENCE_RE     = re.compile(r'^\s*```')
OWNS_RE      = re.compile(r'^\*\*Owns\b', re.I)
PROMPT_RE    = re.compile(r'\*\*Dispatch prompt\b', re.I)
OWNS_MARKER  = re.compile(r'^\s*\*\*Owns[^*]*\*\*\s*', re.I)

def is_read_only(owns_text, owns_toks):
    """A unit is read-only / owns-nothing (exempt from detector A) only when it
    genuinely disclaims file ownership - the value starts with 'nothing', says
    'owns nothing', or mentions 'read-only' AND lists no concrete owned files.
    A unit that owns real files but has a 'read-only' caveat in prose is NOT
    exempt (else its consistency would be silently skipped)."""
    val = OWNS_MARKER.sub('', owns_text).strip()
    if re.match(r'nothing\b', val, re.I):
        return True
    if re.search(r'owns?\s+nothing', val, re.I):
        return True
    if re.search(r'read[\s-]?only', val, re.I) and not owns_toks:
        return True
    return False
# Ownership-clause openers. The spec lists own only / own EXACTLY / own: / own ;
# the synonyms change|write|edit|modify + only/EXACTLY/: are folded in because the
# real plan doc uses "change only `X`" for its research units (U8/U9) - without them
# a real drift there degrades to a LOW no-clause warn instead of a HIGH. The bare
# verb form is kept own-only (least specific) so "change the wording" cannot match.
CLAUSE_START = re.compile(
    r'\b(?:own|change|write|edit|modify)\s+(?:only|EXACTLY)\b'
    r'|\b(?:own|change|write|edit|modify)\s*:'
    r'|\bown\s+(?=[`./\w])',
    re.I)
# Clause end markers are case-SENSITIVE: they are capitalized sentence starters
# in real prompts, so this avoids ending a clause on "do not"/"fix" mid-sentence.
# A bare sentence boundary is `.` + space + Capital so that an abbreviation like
# `e.g.` or `i.e.` (period-space-lowercase/backtick) does NOT truncate the clause.
CLAUSE_END   = re.compile(r'\(1\)|\bImplement\b|\bFix\b|\bCorrect\b|\bReplace\b|\bTDD\b|Do NOT|\bRelocate\b|\.\s+[A-Z]')
# A sentence boundary that ends an ownership LIST and starts explanatory prose.
SENTENCE_BREAK = re.compile(r'\.\s+[A-Z]')
# Capture the exclusion list after "Do NOT edit" up to a real sentence break /
# semicolon / newline / end - NOT the first dot (which lands inside `MEMORY.md`).
EXCL_RE      = re.compile(r'Do NOT edit\s+(.+?)(?:\.\s+[A-Z]|;|\n|$)', re.I | re.S)

def trim_to_list(text):
    """Keep only the leading ownership-LIST sentence; drop trailing explanatory
    prose. A unit's real owned files are the comma-separated list; a later
    `Note: ... the /dev/null fix ...` sentence names files it does NOT own, and
    those must not be tokenized as ownership. Mirrors the prompt-clause bounding."""
    m = SENTENCE_BREAK.search(text)
    return text[:m.start()] if m else text

BLOCK_RE = re.compile(r'blocked by|blocked until|blocked on|depends on|only after|runs last|must wait for|after .*?(?:integrated|accepted|merged)', re.I)
IMM_RE   = re.compile(r'proceed immediately|start now|run now|dispatch now|may run early|can run before', re.I)
QUAL_RE  = re.compile(r'except|but after|relative to|-independent|not gated on|P0a', re.I)
SUPPRESS_B = 'plan-lint: sequencing-ok'

def split_units(text):
    """List of (label, unit_text). A unit runs from its `## Unit` heading to the
    next PEER/PARENT heading (level <= 2). A deeper subheading (### Phases, etc.)
    is unit CONTENT, not a boundary. Fenced code blocks are not split into."""
    lines = text.splitlines()
    units = []
    cur_label = None
    cur = []
    in_fence = False
    def flush():
        if cur_label is not None:
            units.append((cur_label, '\n'.join(cur)))
    for ln in lines:
        if FENCE_RE.match(ln):
            in_fence = not in_fence
            if cur_label is not None:
                cur.append(ln)
            continue
        hm = HEADING_RE.match(ln) if not in_fence else None
        if hm:
            level = len(hm.group(0).strip())      # number of leading '#'
            if UNIT_RE.match(ln):
                flush()
                cur_label = ln.strip().lstrip('#').strip()
                cur = [ln]
                continue
            if level <= 2:
                # a peer (## ...) or parent (# WAVE) heading closes the unit
                flush()
                cur_label = None
                cur = []
                continue
            # level >= 3: a subheading inside the unit -> keep as content
        if cur_label is not None:
            cur.append(ln)
    flush()
    return units

def extract_owns(unit_text):
    """The Owns line plus continuation lines until a blank line."""
    lines = unit_text.splitlines()
    for i, ln in enumerate(lines):
        if OWNS_RE.match(ln.strip()) or OWNS_RE.match(ln):
            buf = [ln]
            for nxt in lines[i + 1:]:
                if nxt.strip() == '':
                    break
                if HEADING_RE.match(nxt) or PROMPT_RE.search(nxt):
                    break
                buf.append(nxt)
            return '\n'.join(buf)
    return None

def extract_prompt(unit_text):
    """The dispatch-prompt value: the quoted string after `**Dispatch prompt:**`.
    Spans multiple lines; ends at the closing quote or the next ##/** heading."""
    m = PROMPT_RE.search(unit_text)
    if not m:
        return None
    after = unit_text[m.end():]
    q = after.find('"')
    if q != -1:
        rest = after[q + 1:]
        end = rest.find('"')
        if end != -1:
            return rest[:end]
        # unterminated quote: take until the next heading/bold marker
        stop = re.search(r'\n#{1,6}\s|\n\*\*', rest)
        return rest[:stop.start()] if stop else rest
    # no quote at all: take the remainder of the field up to the next heading
    stop = re.search(r'\n#{1,6}\s|\n\*\*', after)
    return after[:stop.start()] if stop else after

def extract_clause(prompt_text):
    """The ownership clause span within the prompt (own only / own EXACTLY /
    own: / own ...), ending at the first terminator. None if no marker."""
    sm = CLAUSE_START.search(prompt_text)
    if not sm:
        return None
    rest = prompt_text[sm.end():]
    em = CLAUSE_END.search(rest)
    return rest[:em.start()] if em else rest

def extract_exclusions(prompt_text):
    excl = []
    for m in EXCL_RE.finditer(prompt_text):
        excl.extend(tokenize(m.group(1)))
    return excl

# ------------------------------- detectors ----------------------------------

def detector_a(label, unit_text):
    """Owns vs dispatch-prompt ownership-clause file-set consistency."""
    findings = []
    owns_text = extract_owns(unit_text)
    if owns_text is None:
        return findings
    owns_toks = tokenize(trim_to_list(owns_text))     # tokenize the LIST, not trailing prose
    if is_read_only(owns_text, owns_toks):
        return findings                        # owns-nothing / read-only exempt from A
    if not owns_toks:
        return findings                        # symbolic-only ownership; nothing concrete

    prompt_text = extract_prompt(unit_text)
    if prompt_text is None:
        return findings                        # no dispatch prompt -> nothing to cross-check

    clause_text = extract_clause(prompt_text)
    if clause_text is None:
        # A prompt exists but has no recognizable ownership clause. Ambiguous, not a
        # clean mismatch -> WARN (never a HIGH block).
        findings.append(('LOW', label,
            "%s: dispatch prompt has no recognizable ownership clause "
            "(own only / own EXACTLY / own:) to cross-check against Owns." % label))
        return findings

    clause_toks = tokenize(clause_text)
    if not clause_toks:
        # A clause exists but names no file tokens (e.g. "change only the wording").
        # Nothing to compare -> WARN, never a HIGH block for every Owns token.
        findings.append(('LOW', label,
            "%s: dispatch prompt ownership clause names no files to cross-check against Owns." % label))
        return findings

    exclusions = extract_exclusions(prompt_text)
    excl_variants = set()
    for e in exclusions:
        excl_variants |= e.variants

    # Owns token -> must be represented in the prompt clause.
    for ot in owns_toks:
        kind = represented(ot, clause_toks)
        if kind == 'exact':
            continue
        if kind in ('basename', 'shorthand'):
            findings.append(('LOW', label,
                "%s: Owns lists %s; the prompt clause names it only by %s - verify they mean the same file."
                % (label, ot.label(), 'basename' if kind == 'basename' else 'shorthand')))
        else:
            if ot.symbolic:
                findings.append(('LOW', label,
                    "%s: Owns names %s (a to-be-created artifact) that is absent from the prompt clause - verify."
                    % (label, ot.label())))
            else:
                findings.append(('HIGH', label,
                    "%s: Owns lists %s but the dispatch-prompt ownership clause omits it "
                    "(U7-class drift: the agent is told to own a different set than the plan assigns)."
                    % (label, ot.label())))

    # Prompt-clause token (non-exclusion) -> must be represented in Owns.
    for ct in clause_toks:
        if ct.variants & excl_variants:
            continue                           # a Do-NOT-edit exclusion, not prompt-owned
        kind = represented(ct, owns_toks)
        if kind == 'exact':
            continue
        if kind in ('basename', 'shorthand'):
            continue                           # already surfaced from the Owns side / minor
        if ct.symbolic:
            continue
        findings.append(('HIGH', label,
            "%s: the dispatch-prompt ownership clause names %s but Owns omits it "
            "(U12-class drift: the prompt claims a file the plan did not assign this unit)."
            % (label, ct.label())))
    return findings

def detector_b(label, unit_text):
    """Global sequencing ('blocked by X') that also claims local immediacy."""
    if SUPPRESS_B in unit_text:
        return []
    if not BLOCK_RE.search(unit_text):
        return []
    sentences = re.split(r'(?<=\.)\s|\n', unit_text)
    imm_sents = [s for s in sentences if IMM_RE.search(s)]
    if not imm_sents:
        return []
    unqualified = [s for s in imm_sents if not QUAL_RE.search(s)]
    blk = BLOCK_RE.search(unit_text).group(0).strip()
    if unqualified:
        imm = IMM_RE.search(unqualified[0]).group(0)
        return [('HIGH', label,
            "%s: globally sequenced (\"%s\") yet the prompt/body also claims immediacy "
            "(\"%s\") with no local qualifier (U10-class contradiction). If intentional, "
            "add a `<!-- plan-lint: sequencing-ok ... -->` line to the unit."
            % (label, blk, imm))]
    imm = IMM_RE.search(imm_sents[0]).group(0)
    return [('LOW', label,
        "%s: sequenced (\"%s\") and claims immediacy (\"%s\") but it is locally qualified - verify the scope."
        % (label, blk, imm))]

def lint_doc(path, text):
    findings = []
    for label, unit_text in split_units(text):
        findings.extend(detector_a(label, unit_text))
        findings.extend(detector_b(label, unit_text))
    level = 'CLEAN'
    if any(f[0] == 'HIGH' for f in findings):
        level = 'HIGH'
    elif findings:
        level = 'LOW'
    return level, findings

# ------------------------------- entrypoints --------------------------------

def emit_stop_open():
    sys.stdout.write('{}\n')

def run_lint_file(path):
    try:
        if not path or not os.path.isfile(path):
            print('LEVEL: CLEAN')
            return
        text = read_text(path)
        if not is_plan_doc(path, text):
            print('LEVEL: CLEAN')
            print('skipped: not a plan doc (no docs/plans path, no "For agentic workers" marker)')
            return
        level, findings = lint_doc(path, text)
        print('LEVEL: %s' % level)
        for sev, _label, msg in findings:
            print('%s %s' % (sev, msg))
    except Exception as exc:                   # fail-open
        print('LEVEL: CLEAN')
        print('error: %r' % exc)

def build_reason(highs, lows):
    lines = ["BLOCKED: a dispatch-plan doc has intra-unit inconsistencies that a self-review "
             "should catch before dispatch (plan-consistency-lint). Reconcile each unit's "
             "**Owns:** with its **Dispatch prompt:** ownership clause, and its sequencing:"]
    for path, f in highs:
        lines.append("  - [%s] %s" % (os.path.basename(path), f[2]))
    if lows:
        lines.append("Also (non-blocking, verify):")
        for path, f in lows:
            lines.append("  - [%s] %s" % (os.path.basename(path), f[2]))
    lines.append("Fix the doc(s) and end the turn again. If a finding is a false positive, "
                 "reconcile the wording or add a `<!-- plan-lint: sequencing-ok ... -->` line.")
    return '\n'.join(lines)

def build_warn(lows):
    lines = ["plan-consistency-lint (non-blocking): possible dispatch-plan inconsistencies to verify:"]
    for path, f in lows:
        lines.append("  - [%s] %s" % (os.path.basename(path), f[2]))
    return '\n'.join(lines)

def collect_plan_docs(transcript_path):
    paths = []
    seen = set()
    with open(transcript_path, 'r', errors='replace') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                e = json.loads(line)
            except Exception:
                continue
            if e.get('type') != 'assistant':
                continue
            msg = e.get('message') or {}
            content = msg.get('content')
            if not isinstance(content, list):
                continue
            for b in content:
                if not isinstance(b, dict) or b.get('type') != 'tool_use':
                    continue
                if b.get('name') not in ('Write', 'Edit', 'MultiEdit'):
                    continue
                inp = b.get('input') or {}
                fp = inp.get('file_path')
                if isinstance(fp, str) and fp and fp not in seen:
                    seen.add(fp)
                    paths.append(fp)
    docs = []
    for fp in paths:
        if not fp.endswith('.md') or not os.path.isfile(fp):
            continue
        try:
            text = read_text(fp)
        except Exception:
            continue
        if is_plan_doc(fp, text):
            docs.append((fp, text))
    return docs

def run_stop():
    try:
        data = json.loads(os.environ.get('PLAN_LINT_STDIN', '') or '{}')
    except Exception:
        emit_stop_open(); return
    if not isinstance(data, dict):
        emit_stop_open(); return
    if data.get('stop_hook_active'):
        emit_stop_open(); return                # loop guard
    tp = data.get('transcript_path')
    if not tp or not os.path.isfile(tp):
        emit_stop_open(); return
    try:
        docs = collect_plan_docs(tp)
    except Exception:
        emit_stop_open(); return                # fail-open on any transcript/IO error
    highs, lows = [], []
    for path, text in docs:
        try:
            _level, findings = lint_doc(path, text)
        except Exception:
            continue                            # one bad doc never blocks the turn
        for f in findings:
            (highs if f[0] == 'HIGH' else lows).append((path, f))
    if highs:
        sys.stdout.write(json.dumps({"decision": "block", "reason": build_reason(highs, lows)}) + '\n')
    elif lows:
        sys.stdout.write(json.dumps({"systemMessage": build_warn(lows)}) + '\n')
    else:
        emit_stop_open()

def main():
    mode = os.environ.get('PLAN_LINT_MODE', 'stop')
    if mode == 'lint-file':
        run_lint_file(os.environ.get('PLAN_LINT_FILE', ''))
    else:
        run_stop()

try:
    main()
except Exception:                              # ultimate fail-open safety net
    try:
        if os.environ.get('PLAN_LINT_MODE') == 'lint-file':
            sys.stdout.write('LEVEL: CLEAN\n')
        else:
            sys.stdout.write('{}\n')
    except Exception:
        pass
PYEOF
} 2>/dev/null )"

if [ -z "$OUT" ]; then
  printf '%s\n' "$NEUTRAL"
else
  printf '%s\n' "$OUT"
fi
exit 0
