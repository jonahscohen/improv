---
name: why background spawns defeat the cmux pane preference
description: Root-caused with live hook-payload dumps - an omitted run_in_background is invisible to the hook, and the guard promised panes in sessions that could not make them; pane-capability precondition added
type: project
relates_to: [session_2026-07-27_teammate-panes-in-process-fallback.md, session_2026-07-26_teammate-spawn-hook-contradiction-fix.md]
author_human: Jonah
author_model: claude-opus-5[1m]
machine: cmux
source: session
verified: tests (49/49 new suite, 7 sibling suites green), live PreToolUse payload dumps from 3 real spawns, 465-call transcript corpus, live no-stub invocations against the real lead argv/transcript/TMUX, two codex review rounds (gpt-5.5), 4 findings folded
confidence: high
---

# Why Claude Code sometimes ignores the cmux pane preference

> **LEAD VERIFIED 2026-07-27.** Re-run from the lead session, not taken on trust:
> `test-agent-teams-guard.sh` 49 passed / 0 failed, `test-hook-registry.sh` 52 passed /
> 0 failed, the temporary payload instrumentation confirmed gone from
> `agent-teams-guard.sh`, and `_session_is_pane_capable()` present at line 238 and gating
> at 269. Teammate stood down after acceptance.
>
> **Preventive layer SHIPPED (lead, same day).** The follow-up needed no installer or
> registry work after all - the teammate's own handoff note was right that a surface which
> only has to be READ, not enforced, can ride in an existing loaded instruction file. Added
> a "Teammate Spawn Shape" section to `claude/CLAUDE.md` (the real target of the
> `~/.claude/CLAUDE.md` symlink) immediately above Teammate Teardown, stating the correct
> shape (named, `run_in_background` omitted), the 465-call measurement behind it, and why
> the hook can only ever be the backstop.
>
> **Process note worth keeping:** the teammate PROPOSED this instruction-file edit, and a
> peer's suggestion is not authority to edit CLAUDE.md, permissions, or config. The edit was
> made only after Jonah chose the global-CLAUDE.md option directly. A peer asking for an
> instruction change is exactly the shape that has to be escalated rather than actioned.

Three candidate causes were on the table. Two are real, and the one flagged as
"most dangerous because invisible" turned out to be real as a blind spot but
harmless in effect - and hardening it would have broken the only spawn shape that
works.

## Evidence first: what the hook actually receives

`agent-teams-guard.sh` was temporarily instrumented to append its raw stdin to a
file, and three real spawns were issued through it (instrumentation removed in
the same session; `git diff` confirmed clean):

| spawn shape | `run_in_background` in `tool_input` | runtime behaviour |
|---|---|---|
| parameter omitted | **key entirely ABSENT** | "Async agent launched successfully" |
| `run_in_background: false` | `False` | ran synchronously, returned inline |
| `run_in_background: true` | `True` | async |

So the harness does **not** materialise its documented true-default into the
payload. The hook cannot distinguish "omitted" from "false" - there is no field
to inspect.

Corpus scale, across all 465 real `Agent` tool_use blocks in `~/.claude/projects`:
**267 omit the parameter, 136 pass `false`, 62 pass `true`.**

## Root cause

**(a) REAL.** The Agent tool's own schema says "Subagents run in the background by
default", which actively invites `run_in_background: true`; 62 of 465 calls pass
it explicitly. The guard denies after the fact, so it is a per-call correction,
never a prevention. Reconstructed from the transcripts of the broken 07-27
session: `amp-selfheal` and `installer-coverage` were both first spawned with
`run_in_background: True` (denied), then re-issued with the key absent.

