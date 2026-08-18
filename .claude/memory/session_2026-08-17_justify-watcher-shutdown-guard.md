---
name: Justify-watcher agent shutdown guard (human-gated)
description: A justify-* watcher agent may only be shut down by the USER; every agent path (SendMessage shutdown_request + Bash kill/forge) is hook-blocked, TTY-minted consent token is the one escape.
type: decision
relates_to: [session_2026-07-09_justify-watch-consent-guards.md, session_2026-05-27_agent-teams-guard-hook.md]
author_human: Jonah Cohen
author_model: claude-opus-4-8
source: session
verified: tests
confidence: high
---

MANDATE (Jonah, verbatim intent): "A Justify-watching agent must NOT be autonomously shut
down by a managing/lead/peer agent. Only the human USER's direct command can shut it down.
Not a managing agent. This has happened enough times that it merits a prevention method
that can't be broken."

This is the SIBLING of the daemon watch-disarm gate (session_2026-07-09_justify-watch-consent-guards.md):
that one human-gates DISARMING THE DAEMON WATCH; this one human-gates SHUTTING DOWN THE
WATCHER AGENT (the process/pane). Recurring failure it prevents: 2026-07-12 a managing agent
killed the justify-watch daemon because it rendered as an unnamed general-purpose pane and it
assumed "the other pane must be my leftover"; most recently a lead stood down a justify-owner
watcher it had spawned.

## What counts as a "justify-watching agent"
Primary signal: the `justify-*` name convention (justify-warden, justify-owner, justify-watch),
matched case-insensitively on the leading name (an @session / [ref] suffix is stripped before
judging). Additionally honours a durable registry the watcher may write:
`~/.claude/.justify-watchers` (one name or glob per line). Covers BOTH the persistent daemon
warden AND any redundant/owner watcher an agent spawns.

## The two agent shutdown paths, both hook-blocked
1. **SendMessage** `{"type":"shutdown_request"}` (also "shutdown"/"terminate"/"kill", and a
   stringified-JSON variant) whose `to` is a justify-* watcher -> DENY. New hook
   `justify-watcher-guard.sh` (PreToolUse, matcher `SendMessage`). This is the MAIN path a
   managing agent uses.
2. **Bash kill**: extended `bash-guard.sh`. The pre-existing gate already blocked
   `pkill -f justify` / `killall justify` (name in the text). NEW gate closes the bare-PID hole:
   `kill 16755` where 16755 IS the watcher and "justify" is nowhere in the command - it RESOLVES
   each bare pid in a kill-family slice via `ps -o command=` and blocks if it is a
   `claude.exe --agent-id justify-*` process.

## The ONE sanctioned USER path + the consent primitive
`justify-watcher-shutdown` CLI (justify/cli/justify-watcher-shutdown.sh, PATH-shimmed by
justify/install.sh). TTY-gated (`[ -t 0 ]`) exactly like justify-watch-disarm, so an agent's
Bash tool (never a TTY) is refused with exit 3. Typed `SHUTDOWN` confirmation. Two modes:
default kills the watcher DIRECTLY in the user's own (unhooked) terminal; `--authorize <name>`
mints a single-use, ~120s consent token so the user can tell an agent to do it once.

Consent token `~/.claude/.justify-watcher-shutdown-consent` (helper
`justify-watcher-consent.py`, check/consume only - NO mint subcommand, so there is no
agent-runnable mint to abuse). Both guards `consume` (delete) it on the one shutdown it
authorises (single-use), and target-match it (exact/glob/`*`).

## Why: the security model (mirrors the blessed disarm gate, NOT weaker)
Agent and user share a uid - there is NO cryptographic boundary available. The boundary is the
HARNESS: every agent tool action (Bash, Write, Edit, SendMessage) passes through a PreToolUse
HOOK; the user's terminal does not, and is a TTY; the agent's Bash tool is not. So: hooks block
every agent path to the shutdown, and the token can only be minted from a TTY. An agent cannot
forge the token - `justify-watcher-guard.sh` denies Write/Edit/MultiEdit/NotebookEdit to the
token path, and `bash-guard.sh` denies redirect/tee/cp/mv/dd/ln/touch/rm to it. Same strength
as the existing justify-watch-disarm gate, whose own CLI states "this script is the ergonomics,
not the security boundary." No env-var bypass, no --force.

**Alternatives considered:**
- Categorical block with NO escape hatch (agents can NEVER kill a watcher, user only via CLI):
  simplest and strongest, but the mandate explicitly asked to mirror the disarm token so a user
  CAN authorise an agent-mediated shutdown. Kept the categorical block as the default AND added
  the token as the opt-in escape.
- A cryptographic/daemon-minted token: rejected - same-uid gives no real boundary, and it would
  need the :9223 daemon, but justify-* watchers run in projects without it. The TTY+hook model
  is daemon-independent and matches the existing design.

**Revisit when:** Claude Code gains a real per-agent privilege boundary (then bind the token to
it), or the watcher naming convention changes (update `is_watcher` / the registry).

## Deploy + verify
- Wired in `claude/hooks/app-wirings.json` (PreToolUse SendMessage + Write|Edit|MultiEdit|NotebookEdit),
  registered in `browser-tree.json` (justify bucket + desc + owner), deployed by `install.sh`
  (install_app_hooks + a direct link_or_copy for the .py, mirroring codex-review.py) and
  `justify/install.sh` (the CLI shim). `.py` helpers are never flagged unmanaged (hook-registry
  only flags `*.sh`).
