#!/bin/bash
# PostToolUse hook for Write|Edit|MultiEdit on a project's HTML/CSS.
#
# THE TASTE GATE. The moment a UI file is written in a sidecoach design project (a
# directory carrying a DESIGN.md), scan the FILE THAT WAS JUST WRITTEN through the
# productized detect engine (sidecoach/bin/sidecoach-detect.js) and inject any
# findings back as a must-fix directive.
#
# WHAT IT ACTUALLY RUNS (2026-08-22 rewrite - read before editing).
# The gate no longer hand-calls two static engines. It invokes ONE tool,
# `sidecoach-detect <edited-file>`, which dispatches every shipping lens at once:
#   - an .html edit  -> static-ban + static-check + rendered objective + rendered subjective.
#       The rendered lenses run against the file's own file:// URL, so the HELD-OUT-VALIDATED
#       detectors fire on write: marketing-buzzword (v4 gate, held-out precision 1.000),
#       tiny-text, nested-cards, low-contrast, skipped-heading, broken-image, justified-text,
#       plus the 5 absolute bans over raw source.
#   - a STATIC-ONLY source edit (.css/.scss/.sass/.less/.vue/.svelte/.jsx/.tsx)
#       -> static-ban + static-check only, run with --no-render. These have no renderable
#       file:// target, so the rendered lenses do not apply; the edit gets the 5 absolute bans
#       + the static polish/theming rules over its raw source (and any <style> / CSS-in-source
#       block). The scope is exactly what detect can statically scan (scanned=true): the CSS
#       family plus component templates. .astro/.styl are excluded (detect reports scanned=false
#       on them, so a fail-closed note would fire on every edit with no finding behind it).
#       This is the "broaden coverage WHERE A HOOK CAN RUN DETECT" boundary.
#
# This SUPERSEDES the previous gate, which ran only the 5 static bans plus an older structural
# taste-validator and could NEVER reach marketing-buzzword/tiny-text/nested-cards/low-contrast
# because those live in the rendered lane. Rendering the edited page at write-time is exactly
# what closes that gap. Cost: ~2-6s per .html write (a real headless render); acceptable for a
# gate that only fires on genuine UI edits under a DESIGN.md project.
#
# HARD PREREQUISITE for the rendered lane: the matching Playwright browser must be installed
# (node_modules Playwright pins a chromium_headless_shell revision). If it is missing the
# rendered lenses cannot run - the gate then surfaces whatever the STATIC lenses found AND a
# loud, actionable "rendered taste lane did NOT run" note naming the fix
# (`cd sidecoach && npx playwright install chromium-headless-shell`). It never silently claims a
# page is clean when the taste lane could not run - that fail-closed honesty is the whole point.
#
# ALERTS ON FINDINGS, NOT ON VERDICT. detect's verdict for a lone clean .html is `inconclusive`,
# not `clean`, because the static-check lens cannot fully certify a single file (forms /
# page-quality validators have no applicable rule to measure). Keying the alert off `verdict`
# would fire on every clean page. So the gate alerts strictly on the FINDINGS the lenses
# produced, and reserves the coverage-gap note for the RENDERED lenses being attempted-but-
# unavailable on an .html edit - the only "did not run" that means a taste defect could be hiding.
#
# Origin (2026-06-15): repeatedly shipped AI-slop tells (side-tab accent borders, hero-metric
# template, low-contrast accent text) because I declared UI "done" WITHOUT running the
# evaluators. Discipline alone failed; this makes the sweep mechanical - it fires on every UI
# edit, no cherry-picking, no skipping.
#
# Scope guards: only fires for .html/.css under a dir that has a DESIGN.md (a real sidecoach
# project), and never on the sidecoach engine's own source or node_modules.
# Override: `touch ~/.claude/.suppress-taste-gate` silences it for 30 minutes.

INPUT=$(cat)
export HOOK_INPUT="$INPUT"

python3 <<'PYEOF'
import json, os, sys, subprocess, time, shlex

def emit(ctx):
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "PostToolUse",
                                             "additionalContext": ctx}}))
    sys.exit(0)

