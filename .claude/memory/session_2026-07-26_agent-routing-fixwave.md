---
name: Agent-routing final-review fix wave
description: Single pass folding all 10 findings from the whole-branch review of the agent-routing layer (registration, latency DoS, install deploy modes, six vacuous assertions, type guards)
type: project
relates_to: [session_2026-07-26_agent-routing-task7-codex-fix.md, session_2026-07-26_agent-routing-task6.md]
author_human: Jonah
source: session
verified: tests
confidence: high
---

Final whole-branch review of the `agent-routing` branch returned 10 in-scope findings
(1 critical, 5 important, 4 minor). This beat records the single fix wave that folded
all of them. Items 11-15 (cosmetic) were explicitly out of scope and left alone.

## CRITICAL 1 - route-intent was unregistered; two suites red

`claude/hooks/browser-tree.json` had no `agent-routing` node, so `route-intent` failed
the "in the tree AND deployed by install.sh" managed test at `hook-registry-guard.sh:99`.

Why it mattered beyond a red suite: `NONINTERACTIVE=0` is the default, so a plain
`./install.sh` runs the component browser and exits at `install.sh:3484` without ever
reaching the PICKS apply phase. The browser renders only what `browser-tree.json`
lists. The default install path could not install this cluster at all.

How: added an `agent-routing` bucket node beside `model-routing`, plus a
`hook_desc["route-intent"]` sentence and `hook_owner["route-intent"] = "agent-routing"`.

Verified:
- `hook-registry-guard.sh --audit` now exits 0 with no UNMANAGED line (was: UNMANAGED: route-intent)
- `test-hook-registry.sh` 49/3 -> 52 passed, 0 failed
- `test-component-browser.sh` 138/1 -> 139 passed, 0 failed
- Functional probe through `browser-lib.sh`: `hook_owner route-intent` = `agent-routing`,
  `hooks_owned_by agent-routing` = `route-intent`, leaf path
  `Guardrails/agent-routing/route-intent` - the browser really renders a toggle now.

Files touched: `claude/hooks/browser-tree.json`

## IMPORTANT 2 - quadratic XML scrub was a latency DoS

`route-intent.sh` scrubbed quoted XML with `<([a-zA-Z][\w-]*)\b[^>]*>.*?</\1>`. The
backreference defeats the regex engine's prefix optimization, so every opening tag with
no matching close makes the lazy `.*?` walk to end of string. Void markup (`<br>`,
`<img>`) is the common case in a pasted HTML snippet. Reproduced through the live hook,
against a `timeout: 5` in cluster-wirings.json:

| paste | before | after |
|---|---|---|
| `<br>` x5,000 (19 KB) | 0.33 s | 0.04 s |
| `<br>` x20,000 (78 KB) | 3.82 s | 0.04 s |
| `<br>` x40,000 (156 KB) | 14.94 s | 0.02 s |

How, both halves:
- bail before any scrub on `len(prompt) > 20000` - a prompt that long is never a routing
  candidate, and the scrub is superlinear in input length
- bound the gap: `.{0,2000}?`. This is what protects inputs UNDER the bail; measured
  separately at 4,900 `<br>` (19.6 KB, just under the cap) at 0.08 s.

A quoted XML body longer than 2000 chars is simply not scrubbed now. That costs at most
one wrong advisory line, which is the cheapest failure this hook has.

## IMPORTANT 3 - lexicon and roster dangled on a throwaway-clone install

`install.sh` deployed `route-intent.json` and the three `claude/agents/*.md` with raw
`ln -sf`, while `route-intent.sh` one line earlier used `link_or_copy`. `hook_deploy_mode`
returns `copy` for a repo in a temp location, so after
`git clone /tmp/improv && ./install.sh && rm -rf /tmp/improv` the hook survived as a real
file while its lexicon and roster became dangling symlinks. `[ -f "$LEXICON" ] || exit 0`
then fires forever and `Agent(subagent_type: quick-answer)` cannot resolve. Silent and
permanent.

