---
name: The generated image cache is now gitignored - it is output, not source
description: The image unit's content-addressed cache landed untracked at 2.6MB of generated PNGs. Added to .gitignore before committing so generated assets never enter the repo.
type: project
relates_to: [session_2026-07-29_image-generation.md, session_2026-07-29_both-units-verified-and-committed.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: cache size and contents inspected; .gitignore entry added and staging re-checked
confidence: high
---

# The cache does not belong in the repo (2026-07-29)

While staging the image-generation unit, `git status` showed two untracked cache
directories: `sidecoach/.sidecoach-cache/` at **2.6MB** holding `images/` and `sketches/`,
plus a second under `src/__tests__/fixtures/`.

Neither was in `.gitignore`. A `git add sidecoach/` would have committed several megabytes
of generated PNGs as though they were source, and every subsequent generation would have
dirtied the tree.

Added:

    # sidecoach image cache: generated assets, never source
    .sidecoach-cache/

## Why this is worth a beat rather than a silent fix

It is the same class as the sidecoach `dist/` problem this repo already carries - generated
output living inside the working tree, where a broad `git add` sweeps it in. The install
rehearsal hit the dist version of this a day earlier and had to isolate a build in a clone
specifically because `sidecoach/dist` holds 1205 TRACKED files.

A cache that is content-addressed is deterministic and therefore reproducible, which is
exactly the argument for NOT storing it: it can always be regenerated, and storing it means
every image ever generated is preserved in history forever.

## What caught it

Staging by explicit path rather than `git add -A`, then reading `git status` before
committing. A blanket add would have taken it silently.

## Files touched

- `.gitignore`
