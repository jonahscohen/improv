---
name: Live-firing audit of every wired hook - measured on real traffic, not on the suite
description: Drove all 71 wired hook scripts with real payloads and 1902 real prompts / 386 real stop points mined from transcripts. Found and fixed an inverted signal in grounding-gate (fired 9.83% on agent envelopes vs 1.94% on genuine prompts, now 0% vs 1.94% with zero collateral). Also measured and fixed codex-failure-watcher over-firing (33.3% of its fires were false on 4000 real Bash calls, now 0%) and gave it its first test suite. Found a dangling deployed companion and one wired-but-undeployed hook. Four of my own measurement artifacts caught and corrected before they became findings.
type: project
relates_to: [session_2026-07-27_route-intent-live-efficacy.md, session_2026-07-27_installer-coverage-audit.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: 1902-prompt live-hook corpus, 4000 real Bash tool_use/tool_result pairs, 386 real stop points, 70-point target population, state-primed negative controls, two-direction mutation proofs, two Codex reviews (10 findings folded), test-grounding-guard 20/0 + new test-codex-failure-watcher 17/0 + 10 other suites green
confidence: high
---

# Are our hooks actually firing, correctly, on real traffic?

Collaborator: Jonah. The question was not "is the suite green" - yesterday's
route-intent beat established that a green suite says nothing about live
behaviour. This audit drove the DEPLOYED hooks with real traffic.

## Verification baseline (Team Rule 9, probed BEFORE any change)

At HEAD `4b8d5bb2`: test-hook-registry **52/0**, test-route-intent **all pass**,
test-chrome-tabgroup **20/0**, test-sidecoach-detect **38/0**,
test-concise-detect-stop **34/0**, test-memory-nudge **52/0**,
test-consolidate-nudge / test-multiple-choice-enforce / test-grounding-guard
**all pass**. A real baseline exists.

**The baseline itself produced the session's first false result.** The first run
reported exit 127 on all 13 suites. `timeout` does not exist on this machine
(no GNU coreutils). A perl-based wrapper replaced it and was negative-controlled
(preserves exit 3; returns 124 on a real timeout) before being trusted.

## Roster, built from the SETTINGS files

97 wired hook entries -> **71 distinct hook scripts** + 10 non-script entries
(9 nyx bridge calls, present; 1 inline echo, 1 inline printf).

| reconciliation | result |
|---|---|
| wired but missing from `~/.claude/hooks` | 4, all resolved - project-scoped hooks wired via `$CLAUDE_PROJECT_DIR`, correct by design |
| wired but absent from repo | none |
| on disk, not wired | 7, all accounted for (libraries, twins, or component-gated) |
| **`model-router-guard.sh`** | in repo + registered in `cluster-wirings.json`, **not deployed** (`exit 127`), not in live settings |
| **`~/.claude/hooks/sidecoach-modes.json`** | **dangling symlink** to a retired registry deleted from the repo |

## Does each hook RUN? (82 hook/event probes, real payload shapes)

50 spoke, 32 silent-exit-0, 0 errors. Every probe ran in its **own freshly
created sandbox HOME**, which defeats the cooldown trap generically: cooldowns
resolve through `expanduser("~/...")`, so a HOME with no state files cannot be
silenced by a previous probe.

`bash-guard.sh` and `agent-teams-guard.sh` first measured as 25s TIMEOUTs. That
was **CPU contention with a concurrent baseline run, not a defect**: re-probed
idle they return rc=0 in 0.49s / 0.21s, and latency is flat from 0.1MB to 121MB
of transcript. Reporting that as a hot-path perf bug would have been wrong.

## Does it fire when it should, and stay quiet when it should not?

Corpus: **1902 unique human prompts** from 258 transcripts, split as the
route-intent audit did into **671 genuine lead-session prompts** and **1231
agent/system envelopes** (teammate relays, task notifications, continuation
summaries). The split is what makes an inverted signal visible.

| hook | genuine (671) | envelopes (1231) | read |
|---|---|---|---|
| sidecoach-keyword | 11.62% | 1.54% | healthy, right direction |
| **grounding-gate (before)** | **1.94%** | **9.83%** | **inverted - 5x louder where it must be silent** |
| **grounding-gate (after)** | **1.94%** | **0.00%** | fixed, zero collateral |
| route-intent | 1.04% | 0.24% | healthy (post-fix state from 2026-07-27 holds) |
| task-loop-mandate | 100% | 100% | unconditional per-turn injection by design |
| justify-queue-mandate | 100% | 100% | unconditional per-turn injection by design |

Stop family, replayed against **386 real historical stop points** (real
transcripts truncated at genuine assistant-response boundaries):
concise-detect-stop 3.11%, multiple-choice-detect-stop 2.33%,
content-guard-stop 2.07%, teammate-relay-stop 0.26%, eight others 0% and
state-gated.

### The one real defect, and its fix

`grounding-gate.sh` had no envelope exemption. A teammate relay and a task
notification arrive on UserPromptSubmit exactly like a user prompt and carry
diagnostic prose ("HALTED: second agent is doing this exact unit live"), so the
lexicon matched them. Measured: **121 of 1231 envelopes fired** versus 13 of 671
genuine prompts.

**Why this shape of fix:** it mirrors route-intent's `exempt` list precedent
rather than inventing a second mechanism. **How:** three head-anchored patterns
in `grounding-intent.json`, matched against the **RAW** prompt because
`sanitize()` strips `<...>` tags and would erase the `<task-notification>`
marker before it could be seen. The three heads cover **1231 of 1231** envelopes
in the corpus; no unmeasured markers were added, per the route-intent rule
against improvising tokens.

Result: envelope fires **121 -> 0**, genuine fires **13 -> 13**, and a
before/after set comparison confirms **no genuine fire was lost or gained**.

### Codex review (codex-cli 0.142.5) - 4 findings, all folded

1. **`exempt` was not validated as a list.** A JSON typo turning it into a STRING
   would iterate CHARACTERS, and the first one (`^`) matches every prompt -
   taking the gate to zero recall silently. Now guarded by `isinstance(list)`,
   with a suite row that builds a deliberately malformed lexicon and asserts the
   gate still arms (fails OPEN).
2. **The first patterns were over-broad.** Codex demonstrated three genuine
   prompts they silenced, e.g. `Another Claude session sent a message saying ...
   why is the changes panel not showing?`. Each pattern now requires the
   STRUCTURAL marker - the literal `<teammate-message` tag, the
   `<task-notification` element, the canonical `ran out of context.` phrase -
   not the opening prose. Re-measured: still **1231 of 1231** envelope coverage,
   and all three of Codex's prompts arm correctly again.
3. **"Fresh HOME per probe" is not a hook-WIDE isolation claim.** It is exact for
   hooks whose state resolves through `~`, but `figma-fidelity-arm.sh` writes
   repo-root `.figma-fidelity.*`, `beats-rebuild.sh` writes `beats/.build` and
   spawns a detached compiler, and `node-path-default.sh` appends to
   `$CLAUDE_ENV_FILE`. Recorded as a scope limit on the method. Checked
   afterwards: no `.figma-fidelity.*` strays were left in the tree.
4. **The tests proved suppression but not tightness**, and the BODY control
   checked only the arm file, not the nudge. Both fixed.

Mutation-proved in BOTH directions: removing `exempt` turns the 3 envelope rows
red; loosening the patterns back to prose-only heads turns the 3 tightness rows
red. Suite **11/0 -> 20/0**.

## The mirror-image defect: codex-failure-watcher over-fires (handed over live, then measured)

The lead observed this in production and handed it over: the watcher nudged on a
Bash call whose OUTPUT merely contained "at capacity". It is the inverse of the
hunt - a hook that fires on content it only READ - and it matters for the same
reason, because a hook that cries wolf on ordinary greps gets mentally filtered
out, which is functionally identical to being dead.

**Population, mined correctly.** 4000 real Bash calls, built by PARSING
`tool_use` blocks and pairing each with its `tool_result` by `tool_use_id` -
never by grepping transcripts, which counts mentions rather than invocations
(the inflation the beats-search unit hit). 61 of the 4000 genuinely invoke codex.

| | fires / 4000 | true | false |
|---|---|---|---|
| before | 3 (0.07%) | 2 | **1 = 33.3% of all fires** |
| after | 2 (0.05%) | 2 | **0** |

**Root cause, reproduced verbatim from real traffic:**
`grep -n "codex-rescue-guard\|codex-failure-watcher" claude/settings.json`.
Two flaws compounded: `|` is in the hook's separator class, and a BRE `\|`
inside a QUOTED argument is not a shell pipe; and `codex\b` ends a word at a
HYPHEN, so `codex-failure-watcher` read as the codex CLI. The 2026-06-25 beat
filed this over-fire class and the fix then applied dropped `(` from the
separator set but kept `|`, so the class survived 33 days.

**Why the token fix over the quote fix.** My first attempt blanked quoted spans
before matching. It killed the false positive, and Codex proved it also
REGRESSED `OPENAI_API_KEY="$K" codex exec` into a false NEGATIVE - the dangerous
direction, because a missed capacity failure silently skips the cross-model
gate. **How:** requiring `codex(?=\s|$)` - a whole command token - fixes the
same false positive at its root with no shell-quote parsing at all. Verified
byte-identical to the pristine hook on every pre-existing limit (command
substitution, `bash -c`, heredoc, backticks), so it introduces no regression.
The quote-blanking attempt was discarded entirely.

`test-codex-failure-watcher.sh` is **new - the hook had ZERO behavioural
coverage**, which is precisely why the same over-fire class survived from June.
17 assertions, mutation-proved (reverting the token boundary turns exactly the
two over-fire rows red).

**Residual, needs a design call, deliberately not patched:** a REAL codex
invocation whose review TEXT quotes the phrase still trips it - this beat's own
Codex review did exactly that, live, because the review discussed "model is at
capacity" as test data. Distinguishing codex's failure output from codex's prose
about failures is not a lexicon problem, and every tightening I could see risks
the false-negative direction. Flagged, not fixed.

## Runtime companions - differential, not assumed

Each companion was tested by running the hook against a full COPY of the deployed
hooks directory with and without that file, so script-relative resolution sees
the deletion (a hook run out of tree against the real directory reports a fake
pass).

| companion | deployed | with | without | verdict |
|---|---|---|---|---|
| route-intent.json | yes | 287 B | 0 | load-bearing |
| grounding-intent.json | yes | 573 B | 0 | load-bearing (matches the 573 B measured 2026-07-27) |
| sidecoach-intent.json | yes | 1337 B | 0 | load-bearing |
| sidecoach-verbs.json | yes | 167 B | 0 | load-bearing |
| sidecoach-lanes.json | yes | 167 B | 167 B | not load-bearing on this path (legacy verb tier covers it) |
| consolidate-intent.json | yes | 2 B | 2 B | not load-bearing - confirms the 2026-07-27 read that it is latent risk, not live defect |

`hook_data_files()` covers 3 of the 6 runtime companions; the three sidecoach
registries plus `sidecoach_lanes.py` deploy through a separate sidecoach loop in
install.sh. Both mechanisms work today, but the coverage claim is split across
two places.

## Four measurement artifacts I caught in my own harness

This is the useful part of the record, because each one would have shipped as a
confident false finding.

1. **`timeout` missing** - 13 suites "failed" with exit 127. Fixed with a
   negative-controlled perl wrapper.
2. **A `/sidecoach ...` probe reported the verb tier DEAD.** A literal slash
   command is expanded by Claude Code before any hook sees it, so the hook
   ignores it by design. On the real shape (`polish the pricing page`) it fires.
   Authored input, exactly the trap the route-intent beat names.
3. **Scoring Stop hooks on stdout reported 0% for healthy detectors.**
   `multiple-choice-detect-stop.sh` is a DETECTOR: on a hit it arms
   `~/.claude/.multiple-choice-violation.<session>` and exits 0 with EMPTY
   stdout; the visible half is `multiple-choice-inject-prompt.sh` on the next
   turn. Re-measured on the signal it actually emits, the pair is healthy:
   **64.29% recall on 70 stop points where the assistant ended by asking the
   user something, 1.04% on 289 statement-ending stop points, and the injector
   spoke on 100% of armed cases**. The first framing would have reported the
   repo's question-asking enforcer as dead.
4. **"Any new file counts as an action" scored everything 100%** - the sandbox's
   own `settings.json` symlink was being counted, because I skipped symlinked
   dirs but not symlinked files.

Two of my three first-draft regression assertions were also **vacuous**: the
mutation (removing `exempt`) turned only 1 of 3 red, because the truncated
envelope heads never matched the lexicon in the first place. Rebuilt as a
verbatim real envelope head + a body proven to arm on its own, plus a control
asserting the body arms alone. All three now go red under mutation; suite
**11/0 -> 16/0**.

## Self-analysis

The failure mode I hit four times is one thing: **I kept inventing the success
criterion instead of deriving it from the hook.** Silence on stdout, a file
appearing, a slash-prefixed prompt - each was my assumption about what "firing"
looks like, and each was wrong for a hook whose contract I had not read first.
The route-intent beat warned about authored INPUTS; the generalisation this
session adds is that the authored OUTPUT expectation is just as dangerous,
because it fails in the confident direction - it reports a working hook as dead.

The rule to carry: **before measuring a detector, read what it emits on a hit.**
If it writes state rather than stdout, measure the state. A fire-rate number is
only meaningful once the fire signal is the one the hook actually produces.

The second lesson repeats 2026-07-27's: when a control row looks wrong, suspect
the harness before the subject. Every one of the four artifacts announced itself
as an implausibly extreme number (0%, 100%, all-127) and every one was mine.

## Files touched

- `claude/hooks/grounding-gate.sh` - raw-prompt envelope exemption check
- `claude/hooks/grounding-intent.json` - `exempt` list (3 measured patterns) + `_meta.envelope_exemption`
- `claude/hooks/test-grounding-guard.sh` - 9 assertions (3 envelope, 3 tightness, 1 head-anchor, 1 non-vacuity control, 1 malformed-lexicon fail-open), mutation-proved both directions
- `claude/hooks/codex-failure-watcher.sh` - codex must be a whole command token
- `claude/hooks/test-codex-failure-watcher.sh` - NEW, 17 assertions; the hook previously had no behavioural coverage

## Full roster - all 71 wired hook scripts

Fire column: UserPromptSubmit hooks are measured on 671 genuine prompts / 1231 envelopes; Stop hooks on 386 real stop points; state-gated hooks by primed negative control. Blank = event has no real-traffic population (PreToolUse guards, SessionStart), proven by direct payload probe instead.

| hook | event(s) | runs | fire on real traffic | companion |
|---|---|---|---|---|
| agent-teams-guard.sh | PreToolUse | yes(contention artifact) | - | - |
| api-drift-ack.sh | UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| api-drift-detector.sh | PostToolUse | yes | - | - |
| api-drift-stop.sh | Stop | yes | 0.00% of 386 stop points | - |
| bash-guard.sh | PreToolUse | yes(contention artifact) | - | - |
| beats-rebuild.sh | PostToolUse | yes | - | - |
| beats-staleness-guard.sh | SessionStart | yes | - | - |
| block-clickup-writes.sh | PreToolUse | yes | - | - |
| chrome-tabgroup-clear.sh | PostToolUse | yes | - | - |
| chrome-tabgroup-stop.sh | Stop | yes | 0.00% of 386 stop points | - |
| chrome-tabgroup-track.sh | PostToolUse | yes | - | - |
| claude-surface.sh | SessionStart,UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| cmux-close-guard.sh | PreToolUse | yes | - | - |
| cmux-teammate-shim-heal.sh | SessionStart | yes | - | - |
| codex-failure-watcher.sh | PostToolUse | yes | - | - |
| codex-rescue-guard.sh | PreToolUse | yes | - | - |
| concise-detect-stop.sh | Stop | yes | 3.11% of 386 stop points | - |
| concise-mandate.sh | PostCompact,SessionStart | yes | - | - |
| concise-toggle.sh | UserPromptSubmit | yes | genuine 0.15% / env 0.00% | - |
| consolidate-nudge.sh | SessionStart | yes | - | consolidate-intent.json OK (not load-bearing) |
| content-guard-stop.sh | Stop | yes | 2.07% of 386 stop points | - |
| content-guard.sh | PreToolUse | yes | - | - |
| destructive-confirm-detect.sh | UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| destructive-ops-guard.sh | PreToolUse | yes | - | - |
| fable-orchestrator-guard.sh | PreToolUse | yes | - | - |
| figma-fidelity-arm.sh | PreToolUse | yes | - | - |
| figma-fidelity-stop.sh | Stop | yes | 0.00% of 386 stop points | - |
| grounding-gate.sh | UserPromptSubmit | yes | genuine 1.94% / env 9.83% | grounding-intent.json OK |
| grounding-guard.sh | PreToolUse | yes | - | - |
| hook-registry-guard.sh | PostToolUse | yes | - | - |
| hook-registry-stop.sh | Stop | yes | - | - |
| justify-queue-drain-stop.sh | Stop | yes | 0.00% of 386 stop points | - |
| justify-queue-mandate.sh | SessionStart,UserPromptSubmit | yes | genuine 100.00% / env 100.00% | - |
| justify-source-guard.sh | PreToolUse | yes | - | - |
| justify-watch-guard.sh | SessionStart,Stop | yes | - | - |
| justify-watch-standing-by.sh | Stop,UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| memory-approve.sh | PreToolUse | yes | - | - |
| memory-compact.sh | PostToolUse,SessionStart | yes | - | - |
| memory-nudge.sh | PostToolUse | yes | - | - |
| multiple-choice-detect-stop.sh | Stop | yes | 2.33% of 386 stop points | - |
| multiple-choice-inject-prompt.sh | UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| node-path-default.sh | SessionStart | yes | - | - |
| node-shim-heal.sh | SessionStart,Stop | yes | - | - |
| plan-consistency-lint.sh | Stop | yes | 0.00% of 386 stop points | - |
| push-ahead-check.sh | SessionStart | yes | - | - |
| reflect-nudge.sh | SessionStart | yes | - | - |
| resume-guard.sh | SessionEnd | yes | - | - |
| resume-toggle.sh | UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| route-intent.sh | UserPromptSubmit | yes | genuine 1.04% / env 0.24% | route-intent.json OK |
| screenshot-open-clear.sh | PostToolUse | yes | - | - |
| screenshot-open-mandate.sh | PostToolUse | yes | - | - |
| second-fix-gate.sh | PostToolUse | yes | - | - |
| sidecoach-keyword.sh | UserPromptSubmit | yes | genuine 11.62% / env 1.54% | 3 sidecoach registries OK |
| sidecoach-postresponse.sh | Stop | yes | 0.00% of 386 stop points | - |
| sidecoach-postuserp.sh | UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| sidecoach-preamble.sh | PostCompact,SessionStart | yes | - | - |
| sidecoach-sessionstart.sh | SessionStart | yes | - | - |
| sidecoach-taste-gate.sh | PostToolUse | yes | - | - |
| surface-visual-gate.sh | Stop | yes | 0.00% of 386 stop points | - |
| task-loop-mandate.sh | SessionStart,UserPromptSubmit | yes | genuine 100.00% / env 100.00% | - |
| team-reaper.sh | SessionEnd,SessionStart | yes | - | - |
| teammate-relay-stop.sh | Stop | yes | 0.26% of 386 stop points | - |
| validation-guard.sh | PreToolUse | yes | - | - |
| verify-before-done-stop.sh | Stop | yes | 0.00% of 386 stop points | - |
| verify-before-done.sh | PostToolUse | yes | - | - |
| verify-clear.sh | PostToolUse | yes | - | - |
| verify-manual.sh | UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
| visualizer-guard.sh | PreToolUse | yes | - | - |
| voice-gate.sh | PreToolUse | yes | - | - |
| voice-mandate.sh | PostCompact,SessionStart | yes | - | - |
| voice-toggle.sh | UserPromptSubmit | yes | genuine 0.00% / env 0.00% | - |
