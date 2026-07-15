---
name: U7b - three harness false-positives closed (memory-nudge install-substring, read-only memory clear, verify-before-done repo-source), gate invariant intact
description: Unit 7b of the parallel-dispatch plan - removed 3 Wave-1 harness false-positives in memory-nudge.sh/verify-before-done.sh without weakening the memory-dirty commit gate; two Codex rounds folded; four-part invariant test added
type: project
relates_to: [session_2026-07-14_parallel-dispatch-plan.md, feedback_hooks_prefer_false_positives.md]
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: tests + codex-review (3 rounds, final GO no findings)
confidence: high
---

Executed U7b in worktree improv-wt/u7b (branch w2-u7b, base a54cb63b, the post-Wave-1 merge). Closed the three Wave-1 harness false-positives with the memory-dirty gate's real purpose intact. bash-guard.sh was NOT modified - its commit gate was already correct; only the flag SETTER (memory-nudge) and the verify ARMER (verify-before-done) held the bugs.

## Changes

- memory-nudge.sh issue 1 (install substring): the write-token list carried the bare substring `install`, so `bash install.sh`, `./install.sh`, `bash claude/hooks/test-install-hook-deploy.sh`, and `npm uninstall x` all false-dirtied (blocked U1's commit 3x in Wave 1). Replaced it with an anchored COMMAND-POSITION regex over `_segments`: `^\s*(VAR=)*((\S*/)?wrapper (-flags)(VAR=))*(\S*/)?install\s`. Real installs (bare, sudo, path-qualified `/usr/bin/install`, `./bin/install`, post-`&&`, `VAR= install`, `env FOO=bar install`, `/usr/bin/env install`) still dirty; the install-NAME mentions and argument-position `install` (`npm help install topic`) do not.
- memory-nudge.sh issue 2 (cp-a-beat clears + re-dirty race): the unquoted `cp` into `.claude/memory/` already cleared via the existing is_memory path; the re-dirty race was the SAME install-substring bug (a post-beat `bash test-install-hook-deploy.sh` re-dirtied). Fixed by issue 1. Added the four-part invariant test.
- verify-before-done.sh issue 3 (repo-source exemption): `EXEMPT_PATHS` only listed the dotfiles deploy dir `.claude/hooks/`, so a worktree edit to repo-source `claude/hooks/*.sh` armed CODE FILE CHANGED. Added a path-segment-anchored `_HOOK_DIR_RE = (^|/)\.?claude/hooks/`, scoped to NON-visual files.

## Codex review (produce-and-verify, 3 rounds)

- Round 1 -> 4 findings, all folded: (1) install over-matched as an argument; (2) install under-matched path-qualified forms (DANGEROUS false-clean) -> switched to command-position matching; (3) `claude/hooks/` bare substring over-exempted `src/myclaude/hooks/App.tsx` -> anchored segment regex; (4) test-memory-nudge.sh claimed HOME isolation but used real `$HOME` -> now runs every hook under `HOME=$TMPHOME`.
- Round 2 -> 3 findings, all folded: (1) HIGH - a read-only memory command (`ls/grep/cat .claude/memory`) cleared a legitimately-dirty flag (false-clean) -> gated the clear on `is_memory and is_write`, which also matches issue 2 as written ("a WRITE into .claude/memory clears"); (2) install still under-matched wrapper operands -> allowed path-qualified wrappers + env VAR= operands; (3) hook exemption still exempted a real UI file under a nested `claude/hooks/` segment -> scoped the exemption to non-visual files so `src/claude/hooks/App.tsx` still arms.
- Round 3 -> No findings. Four-part invariant confirmed intact, no regex backtracking, no regression.

## Invariant (HARD, verified by test-memory-dirty-invariant.sh, 25/25)

1. a REAL project write still dirties memory; 2. a recognized Bash WRITE INTO .claude/memory/ clears; 3. a read-only/diagnostic command NEVER re-dirties AND never false-clears after a beat write; 4. a real `git commit` while dirty STILL blocks (bash-guard, unchanged). It did NOT become possible to commit real project changes without a beat.

## Accepted residuals (flagged for the lead, NOT fixed - would need bash-guard's arg parser)

- Wrapper VALUE-flag that eats the next word (`sudo -u root install`, `timeout -s TERM 5 install`) is not detected as an install write. Low-risk: such forms target system dirs, not project files. Pinned as a KNOWN GAP test.
- A single compound that writes a NON-memory file AND names a memory path in the same segment (`sed -i s/a/b/ src/app.ts && cp x .claude/memory/y`) still clears - separating write TARGETS from mentions needs target parsing. Pre-existing; not made worse.

## Self-analysis (per protocol)

Failure: I broke the shell quoting by writing a possessive apostrophe (`segment's`) inside a python COMMENT that lives within the `python3 -c '...'` single-quoted block - `bash -n` caught `syntax error near unexpected token )`. The file DOCUMENTS this exact hazard at line 89 ("a literal single-quote here would terminate that string"); I read it earlier but did not apply it to my own prose. Root cause: treated comment text as free-form English without re-checking the shell-quoting constraint that governs the whole heredoc-style block. Rule for next time: any text added inside a `python3 -c '...'` block - code OR comments - must be apostrophe-free.

## Verification

- test-memory-nudge.sh 52/52, test-verify-before-done.sh 93/93, test-memory-dirty-invariant.sh 25/25 (NEW).
- Regression green: test-nudge-debounce, test-consolidate-nudge, test-verify-visual-gate, test-bash-guard-commit (146), test-validation-guards, test-destructive-ops-guard, test_classifier_parity.
- Codex round 3: no findings.

## Files touched (owned)
- claude/hooks/memory-nudge.sh
- claude/hooks/verify-before-done.sh
- claude/hooks/test-memory-nudge.sh
- claude/hooks/test-verify-before-done.sh
- claude/hooks/test-memory-dirty-invariant.sh (new)

Suggested MEMORY.md index line (lead to integrate serially - this unit did not edit the index per the plan):
- [U7b: 3 Wave-1 harness false-positives closed (memory-nudge install-substring + read-only memory false-clear; verify-before-done repo-source `claude/hooks/` exemption) WITHOUT weakening the memory-dirty gate; command-position install match, visual-scoped hook exemption; four-part invariant test; 3 Codex rounds folded (final GO) - PROJECT (2026-07-15)](session_2026-07-15_u7b-harness-false-positives.md)
