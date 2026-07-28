---
name: Codex-driven hook repairs - two fail-open gates, one fail-closed gate, and four struck numbers
description: Repaired the hooks defects Codex confirmed - codex-failure-watcher's invocation regex, route-intent's mid-sentence matching, grounding-gate's exempt list in both directions, hook-registry-stop collapsing cannot-tell into clean, a zero-iteration green suite, and unguarded python3 - plus a committed reproduction harness that replaced four unreproducible headline numbers
type: project
relates_to: [session_2026-07-28_codex-vetting.md]
author_human: Jonah Cohen
author_model: claude-opus-4-5
source: session
verified: tests + mutation testing + cross-model Codex review (3 passes) + real-corpus measurement
confidence: high
---

Collaborator: Jonah. Codex designed and re-reviewed every fix, per Jonah's directive
that the Claude side does not certify its own work.

## The shape of the session

Seven defects were handed over. Six were mine to fix (install.sh prune belongs to a
sibling agent). Every fix followed the same discipline: reproduce RED first, fix,
confirm GREEN, then MUTATE the product code to prove the new assertion actually bites.
Three Codex review passes found 20 further defects, including several in my own fixes.

## 1. codex-failure-watcher.sh - fail-OPEN invocation detection

The regex claimed to require "a whole command token" but did no shell tokenization.
Measured with a new two-direction probe: **9 of 18 genuine invocation forms were
SILENT** (sudo, env, command, `$( )`, backticks, absolute and tilde paths, nohup,
`bash -c`) and a heredoc BODY mentioning codex fired. Silence is the dangerous
direction - it skips the cross-model gate with no trace.

**Why:** a raw-text separator class can never model quoting, and the two directions
fail together. **How:** replaced it with a real quote-aware shell tokenizer that finds
codex only at a COMMAND POSITION. 20 -> 59 probe cases pass.

Codex reviewed the tokenizer twice and found 16 defects across the two passes - all
fixed and all now permanent probe rows: quote-aware command substitution, arithmetic
expansion (and the substitutions inside it), arbitrary-word heredoc delimiters,
expandable heredoc bodies, here-strings fed to a shell, leading fd redirections,
`eval` joining ALL arguments, `find -exec sh -c`, `env -S`, named `coproc`, `exec -a`,
shell option operands before `-c`, recursion depth, `command -v` as a lookup, and a
shell handed a script file not executing stdin.

**The corpus caught what the probe could not.** `command -v codex` - by far the most
common way codex appears in real traffic - was a false positive I introduced and only
found by measuring against 19k real Bash calls.

## 2. route-intent.json - mid-sentence matching, relocated not fixed

Reproduced: **12 of 12 deliberation/negation prompts routed**, including both prompts
the lead reproduced by hand. A semicolon counts as a clause boundary, so ordinary
deliberating prose satisfied the imperative shape.

**How:** two structural guards. A LOOKBEHIND for negation/deliberation markers scoped
to the sentence (split on `. ! ?` and newline, never `;`), and a NOMINAL guard
rejecting a verb phrase that is the subject of a copula.

**The self-inflicted lesson:** my first draft of those 12 assertions was itself
vacuous - 8 of 12 carried both a marker AND a copula, so either guard alone kept them
green and the labels were fiction. Rewrote so each case isolates the guard it names,
and mutation-proved it: disable one guard, exactly its own group fails.

## 3. grounding-gate - broken in BOTH directions

Five defects, two per direction plus one found by measurement:
- `<system-reminder>` was never exempted at all
- a BOM/zero-width char defeated every `^\s*` anchor (later widened to all Unicode
  Cf/Zs after Codex found U+200E LRM slipping through a hand-picked list)
- `<teammate-message\b` matched `<teammate-message-example>` because `\b` ends a word
  at a hyphen - a fail-CLOSED hole that silenced a genuine prompt
- the continuation exemption keyed on the sentence alone, so any genuine question
  opening with it was silenced; now requires the structural `Summary:` section,
  verified against real transcripts
- **found by measuring, not reasoning:** a BARE `<teammate-message>` head (124 fires)
  and an injected skill body (34 fires) were never covered. 158 of 207 fires - three
  quarters of everything the gate said - were envelopes no human wrote.

