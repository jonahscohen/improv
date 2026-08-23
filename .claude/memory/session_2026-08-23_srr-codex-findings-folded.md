---
name: Scheduled-research runner - 4 Codex findings folded + hardened
description: Folded 4 CONFIRMED Codex findings into the shared scheduled-research runner (claude/hooks/lib/scheduled-research-run.sh) - unambiguous pre-check run/skip contract, cursor rollback on failed advance, normal-path process-group reap, DRY_RUN doc fix - plus a unified pre-flow cursor snapshot that closed a second Codex-review round (best-effort rollback + flow-writes-cursor). Suite 45 -> 75 assertions green.
type: project
relates_to: [session_2026-08-23_scheduled-research-runner-built.md, session_2026-08-23_learning-researcher-framework-plan.md]
author_human: Jonah
author_model: claude-opus-4.8
machine: spare3
source: session
verified: tests - test-scheduled-research-run.sh 78/78 green; bash -n clean; observed fixed behavior for all findings; Codex cross-model review + independent Claude reviewer (its 2 Low temp-leak findings folded)
confidence: high
---

# Scheduled-research runner: 4 Codex findings folded and hardened

Collaborator: Jonah. Executor teammate on the team-lead's spec. Scope limited to the two files
`claude/hooks/lib/scheduled-research-run.sh` (runner) and `claude/hooks/test-scheduled-research-run.sh`
(contract test). The runner is the safety-critical spine for UNATTENDED scheduled learning-researchers:
it must ONLY discover+propose and advance its cursor ONLY on complete success.

## The 4 findings folded (each with a regression test)

1. **Broken pre-check silently skipped forever (High).** Old contract: exit 0 = run, exit 1 = skip,
   exit >=2 = error. A masked failure (missing command in a pipeline) exits 1 -> read as "skip" ->
   runner no-op'd forever with no alarm. **Fix:** the pre-check now prints an explicit decision on
   STDOUT ("run"/"skip") and MUST exit 0; ANY non-zero exit = the gate broke = die 2; exit 0 with no
   run/skip decision = die 2. Skip is now an unambiguous positive statement, so a broken gate can
   never masquerade as it. Decision parsed as the last non-blank stdout line
   (`grep -v blank | tail -n1 | tr -d space`).
   Why not force `set -o pipefail` on the pre-check: it would regress legitimate `| head` / `grep -q`
   pre-checks and does not even catch a gate that catches its own error and prints "skip" - that
   residual is the pre-check author's responsibility (documented in the SRR_PRECHECK_CMD contract).

2. **Cursor advanced on a failed run via SRR_ADVANCE_CMD (High).** An advance-cmd that partial-wrote
   the cursor then exited non-zero left the cursor changed -> next run saw it current, skipped, a
   cycle lost. **Fix:** rollback to the exact pre-run content+mtime (or delete if it did not exist).

