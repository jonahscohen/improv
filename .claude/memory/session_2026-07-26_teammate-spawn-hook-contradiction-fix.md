---
name: Teammate spawn deadlock in agent-teams-guard fixed
description: agent-teams-guard.sh required a name on every Agent spawn while the runtime forbids named spawns from a teammate, so teammates could not delegate at all; teammate contexts are now exempt and the lead mandate is intact
type: project
relates_to: [session_2026-07-26_flow-redundancy-evaluation.md]
author_human: Jonah
author_model: claude-opus-4-8
session_id: a3c67e5e-d9fc-47aa-8a70-811b0253db4c
machine: spare3
source: session
verified: tests (27/27 new suite green, 8 sibling suites green), live hook invocation in a real teammate + against real lead argv, dual falsification against both broken versions, codex-review.py cross-model pass
confidence: high
---

# Teammate spawn deadlock in agent-teams-guard.sh

## The error (hit live 2026-07-26)

A teammate session in this repo could not spawn a subagent at all. Two rules
contradicted each other:

1. `claude/hooks/agent-teams-guard.sh` (PreToolUse, matcher `Agent|Workflow`)
   denied every Agent call that lacked a `name`: "BLOCKED: inside cmux with
   agent-teams enabled, every Agent call must spawn as a NAMED teammate."
2. The agent-teams runtime rejects a NAMED spawn that originates from a teammate:
   "Teammates cannot spawn other teammates - the team roster is flat."

Unnamed was denied by the hook, named was denied by the runtime. No spawn shape
worked, so a teammate could not fan out, could not deploy an independent
reviewer, and had to do everything inline.

## Root cause

The hook's only mode check was `CMUX_SOCKET_PATH` set AND
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. A teammate process inherits BOTH from
the lead (verified: identical values in the lead's and the teammate's env), so
the hook could not tell a teammate from the lead and applied the lead's
named-teammate mandate to a session that structurally cannot satisfy it. Every
gate in the hook exists to make a spawn land as a visible cmux pane, which is a
lead-only concern - a teammate has no pane of its own to spawn into.

## The fix

`is_teammate_context()` in `agent-teams-guard.sh`. A teammate context is exempt
from every gate (unnamed Agent, background Agent, Workflow) and the hook NEVER
denies there; it emits an advisory `additionalContext` instead. The lead's
enforcement is byte-for-byte unchanged.

**Why advise instead of deny the named shape too:** denying named spawns in a
teammate would be helpful guidance right up until detection misread a lead, at
which point it would re-create the identical deadlock from the other side. A path
that only ever advises cannot deadlock either role.

**How detection works** (either signal is enough; exempting is the fail-safe
direction because a missed teammate deadlocks delegation while a misread lead
only loses a spawn-shape nudge):

1. `transcript_path` records carrying `teamName` or `isSidechain: true` - the
   same signal `memory-nudge.sh` and `verify-before-done.sh` already use. Live:
   a teammate transcript carries `teamName` from record 3; the lead's carries
   neither.
2. An ancestor process argv carrying `--agent-id` / `--agent-name` /
   `--parent-session-id` - the flags the harness launches a teammate with. Read
   with `ps -ww` so a long wrapper path cannot truncate the flags away.

Seams: `AGENT_TEAMS_GUARD_FORCE_CONTEXT=teammate|lead` (break-glass + test hook)
and `AGENT_TEAMS_GUARD_PS` (stub ps for hermetic tests). Both are ambient env, so
the emitted notice names whichever signal fired - a stuck state is diagnosable
from the transcript instead of invisible.

## The near-miss, and the self-analysis that matters more than the fix

The first version of this fix keyed detection off `CLAUDE_CODE_CHILD_SESSION`.
An independent reviewer (unnamed subagent, spawned through the very hook being
fixed) caught it: **claude.exe sets that variable on EVERY process it spawns in
EVERY session** - it is hardcoded next to `CLAUDECODE` and `CLAUDE_PID` in its
child-env builder, with no teammate condition. Keying off it exempted the LEAD
too, silently voiding the mandate the hook exists for, and told every lead "you
are a teammate, spawn UNNAMED" - inverting the lead's instruction so no teammate
would ever render as a pane again. It was live for roughly 20 minutes.

**Why did this happen?** I verified the variable was PRESENT in a teammate (ran
`env` in a teammate shell, saw it) and then verified it was ABSENT in the lead
with `ps eww -p <lead pid>`. That second check cannot answer the question asked.
`ps eww` shows a process's EXEC-time environment - what the lead was started
with - and says nothing about what the lead's own runtime passes to the children
it spawns, which is exactly where a hook lives. I confirmed a hypothesis with an
instrument that could only ever return the answer I expected.

