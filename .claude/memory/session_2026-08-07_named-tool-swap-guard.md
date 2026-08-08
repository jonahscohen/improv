---
name: Named-tool substitution guard (H3) - the guard the source beat warned about
description: Built the two-hook named-tool-swap guard (arm + Stop) from the H3 spec. Arms a per-session flag on a TIGHT imperative naming a tool/capability (spawn an agent / run /slash / use the <X> tool); the Stop gate blocks ONCE when a demand is armed, the turn claims done, the capability never successfully ran, and the user did not release it. Built deliberately conservative - the source beat warned it over-fires on paraphrase, so it prefers false negatives. Two Codex review rounds folded (6 false-positive edges fixed); 46-case suite green; shellcheck clean. NOT wired (lead owns wiring); lead decides default-ON/OFF/hold.
type: project
relates_to: [session_2026-08-07_tool-declared-broken-direct-order-failure.md]
author_human: Jonah
author_model: claude-opus-4-8
source: session
verified: tests (46/46) + shellcheck clean + 2 Codex review rounds folded to convergence
confidence: high
---

Collaborator: Jonah. Built at the lead's dispatch; this is the H3 proposal from
session_2026-08-07_tool-declared-broken-direct-order-failure.md turned into real hooks.

## What this is
The named-tool substitution detector. Failure it targets: user says "spawn an agent"; the
spawn errors; the assistant declares the tool "broken", does the task SOLO, and reports done.
Routing around a direct order to use a named tool - without fixing it and without the user's
sign-off - is the sin. This raises the cost of that rationalization at the exact moment it
happens (claiming-done-via-substitute).

**The source beat WARNED this guard over-fires on paraphrase and must be a tight speed-bump,
not a semantic judge.** Every design choice leans toward PASS (false negative) over a false
positive. A spurious block on legitimate work is the expensive failure here.

## Files (built; NOT wired - lead owns all wiring)
- `claude/hooks/named-tool-swap-arm.sh` - UserPromptSubmit. Records the demand to a per-session
  flag `~/.claude/.named-tool-swap-armed.<session>` (one descriptor per line).
- `claude/hooks/named-tool-swap-guard.sh` - Stop. Blocks once when armed + done-claim +
  capability-never-ran + not-released. Once-per-session block flag
  `~/.claude/.named-tool-swap-blocked.<session>`.
- `claude/hooks/test-named-tool-swap-guard.sh` - 46-case falsification suite (both hooks
  through a shared fake $HOME).

## The exact (tight) arming lexicon
Three anchored shapes, each narrow on purpose:
1. **Agent/teammate spawn** - the verb `spawn` within <=16 non-period chars of the noun
   agent/teammate/subagent. ONLY "spawn" (not dispatch/launch/kick off). Descriptor: `agent`.
2. **Slash command** - `/word` at line start OR right after run/use/do/execute/invoke/call, and
   NOT followed by another `/`. Descriptor: `slash:<name>`.
3. **Use a named tool** - "use (the) <X> tool" or "use mcp__...", but ONLY when <X> resolves to
   something the Stop hook can confirm ran: a known built-in (Read/Edit/Bash/...) or an mcp__
   tool. Descriptor: `tool:<base>` (or `agent`).

## Every carve-out / PASS condition implemented (why it is quiet)
- **not armed** -> nothing demanded.
- **capability SUCCEEDED** -> a matching tool_use with a non-error result exists in the
  transcript (Agent by base-name "agent"; tool by base-name; slash via a Skill tool_use whose
  serialized input contains the command). Error != ran: the field failure had an Agent call that
  ERRORED, which does NOT satisfy the demand.
- **user released the demand** - a sign-off in the last prompt (arm hook usually clears it
  first). Sign-off lexicon: do it yourself / you do it / handle it yourself / solo is fine /
  (do not|don't|dont|no need to) spawn / without spawning|an agent / no need for an agent / no
  agent / don't use an agent / skip the agent, PLUS method-flexibility approvals: go ahead
  without / do it another way / another way is fine / your call / up to you / whatever works /
  however easiest.
- **NOT claiming done** - completion detection is NEGATION-AWARE (a claim word counts only if the
  ~24 preceding chars carry no negator), lexicon trimmed to unambiguous claim words (dropped
  "here's"/"ready"/bare "I've X"), and an ONGOING/blocker suppressor forces PASS on "still
  working|failing / in progress / not (yet) done / haven't finished / before I can
  continue / can't continue / blocked on / blocker / needs to be fixed". Asking-the-user
  (a "?" with should I / want me to / how would you like / ...) also passes unless an UNNEGATED
  strong-done word is present.
- **already blocked this session** -> fires at most ONCE per session (atomic O_EXCL flag).
- **subagent/teammate transcript** -> lead-facing gate only.
- **empty session_id** -> guard fails open (would otherwise share a global flag cross-session).
- Standard fail-open: stop_hook_active, no/unreadable transcript, any exception -> `{}` exit 0.

## Accepted FALSE NEGATIVES (deliberate, documented)
- Paraphrase the lexicon does not catch ("kick off a subagent", "dispatch a teammate") never
  arms - the beat named this as acceptable.
- No timing correlation: ANY successful spawn in the session satisfies a later spawn demand. A
  session that spawned once will not be gated on a later solo-substitution. Combined with the
  once-per-session block, the guard's total footprint is at most one nudge per session, only
  when NO successful spawn happened at all - exactly the tight speed-bump asked for.
- "use the browser tool" (no confirmable tool name) does NOT arm.
- Bare affirmative after an ask ("yes, go ahead") does NOT disarm - it can leave a stale arm.
  Mitigated by method-flexibility approvals + the block message telling the user they can
  release the demand; residual is self-correcting and once-per-session.

## Verification
- `bash claude/hooks/test-named-tool-swap-guard.sh` -> 46 passed, 0 failed.
- shellcheck clean on all three files.
- **Cross-model review: 2 Codex rounds folded to convergence.** Round 1 (6 findings): negated
  demands armed (High), completion false-positives on negated/status text (High), approval-
  after-ask stays armed (Med), absolute paths read as slash commands (Med), empty-session global
  flag (Low). Round 2 (3 findings): spawn match missed the negation lookbehind (Med), one-segment
  paths off the FS-root list (Med), "needs to be fixed" status blocked (Low). Round 3: converged.
  Every reported false-positive path is now covered by a test, and the field-failure shape
  ("<tool> is broken ... I did it solo. Done.") still correctly BLOCKS.

## Quoting note (bug caught + fixed during the build)
First draft used `python3 -c '...'`; apostrophes in the lexicons ("don't", "here's") silently
terminated the bash single-quote and vanished, so the "don't spawn" sign-off never matched.
Rewrote both hooks to the env-var + quoted-heredoc shape (`HOOK_INPUT="$INPUT" python3 <<'PY'`),
same pattern the sibling figma-fidelity-arm.sh / cmux-team-config-heal.sh use for the same
reason. A regression test now pins the real-apostrophe path.

## Handoff to the lead
This is the guard the source beat flagged as over-fire-prone. Wiring decision (default-ON /
default-OFF / hold) is the lead's call. It is built conservative enough to run default-ON
without wedging legitimate work, but that is a judgment for the lead at wiring time.

## Files touched
- claude/hooks/named-tool-swap-arm.sh (new)
- claude/hooks/named-tool-swap-guard.sh (new)
- claude/hooks/test-named-tool-swap-guard.sh (new)
