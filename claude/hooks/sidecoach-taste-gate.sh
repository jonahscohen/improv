#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit on a project's HTML/CSS.
#
# The taste gate: the moment a UI file is written in a sidecoach design project
# (a directory carrying a DESIGN.md), run the STATIC half of sidecoach's evaluation
# against it - the 5 absolute-ban anti-pattern scan (side-stripe-borders,
# gradient-text, glassmorphism-default, hero-metric-template, modal-as-first-thought)
# plus the taste validator - and inject any findings back as a must-fix directive.
#
# COUNT CORRECTED 2026-07-29 (Jonah). This header said "6" and listed
# `identical card grids`, whose scanner was DELETED 2026-06-24 for a ReDoS-class
# regex. The authoritative list is BAN_SCANNERS in
# sidecoach/src/absolute-ban-detector.ts, which has five entries and throws on drift,
# so it cannot silently disagree with the shipped ban list. Do not re-hardcode a
# count here without reading that table.
#
# WHAT THIS GATE DOES NOT COVER - read before claiming it enforces something.
# It is a SUBSET of `/sidecoach audit`, not an equivalent: it runs only the two
# STATIC engines above. Every RENDERED rule is out of scope, because no write-time
# hook can render a page - that includes marketing-buzzword, tiny-text, nested-cards,
# default-typeface, low-contrast, skipped-heading, broken-image and justified-text.
# marketing-buzzword in particular is a real, calibrated sidecoach rule
# (polish.marketing-buzzword, held-out precision 1.000) that lives ONLY in the
# rendered subjective lane. It has never been one of the absolute bans and this hook
# has never checked it. A rule documented as enforced that no path can reach buys
# false confidence, which is worse than a missing rule.
#
# Origin (2026-06-15): repeatedly shipped AI-slop tells (side-tab accent borders,
# hero-metric template, low-contrast accent text) because I declared UI "done"
# WITHOUT running the evaluators, then ran one check at a time only after Jonah
# pointed at each failure. Discipline alone failed; this makes the full sweep
# mechanical - it fires on every UI edit, no cherry-picking, no skipping.
#
# Scope guards: only fires for .html/.css under a dir that has a DESIGN.md (a real
# sidecoach project), and never on the sidecoach engine's own source or node_modules.
# Override: `touch ~/.claude/.suppress-taste-gate` silences it for 30 minutes.

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 <<'PYEOF'
import json, os, sys, subprocess, time, glob

raw = os.environ.get("HOOK_INPUT", "")
try:
    data = json.loads(raw)
except Exception:
    print("{}"); sys.exit(0)

if data.get("tool_name") not in ("Write", "Edit", "MultiEdit"):
    print("{}"); sys.exit(0)

fp = (data.get("tool_input", {}) or {}).get("file_path", "") or ""
if not (fp.endswith(".html") or fp.endswith(".css")) or not os.path.isfile(fp):
    print("{}"); sys.exit(0)
# Never gate the engine's own source, deps, or memory.
if any(seg in fp for seg in ("/node_modules/", "/sidecoach/", "/dist/", "/.claude/")):
    print("{}"); sys.exit(0)

# 30-minute manual override.
ovr = os.path.expanduser("~/.claude/.suppress-taste-gate")
if os.path.isfile(ovr) and (time.time() - os.path.getmtime(ovr)) < 1800:
    print("{}"); sys.exit(0)

# Find the project root: nearest ancestor with a DESIGN.md.
d = os.path.dirname(os.path.abspath(fp))
project = None
for _ in range(8):
    if os.path.isfile(os.path.join(d, "DESIGN.md")):
        project = d; break
    parent = os.path.dirname(d)
    if parent == d: break
    d = parent
if not project:
    print("{}"); sys.exit(0)

# Load this project's accepted exceptions: named absolute-ban findings the team
# has deliberately chosen to keep. The raw detector still reports them; this only
# tells the BLOCKING gate they are accepted design calls, not oversights. Match is
# by ban name + file basename (line numbers drift, so they are ignored).
accepts = []
acc_path = os.path.join(project, ".sidecoach-accept.json")
if os.path.isfile(acc_path):
    try:
        with open(acc_path) as fh:
            accepts = (json.load(fh) or {}).get("accept", []) or []
    except Exception:
        accepts = []

def is_accepted(ban, fpath):
    base = os.path.basename(fpath or "")
    for a in accepts:
        if a.get("ban") and a.get("ban") != ban:
            continue
        af = a.get("file")
        if af and os.path.basename(af) != base:
            continue
        return True
    return False

# Locate the sidecoach engine (compiled dist).
cands = [os.environ.get("SIDECOACH_DIR", ""),
         os.path.expanduser("~/Documents/Github/improv/sidecoach"),
         os.path.expanduser("~/.claude/sidecoach")]
sc = next((c for c in cands if c and os.path.isfile(os.path.join(c, "dist", "absolute-ban-detector.js"))), None)
if not sc:
    print("{}"); sys.exit(0)

findings = []

# 1) Full absolute-ban sweep across the project. Emit the real banName (the
#    finding field is `banName`, not `ban`/`id`), then drop any finding the
#    project has registered as an accepted exception.
try:
    out = subprocess.run(
        ["node", "-e",
         "const{scanForAbsoluteBans}=require(process.argv[1]);"
         "const r=scanForAbsoluteBans(process.argv[2]);"
         "for(const f of r.findings){console.log((f.banName||f.ban||f.id||'ban')+'|'+(f.file||'')+':'+(f.line||'?')+'|'+(f.severity||''))}",
         os.path.join(sc, "dist", "absolute-ban-detector.js"), project],
        capture_output=True, text=True, timeout=20)
    for ln in out.stdout.splitlines():
        s = ln.strip()
        if not s:
            continue
        parts = s.split("|")
        ban = parts[0] if parts else ""
        loc = parts[1] if len(parts) > 1 else ""
        fpath = loc.rsplit(":", 1)[0] if loc else ""
        if is_accepted(ban, fpath):
            continue
        findings.append("anti-pattern " + s)
except Exception:
    pass

# 2) Taste validator on the edited HTML (+ project styles.css if present).
if fp.endswith(".html"):
    css = os.path.join(project, "styles.css")
    args = ["node", os.path.join(sc, "bin", "sidecoach-taste-check.js"), fp]
    if os.path.isfile(css): args.append(css)
    try:
        out = subprocess.run(args, capture_output=True, text=True, timeout=20)
        for ln in out.stdout.splitlines():
            s = ln.strip()
            if s.startswith("[") and "]" in s:   # "[error] taste/..." finding lines
                findings.append("taste " + s)
    except Exception:
        pass

if not findings:
    print("{}"); sys.exit(0)

msg = ("TASTE GATE - sidecoach flagged " + str(len(findings)) +
       " finding(s) in the UI you just edited (" + os.path.basename(fp) + "). "
       "These are real anti-pattern / taste failures; fix them before reporting this "
       "UI change done, do not ship them:\n  - " + "\n  - ".join(findings[:12]) +
       ("\n  ...(+" + str(len(findings) - 12) + " more)" if len(findings) > 12 else "") +
       "\nRe-run the full sweep until clean. To silence for 30 min: touch ~/.claude/.suppress-taste-gate")

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": msg,
}}))
PYEOF
