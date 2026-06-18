---
name: Justify queue cleared for already-applied toolkit/hero changes
description: Six queued Justify prompts were already applied in source by a prior session that never POSTed /respond; verified visually and reported done
type: project
---

Collaborator: Jonah Cohen

## What

Cleared a stale Justify queue of six prompts targeting index.html / styles.css
(toolkit eyebrow red, lede + title rewrites, VALIDATE + TUNE and RECORD +
RECALL tags, install-block height + flush red Copy button). All six were
ALREADY applied in source (both files mtime 11:11 today) by a prior session
that never reported back via /respond, so the daemon queue never cleared and
the justify-watch-guard Stop hook kept firing in an unrelated session (the
Wallace Drupal one).

## Why

The watch script's only exit is a task arriving; with an unconsumed queue,
every relaunch exits instantly and the Stop hook loops. The fix is consuming
the queue, not relaunching harder.

## How

- Traced port 4830 to this project (python -m http.server, cwd lookup via lsof).
- Confirmed each prompt's change present in source, then verified rendering in
  Chrome (fresh tab, hero + toolkit screenshots, both Read).
- Sent justify-done for each of the six prompt ids (fills Changes panel,
  clears queue), confirmed /prompts returns [].
- Relaunched ~/.claude/justify-watch.sh in background.

## Failure mode (this session)

First response batch passed only the summary + filesChanged args to
justify-done and left JUSTIFY_CHANGES at its [] default, so every Changes
panel entry rendered "no file changes". Why: I treated the structured changes
array as optional decoration because the helper defaults it, when it is the
payload the panel's diff view renders from - the diff IS the product of this
tool. Fix: re-sent all six responses with JUSTIFY_CHANGES selector/property/
oldValue/newValue arrays (old values reconstructed from prompt contexts +
`git show HEAD:marketing-site/styles.css`), verified in-browser that entries
now show selectors and +N/-N diff chips. Side effect: the panel keeps the
first diff-less batch as separate entries, so six stale duplicates remain
until marked done. Rule going forward: justify-done is incomplete without
JUSTIFY_CHANGES.

## Failure mode (prior session)

(For whichever session applied the changes:) applying Justify edits without
POSTing /respond per promptId leaves the queue full - the Changes panel stays
empty, the user never sees Review, and the watch loop wedges every other
session on this machine. justify-done is part of the task, not optional
bookkeeping.

## Files

- index.html (verified only, not edited this session)
- styles.css (verified only, not edited this session)
