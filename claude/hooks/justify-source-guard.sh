#!/bin/bash
# PreToolUse guard. Prevents the 2026-06-08 incident: editing or building the
# DEPLOYED Justify copy at ~/.claude/justify (a stale artifact) instead of the
# source of truth at ~/Documents/Github/improv/justify. Rebuilding from
# the stale copy silently clobbers the served bundle (it was 543KB; a stale-source
# rebuild produced 291KB, reverting the Manipulate-panel repair).
#
# Registered for matchers "Bash" and "Write|Edit|MultiEdit". Reads hook input
# JSON on stdin, emits a PreToolUse permissionDecision JSON on stdout.
#
# Blocks:
#   1. Write/Edit/MultiEdit whose file_path is under ~/.claude/justify/
#   2. Bash that builds/deploys against ~/.claude/justify (node build.js /
#      npm run build|deploy referencing that path, or `cd ~/.claude/justify` + a build)
# Allows: the sanctioned dotfiles workflow (edit improv/justify, build there,
# run deploy.sh) and a manual recovery `cp` into the install dist.

INPUT=$(cat)

printf '%s' "$INPUT" | python3 -c '
import json, sys, os, re

try:
    data = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

home = os.path.expanduser("~")
install = os.path.join(home, ".claude", "justify")  # the DEPLOYED copy (do not edit/build)

tool = data.get("tool_name", "")
inp  = data.get("tool_input", {})
reason = ""

POINTER = (" The source of truth is ~/Documents/Github/improv/justify/. "
           "Edit the TS source there, run `node build.js --core-only`, then "
           "`bash deploy.sh --core-only` to sync into ~/.claude/justify. "
           "Never edit or rebuild ~/.claude/justify directly - it is a deployed "
           "artifact and rebuilding it from its stale source clobbers the served bundle.")

if tool in ("Write", "Edit", "MultiEdit"):
    fp = inp.get("file_path", "") or ""
    ap = os.path.abspath(os.path.expanduser(fp))
    if ap == install or ap.startswith(install + os.sep):
        reason = "writing to the DEPLOYED Justify copy (" + fp + ")." + POINTER

elif tool == "Bash":
    cmd = inp.get("command", "") or ""
    # normalise ~ and $HOME so path matching is reliable
    norm = cmd.replace("$HOME", home).replace("${HOME}", home).replace("~/", home + "/")
    touches_install = ".claude/justify" in norm
    build_verb = re.search(r"\bbuild\.js\b|npm\s+run\s+build|npm\s+run\s+deploy", norm)
    cd_install_build = re.search(r"cd\s+\S*\.claude/justify", norm) and re.search(r"build\.js|npm\s+run\s+(build|deploy)", norm)
    if (touches_install and build_verb) or cd_install_build:
        reason = "building/deploying against the DEPLOYED Justify copy (~/.claude/justify)." + POINTER

if reason:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "BLOCKED: " + reason
        }
    }))
else:
    print("{}")
'
