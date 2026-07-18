---
name: verify-before-done.sh hook error was a TRANSIENT torn read, not a broken hook
description: A PostToolUse hook error (verify-before-done.sh line 47 "syntax error near unexpected token (") surfaced mid-Edit. Root cause: a CONCURRENT session was writing the file non-atomically (a +22/-3 session-scoping edit in progress) exactly when my PostToolUse fired, so bash read a torn intermediate state where the python3 -c single-quoted block was momentarily unbalanced. The hook itself is valid - bash -n passes, it runs clean, HEAD passes. No fix applied to the hook (nothing is broken); the durable improvement belongs to whatever edits hook files: write atomically (temp + os.replace).
type: session
relates_to: [session_2026-07-18_fidelity-gate-level2-ledger-built.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: bash -n claude/hooks/verify-before-done.sh OK; ran with sample JSON -> exit 0, valid hookSpecificOutput; git show HEAD:...| bash -n OK; git status shows the file dirty (+22/-3, uncommitted); ps shows 6 live claude/justify processes
confidence: high
---

## What surfaced
PostToolUse hook `~/.claude/hooks/verify-before-done.sh` (symlink into
improv/claude/hooks/) errored during one of my Edits:
`line 47: syntax error near unexpected token '('` with the python line
`_sk = re.sub(...)` shown. That is bash trying to execute Python - the signature of
a `python3 -c '...'` single-quoted heredoc whose opening quote was momentarily
unmatched, so bash fell through into the Python body.

## Root cause (Debugging Protocol: what changed between working and broken)
The file is a single-quoted `python3 -c '` block (line 25) closed at line 632; its
own line-47 comment even warns "No literal apostrophes ... one would close it and
break the hook." At the instant my PostToolUse fired, ANOTHER live session was
mid-writing this file (git shows it dirty, +22/-3, a session-scoping change stamped
"Jonah 2026-07-18"; 6 claude/justify procs are running). A non-atomic write means a
reader can catch the file with the closing quote not yet written -> unbalanced ->
bash mis-parses. A moment later the write completed and the file is valid again.

## Why NO hook fix was applied
The hook is NOT broken: `bash -n` passes, it runs clean (exit 0, correct JSON), and
the committed HEAD passes too. "Fixing" a working hook would be wrong. This is a
concurrency artifact, not a persistent bug, so the Hook Error Protocol's "deploy an
agent to fix it" does not apply - there is nothing to fix. Left the dirty file
untouched (it is another session's in-progress work; reverting/committing it would
clobber them).

## Durable improvement (for whoever edits hook files)
Torn reads of a live hook are avoidable: write hook files atomically (write a temp
file, then os.replace/mv into place) so a PostToolUse reader never sees a half-written
script. Flagged to Jonah - the concurrent editor of verify-before-done.sh should adopt
the atomic-write pattern the arm hook already uses for the marker.

## Impact on my own work
Made sure my Level-2 commit stages ONLY my four files (figma-fidelity-arm.sh,
figma-fidelity-stop.sh, bash-guard.sh, test-figma-ledger.sh) and NOT the concurrently
edited verify-before-done.sh, so I don't clobber the other session's in-progress edit.