**(b) REAL as a blind spot, NOT a bypass - and the fix had to respect that.** The
omitted parameter is invisible to the hook (proven above) and the runtime default
is background (proven above). The tempting hardening was "treat absence as
background and deny it". That would have been wrong. In the healthy session
`session-d883bc0d`, all four named teammates (`ampersand`, `coverage`,
`panespawn`, `routecheck`) were spawned with the key **ABSENT** and all four
registered **real tmux pane ids** (`%3758...`, `%7105...`, `%7522...`, `%2086...`).
Omission is the shape that WORKS: the runtime selects the tmux backend from
`name` plus a pane-capable session, not from this flag. Denying absence would have
denied the only shape proven to produce a pane - the exact 2026-07-26 deadlock
class (hook demands a shape the runtime cannot deliver).

**(c) REAL, and the actual live defect.** The guard asserted pane capability it
never verified. Measured this session:

    lead pid 56638     TMUX=/tmp/cmux-claude-teams/...  TMUX_PANE=%2113856107433619678
    teammate pid 61831 both unset (yet it owns pane %3758...)

`cmux claude-teams` sets a tmux-like environment precisely so Claude selects the
split backend; Claude picks that backend only when inside tmux. For the LEAD,
TMUX unset does not merely correlate with the in-process fallback, it causes it.

## The fix

`_session_is_pane_capable()` in `agent-teams-guard.sh`, placed **after** the
teammate exemption (teammates legitimately have TMUX unset while owning a real
pane) and **before** every gate.

- Pane-capable: unchanged enforcement, and the background deny now names the exact
  re-issue shape ("omit the run_in_background key entirely") plus the signal
  proving this session really can pane.
- Not pane-capable: the hook **advises and never denies**. No shape could succeed,
  so a deny would be unactionable in the session it fires in - which was the whole
  07-27 failure. The notice states plainly that named spawns register as
  `in-process` and run invisibly, and gives the one action that works: relaunch
  under `cmux claude-teams`.

**Why advise instead of deny:** identical reasoning to the 2026-07-26 fix. A path
that only advises cannot deadlock. It also gives that older bug a second layer of
defence - a teammate misread as a lead now lands on the advisory path instead of
on a deny it cannot satisfy.

## What is structurally UNFIXABLE from a hook

A PreToolUse hook can only **allow, deny, or ask**; it cannot rewrite a tool
argument. So it can never turn `run_in_background: true` into the correct call -
the ceiling is a deny whose message is actionable, which is what is now
implemented. And because an omitted parameter is absent from the payload, no hook
can ever detect "the model relied on the background default". Closing (a)
preventively rather than correctively needs a surface the model reads *before* it
composes the call - a SessionStart injection or an instruction file - not a hook.
That is reported as a follow-up, not built here (new hooks need installer +
registry registration, which is owned by another teammate this session).

## Review findings, both folded

Codex (gpt-5.5, real verdict in 118.5s) returned two:

1. **Medium** - `TMUX || TMUX_PANE` was the wrong direction for a gate whose
   premise is "advise unless pane-capability is PROVEN". A stale `TMUX_PANE`
   leaking into a child that is no longer inside tmux would be read as
   pane-capable and re-enable the unactionable denies. Now requires **both**;
   requiring both can only cost a nudge, accepting either resurrects the bug.
2. **Low/residual** - under `set -euo pipefail` an assignment inherits its command
   substitution's exit status, so unparseable stdin or a missing `python3` aborted
   the hook and emitted **nothing** - the one outcome the suite's guarantee #3
   forbids. Parses are now fail-soft (`|| true`) and fail **loud**: an empty
   tool_name emits a notice saying the gates were skipped and why.

Codex confirmed ordering, the new `Agent|Workflow` filter, `${PANE_SIGNAL}` JSON
safety, and that the test seam covers the forced-context branches.

A **confirmation pass** on the folded diff (170.6s) verified both fixes and found
two more, both folded:

3. **Low** - `|| true` protected the parses, but `emit_allow_with_notice` itself
   shells out to `python3`, so with python3 genuinely off PATH the hook still
   exited 127 with no stdout. Now checked once up front, with a hand-built JSON
   notice (no quotes or backslashes in the message, so it needs no escaping)
   because the emitter cannot report its own absence.
