---
name: Task 7 complete (agent-routing installer wiring) - two brief assumptions were stale, both caught before writing
description: 28 -> 30 passing. route-intent.sh wired UserPromptSubmit in cluster-wirings.json (schema copied from grounding-gate.sh, not sidecoach-keyword.sh - that entry does not exist), agent-routing cluster added to install.sh's SIX parallel arrays (brief named only five - TITLES is a real, positionally-consumed sixth array the brief missed), and ~/.claude/settings.json live-wired with a timestamped backup. Hook is now genuinely live for the first time.
type: project
relates_to: [session_2026-07-26_agent-routing-task6.md, session_2026-07-26_agent-routing-task45-verified.md]
author_human: Jonah
source: session
verified: bash claude/hooks/test-route-intent.sh gives 30/30; install.sh passes bash -n; a scoped bash-source of the edited array block shows KEYS/TITLES/DESCS/FILES/DIRS/PICKS all at exactly 9 items; git diff --stat confirms no other array block was touched; settings.json re-parses after the live edit and a timestamped backup exists; live end-to-end smoke test through the real ~/.claude/hooks/route-intent.sh symlink produced a correct nudge at rc=0
confidence: high
---

# Task 7: wire the hook into the harness and installer

Collaborator: Jonah. Commit: "install: register the agent-routing cluster".

## What shipped

- `claude/hooks/cluster-wirings.json`: added a `"route-intent.sh"` entry,
  `UserPromptSubmit`, command `~/.claude/hooks/route-intent.sh`, timeout 5.
- `install.sh`: added `agent-routing` as a ninth entry across all SIX
  parallel arrays in the QA-cluster block (KEYS, TITLES, DESCS, FILES,
  DIRS, PICKS - see below), registered it in `CLUSTER_KEYS`, added a
  `cluster_hooks()` case mapping it to `route-intent.sh`, and added
  `|agent-routing` to both `--only`-related case statements
  (`cluster_detect` dispatch and `deactivate_cluster` dispatch). Also
  updated two doc comments/help text that enumerated "8 QA clusters" so
  they do not go stale (`--help` output and an internal Stage-2 comment).
- `~/.claude/settings.json`: appended the `route-intent.sh` hook to the
  last `UserPromptSubmit` group, after backing up to
  `~/.claude/settings.json.bak.<timestamp>` and confirming the file
  re-parses as JSON both before and after.
- `~/.claude/hooks/route-intent.sh` and `route-intent.json` symlinked to
  the repo copies (repo copy was already executable from Task 2).
- Removed a stray `~/.claude/.route-intent-cooldown` before AND after a
  live smoke-test probe, so the very first real nudge on this machine is
  not silently swallowed by leftover cooldown state.

## Two brief assumptions were wrong; caught before either caused damage

**1. `install.sh` has SIX parallel arrays, not five.** The brief named
`KEYS`, `DESCS`, `FILES`, `DIRS`, `PICKS`. Reading the actual QA-cluster
block (`install.sh:477-512` at the time I edited it) showed a `TITLES`
array interleaved with the same five, populated and consumed exactly the
same way - `printf "... ${TITLES[$i]}" ` and a manifest dump both index it
by the same `$i` as the others (`install.sh:1096`, `install.sh:3218`).
Skipping it would have left `TITLES` one short from the `agent-routing`
entry onward, silently relabeling the title of the personal-components
block that follows agent-routing in array order - the exact failure mode
the brief warned about, just through a channel the brief itself did not
account for. Added a `TITLES` entry ("Agent routing (cheaper-agent
nudge)") in the same edit, in the same position as the other five.

**2. `sidecoach-keyword.sh` is not in `cluster-wirings.json`.** Step 3
told me to inspect that entry and copy its exact shape; querying it
returned `null` - it is not registered there. Rather than invent a schema
(explicitly forbidden - "a previous task in this project shipped a bug by
writing a plausible-looking config value the harness did not actually
accept"), I dumped several confirmed UserPromptSubmit entries instead
(`concise-toggle.sh`, `grounding-gate.sh`, `task-loop-mandate.sh`) and
copied their shape: a list containing one object with `event`, `matcher:
null`, and a nested `hook: {type, command, timeout}`. That is what
`route-intent.sh` now has. Two independent real examples agreeing on the
same shape is stronger grounds than one that turned out not to exist.

## The brief's own Step 6 alignment-check script does not work

Ran it verbatim. Output was `KEYS 1, DESCS 5, FILES 0, DIRS 11, PICKS 11`
- wildly unequal, which per the brief's own instruction ("if the five
counts are not all equal, STOP and report") should mean stop. Did not
stop blindly, because the reason was diagnosable: the script's regex
(`re.search`, not `re.findall`) only inspects the FIRST `NAME+=(...)`
occurrence in the whole 5154-line file, when in reality each array is
built from ten-plus separate `+=` chunks scattered across the file (one
per component/cluster block). The five different numbers are an artifact
of which unrelated chunk happens to be first for each array name, not a
signal about my edit. Confirmed this diagnosis by building an accurate
check instead: extracted the exact `KEYS+=/TITLES+=/DESCS+=/FILES+=
/DIRS+=/PICKS+=` block I edited (`install.sh:477-512`) and sourced it for
real in a bash subshell (`REPO_DIR=/tmp/x; source that block; echo
${#ARR[@]}` for each), which is immune to both the paren-inside-quoted-
string problem (e.g. `"~/.claude/settings.json (wiring)"` breaks naive
non-greedy paren matching) and the whole-file-vs-first-chunk problem. All
six came back at exactly 9, with `KEYS` printing `agent-routing` as the
ninth token in the right position. Cross-checked with `git diff` that no
other array block in the file was touched, and `bash -n install.sh` for
syntax. This is stronger evidence than the brief's own script would have
given even if it had matched.

## Live wiring and settings.json safety

Backed up before touching, per the brief's explicit instruction:
`~/.claude/settings.json.bak.20260726-230015` (there were two earlier
same-day backups already present from prior Task 7 attempts/probes this
session, all still intact). Confirmed `json.load` succeeds before and
after the append. `grep -c route-intent ~/.claude/settings.json` is 1
(one hook entry, not duplicated). A real end-to-end probe through the
live symlink (`echo '{"prompt":"find all the callers of
detect-session-model..."}' | ~/.claude/hooks/route-intent.sh`) produced
the expected Explore nudge at `rc=0`. The stray cooldown file this probe
created was removed immediately after, per the standing warning in the
Task 4-5 verification beat that a leftover timestamp there would
silently suppress the first real nudge on this machine.

## Files touched
- `claude/hooks/cluster-wirings.json` (route-intent.sh UserPromptSubmit
  entry)
- `install.sh` (agent-routing across all six arrays, CLUSTER_KEYS,
  cluster_hooks(), two --only case statements, two doc comments)
- `claude/hooks/test-route-intent.sh` (2 assertions appended per the
  brief's Step 1)
- `~/.claude/settings.json` (live UserPromptSubmit registration, outside
  the repo)
- `~/.claude/hooks/route-intent.sh`, `~/.claude/hooks/route-intent.json`
  (new symlinks, outside the repo)
- `.claude/memory/session_2026-07-26_agent-routing-task7.md` (this beat)
