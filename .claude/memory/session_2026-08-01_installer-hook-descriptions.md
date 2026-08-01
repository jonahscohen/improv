---
name: Two-sentence descriptions for all 71 installer hooks
description: Rewrote hook_desc in browser-tree.json so every installable hook says what it does AND why you want it; nine descriptions turned out to be factually wrong, not merely short
type: project
author_human: Jonah
source: session
verified: tests
confidence: high
---

Every installable component in the Improv installer now carries a two-sentence
description. Before: 69 of 71 `hook_desc` entries in
`claude/hooks/browser-tree.json` were a single sentence. After: 0 of 71.

## Pass one was accurate and unusable: the failure was AUDIENCE, not facts

Jonah, reviewing the first pass: "Some of these aren't written for a developer
who doesn't have insight/context to the situation."

Every fact in pass one survived review. Not one correction was reversed. What
failed was who I wrote for: I wrote for someone already inside this project, and
the reader is a developer who just downloaded the installer and has never seen
the repo, the team, or any of our vocabulary.

The specific defect has a name worth keeping: **defining an unknown with another
unknown.** Real examples I shipped:

- "so a beat write never stalls" - they do not know what a beat is.
- "content-guard still runs alongside" - naming a sibling component explains nothing.
- "kicks a debounced background beats.py compile" - internal file, internal concept.
- "Same cadence as task-loop-mandate" - one unknown defined by another unknown.
- "even without a sidecoach verb" - they do not know Sidecoach has verbs.
- "after a compaction" - harness jargon a general developer may not carry.

The rewrite rule: say what the thing IS in the same breath. Not "writes a beat"
but "saves a session note under .claude/memory/". Not "the shell guard fires at
PreToolUse" but "blocks the commit and tells you which file is wrong". Real
paths and real filenames stayed, because those are concrete and checkable; it is
unexplained CONCEPTS that fail, not identifiers.

A mechanical gate now exists for it: a jargon scan over `hook_desc` for
`a beat`, `beats.py`, `content-guard`, `bash-guard`, `sidecoach verb`,
`craft floor`, `compaction` and similar. It went from 12 hits to **0**.

Why I did not catch it myself: I had just spent the whole unit reading 71 hook
headers, so every internal term felt self-evident by the time I wrote. Reading
the source is what makes the facts right and what makes the voice wrong, and
nothing in my process re-read the output as a stranger would. That is the
check to add, not more research.

## Pass one method (facts, unchanged and still correct)

**How:** read the actual hook at `claude/hooks/<name>.sh` before writing about
it, never the name. Most carry a long header comment with a dated incident;
that comment was the source. The second sentence always adds something the
first does not: when it fires, what it catches with a concrete example, the
incident that produced it, or what it costs you when it is off.

**Kept unchanged (already two good sentences):** `concise-mandate`,
`sidecoach-craft-floor`.

## The valuable finding: nine descriptions were WRONG, not merely short

These did not just under-describe their hook. They described behaviour the code
does not have, which is worse than saying nothing - a person reading the
installer would have made a false decision.

1. **`sidecoach-sessionstart`** said "Loads sidecoach context at session start."
   It loads no context at all. It starts the sidecoach daemon in the background
   and writes `~/.claude/.sidecoach-state` for the postuserp/postresponse hooks
   to source. The hook that actually injects PRODUCT.md + DESIGN.md is
   `sidecoach-preamble`, a completely different entry in the same list.

2. **`justify-watch-guard`** said "Keeps the justify watch loop alive." It keeps
   nothing alive. Its own header records that the relaunch behaviour was
   REMOVED on 2026-07-08 because the session-owned relaunch recreated the very
   failure it was meant to fix. It is now a one-line non-blocking advisory.

3. **`grounding-guard`** said "Checks claims against real sources." It checks no
   claims. It DENIES the screenshot/click tools while `grounding-gate` is armed
   until a Read/Grep/Glob lands in the same turn.

4. **`plan-consistency-lint`** said "Checks a plan against the current commit."
   It never looks at a commit. It lints a dispatch-plan doc against ITSELF: a
   file listed under `Owns` that the dispatch prompt omits, or a unit that is
   globally blocked yet told to proceed immediately. The commit-stamp idea comes
   from CLAUDE.md, not from this hook.

5. **`push-ahead-check`** said "Guards against pushing ahead of review." It
   guards nothing and points the other way: it REPORTS commits that were never
   pushed. It never pushes and never blocks.

6. **`model-router-guard`** said "Routes behavior by the session model." Exactly
   inverted. It FORBIDS routing work to another model (fable-router,
   `claude --model`, ANTHROPIC_MODEL, the Agent `model` parameter). A reader
   would have installed a router and got a blocker.

7. **`destructive-ops-guard`** said "Warns before destructive file operations."
   It does not warn, it DENIES; and the ops are infrastructure, not files:
   production deploys, cross-environment database pulls, `gh pr merge`.