How: added `link_or_copy_data()` beside `link_or_copy()` - the same symlink-vs-copy
decision, minus the source and destination chmod (data files are read, never exec'd), plus
`backup_if_exists` on both branches. Routed all four files through it.

Verified by an actual throwaway-clone install into a fake HOME, run TWICE: once with
`install.sh` from HEAD as a control, once with the fix.
- control: `route-intent.json`, `quick-answer.md`, `sonnet-impl.md`, `opus-executor.md`
  all DANGLING after the clone was deleted
- fixed: all four are real files
- and the deployed hook then routed end-to-end with no repo on disk at all, returning the
  Explore nudge for a sweep prompt

## MINOR 9 - roster deploy had no ownership check

`ln -sf` silently replaced a user's own `~/.claude/agents/quick-answer.md`. Covered by the
same `link_or_copy_data` change: `backup_if_exists` runs before the replace. Verified by
planting `MY OWN AGENT - do not clobber` at that path and confirming the content landed in
`$REPO_DIR/.backups/<timestamp>/`.

## MINOR 8 - deactivate_cluster leaked the lexicon and roster

`deactivate_cluster` iterates `cluster_hooks`, which only knows `.sh` members, so the
lexicon and three roster files survived cluster removal.

How: added `rm_data_if_ours()` (the data counterpart of `rm_hook_if_ours`: removes only a
symlink into the repo - dangling ones included - or a byte-identical copy) and an
`agent-routing` data-cleanup block in `deactivate_cluster`, mirroring what
`deactivate_sidecoach` does for its own registries.

Verified by extracting the real functions from `install.sh` and running them against a real
deployed tree: our four files were removed, and on a second pass a user's OWN
`quick-answer.md` and `route-intent.json` survived with content intact while our repo
symlink was removed.

Suites after this unit: route-intent 30/30, hook-registry 52/0, component-browser 139/0,
plus the adjacent installer suites (install-hook-deploy 26/0, apply-plan 33/0,
browser-render 146/0, app-hook-offlist 36/0, apply-pending 33/0, installer-manifest pass).

Files touched: `claude/hooks/route-intent.sh`, `install.sh`

## MINOR 10 - lexicon type guards

`route-intent.sh` iterated `tier["patterns"]` and `exempt` without checking either is a
list. A STRING iterates character by character and every single character is a valid
regex, so a malformed `opus_executor` tier matched nearly every prompt and routed the
whole session to the most expensive model. `isinstance(..., list)` guards on both.

## MINOR 7 - bare word matches in the most expensive tier

`\brefactor\b` and `\bredesign\b` fired on discussion as readily as on instruction.

How: both now require an IMPERATIVE shape - the verb at a clause boundary (string start,
sentence punctuation, or after and/then/please/now/also/next) AND a determiner-led
object. Recorded the rule as `_meta.imperative_shape` in the lexicon so a future editor
adding a bare verb to this tier sees the constraint, plus `_meta.bounded_quantifiers`
carrying forward the IMPORTANT 2 lesson.

Nine cases checked: 4 imperatives still route (including mid-sentence, "clean up the
imports and refactor the parser module"), 5 non-imperatives now stay silent
("do not refactor it", "i hate the redesign we shipped last quarter", "should we
refactor this or leave it alone", "the refactor we did last sprint", "whether a redesign
is even worth the effort").

## IMPORTANT 4a, 4b, 5, 6 - the test suite

The branch had shipped six assertions that passed with their feature deleted. Every
correction here was mutation-proved: break the feature in a temp repo copy, watch the
specific assertion fail, restore.

- **4a (code fence).** The old prompt ended with `does that look right to you or not`,
  which is an exempt pattern, and the inline-backtick scrub already ate triple-backtick
  fence bodies. Fixed by dropping the exempt phrase and giving the fence body an ODD
  number of backticks. That parity is the whole trick and is now commented in place: a
  fence contributes an even six backticks, so an even body count leaves everything
  paired and the inline scrub alone eats it. Split into TWO cases, since the backtick
  fence and the tilde fence are separate scrub lines.
- **4b (escalation).** `update every reference` supplies ZERO filler characters to a
  pattern needing 2-40, so the prompt only ever matched one tier. `update every
  remaining reference` hits both.
- **5 (stderr).** Every call site ran `2>/dev/null`. Replaced with a `run_hook_raw`
  helper capturing stdout, stderr and rc into globals, and all three are now asserted.
  For the >1MB ARG_MAX case the reviewer flagged: handled in the BASH wrapper with a
  100000-character guard on the raw stdin, because the in-python bail cannot help when
  python3 is never reached. 100000 is 5x the in-python prompt cap.
- **6 (installer).** `grep -q 'agent-routing' install.sh` matched DESCS prose, a comment
  and help text. Replaced with assertions that lift the REAL `cluster_hooks()` out of
  install.sh and run it, and that read the REAL deploy and deactivate blocks.

### Two things the mutation testing caught that the review did not

1. **A comment can satisfy a structural assertion.** The first version of the
   "no bare `ln -sf`" assertion failed on the freshly-written comment *explaining* the
   `ln -sf` bug. Which means the sibling `assert_block_has` checks would equally have
   passed on a comment alone - a seventh vacuous assertion, in the commit fixing the
   other six. Blocks are now comment-stripped before any assertion runs.

2. **The two latency guards mask each other, so neither is individually observable in
   wall-clock time.** Measured on the 78 KB payload: intact 0.06s; length bail removed
   but span still bounded 0.27s; span unbounded but bail still present 0.06s; BOTH
   removed ~3.8s. A timing test catches the pair and neither half. Also, the 156 KB case
   never reaches python at all - the bash guard stops it - so it proved nothing about
   the in-python bail. Resolved by testing all THREE size bands (>100000 chars bash
   guard, >20000 chars python bail, <=20000 chars bounded scrub) and adding a structural
   assertion per guard alongside the behavioral timing backstop.

3. **The first mutation attempts were themselves invalid, and reported all-clear.**
   Deleting a scrub line broke the `scrubbed = ...` assignment chain, so the resulting
   NameError was swallowed by the hook's own fail-open and every mutant looked like it
   passed. Separately, mutant copies placed in `/tmp` resolved `HOOK_DIR` to `/tmp` and
   exited at the missing-lexicon guard before running any logic at all. Both produced a
   false green. Mutations are now NEUTRALIZED in place rather than deleted, and run
   against a full temp repo copy so `HOOK_DIR` resolves correctly.

   The lesson generalizes past this repo: a mutation test needs its own sanity check.
   "The mutant passed" and "the mutation never applied" are indistinguishable from the
   outside, and the second is the more likely of the two. Confirm the mutant actually
   differs, and prefer a mutation that cannot break the surrounding code by construction.

**Why this happened (self-analysis):** both misses come from the same failure mode -
asserting that a *string is present* rather than that a *behavior holds*, and then not
asking "what would have to change for this to fail?" The original six vacuous assertions
were the same mistake. The mutation step is what converts an assertion from a claim into
evidence, and it is not optional for anything that reads as a grep.

### Mutation proofs, all 13

| Mutation | Assertion that failed |
|---|---|
| neutralize the triple-backtick scrub | pattern inside a triple-backtick fence does not route |
| neutralize the tilde scrub | pattern inside a tilde fence does not route |
| reverse `escalation_order` | multi-tier prompt escalates to opus-executor (+2) |
| remove the bash ARG_MAX guard | paste past ARG_MAX is silent on BOTH streams |
| remove the in-python length bail | the in-python length bail is present |
| unbound the XML scrub span | the XML scrub quantifier stays bounded |
| remove BOTH latency guards | 78 KB timing case + both structural |
| restore bare refactor/redesign | the 3 imperative-shape negatives |
| drop the `patterns` isinstance guard | a string patterns value does not hijack routing to opus |
| drop the `exempt` isinstance guard | a string exempt value does not silence every prompt |
| delete `agent-routing)` from cluster_hooks | cluster_hooks() returns route-intent.sh |
| revert data deploy to `ln -sf` | both deploy-mode assertions |
| remove the deactivate data block | both deactivate assertions |

Suite went 30 -> 49 assertions, all green.

Files touched: `claude/hooks/test-route-intent.sh`, `claude/hooks/route-intent.sh`,
`claude/hooks/route-intent.json`

## Codex cross-model review round (gate per the produce-and-verify mandate)

The `codex:codex-rescue` agent was BLOCKED for review intent by the harness, correctly:
it can silently downgrade to a same-model self-review when codex is slow (precedent
`session_2026-06-30_codex-rescue-silent-downgrade`). Used the deterministic wrapper
instead - `git diff <base> | ~/.claude/hooks/codex-review.py "<prompt>" -C <repo>` -
which returned a real Codex verdict in 274s (codex-cli 0.142.5). Five findings.

Three folded, two refuted as pre-existing repo-wide convention rather than defects
introduced here:

- **FOLDED - regex false positive AND false negative.** `please` was a boundary token
  of its own, so `should we please refactor the parser module or wait` routed to the
  most expensive tier; and `can you refactor the parser module` did NOT route, which is
  the single most common phrasing of a real request. Fix: softeners moved INSIDE the
  optional group (`(?:(?:can|could|would|will) you\s+)?(?:please\s+)?`) so they can
  follow a boundary but never be one. Re-validated against 12 cases, 0 failures.
- **FOLDED - stdout was still command-substituted.** `$(...)` strips trailing newlines,
  so a hook emitting only `\n` would satisfy every "no output" assertion. Both streams
  are file-backed now and compared by BYTE COUNT. Mutation-proved by making the hook
  echo a bare newline: five assertions fail; before this they all passed.
- **FOLDED - the length-bail assertion was structurally weak.** A grep for
  `if len(prompt) > N:` still passes if the body stops exiting. Replaced with a
  BEHAVIORAL assertion: a 25 KB prompt whose opening words route to opus-executor on
  their own must be silent. Mutation-proved twice - once removing the bail, once
  neutering its body to `pass`. The old grep caught only the first.
- **REFUTED - `rm_data_if_ours` will not remove a symlink pointing outside the current
  `$REPO_DIR`.** True, and deliberate: that target is indistinguishable from a link the
  user made into their own dotfiles, and guessing wrong deletes their file.
  `is_our_hook` has made the identical trade since it was written. The CODE was right;
  my COMMENT overclaimed ("dangling ones included, which is how a dead throwaway-clone
  install gets cleaned up") and has been corrected to state the limit explicitly.
- **REFUTED - `link_or_copy_data` replaces a user's own SYMLINK without a backup.**
  True, but `backup_if_exists` ignores symlinks BY DESIGN, and `link_or_copy` carries an
  explicit comment saying so. Changing it for data files alone would make the two
  helpers disagree. This is a repo-wide policy question, not a defect in this diff, and
  it is out of scope for a fix wave. Flagged, not changed.

## Harness note - a beat written via Bash does not discharge the dirty flag

Hit while committing this beat: `bash-guard.sh:1583` blocked the commit with "beats are
dirty" even though the beat had just been written. Root cause is a writer/detector path
split, not a stale flag - `memory-nudge.sh` sets `~/.claude/.memory-dirty.<session>` on a
project-file edit and clears it when it OBSERVES a beat write, and it observes Write/Edit
tool calls. The last section here was appended with a `python3` heredoc through Bash, so
the detector never saw it and the flag stayed armed.

Not a hook defect - the gate did exactly what it is for, and failing open would be worse.
Worth knowing as a working rule: **write beats with the Write/Edit tools, not by scripting
the file from Bash**, or the commit gate will not clear. Flagged to the lead in case the
detector should also watch Bash-side writes under `.claude/memory/`.

## Out of scope, untouched

Cosmetic items 11-15 from the review, per the brief: `{0,40}` pattern widening, the
whitespace-prompt vacuous half, line 62/64 redundancy, `command -v python3` guard,
redundant `re.I`.
