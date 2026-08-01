---
name: Why the installer appended already-registered hooks, and the reconciliation that heals it
description: The dedupe check in add() was scoped to a single matcher group, but Claude Code treats an absent matcher, '' and '*' as the same bucket. A hook already wired in an equivalent sibling group was invisible to the check and got appended again. Both copies fixed, plus an end-of-run reconciliation pass that repairs drift from any source.
type: decision
relates_to: [session_2026-07-31_duplicate-hook-registrations-removed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: root cause confirmed against the pre-dedupe backup (every duplicate pair traced to its two group shapes); add() unit-tested for collapse and for preserving genuinely distinct matchers; reconcile tested for collapse, preservation, idempotence and malformed input; installer suites 45 + 26 + 15 all green
confidence: high
---

# Why an already-installed hook got appended again (2026-07-31)

Commit stamp at authoring: e66a1af2.

Jonah: "Why would the installer allow appending of an already existing component?"

## It never meant to. The check was looking in one drawer.

`install_app_hooks` has always had a duplicate guard:

    if not any(x.get('command')==hookobj.get('command') for x in hl): hl.append(hookobj)

`hl` is the hook list of ONE matcher group, chosen by `add()`:

    if matcher is not None: find the group whose matcher == matcher
    else:                   find the group with no 'matcher' key at all

**Claude Code treats an absent matcher, `""` and `"*"` as the same thing.** `add()` treated them
as three separate buckets. So a hook already registered in an equivalent sibling group was
invisible to the check, and got appended into a different group under the same event.

Confirmed against the pre-dedupe backup - every duplicated command traced to two group shapes:

    Stop  concise-detect-stop.sh          ['no-matcher', 'no-matcher']
    Stop  justify-queue-drain-stop.sh     ['no-matcher', '']
    Stop  api-drift-stop.sh               ['', '']

`Stop` alone held ten groups: one with no matcher and four with `""`, plus others. Nothing
reconciled them, so each new group was a fresh hiding place.

**Crucially it is NOT true that any repeated command is a duplicate.** These are legitimate and
were preserved:

    PreToolUse  grounding-guard.sh   ['Bash', 'mcp__claude-in-chrome__|mcp__computer-use__']
    PostToolUse verify-before-done.sh ['Write|Edit|MultiEdit|Bash', 'Read']

Same script, genuinely different trigger sets, both wanted. Any fix keyed on the command alone
would have silently deleted real wiring.

## The fix, in two layers

**1. `add()` normalises and looks across every equivalent group** before appending. There are TWO
copies of this function (`install_app_hooks` and the QA-hook cluster wiring); both had the bug and
both are fixed. Everything except absent/`''`/`'*'` is still compared exactly.

**2. `reconcile_hook_duplicates()` runs at the end of every install.** Layer 1 only protects the
run that is happening. Settings that already drifted stay drifted, and hooks arrive from paths
this installer does not own - hand edits, older installer versions, other tools. Reconciliation
repairs the file whatever wired it, is idempotent, and leaves a malformed settings.json untouched
rather than trying to rewrite it.

The other three merge sites were checked and are NOT affected: the config merge tests the command
as a substring across the whole event, and the memory merge is marker-based.

## Measured on the live file

    102 hook entries, 88 unique  ->  14 hooks registered twice
    five of them fired on every single Stop

It stayed invisible because the Stop guards each claim a flag with `set -o noclobber`, so exactly
one of two concurrent processes can block. The defence that stops a double-block is also what
turned this into wasted work instead of visible breakage.

**My own first dedupe pass was incomplete for the same reason the installer's was:** I keyed
absent-matcher as `'*'` but left `''` as its own key, so three duplicates survived. Fixed by
normalising all three to one bucket - the identical mistake, one layer up, made while fixing it.

## Still open, from Jonah's same message

Two UI asks are NOT done and are not covered here: offering an UPDATE action when an OLD component
version is detected, and displaying a duplicate-but-present component as INSTALLED rather than
offering to install it again. Those live in the component browser's status computation, which has
not been read yet.

## Files touched

- `install.sh` (both `add()` copies, new `reconcile_hook_duplicates` called before the summary)
