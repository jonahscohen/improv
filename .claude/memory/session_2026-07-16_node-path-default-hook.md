---
name: Bash tool ignored the nvm default (node v12) - FIXED with a SessionStart PATH hook, not a codex shim
description: The Bash tool's non-interactive zsh never sources ~/.zshrc, so `nvm use default` never runs and the harness-built PATH lists nvm dirs ascending -> node v12 wins over the default 20, breaking every global npm CLI (codex first). The specced `codex` PATH shim provably cannot work (no dotfiles dir precedes the real codex at PATH position 8). Fixed instead at the root: claude/hooks/node-path-default.sh (SessionStart) writes an export PATH to $CLAUDE_ENV_FILE making the nvm default the only nvm dir on PATH. node v12.22.12 -> v20.19.6; bare `codex --version` -> codex-cli 0.142.5.
type: project
relates_to: [reference_codex_broken_node12_path.md, session_2026-07-15_codex-node12-fix.md]
author_human: Jonah Cohen
author_model: claude-opus-4.8
source: session
verified: bash -n; live E2E (node v12.22.12 -> v20.19.6, codex SyntaxError -> codex-cli 0.142.5); test-settings-deploy-parity.sh ALL PARITY CHECKS PASSED (21 selections, x3 runs); codex-review.py --smoke HEALTHY (no regression); 3 rounds of real Codex review (6 findings folded, round 3 CLEAN); deactivate 3-branch ownership matrix verified live
confidence: high
---

Spawned-task follow-on to [[session_2026-07-15_codex-node12-fix.md]], which fixed codex-review.py's
own node resolution but left bare `codex` broken from the Bash tool.

## THE TASK'S PREMISE WAS WRONG - and the prior beat already said so

The task asked for a `codex` PATH shim "somewhere already on PATH via the dotfiles symlink,
e.g. alongside the cmux shim". Three facts kill that, all verified live before building:

1. `~/.claude/cmux` is **not on the Bash tool's PATH at all**. It is at PATH position 2 only
   inside a **cmux** session, because cmux INJECTS that dir into the env it launches claude
   with. `claude/cmux/node`'s own header comment says exactly this. It is not a general shim dir.
2. There is **no dotfiles-controlled dir before position 8**, where the real codex lives
   (`~/.nvm/versions/node/v20.19.6/bin/codex`). `~/.local/bin` is at 13. A shim there never wins.
