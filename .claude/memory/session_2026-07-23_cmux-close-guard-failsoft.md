---
name: cmux-close-guard break-glass - implementer's record (passes 10-12 + residual risk)
description: Implementer-side companion to session_2026-07-23_cmux-close-guard-breakglass.md (the lead's indexed decision beat for the same unit). Same conclusion; adds the THREE bypasses fixed after the lead's 127-row verification - substitution-in-assignment, substitution-as-argument, and an escaped-expansion FALSE POSITIVE - plus known residual risk. Final suite is 138 rows over 12 Codex passes, not 127 over 9.
type: project
relates_to: [session_2026-07-23_cmux-close-guard-breakglass.md, decision_cmux_hardening_proposal.md, session_2026-06-25_cmux-hook-command-not-found-fix.md]
author_human: Jonah
author_model: claude-opus-4.6
machine: Mac
source: session
verified: tests (138/138) + 12 independent Codex review passes
confidence: high
---

Collaborator: Jonah. Authored against HEAD `4d61ba1f`. No commit made - the file is live via the `~/.claude/hooks/` symlink.

> **Read `session_2026-07-23_cmux-close-guard-breakglass.md` first** - that is the lead's indexed decision beat for this unit and the two agree on the conclusion. This one is the implementer's record. It exists because work continued after the lead's verification snapshot: the lead recorded 127 rows over 9 Codex passes, and the final state is **138 rows over 12 passes**. Passes 10-12 are ONLY here, and one of them was a false positive the guard was inflicting on ordinary commands. The "failsoft" in this filename is historical - the fail-soft approach was rejected.

## The ask

Stop `cmux-close-guard.sh` (a PreToolUse hook on the `Bash` matcher, so it runs on EVERY Bash call) from issuing transient `permission denied` decisions when cmux's CLI is momentarily unavailable or its output format has drifted. Today's only workaround is restarting cmux, which kills active work. The prescribed fix was the hardening proposal's Option (a) gap (i): an ABSENT / DRIFTED / TRANSIENT split that FAILS SOFT when the guard cannot see cmux.

**The prescribed fix turned out to be wrong, and shipping it would have re-opened the 2026-07-12 incident.** What shipped instead delivers the same user outcome by a different mechanism.

## Reproduction first (three corrections to the brief)

Fed the hook real PreToolUse payloads against stub cmux binaries. Baseline suite was green (76/76) before any edit.

| Case | Decision before |
|---|---|
| close + cmux exits non-zero (transient) | deny |
| close + cmux exits 0 with drifted schema | deny |
| close + cmux exits 0, empty output | deny |
| close + healthy cmux, live pane | deny (correct - the protection) |
| prose containing a close substring (`echo ...`) | **allow** |

Three things the brief got wrong, all found by reproducing rather than trusting the diagnosis:

1. **Prose was never blocked.** The proposal claimed "any Bash command that merely contains a close-subcommand substring BLOCKs." It does not. `echo 'cmux close-surface ...'` never reaches `find_cmux()`, because `close_cmds` stays empty and the guard emits allow at that check. Only a REAL parsed `cmux <close-sub>` invocation reaches the cmux introspection. So the blast radius was always "actual close attempts", never "unrelated Bash".
2. **The ABSENT case was near-unreachable.** `find_cmux()` returns None only when no cmux exists anywhere. On this machine the `/Applications/cmux.app` binary AND the `~/.claude/cmux/cmux` shim both resolve, so ABSENT essentially never fires. The real recurring pain is the TRANSIENT/DRIFT path.
3. **`CMUX_CLOSE_GUARD_CMUX` leaked to the live cmux.** Set to a non-existent path, `find_cmux()` fell through to the real binary, so a stub-path typo in a test silently drove Jonah's actual cmux session. Visible as nondeterminism: the pre-fix suite scored 81/7 and 80/8 on consecutive runs. Fixed by making the override authoritative when set.

## Why fail-soft is wrong (the decision)

**Choice: an unintrospectable cmux still DENIES. The remedy changes from "restart cmux" to `CMUX_CLOSE_UNVERIFIED=<target>`, an explicit per-target break-glass asserted on the same command.**

**Alternatives considered:**

- **Blanket fail-soft on absent/transient/drift (the prescribed fix): REJECTED, falsified.** Its load-bearing premise is "if introspection is not answering, the close cannot destroy anything either." That is false. Introspection and closing are *different subcommands*. Proved it with a stub whose `top` returned a drifted v2 header while `close-surface` executed perfectly - `top` is heavy and can time out or change shape across a cmux auto-update while the cheap close path is untouched. Worse, DRIFT is the case where cmux is *provably healthy* (it answered), so the close is almost certainly still functional. Allowing there re-opens the exact 2026-07-12 incident.
- **Fail-soft only when the close provably cannot run (absolute path that does not exist): REJECTED, TOCTOU.** `install -m 755 <real cmux> /tmp/cmux-x; /tmp/cmux-x close-surface ...` is absent at hook time and fully functional at execution time. A plausible setup-then-run agent line, not an exotic attack. Removed entirely.
- **Fail-soft when a bare `cmux` does not resolve: REJECTED.** The shell that runs the command can resolve it differently than the hook (a PATH assignment on the same line, a profile entry). "I cannot find it" is not "it will not run."
- **Keep denying with a better message: REJECTED.** Costs the user a cmux restart, which is the entire complaint.

**Why this one:** the cost asymmetry is decisive. A spurious deny costs a cmux restart, which is recoverable. A spurious allow kills a live agent and its queued work, which is not - that is literally the founding incident. So the verdict stays DENY and only the *remedy* improves. The break-glass is deliberately per-target and deliberately not a boolean: a truthy flag gets pasted once and forgotten, whereas naming the surface forces the same positive identification the ownership gate already demands. It never unlocks a pane cmux CAN see - when introspection works, the liveness gate runs and stays a hard no-override gate.

**Scope of the break-glass, which is itself load-bearing:** `list-panels`/`top` are needed by EVERY close, so their failure requires every close on the line to be asserted. The pane tree is needed only by workspace/window closes, so a tree outage clears only the close that asserted it. It does NOT cover "cmux is not resolvable at all" - with no reachable cmux, an "I checked this pane" assertion has nothing to attach to, and the remedy there is a one-time PATH/install fix rather than a per-session restart.

**Revisit when:** cmux ships a stable versioned CLI/IPC contract (then verify against that contract instead of parsing stdout); OR the break-glass shows up in transcripts as a reflex rather than a considered act (that is the "pasted once and forgotten" failure mode - if it appears routinely, tighten it); OR cmux gains a subcommand that reports pane liveness atomically with the close, which would remove the introspect-then-close race entirely.

## Twelve Codex passes

The produce-and-verify mandate ran to convergence. Every pass found something; each was reproduced against the live guard before being fixed, and pinned with a regression row. Passes 1-2 killed the fail-soft premise; the rest are hardening Codex prompted, most of it pre-existing rather than introduced here.

| # | Finding | Status |
|---|---|---|
| 1 | Transient/drift fail-soft allows a live close | premise falsified, reverted to deny |
| 1 | ABSENT judged by `find_cmux()`, so an out-of-tree `/opt/.../cmux` read as absent | **regression I introduced**, fixed |
| 2 | Tree break-glass emitted a WHOLE-LINE allow, clearing a live surface close later on the line | **regression I introduced**, fixed (per-close now) |
| 2 | Bare-name PATH divergence; invalid override masked a real cmux; caller-supplied binary became the introspection source; hook exec'd untrusted relative paths | fixed by removing every fail-soft and never exec'ing a caller-named binary |
| 3 | `cannot-run` allow was TOCTOU | allow removed entirely |
| 3 | `--` end-of-options makes the real target unknowable | denied outright |
| 4 | Dynamic args on a *parsed* close (`$(printf -- '--surface')` smuggles a second target) | pre-existing, fixed |
| 4 | Renamed/copied cmux (`/tmp/cmux-x close-surface`) never classified as cmux | pre-existing, fixed |
| 5 | **My renamed-cmux rule false-positived on `grep`/`rg`/`echo`/`cat`** | **regression I introduced**, fixed |
| 5 | PATH/hash/alias resolution remaps | pre-existing, fixed |
| 7 | Break-glass also covered the unresolvable-cmux path | fixed (hard deny) |
| 8/9 | `PATH+=` append form missed; `ENV_ASSIGN` did not match `+=` at all, so `PATH+=... cmux close-surface` shifted the executable and fell through allowed | pre-existing, fixed at the root |
| 10/11 | Close inside a command substitution (`out=$(cmux close-surface ...)`, `echo $(...)`) never parsed | pre-existing, fixed generally |
| 11 | Escaped `\$(` / backticks in double-quoted prose read as live substitutions | **regression I introduced**, fixed |

Final verdict: **Ship.** "I do not see a case where this diff makes the guard weaker than the original, other than the deliberate `CMUX_CLOSE_UNVERIFIED` break-glass."

## Self-analysis

**Why did I introduce four regressions?**

The first two share one root cause: **I implemented the brief's prescribed mechanism instead of first testing its premise.** The brief said "fail soft when cmux cannot be seen," and I reproduced the *symptom* faithfully but never interrogated the *reasoning* - that an unreachable CLI means an impotent close. One stub took ninety seconds to write and demolished it. I had even written the Debugging Protocol's "reproduce success first" into my own process, then applied it only to the bug and not to the proposed fix. **A prescribed fix is a hypothesis, not an instruction** - the same rule the plan-stamp protocol applies to drifted plans applies to handed-down diagnoses.

The other two (the `grep close-surface` false positive, the escaped-`\$(` false positive) share a different root cause: **I fixed a false negative by widening a rule without testing the widened rule against ordinary traffic.** I checked "does the bypass now deny?" and not "does normal work still pass?" On a hook that runs on every Bash call, a false positive is as costly as a false negative - and blocking `grep` is precisely the class of breakage this unit existed to reduce. The escaped-`\$(` one is the sharpest lesson available: my own rule blocked my own review command, mid-task. Both directions now have pinned regression rows.

**What I did right:** reproducing before fixing caught all three errors in the brief, and running Codex to convergence rather than stopping at the first "looks good" caught ten bypasses - four of them mine. Stopping after pass 1, which felt sufficient at the time, would have shipped a guard that allowed closing a live agent pane.

## Verification

- `bash claude/hooks/test-cmux-close-guard.sh` -> **138 passed, 0 failed**, deterministic across 3 consecutive runs (was 76 rows; all 76 originals retained).
- Falsification: the 7 original fail-soft rows FAIL against the pre-fix guard while the fail-closed controls pass against both, so the rows test the change and not themselves. The out-of-tree-binary fix was falsified separately against a simulated non-standard install (pre-fix allows a live-pane close, post-fix denies it).
- Siblings unaffected: `test-bash-guard-commit` 148/0, `test-destructive-ops-guard` 74/0, `test-validation-guards` 70/0.
- `bash -n` clean on both files; the embedded Python parses via `ast.parse`.
- Every deny checked for its REASON, not just its verdict, so none passes incidentally.

**Pre-existing failure, not mine:** `test-hook-registry.sh` fails 1 of 29 ("audit exits 0 when every hook is packaged"). Identical with my changes stashed. Unrelated to this unit; worth its own look.

## Known residual risk (all pre-existing, recorded for a follow-up)

- A close synthesized with no literal close token anywhere in the command string evades the cheap bail.
- Shell state from earlier Bash calls (aliases, functions, prior `hash -p`) is invisible to a stateless hook. Note the Bash tool does not persist env or functions between calls, which narrows this in practice.
- Executors not on the `WRAPPERS` list, and generated scripts carrying no literal close token.

## Files touched
- claude/hooks/cmux-close-guard.sh (the split, the break-glass, ten bypass fixes)
- claude/hooks/test-cmux-close-guard.sh (76 -> 138 rows; new stubs, 4 new harness modes)
- .claude/memory/session_2026-07-23_cmux-close-guard-failsoft.md (this beat)

MEMORY.md intentionally NOT edited - the lead owns the index this session to avoid a concurrent-write race.
