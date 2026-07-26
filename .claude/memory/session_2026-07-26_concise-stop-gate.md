---
name: Concise-mode Stop gate (post-conclusion tangents + over-cap lists)
description: New concise-detect-stop.sh Stop hook that mechanically enforces the two concise rules the injected ruleset could not hold - the response must END at its next-action line, and five list items is a ceiling - plus the rule-text fix that closed the loophole
type: project
relates_to: [session_2026-07-26_concise-mode-feature-committed.md, session_2026-07-25_concise-mode-hook.md]
author_human: Jonah
author_model: claude-opus-4-8
machine: improv
source: session
verified: test-concise-detect-stop.sh 34/34; live hook invocation on stub transcripts (block JSON + anti-loop + skips); hook-registry-guard --audit exit 0; test-hook-registry 52/0; test-component-browser 139/0; test-settings-deploy-parity pass; codex-review (0.142.5, 2 findings folded)
confidence: high
---

Collaborator: Jonah. 2026-07-26. Built the enforcement half of concise mode: the ruleset injects and shapes STRUCTURE, but does not control VOLUME.

## Motivation - two drift modes, measured not guessed

Both were pulled from this harness's own transcripts (`~/.claude/projects/-Users-spare3-Documents-Github-improv/*.jsonl`), and both are used verbatim as test fixtures:

1. **Post-conclusion tangent.** A response answers the question, reaches its closing line, then appends a subject the user never asked about. Real openers found: "Two side notes from the same check:", "Still unconfirmed:", "Separately,", "One loose end holds up teardown". Breaks ruleset rule 4 (finish the thread before raising tangents) and rule 8 (stop when done).
2. **Item-cap saturation.** Lists land on exactly five items because five was written as a cap, and a cap reads as a target.

## What shipped

- **`claude/hooks/concise-detect-stop.sh` (new, Stop).** Reads the last assistant text from the transcript, runs two structural detections, and emits `{"decision":"block","reason":...}` naming the rule plus the offending opener or item count. Exit code is always 0; the JSON is the block signal.
  - **Tangent detection** requires all three of LEXICON (line opens with a named new-subject opener - the tunable `TANGENT_OPENER_RE` inline in the script), POSITION (the opener sits in the trailing half with 3+ non-empty lines of body ahead of it), and VOLUME (2+ sentences from the opener to the end). A single trailing sentence is a clause, not a tangent.
  - **List detection** counts the longest run of items at ONE indent level. Blank lines and deeper-indented continuations keep a run open; any line at or left of the run's indent closes it, so two 4-item lists never sum to 8.
- **`claude/hooks/concise-mandate.sh` rule text.** Rule 3 now says the response ENDS at the next-action line - nothing follows it, no appended tangents, no unasked-for status addenda (the loophole: the old rule said where to end but never that nothing may follow). Rule 4 names the openers. Rule 7 went from "cap lists at five" to "cut to what changes the reader's next move; five is a ceiling, not a target." Added one line telling the reader rules 3/4/7 are mechanically enforced. Override carve-out and the ayghri/i-have-adhd MIT attribution are intact; `--emit-body` still single-sources for the toggle (verified: "concise on" injects all 10 updated rules).
- **`claude/hooks/test-concise-detect-stop.sh` (new).** 34 assertions, hermetic (fake `$HOME`, stubbed transcripts), both directions, with mutants proving the lexicon and the counter are load-bearing.

## Why NOT a length gate (the decision that shaped the whole hook)

**Why:** a word/token-count gate false-fires on every legitimate deep dive, and this repo already paid that bill - the visual-verification gate earned four distinct false-fire classes by classifying too broadly (`session_2026-07-26_visual-gate-narrowed.md`). Verbosity is not measurable in words; the two things that ARE measurable are a named opener in a trailing block and a countable list overrun. **How:** both detections are structural and narrow, so prose that is merely long passes untouched.

## Anti-loop (a Stop hook that blocks on prose shape can deadlock a session)

Four independent layers, all of which fail toward ALLOW:
1. `stop_hook_active` - never block a stop that is already a hook continuation.
2. Once-per-burst flag `~/.claude/.concise-stop-blocked.<session>`. If it exists the hook allows no matter what it detected, and only a CLEAN stop clears it. Two blocks can never land back to back; at worst one block per violation burst. Flags older than 24h are reaped so an abandoned session cannot mute or ambush a later one.
3. Atomic claim (`set -o noclobber`) on that flag, so two concurrent Stop processes cannot both block.
4. `trap 'exit 0' EXIT` under `set -euo pipefail` - any strict-mode abort or parse failure exits 0. Since the block signal is stdout JSON and never the exit code, forcing exit 0 can only prevent a hook error, never suppress a real block.

Skips entirely when: `~/.claude/.concise-disabled` exists, the user's last prompt invoked the ruleset's own depth override (explain / go deep / verbose / walk me through / in detail / why exactly / ...), the response is predominantly code, or the judged turn is a subagent's (`isSidechain`).

## Codex cross-model review (codex-cli 0.142.5, exit 0) - 2 findings, both folded

- **[High, FOLDED] Malformed transcript lines were skipped silently, so the hook could still block off a stale response.** Blanket "any bad line aborts" was rejected - one corrupt record early would mute the gate for the rest of the session. Folded precisely: track the last unparseable line vs the last successfully parsed assistant line; a parse failure AFTER the judged response means the final response may be truncated or missing, so the hook skips. A corrupt line BEFORE a complete response still fires. Both directions are now regression-tested.
- **[Medium, FOLDED] Indented command output was miscounted as a list.** Pasted output indented 4+ spaces whose lines start with "-" reached the list counter, and the "predominantly code" skip only measured fenced blocks. Folded twice: the code ratio now counts indented blocks as well as fences, and an item-shaped line 4+ spaces in with no shallower list open is treated as an indented code block, not a list level.

## Packaging (the hook-registry-stop gate blocks a Stop on an unpackaged hook)

Joined the `grounding` cluster alongside its two siblings: `install.sh` (`cluster_hooks` list + the FILES display string 6 -> 7 grounding hooks), `claude/hooks/browser-tree.json` (`hook_owner`, `hook_desc`, grounding node tag/desc/hooks), `claude/hooks/cluster-wirings.json` (Stop registration). The wiring command string matches live `~/.claude/settings.json` exactly so install dedupes. Registered live on Stop (backup `~/.claude/settings.json.bak.20260726_194016`; diff is the 9 added lines only, no reformatting) and symlinked both new files into `~/.claude/hooks/` per the repo's per-file convention.

**Live now, no restart needed for the gate itself** - Claude Code reads `settings.json` per hook invocation, and the hook was invoked live from the registered path. The updated ruleset TEXT lands at the next SessionStart (or on the next "concise on").

## Files touched
- `claude/hooks/concise-detect-stop.sh` (new)
- `claude/hooks/test-concise-detect-stop.sh` (new)
- `claude/hooks/concise-mandate.sh` (rules 3, 4, 7 + enforcement note)
- `claude/hooks/browser-tree.json`, `claude/hooks/cluster-wirings.json`, `install.sh` (grounding cluster packaging)
- `~/.claude/settings.json` (live Stop registration) + `~/.claude/hooks/` symlinks