8. **`destructive-confirm-detect`** said "Detects unconfirmed destructive
   actions." Inverted. It detects the human's CONFIRMATION word and promotes a
   blocked op to a one-shot approval. It is the only writer of that approval
   flag.

9. **`block-clickup-writes`** said "Blocks ClickUp writes unless confirmed."
   There is no confirm path. Every mutating ClickUp call is permanently denied;
   only the read-only tools pass.

## Lesser corrections folded in

- `memory-approve` said "Guards writes to your beats files." It only ever
  ALLOWS - it is an auto-approve so a beat write never hits a prompt.
- `content-guard-stop` said "Re-checks written content at stop time." It never
  looks at a file; it scans the last CHAT message, which is the blind spot that
  let an emoji reach the terminal on 2026-06-17.
- `verify-before-done` said it "Blocks done." It arms the flag; the blocking is
  done by `verify-before-done-stop` and by bash-guard's commit gate.
- `grounding-gate` said "Requires grounding claims in real evidence," which is
  true of nothing in particular. It detects a build-behavior diagnostic question
  and injects a read-code-first mandate.
- `visualizer-guard` said it gates "for quality + surface." There is no surface
  check anywhere in it; it is a token-contract and a11y check.
- `surface-visual-gate` said "Nudges." It blocks the stop once.

## Stale comment noticed, not fixed

`verify-manual.sh`'s header claims it "also clears on any user message if they
interrupted to manually verify." The code has a closed `case` list only
(verified / looks good / it works / lgtm / all good / bypass verification), so
that second line has been false for a while. Same family as the memory-nudge
header defect recorded on 2026-07-16. Left alone because this unit only owned
the JSON, but it is worth a follow-up.

## The change broke a second suite, and why that suite was right to break

`test-component-browser.sh` (the named gate) stayed green at 147/0 throughout.
`test-browser-render.sh`, which nobody named, went from **146/146** to
**123 passed, 23 FAILED**. Isolated by restoring the pre-change JSON and
re-running: the baseline was clean, so the break was mine.

Two distinct causes, both worth knowing:

1. **Stale literal fixtures.** Eleven assertions pinned the OLD description text
   verbatim (`"Guards writes to your beats files."` and friends), including a
   hardcoded `LONGEST_DESC`. A rewrite of the strings could not do anything but
   fail those.
2. **A layout premise that a two-sentence description invalidates.** The 7
   Beats/Hooks assertions used `assert_row_has`, which requires the needle on the
   SAME LINE as the row. At ~45 chars the old descriptions fit the row's ~52-col
   description column. At ~220 chars they cannot, so the renderer wraps them onto
   continuation lines beneath the row and the same-line assertion can never see
   them again. The comment above that block literally said "each WITH its
   description on the same row", which is now false by design.

Fix: added `assert_row_flow_has` (row line PLUS its continuation lines, up to the
next numbered row, whitespace-normalized). That keeps the per-row binding - the
whole reason `assert_row_has` exists rather than a bare screen search - and only
widens the window from one line to one row block. The cheap fix, a flat
`assert_in_flow` over the capture, would have passed while proving only that the
words appear SOMEWHERE, so it was rejected.

The needles were also changed to each description's **second sentence**. A
first-sentence needle would still pass on a row that lost its second sentence to
truncation, which is exactly the regression worth catching now.

Rendering itself was never broken: the renderer wraps at word boundaries at 60,
80, 100 and 120 columns with nothing amputated. What changed is row height - a
hook row is now 3 to 5 lines at 80 columns instead of 1, and 3 at 120.

Flakiness note: this suite drives a pty and is timing-sensitive. One run under
load produced a HARNESS ERROR with 4 unrelated failures (a drive that captured
nothing). A clean re-run gave ALL 146 PASSED. Judge it on a clean run.

## Verification

- Single-sentence count: 69 of 71 before, **0 of 71** after.
- `json.load` on the file: parses.
- Key set identical before/after: `True`. Key ORDER also identical, and every
  non-`hook_desc` section byte-identical.
- `claude/hooks/test-component-browser.sh`: **147 passed, 0 failed** (same as
  the pre-change baseline).
- No emoji, no emdash, no key renamed, added, removed, or reordered. Longest new
  string is 237 chars, so a two-line row still holds it.

## Files touched

- `claude/hooks/browser-tree.json` (description strings only, across two passes)
- `claude/hooks/test-browser-render.sh` (new `assert_row_flow_has` helper; 11
  fixtures re-pinned, twice, since the text changed under them)

Second-pass mechanics: a concurrent teammate had already re-voiced 15 entries,
so I rewrote the other 54 with targeted per-key edits and left theirs alone
rather than fight over the same lines. One trap worth recording: when
re-pinning the render fixtures by string substitution, a short needle that is a
SUBSTRING of a longer one destroys the longer one's match if replaced first.
Sorting the substitutions longest-first fixes it; the naive order aborted on an
assertion, which is why the script asserts rather than replacing blind.

Not mine: `claude/installer-gui/{index.html,manifest.py,styles.css}` show as
modified in the same worktree, timestamped before this unit started. A
concurrent session owns those.