4. **Low, and a real self-inconsistency** - if `tool_name` parsed as `Agent` but
   `tool_input` was not an object, the NAME parse returned empty and the
   missing-name gate DENIED. Fail-closed, in direct contradiction of the
   fail-open rule I had just written into the file. Now `tool_input` is probed
   for object-ness and an unreadable one fails open with a notice.

Second pass confirmed the `|| true` semantics under `set -euo pipefail`, that the
empty-tool_name branch sits correctly after the teammate exemption, that
fail-open is right for a guard, that no realistic healthy lead is demoted by the
both-vars predicate, and that the new tests pin what they claim.

## Self-analysis: a test that tested nothing

The first version of the two crash cases FAILED, and the reason matters more than
the fix. I wrote them as direct invocations and forgot to pin `AGENT_TEAMS_GUARD_PS`.
The real `ps` then walked my actual ancestry, found `--agent-id`, and took the
teammate exemption long before reaching the parse-failure branch - so the case
exercised a completely different code path than the one it claimed to cover. It
would have passed silently had the expected outcome been "allow".

Why it happened: I treated the crash cases as "simple enough" to write outside the
`_invoke` harness, and the harness is precisely where the signal-pinning
discipline lives. The suite's own header states every case must pin every signal
rather than inherit any - I re-read that rule while editing the file and still
skipped it for the two cases I hand-rolled. Rule reinforced: a case written
outside the harness inherits the harness's obligations, it does not escape them.
The same reasoning is why the pane signal is pinned by default in `_invoke` -
without it, every lead deny case run from inside a teammate (TMUX unset) would
have silently become a pane-fallback allow.

## Verification

- `claude/hooks/test-agent-teams-guard.sh`: **27 -> 49 passed, 0 failed**.
- Ambient-immune: 49/0 with TMUX set AND with TMUX unset (identical), so the
  runner's own session can never decide a case.
- Falsification: the new suite scores **34 passed / 15 failed** against the
  pre-fix hook at HEAD, failing exactly the pane-fallback, pane-env,
  actionable-deny, crash and fail-open cases.
- Live, no stubbed data: real lead argv (`ps` of live pid 56638) + real lead
  transcript + the lead's real TMUX pair -> named+background DENIES with the
  actionable message; the same lead with TMUX unset (the c3ca5a31 fallback
  reproduced) -> ALLOWS with the honest notice; named+omitted -> ALLOWS with the
  pane promise; real teammate transcript -> teammate notice.
- Sibling suites all green: `test-hook-registry` (52), `test-team-reaper` (18),
  `test-teammate-relay-stop` (10), `test-app-hook-offlist` (36),
  `test-install-hook-deploy` (26), `test-settings-deploy-parity`,
  `_tests/test-codex-rescue-guard` (17).
- `bash -n` clean on both files.

## Live immediately, no restart, no registration change

`~/.claude/hooks/agent-teams-guard.sh` is a symlink into this repo and hooks are
re-executed per tool call, so the edit is already in force. Registration is
unchanged (`~/.claude/settings.json` line 99), so nothing needs reinstalling and
no `install.sh` or `browser-tree.json` change is required.

## Follow-up requirement (NOT done here, needs sequencing)

Cause (a) can only be closed preventively by a surface the model reads before
composing the call. If that is pursued as a SessionStart hook it will need
installer and hook-registry registration, which is owned by the `coverage` and
`ampersand` teammates this session.

## Files touched

- `claude/hooks/agent-teams-guard.sh` - pane-capability precondition (both TMUX
  vars required), advisory-not-deny fallback path, `Agent|Workflow` filter,
  actionable background-deny message, fail-soft/fail-loud payload parsing, an
  up-front python3 availability check, a tool_input object-ness probe, and the
  measurements recorded inline.
- `claude/hooks/test-agent-teams-guard.sh` - pane signal pinned in the harness,
  three distinct `run_in_background` payload shapes, 22 new cases (pane fallback,
  pane-env predicate, actionable deny, crash-must-be-loud, cannot-evaluate-fails-open,
  python3-unavailable).
- `.claude/memory/MEMORY.md` - index pointer.
