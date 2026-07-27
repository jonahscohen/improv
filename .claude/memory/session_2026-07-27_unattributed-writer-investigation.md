---
name: Unattributed writer in the working tree - forensic trace, what is proven, what is not
description: Two teammates independently reported a third writer editing install.sh and the registry files. Process, transcript and mtime forensics attribute every write-class tool call to a known agent, but leave a 7-minute window unexplained. Tree snapshotted; a live DATA-LOSS defect found in the uncommitted install.sh.
type: project
relates_to: [session_2026-07-27_teammate-collision-ruling.md, session_2026-07-27_ampersand-selfheal-fix.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: ps process table, all-project transcript scan, per-agent write-class tool-call extraction, file mtimes; snapshot taken and verified
confidence: medium
---

# Who is writing to this tree (2026-07-27)

`ampersand` reported itself a "second ampersand agent" and said its own deliverable
(test-ampersand-shim.sh) was already on disk, written by someone else. `coverage` had
independently reported the same third-writer pattern an hour earlier. Two isolated agents
reporting the same anomaly warranted a real trace rather than a ruling.

## Proven

- **No zombie agents.** The prior session `c3ca5a31` stopped writing at 06:22 local and its
  two teammates were in-process (they have no process of their own). The 05:03/05:04
  processes that looked like survivors are `--bg-spare` daemon slots, not sessions.
- **Exactly four teammates, all mine, all in real panes.** `cmux list-panels` shows six
  surfaces: this lead, a plain terminal, and four `opus-executor` panes.
- **Every write-class tool call is attributed.** Extracted per agent from the transcripts:
  panespawn 21 (agent-teams-guard.sh + its suite, its own file), coverage 7 (its beat,
  test-bin-parity.sh, test-settings-wire-parity.sh - all its own new files, it kept its
  hands off the contended set exactly as instructed), ampersand 11 (install.sh x8,
  test-ampersand-shim.sh, its beat, MEMORY.md), routecheck 14 (all scratch analysis
  scripts plus route-intent.json).
- **UTC/local offset confirmed, not assumed.** panespawn's first Edit at 10:29:18 UTC
  matches agent-teams-guard.sh's 06:29:18 local mtime exactly.

## Not proven - the residual anomaly

The contested files carry mtimes of 06:21 to 06:28 local. The earliest write-class call by
ANY of the four teammates is 06:29:18. ampersand's own Write of test-ampersand-shim.sh is
06:35:31, seven minutes after that file already existed at 06:28:15.

Two candidates survive and I could not separate them:
1. ampersand wrote them through a Bash heredoc. Its Bash calls in that window are dense
   sandbox scripts (`bash -s <<'OUTER'`), and the truncated command text does not show
   every redirect target. One heredoc at 10:28:14 UTC precedes the 06:28:15 file by one
   second, which is suggestive but not proof.
2. An older live session did. `f3e9bc73` (running since 05:03) and `6ac5465f` (since
   03:57) are both alive with this repo in scope and were not spawned by me.

**Why I stopped:** the grep heuristic for "a Bash command that writes file X" flags any
command merely containing X plus a redirect, including `> /dev/null` and paging, so it
produced mostly false positives across ten transcripts. Refining it further is a research
project, not a debugging step, and the practical question (is the tree safe, and who may
still be writing to it) does not depend on the answer.

## Actions taken

- **Snapshot** of the entire working tree before any reconciliation:
  `scratchpad/tree-snapshot-064720/` - `tracked.patch` (2649 lines) plus all 12 untracked
  files copied with permissions preserved. Nothing in the tree can be lost now.
- No process killed, no session stopped, no teammate stood down. Those are the user's
  calls, and two of the candidate sessions may be in active use.

## Live defect found in the uncommitted tree (independent of authorship)

install.sh:1847 still carries `sed -i.bak "/$m/,/^}$/d" "$ZSHRC"`. With no standalone `}`
after the marker line, sed deletes **through end of file** and the `.bak` is removed on the
following line, so the remainder of a user's `~/.zshrc` is destroyed silently. The existing
suite passes only because its fixture is well-formed. `ampersand` wrote an awk pre-check
patch into its beat rather than applying it, and flagged a constraint that deserves a
comment at the extraction site: the fix must stay INSIDE `deactivate_ampersand`, because
test-ampersand-shim.sh builds its harness by awk line-range extraction and a hoisted
helper falls outside the extract (this is exactly how that suite went 74/0 to 73/1).

This defect must not reach a commit in its current form.

## Lead self-analysis

I ruled on the collision before establishing authorship. The ruling ("ampersand keeps
install.sh in full") was reasonable given the evidence I had, but I derived ownership from
mtimes and from which agent's brief the work RESEMBLED, never from what each agent
actually called. The per-agent tool-call extraction took one command and would have been
decisive an hour earlier. Rule to carry forward: attribute writes from the transcripts, not
from mtimes plus plausibility, before issuing an ownership ruling.

## Files touched

- none in the repo (investigation and snapshot only)
