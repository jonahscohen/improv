---
name: Codex vet of the hooks wave
description: Independent Codex review of the 2026-07-28 hooks work; 4 of 5 claims disputed, two fail-open gates confirmed by execution
type: project
author_human: Jonah
author_model: claude-opus-4.8
source: session
verified: codex-review + live hook execution
confidence: high
---

Ran six real-Codex passes over the hooks changed since `e42b9a57` using
`~/.claude/hooks/codex-review.py` (prompt positional, diff on stdin). Codex's
verdict is the deliverable; the Claude side's self-assessment was not trusted.

Wrapper exit codes: A grounding 0 (173.6s), B watcher+teams-guard 0 (412.6s),
C route-intent combined **3 WEDGED** at 420s, C1 route-intent.json retry 0
(54.7s), C2 test-route-intent.sh retry 0 (244.1s), D registry+parity 0 (298.4s),
E prune 0 (235.2s). The wedge was handled by splitting C into two tighter diffs
and re-running, not by downgrading to a same-model review.

Claim verdicts: 1 grounding-gate UNVERIFIABLE, 2 codex-failure-watcher DISPUTED,
3 agent-teams-guard DISPUTED, 4 route-intent DISPUTED, 5 symlink prune DISPUTED.
None verified as stated.

Confirmed by executing the hooks, not by reading them:

- `codex-failure-watcher.sh:55` regressed in BOTH directions. 8 of 9 real codex
  invocations now go silent (`sudo codex`, `env FOO=1 codex`, `command codex`,
  `codex>/tmp/out`, `codex|tee`, `codex&&`, `(codex exec)`, `$(codex exec)`),
  while 5 of 6 non-invocations still fire (quoted pipe, quoted semicolon,
  `grep -E "beats|codex exec"`, heredoc, comment). The only case the fix
  actually repaired is the exact string quoted in its own commit message.
- `route-intent.json` still matches mid-sentence. 10 of 12 deliberation and
  negation prompts route, including "Do NOT proceed; refactor the router is
  exactly what we must avoid." This is the same false-positive class that forced
  a revert earlier in the session.
- `grounding-gate.sh` leaks a `<system-reminder>` envelope (fires) and a
  BOM-prefixed `<task-notification>` (fires), while suppressing a genuine
  question that opens with the canonical continuation sentence, and suppressing
  `<teammate-message-example>` because `\b` ends a word at a hyphen. The
  `<task-notification>` pattern is tight; the `<teammate-message` one is not,
  and only the tight one has a test.

Why: measurement discipline. Every number in the commit message ("9.83%",
"33.3%", "22.2% recall", "4000 real Bash calls") is prose in a comment. No
corpus, no labels, no reproduction script is committed anywhere, so all four are
self-graded and unverifiable from the tree.

How: split the diff into six focused batches rather than one 286KB blob, quoted
each claim verbatim into its prompt, and asked Codex to attack it. Then executed
the hooks against Codex's concrete failing inputs to separate confirmed defects
from speculation.

Self-analysis - a failure I caught mid-flight: my first calibration run of
route-intent reported only 1 of 8 prompts routing, which would have wrongly
softened Codex's CRITICAL to a near-miss. The cause was `route-intent.sh`
carrying a 900s cooldown in `~/.claude/.route-intent-cooldown`; the first prompt
armed it and silenced the other seven. I had assumed the hook was stateless
because the grounding hook's tests redirect its state and I had already read
that harness. Re-ran with `ROUTE_INTENT_COOLDOWN_FILE` redirected and cleared
between every prompt, and the real number is 10 of 12. Lesson: when probing a
hook by execution, isolate its state files first, before the first invocation,
not after a result looks surprising. The uncontrolled run also wrote to the real
cooldown file; cleared it afterward.

Files touched: none in the repo. Review artifacts under /tmp/codexrev/.