**How did it go wrong?** I treated "present here, absent there" as a delta after
measuring the two sides with DIFFERENT instruments (`env` inside a child vs
`ps eww` on a parent). The correct comparison was symmetric: inspect a
LEAD-spawned CHILD process, which is the same vantage the hook has. When the
reviewer did exactly that (pid 18905, a `python -m http.server` started by a Bash
call in a non-teammate session), the variable was right there. Rule learned: when
a delta decides a gate, both halves must be measured from the position the gate
actually runs in, and a signal named "child session" should be assumed to mean
"is a child" until proven to mean "is a teammate."

The rejected signal is documented in the hook with a do-not-re-add note and the
`ps eww` trap that produced it, and the regression is pinned by four verdict cases plus three advice cases.

## The lead observed the near-miss live, and it exposed a hole in my tests

team-lead reported it independently: a lead spawn of `Agent name=artifact-builder`
got the TEAMMATE notice ("you are a spawned teammate ... spawn UNNAMED ... do NOT
pass name"). The spawn still succeeded and the pane still rendered, because the
teammate path only ever advises. Attribution is unambiguous from the wording:

- the originally shipped hook contains the string "Teammate context" **zero**
  times, so the misfire did NOT predate my edit - it was mine;
- the lead quoted `Teammate context: this session is...`, with no
  `(detected via: ...)` parenthetical, which only the intermediate version
  emitted;
- **the bad signal was never committed** - `git log -p` over every revision of
  the hook shows 0 occurrences of it. The ~20-minute exposure was uncommitted
  working-tree state, live because `~/.claude/hooks/` symlinks into this repo.

Reproduced both ways on the lead's exact input (lead transcript + real lead argv +
`CLAUDE_CODE_CHILD_SESSION=1`, `name=artifact-builder`): the intermediate hook
answers with the teammate notice; the committed hook answers "Named teammate spawn
permitted", and the same context UNNAMED still denies.

**The second self-analysis, and the more useful one.** My suite already had the
lead cases and they were all green while the misfire was live. They passed because
they asserted only the permission DECISION, and the misfire did not change the
decision - it inverted the ADVICE. A gate has two outputs and I was testing one.
The lesson generalizes past this hook: when a hook's payload is guidance, the
guidance is part of the contract and needs its own assertion, because wrong advice
delivered with a correct verdict is invisible to a verdict-only test. Added:
`expect_advice` plus three cases pinning the notice text in both directions. They
score FAIL against the intermediate version on exactly the case the lead saw.

## Verification

- `claude/hooks/test-agent-teams-guard.sh` (new): **27 passed, 0 failed**.
- Dual falsification: the same suite scores **18/9** against the pre-fix hook
  (the original deadlock) and **23/4** against the near-miss version (the lead
  cases go red on exactly the `CLAUDE_CODE_CHILD_SESSION` regression, including
  the lead's live repro).
- Live, no stubs, inside a real teammate: transcript signal -> exempt,
  ancestor-walk-only signal -> exempt. Real lead argv (`ps` of the live lead pid)
  + real lead transcript -> **deny**, mandate intact.
- End-to-end: the independent-review subagent for this very diff was spawned
  UNNAMED from a teammate through the patched hook. It ran. That spawn is the
  fix working.
- Sibling suites green, no cross-breakage: `test-team-reaper`,
  `test-teammate-relay-stop`, `_tests/test-codex-rescue-guard`,
  `test-hook-registry` (52), `test-app-hook-offlist`, `test-install-hook-deploy`,
  `test-settings-deploy-parity`.
- Cross-model gate: `codex-review.py` (codex-cli 0.142.5) real verdict in 234s.
  Two findings, both folded: `ps -ww` against BSD width truncation (Medium) and a
  fixture-setup guard in the test so an empty `TMP` fails loudly (Low). It found
  no `set -euo pipefail` crash path and no PreToolUse contract issue.

## Twin-hook check

Only `agent-teams-guard.sh` enforced the name requirement. The other two hooks on
the `Agent|Workflow` matcher were checked and need no change:
`codex-rescue-guard.sh` requires the OPPOSITE (it denies a NAMED codex-rescue
spawn), and `model-router-guard.sh` only gates the `model` parameter. No twin to
patch.

## Live immediately - no restart needed

`~/.claude/hooks/agent-teams-guard.sh` is a symlink to
`claude/hooks/agent-teams-guard.sh` in this repo, and hooks are re-executed per
tool call, so the edit took effect on the next Agent call in the same session.
Confirmed by the live invocations above and by the unnamed reviewer spawn
succeeding mid-session. Registration is unchanged (`claude/hooks/app-wirings.json`
-> `~/.claude/settings.json`), so nothing needs reinstalling.

## Files touched

- `claude/hooks/agent-teams-guard.sh` - teammate detection + exemption, the
  rejected-signal note, `ps -ww`, signal named in the notice.
- `claude/hooks/test-agent-teams-guard.sh` - new, 27 cases (24 verdict + 3 advice).
- `.claude/memory/MEMORY.md` - index pointer.