Envelope fire rate: **6.28% -> 0.00%**. The remaining 49 genuine fires are real
diagnostic questions, which is the gate working.

The same envelope class was then measured in route-intent: **11 of its 22 routes were
envelopes**. Added a structural envelope exemption there too; now 0.

## 4. hook-registry-stop.sh - "cannot tell" collapsed into "clean"

`[ "$rc" = "1" ] || return 0` made every non-1 exit an empty result, and the next
branch ran `rm -f "$FLAG" "$ACKED"` on it. **An audit that could not parse silently
cleared a live block and exited 0.**

**How:** `_extra` now distinguishes 0/1/other and records unknown modes in a global
(not a command substitution, which would evaporate in a subshell). A cannot-tell never
clears. Deliberately still does NOT block on a transient torn read - the existing
suite asserts that, and blocking on transients trains people to ignore the gate. The
PERMANENT version is the loud one: a python3 that is missing *or cannot execute*
blocks once, with an ack key carrying the repo and flag contents so a new live arm
still speaks.

## 5. test-settings-wire-parity.sh - a zero-iteration green suite

`deployed = [...] if os.path.isdir(hd) else []` meant a missing hooks dir inspected
nothing, found no orphans, and printed PASS. Measured all nine selections: every one
deploys 1-8 hooks, so zero is never legitimate. Both "no directory" and "empty
directory" are now CANNOT-TELL. Codex found the same shape in the forward twin
(`test-settings-deploy-parity.sh`, a settings.json wiring no hooks) - also fixed.

## 6. install.sh prune - REPORTED, NOT TOUCHED

Owned by the sibling agent `codex-fix-installer`. Reported upward.

## 7. python3 unguarded

The watcher now warns (never silently passes) when python3 is missing, but only on a
payload mentioning codex, so it stays quiet on unrelated Bash calls. The registry
guard returns its contract's exit 3 rather than leaking 127. Five suites gained a
fatal python3 guard - a suite that skips silently and prints green is worse than no
suite. mktemp failures made fatal before the variable is used.

## The finding with the longest reach: four unreproducible numbers

**Decision: built the harness, and struck the half that is not mechanically derivable.**

`claude/hooks/_tests/measure-hook-corpus.py` walks `~/.claude/projects` (4021 prompts,
19.5k Bash calls), splits prompts by a predicate committed in the file where it can be
argued with, and prints fire rates per class.

**Why this split rather than all-or-nothing:** fire counts and the envelope/genuine
split are mechanical and re-runnable. Precision, recall, and "that fire was false" are
JUDGMENTS - they need a labelled set that was never committed, and the labels came
from the same agent that chose them. So the harness measures what it can measure and
prints the actual fires for a human to judge, explicitly refusing to auto-label. The
`0% -> 22.2% recall` and `3 fires, 1 false` claims are struck; the envelope rates are
now re-derivable.

**It immediately earned its keep**, finding three defects that reasoning had missed:
the `command -v` false positive, the bare `<teammate-message>` envelope, and
route-intent spending half its output on envelopes.

Codex then reviewed the harness itself and found it could report a vacuous number:
hook crashes counted as silence, an empty denominator printed `n/a` and exited 0, and
ambient env vars leaked in. All fixed - a broken hook now exits 2 with
"MEASUREMENT INVALID" rather than printing a confident zero.

## Wrapper exit codes

Five `codex-review.py` calls, all **exit 0** (real verdict): 368s, 240s, 118s, 197s,
396s. No wedge - splitting into tight per-unit diffs was what avoided the 420s hang
seen earlier in the session.

## A SYMLINKED HOOK HAS NO STAGING AREA (the most durable lesson here)

Mid-rewrite, this file was saved in a state where `bash -n` failed. Because
`~/.claude/hooks/codex-failure-watcher.sh` is a SYMLINK into the repo and the hook runs
on PostToolUse Bash, the broken file was in production the instant it was saved: every
Bash call in every session on this machine started failing. Three sibling agents hit it
independently and all three correctly refused to touch someone else's file.