3. **Watchdog leaked an orphan on normal completion (High).** A flow that backgrounded a
   TERM-ignoring descendant and exited 0 left the descendant alive: the watchdog only cleaned up on
   the TIMEOUT path. **Fix:** `reap_group()` group-kills the flow's process group on the NORMAL
   (non-timeout) path too, TERM -> bounded poll (GRACE_SECS) -> KILL, guarded by `_HAVE_PERL` (without
   perl the flow shares the runner's own group; signalling it would be suicide, so skip).

4. **DRY_RUN claim overstated (Low).** DRY_RUN does run the pre-check. **Fix:** corrected the header
   doc (DRY_RUN runs the gate; only the flow and cursor-advance are skipped) rather than skipping the
   pre-check, because the gate-open test relies on observing the gate under DRY_RUN.

Plus a doc note: the runner does NOT force cursor/log/temp paths out of the repo, so job wrappers
MUST set SRR_CURSOR_FILE / SRR_LOG_FILE under $HOME/.claude, never inside the repo tree.

## Cross-model review (Codex) folded a second layer

`codex exec --sandbox read-only` (codex-cli 0.142.5, a different MODEL) reviewed the diff and surfaced:
- **High:** my finding-2 rollback was best-effort - `TMPDIR=/dev/null` made the mktemp snapshot fail,
  and the `|| true` restore then left the cursor corrupt.
- **Medium:** a misbehaving FLOW that writes the cursor itself then fails was not rolled back (a second
  vector against "advance only on complete success").
- **Low:** stale "pre-check exit 1" wording still in the exit-0 doc and a test comment.

**Fold (decision - unify, do not special-case):** replaced the advance-only snapshot with a UNIFIED
cursor-integrity lifecycle - `snapshot_cursor` runs ONCE after `cd "$REPO_ROOT"` and BEFORE the flow;
`restore_cursor` rolls back on EVERY non-success outcome (timeout/flow-fail/no-produce/advance-fail/
touch-fail); `discard_cursor_snapshot` only on full success. The snapshot is verified with `cmp -s`,
falls back to a sibling `${CURSOR_FILE}.srrsnap.$$` when the temp dir is unusable, and die 6 BEFORE
anything mutable if a present cursor cannot be snapshotted anywhere. This closed the High + Medium in
one coherent change and strengthened the tool's headline guarantee. Stale docs fixed.
- **Medium (concurrency) NOT folded, by decision:** Codex noted two concurrent runs of the same job
  could clobber each other's cursor. launchd coalesces same-label runs, and a lock risks a
  stale-lock-forever-skip (the exact class finding 1 fixes); macOS also lacks `flock`. Documented the
  single-instance assumption in the header instead of adding a lock. Flagged to the lead.

## Second review pass (independent Claude reviewer) - 2 Low temp-leaks folded
The round-2 Codex process wedged (buffered 14 min, 0 output - killed; likely stuck on a pencil MCP
child it spawned). Ran the sanctioned fallback: a fresh independent reviewer (feature-dev:code-reviewer,
NOT the producer) on the new snapshot lifecycle. It found NO High/Med correctness bugs - all four core
guarantees hold (pre-check gate, cursor-integrity, reap_group, bash-3.2/set-u all clean) - and two Low
temp-file leaks, both folded:
- **2a:** `RUN_TMP` could be orphaned if a `die` fired between its creation and the outcome-section
  cleanup (the real path: `cd "$REPO_ROOT"` failing after the `-d` check). Fix: moved `cd` +
  `snapshot_cursor` to BEFORE the `RUN_TMP` block, so those die paths precede temp creation.
- **2b:** the sibling-fallback snapshot (and the mktemp temp on fallback) could be left behind on a
  cp-then-cmp-fail. Fix: `rm -f` the intermediate snapshot before falling back / before dying.
Added 3 regression assertions (no sibling snapshot left after a broken-TMPDIR rollback; a cd-failure
dies 2 with no orphaned run temp - guarded to skip as root / where the platform allows cd into 0000).
Suite is now 78/78.

## Verification (proven, not claimed)
- `bash -n` clean on both files.
- Full contract suite: **78 passed, 0 failed** (the original 45 assertions + 33 new). Existing pre-check
  inputs updated to the new run/skip contract; all 45 behavioral assertions preserved.
- Observed fixed behavior captured for all findings: broken-precheck -> exit 2 (flow not run, cursor
  not created); advance partial-write+fail -> exit 6 (content=ORIG-1.0.0, mtime=1577854800 unchanged);
  TERM-ignoring survivor dead after exit-0 flow; broken-TMPDIR advance-fail -> exit 6 (cursor rolled
  back, no leftover snapshot); flow-writes-cursor+exit 7 -> exit 4 (cursor rolled back).

## Files touched
- `claude/hooks/lib/scheduled-research-run.sh` - pre-check contract, unified cursor snapshot/restore,
  reap_group, hoisted cd, header/exit-code docs.
- `claude/hooks/test-scheduled-research-run.sh` - existing pre-checks moved to the new contract; new
  scenarios PRECHECK-CONTRACT, ADVANCE-ROLLBACK (+ broken-TMPDIR), FLOW-WRITES-CURSOR, NORMAL-REAP,
  DRY_RUN-PRECHECK; stale comments fixed.