raw = os.environ.get("HOOK_INPUT", "")
try:
    data = json.loads(raw)
except Exception:
    print("{}"); sys.exit(0)

if data.get("tool_name") not in ("Write", "Edit", "MultiEdit"):
    print("{}"); sys.exit(0)

fp = (data.get("tool_input", {}) or {}).get("file_path", "") or ""
low = fp.lower()
is_html = low.endswith(".html") or low.endswith(".htm")
# STATIC-ONLY design sources. detect runs its static ban + static-check lenses on
# these (verified 2026-08-25: scanned=true, well-formed lenses map, real findings) but
# they have NO renderable file:// target, so the rendered taste lane never applies and
# no rendered coverage-gap note is owed for them. Scope = the CSS family
# (.css/.scss/.sass/.less) plus component templates (.vue/.svelte/.jsx/.tsx) whose
# <style> / CSS-in-source blocks the ban+static lenses scan. Deliberately EXCLUDES
# .astro and .styl, on which detect reports scanned=false (nothing to scan): broadening
# onto those would fail-closed on every edit with no real finding behind it. This is the
# "broaden coverage WHERE A HOOK CAN RUN DETECT" boundary - detect's own scannability,
# not a guess.
STATIC_EXTS = (".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".jsx", ".tsx")
is_static = low.endswith(STATIC_EXTS)
if not (is_html or is_static) or not os.path.isfile(fp):
    print("{}"); sys.exit(0)
# Never gate the engine's own source, deps, dist, or memory.
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

# Load this project's accepted exceptions: named absolute-ban findings the team has deliberately
# chosen to keep. The raw detector still reports them; this only tells the gate they are
# accepted design calls, not oversights. Match is by ban name + file basename (line numbers drift).
accepts = []
acc_path = os.path.join(project, ".sidecoach-accept.json")
if os.path.isfile(acc_path):
    try:
        with open(acc_path) as fh:
            accepts = (json.load(fh) or {}).get("accept", []) or []
    except Exception:
        accepts = []

def ban_name_of(rule):
    # Findings from the two static lenses name a ban as `ban.<x>` (static-ban) or
    # `anti-pattern.<x>` (static-check). Return <x> for those, else None.
    for pref in ("ban.", "anti-pattern."):
        if rule.startswith(pref):
            return rule[len(pref):]
    return None

def is_accepted(ban, location):
    base = os.path.basename((location or "").rsplit(":", 1)[0]) if location else ""
    for a in accepts:
        if a.get("ban") and a.get("ban") != ban:
            continue
        af = a.get("file")
        if af and base and os.path.basename(af) != base:
            continue
        return True
    return False

# Past this point we are IN SCOPE: a UI file, under a DESIGN.md project, not suppressed, not the
# engine's own source. So an infra failure here is "we should have checked and could not", NOT a
# clean page. FAIL CLOSED - say the page is unverified, never go silent (which reads as clean).
def not_run(reason, remedy=None):
    msg = ("TASTE GATE - could NOT run on " + os.path.basename(fp) + ": " + reason
           + ". This page was NOT evaluated for taste / anti-pattern defects; do not report this "
             "UI change done as verified.")
    if remedy:
        msg += "\n  Fix: " + remedy
    msg += "\n  To silence for 30 min: touch ~/.claude/.suppress-taste-gate"
    emit(msg)

# Locate the sidecoach engine (needs the detect CLI AND a compiled dist).
cands = [os.environ.get("SIDECOACH_DIR", ""),
         os.path.expanduser("~/Documents/Github/improv/sidecoach"),
         os.path.expanduser("~/.claude/sidecoach")]
sc = next((c for c in cands
           if c and os.path.isfile(os.path.join(c, "bin", "sidecoach-detect.js"))
           and os.path.isfile(os.path.join(c, "dist", "absolute-ban-detector.js"))), None)
if not sc:
    not_run("the sidecoach engine was not found or is not built",
            "install sidecoach and run `npm run build` in its directory (or set SIDECOACH_DIR)")

# Run detect on the FILE THAT WAS JUST WRITTEN. For an .html this renders its file:// URL and
# runs the rendered lenses; for a .css it runs the static lenses only. --quiet keeps the JSON on
# stdout as the only machine signal (detect always writes a result JSON to stdout for a scan).
detect = os.path.join(sc, "bin", "sidecoach-detect.js")
abspath = os.path.abspath(fp)
# HTML renders its file:// URL (the rendered taste lane). A STATIC-ONLY source has no
# renderable target, so pass --no-render: detect runs the static ban + static-check
# lenses only - fast (~0.05s) and with no browser dependency. (detect already skips
# render for non-html even without the flag; passing it makes the intent explicit and
# guarantees no accidental render.)
extra = [] if is_html else ["--no-render"]
detect_argv = [abspath] + extra + ["--quiet"]
rerun = "node " + shlex.quote(detect) + " " + shlex.quote(abspath) + "".join(" " + a for a in extra)
try:
    out = subprocess.run(["node", detect] + detect_argv,
                         capture_output=True, text=True, timeout=120)
except subprocess.TimeoutExpired:
    not_run("the detector timed out after 120s", "re-run manually: " + rerun)
except Exception as e:
    not_run("the detector failed to start (" + type(e).__name__ + ")", "re-run manually: " + rerun)

try:
    result = json.loads(out.stdout)
except Exception:
    # detect writes a JSON verdict for every path that STARTED a scan; no parseable JSON means it
    # died before scanning (e.g. dist not built -> exit 2 with an error on stderr). Surface that.
    err = (out.stderr or "").strip().splitlines()
    tail = err[-1][:160] if err else ("exit " + str(out.returncode) + ", no output")
    not_run("the detector did not return a readable result (" + tail + ")",
            "re-run manually: " + rerun)

raw_findings = result.get("findings", []) or []
lenses = result.get("lenses", {}) or {}

# A well-formed scan ALWAYS carries a populated lenses map - detect's recordSkippedLenses fills
# every one of static-ban/static-check/objective/subjective. An empty or missing map therefore
# means detect aborted MID-SCAN: its top-level catch emits {verdict:inconclusive, scanned:false,
# findings:[]} with NO lenses. Without this guard that parses cleanly, shows no findings and no
# rendered gap, and the hook would go silent - fail-open on a crash. Fail CLOSED instead.
if not isinstance(lenses, dict) or not lenses:
    reasons = result.get("unavailableReasons") or []
    reason = str(reasons[0])[:160] if reasons else "the detector aborted before completing"
    not_run("the detector did not complete (" + reason + ")", "re-run manually: " + rerun)

# Drop accepted-exception ban findings BEFORE grouping.
kept = []
for f in raw_findings:
    rule = f.get("rule", "") or ""
    ban = ban_name_of(rule)
    if ban and is_accepted(ban, f.get("location")):
        continue
    kept.append(f)

# Group by the defect's identity - the rule's final dotted segment - so the same defect seen by
# two lenses (e.g. subjective/marketing-buzzword + static-check/polish.marketing-buzzword) and
# a per-element rule repeated across many nodes (low-contrast x N) each collapse to ONE clear
# line. Keep the highest severity, the most concrete detail, and the set of lenses that saw it.
# Cross-lane synonyms: the rendered objective scanner names the contrast defect `low-contrast`
# while the registry-backed static-check rule is `a11y.color-contrast` (tail `color-contrast`).
# They are ONE defect, so alias them to a single group; without this a contrast failure prints as
# two lines. Every other rendered/static pair already shares a tail (tiny-text, marketing-buzzword,
# nested-cards, broken-image, skipped-heading, ...), so this is the only alias needed today.
RULE_ALIASES = {"color-contrast": "low-contrast"}

SEV_RANK = {"blocking": 2, "warning": 1}
groups = {}
order = []
for f in kept:
    rule = f.get("rule", "") or ""
    key = rule.split(".")[-1] if rule else "finding"
    key = RULE_ALIASES.get(key, key)
    if key not in groups:
        groups[key] = {"sev": "warning", "count": 0, "lenses": set(),
                       "detail": "", "detail_rendered": False, "loc": None}
        order.append(key)
    g = groups[key]
    g["count"] += 1
    lens = f.get("lens", "")
    if lens:
        g["lenses"].add(lens)
    sev = f.get("severity", "warning")
    if SEV_RANK.get(sev, 0) > SEV_RANK.get(g["sev"], 0):
        g["sev"] = sev
    # Prefer a rendered lens's measured detail (concrete numbers) over a static message.
    detail = (f.get("detail") or "").strip()
    rendered = lens in ("objective", "subjective")
    if detail and (not g["detail"] or (rendered and not g["detail_rendered"])):
        g["detail"] = detail
        g["detail_rendered"] = rendered
    if not g["loc"]:
        g["loc"] = f.get("selector") or f.get("location")

def fmt(key):
    g = groups[key]
    lenses_s = "+".join(sorted(g["lenses"])) if g["lenses"] else "?"
    count = f" x{g['count']}" if g["count"] > 1 else ""
    loc = f" @ {g['loc']}" if g["loc"] else ""
    dtxt = g["detail"]
    if len(dtxt) > 140:
        dtxt = dtxt[:140].rstrip() + "..."   # mark the cut so a mid-word trim never reads as the real end
    detail = f" - {dtxt}" if g["detail"] else ""
    return f"{key}{count} [{lenses_s}]{loc}{detail}"

blocking = [k for k in order if groups[k]["sev"] == "blocking"]
warning = [k for k in order if groups[k]["sev"] == "warning"]

# Rendered-lane coverage gap: only meaningful when the file was an .html (renderable) and a
# RENDERED lens was attempted but could not run. static-check being incomplete on a lone file is
# normal and is NOT a gap worth reporting.
gap_reason = None
if is_html:
    for name in ("objective", "subjective"):
        l = lenses.get(name) or {}
        if l.get("attempted") and not l.get("available"):
            gap_reason = (l.get("reason") or "no reason reported")
            break

if not blocking and not warning and not gap_reason:
    print("{}"); sys.exit(0)

parts = []
total = len(blocking) + len(warning)
base = os.path.basename(fp)
if total == 0 and gap_reason:
    # Gap-only: there is nothing to "fix" yet, the page is simply UNVERIFIED. Say that plainly
    # rather than "flagged 0 issue(s)", which reads as a clean bill of health it is not.
    head = ("TASTE GATE - sidecoach could NOT fully check " + base + ": the rendered taste lane "
            "did not run, so this page is UNVERIFIED for marketing-buzzword / tiny-text / "
            "nested-cards / contrast. Do not report this UI change done until it is checked:")
else:
    head = ("TASTE GATE - sidecoach scanned " + base + " and flagged " + str(total) + " issue(s)"
            + (" (and the rendered taste lane did NOT fully run - see below)" if gap_reason else "")
            + ". These are real anti-pattern / taste failures; fix them before reporting this UI "
              "change done, do not ship them:")
parts.append(head)

def emit_section(label, keys):
    if not keys:
        return
    parts.append("  " + label + ":")
    for k in keys[:12]:
        parts.append("    - " + fmt(k))
    if len(keys) > 12:
        parts.append("    ...(+" + str(len(keys) - 12) + " more)")

emit_section("MUST FIX (blocking)", blocking)
emit_section("SHOULD FIX (warnings)", warning)

if gap_reason:
    short = gap_reason.splitlines()[0][:160]
    parts.append("  NOT CHECKED: the rendered taste lane (marketing-buzzword, tiny-text, "
                 "nested-cards, contrast, heading order) did NOT run - " + short)
    parts.append("    This page was NOT checked for those defects. Fix: cd "
                 + shlex.quote(sc) + " && npx playwright install chromium-headless-shell")

parts.append("  Re-run: " + rerun)
parts.append("  To silence for 30 min: touch ~/.claude/.suppress-taste-gate")

print(json.dumps({"hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "\n".join(parts),
}}))
PYEOF