3. [[reference_codex_broken_node12_path.md]] had **already rejected the shim for this exact
   reason** ("a dotfiles shim can't shadow it - the real codex sits at PATH position 8, before
   any dotfiles bin dir at 9+").

Jonah was asked to rule rather than have a broken approach built silently. He chose the
SessionStart hook.

## ROOT CAUSE (reproduced, not theorized)

- The Bash tool runs a NON-interactive zsh. `NVM_DIR` is unset in it -> `~/.zshrc` is **never
  sourced**, so its `nvm use default --silent` never runs. (The Bash tool docs claim "the shell
  is initialized from the user's profile"; that is **false for this harness** - tested, not assumed.)
- The harness builds its own PATH, listing nvm dirs ASCENDING: v12.22.12(5), v18.2.0(6),
  v18.20.0(7), v20.19.6(8). So `node` -> **v12.22.12**.
- `nvm alias default` is **20**. So the machine's own declared default was already correct and
  simply never applied. This was never "codex is broken" - it was "the Bash tool ignores the
  user's nvm default", with codex as the first casualty: `codex` is a symlink in the v20 bin dir
  whose `#!/usr/bin/env node` shebang re-picks v12, and codex 0.142.5's top-level await is a
  parse error on v12 -> `SyntaxError: Unexpected reserved word` at codex.js:188.

**Why:** fixing `node` kills the whole bug class (npm, npx, every global CLI), not one symptom,
and it makes the Bash tool agree with a default Jonah had already set. The reframe is the
finding: the codex-shaped bug was a node-shaped bug.

## THE FIX

`claude/hooks/node-path-default.sh` (SessionStart), base-wired in `claude/settings.json`,
deployed by the **config** component (core tier, alongside startup-check.sh - it is not an app hook).

**How:** SessionStart hooks may append `export` lines to `$CLAUDE_ENV_FILE`, which Claude Code
applies to every subsequent Bash tool call (documented; verified against the hooks doc rather than
trusting the subagent that surfaced it). The hook:
- No-ops silently when the ambient node is already >=16 (the common case; also what keeps it clear
  of the cmux `node` shim).
- Resolves `nvm alias default`, following alias CHAINS (`default -> lts/* -> lts/krypton ->
  v20.19.6`), bounded to 10 hops; version-checks the result; falls back to newest nvm node >=16.
- Rewrites PATH by **REMOVING** every other nvm bin dir. **Never prepends.**
- Prints a clear "no nvm node >=16" message instead of letting a session hit a confusing SyntaxError.

**Why surgery and not a prepend (the non-obvious constraint):** prepending a node dir to the front
of PATH would jump AHEAD of `~/.claude/cmux` inside a cmux session, bypassing `claude/cmux/node` -
the shim that heals a purged NODE_OPTIONS preload at exec time - and reintroducing the recurring
MODULE_NOT_FOUND breakage it exists to prevent. Removal-only preserves every relative order, so
nothing can be jumped ahead of. Found by reading the existing shim's header before writing code.

## VERIFIED (real output, not assumed)

- Live E2E: `node` v12.22.12 -> **v20.19.6**; `codex --version` codex.js:188 SyntaxError ->
  **codex-cli 0.142.5**.
- `test-settings-deploy-parity.sh` -> **ALL PARITY CHECKS PASSED** (21 selections), re-run after
  every install.sh edit.
- `codex-review.py --smoke` -> **HEALTHY** (exit 0): its independent resolution is undisturbed.
- Edge cases: no-op when node>=16; silent exit 0 on missing nvm / unset HOME / unset
  CLAUDE_ENV_FILE; idempotent; clear error when no node>=16 exists; `20` matches v20.19.6 but not
  v200.x; self-referential alias terminates.
- Deactivate ownership matrix, all three branches live: ours -> file+wiring removed; user's own
  same-named file -> BOTH preserved; dangling (wired, no file) -> wiring stripped.

## CROSS-MODEL GATE (3 rounds of REAL Codex - now possible because of this very fix)

Round 1 found **6** issues, 2 High, all genuine and mine:
1. **High** - `node_major` returned empty instead of `-1` on a broken binary (`|| return 0`),
   so `[ "" -lt 16 ]` threw `integer expression expected` and evaluated FALSE - a broken default
   alias would survive the version check and skip the fallback. My own comment promised -1; the
   code didn't deliver it.
2. **High** - deactivate removed the hook file but left its SessionStart wiring -> a dangling
   exit-127 hook. The parity invariant, in the teardown direction.
3. Medium - leading/trailing empty PATH components (= cwd) were dropped.
4. Medium - `set -u` could abort on unset HOME/PATH, violating fail-soft.
5. Medium - symbolic aliases (`lts/*`) not honored. Fixed properly once `~/.nvm/alias/lts/*` was
   confirmed to be a real chain, rather than merely documenting the gap.
Round 2 confirmed all five and found a **new** Medium: the wiring strip was unconditional while
the file removal was ownership-gated, so a user's own same-named hook would keep its file but lose
its wiring. Fixed with a single NP_STRIP ownership decision shared by both. Round 3: **CLEAN**.

Self-caught before any review: an unquoted `export PATH=` would have shredded this machine's PATH,
which contains `/Users/spare3/Library/Application Support/...` - spaces. Hence `printf %q`.
Also confirmed `/usr/bin/env bash` -> `/bin/bash` **3.2** here, so no bash-4 syntax and no
`${arr[*]}`-under-`set -u` trap (no arrays used).

## SELF-ANALYSIS

The two High findings share one failure mode: **I wrote the contract in a comment and then did not
verify the code honored it.** `node_major`'s docstring said "-1 if it will not run" while the body
returned empty; the deactivate comment said "remove it here" while only removing half the install.
Both would have been caught by testing the stated contract instead of reading it back. The
empty-string-vs-integer bug is especially instructive: it fails SILENTLY toward "keep the broken
node", the exact opposite of the fail-safe direction. Lesson: when a helper's contract is a
sentinel value, test the sentinel path explicitly - it is the path that only runs when something
is already wrong. My later regression tests did exactly that, and should have existed first.

Also: I initially mis-tested the empty-PATH-component fix with a harness PATH that omitted `/bin`,
so `bash` itself was not found and the hook never ran - and the empty output briefly looked like a
hook failure. A test that cannot run the thing under test is not evidence. Verified the harness
before trusting its verdict.

## LIVE STATUS

Deployed live: `~/.claude/hooks/node-path-default.sh` -> repo symlink (so a git pull reaches it),
and hand-wired into the drifted live `~/.claude/settings.json` (backup at
`~/.claude/settings.json.pre-nodepath.bak`, JSON validated, 14 SessionStart hooks, all events
intact) following the doctor-hooks precedent - `install.sh --only config` was NOT run against the
real HOME because the live settings are a drifted copy and the merge would have re-added
permissions/plugins.
**Requires a session restart to take effect** (SessionStart hooks fire at session start; this is
not a live-immediately shim). Until then, `node` stays v12 in THIS session's Bash tool.

Files touched: claude/hooks/node-path-default.sh (new), claude/settings.json (SessionStart wiring),
install.sh (CONFIG_HOOKS + deactivate_config NP_STRIP ownership strip),
.claude/memory/reference_codex_broken_node12_path.md (KNOWN-REMAINING corrected).