- LIVE now: `justify-watcher-guard.sh` + `justify-watcher-consent.py` symlinked into
  ~/.claude/hooks; both entries merged into live ~/.claude/settings.json via the installer's own
  dedup add() (backup at ~/.claude/settings.json.bak.pre-justify-watcher-*). hook-deploy-currency
  reports no drift.
- Test: `claude/hooks/test-justify-watcher-guard.sh` - 44/44 PASS (guard SendMessage/Write,
  consent check/consume/expire/target, single-use, bash-guard bare-pid kill of a FAKE justify
  agent via `exec -a`, consent override single-use, token-forge redirect/tee/cp, prose no-false-block,
  regression on the existing daemon/worker + disarm gates, CLI TTY-refusal exit 3 + --list, PLUS
  the 12 second-review hardening cases below). Registry --audit clean, hook-data-parity 35/0.
  Regression: `test-bash-guard-commit.sh` 156/0, `test-validation-guards.sh` 70/0 (no fallout
  from the bash-guard additions). hook-deploy-currency `{}` (live == durable, no drift).

## Second independent Codex review + hardening (2026-08-17, resumed after a crash)
After the crash interrupted the commit, the resuming session (Jonah) re-verified everything and
ran a SECOND independent Codex review (codex-cli 0.142.5, read-only) of the full diff. It raised
8 findings. The 5 that a tool-path hook can actually close were CLOSED and given tests; the 3 that
are the same-uid interpreter residue were documented, NOT papered over. Threat model that scopes
them: the real failure is a well-meaning managing/lead agent INFERRING teardown and using a
CONVENTIONAL path (see feedback_2026-08-17_never-autonomously-shutdown-justify-watcher.md), not an
adversary hand-writing raw syscalls.
- **CLOSED F1** (critical): an agent could allocate a pty (`script`/`expect`) to fake the CLI's
  `[ -t 0 ]` gate. bash-guard now DENIES an agent RUNNING `justify-watcher-shutdown` at all (via
  `command_slices`, which sees past VAR=/sudo/env/timeout wrappers + `bash -c` payloads; a bare
  mention in an echo/beat passes). The USER's own terminal never runs this hook, so their path is
  unaffected.
- **CLOSED F3** (high): a `kill -- -PGID` process-group kill now expands `ps -o pid= -g PGID`
  members, so a watcher that is a group MEMBER (not the leader) is still resolved.
- **CLOSED F4** (high): a kill hitting >1 watcher now requires the consent token to cover EVERY
  target (check-all, then consume-once); a token for one watcher no longer waves through a kill
  that also hits another, and a denied multi-kill does not spend the token.
- **CLOSED F6** (high): the Write/Edit token-forge check is now realpath/symlink-aware, so a
  symlink ALIAS to the token cannot dodge the literal-path compare.
- **CLOSED F8** (medium): `consume` is now FAIL-CLOSED - if it cannot delete the token it returns
  non-authorised, so a token whose unlink fails cannot be reused within its TTL (single-use holds).
- **DOCUMENTED F2/F5/F7 (same-uid residue, NOT closed by a tool-path hook, by design):** an agent
  that runs a raw interpreter (`python3 -c 'os.kill(pid,9)'` or `open(token,"w")`) bypasses shell
  parsing; and a raw-agentId terminate is only stopped by the receiver-side approve-gate. This is
  the acknowledged limit of a same-uid harness (no cryptographic boundary; bash-guard's own rm/
  force-push gates share it). Compensating controls: the receiver-side gate blocks the watcher
  APPROVING its own shutdown_response regardless of how the request was addressed; the daemon
  `/watch/disarm` is separately human-TTY-gated; and a Monitor notifies on `watchArmed->false`.
  Fragile interpreter-string parsing was deliberately NOT added (false confidence + false
  positives on legitimate python). Flagged to the lead rather than weakening the rule.

## Commit state (resumed session)
The pre-crash session had built + made everything LIVE but never committed. The resuming session
(Jonah) committed the whole unit to the improv dotfiles repo on branch `justify-watcher-shutdown-guard`
(the repo default is `main`; branched per the branch-first rule). NOT pushed - awaiting the user/lead.
The 5 new files were untracked and the 5 modified files uncommitted before this; all are now in the
one commit together with the second-review hardening.

## RESTART CAVEAT
Already-running sessions (including cmux teammates spawned before this landed) use their
launch-time settings.json snapshot, so the SendMessage guard does not fire in them until they
restart or compact. The bash-guard kill/forge gates are inside bash-guard.sh, which is already
wired, but a running session still runs its snapshot copy. New sessions enforce everything
immediately. The CLI shim (`justify-watcher-shutdown` on PATH) lands on the next
`ampersand --only justify`; until then run it by full path.

## Files touched
- NEW claude/hooks/justify-watcher-guard.sh (PreToolUse guard: SendMessage + file-write forge)
- NEW claude/hooks/justify-watcher-consent.py (single-use consent token check/consume helper)
- NEW justify/cli/justify-watcher-shutdown.sh (TTY-gated sanctioned USER path + token mint)
- NEW claude/hooks/test-justify-watcher-guard.sh (32-case suite)
- claude/hooks/bash-guard.sh (bare-pid watcher-kill gate + consent override + token-forge gate)
- claude/hooks/app-wirings.json, browser-tree.json (wiring + registry)
- install.sh, justify/install.sh (deploy + CLI shim)
- ~/.claude/settings.json (live wiring; not repo-tracked)
