---
name: The browser now shows when a deployed build artifact is behind what the repo built
description: Two of Jonah's three UI asks were already satisfied or aimed off target; the third was real. A compiled bundle is copied rather than symlinked, and on 2026-07-31 the served justify bundle was three days behind a committed fix with nothing surfacing it.
type: decision
relates_to: [session_2026-07-31_installer-duplicate-hook-reconciliation.md, session_2026-07-31_cleared-tasks-resurrecting.md]
author_human: Jonah
author_model: claude-opus-5[1m]
source: session
verified: four-state behaviour driven under a fake HOME; 9 cases added to test-component-browser.sh (147 passed, 0 failed); mutation control swapping content comparison for mtime turns the suite red; real machine reports justify|current
confidence: high
---

# Stale-deploy detection (2026-07-31)

Commit stamp at authoring: 96ca97ea.

Jonah asked for three things and invited a judgement on whether they were good UX. Two were not
worth building, and saying so was the useful part.

## "If duplicate component detected, display as INSTALLED" - already true

`is_our_hook` tests the FILE on disk (symlink into the repo, or a byte-identical copy). It never
looks at the registration list, so a double-registered component already reported `active`. After
the reconciliation added earlier the same day, duplicates are collapsed at the end of every run,
so it stops being a reachable state. Building UI for it would have added a surface for a condition
just deleted.

## "If old component detected, offer to UPDATE" - mostly built, and aimed slightly off

`check_updates` and `update_status` already classify the checkout against origin/main.
`verify_installed_skills` already emits `STALE - the installed copy differs from the repo source`.

And the premise does not hold for most components: **all 84 hooks and all 11 installed sidecoach
skill files are SYMLINKS, and a symlink cannot be stale.** A per-component version column would
have been a table of rows that always read "current".

## What was actually broken

`~/.claude/justify/dist` is **73 real files, zero symlinks** - a compiled bundle is copied. On
2026-07-31 that copy was three days old and served a bundle missing a clamp fix that had already
been built and committed. It was caught only by grepping the deployed file by hand, and nothing in
the browser would ever have shown it.

## The fix

`stale_deploys()` in browser-lib.sh, contract mirroring `update_status`: prints `<label>|<state>`
per artifact, state `stale` / `current` / `unknown`, and **unknown is never rounded to current**.
`stale_deploy_summary()` returns names only when something is genuinely stale, so a clean machine
draws no row. The row is separate from the update row because the remedy differs: that one pulls
from origin, this one re-runs the component's deploy.

## CONTENT comparison, never mtime, and this was measured not assumed

At the moment this was written, one justify source file was already NEWER by mtime than the built
bundle **with identical content** - the mutation-test restore had touched it. An mtime signal would
have fired on an unchanged tree, which is precisely the false-fire class this repo has been burned
by. `cmp` answers the only question that matters: is the thing being SERVED the thing that was
BUILT.

That decision is pinned by a test, and the mutation control proves it bites: swapping `cmp -s` for
an `-nt` mtime comparison takes the suite to 146/1.

## Verification

Nine cases added: not-installed stays silent, current, current-draws-no-row, the exact stale
failure, stale-names-the-component, unreadable-source is unknown, unknown-raises-no-row, and the
mtime false-fire guard. **147 passed, 0 failed.** Real machine currently reports `justify|current`.

Also fixed while adding them: the new block used `$HERE`, which this suite does not define. It
produced four failures AND one FALSE PASS - "unknown does not raise the row" passed because the
command errored to empty output rather than because the logic was right. A test that passes for
the wrong reason is the same defect class as the gate that cannot go red.

## Files touched

- `claude/hooks/browser-lib.sh` (`stale_deploys`, `stale_deploy_summary`)
- `install.sh` (`BR_STALE` cached in `_browser_update_refresh`, conditional row)
- `claude/hooks/test-component-browser.sh` (9 cases, above the summary)
