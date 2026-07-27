---
name: ampersand self-heal shipped, plus the installer data-file and skills coverage gaps closed - scope grew mid-flight from a duplicate dispatch to owning the whole installer registration subsystem
description: Started as a duplicate ampersand dispatch (edits reverted after taking a sibling suite 74/0 to 73/1), then took ownership of the full surface on a lead ruling. Delivers the thin-shim split, a shared zshrc_block_delete that ends three classes of destructive range-delete against the user's .zshrc, the hook_data_files companion-deploy table, and negatives built FROM the table. Nine Codex findings folded, three of them High.
type: project
relates_to: [session_2026-07-27_ampersand-selfheal.md, session_2026-07-27_teammate-collision-ruling.md]
author_human: Jonah
author_model: claude-opus-5
source: session
verified: seven suites green (52/PASS/139/26/parity/98/35); every new assertion negative-controlled against a purpose-built mutant and watched RED; Codex cross-model review at reasoning-effort high
confidence: high
---

# ampersand self-heal + installer coverage closure (2026-07-27)

Collaborator: Jonah. This unit changed shape twice. It is recorded in the order it
happened, because both turns are the lesson.

## Verification baseline (Team Rule 9)

| suite | before | after |
|---|---|---|
| test-hook-registry.sh | 52 passed, 0 failed | 52 passed, 0 failed |
| test-installer-manifest.sh | PASS | PASS |
| test-component-browser.sh | 139 passed, 0 failed | 139 passed, 0 failed |
| test-install-hook-deploy.sh | 26 passed, 0 failed | 26 passed, 0 failed |
| test-settings-deploy-parity.sh | ALL PARITY CHECKS PASSED | ALL PARITY CHECKS PASSED |
| test-ampersand-shim.sh | 74 passed (mid-flight, sibling-authored) | **98 passed, 0 failed** |
| test-hook-data-parity.sh | 24 passed (mid-flight, sibling-authored) | **35 passed, 0 failed** |

`hook-registry-guard.sh --audit`, `--audit-data` and `--audit-skills` all exit 0.
`test-ampersand-shim.sh --negative-control` reports 26 assertions failing against
install.sh as of HEAD, so the suite is provably load-bearing rather than decorative.

## Turn 1 - dispatched as a duplicate, edits reverted

The brief described HEAD `e42b9a57`. That was already false: the working tree held the
finished thin-shim split and the `hook_data_files()` table, and
`claude/hooks/test-ampersand-shim.sh` - the exact deliverable - appeared on disk at
06:28:15 mid-session, written by a third agent.

Three install.sh edits made before that surfaced took the sibling suite **74/0 to 73/1**.
Mechanism worth keeping: that suite builds its harness by extracting functions out of
install.sh with `awk '/^deactivate_ampersand\(\) \{/,/^\}/'`, so a helper hoisted to file
scope is invisible to the extract and the extracted copy dies on "command not found".
All three edits were reverted and 74/0 restored before reporting.

## Turn 2 - lead ruling, scope expanded

The lead assigned this session the whole contended surface (install.sh, browser-tree.json,
hook-registry-guard.sh, hook-registry-stop.sh, both new suites, bin/ampersand) and the
full coverage-closure scope, with `claude/hooks/agent-teams-guard.sh` explicitly hands-off
(owned by `panespawn`, which was live in it). Work resumed on that basis.

Two agents remained active in these files throughout. That is visible in the result and is
not hidden here: the sibling generalised the guard idiom to marker ranges while this
session was writing the vanity-block guard, and independently added the `declare -f`
extraction assertion. The combined state is better than either half; the process was still
wrong, and the ruling names why.

## What shipped

**1. The thin shim.** `~/.zshrc` gets a stable launcher that locates the repo and hands
off to `bin/ampersand`. Behaviour lives in the repo, so it ships by `git pull` and the
.zshrc never needs another migration. All four reproduced failure classes verified in a
sandbox: no ampersand at all, baked path missing, exec bit stripped, pull failure.

Class (b) design choice: the shim SEARCHES (`$IMPROV_DIR`, the hint baked at write time,
then six usual clone paths) and only then fails loudly with three named recovery routes.
Searching beats reporting because the second machine is exactly where a single baked path
is wrong, and a bare `cd` failure is indistinguishable from "nothing happened".

