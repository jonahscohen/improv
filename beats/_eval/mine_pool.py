import json, glob, re, os, sys, random
DIRS = ["-Users-spare3-Documents-Github-improv",
        "-Users-spare3-Documents-Github-claude-dotfiles",
        "-Users-spare3-Documents-Github-improv-justify",
        "-Users-spare3-Documents-Github-improv-sidecoach"]
root = os.path.expanduser("~/.claude/projects")
files = []
for d in DIRS:
    files += glob.glob(os.path.join(root, d, "**", "*.jsonl"), recursive=True)

SKIP = re.compile(r"<system-reminder>|<command-name>|<command-message>|<local-command-stdout>"
                  r"|<teammate-message|<user-prompt-submit-hook>|Caveat: The messages below"
                  r"|<bash-input>|<bash-stdout>", re.I)
BRIEF = re.compile(r"^(You are |YOUR UNIT|Repo: /Users|BAR:|CRITICAL,)", re.I)

prompts = []
for f in files:
    for line in open(f, encoding="utf-8", errors="replace"):
        try: o = json.loads(line)
        except Exception: continue
        if o.get("type") != "user": continue
        m = o.get("message") or {}
        if m.get("role") != "user": continue
        c = m.get("content")
        if not isinstance(c, str) or not c.strip(): continue
        t = c.strip()
        if SKIP.search(t) or BRIEF.match(t) or t.startswith(("/", "!")): continue
        prompts.append(t)
uniq = list(dict.fromkeys(prompts))

# --- mechanical question filter (pre-registered, applied before any labelling) ---
# Reject imperative directives that merely OPEN with an interrogative auxiliary
# ("Do NOT touch...", "Decide: ...") and Claude's own report prose echoed into a
# user turn. Whether a survivor is a WELL-FORMED question is NOT decided here -
# that judgment is delegated to the independent labellers, so the sampler cannot
# quietly select for questions it expects to be unanswerable.
IMPERATIVE = re.compile(r"^(do not|don't|do the|do it|decide|describe|settle|have codex|have \w+ review"
                        r"|amend|when it is done|list |write |run |add |make |build |use )", re.I)
REPORT = re.compile(r"^(did not touch|should-fix|must-fix|nit|[A-Z])\)|SHOULD-FIX|MUST-FIX"
                    r"|^(the distinction is|whether it is wired)", re.I)
CODEY = re.compile(r"^[`\\(\[]|^\W*$|&lt;|&gt;")

def keep(s):
    if not (20 <= len(s) <= 200): return False
    if "?" not in s: return False
    if s.startswith(("-", "*", "#", "|", ">")): return False
    if IMPERATIVE.match(s) or REPORT.match(s) or CODEY.match(s): return False
    if s.count("`") >= 4: return False
    return True

sents = []
for p in uniq:
    for line in p.split("\n"):
        for s in re.split(r"(?<=[?.!])\s+", line.strip()):
            s = s.strip()
            if keep(s) and s.rstrip().endswith("?"): sents.append(s)
whole = [p for p in uniq if keep(p)]
pool = list(dict.fromkeys(sents + whole))
print(f"transcripts={len(files)} prompts={len(uniq)} question-pool={len(pool)}", file=sys.stderr)

published = [q['q'] for q in json.load(open('/tmp/beatseval/questions.json'))]
pubset = set(published)
hit = sum(1 for q in published if q in pool)
print(f"RECOVERY CONTROL: {hit}/32 published questions present in pool", file=sys.stderr)
json.dump(pool, open("/tmp/abst/pool.json","w"), indent=1)

cand = [p for p in pool if p not in pubset]
random.seed(20260728)
samp = random.sample(cand, min(48, len(cand)))
json.dump(samp, open("/tmp/abst/sample.json","w"), indent=1)
print(f"sampled {len(samp)} for independent labelling", file=sys.stderr)
for i, s in enumerate(samp, 1): print(f"s{i:02d}| {s[:120]}")