Root cause: a literal apostrophe inside `(['"]?)` closed a single-quoted
`python3 -c '` block 184 lines early. The durable immunization is a QUOTED heredoc
(`python3 <<'PYEOF'`), whose body is opaque to the shell, so no apostrophe in the
python source can ever terminate it. That is what the file uses now.

**The second-order damage is worse than the outage and is why this needs a gate.** A
syntactically broken hook emits an IDENTICAL shell error for every input (measured: 165
bytes, rc=2, for all ten probe cases). Any probe that reads "produced output" or
"non-zero rc" as a fire therefore sees a 100% fire rate in BOTH directions. A broken
hook does not merely stop working; it actively manufactures wrong efficacy numbers.

**Corrected attribution, from the lead directly.** I hypothesised that their report of
three false positives came from measuring inside the broken window. That was wrong, and
the real cause is a better lesson: their probe tested for NON-EMPTY OUTPUT, and this
hook correctly prints `{}` when it has no finding. So every case read as FIRING and they
nearly reported a catastrophic regression; a control they almost skipped caught it.
Two independent instruments (mine, theirs) both produced a 100% fire rate in both
directions from different causes, neither of which was the classifier. The general rule:
a probe must assert the SHAPE of a positive result, never merely that bytes appeared -
`{}`, a shell error, and a real finding are all "output". My own probe distinguishes
FIRE / SILENT / INERT as three states for exactly this reason, and that turned out to
be the load-bearing detail.

**The gate that was missing:** hook-registry-guard.sh checked whether a hook was
PACKAGED but never whether it PARSED. It now runs `bash -n` (and `ast.parse` for `.py`)
on every write under claude/hooks/, before any other check, covering tests and libs
too, and blocks with exit 2 naming the defect, the symlink urgency, and the heredoc
fix. Six regression rows, mutation-proved.

Working rule when rewriting a symlinked hook: edit a scratch copy and `mv` it into
place once it parses, so a partial edit is never live.

## Self-analysis

Two failures worth recording.

**I wrote vacuous assertions while fixing vacuous assertions.** 8 of my 12 new
route-intent cases were double-covered. The failure mode: I wrote adversarial prompts
that felt strong, then labelled them by which guard I had in mind rather than by which
guard actually caught them. The fix is mechanical, not attitudinal - mutate each guard
and see which rows fall.

**I broke the machine for three other agents.** I saved a mid-rewrite of a hook that
is symlinked live, with no syntax check anywhere in the loop. The failure mode was not
"my edit was wrong" - it was that I treated a live symlinked hook as if it had a
staging area. Every edit to one is a deploy. The gate now exists so the next person
cannot repeat it, but the habit (scratch copy, mv when it parses) is the real fix.

**A patch script silently discarded a fix.** My multi-edit script wrote the file only
at the end, so an assertion failure mid-script threw away the edits that had already
succeeded, and it reported "ok" for the lost one. The sentence-window fix vanished
and only the test caught it. Any batch editor must write incrementally or verify after
writing; "ok" printed before the write is not evidence.

## Files touched

- claude/hooks/codex-failure-watcher.sh (tokenizer rewrite, python3/mktemp guards)
- claude/hooks/route-intent.sh, route-intent.json (suppression guards, envelope exempt)
- claude/hooks/grounding-gate.sh, grounding-intent.json (exempt both directions)
- claude/hooks/hook-registry-stop.sh, hook-registry-guard.sh (cannot-tell, python3)
- claude/hooks/_tests/measure-hook-corpus.py (new - reproduction harness)
- claude/hooks/_tests/probe-codex-invoke.sh (new - two-direction invocation probe)
- claude/hooks/test-codex-failure-watcher.sh (17 -> 21, plus the 59-case probe)
- claude/hooks/test-route-intent.sh (91 -> 120)
- claude/hooks/test-grounding-guard.sh (20 -> 32)
- claude/hooks/test-hook-registry.sh (52 -> 67)
- claude/hooks/test-settings-wire-parity.sh, test-settings-deploy-parity.sh,
  test-hook-data-parity.sh (zero-iteration, python3, mktemp)