**2. `zshrc_block_delete` - one primitive, seven call sites.** Every range-delete against
the user's `.zshrc` now addresses by VERIFIED LINE NUMBER and refuses malformed input.
`sed -i.bak '/begin/,/end/d'` destroyed shell config three separate ways, and every site
removed its `.bak` on the very next line:
- no end marker at all: the range runs to END OF FILE;
- two begins and one end: deletes from the FIRST begin through the LAST end, taking
  unrelated user config in between (a guard proving only "some end after some begin"
  does NOT catch this - that was Codex High #1 against my own first guard);
- unanchored regex: a marker quoted in a comment counts as a boundary.
Matching is whole-line after trimming trailing whitespace and CR, so CRLF files work.
Two previously unguarded sites Codex found - `deactivate_voice_output` and
`deactivate_cmux` - now route through it too.

**3. Duplicate blocks converge (Codex High #3).** `is_current_format` now requires
EXACTLY ONE block. zsh executes the whole file, so a current block plus a stale one runs
whichever is LAST; the old check asked only whether any block carried the marker and
reported everything fine while the broken launcher was live. That is the original
"nothing happened" bug reintroduced by its own fix.

**4. Companion data files.** `hook_data_files()` plus `install_hook_data` deploy
`grounding-intent.json` and `consolidate-intent.json`, which were never deployed at all.
Both consumers guard on `[ -f "$INTENT_FILE" ] || exit 0`, so they installed, looked
present, and did nothing, silently, forever - the identical shape to the route-intent.json
defect of 2026-07-26. `install_hook_data` also no longer returns non-zero on a missing
companion, which under `set -e` aborted the whole installer mid-run (Codex Medium).

**5. Skills.** `consolidate` and `tilt-lab` are deployed (install.sh:3938, 5243).

**6. bin/ampersand.** chmod +x, and the installer now warns loudly when the launcher is
absent instead of silently degrading to the inline fallback.

## Codex review - nine findings, all folded

Cross-model review (`codex-cli 0.142.5`, reasoning-effort high, 217s) against the whole
unit. Three High, four Medium, two Low. Every one folded, then the whole unit re-verified:

| # | Sev | Finding | Fold |
|---|---|---|---|
| 1 | High | Guard passed on unclosed-begin-then-complete-block; sed ate config between | line-number pairing in `zshrc_block_delete` |
| 2 | High | `deactivate_voice_output` / `deactivate_cmux` still deleted unguarded | routed through the primitive |
| 3 | High | Current + stale duplicate reported OK while zsh ran the stale one | `is_current_format` requires exactly one block |
| 4 | Med | Substring marker matching; CRLF `}` refused | whole-line match after trimming `[ \t\r]+$` |
| 5 | Med | `install_hook_data` could abort the installer under `set -e` | explicit if/else + `return 0` + warn |
| 6 | Med | Generated zsh embedded `$REPO_DIR` unescaped | escape `\`, `$`, backtick, `"` in that order |
| 7 | Med | Parity check satisfied by a filename in a COMMENT or in `FILES[]` | scoped to the table body; bespoke deploys declared in `hook_data_bespoke` |
| 8 | Low | Default-arm test pinned output, not the arm | renamed to what it proves + explicit arm check |
| 9 | Low | Extraction brittle and could pass vacuously | `declare -f` assertion on the extracted lib |

## Negatives built FROM what was added

The standing lesson (and the lead's explicit instruction): a green suite that predates
the change proves only that yesterday's cases still pass. Every new assertion was watched
RED first, against purpose-built mutants:

- naive unguarded range sed -> **6 red**, including "user config below survives"
- old "any block carries the marker" freshness check -> **3 red**, including "the
  surviving launcher works"
- table default arm returning non-empty -> **3 red**
- a table arm pointing at the wrong companion -> **2 red**
- guards removed from install.sh -> **7 red** of the 11 launcher/guard rows
- `M8`/`M9` added for the case none of `M1`-`M4` covered: a hook with NO companion must
  stay GREEN, or the guard fires on nearly every hook, gets read as noise, and is ignored

## Self-analysis

**Turn 1.** I checked the file CONTENT and never its mtime. `git status` reported
install.sh modified in my first tool call and I read that as leftover rather than as a
possible live writer. `coverage` caught the identical collision with one `stat`, run
twice. Content answers "what does this say"; only a repeated mtime answers "is anyone
writing this now". Rule carried forward: before editing any file `git status` already
reports modified, stat it twice.

**Turn 2.** I hoisted a helper to file scope without checking who consumed the function I
was changing, and a sibling's extraction-based harness went red. The fix was not to
contort the code around the harness but to make the harness follow the code and assert
what it sourced. Worth stating plainly: my own first guard was WRONG in the same way the
code it replaced was wrong - it proved "an end exists somewhere after a begin", which is
not the same as "this block is well-formed". Codex caught it. A guard against data loss
deserves a stricter proof than the intuition that produced it.

**Process note.** A bash quirk cost real time and is worth recording: a single apostrophe
in a COMMENT inside a quoted heredoc nested in `$( ... )` breaks bash's command-substitution
lexer and surfaces as "unexpected EOF while looking for matching `)`" pointing at the
heredoc's opening line. The comment in that block now says so.

## Files touched

- `install.sh` - `zshrc_block_delete` primitive; seven delete sites routed through it;
  `is_current_format` exactly-one-block; `install_hook_data` set -e safety + warn;
  shim path escaping; bin/ampersand presence warn + chmod; dead `zshrc_range_closed`
  removed (superseded, with a note saying why).
- `claude/hooks/test-ampersand-shim.sh` - `A_unclosed` fixture; `part4` (launcher
  contract + destructive-delete guard); duplicate-block convergence case.
- `claude/hooks/test-hook-data-parity.sh` - SECTION 1b (the table executed, not parsed,
  including the default arm); registry-derived expectations; scoped UNDEPLOYED check plus
  a new UNTABLED row; `M8`/`M9`.
- `claude/hooks/browser-tree.json` - `hook_data_bespoke` declaring sidecoach, whose
  companions ship through its own registry loop (install.sh ~5090) by design.
- `bin/ampersand` - mode 644 -> 755.
- `.claude/memory/MEMORY.md` - pointer.

Not done, deliberately: no commit. `claude/hooks/agent-teams-guard.sh` untouched
(`panespawn` owns it and was live in it). `test-bin-parity.sh` and
`test-settings-wire-parity.sh` untouched - `coverage` owns those and was running its own
Codex review against them.
