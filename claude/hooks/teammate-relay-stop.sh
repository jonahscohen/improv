#!/bin/bash
# Stop hook: BLOCK a TEAMMATE from going idle with an UNSENT report when its
# dispatch demanded a SendMessage relay.
#
# WHY: a recurring failure is a spawned teammate that finishes its unit and
# prints the report to its own terminal instead of relaying it to the lead via
# the SendMessage tool. The lead never sees it; the work is silently stranded.
# This is the teeth for the relay contract: if the dispatch prompt told the
# teammate to SendMessage its report and it is now stopping without ever having
# called SendMessage, block the stop and tell it to relay.
#
# Fires ONLY for teammates (this is the inverse of the other Stop guards, which
# EXEMPT subagents). Teammate detection mirrors verify-before-done-stop.sh /
# api-drift-stop.sh: an early transcript record with isSidechain==true or a
# truthy teamName.
#
# Decisions (all read from the transcript, so behavior is deterministic):
#   - demanded relay: a GENUINE user/dispatch message (not a tool_result echo)
#     contains the token "SendMessage". tool_result content is ignored so a tool
#     output that merely prints "SendMessage" cannot trip the gate (the
#     api-drift tool_response-echo lesson).
#   - sent: any assistant tool_use whose name is SendMessage (or *send_message).
#   - report exists: at least one non-empty assistant text block (nothing to
#     relay if the teammate has produced no output yet). Kept DELIBERATELY broad
#     (any assistant text, not "report-shaped" text): Codex flagged this as a
#     possible false positive on progress text, but the standing calibration
#     (feedback_hooks_prefer_false_positives.md) prefers a false positive over a
#     false negative here, and the block is self-correcting - its reason tells a
#     teammate with nothing to relay to simply keep working instead of stopping.
#
# Safety valves (never trap a session forever):
#   - stop_hook_active: if we already blocked once this cycle, allow the stop.
#   - no / unreadable transcript: allow (fail-open).
#   - not a teammate, no relay demand, already sent, or no report: allow.

INPUT=$(cat)
printf '%s' "$INPUT" | python3 -c '
import json, sys, re

try:
    d = json.load(sys.stdin)
except Exception:
    print("{}"); sys.exit(0)

# Already continued once because of a stop hook - do not block again (no loops).
if d.get("stop_hook_active"):
    print("{}"); sys.exit(0)

path = d.get("transcript_path", "") or ""
if not path:
    print("{}"); sys.exit(0)

SEND_RE = re.compile(r"sendmessage", re.IGNORECASE)

def text_of(content):
    """Human/text portion of a message.content, EXCLUDING tool_result blocks so a
    tool output that echoes the dispatch cannot be read as a dispatch demand."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for b in content:
            if not isinstance(b, dict):
                continue
            if b.get("type") == "tool_result":
                continue  # tool output, not a genuine dispatch instruction
            if b.get("type") == "text" and b.get("text"):
                parts.append(b["text"])
        return "\n".join(parts)
    return ""

is_teammate = False
demanded = False
dispatch_seen = False
sent = False
has_report = False

try:
    with open(path) as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except Exception:
                continue
            if not isinstance(r, dict):
                continue

            # Teammate signal (either marker, anywhere in the transcript).
            if r.get("isSidechain") is True or r.get("teamName"):
                is_teammate = True

            rtype = r.get("type")
            msg = r.get("message") or {}
            content = msg.get("content")

            if rtype == "user":
                # The demand must come from the DISPATCH - the first GENUINE human
                # message (tool_result echoes and empty turns are skipped by
                # text_of). Scoping to the dispatch avoids false-firing on a later
                # note, a correction, or a tool output that merely names the tool.
                if not dispatch_seen:
                    t = text_of(content)
                    if t.strip():
                        dispatch_seen = True
                        if SEND_RE.search(t):
                            demanded = True
            elif rtype == "assistant":
                if isinstance(content, list):
                    for b in content:
                        if not isinstance(b, dict):
                            continue
                        if b.get("type") == "tool_use":
                            name = (b.get("name") or "")
                            if name == "SendMessage" or name.lower().endswith("send_message"):
                                sent = True
                        elif b.get("type") == "text" and (b.get("text") or "").strip():
                            has_report = True
                elif isinstance(content, str) and content.strip():
                    has_report = True
except Exception:
    print("{}"); sys.exit(0)

if is_teammate and demanded and has_report and not sent:
    reason = (
        "BLOCKED: your dispatch asked you to relay your report to the lead via "
        "the SendMessage tool, but you are going idle without having called "
        "SendMessage - the lead cannot see a report printed only to your own "
        "terminal. Send your report now with SendMessage (addressed to the lead / "
        "team-lead), then stop. If you genuinely have no report to relay yet, "
        "continue the work instead of stopping."
    )
    print(json.dumps({"decision": "block", "reason": reason}))
    sys.exit(0)

print("{}")
'
