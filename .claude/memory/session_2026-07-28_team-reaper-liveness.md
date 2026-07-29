---
name: team-reaper never reaps a team whose LEAD session is alive
description: The member-process guard only ever matched teammates, so the teardown discipline made a healthy lead look abandoned and its team dir was rmtree'd twice in one day. Added a lead-liveness guard keyed on config.json leadSessionId, plus the false-alive hardening three Codex rounds demanded.
type: session
relates_to: [session_2026-07-28_team-file-reaped-repair.md, session_2026-07-08_team-reaper-live-guard.md]
supersedes: session_2026-07-08_team-reaper-live-guard.md
author_human: Jonah
author_model: claude-opus-5[1m]
machine: cmux
source: session
verified: tests (51/0), 24-mutant control, defect reproduced against pristine HEAD, end-to-end against the real process table, 3 Codex wrapper passes all exit 0
confidence: high
---

# The reaper deleted a live session's team, twice, because a healthy session looks abandoned

`~/.claude/teams/session-d883bc0d/` vanished twice on 2026-07-28 while the lead session was
still running and still working. Every `Agent` spawn then failed with `team file for
"session-d883bc0d" not found`. The runtime reads `config.json` live rather than caching it,
which is why deleting it breaks spawning immediately.

## Root cause, measured on the live machine (not inferred)

`team_has_live_process()` matched only markers that carry the TEAM DIR NAME. A per-PID scan
of the real process table showed exactly who carries what:

| PID | argv carries | who |
|---|---|---|
| 73001, 75224, 77093, 86404 | `--team-name session-d883bc0d`, `--agent-id X@session-d883bc0d` | the four teammates |
| 56383, 56638 | `--session-id 5b305128-2ba0-47f4-b090-5029c05fcc6c` only | the LEAD and its cmux launcher |

The lead does not carry the team name anywhere in its args. So the guard could only ever see
TEAMMATES - and the standing teardown rule kills each teammate the moment its unit is
accepted. A well-run lead between waves therefore has ZERO processes carrying the team name
and is indistinguishable from an abandoned team. **Following the teardown discipline is what
made this session reapable.** Raising `IDLE_MINUTES` was explicitly rejected: it converts a
certainty into a longer-odds race, and this session would still have lost, twice.

## The fix

A team is never reaped while its LEAD SESSION is alive, established from `config.json`'s
`leadSessionId` by two OR'd signals that each decay on their own:

1. **Process argv** carrying that session id (`--session-id`, `--parent-session-id`,
   `--resume`, space or equals form). Dies with the process. This is the primary signal.
2. **Transcript freshness** of `~/.claude/projects/*/<leadSessionId>.jsonl` inside a bounded
   window. Deliberately NOT an existence test: transcripts are never deleted, so an
   existence test is a permanent false-alive that leaks the directory forever.

**Why the transcript is only ever an OR term, never an AND:** team `session-fb0d96bd` has a
live member but NO transcript under its recorded `leadSessionId`, so a missing transcript
cannot mean dead. A resumed or compacted lead outlives the transcript named by its original id.

**The load-bearing exemption:** the lead guard does NOT apply to the `owned-by-ending-session`
reap. That hook runs inside the lead's own still-running process, so both signals report
alive by construction; honouring them there would disable the primary cleanup path and leak
every team directory forever. A session ending is authoritative about its own liveness in a
way no inference can beat.

## What three Codex rounds added (each finding was real)

Round 1: `inf` window is a permanent false-alive; future-dated mtime is unbounded on the high
side; symlinks aim the probe outside `projects/`; a non-string `leadSessionId` crashes the
hook; substring argv matching lets a short corrupt id match anything.

Round 2: a merely LARGE finite value still overflows (`1e308 * 60 == inf`), so bounds must be
applied to the CONVERTED value; negative tunables turn every team into a reap candidate; the
pre-existing member guard was still substring-based, so a live `worker@session-abc2` pinned
dead team `session-abc`.

Round 3: rows that bypassed the crash tripwire could pass vacuously; equals-form flags were
supported but untested; the memory-safety row reaped nothing, so it tested the fixture rather
than the reap path.

**Residual, named rather than hidden:** if the `ps` scan fails PERSISTENTLY, every team reads
as live for as long as that lasts. That bias is deliberate and kept - a stale directory is
recoverable, deleting a live team is the bug this guard exists to prevent - so the header
comment now names it instead of claiming nothing can pin a directory forever.

## Self-analysis: my mutation harness faked 13 kills

While parallelising the mutation runner I rewrote a working two-line read-then-write as
`open(p,"w").write(open(p).read().replace(...))`. Python evaluates `open(p,"w")` first, so
every mutant file was truncated to 0 bytes before being read. An empty hook fails every row,
so 13 mutants reported CAUGHT having proven nothing.

Why it happened: I treated a mechanical refactor of TEST INFRASTRUCTURE as not needing
verification because the previous version had worked. What caught it: the failure signatures
were IDENTICAL across every mutant - 46 rows, same list - and a real mutation set produces
diverse, targeted signatures. Uniformity is the tell. The harness now asserts the mutated
file's byte length equals the expected delta, refuses an empty result, and treats an
over-broad failure signature as a failed mutation rather than a kill.

A second self-inflicted one: an apostrophe in a Python comment ("each tunable's own unit")
terminated the `python3 -c '...'` single-quoted shell string, and since this hook is
symlinked live into `~/.claude/hooks/`, that briefly shipped a hook that did not parse. The
`hook-registry-guard` PostToolUse hook caught it immediately. No apostrophes inside that block.

## Verification

- **Defect reproduced first**, against pristine `git archive HEAD` (8ae761a4): idle team, lead
  alive via the real argv shapes, no teammate markers -> `removed 1 orphan team(s):
  session-d883bc0d [idle(60m)]`, exit 3. A control with a teammate marker present survives on
  the same pristine hook, so the harness is not vacuous.
- **Real process table, teammates stripped** (1060 real lines, 0 team-name markers, 2 lead
  `--session-id` markers): PRISTINE deletes this session's own team, FIXED keeps it.
- 51/0 on the fixed hook; 16 rows RED against pristine HEAD.
- 24 mutants, each anchor proven present before trusting a result, each caught by its intended
  row with a targeted signature.
- Live `~/.claude/teams/` never touched: every probe ran under a temp HOME, and both live team
  dirs still hold their `config.json`.

Suite runtime is ~2.5 min: this machine costs ~0.4s of wall per process spawn (`python3 -c
pass` = 0.36s at 4% CPU), which is environmental and pre-existing. Run it with a timeout
above the 120s default.

## Files touched

- `claude/hooks/team-reaper.sh` - lead-liveness guard, session-end exemption, `_env_float`
  range/finite validation, token-bounded member and lead matching, symlink and type hardening
- `claude/hooks/test-team-reaper.sh` - 18 -> 51 rows, `run()`/`run_env()` crash tripwires
